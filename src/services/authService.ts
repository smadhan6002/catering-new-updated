/**
 * authService — Production Admin Authentication & Authorization
 * Powered exclusively by Supabase Auth (email/password) & public.admin_users table.
 */
import { ADMIN_SESSION_KEY, ADMIN_USER_ID_KEY } from '../config/admin';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseDiagnostics,
  type SupabaseEnvDiagnostics,
} from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AdminUserRecord {
  id: string;
  name: string | null;
  created_at: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
  adminRecord?: AdminUserRecord;
  needsAdminAuthorization?: boolean;
  userId?: string;
  userEmail?: string;
  diagnostics?: SupabaseEnvDiagnostics;
}

export const authService = {
  /**
   * Official Supabase email/password login with admin authorization check
   */
  async login(usernameOrEmail: string, password: string): Promise<LoginResult> {
    const email = (usernameOrEmail || '').trim();

    if (!email) {
      return { success: false, error: 'Please enter your admin email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    if (!isSupabaseConfigured) {
      const diagnostics = getSupabaseDiagnostics();
      const statusSummary = [
        `VITE_SUPABASE_URL: ${diagnostics.urlValid ? 'OK' : diagnostics.hasUrl ? 'Invalid URL' : 'Missing'}`,
        `VITE_SUPABASE_ANON_KEY: ${diagnostics.anonKeyValid ? 'OK' : diagnostics.hasAnonKey ? 'Invalid/Placeholder' : 'Missing'}`,
      ].join(', ');

      return {
        success: false,
        diagnostics,
        error: `Supabase is not configured on this environment (${statusSummary}). Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are enabled for Production in Vercel and trigger a fresh Redeploy without build cache.`,
      };
    }

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let userFriendlyMsg = error.message;
        const lowerMsg = (error.message || '').toLowerCase();

        if (lowerMsg.includes('invalid login credentials') || error.status === 400) {
          userFriendlyMsg = 'Invalid email or password. Please verify your Supabase admin credentials.';
        } else if (lowerMsg.includes('email not confirmed')) {
          userFriendlyMsg =
            'Email address is not confirmed yet. Please confirm your email in Supabase Dashboard → Authentication → Users (or toggle off "Confirm email" in Auth settings).';
        } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
          userFriendlyMsg = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (lowerMsg.includes('fetch') || lowerMsg.includes('network')) {
          userFriendlyMsg = 'Network connection error. Unable to reach Supabase authentication server.';
        }

        return { success: false, error: userFriendlyMsg };
      }

      if (!data.user) {
        return { success: false, error: 'Authentication failed: No user returned by Supabase.' };
      }

      // 2. Authorize against public.admin_users table
      const { data: adminRecord, error: adminErr } = await supabase
        .from('admin_users')
        .select('id, name, created_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (adminErr) {
        console.warn('Error querying admin_users table:', adminErr.message);
      }

      // If authorized admin
      if (adminRecord) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        sessionStorage.setItem(ADMIN_USER_ID_KEY, data.user.id);
        return {
          success: true,
          user: data.user,
          adminRecord,
        };
      }

      // User exists in Supabase Auth, but NOT in public.admin_users
      // Immediately sign out to prevent unauthorized access
      await supabase.auth.signOut();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_USER_ID_KEY);

      return {
        success: false,
        needsAdminAuthorization: true,
        userId: data.user.id,
        userEmail: data.user.email || email,
        error: `Access Denied: Account (${data.user.email || email}) is authenticated in Supabase, but is not authorized in public.admin_users table.`,
      };
    } catch (err: any) {
      console.error('Login error:', err);
      return {
        success: false,
        error: `Login failed: ${err?.message || 'Unexpected network or server error.'}`,
      };
    }
  },

  /**
   * Log out from Supabase Auth and clear session
   */
  async logout(): Promise<void> {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_USER_ID_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
    }
  },

  /**
   * Fast synchronous check for stored admin session
   */
  isLoggedIn(): boolean {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  },

  /**
   * Verifies current live Supabase session and admin authorization
   */
  async checkCurrentSession(): Promise<{
    isAuthorized: boolean;
    user: User | null;
    adminRecord: AdminUserRecord | null;
  }> {
    if (!isSupabaseConfigured) {
      return { isAuthorized: false, user: null, adminRecord: null };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        sessionStorage.removeItem(ADMIN_USER_ID_KEY);
        return { isAuthorized: false, user: null, adminRecord: null };
      }

      // Check authorization in admin_users
      const { data: adminRecord } = await supabase
        .from('admin_users')
        .select('id, name, created_at')
        .eq('id', session.user.id)
        .maybeSingle();

      if (adminRecord) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        sessionStorage.setItem(ADMIN_USER_ID_KEY, session.user.id);
        return { isAuthorized: true, user: session.user, adminRecord };
      }

      // Session exists in auth, but user is not in admin_users table
      await supabase.auth.signOut();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_USER_ID_KEY);
      return { isAuthorized: false, user: null, adminRecord: null };
    } catch (err) {
      console.warn('Session verification error:', err);
      return { isAuthorized: false, user: null, adminRecord: null };
    }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } catch {
      return null;
    }
  },

  /**
   * Listen to Supabase auth state changes and re-verify authorization
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null, isAuthorized: boolean) => void
  ): () => void {
    if (!isSupabaseConfigured) return () => {};

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: adminRecord } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        const isAuthorized = Boolean(adminRecord);
        if (isAuthorized) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
          sessionStorage.setItem(ADMIN_USER_ID_KEY, session.user.id);
        } else {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          sessionStorage.removeItem(ADMIN_USER_ID_KEY);
        }
        callback(event, session, isAuthorized);
      } else {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        sessionStorage.removeItem(ADMIN_USER_ID_KEY);
        callback(event, null, false);
      }
    });

    return () => subscription.unsubscribe();
  },
};
