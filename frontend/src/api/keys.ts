import { supabase } from '../lib/supabase';

export async function publishKey(publicKeyB64: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('public_keys')
    .upsert({ 
      user_id: user.id, 
      public_key: publicKeyB64 
    });

  if (error) throw error;
}

export async function getPublicKey(userId: string): Promise<any> {
  const { data, error } = await supabase
    .from('public_keys')
    .select('public_key')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data ? { publicKeyB64: data.public_key, user: userId } : null;
}

export async function getBatchPublicKeys(userIds: string[]): Promise<any[]> {
  const { data, error } = await supabase
    .from('public_keys')
    .select('user_id, public_key')
    .in('user_id', userIds);

  if (error) throw error;
  
  // Map to the expected format for the frontend
  return (data || []).map(k => ({
    user: k.user_id,
    publicKeyB64: k.public_key
  }));
}
