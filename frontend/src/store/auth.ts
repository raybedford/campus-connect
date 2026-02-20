import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  profile: any | null;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  setAuth: () => void;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false, 

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      set({ user: session.user, isAuthenticated: true });
      // Fetch profile with school details
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, school:schools(*)')
        .eq('id', session.user.id)
        .single();
      
      if (profile) set({ profile });
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ user: session?.user || null, isAuthenticated: !!session });
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, school:schools(*)')
          .eq('id', session.user.id)
          .single();
        if (profile) set({ profile });
      } else {
        set({ profile: null });
      }
    });
  },

  setAuth: () => {
    set({ isAuthenticated: true });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAuthenticated: false });
  },
}));
