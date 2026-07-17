import { supabase } from "@/integrations/supabase/client";

const VISITOR_STORAGE_KEY = "family-tree-visitor-id";
const TRACKED_SESSION_KEY = "family-tree-visit-tracked";

function getOrCreateVisitorId() {
  if (typeof window === "undefined") return "anon";

  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;

  const generated = `anon-${window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
  window.localStorage.setItem(VISITOR_STORAGE_KEY, generated);
  return generated;
}

export async function trackPageVisit() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(TRACKED_SESSION_KEY) === "1") return;

  try {
    const { data } = await supabase.auth.getSession();
    const visitorId = data.session?.user?.id ?? getOrCreateVisitorId();
    const { error } = await (supabase.from("page_visits" as never) as any).insert({ visitor_id: visitorId });

    if (error) {
      if (error.code !== "42P01") {
        console.warn("Failed to record page visit", error);
      }
      return;
    }

    window.sessionStorage.setItem(TRACKED_SESSION_KEY, "1");
  } catch (error) {
    console.warn("Failed to record page visit", error);
  }
}
