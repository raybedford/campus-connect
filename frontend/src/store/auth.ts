import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false, 

  setAuth: (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    set({ isAuthenticated: true });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },
}));
