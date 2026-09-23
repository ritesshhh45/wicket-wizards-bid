import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Empty, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — Cricket Auction Pro" },
      { name: "description", content: "Approve tournament hosting payments and monitor every live auction on the platform." },
      { property: "og:title", content: "Super Admin — Cricket Auction Pro" },
      { property: "og:description", content: "Platform-wide payment approvals and auction monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: payments, refetch } = useQuery({
    queryKey: ["admin-payments"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,utr_number,screenshot_url,status,created_at,tournament_id,tournaments(name,owner_id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: tournaments } = useQuery({
    queryKey: ["admin-tournaments"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,status,payment_status,num_teams,tournament_type,created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function review(paymentId: string, approve: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("review_payment", {
      p_payment_id: paymentId,
      p_approve: approve,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Payment approved" : "Payment rejected");
    await refetch();
  }

  if (!loading && !isSuperAdmin) {
    return (
      <AppShell>
        <Empty>You do not have permission to view this page.</Empty>
      </AppShell>
    );
  }

  const pending = (payments ?? []).filter((p) => p.status === "pending");

  return (
    <AppShell>
      <SectionTitle>Super admin</SectionTitle>
      <div className="space-y-5">
        <Card>
          <h3 className="mb-3 font-bold">Pending payment verifications</h3>
          {pending.length === 0 && <Empty>No payments waiting for review.</Empty>}
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {(p.tournaments as { name?: string } | null)?.name ?? "Tournament"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(p.amount)} · UTR {p.utr_number ?? "—"} ·{" "}
                    {new Date(p.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                {p.screenshot_url && (
                  <a
                    href={p.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-accent underline"
                  >
                    View screenshot
                  </a>
                )}
                <Button variant="accent" onClick={() => void review(p.id, true)}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => void review(p.id, false)}>
                  Reject
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <h3 className="mb-3 font-bold">All tournaments (monitoring only)</h3>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Tournament</th>
                <th>Type</th>
                <th>Teams</th>
                <th>Status</th>
                <th>Payment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(tournaments ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2.5 font-semibold">{t.name}</td>
                  <td className="text-muted-foreground">
                    {t.tournament_type === "turf" ? "Turf" : "Open Ground"}
                  </td>
                  <td>{t.num_teams}</td>
                  <td>
                    <Badge tone={t.status === "auction_live" ? "danger" : t.status === "active" ? "success" : "warning"}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={t.payment_status === "approved" ? "success" : "warning"}>{t.payment_status}</Badge>
                  </td>
                  <td>
                    <Link to="/live/$id" params={{ id: t.id }} className="text-xs font-bold text-accent">
                      Watch
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
