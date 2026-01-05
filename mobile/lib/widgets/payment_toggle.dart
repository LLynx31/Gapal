import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Payment status toggle button
class PaymentToggle extends StatelessWidget {
  final bool isPaid;
  final ValueChanged<bool> onChanged;

  const PaymentToggle({
    super.key,
    required this.isPaid,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text(
          'Paiement:',
          style: TextStyle(fontWeight: FontWeight.w500),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Row(
            children: [
              _ToggleButton(
                label: 'Non payée',
                isSelected: !isPaid,
                color: AppTheme.unpaid,
                onTap: () => onChanged(false),
              ),
              const SizedBox(width: 8),
              _ToggleButton(
                label: 'Payée',
                isSelected: isPaid,
                color: AppTheme.paid,
                onTap: () => onChanged(true),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ToggleButton extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  const _ToggleButton({
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? color : color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: color,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : color,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
