import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SuggestionForm } from "./SuggestionForm";
import { PersonEditor } from "./PersonEditor";
import {
  addPerson,
  addRelationship,
  addWife,
  deletePerson,
  updatePerson,
} from "@/lib/family-api";
import { MAIN_FAMILY, type Gender, type Person, type Relationship } from "@/lib/family-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RelativeActionType =
  | "parent"
  | "sibling"
  | "child"
  | "spouse"
  | "siblingChild"
  | "fatherInLaw"
  | "motherInLaw"
  | "brotherInLaw"
  | "sisterInLaw";

type PendingAction = {
  type: RelativeActionType;
  title: string;
  description: string;
  gender?: Gender;
};

export function PersonDetail({
  personId,
  persons,
  relationships,
  isAdmin,
  currentUserPersonId = null,
  canViewBirthFamily = false,
  currentUserId = null,
  currentUserName = "",
  currentUserEmail = "",
  userRole = null,
  onClose,
  onViewBirthFamily,
  onChanged,
}: {
  personId: string;
  persons: Person[];
  relationships: Relationship[];
  isAdmin: boolean;
  currentUserPersonId?: string | null;
  canViewBirthFamily?: boolean;
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserEmail?: string;
  userRole?: "admin" | "member" | "visitor" | null;
  onClose: () => void;
  onViewBirthFamily?: (id: string) => void;
  onChanged: () => void;
}) {
  const person = persons.find((p) => p.id === personId);
  const [mode, setMode] = useState<"view" | "suggest" | "edit" | "addDesc" | "addWife" | "addRelative">(
    "view",
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  if (!person) return null;

  const currentPerson = person;
  const isSelf = currentUserPersonId === currentPerson.id;
  const canEdit = Boolean(currentUserId) && (isAdmin || userRole === "member" || isSelf);
  const canAddWife = isAdmin && currentPerson.gender === "male";

  const parents = relationships
    .filter((r) => r.type === "parent" && r.person2Id === currentPerson.id)
    .map((r) => persons.find((p) => p.id === r.person1Id))
    .filter(Boolean) as Person[];
  const children = relationships
    .filter((r) => r.type === "parent" && r.person1Id === currentPerson.id)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((r) => persons.find((p) => p.id === r.person2Id))
    .filter(Boolean) as Person[];
  const spouses = relationships
    .filter(
      (r) =>
        r.type === "spouse" && (r.person1Id === currentPerson.id || r.person2Id === currentPerson.id),
    )
    .map((r) =>
      persons.find((p) => p.id === (r.person1Id === currentPerson.id ? r.person2Id : r.person1Id)),
    )
    .filter(Boolean) as Person[];
  const siblingCandidates = relationships
    .filter((r) => r.type === "parent" && r.person2Id === currentPerson.id)
    .map((r) => r.person1Id);
  const spouseIds = relationships
    .filter((r) => r.type === "spouse" && (r.person1Id === currentPerson.id || r.person2Id === currentPerson.id))
    .map((r) => (r.person1Id === currentPerson.id ? r.person2Id : r.person1Id));
  const isWifeNode = currentPerson.gender === "female" && spouses.length > 0;
  const canDeletePerson = !isWifeNode && (isAdmin || canEdit);

  async function run(fn: () => Promise<unknown>, msg = "Saved", refresh = true) {
    try {
      await fn();
      toast.success(msg);
      if (refresh) onChanged();
      setMode("view");
      setPendingAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function submitEditRequest(data: Omit<Person, "id">) {
    const patch = {
      name: data.name,
      gender: data.gender,
      birthDate: data.birthDate,
      deathDate: data.deathDate,
      photoUrl: data.photoUrl,
      biography: data.biography,
    };

    const { error } = await supabase.from("suggestions").insert({
      person_id: currentPerson.id,
      user_id: currentUserId,
      submitter_name: currentUserName || null,
      submitter_email: currentUserEmail || null,
      message: JSON.stringify({
        type: "person_edit",
        person_id: currentPerson.id,
        patch,
      }),
    });

    if (error) throw error;
  }

  async function submitRelativeAction(data: Omit<Person, "id">) {
    if (!pendingAction) return;

    const basePerson = await addPerson({ ...data, familyGroup: currentPerson.familyGroup });

    switch (pendingAction.type) {
      case "parent":
        await addRelationship({ person1Id: basePerson.id, person2Id: currentPerson.id, type: "parent" });
        break;
      case "sibling": {
        if (!siblingCandidates.length) {
          throw new Error("Add the parents first so the sibling can be linked correctly.");
        }
        await Promise.all(
          siblingCandidates.map((parentId) =>
            addRelationship({ person1Id: parentId, person2Id: basePerson.id, type: "parent" }),
          ),
        );
        break;
      }
      case "child":
        await addRelationship({ person1Id: currentPerson.id, person2Id: basePerson.id, type: "parent" });
        break;
      case "spouse":
        await addRelationship({ person1Id: currentPerson.id, person2Id: basePerson.id, type: "spouse" });
        break;
      case "siblingChild": {
        if (!spouseIds.length) {
          throw new Error("Add a sibling first so a sibling child can be linked correctly.");
        }
        const siblingId = spouseIds[0];
        await addRelationship({ person1Id: siblingId, person2Id: basePerson.id, type: "parent" });
        break;
      }
      case "fatherInLaw":
      case "motherInLaw": {
        const spouseId = spouseIds[0];
        if (!spouseId) {
          throw new Error("Add a spouse first so the in-law can be linked.");
        }
        await addRelationship({ person1Id: basePerson.id, person2Id: spouseId, type: "parent" });
        break;
      }
      case "brotherInLaw":
      case "sisterInLaw": {
        const spouseId = spouseIds[0];
        if (!spouseId) {
          throw new Error("Add a spouse first so the in-law can be linked.");
        }
        const spouseParents = relationships
          .filter((r) => r.type === "parent" && r.person2Id === spouseId)
          .map((r) => r.person1Id);
        if (!spouseParents.length) {
          throw new Error("Add the spouse's parents first so the in-law can be linked.");
        }
        await Promise.all(
          spouseParents.map((parentId) =>
            addRelationship({ person1Id: parentId, person2Id: basePerson.id, type: "parent" }),
          ),
        );
        break;
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start gap-4">
        {currentPerson.photoUrl ? (
          <img src={currentPerson.photoUrl} alt={currentPerson.name} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
            {currentPerson.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{currentPerson.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{currentPerson.gender}</p>
          <p className="text-sm text-muted-foreground">
            {currentPerson.birthDate || "?"} {currentPerson.deathDate ? `– ${currentPerson.deathDate}` : ""}
          </p>
        </div>
      </div>

      {currentPerson.biography && (
        <p className="text-sm leading-relaxed text-foreground">{currentPerson.biography}</p>
      )}

      <Separator />

      <div className="space-y-2 text-sm">
        <Relation label="Parents" people={parents} />
        <Relation label="Spouses" people={spouses} />
        <Relation label="Children" people={children} />
      </div>

      <Separator />

      {mode === "view" && (
        <div className="flex flex-wrap gap-2">
          {currentPerson.familyGroup && currentPerson.familyGroup !== MAIN_FAMILY && onViewBirthFamily && (isAdmin || canViewBirthFamily) && (
            <Button size="sm" variant="secondary" onClick={() => onViewBirthFamily(currentPerson.id)}>
              View birth family tree
            </Button>
          )}
          {currentPerson.gender === "female" && onViewBirthFamily && (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-700 transition hover:bg-yellow-500/20 dark:text-yellow-300"
              onClick={() => onViewBirthFamily(currentPerson.id)}
            >
              Switch tree
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMode("suggest")}>
            Suggest a correction
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setMode("edit")}>
              {isAdmin ? "Edit" : "Request edit"}
            </Button>
          )}
          {canEdit && (
            <>
              {isAdmin ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "parent", title: "Add mother", description: "Create a new mother for this person.", gender: "female" });
                      setMode("addRelative");
                    }}
                  >
                    Add mother
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "parent", title: "Add father", description: "Create a new father for this person.", gender: "male" });
                      setMode("addRelative");
                    }}
                  >
                    Add father
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "sibling", title: "Add sibling", description: "Create a new sibling linked to the same parents.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add sibling
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "child", title: "Add child", description: "Create a new child for this person.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add child
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "parent", title: "Add parent", description: "Create a new parent for this person.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add parent
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "sibling", title: "Add sibling", description: "Create a new sibling linked to the same parents.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add sibling
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "child", title: "Add child", description: "Create a new child for this person.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add child
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "spouse", title: "Add spouse", description: "Create a new spouse for this person.", gender: currentPerson.gender === "male" ? "female" : "male" });
                      setMode("addRelative");
                    }}
                  >
                    Add spouse
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "siblingChild", title: "Add sibling child", description: "Create a new child linked to a sibling.", gender: "other" });
                      setMode("addRelative");
                    }}
                  >
                    Add sibling child
                  </Button>
                </>
              )}
              {!isAdmin && currentPerson.gender === "female" && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "brotherInLaw", title: "Add brother in law", description: "Create a new brother in law for this person.", gender: "male" });
                      setMode("addRelative");
                    }}
                  >
                    Add brother in law
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "fatherInLaw", title: "Add father in law", description: "Create a new father in law for this person.", gender: "male" });
                      setMode("addRelative");
                    }}
                  >
                    Add father in law
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "sisterInLaw", title: "Add sister in law", description: "Create a new sister in law for this person.", gender: "female" });
                      setMode("addRelative");
                    }}
                  >
                    Add sister in law
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPendingAction({ type: "motherInLaw", title: "Add mother in law", description: "Create a new mother in law for this person.", gender: "female" });
                      setMode("addRelative");
                    }}
                  >
                    Add mother in law
                  </Button>
                </>
              )}
            </>
          )}
          {canAddWife && (
            <Button size="sm" variant="secondary" onClick={() => setMode("addWife")}>
              Add wife
            </Button>
          )}
          {canDeletePerson && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ${currentPerson.name}?`)) {
                  run(async () => {
                    await deletePerson(currentPerson.id);
                    onClose();
                  }, "Deleted");
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      )}

      {mode === "suggest" && (
        <SuggestionForm
          personId={currentPerson.id}
          personName={currentPerson.name}
          userId={currentUserId}
          defaultName={currentUserName}
          defaultEmail={currentUserEmail}
          onClose={() => setMode("view")}
        />
      )}
      {mode === "edit" && (
        <PersonEditor
          initial={currentPerson}
          onCancel={() => setMode("view")}
          onSubmit={(data) => {
            if (isAdmin) {
              void run(() => updatePerson(currentPerson.id, data));
              return;
            }

            void run(
              () => submitEditRequest(data),
              "Edit request sent to admin for approval.",
              false,
            );
          }}
        />
      )}
      {mode === "addDesc" && (
        <PersonEditor
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              const child = await addPerson({ ...data, familyGroup: currentPerson.familyGroup });
              await addRelationship({ person1Id: currentPerson.id, person2Id: child.id, type: "parent" });
            }, "Descendant added")
          }
        />
      )}
      {mode === "addWife" && (
        <PersonEditor
          initial={{ gender: "female" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              await addWife(currentPerson.id, {
                name: data.name,
                birthDate: data.birthDate,
                deathDate: data.deathDate,
                photoUrl: data.photoUrl,
                biography: data.biography,
                familyGroup: currentPerson.familyGroup,
              });
            }, "Wife added")
          }
        />
      )}
      {mode === "addRelative" && pendingAction && (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-4">
          <div>
            <p className="font-medium">{pendingAction.title}</p>
            <p className="text-sm text-muted-foreground">{pendingAction.description}</p>
          </div>
          <PersonEditor
            initial={{ gender: pendingAction.gender ?? "other" } as Person}
            onCancel={() => {
              setPendingAction(null);
              setMode("view");
            }}
            onSubmit={(data) => {
              void run(async () => {
                await submitRelativeAction(data);
              }, `${pendingAction.title} added`);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Relation({ label, people }: { label: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span>{people.map((p) => p.name).join(", ")}</span>
    </div>
  );
}
