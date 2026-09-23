import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../state/meter_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';

const _periods = ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'PREVIOUS_MONTH'];
const _periodLabels = {
  'TODAY': 'Today',
  'THIS_WEEK': 'This week',
  'THIS_MONTH': 'This month',
  'PREVIOUS_MONTH': 'Previous month',
};

class UsageScreen extends StatefulWidget {
  const UsageScreen({super.key});
  @override
  State<UsageScreen> createState() => _UsageScreenState();
}

class _UsageScreenState extends State<UsageScreen> {
  String _period = 'THIS_WEEK';
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _comparison;
  final _readingController = TextEditingController();
  bool _savingReading = false;
  String? _lastMeterId;

  Future<void> _load(String meterId) async {
    final summary = await ApiClient.instance.get<Map<String, dynamic>>('/usage/$meterId/summary?period=$_period');
    final comparison = await ApiClient.instance.get<Map<String, dynamic>>('/usage/$meterId/comparison');
    if (mounted) setState(() { _summary = summary; _comparison = comparison; });
  }

  Future<void> _submitReading(String meterId) async {
    if (_readingController.text.isEmpty) return;
    setState(() => _savingReading = true);
    try {
      await ApiClient.instance.post('/meters/$meterId/reading', {'balanceKwh': double.parse(_readingController.text)});
      _readingController.clear();
    } finally {
      if (mounted) setState(() => _savingReading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meterProvider = context.watch<MeterProvider>();
    final meter = meterProvider.selectedMeter;
    if (meter == null) return const Scaffold(body: LoadingView());

    if (_lastMeterId != meter.id || _summary == null) {
      _lastMeterId = meter.id;
      _load(meter.id);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Usage')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _periods
                  .map((p) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(_periodLabels[p]!),
                          selected: _period == p,
                          onSelected: (_) {
                            setState(() => _period = p);
                            _load(meter.id);
                          },
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 14),
          PowerCard(
            child: _summary == null
                ? const LoadingView()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Units consumed', style: TextStyle(color: AppColors.textMuted)),
                      Text('${_summary!['totalKwh']} kWh', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
                      if (_summary!['averageDailyKwh'] != null) Text('Average daily: ${_summary!['averageDailyKwh']} kWh'),
                      if (_summary!['note'] != null) Text(_summary!['note'] as String, style: const TextStyle(color: AppColors.textMuted)),
                    ],
                  ),
          ),
          if (_comparison != null) ...[
            const SizedBox(height: 14),
            PowerCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Why are my units finishing fast?', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if (_comparison!['hasEnoughData'] != true)
                    Text(_comparison!['message'] as String? ?? '', style: const TextStyle(color: AppColors.textMuted))
                  else ...[
                    Text('Your usage is ${_comparison!['direction'] == 'UP' ? 'higher' : _comparison!['direction'] == 'DOWN' ? 'lower' : 'about the same'} this week.'),
                    const SizedBox(height: 6),
                    Text('Normal daily usage: ${_comparison!['normalDailyKwh']} kWh'),
                    Text('Current daily usage: ${_comparison!['currentDailyKwh']} kWh'),
                    Text('Change: ${_comparison!['percentChange']}%'),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          const Text('Update your meter reading', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 10),
          PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Enter the units currently showing on your meter to refresh your estimate.', style: TextStyle(color: AppColors.textMuted)),
                const SizedBox(height: 10),
                TextField(controller: _readingController, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'e.g. 42.7')),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _savingReading ? null : () => _submitReading(meter.id),
                  child: Text(_savingReading ? 'Saving...' : 'Update balance'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
