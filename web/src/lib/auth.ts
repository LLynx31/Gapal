/**
 * Authentication utilities and store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api } from './api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string) => {
        const tokens = await api.login({ username, password });
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);

        const user = await api.getProfile();
        set({ user, isAuthenticated: true, isLoading: false });
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Ignore logout errors
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, isAuthenticated: false });
      },

      fetchUser: async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const user = await api.getProfile();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Role checks
export function canAccessOrders(user: User | null): boolean {
  if (!user) return false;
  return ['admin', 'gestionnaire_commandes', 'vendeur'].includes(user.role);
}

export function canManageOrders(user: User | null): boolean {
  if (!user) return false;
  return ['admin', 'gestionnaire_commandes'].includes(user.role);
}

export function canAccessStock(user: User | null): boolean {
  if (!user) return false;
  return ['admin', 'gestionnaire_stocks'].includes(user.role);
}

export function canAccessAdmin(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}
