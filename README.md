# PowerPal — Smart Prepaid Electricity Assistant

A full-stack app: Node/Express/TypeScript/Prisma backend + React/Vite frontend.
Every feature in the build brief is implemented as real, working code. The only
things that don't work out of the box are the parts that legitimately require
*your* credentials — a VTpass account and a Paystack account — because this
app will never fabricate a meter balance, a token, or a transaction status.
Add real keys to `backend/.env` and those features start working immediately;
no code changes needed.

## What's real vs. what needs your keys

| Feature | Status |
|---|---|
| Auth, meters, token vault, transaction engine, estimation engine, usage analytics, alerts, budgets, support tickets, admin dashboard | Fully working today |
| Meter verification & electricity vending (VTpass) | Real integration — needs `VTPASS_API_KEY` / `VTPASS_SECRET_KEY` in `.env` |
| Payment collection (Paystack) | Real integration — needs `PAYSTACK_SECRET_KEY` in `.env` and your Paystack public key pasted into `frontend/src/pages/Confirm.tsx` (`pk_test_placeholder`) |
| Per-meter-model "how to check your balance" codes | Deliberately empty until you add verified `MeterModel` rows — the app refuses to guess a code, per the brief's own rule #48 |

Sign up for free sandbox/test credentials at https://vtpass.com and
https://paystack.com to try the full flow end-to-end before going live.

## Project layout

```
supabase/     Database schema (Postgres + Row Level Security) and Edge Functions - the real backend now
flutter_app/  The PowerPal mobile app (Flutter/Dart) - talks to Supabase directly
backend/      The original Express/Prisma API - now optional; only needed if you still use frontend/
frontend/     React/Vite web version - optional, still talks to backend/ if you run both
```

**Building the Android app: set up `supabase/` first (see its README),
then `flutter_app/`.** The Express `backend/` and React `frontend/` are
a separate, independent pair that still work together exactly as before
if you want a browser-based admin panel too, but the Flutter app no
longer needs either of them.

## Quick start on Termux (Android)

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git unzip -y
node -v   # should be 18+

# unzip the project (if you downloaded the zip instead of git-cloning)
unzip prepaid-electricity-app.zip
cd prepaid-electricity-app

# --- Backend ---
cd backend
cp .env.example .env
# edit .env with `nano .env` and fill in whatever keys you have
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed:discos
npm run create:admin -- "+2348000000000" "Admin User" "a-strong-password"
npm run dev
# API now running at http://localhost:4000
```

Open a second Termux session (swipe from the left edge → New session) for the frontend:

```bash
cd prepaid-electricity-app/frontend
cp .env.example .env
npm install
npm run dev
# Frontend now running at http://localhost:5173
```

Open `http://localhost:5173` in your phone's browser. If you're testing from
a different device on the same network, replace `localhost` in
`frontend/.env` with your phone's LAN IP, and update `VITE_API_BASE_URL`
accordingly.

## Pushing to your GitHub repository

```bash
cd prepaid-electricity-app
git init
git add .
git commit -m "Initial commit: PowerPal full-stack app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env` files are already git-ignored on both sides, so your real API keys
never get committed — always fill them in fresh on each machine/server from
the matching `.env.example`.

## Database

SQLite by default (`backend/dev.db`) — zero setup, works great for
development and even a small-scale beta on Termux. For production, change
`DATABASE_URL` in `.env` to a Postgres connection string and change
`provider = "sqlite"` to `provider = "postgresql"` in
`backend/prisma/schema.prisma`, then re-run `npx prisma migrate dev`.

## Creating an admin account

```bash
cd backend
npm run create:admin -- "<phone number>" "<full name>" "<password>"
```

Log into the frontend with that phone number/password; the Profile screen
will show an "Admin dashboard" link.

## What's deliberately NOT built yet (and why)

Per the build brief's own rules, this codebase never fakes data to look
finished. Two things are real architecture with no data behind them yet,
by design:

1. **Meter-model-specific guides** (`MeterModel` table) — empty until you
   populate it with codes you've verified against real DISCO/meter
   documentation. The app's UI handles this gracefully (shows a clear "not
   yet confirmed" message) rather than guessing.
2. **Live meter data** — the `LiveMeterDataProvider` interface exists
   (`backend/src/providers/ElectricityProviderInterface.ts`) for when you
   get an authorized real-time feed (DISCO/AMI). Until then, every balance
   shown is clearly labelled "Estimated from your usage," never "Live."

Everything else — the full purchase flow, transaction engine, token vault,
usage analytics, alerts, budgets, support center, admin dashboard — is
complete, wired end-to-end, and ready to run.
