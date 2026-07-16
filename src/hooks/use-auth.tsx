import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  person_id: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<"admin" | "member" | "visitor" | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const [{ data: prof }, { data: roleData }, { data: rolesRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, person_id")
          .eq("id", u.id)
          .maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.id, _role: "admin" }),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);
      setProfile(prof as Profile | null);
      setIsAdmin(Boolean(roleData));
      const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
      const hasExplicitRole = roles.length > 0;
      setRole(
        roles.includes("admin")
          ? "admin"
          : roles.includes("member")
          ? "member"
          : hasExplicitRole
          ? "visitor"
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const nextUser = s?.user ?? null;
      setUser(nextUser);
      setLoading(true);
      // defer DB calls to avoid deadlock inside listener
      setTimeout(() => refresh(nextUser), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(true);
      refresh(nextSession?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setRole(null);
    await supabase.auth.signOut();
  }, []);

  // "Family member" = linked to a node in the tree. "New member" = signed in
  // member role but not yet linked. Derive these from existing data.
  const isFamilyMember = Boolean(profile?.person_id);
  const isAuthenticatedUser = Boolean(user);
  const isNewMember = !!user && !isAdmin && !isFamilyMember && role !== "visitor";
  const resolvedRole = isAdmin ? "admin" : isFamilyMember ? "member" : isAuthenticatedUser ? "member" : role;
  return {
    session,
    user,
    profile,
    isAdmin,
    role: resolvedRole,
    isFamilyMember,
    isNewMember,
    loading,
    signOut,
    refreshProfile: () => refresh(user),
  };
}