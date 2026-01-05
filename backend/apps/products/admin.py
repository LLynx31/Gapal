"""
Admin configuration for Product and Category models.
"""

from django.contrib import admin
from .models import Product, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'category', 'unit_price', 'stock_quantity',
        'unit', 'is_low_stock', 'is_active'
    ]
    list_filter = ['category', 'is_active', 'unit']
    search_fields = ['name', 'barcode', 'description']
    ordering = ['name']

    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True
    is_low_stock.short_description = 'Stock bas'
