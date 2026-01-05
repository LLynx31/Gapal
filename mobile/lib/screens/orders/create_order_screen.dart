import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../providers/orders_provider.dart';
import '../../providers/products_provider.dart';
import '../../models/order.dart';
import '../../models/order_item.dart';
import '../../models/product.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../widgets/priority_buttons.dart';
import '../../widgets/payment_toggle.dart';

class CreateOrderScreen extends StatefulWidget {
  const CreateOrderScreen({super.key});

  @override
  State<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends State<CreateOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  final PageController _pageController = PageController();
  int _currentStep = 0;

  // Form data
  final _clientNameController = TextEditingController();
  final _clientPhoneController = TextEditingController();
  final _deliveryAddressController = TextEditingController();
  final _notesController = TextEditingController();

  String _priority = Priority.moyenne;
  bool _isPaid = false;
  final Map<int, int> _selectedProducts = {}; // productId -> quantity

  // Speech to text
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _speechAvailable = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onError: (error) => debugPrint('Speech error: $error'),
    );
    setState(() {});
  }

  @override
  void dispose() {
    _pageController.dispose();
    _clientNameController.dispose();
    _clientPhoneController.dispose();
    _deliveryAddressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep == 0 && _selectedProducts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez sélectionner au moins un produit'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (_currentStep == 1 && !_formKey.currentState!.validate()) {
      return;
    }

    if (_currentStep < 2) {
      setState(() => _currentStep++);
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _submitOrder();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      Navigator.of(context).pop();
    }
  }

  Future<void> _submitOrder() async {
    final products = context.read<ProductsProvider>().products;

    final items = _selectedProducts.entries.map((entry) {
      final product = products.firstWhere((p) => p.id == entry.key);
      return OrderItem(
        productId: entry.key,
        productName: product.name,
        quantity: entry.value,
        unitPrice: product.unitPrice,
      );
    }).toList();

    final totalPrice = items.fold<double>(
      0,
      (sum, item) => sum + item.subtotal,
    );

    final order = Order(
      localId: DateTime.now().millisecondsSinceEpoch.toString(),
      clientName: _clientNameController.text.trim(),
      clientPhone: _clientPhoneController.text.trim(),
      deliveryAddress: _deliveryAddressController.text.trim(),
      deliveryDate: DateTime.now().add(const Duration(days: 1)), // Default to tomorrow
      deliveryStatus: 'nouvelle',
      paymentStatus: _isPaid ? 'payee' : 'non_payee',
      priority: _priority,
      totalPrice: totalPrice,
      notes: _notesController.text.trim(),
      items: items,
      createdAt: DateTime.now(),
      isSynced: false,
    );

    final ordersProvider = context.read<OrdersProvider>();
    await ordersProvider.createOrder(order);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Commande créée avec succès'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop();
    }
  }

  void _startListening() async {
    if (!_speechAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reconnaissance vocale non disponible'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isListening = true);
    await _speech.listen(
      onResult: (result) {
        setState(() {
          _notesController.text = result.recognizedWords;
        });
      },
      localeId: 'fr_FR',
    );
  }

  void _stopListening() async {
    await _speech.stop();
    setState(() => _isListening = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nouvelle commande'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _previousStep,
        ),
      ),
      body: Column(
        children: [
          // Stepper indicator
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.grey[100],
            child: Row(
              children: [
                _StepIndicator(
                  step: 1,
                  label: 'Produits',
                  isActive: _currentStep >= 0,
                  isCompleted: _currentStep > 0,
                ),
                Expanded(
                  child: Container(
                    height: 2,
                    color: _currentStep > 0 ? AppTheme.primary : Colors.grey[300],
                  ),
                ),
                _StepIndicator(
                  step: 2,
                  label: 'Client',
                  isActive: _currentStep >= 1,
                  isCompleted: _currentStep > 1,
                ),
                Expanded(
                  child: Container(
                    height: 2,
                    color: _currentStep > 1 ? AppTheme.primary : Colors.grey[300],
                  ),
                ),
                _StepIndicator(
                  step: 3,
                  label: 'Confirmation',
                  isActive: _currentStep >= 2,
                  isCompleted: false,
                ),
              ],
            ),
          ),

          // Page content
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _ProductSelectionStep(
                  selectedProducts: _selectedProducts,
                  onProductChanged: (productId, quantity) {
                    setState(() {
                      if (quantity > 0) {
                        _selectedProducts[productId] = quantity;
                      } else {
                        _selectedProducts.remove(productId);
                      }
                    });
                  },
                ),
                _ClientInfoStep(
                  formKey: _formKey,
                  clientNameController: _clientNameController,
                  clientPhoneController: _clientPhoneController,
                  deliveryAddressController: _deliveryAddressController,
                  notesController: _notesController,
                  isListening: _isListening,
                  speechAvailable: _speechAvailable,
                  onStartListening: _startListening,
                  onStopListening: _stopListening,
                ),
                _ConfirmationStep(
                  clientName: _clientNameController.text,
                  clientPhone: _clientPhoneController.text,
                  deliveryAddress: _deliveryAddressController.text,
                  notes: _notesController.text,
                  priority: _priority,
                  isPaid: _isPaid,
                  selectedProducts: _selectedProducts,
                  onPriorityChanged: (p) => setState(() => _priority = p),
                  onPaymentChanged: (p) => setState(() => _isPaid = p),
                ),
              ],
            ),
          ),

          // Bottom bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                // Total
                if (_selectedProducts.isNotEmpty)
                  Expanded(
                    child: Consumer<ProductsProvider>(
                      builder: (context, productsProvider, _) {
                        final total = _selectedProducts.entries.fold<double>(
                          0,
                          (sum, entry) {
                            final product = productsProvider.products
                                .firstWhere((p) => p.id == entry.key,
                                    orElse: () => Product(
                                          id: 0,
                                          name: '',
                                          unitPrice: 0,
                                          stockQuantity: 0,
                                          unit: '',
                                        ));
                            return sum + (product.unitPrice * entry.value);
                          },
                        );
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Total',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                            Text(
                              '${total.toStringAsFixed(0)} FCFA',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primary,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                // Next button
                ElevatedButton(
                  onPressed: _nextStep,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    _currentStep == 2 ? 'Créer la commande' : 'Suivant',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int step;
  final String label;
  final bool isActive;
  final bool isCompleted;

  const _StepIndicator({
    required this.step,
    required this.label,
    required this.isActive,
    required this.isCompleted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isActive ? AppTheme.primary : Colors.grey[300],
            shape: BoxShape.circle,
          ),
          child: Center(
            child: isCompleted
                ? const Icon(Icons.check, color: Colors.white, size: 18)
                : Text(
                    '$step',
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.grey[600],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: isActive ? AppTheme.primary : Colors.grey,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}

class _ProductSelectionStep extends StatelessWidget {
  final Map<int, int> selectedProducts;
  final Function(int, int) onProductChanged;

  const _ProductSelectionStep({
    required this.selectedProducts,
    required this.onProductChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<ProductsProvider>(
      builder: (context, productsProvider, _) {
        if (productsProvider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final products = productsProvider.products;

        if (products.isEmpty) {
          return const Center(
            child: Text('Aucun produit disponible'),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: products.length,
          itemBuilder: (context, index) {
            final product = products[index];
            final quantity = selectedProducts[product.id] ?? 0;

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    // Product info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${product.unitPrice.toStringAsFixed(0)} FCFA / ${product.unit}',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Stock: ${product.stockQuantity}',
                            style: TextStyle(
                              color: product.stockQuantity > 10
                                  ? Colors.green
                                  : Colors.orange,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Quantity selector
                    Row(
                      children: [
                        IconButton(
                          onPressed: quantity > 0
                              ? () => onProductChanged(product.id, quantity - 1)
                              : null,
                          icon: const Icon(Icons.remove_circle_outline),
                          color: AppTheme.primary,
                        ),
                        Container(
                          width: 40,
                          alignment: Alignment.center,
                          child: Text(
                            '$quantity',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: quantity < product.stockQuantity
                              ? () => onProductChanged(product.id, quantity + 1)
                              : null,
                          icon: const Icon(Icons.add_circle_outline),
                          color: AppTheme.primary,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ClientInfoStep extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController clientNameController;
  final TextEditingController clientPhoneController;
  final TextEditingController deliveryAddressController;
  final TextEditingController notesController;
  final bool isListening;
  final bool speechAvailable;
  final VoidCallback onStartListening;
  final VoidCallback onStopListening;

  const _ClientInfoStep({
    required this.formKey,
    required this.clientNameController,
    required this.clientPhoneController,
    required this.deliveryAddressController,
    required this.notesController,
    required this.isListening,
    required this.speechAvailable,
    required this.onStartListening,
    required this.onStopListening,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Informations client',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            // Client name
            TextFormField(
              controller: clientNameController,
              decoration: const InputDecoration(
                labelText: 'Nom du client *',
                prefixIcon: Icon(Icons.person_outline),
                border: OutlineInputBorder(),
              ),
              textInputAction: TextInputAction.next,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Veuillez entrer le nom du client';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Phone
            TextFormField(
              controller: clientPhoneController,
              decoration: const InputDecoration(
                labelText: 'Téléphone',
                prefixIcon: Icon(Icons.phone_outlined),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),

            // Address
            TextFormField(
              controller: deliveryAddressController,
              decoration: const InputDecoration(
                labelText: 'Adresse de livraison',
                prefixIcon: Icon(Icons.location_on_outlined),
                border: OutlineInputBorder(),
              ),
              textInputAction: TextInputAction.next,
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            // Notes with voice input
            TextFormField(
              controller: notesController,
              decoration: InputDecoration(
                labelText: 'Notes',
                prefixIcon: const Icon(Icons.note_outlined),
                border: const OutlineInputBorder(),
                suffixIcon: speechAvailable
                    ? IconButton(
                        onPressed:
                            isListening ? onStopListening : onStartListening,
                        icon: Icon(
                          isListening ? Icons.mic : Icons.mic_none,
                          color: isListening ? Colors.red : null,
                        ),
                      )
                    : null,
              ),
              maxLines: 3,
            ),
            if (isListening)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Écoute en cours...',
                      style: TextStyle(
                        color: Colors.red,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ConfirmationStep extends StatelessWidget {
  final String clientName;
  final String clientPhone;
  final String deliveryAddress;
  final String notes;
  final String priority;
  final bool isPaid;
  final Map<int, int> selectedProducts;
  final ValueChanged<String> onPriorityChanged;
  final ValueChanged<bool> onPaymentChanged;

  const _ConfirmationStep({
    required this.clientName,
    required this.clientPhone,
    required this.deliveryAddress,
    required this.notes,
    required this.priority,
    required this.isPaid,
    required this.selectedProducts,
    required this.onPriorityChanged,
    required this.onPaymentChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Récapitulatif',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),

          // Client info summary
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.person, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      clientName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                if (clientPhone.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.phone, size: 20, color: Colors.grey),
                      const SizedBox(width: 8),
                      Text(clientPhone),
                    ],
                  ),
                ],
                if (deliveryAddress.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on, size: 20, color: Colors.grey),
                      const SizedBox(width: 8),
                      Expanded(child: Text(deliveryAddress)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Products summary
          const Text(
            'Articles',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Consumer<ProductsProvider>(
            builder: (context, productsProvider, _) {
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: selectedProducts.entries.map((entry) {
                    final product = productsProvider.products
                        .firstWhere((p) => p.id == entry.key);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text('${product.name} x${entry.value}'),
                          ),
                          Text(
                            '${(product.unitPrice * entry.value).toStringAsFixed(0)} FCFA',
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              );
            },
          ),
          const SizedBox(height: 24),

          // Priority selection
          const Text(
            'Priorité',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          PriorityButtons(
            selected: priority,
            onChanged: onPriorityChanged,
          ),
          const SizedBox(height: 24),

          // Payment toggle
          PaymentToggle(
            isPaid: isPaid,
            onChanged: onPaymentChanged,
          ),

          // Notes
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Text(
              'Notes',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.yellow[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.yellow[200]!),
              ),
              child: Text(notes),
            ),
          ],
        ],
      ),
    );
  }
}
