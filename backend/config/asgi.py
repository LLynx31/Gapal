"""
ASGI config for Gapal project.
Supports WebSocket connections via Django Channels.
"""

import os
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Import Django ASGI app after setting Django settings
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from apps.notifications.routing import websocket_urlpatterns
from apps.notifications.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
