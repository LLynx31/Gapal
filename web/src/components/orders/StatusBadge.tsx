'use client';

import { cn } from '@/lib/utils';
import { getDeliveryStatusColor, getPaymentStatusColor, getPriorityColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  type?: 'delivery' | 'payment' | 'priority';
  label?: string;
}

export function StatusBadge({ status, type = 'delivery', label }: StatusBadgeProps) {
  const getColor = () => {
    switch (type) {
      case 'payment':
        return getPaymentStatusColor(status);
      case 'priority':
        return getPriorityColor(status);
      default:
        return getDeliveryStatusColor(status);
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getColor()
      )}
    >
      {label || status}
    </span>
  );
}
