import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Empty, Input, Select } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { exportSheet } from "@/lib/exports";

export const Route = createFileRoute("/tournament/$id/history")({
  head: () => ({
    meta: [
      { title: "Auction History — Cricket Auction Pro" },
      { name: "description", content: "Complete activity log of every bid, sale and rollback in this cricket auction." },
      { property: "og:title", content: "Auction History — Cricket Auction Pro" },
      { property: "og:description", content: "Searchable timeline of the whole auction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { id } = Route.useParams();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");

  const { data } = useQuery({
    queryKey: ["history", id],
    queryFn: async () => {
      const [t, events] = await Promise.all([
        supabase.from("tournaments").select("id,name").eq("id", id).maybeSingle(),
        supabase
          .from("auction_events")
          .select("*, players(name), teams(name)")
          .eq("tournament_id", id)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      return { t: t.data, events: events.data ?? [] };
    },
    refetchInterval: 8000,
  });

  const events = data?.events ?? [];
  const types = Array.from(new Set(events.map((e) => e.event_type)));
  const filtered = events.filter((e) => {
    const player = (e.players as { name?: string } | null)?.name ?? "";
    const team = (e.teams as { name?: string } | null)?.name ?? "";
    const text = `${player} ${team} ${e.event_type}`.toLowerCase();
    return (type === "all" || e.event_type === type) && text.includes(q.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{data?.t?.name ?? "Auction"} — history</h1>
      <p className="text-sm text-muted-foreground">Every action recorded during the auction.</p>

      <div className="my-4 flex flex-wrap gap-2">
        <Input placeholder="Search player, team or event…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[220px]">
          <option value="all">All events</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          onClick={() =>
            exportSheet(
              filtered.map((e) => ({
                When: new Date(e.created_at).toLocaleString("en-IN"),
                Event: e.event_type,
                Player: (e.players as { name?: string } | null)?.name ?? "",
                Team: (e.teams as { name?: string } | null)?.name ?? "",
                Amount: e.amount ?? "",
              })),
              "auction-history",
              "xlsx",
            )
          }
        >
          Export
        </Button>
        <Link to="/tournament/$id/results" params={{ id }} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">
          Results
        </Link>
      </div>

      {filtered.length === 0 && <Empty>No events recorded yet.</Empty>}
      <Card>
        <ol className="relative space-y-3">
          {filtered.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 border-l-2 border-primary/40 pl-3">
              <Badge tone={e.event_type.includes("SOLD") ? "success" : e.event_type.includes("UNDO") ? "warning" : "primary"}>
                {e.event_type.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm font-semibold">{(e.players as { name?: string } | null)?.name ?? ""}</span>
              <span className="text-sm text-muted-foreground">{(e.teams as { name?: string } | null)?.name ?? ""}</span>
              {e.amount !== null && <span className="text-sm font-bold text-accent">{formatMoney(e.amount)}</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
