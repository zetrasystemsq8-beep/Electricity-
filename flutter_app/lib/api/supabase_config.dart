// Fill these in with your project's own values (Supabase dashboard →
// Project Settings → API), or pass them at build/run time with:
//   flutter run --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
//               --dart-define=SUPABASE_ANON_KEY=xxxx
// The anon key is safe to ship in the app - it's what Row Level Security
// (see supabase/migrations/0002_rls.sql) is designed to be used alongside.
//
// .trim() below guards against a stray leading/trailing space or newline
// sneaking into the value when it's copy-pasted into a GitHub Actions
// secret - a bad URL from that would otherwise fail silently/confusingly.
class SupabaseConfig {
  static const String _rawUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://rxxaccwqfboeibjhlawh.supabase.co',
  );
  static const String _rawAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static String get url => _rawUrl.trim();
  static String get anonKey => _rawAnonKey.trim();
}
