'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore, canManageStock } from '@/lib/auth';
import Link from 'next/link';
import type { Product } from '@/types';

export default function StockPage() {
  const { user } = useAuthStore();
  const canEdit = canManageStock(user);
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDestockModal, setShowDestockModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['stockAlerts'],
    queryFn: () => api.getStockAlerts(),
  });

  const { data: movements, isLoading, refetch: refetchMovements } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => api.getStockMovements(),
  });

  // Fetch all products for the restock section
  const { data: allProductsData } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => api.getProducts({ page_size: '1000' }),
  });

  // Sort products: out of stock first, then low stock, then others (sorted by stock level)
  const sortedProducts = useMemo(() => {
    const products = allProductsData?.results || [];
    return [...products].sort((a, b) => {
      // Priority 1: Out of stock
      if (a.is_out_of_stock && !b.is_out_of_stock) return -1;
      if (!a.is_out_of_stock && b.is_out_of_stock) return 1;

      // Priority 2: Low stock
      if (a.is_low_stock && !b.is_low_stock) return -1;
      if (!a.is_low_stock && b.is_low_stock) return 1;

      // Priority 3: Sort by stock quantity (lowest first)
      return a.stock_quantity - b.stock_quantity;
    });
  }, [allProductsData]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return sortedProducts;
    const search = productSearch.toLowerCase();
    return sortedProducts.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.category_name?.toLowerCase().includes(search) ||
      p.barcode?.includes(search)
    );
  }, [sortedProducts, productSearch]);

  const handleRestock = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleDestock = (product: Product) => {
    setSelectedProduct(product);
    setShowDestockModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowDestockModal(false);
    setSelectedProduct(null);
  };

  const handleSuccess = () => {
    refetchAlerts();
    refetchMovements();
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['allProducts'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Stocks</h1>
          <p className="text-gray-600">Vue d&apos;ensemble des stocks et alertes</p>
        </div>
        <div className="space-x-2">
          <Link href="/stock/products">
            <Button variant="secondary">Gérer les produits</Button>
          </Link>
        </div>
      </div>

      {/* Alert Cards */}
      {alerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AlertCard
            title="Stock bas"
            count={alerts.counts.low_stock}
            color="yellow"
            icon="⚠️"
          />
          <AlertCard
            title="Rupture de stock"
            count={alerts.counts.out_of_stock}
            color="red"
            icon="🚫"
          />
          <AlertCard
            title="Péremption proche"
            count={alerts.counts.expiring}
            color="orange"
            icon="📅"
          />
        </div>
      )}

      {/* Destocking Section - Expired Products */}
      {alerts && alerts.expiring && alerts.expiring.length > 0 && (
        <div className="bg-white rounded-lg shadow border-l-4 border-orange-500">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-orange-500">⚠️</span>
                  Produits a destocker
                </h2>
                <p className="text-sm text-gray-500">
                  Produits expires ou arrivant a expiration dans les 7 prochains jours
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock actuel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date expiration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.expiring.map((product) => {
                  const isExpired = product.is_expired;
                  return (
                    <tr key={product.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.barcode && (
                          <div className="text-xs text-gray-500">{product.barcode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {product.stock_quantity} {product.unit_display}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${isExpired ? 'text-red-500' : 'text-orange-500'}`}>
                          {product.expiration_date ? formatDate(product.expiration_date) : '-'}
                        </span>
                        {product.days_until_expiration != null && (
                          <div className="text-xs text-gray-500">
                            {product.days_until_expiration <= 0
                              ? 'Expire'
                              : `Dans ${product.days_until_expiration} jour(s)`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={isExpired ? 'danger' : 'warning'}>
                          {isExpired ? 'Expire' : 'Bientot expire'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDestock(product)}
                          disabled={!canEdit || product.stock_quantity <= 0}
                          title={!canEdit ? "Seul le gestionnaire de stocks peut destocker" : ""}
                        >
                          Destocker
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Products Section */}
      <div className="bg-white rounded-lg shadow border-l-4 border-blue-500">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Reapprovisionnement
              </h2>
              <p className="text-sm text-gray-500">
                Les produits en rupture et stock bas sont affiches en priorite
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              />
              <Button
                variant={showAllProducts ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowAllProducts(!showAllProducts)}
              >
                {showAllProducts ? 'Afficher prioritaires' : 'Voir tous les produits'}
              </Button>
            </div>
          </div>
        </div>

        {/* Products needing attention (low stock / out of stock) */}
        {!showAllProducts && alerts && (alerts.low_stock.length > 0 || alerts.out_of_stock.length > 0) && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock actuel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Seuil minimum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.low_stock
                  .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .map((product) => (
                  <tr key={product.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      {product.barcode && (
                        <div className="text-xs text-gray-500">{product.barcode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-bold ${product.is_out_of_stock ? 'text-red-500' : 'text-yellow-500'}`}>
                        {product.stock_quantity} {product.unit_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.min_stock_level} {product.unit_display}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={product.is_out_of_stock ? 'danger' : 'warning'}>
                        {product.is_out_of_stock ? 'Rupture' : 'Stock bas'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRestock(product)}
                        disabled={!canEdit}
                        title={!canEdit ? "Seul le gestionnaire de stocks peut reapprovisionner" : ""}
                      >
                        Reapprovisionner
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Show message if no low stock when in priority mode */}
        {!showAllProducts && alerts && alerts.low_stock.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-green-500 text-4xl mb-2">✓</div>
            <p className="text-gray-600">Tous les produits ont un stock suffisant</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setShowAllProducts(true)}
            >
              Voir tous les produits pour reapprovisionner
            </Button>
          </div>
        )}

        {/* All products view */}
        {showAllProducts && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock actuel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Seuil minimum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      {product.barcode && (
                        <div className="text-xs text-gray-500">{product.barcode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-bold ${
                        product.is_out_of_stock
                          ? 'text-red-500'
                          : product.is_low_stock
                            ? 'text-yellow-500'
                            : 'text-green-500'
                      }`}>
                        {product.stock_quantity} {product.unit_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.min_stock_level} {product.unit_display}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.is_out_of_stock ? (
                        <Badge variant="danger">Rupture</Badge>
                      ) : product.is_low_stock ? (
                        <Badge variant="warning">Stock bas</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        variant={product.is_out_of_stock || product.is_low_stock ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleRestock(product)}
                        disabled={!canEdit}
                        title={!canEdit ? "Seul le gestionnaire de stocks peut reapprovisionner" : ""}
                      >
                        Reapprovisionner
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Aucun produit trouve
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Movements */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Mouvements récents
          </h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        ) : movements?.results?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Raison
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Par
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movements.results.slice(0, 10).map((movement) => (
                  <tr key={movement.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(movement.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {movement.product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          movement.movement_type === 'entree'
                            ? 'success'
                            : movement.movement_type === 'sortie'
                            ? 'danger'
                            : 'info'
                        }
                      >
                        {movement.movement_type_display}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={
                          movement.quantity > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {movement.quantity > 0 ? '+' : ''}
                        {movement.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {movement.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {movement.user_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucun mouvement récent
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {showModal && selectedProduct && (
        <RestockModal
          product={selectedProduct}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Destock Modal */}
      {showDestockModal && selectedProduct && (
        <DestockModal
          product={selectedProduct}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function AlertCard({
  title,
  count,
  color,
  icon,
}: {
  title: string;
  count: number;
  color: string;
  icon: string;
}) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-900/30 border-yellow-600 text-yellow-400',
    red: 'bg-red-900/30 border-red-600 text-red-400',
    orange: 'bg-orange-900/30 border-orange-600 text-orange-400',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold">{count}</p>
          <p className="text-sm text-gray-300">{title}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

function RestockModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Réapprovisionnement');
  // Extract YYYY-MM-DD from expiration_date (may be ISO format with time)
  const initialExpDate = product.expiration_date ? product.expiration_date.split('T')[0] : '';
  const [expirationDate, setExpirationDate] = useState(initialExpDate);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.createStockEntry(product.id, parseInt(quantity), reason, expirationDate && expirationDate.trim() ? expirationDate : undefined),
    onSuccess: () => {
      toast.success('Reapprovisionnement effectue', `${quantity} ${product.unit_display} ajoutes au stock de ${product.name}`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors du reapprovisionnement');
      setError(err.message || 'Erreur lors du réapprovisionnement');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Veuillez entrer une quantité valide');
      return;
    }

    mutation.mutate();
  };

  const suggestedQuantity = Math.max(0, product.min_stock_level * 2 - product.stock_quantity);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50"></div>

        <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              Reapprovisionner
            </h2>
            <p className="text-sm text-gray-300 mt-1">{product.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-900/50 text-red-300 rounded-md text-sm border border-red-700">
                {error}
              </div>
            )}

            {/* Current Stock Info */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Stock actuel</p>
                  <p className="font-semibold text-lg text-white">
                    {product.stock_quantity} {product.unit_display}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Seuil minimum</p>
                  <p className="font-semibold text-lg text-white">
                    {product.min_stock_level} {product.unit_display}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Quantite a ajouter *
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Suggestion: ${suggestedQuantity}`}
                min="1"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {suggestedQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(suggestedQuantity.toString())}
                  className="text-sm text-primary-400 hover:text-primary-300 mt-1"
                >
                  Utiliser la quantite suggeree ({suggestedQuantity})
                </button>
              )}
            </div>

            {/* Expiration Date Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date de peremption (optionnel)
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {product.expiration_date && (
                <p className="text-xs text-gray-400 mt-1">
                  Date actuelle: {formatDate(product.expiration_date)}
                </p>
              )}
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Raison
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Preview */}
            {quantity && parseInt(quantity) > 0 && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-300">
                  Nouveau stock apres reapprovisionnement:{' '}
                  <span className="font-semibold text-green-200">
                    {product.stock_quantity + parseInt(quantity)} {product.unit_display}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <Button type="button" variant="danger" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Enregistrement...' : 'Reapprovisionner'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const DESTOCK_REASONS = [
  { value: 'peremption', label: 'Peremption' },
  { value: 'perte', label: 'Perte' },
  { value: 'deterioration', label: 'Deterioration' },
  { value: 'vol', label: 'Vol' },
  { value: 'autre', label: 'Autre' },
];

function DestockModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(product.stock_quantity.toString());
  const [reasonType, setReasonType] = useState('peremption');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const reason = reasonType === 'autre'
        ? customReason
        : DESTOCK_REASONS.find(r => r.value === reasonType)?.label || reasonType;
      return api.createStockExit(product.id, parseInt(quantity), reason);
    },
    onSuccess: () => {
      toast.success('Destockage effectue', `${quantity} ${product.unit_display} retires du stock de ${product.name}`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors du destockage');
      setError(err.message || 'Erreur lors du destockage');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Veuillez entrer une quantite valide');
      return;
    }

    if (qty > product.stock_quantity) {
      setError(`La quantite ne peut pas depasser le stock actuel (${product.stock_quantity})`);
      return;
    }

    if (reasonType === 'autre' && !customReason.trim()) {
      setError('Veuillez specifier une raison');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50"></div>

        <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-orange-500">⚠️</span>
              Destocker un produit
            </h2>
            <p className="text-sm text-gray-300 mt-1">{product.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-900/50 text-red-300 rounded-md text-sm border border-red-700">
                {error}
              </div>
            )}

            {/* Current Stock Info */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Stock actuel</p>
                  <p className="font-semibold text-lg text-white">
                    {product.stock_quantity} {product.unit_display}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Date expiration</p>
                  <p className={`font-semibold text-lg ${product.is_expired ? 'text-red-400' : 'text-orange-400'}`}>
                    {product.expiration_date ? formatDate(product.expiration_date) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div>
              <label htmlFor="destock-quantity" className="block text-sm font-medium text-gray-300 mb-1">
                Quantite a retirer *
              </label>
              <input
                id="destock-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                max={product.stock_quantity}
                required
                placeholder="Quantite"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setQuantity(product.stock_quantity.toString())}
                className="text-sm text-orange-400 hover:text-orange-300 mt-1"
              >
                Retirer tout le stock ({product.stock_quantity})
              </button>
            </div>

            {/* Reason Selection */}
            <div>
              <label htmlFor="destock-reason" className="block text-sm font-medium text-gray-300 mb-1">
                Raison du destockage *
              </label>
              <select
                id="destock-reason"
                value={reasonType}
                onChange={(e) => setReasonType(e.target.value)}
                title="Raison du destockage"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {DESTOCK_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Reason Input */}
            {reasonType === 'autre' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Specifier la raison *
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Raison du destockage..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Preview */}
            {quantity && parseInt(quantity) > 0 && parseInt(quantity) <= product.stock_quantity && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">
                  Stock apres destockage:{' '}
                  <span className="font-semibold text-red-200">
                    {product.stock_quantity - parseInt(quantity)} {product.unit_display}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <Button type="button" variant="danger" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Enregistrement...' : 'Confirmer le destockage'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
