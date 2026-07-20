// Lightweight pub/sub for a global "save status" indicator shown near the navbar.
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving"; message?: string }
  | { state: "saved"; message?: string }
  | { state: "error"; message?: string }
  | { state: "not-saved"; message?: string };

type Listener = (s: SaveStatus) => void;

let current: SaveStatus = { state: "idle" };
const listeners = new Set<Listener>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: SaveStatus) {
  current = next;
  listeners.forEach((l) => l(current));
}

export function getSaveStatus() {
  return current;
}

export function subscribeSaveStatus(l: Listener) {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}

export function setSaveStatus(next: SaveStatus, autoClearMs?: number) {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  emit(next);
  if (autoClearMs && next.state !== "saving") {
    clearTimer = setTimeout(() => emit({ state: "idle" }), autoClearMs);
  }
}

export const saveStatus = {
  saving: (message = "Saving…") => setSaveStatus({ state: "saving", message }),
  saved: (message = "Info saved") => setSaveStatus({ state: "saved", message }, 2500),
  error: (message = "Save failed") => setSaveStatus({ state: "error", message }, 4000),
  notSaved: (message = "Not saved") => setSaveStatus({ state: "not-saved", message }, 3000),
  idle: () => setSaveStatus({ state: "idle" }),
};
