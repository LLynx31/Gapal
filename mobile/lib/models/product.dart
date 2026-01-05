/// Product model
class Product {
  final int id;
  final String name;
  final double unitPrice;
  final int stockQuantity;
  final int? categoryId;
  final String? categoryName;
  final String unit;
  final bool isActive;

  Product({
    required this.id,
    required this.name,
    required this.unitPrice,
    required this.stockQuantity,
    this.categoryId,
    this.categoryName,
    required this.unit,
    this.isActive = true,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] is String ? int.parse(json['id']) : json['id'] as int,
      name: json['name'],
      unitPrice: json['unit_price'] is String
          ? double.parse(json['unit_price'])
          : (json['unit_price'] as num).toDouble(),
      stockQuantity: json['stock_quantity'] is String
          ? int.parse(json['stock_quantity'])
          : json['stock_quantity'] as int,
      categoryId: json['category'],
      categoryName: json['category_name'],
      unit: json['unit'],
      isActive: json['is_active'] ?? true,
    );
  }

  factory Product.fromMap(Map<String, dynamic> map) {
    return Product(
      id: map['id'] is String ? int.parse(map['id']) : map['id'],
      name: map['name'],
      unitPrice: map['unit_price'] is String
          ? double.parse(map['unit_price'])
          : (map['unit_price'] as num).toDouble(),
      stockQuantity: map['stock_quantity'] is String
          ? int.parse(map['stock_quantity'])
          : map['stock_quantity'],
      categoryId: map['category_id'],
      categoryName: map['category_name'],
      unit: map['unit'],
      isActive: map['is_active'] == 1,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'unit_price': unitPrice,
      'stock_quantity': stockQuantity,
      'category_id': categoryId,
      'category_name': categoryName,
      'unit': unit,
      'is_active': isActive ? 1 : 0,
    };
  }

  String get unitDisplay {
    switch (unit) {
      case 'litre':
        return 'L';
      case 'kg':
        return 'kg';
      case 'sachet':
        return 'sachet(s)';
      case 'pot':
        return 'pot(s)';
      default:
        return 'unité(s)';
    }
  }
}
