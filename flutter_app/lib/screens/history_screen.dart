import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../models/transaction.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/status_pill.dart';
import 'receipt_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<TransactionSummary>? _txns;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.getList('/transactions');
    if (mounted) setState(() => _txns = data.map((e) => TransactionSummary.fromJson(e as Map<String, dynamic>)).toList());
  }

  @override
  Widget build(BuildContext context) {
    if (_txns == null) return const Scaffold(body: LoadingView());

    return Scaffold(
      appBar: AppBar(title: const Text('History')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _txns!.isEmpty
            ? const Center(child: Text('No purchases yet.', style: TextStyle(color: AppColors.textMuted)))
            : ListView.separated(
                padding: const EdgeInsets.all(18),
                itemCount: _txns!.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final t = _txns![i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(t.meterLabel, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(t.createdAt.toLocal().toString()),
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('₦${t.amountPaid ?? t.amountRequested}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        StatusPill(status: t.status),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReceiptScreen(transactionId: t.id))),
                  );
                },
              ),
      ),
    );
  }
}
