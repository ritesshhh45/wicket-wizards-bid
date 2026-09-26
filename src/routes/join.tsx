import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/join")({
  component: JoinTournamentPage,
});

function JoinTournamentPage() {
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();

    if (!joinCode || !name || !mobile || !teamName) {
      toast.error("Please fill all fields");
      return;
    }

    setBusy(true);

    try {
      // Find tournament using join code
      const { data: tournament, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("id, name")
          .eq("join_code", joinCode.toUpperCase())
          .single();

      if (tournamentError || !tournament) {
        throw new Error("Invalid tournament join code");
      }

      // Add captain
      const { error: captainError } = await supabase
        .from("captains")
        .insert({
          tournament_id: tournament.id,
          name,
          mobile,
          team_name: teamName,
        });

      if (captainError) throw captainError;

      toast.success(`Joined ${tournament.name} successfully!`);

      navigate({
        to: "/tournaments",
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">
          Join Tournament
        </h1>

        <p className="text-muted-foreground mb-6">
          Enter the tournament code provided by the organizer.
        </p>

        <form onSubmit={handleJoin} className="space-y-4">

          <input
            placeholder="Tournament Join Code"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase())
            }
            className="w-full rounded-lg border p-3"
          />

          <input
            placeholder="Captain Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border p-3"
          />

          <input
            placeholder="Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-lg border p-3"
          />

          <input
            placeholder="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full rounded-lg border p-3"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary p-3 font-semibold"
          >
            {busy ? "Joining..." : "Join Tournament"}
          </button>

        </form>
      </div>
    </div>
  );
}