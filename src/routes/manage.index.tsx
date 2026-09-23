import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/manage/")({
  head: () => ({
    meta: [
      { title: "Manage Tournaments — Cricket Auction Pro" },
      { name: "description", content: "Manage your tournaments, teams, players and auctions." },
      { property: "og:title", content: "Manage Tournaments — Cricket Auction Pro" },
      { property: "og:description", content: "Owner dashboard for your cricket auctions." },
    ],
  }),
  component: ManageIndex,
});

function ManageIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data } = useQuery({
    queryKey: ["manage-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,status,payment_status,num_teams")
        .eq("owner_id", user!.id)
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
        Manage tournaments
      </SectionTitle>
      {(data ?? []).length === 0 && <Empty>You haven't created a tournament yet.</Empty>}
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).map((t) => (
          <Link key={t.id} to="/manage/$id" params={{ id: t.id }}>
            <Card className="transition hover:ring-1 hover:ring-primary">
              <p className="font-bold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.num_teams} teams</p>
              <div className="mt-2 flex gap-1">
                <Badge tone={t.status === "active" || t.status === "auction_live" ? "success" : "warning"}>
                  {t.status.replace("_", " ")}
                </Badge>
                <Badge tone={t.payment_status === "approved" ? "success" : "danger"}>{t.payment_status}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
