import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Access Vite environment variables statically so Vite inlines them at build time
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function normalizeEnvValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^["']|["']$/g, '').trim();
}

function isPlaceholderValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    !value ||
    lower.includes('your-project') ||
    lower.includes('your_supabase') ||
    lower.includes('placeholder') ||
    lower.includes('<your') ||
    lower === 'undefined' ||
    lower === 'null'
  );
}

function isValidHttpUrl(value: string): boolean {
  if (!value || isPlaceholderValue(value)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

const supabaseUrl = normalizeEnvValue(rawSupabaseUrl).replace(/\/+$/, '');
const supabaseAnonKey = normalizeEnvValue(rawSupabaseAnonKey);

const hasUrl = Boolean(supabaseUrl);
const urlValid = isValidHttpUrl(supabaseUrl);
const hasAnonKey = Boolean(supabaseAnonKey);
const anonKeyValid =
  hasAnonKey && !isPlaceholderValue(supabaseAnonKey) && supabaseAnonKey.length >= 20;

export const isSupabaseConfigured: boolean = urlValid && anonKeyValid;

export interface SupabaseEnvDiagnostics {
  configured: boolean;
  hasUrl: boolean;
  urlValid: boolean;
  hasAnonKey: boolean;
  anonKeyValid: boolean;
  missingOrInvalid: ('VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY')[];
  mode: string;
}

/**
 * Returns safe boolean diagnostics (never includes keys, tokens, or credentials)
 */
export function getSupabaseDiagnostics(): SupabaseEnvDiagnostics {
  const missingOrInvalid: ('VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY')[] = [];
  if (!urlValid) missingOrInvalid.push('VITE_SUPABASE_URL');
  if (!anonKeyValid) missingOrInvalid.push('VITE_SUPABASE_ANON_KEY');

  return {
    configured: isSupabaseConfigured,
    hasUrl,
    urlValid,
    hasAnonKey,
    anonKeyValid,
    missingOrInvalid,
    mode: import.meta.env.MODE || 'unknown',
  };
}

export const supabaseDiagnostics: SupabaseEnvDiagnostics = getSupabaseDiagnostics();

if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  // Safe diagnostics only: never logs URL values, keys, or secrets
  console.warn('[Supabase Diagnostics] Environment variables missing or invalid at build time:', {
    configured: supabaseDiagnostics.configured,
    hasUrl: supabaseDiagnostics.hasUrl,
    urlValid: supabaseDiagnostics.urlValid,
    hasAnonKey: supabaseDiagnostics.hasAnonKey,
    anonKeyValid: supabaseDiagnostics.anonKeyValid,
    missingOrInvalid: supabaseDiagnostics.missingOrInvalid,
    mode: supabaseDiagnostics.mode,
  });
}

// Create shared Supabase client singleton with safe fallback
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
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
    const diag = getSupabaseDiagnostics();
    return {
      connected: false,
      message: `Supabase environment configuration incomplete (${diag.missingOrInvalid.join(', ')} missing or invalid in build).`,
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

