#!/usr/bin/env python
"""
Simulate exactly what the mobile app does with old orders.
"""
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
import json

def test_mobile_old_orders():
    """Test with old order format (timestamp as local_id)."""
    client = Client()

    # Login
    print("1. Login as vendeur2...")
    response = client.post('/api/auth/login/', {
        'username': 'vendeur2',
        'password': 'vendeur123'
    }, content_type='application/json')

    token = response.json()['access']
    print(f"   ✅ Token: {token[:20]}...")

    # Get products
    print("\n2. Get products...")
    response = client.get('/api/products/simple/',
                         HTTP_AUTHORIZATION=f'Bearer {token}')
    product_id = response.json()[0]['id']
    print(f"   ✅ Product ID: {product_id}")

    # Create order with timestamp (simulating old app data)
    print("\n3. Create order with timestamp as local_id (old app data)...")
    old_order = {
        "local_id": "1767458347288",  # Timestamp from mobile logs
        "client_name": "Client Test Mobile",
        "client_phone": "70123456",
        "delivery_address": "Koudougou",
        "delivery_date": "2026-01-06",
        "priority": "moyenne",
        "payment_status": "non_payee",
        "notes": "Test from mobile",
        "items": [{"product_id": product_id, "quantity": 2}]
    }

    response = client.post('/api/orders/',
                          old_order,
                          content_type='application/json',
                          HTTP_AUTHORIZATION=f'Bearer {token}')

    print(f"   Status: {response.status_code}")

    if response.status_code == 201:
        data = response.json()

        # Check required fields for mobile app
        assert 'id' in data, "Missing 'id' field!"
        assert 'order_number' in data, "Missing 'order_number' field!"
        assert 'local_id' in data, "Missing 'local_id' field!"

        assert isinstance(data['id'], int), f"'id' should be int, got {type(data['id'])}"
        assert isinstance(data['order_number'], str), f"'order_number' should be str, got {type(data['order_number'])}"
        assert isinstance(data['local_id'], str), f"'local_id' should be str, got {type(data['local_id'])}"

        print(f"   ✅ Order created successfully!")
        print(f"   ✅ id: {data['id']} (type: {type(data['id']).__name__})")
        print(f"   ✅ order_number: {data['order_number']} (type: {type(data['order_number']).__name__})")
        print(f"   ✅ local_id: {data['local_id'][:36]}... (type: {type(data['local_id']).__name__})")

        # Verify mobile app can parse this
        print("\n4. Verify mobile app can parse response...")
        try:
            # Simulate what mobile app does
            order_id = data['id']  # int
            order_number = data['order_number']  # str
            local_id = data['local_id']  # str

            print(f"   ✅ Mobile app can successfully extract:")
            print(f"      - id: {order_id}")
            print(f"      - order_number: {order_number}")
            print(f"      - local_id: {local_id[:36]}...")

            return True
        except Exception as e:
            print(f"   ❌ Error parsing response: {e}")
            return False
    else:
        print(f"   ❌ Failed: {response.json()}")
        return False

if __name__ == '__main__':
    print("=" * 70)
    print("Mobile App Old Orders Simulation Test")
    print("=" * 70)

    success = test_mobile_old_orders()

    print("\n" + "=" * 70)
    if success:
        print("✅ ALL TESTS PASSED - Mobile app can sync old orders!")
        sys.exit(0)
    else:
        print("❌ TEST FAILED")
        sys.exit(1)
