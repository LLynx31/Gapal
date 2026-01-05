"""
Order and OrderItem models for dairy products management.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import uuid


class Order(models.Model):
    """
    Order model representing a customer order.

    Workflow:
    1. Vendor creates order (status: nouvelle)
    2. Order manager updates status through workflow
    3. When status becomes "livree", stock is auto-decremented
    """

    class DeliveryStatus(models.TextChoices):
        NOUVELLE = 'nouvelle', 'Nouvelle'
        EN_PREPARATION = 'en_preparation', 'En préparation'
        EN_COURS = 'en_cours', 'En cours de livraison'
        LIVREE = 'livree', 'Livrée'
        ANNULEE = 'annulee', 'Annulée'

    class PaymentStatus(models.TextChoices):
        NON_PAYEE = 'non_payee', 'Non payée'
        PAYEE = 'payee', 'Payée'

    class Priority(models.TextChoices):
        BASSE = 'basse', 'Basse'
        MOYENNE = 'moyenne', 'Moyenne'
        HAUTE = 'haute', 'Haute'

    # Identifiers
    order_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='Numéro de commande'
    )
    local_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        verbose_name='ID local (sync)'
    )

    # Client information
    client_name = models.CharField(
        max_length=200,
        verbose_name='Nom du client'
    )
    client_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Téléphone'
    )

    # Delivery information
    delivery_address = models.TextField(
        blank=True,
        default='',
        verbose_name='Adresse de livraison'
    )
    delivery_date = models.DateField(
        verbose_name='Date de livraison'
    )
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.NOUVELLE,
        verbose_name='Statut livraison'
    )

    # Payment
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.NON_PAYEE,
        verbose_name='Statut paiement'
    )

    # Priority
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MOYENNE,
        verbose_name='Priorité'
    )

    # Calculated total
    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Prix total (FCFA)'
    )

    # Notes
    notes = models.TextField(
        blank=True,
        verbose_name='Notes'
    )

    # Relationships
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='orders',
        verbose_name='Créé par'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Synchronisé le'
    )

    class Meta:
        db_table = 'orders'
        verbose_name = 'Commande'
        verbose_name_plural = 'Commandes'
        ordering = ['-priority', '-created_at']

    def __str__(self):
        return f"{self.order_number} - {self.client_name}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self._generate_order_number()
        super().save(*args, **kwargs)

    def _generate_order_number(self):
        """Generate unique order number: YYYYMMDD + 4-digit sequence."""
        prefix = timezone.now().strftime('%Y%m%d')
        last_order = Order.objects.filter(
            order_number__startswith=prefix
        ).order_by('-order_number').first()

        if last_order:
            try:
                last_num = int(last_order.order_number[-4:])
                new_num = last_num + 1
            except ValueError:
                new_num = 1
        else:
            new_num = 1

        return f"{prefix}{new_num:04d}"

    def calculate_total(self):
        """Calculate total price from order items."""
        total = sum(item.subtotal for item in self.items.all())
        self.total_price = total
        return total

    @property
    def is_delivered(self):
        return self.delivery_status == self.DeliveryStatus.LIVREE

    @property
    def is_cancelled(self):
        return self.delivery_status == self.DeliveryStatus.ANNULEE

    @property
    def is_paid(self):
        return self.payment_status == self.PaymentStatus.PAYEE


class OrderItem(models.Model):
    """Individual item in an order."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Commande'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        verbose_name='Produit'
    )
    quantity = models.IntegerField(
        verbose_name='Quantité'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=0,
        verbose_name='Prix unitaire (FCFA)'
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        verbose_name='Sous-total (FCFA)'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    class Meta:
        db_table = 'order_items'
        verbose_name = 'Ligne de commande'
        verbose_name_plural = 'Lignes de commande'

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)
