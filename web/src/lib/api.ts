/**
 * API client for Gapal backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthTokens, LoginCredentials, User, Order, Product, Category,
  StockMovement, Notification, PaginatedResponse, OrderStats, StockAlerts
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          const refreshToken = typeof window !== 'undefined'
            ? localStorage.getItem('refresh_token')
            : null;

          if (refreshToken) {
            try {
              const response = await axios.post<{ access: string }>(
                `${API_URL}/auth/refresh/`,
                { refresh: refreshToken }
              );

              const newToken = response.data.access;
              localStorage.setItem('access_token', newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;

              return this.client.request(originalRequest);
            } catch {
              // Refresh failed - clear tokens and redirect
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ===== AUTH =====
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await this.client.post<AuthTokens>('/auth/login/', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    const refresh = localStorage.getItem('refresh_token');
    await this.client.post('/auth/logout/', { refresh });
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get<User>('/auth/me/');
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // ===== USERS =====
  async getUsers(params?: Record<string, string>): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<PaginatedResponse<User>>('/users/', { params });
    return response.data;
  }

  async getUser(id: number): Promise<User> {
    const response = await this.client.get<User>(`/users/${id}/`);
    return response.data;
  }

  async createUser(data: Partial<User>): Promise<User> {
    const response = await this.client.post<User>('/users/', data);
    return response.data;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const response = await this.client.patch<User>(`/users/${id}/`, data);
    return response.data;
  }

  async deleteUser(id: number): Promise<void> {
    await this.client.delete(`/users/${id}/`);
  }

  // ===== PRODUCTS =====
  async getProducts(params?: Record<string, string>): Promise<PaginatedResponse<Product>> {
    const response = await this.client.get<PaginatedResponse<Product>>('/products/', { params });
    return response.data;
  }

  async getProduct(id: number): Promise<Product> {
    const response = await this.client.get<Product>(`/products/${id}/`);
    return response.data;
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await this.client.post<Product>('/products/', data);
    return response.data;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const response = await this.client.patch<Product>(`/products/${id}/`, data);
    return response.data;
  }

  async deleteProduct(id: number): Promise<void> {
    await this.client.delete(`/products/${id}/`);
  }

  async getProductsSimple(): Promise<Product[]> {
    const response = await this.client.get<Product[]>('/products/simple/');
    return response.data;
  }

  async getLowStockProducts(): Promise<Product[]> {
    const response = await this.client.get<Product[]>('/products/low_stock/');
    return response.data;
  }

  // ===== CATEGORIES =====
  async getCategories(): Promise<Category[]> {
    const response = await this.client.get<Category[]>('/categories/');
    return response.data;
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    const response = await this.client.post<Category>('/categories/', data);
    return response.data;
  }

  // ===== ORDERS =====
  async getOrders(params?: Record<string, string>): Promise<PaginatedResponse<Order>> {
    const response = await this.client.get<PaginatedResponse<Order>>('/orders/', { params });
    return response.data;
  }

  async getOrder(id: number): Promise<Order> {
    const response = await this.client.get<Order>(`/orders/${id}/`);
    return response.data;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const response = await this.client.patch<Order>(`/orders/${id}/update_status/`, {
      delivery_status: status,
    });
    return response.data;
  }

  async updatePaymentStatus(id: number, status: string): Promise<Order> {
    const response = await this.client.patch<Order>(`/orders/${id}/update_payment/`, {
      payment_status: status,
    });
    return response.data;
  }

  async getOrderStats(): Promise<OrderStats> {
    const response = await this.client.get<OrderStats>('/orders/stats/');
    return response.data;
  }

  async getPendingOrders(): Promise<Order[]> {
    const response = await this.client.get<Order[]>('/orders/pending/');
    return response.data;
  }

  async getUnpaidOrders(): Promise<Order[]> {
    const response = await this.client.get<Order[]>('/orders/unpaid/');
    return response.data;
  }

  async getTodayOrders(): Promise<Order[]> {
    const response = await this.client.get<Order[]>('/orders/today/');
    return response.data;
  }

  // ===== STOCK =====
  async getStockMovements(params?: Record<string, string>): Promise<PaginatedResponse<StockMovement>> {
    const response = await this.client.get<PaginatedResponse<StockMovement>>('/stock/movements/', { params });
    return response.data;
  }

  async createStockEntry(productId: number, quantity: number, reason?: string): Promise<StockMovement> {
    const response = await this.client.post<StockMovement>('/stock/entry/', {
      product_id: productId,
      quantity,
      reason,
    });
    return response.data;
  }

  async createStockExit(productId: number, quantity: number, reason?: string): Promise<StockMovement> {
    const response = await this.client.post<StockMovement>('/stock/exit/', {
      product_id: productId,
      quantity,
      reason,
    });
    return response.data;
  }

  async createStockAdjustment(productId: number, newQuantity: number, reason: string): Promise<StockMovement> {
    const response = await this.client.post<StockMovement>('/stock/adjustment/', {
      product_id: productId,
      new_quantity: newQuantity,
      reason,
    });
    return response.data;
  }

  async getStockAlerts(): Promise<StockAlerts> {
    const response = await this.client.get<StockAlerts>('/stock/alerts/');
    return response.data;
  }

  // ===== NOTIFICATIONS =====
  async getNotifications(): Promise<PaginatedResponse<Notification>> {
    const response = await this.client.get<PaginatedResponse<Notification>>('/notifications/');
    return response.data;
  }

  async getUnreadCount(): Promise<{ unread_count: number }> {
    const response = await this.client.get<{ unread_count: number }>('/notifications/unread/');
    return response.data;
  }

  async markNotificationRead(id: number): Promise<void> {
    await this.client.post(`/notifications/${id}/read/`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.client.post('/notifications/read_all/');
  }
}

export const api = new ApiClient();
