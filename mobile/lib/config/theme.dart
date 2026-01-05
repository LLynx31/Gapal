import 'package:flutter/material.dart';

/// Gapal app theme
class AppTheme {
  // Brand colors - Gapal du Faso
  static const Color primary = Color(0xFFFF9800); // Gapal Orange
  static const Color primaryColor = Color(0xFFFF9800); // Gapal Orange (alias)
  static const Color primaryDark = Color(0xFFFF8A00);
  static const Color primaryLight = Color(0xFFFFECB3);
  static const Color accent = Color(0xFFFFC107); // Gapal Yellow/Gold
  static const Color accentDark = Color(0xFFFFB300);

  // Priority colors
  static const Color priorityHigh = Color(0xFFEF4444);
  static const Color priorityMedium = Color(0xFFF97316);
  static const Color priorityLow = Color(0xFF22C55E);

  // Payment status colors
  static const Color paid = Color(0xFF22C55E);
  static const Color unpaid = Color(0xFFEF4444);

  // Theme
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  // Priority color helper
  static Color getPriorityColor(String priority) {
    switch (priority) {
      case 'haute':
        return priorityHigh;
      case 'moyenne':
        return priorityMedium;
      case 'basse':
        return priorityLow;
      default:
        return Colors.grey;
    }
  }
}
