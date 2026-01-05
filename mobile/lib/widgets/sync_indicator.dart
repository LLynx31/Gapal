import 'package:flutter/material.dart';

/// Sync status indicator widget
class SyncIndicator extends StatelessWidget {
  final int pendingCount;
  final bool isOnline;
  final VoidCallback? onSync;

  const SyncIndicator({
    super.key,
    required this.pendingCount,
    required this.isOnline,
    this.onSync,
  });

  @override
  Widget build(BuildContext context) {
    if (pendingCount == 0) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isOnline ? Colors.orange.shade100 : Colors.red.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isOnline ? Icons.sync : Icons.cloud_off,
            size: 16,
            color: isOnline ? Colors.orange.shade700 : Colors.red.shade700,
          ),
          const SizedBox(width: 4),
          Text(
            '$pendingCount en attente',
            style: TextStyle(
              fontSize: 12,
              color: isOnline ? Colors.orange.shade700 : Colors.red.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (isOnline && onSync != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onSync,
              child: Icon(
                Icons.refresh,
                size: 16,
                color: Colors.orange.shade700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
