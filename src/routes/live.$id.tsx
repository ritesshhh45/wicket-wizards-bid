import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Gavel,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Undo2,
  CheckCircle2,
  XCircle,
  Repeat,
  ListOrdered,
  Wifi,
  WifiOff,
  Maximize,
  Trophy,
  Users,
  Radio,
  Search,
  Lock,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Empty } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  formatMoney,
  timeAgo,
} from "@/lib/format";
import {
  squadStats,
  useAuctionState,
  type Player,
  type Team,
} from "@/lib/auction";

export const Route = createFileRoute("/live/$id")({
  validateSearch: (s: Record<string, unknown>): {
    view?: string;
    role?: string;
    access_id?: string;
    access_password?: string;
    captain_team?: string;
  } => ({
    ...(typeof s["view"] === "string" ? { view: s["view"] } : {}),
    ...(typeof s["role"] === "string" ? { role: s["role"] } : {}),
    ...(typeof s["access_id"] === "string" ? { access_id: s["access_id"] } : {}),
    ...(typeof s["access_password"] === "string" ? { access_password: s["access_password"] } : {}),
    ...(typeof s["captain_team"] === "string" ? { captain_team: s["captain_team"] } : {}),
  }),

  head: () => ({
    meta: [
      { title: "Live Auction — Cricket Auction Pro" },
      {
        name: "description",
        content:
          "Watch and take part in the live cricket player auction in real time.",
      },
      {
        property: "og:title",
        content: "Live Auction — Cricket Auction Pro",
      },
      {
        property: "og:description",
        content: "Real-time bidding, team budgets and squad updates.",
      },
    ],
  }),

  component: LiveAuction,
});

function LiveAuction() {
  const { id } = Route.useParams();
  const search = useSearch({ from: "/live/$id" });

  const publicMode = search.view === "public";
  const captainMode = search.role === "captain" && !publicMode;

  const { user, isSuperAdmin } = useAuth();

  const state = useAuctionState(id);

  const {
    tournament,
    teams,
    players,
    session,
    bids,
    loading,
    connection,
  } = state;

  const [busy, setBusy] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlayers, setShowPlayers] = useState(true);
  const [playerSearch, setPlayerSearch] = useState("");
  const [captainAuthLoading, setCaptainAuthLoading] = useState(captainMode);
  const [captainVerified, setCaptainVerified] = useState(!captainMode);
  const [captainAuthError, setCaptainAuthError] = useState("");
  const [captainTeamId, setCaptainTeamId] = useState<string | null>(null);

  // Once the first auction round is finished, every unsold player is
  // moved into a second (double-auction) round. sessionStorage keeps the
  // round state if the auction page is refreshed during the same session.
  const doubleAuctionStorageKey = `cricket-auction-double-round-${id}`;
  const [doubleAuctionStarted, setDoubleAuctionStarted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(doubleAuctionStorageKey) === "1";
  });

  const [flash, setFlash] = useState<{
    type: "sold" | "unsold";
    player: string;
    team?: string;
    amount?: number;
  } | null>(null);

  const isOwner =
    !!user &&
    !!tournament &&
    (tournament.owner_id === user.id || isSuperAdmin);

  const captainTeamStorageKey = `cricket-auction-captain-team-${id}`;

  useEffect(() => {
    if (!captainMode) {
      setCaptainAuthLoading(false);
      setCaptainVerified(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      setCaptainAuthLoading(true);
      setCaptainAuthError("");

      const accessId = search.access_id?.trim();
      const accessPassword = search.access_password?.trim();

      if (!accessId || !accessPassword) {
        const savedTeam =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(captainTeamStorageKey)
            : null;
        if (!cancelled) {
          setCaptainTeamId(search.captain_team ?? savedTeam);
          setCaptainVerified(false);
          setCaptainAuthError(
            "Captain access credentials are missing. Open the Join Auction screen and verify your Auction ID and Password first.",
          );
          setCaptainAuthLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("tournaments")
        .select("id, captain_access_id, captain_access_password, captain_access_locked")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setCaptainVerified(false);
        setCaptainAuthError(error.message);
        setCaptainAuthLoading(false);
        return;
      }

      if (!data) {
        setCaptainVerified(false);
        setCaptainAuthError("Tournament not found.");
        setCaptainAuthLoading(false);
        return;
      }

      const accessData = data as unknown as {
        captain_access_id?: string | null;
        captain_access_password?: string | null;
        captain_access_locked?: boolean | null;
      };

      if (accessData.captain_access_locked) {
        setCaptainVerified(false);
        setCaptainAuthError("Captain joining is locked by the tournament owner.");
        setCaptainAuthLoading(false);
        return;
      }

      if (accessData.captain_access_id !== accessId || accessData.captain_access_password !== accessPassword) {
        setCaptainVerified(false);
        setCaptainAuthError("Invalid Auction ID or Password.");
        setCaptainAuthLoading(false);
        return;
      }

      const savedTeam =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(captainTeamStorageKey)
          : null;
      const resolvedTeam = search.captain_team ?? savedTeam;

      if (resolvedTeam) {
        setCaptainTeamId(resolvedTeam);
      }

      setCaptainVerified(true);
      setCaptainAuthLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [captainMode, captainTeamStorageKey, id, search.access_id, search.access_password, search.captain_team]);

  const myTeam = captainMode
    ? teams.find((t) => t.id === captainTeamId) ?? null
    : teams.find((t) => t.owner_user_id === user?.id) ?? null;

  const auctioneer = isOwner && !publicMode && !captainMode;
  const visibleTeams = captainMode && myTeam ? [myTeam] : teams;

  // Force the tournament to use the exact auction slabs requested for this app.
  // This is important because the Supabase `place_bid` RPC reads
  // `tournaments.bid_increment_rules` when calculating the real bid amount.
  const FIXED_BID_RULES = [
    { upto: 100, increment: 10 },
    { upto: 200, increment: 20 },
    { upto: null, increment: 50 },
  ];

  useEffect(() => {
    if (!isOwner || !tournament || publicMode) return;

    const currentRules = Array.isArray(tournament.bid_increment_rules)
      ? tournament.bid_increment_rules as unknown as Array<{ upto?: number | null; increment?: number }>
      : [];

    const alreadyCorrect =
      currentRules.length === 3 &&
      Number(currentRules[0]?.upto) === 100 &&
      Number(currentRules[0]?.increment) === 10 &&
      Number(currentRules[1]?.upto) === 200 &&
      Number(currentRules[1]?.increment) === 20 &&
      currentRules[2]?.upto == null &&
      Number(currentRules[2]?.increment) === 50;

    if (alreadyCorrect) return;

    void (async () => {
      const { error } = await supabase
        .from("tournaments")
        .update({ bid_increment_rules: FIXED_BID_RULES })
        .eq("id", tournament.id);

      if (error) {
        console.warn("Could not normalize auction bid rules:", error.message);
        return;
      }

      await state.reload();
    })();
  }, [isOwner, tournament?.id, publicMode]);

  const current =
    players.find((p) => p.id === session?.current_player_id) ?? null;

  const leading =
    teams.find((t) => t.id === current?.current_bid_team_id) ?? null;

  /*
   * FIXED AUCTION RULES
   * Base price for every player = 50 points.
   * Bid slabs:
   *   50 -> 100 : +10  (50, 60, 70 ... 100)
   *   100 -> 200: +20  (120, 140, 160 ... 200)
   *   200+      : +50  (250, 300, 350 ...)
   *
   * IMPORTANT: the Supabase `place_bid` RPC must use the same rules.
   * The UI below always shows the correct next amount.
   */
  const AUCTION_BASE_PRICE = 50;

  function bidIncrementFor(amount: number): number {
    if (amount < 100) return 10;
    if (amount < 200) return 20;
    return 50;
  }

  const nextBid = current
    ? current.current_bid === null
      ? AUCTION_BASE_PRICE
      : current.current_bid + bidIncrementFor(Number(current.current_bid))
    : 0;

  const soldCount = players.filter(
    (p) => p.status === "sold",
  ).length;

  const unsoldCount = players.filter(
    (p) => p.status === "unsold",
  ).length;

  const remainingCount = players.filter(
    (p) =>
      p.status === "available" ||
      p.status === "re_auction" ||
      p.status === "in_auction",
  ).length;

  const soldPlayers = useMemo(
    () => players
      .filter((p) => p.status === "sold")
      .map((p) => ({ player: p, team: teams.find((t) => t.id === p.sold_to_team_id) ?? null })),
    [players, teams],
  );

  const doneCount = players.filter(
    (p) =>
      p.status === "sold" ||
      p.status === "unsold",
  ).length;

  const totalPool = players.filter(
    (p) => p.status !== "pending_approval",
  ).length;

  /*
   * PLAYER NUMBERS
   *
   * No fixed 50.
   * If database has 20 players -> 01-20
   * If database has 100 players -> 01-100
   * If database has 200 players -> 01-200
   */
  const numberedPlayers = useMemo(() => {
    return players.map((player, index) => ({
      player,
      number: index + 1,
    }));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();

    if (!query) return numberedPlayers;

    return numberedPlayers.filter(({ player }) => {
      return (
        player.name.toLowerCase().includes(query) ||
        player.role.toLowerCase().includes(query)
      );
    });
  }, [numberedPlayers, playerSearch]);

  useEffect(() => {
    if (!flash) return;

    const timer = setTimeout(() => {
      setFlash(null);
    }, 2600);

    return () => clearTimeout(timer);
  }, [flash]);

  async function rpc(
    fn: string,
    args: Record<string, unknown>,
    okMsg?: string,
  ) {
    setBusy(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(fn, args);

      if (error) throw error;

      if (okMsg) {
        toast.success(okMsg);
      }

      await state.reload();

      // Always return a truthy success value, even when the SQL RPC returns
      // void/null. This is important for Sold/Unsold -> Next Player.
      return { ok: true, data };
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function canBid(team: Team): {
    ok: boolean;
    reason?: string;
  } {
    if (!current) {
      return {
        ok: false,
        reason: "No player",
      };
    }

    if (session?.status !== "live") {
      return {
        ok: false,
        reason: "Auction paused",
      };
    }

    if (current.current_bid_team_id === team.id) {
      return {
        ok: false,
        reason: "Leading",
      };
    }

    if (nextBid > team.remaining_budget) {
      return {
        ok: false,
        reason: "Budget low",
      };
    }

    const stats = squadStats(players, team.id);

    const squad =
      tournament?.min_max_squad as unknown as {
        min: number;
        max: number;
      };

    if (stats.count >= (squad?.max ?? 15)) {
      return {
        ok: false,
        reason: "Squad full",
      };
    }

    const limits =
      (tournament?.category_limits ?? {}) as Record<
        string,
        {
          min?: number;
          max?: number;
        }
      >;

    const lim = limits[current.role];

    if (
      lim?.max !== undefined &&
      (stats.byRole[current.role] ?? 0) >= lim.max
    ) {
      return {
        ok: false,
        reason: "Category full",
      };
    }

    // Reserve calculation must use the auction's real base price, not old
    // grade-tier defaults such as 50,000 / 100,000.
    const minBase = AUCTION_BASE_PRICE;

    const requiredRemaining = Math.max(
      (squad?.min ?? 0) - (stats.count + 1),
      0,
    );

    if (
      team.remaining_budget - nextBid <
      requiredRemaining * minBase
    ) {
      return {
        ok: false,
        reason: "Reserve for min squad",
      };
    }

    return {
      ok: true,
    };
  }

  async function placeBid(team: Team) {
    if (!current) return;

    if (captainMode && (!captainVerified || !myTeam || myTeam.id !== team.id)) {
      toast.error("You can only bid for your assigned team.");
      return;
    }

    if (!captainMode && !auctioneer) {
      toast.error("Only an authorized auction participant can place a bid.");
      return;
    }

    const check = canBid(team);

    if (!check.ok) {
      toast.error(check.reason ?? "Cannot bid");
      return;
    }

    const result = await rpc(
      "place_bid",
      {
        p_player_id: current.id,
        p_team_id: team.id,
      },
    );

    if (result) {
      toast.success(
        `${team.name} bid ${formatMoney(nextBid)}`,
      );
    }
  }

  async function startDoubleAuctionRound(
    currentPlayerId: string,
    currentWasUnsold: boolean,
  ) {
    if (!session) return false;

    // At the end of round one, preserve the original player order. Existing
    // unsold players are first; the player that was just marked unsold is
    // appended if it was not already in the old local state.
    const unsoldIds = players
      .filter((p) => p.status === "unsold")
      .map((p) => p.id);

    if (currentWasUnsold && !unsoldIds.includes(currentPlayerId)) {
      unsoldIds.push(currentPlayerId);
    }

    if (unsoldIds.length === 0) return false;

    setDoubleAuctionStarted(true);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        doubleAuctionStorageKey,
        "1",
      );
    }

    toast.success("First round complete — Double Auction starting");

    // Put every unsold player into the re-auction queue. The existing
    // reauction_player RPC is used so squad/budget logic remains centralized
    // in Supabase.
    for (const playerId of unsoldIds) {
      const queued = await rpc("reauction_player", {
        p_player_id: playerId,
      });

      if (!queued) return false;
    }

    // Load the first unsold player directly so the second round always starts
    // from the first unsold card instead of accidentally picking a later one.
    const firstDoublePlayerId = unsoldIds[0];

    const loaded = await rpc("load_next_player", {
      p_session_id: session.id,
      p_player_id: firstDoublePlayerId,
    });

    return !!loaded;
  }

  async function advanceAfterResult(
    currentPlayerId: string,
    currentWasUnsold: boolean,
  ) {
    if (!session) return;

    // `players` is the state from immediately before the result RPC. The
    // current player is therefore excluded from the remaining-player check.
    // available/re_auction are the only statuses that can continue the
    // current round.
    const hasPlayersLeftInCurrentRound = players.some(
      (p) =>
        p.id !== currentPlayerId &&
        (p.status === "available" || p.status === "re_auction"),
    );

    if (hasPlayersLeftInCurrentRound) {
      await rpc("load_next_player", {
        p_session_id: session.id,
        p_player_id: null,
      });
      return;
    }

    // Round one has finished. If there are unsold players, convert ALL of
    // them into the second-round queue before loading the first one.
    if (!doubleAuctionStarted) {
      const unsoldExists =
        players.some((p) => p.status === "unsold") ||
        currentWasUnsold;

      if (unsoldExists) {
        const started = await startDoubleAuctionRound(
          currentPlayerId,
          currentWasUnsold,
        );
        if (started) return;
      }
    }

    // No players remain in the current round and the double auction has
    // already been completed (or there were no unsold players at all).
    await rpc(
      "complete_auction",
      {
        p_session_id: session.id,
      },
      "Auction completed — all players processed",
    );
  }

  async function markSold() {
    if (!current || !leading) return;

    const currentPlayerId = current.id;
    const playerName = current.name;
    const teamName = leading.name;
    const amount = current.current_bid ?? 0;

    const res = await rpc(
      "mark_player_sold",
      {
        p_player_id: currentPlayerId,
      },
    );

    if (res) {
      setFlash({
        type: "sold",
        player: playerName,
        team: teamName,
        amount,
      });

      await advanceAfterResult(currentPlayerId, false);
    }
  }

  async function markUnsold() {
    if (!current) return;

    const currentPlayerId = current.id;
    const playerName = current.name;

    const res = await rpc(
      "mark_player_unsold",
      {
        p_player_id: currentPlayerId,
      },
    );

    if (res) {
      setFlash({
        type: "unsold",
        player: playerName,
      });

      await advanceAfterResult(currentPlayerId, true);
    }
  }

  /*
   * LOAD A SPECIFIC PLAYER FROM NUMBER CARD
   */
  async function loadSpecificPlayer(player: Player) {
    if (!auctioneer || !session) return;

    if (player.status === "sold") {
      toast.error("This player is already SOLD.");
      return;
    }

    if (player.status === "pending_approval") {
      toast.error("This player is not approved for auction.");
      return;
    }

    if (session.status !== "live") {
      toast.error("Start the auction first.");
      return;
    }

    if (current?.id === player.id) {
      toast.info("This player is already on the block.");
      return;
    }

    await rpc(
      "load_next_player",
      {
        p_session_id: session.id,
        p_player_id: player.id,
      },
      `${player.name} loaded`,
    );
  }

  const body = (
    <div className="space-y-5">

      {captainMode && captainVerified && (
        <Card className="overflow-hidden border-primary/30 bg-primary/5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-primary/30">
              {myTeam?.logo_url ? (
                <img src={myTeam.logo_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Captain Access Verified</p>
              <h2 className="truncate font-display text-xl font-black">{myTeam?.name ?? "Team assignment pending"}</h2>
              <p className="text-sm text-muted-foreground">
                Captain: {myTeam?.captain_name ?? "Pending"}
                {myTeam?.owner_name ? ` · Owner: ${myTeam.owner_name}` : ""}
              </p>
            </div>
            <Badge tone="success">BID ONLY</Badge>
          </div>
          {!myTeam && (
            <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              Your captain access is verified, but no team has been assigned to this session yet. Complete Join Auction team assignment first.
            </div>
          )}
        </Card>
      )}

      {/* ========================================================= */}
      {/* TOP BAR */}
      {/* ========================================================= */}

      <div className="card-surface flex flex-wrap items-center gap-3 px-5 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {tournament?.name ?? "Auction"}
          </h1>

          <p className="text-xs text-muted-foreground">
            {session?.name ?? "No session"}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase ${
              session?.status === "live"
                ? "bg-destructive/20 text-destructive"
                : session?.status === "paused"
                  ? "bg-warning/20 text-warning"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            ● {session?.status ?? "not started"}
          </span>

          <Badge tone="primary">
            Player {Math.min(doneCount + 1, totalPool)} /{" "}
            {totalPool}
          </Badge>

          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {connection === "live" ? (
              <Wifi className="size-3 text-success" />
            ) : (
              <WifiOff className="size-3 text-warning" />
            )}

            {connection === "live"
              ? "Live connected"
              : "Reconnecting…"}
          </span>

          {!publicMode && (
            <Link
              to="/live/$id"
              params={{ id }}
              search={{ view: "public" }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              <Maximize className="size-3" />
              Viewer mode
            </Link>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* AUCTION PAUSED */}
      {/* ========================================================= */}

      {session?.status === "paused" && (
        <div className="rounded-xl bg-warning/20 p-4 text-center font-display text-xl font-bold text-warning">
          AUCTION PAUSED
        </div>
      )}

      {/* ========================================================= */}
      {/* LIVE PLAYER + BID HISTORY */}
      {/* ========================================================= */}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">

        {/* CURRENT PLAYER */}

        <Card className="relative overflow-hidden">

          {current ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

              {/* PLAYER PHOTO */}

              <div className="relative h-72 w-full shrink-0 overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-primary/30 sm:h-80 sm:w-64 lg:h-[360px] lg:w-72">

                {current.photo_url ? (
                  <img
                    src={current.photo_url}
                    alt={current.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-5xl">
                    🏏
                  </div>
                )}

                <div className="absolute left-2 top-2 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-black text-white">
                  LIVE
                </div>
              </div>

              {/* PLAYER INFO */}

              <div className="min-w-0 flex-1">

                <div className="mb-2 flex flex-wrap gap-2">

                  <Badge tone="primary">
                    {current.role}
                  </Badge>

                  {current.grade && (
                    <Badge>
                      Grade {current.grade}
                    </Badge>
                  )}

                  <Badge
                    tone={
                      current.status === "in_auction"
                        ? "warning"
                        : current.status === "sold"
                          ? "success"
                          : "danger"
                    }
                  >
                    {current.status === "in_auction"
                      ? "Bidding"
                      : current.status}
                  </Badge>
                </div>

                <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
                  {current.name}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Base price {formatMoney(AUCTION_BASE_PRICE)}
                </p>

                <div className="mt-4">

                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Current bid
                  </p>

                  <p className="font-display text-4xl font-black text-accent sm:text-6xl">
                    {current.current_bid === null
                      ? formatMoney(AUCTION_BASE_PRICE)
                      : formatMoney(current.current_bid)}
                  </p>

                  <div className="mt-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Next bid
                    </span>
                    <span className="ml-2 font-display text-lg font-black text-accent">
                      {formatMoney(nextBid)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">

                    {leading ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-bold text-primary">
                        <Trophy className="size-4" />
                        {leading.name}
                      </div>
                    ) : (
                      <span className="text-sm font-semibold">
                        No bids yet
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {bids.length} bids
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Empty>
              {session
                ? "No player on the block. Auctioneer can select a player."
                : "Auction has not started."}
            </Empty>
          )}
        </Card>

        {/* LIVE BID HISTORY */}

        <Card>

          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Live bids
            </h3>

            <Radio className="size-4 text-success" />
          </div>

          {leading && current && (
            <div className="mb-3 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">

              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Current leader
              </p>

              <div className="mt-1 flex items-center justify-between">

                <span className="font-bold">
                  {leading.name}
                </span>

                <span className="font-display text-xl font-black text-accent">
                  {formatMoney(current.current_bid ?? 0)}
                </span>

              </div>
            </div>
          )}

          {bids.length === 0 && (
            <Empty>No bids yet.</Empty>
          )}

          <div className="space-y-2">

            {bids.slice(0, 8).map((b, i) => (
              <div
                key={b.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  i === 0
                    ? "bg-primary/20 ring-1 ring-primary/40"
                    : "bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-2">

                  {i === 0 && (
                    <Trophy className="size-4 text-accent" />
                  )}

                  <span className="text-sm font-semibold">
                    {b.teams?.name ?? "Team"}
                  </span>
                </div>

                <span className="text-right">

                  <span className="block text-sm font-bold text-accent">
                    {formatMoney(b.amount)}
                  </span>

                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(b.created_at)}
                  </span>

                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ========================================================= */}
      {/* PLAYER NUMBER BOARD */}
      {/* ========================================================= */}

      {auctioneer && (
        <Card className="overflow-hidden">

          <div className="mb-4 flex flex-wrap items-center gap-3">

            <div>
              <h3 className="font-display text-lg font-bold">
                Auction Player Board
              </h3>

              <p className="text-xs text-muted-foreground">
                Select a player number to bring that player on the block.
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  value={playerSearch}
                  onChange={(e) =>
                    setPlayerSearch(e.target.value)
                  }
                  placeholder="Search player..."
                  className="h-9 w-44 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <Button
                variant="ghost"
                onClick={() =>
                  setShowPlayers((value) => !value)
                }
              >
                <ListOrdered className="size-4" />
                {showPlayers ? "Hide" : "Show"} Players
              </Button>
            </div>
          </div>

          {showPlayers && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

              {filteredPlayers.map(
                ({ player, number }) => {

                  const sold =
                    player.status === "sold";

                  const selected =
                    current?.id === player.id;

                  const disabled =
                    sold ||
                    !auctioneer ||
                    session?.status !== "live" ||
                    busy;

                  return (
                    <button
  key={player.id}
  type="button"
  disabled={disabled}
  onClick={() => void loadSpecificPlayer(player)}
  className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 ${
    sold
      ? "cursor-not-allowed border-red-500/40 bg-red-500/10 opacity-75"
      : selected
        ? "col-span-full border-2 border-primary bg-primary/10 ring-4 ring-primary/30 shadow-2xl shadow-primary/20 lg:min-h-[430px]"
        : "border-border bg-surface hover:-translate-y-1 hover:border-primary hover:ring-1 hover:ring-primary/40"
  }`}
>
  {/* PHOTO */}
  <div
    className={`relative overflow-hidden bg-surface-2 ${
      selected
        ? "h-[300px] sm:h-[380px] lg:h-[430px]"
        : "aspect-[3/4] min-h-[220px] sm:min-h-[250px]"
    }`}
  >
    {player.photo_url ? (
      <img
        src={player.photo_url}
        alt={player.name}
        className={`size-full object-cover transition-transform duration-500 ${
          sold
            ? "grayscale"
            : selected
              ? "scale-100"
              : "group-hover:scale-105"
        }`}
      />
    ) : (
      <div
        className={`grid size-full place-items-center ${
          selected ? "text-7xl" : "text-3xl"
        }`}
      >
        🏏
      </div>
    )}

    {/* DARK GRADIENT */}
    {selected && (
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
    )}

    {/* PLAYER NUMBER */}
    <div
      className={`absolute left-3 top-3 rounded-xl px-3 py-1.5 text-sm font-black ${
        sold
          ? "bg-red-600 text-white"
          : selected
            ? "bg-primary text-primary-foreground shadow-lg"
            : "bg-black/75 text-white"
      }`}
    >
      #{String(number).padStart(2, "0")}
    </div>

    {/* LIVE BADGE */}
    {selected && !sold && (
      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-lg">
        <span className="size-2 animate-pulse rounded-full bg-white" />
        LIVE BIDDING
      </div>
    )}

    {/* SOLD */}
    {sold && (
      <div className="absolute inset-0 grid place-items-center bg-red-950/50">
        <div className="rounded-xl border border-red-400/50 bg-red-600/90 px-4 py-2 text-sm font-black uppercase tracking-wider text-white">
          SOLD
        </div>
      </div>
    )}

    {/* CURRENT PLAYER INFO ON IMAGE */}
    {selected && !sold && (
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-primary">
          Player #{String(number).padStart(2, "0")} · On The Block
        </p>

        <h4 className="font-display text-3xl font-black sm:text-4xl lg:text-5xl">
          {player.name}
        </h4>

        <p className="mt-1 text-sm font-semibold text-white/80">
          {player.role}
          {player.city ? ` · ${player.city}` : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-black/60 px-4 py-2 backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">
              Base Price
            </p>

            <p className="font-display text-xl font-black text-accent">
              {formatMoney(AUCTION_BASE_PRICE)}
            </p>
          </div>

          <div className="rounded-xl bg-primary/90 px-4 py-2 shadow-lg">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
              Current Bid
            </p>

            <p className="font-display text-2xl font-black text-white">
              {formatMoney(
                player.current_bid ?? AUCTION_BASE_PRICE,
              )}
            </p>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* NORMAL CARD INFO */}
  {!selected && (
    <div className="p-3">
      <p className="truncate text-sm font-bold">
        {player.name}
      </p>

      <p
        className={`mt-0.5 truncate text-[11px] font-semibold ${
          sold
            ? "text-red-400"
            : "text-muted-foreground"
        }`}
      >
        {player.role}
        {player.city ? ` · ${player.city}` : ""}
      </p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Base
        </span>

        <span
          className={`text-xs font-bold ${
            sold
              ? "text-red-400"
              : "text-accent"
          }`}
        >
          {sold
            ? "SOLD"
            : formatMoney(AUCTION_BASE_PRICE)}
        </span>
      </div>
    </div>
  )}

  {/* CURRENT PLAYER FOOTER */}
  {selected && !sold && (
    <div className="border-t border-primary/20 bg-primary/5 px-5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">
          🔥 Currently Bidding
        </span>

        <span className="text-xs font-bold text-muted-foreground">
          Next: {formatMoney(nextBid)}
        </span>
      </div>
    </div>
  )}
</button>
                  );
                },
              )}
            </div>
          )}

          {filteredPlayers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">

              <Users className="mx-auto mb-2 size-7 text-muted-foreground" />

              <p className="text-sm font-semibold">
                No players found
              </p>

            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">

            <span className="font-semibold text-muted-foreground">
              Total: {totalPool}
            </span>

            <span className="font-semibold text-success">
              Sold: {soldCount}
            </span>

            <span className="font-semibold text-destructive">
              Unsold: {unsoldCount}
            </span>

            <span className="font-semibold text-accent">
              Remaining: {remainingCount}
            </span>

            <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
              <Lock className="size-3" />
              Sold players are locked
            </span>
          </div>
        </Card>
      )}

      {/* ========================================================= */}
      {/* AUCTIONEER CONTROLS */}
      {/* ========================================================= */}

      {auctioneer && session && (
        <Card>

          <div className="flex flex-wrap gap-2">

            {session.status !== "live" ? (
              <Button
                variant="accent"
                disabled={busy}
                onClick={() =>
                  void rpc(
                    session.status === "paused"
                      ? "pause_auction"
                      : "start_auction",
                    session.status === "paused"
                      ? {
                          p_session_id: session.id,
                          p_resume: true,
                        }
                      : {
                          p_session_id: session.id,
                        },
                    "Auction live",
                  )
                }
              >
                <Play className="size-4" />
                {session.status === "paused"
                  ? "Resume"
                  : "Start auction"}
              </Button>
            ) : (
              <Button
                variant="warning"
                disabled={busy}
                onClick={() =>
                  void rpc(
                    "pause_auction",
                    {
                      p_session_id: session.id,
                      p_resume: false,
                    },
                    "Auction paused",
                  )
                }
              >
                <Pause className="size-4" />
                Pause
              </Button>
            )}

            <Button
              variant="accent"
              disabled={
                busy ||
                !current ||
                !leading
              }
              onClick={() => void markSold()}
            >
              <CheckCircle2 className="size-4" />
              Sold
            </Button>

            <Button
              variant="danger"
              disabled={busy || !current}
              onClick={() => void markUnsold()}
            >
              <XCircle className="size-4" />
              Unsold
            </Button>

            <Button
              variant="ghost"
              disabled={busy || !current}
              onClick={() =>
                void rpc(
                  "undo_last_bid",
                  {
                    p_player_id: current?.id,
                  },
                  "Last bid undone",
                )
              }
            >
              <Undo2 className="size-4" />
              Undo bid
            </Button>

            <Button
              variant="ghost"
              disabled={busy || !current}
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to rollback this player? Budgets and squads will be restored.",
                  )
                ) {
                  void rpc(
                    "reopen_player",
                    {
                      p_player_id: current?.id,
                    },
                    "Player reopened",
                  );
                }
              }}
            >
              <RotateCcw className="size-4" />
              Rollback
            </Button>

            <Button
              variant="ghost"
              disabled={busy || !current}
              onClick={() =>
                void rpc(
                  "reauction_player",
                  {
                    p_player_id: current?.id,
                  },
                  "Sent to re-auction",
                )
              }
            >
              <Repeat className="size-4" />
              Re-auction
            </Button>

            <Button
              variant="primary"
              disabled={
                busy ||
                session.status !== "live"
              }
              onClick={() =>
                void rpc(
                  "load_next_player",
                  {
                    p_session_id: session.id,
                    p_player_id: null,
                  },
                  "Next player loaded",
                )
              }
            >
              <SkipForward className="size-4" />
              Next player
            </Button>

            <Button
              variant="ghost"
              onClick={() =>
                setShowQueue((q) => !q)
              }
            >
              <ListOrdered className="size-4" />
              Queue
            </Button>

            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Complete this auction session?",
                  )
                ) {
                  void rpc(
                    "complete_auction",
                    {
                      p_session_id: session.id,
                    },
                    "Auction completed",
                  );
                }
              }}
            >
              Complete
            </Button>
          </div>

          {/* QUEUE */}

          {showQueue && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">

              {(
                [
                  "available",
                  "re_auction",
                  "unsold",
                ] as const
              ).map((st) => (
                <div key={st}>

                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {st === "available"
                      ? "Up next"
                      : st === "re_auction"
                        ? "Re-auction queue"
                        : "Unsold"}
                  </p>

                  <div className="max-h-64 space-y-1 overflow-auto">

                    {players
                      .filter(
                        (p) => p.status === st,
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                        >

                          <span className="truncate text-xs font-semibold">
                            {p.name}
                            <span className="text-muted-foreground">
                              {" "}
                              · {p.role}
                            </span>
                          </span>

                          <div className="flex gap-2">

                            {st !== "available" && (
                              <button
                                className="text-[10px] font-bold text-accent"
                                onClick={() =>
                                  void rpc(
                                    "reauction_player",
                                    {
                                      p_player_id:
                                        p.id,
                                    },
                                    "Queued",
                                  )
                                }
                              >
                                QUEUE
                              </button>
                            )}

                            <button
                              className="text-[10px] font-bold text-primary"
                              onClick={() =>
                                void rpc(
                                  "load_next_player",
                                  {
                                    p_session_id:
                                      session.id,
                                    p_player_id:
                                      p.id,
                                  },
                                  "Loaded",
                                )
                              }
                            >
                              LOAD
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ========================================================= */}
      {/* TEAM GRID — CAPTAINS */}
      {/* ========================================================= */}

      {!publicMode && (
        <div>

          <div className="mb-3 flex items-center justify-between">

            <div>
              <h3 className="font-display text-lg font-bold">
                Live Bidding Teams
              </h3>

              <p className="text-xs text-muted-foreground">
                {teams.length} teams connected to this auction
              </p>
            </div>

            <Users className="size-5 text-accent" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

            {visibleTeams.map((team) => {

              const stats = squadStats(
                players,
                team.id,
              );

              const squad =
                tournament?.min_max_squad as unknown as {
                  min: number;
                  max: number;
                };

              const check = canBid(team);

              const mine =
                myTeam?.id === team.id;

              const canClick =
                (auctioneer || mine) &&
                check.ok &&
                !busy;

              const isLeading =
                leading?.id === team.id;

              return (
                <Card
                  key={team.id}
                  className={`relative overflow-hidden transition ${
                    isLeading
                      ? "ring-2 ring-primary shadow-lg shadow-primary/10"
                      : ""
                  }`}
                >

                  {isLeading && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[9px] font-black uppercase text-primary-foreground">
                      Leading
                    </div>
                  )}

                  <div className="flex items-center gap-3">

                    <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">

                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center">
                          🛡️
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">

                      <p className="truncate font-bold">
                        {team.name}
                      </p>

                      <p className="truncate text-[11px] text-muted-foreground">
                        Captain: {team.captain_name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <div className="rounded-lg bg-surface-2 p-2">
                      <p className="text-[9px] uppercase text-muted-foreground">
                        Budget left
                      </p>

                      <p className="mt-0.5 font-bold text-accent">
                        {formatMoney(
                          team.remaining_budget,
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-2 p-2">
                      <p className="text-[9px] uppercase text-muted-foreground">
                        Squad
                      </p>

                      <p className="mt-0.5 font-bold">
                        {stats.count}/
                        {squad?.max ?? "-"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">

                    {(
                      (tournament?.categories ??
                        []) as unknown as string[]
                    ).map((c) => (
                      <span
                        key={c}
                        className="rounded bg-surface-2 px-1.5 py-0.5"
                      >
                        {c.slice(0, 3)}:{" "}
                        {stats.byRole[c] ?? 0}
                      </span>
                    ))}
                  </p>

                  {(auctioneer || mine) && (
                    <Button
                      className="mt-3 w-full"
                      variant={
                        isLeading
                          ? "accent"
                          : "primary"
                      }
                      disabled={!canClick}
                      onClick={() =>
                        void placeBid(team)
                      }
                    >
                      <Gavel className="size-4" />

                      {check.ok
                        ? `BID ${formatMoney(
                            nextBid,
                          )}`
                        : check.reason}
                    </Button>
                  )}
                </Card>
              );
            })}

            {teams.length === 0 && (
              <Empty>
                No teams added yet.
              </Empty>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SOLD PLAYERS — VISIBLE, NEVER CLICKABLE */}
      {/* ========================================================= */}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">Sold Players</h3>
            <p className="text-xs text-muted-foreground">
              Sold players stay visible for captains and are permanently locked.
            </p>
          </div>
          <Badge tone="success">{soldPlayers.length} SOLD</Badge>
        </div>

        {soldPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold text-muted-foreground">No players sold yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {soldPlayers.map(({ player, team }) => (
              <div key={player.id} className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/5">
                <div className="relative h-52 overflow-hidden bg-surface-2">
                  {player.photo_url ? (
                    <img src={player.photo_url} alt={player.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-5xl">🏏</div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">SOLD</div>
                </div>
                <div className="p-3">
                  <p className="truncate font-display text-base font-black">{player.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{player.role}{player.city ? ` · ${player.city}` : ""}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sold to</p>
                      <p className="truncate text-sm font-bold text-primary">{team?.name ?? "Team"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Price</p>
                      <p className="font-display text-lg font-black text-accent">{formatMoney(player.sold_price ?? 0)}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-red-500/10 px-2.5 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-red-400">
                    🔒 Bidding locked
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ========================================================= */}
      {/* SUMMARY TABLE */}
      {/* ========================================================= */}

      <Card className="overflow-x-auto">

        <div className="mb-3 flex items-center justify-between">

          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            All teams summary
          </h3>

          <Trophy className="size-4 text-accent" />
        </div>

        <table className="w-full min-w-[720px] text-left text-sm">

          <thead className="text-xs uppercase text-muted-foreground">

            <tr>
              <th className="py-2">
                Team
              </th>

              <th>
                Captain
              </th>

              <th>
                Allotted
              </th>

              <th>
                Spent
              </th>

              <th>
                Remaining
              </th>

              <th>
                Players
              </th>

              <th>
                Categories
              </th>
            </tr>
          </thead>

          <tbody>

            {teams.map((t) => {

              const s = squadStats(
                players,
                t.id,
              );

              const squad =
                tournament?.min_max_squad as unknown as {
                  min: number;
                  max: number;
                };

              return (
                <TeamRow
                  key={t.id}
                  team={t}
                  stats={s}
                  max={squad?.max ?? 0}
                  categories={
                    (tournament?.categories ??
                      []) as unknown as string[]
                  }
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ========================================================= */}
      {/* AUCTION FOOTER STATS */}
      {/* ========================================================= */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-black">
            {totalPool}
          </p>

          <p className="text-xs text-muted-foreground">
            Total Players
          </p>
        </div>

        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
          <p className="text-2xl font-black text-success">
            {soldCount}
          </p>

          <p className="text-xs text-muted-foreground">
            Sold
          </p>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-2xl font-black text-destructive">
            {unsoldCount}
          </p>

          <p className="text-xs text-muted-foreground">
            Unsold
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-2xl font-black text-primary">
            {remainingCount}
          </p>

          <p className="text-xs text-muted-foreground">
            Remaining
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SOLD / UNSOLD FLASH */}
      {/* ========================================================= */}

      {flash && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur">

          <div className="animate-pop-in w-full max-w-xl rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">

            {flash.type === "sold" ? (
              <>
                <p className="font-display text-6xl font-black text-success">
                  🎉 SOLD
                </p>

                <p className="mt-4 font-display text-4xl font-bold">
                  {flash.player}
                </p>

                <p className="mt-4 text-sm uppercase tracking-widest text-muted-foreground">
                  SOLD TO
                </p>

                <p className="mt-1 font-display text-3xl font-black text-primary">
                  {flash.team}
                </p>

                <p className="mt-3 font-display text-5xl font-black text-accent">
                  {formatMoney(
                    flash.amount ?? 0,
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-6xl font-black text-destructive">
                  🔴 UNSOLD
                </p>

                <p className="mt-4 font-display text-4xl font-bold">
                  {flash.player}
                </p>

                <p className="mt-3 text-sm text-muted-foreground">
                  Player moved to unsold pool
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (captainMode && captainAuthLoading) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-xl p-8 text-center">
          <Lock className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="font-display text-2xl font-black">Verifying Captain Access…</h1>
          <p className="mt-2 text-sm text-muted-foreground">Checking your Auction ID and Password.</p>
        </Card>
      </AppShell>
    );
  }

  if (captainMode && !captainVerified) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-xl p-8 text-center">
          <Lock className="mx-auto mb-4 size-10 text-destructive" />
          <h1 className="font-display text-2xl font-black">Captain Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">{captainAuthError || "Invalid captain credentials."}</p>
          <Link
            to="/manage/$id"
            params={{ id }}
            className="mt-5 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-bold"
          >
            Back to Tournament
          </Link>
        </Card>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">
          Loading auction…
        </p>
      </AppShell>
    );
  }

  if (publicMode) {
    return (
      <div className="min-h-screen px-4 py-6">
        {body}
      </div>
    );
  }

  return <AppShell>{body}</AppShell>;
}

/* =============================================================== */
/* TEAM ROW */
/* =============================================================== */

function TeamRow({
  team,
  stats,
  max,
  categories,
}: {
  team: Team;
  stats: ReturnType<typeof squadStats>;
  max: number;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-t border-border hover:bg-surface-2"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="py-2.5 font-semibold">
          {team.name}
        </td>

        <td className="text-muted-foreground">
          {team.captain_name}
        </td>

        <td>
          {formatMoney(team.total_budget)}
        </td>

        <td>
          {formatMoney(stats.spent)}
        </td>

        <td className="font-bold text-accent">
          {formatMoney(team.remaining_budget)}
        </td>

        <td>
          {stats.count}/{max}
        </td>

        <td className="text-xs text-muted-foreground">
          {categories
            .map(
              (c) =>
                `${c.slice(0, 3)}:${stats.byRole[c] ?? 0}`,
            )
            .join(" ")}
        </td>
      </tr>

      {open && (
        <tr className="border-t border-border bg-surface-2/50">

          <td colSpan={7} className="p-3">

            {stats.bought.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No players bought yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

                {stats.bought.map(
                  (p: Player) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        {p.name}{" "}
                        <span className="text-muted-foreground">
                          ({p.role})
                        </span>
                      </span>

                      <span className="ml-2 shrink-0 font-bold text-accent">
                        {formatMoney(
                          p.sold_price ?? 0,
                        )}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}