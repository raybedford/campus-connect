import { supabase } from '../lib/supabase';

/**
 * Compatibility layer for the old Axios 'client' pattern.
 * New code should use 'supabase' directly from '../lib/supabase'.
 */
const client = {
  get: async (path: string, options: any = {}) => {
    // Map old paths to Supabase calls if possible, or throw error
    console.warn(`Deprecated client.get called for ${path}. Use supabase instead.`);
    throw new Error(`Endpoint ${path} is not implemented in Supabase compatibility layer.`);
  },
  post: async (path: string, data: any = {}, options: any = {}) => {
    console.warn(`Deprecated client.post called for ${path}. Use supabase instead.`);
    throw new Error(`Endpoint ${path} is not implemented in Supabase compatibility layer.`);
  },
  delete: async (path: string, options: any = {}) => {
    console.warn(`Deprecated client.delete called for ${path}. Use supabase instead.`);
    throw new Error(`Endpoint ${path} is not implemented in Supabase compatibility layer.`);
  },
};

export default client;
export const API_BASE = '';
