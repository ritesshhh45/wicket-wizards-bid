import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/team/$id")({
  head: () => ({
    meta: [
      { title: "Team Dashboard — Cricket Auction Pro" },
      { name: "description", content: "Track your squad, live budget, purchased players and every budget transaction." },
      { property: "og:title", content: "Team Dashboard — Cricket Auction Pro" },
      { property: "og:description", content: "Your squad, budget and auction spending in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();

  const { data } = useQuery({
    queryKey: ["team-dash", id],
    queryFn: async () => {
      const [team, players, tx] = await Promise.all([
        supabase.from("teams").select("*, tournaments(id,name,min_max_squad,categories)").eq("id", id).maybeSingle(),
        supabase.from("players").select("*").eq("sold_to_team_id", id).order("sold_price", { ascending: false }),
        supabase
          .from("team_transactions")
          .select("*")
          .eq("team_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return { team: team.data, players: players.data ?? [], tx: tx.data ?? [] };
    },
    refetchInterval: 5000,
  });

  const team = data?.team;
  const players = data?.players ?? [];
  const tournament = team?.tournaments as
    | { id: string; name: string; min_max_squad: unknown; categories: unknown }
    | null
    | undefined;
  const squad = (tournament?.min_max_squad ?? {}) as { min?: number; max?: number };
  const categories = (tournament?.categories ?? []) as string[];
  const spent = (team?.total_budget ?? 0) - (team?.remaining_budget ?? 0);
  const pct = team?.total_budget ? Math.round((spent / team.total_budget) * 100) : 0;

  if (!team) {
    return (
      <AppShell>
        <Empty>Team not found.</Empty>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SectionTitle>{team.name}</SectionTitle>
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="size-16 overflow-hidden rounded-xl bg-surface-2">
              {team.logo_url ? (
                <img src={team.logo_url} alt="" className="size-16 object-cover" />
              ) : (
                <div className="grid size-16 place-items-center text-2xl">🛡️</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold">{team.name}</p>
              <p className="text-xs text-muted-foreground">
                Captain {team.captain_name ?? "—"} · Owner {team.owner_name ?? "—"}
              </p>
              {tournament && (
                <Link to="/live/$id" params={{ id: tournament.id }} className="text-xs font-bold text-accent">
                  {tournament.name} — live auction
                </Link>
              )}
            </div>
            <div className="ml-auto text-right">
              <p className="font-display text-2xl font-bold text-accent">{formatMoney(team.remaining_budget)}</p>
              <p className="text-xs text-muted-foreground">remaining of {formatMoney(team.total_budget)}</p>
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Spent {formatMoney(spent)} · Squad {players.length}/{squad.max ?? "-"} (min {squad.min ?? 0})
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {categories.map((c) => (
              <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1">
                {c}: {players.filter((p) => p.role === c).length}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">Purchased players</h3>
          {players.length === 0 && <Empty>No players bought yet.</Empty>}
          <div className="grid gap-2 md:grid-cols-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="size-10 object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center">🏏</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.role}</p>
                </div>
                <span className="font-bold text-accent">{formatMoney(p.sold_price ?? 0)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <h3 className="mb-3 font-bold">Budget ledger</h3>
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">When</th>
                <th>Type</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tx ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("en-IN")}
                  </td>
                  <td>
                    <Badge tone={t.amount < 0 ? "danger" : "success"}>{String(t.type).replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="text-xs text-muted-foreground">{t.description}</td>
                  <td className="text-right font-bold">{formatMoney(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
