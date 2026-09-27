import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Trophy,
  Radio,
  Settings2,
  UserPlus,
  User,
  Phone,
  Bell,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/live", label: "Live Auction", icon: Radio },
  { to: "/manage", label: "Manage Tournaments", icon: Settings2 },
  { to: "/add-player", label: "Add Player", icon: UserPlus },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/contact", label: "Contact Us", icon: Phone },
] as const;

function Notifications() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { id: string; title: string; message: string | null; read: boolean; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,message,read,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(data ?? []);
    };
    void load();
    const channel = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;
  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative">
      <button
        onClick={async () => {
          setOpen((o) => !o);
          if (!open && unread) {
            await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
          }
        }}
        className="relative grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:bg-surface-2 hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-2 shadow-2xl">
          {items.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {items.map((n) => (
            <div key={n.id} className="rounded-lg p-3 hover:bg-surface-2">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, isSuperAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMenuOpen(false)}
            className={`relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
            <Icon className="size-[18px]" strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
      {isSuperAdmin && (
        <Link
          to="/admin"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-accent hover:border-accent/30 hover:bg-accent/10"
        >
          <Shield className="size-4" /> Super Admin
        </Link>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground lg:hidden"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <Trophy className="size-5" strokeWidth={2.2} />
            </span>
            <span className="truncate font-display text-base font-extrabold sm:text-lg">
              Cricket Auction <span className="text-primary">Pro</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Notifications />
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hidden max-w-52 truncate rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground sm:block"
                >
                  {profile?.name || user.email}
                </Link>
                <button
                  onClick={() => void signOut()}
                  className="grid size-10 place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 hover:-translate-y-px hover:opacity-90"
              >
                Login / Signup
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-8 px-4 py-6 sm:px-6 lg:py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 rounded-xl border border-border bg-surface/55 p-3 shadow-xl shadow-background/30 backdrop-blur">{nav}</div>
        </aside>
        {menuOpen && (
          <div className="fixed inset-x-0 top-16 z-30 border-b border-border bg-background/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden">
            <div className="mx-auto max-w-lg">{nav}</div>
          </div>
        )}
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
