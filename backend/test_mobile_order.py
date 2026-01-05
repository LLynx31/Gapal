import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from datetime import date, timedelta
import json

# Login with vendeur2
client = APIClient()
print("="*70)
print("Testing order creation with vendeur2:vendeur123")
print("="*70)

response = client.post('/api/auth/login/', {
    'username': 'vendeur2',
    'password': 'vendeur123'
}, format='json')

if response.status_code != 200:
    print(f"\n❌ Login failed: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    exit(1)

print(f"✅ Login successful")
token = response.json()['access']
client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

# Get products
response = client.get('/api/products/simple/')
if response.status_code != 200:
    print(f"❌ Failed to get products: {response.status_code}")
    exit(1)

products = response.json()
if not products:
    print("❌ No products available")
    exit(1)

product_id = products[0]['id']
print(f"✅ Product found: ID={product_id}, Name={products[0]['name']}")

# Simulate exactly what the mobile app sends
print("\n" + "="*70)
print("TEST 1: Exact mobile app payload (minimal fields)")
print("="*70)

order_data = {
    "client_name": "Client Mobile Test",
    "client_phone": "",  # Empty phone
    "delivery_address": "",  # Empty address
    "delivery_date": (date.today() + timedelta(days=1)).isoformat(),
    "priority": "moyenne",
    "payment_status": "non_payee",
    "notes": "",
    "items": [
        {
            "product_id": product_id,
            "quantity": 2
        }
    ]
}

print(f"\nPayload:")
print(json.dumps(order_data, indent=2))

response = client.post('/api/orders/', order_data, format='json')
print(f"\n📊 Status Code: {response.status_code}")
print(f"📄 Response:")
print(json.dumps(response.json(), indent=2))

if response.status_code == 400:
    print("\n❌ ERROR 400 - This is the error!")
    print("Error details:", response.json())
elif response.status_code == 201:
    print("\n✅ SUCCESS - Order created!")
else:
    print(f"\n⚠️  Unexpected status: {response.status_code}")

# Test 2: Without some fields (like mobile might send)
print("\n" + "="*70)
print("TEST 2: Without client_phone field")
print("="*70)

order_data2 = {
    "client_name": "Client Sans Tel",
    "delivery_address": "Koudougou",
    "delivery_date": (date.today() + timedelta(days=1)).isoformat(),
    "priority": "moyenne",
    "payment_status": "non_payee",
    "items": [
        {
            "product_id": product_id,
            "quantity": 1
        }
    ]
}

print(f"\nPayload:")
print(json.dumps(order_data2, indent=2))

response = client.post('/api/orders/', order_data2, format='json')
print(f"\n📊 Status Code: {response.status_code}")
print(f"📄 Response:")
print(json.dumps(response.json(), indent=2))

if response.status_code == 400:
    print("\n❌ ERROR 400")
elif response.status_code == 201:
    print("\n✅ SUCCESS")
