/**
 * Utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'haute':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'moyenne':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'basse':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getDeliveryStatusColor(status: string): string {
  switch (status) {
    case 'nouvelle':
      return 'bg-blue-100 text-blue-800';
    case 'en_preparation':
      return 'bg-yellow-100 text-yellow-800';
    case 'en_cours':
      return 'bg-purple-100 text-purple-800';
    case 'livree':
      return 'bg-green-100 text-green-800';
    case 'annulee':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'payee':
      return 'bg-green-100 text-green-800';
    case 'non_payee':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
