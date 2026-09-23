import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/meter_provider.dart';
import 'home_screen.dart';
import 'buy_screen.dart';
import 'usage_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';

// Mirrors the web app's bottom nav: Home, Buy, Usage, History, Profile.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  final _screens = const [
    HomeScreen(),
    BuyScreen(),
    UsageScreen(),
    HistoryScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MeterProvider>().refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.bolt_rounded), label: 'Buy'),
          BottomNavigationBarItem(icon: Icon(Icons.bar_chart_rounded), label: 'Usage'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'History'),
          BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
