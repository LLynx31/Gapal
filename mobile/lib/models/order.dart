import 'order_item.dart';

/// Order model
class Order {
  final String localId;
  final int? serverId;
  final String? orderNumber;
  final String clientName;
  final String clientPhone;
  final String deliveryAddress;
  final DateTime deliveryDate;
  final String deliveryStatus;
  final String paymentStatus;
  final String priority;
  final String notes;
  final List<OrderItem> items;
  final double totalPrice;
  final bool isSynced;
  final DateTime createdAt;
  final DateTime? syncedAt;

  Order({
    required this.localId,
    this.serverId,
    this.orderNumber,
    required this.clientName,
    required this.clientPhone,
    required this.deliveryAddress,
    required this.deliveryDate,
    this.deliveryStatus = 'nouvelle',
    this.paymentStatus = 'non_payee',
    this.priority = 'moyenne',
    this.notes = '',
    required this.items,
    required this.totalPrice,
    this.isSynced = false,
    required this.createdAt,
    this.syncedAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      localId: json['local_id'],
      serverId: json['id'] is String ? int.parse(json['id']) : json['id'],
      orderNumber: json['order_number'],
      clientName: json['client_name'],
      clientPhone: json['client_phone'],
      deliveryAddress: json['delivery_address'],
      deliveryDate: DateTime.parse(json['delivery_date']),
      deliveryStatus: json['delivery_status'],
      paymentStatus: json['payment_status'],
      priority: json['priority'],
      notes: json['notes'] ?? '',
      items: (json['items'] as List?)
              ?.map((e) => OrderItem.fromJson(e))
              .toList() ??
          [],
      totalPrice: json['total_price'] is String
          ? double.parse(json['total_price'])
          : (json['total_price'] as num).toDouble(),
      isSynced: true,
      createdAt: DateTime.parse(json['created_at']),
      syncedAt: json['synced_at'] != null
          ? DateTime.parse(json['synced_at'])
          : null,
    );
  }

  factory Order.fromMap(Map<String, dynamic> map, List<Map<String, dynamic>> itemMaps) {
    return Order(
      localId: map['local_id'],
      serverId: map['server_id'],
      orderNumber: map['order_number'],
      clientName: map['client_name'],
      clientPhone: map['client_phone'],
      deliveryAddress: map['delivery_address'],
      deliveryDate: DateTime.parse(map['delivery_date']),
      deliveryStatus: map['delivery_status'],
      paymentStatus: map['payment_status'],
      priority: map['priority'],
      notes: map['notes'] ?? '',
      items: itemMaps.map((e) => OrderItem.fromMap(e)).toList(),
      totalPrice: map['total_price'] is String
          ? double.parse(map['total_price'])
          : (map['total_price'] as num).toDouble(),
      isSynced: map['is_synced'] == 1,
      createdAt: DateTime.parse(map['created_at']),
      syncedAt: map['synced_at'] != null
          ? DateTime.parse(map['synced_at'])
          : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'local_id': localId,
      'server_id': serverId,
      'order_number': orderNumber,
      'client_name': clientName,
      'client_phone': clientPhone,
      'delivery_address': deliveryAddress,
      'delivery_date': deliveryDate.toIso8601String().split('T')[0],
      'delivery_status': deliveryStatus,
      'payment_status': paymentStatus,
      'priority': priority,
      'notes': notes,
      'total_price': totalPrice,
      'is_synced': isSynced ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'synced_at': syncedAt?.toIso8601String(),
    };
  }

  Map<String, dynamic> toApiJson() {
    return {
      'local_id': localId,
      'client_name': clientName,
      'client_phone': clientPhone,
      'delivery_address': deliveryAddress,
      'delivery_date': deliveryDate.toIso8601String().split('T')[0],
      'priority': priority,
      'payment_status': paymentStatus,
      'notes': notes,
      'items': items.map((e) => e.toApiJson()).toList(),
    };
  }

  Order copyWith({
    String? localId,
    int? serverId,
    String? orderNumber,
    String? clientName,
    String? clientPhone,
    String? deliveryAddress,
    DateTime? deliveryDate,
    String? deliveryStatus,
    String? paymentStatus,
    String? priority,
    String? notes,
    List<OrderItem>? items,
    double? totalPrice,
    bool? isSynced,
    DateTime? createdAt,
    DateTime? syncedAt,
  }) {
    return Order(
      localId: localId ?? this.localId,
      serverId: serverId ?? this.serverId,
      orderNumber: orderNumber ?? this.orderNumber,
      clientName: clientName ?? this.clientName,
      clientPhone: clientPhone ?? this.clientPhone,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      deliveryDate: deliveryDate ?? this.deliveryDate,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      priority: priority ?? this.priority,
      notes: notes ?? this.notes,
      items: items ?? this.items,
      totalPrice: totalPrice ?? this.totalPrice,
      isSynced: isSynced ?? this.isSynced,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
    );
  }
}
