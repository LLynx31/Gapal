"""
Custom permissions for role-based access control.
"""

from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Only allow admin users."""
    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsOrderManager(permissions.BasePermission):
    """Allow order managers and admins."""
    message = "Accès réservé aux gestionnaires de commandes."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_order_manager


class IsStockManager(permissions.BasePermission):
    """Allow stock managers and admins."""
    message = "Accès réservé aux gestionnaires de stocks."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_stock_manager


class IsVendor(permissions.BasePermission):
    """Allow vendors."""
    message = "Accès réservé aux vendeurs."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_vendor


class IsVendorOrOrderManager(permissions.BasePermission):
    """Allow vendors and order managers."""
    message = "Accès réservé aux vendeurs et gestionnaires de commandes."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.is_vendor or request.user.is_order_manager or request.user.is_admin


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow admin full access, others read-only."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.is_admin
