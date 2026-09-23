import 'package:flutter/material.dart';
import '../../api/api_client.dart';
import '../../widgets/loading_error.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});
  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  List<dynamic>? _users;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.getList('/admin/users');
    if (mounted) setState(() => _users = data);
  }

  Future<void> _toggle(Map<String, dynamic> u) async {
    final status = u['status'] == 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await ApiClient.instance.post('/admin/users/${u['id']}/status', {'status': status});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_users == null) return const Scaffold(body: LoadingView());
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      body: ListView.separated(
        padding: const EdgeInsets.all(18),
        itemCount: _users!.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final u = _users![i] as Map<String, dynamic>;
          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(u['fullName'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(u['phoneNumber'] as String),
            trailing: TextButton(
              onPressed: () => _toggle(u),
              child: Text(u['status'] == 'ACTIVE' ? 'Suspend' : 'Reactivate'),
            ),
          );
        },
      ),
    );
  }
}
