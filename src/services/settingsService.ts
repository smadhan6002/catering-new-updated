/**
 * settingsService — Site settings persistence with Supabase `site_settings` table
 * Uses live schema columns: `id`, `setting_key`, `setting_value`, `updated_at`.
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
        const settings: Record<string, unknown> = { ...this.getAll() };
        data.forEach((row: Record<string, unknown>) => {
          const settingKey = (row.setting_key as string) ?? (row.key as string);
          if (settingKey) {
            settings[settingKey] =
              row.setting_value !== undefined ? row.setting_value : row.value;
          }
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
      const { error } = await supabase.from('site_settings').upsert(
        {
          setting_key: key,
          setting_value: value as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' }
      );
      if (error) {
        console.error('Failed to save setting in Supabase:', error.message);
        throw new Error(error.message);
      }
    }
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    settingsService.syncFromSupabase().catch(() => {});
  }, 3000);
}
