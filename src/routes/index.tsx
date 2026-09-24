import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Gavel,
  Users,
  Radio,
  ShieldCheck,
  UserRoundPlus,
  Phone,
  Mail,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Cricket Auction Pro — Live Cricket Player Auctions",
      },
      {
        name: "description",
        content:
          "Host fully configurable cricket player auctions with real-time bidding, team budgets, squad rules and public live viewing.",
      },
      {
        property: "og:title",
        content: "Cricket Auction Pro — Live Cricket Player Auctions",
      },
      {
        property: "og:description",
        content:
          "Real-time cricket auction platform for tournaments, teams and live viewers.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();

  const [typeTab, setTypeTab] =
    useState<"turf" | "open_ground">("turf");

  const { data: live } = useQuery({
    queryKey: ["home-tournaments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select(
          "id,name,status,venue,banner_url,auction_date,tournament_type"
        )
        .in("status", ["auction_live", "active", "completed"])
        .order("created_at", { ascending: false })
        .limit(40);

      return data ?? [];
    },
  });

  const byType = (live ?? []).filter(
    (t) => (t.tournament_type ?? "open_ground") === typeTab
  );

  return (
    <AppShell>

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative min-h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-[#050817] shadow-2xl md:min-h-[680px]">

        {/* Full Hero Image */}
        <img
          src="/home-banner.png"
          alt="Cricket Auction Pro"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Soft overlay - mainly bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050817]/90 via-[#050817]/25 to-transparent" />

        {/* Very subtle side glow */}
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />

        <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-green-400/10 blur-3xl" />

        {/* Hero Content */}
        <div className="relative z-10 flex min-h-[560px] items-end px-5 pb-8 sm:px-8 md:min-h-[680px] md:px-12 md:pb-12">

          <div className="max-w-2xl">

            {/* Small label */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-black/30 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-green-400 backdrop-blur-sm">
              <Radio className="size-3" />
              Live Auction
            </div>

            {/* Main Heading */}
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl">
              Cricket Auction{" "}
              <span className="bg-gradient-to-r from-green-400 via-green-300 to-purple-500 bg-clip-text text-transparent">
                Pro
              </span>
            </h1>

            {/* Short Caption */}
            <p className="mt-3 text-base font-semibold text-white/90 sm:text-lg">
              Bid. Build.{" "}
              <span className="text-green-400">Win.</span>
            </p>

            {/* Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">

              <Link
                to="/tournaments/new"
                className="inline-flex items-center justify-center rounded-xl bg-green-400 px-5 py-3 text-sm font-extrabold text-black shadow-lg shadow-green-400/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-300 hover:shadow-green-400/30"
              >
                <Gavel className="mr-2 size-4" />
                Start Auction
              </Link>

              <Link
                to="/live"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-black/30 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all duration-200 hover:border-purple-400 hover:bg-purple-500/20"
              >
                <Radio className="mr-2 size-4 text-purple-400" />
                Watch Live
              </Link>
\n              <Link
                to="/join-auction"
                className="inline-flex items-center justify-center rounded-xl border border-green-400/30 bg-black/30 px-5 py-3 text-sm font-bold text-green-300 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-green-400 hover:bg-green-400/10"
              >
                <UserRoundPlus className="mr-2 size-4" />
                Join Auction
              </Link>

              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/25 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10"
                >
                  Login / Signup
                </Link>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ====================================================== */}

      <div className="mt-6 grid gap-4 md:grid-cols-3">

        {[
          {
            icon: Gavel,
            title: "Atomic bidding",
            text: "Every bid, sale and rollback is validated and recorded in the database.",
          },
          {
            icon: Users,
            title: "Any team count",
            text: "6, 8, 10, 12 teams — budgets, squad and category rules are yours to define.",
          },
          {
            icon: ShieldCheck,
            title: "Full audit trail",
            text: "Bid history, team ledgers, activity log and auction replay forever.",
          },
        ].map((f) => (
          <Card
            key={f.title}
            className="border-white/10 bg-[#080c1d]/95 transition-all duration-200 hover:-translate-y-1 hover:border-green-400/30"
          >
            <f.icon className="mb-3 size-6 text-green-400" />

            <h3 className="text-base font-bold text-white">
              {f.title}
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              {f.text}
            </p>
          </Card>
        ))}

      </div>

      {/* =====================================================
          TOURNAMENTS
      ====================================================== */}

      <section className="mt-10">

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

          <h2 className="font-display text-2xl font-extrabold text-white">
            Browse tournaments
          </h2>

          <div className="flex rounded-xl border border-white/10 bg-[#080c1d] p-1">

            {[
              {
                k: "turf" as const,
                label: "🏟️ Turf",
              },
              {
                k: "open_ground" as const,
                label: "🌾 Open Ground",
              },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setTypeTab(o.k)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  typeTab === o.k
                    ? "bg-green-400 text-black shadow-md shadow-green-400/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}

          </div>
        </div>

        <p className="mb-4 text-sm leading-6 text-slate-400">
          {typeTab === "turf"
            ? "Turf format — squads of about 8 to 10 players."
            : "Open ground format — squads of about 15 to 16 players."}
        </p>

        <div className="grid gap-4 md:grid-cols-3">

          {byType.map((t) => (
            <Link
              key={t.id}
              to="/live/$id"
              params={{ id: t.id }}
            >
              <Card
                className="h-full overflow-hidden border-white/10 bg-[#080c1d]/95 transition-all duration-200 hover:-translate-y-1 hover:border-green-400/30"
              >

                {t.banner_url && (
                  <img
                    src={t.banner_url}
                    alt=""
                    className="mb-4 h-28 w-full rounded-xl object-cover"
                  />
                )}

                <p className="font-bold text-white">
                  {t.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {t.venue ?? "Venue TBA"}
                </p>

                {t.auction_date && (
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(t.auction_date).toLocaleString("en-IN")}
                  </p>
                )}

                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-green-400">
                  {t.status === "auction_live"
                    ? "● Live now"
                    : t.status === "completed"
                    ? "Completed"
                    : "Upcoming"}
                </p>

              </Card>
            </Link>
          ))}

          {byType.length === 0 && (
            <p className="text-sm text-slate-400">
              No{" "}
              {typeTab === "turf"
                ? "turf"
                : "open ground"}{" "}
              tournaments yet.
            </p>
          )}

        </div>
      </section>

      {/* =====================================================
          CONTACT
      ====================================================== */}

      <section id="contact" className="mt-10">

        <Card className="border-white/10 bg-[#080c1d]/95">

          <h2 className="font-display text-2xl font-extrabold text-white">
            Contact us
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Need help setting up your tournament? We're one call away.
          </p>

          <div className="mt-5 flex flex-wrap gap-5 text-sm">

            <a
              className="inline-flex items-center gap-2 font-semibold text-green-400 transition hover:text-green-300"
              href="tel:9422115394"
            >
              <Phone className="size-4" />
              9422115394
            </a>

            <a
              className="inline-flex items-center gap-2 font-semibold text-purple-400 transition hover:text-purple-300"
              href="mailto:ritesshhh19@gmail.com"
            >
              <Mail className="size-4" />
              ritesshhh19@gmail.com
            </a>

          </div>

        </Card>

      </section>

    </AppShell>
  );
}