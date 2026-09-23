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
        className="relative rounded-lg border border-border bg-surface p-2 text-muted-foreground hover:text-foreground"
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
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-xl">
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
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/20 text-foreground ring-1 ring-primary/50"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      {isSuperAdmin && (
        <Link
          to="/admin"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-accent hover:bg-surface-2"
        >
          <Shield className="size-4" /> Super Admin
        </Link>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
          <button
            className="rounded-lg border border-border p-2 lg:hidden"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg">
              🏏
            </span>
            <span className="font-display text-lg font-bold">
              Cricket Auction <span className="text-gradient">Pro</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Notifications />
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:block"
                >
                  {profile?.name || user.email}
                </Link>
                <button
                  onClick={() => void signOut()}
                  className="rounded-lg border border-border bg-surface p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Login / Signup
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20">{nav}</div>
        </aside>
        {menuOpen && (
          <div className="fixed inset-x-0 top-[61px] z-30 border-b border-border bg-background p-4 lg:hidden">
            {nav}
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
