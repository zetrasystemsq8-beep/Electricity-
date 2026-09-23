import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../models/meter.dart';

class MeterProvider extends ChangeNotifier {
  List<Meter> meters = [];
  String? selectedMeterId;
  bool loading = true;

  Meter? get selectedMeter {
    if (selectedMeterId == null) return null;
    try {
      return meters.firstWhere((m) => m.id == selectedMeterId);
    } catch (_) {
      return meters.isNotEmpty ? meters.first : null;
    }
  }

  void selectMeter(String id) {
    selectedMeterId = id;
    notifyListeners();
  }

  Future<void> refresh() async {
    loading = true;
    notifyListeners();
    try {
      final data = await ApiClient.instance.getList('/meters');
      meters = data.map((e) => Meter.fromJson(e as Map<String, dynamic>)).toList();
      selectedMeterId ??= meters.isNotEmpty ? meters.first.id : null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void clear() {
    meters = [];
    selectedMeterId = null;
    notifyListeners();
  }
}
