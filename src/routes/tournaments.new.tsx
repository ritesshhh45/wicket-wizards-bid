import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Input, Label, SectionTitle } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/tournaments/new")({
  head: () => ({
    meta: [
      { title: "Create Tournament — Cricket Auction Pro" },
      { name: "description", content: "Configure teams, budgets, categories, squad rules and bid slabs for your auction." },
      { property: "og:title", content: "Create Tournament — Cricket Auction Pro" },
      { property: "og:description", content: "Set up a fully custom cricket auction tournament." },
    ],
  }),
  component: NewTournament,
});

const UPI_ID = "9422115394@kotakbank";
const FEE = 2499;
const ADMIN_EMAIL = "ritesshhh19@gmail.com";
const UPI_STRING = `upi://pay?pa=${UPI_ID}&pn=CricketAuctionPro&am=${FEE}&cu=INR`;

type Tier = { grade: string; price: number };
type Slab = { upto: number | null; increment: number };
type CatLimit = { min: number; max: number };

function SettingToggle({
  enabled,
  onChange,
  title,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface-2 p-4 text-left transition hover:bg-surface"
      aria-pressed={enabled}
    >
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-accent" : "bg-muted"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function NewTournament() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [auctionDate, setAuctionDate] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [numTeams, setNumTeams] = useState(8);
  const [budget, setBudget] = useState(1000);
  const [minSquad, setMinSquad] = useState(8);
  const [maxSquad, setMaxSquad] = useState(10);
  const [proxy, setProxy] = useState(false);

  // Optional auction rules. Keep these switches OFF when the tournament
  // should use the app/database defaults instead of custom rules.
  const [categoriesEnabled, setCategoriesEnabled] = useState(true);
  const [basePriceEnabled, setBasePriceEnabled] = useState(true);
  const [bidSlabsEnabled, setBidSlabsEnabled] = useState(true);
  const [categories, setCategories] = useState<string[]>([
    "Batsman",
    "Bowler",
    "All-Rounder",
    "Wicketkeeper",
  ]);
  const [catLimits, setCatLimits] = useState<Record<string, CatLimit>>({
    Batsman: { min: 3, max: 6 },
    Bowler: { min: 3, max: 6 },
    "All-Rounder": { min: 1, max: 4 },
    Wicketkeeper: { min: 1, max: 2 },
  });
  const [tiers, setTiers] = useState<Tier[]>([
    { grade: "A", price: 50 },
  ]);
  const [slabs, setSlabs] = useState<Slab[]>([
    { upto: 100, increment: 10 },
    { upto: 200, increment: 20 },
    { upto: null, increment: 50 },
  ]);

  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    void QRCode.toDataURL(UPI_STRING, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQr);
  }, []);

  const isPlatformAdmin = (user?.email ?? "").toLowerCase() === ADMIN_EMAIL;

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("tournaments")
        .insert({
          owner_id: user.id,
          name,
          venue,
          banner_url: bannerUrl,
          tournament_type: "turf",
          auction_date: auctionDate ? new Date(auctionDate).toISOString() : null,
          num_teams: numTeams,
          total_budget_per_team: budget,
          categories: categoriesEnabled ? categories.filter((c) => c.trim()) : [],
          min_max_squad: { min: minSquad, max: maxSquad },
          category_limits: categoriesEnabled ? catLimits : {},
          base_price_tiers: basePriceEnabled
            ? tiers.filter((t) => t.grade.trim() && Number(t.price) >= 0)
            : [],
          bid_increment_rules: bidSlabsEnabled
            ? slabs.filter((s) => Number(s.increment) > 0)
            : [],
          proxy_bidding_enabled: proxy,
          status: isPlatformAdmin ? "active" : "pending_payment",
          payment_status: isPlatformAdmin ? "approved" : "unpaid",
        })
        .select("id")
        .single();
      if (error) throw error;
      setTournamentId(data.id);
      if (isPlatformAdmin) {
        toast.success("Tournament created and activated (admin — payment skipped).");
        void navigate({ to: "/manage/$id", params: { id: data.id } });
        return;
      }
      setStep(2);
      toast.success("Tournament saved. Complete payment to activate.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment() {
    if (!tournamentId) return;
    if (!utr) {
      toast.error("Enter the UTR / transaction ID");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("payments").insert({
        tournament_id: tournamentId,
        amount: FEE,
        utr_number: utr,
        screenshot_url: screenshot,
        status: "pending",
      });
      if (error) throw error;
      await supabase
        .from("tournaments")
        .update({ payment_status: "pending" })
        .eq("id", tournamentId);
      toast.success("Payment submitted. Awaiting admin verification.");
      void navigate({ to: "/manage/$id", params: { id: tournamentId } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <SectionTitle>{step === 1 ? "Create tournament" : "Payment"}</SectionTitle>

      {step === 1 && (
        <form onSubmit={createTournament} className="space-y-5">
          <Card>
            <h3 className="mb-4 font-bold">Basics</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Tournament name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Venue</Label>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
              <div>
                <Label>Auction date & time</Label>
                <Input type="datetime-local" value={auctionDate} onChange={(e) => setAuctionDate(e.target.value)} />
              </div>
              <div>
                <Label>Banner / logo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setBannerUrl(await uploadFile(f, "banners"));
                      toast.success("Banner uploaded");
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-1 font-bold">Auction format</h3>
            <p className="text-xs text-muted-foreground">
              Turf auction mode is used. Squad size, budget and optional rules below are fully editable for this tournament.
            </p>
          </Card>

          <Card>
            <h3 className="mb-4 font-bold">Teams & budget</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Number of teams</Label>
                <Input type="number" min={2} value={numTeams} onChange={(e) => setNumTeams(+e.target.value)} />
              </div>
              <div>
                <Label>Points / budget per team</Label>
                <Input type="number" min={1} step={1} value={budget} onChange={(e) => setBudget(Math.max(1, +e.target.value || 0))} />
              </div>
              <div>
                <Label>Minimum squad</Label>
                <Input type="number" min={0} value={minSquad} onChange={(e) => setMinSquad(+e.target.value)} />
              </div>
              <div>
                <Label>Maximum squad</Label>
                <Input type="number" min={1} value={maxSquad} onChange={(e) => setMaxSquad(+e.target.value)} />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={proxy} onChange={(e) => setProxy(e.target.checked)} />
              Enable proxy / max bidding for team owners
            </label>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <SettingToggle
              enabled={categoriesEnabled}
              onChange={setCategoriesEnabled}
              title="Player categories"
              description="Use category names and per-team min/max limits."
            />
            <SettingToggle
              enabled={basePriceEnabled}
              onChange={setBasePriceEnabled}
              title="Base price grades"
              description="Use grade-based base prices such as A = ₹50."
            />
            <SettingToggle
              enabled={bidSlabsEnabled}
              onChange={setBidSlabsEnabled}
              title="Bid increment slabs"
              description="Use custom ₹50→₹60→₹70… style bidding rules."
            />
          </div>

          {categoriesEnabled && (
          <Card>
            <h3 className="mb-4 font-bold">Player categories & per-team limits</h3>
            <div className="space-y-2">
              {categories.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_80px_40px] items-end gap-2">
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={c}
                      onChange={(e) => {
                        const old = categories[i]!;
                        const next = [...categories];
                        next[i] = e.target.value;
                        setCategories(next);
                        setCatLimits((l) => {
                          const copy = { ...l };
                          copy[e.target.value] = copy[old] ?? { min: 0, max: maxSquad };
                          if (old !== e.target.value) delete copy[old];
                          return copy;
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Min</Label>
                    <Input
                      type="number"
                      value={catLimits[c]?.min ?? 0}
                      onChange={(e) =>
                        setCatLimits({ ...catLimits, [c]: { min: +e.target.value, max: catLimits[c]?.max ?? maxSquad } })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max</Label>
                    <Input
                      type="number"
                      value={catLimits[c]?.max ?? maxSquad}
                      onChange={(e) =>
                        setCatLimits({ ...catLimits, [c]: { min: catLimits[c]?.min ?? 0, max: +e.target.value } })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCategories(categories.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" className="mt-3" onClick={() => setCategories([...categories, "New Category"])}>
              <Plus className="size-4" /> Add category
            </Button>
          </Card>
          )}

          {basePriceEnabled && (
          <Card>
            <h3 className="mb-1 font-bold">Base price grades</h3>
            <p className="mb-4 text-xs text-muted-foreground">Default grade A starts at ₹50. Edit or add grades as required.</p>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_40px] items-end gap-2">
                  <div>
                    <Label>Grade</Label>
                    <Input
                      value={t.grade}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[i] = { ...t, grade: e.target.value };
                        setTiers(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Base price</Label>
                    <Input
                      type="number"
                      value={t.price}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[i] = { ...t, price: +e.target.value };
                        setTiers(next);
                      }}
                    />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" className="mt-3" onClick={() => setTiers([...tiers, { grade: `Grade ${tiers.length + 1}`, price: 50 }])}>
              <Plus className="size-4" /> Add grade
            </Button>
          </Card>
          )}

          {bidSlabsEnabled && (
          <Card>
            <h3 className="mb-1 font-bold">Bid increment slabs</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Example default: ₹50–₹100 = +₹10, ₹100–₹200 = +₹20, above ₹200 = +₹50.
              Leave "up to" empty on the last slab to apply it above all other slabs.
            </p>
            <div className="space-y-2">
              {slabs.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_40px] items-end gap-2">
                  <div>
                    <Label>Up to amount</Label>
                    <Input
                      type="number"
                      value={s.upto ?? ""}
                      placeholder="No limit"
                      onChange={(e) => {
                        const next = [...slabs];
                        next[i] = { ...s, upto: e.target.value === "" ? null : +e.target.value };
                        setSlabs(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Increment</Label>
                    <Input
                      type="number"
                      value={s.increment}
                      onChange={(e) => {
                        const next = [...slabs];
                        next[i] = { ...s, increment: +e.target.value };
                        setSlabs(next);
                      }}
                    />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" className="mt-3" onClick={() => setSlabs([...slabs, { upto: null, increment: 50 }])}>
              <Plus className="size-4" /> Add slab
            </Button>
          </Card>
          )}

          <Button type="submit" disabled={busy} className="w-full md:w-auto">
            {busy ? "Saving…" : isPlatformAdmin ? "Create tournament" : "Continue to payment"}
          </Button>
          {isPlatformAdmin && (
            <p className="text-xs text-accent">
              Admin account detected — payment is skipped and the tournament activates immediately.
            </p>
          )}
        </form>
      )}

      {step === 2 && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="font-display text-2xl font-bold">{formatMoney(FEE)}</h3>
            <p className="text-sm text-muted-foreground">Tournament hosting fee</p>
            {qr && (
              <img
                src={qr}
                alt="UPI QR code"
                width={320}
                height={320}
                className="my-4 h-[320px] w-[320px] max-w-full rounded-xl bg-white p-3 [image-rendering:pixelated]"
              />
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>UPI ID:</span>
              <span className="font-bold text-accent">{UPI_ID}</span>
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(UPI_ID);
                  toast.success("UPI ID copied");
                }}
              >
                Copy UPI ID
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Scan with GPay / PhonePe / Paytm, or pay manually to the UPI ID above.
            </p>
            <p className="mt-2 text-sm">
              Support: <span className="font-bold text-accent">ritesshhh19@gmail.com</span>
            </p>
          </Card>
          <Card>
            <h3 className="mb-4 font-bold">Submit payment proof</h3>
            <div className="space-y-4">
              <div>
                <Label>UTR / Transaction ID</Label>
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
              </div>
              <div>
                <Label>Payment screenshot</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setScreenshot(await uploadFile(f, "payments"));
                      toast.success("Screenshot uploaded");
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </div>
              <Button onClick={() => void submitPayment()} disabled={busy} className="w-full">
                Submit for verification
              </Button>
              <p className="text-xs text-muted-foreground">
                Your tournament stays in "Pending Payment Verification" until a Super Admin approves it.
              </p>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
