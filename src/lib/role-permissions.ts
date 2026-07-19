import { supabase } from "@/integrations/supabase/client";

// Per-role capabilities. Stored server-side in a single "meta" row on the
// persons table so we don't need a schema migration: the row has a fixed id
// (`__permissions__`), lives in family_group `__meta__` (filtered out of the
// tree in family-api.ts), and keeps the JSON blob in the `biography` column.
// Admins can update it via the normal "Admins manage persons" RLS policy,
// and every visitor/authenticated user can SELECT it via the "Anyone can
// read persons" policy.

export type RoleKey = "member" | "visitor";

export type DeleteScope = "none" | "own" | "any";

export interface RolePerms {
  add_descendant: boolean;
  add_father: boolean;
  add_mother: boolean;
  add_brother: boolean;
  add_sister: boolean;
  add_wife: boolean;
  add_husband: boolean;
  can_edit: boolean;
  delete_scope: DeleteScope;
}

export type PermissionsConfig = Record<RoleKey, RolePerms>;

export const PERMISSIONS_ROW_ID = "__permissions__";
export const META_FAMILY_GROUP = "__meta__";

export const DEFAULT_PERMISSIONS: PermissionsConfig = {
  member: {
    add_descendant: true,
    add_father: true,
    add_mother: true,
    add_brother: true,
    add_sister: true,
    add_wife: true,
    add_husband: true,
    can_edit: true,
    delete_scope: "own",
  },
  visitor: {
    add_descendant: false,
    add_father: false,
    add_mother: false,
    add_brother: false,
    add_sister: false,
    add_wife: false,
    add_husband: false,
    can_edit: false,
    delete_scope: "none",
  },
};

function normalize(raw: unknown): PermissionsConfig {
  const base = DEFAULT_PERMISSIONS;
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<PermissionsConfig>;
  return {
    member: { ...base.member, ...(obj.member ?? {}) },
    visitor: { ...base.visitor, ...(obj.visitor ?? {}) },
  };
}

export async function fetchRolePermissions(): Promise<PermissionsConfig> {
  const { data, error } = await supabase
    .from("persons")
    .select("biography")
    .eq("id", PERMISSIONS_ROW_ID)
    .maybeSingle();
  if (error) return DEFAULT_PERMISSIONS;
  if (!data?.biography) return DEFAULT_PERMISSIONS;
  try {
    return normalize(JSON.parse(data.biography));
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

/** Admin-only: upsert the singleton permissions row. */
export async function saveRolePermissions(config: PermissionsConfig): Promise<void> {
  const payload = JSON.stringify(config);
  const { data: existing } = await supabase
    .from("persons")
    .select("id")
    .eq("id", PERMISSIONS_ROW_ID)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("persons")
      .update({ biography: payload })
      .eq("id", PERMISSIONS_ROW_ID);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("persons").insert({
    id: PERMISSIONS_ROW_ID,
    name: "__permissions__",
    gender: "other",
    family_group: META_FAMILY_GROUP,
    biography: payload,
  });
  if (error) throw error;
}

export type AddRelativeAction =
  | "descendant"
  | "father"
  | "mother"
  | "brother"
  | "sister"
  | "wife"
  | "husband";

export function isAddActionAllowed(perms: RolePerms, action: AddRelativeAction): boolean {
  switch (action) {
    case "descendant": return perms.add_descendant;
    case "father": return perms.add_father;
    case "mother": return perms.add_mother;
    case "brother": return perms.add_brother;
    case "sister": return perms.add_sister;
    case "wife": return perms.add_wife;
    case "husband": return perms.add_husband;
  }
}
