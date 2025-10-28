import { supabase } from '@/integrations/supabase/client';

export async function signInAsGuest() {
  const { data, error } = await supabase.auth.signInAnonymously();
  
  if (error) {
    throw new Error('Failed to create guest session');
  }
  
  return data;
}

export function isGuestUser(userId: string | undefined): boolean {
  if (!userId) return false;
  // Anonymous users have is_anonymous flag
  return true; // We'll check this properly in the app
}
