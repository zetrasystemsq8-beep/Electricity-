import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';

class MeterGuideScreen extends StatefulWidget {
  final String meterId;
  const MeterGuideScreen({super.key, required this.meterId});
  @override
  State<MeterGuideScreen> createState() => _MeterGuideScreenState();
}

class _MeterGuideScreenState extends State<MeterGuideScreen> {
  Map<String, dynamic>? _guide;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.get<Map<String, dynamic>>('/meters/${widget.meterId}/guide').then((data) {
      if (mounted) setState(() => _guide = data);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_guide == null) return const Scaffold(body: LoadingView());

    if (_guide!['hasVerifiedGuide'] != true) {
      return Scaffold(
        appBar: AppBar(title: const Text('Check your meter')),
        body: Padding(
          padding: const EdgeInsets.all(18),
          child: PowerCard(child: Text(_guide!['message'] as String)),
        ),
      );
    }

    final balanceSteps = (_guide!['balanceCheckSteps'] as List<dynamic>).cast<String>();
    final tokenSteps = (_guide!['tokenLoadSteps'] as List<dynamic>).cast<String>();

    return Scaffold(
      appBar: AppBar(title: const Text('Check your meter')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Text('${_guide!['manufacturer']} · ${_guide!['modelName']}', style: const TextStyle(color: AppColors.textMuted)),
          const SizedBox(height: 16),
          const Text('Check balance', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(child: _StepList(steps: balanceSteps)),
          const SizedBox(height: 20),
          const Text('Load token', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          PowerCard(child: _StepList(steps: tokenSteps)),
          if (_guide!['source'] != null) ...[
            const SizedBox(height: 10),
            Text('Source: ${_guide!['source']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class _StepList extends StatelessWidget {
  final List<String> steps;
  const _StepList({required this.steps});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: steps.asMap().entries.map((e) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text('${e.key + 1}. ${e.value}'),
        );
      }).toList(),
    );
  }
}
