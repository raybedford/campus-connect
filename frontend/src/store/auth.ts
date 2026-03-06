import { create } from 'zustand';
import { del } from 'idb-keyval';
import { supabase } from '../lib/supabase';
import { hasKeyPair, generateAndStoreKeyPair } from '../crypto/keyManager';
import { publishKey } from '../api/keys';
import { syncAllGroupKeys, clearAllGroupKeys } from '../services/groupKeyManager';

interface AuthState {
  user: any | null;
  profile: any | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  setAuth: () => void;
  setUser: (user: any) => void;
  setProfile: (profile: any) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false, 
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ user: session.user, isAuthenticated: true });
        
        // Initialize E2EE Keys if missing
        try {
          const localKeys = await hasKeyPair();
          if (!localKeys) {
            // Check if user already has a key published on the server
            const { data: remoteKey } = await supabase
              .from('public_keys')
              .select('public_key')
              .eq('user_id', session.user.id)
              .single();

            if (!remoteKey) {
              // Truly new user, generate first keypair
              const { publicKey } = await generateAndStoreKeyPair();
              await publishKey(publicKey);
            } else {
              // Key exists on server but not this device.
              // Do NOT generate a new one, as it will break other devices.
              console.warn('E2EE Key found on server but missing locally. User needs to import backup.');
              sessionStorage.setItem('key_import_required', 'true');
            }
          }
        } catch (err) {
          console.error('E2EE Key initialization failed during boot:', err);
        }

        // Sync all conversation group keys
        try {
          await syncAllGroupKeys(session.user.id);
          console.log('✅ Group keys synced on initialization');
        } catch (err) {
          console.error('Failed to sync group keys on init:', err);
        }

        // Fetch profile with school details
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, school:schools(*)')
          .eq('id', session.user.id)
          .single();

        if (profile) set({ profile });
      }
    } finally {
      set({ isInitialized: true });
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ user: session?.user || null, isAuthenticated: !!session });
      
      const currentUserId = session?.user?.id;

      if ((event === 'SIGNED_IN' || session?.user) && currentUserId) {
        // Initialize E2EE Keys if missing
        try {
          const localKeys = await hasKeyPair();
          if (!localKeys) {
            const { data: remoteKey } = await supabase
              .from('public_keys')
              .select('public_key')
              .eq('user_id', currentUserId)
              .single();

            if (!remoteKey) {
              const { publicKey } = await generateAndStoreKeyPair();
              await publishKey(publicKey).catch(console.error);
            }
          }
        } catch (e) {
          console.error('Key generation error on auth change:', e);
        }

        // Sync all conversation group keys
        try {
          await syncAllGroupKeys(currentUserId);
          console.log('✅ Group keys synced on sign in');
        } catch (err) {
          console.error('Failed to sync group keys on sign in:', err);
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*, school:schools(*)')
          .eq('id', currentUserId)
          .single();
        if (profile) set({ profile });
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null });
      }
    });
  },

  setAuth: () => {
    set({ isAuthenticated: true });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setProfile: (profile) => set({ profile }),

  logout: async () => {
    await supabase.auth.signOut();
    // Clear E2EE keys on logout for security
    await del('campus_connect_private_key');
    await del('campus_connect_public_key');
    // Clear all cached group keys
    clearAllGroupKeys();

    set({ user: null, profile: null, isAuthenticated: false });
  },
}));
