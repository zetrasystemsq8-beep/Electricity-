// Fill these in with your project's own values (Supabase dashboard →
// Project Settings → API), or pass them at build/run time with:
//   flutter run --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
//               --dart-define=SUPABASE_ANON_KEY=xxxx
// The anon key is safe to ship in the app - it's what Row Level Security
// (see supabase/migrations/0002_rls.sql) is designed to be used alongside.
class SupabaseConfig {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://rxxaccwqfboeibjhlawh.supabase.co',
  );
  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );
}
