import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ShieldCheck,
  Camera,
  AlertCircle,
} from "lucide-react";

import { Button, Card, Input, Label, Select } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/register/$id")({
  head: () => ({
    meta: [
      {
        title: "Player Registration — Cricket Auction Pro",
      },
      {
        name: "description",
        content:
          "Register as a player for this cricket auction tournament.",
      },
      {
        property: "og:title",
        content: "Player Registration — Cricket Auction Pro",
      },
      {
        property: "og:description",
        content:
          "Register and automatically enter the cricket auction player pool.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),

  component: RegisterPage,
});

function RegisterPage() {
  const { id } = Route.useParams();

  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [photo, setPhoto] = useState<string | null>(null);

  const [registeredName, setRegisteredName] = useState("");
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "",
    role: "Batsman",
    mobile: "",
  });

  /* =========================================================
     TOURNAMENT
  ========================================================= */

  const {
    data: tournament,
    isLoading: tournamentLoading,
    error: tournamentError,
  } = useQuery({
    queryKey: ["register-tournament", id],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select(
          "id,name,venue,banner_url,categories,tournament_type,status",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  /* =========================================================
     PLAYER COUNT
  ========================================================= */

  const { data: playerCount, refetch: refetchPlayerCount } = useQuery({
    queryKey: ["register-player-count", id],

    queryFn: async () => {
      const { count, error } = await supabase
        .from("players")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("tournament_id", id);

      if (error) throw error;

      return count ?? 0;
    },
  });

  const categories =
    (tournament?.categories as unknown as string[] | null) ?? [];

  const roles =
    categories.length > 0
      ? categories
      : ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper"];

  /* =========================================================
     PHOTO UPLOAD
  ========================================================= */

  async function handlePhotoUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be smaller than 5MB.");
      return;
    }

    setPhotoUploading(true);

    try {
      const uploadedUrl = await uploadFile(file, "players");

      if (!uploadedUrl) {
        throw new Error("Photo upload failed.");
      }

      setPhoto(uploadedUrl);

      toast.success("Photo uploaded successfully.");
    } catch (error) {
      console.error("PHOTO UPLOAD ERROR:", error);

      toast.error(
        error instanceof Error ? error.message : "Photo upload failed.",
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  /* =========================================================
     NORMALIZE MOBILE
  ========================================================= */

  function normalizeMobile(value: string) {
    return value.replace(/\D/g, "").slice(0, 10);
  }

  /* =========================================================
     SUBMIT PLAYER
  ========================================================= */

  async function submit() {
    if (busy) return;

    const name = form.name.trim();
    const mobile = normalizeMobile(form.mobile);

    if (!name) {
      toast.error("Please enter your full name.");
      return;
    }

    if (mobile.length !== 10) {
      toast.error("Please enter a valid 10 digit mobile number.");
      return;
    }

    if (!photo) {
      toast.error("Please upload your photo.");
      return;
    }

    if (!tournament) {
      toast.error("Tournament not found.");
      return;
    }

    if (busy) return;

    setBusy(true);

    try {
      /* =====================================================
         LOCAL REGISTRATION LOCK
      ===================================================== */

      const lockKey = `auction-registration:${id}:${mobile}`;

      const existingLock = window.localStorage.getItem(lockKey);

      if (existingLock) {
        toast.error(
          "This mobile number has already been submitted from this device.",
        );

        setBusy(false);
        return;
      }

      /* =====================================================
         DUPLICATE CHECK
      ===================================================== */

      const { data: existingPlayer, error: duplicateCheckError } =
        await supabase
          .from("players")
          .select("id,name,status,mobile")
          .eq("tournament_id", id)
          .eq("mobile", mobile)
          .maybeSingle();

      if (duplicateCheckError) {
        console.error("DUPLICATE CHECK ERROR:", duplicateCheckError);

        throw new Error(
          duplicateCheckError.message || "Unable to verify registration.",
        );
      }

      if (existingPlayer) {
        toast.error(
          `This mobile number is already registered as ${existingPlayer.name}.`,
        );

        setBusy(false);
        return;
      }

      window.localStorage.setItem(lockKey, new Date().toISOString());

      /* =====================================================
         GET PLAYER NUMBER
      ===================================================== */

      const { count: currentCount, error: countError } = await supabase
        .from("players")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("tournament_id", id);

      if (countError) {
        window.localStorage.removeItem(lockKey);

        throw new Error(
          countError.message || "Unable to generate player number.",
        );
      }

      const nextNumber = (currentCount ?? 0) + 1;

      /* =====================================================
         CREATE PLAYER
      ===================================================== */

      const { data: insertedPlayer, error: insertError } = await supabase
        .from("players")
        .insert({
          tournament_id: id,
          name,
          role: form.role,
          mobile,
          city: "",
          batting_style: "",
          bowling_style: "",
          previous_team: "",
          photo_url: photo,
          base_price: 0,
          status: "available",
        })
        .select("id,name")
        .maybeSingle();

      if (insertError) {
        console.error("PLAYER INSERT ERROR:", insertError);

        window.localStorage.removeItem(lockKey);

        if ((insertError as { code?: string }).code === "23505") {
          toast.error(
            "This mobile number is already registered for this tournament.",
          );

          return;
        }

        throw new Error(
          insertError.message || "Registration failed. Please try again.",
        );
      }

      if (!insertedPlayer) {
        window.localStorage.removeItem(lockKey);

        throw new Error("Player was not created. Please try again.");
      }

      /* =====================================================
         SUCCESS
      ===================================================== */

      setRegisteredName(name);
      setPlayerNumber(nextNumber);
      setDone(true);

      await refetchPlayerCount();

      toast.success("Player registered successfully!");
    } catch (error) {
      console.error("REGISTRATION ERROR:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (tournamentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />

          <p className="text-sm text-muted-foreground">
            Loading tournament…
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     TOURNAMENT ERROR
  ========================================================= */

  if (tournamentError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-destructive/10">
            <AlertCircle className="size-8 text-destructive" />
          </div>

          <h1 className="mt-5 font-display text-2xl font-black">
            Registration unavailable
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Unable to load this tournament.
          </p>

          <p className="mt-2 break-words text-xs text-destructive">
            {tournamentError instanceof Error
              ? tournamentError.message
              : "Unknown error"}
          </p>
        </Card>
      </div>
    );
  }

  /* =========================================================
     TOURNAMENT NOT FOUND
  ========================================================= */

  if (!tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-3xl">
            🏏
          </div>

          <h1 className="mt-5 font-display text-2xl font-black">
            Tournament not found
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            This registration link may be invalid or the tournament may
            have been removed.
          </p>
        </Card>
      </div>
    );
  }

  /* =========================================================
     SUCCESS SCREEN
  ========================================================= */

  if (done) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Card className="overflow-hidden border-accent/30">
            <div className="bg-gradient-to-br from-accent/20 via-background to-primary/10 p-8 text-center">
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-accent/15">
                <CheckCircle2 className="size-11 text-accent" />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-accent">
                Registration Successful
              </p>

              <h1 className="mt-2 font-display text-3xl font-black">
                Welcome, {registeredName}!
              </h1>

              {playerNumber !== null && (
                <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface-2 px-5 py-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Player No.
                  </span>

                  <span className="font-display text-3xl font-black text-accent">
                    #{String(playerNumber).padStart(2, "0")}
                  </span>
                </div>
              )}

              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Your player profile has been successfully added to the
                auction player pool.
              </p>

              <div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-accent">
                  <ShieldCheck className="size-4" />
                  Player is ready for auction
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* =========================================================
     REGISTRATION FORM
  ========================================================= */

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        {/* HEADER */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-black md:text-3xl">
            {tournament.name}
          </h1>

          <div className="mt-3 inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs font-bold text-accent">
            {playerCount ?? 0} players registered
          </div>
        </div>

        {/* FORM */}
        <Card className="p-6">
          <div className="flex flex-col items-center gap-5">
            {/* PHOTO — circular, top */}
            <label
              className={`relative flex size-28 items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-2 transition ${
                busy
                  ? "cursor-not-allowed opacity-70"
                  : "cursor-pointer hover:border-accent hover:bg-accent/5"
              }`}
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Player preview"
                  className="size-28 rounded-full object-cover ring-2 ring-accent/40"
                />
              ) : (
                <Camera className="size-8 text-muted-foreground" />
              )}

              <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-accent text-accent-foreground shadow">
                <Camera className="size-4" />
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || photoUploading}
                className="hidden"
                onChange={(event) => void handlePhotoUpload(event)}
              />
            </label>

            {photoUploading && (
              <p className="-mt-3 text-xs font-semibold text-accent">
                Uploading photo…
              </p>
            )}

            {/* NAME */}
            <div className="w-full">
              <Label>Full name *</Label>

              <Input
                placeholder="Enter your full name"
                value={form.name}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </div>

            {/* MOBILE */}
            <div className="w-full">
              <Label>Mobile number *</Label>

              <Input
                type="tel"
                inputMode="numeric"
                placeholder="10 digit mobile number"
                value={form.mobile}
                disabled={busy}
                maxLength={10}
                onChange={(event) =>
                  setForm({
                    ...form,
                    mobile: normalizeMobile(event.target.value),
                  })
                }
              />
            </div>

            {/* ROLE */}
            <div className="w-full">
              <Label>Playing role *</Label>

              <Select
                value={form.role}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* SUBMIT */}
          <Button
            className="mt-6 w-full py-3 text-sm font-black"
            disabled={
              busy ||
              photoUploading ||
              form.mobile.length !== 10 ||
              !form.name.trim() ||
              !photo
            }
            onClick={() => void submit()}
          >
            {busy
              ? "Registering player…"
              : photoUploading
                ? "Uploading photo…"
                : "Register for Auction"}
          </Button>
        </Card>
      </div>
    </div>
  );
}