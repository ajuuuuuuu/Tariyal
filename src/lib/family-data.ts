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
  const birthGroup =
    !personalGroup && person.familyGroup && person.familyGroup !== MAIN_FAMILY
      ? person.familyGroup
      : null;

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

  const isFemale = person.gender === "female";

  // Case 1: person lives in someone else's personal group (typical for a
  // married-in wife whose familyGroup = `personal-{husbandId}`). Her switch
  // tree is her BIRTH TREE — her own parents/siblings and their descendants.
  if (personalGroup && personalGroup !== ownPersonalGroup) {
    return {
      mode: "self",
      group: personalGroup,
      title: isFemale ? "Birth tree" : "Personal tree",
      description: isFemale
        ? "Showing her birth family — parents, siblings, and their descendants."
        : "Showing this person's related tree.",
    };
  }

  // Case 2: person is the anchor of their own personal group.
  if (personalGroup === ownPersonalGroup) {
    return {
      mode: "self",
      group: personalGroup,
      title: isFemale ? "Birth tree" : "Personal tree",
      description: "Showing this person's personal tree.",
    };
  }

  // Case 3: person is in a non-main birth group (e.g., a distinct lineage).
  if (birthGroup) {
    return {
      mode: "birth",
      group: birthGroup,
      title: "Birth tree",
      description: "Showing her birth family tree.",
    };
  }

  // Case 4: person is in MAIN_FAMILY. Look for a husband's tree.
  const marriedGroup = spousePeople.find(
    (spouse) =>
      spouse.familyGroup &&
      spouse.familyGroup !== (person.familyGroup ?? MAIN_FAMILY),
  )?.familyGroup ?? null;

  if (marriedGroup) {
    const isPersonal = marriedGroup.startsWith("personal-");
    return {
      mode: isPersonal ? "self" : "married",
      group: marriedGroup,
      title: isFemale ? "Husband birth tree" : "Married family tree",
      description: isFemale
        ? "Showing her husband's family/birth tree."
        : "Showing the family tree she married into.",
    };
  }

  return {
    mode: "self",
    group: ownPersonalGroup,
    title: isFemale ? "Birth tree" : "Personal tree",
    description: "Showing the personal tree for this person (their descendants/spouse added under them).",
  };
}
