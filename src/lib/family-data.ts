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

  const birthGroup = person.familyGroup && person.familyGroup !== MAIN_FAMILY ? person.familyGroup : null;
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

  const marriedGroup = spousePeople.find(
    (spouse) => spouse.familyGroup && spouse.familyGroup !== (person.familyGroup ?? MAIN_FAMILY),
  )?.familyGroup ?? null;

  if (marriedGroup) {
    return {
      mode: "married",
      group: marriedGroup,
      title: "Married family tree",
      description: "Showing the family tree of the family she married into.",
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
    group: null,
    title: "Personal tree",
    description: "No additional family information is available yet, so only her node is shown.",
  };
}
