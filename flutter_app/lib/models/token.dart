class TokenEntry {
  final String id;
  final String tokenValue;
  final double? units;
  final double amount;
  final String loadingStatus;
  final DateTime createdAt;
  final String meterLabel;
  final String discoName;

  TokenEntry({
    required this.id,
    required this.tokenValue,
    required this.units,
    required this.amount,
    required this.loadingStatus,
    required this.createdAt,
    required this.meterLabel,
    required this.discoName,
  });

  factory TokenEntry.fromJson(Map<String, dynamic> json) {
    final meter = json['meter'] as Map<String, dynamic>;
    final disco = meter['disco'] as Map<String, dynamic>;
    return TokenEntry(
      id: json['id'] as String,
      tokenValue: json['tokenValue'] as String,
      units: (json['units'] as num?)?.toDouble(),
      amount: (json['amount'] as num).toDouble(),
      loadingStatus: json['loadingStatus'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      meterLabel: meter['label'] as String,
      discoName: disco['name'] as String,
    );
  }
}
