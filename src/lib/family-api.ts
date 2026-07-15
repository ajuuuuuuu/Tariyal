import { supabase } from "@/integrations/supabase/client";
import type { Person, Relationship, Gender } from "./family-data";

function rowToPerson(r: {
  id: string;
  name: string;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  family_group: string;
  photo_url?: string | null;
  biography?: string | null;
}): Person {
  return {
    id: r.id,
    name: r.name,
    gender: r.gender as Gender,
    birthDate: r.birth_date ?? undefined,
    deathDate: r.death_date ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    biography: r.biography ?? undefined,
    familyGroup: r.family_group,
  };
}

function rowToRel(r: {
  id: string;
  person1_id: string;
  person2_id: string;
  type: string;
  sort_order?: number | null;
}): Relationship {
  return {
    id: r.id,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    type: r.type as "parent" | "spouse",
    sortOrder: r.sort_order ?? 0,
  };
}

export async function fetchFamily(): Promise<{
  persons: Person[];
  relationships: Relationship[];
}> {
  const [{ data: pData, error: pErr }, { data: rData, error: rErr }] =
    await Promise.all([
      // Only load essential columns - no images or biography
      supabase.from("persons").select("id,name,gender,birth_date,death_date,family_group"),
      supabase.from("relationships").select("id,person1_id,person2_id,type,sort_order"),
    ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  return {
    persons: (pData ?? []).map(rowToPerson),
    relationships: (rData ?? []).map(rowToRel),
  };
}

function makeId(prefix: string) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function addPerson(p: Omit<Person, "id">): Promise<Person> {
  const id = makeId("p");
  const { data, error } = await supabase
    .from("persons")
    .insert({
      id,
      name: p.name,
      gender: p.gender,
      birth_date: p.birthDate || null,
      death_date: p.deathDate || null,
      photo_url: p.photoUrl || null,
      biography: p.biography || null,
      family_group: p.familyGroup || "hawthorne",
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function updatePerson(id: string, patch: Partial<Person>) {
  const { error } = await supabase
    .from("persons")
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.gender !== undefined && { gender: patch.gender }),
      ...(patch.birthDate !== undefined && { birth_date: patch.birthDate || null }),
      ...(patch.deathDate !== undefined && { death_date: patch.deathDate || null }),
      ...(patch.photoUrl !== undefined && { photo_url: patch.photoUrl || null }),
      ...(patch.biography !== undefined && { biography: patch.biography || null }),
      ...(patch.familyGroup !== undefined && { family_group: patch.familyGroup }),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePerson(id: string) {
  const { error } = await supabase.from("persons").delete().eq("id", id);
  if (error) throw error;
}

// Load photo URL for a specific person (lazy-loaded)
export async function fetchPersonPhoto(id: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("persons")
    .select("photo_url")
    .eq("id", id)
    .single();
  
  if (error || !data) return undefined;
  return data.photo_url ?? undefined;
}

export async function addRelationship(r: Omit<Relationship, "id">) {
  const id = makeId("r");
  const { error } = await supabase.from("relationships").insert({
    id,
    person1_id: r.person1Id,
    person2_id: r.person2Id,
    type: r.type,
    sort_order: r.sortOrder ?? 0,
  });
  if (error) throw error;
}

export async function deleteRelationship(id: string) {
  const { error } = await supabase.from("relationships").delete().eq("id", id);
  if (error) throw error;
}

export async function updateChildOrder(orderedRelationshipIds: string[]) {
  // Persist new sort_order per parent->child relationship
  await Promise.all(
    orderedRelationshipIds.map((relId, idx) =>
      supabase.from("relationships").update({ sort_order: idx }).eq("id", relId),
    ),
  );
}

// Same operation as updateChildOrder, aliased for clarity when reordering spouses.
export const updateRelationshipOrder = updateChildOrder;

export async function addWife(
  husbandId: string,
  wife: Omit<Person, "id" | "gender">,
  sortOrder = 0,
) {
  const person = await addPerson({ ...wife, gender: "female" });
  await addRelationship({
    person1Id: husbandId,
    person2Id: person.id,
    type: "spouse",
    sortOrder,
  });
  return person;
}

export async function removeSpouseLink(husbandId: string, wifeId: string) {
  const { error } = await supabase
    .from("relationships")
    .delete()
    .eq("type", "spouse")
    .or(
      `and(person1_id.eq.${husbandId},person2_id.eq.${wifeId}),and(person1_id.eq.${wifeId},person2_id.eq.${husbandId})`,
    );
  if (error) throw error;
}

export { makeId };