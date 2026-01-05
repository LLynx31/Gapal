# Correction de la Synchronisation des Commandes

## Problème Identifié

L'application mobile recevait des erreurs HTTP 400 lors de la synchronisation des commandes.

### Causes

1. **Serveurs multiples** : Plusieurs instances du serveur Django tournaient en parallèle, certaines sans les migrations appliquées
2. **Utilisation incorrecte de l'API** : Le `SyncService` utilisait `createOrder()` au lieu de `syncOrders()`, envoyant les commandes une par une au lieu d'utiliser l'endpoint de synchronisation batch
3. **UUIDs invalides** : Les anciennes commandes dans la base SQLite mobile avaient des timestamps (ex: `1767458347288`) comme `local_id` au lieu d'UUIDs valides, causant des erreurs de validation

## Corrections Appliquées

### 1. Backend (Django)

#### Modifications du modèle Order
**Fichier**: `backend/apps/orders/models.py`

Champs rendus optionnels pour permettre la création de commandes sans adresse ou téléphone:
```python
client_phone = models.CharField(
    max_length=20,
    blank=True,
    default='',
    verbose_name='Téléphone'
)

delivery_address = models.TextField(
    blank=True,
    default='',
    verbose_name='Adresse de livraison'
)
```

#### Migrations créées
- `0003_alter_order_delivery_address.py`
- `0004_alter_order_client_phone.py`

#### Validation UUID flexible
**Fichier**: `backend/apps/orders/serializers.py`

Le serializer `OrderCreateSerializer` accepte maintenant les `local_id` invalides (timestamps) et génère automatiquement des UUIDs valides:

```python
def validate_local_id(self, value):
    """Validate local_id and convert to UUID string if needed."""
    import uuid

    if not value:
        # Generate new UUID if not provided or empty
        return str(uuid.uuid4())

    # Try to parse as UUID
    try:
        # Validate it's a proper UUID format
        uuid.UUID(value)
        return value  # Return original string if valid
    except (ValueError, AttributeError):
        # If invalid UUID (e.g., timestamp), generate a new one
        print(f"Invalid UUID '{value}', generating new one")
        return str(uuid.uuid4())
```

### 2. Mobile (Flutter)

#### Modification du SyncService
**Fichier**: `mobile/lib/services/sync_service.dart`

Le service utilise maintenant l'endpoint de synchronisation batch `/api/orders/sync/` avec fallback sur la synchronisation individuelle en cas d'erreur:

```dart
// Try batch sync first
try {
  final syncedOrdersData = await _api.syncOrders(pendingOrders);

  // Mark all as synced
  for (var i = 0; i < pendingOrders.length; i++) {
    final order = pendingOrders[i];
    final responseData = syncedOrdersData[i];
    await _db.markOrderSynced(
      order.localId,
      responseData['id'],
      responseData['order_number'],
    );
    synced++;
  }
} catch (e) {
  print('Batch sync failed, trying individual sync: $e');
  // Fallback to individual sync
  for (var order in pendingOrders) {
    try {
      final response = await _api.createOrder(order.toApiJson());
      // ...
    } catch (e) {
      failed++;
    }
  }
}
```

## Tests

### Test Backend

**Test 1 - Synchronisation batch:**
```bash
cd backend
source venv/bin/activate
python test_sync_endpoint.py
```

**Résultat attendu**:
```
✅ Login successful
✅ Found 13 products
✅ Sync successful!
   Synced: 2 orders
```

**Test 2 - UUIDs invalides (anciennes commandes):**
```bash
python test_debug_order.py
```

**Résultat attendu**:
```
Invalid UUID '1767458347288', generating new one
✅ Status: 201
✅ Returns: id, order_number, local_id (new UUID)
```

**Test 3 - Simulation app mobile:**
```bash
python test_mobile_simulation.py
```

**Résultat attendu**:
```
✅ id: 33 (type: int)
✅ order_number: 202601050028 (type: str)
✅ local_id: c2fa071b-08dd-4c9d-9f39-1c42df131f4e (type: str)
```

### Test Mobile

1. Arrêter tous les serveurs Django en cours:
```bash
pkill -f "python.*manage.py runserver"
```

2. Démarrer un serveur propre avec migrations:
```bash
cd backend
source venv/bin/activate
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

3. Dans l'app mobile:
   - Créer une ou plusieurs commandes en mode offline
   - Appuyer sur le bouton de synchronisation
   - Vérifier que les commandes sont synchronisées avec succès

## Endpoints API

### Création de commande unique
```
POST /api/orders/
```
**Body**:
```json
{
  "local_id": "uuid-v4",
  "client_name": "Nom Client",
  "client_phone": "70123456",
  "delivery_address": "Adresse",
  "delivery_date": "2026-01-06",
  "priority": "moyenne",
  "payment_status": "non_payee",
  "notes": "Notes",
  "items": [
    {"product_id": 11, "quantity": 2}
  ]
}
```

### Synchronisation batch
```
POST /api/orders/sync/
```
**Body**:
```json
{
  "orders": [
    {
      "local_id": "uuid-v4-1",
      "client_name": "Client 1",
      // ...
    },
    {
      "local_id": "uuid-v4-2",
      "client_name": "Client 2",
      // ...
    }
  ]
}
```

**Réponse**:
```json
{
  "synced": 2,
  "orders": [
    {
      "id": 123,
      "order_number": "202601050001",
      "client_name": "Client 1",
      // ...
    },
    // ...
  ]
}
```

## Notes Importantes

1. **local_id** peut être un UUID v4 valide, vide, ou invalide (le serveur générera automatiquement un UUID si invalide)
2. **client_phone** et **delivery_address** peuvent être vides (`""`)
3. **items** doit contenir au moins un produit avec `product_id` et `quantity`
4. Le serveur backend doit avoir les migrations appliquées pour accepter les champs optionnels
5. Les anciennes commandes avec timestamps comme `local_id` seront automatiquement converties en UUIDs lors de la synchronisation

## Vérification

Pour vérifier que tout fonctionne:

1. **Backend**: Lancer `python test_sync_endpoint.py` - doit afficher `✅ ALL TESTS PASSED`
2. **Mobile**: Rebuild l'app Flutter et tester la synchronisation
3. **Logs**: Vérifier les logs du serveur Django pour confirmer l'absence d'erreurs 400

```bash
# Voir les logs en temps réel
tail -f /tmp/django_server.log
```
