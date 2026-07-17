import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SuggestionForm } from "./SuggestionForm";
import { PersonEditor } from "./PersonEditor";
import {
  addPerson,
  addRelationship,
  addWife,
  addHusband,
  deletePerson,
  updatePerson,
} from "@/lib/family-api";
import { addFamilyRelative } from "@/lib/family-member-actions.functions";
import { MAIN_FAMILY, type Person, type Relationship } from "@/lib/family-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PersonDetail({
  personId,
  persons,
  relationships,
  isAdmin,
  canManage: canManageProp,
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
  /** When true, non-admin members can add/edit nodes here (e.g. inside a personal/birth tree view). */
  canManage?: boolean;
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
  const addFamilyRelativeFn = useServerFn(addFamilyRelative);
  const [mode, setMode] = useState<
    | "view"
    | "suggest"
    | "edit"
    | "addDesc"
    | "addWife"
    | "addHusband"
    | "addFather"
    | "addMother"
    | "addBrother"
    | "addSister"
  >("view");

  if (!person) return null;

  const currentPerson = person;
  const isSelf = currentUserPersonId === currentPerson.id;
  const canManage = isAdmin || Boolean(canManageProp && (userRole === "member" || userRole === "admin"));
  const canEdit = Boolean(currentUserId) && (canManage || isSelf);
  const canAddWife = canManage && currentPerson.gender === "male";
  const canAddHusband = canManage && currentPerson.gender === "female";

  const personalGroupFor = (person: Person) => {
    const ownPersonalGroup = `personal-${person.id}`;
    if (person.familyGroup?.startsWith("personal-") && person.familyGroup !== ownPersonalGroup) {
      return ownPersonalGroup;
    }
    return person.familyGroup && person.familyGroup !== MAIN_FAMILY ? person.familyGroup : ownPersonalGroup;
  };

  const personalGroupRootId = (person: Person) =>
    person.familyGroup?.startsWith("personal-")
      ? person.familyGroup.slice("personal-".length)
      : null;

  const parentSiblingGroupFor = (person: Person) => {
    // Keep parents/siblings in the SAME family group the person already
    // belongs to, so they show up in whatever tree the person is visible in.
    // A married-in spouse whose familyGroup is `personal-{husbandId}` needs
    // her parents in that same group — not a brand-new `personal-{wifeId}`
    // group that no tree renders.
    if (person.familyGroup && person.familyGroup !== MAIN_FAMILY) {
      return person.familyGroup;
    }
    // Person is in the main family. If they have no parents in the main tree
    // yet (e.g., a married-in spouse still tagged MAIN_FAMILY), fall back to
    // their own personal group so a mini birth-family tree can form.
    const hasParentsInMain = relationships.some(
      (r) => r.type === "parent" && r.person2Id === person.id,
    );
    if (!hasParentsInMain) {
      return personalGroupFor(person);
    }
    return MAIN_FAMILY;
  };

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

  async function run(fn: () => Promise<unknown>, msg = "Saved", refresh = true) {
    try {
      await fn();
      toast.success(msg);
      if (refresh) onChanged();
      setMode("view");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  type AddRelativeAction = "descendant" | "father" | "mother" | "brother" | "sister" | "wife" | "husband";

  async function memberAddRelative(action: AddRelativeAction, data: Omit<Person, "id">) {
    await addFamilyRelativeFn({
      data: {
        personId: currentPerson.id,
        action,
        person: {
          name: data.name,
          gender: data.gender,
          birthDate: data.birthDate ?? null,
          deathDate: data.deathDate ?? null,
          photoUrl: data.photoUrl ?? null,
          biography: data.biography ?? null,
        },
      },
    });
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
              {canManage ? "Edit" : "Request edit"}
            </Button>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setMode("addDesc")}>
                Add descendant
              </Button>
              {canAddWife && (
                <Button size="sm" variant="secondary" onClick={() => setMode("addWife")}>
                  Add wife
                </Button>
              )}
              {canAddHusband && (
                <Button size="sm" variant="secondary" onClick={() => setMode("addHusband")}>
                  Add husband
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setMode("addFather")}>
                Add father
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMode("addMother")}>
                Add mother
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMode("addBrother")}>
                Add brother
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMode("addSister")}>
                Add sister
              </Button>
              {isAdmin && (
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
            </>
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
            if (canManage) {
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
              if (!isAdmin) {
                await memberAddRelative("descendant", data);
                return;
              }
              const familyGroupToUse =
                currentPerson.familyGroup && currentPerson.familyGroup !== MAIN_FAMILY
                  ? currentPerson.familyGroup
                  : `personal-${currentPerson.id}`;
              const child = await addPerson({ ...data, familyGroup: familyGroupToUse });
              await addRelationship({ person1Id: currentPerson.id, person2Id: child.id, type: "parent" });
            }, "Descendant added")
          }
        />
      )}
      {mode === "addFather" && (
        <PersonEditor
          initial={{ gender: "male" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("father", data);
                return;
              }
              const familyGroupToUse = parentSiblingGroupFor(currentPerson);
              const father = await addPerson({ ...data, gender: "male", familyGroup: familyGroupToUse });
              await addRelationship({ person1Id: father.id, person2Id: currentPerson.id, type: "parent" });
            }, "Father added")
          }
        />
      )}
      {mode === "addMother" && (
        <PersonEditor
          initial={{ gender: "female" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("mother", data);
                return;
              }
              const familyGroupToUse = parentSiblingGroupFor(currentPerson);
              const mother = await addPerson({ ...data, gender: "female", familyGroup: familyGroupToUse });
              await addRelationship({ person1Id: mother.id, person2Id: currentPerson.id, type: "parent" });
            }, "Mother added")
          }
        />
      )}
      {mode === "addBrother" && (
        <PersonEditor
          initial={{ gender: "male" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("brother", data);
                return;
              }
              const familyGroupToUse = parentSiblingGroupFor(currentPerson);
              const sibling = await addPerson({ ...data, gender: "male", familyGroup: familyGroupToUse });
              const parentRels = relationships.filter((r) => r.type === "parent" && r.person2Id === currentPerson.id);
              if (parentRels.length > 0) {
                for (const pr of parentRels) {
                  await addRelationship({ person1Id: pr.person1Id, person2Id: sibling.id, type: "parent" });
                }
              } else {
                // No parents found — sibling created without parent links. Admin can add parents later.
              }
            }, "Brother added")
          }
        />
      )}
      {mode === "addSister" && (
        <PersonEditor
          initial={{ gender: "female" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("sister", data);
                return;
              }
              const familyGroupToUse = parentSiblingGroupFor(currentPerson);
              const sibling = await addPerson({ ...data, gender: "female", familyGroup: familyGroupToUse });
              const parentRels = relationships.filter((r) => r.type === "parent" && r.person2Id === currentPerson.id);
              if (parentRels.length > 0) {
                for (const pr of parentRels) {
                  await addRelationship({ person1Id: pr.person1Id, person2Id: sibling.id, type: "parent" });
                }
              }
            }, "Sister added")
          }
        />
      )}
      {mode === "addWife" && (
        <PersonEditor
          initial={{ gender: "female" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("wife", data);
                return;
              }
              const familyGroupToUse = personalGroupFor(currentPerson);
              await addWife(currentPerson.id, {
                name: data.name,
                birthDate: data.birthDate,
                deathDate: data.deathDate,
                photoUrl: data.photoUrl,
                biography: data.biography,
                familyGroup: familyGroupToUse,
              });
            }, "Wife added")
          }
        />
      )}
      {mode === "addHusband" && (
        <PersonEditor
          initial={{ gender: "male" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              if (!isAdmin) {
                await memberAddRelative("husband", data);
                return;
              }
              const familyGroupToUse = personalGroupFor(currentPerson);
              await addHusband(currentPerson.id, {
                name: data.name,
                birthDate: data.birthDate,
                deathDate: data.deathDate,
                photoUrl: data.photoUrl,
                biography: data.biography,
                familyGroup: familyGroupToUse,
              });
            }, "Husband added")
          }
        />
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
