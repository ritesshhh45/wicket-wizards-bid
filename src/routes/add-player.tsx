import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  LockKeyhole,
  Upload,
  UserPlus,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Label,
  SectionTitle,
  Select,
} from "@/components/ui-kit";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/add-player")({
  head: () => ({
    meta: [
      {
        title: "Add Players — Cricket Auction Pro",
      },
      {
        name: "description",
        content:
          "Add and manage cricket auction players for your tournament.",
      },
      {
        property: "og:title",
        content: "Add Players — Cricket Auction Pro",
      },
      {
        property: "og:description",
        content:
          "Add and manage auction players for your cricket tournament.",
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
  component: AddPlayerPage,
});

function AddPlayerPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [tournamentId, setTournamentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    name: "",
    role: "Batsman",
    grade: "A",
    base_price: 0,
    mobile: "",
    city: "",
  });

  /* =========================================================
     AUTH
  ========================================================== */

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  /* =========================================================
     MY TOURNAMENTS
  ========================================================== */

  const { data: tournaments } = useQuery({
    queryKey: ["my-tournaments", user?.id],
    enabled: !!user,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,name,categories,base_price_tiers")
        .eq("owner_id", user!.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        toast.error(error.message);
        return [];
      }

      return data ?? [];
    },
  });

  /* =========================================================
     AUTO SELECT FIRST TOURNAMENT
  ========================================================== */

  useEffect(() => {
    if (!tournamentId && tournaments?.[0]) {
      setTournamentId(tournaments[0].id);
    }
  }, [tournaments, tournamentId]);

  const active = tournaments?.find(
    (t) => t.id === tournamentId,
  );

  const categories = (active?.categories ?? []) as unknown as string[];

  /* =========================================================
     PLAYERS
  ========================================================== */

  const {
    data: players,
    refetch,
  } = useQuery({
    queryKey: ["players-of", tournamentId],
    enabled: !!tournamentId,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select(
          "id,name,role,grade,base_price,status,photo_url,sold_price,mobile,city",
        )
        .eq("tournament_id", tournamentId)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        toast.error(error.message);
        return [];
      }

      return data ?? [];
    },
  });

  /* =========================================================
     FILTER
  ========================================================== */

  const filtered = (players ?? []).filter((p) => {
    const matchesStatus =
      statusFilter === "all" ||
      p.status === statusFilter;

    const matchesSearch = p.name
      .toLowerCase()
      .includes(q.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  /* =========================================================
     ADD PLAYER
  ========================================================== */

  async function addPlayer() {
    const cleanName = form.name.trim();

    if (!tournamentId) {
      toast.error("Please select a tournament");
      return;
    }

    if (!cleanName) {
      toast.error("Enter player name");
      return;
    }

    if (form.base_price < 0) {
      toast.error("Base price cannot be negative");
      return;
    }

    /* -------------------------------------------------------
       DUPLICATE PLAYER CHECK
       ------------------------------------------------------- */

    const duplicate = (players ?? []).some(
      (p) =>
        p.name.trim().toLowerCase() ===
        cleanName.toLowerCase(),
    );

    if (duplicate) {
      toast.error(
        `"${cleanName}" is already added to this tournament.`,
      );
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("players")
      .insert({
        tournament_id: tournamentId,
        name: cleanName,
        role: form.role,
        grade: form.grade,
        base_price: form.base_price,
        mobile: form.mobile,
        city: form.city,
        photo_url: photo,
        status: "available" as const,
      });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${cleanName} added successfully`);

    setForm({
      name: "",
      role: categories[0] ?? "Batsman",
      grade: "A",
      base_price: 0,
      mobile: "",
      city: "",
    });

    setPhoto(null);

    await refetch();
  }

  /* =========================================================
     PHOTO UPLOAD
  ========================================================== */

  async function handlePhotoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      setBusy(true);

      const uploadedUrl = await uploadFile(
        file,
        "players",
      );

      setPhoto(uploadedUrl);

      toast.success("Player photo uploaded");
    } catch (err) {
      toast.error(
        (err as Error).message ||
          "Photo upload failed",
      );
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     UI
  ========================================================== */

  return (
    <AppShell>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

        <SectionTitle>
          Add Players
        </SectionTitle>

        {tournamentId && (
          <div className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-bold text-green-400">
            {players?.length ?? 0} Players
          </div>
        )}

      </div>

      {(tournaments ?? []).length === 0 ? (
        <Empty>
          You need a tournament first.{" "}

          <Link
            to="/tournaments/new"
            className="font-bold text-accent"
          >
            Create one
          </Link>
        </Empty>
      ) : (
        <div className="space-y-6">

          {/* =================================================
              ADD PLAYER FORM
          ================================================== */}

          <Card className="border-white/10 bg-[#080c1d]/95">

            <div className="mb-5 flex items-center gap-3">

              <div className="grid size-10 place-items-center rounded-xl bg-green-400/10 text-green-400">
                <UserPlus className="size-5" />
              </div>

              <div>
                <h2 className="font-bold text-white">
                  Add New Player
                </h2>

                <p className="text-xs text-muted-foreground">
                  Add players to your auction pool
                </p>
              </div>

            </div>

            <div className="grid gap-4 md:grid-cols-3">

              {/* Tournament */}

              <div className="md:col-span-3">
                <Label>Tournament</Label>

                <Select
                  value={tournamentId}
                  onChange={(e) =>
                    setTournamentId(e.target.value)
                  }
                >
                  {(tournaments ?? []).map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                    >
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Player Name */}

              <div>
                <Label>Player name</Label>

                <Input
                  placeholder="e.g. Rohit Patil"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              {/* Role */}

              <div>
                <Label>Role / category</Label>

                <Select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value,
                    })
                  }
                >
                  {(
                    categories.length
                      ? categories
                      : [
                          "Batsman",
                          "Bowler",
                          "All-Rounder",
                          "Wicketkeeper",
                        ]
                  ).map((c) => (
                    <option key={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Grade */}

              <div>
                <Label>Grade</Label>

                <Input
                  value={form.grade}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      grade: e.target.value,
                    })
                  }
                />
              </div>

              {/* Base Price */}

              <div>
                <Label>Base price</Label>

                <Input
                  type="number"
                  min="0"
                  value={form.base_price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      base_price:
                        Number(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Mobile */}

              <div>
                <Label>Mobile</Label>

                <Input
                  placeholder="Mobile number"
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mobile: e.target.value,
                    })
                  }
                />
              </div>

              {/* City */}

              <div>
                <Label>City</Label>

                <Input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      city: e.target.value,
                    })
                  }
                />
              </div>

              {/* Photo */}

              <div>
                <Label>Player Photo</Label>

                <div className="relative">

                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={busy}
                  />

                </div>

                {photo && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-green-400">
                    <CheckCircle2 className="size-4" />
                    Photo uploaded
                  </div>
                )}
              </div>

            </div>

            {/* Add Button */}

            <Button
              className="mt-5"
              disabled={busy}
              onClick={() => void addPlayer()}
            >
              {busy ? (
                "Adding..."
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" />
                  Add Player
                </>
              )}
            </Button>

          </Card>

          {/* =================================================
              PLAYER LIST
          ================================================== */}

          <Card className="border-white/10 bg-[#080c1d]/95">

            {/* Header */}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

              <div>
                <h2 className="font-bold text-white">
                  Auction Player List
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  Every player gets a unique auction number.
                </p>
              </div>

              <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs font-bold text-muted-foreground">
                Total: {players?.length ?? 0}
              </div>

            </div>

            {/* Search + Filter */}

            <div className="mb-5 flex flex-wrap gap-3">

              <Input
                placeholder="Search players..."
                value={q}
                onChange={(e) =>
                  setQ(e.target.value)
                }
                className="max-w-xs"
              />

              <Select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="max-w-[200px]"
              >
                <option value="all">
                  All statuses
                </option>

                <option value="available">
                  Available
                </option>

                <option value="sold">
                  Sold
                </option>

                <option value="unsold">
                  Unsold
                </option>

                <option value="pending_approval">
                  Pending approval
                </option>
              </Select>

            </div>

            {/* Empty */}

            {filtered.length === 0 && (
              <Empty>
                No players match your search.
              </Empty>
            )}

            {/* =================================================
                PLAYER CARDS
            ================================================== */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

              {filtered.map((p, index) => {

                const isSold =
                  p.status === "sold";

                const isUnsold =
                  p.status === "unsold";

                return (
                  <div
                    key={p.id}
                    className={`
                      group relative overflow-hidden rounded-2xl
                      border p-3 transition-all duration-200
                      ${
                        isSold
                          ? "border-red-500/30 bg-red-950/10 opacity-80"
                          : isUnsold
                            ? "border-orange-500/20 bg-orange-950/10"
                            : "border-white/10 bg-surface-2 hover:-translate-y-0.5 hover:border-green-400/30"
                      }
                    `}
                  >

                    {/* Auction Number */}

                    <div
                      className={`
                        absolute right-3 top-3 z-10
                        rounded-lg px-2 py-1
                        text-[10px] font-black
                        ${
                          isSold
                            ? "bg-red-500/15 text-red-400"
                            : "bg-black/30 text-white/60"
                        }
                      `}
                    >
                      #{String(index + 1).padStart(2, "0")}
                    </div>

                    {/* Player Content */}

                    <div className="flex items-center gap-3">

                      {/* Photo */}

                      <div
                        className={`
                          size-16 shrink-0 overflow-hidden rounded-xl
                          ${
                            isSold
                              ? "ring-1 ring-red-500/30"
                              : "bg-surface ring-1 ring-white/10"
                          }
                        `}
                      >

                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt={p.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="grid size-full place-items-center text-2xl">
                            🏏
                          </div>
                        )}

                      </div>

                      {/* Info */}

                      <div className="min-w-0 flex-1 pr-10">

                        <p
                          className={`
                            truncate text-sm font-extrabold
                            ${
                              isSold
                                ? "text-red-400"
                                : "text-white"
                            }
                          `}
                        >
                          {p.name}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.role}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Base:{" "}
                          {formatMoney(
                            p.base_price,
                          )}
                        </p>

                      </div>

                    </div>

                    {/* =================================================
                        STATUS FOOTER
                    ================================================== */}

                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">

                      {isSold ? (
                        <>
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-red-400">
                            <LockKeyhole className="size-3.5" />
                            SOLD
                          </div>

                          <span className="text-sm font-black text-red-400">
                            {formatMoney(
                              p.sold_price ?? 0,
                            )}
                          </span>
                        </>
                      ) : isUnsold ? (
                        <>
                          <div className="text-xs font-black uppercase tracking-wide text-orange-400">
                            UNSOLD
                          </div>

                          <Badge tone="danger">
                            Unsold
                          </Badge>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-green-400">
                            <CheckCircle2 className="size-3.5" />
                            AVAILABLE
                          </div>

                          <Badge tone="muted">
                            Ready
                          </Badge>
                        </>
                      )}

                    </div>

                    {/* Sold Lock Overlay */}

                    {isSold && (
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-red-500/10" />
                    )}

                  </div>
                );
              })}

            </div>

          </Card>

        </div>
      )}

    </AppShell>
  );
}