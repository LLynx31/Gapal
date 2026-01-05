import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../providers/products_provider.dart';
import '../config/theme.dart';
import '../widgets/sync_indicator.dart';
import 'orders/orders_list_screen.dart';
import 'orders/create_order_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    // Load data after the first frame to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final productsProvider = context.read<ProductsProvider>();
    final ordersProvider = context.read<OrdersProvider>();

    await Future.wait([
      productsProvider.loadProducts(),
      ordersProvider.loadOrders(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/images/gapal_logo.png',
              height: 32,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 12),
            const Text('Gapal du Faso'),
          ],
        ),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          // Sync indicator
          Consumer<OrdersProvider>(
            builder: (context, orders, _) {
              return SyncIndicator(
                pendingCount: orders.pendingSyncCount,
                isOnline: orders.isOnline,
                onSync: orders.syncOrders,
              );
            },
          ),
          const SizedBox(width: 8),
          // Logout button
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _showLogoutDialog(),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: const [
          _DashboardView(),
          OrdersListScreen(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _navigateToCreateOrder(),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle commande'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(
              icon: Icons.dashboard,
              label: 'Accueil',
              isSelected: _currentIndex == 0,
              onTap: () => setState(() => _currentIndex = 0),
            ),
            const SizedBox(width: 48), // Space for FAB
            _NavItem(
              icon: Icons.list_alt,
              label: 'Commandes',
              isSelected: _currentIndex == 1,
              onTap: () => setState(() => _currentIndex = 1),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToCreateOrder() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const CreateOrderScreen(),
      ),
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vraiment vous déconnecter ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.read<AuthProvider>().logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? AppTheme.primary : Colors.grey,
              size: 22,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isSelected ? AppTheme.primary : Colors.grey,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        await context.read<OrdersProvider>().loadOrders();
        await context.read<ProductsProvider>().loadProducts();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome message
            Consumer<AuthProvider>(
              builder: (context, auth, _) {
                return Text(
                  'Bonjour, ${auth.userName ?? 'Vendeur'} !',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Text(
              'Voici le résumé de vos activités',
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),

            // Stats cards
            Consumer<OrdersProvider>(
              builder: (context, orders, _) {
                final todayOrders = orders.orders.where((o) {
                  final today = DateTime.now();
                  return o.createdAt.year == today.year &&
                      o.createdAt.month == today.month &&
                      o.createdAt.day == today.day;
                }).toList();

                final pendingOrders = orders.orders.where((o) =>
                    o.deliveryStatus != 'livree' &&
                    o.deliveryStatus != 'annulee').toList();

                final unpaidOrders = orders.orders.where((o) =>
                    o.paymentStatus == 'non_payee' &&
                    o.deliveryStatus != 'annulee').toList();

                return Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Aujourd\'hui',
                            value: '${todayOrders.length}',
                            subtitle: 'commandes',
                            icon: Icons.today,
                            color: Colors.blue,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            title: 'En cours',
                            value: '${pendingOrders.length}',
                            subtitle: 'à livrer',
                            icon: Icons.local_shipping,
                            color: Colors.orange,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            title: 'Non payées',
                            value: '${unpaidOrders.length}',
                            subtitle: 'commandes',
                            icon: Icons.payment,
                            color: Colors.red,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            title: 'À synchroniser',
                            value: '${orders.pendingSyncCount}',
                            subtitle: 'commandes',
                            icon: Icons.sync,
                            color: orders.pendingSyncCount > 0
                                ? Colors.amber
                                : Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 24),

            // Recent orders
            Text(
              'Commandes récentes',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Consumer<OrdersProvider>(
              builder: (context, orders, _) {
                final recentOrders = orders.orders.take(5).toList();

                if (recentOrders.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text(
                        'Aucune commande pour le moment',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  );
                }

                return Column(
                  children: recentOrders.map((order) {
                    return _RecentOrderCard(order: order);
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: color.withOpacity(0.8),
                  fontWeight: FontWeight.w500,
                ),
              ),
              Icon(icon, size: 20, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
}

class _RecentOrderCard extends StatelessWidget {
  final dynamic order;

  const _RecentOrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(order.deliveryStatus).withOpacity(0.2),
          child: Icon(
            _getStatusIcon(order.deliveryStatus),
            color: _getStatusColor(order.deliveryStatus),
            size: 20,
          ),
        ),
        title: Text(
          order.clientName,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${order.items.length} article(s) • ${order.totalPrice.toStringAsFixed(0)} FCFA',
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: order.paymentStatus == 'payee'
                    ? Colors.green.withOpacity(0.1)
                    : Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                order.paymentStatus == 'payee' ? 'Payée' : 'Non payée',
                style: TextStyle(
                  fontSize: 10,
                  color: order.paymentStatus == 'payee'
                      ? Colors.green
                      : Colors.red,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (!order.isSynced)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Icon(Icons.cloud_off, size: 14, color: Colors.orange),
              ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'nouvelle':
        return Colors.blue;
      case 'en_preparation':
        return Colors.orange;
      case 'en_cours':
        return Colors.purple;
      case 'livree':
        return Colors.green;
      case 'annulee':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'nouvelle':
        return Icons.fiber_new;
      case 'en_preparation':
        return Icons.inventory;
      case 'en_cours':
        return Icons.local_shipping;
      case 'livree':
        return Icons.check_circle;
      case 'annulee':
        return Icons.cancel;
      default:
        return Icons.help;
    }
  }
}
