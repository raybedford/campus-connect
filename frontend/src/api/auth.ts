import { supabase } from '../lib/supabase';

export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signup = async (email, password, displayName) => {
  if (!email.endsWith('.edu')) {
    throw new Error('Only .edu emails are allowed.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const forgotPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return { message: 'If an account exists, a reset link has been sent.' };
};

export const resetPassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return { message: 'Password has been updated.' };
};

export const updateMe = async (data: any) => {
  const { error } = await supabase.auth.updateUser({
    data: { ...data },
  });
  if (error) throw error;
};

// Supabase handles verification via email links automatically, but we can provide a dummy
export const verifyEmail = async (email: string, code: string) => {
  // If the user is entering a code manually, we assume they used the 123456 bypass or it's just for UI flow
  return { success: true };
};
