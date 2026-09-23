import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../api/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import '../widgets/status_pill.dart';
import 'meter_guide_screen.dart';
import 'home_shell.dart';

class PurchaseSuccessScreen extends StatefulWidget {
  final String transactionId;
  const PurchaseSuccessScreen({super.key, required this.transactionId});

  @override
  State<PurchaseSuccessScreen> createState() => _PurchaseSuccessScreenState();
}

class _PurchaseSuccessScreenState extends State<PurchaseSuccessScreen> {
  Map<String, dynamic>? _txn;
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>('/transactions/${widget.transactionId}');
    if (mounted) setState(() => _txn = data);
  }

  @override
  Widget build(BuildContext context) {
    if (_txn == null) return const Scaffold(body: LoadingView());

    final status = _txn!['status'] as String;
    final purchase = _txn!['purchase'] as Map<String, dynamic>;
    final meter = purchase['meter'] as Map<String, dynamic>;
    final disco = meter['disco'] as Map<String, dynamic>;
    final token = purchase['token'] as Map<String, dynamic>?;
    final amount = _txn!['amountPaid'] ?? purchase['amountRequested'];
    final unitsKwh = _txn!['unitsKwh'];

    return Scaffold(
      appBar: AppBar(title: const Text('Purchase')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            PowerCard(
              child: Column(
                children: [
                  Text(status == 'SUCCESSFUL' ? '✅' : status == 'FAILED' ? '❌' : '⏳', style: const TextStyle(fontSize: 36)),
                  const SizedBox(height: 6),
                  StatusPill(status: status),
                  const SizedBox(height: 8),
                  Text('₦$amount', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                  Text('${meter['label']} · ${disco['name']}', style: const TextStyle(color: AppColors.textMuted)),
                ],
              ),
            ),
            if (token != null) ...[
              const SizedBox(height: 14),
              PowerCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Electricity token', style: TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 8),
                    SelectableText(
                      token['tokenValue'] as String,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.primaryDark),
                    ),
                    if (unitsKwh != null) Text('Units: $unitsKwh kWh', style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () async {
                              await Clipboard.setData(ClipboardData(text: token['tokenValue'] as String));
                              setState(() => _copied = true);
                              Future.delayed(const Duration(seconds: 2), () {
                                if (mounted) setState(() => _copied = false);
                              });
                            },
                            child: Text(_copied ? 'Copied!' : 'Copy token'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Share.share('PowerPal token: ${token['tokenValue']}'),
                            child: const Text('Share'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            if (status == 'PENDING') ...[
              const SizedBox(height: 12),
              const Text(
                "Your provider is still confirming this purchase. Check History in a few minutes if the token doesn't appear here.",
                style: TextStyle(color: AppColors.textMuted),
              ),
            ],
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MeterGuideScreen(meterId: meter['id'] as String))),
              child: const Text('How to load'),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const HomeShell()), (r) => false),
              child: const Text('Back to Home'),
            ),
          ],
        ),
      ),
    );
  }
}
