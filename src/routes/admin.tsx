import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonEditor } from "@/components/family/PersonEditor";
import { ChildOrderEditor } from "@/components/family/ChildOrderEditor";
import { SpouseManager } from "@/components/family/SpouseManager";
import {
  addPerson,
  addRelationship,
  deletePerson,
  fetchFamily,
  makeId,
} from "@/lib/family-api";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin dashboard" }] }),
  component: AdminPage,
});

interface JoinRequest {
  id: string;
  user_id: string;
  parent_person_id: string;
  relation: string;
  proposed_name: string;
  proposed_gender: string;
  proposed_birth_date: string | null;
  proposed_photo_url: string | null;
  proposed_biography: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  person_id: string | null;
  created_at: string;
}
interface RoleRow { user_id: string; role: "admin" | "member" | "visitor" }
interface SuggestionRow {
  id: string;
  person_id: string;
  message: string;
  submitter_name: string | null;
  submitter_email: string | null;
  status: string;
  created_at: string;
}

interface VisitRow { visitor_id: string; created_at: string }

function AdminPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [spouseHusbandId, setSpouseHusbandId] = useState<string>("");
  const spouseSectionRef = useRef<HTMLDivElement | null>(null);

  function manageSpousesFor(id: string) {
    setSpouseHusbandId(id);
    setTimeout(() => {
      spouseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
  const online = usePresence({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? user?.email ?? "Admin",
    role: "admin",
    enabled: isAdmin,
  });

  const onlineUsers = useMemo(() => Object.values(online), [online]);
  const visitorOnline = useMemo(
    () => onlineUsers.filter((p) => p.role !== "admin"),
    [onlineUsers],
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const family = useQuery({ queryKey: ["family"], queryFn: fetchFamily });
  const reqs = useQuery({
    queryKey: ["join_requests"],
    queryFn: async (): Promise<JoinRequest[]> => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JoinRequest[];
    },
    enabled: isAdmin,
  });

  const profilesQ = useQuery({
    queryKey: ["all_profiles"],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, person_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
  const rolesQ = useQuery({
    queryKey: ["all_roles"],
    enabled: isAdmin,
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });
  const suggestionsQ = useQuery({
    queryKey: ["suggestions"],
    enabled: isAdmin,
    queryFn: async (): Promise<SuggestionRow[]> => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SuggestionRow[];
    },
  });

  const visitsQ = useQuery({
    queryKey: ["page_visits_30d"],
    enabled: isAdmin,
    queryFn: async (): Promise<VisitRow[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("page_visits")
        .select("visitor_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisitRow[];
    },
  });

  const visitStats = useMemo(() => {
    const rows = visitsQ.data ?? [];
    const days: { date: string; visits: number; unique: number }[] = [];
    const uniqueByDay = new Map<string, Set<string>>();
    const countByDay = new Map<string, number>();

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      countByDay.set(key, 0);
      uniqueByDay.set(key, new Set());
    }

    rows.forEach((r) => {
      const key = r.created_at.slice(0, 10);
      if (!countByDay.has(key)) return;
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
      uniqueByDay.get(key)!.add(r.visitor_id);
    });

    countByDay.forEach((visits, date) => {
      days.push({
        date: date.slice(5),
        visits,
        unique: uniqueByDay.get(date)?.size ?? 0,
      });
    });

    const total = rows.length;
    const uniqueTotal = new Set(rows.map((r) => r.visitor_id)).size;
    const today = days[days.length - 1]?.visits ?? 0;

    return { days, total, uniqueTotal, today };
  }, [visitsQ.data]);

  if (loading) return null;
  if (!user) return null;
  if (!isAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">You don't have admin access.</p>
          <Link to="/"><Button variant="outline" size="sm" className="mt-3">Back to tree</Button></Link>
        </div>
      </div>
    );

  const persons = family.data?.persons ?? [];
  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  const decided = (reqs.data ?? []).filter((r) => r.status !== "pending");
  const profiles = profilesQ.data ?? [];
  const allRoles = rolesQ.data ?? [];
  const roleByUser = new Map<string, "admin" | "member" | "visitor">();
  allRoles.forEach((r) => {
    const prev = roleByUser.get(r.user_id);
    // admin > member > visitor precedence
    const rank = { admin: 3, member: 2, visitor: 1 } as const;
    if (!prev || rank[r.role] > rank[prev]) roleByUser.set(r.user_id, r.role);
  });
  const suggestions = suggestionsQ.data ?? [];

  async function changeRole(userId: string, newRole: "admin" | "member" | "visitor") {
    const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (dErr) { toast.error(dErr.message); return; }
    const { error: iErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (iErr) { toast.error(iErr.message); return; }
    toast.success("Role updated");
    rolesQ.refetch();
  }

  async function updateSuggestion(id: string, status: string) {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); suggestionsQ.refetch(); }
  }

  async function applyEditSuggestion(s: SuggestionRow) {
    try {
      const parsed = JSON.parse(s.message) as {
        type?: string;
        person_id?: string;
        patch?: {
          name?: string;
          gender?: "male" | "female" | "other";
          birthDate?: string;
          deathDate?: string;
          photoUrl?: string;
          biography?: string;
        };
      };

      if (parsed.type !== "person_edit" || !parsed.person_id || !parsed.patch) {
        throw new Error("This suggestion does not contain a node edit request.");
      }

      const patch = parsed.patch;
      const { error } = await supabase
        .from("persons")
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.gender !== undefined && { gender: patch.gender }),
          ...(patch.birthDate !== undefined && { birth_date: patch.birthDate || null }),
          ...(patch.deathDate !== undefined && { death_date: patch.deathDate || null }),
          ...(patch.photoUrl !== undefined && { photo_url: patch.photoUrl || null }),
          ...(patch.biography !== undefined && { biography: patch.biography || null }),
        })
        .eq("id", parsed.person_id);
      if (error) throw error;

      const { error: updateErr } = await supabase
        .from("suggestions")
        .update({ status: "approved" })
        .eq("id", s.id);
      if (updateErr) throw updateErr;

      toast.success("Edit approved and applied");
      suggestionsQ.refetch();
      family.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply edit request");
    }
  }

  async function approve(r: JoinRequest) {
    try {
      const parent = persons.find((p) => p.id === r.parent_person_id);
      const newPerson = await addPerson({
        name: r.proposed_name,
        gender: r.proposed_gender as "male" | "female" | "other",
        birthDate: r.proposed_birth_date ?? undefined,
        photoUrl: r.proposed_photo_url ?? undefined,
        biography: r.proposed_biography ?? undefined,
        familyGroup: parent?.familyGroup ?? "hawthorne",
      });
      if (r.relation === "wife" || r.relation === "spouse") {
        await addRelationship({
          person1Id: r.parent_person_id,
          person2Id: newPerson.id,
          type: "spouse",
        });
      } else if (r.relation === "father" || r.relation === "mother" || r.relation === "parent") {
        // New person is the PARENT of the selected relative
        await addRelationship({
          person1Id: newPerson.id,
          person2Id: r.parent_person_id,
          type: "parent",
        });
      } else {
        // son / daughter / child — selected relative is the parent
        await addRelationship({
          person1Id: r.parent_person_id,
          person2Id: newPerson.id,
          type: "parent",
        });
      }
      // Link the requesting user's profile to this new node
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ person_id: newPerson.id })
        .eq("id", r.user_id);
      if (pErr) throw pErr;
      const { error: rErr } = await supabase
        .from("join_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", r.id);
      if (rErr) throw rErr;
      toast.success("Approved — node added to the tree");
      reqs.refetch();
      family.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function reject(r: JoinRequest) {
    const note = prompt("Optional note for rejection?") ?? null;
    const { error } = await supabase
      .from("join_requests")
      .update({ status: "rejected", admin_note: note, decided_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Request rejected");
      reqs.refetch();
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {persons.length} people · {pending.length} pending request{pending.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/"><Button variant="outline" size="sm">View tree</Button></Link>
          <Button size="sm" onClick={() => setAddOpen(true)}>Add person</Button>
          <Button size="sm" variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Visitor traffic</h2>
              <p className="text-sm text-muted-foreground">Page visits over the last 30 days.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md border bg-muted p-3">
                <div className="text-muted-foreground">Today</div>
                <div className="mt-1 text-xl font-semibold">{visitStats.today}</div>
              </div>
              <div className="rounded-md border bg-muted p-3">
                <div className="text-muted-foreground">30d visits</div>
                <div className="mt-1 text-xl font-semibold">{visitStats.total}</div>
              </div>
              <div className="rounded-md border bg-muted p-3">
                <div className="text-muted-foreground">Unique</div>
                <div className="mt-1 text-xl font-semibold">{visitStats.uniqueTotal}</div>
              </div>
            </div>
          </div>
          <div className="h-64 rounded-md border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitStats.days} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a961" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#c9a961" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="visits" stroke="#c9a961" strokeWidth={2} fill="url(#visitsFill)" name="Visits" />
                <Area type="monotone" dataKey="unique" stroke="#0d2d47" strokeWidth={2} fill="transparent" name="Unique" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Online now</h2>
              <p className="text-sm text-muted-foreground">Live viewers and active admin activity.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-muted p-3 text-sm">
                <div className="text-muted-foreground">Viewers online</div>
                <div className="mt-2 text-xl font-semibold">{visitorOnline.length}</div>
              </div>
              <div className="rounded-md border bg-muted p-3 text-sm">
                <div className="text-muted-foreground">Total active</div>
                <div className="mt-2 text-xl font-semibold">{onlineUsers.length}</div>
              </div>
            </div>
          </div>
          {onlineUsers.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No one online.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{p.display_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{p.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Users <span className="text-sm font-normal text-muted-foreground">({profiles.length})</span>
          </h2>
          <div className="overflow-hidden rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Online</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const r = roleByUser.get(p.id) ?? "visitor";
                  const isFam = !!p.person_id;
                  const status = r === "admin" ? "Admin" : isFam ? "Family member" : r === "member" ? "New member" : "Visitor";
                  const isOnline = !!online[p.id];
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.display_name ?? "(no name)"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline">{status}</Badge></td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border bg-background px-2 py-1 text-xs"
                          value={r}
                          disabled={p.id === user?.id}
                          onChange={(e) => changeRole(p.id, e.target.value as "admin" | "member" | "visitor")}
                        >
                          <option value="visitor">visitor</option>
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <span className="h-2 w-2 rounded-full bg-green-500" /> online
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <RolePermissionsSection />



        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Suggestions <span className="text-sm font-normal text-muted-foreground">({suggestions.filter(s => s.status === "pending").length} pending)</span>
          </h2>
          {suggestions.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">No suggestions yet.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s) => {
                const person = persons.find((p) => p.id === s.person_id);
                return (
                  <li key={s.id} className="rounded-md border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{person?.name ?? "(unknown)"}</span>
                      <Badge variant={s.status === "pending" ? "default" : "secondary"}>{s.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()} · {s.submitter_name ?? "Anonymous"}
                        {s.submitter_email ? ` · ${s.submitter_email}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{s.message}</p>
                    {s.status === "pending" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          try {
                            const parsed = JSON.parse(s.message) as { type?: string };
                            return parsed.type === "person_edit" ? (
                              <Button size="sm" variant="secondary" onClick={() => applyEditSuggestion(s)}>Approve edit</Button>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                        <Button size="sm" variant="secondary" onClick={() => updateSuggestion(s.id, "reviewed")}>Mark reviewed</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateSuggestion(s.id, "dismissed")}>Dismiss</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Pending join requests</h2>
          {pending.length === 0 ? (
            <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
              No pending requests.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => {
                const parent = persons.find((p) => p.id === r.parent_person_id);
                return (
                  <li key={r.id} className="rounded-md border bg-card p-4">
                    <div className="flex items-start gap-4">
                      {r.proposed_photo_url ? (
                        <img src={r.proposed_photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {r.proposed_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.proposed_name}</span>
                          <Badge>{r.relation} of {parent?.name ?? "(unknown)"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.proposed_gender}
                          {r.proposed_birth_date ? ` · born ${r.proposed_birth_date}` : ""}
                        </p>
                        {r.proposed_biography && (
                          <p className="mt-2 text-sm">{r.proposed_biography}</p>
                        )}
                        {r.message && (
                          <p className="mt-2 rounded bg-muted/50 p-2 text-sm italic">
                            "{r.message}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" onClick={() => approve(r)}>Approve & add</Button>
                        <Button size="sm" variant="ghost" onClick={() => reject(r)}>Reject</Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {decided.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Recently decided</h2>
            <ul className="space-y-1 text-sm">
              {decided.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded border bg-card px-3 py-2">
                  <span>{r.proposed_name}</span>
                  <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section ref={spouseSectionRef}>
          <h2 className="mb-3 text-lg font-semibold">Manage spouses</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Pick a husband, then add wives or drag to reorder. Wife #1 is placed left
            of the husband; wives #2+ are placed to the right in order.
          </p>
          <SpouseManager
            persons={persons}
            relationships={family.data?.relationships ?? []}
            initialHusbandId={spouseHusbandId}
            onSaved={() => family.refetch()}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Reorder children</h2>
          <p className="mb-2 text-xs text-muted-foreground">Pick a parent, then drag children to change their order in the tree.</p>
          <ChildOrderEditor
            persons={persons}
            relationships={family.data?.relationships ?? []}
            onSaved={() => family.refetch()}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">People in the tree</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {persons.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border bg-card p-3">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.birthDate?.slice(0, 4) || "?"} – {p.deathDate?.slice(0, 4) || ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {p.gender === "male" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => manageSpousesFor(p.id)}
                    >
                      Wives
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Delete ${p.name}?`)) return;
                      try {
                        await deletePerson(p.id);
                        toast.success("Deleted");
                        family.refetch();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>


      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <PersonEditor
            onCancel={() => setAddOpen(false)}
            onSubmit={async (data) => {
              try {
                await addPerson(data);
                toast.success("Person added");
                family.refetch();
                setAddOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RolePermissionsSection() {
  const [config, setConfig] = useState<import("@/lib/role-permissions").PermissionsConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    import("@/lib/role-permissions").then(async ({ fetchRolePermissions }) => {
      setConfig(await fetchRolePermissions());
    });
  }, []);

  if (!config) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">Role permissions</h2>
        <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const roles: Array<"member" | "visitor"> = ["member", "visitor"];
  const addKeys: Array<{ key: keyof import("@/lib/role-permissions").RolePerms; label: string }> = [
    { key: "add_descendant", label: "Add descendant" },
    { key: "add_father", label: "Add father" },
    { key: "add_mother", label: "Add mother" },
    { key: "add_brother", label: "Add brother" },
    { key: "add_sister", label: "Add sister" },
    { key: "add_wife", label: "Add wife" },
    { key: "add_husband", label: "Add husband" },
    { key: "can_edit", label: "Request edits" },
  ];

  const toggle = (role: "member" | "visitor", key: keyof import("@/lib/role-permissions").RolePerms) => {
    setConfig((c) => {
      if (!c) return c;
      const current = c[role][key];
      return { ...c, [role]: { ...c[role], [key]: !current } };
    });
  };

  const setScope = (role: "member" | "visitor", value: "none" | "own" | "any") => {
    setConfig((c) => (c ? { ...c, [role]: { ...c[role], delete_scope: value } } : c));
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { saveRolePermissions } = await import("@/lib/role-permissions");
      await saveRolePermissions(config);
      toast.success("Permissions saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Role permissions</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Control what members and visitors can do inside personal/birth family trees.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <div key={role} className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold capitalize">{role}</h3>
            </div>
            <div className="space-y-2">
              {addKeys.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(config[role][key])}
                    onChange={() => toggle(role, key)}
                  />
                </label>
              ))}
              <div className="pt-2">
                <div className="mb-1 text-sm font-medium">Delete nodes in personal tree</div>
                <select
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  value={config[role].delete_scope}
                  onChange={(e) => setScope(role, e.target.value as "none" | "own" | "any")}
                >
                  <option value="none">Not allowed</option>
                  <option value="own">Only nodes they added</option>
                  <option value="any">Any node (except tree root)</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </section>
  );
}


// silence unused
void makeId;
