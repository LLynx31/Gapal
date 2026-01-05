"""
Views for Order management.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db.models import Count

from .models import Order, OrderItem
from .serializers import (
    OrderSerializer, OrderListSerializer, OrderCreateSerializer,
    OrderUpdateSerializer, OrderStatusSerializer, OrderPaymentSerializer,
    OrderSyncSerializer
)
from apps.users.permissions import IsVendorOrOrderManager, IsOrderManager


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing orders.

    - Vendors: Create orders, view their own orders
    - Order Managers: View all orders, update status
    - Admins: Full access
    """
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['delivery_status', 'payment_status', 'priority']
    search_fields = ['order_number', 'client_name', 'client_phone']
    ordering_fields = ['priority', 'delivery_date', 'created_at', 'total_price']
    ordering = ['-priority', '-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = Order.objects.annotate(
            items_count=Count('items')
        ).select_related('created_by')

        # Vendors only see their own orders
        if user.is_vendor:
            queryset = queryset.filter(created_by=user)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        # Filter by delivery date
        delivery_date = self.request.query_params.get('delivery_date')
        if delivery_date:
            queryset = queryset.filter(delivery_date=delivery_date)

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return OrderListSerializer
        if self.action == 'create':
            return OrderCreateSerializer
        if self.action in ['update', 'partial_update']:
            return OrderUpdateSerializer
        if self.action == 'update_status':
            return OrderStatusSerializer
        if self.action == 'update_payment':
            return OrderPaymentSerializer
        if self.action == 'sync':
            return OrderSyncSerializer
        return OrderSerializer

    def get_permissions(self):
        if self.action in ['create', 'sync']:
            return [IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'update_status', 'update_payment', 'destroy']:
            return [IsAuthenticated(), IsOrderManager()]
        return [IsAuthenticated(), IsVendorOrOrderManager()]

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update delivery status."""
        order = self.get_object()

        # Prevent status change if cancelled
        if order.is_cancelled:
            return Response(
                {'detail': 'Impossible de modifier une commande annulée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = order.delivery_status
        new_status = serializer.validated_data['delivery_status']

        order.delivery_status = new_status
        order.save()

        # Log the change
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            entity_type='Order',
            entity_id=str(order.id),
            old_values={'delivery_status': old_status},
            new_values={'delivery_status': new_status}
        )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['patch'])
    def update_payment(self, request, pk=None):
        """Update payment status."""
        order = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = order.payment_status
        new_status = serializer.validated_data['payment_status']

        order.payment_status = new_status
        order.save()

        # Log the change
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            entity_type='Order',
            entity_id=str(order.id),
            old_values={'payment_status': old_status},
            new_values={'payment_status': new_status}
        )

        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """Sync multiple orders from mobile app."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        orders = serializer.save()

        # Mark as synced
        for order in orders:
            order.synced_at = timezone.now()
            order.save()

        return Response({
            'synced': len(orders),
            'orders': OrderListSerializer(orders, many=True).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending orders (not delivered/cancelled)."""
        orders = self.get_queryset().exclude(
            delivery_status__in=[
                Order.DeliveryStatus.LIVREE,
                Order.DeliveryStatus.ANNULEE
            ]
        )
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unpaid(self, request):
        """Get unpaid orders."""
        orders = self.get_queryset().filter(
            payment_status=Order.PaymentStatus.NON_PAYEE
        ).exclude(
            delivery_status=Order.DeliveryStatus.ANNULEE
        )
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get orders for today's delivery."""
        today = timezone.now().date()
        orders = self.get_queryset().filter(delivery_date=today)
        serializer = OrderListSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get order statistics."""
        queryset = self.get_queryset()

        stats = {
            'total': queryset.count(),
            'nouvelle': queryset.filter(delivery_status=Order.DeliveryStatus.NOUVELLE).count(),
            'en_preparation': queryset.filter(delivery_status=Order.DeliveryStatus.EN_PREPARATION).count(),
            'en_cours': queryset.filter(delivery_status=Order.DeliveryStatus.EN_COURS).count(),
            'livree': queryset.filter(delivery_status=Order.DeliveryStatus.LIVREE).count(),
            'annulee': queryset.filter(delivery_status=Order.DeliveryStatus.ANNULEE).count(),
            'payee': queryset.filter(payment_status=Order.PaymentStatus.PAYEE).count(),
            'non_payee': queryset.filter(payment_status=Order.PaymentStatus.NON_PAYEE).count(),
            'haute_priorite': queryset.filter(priority=Order.Priority.HAUTE).count(),
        }

        return Response(stats)
