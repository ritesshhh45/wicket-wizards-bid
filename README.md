# Auction Master Pro

Build a complete Cricket Auction Management web application called "Cricket Auction Pro" 
from scratch. Use Supabase for database, authentication, and real-time updates. 
Dark theme UI (purple/green accents), fully mobile-responsive.

=== USER ROLES & AUTH ===
- Super Admin: manages all tournaments platform-wide, approves payments
- Tournament Owner: creates & fully configures their own tournament, manages players, 
  teams, and runs the live auction
- Team Owner / Captain: manages their team, places bids during live auction
- Viewer: read-only public access to watch live auction (no login required, shareable link)

Login/Signup with email & password (Supabase Auth), role selection at signup. 
Forgot Password with email reset. Session persists on refresh.

=== 1. HOME PAGE ===
- Landing page with logo/branding, hero section
- Navigation: Home, Tournaments, Live Auction, Manage Tournaments, Add Player, Profile
- Contact Us section with support phone number
- Login/Signup buttons if not logged in

=== 2. CREATE TOURNAMENT (fully configurable by Tournament Owner) ===
Tournament Owner decides EVERYTHING at creation time via a setup form:
- Tournament name, banner/logo upload, venue, auction date & time
- Number of teams (owner enters any number, e.g. 6, 8, 10, 12 — not fixed)
- Total points/budget per team (owner sets amount, e.g. 10,000,000)
- Player categories/roles (default: Batsman, Bowler, All-Rounder, Wicketkeeper — 
  owner can rename/add/remove categories)
- Min/Max player count per team overall (owner sets, e.g. min 11 max 15)
- Min/Max count per category per team (owner sets, e.g. min 2 max 5 bowlers)
- Base price tiers/grades for players (owner defines, e.g. Grade A ₹2,00,000, 
  Grade B ₹1,00,000, Grade C ₹50,000 — fully custom)
- Bid increment rules (owner defines slabs, e.g. "up to X: +10,000" / "above X: +50,000")
- All these settings are stored per-tournament so every tournament can have completely 
  different team count, points, and rules

=== 3. PAYMENT SECTION (Tournament Creation) ===
- After filling tournament setup form, show a Payment step before tournament goes live:
  - Display amount: ₹2699 (tournament hosting fee)
  - Payment instructions: UPI number 9422115394, support email ritesshhh19@gmail.com
  - QR code generated from the UPI ID for easy scan-to-pay
  - Owner uploads payment screenshot + enters UTR/Transaction ID
  - Tournament status = "Pending Payment Verification" until Super Admin approves
  - Super Admin dashboard tab "Pending Payments" — view screenshot + UTR, Approve/Reject
  - Once approved, tournament becomes "Active" and setup unlocks fully
  - Owner sees payment status (Paid/Pending) on their dashboard
  - Confirmation notification/email sent once approved

=== 4. MANAGE TOURNAMENT DASHBOARD (Tournament Owner) ===
- Add/Edit Teams: team name, logo, captain name, owner name (budget auto-filled from 
  tournament's configured total points, but overridable per team if needed)
- Add/Edit/Delete Players manually
- View list of all teams with their remaining budget & squad status
- Edit tournament settings (teams count, points, category rules) before auction starts
- Start/Schedule live auction

=== 5. PLAYER REGISTRATION LINK (auto-feeds into auction list) ===
- Each tournament gets a unique public registration link (app.com/register/[tournament_id]) 
  — no login needed for players
- Form: Player name, photo, mobile number, role/category, batting style, bowling style, 
  base price grade, previous team (optional), city/village
- Submissions land in a "Pending Registrations" tab for the owner
- Owner can Approve (player moves directly into Auction Player List as "Available") or Reject
- Shareable link via WhatsApp share button; shows live "X players registered" count

=== 6. BULK PLAYER IMPORT / EXPORT ===
- "Import Players" button on Manage Players page:
  - Supports Excel (.xlsx), CSV upload with column mapping (name, role, base price, mobile)
  - Supports PDF upload — attempt table extraction, else show manual mapping screen
  - Downloadable sample template (CSV/Excel)
  - Imported players land directly in Auction Player List as "Available"
- "Export Players" — download current list as Excel/CSV/PDF anytime
- "Export Final Squad" per team as PDF/Excel after auction ends (name, role, price paid)

=== 7. ADD/MANAGE PLAYER PAGE ===
- Form: name, photo, role (from tournament's configured categories), base price/grade, 
  mobile, batting style, bowling style, stats (optional)
- Status: Available / Sold / Unsold
- Search/filter by tournament, role, status

=== 8. LIVE AUCTION SCREEN (core feature) ===

TOP SECTION — Current Player Card:
- Player photo, name, role badge (Batsman/Bowler/All-Rounder/WK/custom category), 
  base price
- Status: "Bidding" (yellow) / "SOLD" (green) / "UNSOLD" (red)
- Current highest bid amount (large) + name of team currently leading

MIDDLE SECTION — Team Bidding Grid (dynamic grid, adjusts to however many teams 
the owner configured — 6, 8, 10, 12, etc.):
- Each team shown as a tile: logo, team name, captain name
- "Bid" button per tile — places bid at current_bid + configured increment
- Leading team's tile glows/highlights
- Button auto-disables if: remaining points can't cover next increment, OR team hit 
  max squad size, OR team hit max limit for that player's category
- Tournament Owner/Auctioneer view: can click any team's bid button (controlling room)
- Team Owner's own device view: sees and can click only their own team's bid button

BOTTOM SECTION — All Teams Live Summary Table (all teams visible together):
- Per team row: logo, name, captain name, total points allotted, points spent, 
  points remaining (live), players bought count (e.g. "7/15"), category-wise count 
  (e.g. Bat:3 Bowl:2 AR:1 WK:1)
- Expand row to see full purchased players list with price paid for each

SIDE PANEL — Auctioneer Controls:
- "Sold" button — assigns player to highest bidder, deducts points, updates squad, 
  auto-loads next player
- "Unsold" button
- "Re-auction" (send unsold players back to queue)
- "Next Player" / "Undo Last Bid"
- Progress counter: "Player 12 of 85"
- Pause/Resume auction

PUBLIC VIEWER MODE (no login, full-screen, streamable on YouTube Live):
- Clean version of Current Player Card + bid history (last 3-4 bids) + team summary table
- No control buttons visible

REAL-TIME: All updates (bids, sold/unsold, points, squad lists) sync instantly across 
every connected screen via Supabase Realtime — no page refresh anywhere.

=== 9. TEAM DASHBOARD (Team Owner/Captain view) ===
- Team profile: name, logo, captain name
- Total points vs remaining (live progress bar)
- Purchased players list grouped by role, with price paid
- Squad completion status vs tournament's configured min/max rules
- Category-wise count vs limits

=== 10. PROFILE SECTION (all roles) ===
- Name, email, phone, profile photo (editable), role badge
- Tournament Owners: list of their tournaments with status & payment status
- Team Owners: their team, tournament joined, quick link to remaining budget
- Change password, Logout

=== 11. DATA MODELS (Supabase) ===
- tournaments: id, name, banner_url, num_teams, total_budget_per_team, categories (jsonb), 
  min_max_squad (jsonb), category_limits (jsonb), base_price_tiers (jsonb), 
  bid_increment_rules (jsonb), status, payment_status, auction_date
- teams: id, tournament_id, name, logo_url, captain_name, owner_name, total_budget, 
  remaining_budget
- players: id, tournament_id, name, photo_url, role, base_price, stats (jsonb), 
  status (available/sold/unsold/pending_approval), sold_to_team_id, sold_price
- bids: id, player_id, team_id, amount, created_at
- profiles: id, name, email, phone, role, tournament_id, team_id
- payments: id, tournament_id, amount, utr_number, screenshot_url, status, approved_by

=== 12. VALIDATION RULES ===
- Team can't bid beyond remaining_budget
- Team can't bid if max squad size reached (per tournament's own config)
- Team can't bid on a role if that role's max limit reached (per tournament's own config)
- Bid must follow tournament's configured increment slabs
- Only Tournament Owner/Auctioneer can trigger Sold/Unsold
- Tournament setup (teams/points/categories) locked once auction starts, editable before

=== 13. UI/UX ===
- Dark theme, purple/green accents, large bold text for player name & bid (projector/
  stream friendly)
- Mobile responsive for team owners bidding from phones
- Smooth Sold/Unsold animations, toast notifications for bids
- Sidebar: Home, Tournaments, Live Auction, Manage Tournaments, Add Player, Profile, 
  Contact Us

Use Supabase Realtime channels throughout so every screen (auctioneer, team owners, 
public viewers) updates instantly without refresh.
🔥 ADVANCED AUCTION SYSTEM — ADD THIS TO THE EXISTING PROMPT

Do NOT replace or remove any existing functionality. Keep the entire existing Cricket Auction Pro specification intact and ADD all features below.

The LIVE AUCTION must be treated as the core transactional system of the application. All bidding, sold/unsold actions, budget changes, squad changes, rollback actions and auction state changes must be persistent, atomic, auditable and synchronized in real time through Supabase.

1. AUCTION SESSION SYSTEM

Create a dedicated auction session for every tournament.

auction_sessions

Fields:

id

tournament_id

name

status: scheduled / live / paused / completed

current_player_id

started_at

paused_at

ended_at

created_by

created_at

updated_at

A tournament may have multiple auction sessions:

Example:

Main Auction

Re-Auction

Replacement Player Auction

Second Auction

The owner can create and manage multiple sessions.

Only ONE session can be actively running for a tournament at a time.

2. COMPLETE AUCTION HISTORY

Every auction action must be permanently recorded.

Create:

auction_events

Fields:

id

tournament_id

auction_session_id

player_id

team_id

user_id

event_type

amount

previous_amount

metadata JSONB

created_at

Supported event types:

BID_PLACED

BID_UNDONE

PLAYER_SOLD

PLAYER_UNSOLD

PLAYER_REAUCTIONED

PLAYER_SKIPPED

PLAYER_REOPENED

NEXT_PLAYER

AUCTION_STARTED

AUCTION_PAUSED

AUCTION_RESUMED

AUCTION_COMPLETED

PLAYER_EDITED

TEAM_BUDGET_UPDATED

TEAM_CREATED

TEAM_UPDATED

TEAM_DELETED

ROLLBACK_EXECUTED

Every event must contain timestamp and relevant user/team/player information.

3. PLAYER BID HISTORY

Every player must have a complete bid timeline.

On the player details/history page show:

Player name
Photo
Role
Base price
Final status
Winning team
Final sold price

Then:

BID HISTORY

Show:

Bid number

Team logo

Team name

Captain

Bid amount

Bidder

Exact timestamp

Example:

Tigers — ₹50,000 — 7:42:10 PM

Warriors — ₹60,000 — 7:42:18 PM

Tigers — ₹70,000 — 7:42:24 PM

Warriors — ₹80,000 — 7:42:31 PM

Clearly highlight the final winning bid.

4. LIVE BID HISTORY PANEL

On the live auction screen add a real-time bid history panel.

Show the latest 4–6 bids.

Example:

LIVE BIDS

🟣 Warriors — ₹80,000
🟢 Tigers — ₹70,000
🟣 Warriors — ₹60,000
🟢 Tigers — ₹50,000

Newest bid should automatically appear at the top.

Use smooth animation when a new bid arrives.

5. AUCTION QUEUE

Add a complete Auction Queue panel for the Auctioneer.

Show:

Current player

Next players

Remaining players

Sold players

Unsold players

Re-auction queue

Controls:

Drag and drop reorder

Move player up

Move player down

Skip player

Move to later

Add player to queue

Remove from queue

Re-auction player

Display:

Player photo
Name
Role
Base price
Status

Example:

CURRENT
Rohit Patil

UP NEXT

Akash Jadhav

Sameer Khan

Rahul Pawar

Aditya More

6. PLAYER AUCTION STATE MACHINE

Use strict player states:

REGISTERED
↓
PENDING_APPROVAL
↓
AVAILABLE
↓
IN_AUCTION
↓
SOLD / UNSOLD
↓
RE-AUCTION
↓
SOLD / UNSOLD

Never allow invalid state transitions.

7. ROLLBACK / UNDO SYSTEM

Add a highly visible Auctioneer-only:

↩ ROLLBACK / UNDO

button.

Do NOT allow Team Owners or Viewers to rollback anything.

Rollback options:

Undo Last Bid

Removes the most recent bid and restores the previous current bid.

Undo SOLD

Reopens the player and restores the winning team's previous budget.

Reopen Player

Moves a sold/unsold player back into auction.

Re-auction Player

Moves player into the re-auction queue.

Restore Previous State

Restore the player/team state from the last valid auction state.

Every rollback must create an auction_events record.

Before destructive rollback show confirmation:

"Are you sure you want to rollback this action?"

Show:

Player

Team

Current amount

Previous amount

Action being reversed

Never silently rollback data.

8. ATOMIC BID TRANSACTION

Bidding must be server-side and transactional.

Do NOT rely only on frontend validation.

Create secure Supabase PostgreSQL RPC/functions such as:

place_bid()

mark_player_sold()

mark_player_unsold()

undo_last_bid()

reopen_player()

reauction_player()

load_next_player()

pause_auction()

resume_auction()

The database must validate:

Team budget

Current bid

Bid increment

Squad size

Category limits

Player auction status

Tournament auction status

Team authorization

Two simultaneous bids must not corrupt the auction state.

Use transactional locking / atomic updates where required.

9. SMART MINIMUM-SQUAD VALIDATION

Do not only check maximum squad size.

Also calculate whether a team has enough remaining budget to satisfy its remaining minimum squad/category requirements.

Example:

Team:

Budget remaining: ₹1,00,000
Players: 10/15

Minimum squad: 15

Required remaining players: 5

If the next bid would make it impossible to satisfy mandatory remaining players, prevent the bid.

Show warning:

"Bid blocked — insufficient remaining budget to complete the minimum required squad."

Also consider category minimum requirements.

Example:

Bowlers: 1/3

Minimum required: 3

Required remaining bowlers: 2

The system should preserve budget accordingly.

10. TEAM LIVE TRANSACTION HISTORY

Create:

team_transactions

Fields:

id

tournament_id

team_id

player_id

type

amount

description

auction_session_id

created_at

Transaction types:

INITIAL_BUDGET

PLAYER_PURCHASE

BID_HOLD

BUDGET_ADJUSTMENT

REFUND

ROLLBACK

MANUAL_ADJUSTMENT

Team dashboard should show:

Starting Budget
Total Spent
Remaining Budget
Players Purchased

Then transaction history.

Example:

₹10,00,000 Initial Budget

₹2,00,000 Player A

₹1,50,000 Player B

₹80,000 Player C

₹80,000 Rollback

11. ADVANCED TEAM SQUAD VALIDATION

On every team tile show:

Squad:
11 / 15

Category:

Batsman: 4 / 5
Bowler: 3 / 5
All-Rounder: 2 / 5
Wicketkeeper: 2 / 3

Budget:

₹1,60,000 remaining

Show visual warning states:

Valid

Minimum not completed

Maximum reached

Budget low

Category limit reached

Bid buttons must automatically disable when any tournament rule is violated.

12. PROXY / MAX BID — OPTIONAL TOURNAMENT SETTING

Add optional tournament setting:

"Enable Proxy Bidding"

If enabled, Team Owner can set:

Maximum Bid: ₹2,00,000

The system automatically participates in bidding according to configured bid increments until the maximum amount is reached.

Never exceed the team's configured maximum proxy bid or remaining budget.

Show proxy status privately to that team.

13. AUCTION PAUSE / RESUME

Auctioneer controls:

PAUSE AUCTION
RESUME AUCTION

When paused:

No bids allowed

Current player remains visible

Viewer sees "AUCTION PAUSED"

Team owners see disabled bid buttons

Current bid state is preserved

Record both actions in auction_events.

14. AUCTION REPLAY MODE

After auction completion, provide:

AUCTION REPLAY

Owner can select any player and replay their bidding timeline.

Example:

7:42:10 — Tigers ₹50,000
↓
7:42:18 — Warriors ₹60,000
↓
7:42:24 — Tigers ₹70,000
↓
7:42:31 — Warriors ₹80,000
↓
7:42:40 — SOLD TO WARRIORS

Add:

Play

Pause

Previous

Next

Timeline scrubber

This is read-only and cannot modify auction data.

15. COMPLETE AUCTION ACTIVITY LOG

Create an Auction Activity page.

Filters:

Date/time

Player

Team

User

Event type

Amount

Example:

21:42:31 — Warriors placed ₹80,000 bid
21:42:24 — Tigers placed ₹70,000 bid
21:43:02 — Auctioneer marked player SOLD
21:43:03 — ₹80,000 deducted from Warriors
21:43:04 — Next player loaded

Only authorized Tournament Owner/Super Admin can access full audit logs.

16. LIVE AUCTION SCREEN — ENHANCED LAYOUT

Keep the existing auction screen but enhance it.

TOP

Tournament name
Auction session
LIVE indicator
Elapsed auction time
Player progress

Example:

LIVE 🔴
Player 12 / 85

CENTER

Large player card:

Player photo
Player name
Role
Base price
Current bid
Leading team
Bid count

RIGHT / BELOW

LIVE BID HISTORY

TEAM GRID

Dynamic team grid based on configured team count.

Each tile:

Logo
Team name
Captain
Remaining budget
Squad count
Category status
Bid button

Leading team gets animated highlight.

BOTTOM

All-team summary table.

AUCTIONEER CONTROL BAR

Previous
Undo Bid
Rollback
Sold
Unsold
Re-auction
Skip
Next Player
Pause
Resume

17. SOLD ANIMATION

When Auctioneer clicks SOLD:

Show full-screen / center animation:

🎉 SOLD

Player Name

SOLD TO
Warriors

₹80,000

Then:

Deduct budget

Add player to squad

Update team counters

Update player status

Record event

Update transaction

Broadcast realtime event

Automatically prepare next player

All changes must happen atomically.

18. UNSOLD ANIMATION

When marked unsold:

🔴 UNSOLD

Player Name

Then:

Player status = unsold

Record auction event

Do not deduct team budget

Option to add to re-auction queue

19. FINAL TOURNAMENT HISTORY

After auction completion create:

TOURNAMENT HISTORY

Show:

Total teams

Total registered players

Total approved players

Total sold

Total unsold

Total auction value

Auction duration

Number of bids

Number of auction sessions

Player history remains permanently accessible.

20. FINAL TEAM REPORT

For every team generate:

Team logo
Team name
Captain
Owner

Starting Budget
Total Spent
Remaining Budget

Squad:

Player
Role
Base Price
Final Price

Category summary:

Batsman
Bowler
All-Rounder
Wicketkeeper
Custom categories

Export:

PDF
Excel
CSV

21. FINAL AUCTION REPORT

Create a downloadable complete tournament report containing:

Tournament information
Auction session information
Team summary
Complete squad list
Player sold prices
Unsold players
Bid history
Total spending
Remaining budgets
Category counts
Auction statistics
Auction timeline

Export as:

PDF
Excel
CSV

22. NOTIFICATION SYSTEM

Create:

notifications

Fields:

id

user_id

tournament_id

type

title

message

read

created_at

Notifications:

Payment approved

Payment rejected

Tournament activated

Auction scheduled

Auction starting soon

Team outbid

Team won player

Player registration approved

Player registration rejected

Auction paused

Auction resumed

Auction completed

Add notification bell with unread count.

23. PUBLIC SHARE PAGES

Generate unique shareable URLs:

/live/[tournament_id]

/register/[tournament_id]

/tournament/[tournament_id]/results

/tournament/[tournament_id]/history

Public pages require no login.

Viewer can watch:

Current player

Current bid

Latest bids

Team summary

Sold players

Auction progress

Final results

Never expose admin controls.

24. QR CODE SHARING

Generate QR codes for:

Live Auction

Player Registration

Tournament Results

Add:

"Share on WhatsApp"

"Copy Link"

"Download QR"

25. SUPER ADMIN AUCTION MONITORING

Super Admin can view:

Active auctions

Paused auctions

Completed auctions

Number of bids

Current player

Tournament owner

Teams participating

Super Admin should NOT accidentally modify auction data.

Use explicit permission checks for administrative actions.

26. SECURITY / SUPABASE RLS

Implement strict Row Level Security.

SUPER ADMIN

Full platform access.

TOURNAMENT OWNER

Can manage only tournaments they own.

Can manage:

Their teams

Their players

Their auction

Their settings before auction starts

Their history

Their reports

TEAM OWNER / CAPTAIN

Can:

View their team

View public auction

Place bids only for their assigned team

View their budget

View their squad

View permitted auction history

Cannot:

Modify other teams

Mark SOLD

Mark UNSOLD

Rollback

Modify tournament settings

VIEWER

Public read-only access only.

27. TOURNAMENT LOCK

Before auction:

Settings editable.

Once auction starts:

LOCK:

Number of teams

Team budget

Categories

Category limits

Squad limits

Base price tiers

Bid increments

Display:

🔒 Auction configuration locked

Only permitted emergency/admin workflows can modify configuration, and every modification must be logged.

28. REALTIME REQUIREMENTS

Use Supabase Realtime throughout.

Subscribe to:

auction_sessions

players

bids

teams

auction_events

team_transactions

notifications

When a bid happens:

ALL connected clients immediately update:

Current bid

Leading team

Bid history

Team budget availability

Bid button state

Team grid

Squad counters

Auction progress

No manual page refresh.

Use optimistic UI carefully, but the database/server transaction remains the source of truth.

29. CONCURRENCY PROTECTION

This is extremely important.

If two teams click BID at almost exactly the same time:

The backend must determine the valid order.

Never allow:

Duplicate bid amount

Incorrect current bid

Negative budget

Double deduction

Wrong winning team

Race-condition sold player

Two simultaneous SOLD operations

Use PostgreSQL transactions / row-level locking / secure RPC functions.

30. AUDIT EVERYTHING IMPORTANT

Every sensitive action must be logged.

Examples:

Login

Tournament creation

Tournament setting changes

Payment approval/rejection

Team creation

Player creation/edit/delete

Bid

Sold

Unsold

Re-auction

Rollback

Budget adjustment

Auction pause/resume

Auction completion

Audit records must not be editable from the frontend.

31. DASHBOARD QUICK STATS

Tournament Owner dashboard:

TOTAL PLAYERS
85

SOLD
62

UNSOLD
8

REMAINING
15

TOTAL AUCTION VALUE
₹72,40,000

TOTAL BIDS
418

ACTIVE SESSION
Main Auction

CURRENT PLAYER
Rohit Patil

32. SEARCH & FILTER HISTORY

Auction History must support:

Search player name
Search team
Filter role
Filter status
Filter date
Filter event
Filter price range

Sort:

Newest
Oldest
Highest bid
Lowest bid
Highest sold price

33. MOBILE AUCTION EXPERIENCE

Team Owner mobile view must prioritize:

Current player
Current bid
Their remaining budget
Their team
Large BID button
Latest bid
Squad count

Use sticky bottom bidding control:

[ Remaining ₹2,40,000 ]

[ BID ₹80,000 ]

Do not require scrolling to place a bid.

Add haptic-style visual feedback where supported.

34. AUCTION DISCONNECT RECOVERY

If a user's internet disconnects:

Automatically reconnect Supabase Realtime

Fetch latest authoritative auction state

Restore current player

Restore current bid

Restore team budget

Restore bid button state

Show:

"Reconnecting…"

Then:

"Live auction connected"

Never trust stale client state.

35. DATABASE DESIGN ADDITIONS

Add these tables in addition to the existing schema:

auction_sessions

id
tournament_id
name
status
current_player_id
started_at
paused_at
ended_at
created_by
created_at
updated_at

auction_events

id
tournament_id
auction_session_id
player_id
team_id
user_id
event_type
amount
previous_amount
metadata
created_at

team_transactions

id
tournament_id
team_id
player_id
auction_session_id
type
amount
description
created_at

notifications

id
user_id
tournament_id
type
title
message
read
created_at

Add appropriate indexes for:

tournament_id

player_id

team_id

auction_session_id

created_at

event_type

36. IMPORTANT DATA CONSISTENCY RULE

The following values must NEVER be manually trusted from frontend state:

Current bid

Winning team

Remaining budget

Sold price

Squad count

Player status

These must be calculated/validated server-side.

Frontend displays database state.

37. FINAL GOAL

The finished Cricket Auction Pro application must feel like a professional real-world cricket auction platform.

The LIVE AUCTION must be the highest priority feature.

It must support:

✓ Real-time bidding
✓ Multiple teams
✓ Dynamic team count
✓ Dynamic tournament rules
✓ Complete bid history
✓ Player history
✓ Team spending history
✓ Auction event history
✓ Rollback
✓ Undo
✓ Re-auction
✓ Auction queue
✓ Pause/Resume
✓ Auction replay
✓ Smart budget validation
✓ Category validation
✓ Minimum squad validation
✓ Concurrent bid protection
✓ Real-time synchronization
✓ Public viewer mode
✓ Final results
✓ Reports
✓ PDF/Excel/CSV export
✓ Notifications
✓ QR/share links
✓ Complete audit trail
✓ Supabase RLS
✓ Secure server-side auction transactions

DO NOT simplify these features into mock UI.

Build the actual database relationships, Supabase queries/RPC functions, RLS policies, realtime subscriptions, transactional auction logic and persistent history.

All existing Cricket Auction Pro features from the original specification must continue working together with these advanced auction features.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wicket-wizards-bid.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1b71318e-ab06-47b1-9c86-cc3d33bb564d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
