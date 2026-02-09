# Configuration WebSocket pour Gapal

Ce document explique comment configurer les WebSockets avec Daphne, Redis et Nginx pour le projet Gapal.

## Architecture

```
Client (Browser/Mobile)
    ↓
Nginx (Port 443/80)
    ↓
    ├─ HTTP/REST API → Gunicorn (Port 8000)
    └─ WebSocket     → Daphne (Port 8001)
             ↓
          Redis (Port 6379) - Channel Layer
```

## Prérequis

### 1. Configurer le fichier .env

Le fichier `.env` doit contenir ces variables pour les WebSockets:

```env
# Configuration de base
DEBUG=False
SECRET_KEY=votre-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1,api.gapal.tangagroup.com

# Base de données
DB_NAME=gapal_db
DB_USER=gapal_user
DB_PASSWORD=votre-mot-de-passe
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://gapal.tangagroup.com

# Redis (pour WebSocket)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. Installer Redis

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Vérifier que Redis fonctionne:
```bash
redis-cli ping
# Devrait retourner: PONG
```

### 3. Installer les dépendances Python

Dans l'environnement virtuel:
```bash
source venv/bin/activate
pip install channels daphne channels-redis
```

## Configuration

### 1. Service Daphne (WebSocket)

Copier le fichier de service:
```bash
sudo cp gapal-daphne.service.example /etc/systemd/system/gapal-daphne.service
```

Adapter les chemins dans le fichier si nécessaire, puis:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gapal-daphne
sudo systemctl start gapal-daphne
```

Vérifier le statut:
```bash
sudo systemctl status gapal-daphne
```

### 2. Configuration Nginx

Ajouter la configuration WebSocket dans le bloc `server` de Nginx:

```nginx
# Configuration HTTP normale
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Configuration WebSocket
location /ws/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeouts pour WebSocket
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

Tester et recharger Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Configuration Django

#### a. Settings (déjà fait)

Dans `config/settings/base.py`:
```python
INSTALLED_APPS = [
    'daphne',  # Doit être en premier
    'channels',
    # ... autres apps
]

ASGI_APPLICATION = 'config.asgi.application'

# Configuration Redis depuis variables d'environnement
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(REDIS_HOST, REDIS_PORT)],
        },
    },
}
```

#### b. ASGI Configuration (déjà fait)

Dans `config/asgi.py`:
```python
import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

from apps.notifications.routing import websocket_urlpatterns
from apps.notifications.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
```

#### c. WebSocket Routing (déjà fait)

Dans `apps/notifications/routing.py`:
```python
from django.urls import re_path
from .consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi()),
]
```

## Déploiement

Utilisez le script de déploiement amélioré:

```bash
cd /home/Nycaise/web/api.gapal.tangagroup.com/app/backend
sudo ./deploy.sh main
```

Le script va:
1. Mettre à jour le code depuis Git
2. Installer les dépendances
3. Vérifier Redis
4. Appliquer les migrations
5. Vider le cache Redis
6. Redémarrer Daphne (WebSocket)
7. Redémarrer Gunicorn (HTTP)
8. Recharger Nginx
9. Vérifier que tout fonctionne

## Vérifications

### 1. Vérifier les services

```bash
# Redis
sudo systemctl status redis-server
redis-cli ping

# Daphne (WebSocket)
sudo systemctl status gapal-daphne
sudo netstat -tlnp | grep 8001

# Gunicorn (HTTP)
sudo systemctl status gapal
sudo netstat -tlnp | grep 8000

# Nginx
sudo systemctl status nginx
```

### 2. Tester les WebSockets

#### Via curl:
```bash
# Tester que le port WebSocket est accessible
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://api.gapal.tangagroup.com/ws/notifications/
```

#### Via wscat (à installer):
```bash
npm install -g wscat
wscat -c "wss://api.gapal.tangagroup.com/ws/notifications/?token=YOUR_JWT_TOKEN"
```

#### Depuis le navigateur (Console DevTools):
```javascript
const token = 'YOUR_JWT_TOKEN';
const ws = new WebSocket(`wss://api.gapal.tangagroup.com/ws/notifications/?token=${token}`);

ws.onopen = () => console.log('Connecté!');
ws.onmessage = (event) => console.log('Message:', event.data);
ws.onerror = (error) => console.error('Erreur:', error);
ws.onclose = () => console.log('Déconnecté');
```

### 3. Consulter les logs

```bash
# Logs Daphne
sudo journalctl -u gapal-daphne -f

# Logs Gunicorn
sudo journalctl -u gapal -f

# Logs Redis
sudo journalctl -u redis-server -f

# Logs Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Logs Daphne access
sudo tail -f /home/Nycaise/web/api.gapal.tangagroup.com/logs/daphne-access.log
```

## Dépannage

### WebSocket se connecte mais se déconnecte immédiatement

**Problème**: Token JWT invalide ou manquant

**Solution**: Vérifier le middleware JWT dans `apps/notifications/middleware.py`

### Erreur "Redis connection refused"

**Problème**: Redis n'est pas démarré

**Solution**:
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Port 8001 déjà utilisé

**Problème**: Daphne n'a pas été arrêté proprement

**Solution**:
```bash
sudo systemctl stop gapal-daphne
sudo kill $(sudo lsof -t -i:8001)
sudo systemctl start gapal-daphne
```

### Nginx renvoie 502 Bad Gateway pour /ws/

**Problème**: Daphne n'écoute pas sur le port 8001

**Solution**:
```bash
sudo systemctl status gapal-daphne
sudo journalctl -u gapal-daphne -n 50
```

### Notifications ne sont pas envoyées

**Problème**: Channel layer Redis non configuré

**Solution**: Vérifier que `CHANNEL_LAYERS` est dans settings et que Redis fonctionne

### SSL/TLS avec WebSocket (wss://)

**Important**: Le WebSocket DOIT utiliser `wss://` (WebSocket Secure) si votre site utilise HTTPS.

Nginx gère automatiquement le SSL/TLS. Le WebSocket passe par Nginx qui fait la terminaison SSL, puis redirige vers Daphne en HTTP standard (ws://).

## Performance

### Optimisations Redis

Dans `/etc/redis/redis.conf`:
```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Redémarrer Redis:
```bash
sudo systemctl restart redis-server
```

### Monitoring

Surveiller les connexions WebSocket:
```bash
# Nombre de connexions actives sur port 8001
sudo netstat -an | grep :8001 | wc -l

# Connexions Redis
redis-cli info clients
```

## Sécurité

1. **Authentification**: Le token JWT est vérifié par le middleware
2. **CORS**: Configuré dans Django settings
3. **Rate limiting**: Peut être ajouté dans le consumer
4. **Firewall**: Seul Nginx doit être accessible de l'extérieur

```bash
# Daphne ne doit écouter que sur 127.0.0.1:8001 (pas 0.0.0.0:8001)
# Vérifier avec:
sudo netstat -tlnp | grep 8001
```

## Maintenance

### Redémarrage complet

```bash
sudo systemctl restart redis-server
sudo systemctl restart gapal-daphne
sudo systemctl restart gapal
sudo systemctl reload nginx
```

### Nettoyage du cache Redis

```bash
redis-cli FLUSHDB
```

### Mise à jour du code

Utilisez toujours le script de déploiement:
```bash
sudo ./deploy.sh main
```

## Ressources

- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Daphne Documentation](https://github.com/django/daphne)
- [Redis Documentation](https://redis.io/documentation)
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
