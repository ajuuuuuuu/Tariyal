import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FamilyTree } from "@/components/family/FamilyTree";
import { TreeSkeleton } from "@/components/family/TreeSkeleton";
import { PersonDetail } from "@/components/family/PersonDetail";
import { JoinRequestDialog } from "@/components/family/JoinRequestDialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MAIN_FAMILY } from "@/lib/family-data";
import { fetchFamily } from "@/lib/family-api";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tariyal Vanshawali" },
      { name: "description", content: "Explore the interactive family tree of the Umed family." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, profile, isAdmin, role, isFamilyMember, signOut, refreshProfile } = useAuth();
  usePresence({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? user?.email ?? "Guest",
    role: isAdmin ? "admin" : isFamilyMember ? "family_member" : role === "visitor" ? "visitor" : "new_member",
  });
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["family"],
    queryFn: fetchFamily,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
  const persons = data?.persons ?? [];
  const relationships = data?.relationships ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [branchPersonId, setBranchPersonId] = useState<string | null>(null);
  const [branchMode, setBranchMode] = useState<"origin" | "marriage">("origin");
  const [joinOpen, setJoinOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  useEffect(() => {
    if (profile?.person_id) setHighlightId(profile.person_id);
  }, [profile?.person_id]);

  // Page visit tracking removed - table doesn't exist in schema

  useEffect(() => {
    if (!user) {
      setPendingRequest(false);
      setSelectedId(null);
      setBranchPersonId(null);
      return;
    }
    supabase
      .from("join_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => setPendingRequest(Boolean(data)));
  }, [user]);

  const relatedIds = useMemo(() => {
    if (!highlightId) return new Set<string>();
    const ids = new Set<string>();
    relationships.forEach((r) => {
      if (r.type === "parent") {
        if (r.person2Id === highlightId) ids.add(r.person1Id);
        if (r.person1Id === highlightId) ids.add(r.person2Id);
      } else if (r.type === "spouse") {
        if (r.person1Id === highlightId) ids.add(r.person2Id);
        if (r.person2Id === highlightId) ids.add(r.person1Id);
      }
    });
    return ids;
  }, [relationships, highlightId]);

  const mainPersonIds = useMemo(() => {
    const ids = new Set(
      persons.filter((p) => (p.familyGroup ?? MAIN_FAMILY) === MAIN_FAMILY).map((p) => p.id),
    );
    relationships.forEach((r) => {
      if (r.type !== "spouse") return;
      if (ids.has(r.person1Id)) ids.add(r.person2Id);
      if (ids.has(r.person2Id)) ids.add(r.person1Id);
    });
    return ids;
  }, [persons, relationships]);

  const mainPersons = useMemo(
    () => persons.filter((p) => mainPersonIds.has(p.id)),
    [persons, mainPersonIds],
  );
  const mainRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => mainPersonIds.has(r.person1Id) && mainPersonIds.has(r.person2Id),
      ),
    [relationships, mainPersonIds],
  );

  const branchPerson = branchPersonId
    ? persons.find((p) => p.id === branchPersonId) ?? null
    : null;
  const branchGroup = branchPerson?.familyGroup;
  const branchPersons = useMemo(() => {
    if (!branchPerson) return [];

    const personIds = new Set<string>();
    const personMap = new Map(persons.map((p) => [p.id, p]));

    const collect = (currentId: string, depth = 0) => {
      if (depth > 2) return;
      const current = personMap.get(currentId);
      if (!current) return;
      personIds.add(current.id);

      const parents = relationships
        .filter((r) => r.type === "parent" && r.person2Id === current.id)
        .map((r) => r.person1Id);
      const children = relationships
        .filter((r) => r.type === "parent" && r.person1Id === current.id)
        .map((r) => r.person2Id);
      const spouses = relationships
        .filter((r) => r.type === "spouse" && (r.person1Id === current.id || r.person2Id === current.id))
        .map((r) => (r.person1Id === current.id ? r.person2Id : r.person1Id));

      if (branchMode === "origin") {
        parents.forEach((id) => collect(id, depth + 1));
        children.forEach((id) => collect(id, depth + 1));
      } else {
        spouses.forEach((id) => collect(id, depth + 1));
      }
    };

    collect(branchPerson.id);

    if (!personIds.size) {
      personIds.add(branchPerson.id);
    }

    return Array.from(personIds, (id) => personMap.get(id)).filter(Boolean) as typeof persons;
  }, [branchMode, branchPerson, persons, relationships]);
  const branchIds = useMemo(() => new Set(branchPersons.map((p) => p.id)), [branchPersons]);
  const branchRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => branchIds.has(r.person1Id) && branchIds.has(r.person2Id),
      ),
    [relationships, branchIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return persons.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [persons, query]);

  const myNode = profile?.person_id
    ? persons.find((p) => p.id === profile.person_id)
    : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        isFamilyMember={isFamilyMember}
        role={role}
        onSignOut={signOut}
        query={query}
        onQueryChange={setQuery}
        matches={matches}
        onSelectMatch={(id) => {
          setSelectedId(id);
          setHighlightId(id);
          setQuery("");
        }}
        hasMyNode={Boolean(myNode)}
        onMyNode={() => {
          if (myNode) {
            setSelectedId(myNode.id);
            setHighlightId(myNode.id);
          }
        }}
        pendingJoinRequest={pendingRequest}
        onOpenJoin={() => setJoinOpen(true)}
      />
      <main className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <TreeSkeleton />
        ) : (
          <FamilyTree
            persons={mainPersons}
            relationships={mainRelationships}
            onSelect={(id) => setHighlightId(id)}
            onOpen={(id) => {
              setHighlightId(id);
              setSelectedId(id);
            }}
            highlightId={highlightId}
            relatedIds={relatedIds}
          />
        )}
      </main>

      <Sheet open={!!selectedId && !!user} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          {selectedId && (
            <PersonDetail
              personId={selectedId}
              persons={persons}
              relationships={relationships}
              isAdmin={isAdmin}
              currentUserPersonId={profile?.person_id ?? null}
              canViewBirthFamily={isFamilyMember}
              currentUserId={user?.id ?? null}
              currentUserName={profile?.display_name ?? ""}
              currentUserEmail={user?.email ?? ""}
              userRole={role}
              onClose={() => setSelectedId(null)}
              onViewBirthFamily={(id) => {
                setBranchPersonId(id);
                setBranchMode("origin");
                setSelectedId(null);
              }}
              onChanged={() => refetch()}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!branchPerson} onOpenChange={(o) => !o && setBranchPersonId(null)}>
        <DialogContent className="flex h-[80vh] max-w-5xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DialogTitle>
                  {branchPerson?.name}'s {branchMode === "origin" ? "origin family" : "marriage family"}
                  {branchGroup ? ` — the ${capitalize(branchGroup)}s` : ""}
                </DialogTitle>
                <DialogDescription>
                  {branchMode === "origin"
                    ? "Showing parents, children, and the surrounding birth-family branch."
                    : "Showing spouses and the surrounding marriage-family branch."}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBranchMode("origin")}
                  className={`rounded-full border px-3 py-1 text-sm ${branchMode === "origin" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  Origin family
                </button>
                <button
                  type="button"
                  onClick={() => setBranchMode("marriage")}
                  className={`rounded-full border px-3 py-1 text-sm ${branchMode === "marriage" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  Marriage family
                </button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 w-full">
            {branchPerson && (
              <FamilyTree
                persons={branchPersons}
                relationships={branchRelationships}
                onSelect={() => {}}
                highlightId={branchPerson.id}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {user && (
        <JoinRequestDialog
          open={joinOpen}
          onOpenChange={setJoinOpen}
          persons={persons}
          userId={user.id}
          defaultName={profile?.display_name ?? ""}
          onSubmitted={() => {
            setPendingRequest(true);
            refreshProfile();
          }}
        />
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
