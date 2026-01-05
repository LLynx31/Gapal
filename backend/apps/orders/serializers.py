"""
Serializers for Order and OrderItem models.
"""

from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem
from apps.products.models import Product
from apps.products.serializers import ProductSimpleSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer for OrderItem."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.get_unit_display', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'quantity', 'unit_price', 'subtotal'
        ]
        read_only_fields = ['id', 'subtotal']


class OrderItemCreateSerializer(serializers.Serializer):
    """Serializer for creating order items."""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

    def validate_product_id(self, value):
        try:
            product = Product.objects.get(id=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Produit non trouvé ou inactif.")
        return value


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order with full details."""
    items = OrderItemSerializer(many=True, read_only=True)
    delivery_status_display = serializers.CharField(
        source='get_delivery_status_display', read_only=True
    )
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    items_count = serializers.SerializerMethodField()

    def get_items_count(self, obj):
        """Get items count from annotation or compute directly."""
        if hasattr(obj, 'items_count'):
            return obj.items_count
        return obj.items.count()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'local_id',
            'client_name', 'client_phone',
            'delivery_address', 'delivery_date',
            'delivery_status', 'delivery_status_display',
            'payment_status', 'payment_status_display',
            'priority', 'priority_display',
            'total_price', 'notes',
            'created_by', 'created_by_name',
            'items', 'items_count',
            'created_at', 'updated_at', 'synced_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'total_price',
            'created_by', 'created_at', 'updated_at', 'synced_at'
        ]


class OrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for order lists."""
    delivery_status_display = serializers.CharField(
        source='get_delivery_status_display', read_only=True
    )
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display', read_only=True
    )
    items_count = serializers.SerializerMethodField()

    def get_items_count(self, obj):
        """Get items count from annotation or compute directly."""
        if hasattr(obj, 'items_count'):
            return obj.items_count
        return obj.items.count()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'client_name', 'client_phone',
            'delivery_date', 'delivery_status', 'delivery_status_display',
            'payment_status', 'payment_status_display',
            'priority', 'priority_display', 'total_price',
            'items_count', 'created_at'
        ]


class OrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating orders (from mobile app)."""
    items = OrderItemCreateSerializer(many=True, write_only=True)
    local_id = serializers.UUIDField(required=False)

    class Meta:
        model = Order
        fields = [
            'local_id', 'client_name', 'client_phone',
            'delivery_address', 'delivery_date',
            'priority', 'payment_status', 'notes', 'items'
        ]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La commande doit contenir au moins un produit.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user

        # Create order
        order = Order.objects.create(
            created_by=user,
            **validated_data
        )

        # Create order items
        total = 0
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'])
            item = OrderItem.objects.create(
                order=order,
                product=product,
                quantity=item_data['quantity'],
                unit_price=product.unit_price
            )
            total += item.subtotal

        # Update total
        order.total_price = total
        order.save()

        return order


class OrderUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating order status."""

    class Meta:
        model = Order
        fields = [
            'delivery_status', 'payment_status', 'notes',
            'delivery_address', 'delivery_date', 'priority'
        ]


class OrderStatusSerializer(serializers.Serializer):
    """Serializer for updating delivery status only."""
    delivery_status = serializers.ChoiceField(choices=Order.DeliveryStatus.choices)


class OrderPaymentSerializer(serializers.Serializer):
    """Serializer for updating payment status only."""
    payment_status = serializers.ChoiceField(choices=Order.PaymentStatus.choices)


class OrderSyncSerializer(serializers.Serializer):
    """Serializer for syncing multiple orders from mobile."""
    orders = OrderCreateSerializer(many=True)

    def create(self, validated_data):
        orders_data = validated_data.get('orders', [])
        created_orders = []

        for order_data in orders_data:
            serializer = OrderCreateSerializer(
                data=order_data,
                context=self.context
            )
            serializer.is_valid(raise_exception=True)
            order = serializer.save()
            created_orders.append(order)

        return created_orders
