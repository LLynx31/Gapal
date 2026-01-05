"""
Admin configuration for Order models.
"""

from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['subtotal']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 'client_name', 'client_phone',
        'delivery_date', 'delivery_status', 'payment_status',
        'priority', 'total_price', 'created_at'
    ]
    list_filter = ['delivery_status', 'payment_status', 'priority', 'created_at']
    search_fields = ['order_number', 'client_name', 'client_phone']
    ordering = ['-created_at']
    readonly_fields = ['order_number', 'total_price', 'created_at', 'updated_at']
    inlines = [OrderItemInline]

    fieldsets = (
        ('Informations client', {
            'fields': ('client_name', 'client_phone', 'delivery_address')
        }),
        ('Livraison', {
            'fields': ('delivery_date', 'delivery_status', 'priority')
        }),
        ('Paiement', {
            'fields': ('payment_status', 'total_price')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Métadonnées', {
            'fields': ('order_number', 'local_id', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
