"""
Admin configuration for Notification model.
"""

from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'type', 'recipient_role', 'user', 'is_read', 'created_at']
    list_filter = ['type', 'is_read', 'recipient_role', 'created_at']
    search_fields = ['title', 'message']
    ordering = ['-created_at']
