"""
Serializers for Sales management.
"""

from rest_framework import serializers
from decimal import Decimal
from .models import Sale, SaleItem
from apps.products.models import Product
from apps.stock.models import StockMovement


class SaleItemSerializer(serializers.ModelSerializer):
    """Serializer for sale items with product details."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'quantity', 'unit_price', 'subtotal'
        ]
        read_only_fields = ['id', 'subtotal']


class SaleItemCreateSerializer(serializers.Serializer):
    """Serializer for creating sale items."""
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=0, required=False)

    def validate_product_id(self, value):
        try:
            Product.objects.get(pk=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Produit non trouvé ou inactif")
        return value

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être positive")
        return value


class SaleSerializer(serializers.ModelSerializer):
    """Full serializer for Sale with items."""
    items = SaleItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    items_count = serializers.IntegerField(read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'receipt_number', 'local_id',
            'client_name', 'client_phone',
            'payment_method', 'payment_method_display',
            'payment_status', 'payment_status_display',
            'subtotal', 'discount', 'total_amount',
            'amount_paid', 'amount_due',
            'notes', 'items', 'items_count',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'receipt_number', 'local_id',
            'subtotal', 'total_amount', 'amount_due',
            'created_by', 'created_at', 'updated_at'
        ]


class SaleListSerializer(serializers.ModelSerializer):
    """Light serializer for sale listings."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    items_count = serializers.IntegerField(read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'receipt_number',
            'client_name', 'client_phone',
            'payment_method', 'payment_method_display',
            'payment_status', 'payment_status_display',
            'total_amount', 'amount_paid', 'amount_due',
            'items_count', 'created_by_name', 'created_at'
        ]


class SaleCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new sale."""
    items = SaleItemCreateSerializer(many=True, write_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'receipt_number', 'local_id',
            'client_name', 'client_phone',
            'payment_method', 'payment_status',
            'discount', 'amount_paid', 'notes',
            'items', 'subtotal', 'total_amount', 'amount_due',
            'created_at'
        ]
        read_only_fields = [
            'id', 'receipt_number', 'local_id',
            'subtotal', 'total_amount', 'amount_due',
            'created_at'
        ]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La vente doit contenir au moins un article")
        return value

    def validate_discount(self, value):
        if value < 0:
            raise serializers.ValidationError("La remise ne peut pas être négative")
        return value

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user

        # Calculate subtotal from items
        subtotal = Decimal('0')
        for item_data in items_data:
            product = Product.objects.get(pk=item_data['product_id'])
            unit_price = item_data.get('unit_price', product.unit_price)
            subtotal += item_data['quantity'] * unit_price

        # Create sale
        sale = Sale.objects.create(
            created_by=user,
            subtotal=subtotal,
            **validated_data
        )

        # Create sale items and update stock
        for item_data in items_data:
            product = Product.objects.get(pk=item_data['product_id'])
            unit_price = item_data.get('unit_price', product.unit_price)
            quantity = item_data['quantity']

            # Create sale item
            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=quantity * unit_price
            )

            # Reduce stock and create movement
            previous_quantity = product.stock_quantity
            product.stock_quantity -= int(quantity)
            product.save()

            # Create stock movement
            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.MovementType.SORTIE,
                quantity=-int(quantity),  # Negative for exit
                previous_quantity=previous_quantity,
                new_quantity=product.stock_quantity,
                reason=f"Vente {sale.receipt_number}",
                user=user
            )

        # Recalculate totals
        sale._calculate_totals()
        sale.save()

        return sale


class ReceiptSerializer(serializers.ModelSerializer):
    """Serializer for generating receipt data."""
    items = SaleItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    # Company info (could be from settings in production)
    company_name = serializers.SerializerMethodField()
    company_address = serializers.SerializerMethodField()
    company_phone = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'receipt_number',
            'client_name', 'client_phone',
            'payment_method', 'payment_method_display',
            'payment_status', 'payment_status_display',
            'subtotal', 'discount', 'total_amount',
            'amount_paid', 'amount_due',
            'notes', 'items',
            'created_by_name', 'created_at',
            'company_name', 'company_address', 'company_phone'
        ]

    def get_company_name(self, obj):
        return "Gapal du Faso"

    def get_company_address(self, obj):
        return "Ouagadougou, Burkina Faso"

    def get_company_phone(self, obj):
        return "+226 XX XX XX XX"
