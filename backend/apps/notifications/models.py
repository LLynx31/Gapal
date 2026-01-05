"""
Notification model for real-time alerts.
"""

from django.db import models
from django.conf import settings


class Notification(models.Model):
    """
    Notification model for user alerts.

    Notifications can be targeted to:
    - A specific user (user field)
    - All users with a specific role (recipient_role field)
    """

    class NotificationType(models.TextChoices):
        NEW_ORDER = 'new_order', 'Nouvelle commande'
        ORDER_STATUS = 'order_status', 'Statut commande'
        ORDER_DELIVERED = 'order_delivered', 'Commande livrée'
        LOW_STOCK = 'low_stock', 'Stock bas'
        EXPIRATION = 'expiration', 'Produit périmé'
        SYSTEM = 'system', 'Système'

    type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        verbose_name='Type'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Titre'
    )
    message = models.TextField(
        verbose_name='Message'
    )

    # Target (either specific user or role)
    recipient_role = models.CharField(
        max_length=30,
        blank=True,
        verbose_name='Rôle destinataire'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='Utilisateur'
    )

    # Related entities
    related_order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='Commande liée'
    )
    related_product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        verbose_name='Produit lié'
    )

    is_read = models.BooleanField(
        default=False,
        verbose_name='Lu'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_type_display()})"
