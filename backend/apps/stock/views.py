"""
Views for Stock management.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import StockMovement
from .serializers import (
    StockMovementSerializer, StockEntrySerializer,
    StockExitSerializer, StockAdjustmentSerializer
)
from .services import create_stock_entry, create_stock_exit, create_stock_adjustment
from apps.products.models import Product
from apps.users.permissions import IsStockManager


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing stock movements (read-only).

    - Lecture: Tous les utilisateurs authentifiés
    """
    queryset = StockMovement.objects.select_related('product', 'user', 'order')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]  # Lecture pour tous les authentifiés
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['product', 'movement_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset


class StockEntryView(APIView):
    """Create a stock entry."""
    permission_classes = [IsAuthenticated, IsStockManager]

    def post(self, request):
        serializer = StockEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = Product.objects.get(id=serializer.validated_data['product_id'])

        # Update expiration date if provided
        expiration_date = serializer.validated_data.get('expiration_date')
        if expiration_date:
            product.expiration_date = expiration_date
            product.save(update_fields=['expiration_date'])

        movement = create_stock_entry(
            product=product,
            quantity=serializer.validated_data['quantity'],
            user=request.user,
            reason=serializer.validated_data.get('reason', '')
        )

        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED
        )


class StockExitView(APIView):
    """Create a manual stock exit."""
    permission_classes = [IsAuthenticated, IsStockManager]

    def post(self, request):
        serializer = StockExitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = Product.objects.get(id=serializer.validated_data['product_id'])
        movement = create_stock_exit(
            product=product,
            quantity=serializer.validated_data['quantity'],
            user=request.user,
            reason=serializer.validated_data.get('reason', '')
        )

        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED
        )


class StockAdjustmentView(APIView):
    """Create a stock adjustment."""
    permission_classes = [IsAuthenticated, IsStockManager]

    def post(self, request):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = Product.objects.get(id=serializer.validated_data['product_id'])
        movement = create_stock_adjustment(
            product=product,
            new_quantity=serializer.validated_data['new_quantity'],
            user=request.user,
            reason=serializer.validated_data['reason']
        )

        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED
        )


class StockAlertsView(APIView):
    """
    Get stock alerts (low stock and expiring products).

    - Lecture: Tous les utilisateurs authentifiés
    """
    permission_classes = [IsAuthenticated]  # Lecture pour tous les authentifiés

    def get(self, request):
        from django.db.models import F
        from django.utils import timezone
        from datetime import timedelta
        from apps.products.serializers import ProductListSerializer

        # Low stock products
        low_stock = Product.objects.filter(
            is_active=True,
            stock_quantity__lte=F('min_stock_level')
        )

        # Expiring products (within 7 days)
        expiring_threshold = timezone.now().date() + timedelta(days=7)
        expiring = Product.objects.filter(
            is_active=True,
            expiration_date__isnull=False,
            expiration_date__lte=expiring_threshold
        )

        # Out of stock products
        out_of_stock = Product.objects.filter(
            is_active=True,
            stock_quantity__lte=0
        )

        return Response({
            'low_stock': ProductListSerializer(low_stock, many=True).data,
            'expiring': ProductListSerializer(expiring, many=True).data,
            'out_of_stock': ProductListSerializer(out_of_stock, many=True).data,
            'counts': {
                'low_stock': low_stock.count(),
                'expiring': expiring.count(),
                'out_of_stock': out_of_stock.count()
            }
        })
