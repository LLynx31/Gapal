# Correction des Problèmes de Production - Application Mobile

## Problème Initial

L'application mobile fonctionnait correctement en mode développement mais échouait silencieusement en production (APK installé sur téléphone réel), sans aucun feedback utilisateur lors des tentatives de connexion.

## Causes Identifiées

### 1. ❌ Permissions Internet Manquantes
**Problème**: L'application n'avait pas les permissions nécessaires pour accéder à Internet dans le AndroidManifest.xml.

**Impact**: Les appels API échouaient silencieusement, sans erreur visible pour l'utilisateur.

### 2. ❌ Gestion d'Erreurs Insuffisante
**Problème**: Le code n'attrapait pas correctement les erreurs réseau et n'affichait pas de messages clairs à l'utilisateur.

**Impact**:
- Aucun feedback lors d'erreurs réseau
- Messages d'erreur génériques ("Exception: ...")
- Impossible de distinguer entre erreur réseau, identifiants incorrects, serveur down, etc.

### 3. ❌ Configuration HTTPS Manquante
**Problème**: Pas de configuration de sécurité réseau pour Android, ce qui peut causer des problèmes avec les certificats HTTPS.

**Impact**: Connexions HTTPS potentiellement bloquées ou non sécurisées.

### 4. ❌ Pas de Timeout sur les Requêtes
**Problème**: Les requêtes HTTP n'avaient pas de timeout, donc l'app pouvait rester bloquée indéfiniment.

**Impact**: Application qui semble "gelée" sans indication à l'utilisateur.

## Solutions Implémentées

### 1. ✅ Ajout des Permissions Internet

**Fichier**: [mobile/android/app/src/main/AndroidManifest.xml](mobile/android/app/src/main/AndroidManifest.xml#L2-L4)

```xml
<!-- Internet permissions required for API calls -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**Pourquoi c'est important**:
- `INTERNET` permet à l'app de faire des requêtes réseau
- `ACCESS_NETWORK_STATE` permet de vérifier si le réseau est disponible

### 2. ✅ Configuration de Sécurité Réseau

**Fichier créé**: [mobile/android/app/src/main/res/xml/network_security_config.xml](mobile/android/app/src/main/res/xml/network_security_config.xml)

```xml
<network-security-config>
    <!-- Production: HTTPS uniquement -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Domaine API autorisé -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.gapal.tangagroup.com</domain>
    </domain-config>

    <!-- Localhost pour développement -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

**Référencé dans AndroidManifest**:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="false">
```

**Avantages**:
- Force l'utilisation de HTTPS en production
- Accepte les certificats système (Let's Encrypt, etc.)
- Permet localhost en développement

### 3. ✅ Amélioration de la Gestion d'Erreurs dans ApiService

**Fichier**: [mobile/lib/services/api_service.dart](mobile/lib/services/api_service.dart)

**Changements**:

#### A. Ajout de Timeouts
```dart
final response = await http.post(uri, headers: headers, body: body).timeout(
  const Duration(seconds: 30),
  onTimeout: () {
    throw ApiException(
      'Délai d\'attente dépassé. Vérifiez votre connexion Internet.',
      408,
    );
  },
);
```

#### B. Messages d'Erreurs Spécifiques par Code HTTP

**Login** ([api_service.dart:52-113](mobile/lib/services/api_service.dart#L52-L113)):
```dart
if (response.statusCode == 200) {
  // Success
} else if (response.statusCode == 401) {
  throw ApiException('Identifiants incorrects', 401);
} else if (response.statusCode == 400) {
  // Parse backend error message
  final error = jsonDecode(response.body);
  final errorMsg = error['detail'] ?? 'Données de connexion invalides';
  throw ApiException(errorMsg, 400);
} else if (response.statusCode >= 500) {
  throw ApiException('Erreur serveur. Réessayez plus tard.', response.statusCode);
}
```

#### C. Catch des Erreurs Réseau
```dart
try {
  // HTTP request
} on ApiException {
  rethrow; // Re-throw our custom exceptions
} catch (e) {
  // Catch network errors (DNS, connection refused, etc.)
  throw ApiException(
    'Impossible de se connecter au serveur. Vérifiez votre connexion Internet.',
    0,
  );
}
```

**Messages d'erreur maintenant affichés**:
- ✅ "Identifiants incorrects" (401)
- ✅ "Données de connexion invalides" (400)
- ✅ "Erreur serveur. Réessayez plus tard." (500+)
- ✅ "Délai d'attente dépassé. Vérifiez votre connexion Internet." (timeout)
- ✅ "Impossible de se connecter au serveur. Vérifiez votre connexion Internet." (erreur réseau)
- ✅ "Session expirée. Reconnectez-vous." (401 sur autres endpoints)

### 4. ✅ Amélioration de ApiException

**Fichier**: [mobile/lib/services/api_service.dart:285-301](mobile/lib/services/api_service.dart#L285-L301)

```dart
class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() {
    if (statusCode == 0) {
      return message; // Network error, no status code
    }
    return '$message (Code: $statusCode)';
  }

  /// User-friendly error message
  String get userMessage => message;
}
```

**Utilisation dans l'UI**:
```dart
on ApiException catch (e) {
  _errorMessage = e.userMessage; // Message propre sans "Exception: ..."
}
```

### 5. ✅ Amélioration du AuthProvider

**Fichier**: [mobile/lib/providers/auth_provider.dart:54-84](mobile/lib/providers/auth_provider.dart#L54-L84)

```dart
Future<bool> login(String username, String password) async {
  _isLoading = true;
  _errorMessage = null;
  notifyListeners();

  try {
    await _api.login(username, password);
    _user = await _api.getProfile();
    _isAuthenticated = true;

    // Cache user data
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.userKey, jsonEncode(_user));

    _errorMessage = null;
    return true;
  } on ApiException catch (e) {
    _isAuthenticated = false;
    _user = null;
    _errorMessage = e.userMessage; // ✅ Message propre
    return false;
  } catch (e) {
    _isAuthenticated = false;
    _user = null;
    _errorMessage = 'Erreur inattendue: ${e.toString()}';
    return false;
  } finally {
    _isLoading = false;
    notifyListeners();
  }
}
```

**L'écran de login affiche déjà le message d'erreur** ([login_screen.dart:35-42](mobile/lib/screens/login_screen.dart#L35-L42)):
```dart
if (!success && mounted) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(authProvider.errorMessage ?? 'Erreur de connexion'),
      backgroundColor: Colors.red,
    ),
  );
}
```

## Configuration API

**Fichier**: [mobile/lib/config/constants.dart:4](mobile/lib/config/constants.dart#L4)

```dart
static const String apiBaseUrl = 'https://api.gapal.tangagroup.com/api';
```

**Assurez-vous que**:
- ✅ L'URL utilise HTTPS (pas HTTP)
- ✅ Le serveur a un certificat SSL valide
- ✅ Le domaine est accessible depuis Internet (pas localhost)
- ✅ Le firewall du serveur autorise les connexions HTTPS (port 443)

## Comment Tester

### 1. Rebuild l'Application

```bash
cd mobile

# Nettoyer le build précédent
flutter clean

# Obtenir les dépendances
flutter pub get

# Builder l'APK de production
flutter build apk --release

# Ou builder un APK de debug avec les logs
flutter build apk --debug
```

**APK générés**:
- Release: `build/app/outputs/flutter-apk/app-release.apk`
- Debug: `build/app/outputs/flutter-apk/app-debug.apk`

### 2. Installer sur un Téléphone Réel

```bash
# Connecter le téléphone via USB (activer le débogage USB)
flutter install

# Ou copier l'APK et installer manuellement
```

### 3. Tests à Effectuer

#### Test 1: Identifiants Incorrects
**Action**: Taper un mauvais mot de passe
**Attendu**: Message "Identifiants incorrects" s'affiche

#### Test 2: Pas de Connexion Internet
**Action**: Désactiver WiFi et données mobiles, puis essayer de se connecter
**Attendu**: Message "Impossible de se connecter au serveur. Vérifiez votre connexion Internet."

#### Test 3: Serveur Down
**Action**: Utiliser une URL d'API invalide temporairement
**Attendu**: Message d'erreur de connexion

#### Test 4: Connexion Lente
**Action**: Utiliser une connexion très lente (3G)
**Attendu**: Soit succès, soit timeout après 30 secondes avec message approprié

#### Test 5: Connexion Réussie
**Action**: Identifiants corrects avec connexion Internet
**Attendu**: Connexion réussie, navigation vers l'écran d'accueil

### 4. Vérifier les Logs (APK Debug)

```bash
# Voir les logs en temps réel
flutter logs

# Ou avec adb
adb logcat -s flutter
```

**Logs à rechercher**:
```
I/flutter: ApiService.HTTP: {"method":"POST","url":"https://api.gapal.tangagroup.com/api/auth/login/","status":200,...}
I/flutter: ApiService.login: Network error: ...
```

## Vérifications Backend

### 1. Vérifier que le Serveur est Accessible

```bash
# Test depuis votre ordinateur
curl -I https://api.gapal.tangagroup.com/api/auth/login/

# Devrait retourner:
# HTTP/1.1 405 Method Not Allowed (normal, besoin de POST)
# ou HTTP/1.1 200 OK
```

### 2. Vérifier le Certificat SSL

```bash
# Test SSL
curl -v https://api.gapal.tangagroup.com 2>&1 | grep -i ssl

# Devrait montrer un certificat valide
```

### 3. Tester l'API Login

```bash
curl -X POST https://api.gapal.tangagroup.com/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Devrait retourner:
# {"access":"...","refresh":"..."}
```

### 4. Vérifier les CORS (pour debug web uniquement)

Les apps mobiles natives ne sont pas affectées par CORS, mais pour le debug web:

```python
# backend/config/settings/base.py
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://api.gapal.tangagroup.com',
]
```

## Problèmes Courants et Solutions

### Problème: "HandshakeException: Handshake error"
**Cause**: Certificat SSL invalide ou expiré
**Solution**:
1. Vérifier que le certificat est valide
2. Renouveler avec Let's Encrypt si nécessaire
3. Vérifier la configuration nginx/apache

### Problème: "SocketException: Failed host lookup"
**Cause**: DNS ne résout pas le domaine
**Solution**:
1. Vérifier que le domaine existe: `nslookup api.gapal.tangagroup.com`
2. Vérifier la connexion Internet du téléphone
3. Essayer avec un autre DNS (8.8.8.8)

### Problème: L'app se ferme sans message
**Cause**: Crash non attrapé
**Solution**:
1. Installer l'APK debug (pas release)
2. Activer le débogage USB
3. Lancer `flutter logs` pour voir l'erreur exacte

### Problème: "Session expirée" après quelques minutes
**Cause**: Token JWT expire trop vite
**Solution**: Augmenter la durée dans le backend
```python
# backend/config/settings/base.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),  # Au lieu de 5 minutes
}
```

### Problème: Timeout même avec bonne connexion
**Cause**: Serveur backend trop lent
**Solution**:
1. Vérifier les logs Django pour les requêtes lentes
2. Optimiser les requêtes SQL (indexes, select_related)
3. Augmenter le timeout si nécessaire (actuellement 30s)

## Checklist de Déploiement

Avant de distribuer l'APK:

- [ ] URL API configurée correctement (HTTPS, domaine accessible)
- [ ] Certificat SSL valide sur le serveur
- [ ] Permissions Internet dans AndroidManifest
- [ ] Configuration network_security_config en place
- [ ] Tests effectués sur téléphone réel (pas émulateur)
- [ ] Test avec mauvais identifiants → message clair
- [ ] Test sans Internet → message clair
- [ ] Test avec bons identifiants → connexion réussie
- [ ] Logs vérifiés (pas d'erreurs non gérées)
- [ ] APK signé pour production (si distribution)

## Commandes Utiles

```bash
# Rebuild complet
flutter clean && flutter pub get && flutter build apk --release

# Installer sur téléphone connecté
flutter install

# Voir les logs en temps réel
flutter logs

# Voir les périphériques connectés
flutter devices

# Analyser l'APK
flutter build apk --analyze-size

# Builder pour iOS (macOS uniquement)
flutter build ios
```

## Prochaines Améliorations

1. **Retry Automatique**: Réessayer automatiquement lors d'échecs réseau temporaires
2. **Cache des Erreurs**: Logger les erreurs localement pour debug
3. **Détection Réseau**: Détecter si WiFi/données mobiles sont disponibles avant de faire des requêtes
4. **Mode Offline**: Afficher un message si aucune connexion n'est disponible
5. **Refresh Token**: Implémenter le rafraîchissement automatique du token expiré
6. **Sentry/Crashlytics**: Intégrer un système de reporting d'erreurs en production

## Support

Si le problème persiste:

1. **Vérifier les logs**: `flutter logs` ou `adb logcat -s flutter`
2. **Tester l'API directement**: `curl` depuis un terminal
3. **Vérifier le certificat SSL**: Outils en ligne comme SSL Labs
4. **Tester sur un autre téléphone**: Éliminer les problèmes matériels/réseau
5. **Build debug**: Utiliser `flutter build apk --debug` pour avoir plus d'infos

**Logs importants à fournir**:
- Output de `flutter logs`
- Output de `curl -v https://api.gapal.tangagroup.com/api/auth/login/`
- Version Android du téléphone
- Message d'erreur exact affiché dans l'app
