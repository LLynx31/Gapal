import 'dart:convert';
import 'dart:developer' as developer;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/product.dart';
import '../models/order.dart';

/// API service for communicating with the Django backend
class ApiService {
  final String baseUrl = AppConstants.apiBaseUrl;

  void _log(String tag, Object? message) {
    // Use developer.log for richer logs, falls back to print in simple cases
    developer.log(message?.toString() ?? '', name: 'ApiService.$tag');
  }

  void _logRequestResponse({
    required String method,
    required Uri uri,
    Map<String, String>? headers,
    Object? requestBody,
    required int statusCode,
    String? responseBody,
  }) {
    final logMap = {
      'method': method,
      'url': uri.toString(),
      'status': statusCode,
      'headers': headers ?? {},
      'requestBody': requestBody,
      'responseBody': responseBody,
    };
    _log('HTTP', jsonEncode(logMap));
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConstants.accessTokenKey);
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // ===== AUTH =====

  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final uri = Uri.parse('$baseUrl/auth/login/');
      final body = jsonEncode({'username': username, 'password': password});
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw ApiException(
            'Délai d\'attente dépassé. Vérifiez votre connexion Internet.',
            408,
          );
        },
      );

      _logRequestResponse(
        method: 'POST',
        uri: uri,
        headers: {'Content-Type': 'application/json'},
        requestBody: {'username': username},
        statusCode: response.statusCode,
        responseBody: response.body,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        // Save tokens
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.accessTokenKey, data['access']);
        await prefs.setString(AppConstants.refreshTokenKey, data['refresh']);

        return data;
      } else if (response.statusCode == 401) {
        _log('login', 'Authentication failed: 401');
        throw ApiException('Identifiants incorrects', response.statusCode);
      } else if (response.statusCode == 400) {
        // Try to parse error message from backend
        try {
          final error = jsonDecode(response.body);
          final errorMsg = error['detail'] ?? error['non_field_errors']?.first ?? 'Erreur de connexion';
          _log('login', 'Bad request: $errorMsg');
          throw ApiException(errorMsg, response.statusCode);
        } catch (_) {
          _log('login', 'Bad request: Could not parse error');
          throw ApiException('Données de connexion invalides', response.statusCode);
        }
      } else if (response.statusCode >= 500) {
        _log('login', 'Server error: ${response.statusCode}');
        throw ApiException('Erreur serveur. Réessayez plus tard.', response.statusCode);
      }

      _log('login', 'Unknown error: ${response.statusCode}');
      throw ApiException('Erreur de connexion (${response.statusCode})', response.statusCode);
    } on ApiException catch (e) {
      _log('login', 'ApiException: ${e.message} (${e.statusCode})');
      rethrow;
    } catch (e) {
      _log('login', 'Network error: $e');
      throw ApiException(
        'Impossible de se connecter au serveur. Vérifiez votre connexion Internet.',
        0,
      );
    }
  }

  Future<Map<String, dynamic>> getProfile() async {
    try {
      final headers = await _getHeaders();
      final uri = Uri.parse('$baseUrl/auth/me/');
      final response = await http.get(uri, headers: headers).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw ApiException('Délai d\'attente dépassé', 408);
        },
      );

      _logRequestResponse(
        method: 'GET',
        uri: uri,
        headers: headers,
        requestBody: null,
        statusCode: response.statusCode,
        responseBody: response.body,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        throw ApiException('Session expirée. Reconnectez-vous.', response.statusCode);
      }

      throw ApiException('Erreur de profil (${response.statusCode})', response.statusCode);
    } on ApiException {
      rethrow;
    } catch (e) {
      _log('getProfile', 'Network error: $e');
      throw ApiException('Erreur de connexion au serveur', 0);
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.accessTokenKey);
    await prefs.remove(AppConstants.refreshTokenKey);
    await prefs.remove(AppConstants.userKey);
  }

  // ===== PRODUCTS =====

  Future<List<Product>> getProducts() async {
    try {
      final headers = await _getHeaders();
      final uri = Uri.parse('$baseUrl/products/simple/');
      final response = await http.get(uri, headers: headers).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw ApiException('Délai d\'attente dépassé', 408);
        },
      );

      _logRequestResponse(
        method: 'GET',
        uri: uri,
        headers: headers,
        requestBody: null,
        statusCode: response.statusCode,
        responseBody: response.body,
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((e) => Product.fromJson(e)).toList();
      } else if (response.statusCode == 401) {
        throw ApiException('Session expirée. Reconnectez-vous.', response.statusCode);
      }

      throw ApiException(
        'Erreur de chargement des produits (${response.statusCode})',
        response.statusCode,
      );
    } on ApiException {
      rethrow;
    } catch (e) {
      _log('getProducts', 'Network error: $e');
      throw ApiException('Erreur de connexion au serveur', 0);
    }
  }

  // ===== ORDERS =====

  Future<Map<String, dynamic>> createOrder(
    Map<String, dynamic> orderData,
  ) async {
    try {
      final headers = await _getHeaders();
      final uri = Uri.parse('$baseUrl/orders/');
      final body = jsonEncode(orderData);
      final response = await http.post(uri, headers: headers, body: body).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw ApiException('Délai d\'attente dépassé', 408);
        },
      );

      _logRequestResponse(
        method: 'POST',
        uri: uri,
        headers: headers,
        requestBody: orderData,
        statusCode: response.statusCode,
        responseBody: response.body,
      );

      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        throw ApiException('Session expirée. Reconnectez-vous.', response.statusCode);
      } else if (response.statusCode == 400) {
        try {
          final error = jsonDecode(response.body);
          final errorMsg = error['detail'] ?? 'Données invalides';
          throw ApiException(errorMsg, response.statusCode);
        } catch (_) {
          throw ApiException('Erreur de création de commande', response.statusCode);
        }
      }

      throw ApiException('Erreur de création de commande (${response.statusCode})', response.statusCode);
    } on ApiException {
      rethrow;
    } catch (e) {
      _log('createOrder', 'Network error: $e');
      throw ApiException('Erreur de connexion au serveur', 0);
    }
  }

  Future<List<Map<String, dynamic>>> syncOrders(List<Order> orders) async {
    try {
      final headers = await _getHeaders();
      final uri = Uri.parse('$baseUrl/orders/sync/');
      final payload = {'orders': orders.map((o) => o.toApiJson()).toList()};
      final body = jsonEncode(payload);
      final response = await http.post(uri, headers: headers, body: body).timeout(
        const Duration(seconds: 60), // Longer timeout for batch sync
        onTimeout: () {
          throw ApiException('Délai d\'attente dépassé pour la synchronisation', 408);
        },
      );

      _logRequestResponse(
        method: 'POST',
        uri: uri,
        headers: headers,
        requestBody: payload,
        statusCode: response.statusCode,
        responseBody: response.body,
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        return List<Map<String, dynamic>>.from(data['orders']);
      } else if (response.statusCode == 401) {
        throw ApiException('Session expirée. Reconnectez-vous.', response.statusCode);
      }

      throw ApiException('Erreur de synchronisation (${response.statusCode})', response.statusCode);
    } on ApiException {
      rethrow;
    } catch (e) {
      _log('syncOrders', 'Network error: $e');
      throw ApiException('Erreur de connexion au serveur', 0);
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() {
    if (statusCode == 0) {
      return message; // Network error
    }
    return '$message (Code: $statusCode)';
  }

  /// User-friendly error message
  String get userMessage => message;
}
