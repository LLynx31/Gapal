'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { SkeletonStats, SkeletonCard } from '@/components/ui/Skeleton';
import { DonutChart, BarChart, ChartLegend, ProgressRing } from '@/components/charts/SimpleChart';
import Link from 'next/link';

interface DashboardStats {
  orders: {
    total: number;
    nouvelle: number;
    en_preparation: number;
    en_cours: number;
    livree: number;
    non_payee: number;
    haute_priorite: number;
    today: number;
    revenue_today: number;
    revenue_month: number;
  };
  stock: {
    total_products: number;
    low_stock: number;
    expiring_soon: number;
    total_value: number;
  };
  recent_orders: Array<{
    id: number;
    order_number: string;
    client_name: string;
    total_price: number;
    delivery_status: string;
    payment_status: string;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: orderStats, isLoading: loadingOrders } = useQuery({
    queryKey: ['orderStats'],
    queryFn: () => api.getOrderStats(),
  });

  const { data: stockStats, isLoading: loadingStock } = useQuery({
    queryKey: ['stockStats'],
    queryFn: async () => {
      const [products, lowStock] = await Promise.all([
        api.getProducts(),
        api.getLowStockProducts(),
      ]);
      const productsList = Array.isArray(products) ? products : (products as any)?.results || [];
      const lowStockList = Array.isArray(lowStock) ? lowStock : (lowStock as any)?.results || [];

      return {
        total_products: productsList.length,
        low_stock: lowStockList.length,
        expiring_soon: productsList.filter((p: any) => {
          if (!p.expiration_date) return false;
          const expDate = new Date(p.expiration_date);
          const today = new Date();
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7 && diffDays >= 0;
        }).length,
        total_value: productsList.reduce((sum: number, p: any) => sum + (p.unit_price * p.stock_quantity), 0),
      };
    },
  });

  const { data: recentOrders, isLoading: loadingRecent } = useQuery({
    queryKey: ['recentOrders'],
    queryFn: async () => {
      const response = await api.getOrders({ page_size: '5' });
      return response?.results || [];
    },
  });

  const isLoading = loadingOrders || loadingStock || loadingRecent;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // DashStack style - Light: fond pastel + texte foncé | Dark: fond saturé + texte blanc
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      nouvelle: 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white',
      en_preparation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-white',
      en_cours: 'bg-purple-100 text-purple-700 dark:bg-purple-600 dark:text-white',
      livree: 'bg-green-100 text-green-700 dark:bg-green-600 dark:text-white',
      annulee: 'bg-red-100 text-red-700 dark:bg-red-600 dark:text-white',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-white';
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

  // Prepare chart data - DashStack palette (blue, violet, cyan, green)
  const orderStatusChartData = [
    { label: 'Nouvelles', value: orderStats?.nouvelle || 0, color: '#3b82f6' }, // Blue
    { label: 'En prép.', value: orderStats?.en_preparation || 0, color: '#8b5cf6' }, // Violet
    { label: 'En cours', value: orderStats?.en_cours || 0, color: '#06b6d4' }, // Cyan
    { label: 'Livrées', value: orderStats?.livree || 0, color: '#22c55e' }, // Green
  ];

  const deliveryRate = orderStats?.total ? Math.round((orderStats.livree / orderStats.total) * 100) : 0;
  const paymentRate = orderStats?.total && orderStats.non_payee !== undefined
    ? Math.round(((orderStats.total - orderStats.non_payee) / orderStats.total) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
          <p className="text-gray-600 dark:text-gray-400">Bienvenue, {user?.first_name || user?.username}</p>
        </div>
        <SkeletonStats count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Vue d'ensemble de votre activité
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commandes du jour - DashStack blue */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Commandes du jour</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{orderStats?.today || 0}</p>
            </div>
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">{orderStats?.nouvelle || 0}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">nouvelles à traiter</span>
          </div>
        </div>

        {/* Chiffre d'affaires - Keep Gapal orange for revenue (brand) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 card-hover">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CA du mois</p>
              <p className="text-4xl font-bold text-[#FF9800] dark:text-[#FFB74D] mt-2 truncate">
                {formatCurrency(orderStats?.revenue_month || 0)}
              </p>
            </div>
            <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center shrink-0 ml-2">
              <svg className="w-7 h-7 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">Aujourd'hui:</span>
            <span className="text-green-600 dark:text-green-400 font-medium ml-1">{formatCurrency(orderStats?.revenue_today || 0)}</span>
          </div>
        </div>

        {/* Produits - DashStack purple */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Produits en stock</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{stockStats?.total_products || 0}</p>
            </div>
            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">Valeur totale:</span>
            <span className="text-purple-600 dark:text-purple-400 font-medium ml-1">{formatCurrency(stockStats?.total_value || 0)}</span>
          </div>
        </div>

        {/* Alertes - Keep red */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 card-hover">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alertes</p>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
                {(stockStats?.low_stock || 0) + (stockStats?.expiring_soon || 0) + (orderStats?.non_payee || 0)}
              </p>
            </div>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {(stockStats?.low_stock || 0) > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">{stockStats?.low_stock} produit(s) en stock bas</p>
            )}
            {(stockStats?.expiring_soon || 0) > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400">{stockStats?.expiring_soon} produit(s) expirant bientôt</p>
            )}
            {(orderStats?.non_payee || 0) > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">{orderStats?.non_payee} commande(s) non payée(s)</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Distribution Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Répartition des commandes</h2>
          <div className="flex flex-col items-center">
            <DonutChart data={orderStatusChartData} size={180} strokeWidth={25} />
            <ChartLegend
              className="mt-4"
              items={orderStatusChartData.map((d) => ({
                label: d.label,
                color: d.color,
                value: d.value,
              }))}
            />
          </div>
        </div>

        {/* Bar Chart - Orders by Status */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Commandes par statut</h2>
          <BarChart data={orderStatusChartData} height={200} />
        </div>

        {/* Performance Rings */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance</h2>
          <div className="flex justify-around items-center h-[180px]">
            <ProgressRing
              value={deliveryRate}
              size={100}
              strokeWidth={10}
              color="#22c55e"
              label="Livraison"
            />
            <ProgressRing
              value={paymentRate}
              size={100}
              strokeWidth={10}
              color="#3b82f6"
              label="Paiement"
            />
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Overview */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">État des commandes</h2>
            <Link
              href="/orders"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Voir tout
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatusCard
              label="Nouvelles"
              count={orderStats?.nouvelle || 0}
              color="blue"
              href="/orders?delivery_status=nouvelle"
            />
            <StatusCard
              label="En préparation"
              count={orderStats?.en_preparation || 0}
              color="yellow"
              href="/orders?delivery_status=en_preparation"
            />
            <StatusCard
              label="En cours"
              count={orderStats?.en_cours || 0}
              color="purple"
              href="/orders?delivery_status=en_cours"
            />
            <StatusCard
              label="Livrées"
              count={orderStats?.livree || 0}
              color="green"
              href="/orders?delivery_status=livree"
            />
            <StatusCard
              label="Haute priorité"
              count={orderStats?.haute_priorite || 0}
              color="red"
              href="/orders?priority=haute"
            />
          </div>

          {/* Progress bars */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Taux de livraison</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {deliveryRate}%
                </span>
              </div>
              <div className="progress-bar dark:bg-gray-700">
                <div
                  className="progress-bar-fill bg-green-500"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Taux de paiement</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {paymentRate}%
                </span>
              </div>
              <div className="progress-bar dark:bg-slate-700">
                <div
                  className="progress-bar-fill bg-blue-500"
                  style={{ width: `${paymentRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <Link
              href="/orders"
              className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="ml-3 font-medium text-gray-900 dark:text-white">Gérer les commandes</span>
            </Link>
            <Link
              href="/stock"
              className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors group"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="ml-3 font-medium text-gray-900 dark:text-white">Voir les stocks</span>
            </Link>
            <Link
              href="/stock/products"
              className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="ml-3 font-medium text-gray-900 dark:text-white">Ajouter un produit</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dernières commandes</h2>
            <Link
              href="/orders"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Voir tout
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {recentOrders?.map((order: any) => (
                <tr key={order.id} className="table-row-hover">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    >
                      #{order.order_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{order.client_name}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucune commande récente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  count,
  color,
  href
}: {
  label: string;
  count: number;
  color: string;
  href: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/50',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50',
  };

  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 text-center transition-all ${colors[color]} cursor-pointer`}
    >
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs mt-1">{label}</p>
    </Link>
  );
}
