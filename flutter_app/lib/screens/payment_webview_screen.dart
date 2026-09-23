import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Hosts Paystack's real checkout page (the authorization_url our backend
/// got from Paystack's transaction/initialize call - see
/// backend/src/routes/purchase.routes.ts). Paystack redirects the webview
/// to our callback_url once payment finishes; we intercept that navigation,
/// pull the `reference` query param out of it, and pop back to
/// ConfirmScreen with it. No payment data is faked here - this is the same
/// hosted page a browser checkout would show, just embedded.
class PaymentWebViewScreen extends StatefulWidget {
  final String checkoutUrl;
  const PaymentWebViewScreen({super.key, required this.checkoutUrl});

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  static const _callbackPrefix = 'https://powerpal.app/payment-callback';

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onNavigationRequest: (request) {
            if (request.url.startsWith(_callbackPrefix)) {
              final uri = Uri.parse(request.url);
              final reference = uri.queryParameters['reference'] ?? uri.queryParameters['trxref'];
              Navigator.of(context).pop(reference);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secure payment'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const LinearProgressIndicator(),
        ],
      ),
    );
  }
}
