/**
 * rentalService — handles rental items inventory, categories, transactions and documents
 * Data is backed by Supabase (rental_items, rental_documents, rental_document_items, site_settings)
 * with reliable offline localStorage fallback.
 */
import type {
  RentalCategory,
  RentalItem,
  RentalDocument,
  RentalDocItem,
  RentalStatus,
} from '../types/rental';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const RENTAL_ITEMS_KEY = 'annapoorna_rental_items';
const RENTAL_CATEGORIES_KEY = 'annapoorna_rental_categories';
const RENTAL_DOCS_KEY = 'annapoorna_rental_documents';
const RENTAL_COUNTER_KEY = 'annapoorna_rental_counter';
const RENTAL_META_KEY = 'kanchi_rental_metadata';
const RENTAL_CATALOG_VERSION_KEY = 'kanchi_rental_catalog_v2';

const SITE_KEY_RENTAL_META = 'kanchi_rental_metadata';
const SITE_KEY_RENTAL_CATS = 'kanchi_rental_categories';

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

function isUuid(id?: string): boolean {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}

export const DEFAULT_RENTAL_CATEGORIES: RentalCategory[] = [
  { id: 'cat-cooking', name: 'Cooking Vessels', nameTa: 'சமையல் பாத்திரங்கள்', description: 'Large pots, andas, cauldrons for cooking' },
  { id: 'cat-serving', name: 'Serving Vessels', nameTa: 'பரிமாறும் பாத்திரங்கள்', description: 'Buckets, basins, spoons, serving dishes' },
  { id: 'cat-carriers', name: 'Food Carriers', nameTa: 'உணவு எடுத்துச் செல்லும் பாத்திரங்கள்', description: 'Multi-tier carriers, food drums with lids' },
  { id: 'cat-hotboxes', name: 'Hot Boxes', nameTa: 'ஹாட்பாக்ஸ் வகைகள்', description: 'Insulated hot cases and casseroles' },
  { id: 'cat-plates', name: 'Plates and Trays', nameTa: 'தட்டுகள் & தட்டகங்கள்', description: 'Dining plates, water tumblers, buffet trays' },
  { id: 'cat-beverages', name: 'Beverage Equipment', nameTa: 'பான சாதனங்கள்', description: 'Coffee flasks, tea cans, milk warmers' },
  { id: 'cat-other', name: 'Other Items', nameTa: 'இதர பொருட்கள்', description: 'Miscellaneous catering equipment & accessories' },
];

export type SeededRentalItem = Omit<RentalItem, 'id' | 'availableQuantity' | 'createdAt'> & {
  id?: string;
};

export const INITIAL_RENTAL_ITEMS: SeededRentalItem[] = [
  // Existing 13 Rental Items (RNT-001 to RNT-013)
  {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'RNT-001',
    nameEn: 'Anda (Large Cooking Vessel)',
    nameTa: 'அண்டா',
    categoryId: 'cat-cooking',
    totalQuantity: 25,
    rentalPrice: 150,
    pricingUnit: 'Per Day',
    securityDeposit: 500,
    description: 'Heavy duty stainless steel cooking cauldron for large feasts',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    code: 'RNT-002',
    nameEn: 'Aadukku (Tiered Cooking Pots)',
    nameTa: 'அடுக்கு',
    categoryId: 'cat-cooking',
    totalQuantity: 20,
    rentalPrice: 120,
    pricingUnit: 'Per Day',
    securityDeposit: 400,
    description: 'Traditional tiered cooking vessel set',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    code: 'RNT-003',
    nameEn: 'Thookku with Lid',
    nameTa: 'தூக்கு (மூடியுடன்)',
    categoryId: 'cat-cooking',
    totalQuantity: 30,
    rentalPrice: 80,
    pricingUnit: 'Per Day',
    securityDeposit: 200,
    description: 'Deep storage and cooking vessel with tight fitting lid',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    code: 'RNT-004',
    nameEn: 'Thookku without Lid',
    nameTa: 'தூக்கு (மூடி இல்லாமல்)',
    categoryId: 'cat-cooking',
    totalQuantity: 20,
    rentalPrice: 60,
    pricingUnit: 'Per Day',
    securityDeposit: 150,
    description: 'Deep open vessel for mixing and holding liquids',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    code: 'RNT-005',
    nameEn: 'Drum with Lid',
    nameTa: 'டிரம் (மூடியுடன்)',
    categoryId: 'cat-carriers',
    totalQuantity: 20,
    rentalPrice: 150,
    pricingUnit: 'Per Day',
    securityDeposit: 500,
    description: 'Large food transport drum with lockable lid',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    code: 'RNT-006',
    nameEn: 'Drum without Lid',
    nameTa: 'டிரம் (மூடி இல்லாமல்)',
    categoryId: 'cat-carriers',
    totalQuantity: 15,
    rentalPrice: 100,
    pricingUnit: 'Per Day',
    securityDeposit: 300,
    description: 'Large capacity holding drum',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000007',
    code: 'RNT-007',
    nameEn: 'Bucket (Sambar / Rasam)',
    nameTa: 'வாளி (சாம்பார் / ரசம்)',
    categoryId: 'cat-serving',
    totalQuantity: 40,
    rentalPrice: 50,
    pricingUnit: 'Per Day',
    securityDeposit: 100,
    description: 'Serving bucket with sturdy handle',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000008',
    code: 'RNT-008',
    nameEn: 'Basin (Large Food Holding Basin)',
    nameTa: 'பேசின்',
    categoryId: 'cat-serving',
    totalQuantity: 35,
    rentalPrice: 60,
    pricingUnit: 'Per Day',
    securityDeposit: 150,
    description: 'Wide mouth stainless steel basin for rice and gravies',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000009',
    code: 'RNT-009',
    nameEn: 'Spoon Set (Serving Ladles & Spoons)',
    nameTa: 'கரண்டி செட்',
    categoryId: 'cat-serving',
    totalQuantity: 25,
    rentalPrice: 80,
    pricingUnit: 'Per Day',
    securityDeposit: 150,
    description: 'Assorted set of heavy-duty serving spoons and ladles (set of 5)',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000010',
    code: 'RNT-010',
    nameEn: 'Hot Box (Large Feasts Casserole)',
    nameTa: 'ஹாட்பாக்ஸ் (பெரியது)',
    categoryId: 'cat-hotboxes',
    totalQuantity: 30,
    rentalPrice: 120,
    pricingUnit: 'Per Day',
    securityDeposit: 300,
    description: 'Double wall thermal insulated food carrier',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000011',
    code: 'RNT-011',
    nameEn: 'Tea / Coffee Flask (10L)',
    nameTa: 'டீ பிளாஸ்க் (10L)',
    categoryId: 'cat-beverages',
    totalQuantity: 15,
    rentalPrice: 150,
    pricingUnit: 'Per Day',
    securityDeposit: 400,
    description: 'Insulated beverage dispenser with tap',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000012',
    code: 'RNT-012',
    nameEn: 'Dining Plate (Stainless Steel)',
    nameTa: 'சாப்பாட்டு தட்டு',
    categoryId: 'cat-plates',
    totalQuantity: 300,
    rentalPrice: 5,
    pricingUnit: 'Per Piece',
    securityDeposit: 15,
    description: 'Traditional round 5-compartment dining plate',
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000013',
    code: 'RNT-013',
    nameEn: 'Water Tumbler (Stainless Steel)',
    nameTa: 'தண்ணீர் டம்ளர்',
    categoryId: 'cat-plates',
    totalQuantity: 300,
    rentalPrice: 3,
    pricingUnit: 'Per Piece',
    securityDeposit: 10,
    description: 'Mirror finish drinking water cup',
    isActive: true,
  },

  // Catering Book Missing Utensils & Equipment (RNT-014 to RNT-037)
  {
    id: '20000000-0000-4000-8000-000000000014',
    code: 'RNT-014',
    nameEn: 'Big Bamboo Basket',
    nameTa: 'பெரிய மூங்கில் கூடை',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000015',
    code: 'RNT-015',
    nameEn: 'Small Bamboo Basket',
    nameTa: 'சிறிய மூங்கில் கூடை',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000016',
    code: 'RNT-016',
    nameEn: 'Bamboo Tray / Plate',
    nameTa: 'மூங்கில் தட்டு',
    categoryId: 'cat-plates',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000017',
    code: 'RNT-017',
    nameEn: 'Mixer Grinder (with 2 Jars)',
    nameTa: 'மிக்ஸி 2 ஜாருடன்',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000018',
    code: 'RNT-018',
    nameEn: 'Commercial Gas Cylinder (Large)',
    nameTa: 'சிலிண்டர் (பெரியது)',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000019',
    code: 'RNT-019',
    nameEn: 'Big Dabara',
    nameTa: 'பெரிய டபரா',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000020',
    code: 'RNT-020',
    nameEn: 'Small Dabara',
    nameTa: 'சிறிய டபாரா',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000021',
    code: 'RNT-021',
    nameEn: 'Large Kuthu Adukku (Tiered Vessel)',
    nameTa: 'பெரிய குத்து அடுக்கு',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000022',
    code: 'RNT-022',
    nameEn: 'Small Kuthu Adukku (Tiered Vessel)',
    nameTa: 'சிறிய குத்து அடுக்கு',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000023',
    code: 'RNT-023',
    nameEn: 'Half Anda',
    nameTa: 'அரை அண்டா',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000024',
    code: 'RNT-024',
    nameEn: 'Quarter Anda',
    nameTa: 'கால் அண்டா',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000025',
    code: 'RNT-025',
    nameEn: 'Idli Steamer Pot',
    nameTa: 'இட்லி பானை',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000026',
    code: 'RNT-026',
    nameEn: 'Sugar / Sweet Kadai',
    nameTa: 'சக்கரைப் கடாய்',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000027',
    code: 'RNT-027',
    nameEn: 'Oil Frying Kadai',
    nameTa: 'எண்ணெய் கடாய்',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000028',
    code: 'RNT-028',
    nameEn: 'Annakoodai (Rice Draining Basket)',
    nameTa: 'அன்னக்கூடை',
    categoryId: 'cat-serving',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000029',
    code: 'RNT-029',
    nameEn: 'Coconut Scraper (Manual)',
    nameTa: 'தேங்காய் துருவல்',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000030',
    code: 'RNT-030',
    nameEn: 'Aluminium Tray',
    nameTa: 'அலுமினிய டிரே',
    categoryId: 'cat-plates',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000031',
    code: 'RNT-031',
    nameEn: 'Double Burner Gas Stove',
    nameTa: 'இரட்டை கேஸ் அடுப்பு',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000032',
    code: 'RNT-032',
    nameEn: 'Single Burner Gas Stove',
    nameTa: 'ஒற்றை கேஸ் அடுப்பு',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000033',
    code: 'RNT-033',
    nameEn: 'Dosa Tawa / Griddle',
    nameTa: 'தோசைக்கல்',
    categoryId: 'cat-cooking',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000034',
    code: 'RNT-034',
    nameEn: 'Water Jug',
    nameTa: 'தண்ணீர் ஜக்',
    categoryId: 'cat-serving',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000035',
    code: 'RNT-035',
    nameEn: 'Annakuthi (Rice Server Scoop)',
    nameTa: 'அன்னக்குத்தி',
    categoryId: 'cat-serving',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000036',
    code: 'RNT-036',
    nameEn: 'Vaal Kinnam (Long-Handled Serving Bowl)',
    nameTa: 'வால் கிண்ணம்',
    categoryId: 'cat-serving',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000037',
    code: 'RNT-037',
    nameEn: 'Coconut Grater Machine',
    nameTa: 'தேங்காய் துருவல் மெஷின்',
    categoryId: 'cat-other',
    totalQuantity: 0,
    rentalPrice: 0,
    pricingUnit: 'Per Day',
    securityDeposit: 0,
    isActive: true,
  },
];

type RentalItemMeta = {
  code?: string;
  categoryId?: string;
  totalQuantity?: number;
  securityDeposit?: number;
  description?: string;
  notes?: string;
  isActive?: boolean;
};

const SEEDED_RENTAL_META_BY_ID: Record<string, RentalItemMeta> = Object.fromEntries(
  INITIAL_RENTAL_ITEMS.filter((it) => it.id).map((it) => [
    it.id as string,
    {
      code: it.code,
      categoryId: it.categoryId,
      totalQuantity: it.totalQuantity,
      securityDeposit: it.securityDeposit ?? 0,
      ...(it.description ? { description: it.description } : {}),
      isActive: it.isActive ?? true,
    },
  ])
);

function extractRentalMeta(item: Partial<RentalItem>): RentalItemMeta {
  const meta: RentalItemMeta = {};
  if (item.code) meta.code = item.code;
  if (item.categoryId) meta.categoryId = item.categoryId;
  if (item.totalQuantity !== undefined) meta.totalQuantity = Number(item.totalQuantity);
  if (item.securityDeposit !== undefined) meta.securityDeposit = Number(item.securityDeposit);
  if (item.description) meta.description = item.description;
  if (item.notes) meta.notes = item.notes;
  meta.isActive = item.isActive ?? true;
  return meta;
}

function getLocalMetaMap(): Record<string, RentalItemMeta> {
  try {
    return JSON.parse(localStorage.getItem(RENTAL_META_KEY) || '{}') as Record<
      string,
      RentalItemMeta
    >;
  } catch {
    return {};
  }
}

function saveLocalMetaMap(metaMap: Record<string, RentalItemMeta>): void {
  localStorage.setItem(RENTAL_META_KEY, JSON.stringify(metaMap));
}

async function persistRemoteSetting(key: string, value: unknown): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('site_settings').upsert(
    {
      setting_key: key,
      setting_value: value as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' }
  );
  if (error) {
    console.warn(`Supabase site_settings (${key}) warning:`, error.message);
  }
}

function mergeRentalCategories(
  storedCats: RentalCategory[],
  remoteCats: RentalCategory[] = []
): RentalCategory[] {
  const map = new Map<string, RentalCategory>();
  DEFAULT_RENTAL_CATEGORIES.forEach((c) => map.set(c.id, c));
  storedCats.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  remoteCats.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  return Array.from(map.values());
}

function getCounter(): number {
  return parseInt(localStorage.getItem(RENTAL_COUNTER_KEY) || '0', 10);
}

function generateRentalNumber(): string {
  const next = getCounter() + 1;
  localStorage.setItem(RENTAL_COUNTER_KEY, String(next));
  const year = new Date().getFullYear();
  return `RNT-${year}-${String(next).padStart(4, '0')}`;
}

export const rentalService = {
  /**
   * Synchronizes rental categories, items, metadata, and transactions from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Items & Settings metadata/categories
      const [{ data: itemData, error: itemErr }, { data: settingsRows }] = await Promise.all([
        supabase.from('rental_items').select('*'),
        supabase
          .from('site_settings')
          .select('*')
          .in('setting_key', [SITE_KEY_RENTAL_META, SITE_KEY_RENTAL_CATS]),
      ]);

      let remoteMetaMap: Record<string, RentalItemMeta> = {};
      let remoteCats: RentalCategory[] = [];
      if (Array.isArray(settingsRows)) {
        for (const row of settingsRows as Array<Record<string, any>>) {
          const sKey = row.setting_key ?? row.key;
          const sVal = row.setting_value !== undefined ? row.setting_value : row.value;
          if (sKey === SITE_KEY_RENTAL_META && sVal && typeof sVal === 'object') {
            remoteMetaMap = sVal as Record<string, RentalItemMeta>;
          } else if (sKey === SITE_KEY_RENTAL_CATS && Array.isArray(sVal)) {
            remoteCats = sVal as RentalCategory[];
          }
        }
      }

      const localCatsRaw = (() => {
        try {
          return JSON.parse(localStorage.getItem(RENTAL_CATEGORIES_KEY) || '[]') as RentalCategory[];
        } catch {
          return [];
        }
      })();
      const mergedCategories = mergeRentalCategories(localCatsRaw, remoteCats);
      localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(mergedCategories));

      const localMetaMap = getLocalMetaMap();
      const mergedMetaMap: Record<string, RentalItemMeta> = {
        ...SEEDED_RENTAL_META_BY_ID,
        ...localMetaMap,
        ...remoteMetaMap,
      };
      saveLocalMetaMap(mergedMetaMap);

      let syncedItems: RentalItem[] = this.getRawItems();

      if (!itemErr && Array.isArray(itemData) && itemData.length > 0) {
        const localMap = new Map(syncedItems.map((r) => [r.id, r]));

        syncedItems = itemData
          .map((r: Record<string, any>, idx: number) => {
            let notesMeta: Record<string, any> = {};
            if (typeof r.notes === 'string' && r.notes.startsWith('{')) {
              try {
                notesMeta = JSON.parse(r.notes);
              } catch {
                notesMeta = {};
              }
            }

            const localExisting = localMap.get(r.id);
            const fallbackLocalMeta = localExisting ? extractRentalMeta(localExisting) : {};
            const meta: RentalItemMeta = {
              ...(SEEDED_RENTAL_META_BY_ID[r.id] || {}),
              ...fallbackLocalMeta,
              ...(mergedMetaMap[r.id] || {}),
              ...(notesMeta as RentalItemMeta),
            };

            const totalQty =
              meta.totalQuantity != null
                ? Number(meta.totalQuantity)
                : r.total_quantity != null
                ? Number(r.total_quantity)
                : 0;

            return {
              id: r.id,
              code: meta.code || r.code || `RNT-${String(idx + 1).padStart(3, '0')}`,
              nameEn: r.name || r.name_en || '',
              nameTa: r.tamil_name || r.name_ta || '',
              categoryId: meta.categoryId || r.category_id || 'cat-other',
              totalQuantity: totalQty,
              rentalPrice: Number(r.price ?? r.rental_price) || 0,
              pricingUnit: r.unit || r.pricing_unit || 'Per Day',
              securityDeposit:
                meta.securityDeposit != null
                  ? Number(meta.securityDeposit)
                  : Number(r.security_deposit) || 0,
              description: meta.description || r.description || undefined,
              notes:
                meta.notes || (meta.code ? undefined : r.notes) || undefined,
              isActive: meta.isActive ?? (r.is_active ?? true),
              availableQuantity: totalQty,
              createdAt: r.created_at || localExisting?.createdAt || new Date().toISOString(),
              updatedAt: r.updated_at || r.created_at || localExisting?.updatedAt || new Date().toISOString(),
            };
          })
          .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(syncedItems));
        localStorage.setItem(RENTAL_CATALOG_VERSION_KEY, '1');
      }

      const syncedItemById = new Map(syncedItems.map((i) => [i.id, i]));

      // 2. Documents & Items
      const { data: docData, error: docErr } = await supabase
        .from('rental_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!docErr && Array.isArray(docData)) {
        if (docData.length === 0) {
          localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify([]));
        } else {
          const docIds = docData.map((d) => d.id);
          const { data: itemRows } = await supabase
            .from('rental_document_items')
            .select('*')
            .in('document_id', docIds);

          const itemsByDocId: Record<string, RentalDocItem[]> = {};
          if (Array.isArray(itemRows)) {
            itemRows.forEach((r) => {
              if (!itemsByDocId[r.document_id]) itemsByDocId[r.document_id] = [];
              const catalogMatch = r.item_id ? syncedItemById.get(r.item_id) : undefined;
              itemsByDocId[r.document_id].push({
                itemId: r.item_id || '',
                itemCode: catalogMatch?.code || '',
                nameEn: r.item_name || catalogMatch?.nameEn || '',
                nameTa: catalogMatch?.nameTa || r.item_name || '',
                quantity: Number(r.quantity) || 0,
                returnedQuantity: Number(r.returned_quantity) || 0,
                pricePerUnit: Number(r.price) || 0,
                pricingUnit: catalogMatch?.pricingUnit || 'Per Day',
                lineTotal: Number(r.subtotal) || (Number(r.quantity) * Number(r.price)),
              });
            });
          }

          const mappedDocs: RentalDocument[] = docData.map((rd) => {
            let meta: Record<string, any> = {};
            if (rd.notes && rd.notes.startsWith('{')) {
              try {
                meta = JSON.parse(rd.notes);
              } catch {
                meta = {};
              }
            }

            const tableItems = itemsByDocId[rd.id];
            const metaItems = Array.isArray(meta.items) ? (meta.items as RentalDocItem[]) : null;
            const docItems =
              tableItems && tableItems.length > 0
                ? tableItems.map((ti, idx) => {
                    const mItem = metaItems?.[idx];
                    return {
                      ...ti,
                      itemCode: mItem?.itemCode || ti.itemCode,
                      nameTa: mItem?.nameTa || ti.nameTa,
                      returnedQuantity: mItem?.returnedQuantity ?? ti.returnedQuantity,
                      pricingUnit: mItem?.pricingUnit || ti.pricingUnit,
                      notes: mItem?.notes || ti.notes,
                    };
                  })
                : metaItems || (Array.isArray(rd.items) ? rd.items : []);
            return {
              id: rd.id,
              rentalNumber: meta.rentalNumber || rd.rental_number || `RNT-${rd.id.substring(0, 8)}`,
              customerName: rd.customer_name || meta.customerName || '',
              mobile: rd.phone || rd.mobile || meta.mobile || '',
              address: meta.address || rd.address || undefined,
              functionName: meta.functionName || rd.function_name || undefined,
              documentDate: rd.document_date || new Date().toISOString().split('T')[0],
              functionDate: meta.functionDate || rd.function_date || rd.document_date,
              rentalStartDate: meta.rentalStartDate || rd.rental_start_date || rd.document_date,
              expectedReturnDate: meta.expectedReturnDate || rd.expected_return_date || rd.document_date,
              actualReturnDate: meta.actualReturnDate || rd.actual_return_date || undefined,
              deliveryDetails: meta.deliveryDetails || rd.delivery_details || undefined,
              items: docItems,
              subtotal: meta.subtotal != null ? Number(meta.subtotal) : (Number(rd.subtotal) || 0),
              additionalCharges: meta.additionalCharges != null ? Number(meta.additionalCharges) : (Number(rd.additional_charges) || 0),
              discount: meta.discount != null ? Number(meta.discount) : (Number(rd.discount) || 0),
              securityDeposit: meta.securityDeposit != null ? Number(meta.securityDeposit) : (Number(rd.security_deposit) || 0),
              grandTotal: meta.grandTotal != null ? Number(meta.grandTotal) : (Number(rd.grand_total) || 0),
              advancePaid: meta.advancePaid != null ? Number(meta.advancePaid) : (Number(rd.advance_paid) || 0),
              balanceDue: meta.balanceDue != null ? Number(meta.balanceDue) : (Number(rd.balance_due) || 0),
              status: (meta.status || rd.status || 'Confirmed') as RentalStatus,
              notes: meta.notes || (meta.rentalNumber ? undefined : rd.notes) || undefined,
              terms: meta.terms || rd.terms || undefined,
              preferredLanguage: meta.preferredLanguage || rd.preferred_language || 'en',
              createdAt: rd.created_at || new Date().toISOString(),
              updatedAt: rd.updated_at || rd.created_at || new Date().toISOString(),
            };
          });

          localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(mappedDocs));
        }
      }
    } catch (err) {
      console.warn('Rental sync error:', err);
    }
  },

  // ─── CATEGORIES ─────────────────────────────────────────────────────────
  getCategories(): RentalCategory[] {
    try {
      const stored = localStorage.getItem(RENTAL_CATEGORIES_KEY);
      const parsed = stored ? (JSON.parse(stored) as RentalCategory[]) : [];
      const merged = mergeRentalCategories(Array.isArray(parsed) ? parsed : []);
      if (!stored || merged.length !== parsed.length) {
        localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(merged));
      }
      return merged;
    } catch {
      return DEFAULT_RENTAL_CATEGORIES;
    }
  },

  getCategoryById(id: string): RentalCategory | undefined {
    return this.getCategories().find((c) => c.id === id);
  },

  addCategory(data: { name: string; nameTa: string; description?: string }): RentalCategory {
    const cleanName = data.name.trim();
    const cleanNameTa = data.nameTa.trim() || cleanName;
    const cats = this.getCategories();
    const existing = cats.find(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing;

    const id = `cat-custom-${Date.now()}`;
    const newCat: RentalCategory = {
      id,
      name: cleanName,
      nameTa: cleanNameTa,
      description: data.description,
    };
    cats.push(newCat);
    localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(cats));
    persistRemoteSetting(SITE_KEY_RENTAL_CATS, cats).catch(() => {});
    return newCat;
  },

  updateCategory(id: string, data: Partial<RentalCategory>): RentalCategory | undefined {
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    cats[idx] = { ...cats[idx], ...data };
    localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(cats));
    persistRemoteSetting(SITE_KEY_RENTAL_CATS, cats).catch(() => {});
    return cats[idx];
  },

  // ─── ITEMS ─────────────────────────────────────────────────────────────
  getRawItems(): RentalItem[] {
    try {
      const stored = localStorage.getItem(RENTAL_ITEMS_KEY);
      if (!stored) {
        const now = new Date().toISOString();
        const seeded: RentalItem[] = INITIAL_RENTAL_ITEMS.map((item) => ({
          ...item,
          id: item.id || generateUUID(),
          availableQuantity: item.totalQuantity,
          createdAt: now,
        }));
        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(seeded));
        localStorage.setItem(RENTAL_CATALOG_VERSION_KEY, '1');
        return seeded;
      }

      const parsed = JSON.parse(stored) as RentalItem[];
      const isUpgraded = localStorage.getItem(RENTAL_CATALOG_VERSION_KEY) === '1';

      if (!isUpgraded && Array.isArray(parsed)) {
        const now = new Date().toISOString();
        const byCode = new Map<string, RentalItem>();
        const byEnName = new Map<string, RentalItem>();
        parsed.forEach((it) => {
          if (it?.code) byCode.set(it.code.trim().toUpperCase(), it);
          if (it?.nameEn) byEnName.set(it.nameEn.trim().toLowerCase(), it);
        });

        const metaMap = getLocalMetaMap();
        const seededById = new Set<string>();
        const seededCodes = new Set(INITIAL_RENTAL_ITEMS.map((s) => s.code.trim().toUpperCase()));
        const seededNames = new Set(INITIAL_RENTAL_ITEMS.map((s) => s.nameEn.trim().toLowerCase()));

        const merged: RentalItem[] = INITIAL_RENTAL_ITEMS.map((seed) => {
          const seedId = seed.id || generateUUID();
          seededById.add(seedId);
          const legacy =
            byCode.get(seed.code.trim().toUpperCase()) ||
            byEnName.get(seed.nameEn.trim().toLowerCase());

          const item: RentalItem = {
            ...seed,
            ...(legacy || {}),
            id: seedId,
            code: seed.code,
            nameEn: legacy?.nameEn || seed.nameEn,
            nameTa: legacy?.nameTa || seed.nameTa,
            categoryId: legacy?.categoryId || seed.categoryId,
            totalQuantity: legacy?.totalQuantity ?? seed.totalQuantity,
            rentalPrice: legacy?.rentalPrice ?? seed.rentalPrice,
            pricingUnit: legacy?.pricingUnit || seed.pricingUnit,
            securityDeposit: legacy?.securityDeposit ?? seed.securityDeposit,
            description: legacy?.description ?? seed.description,
            isActive: legacy?.isActive ?? seed.isActive,
            availableQuantity: legacy?.totalQuantity ?? seed.totalQuantity,
            createdAt: legacy?.createdAt || now,
          };
          metaMap[seedId] = extractRentalMeta(item);
          return item;
        });

        parsed.forEach((it) => {
          const codeKey = it?.code?.trim().toUpperCase() || '';
          const nameKey = it?.nameEn?.trim().toLowerCase() || '';
          if (
            it &&
            !seededById.has(it.id) &&
            !seededCodes.has(codeKey) &&
            !seededNames.has(nameKey)
          ) {
            merged.push(it);
            metaMap[it.id] = extractRentalMeta(it);
          }
        });

        saveLocalMetaMap(metaMap);
        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(merged));
        localStorage.setItem(RENTAL_CATALOG_VERSION_KEY, '1');
        return merged;
      }

      return parsed;
    } catch {
      return [];
    }
  },

  getAllItems(): RentalItem[] {
    const items = this.getRawItems();
    const documents = this.getAllDocuments();

    const rentedCountMap: Record<string, number> = {};
    for (const doc of documents) {
      if (doc.status === 'Items Issued' || doc.status === 'Confirmed' || doc.status === 'Partially Returned') {
        for (const itm of doc.items) {
          const outQty = Math.max(0, itm.quantity - (itm.returnedQuantity || 0));
          rentedCountMap[itm.itemId] = (rentedCountMap[itm.itemId] || 0) + outQty;
        }
      }
    }

    return items.map((item) => {
      const currentlyRented = rentedCountMap[item.id] || 0;
      const available = Math.max(0, item.totalQuantity - currentlyRented);
      return {
        ...item,
        availableQuantity: available,
      };
    });
  },

  getActiveItems(): RentalItem[] {
    return this.getAllItems().filter((item) => item.isActive);
  },

  getItemById(id: string): RentalItem | undefined {
    return this.getAllItems().find((item) => item.id === id);
  },

  getItemByCode(code: string): RentalItem | undefined {
    const trimmed = code.trim().toLowerCase();
    return this.getAllItems().find((item) => item.code.trim().toLowerCase() === trimmed);
  },

  async addItem(
    data: Omit<RentalItem, 'id' | 'availableQuantity' | 'createdAt' | 'updatedAt'>
  ): Promise<RentalItem> {
    const items = this.getRawItems();

    const code = data.code.trim();
    if (items.some((i) => i.code.toLowerCase() === code.toLowerCase())) {
      throw new Error(`Item code "${code}" already exists. Please choose a unique code.`);
    }

    const nextId = generateUUID();
    const newItem: RentalItem = {
      ...data,
      id: nextId,
      code,
      availableQuantity: Math.max(0, data.totalQuantity),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('rental_items').insert({
        id: nextId,
        name: newItem.nameEn,
        tamil_name: newItem.nameTa || newItem.nameEn,
        price: newItem.rentalPrice,
        unit: newItem.pricingUnit || 'Per Day',
      });

      if (error) {
        console.error('Failed to insert rental item in Supabase:', error);
        throw new Error(error.message);
      }

      const metaMap = getLocalMetaMap();
      metaMap[nextId] = extractRentalMeta(newItem);
      saveLocalMetaMap(metaMap);
      await persistRemoteSetting(SITE_KEY_RENTAL_META, metaMap);
    } else {
      const metaMap = getLocalMetaMap();
      metaMap[nextId] = extractRentalMeta(newItem);
      saveLocalMetaMap(metaMap);
    }

    items.push(newItem);
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    return newItem;
  },

  async updateItem(
    id: string,
    changes: Partial<Omit<RentalItem, 'id' | 'createdAt'>>
  ): Promise<RentalItem | undefined> {
    const items = this.getRawItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;

    if (changes.code) {
      const code = changes.code.trim();
      const duplicate = items.find((i) => i.id !== id && i.code.toLowerCase() === code.toLowerCase());
      if (duplicate) {
        throw new Error(`Item code "${code}" is already in use by another item.`);
      }
      changes.code = code;
    }

    const updated: RentalItem = {
      ...items[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(id)) {
      const { error } = await supabase.from('rental_items').upsert(
        {
          id,
          name: updated.nameEn,
          tamil_name: updated.nameTa || updated.nameEn,
          price: updated.rentalPrice,
          unit: updated.pricingUnit || 'Per Day',
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.error('Failed to update rental item in Supabase:', error.message);
        throw new Error(error.message);
      }
    }

    const metaMap = getLocalMetaMap();
    metaMap[id] = extractRentalMeta(updated);
    saveLocalMetaMap(metaMap);
    if (isSupabaseConfigured) {
      await persistRemoteSetting(SITE_KEY_RENTAL_META, metaMap);
    }

    items[idx] = updated;
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    return items[idx];
  },

  async deleteItem(id: string): Promise<{ softDeleted: boolean }> {
    const documents = this.getAllDocuments();
    const isReferenced = documents.some((doc) => doc.items.some((i) => i.itemId === id));

    if (isReferenced) {
      await this.updateItem(id, { isActive: false });
      return { softDeleted: true };
    }

    if (isSupabaseConfigured && isUuid(id)) {
      const { error } = await supabase.from('rental_items').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete rental item in Supabase:', error.message);
        throw new Error(error.message);
      }
    }

    const items = this.getRawItems().filter((i) => i.id !== id);
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    const metaMap = getLocalMetaMap();
    if (metaMap[id]) {
      delete metaMap[id];
      saveLocalMetaMap(metaMap);
      if (isSupabaseConfigured) {
        await persistRemoteSetting(SITE_KEY_RENTAL_META, metaMap);
      }
    }

    return { softDeleted: false };
  },

  // ─── DOCUMENTS & TRANSACTIONS ──────────────────────────────────────────
  getAllDocuments(): RentalDocument[] {
    try {
      return JSON.parse(localStorage.getItem(RENTAL_DOCS_KEY) || '[]') as RentalDocument[];
    } catch {
      return [];
    }
  },

  getDocumentById(id: string): RentalDocument | undefined {
    return this.getAllDocuments().find((d) => d.id === id || d.rentalNumber === id);
  },

  computeTotals(doc: {
    items: RentalDocItem[];
    additionalCharges?: number;
    discount?: number;
    securityDeposit?: number;
    advancePaid?: number;
  }) {
    const subtotal = doc.items.reduce((s, itm) => s + (itm.quantity * itm.pricePerUnit), 0);
    const additional = doc.additionalCharges || 0;
    const disc = doc.discount || 0;
    const deposit = doc.securityDeposit || 0;
    const grandTotal = Math.max(0, subtotal + additional - disc + deposit);
    const advance = doc.advancePaid || 0;
    const balanceDue = Math.max(0, grandTotal - advance);

    return {
      subtotal,
      additionalCharges: additional,
      discount: disc,
      securityDeposit: deposit,
      grandTotal,
      advancePaid: advance,
      balanceDue,
    };
  },

  async addDocument(
    data: Omit<RentalDocument, 'id' | 'rentalNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'grandTotal' | 'balanceDue'>
  ): Promise<RentalDocument> {
    const documents = this.getAllDocuments();
    const rentalNumber = generateRentalNumber();
    const totals = this.computeTotals(data);
    const docId = generateUUID();

    const preparedItems = data.items.map((i) => ({
      ...i,
      lineTotal: i.quantity * i.pricePerUnit,
      returnedQuantity: i.returnedQuantity || 0,
    }));

    const newDoc: RentalDocument = {
      ...data,
      id: docId,
      rentalNumber,
      items: preparedItems,
      ...totals,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const meta = {
        rentalNumber,
        functionName: newDoc.functionName || null,
        functionDate: newDoc.functionDate,
        rentalStartDate: newDoc.rentalStartDate,
        expectedReturnDate: newDoc.expectedReturnDate,
        actualReturnDate: newDoc.actualReturnDate || null,
        address: newDoc.address || null,
        deliveryDetails: newDoc.deliveryDetails || null,
        subtotal: newDoc.subtotal,
        additionalCharges: newDoc.additionalCharges,
        discount: newDoc.discount,
        securityDeposit: newDoc.securityDeposit,
        grandTotal: newDoc.grandTotal,
        advancePaid: newDoc.advancePaid,
        balanceDue: newDoc.balanceDue,
        status: newDoc.status,
        notes: newDoc.notes || null,
        terms: newDoc.terms || null,
        preferredLanguage: newDoc.preferredLanguage || 'en',
        items: preparedItems,
      };

      const { error: docErr } = await supabase.from('rental_documents').insert({
        id: docId,
        customer_name: newDoc.customerName,
        phone: newDoc.mobile,
        document_date: newDoc.documentDate,
        notes: JSON.stringify(meta),
      });

      if (docErr) {
        console.error('Failed to insert rental document in Supabase:', docErr);
        throw new Error(docErr.message);
      }

      if (preparedItems.length > 0) {
        const itemRows = preparedItems.map((itm) => ({
          id: generateUUID(),
          document_id: docId,
          item_id: itm.itemId && isUuid(itm.itemId) ? itm.itemId : null,
          item_name: itm.nameEn,
          quantity: itm.quantity,
          price: itm.pricePerUnit,
          subtotal: itm.lineTotal,
        }));

        const { error: rdiErr } = await supabase.from('rental_document_items').insert(itemRows);
        if (rdiErr) {
          console.error('Failed to insert rental document items in Supabase:', rdiErr);
          throw new Error(rdiErr.message);
        }
      }
    }

    documents.unshift(newDoc);
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    return newDoc;
  },

  async updateDocument(
    id: string,
    changes: Partial<Omit<RentalDocument, 'id' | 'rentalNumber' | 'createdAt'>>
  ): Promise<RentalDocument | undefined> {
    const documents = this.getAllDocuments();
    const idx = documents.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;

    const current = documents[idx];
    const items = changes.items || current.items;
    const totals = this.computeTotals({
      items,
      additionalCharges: changes.additionalCharges ?? current.additionalCharges,
      discount: changes.discount ?? current.discount,
      securityDeposit: changes.securityDeposit ?? current.securityDeposit,
      advancePaid: changes.advancePaid ?? current.advancePaid,
    });

    const updated: RentalDocument = {
      ...current,
      ...changes,
      ...totals,
      items: items.map((i) => ({
        ...i,
        lineTotal: i.quantity * i.pricePerUnit,
      })),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(id)) {
      const meta = {
        rentalNumber: updated.rentalNumber,
        functionName: updated.functionName || null,
        functionDate: updated.functionDate,
        rentalStartDate: updated.rentalStartDate,
        expectedReturnDate: updated.expectedReturnDate,
        actualReturnDate: updated.actualReturnDate || null,
        address: updated.address || null,
        deliveryDetails: updated.deliveryDetails || null,
        subtotal: updated.subtotal,
        additionalCharges: updated.additionalCharges,
        discount: updated.discount,
        securityDeposit: updated.securityDeposit,
        grandTotal: updated.grandTotal,
        advancePaid: updated.advancePaid,
        balanceDue: updated.balanceDue,
        status: updated.status,
        notes: updated.notes || null,
        terms: updated.terms || null,
        preferredLanguage: updated.preferredLanguage || 'en',
        items: updated.items,
      };

      const { error: docErr } = await supabase.from('rental_documents').update({
        customer_name: updated.customerName,
        phone: updated.mobile,
        document_date: updated.documentDate,
        notes: JSON.stringify(meta),
      }).eq('id', id);

      if (docErr) {
        console.error('Failed to update rental document in Supabase:', docErr.message);
        throw new Error(docErr.message);
      }

      if (changes.items) {
        await supabase.from('rental_document_items').delete().eq('document_id', id);
        if (updated.items.length > 0) {
          const itemRows = updated.items.map((itm) => ({
            id: generateUUID(),
            document_id: id,
            item_id: itm.itemId && isUuid(itm.itemId) ? itm.itemId : null,
            item_name: itm.nameEn,
            quantity: itm.quantity,
            price: itm.pricePerUnit,
            subtotal: itm.lineTotal,
          }));
          const { error: rdiErr } = await supabase.from('rental_document_items').insert(itemRows);
          if (rdiErr) {
            console.error('Failed to update rental document items in Supabase:', rdiErr.message);
            throw new Error(rdiErr.message);
          }
        }
      }
    }

    documents[idx] = updated;
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    return updated;
  },

  async updateStatus(
    id: string,
    status: RentalStatus,
    actualReturnDate?: string,
    notes?: string
  ): Promise<RentalDocument | undefined> {
    const doc = this.getDocumentById(id);
    if (!doc) return undefined;

    const updates: Partial<RentalDocument> = { status };
    if (actualReturnDate) updates.actualReturnDate = actualReturnDate;
    if (notes !== undefined) {
      updates.notes = doc.notes ? `${doc.notes}\n${notes}` : notes;
    }

    if (status === 'Returned') {
      updates.items = doc.items.map((i) => ({
        ...i,
        returnedQuantity: i.quantity,
      }));
      if (!updates.actualReturnDate) {
        updates.actualReturnDate = new Date().toISOString().split('T')[0];
      }
    }

    return await this.updateDocument(id, updates);
  },

  async deleteDocument(id: string): Promise<boolean> {
    const documents = this.getAllDocuments();
    const filtered = documents.filter((d) => d.id !== id);
    if (filtered.length !== documents.length) {
      if (isSupabaseConfigured && isUuid(id)) {
        await supabase.from('rental_document_items').delete().eq('document_id', id);
        const { error } = await supabase.from('rental_documents').delete().eq('id', id);
        if (error) {
          console.error('Failed to delete rental document in Supabase:', error.message);
          throw new Error(error.message);
        }
      }
      localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  },

  generateRentalNumber(): string {
    return generateRentalNumber();
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    rentalService.syncFromSupabase().catch(() => {});
  }, 1600);
}
