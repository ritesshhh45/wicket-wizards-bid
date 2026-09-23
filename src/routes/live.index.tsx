import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/live/")({
  head: () => ({
    meta: [
      { title: "Live Auctions — Cricket Auction Pro" },
      { name: "description", content: "Join any running cricket auction and follow the bidding live." },
      { property: "og:title", content: "Live Auctions — Cricket Auction Pro" },
      { property: "og:description", content: "All running and upcoming cricket auctions." },
    ],
  }),
  component: LiveIndex,
});

function LiveIndex() {
  const { data } = useQuery({
    queryKey: ["live-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,venue,status")
        .in("status", ["active", "auction_live", "completed"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <SectionTitle>Live auctions</SectionTitle>
      {(data ?? []).length === 0 && <Empty>No auctions available yet.</Empty>}
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).map((t) => (
          <Link key={t.id} to="/live/$id" params={{ id: t.id }}>
            <Card className="transition hover:ring-1 hover:ring-primary">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{t.name}</p>
                <Badge tone={t.status === "auction_live" ? "danger" : "muted"}>
                  {t.status === "auction_live" ? "● live" : t.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.venue ?? "Venue TBA"}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
