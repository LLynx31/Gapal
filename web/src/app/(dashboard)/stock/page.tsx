'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Product } from '@/types';

export default function StockPage() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['stockAlerts'],
    queryFn: () => api.getStockAlerts(),
  });

  const { data: movements, isLoading, refetch: refetchMovements } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => api.getStockMovements(),
  });

  const handleRestock = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  const handleSuccess = () => {
    refetchAlerts();
    refetchMovements();
    queryClient.invalidateQueries({ queryKey: ['products'] });
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

      {/* Low Stock Products */}
      {alerts && alerts.low_stock.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Produits en stock bas
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock actuel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Seuil minimum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.low_stock.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={product.is_out_of_stock ? 'danger' : 'warning'}>
                        {product.stock_quantity} {product.unit_display}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.min_stock_level} {product.unit_display}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestock(product)}
                      >
                        Réapprovisionner
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Réapprovisionnement');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.createStockEntry(product.id, parseInt(quantity), reason),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
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
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Réapprovisionner
            </h2>
            <p className="text-sm text-gray-600 mt-1">{product.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Current Stock Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Stock actuel</p>
                  <p className="font-semibold text-lg">
                    {product.stock_quantity} {product.unit_display}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Seuil minimum</p>
                  <p className="font-semibold text-lg">
                    {product.min_stock_level} {product.unit_display}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité à ajouter *
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Suggestion: ${suggestedQuantity}`}
                min="1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {suggestedQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(suggestedQuantity.toString())}
                  className="text-sm text-primary-600 hover:text-primary-800 mt-1"
                >
                  Utiliser la quantité suggérée ({suggestedQuantity})
                </button>
              )}
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Preview */}
            {quantity && parseInt(quantity) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Nouveau stock après réapprovisionnement:{' '}
                  <span className="font-semibold">
                    {product.stock_quantity + parseInt(quantity)} {product.unit_display}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Enregistrement...' : 'Réapprovisionner'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
