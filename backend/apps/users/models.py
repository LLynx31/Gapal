"""
User model with role-based access control for Gapal.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User model with roles for the dairy management system.

    Roles:
    - vendeur: Field salesperson who creates orders (mobile app)
    - gestionnaire_commandes: Manages orders and deliveries (web app)
    - gestionnaire_stocks: Manages products and inventory (web app)
    - admin: Full system access including user management
    """

    class Role(models.TextChoices):
        VENDEUR = 'vendeur', 'Vendeur'
        GESTIONNAIRE_COMMANDES = 'gestionnaire_commandes', 'Gestionnaire Commandes'
        GESTIONNAIRE_STOCKS = 'gestionnaire_stocks', 'Gestionnaire Stocks'
        ADMIN = 'admin', 'Administrateur'

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.VENDEUR,
        verbose_name='Rôle'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Téléphone'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        db_table = 'users'
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_order_manager(self):
        return self.role in [self.Role.GESTIONNAIRE_COMMANDES, self.Role.ADMIN]

    @property
    def is_stock_manager(self):
        return self.role in [self.Role.GESTIONNAIRE_STOCKS, self.Role.ADMIN]

    @property
    def is_vendor(self):
        return self.role == self.Role.VENDEUR
