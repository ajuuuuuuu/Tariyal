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
  const { user, profile, isAdmin, role, isFamilyMember, isNewMember, signOut, refreshProfile } = useAuth();
  const canUseMemberTools = isFamilyMember || isNewMember || role === "member" || isAdmin;
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
  const [selectedFromTree, setSelectedFromTree] = useState<"main" | "switch">("main");
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
    // Main tree = the primary lineage founder(s) and their descendants
    // (traversed strictly downward via parent→child edges), plus spouses
    // of anyone reached. We deliberately do NOT traverse upward from a
    // spouse, so a wife/husband who married in doesn't drag her/his own
    // parents or siblings into the main tree, even if legacy data or a
    // stale add-flow left them tagged as MAIN_FAMILY.
    const pool = persons.filter((p) => p.familyGroup === MAIN_FAMILY);
    const poolIds = new Set(pool.map((p) => p.id));
    if (pool.length === 0) return new Set<string>();

    // Downward child map + parent-count, restricted to the pool.
    const children = new Map<string, string[]>();
    const parentsOf = new Map<string, string[]>();
    pool.forEach((p) => {
      children.set(p.id, []);
      parentsOf.set(p.id, []);
    });
    relationships.forEach((r) => {
      if (r.type !== "parent") return;
      if (!poolIds.has(r.person1Id) || !poolIds.has(r.person2Id)) return;
      children.get(r.person1Id)!.push(r.person2Id);
      parentsOf.get(r.person2Id)!.push(r.person1Id);
    });

    // Candidate roots: pool persons with no parent inside the pool.
    const candidateRoots = pool.filter((p) => parentsOf.get(p.id)!.length === 0);

    // For each candidate root, measure its downward blood reach (descendants).
    const reachFrom = (rootId: string) => {
      const seen = new Set<string>([rootId]);
      const stack = [rootId];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of children.get(cur) ?? []) {
          if (!seen.has(child)) {
            seen.add(child);
            stack.push(child);
          }
        }
      }
      return seen;
    };

    const rootReaches = candidateRoots.map((r) => ({ id: r.id, reach: reachFrom(r.id) }));
    rootReaches.sort((a, b) => b.reach.size - a.reach.size);
    const primary = rootReaches[0];
    if (!primary) return new Set<string>();

    // Union descendants of the primary root with descendants of any other
    // root that shares a spouse with someone already in the main lineage
    // — this covers the (rare) case where a co-founder branch belongs in
    // the main tree, without also pulling in unrelated wife-side ancestors.
    const mainBlood = new Set(primary.reach);
    const spouseEdges = relationships.filter(
      (r) =>
        r.type === "spouse" && poolIds.has(r.person1Id) && poolIds.has(r.person2Id),
    );
    let grew = true;
    while (grew) {
      grew = false;
      for (const { id, reach } of rootReaches) {
        if (mainBlood.has(id)) continue;
        const overlapsViaSpouse = spouseEdges.some((r) => {
          const inReach = reach.has(r.person1Id) || reach.has(r.person2Id);
          const inMain = mainBlood.has(r.person1Id) || mainBlood.has(r.person2Id);
          return inReach && inMain;
        });
        if (overlapsViaSpouse) {
          reach.forEach((pid) => mainBlood.add(pid));
          grew = true;
        }
      }
    }

    // Include spouses of anyone in the main lineage (but do not recurse
    // upward into a spouse's own ancestors).
    const result = new Set(mainBlood);
    spouseEdges.forEach((r) => {
      if (mainBlood.has(r.person1Id)) result.add(r.person2Id);
      if (mainBlood.has(r.person2Id)) result.add(r.person1Id);
    });

    return result;
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
    if (!treeViewContext?.group) return [treeViewPerson];

    const focalGroup = treeViewPerson.familyGroup ?? MAIN_FAMILY;
    const ownPersonalGroup = `personal-${treeViewPerson.id}`;
    const viewingMarriedTree = treeViewContext.mode === "married";
    const focalIsInGroup =
      !viewingMarriedTree &&
      (treeViewContext.group === focalGroup || treeViewContext.group === ownPersonalGroup);

    // Personal/switch tree = every person that lives in the target family
    // group (+ the focal person). This mirrors main-tree behavior: whatever
    // node is added to this group renders here, with the same hierarchical
    // layout, edges, and interactions.
    const groupMembers = persons.filter(
      (person) => (person.familyGroup ?? MAIN_FAMILY) === treeViewContext.group,
    );

    // Legacy rescue: some relatives that a member added to their personal
    // tree were saved with familyGroup=MAIN_FAMILY due to an earlier bug
    // (e.g. Sushmi's mother/siblings). If they are NOT part of the main
    // lineage (mainPersonIds), pull them into the focal person's personal
    // tree so nothing gets orphaned.
    const focalPersonalGroup = `personal-${treeViewPerson.id}`;
    let rescuedForFocal: typeof persons = [];
    if (treeViewContext.group === focalPersonalGroup) {
      const rescued = new Set<string>();
      const stack: string[] = [treeViewPerson.id];
      const seen = new Set<string>([treeViewPerson.id]);
      while (stack.length) {
        const cur = stack.pop()!;
        relationships.forEach((r) => {
          const other =
            r.person1Id === cur ? r.person2Id : r.person2Id === cur ? r.person1Id : null;
          if (!other || seen.has(other)) return;
          seen.add(other);
          if (!mainPersonIds.has(other)) {
            rescued.add(other);
            stack.push(other);
          }
        });
      }
      rescuedForFocal = persons.filter((p) => rescued.has(p.id));
    }

    const combined = Array.from(
      new Map(
        [treeViewPerson, ...groupMembers, ...rescuedForFocal].map((person) => [person.id, person]),
      ).values(),
    );

    if (!focalIsInGroup) {
      // Viewing someone else's tree (e.g. daughter viewing husband's birth
      // tree). Exclude the focal person's own birth-side relatives so only
      // the target group's members appear alongside her.
      const birthExclude = new Set<string>();
      const focalParents = relationships
        .filter((r) => r.type === "parent" && r.person2Id === treeViewPerson.id)
        .map((r) => r.person1Id);
      focalParents.forEach((pid) => {
        birthExclude.add(pid);
        relationships
          .filter((r) => r.type === "parent" && r.person1Id === pid)
          .forEach((r) => {
            if (r.person2Id !== treeViewPerson.id) {
              birthExclude.add(r.person2Id);
              relationships
                .filter((rr) => rr.type === "parent" && rr.person1Id === r.person2Id)
                .forEach((rr) => birthExclude.add(rr.person2Id));
            }
          });
      });
      return combined.filter((p) => !birthExclude.has(p.id));
    }

    return combined;
  }, [persons, treeViewContext, treeViewPerson, relationships, mainPersonIds]);
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
              setSelectedFromTree("main");
              setSelectedId(id);
            }}
            onSwitchTree={(id) => {
              setTreeViewPersonId(id);
              setTreeViewMode("switch");
              setSelectedId(null);
            }}
            highlightId={highlightId}
            relatedIds={relatedIds}
            allPersons={persons}
            showAddedIndicator
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
                canManage={selectedFromTree === "switch" && canUseMemberTools}
              currentUserPersonId={profile?.person_id ?? null}
                canViewBirthFamily={canUseMemberTools}
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
              {treeViewContext?.group && !treeViewContext.group.startsWith("personal-")
                ? ` — the ${capitalize(treeViewContext.group)}s`
                : ""}
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
                  setSelectedFromTree("switch");
                  setSelectedId(id);
                }}
                onOpen={(id) => {
                  setHighlightId(id);
                  setSelectedFromTree("switch");
                  setSelectedId(id);
                }}
                onSwitchTree={(id) => {
                  setTreeViewPersonId(id);
                  setTreeViewMode("switch");
                  setSelectedId(null);
                }}
                highlightId={treeViewPerson.id}
                allPersons={persons}
                showAddedIndicator
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
