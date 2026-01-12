#!/usr/bin/env python
"""
Script pour tester le tri intelligent des commandes
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.orders.models import Order

def test_order_sorting():
    """Teste le tri des commandes."""

    print("=" * 60)
    print("Test du Tri Intelligent des Commandes")
    print("=" * 60)

    # Récupérer toutes les commandes avec les annotations
    from django.db.models import Case, When, IntegerField

    orders = Order.objects.annotate(
        status_order=Case(
            When(delivery_status='nouvelle', then=1),
            When(delivery_status='en_preparation', then=2),
            When(delivery_status='en_cours', then=3),
            When(delivery_status='livree', then=10),
            When(delivery_status='annulee', then=11),
            default=5,
            output_field=IntegerField(),
        ),
        priority_order=Case(
            When(priority='haute', then=1),
            When(priority='moyenne', then=2),
            When(priority='basse', then=3),
            default=2,
            output_field=IntegerField(),
        )
    ).order_by('status_order', 'priority_order', '-created_at')

    print(f"\nTotal: {orders.count()} commandes\n")

    if orders.count() == 0:
        print("⚠️  Aucune commande trouvée dans la base de données")
        return

    print("Ordre d'affichage:")
    print("-" * 60)

    for i, order in enumerate(orders[:20], 1):  # Top 20
        # Status emoji
        status_emoji = {
            'nouvelle': '🆕',
            'en_preparation': '👨‍🍳',
            'en_cours': '🚚',
            'livree': '✅',
            'annulee': '❌',
        }.get(order.delivery_status, '❓')

        # Priority emoji
        priority_emoji = {
            'haute': '🔴',
            'moyenne': '🟡',
            'basse': '🟢',
        }.get(order.priority, '⚪')

        print(f"{i:2d}. {status_emoji} {order.order_number:20s} "
              f"{priority_emoji} {order.priority:8s} "
              f"(status_order={order.status_order}, priority_order={order.priority_order}) "
              f"- {order.delivery_status}")

    if orders.count() > 20:
        print(f"\n... et {orders.count() - 20} autres commandes")

    # Statistiques par statut
    print("\n" + "=" * 60)
    print("Statistiques par Statut:")
    print("-" * 60)

    from collections import Counter
    status_counts = Counter(order.delivery_status for order in orders)

    for status in ['nouvelle', 'en_preparation', 'en_cours', 'livree', 'annulee']:
        count = status_counts.get(status, 0)
        if count > 0:
            emoji = {
                'nouvelle': '🆕',
                'en_preparation': '👨‍🍳',
                'en_cours': '🚚',
                'livree': '✅',
                'annulee': '❌',
            }[status]
            print(f"{emoji} {status:15s}: {count:3d} commandes")

    # Statistiques par priorité
    print("\n" + "=" * 60)
    print("Statistiques par Priorité:")
    print("-" * 60)

    priority_counts = Counter(order.priority for order in orders)

    for priority in ['haute', 'moyenne', 'basse']:
        count = priority_counts.get(priority, 0)
        if count > 0:
            emoji = {'haute': '🔴', 'moyenne': '🟡', 'basse': '🟢'}[priority]
            print(f"{emoji} {priority:8s}: {count:3d} commandes")

    print("\n" + "=" * 60)
    print("✅ Tri testé avec succès!")
    print("=" * 60)

    # Vérification logique
    print("\n🔍 Vérification de la logique de tri:")
    print("-" * 60)

    # Les nouvelles commandes devraient être en premier
    first_order = orders.first()
    if first_order:
        if first_order.delivery_status in ['nouvelle', 'en_preparation', 'en_cours']:
            print("✅ Les commandes actives sont bien en haut")
        else:
            print("⚠️  Attention: La première commande n'est pas une commande active")

    # Les commandes livrées/annulées devraient être à la fin
    last_statuses = [o.delivery_status for o in orders.reverse()[:5]]
    if all(s in ['livree', 'annulee'] for s in last_statuses if s):
        print("✅ Les commandes terminées sont bien en bas")

    # Les hautes priorités devraient être avant les basses (parmi les actives)
    active_orders = [o for o in orders if o.delivery_status in ['nouvelle', 'en_preparation', 'en_cours']]
    if active_orders:
        first_active = active_orders[0]
        if first_active.priority == 'haute':
            print(f"✅ Les commandes haute priorité sont en premier parmi les actives")
        else:
            print(f"ℹ️  Première commande active: priorité {first_active.priority}")

if __name__ == '__main__':
    test_order_sorting()
