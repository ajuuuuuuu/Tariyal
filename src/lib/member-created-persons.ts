// Track which person nodes the current signed-in member has added, so we can
// show a Delete button only for their own additions inside personal/birth
// trees. Persisted per-user in localStorage; server enforces guardrails too.

const KEY_PREFIX = "familyTree:memberCreated:";

function keyFor(userId: string | null | undefined) {
  return userId ? `${KEY_PREFIX}${userId}` : null;
}

function read(userId: string | null | undefined): string[] {
  const k = keyFor(userId);
  if (!k || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(userId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId)!, JSON.stringify(ids));
  } catch {
    /* ignore quota errors */
  }
}

export function recordMemberCreatedPerson(userId: string | null | undefined, personId: string) {
  if (!userId) return;
  const ids = read(userId);
  if (!ids.includes(personId)) {
    ids.push(personId);
    write(userId, ids);
  }
}

export function forgetMemberCreatedPerson(userId: string | null | undefined, personId: string) {
  if (!userId) return;
  const ids = read(userId).filter((id) => id !== personId);
  write(userId, ids);
}

export function isMemberCreatedPerson(userId: string | null | undefined, personId: string) {
  if (!userId) return false;
  return read(userId).includes(personId);
}
