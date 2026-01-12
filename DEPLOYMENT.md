# Guide de Déploiement - Gapal

## Scripts de déploiement disponibles

### 1. `deploy.sh` - Déploiement standard (RECOMMANDÉ)

Ce script sauvegarde automatiquement les modifications locales avant de mettre à jour.

**Utilisation:**
```bash
sudo ./deploy.sh [branche]
```

**Exemples:**
```bash
# Déployer depuis la branche main (par défaut)
sudo ./deploy.sh

# Déployer depuis une branche spécifique
sudo ./deploy.sh develop
sudo ./deploy.sh feature/new-feature
```

**Ce que fait ce script:**
1. Sauvegarde le fichier `.env`
2. Vérifie les modifications locales
3. Sauvegarde automatiquement les modifications locales (git stash)
4. Récupère les dernières mises à jour depuis Git
5. Restaure le fichier `.env`
6. Installe les dépendances Python
7. Applique les migrations de la base de données
8. Collecte les fichiers statiques
9. Redémarre le service Gunicorn
10. Recharge Nginx
11. Vérifie que l'application fonctionne

**En cas de modifications locales sauvegardées:**
- Pour voir les modifications: `git stash list`
- Pour restaurer: `git stash pop`
- Pour supprimer: `git stash drop`

---

### 2. `deploy-force.sh` - Déploiement forcé (ATTENTION)

⚠️ **ATTENTION:** Ce script écrase **TOUTES** les modifications locales!

Utilisez ce script uniquement si:
- Vous êtes sûr de ne pas avoir besoin des modifications locales
- Le déploiement standard échoue et vous voulez forcer la mise à jour
- Vous voulez repartir d'une copie propre du dépôt

**Utilisation:**
```bash
sudo ./deploy-force.sh [branche]
```

**Exemples:**
```bash
# Déploiement forcé depuis main
sudo ./deploy-force.sh

# Déploiement forcé depuis une autre branche
sudo ./deploy-force.sh develop
```

**Ce que fait ce script:**
1. Sauvegarde le fichier `.env`
2. Affiche les fichiers qui seront écrasés
3. **Reset forcé** vers la version du dépôt (git reset --hard)
4. Supprime les fichiers non suivis (git clean -fd)
5. Puis effectue les mêmes étapes que le déploiement standard

---

## Résolution du problème actuel

L'erreur que vous rencontrez:
```
Please commit your changes or stash them before you merge.
Aborting
[ERREUR] Échec du pull Git
```

**Solution 1 (Recommandée) - Utiliser le nouveau deploy.sh:**

Le nouveau script `deploy.sh` gère automatiquement ce problème en sauvegardant temporairement vos modifications locales.

```bash
# Sur le serveur
cd /home/Nycaise/web/api.gapal.tangagroup.com/app

# Télécharger le nouveau script depuis votre dépôt Git
# puis:
chmod +x deploy.sh
sudo ./deploy.sh
```

**Solution 2 - Utiliser deploy-force.sh:**

Si vous êtes sûr de ne pas avoir besoin des modifications locales:

```bash
chmod +x deploy-force.sh
sudo ./deploy-force.sh
```

**Solution 3 - Résolution manuelle:**

Sur le serveur, si vous voulez gérer manuellement:

```bash
cd /home/Nycaise/web/api.gapal.tangagroup.com/app

# Option A: Sauvegarder les modifications
git stash
git pull origin main

# Option B: Écraser les modifications
git reset --hard origin/main

# Puis continuer avec les étapes habituelles
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gapal
```

---

## Logs de déploiement

Les logs sont enregistrés dans:
```
/home/Nycaise/web/api.gapal.tangagroup.com/logs/deploy.log
```

Pour consulter les logs:
```bash
# Voir les dernières lignes
tail -f /home/Nycaise/web/api.gapal.tangagroup.com/logs/deploy.log

# Voir tout le fichier
cat /home/Nycaise/web/api.gapal.tangagroup.com/logs/deploy.log
```

---

## Vérifications après déploiement

### 1. Vérifier le statut du service
```bash
sudo systemctl status gapal
```

### 2. Vérifier les logs de l'application
```bash
# Logs Django/Gunicorn
sudo journalctl -u gapal -n 50 -f

# Logs Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 3. Tester l'API
```bash
# Test simple
curl http://127.0.0.1:8000/admin/

# Test complet
curl https://api.gapal.tangagroup.com/admin/
```

---

## Commandes utiles

### Git
```bash
# Voir l'état actuel
git status

# Voir les modifications
git diff

# Voir l'historique
git log --oneline -10

# Voir les stash
git stash list

# Restaurer un stash
git stash pop

# Supprimer un stash
git stash drop
```

### Service
```bash
# Redémarrer le service
sudo systemctl restart gapal

# Recharger la configuration (sans interruption)
sudo systemctl reload gapal

# Voir les logs en temps réel
sudo journalctl -u gapal -f

# Vérifier le statut
sudo systemctl status gapal
```

### Nginx
```bash
# Recharger Nginx
sudo systemctl reload nginx

# Redémarrer Nginx
sudo systemctl restart nginx

# Tester la configuration
sudo nginx -t

# Voir les logs
sudo tail -f /var/log/nginx/error.log
```

---

## En cas de problème

### Le service ne démarre pas

1. Vérifier les logs:
```bash
sudo journalctl -u gapal -n 100 --no-pager
```

2. Vérifier que l'environnement virtuel est activé:
```bash
cd /home/Nycaise/web/api.gapal.tangagroup.com/app/backend
source venv/bin/activate
python manage.py check
```

3. Vérifier les migrations:
```bash
python manage.py showmigrations
```

### L'application renvoie des erreurs 500

1. Activer le mode DEBUG temporairement dans `.env`:
```bash
DEBUG=True
```

2. Redémarrer le service et vérifier les logs

3. **IMPORTANT:** Remettre DEBUG=False en production!

### Les fichiers statiques ne se chargent pas

```bash
cd /home/Nycaise/web/api.gapal.tangagroup.com/app/backend
source venv/bin/activate
python manage.py collectstatic --noinput --clear
sudo systemctl restart gapal
```

---

## Workflow recommandé

1. **Avant de déployer:**
   - Tester en local
   - Commiter et pusher les changements sur Git
   - Vérifier que les tests passent

2. **Déploiement:**
   ```bash
   sudo ./deploy.sh
   ```

3. **Après le déploiement:**
   - Vérifier le statut du service
   - Tester l'API
   - Vérifier les logs pour les erreurs

4. **En cas de problème:**
   - Consulter les logs
   - Si nécessaire, revenir à la version précédente:
     ```bash
     git checkout [commit-hash]
     sudo ./deploy.sh
     ```
