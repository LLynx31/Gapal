import 'package:flutter/foundation.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import '../models/product.dart';

/// Products provider with offline support
class ProductsProvider with ChangeNotifier {
  final DatabaseService _db;
  final SyncService _sync;

  List<Product> _products = [];
  bool _isLoading = false;
  String? _error;

  ProductsProvider(this._db, this._sync);

  List<Product> get products => _products;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Product> get availableProducts =>
      _products.where((p) => p.stockQuantity > 0).toList();

  Future<void> loadProducts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // First, try to sync from server
      if (await _sync.isOnline()) {
        await _sync.syncProductsFromServer();
      }

      // Then load from local database
      _products = await _db.getProducts();

      if (_products.isEmpty && await _sync.isOnline()) {
        // If no local products and online, sync again
        await _sync.syncProductsFromServer();
        _products = await _db.getProducts();
      }
    } catch (e) {
      _error = 'Erreur de chargement des produits';
    }

    _isLoading = false;
    notifyListeners();
  }

  Product? getProduct(int id) {
    try {
      return _products.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  List<Product> searchProducts(String query) {
    if (query.isEmpty) return availableProducts;
    final lowerQuery = query.toLowerCase();
    return availableProducts
        .where((p) => p.name.toLowerCase().contains(lowerQuery))
        .toList();
  }
}
