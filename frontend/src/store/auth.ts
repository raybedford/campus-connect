import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
}

/**
 * AUTH BYPASS FOR DEMO TESTING
 */
export const useAuthStore = create<AuthState>((set) => ({
  // Demo Setup: Automatically Authenticated
  user: {
    id: 'demo_alex_id',
    displayName: 'Alex Johnson',
    email: 'alex.j@coloradotech.edu',
    school: {
      name: 'Colorado Technical University',
      logoUrl: 'https://logo.clearbit.com/coloradotech.edu'
    }
  },
  isAuthenticated: true, 

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
