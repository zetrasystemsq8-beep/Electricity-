# PowerPal — Supabase backend

This replaces the old Express/Prisma backend for the Flutter app. Auth,
meters, tokens, transactions, usage, budgets, support tickets and
notifications now live directly in Supabase (Postgres + Row Level
Security). Only the parts that need a secret key - meter verification
(VTpass) and payments (Paystack) - run as Edge Functions, since those keys
can never be embedded in a mobile app.

Everything below is done from your browser, in the Supabase dashboard -
no CLI needed, which matters since the Supabase CLI isn't reliably
installable in Termux.

## 1. Run the database migrations

1. Open your Supabase project → **SQL Editor** (left sidebar)
2. Open `migrations/0001_init.sql` from this repo, copy its entire
   contents, paste into a new SQL Editor query, and run it
3. Repeat for `migrations/0002_rls.sql`
4. Repeat for `migrations/0003_seed_discos.sql`

Run them **in that order** - each depends on the one before it. If a run
fails partway through, check the error message; re-running a migration
that already partly succeeded will usually fail on "already exists"
errors for the parts that did apply, which is fine to ignore as long as
the actual new statements at the point of failure succeed once you retry
just those lines.

## 2. Deploy the Edge Functions

For each of the three folders under `functions/` (`meters-verify`,
`purchases-initiate`, `purchases-confirm`) and `webhooks-paystack`:

1. In the Supabase dashboard, go to **Edge Functions** → **Deploy a new
   function**
2. Name it exactly the same as the folder (e.g. `meters-verify`)
3. Copy the contents of that folder's `index.ts` into the function editor
4. You'll also need the shared helper files - Supabase's dashboard editor
   supports multiple files per function. Create these additional files
   inside the same function, matching the folder structure under
   `_shared/`:
   - `_shared/cors.ts`
   - `_shared/supabaseAdmin.ts`
   - `_shared/vtpass.ts` (only needed for `meters-verify` and
     `purchases-confirm`)
   - `_shared/paystack.ts` (only needed for `purchases-initiate`,
     `purchases-confirm`, and `webhooks-paystack`)
5. Deploy

Repeat for all four functions.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
automatically available inside every Edge Function - you don't set those
yourself.

## 3. Add your real provider secrets

Still in **Edge Functions**, find the **Secrets** section (applies to all
functions in the project) and add:

| Secret | Value |
|---|---|
| `VTPASS_BASE_URL` | `https://sandbox.vtpass.com/api` (switch to the live URL when ready) |
| `VTPASS_API_KEY` | from your VTpass account |
| `VTPASS_SECRET_KEY` | from your VTpass account |
| `PAYSTACK_SECRET_KEY` | from your Paystack account |
| `PAYSTACK_WEBHOOK_SECRET` | from your Paystack account (webhook settings page) |

Until these are set, `meters-verify` and the purchase functions will
return a clear "not configured" error instead of pretending to work -
same rule as before, just enforced in a different place now.

## 4. Point Paystack's webhook at your function

In your Paystack dashboard → Settings → Webhooks, set the webhook URL to:

```
https://<your-project-ref>.supabase.co/functions/v1/webhooks-paystack
```

## 5. Point the Flutter app at this project

See `../flutter_app/README.md` — you need this project's URL and anon key
(Project Settings → API), passed to the app via `--dart-define`.

## What changed vs. the original Express backend

The business logic is the same (transaction engine, estimation engine,
provider abstraction, "never fake a balance or a token" rules) - it's
just repackaged: Express routes → direct Supabase table access (governed
by `migrations/0002_rls.sql` instead of custom middleware) for everything
that doesn't need a secret key, and Express services → Edge Functions for
the three things that do.

**Not carried over in this pass** (scope was trimmed to fit): the
appliance estimator (section 16 of the original build brief) and the
admin "provider health" call-log dashboard - the `provider_call_logs`
table still exists and Edge Functions could log to it, but no UI reads it
yet in the Flutter app. Both are straightforward to add back the same way
everything else here was built, if you want them.
