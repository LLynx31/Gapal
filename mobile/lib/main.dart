import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/orders_provider.dart';
import 'providers/products_provider.dart';
import 'services/database_service.dart';
import 'services/api_service.dart';
import 'services/sync_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize services
  final dbService = DatabaseService.instance;
  await dbService.database;

  final apiService = ApiService();
  final syncService = SyncService(dbService, apiService);
  syncService.initialize();

  runApp(GapalApp(
    dbService: dbService,
    apiService: apiService,
    syncService: syncService,
  ));
}

class GapalApp extends StatelessWidget {
  final DatabaseService dbService;
  final ApiService apiService;
  final SyncService syncService;

  const GapalApp({
    super.key,
    required this.dbService,
    required this.apiService,
    required this.syncService,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => ProductsProvider(dbService, syncService),
        ),
        ChangeNotifierProvider(
          create: (_) => OrdersProvider(dbService, syncService),
        ),
      ],
      child: MaterialApp(
        title: 'Gapal du Faso',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('fr', 'FR'),
        ],
        locale: const Locale('fr', 'FR'),
        home: const AuthWrapper(),
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoading) {
          return const Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Chargement...'),
                ],
              ),
            ),
          );
        }

        if (auth.isAuthenticated) {
          return const HomeScreen();
        }

        return const LoginScreen();
      },
    );
  }
}
