'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan';
  className?: string;
}

// Dark mode only - fond saturé + texte blanc
const variants = {
  default: 'bg-gray-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-600 text-white',
  danger: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  cyan: 'bg-cyan-600 text-white',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
