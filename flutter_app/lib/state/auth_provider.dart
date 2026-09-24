// Auth now goes straight through Supabase Auth instead of our old custom
// JWT backend. We keep the app's phone+password UX by signing up with a
// synthetic email (phone@powerpal.local) - Supabase's
// on_auth_user_created trigger (see supabase/migrations/0001_init.sql)
// automatically creates the matching public.profiles row with the real
// phone number and name.
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? user;
  bool loading = true;

  SupabaseClient get _sb => Supabase.instance.client;

  static String _syntheticEmail(String phoneNumber) {
    final cleaned = phoneNumber.replaceAll(RegExp(r'[^0-9+]'), '');
    return '$cleaned@powerpal.local';
  }

  Future<void> bootstrap() async {
    final session = _sb.auth.currentSession;
    if (session == null) {
      loading = false;
      notifyListeners();
      return;
    }
    await _loadProfile(session.user.id);
    loading = false;
    notifyListeners();
  }

  Future<void> _loadProfile(String userId) async {
    final row = await _sb.from('profiles').select().eq('id', userId).single();
    user = AppUser(
      id: row['id'] as String,
      phoneNumber: row['phone_number'] as String,
      fullName: row['full_name'] as String,
      role: row['role'] as String,
    );
  }

  Future<void> login(String phoneNumber, String password) async {
    final res = await _sb.auth.signInWithPassword(email: _syntheticEmail(phoneNumber), password: password);
    if (res.user == null) throw Exception('Incorrect phone number or password.');
    await _loadProfile(res.user!.id);
    notifyListeners();
  }

  Future<void> register(String phoneNumber, String fullName, String password) async {
    final res = await _sb.auth.signUp(
      email: _syntheticEmail(phoneNumber),
      password: password,
      data: {'phone_number': phoneNumber, 'full_name': fullName},
    );
    if (res.user == null) throw Exception('Could not create account. Please try again.');

    // The on_auth_user_created trigger creates the profile row
    // synchronously within the same transaction as signUp, so it should
    // already exist - but guard with a short retry in case of replication
    // lag on Supabase's side.
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await _loadProfile(res.user!.id);
        break;
      } catch (_) {
        await Future.delayed(const Duration(milliseconds: 400));
      }
    }
    notifyListeners();
  }

  Future<void> logout() async {
    await _sb.auth.signOut();
    user = null;
    notifyListeners();
  }
}
