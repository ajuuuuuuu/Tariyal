import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const personInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  gender: z.enum(["male", "female", "other"]).optional(),
  birthDate: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  biography: z.string().optional().nullable(),
});

const addRelativeSchema = z.object({
  personId: z.string().min(1),
  action: z.enum(["descendant", "father", "mother", "brother", "sister", "wife", "husband"]),
  person: personInputSchema,
});

export const addFamilyRelative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => addRelativeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (roleError) throw roleError;

    const roles = (roleRows ?? []).map((row) => row.role);
    const isVisitorOnly = roles.length > 0 && roles.every((role) => role === "visitor");
    const canAddFamily = !isVisitorOnly && (roles.length === 0 || roles.includes("member") || roles.includes("admin"));

    if (!canAddFamily) {
      throw new Error("You need a family member account to add relatives.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const MAIN_FAMILY = "hawthorne";

    const makeId = (prefix: string) =>
      prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const { data: currentPerson, error: personError } = await supabaseAdmin
      .from("persons")
      .select("id,name,gender,family_group")
      .eq("id", data.personId)
      .single();

    if (personError) throw personError;

    const { data: relRows, error: relError } = await supabaseAdmin
      .from("relationships")
      .select("id,person1_id,person2_id,type,sort_order");

    if (relError) throw relError;

    const relationships = relRows ?? [];

    // Member additions ALWAYS happen from within a personal/switch tree
    // view (the UI hides these buttons in the main tree for non-admins).
    // So every relative a member adds must land in a personal group and
    // never in MAIN_FAMILY — otherwise the new node leaks into the main
    // tree (bug: Kamla's mother appearing in main tree) or disappears
    // from the personal tree that's being viewed (bug: Sushmi's brother
    // missing after prior edits promoted her group to MAIN).
    //
    // If the focal person already lives in some personal group (their own
    // or e.g. her husband's `personal-{husbandId}`), reuse that same group
    // so the new node shows up in the exact tree the member is looking at.
    // Otherwise, fall back to the focal person's own `personal-{id}` group.
    const personalGroupFor = (person: { id: string; family_group: string | null }) => {
      if (person.family_group?.startsWith("personal-")) return person.family_group;
      return `personal-${person.id}`;
    };

    const parentSiblingGroupFor = personalGroupFor;

    const createPerson = async (gender: "male" | "female" | "other", familyGroup: string) => {
      const id = makeId("p");
      const { data: created, error } = await supabaseAdmin
        .from("persons")
        .insert({
          id,
          name: data.person.name,
          gender,
          birth_date: data.person.birthDate || null,
          death_date: data.person.deathDate || null,
          photo_url: data.person.photoUrl || null,
          biography: data.person.biography || null,
          family_group: familyGroup,
        })
        .select("id")
        .single();

      if (error) throw error;
      return created.id;
    };

    const createRelationship = async (person1Id: string, person2Id: string, type: "parent" | "spouse") => {
      const { error } = await supabaseAdmin.from("relationships").insert({
        id: makeId("r"),
        person1_id: person1Id,
        person2_id: person2Id,
        type,
        sort_order: 0,
      });

      if (error) throw error;
    };

    if (data.action === "descendant") {
      const familyGroup =
        currentPerson.family_group && currentPerson.family_group !== MAIN_FAMILY
          ? currentPerson.family_group
          : `personal-${currentPerson.id}`;
      const childId = await createPerson(data.person.gender ?? "male", familyGroup);
      await createRelationship(currentPerson.id, childId, "parent");
      return { id: childId };
    }

    if (data.action === "father" || data.action === "mother") {
      const parentId = await createPerson(
        data.action === "father" ? "male" : "female",
        parentSiblingGroupFor(currentPerson),
      );
      await createRelationship(parentId, currentPerson.id, "parent");
      return { id: parentId };
    }

    if (data.action === "brother" || data.action === "sister") {
      const siblingId = await createPerson(
        data.action === "brother" ? "male" : "female",
        parentSiblingGroupFor(currentPerson),
      );
      const parentRelationships = relationships.filter(
        (relationship) => relationship.type === "parent" && relationship.person2_id === currentPerson.id,
      );

      for (const parentRelationship of parentRelationships) {
        await createRelationship(parentRelationship.person1_id, siblingId, "parent");
      }

      return { id: siblingId };
    }

    if (data.action === "wife" || data.action === "husband") {
      const spouseId = await createPerson(
        data.action === "wife" ? "female" : "male",
        personalGroupFor(currentPerson),
      );
      await createRelationship(currentPerson.id, spouseId, "spouse");
      return { id: spouseId };
    }

    throw new Error("Unsupported family action.");
  });

const deleteRelativeSchema = z.object({
  personId: z.string().min(1),
});

/**
 * Delete a person that a family member added inside a personal/birth tree.
 * Guardrails (enforced server-side even though the UI also checks):
 *  - Caller must be a member or admin (not visitor-only).
 *  - Target person's family_group must start with `personal-` (i.e. lives in
 *    someone's personal/birth tree — never the main family).
 *  - Target person must NOT be the root of that personal group (the person
 *    whose id is embedded in the group name — usually the wife/daughter).
 *  - Target person must have no children (no dangling subtree).
 */
export const deleteMemberAddedPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteRelativeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw roleError;

    const roles = (roleRows ?? []).map((row) => row.role);
    const isVisitorOnly = roles.length > 0 && roles.every((role) => role === "visitor");
    const canManage = !isVisitorOnly && (roles.length === 0 || roles.includes("member") || roles.includes("admin"));
    if (!canManage) throw new Error("You need a family member account to delete relatives.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: targetError } = await supabaseAdmin
      .from("persons")
      .select("id,family_group")
      .eq("id", data.personId)
      .single();
    if (targetError) throw targetError;

    const isAdmin = roles.includes("admin");
    if (!isAdmin) {
      const group = target.family_group ?? "";
      if (!group.startsWith("personal-")) {
        throw new Error("Members can only delete relatives inside a personal family tree.");
      }
      if (group === `personal-${target.id}`) {
        throw new Error("The main person of a personal tree cannot be deleted here.");
      }

      const { data: children, error: childError } = await supabaseAdmin
        .from("relationships")
        .select("id")
        .eq("type", "parent")
        .eq("person1_id", target.id)
        .limit(1);
      if (childError) throw childError;
      if ((children ?? []).length > 0) {
        throw new Error("Remove this person's children first.");
      }
    }

    const { error: delError } = await supabaseAdmin
      .from("persons")
      .delete()
      .eq("id", data.personId);
    if (delError) throw delError;

    return { ok: true };
  });
