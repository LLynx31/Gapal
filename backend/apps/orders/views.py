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
from django.db.models import Count, Case, When, IntegerField, Q

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

    - Lecture: Tous les utilisateurs authentifiés
    - Création: Vendeurs + Gestionnaire commandes + Admin
    - Modification: Gestionnaire commandes + Admin
    """
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['delivery_status', 'payment_status', 'priority']
    search_fields = ['order_number', 'client_name', 'client_phone']
    ordering_fields = ['priority', 'delivery_date', 'created_at', 'total_price', 'status_order', 'priority_order']
    ordering = ['status_order', 'priority_order', '-created_at']  # Nouvelles en haut, par priorité, puis récentes en premier

    def get_queryset(self):
        # Annotation pour le tri intelligent:
        # 1. Les commandes non traitées (nouvelle, en_preparation, en_cours) en haut
        # 2. Tri par priorité: haute=1, moyenne=2, basse=3
        # 3. Les commandes livrées/annulées en bas
        queryset = Order.objects.annotate(
            items_count=Count('items'),
            # Status order: commandes actives en haut (valeur basse), terminées en bas (valeur haute)
            status_order=Case(
                When(delivery_status='nouvelle', then=1),
                When(delivery_status='en_preparation', then=2),
                When(delivery_status='en_cours', then=3),
                When(delivery_status='livree', then=10),
                When(delivery_status='annulee', then=11),
                default=5,
                output_field=IntegerField(),
            ),
            # Priority order: haute=1, moyenne=2, basse=3
            priority_order=Case(
                When(priority='haute', then=1),
                When(priority='moyenne', then=2),
                When(priority='basse', then=3),
                default=2,
                output_field=IntegerField(),
            )
        ).select_related('created_by')

        # Tous les utilisateurs authentifiés peuvent voir toutes les commandes

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
        # Lecture: tous les utilisateurs authentifiés
        if self.action in ['list', 'retrieve', 'pending', 'unpaid', 'today', 'stats']:
            return [IsAuthenticated()]
        # Création: vendeurs + gestionnaires commandes + admin
        if self.action in ['create', 'sync']:
            return [IsAuthenticated()]
        # Modification: gestionnaires commandes + admin
        return [IsAuthenticated(), IsOrderManager()]

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
        from django.db.models import Sum
        from datetime import timedelta

        queryset = self.get_queryset()
        today = timezone.now().date()

        # Daily revenue for the last 7 days
        daily_revenue = []
        daily_orders = []
        days_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        for i in range(6, -1, -1):  # 6 days ago to today
            day = today - timedelta(days=i)
            day_orders = queryset.filter(created_at__date=day)
            day_revenue = day_orders.filter(
                payment_status=Order.PaymentStatus.PAYEE
            ).aggregate(total=Sum('total_price'))['total'] or 0
            daily_revenue.append({
                'date': day.strftime('%Y-%m-%d'),
                'label': days_fr[day.weekday()],  # Lun, Mar, Mer, etc.
                'value': float(day_revenue)
            })
            daily_orders.append({
                'date': day.strftime('%Y-%m-%d'),
                'label': days_fr[day.weekday()],
                'value': day_orders.count()
            })

        # Today's statistics
        today_orders = queryset.filter(created_at__date=today)
        today_revenue = today_orders.filter(
            payment_status=Order.PaymentStatus.PAYEE
        ).aggregate(total=Sum('total_price'))['total'] or 0

        # This month's revenue
        month_orders = queryset.filter(
            created_at__year=today.year,
            created_at__month=today.month
        )
        month_revenue = month_orders.filter(
            payment_status=Order.PaymentStatus.PAYEE
        ).aggregate(total=Sum('total_price'))['total'] or 0

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
            'today': today_orders.count(),
            'revenue_today': float(today_revenue),
            'revenue_month': float(month_revenue),
            'daily_revenue': daily_revenue,
            'daily_orders': daily_orders,
        }

        return Response(stats)

    @action(detail=False, methods=['get'], url_path='pdf')
    def export_pdf(self, request):
        """Export orders as PDF report."""
        from django.http import HttpResponse
        from .pdf_generator import generate_orders_pdf

        # Get filtered queryset
        queryset = self.filter_queryset(self.get_queryset())

        # Get filter parameters for display in PDF
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'delivery_status': request.query_params.get('delivery_status'),
            'payment_status': request.query_params.get('payment_status'),
            'priority': request.query_params.get('priority'),
        }

        # Generate PDF
        pdf_buffer = generate_orders_pdf(queryset, filters)

        # Return as HTTP response
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        filename = f'rapport-commandes-{timezone.now().strftime("%Y%m%d")}.pdf'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        return response

    @action(detail=True, methods=['get'], url_path='receipt')
    def generate_receipt(self, request, pk=None):
        """Generate receipt PDF for a specific order."""
        from django.http import HttpResponse
        from .receipt_generator import generate_order_receipt

        order = self.get_object()

        # Generate receipt PDF
        pdf_buffer = generate_order_receipt(order)

        # Return as HTTP response
        response = HttpResponse(pdf_buffer, content_type='application/pdf')
        filename = f'recu-{order.order_number}.pdf'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        return response
