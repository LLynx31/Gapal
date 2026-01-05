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
      return true;
    } catch (e) {
      _isAuthenticated = false;
      _user = null;
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _api.logout();
    _isAuthenticated = false;
    _user = null;
    notifyListeners();
  }
}
