"""
Signals for Order model.
Handles automatic stock decrement on delivery.
"""

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Order


@receiver(pre_save, sender=Order)
def capture_previous_status(sender, instance, **kwargs):
    """Capture previous delivery status before save."""
    if instance.pk:
        try:
            previous = Order.objects.get(pk=instance.pk)
            instance._previous_delivery_status = previous.delivery_status
        except Order.DoesNotExist:
            instance._previous_delivery_status = None
    else:
        instance._previous_delivery_status = None


@receiver(post_save, sender=Order)
def handle_order_status_change(sender, instance, created, **kwargs):
    """
    Handle order status changes:
    - New order: Send notification
    - Delivered: Auto-decrement stock
    """
    from apps.notifications.services import create_new_order_notification

    if created:
        # New order - send notification to order managers
        create_new_order_notification(instance)
    else:
        previous_status = getattr(instance, '_previous_delivery_status', None)

        # Check if status changed to 'livree'
        if (previous_status != Order.DeliveryStatus.LIVREE and
                instance.delivery_status == Order.DeliveryStatus.LIVREE):

            # Auto-decrement stock
            from apps.stock.services import decrement_stock_for_order
            decrement_stock_for_order(instance, instance.created_by)

            # Send notification
            from apps.notifications.services import create_order_delivered_notification
            create_order_delivered_notification(instance)
