// User types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: UserRole;
  role_display: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export type UserRole = 'vendeur' | 'gestionnaire_commandes' | 'gestionnaire_stocks' | 'admin';

// Auth types
export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Product types
export interface Category {
  id: number;
  name: string;
  description: string;
  products_count: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  unit_price: number;
  stock_quantity: number;
  category: number | null;
  category_name: string | null;
  unit: ProductUnit;
  unit_display: string;
  barcode: string | null;
  min_stock_level: number;
  expiration_date: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  is_expired: boolean;
  is_expiring_soon: boolean;
  days_until_expiration: number | null;
  created_at: string;
  updated_at: string;
}

export type ProductUnit = 'litre' | 'kg' | 'unite' | 'sachet' | 'pot';

// Order types
export interface Order {
  id: number;
  order_number: string;
  local_id: string;
  client_name: string;
  client_phone: string;
  delivery_address: string;
  delivery_date: string;
  delivery_status: DeliveryStatus;
  delivery_status_display: string;
  payment_status: PaymentStatus;
  payment_status_display: string;
  priority: Priority;
  priority_display: string;
  total_price: number;
  notes: string;
  created_by: number;
  created_by_name: string;
  items: OrderItem[];
  items_count: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  product_unit: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type DeliveryStatus = 'nouvelle' | 'en_preparation' | 'en_cours' | 'livree' | 'annulee';
export type PaymentStatus = 'non_payee' | 'payee';
export type Priority = 'basse' | 'moyenne' | 'haute';

// Stock types
export interface StockMovement {
  id: number;
  product: number;
  product_name: string;
  movement_type: MovementType;
  movement_type_display: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  order: number | null;
  order_number: string | null;
  reason: string;
  user: number;
  user_name: string;
  created_at: string;
}

export type MovementType = 'entree' | 'sortie' | 'ajustement';

// Notification types
export interface Notification {
  id: number;
  type: NotificationType;
  type_display: string;
  title: string;
  message: string;
  related_order: number | null;
  order_number: string | null;
  related_product: number | null;
  product_name: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationType = 'new_order' | 'order_status' | 'order_delivered' | 'low_stock' | 'expiration' | 'system';

// API response types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Stats types
export interface OrderStats {
  total: number;
  nouvelle: number;
  en_preparation: number;
  en_cours: number;
  livree: number;
  annulee: number;
  payee: number;
  non_payee: number;
  haute_priorite: number;
  today: number;
  revenue_today: number;
  revenue_month: number;
}

export interface StockAlerts {
  low_stock: Product[];
  expiring: Product[];
  out_of_stock: Product[];
  counts: {
    low_stock: number;
    expiring: number;
    out_of_stock: number;
  };
}
