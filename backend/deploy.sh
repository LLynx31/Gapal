#!/bin/bash

#===============================================================================
# Script de Redéploiement - Gapal Django API avec WebSocket
# Usage: ./deploy.sh [branch]
# Exemple: ./deploy.sh main
#
# Ce script peut être placé à:
#   - /home/Nycaise/web/api.gapal.tangagroup.com/deploy.sh (racine)
#   - /home/Nycaise/web/api.gapal.tangagroup.com/app/backend/deploy.sh
#===============================================================================

set -e  # Arrêter en cas d'erreur

# Configuration
BASE_DIR="/home/Nycaise/web/api.gapal.tangagroup.com"
APP_DIR="$BASE_DIR/app"
BACKEND_DIR="$APP_DIR/backend"
WEB_DIR="$APP_DIR/web"
VENV_DIR="$BACKEND_DIR/venv"
SERVICE_NAME="gapal"
DAPHNE_SERVICE_NAME="gapal-daphne"
REDIS_SERVICE_NAME="redis-server"
BRANCH="${1:-main}"  # Branche par défaut: main
LOG_FILE="$BASE_DIR/logs/deploy.log"

# Créer le répertoire de logs s'il n'existe pas
mkdir -p "$BASE_DIR/logs"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERREUR]${NC} $1"
    echo "[ERREUR] $1" >> "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[ATTENTION]${NC} $1"
    echo "[ATTENTION] $1" >> "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Charger les variables d'environnement depuis le .env
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Configuration Redis (depuis .env ou valeurs par défaut)
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Vérifier si on est root ou avec sudo
if [[ $EUID -ne 0 ]]; then
   error "Ce script doit être exécuté en tant que root (utilisez sudo)"
fi

log "========== Début du déploiement =========="
log "Branche: $BRANCH"
log "Configuration Redis: $REDIS_HOST:$REDIS_PORT"

# 1. Aller dans le répertoire de l'application
log "1. Navigation vers le répertoire de l'application..."
cd "$APP_DIR" || error "Impossible d'accéder à $APP_DIR"

# 2. Sauvegarder les fichiers locaux importants
log "2. Sauvegarde des fichiers de configuration..."
if [ -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env" "/tmp/.env.backup"
    log "   - .env sauvegardé"
fi

# 3. Récupérer les dernières modifications
log "3. Récupération des mises à jour depuis Git..."
git fetch origin || error "Échec du fetch Git"
git checkout "$BRANCH" || error "Impossible de checkout la branche $BRANCH"
git pull origin "$BRANCH" || error "Échec du pull Git"
log "   - Code mis à jour depuis la branche $BRANCH"

# 4. Restaurer les fichiers de configuration
log "4. Restauration des fichiers de configuration..."
if [ -f "/tmp/.env.backup" ]; then
    cp "/tmp/.env.backup" "$BACKEND_DIR/.env"
    rm "/tmp/.env.backup"
    log "   - .env restauré"
fi

# 5. Activer l'environnement virtuel et installer les dépendances
log "5. Mise à jour des dépendances Python..."
cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet || warn "Certaines dépendances n'ont pas pu être installées"
    log "   - Dépendances installées (incluant channels, daphne, channels-redis)"
else
    warn "   - requirements.txt non trouvé"
fi

# 6. Vérifier que Redis est actif (nécessaire pour les WebSockets)
log "6. Vérification de Redis..."
if systemctl is-active --quiet "$REDIS_SERVICE_NAME"; then
    log "   - Redis est actif"
else
    warn "   - Redis n'est pas actif, tentative de démarrage..."
    systemctl start "$REDIS_SERVICE_NAME" || warn "Impossible de démarrer Redis"
fi

# 7. Appliquer les migrations de base de données
log "7. Application des migrations..."
python manage.py migrate --noinput || warn "Problème lors des migrations"
log "   - Migrations appliquées"

# 8. Collecter les fichiers statiques
log "8. Collecte des fichiers statiques..."
python manage.py collectstatic --noinput || warn "Problème lors de la collecte des fichiers statiques"
log "   - Fichiers statiques collectés"

# 9. Vider le cache Redis (pour les WebSockets)
log "9. Nettoyage du cache Redis..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHDB || warn "Impossible de vider le cache Redis"
log "   - Cache Redis nettoyé"

# 10. Redémarrer le service Daphne (WebSocket)
log "10. Redémarrage du service WebSocket (Daphne)..."
if systemctl list-units --full -all | grep -Fq "$DAPHNE_SERVICE_NAME.service"; then
    systemctl restart "$DAPHNE_SERVICE_NAME" || warn "Échec du redémarrage de $DAPHNE_SERVICE_NAME"
    sleep 2

    if systemctl is-active --quiet "$DAPHNE_SERVICE_NAME"; then
        log "   - Service $DAPHNE_SERVICE_NAME redémarré avec succès"
    else
        warn "   - Le service $DAPHNE_SERVICE_NAME n'a pas démarré correctement"
        info "   - Vérifiez les logs avec: journalctl -u $DAPHNE_SERVICE_NAME -n 50"
    fi
else
    warn "   - Service $DAPHNE_SERVICE_NAME non trouvé"
    info "   - Créez le service avec: sudo cp gapal-daphne.service.example /etc/systemd/system/gapal-daphne.service"
    info "   - Puis: sudo systemctl daemon-reload && sudo systemctl enable gapal-daphne && sudo systemctl start gapal-daphne"
fi

# 11. Redémarrer le service Gunicorn (HTTP)
log "11. Redémarrage du service HTTP (Gunicorn)..."
systemctl restart "$SERVICE_NAME" || error "Échec du redémarrage de $SERVICE_NAME"
sleep 2

# Vérifier que le service est bien démarré
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "   - Service $SERVICE_NAME redémarré avec succès"
else
    error "Le service $SERVICE_NAME n'a pas démarré correctement"
fi

# 12. Recharger Nginx
log "12. Rechargement de Nginx..."
nginx -t || error "Configuration Nginx invalide"
systemctl reload nginx || error "Problème lors du rechargement de Nginx"
log "   - Nginx rechargé"

# 13. Vérifications finales
log "13. Vérifications de l'application..."
sleep 3

# Vérifier HTTP (on teste /admin/ qui retourne généralement 301/302)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/admin/ || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
    log "   ✓ API HTTP accessible (HTTP $HTTP_CODE sur /admin/)"
else
    # Essayer aussi /api/users/me/ qui nécessite auth mais devrait retourner 401
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/users/me/ || echo "000")
    if [ "$HTTP_CODE2" == "401" ] || [ "$HTTP_CODE2" == "403" ]; then
        log "   ✓ API HTTP accessible (HTTP $HTTP_CODE2 sur /api/users/me/ - auth requise)"
    else
        warn "   ✗ API HTTP - Codes inattendus: /admin/=$HTTP_CODE, /api/users/me/=$HTTP_CODE2"
    fi
fi

# Vérifier WebSocket (Daphne sur port 8001)
if nc -z 127.0.0.1 8001 2>/dev/null; then
    log "   ✓ Service WebSocket (Daphne) écoute sur le port 8001"
else
    warn "   ✗ Service WebSocket (Daphne) n'est pas accessible sur le port 8001"
fi

# Vérifier Redis
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    log "   ✓ Redis répond correctement ($REDIS_HOST:$REDIS_PORT)"
else
    warn "   ✗ Redis ne répond pas ($REDIS_HOST:$REDIS_PORT)"
fi

# Désactiver l'environnement virtuel
deactivate

log "========== Déploiement terminé =========="
echo ""
echo -e "${GREEN}✓ Déploiement réussi!${NC}"
echo "URL API: https://api.gapal.tangagroup.com"
echo "WebSocket: wss://api.gapal.tangagroup.com/ws/"

# Afficher le statut des services
echo ""
echo "================= STATUT DES SERVICES ================="
echo ""
echo "1. Service HTTP (Gunicorn):"
systemctl status "$SERVICE_NAME" --no-pager | head -10
echo ""
echo "2. Service WebSocket (Daphne):"
if systemctl list-units --full -all | grep -Fq "$DAPHNE_SERVICE_NAME.service"; then
    systemctl status "$DAPHNE_SERVICE_NAME" --no-pager | head -10
else
    echo "   Service non configuré - voir instructions ci-dessous"
fi
echo ""
echo "3. Redis:"
systemctl status "$REDIS_SERVICE_NAME" --no-pager | head -10
echo ""
echo "4. Nginx:"
systemctl status nginx --no-pager | head -5
echo ""
echo "======================================================="

# Conseils de dépannage
echo ""
echo "En cas de problème:"
echo "  - Logs HTTP: journalctl -u $SERVICE_NAME -f"
echo "  - Logs WebSocket: journalctl -u $DAPHNE_SERVICE_NAME -f"
echo "  - Logs Redis: journalctl -u $REDIS_SERVICE_NAME -f"
echo "  - Logs Nginx: tail -f /var/log/nginx/error.log"
echo "  - Tester WebSocket: wscat -c wss://api.gapal.tangagroup.com/ws/notifications/"
echo ""
echo "Pour configurer Daphne (si non configuré):"
echo "  1. sudo cp $BACKEND_DIR/gapal-daphne.service.example /etc/systemd/system/gapal-daphne.service"
echo "  2. sudo systemctl daemon-reload"
echo "  3. sudo systemctl enable gapal-daphne"
echo "  4. sudo systemctl start gapal-daphne"
