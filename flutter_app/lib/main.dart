import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api/supabase_config.dart';
import 'state/auth_provider.dart';
import 'state/meter_provider.dart';
import 'theme/app_theme.dart';
import 'widgets/loading_error.dart';
import 'screens/welcome_screen.dart';
import 'screens/add_meter_screen.dart';
import 'screens/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  String? startupError;
  try {
    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
    );
  } catch (e) {
    // If SUPABASE_URL/SUPABASE_ANON_KEY were blank, malformed, or corrupted
    // when the app was built, fail loudly with the real reason instead of
    // leaving the person staring at a generic "something went wrong" deeper
    // in the app with no way to tell what's actually broken.
    startupError = e.toString();
  }

  runApp(startupError != null ? SupabaseStartupErrorApp(message: startupError) : const PowerPalApp());
}

class SupabaseStartupErrorApp extends StatelessWidget {
  final String message;
  const SupabaseStartupErrorApp({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Could not connect to Supabase', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                const Text('This usually means SUPABASE_URL or SUPABASE_ANON_KEY was blank, mistyped, or corrupted when this build was made.'),
                const SizedBox(height: 20),
                const Text('Raw error:', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                SelectableText(message),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
/// between "add your first meter" and the main tabbed Home shell.
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
