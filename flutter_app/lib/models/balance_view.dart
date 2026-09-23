class BalanceView {
  final double balanceKwh;
  final String source;
  final double? estimatedDaysRemaining;
  final double? averageDailyUsageKwh;

  BalanceView({
    required this.balanceKwh,
    required this.source,
    required this.estimatedDaysRemaining,
    required this.averageDailyUsageKwh,
  });

  factory BalanceView.fromJson(Map<String, dynamic> json) => BalanceView(
        balanceKwh: (json['balanceKwh'] as num).toDouble(),
        source: json['source'] as String,
        estimatedDaysRemaining: (json['estimatedDaysRemaining'] as num?)?.toDouble(),
        averageDailyUsageKwh: (json['averageDailyUsageKwh'] as num?)?.toDouble(),
      );
}
