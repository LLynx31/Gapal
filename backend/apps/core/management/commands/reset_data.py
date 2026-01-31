"""
Management command to reset all data except admin user.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = 'Reset all data except admin user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm data deletion',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will delete ALL data except admin users!\n'
                    'To confirm, run: python manage.py reset_data --confirm'
                )
            )
            return

        self.stdout.write(self.style.WARNING('Starting data reset...'))

        with transaction.atomic():
            # Import models
            from apps.orders.models import Order, OrderItem
            from apps.products.models import Product, Category
            from apps.sales.models import Sale, SaleItem
            from apps.stocks.models import StockMovement
            from apps.notifications.models import Notification
            from apps.audit.models import AuditLog

            # Delete orders and order items
            order_items_count = OrderItem.objects.count()
            orders_count = Order.objects.count()
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {order_items_count} order items and {orders_count} orders'
                )
            )

            # Delete sales and sale items
            sale_items_count = SaleItem.objects.count()
            sales_count = Sale.objects.count()
            SaleItem.objects.all().delete()
            Sale.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {sale_items_count} sale items and {sales_count} sales'
                )
            )

            # Delete stock movements
            stock_movements_count = StockMovement.objects.count()
            StockMovement.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {stock_movements_count} stock movements'
                )
            )

            # Delete products
            products_count = Product.objects.count()
            Product.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {products_count} products'
                )
            )

            # Delete categories
            categories_count = Category.objects.count()
            Category.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {categories_count} categories'
                )
            )

            # Delete notifications
            notifications_count = Notification.objects.count()
            Notification.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {notifications_count} notifications'
                )
            )

            # Delete audit logs
            audit_logs_count = AuditLog.objects.count()
            AuditLog.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {audit_logs_count} audit logs'
                )
            )

            # Delete non-admin users
            non_admin_users = User.objects.filter(is_superuser=False)
            non_admin_count = non_admin_users.count()
            non_admin_users.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Deleted {non_admin_count} non-admin users'
                )
            )

            # Show remaining admin users
            admin_users = User.objects.filter(is_superuser=True)
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nRemaining admin users ({admin_users.count()}):'
                )
            )
            for user in admin_users:
                self.stdout.write(f'  - {user.username} ({user.email})')

        self.stdout.write(
            self.style.SUCCESS(
                '\n✓ Data reset completed successfully!'
            )
        )
