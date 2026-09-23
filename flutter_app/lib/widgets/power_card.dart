import 'package:flutter/material.dart';

class PowerCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const PowerCard({super.key, required this.child, this.padding = const EdgeInsets.all(18)});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(padding: padding, child: child),
    );
  }
}
