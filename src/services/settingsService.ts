/**
 * settingsService — Site settings persistence with Supabase `site_settings` table
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SETTINGS_KEY = 'catering_site_settings';

export const settingsService = {
  /**
   * Synchronize settings from Supabase
   */
  async syncFromSupabase(): Promise<Record<string, unknown>> {
    if (!isSupabaseConfigured) return this.getAll();

    try {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (!error && Array.isArray(data)) {
        const settings: Record<string, unknown> = {};
        data.forEach((row) => {
          settings[row.key] = row.value;
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return settings;
      }
    } catch (err) {
      console.warn('Settings sync error:', err);
    }
    return this.getAll();
  },

  getAll(): Record<string, unknown> {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch {
      return {};
    }
  },

  get<T>(key: string, defaultValue: T): T {
    const all = this.getAll();
    if (all[key] !== undefined) {
      return all[key] as T;
    }
    return defaultValue;
  },

  async set<T>(key: string, value: T): Promise<void> {
    const all = this.getAll();
    all[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(all));

    if (isSupabaseConfigured) {
      await supabase.from('site_settings').upsert({
        key,
        value: value as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    settingsService.syncFromSupabase().catch(() => {});
  }, 3000);
}

