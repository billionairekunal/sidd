# Siddheshwer Transport ERP — project brief (read first)

Lorry Receipt (LR) system for Siddheshwer Transport (Kuruli, Khed, Pune). Replaces the paper
carbon-copy LR: create LRs, print freight invoices, track dispatch → delivery → payment.

## Stack
- **Next.js 16** App Router, plain JavaScript (JSX), Tailwind CSS 3, `lucide-react` icons, Manrope font.
- **Supabase Postgres** via the `postgres` npm client (no Supabase JS SDK, no ORM).
- JWT auth (`jsonwebtoken`, bcrypt-hashed passwords), token kept in `localStorage`.
- Photo scan: Google **Gemini** REST API (free tier). Deploy: **Vercel**.
- Repo: `github.com/billionairekunal/sidd`, branch `main`. Locally the branch is `nextjs`
  and the remote is `sidd`: push with `git push sidd nextjs:main`.

## Run
```
npm install
npm run dev        # http://localhost:3323 (needs .env.local — see .env.example)
npm run build
```
Windows PC with little free RAM: `next build` can die with "out of memory"/"spawn UNKNOWN" —
a machine issue, not code. After deleting/renaming source files, if Tailwind errors with
ENOENT on the old file: stop the dev server, delete `.next/`, restart.

## Layout
- `src/app/**/page.jsx` — one thin page per screen, wraps a view in `<Guard roles={[...]}>`.
- `src/app/api/**/route.js` — one-liners exporting handlers from `src/server/routes/*.js`.
- `src/views/*.jsx` — screen components. `src/components/` — Layout (sidebar, phone drawer,
  bottom tabs), OfficeHeader (top tabs), Guard, StatusBadge, Select (custom dropdown that floats
  so tables can't clip it), ClientCombobox (consignor search), ScanLR (photo scan box).
- `src/server/db.js` — DB layer. Keeps a SQLite-like API: `await db.prepare(sql).get/all/run(...)`
  with `?` placeholders; `withTransaction(async () => ...)` (AsyncLocalStorage). Client is created
  lazily via `getSql()` so builds work without DATABASE_URL. Schema is `CREATE ... IF NOT EXISTS`
  in `SCHEMA` and runs on first query.
- `src/server/auth.js` — `route([options,] handler)` wrapper: JWT check, `roles`, JSON body,
  catches errors → JSON 500. Handlers use an Express-like `res.status().json()`.
- `scripts/sqlite-to-supabase.mjs` — one-time copy from the old local SQLite file.

## Roles (server enforces everything; UI hiding is convenience)
| Role | Login | Can do |
|---|---|---|
| `owner` / `dispatcher` (Office) | `EMP-4920` / `dispatch123` | everything office: dashboard, LRs, payments (read-only), vehicles & clients, mark Draft → In Transit, cancel |
| `creator` (LR Creator) | `CRT-3001` / `create123` | only New LR, LR History, LR view + invoice. No status changes, no edits, no money totals, **no Freight Terms** (always "To Pay") |
| `receiver` | `REC-2001` / `receive123` | incoming deliveries, inspect items, Delivered/Disputed, mark Paid, reconciliation |
| `security` | — | **removed** (gate-out step deleted); old accounts are refused at login |

LR status machine lives in `TRANSITIONS` in `src/server/routes/lrs.js`. An LR created **with a
vehicle** starts **In Transit**; without one it is **Draft** until Office marks it In Transit.

## Database notes
- `DATABASE_URL` must be the Supabase **session pooler, port 5432**. The transaction pooler (6543)
  stalled concurrent queries — don't switch back.
- All tables have **Row Level Security ON with no policies** so Supabase's public REST API can't
  read them; the server connects as the owner. Keep RLS on for any new table.
- Timestamps are TEXT `'YYYY-MM-DD HH:MM:SS'` UTC (`NOW` helper); "today" counts use India time
  (`TODAY_IST`, `istDate()`). Dates like `lr_date` and vehicle paper expiries are `YYYY-MM-DD` text.
- Search uses `ILIKE`. COUNT/bigint are parsed to numbers.
- **Real business data lives only in Supabase** — 21 fleet vehicles (with owner, fuel, paper
  expiries, engine/chassis no.) and 8 consignor companies with GSTINs. Never put fleet/client data
  in code or seed lists (the repo is on GitHub). Only demo *user accounts* are seeded.

## Features to know
- **Invoice**: `/lrs/[id]/invoice`, formal A4 design (`src/views/LRInvoice.jsx`), opens after
  creating an LR; scales to fit phones, prints at A4.
- **Scan LR photo** (New LR): browser shrinks the photo → `POST /api/lrs/scan` → Gemini with a JSON
  schema → form fills, filled fields highlighted "From photo · check". Tries several free models
  (`gemini-flash-lite-latest` first). Photos are not stored. Free tier: Google may use photos.
- **Vehicles & Clients** (`/settings`): Papers badge (expired / due in 30 days / valid).
- Mobile: phone top bar + drawer + bottom tabs; Gate/Delivery/History/goods lines become cards.

## Conventions
- Small, focused changes; keep the existing patterns above. Test API changes with curl/node
  against `localhost:3323`, and clean up any test rows you create in Supabase.
- Never commit secrets: `.env.local` and `data/` are git-ignored. Check diffs for keys before pushing.
- Commit messages: short summary line + bullet body.

## Open items / ideas (not done)
- **Before real use online: change the demo passwords.** They are public in README/this file, so
  anyone could log in to the live site as Office. There is no change-password screen yet — add one
  (or update `users.password_hash` with a bcrypt hash) and stop documenting real passwords.
- Rotate the keys that were shared in chat (Gemini key, Supabase DB password, `sbp_` token, secret key).
- Vercel: env vars `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` must be set; confirm the live deployment works.
- Supabase project is in Seoul; a Mumbai (ap-south-1) project would be faster from India.
- Possible: "Handled by" (Pravin Sir / Avinash Sir) field on clients; Kalyani Maxion's GSTIN;
  company GSTIN/phone on the invoice letterhead; real terms & conditions text on the invoice.
