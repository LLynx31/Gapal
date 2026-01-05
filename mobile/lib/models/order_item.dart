/// Order item model
class OrderItem {
  final int productId;
  final String productName;
  final int quantity;
  final double unitPrice;

  OrderItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
  });

  double get subtotal => quantity * unitPrice;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      productId: json['product'] is String
          ? int.parse(json['product'])
          : json['product'] as int,
      productName: json['product_name'],
      quantity: json['quantity'] is String
          ? int.parse(json['quantity'])
          : json['quantity'] as int,
      unitPrice: json['unit_price'] is String
          ? double.parse(json['unit_price'])
          : (json['unit_price'] as num).toDouble(),
    );
  }

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    return OrderItem(
      productId: map['product_id'] is String
          ? int.parse(map['product_id'])
          : map['product_id'],
      productName: map['product_name'],
      quantity: map['quantity'] is String
          ? int.parse(map['quantity'])
          : map['quantity'],
      unitPrice: map['unit_price'] is String
          ? double.parse(map['unit_price'])
          : (map['unit_price'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'product_id': productId,
      'product_name': productName,
      'quantity': quantity,
      'unit_price': unitPrice,
    };
  }

  Map<String, dynamic> toApiJson() {
    return {
      'product_id': productId,
      'quantity': quantity,
    };
  }
}
