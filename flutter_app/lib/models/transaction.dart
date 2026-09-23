class TransactionSummary {
  final String id;
  final String status;
  final double? amountPaid;
  final double? unitsKwh;
  final DateTime createdAt;
  final double amountRequested;
  final String meterLabel;

  TransactionSummary({
    required this.id,
    required this.status,
    required this.amountPaid,
    required this.unitsKwh,
    required this.createdAt,
    required this.amountRequested,
    required this.meterLabel,
  });

  factory TransactionSummary.fromJson(Map<String, dynamic> json) {
    final purchase = json['purchase'] as Map<String, dynamic>;
    final meter = purchase['meter'] as Map<String, dynamic>;
    return TransactionSummary(
      id: json['id'] as String,
      status: json['status'] as String,
      amountPaid: (json['amountPaid'] as num?)?.toDouble(),
      unitsKwh: (json['unitsKwh'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      amountRequested: (purchase['amountRequested'] as num).toDouble(),
      meterLabel: meter['label'] as String,
    );
  }
}
