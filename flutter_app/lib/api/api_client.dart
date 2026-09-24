// Drop-in replacement for the old REST ApiClient. Every screen in this app
// still calls ApiClient.instance.get/post/getList with the exact same paths
// as before - this file is the only thing that changed: instead of hitting
// our old Express API, each path now maps to either a direct Supabase table
// call (RLS-protected) or one of the three Edge Functions that hold secret
// provider keys (meters-verify, purchases-initiate, purchases-confirm).
// Keeping the same method signatures meant zero changes were needed in any
// screen file.
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api_exception.dart';
import 'supabase_repo.dart';
import 'support_content.dart';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  SupabaseClient get _sb => Supabase.instance.client;
  final SupabaseRepo _repo = SupabaseRepo();

  Future<T> get<T>(String path) async => await _route('GET', path, null) as T;
  Future<T> post<T>(String path, [Map<String, dynamic>? body]) async => await _route('POST', path, body) as T;
  Future<T> patch<T>(String path, [Map<String, dynamic>? body]) async => await _route('PATCH', path, body) as T;
  Future<T> delete<T>(String path) async => await _route('DELETE', path, null) as T;

  Future<List<dynamic>> getList(String path) async {
    final result = await _route('GET', path, null);
    return result as List<dynamic>;
  }

  Future<dynamic> _route(String method, String rawPath, Map<String, dynamic>? body) async {
    final uri = Uri.parse('http://x$rawPath'); // dummy host just to reuse Uri's path/query parsing
    final path = uri.path;
    final query = uri.queryParameters;
    final segments = path.split('/').where((s) => s.isNotEmpty).toList();

    try {
      // ---- /meters ----
      if (method == 'GET' && path == '/meters/discos') return await _repo.listDiscos();
      if (method == 'GET' && path == '/meters') return await _repo.listMeters();
      if (method == 'POST' && path == '/meters') return await _repo.addMeter(body!);
      if (method == 'POST' && segments.length == 3 && segments[0] == 'meters' && segments[2] == 'verify') {
        return await _repo.verifyMeter(segments[1]);
      }
      if (method == 'GET' && segments.length == 3 && segments[0] == 'meters' && segments[2] == 'balance') {
        return await _repo.getBalance(segments[1]);
      }
      if (method == 'POST' && segments.length == 3 && segments[0] == 'meters' && segments[2] == 'reading') {
        return await _repo.recordReading(segments[1], (body!['balanceKwh'] as num).toDouble());
      }
      if (method == 'GET' && segments.length == 3 && segments[0] == 'meters' && segments[2] == 'guide') {
        return await _repo.getMeterGuide(segments[1]);
      }

      // ---- /transactions ----
      if (method == 'GET' && path == '/transactions') return await _repo.listTransactions();
      if (method == 'GET' && segments.length == 2 && segments[0] == 'transactions') {
        return await _repo.getTransaction(segments[1]);
      }

      // ---- /tokens ----
      if (method == 'GET' && path == '/tokens') return await _repo.listTokens();
      if (method == 'POST' && segments.length == 3 && segments[0] == 'tokens' && segments[2] == 'loaded') {
        return await _repo.setTokenLoaded(segments[1], body!['loaded'] as bool);
      }

      // ---- /purchases ----
      if (method == 'POST' && path == '/purchases/initiate') return await _repo.initiatePurchase(body!);
      if (method == 'POST' && path == '/purchases/confirm') return await _repo.confirmPurchase(body!);

      // ---- /usage ----
      if (method == 'GET' && segments.length == 3 && segments[0] == 'usage' && segments[2] == 'summary') {
        return await _repo.getUsageSummary(segments[1], query['period'] ?? 'THIS_WEEK');
      }
      if (method == 'GET' && segments.length == 3 && segments[0] == 'usage' && segments[2] == 'comparison') {
        return await _repo.getUsageComparison(segments[1]);
      }

      // ---- /budget ----
      if (method == 'GET' && path == '/budget') return await _repo.getBudgetStatus(query['meterId']);
      if (method == 'POST' && path == '/budget') return await _repo.setBudget(body!);

      // ---- /support ----
      if (method == 'GET' && path == '/support/self-help') return SupportContent.topics();
      if (method == 'GET' && segments.length == 3 && segments[0] == 'support' && segments[1] == 'self-help') {
        return SupportContent.guide(segments[2]);
      }
      if (method == 'GET' && path == '/support/tickets') return await _repo.listMyTickets();
      if (method == 'POST' && path == '/support/tickets') return await _repo.createTicket(body!);

      // ---- /notifications ----
      if (method == 'GET' && path == '/notifications') return await _repo.listNotifications();
      if (method == 'POST' && segments.length == 3 && segments[0] == 'notifications' && segments[2] == 'read') {
        return await _repo.markNotificationRead(segments[1]);
      }

      // ---- /admin ----
      if (method == 'GET' && path == '/admin/overview') return await _repo.adminOverview();
      if (method == 'GET' && path == '/admin/users') return await _repo.adminListUsers(query['status']);
      if (method == 'POST' && segments.length == 4 && segments[0] == 'admin' && segments[1] == 'users' && segments[3] == 'status') {
        return await _repo.adminSetUserStatus(segments[2], body!['status'] as String);
      }
      if (method == 'GET' && path == '/admin/transactions') return await _repo.adminListTransactions();
      if (method == 'GET' && path == '/admin/support-tickets') return await _repo.adminListTickets();
      if (method == 'POST' &&
          segments.length == 4 &&
          segments[0] == 'admin' &&
          segments[1] == 'support-tickets' &&
          segments[3] == 'status') {
        return await _repo.adminSetTicketStatus(segments[2], body!['status'] as String);
      }

      throw ApiException(404, 'No handler for $method $path');
    } on PostgrestException catch (e) {
      throw ApiException(400, e.message, e.code);
    } on FunctionException catch (e) {
      final details = e.details;
      final message = details is Map && details['error'] is Map
          ? (details['error']['message'] as String? ?? 'Request failed')
          : 'Request failed (${e.status})';
      throw ApiException(e.status ?? 500, message);
    }
  }
}
