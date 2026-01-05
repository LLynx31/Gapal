import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from datetime import date, timedelta

# Login with vendor
client = APIClient()
response = client.post('/api/auth/login/', {
    'username': 'gestionnaire_stock',
    'password': 'test123'
}, format='json')

if response.status_code != 200:
    print(f"Login failed: {response.status_code}")
    print(response.json())
    exit(1)

print("✅ Login successful")
token = response.json()['access']
client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

# Get products
response = client.get('/api/products/simple/')
if response.status_code != 200:
    print(f"Failed to get products: {response.status_code}")
    exit(1)

products = response.json()
if not products:
    print("❌ No products available")
    exit(1)

product_id = products[0]['id']
print(f"✅ Product found: ID={product_id}, Name={products[0]['name']}")

# Test: Order without delivery_address field (like mobile app might send)
print("\n" + "="*70)
print("TEST: Order without delivery_address field")
print("="*70)

order_data = {
    "client_name": "Test Client Mobile",
    "delivery_date": (date.today() + timedelta(days=1)).isoformat(),
    "priority": "moyenne",
    "payment_status": "non_payee",
    "items": [
        {
            "product_id": product_id,
            "quantity": 2
        }
    ]
}

print(f"\nSending data:")
import json
print(json.dumps(order_data, indent=2))

response = client.post('/api/orders/', order_data, format='json')
print(f"\nStatus Code: {response.status_code}")
print(f"Response:")
print(json.dumps(response.json(), indent=2))

if response.status_code == 201:
    print("\n✅ SUCCESS - Order created!")
else:
    print("\n❌ FAILED - Order not created")
    print("\nThis is the error the mobile app is getting!")
