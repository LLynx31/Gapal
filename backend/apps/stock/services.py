"""
Stock management services.
"""

from django.db import transaction
from .models import StockMovement
from apps.products.models import Product


@transaction.atomic
def create_stock_entry(product, quantity, user, reason=''):
    """
    Create a stock entry (add stock).

    Args:
        product: Product instance
        quantity: Quantity to add (positive)
        user: User making the entry
        reason: Reason for the entry

    Returns:
        StockMovement instance
    """
    previous_qty = product.stock_quantity
    new_qty = previous_qty + quantity

    # Update product stock
    product.stock_quantity = new_qty
    product.save()

    # Create movement record
    movement = StockMovement.objects.create(
        product=product,
        movement_type=StockMovement.MovementType.ENTREE,
        quantity=quantity,
        previous_quantity=previous_qty,
        new_quantity=new_qty,
        user=user,
        reason=reason or 'Entrée de stock'
    )

    return movement


@transaction.atomic
def create_stock_exit(product, quantity, user, reason='', order=None):
    """
    Create a stock exit (remove stock).

    Args:
        product: Product instance
        quantity: Quantity to remove (positive, will be negated)
        user: User making the exit
        reason: Reason for the exit
        order: Optional linked order

    Returns:
        StockMovement instance
    """
    previous_qty = product.stock_quantity
    new_qty = previous_qty - quantity

    # Update product stock
    product.stock_quantity = new_qty
    product.save()

    # Create movement record
    movement = StockMovement.objects.create(
        product=product,
        movement_type=StockMovement.MovementType.SORTIE,
        quantity=-quantity,
        previous_quantity=previous_qty,
        new_quantity=new_qty,
        user=user,
        reason=reason or 'Sortie de stock',
        order=order
    )

    # Check for low stock alert
    if product.is_low_stock:
        from apps.notifications.services import create_low_stock_notification
        create_low_stock_notification(product)

    return movement


@transaction.atomic
def create_stock_adjustment(product, new_quantity, user, reason=''):
    """
    Create a stock adjustment (set stock to specific value).

    Args:
        product: Product instance
        new_quantity: New stock quantity
        user: User making the adjustment
        reason: Reason for the adjustment

    Returns:
        StockMovement instance
    """
    previous_qty = product.stock_quantity
    quantity_diff = new_quantity - previous_qty

    # Update product stock
    product.stock_quantity = new_quantity
    product.save()

    # Create movement record
    movement = StockMovement.objects.create(
        product=product,
        movement_type=StockMovement.MovementType.AJUSTEMENT,
        quantity=quantity_diff,
        previous_quantity=previous_qty,
        new_quantity=new_quantity,
        user=user,
        reason=reason or 'Ajustement inventaire'
    )

    return movement


@transaction.atomic
def decrement_stock_for_order(order, user):
    """
    Decrement stock for all items in an order.
    Called when order is marked as delivered.

    Args:
        order: Order instance
        user: User who triggered the delivery

    Returns:
        List of StockMovement instances
    """
    movements = []

    for item in order.items.select_related('product').all():
        product = item.product
        previous_qty = product.stock_quantity
        new_qty = previous_qty - item.quantity

        # Update product stock
        product.stock_quantity = new_qty
        product.save()

        # Create movement record
        movement = StockMovement.objects.create(
            product=product,
            movement_type=StockMovement.MovementType.SORTIE,
            quantity=-item.quantity,
            previous_quantity=previous_qty,
            new_quantity=new_qty,
            order=order,
            user=user,
            reason=f'Livraison commande {order.order_number}'
        )
        movements.append(movement)

        # Check for low stock alert
        if product.is_low_stock:
            from apps.notifications.services import create_low_stock_notification
            create_low_stock_notification(product)

    return movements
