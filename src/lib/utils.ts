import { supabase } from './supabase';

export function getAvatarUrl(path: string | null) {
  if (!path) return null;
  // If it's already a full URL, return it
  if (path.startsWith('http')) return path;
  
  const { data } = supabase.storage.from('Documents').getPublicUrl(path);
  return data.publicUrl;
}

export function calculateGrade(score: number): number {
  if (score < 51) return 2;
  if (score <= 70) return 3;
  if (score <= 85) return 4;
  return 5;
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Произошла неизвестная ошибка';
  if (typeof error === 'string') return error;
  
  // Handle Supabase error objects and standard Error objects
  const err = error as { message?: string };
  if (err.message && typeof err.message === 'string') {
    return err.message;
  }
  
  if (error instanceof Error) return error.message;
  
  return 'Произошла ошибка';
}
