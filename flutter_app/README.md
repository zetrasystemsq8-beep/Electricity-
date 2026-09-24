# PowerPal — Flutter app

Talks directly to Supabase (Auth + Database with Row Level Security) for
everything except meter verification and payments, which go through three
small Edge Functions that hold the secret VTpass/Paystack keys. See
`../supabase/README.md` for deploying that side first - do that before
running this app, since it has nothing to talk to otherwise.

## 1. Bring in your Android/iOS shell

*(Already done if you're reading this after following the earlier setup -
`android/` and `ios/` should already be sitting next to this file, renamed
to your real package name.)*

## 2. Point the app at your Supabase project

Open `lib/api/supabase_config.dart` and either edit the default values
directly, or pass them at run time so you never have to commit real values
to git:

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are in your Supabase dashboard → **Project Settings** → **API**.
The anon key is safe to ship inside the app - Row Level Security
(`../supabase/migrations/0002_rls.sql`) is what actually protects each
user's data, not keeping this key secret.

For a release build:

```bash
flutter build apk \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Paystack checkout

Payment goes through Paystack's hosted checkout (started by the
`purchases-initiate` Edge Function), opened in-app via `webview_flutter`
(`lib/screens/payment_webview_screen.dart`). The webview watches for any
navigation starting with `https://powerpal.app/payment-callback` (set in
`supabase/functions/purchases-initiate/index.ts`) and treats it as
"payment attempt finished," pulling the `reference`/`trxref` param out of
the URL.

## 4. Run it

```bash
cd flutter_app
flutter pub get
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

## Architecture note

`lib/api/api_client.dart` keeps the exact same `get`/`post`/`getList`
method signatures every screen was already written against - underneath,
it now routes each call to either a direct Supabase table operation
(`lib/api/supabase_repo.dart`) or one of the three Edge Functions, instead
of hitting a REST API. No screen file needed to change when the backend
moved off Express. `lib/state/auth_provider.dart` talks to Supabase Auth
directly (phone+password UX kept via a synthetic
`phone@powerpal.local` email under the hood).

## What's implemented

Same screen list as before: Welcome, Register, Login, Add/Verify Meter,
Home dashboard, Buy → Confirm → Paystack webview → success/token screen,
Token Vault, History → Receipt, Usage (with meter-reading input), Meter
Guide, Support (self-help + tickets), Budget, Profile, and the Admin
dashboard. See `../supabase/README.md` for two features not carried over
in this pass (appliance estimator, provider call-log dashboard).
