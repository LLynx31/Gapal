# Creating Test Users for Permission Testing

To test the permission system, you need to create two test users with different roles.

## Using Django Management Command

If you have Django set up with a virtual environment, run:

```bash
cd backend
python manage.py create_test_users
```

This will create:

### 1. **Stock Manager (gestionnaire_stocks)**
- **Username:** `gestionnaire_stock`
- **Password:** `password123`
- **Access:**
  - ✅ Can create/edit stock movements (Restock, Destock)
  - ✅ Can view orders, sales, stock data (read-only for others)
  - ❌ Cannot modify orders or sales

### 2. **Order Manager (gestionnaire_commandes)**
- **Username:** `gestionnaire_commandes`
- **Password:** `password123`
- **Access:**
  - ✅ Can create/modify orders and sales
  - ✅ Can view all data (orders, sales, stock)
  - ❌ Cannot modify stock movements

### 3. **Vendor (vendeur)** - Optional
- **Username:** `vendeur_test`
- **Password:** `password123`
- **Access:**
  - ✅ Can create orders
  - ✅ Can view all data (read-only)
  - ❌ Cannot modify orders, sales, or stock

## Manual User Creation via Django Admin

1. Go to Django admin: `http://localhost:8000/admin/`
2. Login with admin credentials
3. Click "Users" in the left sidebar
4. Click "Add User"
5. Create users with these details:

### User 1: Stock Manager
- **Username:** `gestionnaire_stock`
- **Email:** `stock@gapal.local`
- **First Name:** `Jean`
- **Last Name:** `Stock`
- **Password:** `password123`
- **Role:** Select "Gestionnaire Stocks" from the dropdown

### User 2: Order Manager
- **Username:** `gestionnaire_commandes`
- **Email:** `orders@gapal.local`
- **First Name:** `Marie`
- **Last Name:** `Commandes`
- **Password:** `password123`
- **Role:** Select "Gestionnaire Commandes" from the dropdown

## Testing Permission System

Once you've created the users, test the following scenarios:

### As Stock Manager (`gestionnaire_stock`)
1. Login to the application
2. Navigate to **Stocks**
3. ✅ You should see "Réapprovisionner" and "Destocker" buttons
4. Navigate to **Commandes** (Orders)
5. ✅ You should see order details but NOT be able to change status/payment
6. Navigate to **Ventes** (Sales)
7. ✅ You should see sales data but NOT see "Nouvelle Vente" button
8. Navigate to **Administration**
9. ❌ You should NOT see this menu item (access denied)

### As Order Manager (`gestionnaire_commandes`)
1. Login to the application
2. Navigate to **Ventes** (Sales)
3. ✅ You should see "Nouvelle Vente" button
4. Navigate to **Commandes** (Orders)
5. ✅ You should see order details AND be able to change status/payment
6. Navigate to **Stocks**
7. ✅ You should see stock data but NOT see "Réapprovisionner"/"Destocker" buttons
8. Navigate to **Administration**
9. ❌ You should NOT see this menu item (access denied)

### As Vendor (`vendeur_test`)
1. Login to the application
2. All menu items visible (except Administration)
3. ✅ Can see all data (read-only mode)
4. ❌ No "Create" or "Edit" buttons visible
5. All sections show read-only data

## Permission Matrix

| Feature | Stock Manager | Order Manager | Vendor | Admin |
|---------|---------------|---------------|--------|-------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| View Orders | ✅ | ✅ | ✅ | ✅ |
| Modify Orders | ❌ | ✅ | ❌ | ✅ |
| View Sales | ✅ | ✅ | ✅ | ✅ |
| Create/Modify Sales | ❌ | ✅ | ❌ | ✅ |
| View Stock | ✅ | ✅ | ✅ | ✅ |
| Restock/Destock | ✅ | ❌ | ❌ | ✅ |
| View Admin Panel | ❌ | ❌ | ❌ | ✅ |
