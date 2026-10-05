/**
 * 會員／管理者登入狀態（zustand）。
 *
 * 這是平台狀態：authApi 呼叫 + session 快取，與任何領域無關，
 * 第三個站台會需要一模一樣的一份。P3 之前它住在 Polaris 的 src/store/auth.ts，
 * 等於每個新站台都要複製一次。
 *
 * zustand 是 peerDependency —— 由消費站台提供，避免套件與站台各自帶一份 store 實例。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, LoginCredentials } from './types';
import { authApi } from './auth';
import type { RegisterPayload, RegisterResponse } from './auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  resetForLogin: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login(credentials);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          set({
            error: error.message || 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      register: async (payload: RegisterPayload) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.register(payload);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return response;
        } catch (error: any) {
          set({
            error: error.message || '註冊失敗，請稍後再試',
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // 即使後端登出失敗，前端也清除狀態
        }
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });

        try {
          const user = await authApi.getProfile();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      resetForLogin: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {} as Storage
      ),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
