import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/auth_provider.dart';
import 'state/meter_provider.dart';
import 'theme/app_theme.dart';
import 'widgets/loading_error.dart';
import 'screens/welcome_screen.dart';
import 'screens/add_meter_screen.dart';
import 'screens/home_shell.dart';

void main() {
  runApp(const PowerPalApp());
}

class PowerPalApp extends StatelessWidget {
  const PowerPalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..bootstrap()),
        ChangeNotifierProvider(create: (_) => MeterProvider()),
      ],
      child: MaterialApp(
        title: 'PowerPal',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const AuthGate(),
      ),
    );
  }
}

/// Root gate: shows Welcome/auth screens if signed out, otherwise decides
/// between "add your first meter" and the main tabbed Home shell - mirrors
/// the web app's RequireAuth + onboarding flow.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.loading) {
      return const Scaffold(body: LoadingView());
    }

    if (auth.user == null) {
      return const WelcomeScreen();
    }

    return const _PostLoginRouter();
  }
}

class _PostLoginRouter extends StatefulWidget {
  const _PostLoginRouter();
  @override
  State<_PostLoginRouter> createState() => _PostLoginRouterState();
}

class _PostLoginRouterState extends State<_PostLoginRouter> {
  bool _loading = true;
  bool _hasMeters = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final meterProvider = context.read<MeterProvider>();
    await meterProvider.refresh();
    if (mounted) {
      setState(() {
        _hasMeters = meterProvider.meters.isNotEmpty;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    return _hasMeters ? const HomeShell() : const AddMeterScreen();
  }
}
