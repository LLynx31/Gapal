/// Application constants
class AppConstants {
  // API
  static const String apiBaseUrl = 'https://api.gapal.tangagroup.com/api'; // Android emulator
  // static const String apiBaseUrl = 'http://localhost:8000/api'; // iOS simulator

  // Storage keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'user';

  // Sync
  static const int syncRetryAttempts = 3;
  static const Duration syncInterval = Duration(minutes: 5);
}

/// Delivery status options
class DeliveryStatus {
  static const String nouvelle = 'nouvelle';
  static const String enPreparation = 'en_preparation';
  static const String enCours = 'en_cours';
  static const String livree = 'livree';
  static const String annulee = 'annulee';

  static const Map<String, String> labels = {
    nouvelle: 'Nouvelle',
    enPreparation: 'En préparation',
    enCours: 'En cours',
    livree: 'Livrée',
    annulee: 'Annulée',
  };
}

/// Payment status options
class PaymentStatus {
  static const String nonPayee = 'non_payee';
  static const String payee = 'payee';

  static const Map<String, String> labels = {
    nonPayee: 'Non payée',
    payee: 'Payée',
  };
}

/// Priority options
class Priority {
  static const String basse = 'basse';
  static const String moyenne = 'moyenne';
  static const String haute = 'haute';

  static const Map<String, String> labels = {
    basse: 'Basse',
    moyenne: 'Moyenne',
    haute: 'Haute',
  };
}