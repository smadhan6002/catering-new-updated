/**
 * authService — Admin authentication integrated with Supabase Auth & fallback
 */
import { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_KEY } from '../config/admin';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const authService = {
  async login(usernameOrEmail: string, password: string): Promise<boolean> {
    const trimmed = usernameOrEmail.trim();

    // 1. Attempt Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        const email = trimmed.includes('@') ? trimmed : `${trimmed}@kanchiambalcatering.com`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data.session) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
          return true;
        }
      } catch (err) {
        console.warn('Supabase auth attempt:', err);
      }
    }

    // 2. Fallback admin credentials
    if (trimmed === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    }

    return false;
  },

  async logout(): Promise<void> {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // safe
      }
    }
  },

  isLoggedIn(): boolean {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  },

  async getCurrentUser() {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getUser();
        return data.user;
      } catch {
        return null;
      }
    }
    return null;
  },
};
