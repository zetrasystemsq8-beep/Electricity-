import 'package:flutter/material.dart';
import '../../api/api_client.dart';
import '../../widgets/loading_error.dart';
import '../../widgets/power_card.dart';

const _statuses = ['OPEN', 'PROCESSING', 'RESOLVED'];

class AdminSupportScreen extends StatefulWidget {
  const AdminSupportScreen({super.key});
  @override
  State<AdminSupportScreen> createState() => _AdminSupportScreenState();
}

class _AdminSupportScreenState extends State<AdminSupportScreen> {
  List<dynamic>? _tickets;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.getList('/admin/support-tickets');
    if (mounted) setState(() => _tickets = data);
  }

  Future<void> _updateStatus(String id, String status) async {
    await ApiClient.instance.post('/admin/support-tickets/$id/status', {'status': status});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_tickets == null) return const Scaffold(body: LoadingView());
    return Scaffold(
      appBar: AppBar(title: const Text('Support tickets')),
      body: ListView.separated(
        padding: const EdgeInsets.all(18),
        itemCount: _tickets!.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          final t = _tickets![i] as Map<String, dynamic>;
          final user = t['user'] as Map<String, dynamic>;
          return PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text((t['category'] as String).replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('${user['fullName']} · ${user['phoneNumber']}', style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 6),
                Text(t['description'] as String),
                const SizedBox(height: 8),
                DropdownButton<String>(
                  value: t['status'] as String,
                  items: _statuses.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                  onChanged: (v) {
                    if (v != null) _updateStatus(t['id'] as String, v);
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
