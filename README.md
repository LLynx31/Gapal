# Gapal du Faso

Système de gestion de produits laitiers avec application mobile et interface web.

## Architecture

### Backend (Django REST Framework)
- Python 3.12+
- PostgreSQL 14+
- Redis 6+ (cache et WebSocket)
- Django Channels (notifications temps réel)

### Frontend Web (Next.js 15)
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI

### Mobile (Flutter)
- Synchronisation offline
- SQLite local
- API REST

## Prérequis

### Système
- Ubuntu 22.04 LTS ou supérieur (recommandé)
- Python 3.12+
- Node.js 18+ et npm
- PostgreSQL 14+
- Redis 6+
- Nginx (pour production)

### Outils de développement
```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip
sudo apt install -y nodejs npm
sudo apt install -y postgresql postgresql-contrib
sudo apt install -y redis-server
sudo apt install -y nginx
```

## Installation Backend (Django)

### 1. Configuration PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base de données et l'utilisateur
CREATE DATABASE gapal_db;
CREATE USER gapal_user WITH PASSWORD 'votre_mot_de_passe_securise';
ALTER ROLE gapal_user SET client_encoding TO 'utf8';
ALTER ROLE gapal_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE gapal_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE gapal_db TO gapal_user;
\q
```

### 2. Configuration Redis

```bash
# Démarrer Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Vérifier le statut
sudo systemctl status redis-server
```

### 3. Installation du Backend

```bash
# Naviguer vers le dossier backend
cd backend

# Créer l'environnement virtuel
python3.12 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configuration des variables d'environnement

Créer un fichier `.env` dans le dossier `backend/`:

```env
# Django
DEBUG=False
SECRET_KEY=votre-cle-secrete-tres-longue-et-aleatoire
ALLOWED_HOSTS=localhost,127.0.0.1,votre-domaine.com

# Database
DB_NAME=gapal_db
DB_USER=gapal_user
DB_PASSWORD=votre_mot_de_passe_securise
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS (pour le frontend web)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://votre-domaine.com

# Email (optionnel)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=votre-email@gmail.com
EMAIL_HOST_PASSWORD=votre-mot-de-passe-app
```

### 5. Migrations et données initiales

```bash
# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Charger les données de test (optionnel)
python manage.py loaddata fixtures/initial_data.json
```

### 6. Lancer le serveur de développement

```bash
# HTTP (Django)
python manage.py runserver 0.0.0.0:8000

# WebSocket (Daphne)
daphne -b 0.0.0.0 -p 8001 config.asgi:application
```

Accéder à:
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/
- WebSocket: ws://localhost:8001/ws/

## Installation Frontend Web (Next.js)

### 1. Installation des dépendances

```bash
cd web
npm install
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env.local` dans le dossier `web/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8001/ws
```

### 3. Lancer le serveur de développement

```bash
npm run dev
```

Accéder à: http://localhost:3000

### 4. Build pour production

```bash
npm run build
npm run start
```

## Installation Mobile (Flutter)

### 1. Prérequis Flutter

```bash
# Installer Flutter SDK
sudo snap install flutter --classic

# Vérifier l'installation
flutter doctor
```

### 2. Configuration

```bash
cd mobile

# Installer les dépendances
flutter pub get

# Vérifier les appareils disponibles
flutter devices
```

### 3. Configuration de l'API

Modifier `lib/config/api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:8000/api'; // Android emulator
  // static const String baseUrl = 'http://localhost:8000/api'; // iOS simulator
  // static const String baseUrl = 'https://votre-domaine.com/api'; // Production
}
```

### 4. Lancer l'application

```bash
# Android
flutter run

# Build APK
flutter build apk --release

# Build App Bundle (Google Play)
flutter build appbundle --release
```

## Déploiement en Production

### 1. Configuration Nginx

Créer `/etc/nginx/sites-available/gapal`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /static/ {
        alias /home/votre-user/Gapal/backend/staticfiles/;
    }

    location /media/ {
        alias /home/votre-user/Gapal/backend/media/;
    }
}

# Frontend Web
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activer le site:
```bash
sudo ln -s /etc/nginx/sites-available/gapal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Configuration Gunicorn (Backend HTTP)

Créer `/etc/systemd/system/gapal-gunicorn.service`:

```ini
[Unit]
Description=Gapal Gunicorn daemon
After=network.target

[Service]
User=votre-user
Group=www-data
WorkingDirectory=/home/votre-user/Gapal/backend
Environment="PATH=/home/votre-user/Gapal/backend/venv/bin"
ExecStart=/home/votre-user/Gapal/backend/venv/bin/gunicorn \
          --workers 4 \
          --bind 127.0.0.1:8000 \
          --timeout 120 \
          --access-logfile /var/log/gapal/gunicorn-access.log \
          --error-logfile /var/log/gapal/gunicorn-error.log \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

### 3. Configuration Daphne (Backend WebSocket)

Créer `/etc/systemd/system/gapal-daphne.service`:

```ini
[Unit]
Description=Gapal Daphne daemon
After=network.target

[Service]
User=votre-user
Group=www-data
WorkingDirectory=/home/votre-user/Gapal/backend
Environment="PATH=/home/votre-user/Gapal/backend/venv/bin"
ExecStart=/home/votre-user/Gapal/backend/venv/bin/daphne \
          -b 127.0.0.1 \
          -p 8001 \
          config.asgi:application

[Install]
WantedBy=multi-user.target
```

### 4. Démarrer les services

```bash
# Créer le dossier de logs
sudo mkdir -p /var/log/gapal
sudo chown votre-user:www-data /var/log/gapal

# Recharger systemd
sudo systemctl daemon-reload

# Démarrer et activer les services
sudo systemctl start gapal-gunicorn
sudo systemctl enable gapal-gunicorn
sudo systemctl start gapal-daphne
sudo systemctl enable gapal-daphne

# Vérifier le statut
sudo systemctl status gapal-gunicorn
sudo systemctl status gapal-daphne
```

### 5. Configuration PM2 pour Next.js

```bash
# Installer PM2 globalement
sudo npm install -g pm2

# Naviguer vers le dossier web
cd /home/votre-user/Gapal/web

# Build production
npm run build

# Démarrer avec PM2
pm2 start npm --name "gapal-web" -- start

# Sauvegarder la configuration PM2
pm2 save

# Activer PM2 au démarrage
pm2 startup systemd
```

### 6. Configuration SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir les certificats
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com -d api.votre-domaine.com

# Le renouvellement automatique est configuré automatiquement
# Tester le renouvellement:
sudo certbot renew --dry-run
```

### 7. Collecter les fichiers statiques Django

```bash
cd /home/votre-user/Gapal/backend
source venv/bin/activate
python manage.py collectstatic --noinput
```

## Maintenance

### Sauvegardes PostgreSQL

```bash
# Sauvegarde
pg_dump -U gapal_user gapal_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauration
psql -U gapal_user gapal_db < backup_20260105_120000.sql
```

### Logs

```bash
# Gunicorn
tail -f /var/log/gapal/gunicorn-error.log

# Daphne
sudo journalctl -u gapal-daphne -f

# Nginx
tail -f /var/log/nginx/error.log

# PM2
pm2 logs gapal-web
```

### Mises à jour

```bash
# Backend
cd /home/votre-user/Gapal/backend
source venv/bin/activate
git pull
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gapal-gunicorn
sudo systemctl restart gapal-daphne

# Frontend
cd /home/votre-user/Gapal/web
git pull
npm install
npm run build
pm2 restart gapal-web
```

## Support

Pour toute question ou problème, contacter l'équipe de développement.

## Licence

Propriétaire - Tous droits réservés
