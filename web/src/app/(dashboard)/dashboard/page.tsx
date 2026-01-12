'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { useAuthStore } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { SkeletonStats, SkeletonCard } from '@/components/ui/Skeleton';
import { DonutChart, BarChart, LineChart, ChartLegend, ProgressRing, Sparkline } from '@/components/charts/SimpleChart';
import Link from 'next/link';
import type { OrderStats, SaleStats } from '@/types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: orderStats, isLoading: loadingOrders } = useQuery<OrderStats>({
    queryKey: ['orderStats'],
    queryFn: () => api.getOrderStats(),
  });

  const { data: saleStats, isLoading: loadingSales } = useQuery<SaleStats>({
    queryKey: ['saleStats'],
    queryFn: () => api.getSaleStats(),
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

  // WebSocket for real-time updates
  useEffect(() => {
    const unsubscribe = wsClient.on('notification', (data) => {
      if (data.type === 'new_order') {
        toast.info(
          'Nouvelle commande',
          data.message || `Commande ${data.order_number || ''} reçue`
        );
        queryClient.invalidateQueries({ queryKey: ['orderStats'] });
        queryClient.invalidateQueries({ queryKey: ['recentOrders'] });
      } else if (data.type === 'low_stock') {
        toast.warning(
          'Stock bas',
          data.message || `${data.product_name} est en stock bas`
        );
        queryClient.invalidateQueries({ queryKey: ['stockStats'] });
      }
    });

    return () => unsubscribe();
  }, [toast, queryClient]);

  const isLoading = loadingOrders || loadingStock || loadingRecent || loadingSales;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calcul du CA total (commandes + ventes boutique)
  const totalRevenueMonth = (orderStats?.revenue_month || 0) + (saleStats?.month?.total || 0);
  const totalRevenueToday = (orderStats?.revenue_today || 0) + (saleStats?.today?.total || 0);

  // Combiner les données de revenus (commandes + ventes) pour le sparkline
  const combinedRevenueData = orderStats?.daily_revenue?.map((orderDay, index) => {
    const saleDay = saleStats?.daily_sales?.[index];
    return orderDay.value + (saleDay?.value || 0);
  }) || [];

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

  // Prepare chart data
  const orderStatusChartData = [
    { label: 'Nouvelles', value: orderStats?.nouvelle || 0, color: '#3b82f6' },
    { label: 'En prép.', value: orderStats?.en_preparation || 0, color: '#8b5cf6' },
    { label: 'En cours', value: orderStats?.en_cours || 0, color: '#06b6d4' },
    { label: 'Livrées', value: orderStats?.livree || 0, color: '#22c55e' },
  ];

  const deliveryRate = orderStats?.total ? Math.round((orderStats.livree / orderStats.total) * 100) : 0;
  const paymentRate = orderStats?.total && orderStats.non_payee !== undefined
    ? Math.round(((orderStats.total - orderStats.non_payee) / orderStats.total) * 100)
    : 0;

  // Calculate trends - utiliser les données combinées pour le CA
  const ordersSparklineData = orderStats?.daily_orders?.map(d => d.value) || [];
  const salesSparklineData = saleStats?.daily_sales?.map(d => d.value) || [];

  const calculateTrend = (data: number[]) => {
    if (data.length < 2) return 0;
    const lastDay = data[data.length - 1] || 0;
    const prevDay = data[data.length - 2] || 0;
    if (prevDay === 0) return lastDay > 0 ? 100 : 0;
    return Math.round(((lastDay - prevDay) / prevDay) * 100);
  };

  const revenueTrend = calculateTrend(combinedRevenueData);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Vue d'ensemble de votre activité
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Mise à jour en temps réel
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chiffre d'affaires du mois */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {combinedRevenueData.length > 1 && (
              <Sparkline data={combinedRevenueData} width={60} height={30} color="rgba(255,255,255,0.8)" />
            )}
          </div>
          <p className="text-white/80 text-sm font-medium">CA du mois</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalRevenueMonth)}</p>
          <div className="mt-3 flex items-center text-sm">
            <span className={`flex items-center ${revenueTrend >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {revenueTrend >= 0 ? (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {Math.abs(revenueTrend)}%
            </span>
            <span className="text-white/60 ml-2">vs hier</span>
          </div>
        </div>

        {/* Commandes du jour */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            {ordersSparklineData.length > 1 && (
              <Sparkline data={ordersSparklineData} width={60} height={30} color="#3b82f6" />
            )}
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Commandes du jour</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{orderStats?.today || 0}</p>
          <div className="mt-3 flex items-center text-sm">
            <span className="text-blue-600 dark:text-blue-400 font-medium">{orderStats?.nouvelle || 0} nouvelles</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-yellow-600 dark:text-yellow-400">{orderStats?.en_preparation || 0} en prép.</span>
          </div>
        </div>

        {/* Ventes du jour */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            {salesSparklineData.length > 1 && (
              <Sparkline data={salesSparklineData} width={60} height={30} color="#22c55e" />
            )}
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ventes du jour</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(saleStats?.today?.total || 0)}</p>
          <div className="mt-3 flex items-center text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">{saleStats?.today?.count || 0} ventes</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-purple-600 dark:text-purple-400">Semaine: {formatCurrency(saleStats?.week?.total || 0)}</span>
          </div>
        </div>

        {/* Alertes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              (stockStats?.low_stock || 0) + (stockStats?.expiring_soon || 0) + (orderStats?.non_payee || 0) > 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              {(stockStats?.low_stock || 0) + (stockStats?.expiring_soon || 0) + (orderStats?.non_payee || 0) > 0 ? 'Attention' : 'OK'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alertes</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {(stockStats?.low_stock || 0) + (stockStats?.expiring_soon || 0) + (orderStats?.non_payee || 0)}
          </p>
          <div className="mt-3 space-y-1 text-xs">
            {(stockStats?.low_stock || 0) > 0 && (
              <p className="text-red-600 dark:text-red-400">{stockStats?.low_stock} stock bas</p>
            )}
            {(orderStats?.non_payee || 0) > 0 && (
              <p className="text-yellow-600 dark:text-yellow-400">{orderStats?.non_payee} impayée(s)</p>
            )}
            {(stockStats?.expiring_soon || 0) > 0 && (
              <p className="text-orange-600 dark:text-orange-400">{stockStats?.expiring_soon} expire bientôt</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Évolution du CA</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">7 derniers jours (Commandes + Ventes)</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenueToday)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Aujourd'hui</p>
            </div>
          </div>
          <LineChart
            data={(orderStats?.daily_revenue || []).map((day, index) => ({
              ...day,
              value: day.value + (saleStats?.daily_sales?.[index]?.value || 0)
            }))}
            height={200}
            color="#f97316"
            showDots={true}
            showArea={true}
          />
        </div>

        {/* Orders Trend Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Commandes reçues</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">7 derniers jours</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{orderStats?.today || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Aujourd'hui</p>
            </div>
          </div>
          <LineChart
            data={orderStats?.daily_orders || []}
            height={200}
            color="#3b82f6"
            showDots={true}
            showArea={true}
          />
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Distribution Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Répartition des commandes</h2>
          <div className="flex flex-col items-center">
            <DonutChart data={orderStatusChartData} size={160} strokeWidth={25} />
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
          <div className="flex justify-around items-center h-[160px]">
            <ProgressRing
              value={deliveryRate}
              size={90}
              strokeWidth={10}
              color="#22c55e"
              label="Livraison"
            />
            <ProgressRing
              value={paymentRate}
              size={90}
              strokeWidth={10}
              color="#3b82f6"
              label="Paiement"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{orderStats?.livree || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Livrées</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{orderStats?.payee || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Overview and Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Overview */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">État des commandes</h2>
            <Link
              href="/orders"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Voir tout →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatusCard
              label="Nouvelles"
              count={orderStats?.nouvelle || 0}
              color="blue"
              href="/orders?delivery_status=nouvelle"
            />
            <StatusCard
              label="En prép."
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
              label="Priorité haute"
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
                <span className="font-medium text-gray-900 dark:text-white">{deliveryRate}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Taux de paiement</span>
                <span className="font-medium text-gray-900 dark:text-white">{paymentRate}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
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
              href="/sales"
              className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="ml-3 font-medium text-gray-900 dark:text-white">Nouvelle vente</span>
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
              className="flex items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors group"
            >
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
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
              Voir tout →
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
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
      className={`rounded-xl border p-4 text-center transition-all ${colors[color]} cursor-pointer hover:shadow-md`}
    >
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs mt-1 font-medium">{label}</p>
    </Link>
  );
}
