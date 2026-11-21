/**
 * bananaLeafService — Manages Banana Leaf Meals Customizer configurations & defaults
 * Fully integrated with Supabase (meal_customization_configs table) with instant local fallback.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dishService } from './dishService';
import type { MealCustomizationConfig, MealGroup } from '../types/bananaLeaf';

const LOCAL_STORAGE_KEY = 'kanchi_banana_leaf_meals_config';

/**
 * Built-in default configuration matching authentic South Indian Banana Leaf Feast traditions.
 */
export const DEFAULT_BANANA_LEAF_CONFIG: MealCustomizationConfig = {
  id: 'banana-leaf-meals',
  dishId: 'ms1',
  isEnabled: true,
  titleEn: 'Customize Your Banana Leaf Meals',
  titleTa: 'உங்கள் வாழை இலை உணவைத் தேர்வு செய்யுங்கள்',
  subtitleEn: 'Choose the dishes you want to include in your meal.',
  subtitleTa: 'உங்கள் உணவில் சேர்க்க விரும்பும் உணவுகளைத் தேர்ந்தெடுக்கவும்.',
  updatedAt: new Date().toISOString(),
  groups: [
    {
      id: 'group-rice',
      name: 'Rice Varieties',
      nameTa: 'சாத வகைகள்',
      description: 'Choose your preferred rice options',
      descriptionTa: 'உங்கள் விருப்பமான சாத வகைகளைத் தேர்ந்தெடுக்கவும்',
      minSelections: 1,
      maxSelections: 3,
      isRequired: true,
      dishes: [
        { dishId: 'ms2', dishName: 'Rice', dishNameTa: 'சாதம்', isDefault: true, isRequired: true },
        { dishId: 'vr1', dishName: 'Sambar Rice', dishNameTa: 'சாம்பார் சாதம்', isDefault: false },
        { dishId: 'vr3', dishName: 'Tamarind Rice', dishNameTa: 'புளி சாதம்', isDefault: false },
        { dishId: 'vr4', dishName: 'Lemon Rice', dishNameTa: 'எலுமிச்சை சாதம்', isDefault: false },
        { dishId: 'vr6', dishName: 'Curd Rice', dishNameTa: 'தயிர் சாதம்', isDefault: false },
        { dishId: 'vr9', dishName: 'Veg Pulao', dishNameTa: 'வெஜ் புலாவ்', isDefault: false },
      ],
    },
    {
      id: 'group-kuzhambu',
      name: 'Kuzhambu & Gravies',
      nameTa: 'சாம்பார் & குழம்பு வகைகள்',
      description: 'Essential South Indian gravies',
      descriptionTa: 'பாரம்பரிய சாம்பார் மற்றும் ரச வகைகள்',
      minSelections: 1,
      maxSelections: 3,
      isRequired: true,
      dishes: [
        { dishId: 'ms3', dishName: 'Sambar', dishNameTa: 'சாம்பார்', isDefault: true, isRequired: true },
        { dishId: 'ms5', dishName: 'Tomato Rasam', dishNameTa: 'தக்காளி ரசம்', isDefault: true },
        { dishId: 'ms4', dishName: 'Vatha Kuzhambu', dishNameTa: 'வத்தக் குழம்பு', isDefault: false },
        { dishId: 'ms6', dishName: 'Pepper Rasam', dishNameTa: 'மிளகு ரசம்', isDefault: false },
        { dishId: 'ms7', dishName: 'Pineapple Rasam', dishNameTa: 'அன்னாசி ரசம்', isDefault: false },
      ],
    },
    {
      id: 'group-sides',
      name: 'Vegetable Side Dishes',
      nameTa: 'பொரியல் & கூட்டு வகைகள்',
      description: 'Traditional fresh vegetable sides',
      descriptionTa: 'சுவையான பொரியல் மற்றும் கூட்டு வகைகள்',
      minSelections: 1,
      maxSelections: 3,
      isRequired: true,
      dishes: [
        { dishId: 'ms10', dishName: 'Poriyal', dishNameTa: 'பொரியல்', isDefault: true },
        { dishId: 'ms11', dishName: 'Kootu', dishNameTa: 'கூட்டு', isDefault: true },
        { dishId: 'ms14', dishName: 'Aviyal', dishNameTa: 'அவியல்', isDefault: false },
      ],
    },
    {
      id: 'group-accompaniments',
      name: 'Accompaniments & Crunchies',
      nameTa: 'தொட்டுக்கைகள் & வறுவல்கள்',
      description: 'Crispy appalam, pickle & refreshing buttermilk',
      descriptionTa: 'அப்பளம், ஊறுகாய் மற்றும் நீர்மோர்',
      minSelections: 1,
      maxSelections: 4,
      isRequired: true,
      dishes: [
        { dishId: 'ms12', dishName: 'Appalam', dishNameTa: 'அப்பளம்', isDefault: true, isRequired: true },
        { dishId: 'ms13', dishName: 'Pickle', dishNameTa: 'ஊறுகாய்', isDefault: true },
        { dishId: 'ms9', dishName: 'Buttermilk', dishNameTa: 'மோர்', isDefault: false },
        { dishId: 'ms15', dishName: 'Potato Chips', dishNameTa: 'உருளைக்கிழங்கு சிப்ஸ்', isDefault: false },
        { dishId: 'ms16', dishName: 'Banana Chips', dishNameTa: 'வாழைக்காய் சிப்ஸ்', isDefault: false },
        { dishId: 'ms20', dishName: 'Vathal Varieties', dishNameTa: 'வத்தல் வகைகள்', isDefault: false },
        { dishId: 'ms23', dishName: 'Banana', dishNameTa: 'வாழைப்பழம்', isDefault: false },
        { dishId: 'ms19', dishName: 'Beeda', dishNameTa: 'பீடா', isDefault: false },
      ],
    },
  ],
};

function sanitizeGroups(groups: MealGroup[]): MealGroup[] {
  return (groups || [])
    .filter(
      (g) =>
        g.id !== 'group-sweets' &&
        !g.name.toLowerCase().includes('payasam') &&
        !g.name.toLowerCase().includes('sweet') &&
        !(g.nameTa && g.nameTa.includes('பாயாசம்'))
    )
    .map((g) => ({
      ...g,
      dishes: (g.dishes || []).filter((d) => {
        const idLower = (d.dishId || '').toLowerCase();
        const nameLower = (d.dishName || '').toLowerCase();
        const taLower = (d.dishNameTa || '').toLowerCase();
        return (
          !idLower.startsWith('py') &&
          !nameLower.includes('payasam') &&
          !taLower.includes('பாயாசம்')
        );
      }),
    }));
}

function enrichDishOptions(groups: MealGroup[]): MealGroup[] {
  const allDishes = dishService.getAllDishes();
  const dishMap = new Map(allDishes.map((d) => [d.id, d]));
  const cleaned = sanitizeGroups(groups);

  return cleaned.map((g) => ({
    ...g,
    dishes: g.dishes.map((dish) => {
      const live = dishMap.get(dish.dishId);
      return {
        ...dish,
        dishName: live?.name || dish.dishName,
        dishNameTa: live?.nameTa || dish.dishNameTa,
        image: live?.image || dish.image,
        categoryId: live?.categoryId || dish.categoryId,
      };
    }),
  }));
}

class BananaLeafService {
  private cachedConfig: MealCustomizationConfig | null = null;

  /**
   * Returns current active configuration (cached or loaded from storage/Supabase).
   */
  getConfig(): MealCustomizationConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed: MealCustomizationConfig = JSON.parse(local);
        this.cachedConfig = {
          ...parsed,
          groups: enrichDishOptions(parsed.groups),
        };
        return this.cachedConfig;
      }
    } catch (e) {
      console.warn('[bananaLeafService] Error parsing local storage config:', e);
    }

    // Default configuration enriched with live dish catalog images & metadata
    const config: MealCustomizationConfig = {
      ...DEFAULT_BANANA_LEAF_CONFIG,
      groups: enrichDishOptions(DEFAULT_BANANA_LEAF_CONFIG.groups),
    };
    this.cachedConfig = config;
    return config;
  }

  /**
   * Syncs configuration directly with Supabase.
   */
  async syncFromSupabase(): Promise<MealCustomizationConfig> {
    if (!isSupabaseConfigured) {
      return this.getConfig();
    }

    try {
      const { data, error } = await supabase
        .from('meal_customization_configs')
        .select('*')
        .eq('id', 'banana-leaf-meals')
        .single();

      if (error) {
        // Table might not exist yet before SQL migration is executed; fallback gracefully
        console.info('[bananaLeafService] Using local config (Supabase table not queried):', error.message);
        return this.getConfig();
      }

      if (data) {
        const config: MealCustomizationConfig = {
          id: data.id,
          dishId: data.dish_id || 'ms1',
          isEnabled: data.is_enabled ?? true,
          titleEn: data.title_en || DEFAULT_BANANA_LEAF_CONFIG.titleEn,
          titleTa: data.title_ta || DEFAULT_BANANA_LEAF_CONFIG.titleTa,
          subtitleEn: data.subtitle_en || DEFAULT_BANANA_LEAF_CONFIG.subtitleEn,
          subtitleTa: data.subtitle_ta || DEFAULT_BANANA_LEAF_CONFIG.subtitleTa,
          groups: enrichDishOptions(data.groups || DEFAULT_BANANA_LEAF_CONFIG.groups),
          updatedAt: data.updated_at || new Date().toISOString(),
        };

        this.cachedConfig = config;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
        return config;
      }
    } catch (err) {
      console.warn('[bananaLeafService] Error syncing config from Supabase:', err);
    }

    return this.getConfig();
  }

  /**
   * Saves updated configuration to Supabase & local storage.
   */
  async saveConfig(config: MealCustomizationConfig): Promise<MealCustomizationConfig> {
    const updated: MealCustomizationConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };

    this.cachedConfig = updated;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('meal_customization_configs').upsert({
          id: updated.id,
          dish_id: updated.dishId,
          is_enabled: updated.isEnabled,
          title_en: updated.titleEn,
          title_ta: updated.titleTa,
          subtitle_en: updated.subtitleEn,
          subtitle_ta: updated.subtitleTa,
          groups: updated.groups,
          updated_at: updated.updatedAt,
        });

        if (error) {
          console.warn('[bananaLeafService] Could not upsert to Supabase meal_customization_configs:', error.message);
        } else {
          console.log('[bananaLeafService] Successfully persisted config to Supabase.');
        }
      } catch (err) {
        console.warn('[bananaLeafService] Exception persisting config to Supabase:', err);
      }
    }

    return updated;
  }

  /**
   * Resets configuration to default state.
   */
  async resetToDefaults(): Promise<MealCustomizationConfig> {
    const fresh = {
      ...DEFAULT_BANANA_LEAF_CONFIG,
      groups: enrichDishOptions(DEFAULT_BANANA_LEAF_CONFIG.groups),
      updatedAt: new Date().toISOString(),
    };
    return this.saveConfig(fresh);
  }

  /**
   * Checks whether a dish is the Banana Leaf Meals parent dish.
   */
  isBananaLeafMeals(dishIdOrName: string): boolean {
    if (!dishIdOrName) return false;
    const clean = dishIdOrName.trim().toLowerCase();
    return clean === 'ms1' || clean === 'banana leaf meals' || clean === 'பனானா லீஃப் மீல்ஸ்';
  }

  /**
   * Generates a stable unique ID for a customized meal based on its dish selections.
   */
  generateCustomizationId(selectedDishIds: string[]): string {
    const sorted = [...selectedDishIds].sort().join(',');
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      hash = (hash << 5) - hash + sorted.charCodeAt(i);
      hash |= 0;
    }
    return `blm-${Math.abs(hash).toString(36)}`;
  }
}

export const bananaLeafService = new BananaLeafService();
