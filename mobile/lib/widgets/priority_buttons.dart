import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../config/constants.dart';

/// Priority selection buttons with colors
class PriorityButtons extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const PriorityButtons({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _PriorityButton(
          label: 'Basse',
          value: Priority.basse,
          color: AppTheme.priorityLow,
          isSelected: selected == Priority.basse,
          onTap: () => onChanged(Priority.basse),
        ),
        const SizedBox(width: 8),
        _PriorityButton(
          label: 'Moyenne',
          value: Priority.moyenne,
          color: AppTheme.priorityMedium,
          isSelected: selected == Priority.moyenne,
          onTap: () => onChanged(Priority.moyenne),
        ),
        const SizedBox(width: 8),
        _PriorityButton(
          label: 'Haute',
          value: Priority.haute,
          color: AppTheme.priorityHigh,
          isSelected: selected == Priority.haute,
          onTap: () => onChanged(Priority.haute),
        ),
      ],
    );
  }
}

class _PriorityButton extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _PriorityButton({
    required this.label,
    required this.value,
    required this.color,
    required this.isSelected,
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
