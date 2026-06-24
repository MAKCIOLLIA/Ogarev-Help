import { supabase } from './supabase';
import { User } from '../types';

export const updateUserProfile = async (token: string, fullName: string, about: string): Promise<Partial<User>> => {
  const { data, error } = await supabase.rpc('update_user_profile', {
    p_token: token,
    p_full_name: fullName,
    p_about: about,
  });

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Не удалось обновить профиль.');
  }

  return data[0] as Partial<User>;
};
