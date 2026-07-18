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
    // All persons flagged as MAIN_FAMILY. From these we keep only the
    // largest blood-connected component (parent/child edges) + their spouses.
    // A married-in wife's parents/siblings form their own blood component
    // and get excluded from the main tree.
    const pool = persons.filter((p) => p.familyGroup === MAIN_FAMILY);
    const poolIds = new Set(pool.map((p) => p.id));
    if (pool.length === 0) return new Set<string>();

    // Blood-only adjacency (parent edges) within the pool.
    const bloodAdj = new Map<string, Set<string>>();
    pool.forEach((p) => bloodAdj.set(p.id, new Set()));
    relationships.forEach((r) => {
      if (r.type !== "parent") return;
      if (!poolIds.has(r.person1Id) || !poolIds.has(r.person2Id)) return;
      bloodAdj.get(r.person1Id)!.add(r.person2Id);
      bloodAdj.get(r.person2Id)!.add(r.person1Id);
    });

    // Find connected components.
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const p of pool) {
      if (visited.has(p.id)) continue;
      const comp: string[] = [];
      const stack = [p.id];
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        comp.push(cur);
        bloodAdj.get(cur)!.forEach((n) => {
          if (!visited.has(n)) stack.push(n);
        });
      }
      components.push(comp);
    }

    // Pick the largest blood component as the main lineage.
    components.sort((a, b) => b.length - a.length);
    const mainBlood = new Set(components[0] ?? []);

    // Include spouses (in the pool) of anyone in the main blood component.
    const result = new Set(mainBlood);
    relationships.forEach((r) => {
      if (r.type !== "spouse") return;
      if (!poolIds.has(r.person1Id) || !poolIds.has(r.person2Id)) return;
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
    const groupMembers = treeViewContext?.group
      ? persons.filter((person) => (person.familyGroup ?? MAIN_FAMILY) === treeViewContext.group)
      : [];

    let extra: typeof persons = [];
    const focalGroup = treeViewPerson.familyGroup ?? MAIN_FAMILY;
    const focalIsInGroup = treeViewContext?.group === focalGroup;

    if (
      treeViewContext?.mode === "self" &&
      treeViewContext.group?.startsWith("personal-") &&
      focalIsInGroup
    ) {
      // Focal person's own birth tree (e.g. wife viewing her birth family).
      // Include parents, grandparents, siblings, siblings' children, and
      // nieces/nephews. Do NOT include spouse or descendants — those belong
      // to the married-into tree, not the birth tree.
      const personById = new Map(persons.map((p) => [p.id, p]));
      const ids = new Set<string>();
      const parentIds = relationships
        .filter((r) => r.type === "parent" && r.person2Id === treeViewPerson.id)
        .map((r) => r.person1Id);

      parentIds.forEach((id) => ids.add(id));

      const grandParentIds = new Set<string>();
      parentIds.forEach((parentId) => {
        relationships
          .filter((r) => r.type === "parent" && r.person2Id === parentId)
          .forEach((r) => {
            ids.add(r.person1Id);
            grandParentIds.add(r.person1Id);
          });
      });

      const siblingIds = new Set<string>();
      parentIds.forEach((parentId) => {
        relationships
          .filter((r) => r.type === "parent" && r.person1Id === parentId)
          .forEach((r) => {
            if (r.person2Id !== treeViewPerson.id) {
              siblingIds.add(r.person2Id);
              ids.add(r.person2Id);
            }
          });
      });

      grandParentIds.forEach((grandParentId) => {
        relationships
          .filter((r) => r.type === "parent" && r.person1Id === grandParentId)
          .forEach((r) => {
            if (!parentIds.includes(r.person2Id) && r.person2Id !== treeViewPerson.id) {
              ids.add(r.person2Id);
            }
          });
      });

      siblingIds.forEach((siblingId) => {
        relationships
          .filter((r) => r.type === "parent" && r.person1Id === siblingId)
          .forEach((r) => ids.add(r.person2Id));
      });

      extra = Array.from(ids)
        .map((id) => personById.get(id))
        .filter((p): p is (typeof persons)[number] => Boolean(p));
    }

    const combined = Array.from(
      new Map([treeViewPerson, ...groupMembers, ...extra].map((person) => [person.id, person])).values(),
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
              // sibling's children
              relationships
                .filter((rr) => rr.type === "parent" && rr.person1Id === r.person2Id)
                .forEach((rr) => birthExclude.add(rr.person2Id));
            }
          });
      });
      return combined.filter((p) => !birthExclude.has(p.id));
    }

    return combined;

  }, [persons, treeViewContext, treeViewPerson, relationships]);
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
