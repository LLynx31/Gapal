"""
WebSocket consumers for real-time notifications.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications.

    Users join:
    - Their personal group: user_{user_id}
    - Their role group: role_{role}

    This allows sending notifications to:
    - Specific users
    - All users with a specific role
    """

    async def connect(self):
        self.user = self.scope["user"]

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Join user-specific group
        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )

        # Join role-specific group
        self.role_group = f"role_{self.user.role}"
        await self.channel_layer.group_add(
            self.role_group,
            self.channel_name
        )

        await self.accept()

        # Send initial unread count
        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'init',
            'unread_count': unread_count
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )
        if hasattr(self, 'role_group'):
            await self.channel_layer.group_discard(
                self.role_group,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'mark_read':
                notification_id = data.get('notification_id')
                await self.mark_notification_read(notification_id)

            elif action == 'mark_all_read':
                await self.mark_all_read()

            elif action == 'get_unread_count':
                count = await self.get_unread_count()
                await self.send(text_data=json.dumps({
                    'type': 'unread_count',
                    'count': count
                }))

        except json.JSONDecodeError:
            pass

    async def notification_message(self, event):
        """Send notification to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))

    async def order_update(self, event):
        """Send order update to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'data': event['data']
        }))

    async def stock_alert(self, event):
        """Send stock alert to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'stock_alert',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_unread_count(self):
        from .models import Notification
        from django.db import models
        return Notification.objects.filter(
            is_read=False
        ).filter(
            models.Q(user=self.user) |
            models.Q(recipient_role=self.user.role)
        ).count()

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        from .models import Notification
        Notification.objects.filter(id=notification_id).update(is_read=True)

    @database_sync_to_async
    def mark_all_read(self):
        from .models import Notification
        from django.db import models
        Notification.objects.filter(
            is_read=False
        ).filter(
            models.Q(user=self.user) |
            models.Q(recipient_role=self.user.role)
        ).update(is_read=True)
