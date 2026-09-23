import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? user;
  bool loading = true;

  Future<void> bootstrap() async {
    await ApiClient.instance.loadToken();
    if (ApiClient.instance.token == null) {
      loading = false;
      notifyListeners();
      return;
    }
    try {
      final data = await ApiClient.instance.get<Map<String, dynamic>>('/auth/me');
      user = AppUser.fromJson(data);
    } catch (_) {
      await ApiClient.instance.setToken(null);
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String phoneNumber, String password) async {
    final result = await ApiClient.instance.post<Map<String, dynamic>>('/auth/login', {
      'phoneNumber': phoneNumber,
      'password': password,
    });
    await ApiClient.instance.setToken(result['token'] as String);
    user = AppUser.fromJson(result['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> register(String phoneNumber, String fullName, String password) async {
    final result = await ApiClient.instance.post<Map<String, dynamic>>('/auth/register', {
      'phoneNumber': phoneNumber,
      'fullName': fullName,
      'password': password,
    });
    await ApiClient.instance.setToken(result['token'] as String);
    user = AppUser.fromJson(result['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiClient.instance.setToken(null);
    user = null;
    notifyListeners();
  }
}
