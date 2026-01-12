# Guide de Dépannage - Pagination

## Si vous ne voyez pas le composant de pagination

### 1. Vérifier le nombre de données

La pagination s'affiche uniquement s'il y a des éléments. Vérifiez que vous avez des données:

**Page des Commandes:**
```bash
# Dans le backend Django, créez des commandes de test
cd backend
source venv/bin/activate
python manage.py shell

# Dans le shell Python:
from apps.orders.models import Order
from apps.users.models import User
from apps.products.models import Product
from datetime import date, timedelta

user = User.objects.first()
product = Product.objects.first()

# Créer 30 commandes de test
for i in range(30):
    order = Order.objects.create(
        client_name=f"Client Test {i}",
        client_phone=f"7012345{i:02d}",
        delivery_date=date.today() + timedelta(days=1),
        created_by=user
    )
    from apps.orders.models import OrderItem
    OrderItem.objects.create(
        order=order,
        product=product,
        quantity=2,
        unit_price=product.unit_price
    )
    order.calculate_total()
    order.save()

print(f"Créé {Order.objects.count()} commandes")
```

**Page des Produits:**
```python
# Dans le shell Python:
from apps.products.models import Product, Category

category = Category.objects.first()

# Créer 30 produits de test
for i in range(30):
    Product.objects.create(
        name=f"Produit Test {i}",
        category=category,
        unit_price=1000 + (i * 100),
        unit='LITRE',
        stock_quantity=50,
        min_stock_level=10
    )

print(f"Créé {Product.objects.count()} produits")
```

### 2. Vérifier la console du navigateur

Ouvrez les outils de développement (F12) et vérifiez:

1. **Onglet Console**: Recherchez des erreurs JavaScript
2. **Onglet Network**: Vérifiez que les appels API réussissent (status 200)
3. **Onglet Elements**: Recherchez l'élément avec la classe `Pagination`

### 3. Forcer le rafraîchissement

```bash
# Sur le frontend
cd web

# Supprimer le cache Next.js
rm -rf .next

# Rebuild
npm run dev
```

Puis dans le navigateur:
- **Windows/Linux**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R

### 4. Vérifier que le composant est bien rendu

Dans les outils de développement, recherchez:

```html
<!-- Devrait apparaître en bas du tableau -->
<div class="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 border-t border-gray-200 dark:border-gray-700">
  <div class="text-sm text-gray-600 dark:text-gray-400">
    Affichage de 1 à 25 sur XX résultats
  </div>
  ...
</div>
```

### 5. Vérifier les états React

Ajoutez temporairement un console.log pour déboguer:

```typescript
// Dans orders/page.tsx, products/page.tsx, ou audit-logs/page.tsx

console.log('Current page:', currentPage);
console.log('Page size:', pageSize);
console.log('Total items:', sortedOrders.length); // ou productsList.length, logsList.length
console.log('Total pages:', totalPages);
console.log('Paginated items:', paginatedOrders.length); // ou paginatedProducts.length, paginatedLogs.length
```

Puis ouvrez la console du navigateur pour voir ces valeurs.

### 6. Test rapide avec modification temporaire

Pour forcer l'affichage de la pagination, modifiez temporairement:

```typescript
// Dans le composant Pagination.tsx, commentez la condition:
// if (totalItems === 0) return null;

// Et ajoutez:
console.log('Pagination render:', { currentPage, totalPages, totalItems, pageSize });
```

### 7. Vérifier l'ordre des éléments dans le DOM

La pagination doit être à l'intérieur de la div du tableau:

```tsx
<div className="bg-white dark:bg-slate-800 rounded-lg shadow">
  <div className="overflow-x-auto">
    <table>...</table>
  </div>

  {/* Pagination DOIT être ici */}
  <Pagination ... />
</div>
```

### 8. Vérifier les imports

Assurez-vous que le composant est bien importé:

```typescript
import { Pagination } from '@/components/ui/Pagination';
```

Et que le fichier existe à:
```
web/src/components/ui/Pagination.tsx
```

### 9. Redémarrer le serveur de développement

```bash
cd web

# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev
```

### 10. Vérifier le mode sombre

Si vous êtes en mode sombre, les classes `dark:` doivent être appliquées. Vérifiez que:

```html
<html class="dark">
```

est présent dans le DOM.

## Commandes utiles

```bash
# Backend: Compter les éléments
cd backend && source venv/bin/activate
python manage.py shell -c "from apps.orders.models import Order; print(f'Orders: {Order.objects.count()}')"
python manage.py shell -c "from apps.products.models import Product; print(f'Products: {Product.objects.count()}')"

# Frontend: Rebuild complet
cd web
rm -rf .next node_modules
npm install
npm run dev

# Vérifier la structure du composant
cat src/components/ui/Pagination.tsx | grep "export function Pagination"
```

## Si rien ne fonctionne

1. Créez une capture d'écran de la page
2. Ouvrez la console (F12) et faites une capture des erreurs
3. Partagez le contenu de la console avec les valeurs de débogage

Le composant de pagination devrait apparaître en bas de chaque tableau dès qu'il y a au moins 1 élément à afficher.
