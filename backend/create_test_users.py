"""
Script pour créer les utilisateurs de test.
Exécution: python manage.py shell < create_test_users.py
"""

from apps.users.models import User

# Données des utilisateurs à créer
users_data = [
    {
        'username': 'gestionnaire_stock',
        'email': 'stock@gapal.local',
        'password': 'password123',
        'first_name': 'Jean',
        'last_name': 'Stock',
        'role': 'gestionnaire_stocks'
    },
    {
        'username': 'gestionnaire_commandes',
        'email': 'orders@gapal.local',
        'password': 'password123',
        'first_name': 'Marie',
        'last_name': 'Commandes',
        'role': 'gestionnaire_commandes'
    },
    {
        'username': 'vendeur_test',
        'email': 'vendor@gapal.local',
        'password': 'password123',
        'first_name': 'Pierre',
        'last_name': 'Vendeur',
        'role': 'vendeur'
    }
]

print("=== Création des utilisateurs de test ===\n")

for user_data in users_data:
    username = user_data['username']

    # Vérifier si l'utilisateur existe déjà
    if User.objects.filter(username=username).exists():
        print(f"⚠ Utilisateur '{username}' existe déjà")
        user = User.objects.get(username=username)

        # Mettre à jour le rôle si différent
        if user.role != user_data['role']:
            user.role = user_data['role']
            user.save()
            print(f"  ✓ Rôle mis à jour: {user.get_role_display()}")
        else:
            print(f"  - Rôle: {user.get_role_display()}")
    else:
        # Créer le nouvel utilisateur
        user = User.objects.create_user(
            username=user_data['username'],
            email=user_data['email'],
            password=user_data['password'],
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            role=user_data['role']
        )
        print(f"✓ Utilisateur créé: {user.username}")
        print(f"  Email: {user.email}")
        print(f"  Nom: {user.get_full_name()}")
        print(f"  Rôle: {user.get_role_display()}\n")

print("\n=== Vérification finale ===\n")
for user in User.objects.all().order_by('username'):
    print(f"- {user.username} | {user.get_full_name()} | {user.get_role_display()}")

print(f"\nTotal: {User.objects.count()} utilisateurs")
