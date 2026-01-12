# Migration vers la Pagination Server-Side

## Résumé

Le frontend web a été migré de la **pagination client-side** vers la **pagination server-side** pour améliorer les performances et réduire la charge réseau.

## Changements effectués

### Backend (Django REST Framework)

Le backend était déjà configuré pour la pagination server-side:

**Configuration**: [backend/config/settings/base.py](backend/config/settings/base.py#L100-L116)
```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'utils.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    ...
}
```

**Classe de pagination**: [backend/utils/pagination.py](backend/utils/pagination.py)
```python
class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
```

### Frontend (Next.js)

Trois pages ont été modifiées pour utiliser la pagination server-side:

#### 1. Page des Commandes
**Fichier**: [web/src/app/(dashboard)/orders/page.tsx](web/src/app/(dashboard)/orders/page.tsx)

**Changements**:
- Ajout de `page` et `page_size` aux paramètres de la requête API
- Ajout de `ordering` pour le tri server-side (avec préfixe `-` pour desc)
- Suppression de la pagination et du tri côté client
- Utilisation directe de `data.results` au lieu de `paginatedOrders`
- Calcul de `totalPages` basé sur `data.count` au lieu de la longueur du tableau local

**Avant**:
```typescript
const { data } = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => api.getOrders(filters),
});

const sortedOrders = useMemo(() => {
  return [...orders].sort(...);
}, [orders, sortConfig]);

const paginatedOrders = useMemo(() => {
  return sortedOrders.slice(startIndex, endIndex);
}, [sortedOrders, currentPage, pageSize]);
```

**Après**:
```typescript
const { data } = useQuery({
  queryKey: ['orders', filters, currentPage, pageSize, sortConfig],
  queryFn: () => {
    const params = {
      ...filters,
      page: currentPage.toString(),
      page_size: pageSize.toString(),
      ordering: sortConfig ? `${sortConfig.direction === 'desc' ? '-' : ''}${sortConfig.key}` : undefined,
    };
    return api.getOrders(params);
  },
});

const orders = data?.results || [];
const totalPages = data?.count ? Math.ceil(data.count / pageSize) : 0;
```

#### 2. Page des Produits
**Fichier**: [web/src/app/(dashboard)/stock/products/page.tsx](web/src/app/(dashboard)/stock/products/page.tsx)

**Changements identiques**:
- Pagination et tri déplacés vers le backend
- Utilisation de `products.results` au lieu de `paginatedProducts`

#### 3. Page des Audit Logs
**Fichier**: [web/src/app/(dashboard)/admin/audit-logs/page.tsx](web/src/app/(dashboard)/admin/audit-logs/page.tsx)

**Changements**:
- Ajout des paramètres de pagination à la requête fetch
- Support du format de réponse paginé `{ count, results }`
- Gestion du fallback pour les anciens endpoints qui retournent des tableaux

## API de Pagination Backend

### Paramètres de requête

| Paramètre | Description | Valeur par défaut | Max |
|-----------|-------------|-------------------|-----|
| `page` | Numéro de la page | 1 | - |
| `page_size` | Nombre d'éléments par page | 20 | 100 |
| `ordering` | Champ de tri (préfixe `-` pour desc) | - | - |

### Exemples d'URL

```bash
# Page 1, 25 éléments
GET /api/orders/?page=1&page_size=25

# Page 2, 50 éléments
GET /api/products/?page=2&page_size=50

# Tri par priorité décroissante
GET /api/orders/?page=1&page_size=25&ordering=-priority

# Avec filtres
GET /api/orders/?page=1&page_size=25&delivery_status=nouvelle&payment_status=non_payee
```

### Format de réponse

```json
{
  "count": 150,
  "next": "http://example.com/api/orders/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "order_number": "CMD-20250105-001",
      ...
    },
    ...
  ]
}
```

## Tests

Un script de test a été créé pour valider la pagination server-side:

**Fichier**: [backend/test_pagination.py](backend/test_pagination.py)

**Exécution**:
```bash
cd backend
source venv/bin/activate
python test_pagination.py
```

**Résultats**:
```
✅ PRODUCTS - Page 1, Size 5
   Total count: 14
   Results in this page: 5
   Next page: Yes
   Previous page: No

✅ ORDERS - Page 1, Size 10
   Total count: 37
   Results in this page: 10
   Next page: Yes
   Previous page: No
```

## Avantages

### 🚀 Performance
- **Moins de données transférées**: Seulement les éléments de la page actuelle
- **Chargement plus rapide**: Pas besoin d'attendre tous les résultats
- **Moins de mémoire**: Le client ne stocke que la page actuelle

### 📊 Scalabilité
- **Datasets volumineux**: Fonctionne même avec des milliers d'éléments
- **Charge serveur distribuée**: Le backend gère le tri et le filtrage
- **Cache efficace**: React Query peut mettre en cache chaque page séparément

### 💡 Expérience utilisateur
- **Temps de réponse constant**: Indépendant du nombre total d'éléments
- **Navigation fluide**: Pas de freeze lors du changement de page
- **Filtres réactifs**: Les résultats sont déjà filtrés et triés par le backend

## Compatibilité

### Tri (Ordering)

Les champs suivants sont supportés pour le tri:

**Orders**:
- `priority` - Priorité
- `delivery_date` - Date de livraison
- `created_at` - Date de création
- `total_price` - Prix total

**Products**:
- `name` - Nom
- `unit_price` - Prix unitaire
- `stock_quantity` - Quantité en stock
- `created_at` - Date de création

### Filtres

Les filtres existants continuent de fonctionner:

**Orders**:
- `delivery_status`, `payment_status`, `priority`
- `search` (order_number, client_name, client_phone)
- `start_date`, `end_date`, `delivery_date`

**Products**:
- `category`, `is_active`, `unit`
- `search` (name, barcode, description)
- `low_stock`, `expiring_soon`, `out_of_stock`

## Migration Progressive

Si vous souhaitez revenir temporairement à la pagination client-side:

1. Retirez les paramètres `page` et `page_size` de la requête API
2. Restaurez la logique `useMemo` pour `paginatedOrders`/`paginatedProducts`
3. Calculez `totalPages` basé sur la longueur du tableau local

## Notes Techniques

### React Query Cache

Avec la pagination server-side, React Query crée une entrée de cache séparée pour chaque combinaison de `[filters, page, pageSize, sortConfig]`. Cela permet:

- Navigation rapide entre les pages déjà visitées
- Invalidation ciblée des caches
- Préchargement intelligent des pages suivantes (peut être ajouté)

### Reset de Page

Lors du changement de filtres ou de taille de page, la page est automatiquement réinitialisée à 1:

```typescript
useEffect(() => {
  setCurrentPage(1);
}, [filters, pageSize]);
```

### Gestion du Tri

Le tri est maintenant géré par le backend via le paramètre `ordering`:
- `ordering=priority` - Tri ascendant par priorité
- `ordering=-priority` - Tri descendant par priorité (préfixe `-`)

## Prochaines Améliorations Possibles

1. **Préchargement**: Charger la page suivante en arrière-plan
2. **Curseur de pagination**: Alternative à la pagination par numéro de page
3. **Scroll infini**: Charger automatiquement la page suivante au scroll
4. **Cache persistant**: Sauvegarder les pages dans IndexedDB
5. **Indicateur de page**: Afficher quelle page est en cours de chargement

## Support

Pour toute question ou problème:
- Vérifiez que le backend tourne avec `python manage.py runserver`
- Testez les endpoints avec le script `test_pagination.py`
- Consultez les logs du serveur Django pour les erreurs
- Vérifiez la console du navigateur pour les erreurs React Query
