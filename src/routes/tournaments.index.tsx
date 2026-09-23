import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Tournaments — Cricket Auction Pro" },
      { name: "description", content: "Browse every cricket auction tournament on the platform." },
      { property: "og:title", content: "Tournaments — Cricket Auction Pro" },
      { property: "og:description", content: "Live, upcoming and completed cricket auction tournaments." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,venue,status,auction_date,num_teams,total_budget_per_team,banner_url")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <SectionTitle
        action={
          <Link to="/tournaments/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            Create Tournament
          </Link>
        }
      >
        Tournaments
      </SectionTitle>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && <Empty>No tournaments created yet.</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((t) => (
          <Card key={t.id}>
            {t.banner_url && (
              <img src={t.banner_url} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" />
            )}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold">{t.name}</h3>
              <Badge tone={t.status === "auction_live" ? "danger" : t.status === "active" ? "success" : "warning"}>
                {t.status === "auction_live" ? "● live" : t.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.venue ?? "Venue TBA"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t.num_teams} teams · {formatMoney(t.total_budget_per_team)} per team
            </p>
            {t.auction_date && (
              <p className="text-xs text-muted-foreground">
                {new Date(t.auction_date).toLocaleString("en-IN")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <Link to="/live/$id" params={{ id: t.id }} className="rounded-lg bg-accent px-3 py-2 text-accent-foreground">
                Live auction
              </Link>
              <Link to="/register/$id" params={{ id: t.id }} className="rounded-lg border border-border px-3 py-2">
                Register
              </Link>
              <Link to="/tournament/$id/results" params={{ id: t.id }} className="rounded-lg border border-border px-3 py-2">
                Results
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
