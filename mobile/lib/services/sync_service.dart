import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'database_service.dart';
import 'api_service.dart';

/// Sync service for offline-first functionality
class SyncService {
  final DatabaseService _db;
  final ApiService _api;
  final Connectivity _connectivity = Connectivity();

  StreamSubscription? _connectivitySubscription;
  bool _isSyncing = false;

  SyncService(this._db, this._api);

  void initialize() {
    // Listen for connectivity changes
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((results) {
      if (results.isNotEmpty && results.first != ConnectivityResult.none) {
        syncPendingOrders();
      }
    });
  }

  void dispose() {
    _connectivitySubscription?.cancel();
  }

  Future<bool> isOnline() async {
    final results = await _connectivity.checkConnectivity();
    return results.isNotEmpty && results.first != ConnectivityResult.none;
  }

  Future<SyncResult> syncPendingOrders() async {
    if (_isSyncing) {
      return SyncResult(synced: 0, failed: 0, pending: 0);
    }

    _isSyncing = true;
    int synced = 0;
    int failed = 0;

    try {
      final pendingOrders = await _db.getOrders(pendingOnly: true);

      if (pendingOrders.isEmpty) {
        final pending = await _db.getPendingOrdersCount();
        return SyncResult(synced: 0, failed: 0, pending: pending);
      }

      // Try batch sync first
      try {
        final syncedOrdersData = await _api.syncOrders(pendingOrders);

        // Mark all as synced
        for (var i = 0; i < pendingOrders.length; i++) {
          final order = pendingOrders[i];
          final responseData = syncedOrdersData[i];
          await _db.markOrderSynced(
            order.localId,
            responseData['id'],
            responseData['order_number'],
          );
          synced++;
        }
      } catch (e) {
        print('Batch sync failed, trying individual sync: $e');
        // Fallback to individual sync
        for (var order in pendingOrders) {
          try {
            final response = await _api.createOrder(order.toApiJson());
            await _db.markOrderSynced(
              order.localId,
              response['id'],
              response['order_number'],
            );
            synced++;
          } catch (e) {
            print('Failed to sync order ${order.localId}: $e');
            failed++;
          }
        }
      }

      // Also sync products from server
      await syncProductsFromServer();

      final pending = await _db.getPendingOrdersCount();
      return SyncResult(synced: synced, failed: failed, pending: pending);
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> syncProductsFromServer() async {
    try {
      final products = await _api.getProducts();
      await _db.syncProducts(products);
    } catch (e) {
      print('Failed to sync products: $e');
    }
  }

  Future<int> getPendingCount() async {
    return await _db.getPendingOrdersCount();
  }
}

class SyncResult {
  final int synced;
  final int failed;
  final int pending;

  SyncResult({
    required this.synced,
    required this.failed,
    required this.pending,
  });

  bool get hasErrors => failed > 0;
  bool get hasPending => pending > 0;
}
