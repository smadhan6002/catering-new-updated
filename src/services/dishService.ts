/**
 * dishService — unified dish catalogue & persistence manager
 * Handles both built-in dishes (with editable overrides) and custom admin-added dishes.
 * Fully connected to Supabase database (dishes & categories) with instant local fallback.
 */
import type { AdminDish } from '../types/admin';
import { categories as staticCategories } from '../data/menu';
import { getDishUnitConfig } from '../data/units';
import { ta } from '../locales/ta';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DISHES_KEY = 'annapoorna_admin_dishes';
const UNIT_OVERRIDES_KEY = 'annapoorna_dish_unit_overrides';
const DISH_OVERRIDES_KEY = 'annapoorna_dish_overrides';
const DISH_TAMIL_NAMES_KEY = 'annapoorna_dish_tamil_names';
const DEACTIVATED_DISHES_KEY = 'annapoorna_deactivated_dishes';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const CATEGORY_UUID_MAP: Record<string, string> = {
  'starters': 'c0000000-0000-0000-0000-000000000001',
  'bonda-bajji': 'c0000000-0000-0000-0000-000000000002',
  'beverages': 'c0000000-0000-0000-0000-000000000003',
  'variety-rice': 'c0000000-0000-0000-0000-000000000004',
  'meals-sides': 'c0000000-0000-0000-0000-000000000005',
  'vada-varieties': 'c0000000-0000-0000-0000-000000000006',
  'payasam-varieties': 'c0000000-0000-0000-0000-000000000007',
  'indian-breads': 'c0000000-0000-0000-0000-000000000008',
  'gravy-varieties': 'c0000000-0000-0000-0000-000000000009',
  'halwa-sweets': 'c0000000-0000-0000-0000-000000000010',
  'sweets': 'c0000000-0000-0000-0000-000000000011',
  'tiffin': 'c0000000-0000-0000-0000-000000000012',
  'accompaniments': 'c0000000-0000-0000-0000-000000000013',
  'special-counters': 'c0000000-0000-0000-0000-000000000014',
};

export const DEFAULT_CATEGORIES_TO_SEED = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Starters', tamil_name: 'தொடக்க உணவுகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Bonda & Bajji', tamil_name: 'போண்டா & பஜ்ஜி', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'Beverages', tamil_name: 'பானங்கள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000004', name: 'Variety Rice', tamil_name: 'கலவை சாதம்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000005', name: 'Meals & Sides', tamil_name: 'சாப்பாடு & கூட்டுகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000006', name: 'Vada Varieties', tamil_name: 'வடை வகைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000007', name: 'Payasam Varieties', tamil_name: 'பாயாசம் வகைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000008', name: 'Indian Breads', tamil_name: 'ரொட்டி வகைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000009', name: 'Gravy Varieties', tamil_name: 'குருமா & கிரேவி வகைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000010', name: 'Halwa & Sweets', tamil_name: 'அல்வா & இனிப்புகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000011', name: 'Traditional Sweets', tamil_name: 'பாரம்பரிய இனிப்புகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000012', name: 'Tiffin Varieties', tamil_name: 'சிற்றுண்டி வகைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000013', name: 'Accompaniments', tamil_name: 'தொட்டுக்கைகள்', is_active: true },
  { id: 'c0000000-0000-0000-0000-000000000014', name: 'Special Counters', tamil_name: 'சிறப்பு கவுண்டர்கள்', is_active: true },
];

const UUID_TO_CATEGORY_MAP: Record<string, string> = Object.entries(CATEGORY_UUID_MAP).reduce(
  (acc, [slug, uuid]) => {
    acc[uuid] = slug;
    return acc;
  },
  {} as Record<string, string>
);

export interface DishUnitOverride {
  defaultUnit: string;
  supportedUnits?: string[];
}

export interface DishOverride {
  name?: string;
  nameTa?: string;
  categoryId?: string;
  image?: string;
  defaultUnit?: string;
  isActive?: boolean;
}

export interface UnifiedDish {
  id: string;
  name: string;
  nameTa: string;
  categoryId: string;
  categoryName: string;
  image: string;
  defaultUnit: string;
  isBuiltIn: boolean;
  isAdminAdded: boolean;
  isActive: boolean;
}

function resolveCategoryUUID(slugOrUuid: string): string {
  if (CATEGORY_UUID_MAP[slugOrUuid]) {
    return CATEGORY_UUID_MAP[slugOrUuid];
  }
  return slugOrUuid;
}

function resolveCategorySlug(uuidOrSlug: string): string {
  if (UUID_TO_CATEGORY_MAP[uuidOrSlug]) {
    return UUID_TO_CATEGORY_MAP[uuidOrSlug];
  }
  return uuidOrSlug;
}

export const dishService = {
  /**
   * Synchronizes categories and dishes from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Fetch categories (and auto-seed if empty in Supabase)
      const { data: catData, error: catErr } = await supabase.from('categories').select('*');
      if (catErr) {
        console.warn('Failed to fetch categories:', catErr.message);
      } else if (!catData || catData.length === 0) {
        console.log('Seeding default categories to Supabase...');
        await supabase.from('categories').upsert(DEFAULT_CATEGORIES_TO_SEED, { onConflict: 'id' });
      }

      // 2. Fetch dishes from Supabase
      const { data: dishesData, error: dishErr } = await supabase
        .from('dishes')
        .select('*');

      if (!dishErr && Array.isArray(dishesData)) {
        const local = this.getAll();
        const localMap = new Map(local.map((d) => [d.id, d]));
        const overrides = this.getOverrides();

        dishesData.forEach((row) => {
          const categorySlug = resolveCategorySlug(row.category_id);
          const isDeactivated = row.is_available === false;

          // If dish is an admin custom dish
          const adminDish: AdminDish = {
            id: row.id,
            name: row.name,
            categoryId: categorySlug,
            image: row.image_url || row.image || '',
            isAdminAdded: true,
            defaultUnit: row.default_unit || 'Pieces',
          };
          localMap.set(row.id, adminDish);

          if (row.tamil_name || row.name_ta) {
            this.setCustomTamilName(row.id, row.tamil_name || row.name_ta);
          }

          overrides[row.id] = {
            ...(overrides[row.id] || {}),
            name: row.name,
            nameTa: row.tamil_name || row.name_ta || undefined,
            categoryId: categorySlug,
            image: row.image_url || row.image || undefined,
            isActive: !isDeactivated,
          };
        });

        localStorage.setItem(DISHES_KEY, JSON.stringify(Array.from(localMap.values())));
        localStorage.setItem(DISH_OVERRIDES_KEY, JSON.stringify(overrides));
      }
    } catch (err) {
      console.warn('Dish sync error:', err);
    }
  },

  getAll(): AdminDish[] {
    try {
      return JSON.parse(localStorage.getItem(DISHES_KEY) || '[]') as AdminDish[];
    } catch {
      return [];
    }
  },

  getOverrides(): Record<string, DishOverride> {
    try {
      return JSON.parse(localStorage.getItem(DISH_OVERRIDES_KEY) || '{}');
    } catch {
      return {};
    }
  },

  setOverride(dishId: string, changes: DishOverride): void {
    const allOverrides = this.getOverrides();
    allOverrides[dishId] = { ...(allOverrides[dishId] || {}), ...changes };
    localStorage.setItem(DISH_OVERRIDES_KEY, JSON.stringify(allOverrides));
  },

  getDeactivatedDishIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(DEACTIVATED_DISHES_KEY) || '[]');
    } catch {
      return [];
    }
  },

  getCustomTamilNames(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(DISH_TAMIL_NAMES_KEY) || '{}');
    } catch {
      return {};
    }
  },

  getCustomTamilName(dishId: string): string | undefined {
    const names = this.getCustomTamilNames();
    if (names[dishId]) return names[dishId];
    const overrides = this.getOverrides();
    return overrides[dishId]?.nameTa;
  },

  setCustomTamilName(dishId: string, nameTa: string): void {
    const names = this.getCustomTamilNames();
    names[dishId] = nameTa;
    localStorage.setItem(DISH_TAMIL_NAMES_KEY, JSON.stringify(names));
    this.setOverride(dishId, { nameTa });
  },

  getAllDishes(): UnifiedDish[] {
    const overrides = this.getOverrides();
    const deactivated = this.getDeactivatedDishIds();
    const customTamil = this.getCustomTamilNames();
    const adminDishes = this.getAll();
    const list: UnifiedDish[] = [];

    // 1. Static built-in dishes
    staticCategories.forEach((cat) => {
      cat.items.forEach((item) => {
        const ovr = overrides[item.id] || {};
        const isDeactivated = ovr.isActive !== undefined ? !ovr.isActive : deactivated.includes(item.id);
        const unitOverride = this.getDishUnit(item.id);
        const unitCfg = unitOverride || getDishUnitConfig(item.categoryId);

        const canonicalName = ovr.name || item.name;
        const canonicalCatId = ovr.categoryId || item.categoryId;
        const currentCat = staticCategories.find((c) => c.id === canonicalCatId);
        const categoryName = currentCat ? currentCat.name : canonicalCatId;

        const nameTa =
          ovr.nameTa ||
          customTamil[item.id] ||
          ta.dishTranslationsByEnglishName?.[canonicalName] ||
          ta.dishTranslationsByEnglishName?.[item.name] ||
          (ta.dishes as Record<string, string>)[item.id] ||
          canonicalName;

        list.push({
          id: item.id,
          name: canonicalName,
          nameTa,
          categoryId: canonicalCatId,
          categoryName,
          image: ovr.image || item.image,
          defaultUnit: ovr.defaultUnit || unitCfg.defaultUnit,
          isBuiltIn: true,
          isAdminAdded: false,
          isActive: !isDeactivated,
        });
      });
    });

    // 2. Custom admin-added dishes
    adminDishes.forEach((ad) => {
      const ovr = overrides[ad.id] || {};
      const isDeactivated = ovr.isActive !== undefined ? !ovr.isActive : deactivated.includes(ad.id);
      const unitOverride = this.getDishUnit(ad.id);
      const unitCfg = unitOverride || getDishUnitConfig(ad.categoryId);

      const canonicalName = ovr.name || ad.name;
      const canonicalCatId = ovr.categoryId || ad.categoryId;
      const currentCat = staticCategories.find((c) => c.id === canonicalCatId);
      const categoryName = currentCat ? currentCat.name : canonicalCatId;

      const nameTa =
        ovr.nameTa ||
        customTamil[ad.id] ||
        (ta.dishes as Record<string, string>)[ad.id] ||
        ta.dishTranslationsByEnglishName?.[canonicalName] ||
        canonicalName;

      list.push({
        id: ad.id,
        name: canonicalName,
        nameTa,
        categoryId: canonicalCatId,
        categoryName,
        image: ovr.image || ad.image,
        defaultUnit: ovr.defaultUnit || ad.defaultUnit || unitCfg.defaultUnit,
        isBuiltIn: false,
        isAdminAdded: true,
        isActive: !isDeactivated,
      });
    });

    return list;
  },

  getActiveDishes(categoryId?: string): UnifiedDish[] {
    const all = this.getAllDishes().filter((d) => d.isActive);
    if (!categoryId || categoryId === 'all') return all;
    return all.filter((d) => d.categoryId === categoryId);
  },

  getDishById(id: string): UnifiedDish | undefined {
    return this.getAllDishes().find((d) => d.id === id);
  },

  async add(data: Omit<AdminDish, 'id' | 'isAdminAdded'> & { nameTa?: string }): Promise<AdminDish> {
    const dishes = this.getAll();
    const dishUuid = generateUUID();
    const categoryUuid = resolveCategoryUUID(data.categoryId);

    const dish: AdminDish = {
      id: dishUuid,
      name: data.name,
      categoryId: data.categoryId,
      image: data.image,
      isAdminAdded: true,
      defaultUnit: data.defaultUnit,
    };
    dishes.push(dish);
    localStorage.setItem(DISHES_KEY, JSON.stringify(dishes));

    if (data.nameTa) {
      this.setCustomTamilName(dishUuid, data.nameTa);
    }
    if (data.defaultUnit) {
      this.setUnitOverride(dishUuid, data.defaultUnit);
    }

    // Persist to Supabase dishes table
    if (isSupabaseConfigured) {
      // Ensure category exists to prevent dishes_category_id_fkey foreign key errors
      const { data: catExists } = await supabase
        .from('categories')
        .select('id')
        .eq('id', categoryUuid)
        .maybeSingle();

      if (!catExists) {
        const seedCat = DEFAULT_CATEGORIES_TO_SEED.find((c) => c.id === categoryUuid);
        if (seedCat) {
          await supabase.from('categories').upsert(seedCat, { onConflict: 'id' });
        }
      }

      const { error } = await supabase.from('dishes').insert({
        id: dishUuid,
        name: data.name,
        tamil_name: data.nameTa || data.name,
        category_id: categoryUuid,
        image_url: data.image || null,
        price: 0,
        is_available: true,
      });

      if (error) {
        console.error('Failed to insert dish in Supabase:', error);
        throw new Error(error.message);
      }
    }

    return dish;
  },

  async updateDish(
    id: string,
    changes: {
      name?: string;
      nameTa?: string;
      categoryId?: string;
      image?: string;
      defaultUnit?: string;
      isActive?: boolean;
    }
  ): Promise<void> {
    this.setOverride(id, changes);

    const dishes = this.getAll();
    const idx = dishes.findIndex((d) => d.id === id);
    if (idx !== -1) {
      dishes[idx] = {
        ...dishes[idx],
        name: changes.name ?? dishes[idx].name,
        categoryId: changes.categoryId ?? dishes[idx].categoryId,
        image: changes.image ?? dishes[idx].image,
        defaultUnit: changes.defaultUnit ?? dishes[idx].defaultUnit,
      };
      localStorage.setItem(DISHES_KEY, JSON.stringify(dishes));
    }

    if (changes.nameTa) {
      this.setCustomTamilName(id, changes.nameTa);
    }
    if (changes.defaultUnit) {
      this.setUnitOverride(id, changes.defaultUnit);
    }

    if (changes.isActive !== undefined) {
      if (changes.isActive) {
        await this.reactivateDish(id);
      } else {
        await this.deactivateDish(id);
      }
    }

    // Update in Supabase
    if (isSupabaseConfigured) {
      // If this is a valid UUID, update or upsert in dishes
      const isValidUuid = id.length >= 32 && id.includes('-');
      if (isValidUuid) {
        const updatePayload: Record<string, any> = {
          name: changes.name,
          tamil_name: changes.nameTa,
          image_url: changes.image,
          is_available: changes.isActive,
        };
        if (changes.categoryId) {
          const catUuid = resolveCategoryUUID(changes.categoryId);
          updatePayload.category_id = catUuid;
          const { data: catExists } = await supabase
            .from('categories')
            .select('id')
            .eq('id', catUuid)
            .maybeSingle();
          if (!catExists) {
            const seedCat = DEFAULT_CATEGORIES_TO_SEED.find((c) => c.id === catUuid);
            if (seedCat) {
              await supabase.from('categories').upsert(seedCat, { onConflict: 'id' });
            }
          }
        }

        const { error } = await supabase
          .from('dishes')
          .update(updatePayload)
          .eq('id', id);

        if (error) console.warn('Supabase dish update warning:', error.message);
      }
    }
  },

  async update(id: string, changes: Partial<Omit<AdminDish, 'id' | 'isAdminAdded'>>): Promise<AdminDish | undefined> {
    await this.updateDish(id, changes);
    return this.getAll().find((d) => d.id === id);
  },

  async deactivateDish(id: string): Promise<void> {
    const deactivated = this.getDeactivatedDishIds();
    if (!deactivated.includes(id)) {
      deactivated.push(id);
      localStorage.setItem(DEACTIVATED_DISHES_KEY, JSON.stringify(deactivated));
    }
    this.setOverride(id, { isActive: false });

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
      await supabase.from('dishes').update({ is_available: false }).eq('id', id);
    }
  },

  async reactivateDish(id: string): Promise<void> {
    const deactivated = this.getDeactivatedDishIds().filter((d) => d !== id);
    localStorage.setItem(DEACTIVATED_DISHES_KEY, JSON.stringify(deactivated));
    this.setOverride(id, { isActive: true });

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
      await supabase.from('dishes').update({ is_available: true }).eq('id', id);
    }
  },

  async deleteDish(id: string): Promise<void> {
    const adminDishes = this.getAll();
    const isCustom = adminDishes.some((d) => d.id === id);
    if (isCustom) {
      const updated = adminDishes.filter((d) => d.id !== id);
      localStorage.setItem(DISHES_KEY, JSON.stringify(updated));
      if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
        await supabase.from('dishes').delete().eq('id', id);
      }
    }
    await this.deactivateDish(id);
  },

  async delete(id: string): Promise<void> {
    await this.deleteDish(id);
  },

  getUnitOverrides(): Record<string, DishUnitOverride> {
    try {
      return JSON.parse(localStorage.getItem(UNIT_OVERRIDES_KEY) || '{}');
    } catch {
      return {};
    }
  },

  setUnitOverride(dishId: string, defaultUnit: string, supportedUnits?: string[]): void {
    const overrides = this.getUnitOverrides();
    overrides[dishId] = { defaultUnit, supportedUnits };
    localStorage.setItem(UNIT_OVERRIDES_KEY, JSON.stringify(overrides));
  },

  getDishUnit(dishId: string): DishUnitOverride | undefined {
    const adminDish = this.getAll().find((d) => d.id === dishId);
    if (adminDish?.defaultUnit) {
      return {
        defaultUnit: adminDish.defaultUnit,
        supportedUnits: adminDish.supportedUnits,
      };
    }
    const overrides = this.getUnitOverrides();
    return overrides[dishId];
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    dishService.syncFromSupabase().catch(() => {});
  }, 1000);
}
