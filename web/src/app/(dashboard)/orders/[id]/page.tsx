'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { useAuthStore, canManageOrders } from '@/lib/auth';
import type { Order } from '@/types';

const deliveryStatusFlow: Record<string, string[]> = {
  nouvelle: ['en_preparation', 'annulee'],
  en_preparation: ['en_cours', 'annulee'],
  en_cours: ['livree', 'annulee'],
  livree: [],
  annulee: [],
};

const statusColors: Record<string, 'info' | 'warning' | 'default' | 'success' | 'danger'> = {
  nouvelle: 'info',
  en_preparation: 'warning',
  en_cours: 'default',
  livree: 'success',
  annulee: 'danger',
};

const priorityColors: Record<string, 'danger' | 'warning' | 'default'> = {
  haute: 'danger',
  moyenne: 'warning',
  basse: 'default',
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuthStore();
  const canEdit = canManageOrders(user);
  const orderId = Number(params.id);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrder(orderId),
    enabled: !isNaN(orderId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.updateOrderStatus(orderId, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const messages: Record<string, string> = {
        en_preparation: 'Commande en préparation',
        en_cours: 'Livraison lancée',
        livree: 'Commande livrée',
        annulee: 'Commande annulée',
      };
      toast.success('Statut mis à jour', messages[status] || 'Statut modifié');
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la mise à jour du statut');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (status: string) => api.updatePaymentStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Paiement enregistré', 'La commande a été marquée comme payée');
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la mise à jour du paiement');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Commande non trouvée</h2>
        <p className="text-gray-600 mb-4">La commande demandée n&apos;existe pas.</p>
        <Link href="/orders">
          <Button>Retour aux commandes</Button>
        </Link>
      </div>
    );
  }

  const nextStatuses = deliveryStatusFlow[order.delivery_status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/orders" className="text-gray-500 hover:text-gray-700">
              &larr; Retour
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Commande {order.order_number}
          </h1>
          <p className="text-gray-600">
            Créée le {formatDate(order.created_at)} par {order.created_by_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={statusColors[order.delivery_status]}>
            {order.delivery_status_display}
          </Badge>
          <Badge variant={priorityColors[order.priority]}>
            {order.priority_display}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informations client
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="font-medium">{order.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">
                  <a href={`tel:${order.client_phone}`} className="text-primary-600 hover:underline">
                    {order.client_phone}
                  </a>
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Adresse de livraison</p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date de livraison</p>
                <p className="font-medium">{formatDate(order.delivery_date)}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Articles ({order.items?.length || 0})
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
                      Prix unitaire
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Sous-total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.product_unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPrice(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatPrice(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-lg text-primary-600">
                      {formatPrice(order.total_price)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Payment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Statut & Paiement
            </h2>

            {/* Delivery Status */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Statut de livraison</p>
              <Badge variant={statusColors[order.delivery_status]} className="text-sm">
                {order.delivery_status_display}
              </Badge>

              {nextStatuses.length > 0 && (
                <div className="mt-3 space-y-2">
                  {nextStatuses.map((status) => (
                    <Button
                      key={status}
                      variant={status === 'annulee' ? 'danger' : 'primary'}
                      size="sm"
                      onClick={() => statusMutation.mutate(status)}
                      disabled={!canEdit || statusMutation.isPending}
                      title={!canEdit ? "Seul le gestionnaire de commandes peut modifier le statut" : ""}
                      className="w-full"
                    >
                      {status === 'en_preparation' && 'Passer en préparation'}
                      {status === 'en_cours' && 'Lancer la livraison'}
                      {status === 'livree' && 'Marquer comme livrée'}
                      {status === 'annulee' && 'Annuler la commande'}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Status */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Statut de paiement</p>
              <Badge variant={order.payment_status === 'payee' ? 'success' : 'danger'}>
                {order.payment_status_display}
              </Badge>

              {order.payment_status === 'non_payee' && (
                <div className="mt-3">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => paymentMutation.mutate('payee')}
                    disabled={!canEdit || paymentMutation.isPending}
                    title={!canEdit ? "Seul le gestionnaire de commandes peut modifier le paiement" : ""}
                    className="w-full"
                  >
                    Marquer comme payée
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informations
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Numéro</dt>
                <dd className="font-mono text-sm">{order.order_number}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Créée le</dt>
                <dd className="text-sm">{formatDate(order.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Mise à jour</dt>
                <dd className="text-sm">{formatDate(order.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Créée par</dt>
                <dd className="text-sm">{order.created_by_name}</dd>
              </div>
              {order.synced_at && (
                <div>
                  <dt className="text-sm text-gray-500">Synchronisée</dt>
                  <dd className="text-sm">{formatDate(order.synced_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
