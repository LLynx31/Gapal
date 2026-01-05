"""
Product and Category models for dairy products management.
"""

from django.db import models
from django.utils import timezone
from datetime import timedelta


class Category(models.Model):
    """Product category (e.g., Lait, Yaourt, Fromage, Beurre)."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='Nom'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Description'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    class Meta:
        db_table = 'categories'
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    """Dairy product with stock tracking."""

    class Unit(models.TextChoices):
        LITRE = 'litre', 'Litre(s)'
        KG = 'kg', 'Kilogramme(s)'
        UNITE = 'unite', 'Unité(s)'
        SACHET = 'sachet', 'Sachet(s)'
        POT = 'pot', 'Pot(s)'

    name = models.CharField(
        max_length=200,
        verbose_name='Nom'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Description'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=0,
        verbose_name='Prix unitaire (FCFA)'
    )
    stock_quantity = models.IntegerField(
        default=0,
        verbose_name='Quantité en stock'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='Catégorie'
    )
    unit = models.CharField(
        max_length=20,
        choices=Unit.choices,
        default=Unit.UNITE,
        verbose_name='Unité'
    )
    barcode = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        verbose_name='Code-barres'
    )
    min_stock_level = models.IntegerField(
        default=10,
        verbose_name='Seuil stock minimum'
    )
    expiration_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Date de péremption'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Actif'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        db_table = 'products'
        verbose_name = 'Produit'
        verbose_name_plural = 'Produits'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.stock_quantity} {self.get_unit_display()})"

    @property
    def is_low_stock(self):
        """Check if stock is below minimum threshold."""
        return self.stock_quantity <= self.min_stock_level

    @property
    def is_out_of_stock(self):
        """Check if product is out of stock."""
        return self.stock_quantity <= 0

    @property
    def is_expired(self):
        """Check if product is expired."""
        if self.expiration_date:
            return self.expiration_date <= timezone.now().date()
        return False

    @property
    def is_expiring_soon(self):
        """Check if product expires within 7 days."""
        if self.expiration_date:
            return self.expiration_date <= (timezone.now().date() + timedelta(days=7))
        return False

    @property
    def days_until_expiration(self):
        """Get days until expiration."""
        if self.expiration_date:
            delta = self.expiration_date - timezone.now().date()
            return delta.days
        return None
