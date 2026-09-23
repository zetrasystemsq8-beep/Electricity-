import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatusPill extends StatelessWidget {
  final String status;
  const StatusPill({super.key, required this.status});

  static const Map<String, _PillStyle> _map = {
    'LIVE_METER': _PillStyle('Live meter balance', Color(0xFFE2F6EC), AppColors.primary),
    'ESTIMATED': _PillStyle('Estimated from your usage', Color(0xFFFDF1DD), Color(0xFFA1690C)),
    'USER_ENTERED_READING': _PillStyle('From your last reading', Color(0xFFFDF1DD), Color(0xFFA1690C)),
    'SUCCESSFUL': _PillStyle('Successful', Color(0xFFE2F6EC), AppColors.primary),
    'PENDING': _PillStyle('Pending', Color(0xFFFDF1DD), Color(0xFFA1690C)),
    'PROCESSING': _PillStyle('Processing', Color(0xFFFDF1DD), Color(0xFFA1690C)),
    'FAILED': _PillStyle('Failed', Color(0xFFFBE4E4), AppColors.danger),
    'REVERSED': _PillStyle('Reversed', Color(0xFFFBE4E4), AppColors.danger),
    'REFUNDED': _PillStyle('Refunded', Color(0xFFFDF1DD), Color(0xFFA1690C)),
  };

  @override
  Widget build(BuildContext context) {
    final style = _map[status] ?? _PillStyle(status, const Color(0xFFFDF1DD), const Color(0xFFA1690C));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
      child: Text(style.label, style: TextStyle(color: style.fg, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _PillStyle {
  final String label;
  final Color bg;
  final Color fg;
  const _PillStyle(this.label, this.bg, this.fg);
}
