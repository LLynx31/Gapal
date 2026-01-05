"""
Serializers for User model and authentication.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
import secrets
import string

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'phone', 'role', 'role_display', 'is_active',
            'last_login', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_login', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users (admin only)."""
    password = serializers.CharField(write_only=True, required=False)
    generated_password = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'role', 'password', 'generated_password', 'is_active'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password', None)

        # Generate random password if not provided
        if not password:
            password = self._generate_password()
            self._generated_password = password

        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def _generate_password(self, length=12):
        """Generate a random password."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(self, '_generated_password'):
            data['generated_password'] = self._generated_password
        return data


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users."""

    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone', 'role', 'is_active'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for admin password reset."""
    new_password = serializers.CharField(required=False)

    def validate_new_password(self, value):
        if value:
            validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    """Serializer for user login."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for user's own profile."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'role', 'role_display', 'last_login', 'created_at'
        ]
        read_only_fields = ['id', 'username', 'role', 'last_login', 'created_at']
