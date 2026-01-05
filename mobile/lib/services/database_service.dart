import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/order.dart';
import '../models/product.dart';

/// Local SQLite database service for offline support
class DatabaseService {
  static Database? _database;

  // Singleton
  static final DatabaseService instance = DatabaseService._internal();
  DatabaseService._internal();
  factory DatabaseService() => instance;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'gapal.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Products table (cached from server)
    await db.execute('''
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        unit_price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL,
        category_id INTEGER,
        category_name TEXT,
        unit TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        synced_at TEXT
      )
    ''');

    // Orders table (local + synced)
    await db.execute('''
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        local_id TEXT NOT NULL UNIQUE,
        order_number TEXT,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        delivery_status TEXT DEFAULT 'nouvelle',
        payment_status TEXT DEFAULT 'non_payee',
        priority TEXT DEFAULT 'moyenne',
        total_price REAL DEFAULT 0,
        notes TEXT,
        is_synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        synced_at TEXT
      )
    ''');

    // Order items table
    await db.execute('''
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_local_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        FOREIGN KEY (order_local_id) REFERENCES orders (local_id)
      )
    ''');
  }

  // ===== PRODUCTS =====

  Future<List<Product>> getProducts() async {
    final db = await database;
    final maps = await db.query('products', where: 'is_active = 1');
    return maps.map((map) => Product.fromMap(map)).toList();
  }

  Future<Product?> getProduct(int id) async {
    final db = await database;
    final maps = await db.query('products', where: 'id = ?', whereArgs: [id]);
    if (maps.isEmpty) return null;
    return Product.fromMap(maps.first);
  }

  Future<void> syncProducts(List<Product> products) async {
    final db = await database;
    final batch = db.batch();

    // Clear and insert fresh
    batch.delete('products');
    for (var product in products) {
      batch.insert('products', product.toMap());
    }

    await batch.commit(noResult: true);
  }

  // ===== ORDERS =====

  Future<List<Order>> getOrders({bool pendingOnly = false}) async {
    final db = await database;

    String? where;
    if (pendingOnly) {
      where = 'is_synced = 0';
    }

    final maps = await db.query(
      'orders',
      where: where,
      orderBy: 'created_at DESC',
    );

    List<Order> orders = [];
    for (var map in maps) {
      final items = await db.query(
        'order_items',
        where: 'order_local_id = ?',
        whereArgs: [map['local_id']],
      );
      orders.add(Order.fromMap(map, items));
    }
    return orders;
  }

  Future<Order?> getOrder(String localId) async {
    final db = await database;
    final maps = await db.query(
      'orders',
      where: 'local_id = ?',
      whereArgs: [localId],
    );

    if (maps.isEmpty) return null;

    final items = await db.query(
      'order_items',
      where: 'order_local_id = ?',
      whereArgs: [localId],
    );

    return Order.fromMap(maps.first, items);
  }

  Future<int> getPendingOrdersCount() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM orders WHERE is_synced = 0',
    );
    return result.first['count'] as int;
  }

  Future<String> saveOrder(Order order) async {
    final db = await database;

    await db.insert('orders', order.toMap());

    for (var item in order.items) {
      await db.insert('order_items', {
        ...item.toMap(),
        'order_local_id': order.localId,
      });
    }

    return order.localId;
  }

  Future<void> markOrderSynced(
    String localId,
    int serverId,
    String orderNumber,
  ) async {
    final db = await database;
    await db.update(
      'orders',
      {
        'server_id': serverId,
        'order_number': orderNumber,
        'is_synced': 1,
        'synced_at': DateTime.now().toIso8601String(),
      },
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  Future<void> deleteOrder(String localId) async {
    final db = await database;
    await db.delete('order_items', where: 'order_local_id = ?', whereArgs: [localId]);
    await db.delete('orders', where: 'local_id = ?', whereArgs: [localId]);
  }

  // ===== UTILS =====

  Future<void> clearAllData() async {
    final db = await database;
    await db.delete('order_items');
    await db.delete('orders');
    await db.delete('products');
  }
}
