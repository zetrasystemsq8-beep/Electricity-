import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api/api_client.dart';
import '../models/token.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';

class TokenVaultScreen extends StatefulWidget {
  const TokenVaultScreen({super.key});
  @override
  State<TokenVaultScreen> createState() => _TokenVaultScreenState();
}

class _TokenVaultScreenState extends State<TokenVaultScreen> {
  List<TokenEntry>? _tokens;
  String? _copiedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.getList('/tokens');
    if (mounted) setState(() => _tokens = data.map((e) => TokenEntry.fromJson(e as Map<String, dynamic>)).toList());
  }

  Future<void> _toggleLoaded(TokenEntry t) async {
    final loaded = t.loadingStatus != 'LOADED';
    await ApiClient.instance.post('/tokens/${t.id}/loaded', {'loaded': loaded});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_tokens == null) return const Scaffold(body: LoadingView());

    return Scaffold(
      appBar: AppBar(title: const Text('My Tokens')),
      body: _tokens!.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(18),
              child: Text('No tokens yet. Buy electricity to see them saved here.', style: TextStyle(color: AppColors.textMuted)),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(18),
              itemCount: _tokens!.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final t = _tokens![i];
                return PowerCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${t.meterLabel} · ${t.discoName}', style: const TextStyle(color: AppColors.textMuted)),
                      const SizedBox(height: 6),
                      SelectableText(t.tokenValue, style: const TextStyle(fontFamily: 'monospace', fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primaryDark)),
                      const SizedBox(height: 6),
                      Text('₦${t.amount.toStringAsFixed(0)} ${t.units != null ? '· ${t.units} kWh' : ''} · ${t.createdAt.toLocal().toString().split(' ').first}', style: const TextStyle(color: AppColors.textMuted)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: () async {
                              await Clipboard.setData(ClipboardData(text: t.tokenValue));
                              setState(() => _copiedId = t.id);
                              Future.delayed(const Duration(seconds: 2), () {
                                if (mounted) setState(() => _copiedId = null);
                              });
                            },
                            child: Text(_copiedId == t.id ? 'Copied!' : 'Copy'),
                          ),
                          const SizedBox(width: 10),
                          TextButton(
                            onPressed: () => _toggleLoaded(t),
                            child: Text(t.loadingStatus == 'LOADED' ? 'Marked loaded ✓' : 'Mark as loaded'),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
