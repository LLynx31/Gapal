import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../config/constants.dart';

/// Authentication provider
class AuthProvider with ChangeNotifier {
  final ApiService _api;

  bool _isAuthenticated = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;
  String? _errorMessage;

  AuthProvider(this._api) {
    _checkAuth();
  }

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get userName => _user?['first_name'] ?? _user?['username'];
  String? get username => _user?['username'];
  String? get errorMessage => _errorMessage;

  Future<void> _checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(AppConstants.accessTokenKey);

      if (token != null) {
        // Try to get user profile
        _user = await _api.getProfile();
        _isAuthenticated = true;

        // Cache user data
        await prefs.setString(AppConstants.userKey, jsonEncode(_user));
      } else {
        _isAuthenticated = false;
      }
    } catch (e) {
      _isAuthenticated = false;
      _user = null;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    print('🔑 AuthProvider: Login attempt for user: $username');
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      print('🔑 AuthProvider: Calling API login...');
      await _api.login(username, password);
      print('🔑 AuthProvider: Login successful, fetching profile...');
      _user = await _api.getProfile();
      _isAuthenticated = true;

      // Cache user data
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userKey, jsonEncode(_user));

      _errorMessage = null;
      print('🔑 AuthProvider: Login completed successfully');
      return true;
    } on ApiException catch (e) {
      print('❌ AuthProvider: ApiException caught: ${e.userMessage} (code: ${e.statusCode})');
      _isAuthenticated = false;
      _user = null;
      _errorMessage = e.userMessage;
      print('❌ AuthProvider: Error message set to: $_errorMessage');
      return false;
    } catch (e) {
      print('❌ AuthProvider: Unexpected error caught: $e');
      _isAuthenticated = false;
      _user = null;
      _errorMessage = 'Erreur inattendue: ${e.toString()}';
      print('❌ AuthProvider: Error message set to: $_errorMessage');
      return false;
    } finally {
      _isLoading = false;
      print('🔑 AuthProvider: isLoading set to false, notifying listeners');
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _api.logout();
    _isAuthenticated = false;
    _user = null;
    notifyListeners();
  }

  void clearError() {
    if (_errorMessage != null) {
      _errorMessage = null;
      notifyListeners();
    }
  }
}
