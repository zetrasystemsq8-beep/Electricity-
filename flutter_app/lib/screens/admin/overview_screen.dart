import 'package:flutter/material.dart';
import '../../api/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/loading_error.dart';
import '../../widgets/power_card.dart';
import 'users_screen.dart';
import 'transactions_screen.dart';
import 'support_screen.dart';

class AdminOverviewScreen extends StatefulWidget {
  const AdminOverviewScreen({super.key});
  @override
  State<AdminOverviewScreen> createState() => _AdminOverviewScreenState();
}

class _AdminOverviewScreenState extends State<AdminOverviewScreen> {
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.get<Map<String, dynamic>>('/admin/overview').then((data) {
      if (mounted) setState(() => _data = data);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_data == null) return const Scaffold(body: LoadingView());

    final users = _data!['users'] as Map<String, dynamic>;
    final meters = _data!['meters'] as Map<String, dynamic>;
    final revenue = _data!['revenue'] as Map<String, dynamic>;
    final transactions = _data!['transactions'] as Map<String, dynamic>;
    final providers = (_data!['providers'] as List<dynamic>).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(title: const Text('Admin dashboard')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.6,
            children: [
              _statCard('Users', '${users['total']}'),
              _statCard('Verified meters', '${meters['verified']}/${meters['total']}'),
              _statCard('Revenue', '₦${revenue['totalSuccessfulVolume']}'),
              _statCard('Suspended users', '${users['suspended']}'),
            ],
          ),
          const SizedBox(height: 20),
          const Text('Transactions by status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            child: Column(
              children: transactions.entries
                  .map((e) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(e.key), Text('${e.value}')]),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Provider status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            child: Column(
              children: providers
                  .map((p) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(p['name'] as String),
                            Chip(
                              label: Text(p['configured'] == true ? 'Configured' : 'Not configured'),
                              backgroundColor: p['configured'] == true ? const Color(0xFFE2F6EC) : const Color(0xFFFBE4E4),
                            ),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Manage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(title: const Text('Users'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminUsersScreen()))),
                ListTile(title: const Text('Transactions'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminTransactionsScreen()))),
                ListTile(title: const Text('Support tickets'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminSupportScreen()))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String label, String value) {
    return PowerCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
