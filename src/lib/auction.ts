import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Bid = Database["public"]["Tables"]["bids"]["Row"];
export type AuctionSession = Database["public"]["Tables"]["auction_sessions"]["Row"];

export type AuctionState = {
  tournament: Tournament | null;
  teams: Team[];
  players: Player[];
  session: AuctionSession | null;
  bids: (Bid & { teams: { name: string } | null })[];
  loading: boolean;
  connection: "connecting" | "live" | "offline";
  reload: () => Promise<void>;
};

export function useAuctionState(tournamentId: string): AuctionState {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<AuctionSession | null>(null);
  const [bids, setBids] = useState<(Bid & { teams: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");

  const reload = useCallback(async () => {
    const [t, tm, pl, ses] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("teams").select("*").eq("tournament_id", tournamentId).order("created_at"),
      supabase.from("players").select("*").eq("tournament_id", tournamentId).order("queue_order").order("created_at"),
      supabase
        .from("auction_sessions")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false }),
    ]);
    setTournament(t.data ?? null);
    setTeams(tm.data ?? []);
    setPlayers(pl.data ?? []);
    const sessions = ses.data ?? [];
    setSession(sessions.find((s) => s.status === "live" || s.status === "paused") ?? sessions[0] ?? null);
    setLoading(false);
  }, [tournamentId]);

  const loadBids = useCallback(async (playerId: string | null) => {
    if (!playerId) return setBids([]);
    const { data } = await supabase
      .from("bids")
      .select("*, teams(name)")
      .eq("player_id", playerId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(8);
    setBids((data ?? []) as (Bid & { teams: { name: string } | null })[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void loadBids(session?.current_player_id ?? null);
  }, [session?.current_player_id, loadBids]);

  useEffect(() => {
    const channel = supabase
      .channel(`auction-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` }, () => {
        void reload();
        void loadBids(session?.current_player_id ?? null);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${tournamentId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_sessions", filter: `tournament_id=eq.${tournamentId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `tournament_id=eq.${tournamentId}` }, () => void loadBids(session?.current_player_id ?? null))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("offline");
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, reload, loadBids, session?.current_player_id]);

  return { tournament, teams, players, session, bids, loading, connection, reload };
}

export function squadStats(players: Player[], teamId: string) {
  const bought = players.filter((p) => p.sold_to_team_id === teamId);
  const byRole: Record<string, number> = {};
  for (const p of bought) byRole[p.role] = (byRole[p.role] ?? 0) + 1;
  return { bought, count: bought.length, byRole, spent: bought.reduce((s, p) => s + (p.sold_price ?? 0), 0) };
}
