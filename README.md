# Transport ERP — Phase 1 (+ delivery checkpoint)

A working implementation of Phase 1 ("Replace paper") from `Transport_ERP_System_Design.md`:
digital Lorry Receipt creation, a fleet/LR dashboard, and vehicle/client masters — built from
the Siddheshwer Transport mockups. Also includes a logged-in (not link-based) version of the
Phase 2 warehouse delivery confirmation.

## Stack

One **Next.js 16** (App Router) app — screens and API together. Needs Node 22.5+ (for `node:sqlite`).

- `src/app/` — Next.js routes: one `page.jsx` per screen, and `api/**/route.js` for the API.
- `src/views/` — the screen components; `src/components/` — layout, header, `Guard` (role gate).
- `src/server/` — `db.js` (Node's built-in `node:sqlite`), `auth.js` (JWT + role checks),
  `routes/*.js` (all API logic, including the LR status state machine).
- Tailwind CSS 3 for styling.

## Run it

```bash
npm install   # first time only
npm run dev   # http://localhost:3323
```

For production: `npm run build` then `npm start` (also on port 3323).

Open http://localhost:3323 and sign in with one of two roles (toggle on the login screen):

- **Office Staff:** Employee ID `EMP-4920` / password `dispatch123` — Dashboard, History (LR list), Settings, plus a "Reports" view (Live Arrivals board).
- **Receiver:** Employee ID `REC-2001` / password `receive123` — Incoming Deliveries, Delivery Log, Inspections (your own past verifications), and Reconciliation (Payment & Finance Tracking).

The SQLite database is created at `data/erp.sqlite3` on first run, seeded with demo
vehicles and clients (no LRs — create your own from the dashboard).

## What's implemented vs. the full spec

Phase 1 ("replace paper": LR creation/listing/status tracking, a fleet status dashboard, and
vehicle/client masters) plus the Phase 2 delivery checkpoint, with the LR operator deliberately excluded from
confirming their own deliveries and payments:

- **Dispatch (→ In Transit):** there is no gate-out step. An LR created with a vehicle goes
  straight to **In Transit** (and the vehicle is marked In Transit); one created without a
  vehicle stays **Draft** until **Office** marks it In Transit from the LR detail page.
  (A Security role/gate check existed earlier and was removed; old `security` accounts can no
  longer log in.)
- **In Transit → Delivered/Disputed** (proof of delivery): only **Receiver** can do this, from
  `/delivery` — either a quick "Mark Delivered"/"Report Issue" action, or "Inspect" first to
  record received quantity and condition per goods line item (visible afterward on the
  dispatcher's LR detail page).
- **Delivered → Paid** (payment receipt): also **Receiver**-only, from `/reconciliation`'s "Pay"
  button — continuing the same "operator excluded from self-approving" pattern. Office can see a
  read-only "Payments Received" summary on its own Dashboard but can't mark anything Paid itself.

The full state machine (`Draft → In Transit → Delivered → Paid`, with `Disputed`/`Cancelled`
branches) is enforced authoritatively in `src/server/routes/lrs.js`'s `TRANSITIONS` table — any
transition not explicitly listed there is rejected with 400 regardless of role, and each listed
transition names exactly which role(s) may perform it (403 otherwise). The frontend's per-role
buttons are just a convenience on top of that; the API is the real gate.

The rest of Phase 2+ from the spec — the driver mobile app, GPS tracking, the *external*
link/QR-based version of POD confirmation (no login, for staff who aren't system
users) — is out of scope for this build.

## Office-side navigation

The Office Staff role has **two zones** within the same account, sharing top tabs (Direct
Dispatch / Reports / History) and header search, but each with its own sidebar:

**Core zone** (`/`, `/payments`, `/lrs`, `/lrs/new`, `/lrs/:id`, sidebar: Dashboard / Payments /
History / Settings) — the day-to-day LR-maker's workspace. This is intentionally the *only*
thing Office does: create the LR, see LR history, and see whether payments have come in
(read-only) — nothing else.
- **Dashboard** (`/`) — the original "Good morning" view: active trips/disputed/total-today
  counters, a compact "Payments Received" summary (received vs. pending-past-21-days, read-only)
  with a link into the full Payments page, a recent-LRs table, and the "Create New Lorry
  Receipt" CTA.
- **Payments** (`/payments`) — all delivered transportation (Delivered + Paid LRs, i.e.
  everything actually billable; still-in-transit LRs are excluded), sorted by urgency (soonest
  due / most overdue first), with an All/Pending/Paid filter. The "Days Remaining to Pay" column
  reads **"Paid"** in green once settled, **"Pending"** in red once past due, or **"N days
  remaining"** otherwise. Read-only — same as the Dashboard summary, Office can see this but
  Receiver is the one who actually marks something Paid.
- **History** (`/lrs`) — the full LR list with status/date/search filters.

**Reports zone** (`/reports`, sidebar: Dashboard / Settings) — reached via the "Reports" top
tab: the "Live Arrivals" board (4 metric cards, status pills, a filterable arrivals table).
"Delayed" and the ETA/On-Time/Late labels are a heuristic from `lr_date` vs. today, since no
ETA/expected-transit-time field is modeled.

## Receiver-side navigation

The Receiver role (consignee/warehouse) owns the back half of the LR lifecycle — confirming
delivery *and* confirming payment — exclusively. Sidebar: Incoming Deliveries / Delivery Log /
Inspections / Reconciliation.
- **Incoming Deliveries** (`/delivery`) — In-Transit LRs awaiting confirmation: a quick "Mark
  Delivered"/"Report Issue" action, or "Inspect" first to record received quantity and condition
  per goods line item.
- **Delivery Log** (`/delivery/log`) — history of confirmed/disputed deliveries.
- **Inspections** (`/inspections`) — your own past delivery-verification records (read-only,
  separate from the live action screen above).
- **Reconciliation** ("Payment & Finance Tracking", `/reconciliation`) — receivables/overdue
  computed live from existing LR `amount` + the matched client's `payment_terms_days` (no new
  schema). **"Pay" is real** — it calls `Delivered → Paid` in `TRANSITIONS`, restricted to
  Receiver same as the delivery checkpoints. **"Hold" is visual-only** — a local toggle that
  isn't persisted, by explicit choice.

These (Inspections, Reconciliation) used to live on the Office side; they were moved to be
Receiver-exclusive on request, so Office never sees or approves its own deliveries/payments.
