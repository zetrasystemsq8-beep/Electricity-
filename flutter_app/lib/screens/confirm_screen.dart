import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../state/meter_provider.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import 'payment_webview_screen.dart';
import 'purchase_success_screen.dart';

class ConfirmScreen extends StatefulWidget {
  final String meterId;
  final double amount;
  const ConfirmScreen({super.key, required this.meterId, required this.amount});

  @override
  State<ConfirmScreen> createState() => _ConfirmScreenState();
}

class _ConfirmScreenState extends State<ConfirmScreen> {
  String? _error;
  bool _busy = false;

  Future<void> _startPayment() async {
    setState(() { _error = null; _busy = true; });
    try {
      final result = await ApiClient.instance.post<Map<String, dynamic>>('/purchases/initiate', {
        'meterId': widget.meterId,
        'amount': widget.amount,
      });

      final transactionId = result['transactionId'] as String;

      if (result['paymentConfigured'] != true) {
        setState(() {
          _error = result['paystackPublicNote'] as String? ?? "Payments aren't configured yet.";
          _busy = false;
        });
        return;
      }

      final checkoutUrl = result['checkoutUrl'] as String;

      if (!mounted) return;
      final reference = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => PaymentWebViewScreen(checkoutUrl: checkoutUrl)),
      );

      if (reference == null) {
        // User closed the webview without completing payment.
        setState(() => _busy = false);
        return;
      }

      final txn = await ApiClient.instance.post<Map<String, dynamic>>('/purchases/confirm', {
        'transactionId': transactionId,
        'processorRef': reference,
      });

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => PurchaseSuccessScreen(transactionId: txn['id'] as String)),
      );
    } catch (e) {
      setState(() {
        _error = e is ApiException ? e.message : "Couldn't complete this purchase.";
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final meter = context.read<MeterProvider>().meters.firstWhere((m) => m.id == widget.meterId);

    return Scaffold(
      appBar: AppBar(title: const Text('Confirm purchase')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ErrorBanner(message: _error!),
              PowerCard(
                child: Column(
                  children: [
                    _Row('Meter', meter.meterNumber),
                    _Row('Customer', meter.customerName ?? '—'),
                    _Row('DISCO', meter.disco.name),
                    _Row('Amount', '₦${widget.amount.toStringAsFixed(0)}'),
                    _Row('Expected electricity information', 'Based on provider response'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (_busy)
                const LoadingView()
              else
                ElevatedButton(onPressed: _startPayment, child: Text('Pay ₦${widget.amount.toStringAsFixed(0)}')),
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54)),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
