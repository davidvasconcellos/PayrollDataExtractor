import { create } from 'zustand';
import { apiRequest } from '@/lib/queryClient';
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';

interface User {
  id: number;
  username: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  
  login: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      const user = await response.json();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Login error:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to login', 
        isLoading: false 
      });
    }
  },
  
  logout: async () => {
    try {
      set({ isLoading: true });
      await apiRequest('POST', '/api/auth/logout');
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Logout error:', error);
      set({ isLoading: false });
    }
  },
  
  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/auth/check', { 
        credentials: 'include' 
      });
      
      if (response.ok) {
        const user = await response.json();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  }
}));

// Create a context for Auth to use in components
const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthStore();
  const [location, navigate] = useLocation();
  
  useEffect(() => {
    // Check authentication when the app loads
    auth.checkAuth();
  }, []);
  
  // Redirects for authentication
  useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated && location !== '/login') {
        navigate('/login');
      } else if (auth.isAuthenticated && location === '/login') {
        navigate('/');
      }
    }
  }, [auth.isAuthenticated, auth.isLoading, location]);
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};