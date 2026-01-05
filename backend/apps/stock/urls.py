"""
URL routes for stock management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StockMovementViewSet, StockEntryView, StockExitView,
    StockAdjustmentView, StockAlertsView
)

router = DefaultRouter()
router.register('movements', StockMovementViewSet, basename='stock-movement')

urlpatterns = [
    path('entry/', StockEntryView.as_view(), name='stock-entry'),
    path('exit/', StockExitView.as_view(), name='stock-exit'),
    path('adjustment/', StockAdjustmentView.as_view(), name='stock-adjustment'),
    path('alerts/', StockAlertsView.as_view(), name='stock-alerts'),
] + router.urls
