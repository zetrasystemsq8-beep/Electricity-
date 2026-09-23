// Thin HTTP wrapper around the PowerPal backend. Every call hits the real
// API - no mock data anywhere in this app. Change [baseUrl] to point at
// your deployed backend (or 10.0.2.2 for the Android emulator talking to
// a backend running on your host machine).
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  /// Point this at your backend. For a phone connected to the same Termux
  /// device over localhost this won't work - use your machine's LAN IP,
  /// e.g. http://192.168.1.42:4000/api, or a deployed URL.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api',
  );

  String? _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('powerpal_token');
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null) {
      await prefs.remove('powerpal_token');
    } else {
      await prefs.setString('powerpal_token', token);
    }
  }

  String? get token => _token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<T> get<T>(String path) => _request<T>('GET', path);
  Future<T> post<T>(String path, [Map<String, dynamic>? body]) =>
      _request<T>('POST', path, body);
  Future<T> patch<T>(String path, [Map<String, dynamic>? body]) =>
      _request<T>('PATCH', path, body);
  Future<T> delete<T>(String path) => _request<T>('DELETE', path);

  Future<T> _request<T>(String method, String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$baseUrl$path');
    late http.Response res;

    final encodedBody = body != null ? jsonEncode(body) : null;

    switch (method) {
      case 'GET':
        res = await http.get(uri, headers: _headers);
        break;
      case 'POST':
        res = await http.post(uri, headers: _headers, body: encodedBody);
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: _headers, body: encodedBody);
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: _headers);
        break;
    }

    if (res.statusCode == 204) return null as T;

    Map<String, dynamic>? decoded;
    if (res.body.isNotEmpty) {
      try {
        decoded = jsonDecode(res.body) as Map<String, dynamic>;
      } catch (_) {
        decoded = null;
      }
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final error = decoded?['error'] as Map<String, dynamic>?;
      throw ApiException(
        res.statusCode,
        error?['message'] as String? ?? 'Request failed (${res.statusCode})',
        error?['code'] as String?,
      );
    }

    return decoded as T;
  }

  /// For endpoints returning a raw JSON array instead of an object.
  Future<List<dynamic>> getList(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      Map<String, dynamic>? decoded;
      try {
        decoded = jsonDecode(res.body) as Map<String, dynamic>;
      } catch (_) {}
      final error = decoded?['error'] as Map<String, dynamic>?;
      throw ApiException(res.statusCode, error?['message'] as String? ?? 'Request failed', error?['code'] as String?);
    }
    return jsonDecode(res.body) as List<dynamic>;
  }
}
