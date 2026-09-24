// All direct Supabase table access + Edge Function calls live here, one
// method per REST-style operation the app needs. Every method returns data
// already shaped to match what the screens/models expect (the same shapes
// the old Express API returned) so no screen code had to change when we
// moved off the custom backend.
import 'package:supabase_flutter/supabase_flutter.dart';
import 'support_content.dart';

class SupabaseRepo {
  SupabaseClient get _sb => Supabase.instance.client;
  String get _uid => _sb.auth.currentUser!.id;

  // ---------------------------------------------------------------------
  // DISCOS / METERS
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> listDiscos() async {
    final rows = await _sb.from('discos').select().eq('is_active', true).order('name');
    return (rows as List).map((r) => {'id': r['id'], 'name': r['name'], 'shortCode': r['short_code']}).toList();
  }

  Map<String, dynamic> _mapMeter(Map<String, dynamic> m) {
    final disco = m['disco'] as Map<String, dynamic>?;
    return {
      'id': m['id'],
      'label': m['label'],
      'meterNumber': m['meter_number'],
      'disco': disco == null ? null : {'id': disco['id'], 'name': disco['name'], 'shortCode': disco['short_code']},
      'customerName': m['customer_name'],
      'meterType': m['meter_type'],
      'minimumPurchase': m['minimum_purchase'],
      'verificationStatus': m['verification_status'],
    };
  }

  Future<List<Map<String, dynamic>>> listMeters() async {
    final rows = await _sb
        .from('meters')
        .select('*, disco:discos(*)')
        .eq('user_id', _uid)
        .eq('is_active', true)
        .order('created_at');
    return (rows as List).map((r) => _mapMeter(r as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> addMeter(Map<String, dynamic> body) async {
    final row = await _sb
        .from('meters')
        .insert({
          'user_id': _uid,
          'label': body['label'],
          'meter_number': body['meterNumber'],
          'disco_id': body['discoId'],
          if (body['phoneNumber'] != null) 'phone_number': body['phoneNumber'],
        })
        .select('*, disco:discos(*)')
        .single();
    return _mapMeter(row);
  }

  Future<Map<String, dynamic>> verifyMeter(String meterId) async {
    final res = await _sb.functions.invoke('meters-verify', body: {'meterId': meterId});
    return _mapMeter(res.data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------
  // BALANCE / ESTIMATION  (ported from backend/src/services/estimationService.ts)
  // ---------------------------------------------------------------------

  Future<double?> _averageDailyUsage(String meterId, {int days = 14}) async {
    final since = DateTime.now().subtract(Duration(days: days)).toIso8601String();
    final rows = await _sb.from('usage_records').select().eq('meter_id', meterId).gte('period_end', since);
    final list = (rows as List).cast<Map<String, dynamic>>();
    if (list.isEmpty) return null;

    final totalKwh = list.fold<double>(0, (sum, r) => sum + (r['kwh_consumed'] as num).toDouble());
    final minStart = list.map((r) => DateTime.parse(r['period_start'] as String)).reduce((a, b) => a.isBefore(b) ? a : b);
    final maxEnd = list.map((r) => DateTime.parse(r['period_end'] as String)).reduce((a, b) => a.isAfter(b) ? a : b);
    final spanDays = maxEnd.difference(minStart).inHours / 24.0;
    return totalKwh / (spanDays < 1 ? 1 : spanDays);
  }

  Future<Map<String, dynamic>?> getBalance(String meterId) async {
    final latest = await _sb
        .from('balance_snapshots')
        .select()
        .eq('meter_id', meterId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (latest == null) return null;

    final avgDaily = await _averageDailyUsage(meterId);
    double balance = (latest['balance_kwh'] as num).toDouble();
    String source = latest['source'] as String;

    if (source != 'LIVE_METER' && avgDaily != null) {
      final daysSince = DateTime.now().difference(DateTime.parse(latest['created_at'] as String)).inHours / 24.0;
      balance = (balance - avgDaily * daysSince).clamp(0, double.infinity);
      source = 'ESTIMATED';
    }

    return {
      'balanceKwh': double.parse(balance.toStringAsFixed(2)),
      'source': source,
      'averageDailyUsageKwh': avgDaily,
      'estimatedDaysRemaining': (avgDaily != null && avgDaily > 0) ? double.parse((balance / avgDaily).toStringAsFixed(1)) : null,
    };
  }

  Future<Map<String, dynamic>> recordReading(String meterId, double balanceKwh) async {
    final previous = await _sb
        .from('balance_snapshots')
        .select()
        .eq('meter_id', meterId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();

    final snapshot = await _sb
        .from('balance_snapshots')
        .insert({
          'meter_id': meterId,
          'balance_kwh': balanceKwh,
          'source': 'USER_ENTERED_READING',
          'note': 'Entered directly by the customer from their meter display.',
        })
        .select()
        .single();

    if (previous != null && (previous['balance_kwh'] as num).toDouble() >= balanceKwh) {
      final consumed = (previous['balance_kwh'] as num).toDouble() - balanceKwh;
      if (consumed > 0) {
        await _sb.from('usage_records').insert({
          'meter_id': meterId,
          'period_start': previous['created_at'],
          'period_end': snapshot['created_at'],
          'kwh_consumed': consumed,
          'source': 'USER_ENTERED_READING',
        });
      }
    }

    return snapshot;
  }

  Future<Map<String, dynamic>> getMeterGuide(String meterId) async {
    final meter = await _sb.from('meters').select('*, meter_model:meter_models(*)').eq('id', meterId).eq('user_id', _uid).single();
    final model = meter['meter_model'] as Map<String, dynamic>?;
    if (model == null) {
      return {
        'hasVerifiedGuide': false,
        'message':
            "We haven't confirmed the exact model of this meter yet, so we can't show its specific balance-check code. Use Support > I don't understand my meter for general help.",
      };
    }
    return {
      'hasVerifiedGuide': true,
      'manufacturer': model['manufacturer'],
      'modelName': model['model_name'],
      'balanceCheckSteps': model['balance_check_steps'],
      'tokenLoadSteps': model['token_load_steps'],
      'source': model['verified_source'],
    };
  }

  // ---------------------------------------------------------------------
  // TRANSACTIONS / TOKENS
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> listTransactions() async {
    final rows = await _sb
        .from('transactions')
        .select('*, purchase:purchases!inner(amount_requested, user_id, meter:meters(label))')
        .eq('purchase.user_id', _uid)
        .order('created_at', ascending: false);

    return (rows as List).map((r) {
      final purchase = r['purchase'] as Map<String, dynamic>;
      final meter = purchase['meter'] as Map<String, dynamic>;
      return {
        'id': r['id'],
        'status': r['status'],
        'amountPaid': r['amount_paid'],
        'unitsKwh': r['units_kwh'],
        'createdAt': r['created_at'],
        'purchase': {'amountRequested': purchase['amount_requested'], 'meter': {'label': meter['label']}},
      };
    }).toList();
  }

  Future<Map<String, dynamic>> getTransaction(String id) async {
    final r = await _sb
        .from('transactions')
        .select(
            '*, purchase:purchases!inner(amount_requested, user_id, meter:meters(id, label, meter_number, disco:discos(name)), token:tokens(id, token_value)), events:transaction_events(to_status, note, created_at)')
        .eq('id', id)
        .single();

    final purchase = r['purchase'] as Map<String, dynamic>;
    final meter = purchase['meter'] as Map<String, dynamic>;
    // tokens.purchase_id is UNIQUE, so Supabase embeds it as a single
    // object (or null) here, not a list - important not to assume array.
    final token = purchase['token'] as Map<String, dynamic>?;
    final events = (r['events'] as List).cast<Map<String, dynamic>>();

    return {
      'id': r['id'],
      'internalRef': r['internal_ref'],
      'status': r['status'],
      'amountPaid': r['amount_paid'],
      'unitsKwh': r['units_kwh'],
      'electricityCreditRaw': r['electricity_credit_raw'],
      'otherChargesRaw': r['other_charges_raw'],
      'createdAt': r['created_at'],
      'purchase': {
        'amountRequested': purchase['amount_requested'],
        'meter': {'id': meter['id'], 'label': meter['label'], 'meterNumber': meter['meter_number'], 'disco': meter['disco']},
        'token': token == null ? null : {'id': token['id'], 'tokenValue': token['token_value']},
      },
      'events': events.map((e) => {'toStatus': e['to_status'], 'note': e['note'], 'createdAt': e['created_at']}).toList(),
    };
  }

  Future<List<Map<String, dynamic>>> listTokens() async {
    final rows = await _sb
        .from('tokens')
        .select('*, purchase:purchases!inner(user_id), meter:meters(label, disco:discos(name))')
        .eq('purchase.user_id', _uid)
        .order('created_at', ascending: false);

    return (rows as List).map((r) {
      final meter = r['meter'] as Map<String, dynamic>;
      return {
        'id': r['id'],
        'tokenValue': r['token_value'],
        'units': r['units'],
        'amount': r['amount'],
        'loadingStatus': r['loading_status'],
        'createdAt': r['created_at'],
        'meter': {'label': meter['label'], 'disco': meter['disco']},
      };
    }).toList();
  }

  Future<Map<String, dynamic>> setTokenLoaded(String tokenId, bool loaded) async {
    await _sb.from('tokens').update({'loading_status': loaded ? 'LOADED' : 'NOT_LOADED'}).eq('id', tokenId);
    return {};
  }

  // ---------------------------------------------------------------------
  // PURCHASES (Edge Functions - hold secret provider keys)
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> initiatePurchase(Map<String, dynamic> body) async {
    final res = await _sb.functions.invoke('purchases-initiate', body: body);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> confirmPurchase(Map<String, dynamic> body) async {
    final res = await _sb.functions.invoke('purchases-confirm', body: body);
    return res.data as Map<String, dynamic>;
  }

  // ---------------------------------------------------------------------
  // USAGE ANALYTICS  (ported from backend/src/services/usageService.ts)
  // ---------------------------------------------------------------------

  ({DateTime start, DateTime end}) _periodRange(String period) {
    final now = DateTime.now();
    switch (period) {
      case 'TODAY':
        return (start: DateTime(now.year, now.month, now.day), end: now);
      case 'THIS_WEEK':
        final start = now.subtract(Duration(days: now.weekday % 7));
        return (start: DateTime(start.year, start.month, start.day), end: now);
      case 'THIS_MONTH':
        return (start: DateTime(now.year, now.month, 1), end: now);
      case 'PREVIOUS_MONTH':
        final firstThis = DateTime(now.year, now.month, 1);
        final firstPrev = DateTime(now.year, now.month - 1, 1);
        return (start: firstPrev, end: firstThis);
      default:
        return (start: DateTime(now.year, now.month, now.day), end: now);
    }
  }

  Future<Map<String, dynamic>> getUsageSummary(String meterId, String period) async {
    final range = _periodRange(period);
    final rows = await _sb
        .from('usage_records')
        .select()
        .eq('meter_id', meterId)
        .gte('period_start', range.start.toIso8601String())
        .lte('period_end', range.end.toIso8601String());

    final list = (rows as List).cast<Map<String, dynamic>>();
    final totalKwh = list.fold<double>(0, (sum, r) => sum + (r['kwh_consumed'] as num).toDouble());
    final spanDays = range.end.difference(range.start).inHours / 24.0;
    final avgDaily = list.isNotEmpty ? totalKwh / (spanDays < 1 ? 1 : spanDays) : null;

    return {
      'totalKwh': double.parse(totalKwh.toStringAsFixed(2)),
      'averageDailyKwh': avgDaily != null ? double.parse(avgDaily.toStringAsFixed(2)) : null,
      if (list.isEmpty) 'note': 'No usage data recorded yet for this period. Enter a meter reading to start tracking.',
    };
  }

  Future<Map<String, dynamic>> getUsageComparison(String meterId) async {
    final recentAvg = await _averageDailyUsage(meterId, days: 7);
    final baselineAvg = await _averageDailyUsage(meterId, days: 30);

    if (recentAvg == null || baselineAvg == null || baselineAvg == 0) {
      return {'hasEnoughData': false, 'message': 'We need a bit more usage history before we can compare your recent consumption.'};
    }

    final percentChange = ((recentAvg - baselineAvg) / baselineAvg) * 100;
    return {
      'hasEnoughData': true,
      'normalDailyKwh': double.parse(baselineAvg.toStringAsFixed(2)),
      'currentDailyKwh': double.parse(recentAvg.toStringAsFixed(2)),
      'percentChange': double.parse(percentChange.toStringAsFixed(1)),
      'direction': percentChange > 5 ? 'UP' : (percentChange < -5 ? 'DOWN' : 'STEADY'),
    };
  }

  // ---------------------------------------------------------------------
  // BUDGET
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>?> getBudgetStatus(String? meterId) async {
    final now = DateTime.now();
    var query = _sb.from('budgets').select().eq('user_id', _uid).eq('period_month', now.month).eq('period_year', now.year);
    query = meterId != null ? query.eq('meter_id', meterId) : query.isFilter('meter_id', null);
    final budget = await query.maybeSingle();
    if (budget == null) return null;

    final start = DateTime(now.year, now.month, 1);
    final end = DateTime(now.year, now.month + 1, 1);

    var txnQuery = _sb
        .from('transactions')
        .select('amount_paid, purchase:purchases!inner(user_id, meter_id)')
        .eq('status', 'SUCCESSFUL')
        .eq('purchase.user_id', _uid)
        .gte('created_at', start.toIso8601String())
        .lt('created_at', end.toIso8601String());
    if (meterId != null) txnQuery = txnQuery.eq('purchase.meter_id', meterId);

    final rows = await txnQuery;
    final spent = (rows as List).fold<double>(0, (sum, r) => sum + ((r['amount_paid'] as num?)?.toDouble() ?? 0));
    final limit = (budget['monthly_limit'] as num).toDouble();

    return {
      'monthlyLimit': limit,
      'spent': spent,
      'remaining': (limit - spent) < 0 ? 0 : (limit - spent),
      'percentUsed': double.parse(((spent / limit) * 100).toStringAsFixed(1)),
    };
  }

  Future<Map<String, dynamic>> setBudget(Map<String, dynamic> body) async {
    final now = DateTime.now();
    final meterId = body['meterId'] as String?;
    final row = await _sb
        .from('budgets')
        .upsert({
          'user_id': _uid,
          'meter_id': meterId,
          'monthly_limit': body['monthlyLimit'],
          'period_month': now.month,
          'period_year': now.year,
        }, onConflict: 'user_id,meter_id,period_month,period_year')
        .select()
        .single();
    return row;
  }

  // ---------------------------------------------------------------------
  // SUPPORT
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> listMyTickets() async {
    final rows = await _sb.from('support_tickets').select().eq('user_id', _uid).order('created_at', ascending: false);
    return (rows as List)
        .map((r) => {
              'id': r['id'],
              'category': r['category'],
              'description': r['description'],
              'status': r['status'],
              'createdAt': r['created_at'],
            })
        .toList();
  }

  Future<Map<String, dynamic>> createTicket(Map<String, dynamic> body) async {
    final row = await _sb
        .from('support_tickets')
        .insert({'user_id': _uid, 'category': body['category'], 'description': body['description']})
        .select()
        .single();
    return {'id': row['id'], 'category': row['category'], 'description': row['description'], 'status': row['status'], 'createdAt': row['created_at']};
  }

  // ---------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> listNotifications() async {
    final rows = await _sb.from('notifications').select().eq('user_id', _uid).order('created_at', ascending: false).limit(50);
    return (rows as List)
        .map((r) => {
              'id': r['id'],
              'title': r['title'],
              'body': r['body'],
              'category': r['category'],
              'readAt': r['read_at'],
              'createdAt': r['created_at'],
            })
        .toList();
  }

  Future<Map<String, dynamic>> markNotificationRead(String id) async {
    final row = await _sb.from('notifications').update({'read_at': DateTime.now().toIso8601String()}).eq('id', id).select().single();
    return row;
  }

  // ---------------------------------------------------------------------
  // ADMIN  (relies on the admin RLS policies in 0002_rls.sql)
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> adminOverview() async {
    final users = await _sb.from('profiles').select('status');
    final usersList = (users as List).cast<Map<String, dynamic>>();
    final total = usersList.length;
    final active = usersList.where((u) => u['status'] == 'ACTIVE').length;
    final suspended = usersList.where((u) => u['status'] == 'SUSPENDED').length;

    final meters = await _sb.from('meters').select('verification_status').eq('is_active', true);
    final metersList = (meters as List).cast<Map<String, dynamic>>();
    final verifiedMeters = metersList.where((m) => m['verification_status'] == 'VERIFIED').length;

    final txns = await _sb.from('transactions').select('status, amount_paid');
    final txnList = (txns as List).cast<Map<String, dynamic>>();
    final statusCounts = <String, int>{};
    double revenue = 0;
    for (final t in txnList) {
      final s = t['status'] as String;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      if (s == 'SUCCESSFUL') revenue += (t['amount_paid'] as num?)?.toDouble() ?? 0;
    }

    return {
      'users': {'total': total, 'active': active, 'suspended': suspended},
      'meters': {'total': metersList.length, 'verified': verifiedMeters},
      'transactions': statusCounts,
      'revenue': {'totalSuccessfulVolume': revenue},
      // Whether VTpass/Paystack secrets are set lives in Supabase's function
      // environment, which the client has no visibility into - shown as
      // "needs checking" rather than guessed.
      'providers': [
        {'name': 'VTpass (check Supabase function secrets)', 'configured': false},
        {'name': 'Paystack (check Supabase function secrets)', 'configured': false},
      ],
    };
  }

  Future<List<Map<String, dynamic>>> adminListUsers(String? status) async {
    var query = _sb.from('profiles').select();
    if (status != null) query = query.eq('status', status);
    final rows = await query.order('created_at', ascending: false);
    return (rows as List)
        .map((r) => {
              'id': r['id'],
              'phoneNumber': r['phone_number'],
              'fullName': r['full_name'],
              'status': r['status'],
              'role': r['role'],
              'createdAt': r['created_at'],
            })
        .toList();
  }

  Future<Map<String, dynamic>> adminSetUserStatus(String userId, String status) async {
    final row = await _sb.from('profiles').update({'status': status}).eq('id', userId).select().single();
    return row;
  }

  Future<List<Map<String, dynamic>>> adminListTransactions() async {
    final rows = await _sb
        .from('transactions')
        .select('*, purchase:purchases(amount_requested, meter:meters(label), user:profiles(full_name))')
        .order('created_at', ascending: false)
        .limit(100);

    return (rows as List).map((r) {
      final purchase = r['purchase'] as Map<String, dynamic>;
      final meter = purchase['meter'] as Map<String, dynamic>;
      final user = purchase['user'] as Map<String, dynamic>;
      return {
        'id': r['id'],
        'status': r['status'],
        'amountPaid': r['amount_paid'],
        'createdAt': r['created_at'],
        'purchase': {
          'amountRequested': purchase['amount_requested'],
          'meter': {'label': meter['label']},
          'user': {'fullName': user['full_name']},
        },
      };
    }).toList();
  }

  Future<List<Map<String, dynamic>>> adminListTickets() async {
    final rows = await _sb
        .from('support_tickets')
        .select('*, user:profiles(full_name, phone_number)')
        .order('created_at', ascending: false)
        .limit(100);

    return (rows as List).map((r) {
      final user = r['user'] as Map<String, dynamic>;
      return {
        'id': r['id'],
        'category': r['category'],
        'description': r['description'],
        'status': r['status'],
        'createdAt': r['created_at'],
        'user': {'fullName': user['full_name'], 'phoneNumber': user['phone_number']},
      };
    }).toList();
  }

  Future<Map<String, dynamic>> adminSetTicketStatus(String ticketId, String status) async {
    final row = await _sb.from('support_tickets').update({'status': status}).eq('id', ticketId).select().single();
    return row;
  }
}
