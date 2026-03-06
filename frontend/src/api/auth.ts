import { supabase } from '../lib/supabase';

// Password validation utility
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signup = async (email: string, password: string, displayName: string) => {
  if (!email.endsWith('.edu')) {
    throw new Error('Only .edu emails are allowed.');
  }

  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.error);
  }

  // Auto-detect browser/native language (e.g., 'es', 'fr', 'en')
  const nativeLang = navigator.language.split('-')[0] || 'en';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
        preferred_language: nativeLang
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
  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.error);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return { message: 'Password has been updated.' };
};

interface UpdateProfileData {
  full_name?: string;
  preferred_language?: string;
  avatar_url?: string;
}

export const updateMe = async (data: UpdateProfileData) => {
  // Validate data
  if (data.full_name !== undefined && typeof data.full_name !== 'string') {
    throw new Error('Invalid full_name');
  }
  if (data.preferred_language !== undefined && typeof data.preferred_language !== 'string') {
    throw new Error('Invalid preferred_language');
  }
  if (data.avatar_url !== undefined && typeof data.avatar_url !== 'string') {
    throw new Error('Invalid avatar_url');
  }

  const { error } = await supabase.auth.updateUser({
    data: { ...data },
  });
  if (error) throw error;
};

// Supabase handles verification via email links automatically
export const verifyEmail = async (_email: string, _code: string) => {
  return { success: true };
};
