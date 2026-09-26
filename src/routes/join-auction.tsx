import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join-auction")({
  component: JoinAuction,
});

type Tournament = {
  id: string;
  name: string;
  venue: string | null;
  banner_url: string | null;
  status: string | null;
  tournament_type: string | null;
  auction_date: string | null;
  captain_access_locked?: boolean | null;
};

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_name: string | null;
  owner_name: string | null;
  remaining_budget: number | null;
};

type CaptainSession = {
  tournamentId: string;
  teamId: string;
  teamName: string;
  captainName: string;
  ownerName: string;
  logoUrl: string | null;
  joinedAt: string;
};

const SESSION_KEY = "cricket-auction-captain-session";

function saveCaptainSession(session: CaptainSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function JoinAuction() {
  const navigate = useNavigate();

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [auctionId, setAuctionId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"list" | "credentials" | "team">("list");
  const [verifiedTournament, setVerifiedTournament] =
    useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /*
   * Public, credential-free listing. Reads from `public_tournaments`,
   * a view that deliberately does NOT include captain_access_id /
   * captain_access_password — those never reach the browser here.
   */
  const {
    data: tournaments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["join-auction-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_tournaments")
        .select(
          "id,name,venue,banner_url,status,tournament_type,auction_date",
        )
        .order("id", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Tournament[];
    },
  });

  const filteredTournaments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tournaments;

    return tournaments.filter((t) =>
      [t.name, t.venue, t.tournament_type, t.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [search, tournaments]);

  const selectedTournament = tournaments.find(
    (t) => t.id === selectedTournamentId,
  );

  async function verifyAccess() {
    setError("");

    if (!selectedTournamentId) {
      setError("Please select a tournament first.");
      return;
    }

    if (!auctionId.trim() || !password.trim()) {
      setError("Enter both Auction ID and Password.");
      return;
    }

    setBusy(true);

    try {
      /*
       * Credential check happens INSIDE Postgres via this RPC.
       * The password never travels to the client as data — only
       * a match/no-match (empty result) comes back.
       */
      const { data, error: rpcError } = await supabase.rpc(
        "verify_captain_access",
        {
          p_tournament_id: selectedTournamentId,
          p_auction_id: auctionId.trim(),
          p_password: password.trim(),
        },
      );

      if (rpcError) throw rpcError;

      const rows = (data ?? []) as Tournament[];
      const tournament = rows[0];

      if (!tournament) {
        setError("Invalid Auction ID or Password.");
        return;
      }

      if (tournament.captain_access_locked) {
        setError(
          "Captain joining is locked by the tournament owner. You cannot join this auction now.",
        );
        return;
      }

      if (
        tournament.status === "completed" ||
        tournament.status === "auction_ended"
      ) {
        setError("This auction has already ended.");
        return;
      }

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select(
          "id,name,logo_url,captain_name,owner_name,remaining_budget",
        )
        .eq("tournament_id", tournament.id)
        .order("created_at", { ascending: true });

      if (teamError) throw teamError;

      const availableTeams = (teamData ?? []) as Team[];

      if (availableTeams.length === 0) {
        setError(
          "No teams have been created for this tournament yet. Ask the owner to add the teams first.",
        );
        return;
      }

      setVerifiedTournament(tournament);
      setTeams(availableTeams);
      setSelectedTeamId("");
      setStep("team");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify the auction credentials.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function enterTournament() {
    setError("");

    const team = teams.find((t) => t.id === selectedTeamId);

    if (!verifiedTournament || !team) {
      setError("Select your team before entering the tournament.");
      return;
    }

    setBusy(true);

    try {
      const session: CaptainSession = {
        tournamentId: verifiedTournament.id,
        teamId: team.id,
        teamName: team.name,
        captainName: team.captain_name ?? "",
        ownerName: team.owner_name ?? "Tournament Owner",
        logoUrl: team.logo_url,
        joinedAt: new Date().toISOString(),
      };

      saveCaptainSession(session);

      await navigate({
        to: "/live/$id",
        params: { id: verifiedTournament.id },
        search: {
          captain_team: team.id,
        } as never,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to enter the tournament.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    setError("");
    setSelectedTournamentId("");
    setAuctionId("");
    setPassword("");
    setVerifiedTournament(null);
    setTeams([]);
    setSelectedTeamId("");
    setStep("list");
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050817] p-6 shadow-2xl sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-green-400">
              <ShieldCheck className="size-3.5" />
              Captain Access
            </div>

            <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
              Join an Auction
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Select your tournament, enter the Captain Auction ID and
              password shared by the tournament owner, then choose your
              assigned team to enter live bidding.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            <LockKeyhole className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Unable to continue</p>
              <p className="mt-1 text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        {step === "list" && (
          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-black text-white">
                  Available Tournaments
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Choose the tournament whose credentials the owner shared.
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tournament..."
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#080c1d] pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-green-400/50"
                />
              </div>
            </div>

            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                  />
                ))}
              </div>
            )}

            {isError && (
              <Card className="border-red-400/20 bg-red-400/5">
                <p className="font-bold text-white">
                  Unable to load tournaments.
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Check your Supabase connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-4 rounded-xl bg-green-400 px-4 py-2 text-sm font-black text-black"
                >
                  Retry
                </button>
              </Card>
            )}

            {!isLoading && !isError && filteredTournaments.length === 0 && (
              <Card className="border-white/10 bg-[#080c1d]/95">
                <div className="py-10 text-center">
                  <Trophy className="mx-auto size-10 text-slate-600" />
                  <p className="mt-3 font-bold text-white">
                    No tournaments found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask the tournament owner to create the tournament first.
                  </p>
                </div>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  type="button"
                  onClick={() => {
                    setError("");
                    setSelectedTournamentId(tournament.id);
                    setStep("credentials");
                  }}
                  className="group text-left"
                >
                  <Card className="h-full overflow-hidden border-white/10 bg-[#080c1d]/95 p-0 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-green-400/30">
                    {tournament.banner_url ? (
                      <img
                        src={tournament.banner_url}
                        alt=""
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-32 place-items-center bg-gradient-to-br from-purple-500/20 via-[#080c1d] to-green-400/10">
                        <Trophy className="size-10 text-green-400/70" />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-black text-white">
                            {tournament.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {tournament.venue ?? "Venue TBA"}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-green-400/20 bg-green-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-green-400">
                          {tournament.status === "auction_live"
                            ? "Live"
                            : tournament.status === "completed"
                              ? "Completed"
                              : "Open"}
                        </span>
                      </div>

                      {tournament.auction_date && (
                        <p className="mt-3 text-xs text-slate-500">
                          {new Date(tournament.auction_date).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-2 text-sm font-bold text-green-400">
                        Join this auction
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "credentials" && selectedTournament && (
          <section className="mx-auto mt-6 max-w-2xl">
            <Card className="border-white/10 bg-[#080c1d]/95">
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-green-400/10 text-green-400">
                  <KeyRound className="size-6" />
                </div>

                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-black text-white">
                    {selectedTournament.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    Enter the credentials shared by the owner.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-white">
                    Captain Auction ID
                  </label>
                  <input
                    value={auctionId}
                    onChange={(e) => setAuctionId(e.target.value)}
                    autoComplete="off"
                    placeholder="Example: AUC-8F29K"
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#050817] px-4 text-sm font-bold tracking-wide text-white outline-none placeholder:text-slate-600 focus:border-green-400/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white">
                    Password
                  </label>

                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      placeholder="Enter captain password"
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#050817] px-4 pr-12 text-sm font-bold tracking-wide text-white outline-none placeholder:text-slate-600 focus:border-green-400/50"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-purple-400/10 bg-purple-400/5 p-4">
                  <p className="text-xs leading-5 text-slate-400">
                    The ID and password are specific to this tournament. They
                    do not work for another tournament.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setStep("list");
                    }}
                    className="h-12 rounded-xl border border-white/10 px-5 text-sm font-black text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void verifyAccess()}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-green-400 px-5 text-sm font-black text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Verifying..." : "Verify & Continue"}
                    {!busy && <ArrowRight className="size-4" />}
                  </button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {step === "team" && verifiedTournament && (
          <section className="mt-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-green-400">
                  <CheckCircle2 className="size-3.5" />
                  Access verified
                </div>

                <h2 className="mt-3 font-display text-2xl font-black text-white">
                  Select Your Team
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Choose the team assigned to you by the tournament owner.
                </p>
              </div>

              <button
                type="button"
                onClick={resetFlow}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Change Tournament
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {teams.map((team, index) => {
                const selected = selectedTeamId === team.id;

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      setSelectedTeamId(team.id);
                      setError("");
                    }}
                    className={`text-left transition ${
                      selected ? "scale-[1.01]" : ""
                    }`}
                  >
                    <Card
                      className={`h-full border bg-[#080c1d]/95 transition ${
                        selected
                          ? "border-green-400/70 ring-2 ring-green-400/20"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Team {String(index + 1).padStart(2, "0")}
                        </span>

                        {selected && (
                          <CheckCircle2 className="size-5 text-green-400" />
                        )}
                      </div>

                      <div className="mt-5 grid size-20 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                        {team.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">🛡️</span>
                        )}
                      </div>

                      <p className="mt-4 font-display text-lg font-black text-white">
                        {team.name}
                      </p>

                      <div className="mt-3 space-y-1 text-xs">
                        <p className="text-slate-500">
                          Captain:{" "}
                          <span className="font-bold text-slate-300">
                            {team.captain_name || "Not set"}
                          </span>
                        </p>
                        <p className="text-slate-500">
                          Owner:{" "}
                          <span className="font-bold text-slate-300">
                            {team.owner_name || "Tournament Owner"}
                          </span>
                        </p>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>

            <Card className="mt-6 border-green-400/10 bg-green-400/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-5 text-green-400" />
                  <div>
                    <p className="font-bold text-white">
                      Captain access is ready
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      After entering the auction, your live screen should be
                      restricted to bidding for the selected team.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedTeamId || busy}
                  onClick={() => void enterTournament()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green-400 px-6 text-sm font-black text-black transition hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Entering..." : "Enter Tournament"}
                  {!busy && <ArrowRight className="size-4" />}
                </button>
              </div>
            </Card>
          </section>
        )}
      </main>
    </AppShell>
  );
}