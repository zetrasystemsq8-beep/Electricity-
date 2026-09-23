import 'package:flutter/material.dart';
import '../../api/api_client.dart';
import '../../widgets/loading_error.dart';
import '../../widgets/status_pill.dart';

class AdminTransactionsScreen extends StatefulWidget {
  const AdminTransactionsScreen({super.key});
  @override
  State<AdminTransactionsScreen> createState() => _AdminTransactionsScreenState();
}

class _AdminTransactionsScreenState extends State<AdminTransactionsScreen> {
  List<dynamic>? _txns;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.getList('/admin/transactions').then((data) {
      if (mounted) setState(() => _txns = data);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_txns == null) return const Scaffold(body: LoadingView());
    return Scaffold(
      appBar: AppBar(title: const Text('Transactions')),
      body: ListView.separated(
        padding: const EdgeInsets.all(18),
        itemCount: _txns!.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final t = _txns![i] as Map<String, dynamic>;
          final purchase = t['purchase'] as Map<String, dynamic>;
          final meter = purchase['meter'] as Map<String, dynamic>;
          final user = purchase['user'] as Map<String, dynamic>;
          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(user['fullName'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(meter['label'] as String),
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('₦${t['amountPaid'] ?? purchase['amountRequested']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                StatusPill(status: t['status'] as String),
              ],
            ),
          );
        },
      ),
    );
  }
}
