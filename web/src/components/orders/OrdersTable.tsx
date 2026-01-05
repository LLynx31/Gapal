'use client';

import { useState } from 'react';
import type { Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';

interface OrdersTableProps {
  orders: Order[];
  onOrderUpdated: () => void;
  canEdit?: boolean;
}

const deliveryStatusOptions = [
  { value: 'nouvelle', label: 'Nouvelle' },
  { value: 'en_preparation', label: 'En préparation' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livree', label: 'Livrée' },
  { value: 'annulee', label: 'Annulée' },
];

const paymentStatusOptions = [
  { value: 'non_payee', label: 'Non payée' },
  { value: 'payee', label: 'Payée' },
];

export function OrdersTable({ orders, onOrderUpdated, canEdit = true }: OrdersTableProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleStatusChange = async (orderId: number, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(orderId, status);
      onOrderUpdated();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePaymentChange = async (orderId: number, status: string) => {
    setUpdatingId(orderId);
    try {
      await api.updatePaymentStatus(orderId, status);
      onOrderUpdated();
    } catch (error) {
      console.error('Error updating payment:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Aucune commande trouvée</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              N° Commande
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Livraison
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Priorité
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Paiement
            </th>
            {canEdit && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                <div className="text-xs text-gray-500">{order.items_count} produit(s)</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{order.client_name}</div>
                <div className="text-xs text-gray-500">{order.client_phone}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{formatDate(order.delivery_date)}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge
                  status={order.priority}
                  type="priority"
                  label={order.priority_display}
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {formatPrice(order.total_price)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {canEdit ? (
                  <Select
                    value={order.delivery_status}
                    options={deliveryStatusOptions}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    disabled={updatingId === order.id}
                    className="text-xs w-32"
                  />
                ) : (
                  <StatusBadge
                    status={order.delivery_status}
                    label={order.delivery_status_display}
                  />
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {canEdit ? (
                  <Select
                    value={order.payment_status}
                    options={paymentStatusOptions}
                    onChange={(e) => handlePaymentChange(order.id, e.target.value)}
                    disabled={updatingId === order.id}
                    className="text-xs w-28"
                  />
                ) : (
                  <StatusBadge
                    status={order.payment_status}
                    type="payment"
                    label={order.payment_status_display}
                  />
                )}
              </td>
              {canEdit && (
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = `/orders/${order.id}`}
                  >
                    Détails
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
