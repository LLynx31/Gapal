"""
Views for Sales management.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db.models import Count, Sum
from datetime import timedelta

from .models import Sale, SaleItem
from .serializers import (
    SaleSerializer, SaleListSerializer, SaleCreateSerializer,
    ReceiptSerializer
)
from apps.users.permissions import IsOrderManager


class SaleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sales.

    - Lecture: Tous les utilisateurs authentifiés
    - Création/Modification: Gestionnaire commandes + Admin
    """
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['payment_method', 'payment_status']
    search_fields = ['receipt_number', 'client_name', 'client_phone']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Sale.objects.select_related('created_by').prefetch_related('items')

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return SaleListSerializer
        if self.action == 'create':
            return SaleCreateSerializer
        if self.action == 'receipt':
            return ReceiptSerializer
        return SaleSerializer

    def get_permissions(self):
        # Lecture: tous les utilisateurs authentifiés
        if self.action in ['list', 'retrieve', 'receipt', 'today', 'stats', 'recent']:
            return [IsAuthenticated()]
        # Création/Modification: gestionnaire commandes + admin
        return [IsAuthenticated(), IsOrderManager()]

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        """Get receipt data for a sale."""
        sale = self.get_object()
        serializer = ReceiptSerializer(sale)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's sales."""
        today = timezone.now().date()
        sales = self.get_queryset().filter(created_at__date=today)
        serializer = SaleListSerializer(sales, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get sales statistics."""
        queryset = self.get_queryset()

        # Today's stats
        today = timezone.now().date()
        today_sales = queryset.filter(created_at__date=today)

        # This week's stats
        week_start = today - timedelta(days=today.weekday())
        week_sales = queryset.filter(created_at__date__gte=week_start)

        # This month's stats
        month_sales = queryset.filter(
            created_at__year=today.year,
            created_at__month=today.month
        )

        # Calculate totals
        today_total = today_sales.aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        week_total = week_sales.aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )
        month_total = month_sales.aggregate(
            total=Sum('total_amount'),
            count=Count('id')
        )

        # Payment method breakdown for today
        payment_methods = today_sales.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        )

        # Unpaid/pending sales
        pending = queryset.exclude(payment_status='payee').aggregate(
            total=Sum('amount_due'),
            count=Count('id')
        )

        # Daily sales for the last 7 days
        daily_sales = []
        days_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        for i in range(6, -1, -1):  # 6 days ago to today
            day = today - timedelta(days=i)
            day_data = queryset.filter(created_at__date=day).aggregate(
                total=Sum('total_amount'),
                count=Count('id')
            )
            daily_sales.append({
                'date': day.strftime('%Y-%m-%d'),
                'label': days_fr[day.weekday()],  # Lun, Mar, Mer, etc.
                'value': float(day_data['total'] or 0),
                'count': day_data['count'] or 0
            })

        return Response({
            'today': {
                'count': today_total['count'] or 0,
                'total': float(today_total['total'] or 0),
            },
            'week': {
                'count': week_total['count'] or 0,
                'total': float(week_total['total'] or 0),
            },
            'month': {
                'count': month_total['count'] or 0,
                'total': float(month_total['total'] or 0),
            },
            'payment_methods': list(payment_methods),
            'pending': {
                'count': pending['count'] or 0,
                'total': float(pending['total'] or 0),
            },
            'daily_sales': daily_sales,
        })

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent sales (last 10)."""
        sales = self.get_queryset()[:10]
        serializer = SaleListSerializer(sales, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark a sale as fully paid."""
        sale = self.get_object()
        sale.payment_status = Sale.PaymentStatus.PAYEE
        sale.amount_paid = sale.total_amount
        sale.amount_due = 0
        sale.save()

        serializer = SaleSerializer(sale)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_payment(self, request, pk=None):
        """Add a partial payment to a sale."""
        sale = self.get_object()
        amount = request.data.get('amount', 0)

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Montant invalide'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount <= 0:
            return Response(
                {'detail': 'Le montant doit être positif'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sale.amount_paid += amount
        sale.amount_due = sale.total_amount - sale.amount_paid

        if sale.amount_due <= 0:
            sale.payment_status = Sale.PaymentStatus.PAYEE
            sale.amount_due = 0
        else:
            sale.payment_status = Sale.PaymentStatus.PARTIELLE

        sale.save()

        serializer = SaleSerializer(sale)
        return Response(serializer.data)
