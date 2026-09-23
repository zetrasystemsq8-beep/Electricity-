import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../models/balance_view.dart';
import '../models/transaction.dart';
import '../state/meter_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import '../widgets/status_pill.dart';
import 'add_meter_screen.dart';
import 'buy_screen.dart';
import 'token_vault_screen.dart';
import 'meter_guide_screen.dart';
import 'history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  BalanceView? _balance;
  bool _balanceLoading = false;
  TransactionSummary? _lastTxn;
  Map<String, dynamic>? _todayUsage;
  String? _lastLoadedMeterId;

  Future<void> _loadForMeter(String meterId) async {
    if (_lastLoadedMeterId == meterId) return;
    _lastLoadedMeterId = meterId;
    setState(() => _balanceLoading = true);

    final balanceJson = await ApiClient.instance.get<Map<String, dynamic>?>('/meters/$meterId/balance');
    final txnList = await ApiClient.instance.getList('/transactions');
    final usageJson = await ApiClient.instance.get<Map<String, dynamic>>('/usage/$meterId/summary?period=TODAY');

    if (!mounted) return;
    setState(() {
      _balance = balanceJson != null ? BalanceView.fromJson(balanceJson) : null;
      final txns = txnList.map((e) => TransactionSummary.fromJson(e as Map<String, dynamic>)).toList();
      _lastTxn = txns.where((t) => t.status == 'SUCCESSFUL').isNotEmpty
          ? txns.firstWhere((t) => t.status == 'SUCCESSFUL')
          : null;
      _todayUsage = usageJson;
      _balanceLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final meterProvider = context.watch<MeterProvider>();

    if (meterProvider.loading) return const Scaffold(body: LoadingView());

    if (meterProvider.meters.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('PowerPal')),
        body: Padding(
          padding: const EdgeInsets.all(18),
          child: PowerCard(
            child: Column(
              children: [
                const Text("You haven't added a meter yet."),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddMeterScreen())),
                  child: const Text('Add your meter'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final meter = meterProvider.selectedMeter!;
    _loadForMeter(meter.id);

    return Scaffold(
      appBar: AppBar(
        title: const Text('PowerPal'),
        actions: [
          if (meterProvider.meters.length > 1)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: DropdownButton<String>(
                value: meter.id,
                underline: const SizedBox(),
                items: meterProvider.meters.map((m) => DropdownMenuItem(value: m.id, child: Text(m.label))).toList(),
                onChanged: (id) {
                  if (id != null) {
                    context.read<MeterProvider>().selectMeter(id);
                    _lastLoadedMeterId = null;
                  }
                },
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _lastLoadedMeterId = null;
          await _loadForMeter(meter.id);
        },
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            PowerCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Electricity left · ${meter.label}', style: const TextStyle(color: AppColors.textMuted)),
                  const SizedBox(height: 6),
                  if (_balanceLoading)
                    const LoadingView(label: 'Loading balance...')
                  else if (_balance == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text('No balance yet - buy electricity or enter a meter reading to get started.'),
                    )
                  else ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${_balance!.balanceKwh}', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800)),
                        const SizedBox(width: 6),
                        const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('kWh', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    StatusPill(status: _balance!.source),
                    if (_balance!.estimatedDaysRemaining != null) ...[
                      const SizedBox(height: 10),
                      Text('Estimated remaining time: ${_balance!.estimatedDaysRemaining} days'),
                    ],
                  ],
                ],
              ),
            ),
            if (_lastTxn != null) ...[
              const SizedBox(height: 14),
              PowerCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Last purchase', style: TextStyle(color: AppColors.textMuted)),
                    Text('₦${_lastTxn!.amountPaid ?? _lastTxn!.amountRequested}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                    Text('${_lastTxn!.createdAt.toLocal()}'.split(' ').first + ' · ${_lastTxn!.unitsKwh ?? "—"} kWh', style: const TextStyle(color: AppColors.textMuted)),
                  ],
                ),
              ),
            ],
            if (_todayUsage != null) ...[
              const SizedBox(height: 14),
              PowerCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Today's usage", style: TextStyle(color: AppColors.textMuted)),
                    Text('${_todayUsage!['totalKwh']} kWh', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 22),
            const Text('Quick actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              children: [
                _QuickAction(icon: Icons.bolt_rounded, label: 'Buy', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BuyScreen()))),
                _QuickAction(icon: Icons.vpn_key_rounded, label: 'My Token', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TokenVaultScreen()))),
                _QuickAction(icon: Icons.dialpad_rounded, label: 'Check Meter', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MeterGuideScreen(meterId: meter.id)))),
                _QuickAction(icon: Icons.receipt_long_rounded, label: 'History', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HistoryScreen()))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
