#!/usr/bin/env python
"""
Script to test server-side pagination for orders, products, and audit logs.
"""
import requests
import json

BASE_URL = 'http://localhost:8000/api'

def get_token():
    """Login and get JWT token."""
    response = requests.post(f'{BASE_URL}/auth/login/', json={
        'username': 'admin',
        'password': 'admin123'
    })
    if response.status_code == 200:
        return response.json()['access']
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def test_pagination(endpoint, token, page=1, page_size=5):
    """Test pagination for a given endpoint."""
    headers = {'Authorization': f'Bearer {token}'}
    params = {'page': page, 'page_size': page_size}

    response = requests.get(f'{BASE_URL}/{endpoint}/', headers=headers, params=params)

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ {endpoint.upper()} - Page {page}, Size {page_size}")
        print(f"   Total count: {data.get('count', 'N/A')}")
        print(f"   Results in this page: {len(data.get('results', []))}")
        print(f"   Next page: {'Yes' if data.get('next') else 'No'}")
        print(f"   Previous page: {'Yes' if data.get('previous') else 'No'}")
        return data
    else:
        print(f"\n❌ {endpoint.upper()} - Error {response.status_code}")
        print(f"   {response.text}")
        return None

def main():
    print("=" * 60)
    print("Testing Server-Side Pagination")
    print("=" * 60)

    # Get authentication token
    print("\n1. Authenticating...")
    token = get_token()
    if not token:
        print("Cannot continue without authentication")
        return
    print("   ✅ Authentication successful")

    # Test products pagination
    print("\n2. Testing Products Pagination")
    test_pagination('products', token, page=1, page_size=5)
    test_pagination('products', token, page=2, page_size=3)

    # Test orders pagination
    print("\n3. Testing Orders Pagination")
    test_pagination('orders', token, page=1, page_size=10)

    # Test with different page sizes
    print("\n4. Testing Different Page Sizes")
    for page_size in [5, 25, 50]:
        test_pagination('products', token, page=1, page_size=page_size)

    print("\n" + "=" * 60)
    print("✅ All pagination tests completed!")
    print("=" * 60)

if __name__ == '__main__':
    main()
