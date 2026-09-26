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

  const [typeTab, setTypeTab] = useState<"turf" | "open_ground">("turf");

  const { data: live } = useQuery({
    queryKey: ["home-tournaments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select(
          "id,name,status,venue,banner_url,auction_date,tournament_type",
        )
        .in("status", ["auction_live", "active", "completed"])
        .order("created_at", { ascending: false })
        .limit(40);

      return data ?? [];
    },
  });

  const byType = (live ?? []).filter(
    (t) => (t.tournament_type ?? "open_ground") === typeTab,
  );

  return (
    <AppShell>
      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative min-h-[520px] overflow-hidden rounded-3xl border border-amber-100 bg-amber-50 shadow-sm md:min-h-[620px]">
        <img
          src="/home-banner.png"
          alt="Cricket Auction Pro"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Warm overlay so dark text stays readable over the photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-amber-50 via-amber-50/70 to-amber-50/10" />

        <div className="relative z-10 flex min-h-[520px] items-end px-5 pb-8 sm:px-8 md:min-h-[620px] md:px-12 md:pb-12">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <Radio className="size-3" />
              Live Auction
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Cricket Auction <span className="text-emerald-600">Pro</span>
            </h1>

            <p className="mt-3 text-base font-semibold text-slate-600 sm:text-lg">
              Bid. Build. <span className="text-emerald-600">Win.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tournaments/new"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600"
              >
                <Gavel className="mr-2 size-4" />
                Start Auction
              </Link>

              <Link
                to="/live"
                className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-stone-50 px-5 py-3 text-sm font-bold text-stone-700 transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50"
              >
                <Radio className="mr-2 size-4 text-red-600" />
                Watch Live
              </Link>

              <Link
                to="/join-auction"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100"
              >
                <UserRoundPlus className="mr-2 size-4" />
                Join Auction
              </Link>

              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-stone-50 px-5 py-3 text-sm font-bold text-stone-700 transition-all duration-200 hover:bg-stone-100"
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
            text: "Every bid and sale is validated and recorded.",
          },
          {
            icon: Users,
            title: "Any team count",
            text: "Budgets, squad size and category rules are yours to define.",
          },
          {
            icon: ShieldCheck,
            title: "Full audit trail",
            text: "Bid history and team ledgers, kept forever.",
          },
        ].map((f) => (
          <Card
            key={f.title}
            className="border-stone-200 bg-stone-50 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300"
          >
            <f.icon className="mb-3 size-6 text-emerald-600" />

            <h3 className="text-base font-bold text-stone-900">
              {f.title}
            </h3>

            <p className="mt-1 text-sm leading-6 text-stone-500">
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
          <h2 className="font-display text-2xl font-extrabold text-stone-900">
            Browse tournaments
          </h2>

          <div className="flex rounded-xl border border-stone-200 bg-stone-100 p-1">
            {[
              { k: "turf" as const, label: "🏟️ Turf" },
              { k: "open_ground" as const, label: "🌾 Open Ground" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setTypeTab(o.k)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  typeTab === o.k
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm leading-6 text-stone-500">
          {typeTab === "turf"
            ? "Turf format — squads of about 8 to 10 players."
            : "Open ground format — squads of about 15 to 16 players."}
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {byType.map((t) => (
            <Link key={t.id} to="/live/$id" params={{ id: t.id }}>
              <Card className="h-full overflow-hidden border-stone-200 bg-stone-50 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300">
                {t.banner_url && (
                  <img
                    src={t.banner_url}
                    alt=""
                    className="mb-4 h-28 w-full rounded-xl object-cover"
                  />
                )}

                <p className="font-bold text-stone-900">{t.name}</p>

                <p className="mt-1 text-xs text-stone-500">
                  {t.venue ?? "Venue TBA"}
                </p>

                {t.auction_date && (
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(t.auction_date).toLocaleString("en-IN")}
                  </p>
                )}

                <p
                  className={`mt-3 text-xs font-bold uppercase tracking-wide ${
                    t.status === "auction_live"
                      ? "text-red-600"
                      : "text-emerald-600"
                  }`}
                >
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
            <p className="text-sm text-stone-500">
              No {typeTab === "turf" ? "turf" : "open ground"} tournaments
              yet.
            </p>
          )}
        </div>
      </section>

      {/* =====================================================
          CONTACT
      ====================================================== */}

      <section id="contact" className="mt-10">
        <Card className="border-stone-200 bg-stone-50 shadow-sm">
          <h2 className="font-display text-2xl font-extrabold text-stone-900">
            Contact us
          </h2>

          <p className="mt-1 text-sm text-stone-500">
            Need help setting up your tournament? We're one call away.
          </p>

          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <a
              className="inline-flex items-center gap-2 font-semibold text-emerald-600 transition hover:text-emerald-700"
              href="tel:9422115394"
            >
              <Phone className="size-4" />
              9422115394
            </a>

            <a
              className="inline-flex items-center gap-2 font-semibold text-amber-600 transition hover:text-amber-700"
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