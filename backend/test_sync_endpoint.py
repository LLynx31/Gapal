#!/usr/bin/env python
"""
Test script for orders sync endpoint.
Tests the /api/orders/sync/ endpoint with multiple orders.
"""
import os
import django
import sys
import uuid
from datetime import date, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from apps.users.models import User
from apps.products.models import Product

def test_sync_endpoint():
    """Test the orders sync endpoint."""
    client = Client()

    # Login as vendeur2
    print("1. Logging in as vendeur2...")
    response = client.post('/api/auth/login/', {
        'username': 'vendeur2',
        'password': 'vendeur123'
    }, content_type='application/json')

    if response.status_code != 200:
        print(f"   ❌ Login failed: {response.status_code}")
        print(f"   Response: {response.content.decode()}")
        return False

    data = response.json()
    token = data.get('access')
    print(f"   ✅ Login successful, token: {token[:20]}...")

    # Get a product
    print("\n2. Getting products...")
    response = client.get('/api/products/simple/',
                         HTTP_AUTHORIZATION=f'Bearer {token}')

    if response.status_code != 200:
        print(f"   ❌ Failed to get products: {response.status_code}")
        return False

    products = response.json()
    if not products:
        print("   ❌ No products found")
        return False

    product_id = products[0]['id']
    print(f"   ✅ Found {len(products)} products, using product ID: {product_id}")

    # Test sync with multiple orders
    print("\n3. Testing sync endpoint with 2 orders...")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    sync_data = {
        "orders": [
            {
                "local_id": str(uuid.uuid4()),
                "client_name": "Client Sync Test 1",
                "client_phone": "70111111",
                "delivery_address": "Adresse Test 1",
                "delivery_date": tomorrow,
                "priority": "haute",
                "payment_status": "non_payee",
                "notes": "Test sync batch 1",
                "items": [
                    {"product_id": product_id, "quantity": 5}
                ]
            },
            {
                "local_id": str(uuid.uuid4()),
                "client_name": "Client Sync Test 2",
                "client_phone": "",
                "delivery_address": "",
                "delivery_date": tomorrow,
                "priority": "moyenne",
                "payment_status": "non_payee",
                "notes": "Test sync batch 2",
                "items": [
                    {"product_id": product_id, "quantity": 3}
                ]
            }
        ]
    }

    response = client.post('/api/orders/sync/',
                          sync_data,
                          content_type='application/json',
                          HTTP_AUTHORIZATION=f'Bearer {token}')

    print(f"   Status: {response.status_code}")

    if response.status_code == 201:
        result = response.json()
        print(f"   ✅ Sync successful!")
        print(f"   Synced: {result.get('synced')} orders")

        if 'orders' in result:
            print(f"   Orders created:")
            for order in result['orders']:
                print(f"     - {order.get('order_number')} - {order.get('client_name')}")

        return True
    else:
        print(f"   ❌ Sync failed: {response.status_code}")
        print(f"   Response: {response.content.decode()}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Testing Orders Sync Endpoint")
    print("=" * 60)

    success = test_sync_endpoint()

    print("\n" + "=" * 60)
    if success:
        print("✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("❌ TESTS FAILED")
        sys.exit(1)
