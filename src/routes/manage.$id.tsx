import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, Download, Share2, Trash2, Plus, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Empty, Input, Label, SectionTitle, Select } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { formatMoney } from "@/lib/format";
import { squadStats, useAuctionState } from "@/lib/auction";
import { downloadTemplate, exportPdf, exportSheet } from "@/lib/exports";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/manage/$id")({
  head: () => ({
    meta: [
      { title: "Tournament Dashboard — Cricket Auction Pro" },
      { name: "description", content: "Manage teams, players, registrations, settings and the live auction." },
      { property: "og:title", content: "Tournament Dashboard — Cricket Auction Pro" },
      { property: "og:description", content: "Everything you need to run your auction day." },
    ],
  }),
  component: ManageTournament,
});

const TABS = ["Overview", "Teams", "Players", "Registrations", "Import / Export", "Settings", "Sessions", "Share"] as const;
type Tab = (typeof TABS)[number];

function ManageTournament() {
  const { id } = Route.useParams();
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const state = useAuctionState(id);
  const { tournament, teams, players, session } = state;
  const [tab, setTab] = useState<Tab>("Overview");
  const [startingAuction, setStartingAuction] = useState(false);

  const isOwner = !!user && !!tournament && (tournament.owner_id === user.id || isSuperAdmin);
  const categories = (tournament?.categories ?? []) as unknown as string[];
  const tiers = (tournament?.base_price_tiers ?? []) as unknown as { grade: string; price: number }[];
  const pending = players.filter((p) => p.status === "pending_approval");
  const squadPlayers = players.filter((p) => p.status !== "pending_approval");

  if (!tournament) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!isOwner) {
    return (
      <AppShell>
        <Empty>You don't have permission to manage this tournament.</Empty>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle>{tournament.name}</SectionTitle>

        {/* OWNER-ONLY AUCTION CONTROL: this page itself is protected by isOwner above. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {tournament.status !== "auction_live" ? (
            <Button
              variant="accent"
              disabled={startingAuction}
              className="min-h-11 w-full rounded-xl px-5 py-3 text-sm font-extrabold shadow-lg sm:w-auto"
              onClick={async () => {
                setStartingAuction(true);
                try {
                  const { data: scheduled, error: sessionError } = await supabase
                    .from("auction_sessions")
                    .select("id")
                    .eq("tournament_id", id)
                    .eq("status", "scheduled")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (sessionError) {
                    toast.error(sessionError.message);
                    return;
                  }

                  if (!scheduled?.id) {
                    toast.error("Create an auction session first from the Sessions tab.");
                    setTab("Sessions");
                    return;
                  }

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { error } = await (supabase as any).rpc("start_auction", {
                    p_session_id: scheduled.id,
                  });

                  if (error) {
                    toast.error(error.message);
                    return;
                  }

                  await state.reload();
                  toast.success("Auction started successfully");
                  void navigate({ to: "/live/$id", params: { id } });
                } finally {
                  setStartingAuction(false);
                }
              }}
            >
              <Play className="size-4" />
              {startingAuction ? "Starting…" : "Start Auction"}
            </Button>
          ) : (
            <Link
              to="/live/$id"
              params={{ id }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-accent-foreground shadow-lg transition hover:scale-[1.01] hover:opacity-95 sm:w-auto"
            >
              <span className="text-base">●</span>
              Open Live Auction
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={tournament.payment_status === "approved" ? "success" : "danger"}>
          Payment: {tournament.payment_status}
        </Badge>
        <Badge tone={tournament.status === "auction_live" ? "danger" : "primary"}>{tournament.status.replace("_", " ")}</Badge>
        {tournament.config_locked && <Badge tone="warning">🔒 Auction configuration locked</Badge>}
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview state={state} />}
      {tab === "Teams" && <TeamsTab tournamentId={id} teams={teams} players={players} budget={tournament.total_budget_per_team} reload={state.reload} />}
      {tab === "Players" && <PlayersTab tournamentId={id} players={squadPlayers} categories={categories} tiers={tiers} reload={state.reload} />}
      {tab === "Registrations" && <RegistrationsTab pending={pending} reload={state.reload} />}
      {tab === "Import / Export" && <ImportExport tournamentId={id} players={squadPlayers} teams={teams} reload={state.reload} />}
      {tab === "Settings" && <SettingsTab tournament={tournament} reload={state.reload} />}
      {tab === "Sessions" && <SessionsTab tournamentId={id} reload={state.reload} currentSessionId={session?.id ?? null} />}
      {tab === "Share" && <ShareTab tournamentId={id} registered={pending.length + squadPlayers.length} />}
    </AppShell>
  );
}

function Overview({ state }: { state: ReturnType<typeof useAuctionState> }) {
  const { players, teams, session } = state;
  const sold = players.filter((p) => p.status === "sold");
  const value = sold.reduce((s, p) => s + (p.sold_price ?? 0), 0);
  const [bidCount, setBidCount] = useState(0);
  useEffect(() => {
    void supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", state.tournament?.id ?? "")
      .then(({ count }) => setBidCount(count ?? 0));
  }, [state.tournament?.id, players]);

  const stats = [
    { label: "Total players", value: players.filter((p) => p.status !== "pending_approval").length },
    { label: "Sold", value: sold.length },
    { label: "Unsold", value: players.filter((p) => p.status === "unsold").length },
    { label: "Remaining", value: players.filter((p) => p.status === "available" || p.status === "re_auction").length },
    { label: "Total auction value", value: formatMoney(value) },
    { label: "Total bids", value: bidCount },
    { label: "Active session", value: session?.name ?? "—" },
    { label: "Teams", value: teams.length },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <h3 className="mb-3 font-bold">Teams status</h3>
        <div className="space-y-2">
          {teams.map((t) => {
            const s = squadStats(players, t.id);
            return (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.count} players · spent {formatMoney(s.spent)} · left{" "}
                  <span className="font-bold text-accent">{formatMoney(t.remaining_budget)}</span>
                </span>
              </div>
            );
          })}
          {teams.length === 0 && <Empty>Add teams to get started.</Empty>}
        </div>
      </Card>
    </>
  );
}

function TeamsTab({
  tournamentId,
  teams,
  players,
  budget,
  reload,
}: {
  tournamentId: string;
  teams: ReturnType<typeof useAuctionState>["teams"];
  players: ReturnType<typeof useAuctionState>["players"];
  budget: number;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", captain_name: "", owner_name: "", owner_email: "", total_budget: 2000 });
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addTeam() {
    setBusy(true);
    try {
      let ownerUserId: string | null = null;
      if (form.owner_email) {
        const { data } = await supabase.from("profiles").select("id").eq("email", form.owner_email).maybeSingle();
        ownerUserId = data?.id ?? null;
        if (!ownerUserId) toast.warning("No account found for that email — team created without a linked owner.");
      }
      const { error } = await supabase.from("teams").insert({
        tournament_id: tournamentId,
        name: form.name,
        captain_name: form.captain_name,
        owner_name: form.owner_name,
        owner_user_id: ownerUserId,
        logo_url: logo,
        total_budget: form.total_budget,
        remaining_budget: form.total_budget,
      });
      if (error) throw error;
      setForm({ name: "", captain_name: "", owner_name: "", owner_email: "", total_budget: 2000 });
      setLogo(null);
      await reload();
      toast.success("Team added");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <h3 className="mb-4 font-bold">Add team</h3>
        <div className="space-y-3">
          <div>
            <Label>Team name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Captain name</Label>
            <Input value={form.captain_name} onChange={(e) => setForm({ ...form, captain_name: e.target.value })} />
          </div>
          <div>
            <Label>Owner name</Label>
            <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          </div>
          <div>
            <Label>Owner login email (optional)</Label>
            <Input value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
          </div>
          <div>
            <Label>Budget</Label>
            <Input type="number" value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: +e.target.value })} />
          </div>
          <div>
            <Label>Logo</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setLogo(await uploadFile(f, "teams"));
                toast.success("Logo uploaded");
              }}
            />
          </div>
          <Button disabled={busy || !form.name} onClick={() => void addTeam()} className="w-full">
            <Plus className="size-4" /> Add team
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {teams.map((t) => {
          const s = squadStats(players, t.id);
          return (
            <Card key={t.id}>
              <div className="flex items-center gap-3">
                <div className="size-11 overflow-hidden rounded-lg bg-surface-2">
                  {t.logo_url ? <img src={t.logo_url} alt="" className="size-11 object-cover" /> : <div className="grid size-11 place-items-center">🛡️</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Captain {t.captain_name || "—"} · Owner {t.owner_name || "—"}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-accent">{formatMoney(t.remaining_budget)}</p>
                  <p className="text-muted-foreground">{s.count} players</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Delete ${t.name}?`)) return;
                    await supabase.from("teams").delete().eq("id", t.id);
                    await reload();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          );
        })}
        {teams.length === 0 && <Empty>No teams yet.</Empty>}
      </div>
    </div>
  );
}

function PlayersTab({
  tournamentId,
  players,
  categories,
  tiers,
  reload,
}: {
  tournamentId: string;
  players: ReturnType<typeof useAuctionState>["players"];
  categories: string[];
  tiers: { grade: string; price: number }[];
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ name: "", role: categories[0] ?? "Batsman", grade: tiers[0]?.grade ?? "", base_price: 50, mobile: "", batting_style: "", bowling_style: "", city: "" });
  const [photo, setPhoto] = useState<string | null>(null);

  const list = useMemo(
    () =>
      players.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) &&
          (!roleFilter || p.role === roleFilter) &&
          (!statusFilter || p.status === statusFilter),
      ),
    [players, q, roleFilter, statusFilter],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <h3 className="mb-4 font-bold">Add player</h3>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Grade</Label>
            <Select
              value={form.grade}
              onChange={(e) => {
                const t = tiers.find((x) => x.grade === e.target.value);
                setForm({ ...form, grade: e.target.value, base_price: t?.price ?? form.base_price });
              }}
            >
              {tiers.map((t) => (
                <option key={t.grade} value={t.grade}>
                  {t.grade} · {formatMoney(t.price)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Base price</Label>
            <Input type="number" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: +e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Batting</Label>
              <Input value={form.batting_style} onChange={(e) => setForm({ ...form, batting_style: e.target.value })} />
            </div>
            <div>
              <Label>Bowling</Label>
              <Input value={form.bowling_style} onChange={(e) => setForm({ ...form, bowling_style: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Photo</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPhoto(await uploadFile(f, "players"));
                toast.success("Photo uploaded");
              }}
            />
          </div>
          <Button
            className="w-full"
            disabled={!form.name}
            onClick={async () => {
              const { error } = await supabase.from("players").insert({
                tournament_id: tournamentId,
                ...form,
                photo_url: photo,
                status: "available",
              });
              if (error) { toast.error(error.message); return; }
              setForm({ ...form, name: "", mobile: "" });
              setPhoto(null);
              await reload();
              toast.success("Player added");
            }}
          >
            <Plus className="size-4" /> Add player
          </Button>
        </div>
      </Card>

      <div>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Input placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {["available", "in_auction", "sold", "unsold", "re_auction"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Player</th>
                <th>Role</th>
                <th>Base</th>
                <th>Status</th>
                <th>Sold for</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, index) => (
                <tr key={p.id} className={`border-t border-border ${p.status === "sold" ? "bg-red-500/5" : ""}`}>
                  <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {p.photo_url ? <img src={p.photo_url} alt="" className="size-9 object-cover" /> : <div className="grid size-9 place-items-center text-sm">🏏</div>}
                        </div>
                        <span className="font-semibold">{String(index + 1).padStart(2, "0")} · {p.name}</span>
                      </div>
                    </td>
                  <td className="text-muted-foreground">{p.role}</td>
                  <td>{formatMoney(p.base_price)}</td>
                  <td>
                    <Badge tone={p.status === "sold" ? "danger" : p.status === "unsold" ? "danger" : "muted"}>
                        <span className={p.status === "sold" ? "font-extrabold text-red-500" : ""}>{p.status === "sold" ? "SOLD" : p.status}</span>
                      </Badge>
                  </td>
                  <td className="text-accent">{p.sold_price ? formatMoney(p.sold_price) : "—"}</td>
                  <td className="text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete ${p.name}?`)) return;
                        await supabase.from("players").delete().eq("id", p.id);
                        await reload();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty>No players match.</Empty>}
        </Card>
      </div>
    </div>
  );
}

function RegistrationsTab({
  pending,
  reload,
}: {
  pending: ReturnType<typeof useAuctionState>["players"];
  reload: () => Promise<void>;
}) {
  return (
    <Card>
      <h3 className="mb-4 font-bold">Pending registrations ({pending.length})</h3>
      {pending.length === 0 && <Empty>No pending registrations.</Empty>}
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            <div className="size-10 overflow-hidden rounded-lg bg-surface">
              {p.photo_url ? <img src={p.photo_url} alt="" className="size-10 object-cover" /> : <div className="grid size-10 place-items-center">🏏</div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.role} · {p.city || "—"} · {p.mobile || "—"} · base {formatMoney(p.base_price)}
              </p>
            </div>
            <Button
              variant="accent"
              onClick={async () => {
                await supabase.from("players").update({ status: "available" }).eq("id", p.id);
                await reload();
                toast.success("Approved into auction list");
              }}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await supabase.from("players").delete().eq("id", p.id);
                await reload();
                toast.success("Rejected");
              }}
            >
              Reject
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ImportExport({
  tournamentId,
  players,
  teams,
  reload,
}: {
  tournamentId: string;
  players: ReturnType<typeof useAuctionState>["players"];
  teams: ReturnType<typeof useAuctionState>["teams"];
  reload: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [sourceFile, setSourceFile] = useState("");
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState<Record<string, string>>({});

  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => set.add(key));
    }
    return Array.from(set);
  }, [rows]);

  const exportRows = players.map((p) => ({
    player_no: p.id,
    name: p.name,
    role: p.role,
    grade: p.grade ?? "",
    base_price: p.base_price,
    mobile: p.mobile ?? "",
    city: p.city ?? "",
    batting_style: p.batting_style ?? "",
    bowling_style: p.bowling_style ?? "",
    photo_url: p.photo_url ?? "",
    status: p.status,
    sold_price: p.sold_price ?? "",
    team: teams.find((t) => t.id === p.sold_to_team_id)?.name ?? "",
  }));

  const normalized = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_\-./]+/g, "");

  const findColumn = (keys: string[], aliases: string[]) => {
    for (const alias of aliases) {
      const exact = keys.find((key) => normalized(key) === normalized(alias));
      if (exact) return exact;
    }
    for (const key of keys) {
      const nk = normalized(key);
      if (aliases.some((alias) => nk.includes(normalized(alias)))) return key;
    }
    return "";
  };

  const guessMapping = (sourceRows: Record<string, unknown>[]) => {
    const keys = Array.from(new Set(sourceRows.flatMap((r) => Object.keys(r))));
    return {
      name: findColumn(keys, ["name", "player", "playername", "fullname", "player_name"]),
      role: findColumn(keys, ["role", "skill", "category", "playingrole", "playerrole"]),
      grade: findColumn(keys, ["grade", "group", "categorygrade"]),
      base_price: findColumn(keys, ["base_price", "baseprice", "base", "price", "basepoints"]),
      mobile: findColumn(keys, ["mobile", "mobile_no", "mobileno", "phone", "phone_no", "contact"]),
      city: findColumn(keys, ["city", "location"]),
      batting_style: findColumn(keys, ["batting_style", "battingstyle", "batting"]),
      bowling_style: findColumn(keys, ["bowling_style", "bowlingstyle", "bowling"]),
      photo_url: findColumn(keys, ["photo_url", "photourl", "photo", "image", "imageurl", "picture"]),
    };
  };

  const PLAYER_FIELD_ALIASES: Record<string, string[]> = {
    name: ["name", "player", "playername", "fullname", "player_name", "player name", "full name"],
    role: ["role", "skill", "category", "playingrole", "playerrole", "playing role"],
    grade: ["grade", "group", "categorygrade"],
    base_price: ["base_price", "baseprice", "base", "price", "basepoints", "base points"],
    mobile: ["mobile", "mobile_no", "mobileno", "phone", "phone_no", "contact", "mobile number", "phone number"],
    city: ["city", "location"],
    batting_style: ["batting_style", "battingstyle", "batting", "batting style"],
    bowling_style: ["bowling_style", "bowlingstyle", "bowling", "bowling style"],
    photo_url: ["photo_url", "photourl", "photo", "image", "imageurl", "picture", "photo url", "image url"],
  };

  const cleanHeader = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_\-./()]+/g, "");

  const looksLikePlayerHeader = (value: unknown) => {
    const normalized = cleanHeader(value);
    if (!normalized) return false;
    return Object.values(PLAYER_FIELD_ALIASES).some((aliases) =>
      aliases.some((alias) => normalized === cleanHeader(alias) || normalized.includes(cleanHeader(alias))),
    );
  };

  const findHeaderRow = (matrix: unknown[][]) => {
    const limit = Math.min(matrix.length, 30);
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < limit; i++) {
      const row = matrix[i] ?? [];
      const values = row.map((v) => String(v ?? "").trim()).filter(Boolean);
      if (!values.length) continue;

      const score = values.reduce((total, value) => total + (looksLikePlayerHeader(value) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex >= 0 ? bestIndex : matrix.findIndex((row) => row.some((v) => String(v ?? "").trim() !== ""));
  };

  const matrixToObjects = (matrix: unknown[][]) => {
    const headerIndex = findHeaderRow(matrix);
    if (headerIndex < 0) return [];

    const rawHeaders = matrix[headerIndex] ?? [];
    const headers: string[] = [];
    const used = new Set<string>();

    rawHeaders.forEach((value, index) => {
      let header = String(value ?? "").trim();
      if (!header) header = `column_${index + 1}`;

      let unique = header;
      let n = 2;
      while (used.has(unique)) {
        unique = `${header}_${n++}`;
      }
      used.add(unique);
      headers.push(unique);
    });

    const output: Record<string, unknown>[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex++) {
      const row = matrix[rowIndex] ?? [];
      if (!row.some((value) => String(value ?? "").trim() !== "")) continue;

      const object: Record<string, unknown> = {};
      headers.forEach((header, columnIndex) => {
        object[header] = row[columnIndex] ?? "";
      });

      if (Object.values(object).some((value) => String(value ?? "").trim() !== "")) {
        output.push(object);
      }
    }

    return output;
  };

  const readSpreadsheet = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      raw: false,
      dense: true,
      defval: "",
    });

    if (!workbook.SheetNames.length) {
      throw new Error("No worksheet found in this file.");
    }

    const allRows: Record<string, unknown>[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Read the sheet as a matrix first. This handles files where the real
      // header starts on row 2, 3, 4, etc. instead of silently treating the
      // first title row as the header and returning only one player.
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      });

      allRows.push(...matrixToObjects(matrix));
    }

    if (!allRows.length) {
      throw new Error("No player rows found. Make sure the file contains a Name/Player column with player data below it.");
    }

    return allRows;
  };

  const readCsv = async (file: File) => {
    const text = await file.text();
    const workbook = XLSX.read(text, {
      type: "string",
      raw: false,
      dense: true,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("CSV file is empty.");

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    const parsed = matrixToObjects(matrix);
    if (!parsed.length) {
      throw new Error("No player rows found in CSV. Make sure the file contains a Name/Player column.");
    }

    return parsed;
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop();

      if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
        throw new Error("For this importer use Excel (.xlsx/.xls) or CSV. PDF/DOC parsing is kept separate so player rows are never imported incorrectly.");
      }

      const parsed = ext === "csv" ? await readCsv(file) : await readSpreadsheet(file);
      const guessed = guessMapping(parsed);

      setRows(parsed);
      setMap(guessed);
      setSourceFile(`${file.name} · ${parsed.length} source rows · all sheets merged`);
      toast.success(`${parsed.length} player rows found`);
    } catch (err) {
      setRows([]);
      setMap({});
      setSourceFile("");
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const previewRows = useMemo(() => {
    const nameColumn = map.name;
    if (!nameColumn) return [];

    return rows
      .map((row, sourceIndex) => {
        const name = String(row[nameColumn] ?? "").trim();
        if (!name) return null;

        const role = String(row[map.role] ?? "Batsman").trim() || "Batsman";
        const rawBase = map.base_price ? Number(String(row[map.base_price] ?? "").replace(/,/g, "")) : 50;
        const base = Number.isFinite(rawBase) && rawBase > 0 ? rawBase : 50;

        return {
          sourceIndex,
          name,
          role,
          grade: map.grade ? String(row[map.grade] ?? "").trim() : "",
          base,
          mobile: map.mobile ? String(row[map.mobile] ?? "").trim() : "",
          city: map.city ? String(row[map.city] ?? "").trim() : "",
          batting_style: map.batting_style ? String(row[map.batting_style] ?? "").trim() : "",
          bowling_style: map.bowling_style ? String(row[map.bowling_style] ?? "").trim() : "",
          photo_url: map.photo_url ? String(row[map.photo_url] ?? "").trim() : "",
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);
  }, [rows, map]);

  async function importPlayers() {
    if (!previewRows.length) {
      toast.error("No player rows found. Map the Name column first.");
      return;
    }

    setBusy(true);

    try {
      // Prevent accidental double-imports by matching existing name/mobile.
      const { data: existing, error: existingError } = await supabase
        .from("players")
        .select("id,name,mobile")
        .eq("tournament_id", tournamentId);

      if (existingError) throw existingError;

      const existingKeys = new Set(
        (existing ?? []).flatMap((p) => [
          `name:${String(p.name ?? "").trim().toLowerCase()}`,
          ...(p.mobile ? [`mobile:${String(p.mobile).trim()}`] : []),
        ]),
      );

      const unique = new Map<string, (typeof previewRows)[number]>();

      for (const p of previewRows) {
        const nameKey = `name:${p.name.toLowerCase()}`;
        const mobileKey = p.mobile ? `mobile:${p.mobile}` : "";
        if (existingKeys.has(nameKey) || (mobileKey && existingKeys.has(mobileKey))) continue;

        const rowKey = mobileKey || nameKey;
        if (!unique.has(rowKey)) unique.set(rowKey, p);
      }

      const payload = Array.from(unique.values()).map((p) => ({
        tournament_id: tournamentId,
        name: p.name,
        role: p.role,
        grade: p.grade || null,
        base_price: 50, // auction default requested
        mobile: p.mobile || null,
        city: p.city || null,
        batting_style: p.batting_style || null,
        bowling_style: p.bowling_style || null,
        photo_url: p.photo_url || null,
        status: "available" as const,
      }));

      if (!payload.length) {
        toast.info("No new players to import. Existing players were skipped to prevent duplicates.");
        return;
      }

      // Insert in safe chunks for large player lists.
      const chunkSize = 100;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("players").insert(chunk);
        if (error) throw error;
      }

      setRows([]);
      setMap({});
      setSourceFile("");
      await reload();
      toast.success(`${payload.length} players imported as auction-ready cards`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">Import players</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload your player list. Every valid player row becomes an auction-ready player card.
            </p>
          </div>
        </div>

        <Input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.currentTarget.value = "";
          }}
        />

        {sourceFile && (
          <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
            {sourceFile}
          </div>
        )}

        <Button variant="ghost" className="mt-3" onClick={downloadTemplate} disabled={busy}>
          <Download className="size-4" /> Sample template
        </Button>

        {rows.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-sm font-bold">Column mapping</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Name is required. Other player details are optional.
              </p>
            </div>

            {[
              "name",
              "role",
              "grade",
              "base_price",
              "mobile",
              "city",
              "batting_style",
              "bowling_style",
              "photo_url",
            ].map((field) => (
              <div key={field} className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                <Label>{field}</Label>
                <Select
                  value={map[field] ?? ""}
                  onChange={(e) => setMap({ ...map, [field]: e.target.value })}
                >
                  <option value="">— skip —</option>
                  {cols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold">Auction card preview</p>
                <Badge tone="primary">{previewRows.length} players</Badge>
              </div>

              <div className="grid max-h-[520px] gap-3 overflow-auto sm:grid-cols-2">
                {previewRows.map((p, index) => (
                  <div
                    key={`${p.sourceIndex}-${p.name}`}
                    className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className="size-14 object-cover" />
                        ) : (
                          <div className="grid size-14 place-items-center text-xl">🏏</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-extrabold tracking-widest text-accent">
                          PLAYER {String(index + 1).padStart(2, "0")}
                        </p>
                        <p className="truncate font-bold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.role}
                          {p.city ? ` · ${p.city}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 border-t border-border">
                      <div className="p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground">Base</p>
                        <p className="font-extrabold text-accent">{formatMoney(50)}</p>
                      </div>
                      <div className="border-l border-border p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                        <p className="font-extrabold text-emerald-400">READY</p>
                      </div>
                    </div>
                  </div>
                ))}

                {previewRows.length === 0 && (
                  <div className="sm:col-span-2">
                    <Empty>Map the Name column to see player cards.</Empty>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {previewRows.length} valid players ready to import.
            </p>

            <Button
              className="w-full"
              disabled={busy || previewRows.length === 0}
              onClick={() => void importPlayers()}
            >
              {busy ? "Importing players…" : `Import ${previewRows.length} players`}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-bold">Export</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Download the current player pool or final squads.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => exportSheet(exportRows, "players", "xlsx")}>
            Players Excel
          </Button>
          <Button variant="ghost" onClick={() => exportSheet(exportRows, "players", "csv")}>
            Players CSV
          </Button>
          <Button variant="ghost" onClick={() => exportPdf("Player list", exportRows, "players")}>
            Players PDF
          </Button>
        </div>

        <h3 className="mb-3 mt-6 font-bold">Final squads</h3>

        <div className="space-y-2">
          {teams.map((t) => {
            const squad = players
              .filter((p) => p.sold_to_team_id === t.id)
              .map((p) => ({
                name: p.name,
                role: p.role,
                base_price: p.base_price,
                price_paid: p.sold_price ?? 0,
              }));

            return (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
              >
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="flex gap-2 text-xs">
                  <button
                    className="font-bold text-accent"
                    onClick={() => exportSheet(squad, `${t.name}-squad`, "xlsx")}
                  >
                    Excel
                  </button>
                  <button
                    className="font-bold text-accent"
                    onClick={() =>
                      exportPdf(`${t.name} squad`, squad, `${t.name}-squad`)
                    }
                  >
                    PDF
                  </button>
                </span>
              </div>
            );
          })}

          {teams.length === 0 && <Empty>No teams yet.</Empty>}
        </div>
      </Card>
    </div>
  );
}

function SettingsTab({
  tournament,
  reload,
}: {
  tournament: NonNullable<ReturnType<typeof useAuctionState>["tournament"]>;
  reload: () => Promise<void>;
}) {
  const locked = tournament.config_locked;
  const squad = tournament.min_max_squad as unknown as { min: number; max: number };
  const [form, setForm] = useState({
    name: tournament.name,
    venue: tournament.venue ?? "",
    num_teams: tournament.num_teams,
    total_budget_per_team: tournament.total_budget_per_team,
    min: squad?.min ?? 11,
    max: squad?.max ?? 15,
  });

  return (
    <Card>
      {locked && (
        <p className="mb-4 rounded-lg bg-warning/20 px-3 py-2 text-sm font-bold text-warning">
          🔒 Auction configuration locked — the auction has started.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Venue</Label>
          <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </div>
        <div>
          <Label>Number of teams</Label>
          <Input disabled={locked} type="number" value={form.num_teams} onChange={(e) => setForm({ ...form, num_teams: +e.target.value })} />
        </div>
        <div>
          <Label>Points per team</Label>
          <Input disabled={locked} type="number" value={form.total_budget_per_team} onChange={(e) => setForm({ ...form, total_budget_per_team: +e.target.value })} />
        </div>
        <div>
          <Label>Min squad</Label>
          <Input disabled={locked} type="number" value={form.min} onChange={(e) => setForm({ ...form, min: +e.target.value })} />
        </div>
        <div>
          <Label>Max squad</Label>
          <Input disabled={locked} type="number" value={form.max} onChange={(e) => setForm({ ...form, max: +e.target.value })} />
        </div>
      </div>
      <Button
        className="mt-4"
        onClick={async () => {
          const { error } = await supabase
            .from("tournaments")
            .update({
              name: form.name,
              venue: form.venue,
              ...(locked
                ? {}
                : {
                    num_teams: form.num_teams,
                    total_budget_per_team: form.total_budget_per_team,
                    min_max_squad: { min: form.min, max: form.max },
                  }),
            })
            .eq("id", tournament.id);
          if (error) { toast.error(error.message); return; }
          await reload();
          toast.success("Settings saved");
        }}
      >
        Save settings
      </Button>
    </Card>
  );
}

function SessionsTab({
  tournamentId,
  currentSessionId,
  reload,
}: {
  tournamentId: string;
  currentSessionId: string | null;
  reload: () => Promise<void>;
}) {
  const [sessions, setSessions] = useState<{ id: string; name: string; status: string; started_at: string | null }[]>([]);
  const [name, setName] = useState("Main Auction");

  const load = async () => {
    const { data } = await supabase
      .from("auction_sessions")
      .select("id,name,status,started_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });
    setSessions(data ?? []);
  };
  useEffect(() => {
    void load();
  }, [tournamentId, currentSessionId]);

  return (
    <Card>
      <h3 className="mb-3 font-bold">Auction sessions</h3>
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Session name" />
        <Button
          onClick={async () => {
            const { error } = await supabase.from("auction_sessions").insert({ tournament_id: tournamentId, name });
            if (error) { toast.error(error.message); return; }
            await load();
            await reload();
            toast.success("Session created");
          }}
        >
          <Plus className="size-4" /> Create
        </Button>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.started_at ? new Date(s.started_at).toLocaleString("en-IN") : "Not started"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={s.status === "live" ? "danger" : s.status === "completed" ? "success" : "muted"}>{s.status}</Badge>
              {s.status === "scheduled" && (
                <Button
                  variant="accent"
                  onClick={async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await (supabase as any).rpc("start_auction", { p_session_id: s.id });
                    if (error) { toast.error(error.message); return; }
                    await load();
                    await reload();
                    toast.success("Auction started");
                  }}
                >
                  <Play className="size-4" /> Start
                </Button>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && <Empty>Create a session to run the auction.</Empty>}
      </div>
    </Card>
  );
}

function ShareTab({ tournamentId, registered }: { tournamentId: string; registered: number }) {
  const [origin, setOrigin] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const links = useMemo(
    () => [
      { label: "Player registration", url: `${origin}/register/${tournamentId}` },
      { label: "Live auction (viewer)", url: `${origin}/live/${tournamentId}?view=public` },
      { label: "Results", url: `${origin}/tournament/${tournamentId}/results` },
      { label: "History", url: `${origin}/tournament/${tournamentId}/history` },
    ],
    [origin, tournamentId],
  );

  useEffect(() => {
    if (!origin) return;
    void Promise.all(links.map(async (l) => [l.label, await QRCode.toDataURL(l.url, { width: 220, margin: 1 })] as const)).then(
      (pairs) => setQrs(Object.fromEntries(pairs)),
    );
  }, [origin, links]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <p className="text-sm font-bold text-accent">{registered} players registered</p>
      </Card>
      {links.map((l) => (
        <Card key={l.label}>
          <p className="font-bold">{l.label}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{l.url}</p>
          {qrs[l.label] && <img src={qrs[l.label]} alt="" className="my-3 w-40 rounded-lg bg-white p-2" />}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(l.url);
                toast.success("Link copied");
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold"
              href={`https://wa.me/?text=${encodeURIComponent(l.label + ": " + l.url)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 className="size-4" /> WhatsApp
            </a>
            {qrs[l.label] && (
              <a
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold"
                href={qrs[l.label]}
                download={`${l.label}-qr.png`}
              >
                <Download className="size-4" /> QR
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
