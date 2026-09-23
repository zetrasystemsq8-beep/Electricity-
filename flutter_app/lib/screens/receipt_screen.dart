import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import '../widgets/status_pill.dart';

class ReceiptScreen extends StatefulWidget {
  final String transactionId;
  const ReceiptScreen({super.key, required this.transactionId});
  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  Map<String, dynamic>? _txn;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.get<Map<String, dynamic>>('/transactions/${widget.transactionId}').then((data) {
      if (mounted) setState(() => _txn = data);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_txn == null) return const Scaffold(body: LoadingView());

    final purchase = _txn!['purchase'] as Map<String, dynamic>;
    final meter = purchase['meter'] as Map<String, dynamic>;
    final disco = meter['disco'] as Map<String, dynamic>;
    final token = purchase['token'] as Map<String, dynamic>?;
    final events = (_txn!['events'] as List<dynamic>).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(title: const Text('Receipt')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusPill(status: _txn!['status'] as String),
                const SizedBox(height: 8),
                Text('₦${_txn!['amountPaid'] ?? purchase['amountRequested']}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                _row('Meter', meter['meterNumber'] as String),
                _row('DISCO', disco['name'] as String),
                if (_txn!['electricityCreditRaw'] != null) _row('Electricity credit', '₦${_txn!['electricityCreditRaw']}'),
                if (_txn!['otherChargesRaw'] != null) _row('Other applicable charges', '₦${_txn!['otherChargesRaw']}'),
                if (_txn!['unitsKwh'] != null) _row('Units received', '${_txn!['unitsKwh']} kWh'),
                if (token != null) _row('Token', token['tokenValue'] as String),
                _row('Receipt number', _txn!['internalRef'] as String),
                _row('Date', DateTime.parse(_txn!['createdAt'] as String).toLocal().toString()),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('Transaction timeline', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 10),
          PowerCard(
            child: Column(
              children: events
                  .map((e) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(e['toStatus'] as String),
                            Text(DateTime.parse(e['createdAt'] as String).toLocal().toString().split(' ').last, style: const TextStyle(color: AppColors.textMuted)),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: AppColors.textMuted)),
            Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );
}
