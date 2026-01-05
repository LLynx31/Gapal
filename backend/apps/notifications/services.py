"""
Notification services for creating and sending notifications.
"""

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from apps.users.models import User


def send_websocket_notification(notification_data, target_role=None, target_user=None):
    """
    Send notification via WebSocket.

    Args:
        notification_data: Dict with notification info
        target_role: Role to send to (e.g., 'gestionnaire_commandes')
        target_user: Specific user to send to
    """
    channel_layer = get_channel_layer()

    if target_user:
        # Send to specific user
        async_to_sync(channel_layer.group_send)(
            f"user_{target_user.id}",
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )
    elif target_role:
        # Send to role group
        async_to_sync(channel_layer.group_send)(
            f"role_{target_role}",
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )


def create_new_order_notification(order):
    """Create notification for new order."""
    # Create notification for order managers
    notification = Notification.objects.create(
        type=Notification.NotificationType.NEW_ORDER,
        title='Nouvelle commande',
        message=f'Commande {order.order_number} de {order.client_name} - {order.total_price} FCFA',
        recipient_role=User.Role.GESTIONNAIRE_COMMANDES,
        related_order=order
    )

    # Send WebSocket notification
    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'order_id': order.id,
            'order_number': order.order_number,
            'priority': order.priority,
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.GESTIONNAIRE_COMMANDES
    )

    # Also notify admins
    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'order_id': order.id,
            'order_number': order.order_number,
            'priority': order.priority,
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.ADMIN
    )

    return notification


def create_order_delivered_notification(order):
    """Create notification when order is delivered."""
    notification = Notification.objects.create(
        type=Notification.NotificationType.ORDER_DELIVERED,
        title='Commande livrée',
        message=f'Commande {order.order_number} a été livrée à {order.client_name}',
        recipient_role=User.Role.GESTIONNAIRE_COMMANDES,
        related_order=order
    )

    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'order_id': order.id,
            'order_number': order.order_number,
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.GESTIONNAIRE_COMMANDES
    )

    return notification


def create_low_stock_notification(product):
    """Create notification for low stock."""
    # Check if recent notification exists for this product
    recent = Notification.objects.filter(
        type=Notification.NotificationType.LOW_STOCK,
        related_product=product,
        is_read=False
    ).exists()

    if recent:
        return None

    notification = Notification.objects.create(
        type=Notification.NotificationType.LOW_STOCK,
        title='Stock bas',
        message=f'{product.name}: {product.stock_quantity} {product.get_unit_display()} restants (seuil: {product.min_stock_level})',
        recipient_role=User.Role.GESTIONNAIRE_STOCKS,
        related_product=product
    )

    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'product_id': product.id,
            'product_name': product.name,
            'stock_quantity': product.stock_quantity,
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.GESTIONNAIRE_STOCKS
    )

    # Also notify admins
    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'product_id': product.id,
            'product_name': product.name,
            'stock_quantity': product.stock_quantity,
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.ADMIN
    )

    return notification


def create_expiration_notification(product):
    """Create notification for expiring product."""
    notification = Notification.objects.create(
        type=Notification.NotificationType.EXPIRATION,
        title='Produit bientôt périmé',
        message=f'{product.name} expire le {product.expiration_date.strftime("%d/%m/%Y")}',
        recipient_role=User.Role.GESTIONNAIRE_STOCKS,
        related_product=product
    )

    send_websocket_notification(
        {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'product_id': product.id,
            'product_name': product.name,
            'expiration_date': product.expiration_date.isoformat(),
            'created_at': notification.created_at.isoformat()
        },
        target_role=User.Role.GESTIONNAIRE_STOCKS
    )

    return notification
