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

      <section className="relative min-h-[500px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-background/50 md:min-h-[590px]">
        <img
          src="/home-banner.png"
          alt="Cricket Auction Pro"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-transparent to-transparent" />

        <div className="relative z-10 flex min-h-[500px] items-end px-5 pb-8 sm:px-8 md:min-h-[590px] md:px-12 md:pb-12">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary backdrop-blur">
              <Radio className="size-3" />
              Live Auction
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-foreground sm:text-5xl md:text-6xl">
              Cricket Auction <span className="text-primary">Pro</span>
            </h1>

            <p className="mt-3 text-base font-semibold text-muted-foreground sm:text-lg">
              Bid. Build. <span className="text-primary">Win.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tournaments/new"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition-all duration-200 hover:-translate-y-px hover:opacity-90"
              >
                <Gavel className="mr-2 size-4" />
                Start Auction
              </Link>

              <Link
                to="/live"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface/80 px-5 py-3 text-sm font-bold text-foreground backdrop-blur transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:bg-surface-2"
              >
                <Radio className="mr-2 size-4 text-destructive" />
                Watch Live
              </Link>

              <Link
                to="/join-auction"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 px-5 py-3 text-sm font-bold text-primary transition-all duration-200 hover:-translate-y-px hover:bg-primary/15"
              >
                <UserRoundPlus className="mr-2 size-4" />
                Join Auction
              </Link>

              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface/80 px-5 py-3 text-sm font-bold text-foreground backdrop-blur transition-all duration-200 hover:border-primary/40 hover:bg-surface-2"
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

      <div className="mt-6 grid gap-5 md:grid-cols-3">
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
            className="group border-border bg-surface shadow-lg shadow-background/20 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl"
          >
            <span className="mb-4 grid size-10 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><f.icon className="size-5" /></span>

            <h3 className="text-base font-bold text-foreground">
              {f.title}
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {f.text}
            </p>
          </Card>
        ))}
      </div>

      {/* =====================================================
          TOURNAMENTS
      ====================================================== */}

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Browse tournaments
          </h2>

          <div className="flex rounded-lg border border-border bg-surface p-1">
            {[
              { k: "turf" as const, label: "🏟️ Turf" },
              { k: "open_ground" as const, label: "🌾 Open Ground" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setTypeTab(o.k)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  typeTab === o.k
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-5 text-sm leading-6 text-muted-foreground">
          {typeTab === "turf"
            ? "Turf format — squads of about 8 to 10 players."
            : "Open ground format — squads of about 15 to 16 players."}
        </p>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {byType.map((t) => (
            <Link key={t.id} to="/live/$id" params={{ id: t.id }}>
              <Card className="h-full overflow-hidden border-border bg-surface shadow-lg shadow-background/20 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl">
                {t.banner_url && (
                  <img
                    src={t.banner_url}
                    alt=""
                    className="mb-4 h-36 w-full rounded-lg object-cover"
                  />
                )}

                <p className="font-bold text-foreground">{t.name}</p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t.venue ?? "Venue TBA"}
                </p>

                {t.auction_date && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(t.auction_date).toLocaleString("en-IN")}
                  </p>
                )}

                <p
                  className={`mt-3 text-xs font-bold uppercase tracking-wide ${
                    t.status === "auction_live"
                      ? "text-destructive"
                      : "text-primary"
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
            <p className="text-sm text-muted-foreground">
              No {typeTab === "turf" ? "turf" : "open ground"} tournaments
              yet.
            </p>
          )}
        </div>
      </section>

      {/* =====================================================
          CONTACT
      ====================================================== */}

      <section id="contact" className="mt-12">
        <Card className="border-border bg-surface shadow-lg shadow-background/20">
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Contact us
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Need help setting up your tournament? We're one call away.
          </p>

          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <a
              className="inline-flex items-center gap-2 font-semibold text-primary transition hover:opacity-80"
              href="tel:9422115394"
            >
              <Phone className="size-4" />
              9422115394
            </a>

            <a
              className="inline-flex items-center gap-2 font-semibold text-accent transition hover:opacity-80"
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