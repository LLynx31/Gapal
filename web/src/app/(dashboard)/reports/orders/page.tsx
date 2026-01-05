'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface OrderReportFilters {
  start_date?: string;
  end_date?: string;
  delivery_status?: string;
  payment_status?: string;
  priority?: string;
}

export default function OrderReportsPage() {
  const { success, error: showError } = useToast();
  const [filters, setFilters] = useState<OrderReportFilters>({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['order-reports', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.delivery_status) params.delivery_status = filters.delivery_status;
      if (filters.payment_status) params.payment_status = filters.payment_status;
      if (filters.priority) params.priority = filters.priority;

      const response = await api.getOrders(params);
      return (response as any)?.results || response || [];
    },
  });

  const handleExportCSV = () => {
    if (!orders || orders.length === 0) {
      showError('Aucune donnée à exporter');
      return;
    }

    const headers = ['N° Commande', 'Client', 'Téléphone', 'Adresse', 'Date livraison', 'Prix total', 'Statut livraison', 'Statut paiement', 'Priorité', 'Date création'];
    const rows = orders.map((order: any) => [
      order.order_number || '-',
      order.client_name,
      order.client_phone,
      order.delivery_address,
      new Date(order.delivery_date).toLocaleDateString('fr-FR'),
      order.total_price,
      order.delivery_status,
      order.payment_status,
      order.priority,
      new Date(order.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport-commandes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    success('Rapport exporté avec succès');
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.delivery_status) params.append('delivery_status', filters.delivery_status);
      if (filters.payment_status) params.append('payment_status', filters.payment_status);
      if (filters.priority) params.append('priority', filters.priority);

      // This endpoint should be implemented in the backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/orders/pdf/?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rapport-commandes-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      success('Rapport PDF exporté avec succès');
    } catch (err) {
      showError('Erreur lors de l\'export PDF');
    }
  };

  const stats = orders ? {
    total: orders.length,
    totalRevenue: orders.reduce((sum: number, o: any) => sum + o.total_price, 0),
    delivered: orders.filter((o: any) => o.delivery_status === 'livree').length,
    paid: orders.filter((o: any) => o.payment_status === 'payee').length,
    unpaid: orders.filter((o: any) => o.payment_status === 'non_payee').length,
    cancelled: orders.filter((o: any) => o.delivery_status === 'annulee').length,
  } : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
    if (!orders || !sortConfig) return orders || [];

    return [...orders].sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [orders, sortConfig]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapports - Commandes</h1>
          <p className="text-gray-600 dark:text-gray-400">Analyse des commandes par période</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!orders || orders.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!orders || orders.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtres</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date début
            </label>
            <input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date fin
            </label>
            <input
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Statut livraison
            </label>
            <select
              value={filters.delivery_status || ''}
              onChange={(e) => setFilters({ ...filters, delivery_status: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tous</option>
              <option value="nouvelle">Nouvelle</option>
              <option value="en_preparation">En préparation</option>
              <option value="en_cours">En cours</option>
              <option value="livree">Livrée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Statut paiement
            </label>
            <select
              value={filters.payment_status || ''}
              onChange={(e) => setFilters({ ...filters, payment_status: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tous</option>
              <option value="payee">Payée</option>
              <option value="non_payee">Non payée</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priorité
            </label>
            <select
              value={filters.priority || ''}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Toutes</option>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total commandes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Livrées</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Payées</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.paid}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Non payées</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.unpaid}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Annulées</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.cancelled}</p>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Détail des commandes ({orders?.length || 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <SkeletonTable rows={5} cols={8} />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedOrders.map((order: any) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{order.order_number}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.items?.length || 0} produit(s)</div>
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
                        {formatCurrency(order.total_price)}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => window.location.href = `/orders/${order.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {(!sortedOrders || sortedOrders.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucune commande trouvée pour cette période
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
