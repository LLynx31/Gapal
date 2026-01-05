"""
Audit log model for tracking user actions.
"""

from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """
    Audit log for tracking all significant user actions.
    Stored for 1 year for RGPD compliance.
    """

    class Action(models.TextChoices):
        CREATE = 'create', 'Création'
        UPDATE = 'update', 'Modification'
        DELETE = 'delete', 'Suppression'
        LOGIN = 'login', 'Connexion'
        LOGOUT = 'logout', 'Déconnexion'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Utilisateur'
    )
    action = models.CharField(
        max_length=20,
        choices=Action.choices,
        verbose_name='Action'
    )
    entity_type = models.CharField(
        max_length=100,
        verbose_name='Type d\'entité'
    )
    entity_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='ID entité'
    )
    old_values = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Anciennes valeurs'
    )
    new_values = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Nouvelles valeurs'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='Adresse IP'
    )
    user_agent = models.TextField(
        blank=True,
        verbose_name='User Agent'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Date')

    class Meta:
        db_table = 'audit_logs'
        verbose_name = 'Log d\'audit'
        verbose_name_plural = 'Logs d\'audit'
        ordering = ['-created_at']

    def __str__(self):
        user_name = self.user.username if self.user else 'Système'
        return f"{user_name} - {self.get_action_display()} - {self.entity_type}"
