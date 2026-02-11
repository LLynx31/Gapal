'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore, canManageStock } from '@/lib/auth';
import Link from 'next/link';
import type { Product, Category, ProductUnit } from '@/types';

export default function ProductsPage() {
  const { user } = useAuthStore();
  const canEdit = canManageStock(user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', searchTerm, categoryFilter, currentPage, pageSize],
    queryFn: () => api.getProducts({
      ...(searchTerm && { search: searchTerm }),
      ...(categoryFilter && { category: categoryFilter }),
      page: currentPage.toString(),
      page_size: pageSize.toString(),
    }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  // Handle both array and paginated response
  const categories = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData as any)?.results || [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit supprimé', 'Le produit a été retiré du catalogue');
    },
    onError: (err: Error) => {
      toast.error('Erreur', err.message || 'Erreur lors de la suppression');
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  // Get products directly from API response (already paginated by backend)
  const productsList = products?.results || [];
  const totalPages = products?.count ? Math.ceil(products.count / pageSize) : 0;

  // Reset to page 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Produits</h1>
          <p className="text-gray-600">Gérez votre catalogue de produits laitiers</p>
        </div>
        <div className="space-x-2">
          <Link href="/stock">
            <Button variant="secondary">Retour aux stocks</Button>
          </Link>
          <Button
            onClick={() => setShowModal(true)}
            disabled={!canEdit}
            title={!canEdit ? "Seul le gestionnaire de stocks peut créer des produits" : ""}
            className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
          >
            + Nouveau produit
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom du produit..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Toutes les catégories</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        ) : products?.results?.length ? (
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
                    Prix unitaire
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Péremption
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productsList.map((product) => (
                  <tr key={product.id} className={`hover:bg-gray-700/50 ${!product.is_active ? 'bg-gray-800/50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.barcode && (
                          <div className="text-xs text-gray-500">
                            Code: {product.barcode}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(product.unit_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        product.is_out_of_stock
                          ? 'text-red-600'
                          : product.is_low_stock
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}>
                        {product.stock_quantity} {product.unit_display}
                      </span>
                      <div className="text-xs text-gray-500">
                        Min: {product.min_stock_level}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {!product.is_active && (
                          <Badge variant="default">Inactif</Badge>
                        )}
                        {product.is_out_of_stock && (
                          <Badge variant="danger">Rupture</Badge>
                        )}
                        {product.is_low_stock && !product.is_out_of_stock && (
                          <Badge variant="warning">Stock bas</Badge>
                        )}
                        {product.is_expired && (
                          <Badge variant="danger">Expiré</Badge>
                        )}
                        {product.is_expiring_soon && !product.is_expired && (
                          <Badge variant="warning">Expire bientôt</Badge>
                        )}
                        {product.is_active && !product.is_out_of_stock && !product.is_low_stock && !product.is_expired && !product.is_expiring_soon && (
                          <Badge variant="success">OK</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.expiration_date ? (
                        <div>
                          <div>{formatDate(product.expiration_date)}</div>
                          {product.days_until_expiration !== null && (
                            <div className={`text-xs ${
                              product.days_until_expiration <= 0
                                ? 'text-red-600'
                                : product.days_until_expiration <= 7
                                  ? 'text-yellow-600'
                                  : 'text-gray-500'
                            }`}>
                              {product.days_until_expiration <= 0
                                ? 'Expiré'
                                : `${product.days_until_expiration}j restants`}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          disabled={!canEdit}
                          title={!canEdit ? "Seul le gestionnaire de stocks peut modifier les produits" : ""}
                          className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          disabled={!canEdit}
                          title={!canEdit ? "Seul le gestionnaire de stocks peut supprimer les produits" : ""}
                          className={`text-red-600 hover:text-red-800 ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {products?.count && products.count > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={products.count}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucun produit trouvé
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories || []}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories: initialCategories,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    unit_price: product?.unit_price?.toString() || '',
    stock_quantity: product?.stock_quantity?.toString() || '',
    category: product?.category?.toString() || '',
    unit: product?.unit || 'unite' as ProductUnit,
    barcode: product?.barcode || '',
    min_stock_level: product?.min_stock_level?.toString() || '10',
    expiration_date: product?.expiration_date || '',
    is_active: product?.is_active ?? true,
  });
  const [error, setError] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Fonction pour créer une nouvelle catégorie
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Erreur', 'Le nom de la catégorie est requis');
      return;
    }

    setIsCreatingCategory(true);
    try {
      const newCategory = await api.createCategory({ name: newCategoryName.trim() });
      setCategories([...categories, newCategory]);
      setFormData({ ...formData, category: newCategory.id.toString() });
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Catégorie créée', `La catégorie "${newCategory.name}" a été créée`);
    } catch (err: any) {
      toast.error('Erreur', err.message || 'Erreur lors de la création de la catégorie');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit créé', 'Le produit a été ajouté au catalogue');
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la création');
      toast.error('Erreur', err.message || 'Erreur lors de la création du produit');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Product>) => api.updateProduct(product!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit mis à jour', 'Les modifications ont été enregistrées');
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la mise à jour');
      toast.error('Erreur', err.message || 'Erreur lors de la mise à jour');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Base data for both create and update
    const baseData = {
      name: formData.name,
      description: formData.description,
      unit_price: parseInt(formData.unit_price),
      category: formData.category ? parseInt(formData.category) : null,
      unit: formData.unit,
      barcode: formData.barcode || null,
      min_stock_level: parseInt(formData.min_stock_level),
      expiration_date: formData.expiration_date || null,
      is_active: formData.is_active,
    };

    if (product) {
      // Update: don't send stock_quantity (managed via stock movements)
      updateMutation.mutate(baseData);
    } else {
      // Create: include initial stock_quantity
      createMutation.mutate({
        ...baseData,
        stock_quantity: parseInt(formData.stock_quantity),
      });
    }
  };

  const units: { value: ProductUnit; label: string }[] = [
    { value: 'litre', label: 'Litre' },
    { value: 'kg', label: 'Kilogramme' },
    { value: 'unite', label: 'Unité' },
    { value: 'sachet', label: 'Sachet' },
    { value: 'pot', label: 'Pot' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50"></div>

        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {product ? 'Modifier le produit' : 'Nouveau produit'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                {showNewCategoryInput ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nom de la nouvelle catégorie"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={isCreatingCategory || !newCategoryName.trim()}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingCategory ? 'Création...' : 'Créer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategoryInput(false);
                          setNewCategoryName('');
                        }}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-label="Catégorie du produit"
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryInput(true)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300"
                      title="Créer une nouvelle catégorie"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unité *
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {units.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix unitaire (FCFA) *
                </label>
                <input
                  type="number"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {product ? 'Stock actuel' : 'Quantite initiale *'}
                </label>
                {product ? (
                  <div>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                      {formData.stock_quantity} {formData.unit}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Pour modifier le stock, utilisez le <a href="/stock" className="text-blue-600 hover:underline">reapprovisionnement</a>
                    </p>
                  </div>
                ) : (
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seuil minimum
                </label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code-barres
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de péremption
                </label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Produit actif
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="danger" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Enregistrement...'
                  : product
                    ? 'Mettre à jour'
                    : 'Créer'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
