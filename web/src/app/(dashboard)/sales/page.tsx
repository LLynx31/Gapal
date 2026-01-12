'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore, canManageSales } from '@/lib/auth';
import type { Product, Sale, SaleCreateItem, SalePaymentMethod, ReceiptData } from '@/types';

const paymentMethodOptions = [
  { value: '', label: 'Tous' },
  { value: 'especes', label: 'Especes' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'carte', label: 'Carte Bancaire' },
  { value: 'credit', label: 'Credit' },
];

const paymentStatusOptions = [
  { value: '', label: 'Tous' },
  { value: 'payee', label: 'Payee' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'partielle', label: 'Partielle' },
];

const getPaymentStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    payee: 'bg-green-600 text-white',
    en_attente: 'bg-yellow-600 text-white',
    partielle: 'bg-orange-600 text-white',
  };
  return colors[status] || 'bg-gray-600 text-white';
};

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    especes: 'Especes',
    mobile_money: 'Mobile Money',
    carte: 'Carte Bancaire',
    credit: 'Credit',
  };
  return labels[method] || method;
};

export default function SalesPage() {
  const { user } = useAuthStore();
  const canEdit = canManageSales(user);
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    payment_method: '',
    payment_status: '',
    search: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  // Fetch sales
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales', filters, currentPage, pageSize],
    queryFn: () => {
      const params: Record<string, string> = {
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      };
      return api.getSales(params);
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['saleStats'],
    queryFn: () => api.getSaleStats(),
  });

  const sales = data?.results || [];
  const totalPages = data?.count ? Math.ceil(data.count / pageSize) : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  const handleViewReceipt = async (saleId: number) => {
    try {
      const receipt = await api.getSaleReceipt(saleId);
      setSelectedReceipt(receipt);
      setShowReceiptModal(true);
    } catch (error) {
      console.error('Error fetching receipt:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventes</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {data?.count || 0} vente(s) au total
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewSaleModal(true)}
          disabled={!canEdit}
          title={!canEdit ? "Seul le gestionnaire de commandes peut créer des ventes" : ""}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            canEdit
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 border border-gray-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle Vente
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatCard label="Aujourd'hui" value={stats.today.total} count={stats.today.count} color="blue" />
          <StatCard label="Cette semaine" value={stats.week.total} count={stats.week.count} color="green" />
          <StatCard label="Ce mois" value={stats.month.total} count={stats.month.count} color="purple" />
          <StatCard label="En attente" value={stats.pending.total} count={stats.pending.count} color="orange" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Rechercher (recu, client, telephone)..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={paymentMethodOptions}
            value={filters.payment_method}
            onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
          />
          <Select
            options={paymentStatusOptions}
            value={filters.payment_status}
            onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
          />
        </div>
      </div>

      {/* Sales Table */}
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
                    N Recu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Paiement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sales.map((sale: Sale) => (
                  <tr key={sale.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{sale.receipt_number}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{sale.items_count || 0} article(s)</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{sale.client_name || 'Client anonyme'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{sale.client_phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {sale.total_amount?.toLocaleString('fr-FR')} FCFA
                      </div>
                      {sale.amount_due > 0 && (
                        <div className="text-xs text-red-500">
                          Reste: {sale.amount_due?.toLocaleString('fr-FR')} FCFA
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(sale.payment_status)}`}>
                        {sale.payment_status === 'payee' ? 'Payee' : sale.payment_status === 'en_attente' ? 'En attente' : 'Partielle'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewReceipt(sale.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium mr-3"
                      >
                        Recu
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Aucune vente trouvee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && data?.count && data.count > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={data.count}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* New Sale Modal */}
      {showNewSaleModal && (
        <NewSaleModal
          onClose={() => setShowNewSaleModal(false)}
          onSuccess={() => {
            setShowNewSaleModal(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['saleStats'] });
          }}
        />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/30 text-blue-400 border-blue-600',
    green: 'bg-green-900/30 text-green-400 border-green-600',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-600',
    orange: 'bg-orange-900/30 text-orange-400 border-orange-600',
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colors[color]}`}>
      <p className="text-xl font-bold">{value?.toLocaleString('fr-FR')} FCFA</p>
      <p className="text-sm text-gray-300">{label}</p>
      <p className="text-xs text-gray-400">{count} vente(s)</p>
    </div>
  );
}

// New Sale Modal Component
function NewSaleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const toast = useToast();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('especes');
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [items, setItems] = useState<Array<{ product: Product; quantity: number; unit_price: number }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showChangeScreen, setShowChangeScreen] = useState(false);
  const [changeToGive, setChangeToGive] = useState(0);

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products-simple'],
    queryFn: () => api.getProductsSimple(),
  });

  const products = productsData || [];
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total = subtotal - discount;
  const paidAmount = amountPaid || total;
  const isPaymentInsufficient = paymentMethod === 'especes' && paidAmount < total && amountPaid > 0;
  const changePreview = paidAmount - total;

  const addProduct = (product: Product) => {
    const existing = items.find(item => item.product.id === product.id);
    if (existing) {
      setItems(items.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setItems([...items, { product, quantity: 1, unit_price: product.unit_price }]);
    }
    setSearchQuery('');
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(items.filter(item => item.product.id !== productId));
    } else {
      setItems(items.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const removeItem = (productId: number) => {
    setItems(items.filter(item => item.product.id !== productId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError('Ajoutez au moins un produit');
      return;
    }

    // Pour paiement espèces, vérifier le montant et calculer la monnaie
    const paidAmount = amountPaid || total;
    if (paymentMethod === 'especes' && paidAmount < total) {
      setError('Le montant payé est insuffisant');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const saleItems: SaleCreateItem[] = items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      await api.createSale({
        client_name: clientName || undefined,
        client_phone: clientPhone || undefined,
        payment_method: paymentMethod,
        discount: discount,
        amount_paid: paidAmount,
        items: saleItems,
      });

      // Calculer la monnaie à rendre
      const change = paidAmount - total;
      if (paymentMethod === 'especes' && change > 0) {
        setChangeToGive(change);
        setShowChangeScreen(true);
        toast.success('Vente enregistrée', `Total: ${total.toLocaleString('fr-FR')} FCFA`);
      } else {
        toast.success('Vente enregistrée', `Total: ${total.toLocaleString('fr-FR')} FCFA`);
        onSuccess();
      }
    } catch (err: any) {
      toast.error('Erreur', err.response?.data?.detail || 'Erreur lors de la création de la vente');
      setError(err.response?.data?.detail || 'Erreur lors de la création de la vente');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Écran de confirmation avec monnaie à rendre
  if (showChangeScreen) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="p-8 text-center space-y-6">
            {/* Icône de succès */}
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Vente enregistrée</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Total: {total.toLocaleString('fr-FR')} FCFA</p>
            </div>

            {/* Montant reçu */}
            <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Montant reçu</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {(amountPaid || total).toLocaleString('fr-FR')} FCFA
              </p>
            </div>

            {/* Monnaie à rendre */}
            {changeToGive > 0 && (
              <div className="p-6 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl border-2 border-yellow-400 dark:border-yellow-600">
                <p className="text-lg text-yellow-700 dark:text-yellow-300 font-medium">
                  Rendez la monnaie au client
                </p>
                <p className="text-4xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                  {changeToGive.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            )}

            {changeToGive === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <p className="text-green-700 dark:text-green-300 font-medium">
                  Compte exact - Pas de monnaie à rendre
                </p>
              </div>
            )}

            {/* Bouton de fermeture */}
            <button
              onClick={onSuccess}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nouvelle Vente</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Product selection */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Produits</h3>

              {/* Search */}
              <Input
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {/* Product list */}
              {searchQuery && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">Aucun produit trouve</p>
                  ) : (
                    filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700 flex justify-between items-center"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{product.name}</span>
                        <span className="text-sm text-gray-500">{product.unit_price?.toLocaleString('fr-FR')} FCFA</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected items */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Articles selectionnes</h4>
                {items.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun article</p>
                ) : (
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                          <p className="text-xs text-gray-500">{item.unit_price?.toLocaleString('fr-FR')} FCFA/unite</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800"
                          />
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-8 h-8 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <p className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                          {(item.quantity * item.unit_price).toLocaleString('fr-FR')} FCFA
                        </p>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Client info and payment */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Client et Paiement</h3>

              <div className="space-y-3">
                <Input
                  label="Nom du client (optionnel)"
                  placeholder="Nom du client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <Input
                  label="Telephone (optionnel)"
                  placeholder="Telephone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
                <Select
                  label="Mode de paiement"
                  options={[
                    { value: 'especes', label: 'Especes' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                    { value: 'carte', label: 'Carte Bancaire' },
                    { value: 'credit', label: 'Credit' },
                  ]}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}
                />
                <Input
                  label="Remise (FCFA)"
                  type="number"
                  placeholder="0"
                  value={discount.toString()}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
                <Input
                  label="Montant paye (FCFA)"
                  type="number"
                  placeholder={total.toString()}
                  value={amountPaid.toString()}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Sous-total:</span>
                  <span className="text-gray-900 dark:text-white">{subtotal.toLocaleString('fr-FR')} FCFA</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Remise:</span>
                    <span className="text-red-500">-{discount.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white">Total:</span>
                  <span className="text-gray-900 dark:text-white">{total.toLocaleString('fr-FR')} FCFA</span>
                </div>

                {/* Aperçu monnaie / erreur montant insuffisant */}
                {paymentMethod === 'especes' && amountPaid > 0 && (
                  <>
                    {isPaymentInsufficient ? (
                      <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Montant insuffisant</p>
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">
                          Il manque {Math.abs(changePreview).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    ) : changePreview > 0 ? (
                      <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Monnaie à rendre</p>
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">
                          {changePreview.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Compte exact</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0 || isPaymentInsufficient}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Enregistrement...' : isPaymentInsufficient ? 'Montant insuffisant' : 'Enregistrer la vente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Receipt Modal Component
function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Recu ${receipt.receipt_number}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                width: 80mm;
                margin: 0 auto;
                padding: 10px;
              }
              .header { text-align: center; margin-bottom: 10px; }
              .company-name { font-size: 16px; font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 10px 0; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .item-name { flex: 1; }
              .item-qty { width: 40px; text-align: center; }
              .item-price { width: 80px; text-align: right; }
              .total-row { font-weight: bold; font-size: 14px; }
              .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recu de vente</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={printRef} className="font-mono text-sm space-y-4">
            {/* Company Header */}
            <div className="header text-center">
              <p className="company-name text-lg font-bold">{receipt.company_name}</p>
              <p>{receipt.company_address}</p>
              <p>Tel: {receipt.company_phone}</p>
            </div>

            <div className="divider border-t border-dashed border-gray-400"></div>

            {/* Receipt Info */}
            <div className="space-y-1">
              <p><strong>Recu N:</strong> {receipt.receipt_number}</p>
              <p><strong>Date:</strong> {new Date(receipt.created_at).toLocaleString('fr-FR')}</p>
              <p><strong>Vendeur:</strong> {receipt.created_by_name}</p>
              {receipt.client_name && <p><strong>Client:</strong> {receipt.client_name}</p>}
              {receipt.client_phone && <p><strong>Tel:</strong> {receipt.client_phone}</p>}
            </div>

            <div className="divider border-t border-dashed border-gray-400"></div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex text-xs font-bold">
                <span className="flex-1">Article</span>
                <span className="w-10 text-center">Qte</span>
                <span className="w-20 text-right">P.U.</span>
                <span className="w-20 text-right">Total</span>
              </div>
              {receipt.items.map((item, index) => (
                <div key={index} className="flex text-xs">
                  <span className="flex-1 truncate">{item.product_name}</span>
                  <span className="w-10 text-center">{item.quantity}</span>
                  <span className="w-20 text-right">{item.unit_price.toLocaleString('fr-FR')}</span>
                  <span className="w-20 text-right">{item.subtotal.toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>

            <div className="divider border-t border-dashed border-gray-400"></div>

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span>{receipt.subtotal.toLocaleString('fr-FR')} FCFA</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Remise:</span>
                  <span>-{receipt.discount.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL:</span>
                <span>{receipt.total_amount.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span>Paye:</span>
                <span>{receipt.amount_paid.toLocaleString('fr-FR')} FCFA</span>
              </div>
              {receipt.amount_due > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Reste:</span>
                  <span>{receipt.amount_due.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
            </div>

            <div className="divider border-t border-dashed border-gray-400"></div>

            {/* Footer */}
            <div className="footer text-center text-xs">
              <p>Mode de paiement: {receipt.payment_method_display}</p>
              <p className="mt-2">Merci de votre visite!</p>
              <p>A bientot</p>
            </div>
          </div>
        </div>

        {/* Footer with print button */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}
