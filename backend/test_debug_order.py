#!/usr/bin/env python
"""
Debug script to see exact validation errors.
"""
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from apps.users.models import User
from apps.products.models import Product
import json

def test_with_invalid_uuid():
    """Test with timestamp instead of UUID to see the error."""
    client = Client()

    # Login as vendeur2
    print("Logging in as vendeur2...")
    response = client.post('/api/auth/login/', {
        'username': 'vendeur2',
        'password': 'vendeur123'
    }, content_type='application/json')

    token = response.json()['access']

    # Get a product
    response = client.get('/api/products/simple/',
                         HTTP_AUTHORIZATION=f'Bearer {token}')
    product_id = response.json()[0]['id']

    # Test with timestamp (like old orders)
    print("\n1. Testing with timestamp as local_id (simulating old order)...")
    order_data = {
        "local_id": "1767458347288",  # Timestamp, not UUID
        "client_name": "Test Client",
        "client_phone": "70123456",
        "delivery_address": "Address",
        "delivery_date": "2026-01-06",
        "priority": "moyenne",
        "payment_status": "non_payee",
        "notes": "Test",
        "items": [{"product_id": product_id, "quantity": 2}]
    }

    response = client.post('/api/orders/',
                          order_data,
                          content_type='application/json',
                          HTTP_AUTHORIZATION=f'Bearer {token}')

    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

    # Test without local_id
    print("\n2. Testing without local_id...")
    order_data = {
        "client_name": "Test Client",
        "client_phone": "70123456",
        "delivery_address": "Address",
        "delivery_date": "2026-01-06",
        "priority": "moyenne",
        "payment_status": "non_payee",
        "notes": "Test",
        "items": [{"product_id": product_id, "quantity": 2}]
    }

    response = client.post('/api/orders/',
                          order_data,
                          content_type='application/json',
                          HTTP_AUTHORIZATION=f'Bearer {token}')

    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        data = response.json()
        order_number = data.get('order_number', 'N/A')
        print(f"✅ Order created: {order_number}")
        print(f"Response: {json.dumps(data, indent=2)}")
    else:
        print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == '__main__':
    test_with_invalid_uuid()
