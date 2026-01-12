#!/bin/bash

#===============================================================================
# Script de Redéploiement - Gapal Django API
# Usage: ./deploy.sh [branch]
# Exemple: ./deploy.sh main
#===============================================================================

set -e  # Arrêter en cas d'erreur

# Configuration
APP_DIR="/home/Nycaise/web/api.gapal.tangagroup.com/app"
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"
SERVICE_NAME="gapal"
BRANCH="${1:-main}"  # Branche par défaut: main
LOG_FILE="/home/Nycaise/web/api.gapal.tangagroup.com/logs/deploy.log"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Vérifier si on est root ou avec sudo
if [[ $EUID -ne 0 ]]; then
   error "Ce script doit être exécuté en tant que root (utilisez sudo)"
fi

log "========== Début du déploiement =========="
log "Branche: $BRANCH"

# 1. Aller dans le répertoire de l'application
log "1. Navigation vers le répertoire de l'application..."
cd "$APP_DIR" || error "Impossible d'accéder à $APP_DIR"

# 2. Sauvegarder les fichiers locaux importants
log "2. Sauvegarde des fichiers de configuration..."
if [ -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env" "/tmp/.env.backup"
    log "   - .env sauvegardé"
fi

# 3. Vérifier et gérer les modifications locales
log "3. Vérification des modifications locales..."
if ! git diff-index --quiet HEAD --; then
    warn "   - Modifications locales détectées"
    log "   - Sauvegarde temporaire des modifications (git stash)..."
    git stash push -m "Auto-stash avant déploiement $(date '+%Y-%m-%d %H:%M:%S')" || warn "Impossible de stash les modifications"
    STASHED=true
else
    log "   - Aucune modification locale"
    STASHED=false
fi

# 4. Récupérer les dernières modifications
log "4. Récupération des mises à jour depuis Git..."
git fetch origin || error "Échec du fetch Git"
git checkout "$BRANCH" || error "Impossible de checkout la branche $BRANCH"
git pull origin "$BRANCH" || error "Échec du pull Git"
log "   - Code mis à jour depuis la branche $BRANCH"

# 5. Optionnel: Restaurer les modifications locales si nécessaire
# if [ "$STASHED" = true ]; then
#     log "5. Application des modifications locales sauvegardées..."
#     git stash pop || warn "Impossible de restaurer les modifications locales"
# fi

# 6. Restaurer les fichiers de configuration
log "5. Restauration des fichiers de configuration..."
if [ -f "/tmp/.env.backup" ]; then
    cp "/tmp/.env.backup" "$BACKEND_DIR/.env"
    rm "/tmp/.env.backup"
    log "   - .env restauré"
fi

# 7. Activer l'environnement virtuel et installer les dépendances
log "6. Mise à jour des dépendances Python..."
cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet || warn "Certaines dépendances n'ont pas pu être installées"
    log "   - Dépendances installées"
else
    warn "   - requirements.txt non trouvé"
fi

# 8. Appliquer les migrations de base de données
log "7. Application des migrations..."
python manage.py migrate --noinput || warn "Problème lors des migrations"
log "   - Migrations appliquées"

# 9. Collecter les fichiers statiques
log "8. Collecte des fichiers statiques..."
python manage.py collectstatic --noinput || warn "Problème lors de la collecte des fichiers statiques"
log "   - Fichiers statiques collectés"

# 10. Redémarrer le service Gunicorn
log "9. Redémarrage du service $SERVICE_NAME..."
systemctl restart "$SERVICE_NAME" || error "Échec du redémarrage de $SERVICE_NAME"
sleep 2

# Vérifier que le service est bien démarré
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "   - Service $SERVICE_NAME redémarré avec succès"
else
    error "Le service $SERVICE_NAME n'a pas démarré correctement"
fi

# 11. Recharger Nginx (au cas où)
log "10. Rechargement de Nginx..."
systemctl reload nginx || warn "Problème lors du rechargement de Nginx"
log "   - Nginx rechargé"

# 12. Vérification finale
log "11. Vérification de l'application..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/admin/)

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
    log "   - Application accessible (HTTP $HTTP_CODE)"
else
    warn "   - Code HTTP inattendu: $HTTP_CODE"
fi

# Désactiver l'environnement virtuel
deactivate

log "========== Déploiement terminé avec succès =========="
log "URL: https://api.gapal.tangagroup.com"

# Afficher le statut du service
echo ""
echo "Statut du service:"
systemctl status "$SERVICE_NAME" --no-pager | head -15

# Afficher les modifications stashées si nécessaire
if [ "$STASHED" = true ]; then
    echo ""
    warn "IMPORTANT: Des modifications locales ont été sauvegardées (stash)"
    warn "Pour les voir: git stash list"
    warn "Pour les restaurer: git stash pop"
fi
