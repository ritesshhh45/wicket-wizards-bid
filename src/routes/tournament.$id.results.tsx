import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { exportPdf, exportSheet } from "@/lib/exports";

export const Route = createFileRoute("/tournament/$id/results")({
  head: () => ({
    meta: [
      { title: "Auction Results — Cricket Auction Pro" },
      { name: "description", content: "Final squads, sold prices and unsold players from this cricket auction." },
      { property: "og:title", content: "Auction Results — Cricket Auction Pro" },
      { property: "og:description", content: "Team-by-team final squads and spending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["results", id],
    queryFn: async () => {
      const [t, teams, players] = await Promise.all([
        supabase.from("tournaments").select("id,name,venue,banner_url").eq("id", id).maybeSingle(),
        supabase.from("teams").select("*").eq("tournament_id", id).order("created_at"),
        supabase.from("players").select("*").eq("tournament_id", id),
      ]);
      return { t: t.data, teams: teams.data ?? [], players: players.data ?? [] };
    },
    refetchInterval: 10000,
  });

  const teams = data?.teams ?? [];
  const players = data?.players ?? [];
  const unsold = players.filter((p) => p.status === "unsold");

  const flat = players
    .filter((p) => p.status === "sold")
    .map((p) => ({
      Player: p.name,
      Role: p.role,
      Team: teams.find((t) => t.id === p.sold_to_team_id)?.name ?? "",
      Price: p.sold_price ?? 0,
    }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{data?.t?.name ?? "Results"}</h1>
        <p className="text-sm text-muted-foreground">{data?.t?.venue ?? "Venue TBA"} · Final auction results</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => exportSheet(flat, "auction-results", "xlsx")}>
            Export Excel
          </Button>
          <Button variant="ghost" onClick={() => exportSheet(flat, "auction-results", "csv")}>
            Export CSV
          </Button>
          <Button variant="ghost" onClick={() => exportPdf("Auction Results", flat, "auction-results")}>
            Export PDF
          </Button>
          <Link to="/tournament/$id/history" params={{ id }} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">
            Auction history
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const squad = players.filter((p) => p.sold_to_team_id === team.id);
          return (
            <Card key={team.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg font-bold">{team.name}</p>
                <span className="text-xs text-muted-foreground">{squad.length} players</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Spent {formatMoney(team.total_budget - team.remaining_budget)} · Left{" "}
                {formatMoney(team.remaining_budget)}
              </p>
              <div className="mt-3 space-y-1">
                {squad.length === 0 && <p className="text-xs text-muted-foreground">No players.</p>}
                {squad.map((p) => (
                  <div key={p.id} className="flex justify-between rounded bg-surface-2 px-2.5 py-1.5 text-xs">
                    <span>
                      {p.name} <span className="text-muted-foreground">({p.role})</span>
                    </span>
                    <span className="font-bold text-accent">{formatMoney(p.sold_price ?? 0)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <h3 className="mb-2 font-bold">Unsold players</h3>
        {unsold.length === 0 ? (
          <Empty>Every player found a team.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            {unsold.map((p) => (
              <span key={p.id} className="rounded-full bg-surface-2 px-3 py-1.5">
                {p.name} · {p.role}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
