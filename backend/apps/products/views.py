"""
Views for Product and Category management.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from datetime import timedelta

from .models import Product, Category
from .serializers import (
    ProductSerializer, ProductListSerializer, ProductSimpleSerializer,
    CategorySerializer
)
from apps.users.permissions import IsStockManager, IsAdminOrReadOnly


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for managing product categories."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [SearchFilter]
    search_fields = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing products.

    - List/Retrieve: All authenticated users
    - Create/Update/Delete: Stock managers and admins only
    """
    queryset = Product.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active', 'unit']
    search_fields = ['name', 'barcode', 'description']
    ordering_fields = ['name', 'unit_price', 'stock_quantity', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        if self.action == 'simple':
            return ProductSimpleSerializer
        return ProductSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'simple']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsStockManager()]

    def get_queryset(self):
        queryset = Product.objects.select_related('category')

        # Filter by low stock
        low_stock = self.request.query_params.get('low_stock')
        if low_stock == 'true':
            queryset = queryset.filter(
                stock_quantity__lte=models.F('min_stock_level')
            )

        # Filter by expiring soon
        expiring_soon = self.request.query_params.get('expiring_soon')
        if expiring_soon == 'true':
            threshold = timezone.now().date() + timedelta(days=7)
            queryset = queryset.filter(expiration_date__lte=threshold)

        # Filter by out of stock
        out_of_stock = self.request.query_params.get('out_of_stock')
        if out_of_stock == 'true':
            queryset = queryset.filter(stock_quantity__lte=0)

        # By default, only show active products
        show_inactive = self.request.query_params.get('show_inactive')
        if show_inactive != 'true':
            queryset = queryset.filter(is_active=True)

        return queryset

    def destroy(self, request, *args, **kwargs):
        """Soft delete - deactivate product instead of deleting."""
        product = self.get_object()
        product.is_active = False
        product.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def simple(self, request):
        """Get simplified product list for dropdowns."""
        products = self.get_queryset().filter(is_active=True, stock_quantity__gt=0)
        serializer = ProductSimpleSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get products with low stock."""
        from django.db.models import F
        products = Product.objects.filter(
            is_active=True,
            stock_quantity__lte=F('min_stock_level')
        ).select_related('category')
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get products expiring within 7 days."""
        threshold = timezone.now().date() + timedelta(days=7)
        products = Product.objects.filter(
            is_active=True,
            expiration_date__isnull=False,
            expiration_date__lte=threshold
        ).select_related('category').order_by('expiration_date')
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Reactivate a deactivated product."""
        product = self.get_object()
        product.is_active = True
        product.save()
        return Response({'detail': 'Produit activé.'})
