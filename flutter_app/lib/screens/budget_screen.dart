import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../state/meter_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';

class BudgetScreen extends StatefulWidget {
  const BudgetScreen({super.key});
  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> {
  Map<String, dynamic>? _status;
  bool _loading = true;
  final _limitController = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final meterId = context.read<MeterProvider>().selectedMeter?.id;
    final data = await ApiClient.instance.get<Map<String, dynamic>?>('/budget${meterId != null ? '?meterId=$meterId' : ''}');
    if (mounted) setState(() { _status = data; _loading = false; });
  }

  Future<void> _save() async {
    if (_limitController.text.isEmpty) return;
    setState(() => _saving = true);
    try {
      final meterId = context.read<MeterProvider>().selectedMeter?.id;
      await ApiClient.instance.post('/budget', {
        'monthlyLimit': double.parse(_limitController.text),
        if (meterId != null) 'meterId': meterId,
      });
      _limitController.clear();
      await _load();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Electricity budget')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          if (_loading)
            const LoadingView()
          else if (_status != null)
            PowerCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('This month', style: TextStyle(color: AppColors.textMuted)),
                  Text('₦${_status!['spent']} / ₦${_status!['monthlyLimit']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: ((_status!['percentUsed'] as num).toDouble() / 100).clamp(0, 1),
                      minHeight: 10,
                      backgroundColor: AppColors.border,
                      color: (_status!['percentUsed'] as num) > 90 ? AppColors.danger : AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text('You have ₦${_status!['remaining']} remaining in your monthly electricity budget.'),
                ],
              ),
            )
          else
            const Text('No budget set for this month yet.', style: TextStyle(color: AppColors.textMuted)),
          const SizedBox(height: 20),
          Text(_status != null ? 'Update budget' : 'Set a budget', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(controller: _limitController, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '50000')),
                const SizedBox(height: 10),
                ElevatedButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving...' : 'Save budget')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
