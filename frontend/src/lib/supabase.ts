import { createClient } from '@supabase/supabase-js';

// Vercel's integration might provide these without the VITE_ prefix, 
// but Vite requires VITE_ to expose them to the browser.
// We'll check for both just in case.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window as any)._env_?.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any)._env_?.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
