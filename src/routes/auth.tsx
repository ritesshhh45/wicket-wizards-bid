import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Card, Input, Label, Select } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cricket Auction Pro" },
      {
        name: "description",
        content: "Sign in or create your Cricket Auction Pro account.",
      },
      {
        property: "og:title",
        content: "Sign in — Cricket Auction Pro",
      },
      {
        property: "og:description",
        content: "Access your tournaments, teams and live auctions.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("tournament_owner");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      void navigate({ to: "/profile" });
    }
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (busy) return;

    setBusy(true);

    try {
      /*
       * ============================
       * LOGIN
       * ============================
       */
      if (mode === "login") {
        const cleanEmail = email.trim().toLowerCase();

        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          throw error;
        }

        toast.success("Welcome back!");

        await navigate({
          to: "/tournaments",
        });

        return;
      }

      /*
       * ============================
       * SIGN UP
       * ============================
       */
      if (mode === "signup") {
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const cleanPhone = phone.trim();

        if (!cleanName) {
          throw new Error("Please enter your full name.");
        }

        if (!cleanEmail) {
          throw new Error("Please enter your email.");
        }

        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        /*
         * Create Supabase account.
         *
         * No emailRedirectTo is used because we do not want
         * an email-verification redirect flow.
         */
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: cleanName,
              phone: cleanPhone,
              role,
            },
          },
        });

        if (error) {
          /*
           * Convert common Supabase errors into
           * user-friendly messages.
           */
          const message = error.message.toLowerCase();

          if (
            message.includes("already registered") ||
            message.includes("already exists") ||
            message.includes("user already registered")
          ) {
            throw new Error(
              "An account with this email already exists. Please login."
            );
          }

          throw error;
        }

        /*
         * If Supabase returns a session, the user is already
         * authenticated. This is the desired direct-login flow.
         */
        if (data.session) {
          toast.success("Account created successfully!");

          await navigate({
            to: "/tournaments",
          });

          return;
        }

        /*
         * No session came back from signUp. This usually means
         * "Confirm email" is ON in the Supabase project settings.
         *
         * As a fallback, try an immediate sign-in with the same
         * credentials — this only succeeds once email confirmation
         * is turned OFF in Supabase (Authentication → Providers →
         * Email → Confirm email). If it's still ON, Supabase will
         * reject this with "Email not confirmed" and we show a
         * clear message — no code change can bypass a server-side
         * confirmation requirement.
         */
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          throw new Error(
            "Account created, but automatic login is unavailable. " +
              "Turn OFF \"Confirm email\" in Supabase → Authentication → " +
              "Providers → Email, then try signing up again."
          );
        }

        toast.success("Account created successfully!");

        await navigate({
          to: "/tournaments",
        });

        return;
      }

      /*
       * ============================
       * FORGOT PASSWORD
       * ============================
       */
      if (mode === "forgot") {
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail) {
          throw new Error("Please enter your email.");
        }

        const { error } =
          await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${window.location.origin}/profile`,
          });

        if (error) {
          throw error;
        }

        toast.success("Password reset link sent to your email.");

        setMode("login");

        return;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";

      /*
       * Make Supabase errors more user friendly.
       */
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("invalid login credentials") ||
        lowerMessage.includes("invalid credentials")
      ) {
        toast.error("Invalid email or password.");
      } else if (lowerMessage.includes("email not confirmed")) {
        toast.error(
          "Email confirmation is enabled for this Supabase project."
        );
      } else if (lowerMessage.includes("user already registered")) {
        toast.error(
          "An account with this email already exists. Please login."
        );
      } else if (lowerMessage.includes("password")) {
        toast.error(message);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-display text-2xl font-bold">
            Cricket Auction{" "}
            <span className="text-gradient">Pro</span>
          </p>
        </div>

        <Card>
          {/* LOGIN / SIGNUP TABS */}
          <div className="mb-5 flex gap-2">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {m === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* SIGNUP ONLY FIELDS */}
            {mode === "signup" && (
              <>
                <div>
                  <Label>Full name</Label>

                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div>
                  <Label>Mobile</Label>

                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter mobile number"
                  />
                </div>

                <div>
                  <Label>I am a</Label>

                  <Select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="tournament_owner">
                      Tournament Owner
                    </option>

                    <option value="team_owner">
                      Team Owner / Captain
                    </option>

                    <option value="viewer">
                      Viewer
                    </option>
                  </Select>
                </div>
              </>
            )}

            {/* EMAIL */}
            <div>
              <Label>Email</Label>

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>

            {/* PASSWORD */}
            {mode !== "forgot" && (
              <div>
                <Label>Password</Label>

                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={
                    mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={6}
                />
              </div>
            )}

            {/* SUBMIT */}
            <Button
              type="submit"
              disabled={busy}
              className="w-full"
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Login"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          {/* FORGOT PASSWORD */}
          <button
            type="button"
            onClick={() =>
              setMode(mode === "forgot" ? "login" : "forgot")
            }
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "forgot"
              ? "Back to login"
              : "Forgot password?"}
          </button>
        </Card>
      </div>
    </div>
  );
}