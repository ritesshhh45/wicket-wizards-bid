-- increment slab resolution
CREATE OR REPLACE FUNCTION public.next_increment(_tournament UUID, _current BIGINT)
RETURNS BIGINT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rule JSONB; inc BIGINT := 10000;
BEGIN
  FOR rule IN SELECT * FROM jsonb_array_elements((SELECT bid_increment_rules FROM public.tournaments WHERE id = _tournament))
  LOOP
    inc := COALESCE((rule->>'increment')::BIGINT, inc);
    IF rule->>'upto' IS NULL OR _current < (rule->>'upto')::BIGINT THEN
      RETURN inc;
    END IF;
  END LOOP;
  RETURN inc;
END;
$$;

CREATE OR REPLACE FUNCTION public.min_base_price(_tournament UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MIN((t->>'price')::BIGINT), 0)
  FROM public.tournaments tr, jsonb_array_elements(tr.base_price_tiers) t
  WHERE tr.id = _tournament;
$$;

CREATE OR REPLACE FUNCTION public.log_event(_t UUID, _s UUID, _p UUID, _team UUID, _type TEXT, _amount BIGINT, _prev BIGINT, _meta JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.auction_events (tournament_id, auction_session_id, player_id, team_id, user_id, event_type, amount, previous_amount, metadata)
  VALUES (_t, _s, _p, _team, auth.uid(), _type, _amount, _prev, COALESCE(_meta,'{}'::jsonb));
$$;

-- ============ PLACE BID ============
CREATE OR REPLACE FUNCTION public.place_bid(p_player_id UUID, p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl public.players; tm public.teams; tr public.tournaments; ses public.auction_sessions;
  inc BIGINT; new_amount BIGINT; squad_count INT; cat_count INT;
  max_squad INT; min_squad INT; cat_max INT; cat_min INT; reserve BIGINT; mbp BIGINT;
  required_remaining INT;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF pl IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  SELECT * INTO tm FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF tm IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF tm.tournament_id <> pl.tournament_id THEN RAISE EXCEPTION 'Team not in this tournament'; END IF;
  SELECT * INTO tr FROM public.tournaments WHERE id = pl.tournament_id;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = tr.id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;

  IF ses IS NULL OR ses.status <> 'live' THEN RAISE EXCEPTION 'Auction is not live'; END IF;
  IF ses.current_player_id IS DISTINCT FROM p_player_id THEN RAISE EXCEPTION 'This player is not currently on the block'; END IF;
  IF pl.status <> 'in_auction' THEN RAISE EXCEPTION 'Player is not in auction'; END IF;

  -- authorization: tournament owner/auctioneer, super admin, or the team's own owner
  IF NOT (public.owns_tournament(tr.id) OR tm.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to bid for this team';
  END IF;

  IF pl.current_bid IS NULL THEN
    new_amount := pl.base_price;
  ELSE
    IF pl.current_bid_team_id = p_team_id THEN RAISE EXCEPTION 'Your team is already the highest bidder'; END IF;
    inc := public.next_increment(tr.id, pl.current_bid);
    new_amount := pl.current_bid + inc;
  END IF;

  IF new_amount > tm.remaining_budget THEN RAISE EXCEPTION 'Bid exceeds remaining budget'; END IF;

  SELECT COUNT(*) INTO squad_count FROM public.players WHERE sold_to_team_id = p_team_id;
  SELECT COUNT(*) INTO cat_count FROM public.players WHERE sold_to_team_id = p_team_id AND role = pl.role;
  max_squad := COALESCE((tr.min_max_squad->>'max')::INT, 15);
  min_squad := COALESCE((tr.min_max_squad->>'min')::INT, 0);
  IF squad_count >= max_squad THEN RAISE EXCEPTION 'Squad is full'; END IF;

  cat_max := NULLIF(tr.category_limits->pl.role->>'max','')::INT;
  cat_min := COALESCE(NULLIF(tr.category_limits->pl.role->>'min','')::INT, 0);
  IF cat_max IS NOT NULL AND cat_count >= cat_max THEN
    RAISE EXCEPTION 'Category limit reached for %', pl.role;
  END IF;

  -- smart minimum-squad budget reservation
  mbp := GREATEST(public.min_base_price(tr.id), 0);
  required_remaining := GREATEST(min_squad - (squad_count + 1), 0);
  reserve := required_remaining * mbp;
  IF (tm.remaining_budget - new_amount) < reserve THEN
    RAISE EXCEPTION 'Bid blocked - insufficient remaining budget to complete the minimum required squad';
  END IF;

  INSERT INTO public.bids (tournament_id, auction_session_id, player_id, team_id, user_id, amount)
  VALUES (tr.id, ses.id, pl.id, tm.id, auth.uid(), new_amount);

  UPDATE public.players SET current_bid = new_amount, current_bid_team_id = tm.id WHERE id = pl.id;
  PERFORM public.log_event(tr.id, ses.id, pl.id, tm.id, 'BID_PLACED', new_amount, pl.current_bid, jsonb_build_object('team_name', tm.name));

  RETURN jsonb_build_object('amount', new_amount, 'team_id', tm.id);
END;
$$;

-- ============ SOLD ============
CREATE OR REPLACE FUNCTION public.mark_player_sold(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.players; tm public.teams; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF pl IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF pl.status = 'sold' THEN RAISE EXCEPTION 'Player already sold'; END IF;
  IF pl.current_bid IS NULL OR pl.current_bid_team_id IS NULL THEN RAISE EXCEPTION 'No bids to sell against'; END IF;
  SELECT * INTO tm FROM public.teams WHERE id = pl.current_bid_team_id FOR UPDATE;
  IF tm.remaining_budget < pl.current_bid THEN RAISE EXCEPTION 'Team budget insufficient'; END IF;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = pl.tournament_id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;

  UPDATE public.teams SET remaining_budget = remaining_budget - pl.current_bid WHERE id = tm.id;
  UPDATE public.players SET status = 'sold', sold_to_team_id = tm.id, sold_price = pl.current_bid WHERE id = pl.id;
  INSERT INTO public.team_transactions (tournament_id, team_id, player_id, auction_session_id, type, amount, description)
  VALUES (pl.tournament_id, tm.id, pl.id, ses.id, 'PLAYER_PURCHASE', pl.current_bid, pl.name);
  PERFORM public.log_event(pl.tournament_id, ses.id, pl.id, tm.id, 'PLAYER_SOLD', pl.current_bid, NULL,
    jsonb_build_object('team_name', tm.name, 'player_name', pl.name));
  IF tm.owner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, tournament_id, type, title, message)
    VALUES (tm.owner_user_id, pl.tournament_id, 'PLAYER_WON', 'You won a player!', pl.name || ' sold to ' || tm.name);
  END IF;
  RETURN jsonb_build_object('player', pl.name, 'team', tm.name, 'amount', pl.current_bid);
END;
$$;

-- ============ UNSOLD ============
CREATE OR REPLACE FUNCTION public.mark_player_unsold(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.players; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF pl.status = 'sold' THEN RAISE EXCEPTION 'Player already sold'; END IF;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = pl.tournament_id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;
  UPDATE public.players SET status = 'unsold', current_bid = NULL, current_bid_team_id = NULL WHERE id = pl.id;
  UPDATE public.bids SET active = false WHERE player_id = pl.id;
  PERFORM public.log_event(pl.tournament_id, ses.id, pl.id, NULL, 'PLAYER_UNSOLD', NULL, pl.current_bid, jsonb_build_object('player_name', pl.name));
  RETURN jsonb_build_object('player', pl.name);
END;
$$;

-- ============ UNDO LAST BID ============
CREATE OR REPLACE FUNCTION public.undo_last_bid(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.players; last_bid public.bids; prev_bid public.bids; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO last_bid FROM public.bids WHERE player_id = pl.id AND active ORDER BY created_at DESC, id DESC LIMIT 1;
  IF last_bid IS NULL THEN RAISE EXCEPTION 'No bids to undo'; END IF;
  UPDATE public.bids SET active = false WHERE id = last_bid.id;
  SELECT * INTO prev_bid FROM public.bids WHERE player_id = pl.id AND active ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = pl.tournament_id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;
  UPDATE public.players SET current_bid = prev_bid.amount, current_bid_team_id = prev_bid.team_id WHERE id = pl.id;
  PERFORM public.log_event(pl.tournament_id, ses.id, pl.id, last_bid.team_id, 'BID_UNDONE', prev_bid.amount, last_bid.amount, '{}'::jsonb);
  RETURN jsonb_build_object('current_bid', prev_bid.amount);
END;
$$;

-- ============ REOPEN (undo sold / reopen) ============
CREATE OR REPLACE FUNCTION public.reopen_player(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.players; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = pl.tournament_id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;
  IF pl.status = 'sold' AND pl.sold_to_team_id IS NOT NULL THEN
    UPDATE public.teams SET remaining_budget = remaining_budget + COALESCE(pl.sold_price,0) WHERE id = pl.sold_to_team_id;
    INSERT INTO public.team_transactions (tournament_id, team_id, player_id, auction_session_id, type, amount, description)
    VALUES (pl.tournament_id, pl.sold_to_team_id, pl.id, ses.id, 'ROLLBACK', COALESCE(pl.sold_price,0), 'Rollback: ' || pl.name);
  END IF;
  UPDATE public.players SET status = 'available', sold_to_team_id = NULL, sold_price = NULL,
    current_bid = NULL, current_bid_team_id = NULL WHERE id = pl.id;
  UPDATE public.bids SET active = false WHERE player_id = pl.id;
  PERFORM public.log_event(pl.tournament_id, ses.id, pl.id, pl.sold_to_team_id, 'PLAYER_REOPENED', NULL, pl.sold_price, jsonb_build_object('player_name', pl.name));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reauction_player(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.players; ses public.auction_sessions;
BEGIN
  SELECT * INTO pl FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT public.owns_tournament(pl.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF pl.status = 'sold' THEN RAISE EXCEPTION 'Sold players must be reopened first'; END IF;
  SELECT * INTO ses FROM public.auction_sessions WHERE tournament_id = pl.tournament_id AND status IN ('live','paused') ORDER BY started_at DESC NULLS LAST LIMIT 1;
  UPDATE public.players SET status = 're_auction', current_bid = NULL, current_bid_team_id = NULL WHERE id = pl.id;
  PERFORM public.log_event(pl.tournament_id, ses.id, pl.id, NULL, 'PLAYER_REAUCTIONED', NULL, NULL, jsonb_build_object('player_name', pl.name));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============ SESSION CONTROL ============
CREATE OR REPLACE FUNCTION public.start_auction(p_session_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ses public.auction_sessions;
BEGIN
  SELECT * INTO ses FROM public.auction_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT public.owns_tournament(ses.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE tournament_id = ses.tournament_id AND status = 'live' AND id <> ses.id) THEN
    RAISE EXCEPTION 'Another session is already live';
  END IF;
  UPDATE public.auction_sessions SET status = 'live', started_at = COALESCE(started_at, now()), updated_at = now() WHERE id = ses.id;
  UPDATE public.tournaments SET status = 'auction_live', config_locked = true WHERE id = ses.tournament_id;
  PERFORM public.log_event(ses.tournament_id, ses.id, NULL, NULL, 'AUCTION_STARTED', NULL, NULL, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_auction(p_session_id UUID, p_resume BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ses public.auction_sessions;
BEGIN
  SELECT * INTO ses FROM public.auction_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT public.owns_tournament(ses.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_resume THEN
    UPDATE public.auction_sessions SET status = 'live', paused_at = NULL, updated_at = now() WHERE id = ses.id;
    PERFORM public.log_event(ses.tournament_id, ses.id, NULL, NULL, 'AUCTION_RESUMED', NULL, NULL, '{}'::jsonb);
  ELSE
    UPDATE public.auction_sessions SET status = 'paused', paused_at = now(), updated_at = now() WHERE id = ses.id;
    PERFORM public.log_event(ses.tournament_id, ses.id, NULL, NULL, 'AUCTION_PAUSED', NULL, NULL, '{}'::jsonb);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_auction(p_session_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ses public.auction_sessions;
BEGIN
  SELECT * INTO ses FROM public.auction_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT public.owns_tournament(ses.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.auction_sessions SET status = 'completed', ended_at = now(), current_player_id = NULL, updated_at = now() WHERE id = ses.id;
  UPDATE public.tournaments SET status = 'completed' WHERE id = ses.tournament_id;
  PERFORM public.log_event(ses.tournament_id, ses.id, NULL, NULL, 'AUCTION_COMPLETED', NULL, NULL, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============ LOAD NEXT PLAYER ============
CREATE OR REPLACE FUNCTION public.load_next_player(p_session_id UUID, p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ses public.auction_sessions; nxt public.players; cur public.players;
BEGIN
  SELECT * INTO ses FROM public.auction_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT public.owns_tournament(ses.tournament_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF ses.current_player_id IS NOT NULL THEN
    SELECT * INTO cur FROM public.players WHERE id = ses.current_player_id;
    IF cur.status = 'in_auction' THEN
      UPDATE public.players SET status = CASE WHEN cur.status = 're_auction' THEN 're_auction' ELSE 'available' END,
        current_bid = NULL, current_bid_team_id = NULL WHERE id = cur.id;
      UPDATE public.bids SET active = false WHERE player_id = cur.id;
    END IF;
  END IF;

  IF p_player_id IS NOT NULL THEN
    SELECT * INTO nxt FROM public.players WHERE id = p_player_id AND tournament_id = ses.tournament_id FOR UPDATE;
  ELSE
    SELECT * INTO nxt FROM public.players
      WHERE tournament_id = ses.tournament_id AND status IN ('available','re_auction')
      ORDER BY queue_order ASC, created_at ASC LIMIT 1 FOR UPDATE;
  END IF;

  IF nxt IS NULL THEN
    UPDATE public.auction_sessions SET current_player_id = NULL, updated_at = now() WHERE id = ses.id;
    RETURN jsonb_build_object('done', true);
  END IF;

  IF nxt.status NOT IN ('available','re_auction') THEN RAISE EXCEPTION 'Player is not available for auction'; END IF;

  UPDATE public.players SET status = 'in_auction', current_bid = NULL, current_bid_team_id = NULL WHERE id = nxt.id;
  UPDATE public.auction_sessions SET current_player_id = nxt.id, updated_at = now() WHERE id = ses.id;
  PERFORM public.log_event(ses.tournament_id, ses.id, nxt.id, NULL, 'NEXT_PLAYER', NULL, NULL, jsonb_build_object('player_name', nxt.name));
  RETURN jsonb_build_object('player_id', nxt.id, 'name', nxt.name);
END;
$$;

-- ============ PAYMENT APPROVAL (super admin) ============
CREATE OR REPLACE FUNCTION public.review_payment(p_payment_id UUID, p_approve BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay public.payments; tr public.tournaments;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  SELECT * INTO tr FROM public.tournaments WHERE id = pay.tournament_id;
  IF p_approve THEN
    UPDATE public.payments SET status = 'approved', approved_by = auth.uid() WHERE id = pay.id;
    UPDATE public.tournaments SET payment_status = 'approved', status = 'active' WHERE id = tr.id;
    INSERT INTO public.notifications (user_id, tournament_id, type, title, message)
    VALUES (tr.owner_id, tr.id, 'PAYMENT_APPROVED', 'Payment approved', tr.name || ' is now active.');
  ELSE
    UPDATE public.payments SET status = 'rejected', approved_by = auth.uid() WHERE id = pay.id;
    UPDATE public.tournaments SET payment_status = 'rejected' WHERE id = tr.id;
    INSERT INTO public.notifications (user_id, tournament_id, type, title, message)
    VALUES (tr.owner_id, tr.id, 'PAYMENT_REJECTED', 'Payment rejected', 'Please re-submit payment for ' || tr.name);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- team budget seeding trigger
CREATE OR REPLACE FUNCTION public.seed_team_budget()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.total_budget IS NULL OR NEW.total_budget = 0 THEN
    SELECT total_budget_per_team INTO NEW.total_budget FROM public.tournaments WHERE id = NEW.tournament_id;
  END IF;
  NEW.remaining_budget := NEW.total_budget;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_seed_team_budget BEFORE INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.seed_team_budget();

CREATE OR REPLACE FUNCTION public.log_initial_budget()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_transactions (tournament_id, team_id, type, amount, description)
  VALUES (NEW.tournament_id, NEW.id, 'INITIAL_BUDGET', NEW.total_budget, 'Initial budget');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_initial_budget AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.log_initial_budget();

GRANT EXECUTE ON FUNCTION public.place_bid(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_player_sold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_player_unsold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_bid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reauction_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_auction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_auction(UUID,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_auction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_next_player(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment(UUID,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_increment(UUID,BIGINT) TO authenticated, anon;