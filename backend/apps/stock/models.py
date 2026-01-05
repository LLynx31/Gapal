"""
Stock movement model for tracking inventory changes.
"""

from django.db import models
from django.conf import settings


class StockMovement(models.Model):
    """
    Tracks all stock movements (entries, exits, adjustments).

    Movement types:
    - entree: Stock entry (supplier delivery, return)
    - sortie: Stock exit (order delivery, manual sale)
    - ajustement: Inventory adjustment (correction, loss)
    """

    class MovementType(models.TextChoices):
        ENTREE = 'entree', 'Entrée'
        SORTIE = 'sortie', 'Sortie'
        AJUSTEMENT = 'ajustement', 'Ajustement'

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='movements',
        verbose_name='Produit'
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MovementType.choices,
        verbose_name='Type de mouvement'
    )
    quantity = models.IntegerField(
        verbose_name='Quantité',
        help_text='Positif pour entrée, négatif pour sortie'
    )
    previous_quantity = models.IntegerField(
        verbose_name='Stock précédent'
    )
    new_quantity = models.IntegerField(
        verbose_name='Nouveau stock'
    )

    # Optional reference to order (for automatic decrements)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
        verbose_name='Commande liée'
    )

    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Raison',
        help_text='Ex: Livraison commande, Arrivage fournisseur, Vente directe'
    )

    # Who made the movement
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        verbose_name='Utilisateur'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Date')

    class Meta:
        db_table = 'stock_movements'
        verbose_name = 'Mouvement de stock'
        verbose_name_plural = 'Mouvements de stock'
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.quantity > 0 else ''
        return f"{self.product.name}: {sign}{self.quantity} ({self.get_movement_type_display()})"
