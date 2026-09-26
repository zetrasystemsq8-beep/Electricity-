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
