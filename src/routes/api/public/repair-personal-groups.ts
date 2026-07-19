import { createFileRoute } from "@tanstack/react-router";

// Temporary data-repair endpoint. Delete after invocation.
export const Route = createFileRoute("/api/public/repair-personal-groups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-repair-token");
        if (token !== "repair-2026-07-19-personal-groups") {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const fixes = [
          { ids: ["pmrq9wdxaatip", "pmrql295ktj6c"], group: "personal-pmr3cw1alg50f" },
          { ids: ["pmrrbws8phtda"], group: "personal-pmr3cr57qjzqt" },
        ];
        const results: unknown[] = [];
        for (const fix of fixes) {
          const { data, error } = await supabaseAdmin
            .from("persons")
            .update({ family_group: fix.group })
            .in("id", fix.ids)
            .select("id,family_group");
          results.push({ fix, data, error: error?.message });
        }
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
