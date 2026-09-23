import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, Upload, UserRound } from "lucide-react";
import { Button, Card, Input, Label, Select } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/register/$id")({
  head: () => ({
    meta: [
      { title: "Player Registration — Cricket Auction Pro" },
      {
        name: "description",
        content:
          "Register as a player for this cricket auction tournament. Your player card will be added automatically.",
      },
      {
        property: "og:title",
        content: "Player Registration — Cricket Auction Pro",
      },
      {
        property: "og:description",
        content: "Register and automatically enter the cricket auction player pool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    city: "",
    batting_style: "",
    bowling_style: "",
    previous_team: "",
  });

  /* -------------------------------------------------------
     TOURNAMENT
  ------------------------------------------------------- */

  const { data: t, isLoading: tournamentLoading } = useQuery({
    queryKey: ["reg-tournament", id],
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

  /* -------------------------------------------------------
     PLAYER COUNT
  ------------------------------------------------------- */

  const { data: count, refetch: refetchCount } = useQuery({
    queryKey: ["reg-count", id],
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

  const categories = (t?.categories ?? []) as unknown as string[];

  const roles = categories.length
    ? categories
    : ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper"];

  /* -------------------------------------------------------
     PHOTO UPLOAD
  ------------------------------------------------------- */

  async function handlePhotoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be smaller than 5MB.");
      return;
    }

    setPhotoUploading(true);

    try {
      const uploadedUrl = await uploadFile(file, "players");

      setPhoto(uploadedUrl);

      toast.success("Photo uploaded successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Photo upload failed",
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  /* -------------------------------------------------------
     SUBMIT REGISTRATION
  ------------------------------------------------------- */

  async function submit() {
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    const city = form.city.trim();

    if (!name) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!mobile) {
      toast.error("Please enter your mobile number.");
      return;
    }

    if (mobile.length < 10) {
      toast.error("Please enter a valid mobile number.");
      return;
    }

    if (!photo) {
      toast.error("Please upload your photo.");
      return;
    }

    if (!t) {
      toast.error("Tournament not found.");
      return;
    }

    setBusy(true);

    try {
      /* ---------------------------------------------------
         DUPLICATE CHECK
         Same mobile + same tournament = no duplicate player
      --------------------------------------------------- */

      const { data: existingPlayer, error: duplicateError } =
        await supabase
          .from("players")
          .select("id,name,status")
          .eq("tournament_id", id)
          .eq("mobile", mobile)
          .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (existingPlayer) {
        toast.error(
          `This mobile number is already registered as ${existingPlayer.name}.`,
        );
        setBusy(false);
        return;
      }

      /* ---------------------------------------------------
         GET CURRENT PLAYER COUNT
         Used only to show a player number after registration.
      --------------------------------------------------- */

      const { count: currentCount, error: countError } =
        await supabase
          .from("players")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("tournament_id", id);

      if (countError) {
        throw countError;
      }

      const nextNumber = (currentCount ?? 0) + 1;

      /* ---------------------------------------------------
         CREATE PLAYER

         IMPORTANT:
         status = "available"

         So player goes directly into auction pool.
         No owner approval required.
      --------------------------------------------------- */

      const { error: insertError } = await supabase
        .from("players")
        .insert({
          tournament_id: id,
          name,
          role: form.role,
          mobile,
          city,
          batting_style: form.batting_style.trim(),
          bowling_style: form.bowling_style.trim(),
          previous_team: form.previous_team.trim(),
          photo_url: photo,
          base_price: 0,

          // DIRECT AUCTION PLAYER
          status: "available",
        });

      if (insertError) {
        throw insertError;
      }

      setRegisteredName(name);
      setPlayerNumber(nextNumber);
      setDone(true);

      await refetchCount();

      toast.success("Player added to auction successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */

  if (tournamentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Loading tournament…
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     TOURNAMENT NOT FOUND
  ------------------------------------------------------- */

  if (!t) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <p className="text-2xl">🏏</p>
          <h1 className="mt-3 font-display text-2xl font-bold">
            Tournament not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This registration link may be invalid or the tournament may have
            been removed.
          </p>
        </Card>
      </div>
    );
  }

  /* -------------------------------------------------------
     SUCCESS SCREEN
  ------------------------------------------------------- */

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
                Registration successful
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
                Your player profile has been added directly to the auction
                player pool.
              </p>

              <div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-accent">
                  <ShieldCheck className="size-4" />
                  Player is ready for auction
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  The auctioneer can now see your player card when the auction
                  starts.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     REGISTRATION FORM
  ------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* HEADER */}

        <div className="mb-6 text-center">
          {t.banner_url && (
            <img
              src={t.banner_url}
              alt=""
              className="mb-5 h-40 w-full rounded-2xl object-cover"
            />
          )}

          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10">
            <UserRound className="size-7 text-primary" />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
            Player Registration
          </p>

          <h1 className="mt-2 font-display text-3xl font-black md:text-4xl">
            {t.name}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {t.venue ?? "Venue TBA"} ·{" "}
            {t.tournament_type === "turf"
              ? "Turf Tournament"
              : "Open Ground Tournament"}
          </p>

          <div className="mt-4 inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-xs font-bold text-accent">
            {count ?? 0} players registered
          </div>
        </div>

        {/* FORM */}

        <Card className="overflow-hidden">
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold">
              Create your player card
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Fill your details carefully. Your information will be used during
              the live auction.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            {/* NAME */}

            <div>
              <Label>Full name *</Label>

              <Input
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />
            </div>

            {/* MOBILE */}

            <div>
              <Label>Mobile number *</Label>

              <Input
                type="tel"
                inputMode="numeric"
                placeholder="10 digit mobile number"
                value={form.mobile}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
              />
            </div>

            {/* ROLE */}

            <div>
              <Label>Playing role *</Label>

              <Select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                  })
                }
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </Select>
            </div>

            {/* CITY */}

            <div>
              <Label>City</Label>

              <Input
                placeholder="Your city"
                value={form.city}
                onChange={(e) =>
                  setForm({
                    ...form,
                    city: e.target.value,
                  })
                }
              />
            </div>

            {/* BATTING */}

            <div>
              <Label>Batting style</Label>

              <Input
                placeholder="e.g. Right Hand"
                value={form.batting_style}
                onChange={(e) =>
                  setForm({
                    ...form,
                    batting_style: e.target.value,
                  })
                }
              />
            </div>

            {/* BOWLING */}

            <div>
              <Label>Bowling style</Label>

              <Input
                placeholder="e.g. Right Arm Fast"
                value={form.bowling_style}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bowling_style: e.target.value,
                  })
                }
              />
            </div>

            {/* PREVIOUS TEAM */}

            <div className="sm:col-span-2">
              <Label>Previous team</Label>

              <Input
                placeholder="Optional"
                value={form.previous_team}
                onChange={(e) =>
                  setForm({
                    ...form,
                    previous_team: e.target.value,
                  })
                }
              />
            </div>

            {/* PHOTO */}

            <div className="sm:col-span-2">
              <Label>Player photo *</Label>

              <label className="mt-1 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 p-5 text-center transition hover:border-accent hover:bg-accent/5">
                {photo ? (
                  <>
                    <img
                      src={photo}
                      alt="Player preview"
                      className="size-28 rounded-2xl object-cover ring-2 ring-accent/40"
                    />

                    <p className="mt-3 text-sm font-bold text-accent">
                      Photo uploaded ✓
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Click to change photo
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid size-14 place-items-center rounded-full bg-primary/10">
                      <Upload className="size-6 text-primary" />
                    </div>

                    <p className="mt-3 text-sm font-bold">
                      Upload player photo
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG or WEBP · Max 5MB
                    </p>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handlePhotoUpload(e)}
                />
              </label>

              {photoUploading && (
                <p className="mt-2 text-xs font-semibold text-accent">
                  Uploading photo…
                </p>
              )}
            </div>
          </div>

          {/* SUBMIT */}

          <Button
            className="mt-6 w-full py-3 text-sm font-black"
            disabled={busy || photoUploading}
            onClick={() => void submit()}
          >
            {busy
              ? "Creating player card…"
              : photoUploading
                ? "Uploading photo…"
                : "Register for Auction"}
          </Button>

          <div className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-accent" />
            Your player details are securely submitted to this tournament.
          </div>
        </Card>

        {/* INFO */}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard
            title="Photo"
            text="Your photo appears on the auction player card."
          />

          <InfoCard
            title="Player Card"
            text="Your card is created automatically after registration."
          />

          <InfoCard
            title="Live Auction"
            text="The auctioneer can select your card during bidding."
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   SMALL INFO CARD
------------------------------------------------------- */

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {text}
      </p>
    </div>
  );
}