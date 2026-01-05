"""
Serializers for Product and Category models.
"""

from rest_framework import serializers
from .models import Product, Category


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model."""
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'products_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product model."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_expiring_soon = serializers.BooleanField(read_only=True)
    days_until_expiration = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'unit_price', 'stock_quantity',
            'category', 'category_name', 'unit', 'unit_display',
            'barcode', 'min_stock_level', 'expiration_date',
            'is_active', 'is_low_stock', 'is_out_of_stock',
            'is_expired', 'is_expiring_soon', 'days_until_expiration',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product lists."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'unit_price', 'stock_quantity',
            'category', 'category_name', 'unit', 'unit_display',
            'is_low_stock', 'is_active'
        ]


class ProductSimpleSerializer(serializers.ModelSerializer):
    """Minimal serializer for dropdowns and selectors."""

    class Meta:
        model = Product
        fields = ['id', 'name', 'unit_price', 'stock_quantity', 'unit']
