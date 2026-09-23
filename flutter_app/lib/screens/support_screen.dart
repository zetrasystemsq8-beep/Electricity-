import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';

const _categories = [
  'PAYMENT_PROBLEM', 'TOKEN_PROBLEM', 'METER_PROBLEM', 'BALANCE_PROBLEM',
  'WRONG_CUSTOMER_DETAILS', 'REFUND', 'OTHER',
];

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  List<dynamic>? _topics;
  List<dynamic>? _tickets;
  Map<String, dynamic>? _openGuide;
  String _category = _categories.first;
  final _description = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final topics = await ApiClient.instance.getList('/support/self-help');
    final tickets = await ApiClient.instance.getList('/support/tickets');
    if (mounted) setState(() { _topics = topics; _tickets = tickets; });
  }

  Future<void> _viewGuide(String key) async {
    final guide = await ApiClient.instance.get<Map<String, dynamic>>('/support/self-help/$key');
    if (mounted) setState(() => _openGuide = guide);
  }

  Future<void> _submitTicket() async {
    setState(() { _error = null; _submitting = true; });
    try {
      await ApiClient.instance.post('/support/tickets', {'category': _category, 'description': _description.text});
      _description.clear();
      await _load();
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : "Couldn't submit your ticket.");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_openGuide != null) {
      final steps = (_openGuide!['steps'] as List<dynamic>).cast<String>();
      return Scaffold(
        appBar: AppBar(title: Text(_openGuide!['title'] as String), leading: IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _openGuide = null))),
        body: Padding(
          padding: const EdgeInsets.all(18),
          child: PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: steps.asMap().entries.map((e) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('${e.key + 1}. ${e.value}'))).toList(),
            ),
          ),
        ),
      );
    }

    if (_topics == null) return const Scaffold(body: LoadingView());

    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text("I don't understand my meter", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: _topics!.map((t) {
                return ListTile(
                  title: Text(t['title'] as String),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _viewGuide(t['key'] as String),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Raise a ticket', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          if (_error != null) ErrorBanner(message: _error!),
          PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  value: _category,
                  items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c.replaceAll('_', ' ')))).toList(),
                  onChanged: (v) => setState(() => _category = v!),
                ),
                const SizedBox(height: 10),
                TextField(controller: _description, maxLines: 4, decoration: const InputDecoration(hintText: 'Describe the problem')),
                const SizedBox(height: 10),
                ElevatedButton(onPressed: _submitting ? null : _submitTicket, child: Text(_submitting ? 'Submitting...' : 'Submit ticket')),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('Your tickets', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            padding: EdgeInsets.zero,
            child: (_tickets?.isEmpty ?? true)
                ? const Padding(padding: EdgeInsets.all(14), child: Text('No tickets yet.', style: TextStyle(color: AppColors.textMuted)))
                : Column(
                    children: _tickets!.map((t) {
                      return ListTile(
                        title: Text((t['category'] as String).replaceAll('_', ' ')),
                        subtitle: Text(DateTime.parse(t['createdAt'] as String).toLocal().toString().split(' ').first),
                        trailing: Chip(label: Text(t['status'] as String)),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}
