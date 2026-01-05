'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { useAuthStore, canManageOrders } from '@/lib/auth';

const deliveryStatusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'nouvelle', label: 'Nouvelle' },
  { value: 'en_preparation', label: 'En préparation' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livree', label: 'Livrée' },
  { value: 'annulee', label: 'Annulée' },
];

const paymentStatusOptions = [
  { value: '', label: 'Tous' },
  { value: 'non_payee', label: 'Non payée' },
  { value: 'payee', label: 'Payée' },
];

const priorityOptions = [
  { value: '', label: 'Toutes' },
  { value: 'haute', label: 'Haute' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'basse', label: 'Basse' },
];

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    nouvelle: 'Nouvelle',
    en_preparation: 'En préparation',
    en_cours: 'En cours',
    livree: 'Livrée',
    annulee: 'Annulée',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    nouvelle: 'bg-blue-600 text-white',
    en_preparation: 'bg-yellow-600 text-white',
    en_cours: 'bg-purple-600 text-white',
    livree: 'bg-green-600 text-white',
    annulee: 'bg-red-600 text-white',
  };
  return colors[status] || 'bg-gray-600 text-white';
};

export default function OrdersPage() {
  const { user } = useAuthStore();
  const canEdit = canManageOrders(user);

  const [filters, setFilters] = useState({
    delivery_status: '',
    payment_status: '',
    priority: '',
    search: '',
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => api.getOrders(
      Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      )
    ),
    refetchInterval: 30000, // Poll every 30 seconds as fallback
  });

  const { data: stats } = useQuery({
    queryKey: ['orderStats'],
    queryFn: () => api.getOrderStats(),
  });

  // WebSocket for real-time updates
  useEffect(() => {
    const unsubscribe = wsClient.on('notification', (data) => {
      if (data.type === 'new_order' || data.type === 'order_status') {
        refetch();
      }
    });

    return () => unsubscribe();
  }, [refetch]);

  // Sorting function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort data
  const sortedOrders = React.useMemo(() => {
    const orders = data?.results || [];
    if (!sortConfig) return orders;

    return [...orders].sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data?.results, sortConfig]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commandes</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {data?.count || 0} commande(s) au total
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Nouvelles" value={stats.nouvelle} color="blue" />
          <StatCard label="En préparation" value={stats.en_preparation} color="yellow" />
          <StatCard label="En cours" value={stats.en_cours} color="purple" />
          <StatCard label="Livrées" value={stats.livree} color="green" />
          <StatCard label="Non payées" value={stats.non_payee} color="red" />
          <StatCard label="Haute priorité" value={stats.haute_priorite} color="orange" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={deliveryStatusOptions}
            value={filters.delivery_status}
            onChange={(e) => setFilters({ ...filters, delivery_status: e.target.value })}
          />
          <Select
            options={paymentStatusOptions}
            value={filters.payment_status}
            onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
          />
          <Select
            options={priorityOptions}
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Chargement...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('order_number')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>N° Commande</span>
                      <SortIcon column="order_number" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('client_name')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Client</span>
                      <SortIcon column="client_name" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('delivery_date')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Livraison</span>
                      <SortIcon column="delivery_date" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('priority')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Priorité</span>
                      <SortIcon column="priority" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('total_price')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Total</span>
                      <SortIcon column="total_price" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('delivery_status')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Statut</span>
                      <SortIcon column="delivery_status" sortConfig={sortConfig} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('payment_status')}
                      className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-white"
                    >
                      <span>Paiement</span>
                      <SortIcon column="payment_status" sortConfig={sortConfig} />
                    </button>
                  </th>
                  {canEdit && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedOrders.map((order: any) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{order.order_number}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.items_count || order.items?.length || 0} produit(s)</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{order.client_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.client_phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{new Date(order.delivery_date).toLocaleDateString('fr-FR')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.priority === 'haute'
                          ? 'bg-red-600 text-white'
                          : order.priority === 'moyenne'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-600 text-white'
                      }`}>
                        {order.priority === 'haute' ? 'Haute' : order.priority === 'moyenne' ? 'Moyenne' : 'Basse'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.total_price?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.delivery_status)}`}>
                        {getStatusLabel(order.delivery_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.payment_status === 'payee'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}>
                        {order.payment_status === 'payee' ? 'Payée' : 'Non payée'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => window.location.href = `/orders/${order.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Détails
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucune commande trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/30 text-blue-400 border-blue-600',
    yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-600',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-600',
    green: 'bg-green-900/30 text-green-400 border-green-600',
    red: 'bg-red-900/30 text-red-400 border-red-600',
    orange: 'bg-orange-900/30 text-orange-400 border-orange-600',
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-300">{label}</p>
    </div>
  );
}

function SortIcon({ column, sortConfig }: { column: string; sortConfig: { key: string; direction: 'asc' | 'desc' } | null }) {
  if (!sortConfig || sortConfig.key !== column) {
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  if (sortConfig.direction === 'asc') {
    return (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
