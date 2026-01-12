# Logique de Tri Intelligent des Commandes

## Objectif

Les commandes sont triées de manière intelligente pour afficher en priorité les commandes qui nécessitent une attention immédiate, tout en organisant les commandes par priorité et date.

## Règles de Tri

### 1. Par Statut (status_order)

Les commandes sont d'abord triées par statut, avec les commandes actives en haut et les commandes terminées en bas:

| Statut | Ordre | Emoji | Description |
|--------|-------|-------|-------------|
| **Nouvelle** | 1 | 🆕 | Nouvelles commandes non traitées - **PRIORITAIRE** |
| **En préparation** | 2 | 👨‍🍳 | Commandes en cours de préparation |
| **En cours** | 3 | 🚚 | Commandes en cours de livraison |
| **Livrée** | 10 | ✅ | Commandes livrées - en bas |
| **Annulée** | 11 | ❌ | Commandes annulées - tout en bas |

### 2. Par Priorité (priority_order)

Au sein du même statut, les commandes sont triées par priorité:

| Priorité | Ordre | Emoji | Description |
|----------|-------|-------|-------------|
| **Haute** | 1 | 🔴 | Urgente - à traiter en premier |
| **Moyenne** | 2 | 🟡 | Normale |
| **Basse** | 3 | 🟢 | Peut attendre |

### 3. Par Date de Création

En dernier, les commandes sont triées par date de création décroissante (les plus récentes en premier).

## Exemple de Tri

Voici comment les commandes s'affichent:

```
1. 🆕 202601050031  🔴 haute     - nouvelle      (plus récente haute priorité)
2. 🆕 202601050026  🔴 haute     - nouvelle
3. 🆕 202601050022  🔴 haute     - nouvelle
4. 🆕 202601050018  🔴 haute     - nouvelle
5. 🆕 202601050028  🟡 moyenne   - nouvelle      (nouvelles commandes priorité moyenne)
6. 🆕 202601050027  🟡 moyenne   - nouvelle
7. 🆕 202601050025  🟡 moyenne   - nouvelle
8. 🆕 202601050030  🟢 basse     - nouvelle      (nouvelles commandes priorité basse)
9. 🆕 202601050029  🟢 basse     - nouvelle
10. 👨‍🍳 202601050005  🔴 haute     - en_preparation (en préparation haute priorité)
11. 👨‍🍳 202601050004  🟡 moyenne   - en_preparation
12. 🚚 202601050003  🔴 haute     - en_cours      (en cours haute priorité)
13. 🚚 202601050002  🟡 moyenne   - en_cours
...
35. ✅ 202601050021  🟡 moyenne   - livree        (commandes livrées en bas)
36. ✅ 202601050017  🟡 moyenne   - livree
37. ❌ 202601050008  🟡 moyenne   - annulee       (commandes annulées tout en bas)
```

## Implémentation Backend

### Fichier: `backend/apps/orders/views.py`

#### Annotations SQL

```python
queryset = Order.objects.annotate(
    # Status order: commandes actives en haut (valeur basse), terminées en bas (valeur haute)
    status_order=Case(
        When(delivery_status='nouvelle', then=1),
        When(delivery_status='en_preparation', then=2),
        When(delivery_status='en_cours', then=3),
        When(delivery_status='livree', then=10),
        When(delivery_status='annulee', then=11),
        default=5,
        output_field=IntegerField(),
    ),
    # Priority order: haute=1, moyenne=2, basse=3
    priority_order=Case(
        When(priority='haute', then=1),
        When(priority='moyenne', then=2),
        When(priority='basse', then=3),
        default=2,
        output_field=IntegerField(),
    )
)
```

#### Tri par Défaut

```python
ordering = ['status_order', 'priority_order', '-created_at']
```

**Explication**:
1. `status_order` - Tri ascendant (1, 2, 3, ... 10, 11) → nouvelles en premier
2. `priority_order` - Tri ascendant (1, 2, 3) → haute priorité en premier
3. `-created_at` - Tri descendant → plus récentes en premier

#### Champs de Tri Disponibles

```python
ordering_fields = [
    'priority',          # Tri manuel par priorité
    'delivery_date',     # Tri par date de livraison
    'created_at',        # Tri par date de création
    'total_price',       # Tri par prix total
    'status_order',      # Tri par statut (intelligent)
    'priority_order'     # Tri par priorité (intelligent)
]
```

## Implémentation Frontend

### Fichier: `web/src/app/(dashboard)/orders/page.tsx`

#### Paramètre de Tri

```typescript
// Tri par défaut intelligent
params.ordering = 'status_order,priority_order,-created_at';

// Si l'utilisateur trie manuellement une colonne
if (sortConfig) {
  const orderingPrefix = sortConfig.direction === 'desc' ? '-' : '';
  params.ordering = `${orderingPrefix}${sortConfig.key}`;
}
```

## Comportement Dynamique

### Quand une Commande Change de Statut

**Scénario**: Une commande "Nouvelle" haute priorité est marquée comme "Livrée"

**Avant**:
```
1. 🆕 CMD-001  🔴 haute  - nouvelle
2. 🆕 CMD-002  🟡 moyenne - nouvelle
...
```

**Après** (la commande descend automatiquement):
```
1. 🆕 CMD-002  🟡 moyenne - nouvelle    ← Monte en position 1
2. 🆕 CMD-003  🟡 moyenne - nouvelle
...
35. ✅ CMD-001  🔴 haute  - livree      ← Descend en bas
```

### WebSocket Real-Time

Le frontend écoute les mises à jour en temps réel via WebSocket:

```typescript
wsClient.on('notification', (data) => {
  if (data.type === 'order_status') {
    refetch(); // Recharge les données avec le nouveau tri
  }
});
```

## Tests

### Script de Test

**Fichier**: `backend/test_order_sorting.py`

```bash
cd backend
source venv/bin/activate
python test_order_sorting.py
```

**Sortie Attendue**:
```
============================================================
Test du Tri Intelligent des Commandes
============================================================

Total: 37 commandes

Ordre d'affichage:
------------------------------------------------------------
 1. 🆕 202601050031  🔴 haute    - nouvelle
 2. 🆕 202601050026  🔴 haute    - nouvelle
 3. 🆕 202601050022  🔴 haute    - nouvelle
 ...

✅ Les commandes actives sont bien en haut
✅ Les commandes terminées sont bien en bas
✅ Les commandes haute priorité sont en premier parmi les actives
```

### Test Manuel via API

```bash
# Test avec tri par défaut
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8000/api/orders/?page=1&page_size=10'

# Test avec tri personnalisé
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8000/api/orders/?ordering=status_order,priority_order,-created_at'

# Test tri descendant par date
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8000/api/orders/?ordering=-created_at'
```

## Avantages

### 1. Efficacité Opérationnelle ⚡
- Les nouvelles commandes sont **immédiatement visibles** en haut
- Les commandes urgentes (haute priorité) sont **traitées en premier**
- Les commandes terminées ne **polluent pas** l'affichage principal

### 2. Productivité 📈
- Les opérateurs voient d'abord **ce qui nécessite une action**
- Moins de temps perdu à chercher les commandes importantes
- Flux de travail naturel: du haut (à faire) vers le bas (fait)

### 3. Visibilité 👀
- État en temps réel avec émojis visuels
- Hiérarchie claire par couleurs (🔴🟡🟢)
- Les commandes anciennes non traitées restent visibles en haut

### 4. Flexibilité 🔧
- L'utilisateur peut **toujours trier manuellement** en cliquant sur une colonne
- Le tri par défaut s'applique uniquement sans tri manuel
- Pagination compatible avec le tri

## Cas d'Usage

### Cas 1: Gestionnaire de Commandes (Matin)
```
Affichage:
1. 🆕 CMD-045  🔴 haute    - nouvelle      ← "Oh! Une commande urgente!"
2. 🆕 CMD-044  🟡 moyenne  - nouvelle      ← "Des commandes de la nuit"
3. 🆕 CMD-043  🟡 moyenne  - nouvelle
4. 👨‍🍳 CMD-042  🔴 haute    - en_preparation ← "Celle-ci est déjà en cours"
...
```

**Action**: Le gestionnaire traite d'abord CMD-045 (haute priorité, nouvelle)

### Cas 2: Après Traitement d'une Commande Urgente
```
Avant:
1. 🆕 CMD-045  🔴 haute  - nouvelle

Clic "Marquer en préparation" → Rafraîchissement automatique

Après:
1. 🆕 CMD-044  🟡 moyenne  - nouvelle      ← Monte en position 1
2. 👨‍🍳 CMD-045  🔴 haute    - en_preparation ← Descend à sa nouvelle place
```

### Cas 3: Fin de Journée
```
Affichage:
1. 🆕 CMD-050  🟡 moyenne  - nouvelle      ← Quelques nouvelles
2. 🆕 CMD-049  🟡 moyenne  - nouvelle
3. 👨‍🍳 CMD-048  🔴 haute    - en_preparation ← En cours
4. 🚚 CMD-047  🟡 moyenne  - en_cours      ← En livraison
...
30. ✅ CMD-020  🟡 moyenne  - livree        ← Toutes les commandes du jour traitées
31. ✅ CMD-019  🟡 moyenne  - livree
```

## Personnalisation

### Modifier l'Ordre des Priorités

Si vous souhaitez changer l'ordre, modifiez les valeurs dans `views.py`:

```python
priority_order=Case(
    When(priority='haute', then=1),      # ← Changer la valeur
    When(priority='moyenne', then=2),    # ← Changer la valeur
    When(priority='basse', then=3),      # ← Changer la valeur
    default=2,
    output_field=IntegerField(),
)
```

### Ajouter un Nouveau Statut

```python
status_order=Case(
    When(delivery_status='nouvelle', then=1),
    When(delivery_status='en_preparation', then=2),
    When(delivery_status='en_cours', then=3),
    When(delivery_status='urgent', then=0),  # ← Nouveau statut ultra-prioritaire
    When(delivery_status='livree', then=10),
    When(delivery_status='annulee', then=11),
    default=5,
    output_field=IntegerField(),
)
```

## Compatibilité

### Pagination ✅
Le tri fonctionne avec la pagination server-side:
- Chaque page affiche les commandes dans le bon ordre
- La navigation entre pages respecte le tri global

### Filtres ✅
Le tri s'applique après les filtres:
```
Filtre: delivery_status=nouvelle
↓
Tri: priority_order, -created_at
↓
Pagination: page=1, page_size=25
```

### Tri Manuel ✅
L'utilisateur peut toujours trier par colonne:
- Clic sur "Date de livraison" → Tri par delivery_date
- Clic sur "Prix" → Tri par total_price
- Le tri par défaut revient après suppression du tri manuel

## Maintenance

### Vérifier le Tri
```bash
python backend/test_order_sorting.py
```

### Logs de Debug
Dans les logs Django, vérifiez la requête SQL générée:
```sql
SELECT "orders_order".*,
       CASE WHEN "orders_order"."delivery_status" = 'nouvelle' THEN 1
            WHEN "orders_order"."delivery_status" = 'en_preparation' THEN 2
            ...
       END AS "status_order",
       CASE WHEN "orders_order"."priority" = 'haute' THEN 1
            ...
       END AS "priority_order"
FROM "orders_order"
ORDER BY "status_order" ASC, "priority_order" ASC, "created_at" DESC
```

### Performance
Les annotations `status_order` et `priority_order` sont calculées au niveau SQL:
- ✅ Très performant (pas de traitement Python)
- ✅ Compatible avec les indexes
- ✅ Fonctionne avec des milliers de commandes

## Résumé

| Aspect | Valeur |
|--------|--------|
| **Tri par défaut** | `status_order,priority_order,-created_at` |
| **Nouvelles commandes** | Toujours en haut |
| **Priorité haute** | En premier dans chaque statut |
| **Commandes livrées** | Automatiquement en bas |
| **Tri manuel** | Respecté quand activé |
| **Performance** | Optimisé SQL, très rapide |

**Résultat**: Les utilisateurs voient immédiatement ce qui nécessite leur attention! 🎯
