import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import '../models/order.dart';
import '../models/order_item.dart';

/// Orders provider with offline support
class OrdersProvider with ChangeNotifier {
  final DatabaseService _db;
  final SyncService _sync;

  List<Order> _orders = [];
  int _pendingCount = 0;
  bool _isLoading = false;
  bool _isOnline = true;
  String? _error;

  OrdersProvider(this._db, this._sync) {
    _checkConnectivity();
  }

  List<Order> get orders => _orders;
  int get pendingCount => _pendingCount;
  int get pendingSyncCount => _pendingCount;
  bool get isLoading => _isLoading;
  bool get isOnline => _isOnline;
  String? get error => _error;
  bool get hasPendingOrders => _pendingCount > 0;

  Future<void> _checkConnectivity() async {
    _isOnline = await _sync.isOnline();
    notifyListeners();
  }

  Future<void> loadOrders() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _orders = await _db.getOrders();
      _pendingCount = await _db.getPendingOrdersCount();
    } catch (e) {
      _error = 'Erreur de chargement des commandes';
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<String> saveOrder({
    required String clientName,
    required String clientPhone,
    required String deliveryAddress,
    required DateTime deliveryDate,
    required String priority,
    required String paymentStatus,
    required String notes,
    required List<OrderItem> items,
  }) async {
    final localId = const Uuid().v4();
    final totalPrice = items.fold<double>(
      0,
      (sum, item) => sum + item.subtotal,
    );

    final order = Order(
      localId: localId,
      clientName: clientName,
      clientPhone: clientPhone,
      deliveryAddress: deliveryAddress,
      deliveryDate: deliveryDate,
      priority: priority,
      paymentStatus: paymentStatus,
      notes: notes,
      items: items,
      totalPrice: totalPrice,
      createdAt: DateTime.now(),
    );

    await _db.saveOrder(order);
    _orders.insert(0, order);
    _pendingCount++;
    notifyListeners();

    // Try to sync immediately if online
    _trySync();

    return localId;
  }

  Future<void> deleteOrder(String localId) async {
    final order = _orders.firstWhere((o) => o.localId == localId);
    if (!order.isSynced) {
      await _db.deleteOrder(localId);
      _orders.removeWhere((o) => o.localId == localId);
      _pendingCount--;
      notifyListeners();
    }
  }

  Future<SyncResult> syncOrders() async {
    _isOnline = await _sync.isOnline();
    final result = await _sync.syncPendingOrders();
    await loadOrders();
    return result;
  }

  Future<void> _trySync() async {
    _isOnline = await _sync.isOnline();
    if (_isOnline) {
      await syncOrders();
    }
    notifyListeners();
  }

  /// Create a new order (alias for saveOrder with Order object)
  Future<String> createOrder(Order order) async {
    await _db.saveOrder(order);
    _orders.insert(0, order);
    _pendingCount++;
    notifyListeners();

    // Try to sync immediately if online
    _trySync();

    return order.localId;
  }
}
