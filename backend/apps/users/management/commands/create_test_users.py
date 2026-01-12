"""
Management command to create test users for permission testing.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test users for permission testing'

    def handle(self, *args, **options):
        # Test user for stock management
        stock_user, stock_created = User.objects.get_or_create(
            username='gestionnaire_stock',
            defaults={
                'email': 'stock@gapal.local',
                'first_name': 'Jean',
                'last_name': 'Stock',
                'role': User.Role.GESTIONNAIRE_STOCKS,
                'is_staff': True,
            }
        )
        if stock_created:
            stock_user.set_password('password123')
            stock_user.save()
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created stock manager: {stock_user.username} (password: password123)'
            ))
        else:
            self.stdout.write(f'✓ Stock manager already exists: {stock_user.username}')

        # Test user for order management
        order_user, order_created = User.objects.get_or_create(
            username='gestionnaire_commandes',
            defaults={
                'email': 'orders@gapal.local',
                'first_name': 'Marie',
                'last_name': 'Commandes',
                'role': User.Role.GESTIONNAIRE_COMMANDES,
                'is_staff': True,
            }
        )
        if order_created:
            order_user.set_password('password123')
            order_user.save()
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created order manager: {order_user.username} (password: password123)'
            ))
        else:
            self.stdout.write(f'✓ Order manager already exists: {order_user.username}')

        # Test vendor user
        vendor_user, vendor_created = User.objects.get_or_create(
            username='vendeur_test',
            defaults={
                'email': 'vendor@gapal.local',
                'first_name': 'Pierre',
                'last_name': 'Vendeur',
                'role': User.Role.VENDEUR,
                'is_staff': False,
            }
        )
        if vendor_created:
            vendor_user.set_password('password123')
            vendor_user.save()
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created vendor: {vendor_user.username} (password: password123)'
            ))
        else:
            self.stdout.write(f'✓ Vendor already exists: {vendor_user.username}')

        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('Test Users Created Successfully!'))
        self.stdout.write(self.style.SUCCESS('='*60))
        self.stdout.write('\nTest Credentials:')
        self.stdout.write('-'*60)
        self.stdout.write('Stock Manager (gestionnaire_stocks):')
        self.stdout.write('  Username: gestionnaire_stock')
        self.stdout.write('  Password: password123')
        self.stdout.write('  Access: Can manage stocks, view all data')
        self.stdout.write('')
        self.stdout.write('Order Manager (gestionnaire_commandes):')
        self.stdout.write('  Username: gestionnaire_commandes')
        self.stdout.write('  Password: password123')
        self.stdout.write('  Access: Can manage orders & sales, view all data')
        self.stdout.write('')
        self.stdout.write('Vendor (vendeur):')
        self.stdout.write('  Username: vendeur_test')
        self.stdout.write('  Password: password123')
        self.stdout.write('  Access: Can create orders, view all data (read-only)')
        self.stdout.write('-'*60)
