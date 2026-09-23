import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/meter_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import 'confirm_screen.dart';

const _quickAmounts = [1000, 2000, 5000, 10000, 20000];

class BuyScreen extends StatefulWidget {
  const BuyScreen({super.key});
  @override
  State<BuyScreen> createState() => _BuyScreenState();
}

class _BuyScreenState extends State<BuyScreen> {
  int? _amount;
  bool _customOpen = false;
  final _customController = TextEditingController();
  String? _error;

  void _continue() {
    final meterProvider = context.read<MeterProvider>();
    final meter = meterProvider.selectedMeter;
    if (meter == null) {
      setState(() => _error = 'Choose a meter first.');
      return;
    }
    if (meter.verificationStatus != 'VERIFIED') {
      setState(() => _error = "This meter isn't verified yet. Verify it from Profile before buying.");
      return;
    }
    final amount = _customOpen ? int.tryParse(_customController.text) : _amount;
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter an amount.');
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ConfirmScreen(meterId: meter.id, amount: amount.toDouble()),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final meterProvider = context.watch<MeterProvider>();
    if (meterProvider.loading) return const Scaffold(body: LoadingView());

    return Scaffold(
      appBar: AppBar(title: const Text('Buy electricity')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            if (_error != null) ErrorBanner(message: _error!),
            const Text('Meter', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              value: meterProvider.selectedMeter?.id,
              items: meterProvider.meters
                  .map((m) => DropdownMenuItem(
                        value: m.id,
                        enabled: m.verificationStatus == 'VERIFIED',
                        child: Text('${m.label}${m.verificationStatus != 'VERIFIED' ? ' (not verified)' : ''}'),
                      ))
                  .toList(),
              onChanged: (id) {
                if (id != null) context.read<MeterProvider>().selectMeter(id);
              },
            ),
            const SizedBox(height: 20),
            const Text('Amount', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.2,
              children: [
                ..._quickAmounts.map((amt) => _AmountChip(
                      label: '₦${amt.toString()}',
                      selected: !_customOpen && _amount == amt,
                      onTap: () => setState(() { _amount = amt; _customOpen = false; }),
                    )),
                _AmountChip(label: 'Custom', selected: _customOpen, onTap: () => setState(() => _customOpen = true)),
              ],
            ),
            if (_customOpen) ...[
              const SizedBox(height: 14),
              const Text('Custom amount (₦)', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextField(controller: _customController, keyboardType: TextInputType.number),
            ],
            const SizedBox(height: 24),
            ElevatedButton(onPressed: _continue, child: const Text('Continue')),
          ],
        ),
      ),
    );
  }
}

class _AmountChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _AmountChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: selected ? AppColors.primary : Colors.white,
        foregroundColor: selected ? Colors.white : AppColors.primary,
        minimumSize: Size.zero,
      ),
      child: Text(label),
    );
  }
}
