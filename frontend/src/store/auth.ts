import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  setAuth: (accessToken: string, refreshToken: string) => void;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false, 

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      set({ user: session.user, isAuthenticated: true });
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null, isAuthenticated: !!session });
    });
  },

  setAuth: (accessToken, refreshToken) => {
    // Supabase handles this in the background, but we can set UI state
    set({ isAuthenticated: true });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));
