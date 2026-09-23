import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../models/disco.dart';
import '../models/meter.dart';
import '../state/meter_provider.dart';
import '../widgets/loading_error.dart';
import '../widgets/power_card.dart';
import 'home_shell.dart';

class AddMeterScreen extends StatefulWidget {
  const AddMeterScreen({super.key});
  @override
  State<AddMeterScreen> createState() => _AddMeterScreenState();
}

enum _Step { form, verifying, verified }

class _AddMeterScreenState extends State<AddMeterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _label = TextEditingController(text: 'My Home');
  final _meterNumber = TextEditingController();
  final _phone = TextEditingController();
  List<Disco> _discos = [];
  String? _discoId;
  bool _loadingDiscos = true;
  String? _error;
  _Step _step = _Step.form;
  Meter? _verifiedMeter;

  @override
  void initState() {
    super.initState();
    _loadDiscos();
  }

  Future<void> _loadDiscos() async {
    final data = await ApiClient.instance.getList('/meters/discos');
    setState(() {
      _discos = data.map((e) => Disco.fromJson(e as Map<String, dynamic>)).toList();
      _discoId = _discos.isNotEmpty ? _discos.first.id : null;
      _loadingDiscos = false;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _discoId == null) return;
    setState(() { _error = null; _step = _Step.verifying; });
    try {
      final meterJson = await ApiClient.instance.post<Map<String, dynamic>>('/meters', {
        'label': _label.text.trim(),
        'meterNumber': _meterNumber.text.trim(),
        'discoId': _discoId,
        if (_phone.text.trim().isNotEmpty) 'phoneNumber': _phone.text.trim(),
      });
      final verifiedJson = await ApiClient.instance.post<Map<String, dynamic>>('/meters/${meterJson['id']}/verify', {});
      final verified = Meter.fromJson(verifiedJson);
      if (!mounted) return;
      await context.read<MeterProvider>().refresh();
      setState(() { _verifiedMeter = verified; _step = _Step.verified; });
    } catch (e) {
      setState(() {
        _error = e is ApiException ? e.message : "Couldn't add this meter. Please try again.";
        _step = _Step.form;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingDiscos) return const Scaffold(body: LoadingView());

    if (_step == _Step.verified && _verifiedMeter != null) {
      final m = _verifiedMeter!;
      return Scaffold(
        appBar: AppBar(title: const Text('Meter verified')),
        body: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              PowerCard(
                child: Column(
                  children: [
                    const Text('✅', style: TextStyle(fontSize: 36)),
                    const SizedBox(height: 8),
                    Text(m.customerName ?? 'Meter verified', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    Text('${m.meterNumber} · ${m.disco.name}', style: const TextStyle(color: Colors.black54)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const HomeShell()),
                  (route) => false,
                ),
                child: const Text('Go to Home'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Add your meter')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ErrorBanner(message: _error!),
                const Text('What should we call this meter?', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(controller: _label, validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
                const SizedBox(height: 14),
                const Text('Meter number', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _meterNumber,
                  keyboardType: TextInputType.number,
                  validator: (v) => (v == null || v.length < 5) ? 'Enter a valid meter number' : null,
                ),
                const SizedBox(height: 14),
                const Text('DISCO', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _discoId,
                  items: _discos.map((d) => DropdownMenuItem(value: d.id, child: Text(d.name))).toList(),
                  onChanged: (v) => setState(() => _discoId = v),
                ),
                const SizedBox(height: 14),
                const Text('Phone number (optional)', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(controller: _phone, keyboardType: TextInputType.phone),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: _step == _Step.verifying ? null : _submit,
                  child: Text(_step == _Step.verifying ? 'Verifying meter...' : 'Verify meter'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
