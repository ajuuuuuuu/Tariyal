// Family tree types. Data lives in Lovable Cloud.
export type Gender = "male" | "female" | "other";

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  photoUrl?: string;
  biography?: string;
  familyGroup?: string;
}

export type RelationshipType = "parent" | "spouse";

export interface Relationship {
  id: string;
  person1Id: string;
  person2Id: string;
  type: RelationshipType;
  sortOrder?: number;
}

export const MAIN_FAMILY = "hawthorne";

export interface TreeSwitchContext {
  mode: "birth" | "married" | "self";
  group: string | null;
  title: string;
  description: string;
}

export function getTreeSwitchContext(
  person: Person | null | undefined,
  persons: Person[],
  relationships: Relationship[],
): TreeSwitchContext | null {
  if (!person) return null;

  const personalGroup = person.familyGroup?.startsWith("personal-") ? person.familyGroup : null;
  const ownPersonalGroup = `personal-${person.id}`;
  const birthGroup = !personalGroup && person.familyGroup && person.familyGroup !== MAIN_FAMILY ? person.familyGroup : null;
  const spouseIds = relationships
    .filter(
      (relationship) =>
        relationship.type === "spouse" &&
        (relationship.person1Id === person.id || relationship.person2Id === person.id),
    )
    .map((relationship) =>
      relationship.person1Id === person.id ? relationship.person2Id : relationship.person1Id,
    );

  const spousePeople = spouseIds
    .map((id) => persons.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Person => Boolean(candidate));

  if (personalGroup === ownPersonalGroup) {
    return {
      mode: "self",
      group: personalGroup,
      title: "Personal tree",
      description: "Showing the personal tree for this person and their spouse-related relatives.",
    };
  }

  // If this person already lives in someone else's personal sub-tree
  // (e.g. a wife stored under `personal-<husbandId>`), show THAT sub-tree
  // so newly added relatives (which inherit the same group) appear.
  if (personalGroup) {
    return {
      mode: "self",
      group: personalGroup,
      title: "Personal tree",
      description: "Showing the personal tree for this person and their spouse-related relatives.",
    };
  }

  const marriedGroup = spousePeople.find(
    (spouse) =>
      spouse.familyGroup &&
      !spouse.familyGroup.startsWith("personal-") &&
      spouse.familyGroup !== (person.familyGroup ?? MAIN_FAMILY),
  )?.familyGroup ?? null;

  if (marriedGroup) {
    const isPersonal = marriedGroup.startsWith("personal-");
    return {
      mode: isPersonal ? "self" : "married",
      group: marriedGroup,
      title: isPersonal ? "Personal tree" : "Married family tree",
      description: isPersonal
        ? "Showing the personal tree for this person and their spouse-related relatives."
        : "Showing the family tree of the family she married into.",
    };
  }


  if (birthGroup) {
    return {
      mode: "birth",
      group: birthGroup,
      title: "Birth family tree",
      description: "Showing her birth family tree.",
    };
  }

  return {
    mode: "self",
    group: personalGroup ?? ownPersonalGroup,
    title: "Personal tree",
    description: "Showing the personal tree for this person (their descendants/spouse added under them).",
  };

}
