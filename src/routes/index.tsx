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
import { MAIN_FAMILY, getTreeSwitchContext } from "@/lib/family-data";
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
  const [treeViewPersonId, setTreeViewPersonId] = useState<string | null>(null);
  const [treeViewMode, setTreeViewMode] = useState<"birth" | "switch">("birth");
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
      setTreeViewPersonId(null);
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

  const treeViewPerson = treeViewPersonId
    ? persons.find((p) => p.id === treeViewPersonId) ?? null
    : null;
  const treeViewContext = useMemo(
    () => getTreeSwitchContext(treeViewPerson, persons, relationships),
    [treeViewPerson, persons, relationships],
  );
  const treeViewPersons = useMemo(() => {
    if (!treeViewPerson) return [];
    const groupMembers = treeViewContext?.group
      ? persons.filter((person) => (person.familyGroup ?? MAIN_FAMILY) === treeViewContext.group)
      : [];
    return Array.from(new Map([treeViewPerson, ...groupMembers].map((person) => [person.id, person])).values());
  }, [persons, treeViewContext, treeViewPerson]);
  const treeViewIds = useMemo(() => new Set(treeViewPersons.map((person) => person.id)), [treeViewPersons]);
  const treeViewRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) => treeViewIds.has(relationship.person1Id) && treeViewIds.has(relationship.person2Id),
      ),
    [relationships, treeViewIds],
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
            onSwitchTree={(id) => {
              setTreeViewPersonId(id);
              setTreeViewMode("switch");
              setSelectedId(null);
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
                setTreeViewPersonId(id);
                setTreeViewMode("birth");
                setSelectedId(null);
              }}
              onChanged={() => refetch()}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!treeViewPerson} onOpenChange={(o) => !o && setTreeViewPersonId(null)}>
        <DialogContent className="flex h-[80vh] max-w-5xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {treeViewPerson?.name}'s {treeViewContext?.title ?? "family tree"}
              {treeViewContext?.group ? ` — the ${capitalize(treeViewContext.group)}s` : ""}
            </DialogTitle>
            <DialogDescription>
              {treeViewContext?.description ?? "Highlighted within a related family tree."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 w-full">
            {treeViewPerson && (
              <FamilyTree
                persons={treeViewPersons}
                relationships={treeViewRelationships}
                onSelect={(id) => {
                  setHighlightId(id);
                  setSelectedId(id);
                }}
                onOpen={(id) => {
                  setHighlightId(id);
                  setSelectedId(id);
                }}
                highlightId={treeViewPerson.id}
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
