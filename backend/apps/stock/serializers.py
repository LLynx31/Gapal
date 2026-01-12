"""
Serializers for Stock models.
"""

from rest_framework import serializers
from .models import StockMovement
from apps.products.models import Product


class StockMovementSerializer(serializers.ModelSerializer):
    """Serializer for StockMovement."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    movement_type_display = serializers.CharField(
        source='get_movement_type_display', read_only=True
    )
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name',
            'movement_type', 'movement_type_display',
            'quantity', 'previous_quantity', 'new_quantity',
            'order', 'order_number', 'reason',
            'user', 'user_name', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']


class StockEntrySerializer(serializers.Serializer):
    """Serializer for creating stock entries."""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255, required=False, default='')
    expiration_date = serializers.DateField(required=False, allow_null=True)

    def validate_product_id(self, value):
        try:
            Product.objects.get(id=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Produit non trouvé ou inactif.")
        return value


class StockExitSerializer(serializers.Serializer):
    """Serializer for creating stock exits."""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255, required=False, default='')

    def validate_product_id(self, value):
        try:
            Product.objects.get(id=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Produit non trouvé ou inactif.")
        return value

    def validate(self, data):
        product = Product.objects.get(id=data['product_id'])
        if product.stock_quantity < data['quantity']:
            raise serializers.ValidationError({
                'quantity': f"Stock insuffisant. Disponible: {product.stock_quantity}"
            })
        return data


class StockAdjustmentSerializer(serializers.Serializer):
    """Serializer for stock adjustments."""
    product_id = serializers.IntegerField()
    new_quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=255)

    def validate_product_id(self, value):
        try:
            Product.objects.get(id=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Produit non trouvé ou inactif.")
        return value
