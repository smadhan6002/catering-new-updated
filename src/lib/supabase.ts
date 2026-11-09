import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseUrl !== '' &&
  supabaseAnonKey !== ''
);

// Create Supabase client singleton with safe fallback
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Verifies live connection to Supabase REST API
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  tables?: string[];
}> {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      message: 'Supabase URL or Anon Key is missing in environment variables.',
    };
  }

  try {
    // Attempt to probe the REST endpoint or an essential table
    const { data, error } = await supabase.from('dishes').select('id').limit(1);

    if (error) {
      // Check if table does not exist yet (code 42P01 or similar)
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return {
          connected: true,
          message: 'Connected to Supabase project, but database tables need to be created. Please run the SQL migration script.',
          tables: [],
        };
      }
      return {
        connected: false,
        message: `Supabase error: ${error.message}`,
      };
    }

    return {
      connected: true,
      message: 'Successfully connected to Supabase backend!',
      tables: data ? ['dishes'] : [],
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      message: `Failed to connect to Supabase: ${errorMsg}`,
    };
  }
}
