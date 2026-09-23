-- Captain access, fixed players and re-auction rounds (additive, backward compatible)

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_photo_url TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_claimed_at TIMESTAMPTZ;

UPDATE public.teams SET invite_token = encode(gen_random_bytes(12), 'hex') WHERE invite_token IS NULL;

ALTER TABLE public.teams ALTER COLUMN invite_token SET DEFAULT encode(gen_random_bytes(12), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_token_key ON public.teams (invite_token);

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS auction_round INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 1;

-- Claim a captain invite link: binds the signed-in user permanently to that one team.
CREATE OR REPLACE FUNCTION public.claim_team_invite(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tm public.teams;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO tm FROM public.teams WHERE invite_token = p_token FOR UPDATE;
  IF tm IS NULL THEN RAISE EXCEPTION 'Invalid or expired captain link'; END IF;
  IF tm.owner_user_id IS NOT NULL AND tm.owner_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This captain link is already used by another account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.teams o
    WHERE o.tournament_id = tm.tournament_id AND o.owner_user_id = auth.uid() AND o.id <> tm.id
  ) THEN
    RAISE EXCEPTION 'You are already the captain of another team in this tournament';
  END IF;
  UPDATE public.teams
     SET owner_user_id = auth.uid(),
         captain_claimed_at = COALESCE(captain_claimed_at, now())
   WHERE id = tm.id;
  RETURN jsonb_build_object('team_id', tm.id, 'tournament_id', tm.tournament_id);
END;
$$;

-- Owner can rotate a captain link (revokes the previous captain binding).
CREATE OR REPLACE FUNCTION public.regenerate_team_invite(p_team_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tm public.teams; tok TEXT;
BEGIN
  SELECT * INTO tm FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF tm IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF NOT public.owns_tournament(tm.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  tok := encode(gen_random_bytes(12), 'hex');
  UPDATE public.teams SET invite_token = tok, owner_user_id = NULL, captain_claimed_at = NULL WHERE id = tm.id;
  RETURN jsonb_build_object('invite_token', tok);
END;
$$;

-- Assign / unassign a pre-auction fixed player (counts in squad, never enters the queue).
CREATE OR REPLACE FUNCTION public.set_fixed_player(p_player_id UUID, p_team_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE pl public.players; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF pl IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO ses FROM public.auction_sessions
    WHERE tournament_id = pl.tournament_id AND status = 'live' LIMIT 1;
  IF ses IS NOT NULL THEN RAISE EXCEPTION 'Fixed players can only be changed before the auction is live'; END IF;

  IF p_team_id IS NULL THEN
    UPDATE public.players
       SET is_fixed = false, status = 'available', sold_to_team_id = NULL, sold_price = NULL
     WHERE id = pl.id;
    RETURN jsonb_build_object('ok', true, 'fixed', false);
  END IF;

  IF (SELECT COUNT(*) FROM public.players WHERE sold_to_team_id = p_team_id AND is_fixed AND id <> pl.id) >= 2 THEN
    RAISE EXCEPTION 'This team already has 2 fixed players';
  END IF;

  UPDATE public.players
     SET is_fixed = true, status = 'sold', sold_to_team_id = p_team_id, sold_price = 0,
         current_bid = NULL, current_bid_team_id = NULL
   WHERE id = pl.id;
  RETURN jsonb_build_object('ok', true, 'fixed', true);
END;
$$;

-- Start the next re-auction round: every unsold player from this pass returns to the queue.
CREATE OR REPLACE FUNCTION public.start_reauction_round(p_tournament_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n INT; r INT;
BEGIN
  IF NOT public.owns_tournament(p_tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COUNT(*) INTO n FROM public.players
    WHERE tournament_id = p_tournament_id AND status = 'unsold';
  IF n = 0 THEN RAISE EXCEPTION 'No unsold players to re-auction'; END IF;

  UPDATE public.tournaments
     SET current_round = current_round + 1
   WHERE id = p_tournament_id
  RETURNING current_round INTO r;

  UPDATE public.players
     SET status = 're_auction', auction_round = r, current_bid = NULL, current_bid_team_id = NULL
   WHERE tournament_id = p_tournament_id AND status = 'unsold';

  PERFORM public.log_event(p_tournament_id, NULL, NULL, NULL, 'REAUCTION_ROUND_STARTED', NULL, NULL,
    jsonb_build_object('round', r, 'players', n));
  RETURN jsonb_build_object('round', r, 'players', n);
END;
$$;