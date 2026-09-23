import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Empty, Input, Label, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Cricket Auction Pro" },
      { name: "description", content: "Manage your account, tournaments, team and password." },
      { property: "og:title", content: "My Profile — Cricket Auction Pro" },
      { property: "og:description", content: "Your Cricket Auction Pro account overview." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, loading, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);
  useEffect(() => {
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const { data: tournaments } = useQuery({
    queryKey: ["my-tournaments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,status,payment_status")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: myTeams } = useQuery({
    queryKey: ["my-teams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("id,name,remaining_budget,total_budget,tournament_id,tournaments(name)")
        .eq("owner_user_id", user!.id);
      return data ?? [];
    },
  });

  if (!user) return null;

  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle>Account</SectionTitle>
          <div className="mb-4 flex items-center gap-4">
            <div className="grid size-16 place-items-center overflow-hidden rounded-full bg-surface-2 text-2xl">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="" className="size-16 object-cover" />
              ) : (
                "🏏"
              )}
            </div>
            <div>
              <p className="font-bold">{profile?.name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-1 flex gap-1">
                {roles.map((r) => (
                  <Badge key={r} tone="primary">
                    {r.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Profile photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await uploadFile(f, "avatars");
                    await supabase.from("profiles").update({ photo_url: url }).eq("id", user.id);
                    await refresh();
                    toast.success("Photo updated");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              />
            </div>
            <Button
              onClick={async () => {
                const { error } = await supabase.from("profiles").update({ name, phone }).eq("id", user.id);
                if (error) toast.error(error.message);
                else {
                  await refresh();
                  toast.success("Profile saved");
                }
              }}
            >
              Save profile
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Label>Change password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                variant="ghost"
                onClick={async () => {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) toast.error(error.message);
                  else {
                    setNewPassword("");
                    toast.success("Password updated");
                  }
                }}
              >
                Update
              </Button>
            </div>
            <Button
              variant="danger"
              className="mt-4"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/" });
              }}
            >
              Logout
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionTitle
              action={
                <Link to="/tournaments/new" className="text-xs font-bold text-accent">
                  + New
                </Link>
              }
            >
              My tournaments
            </SectionTitle>
            {(tournaments ?? []).length === 0 && <Empty>No tournaments yet.</Empty>}
            <div className="space-y-2">
              {(tournaments ?? []).map((t) => (
                <Link
                  key={t.id}
                  to="/manage/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5"
                >
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="flex gap-1">
                    <Badge tone={t.status === "active" || t.status === "auction_live" ? "success" : "warning"}>
                      {t.status.replace("_", " ")}
                    </Badge>
                    <Badge tone={t.payment_status === "approved" ? "success" : "danger"}>
                      {t.payment_status === "approved" ? "Paid" : t.payment_status}
                    </Badge>
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>My teams</SectionTitle>
            {(myTeams ?? []).length === 0 && <Empty>You are not assigned to a team yet.</Empty>}
            <div className="space-y-2">
              {(myTeams ?? []).map((t) => (
                <Link
                  key={t.id}
                  to="/team/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5"
                >
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="text-xs text-accent">{formatMoney(t.remaining_budget)} left</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
