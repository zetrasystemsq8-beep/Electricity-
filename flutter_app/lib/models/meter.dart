import 'disco.dart';

class Meter {
  final String id;
  final String label;
  final String meterNumber;
  final Disco disco;
  final String? customerName;
  final String meterType;
  final double? minimumPurchase;
  final String verificationStatus;

  Meter({
    required this.id,
    required this.label,
    required this.meterNumber,
    required this.disco,
    required this.customerName,
    required this.meterType,
    required this.minimumPurchase,
    required this.verificationStatus,
  });

  factory Meter.fromJson(Map<String, dynamic> json) => Meter(
        id: json['id'] as String,
        label: json['label'] as String,
        meterNumber: json['meterNumber'] as String,
        disco: Disco.fromJson(json['disco'] as Map<String, dynamic>),
        customerName: json['customerName'] as String?,
        meterType: json['meterType'] as String? ?? 'UNKNOWN',
        minimumPurchase: (json['minimumPurchase'] as num?)?.toDouble(),
        verificationStatus: json['verificationStatus'] as String,
      );
}
