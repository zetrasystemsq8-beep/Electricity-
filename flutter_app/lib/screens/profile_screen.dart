import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../state/auth_provider.dart';
import '../state/meter_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import '../widgets/status_pill.dart';
import 'add_meter_screen.dart';
import 'budget_screen.dart';
import 'support_screen.dart';
import 'admin/overview_screen.dart';
import 'welcome_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<dynamic>? _notifications;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.getList('/notifications').then((data) {
      if (mounted) setState(() => _notifications = data);
    });
  }

  Future<void> _verifyMeter(String meterId) async {
    await ApiClient.instance.post('/meters/$meterId/verify', {});
    if (mounted) await context.read<MeterProvider>().refresh();
  }

  Future<void> _logout() async {
    await context.read<AuthProvider>().logout();
    context.read<MeterProvider>().clear();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const WelcomeScreen()), (r) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final meterProvider = context.watch<MeterProvider>();
    if (user == null) return const Scaffold(body: LoadingView());

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          PowerCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                Text(user.phoneNumber, style: const TextStyle(color: AppColors.textMuted)),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('My meters', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            child: Column(
              children: [
                ...meterProvider.meters.map((m) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(m.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${m.meterNumber} · ${m.disco.name}'),
                      trailing: m.verificationStatus == 'VERIFIED'
                          ? const StatusPill(status: 'SUCCESSFUL')
                          : TextButton(onPressed: () => _verifyMeter(m.id), child: const Text('Verify')),
                    )),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddMeterScreen())),
                  child: const Text('Add another meter'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('Manage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(title: const Text('Electricity budget'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BudgetScreen()))),
                ListTile(title: const Text('Support'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportScreen()))),
                if (user.role == 'ADMIN')
                  ListTile(title: const Text('Admin dashboard'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminOverviewScreen()))),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(
            padding: EdgeInsets.zero,
            child: (_notifications?.isEmpty ?? true)
                ? const Padding(padding: EdgeInsets.all(14), child: Text('No notifications yet.', style: TextStyle(color: AppColors.textMuted)))
                : Column(
                    children: _notifications!.take(10).map((n) => ListTile(
                          title: Text(n['title'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(n['body'] as String),
                        )).toList(),
                  ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: _logout,
            child: const Text('Log out'),
          ),
        ],
      ),
    );
  }
}
