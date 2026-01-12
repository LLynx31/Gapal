"""
Models for store sales/purchases management.
"""

from django.db import models
from django.conf import settings
from decimal import Decimal
from datetime import date
import uuid


class Sale(models.Model):
    """
    Represents a store sale/purchase transaction.
    """

    class PaymentMethod(models.TextChoices):
        ESPECES = 'especes', 'Espèces'
        MOBILE_MONEY = 'mobile_money', 'Mobile Money'
        CARTE = 'carte', 'Carte Bancaire'
        CREDIT = 'credit', 'Crédit'

    class PaymentStatus(models.TextChoices):
        PAYEE = 'payee', 'Payée'
        EN_ATTENTE = 'en_attente', 'En attente'
        PARTIELLE = 'partielle', 'Paiement partiel'

    # Identifiers
    receipt_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='Numéro de reçu'
    )
    local_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        verbose_name='ID local'
    )

    # Client information (optional for walk-in customers)
    client_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Nom du client'
    )
    client_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Téléphone'
    )

    # Payment details
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.ESPECES,
        verbose_name='Mode de paiement'
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PAYEE,
        verbose_name='Statut de paiement'
    )

    # Financial
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Sous-total'
    )
    discount = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Remise'
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Montant total'
    )
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Montant payé'
    )
    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=Decimal('0'),
        verbose_name='Reste à payer'
    )

    # Notes
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name='Notes'
    )

    # Relationships
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='sales',
        verbose_name='Vendeur'
    )

    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Date de vente'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Modifié le'
    )
    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Synchronisé le'
    )

    class Meta:
        db_table = 'sales'
        verbose_name = 'Vente'
        verbose_name_plural = 'Ventes'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.receipt_number} - {self.total_amount} FCFA"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = self._generate_receipt_number()
        self._calculate_totals()
        super().save(*args, **kwargs)

    def _generate_receipt_number(self):
        """Generate unique receipt number: REC-YYYYMMDD-XXXX"""
        today = date.today()
        prefix = f"REC-{today.strftime('%Y%m%d')}"

        # Get last receipt number for today
        last_sale = Sale.objects.filter(
            receipt_number__startswith=prefix
        ).order_by('-receipt_number').first()

        if last_sale:
            last_num = int(last_sale.receipt_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1

        return f"{prefix}-{new_num:04d}"

    def _calculate_totals(self):
        """Calculate totals from items."""
        if self.pk:
            self.subtotal = sum(item.subtotal for item in self.items.all())
        self.total_amount = self.subtotal - self.discount
        self.amount_due = self.total_amount - self.amount_paid

    def calculate_total(self):
        """Public method to recalculate and save totals."""
        self._calculate_totals()
        self.save(update_fields=['subtotal', 'total_amount', 'amount_due'])

    @property
    def is_paid(self):
        return self.payment_status == self.PaymentStatus.PAYEE

    @property
    def items_count(self):
        return self.items.count()


class SaleItem(models.Model):
    """
    Individual item in a sale transaction.
    """

    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Vente'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        related_name='sale_items',
        verbose_name='Produit'
    )

    # Quantity and pricing
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Quantité'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=0,
        verbose_name='Prix unitaire'
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        verbose_name='Sous-total'
    )

    class Meta:
        db_table = 'sale_items'
        verbose_name = 'Article de vente'
        verbose_name_plural = 'Articles de vente'

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    def save(self, *args, **kwargs):
        # Calculate subtotal
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)

        # Update sale total
        if self.sale:
            self.sale.calculate_total()
