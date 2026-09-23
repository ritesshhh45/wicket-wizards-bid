-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin','tournament_owner','team_owner','viewer');
CREATE TYPE public.tournament_status AS ENUM ('draft','pending_payment','active','auction_live','completed');
CREATE TYPE public.payment_status AS ENUM ('unpaid','pending','approved','rejected');
CREATE TYPE public.player_status AS ENUM ('pending_approval','available','in_auction','sold','unsold','re_auction');
CREATE TYPE public.session_status AS ENUM ('scheduled','live','paused','completed');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  BEGIN
    r := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'viewer');
  EXCEPTION WHEN OTHERS THEN r := 'viewer';
  END;
  IF r = 'super_admin' THEN r := 'viewer'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TOURNAMENTS
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  banner_url TEXT,
  venue TEXT,
  auction_date TIMESTAMPTZ,
  num_teams INT NOT NULL DEFAULT 8,
  total_budget_per_team BIGINT NOT NULL DEFAULT 10000000,
  categories JSONB NOT NULL DEFAULT '["Batsman","Bowler","All-Rounder","Wicketkeeper"]'::jsonb,
  min_max_squad JSONB NOT NULL DEFAULT '{"min":11,"max":15}'::jsonb,
  category_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_price_tiers JSONB NOT NULL DEFAULT '[{"grade":"A","price":200000},{"grade":"B","price":100000},{"grade":"C","price":50000}]'::jsonb,
  bid_increment_rules JSONB NOT NULL DEFAULT '[{"upto":500000,"increment":10000},{"upto":null,"increment":50000}]'::jsonb,
  proxy_bidding_enabled BOOLEAN NOT NULL DEFAULT false,
  status public.tournament_status NOT NULL DEFAULT 'pending_payment',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  config_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT ON public.tournaments TO anon;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments public read" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "owner insert tournament" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update tournament" ON public.tournaments FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "owner delete tournament" ON public.tournaments FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.owns_tournament(_t UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE id = _t AND owner_id = auth.uid())
      OR public.has_role(auth.uid(),'super_admin');
$$;

-- TEAMS
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  captain_name TEXT,
  owner_name TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_budget BIGINT NOT NULL DEFAULT 0,
  remaining_budget BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams owner manage" ON public.teams FOR ALL TO authenticated
  USING (public.owns_tournament(tournament_id)) WITH CHECK (public.owns_tournament(tournament_id));

-- PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'Batsman',
  grade TEXT,
  base_price BIGINT NOT NULL DEFAULT 0,
  mobile TEXT,
  batting_style TEXT,
  bowling_style TEXT,
  city TEXT,
  previous_team TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.player_status NOT NULL DEFAULT 'available',
  current_bid BIGINT,
  current_bid_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_to_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_price BIGINT,
  queue_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_tournament ON public.players(tournament_id);
CREATE INDEX idx_players_status ON public.players(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT ON public.players TO anon;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players public read" ON public.players FOR SELECT USING (true);
CREATE POLICY "public registration insert" ON public.players FOR INSERT TO anon
  WITH CHECK (status = 'pending_approval');
CREATE POLICY "players owner manage" ON public.players FOR ALL TO authenticated
  USING (public.owns_tournament(tournament_id)) WITH CHECK (public.owns_tournament(tournament_id));

-- AUCTION SESSIONS
CREATE TABLE public.auction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Auction',
  status public.session_status NOT NULL DEFAULT 'scheduled',
  current_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_tournament ON public.auction_sessions(tournament_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_sessions TO authenticated;
GRANT SELECT ON public.auction_sessions TO anon;
GRANT ALL ON public.auction_sessions TO service_role;
ALTER TABLE public.auction_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions public read" ON public.auction_sessions FOR SELECT USING (true);
CREATE POLICY "sessions owner manage" ON public.auction_sessions FOR ALL TO authenticated
  USING (public.owns_tournament(tournament_id)) WITH CHECK (public.owns_tournament(tournament_id));

-- BIDS
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  auction_session_id UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bids_player ON public.bids(player_id, created_at DESC);
CREATE INDEX idx_bids_tournament ON public.bids(tournament_id);
GRANT SELECT ON public.bids TO authenticated, anon;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids public read" ON public.bids FOR SELECT USING (true);

-- AUCTION EVENTS
CREATE TABLE public.auction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  auction_session_id UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount BIGINT,
  previous_amount BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_tournament ON public.auction_events(tournament_id, created_at DESC);
CREATE INDEX idx_events_player ON public.auction_events(player_id);
CREATE INDEX idx_events_type ON public.auction_events(event_type);
GRANT SELECT ON public.auction_events TO authenticated, anon;
GRANT ALL ON public.auction_events TO service_role;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.auction_events FOR SELECT USING (true);

-- TEAM TRANSACTIONS
CREATE TABLE public.team_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  auction_session_id UUID REFERENCES public.auction_sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_team ON public.team_transactions(team_id, created_at DESC);
GRANT SELECT ON public.team_transactions TO authenticated, anon;
GRANT ALL ON public.team_transactions TO service_role;
ALTER TABLE public.team_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx public read" ON public.team_transactions FOR SELECT USING (true);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL DEFAULT 2699,
  utr_number TEXT,
  screenshot_url TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments owner read" ON public.payments FOR SELECT TO authenticated
  USING (public.owns_tournament(tournament_id) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "payments owner insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.owns_tournament(tournament_id));
CREATE POLICY "payments admin update" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- REALTIME
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.auction_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;