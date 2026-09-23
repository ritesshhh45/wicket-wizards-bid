export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function shortMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  const v = Number(n);
  if (v >= 10000000) return "₹" + (v / 10000000).toFixed(2) + " Cr";
  if (v >= 100000) return "₹" + (v / 100000).toFixed(2) + " L";
  if (v >= 1000) return "₹" + (v / 1000).toFixed(1) + "K";
  return "₹" + v;
}

export type IncrementRule = { upto: number | null; increment: number };

export function nextIncrement(rules: IncrementRule[], current: number): number {
  let inc = 10000;
  for (const r of rules ?? []) {
    inc = Number(r.increment) || inc;
    if (r.upto === null || r.upto === undefined || current < Number(r.upto)) return inc;
  }
  return inc;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
