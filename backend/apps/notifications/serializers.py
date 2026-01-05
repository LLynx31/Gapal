"""
Serializers for Notification model.
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification."""
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    order_number = serializers.CharField(source='related_order.order_number', read_only=True)
    product_name = serializers.CharField(source='related_product.name', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'type_display', 'title', 'message',
            'related_order', 'order_number',
            'related_product', 'product_name',
            'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'type', 'title', 'message', 'created_at']
