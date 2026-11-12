/**
 * inventoryService — Grocery & Vegetable Inventory Management System
 * Connected to Supabase (inventory_items, purchase_documents, purchase_items, site_settings)
 * with robust local cache fallback and exact decimal quantity preservation.
 */
import type {
  InventoryCategory,
  InventoryItem,
  InventoryDocument,
  InventoryDocumentItem,
} from '../types/inventory';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const INVENTORY_ITEMS_KEY = 'kanchi_inventory_items';
const INVENTORY_CATEGORIES_KEY = 'kanchi_inventory_categories';
const INVENTORY_DOCS_KEY = 'kanchi_inventory_documents';
const INVENTORY_COUNTER_KEY = 'kanchi_inventory_counter';
const INVENTORY_META_KEY = 'kanchi_inventory_metadata';
const INVENTORY_CATALOG_VERSION_KEY = 'kanchi_inv_catalog_v2';

const SITE_KEY_INVENTORY_META = 'kanchi_inventory_metadata';
const SITE_KEY_INVENTORY_CATS = 'kanchi_inventory_categories';

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

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategory[] = [
  { id: 'cat-grocery', nameEn: 'Grocery Items', nameTa: 'மளிகைப் பொருட்கள்' },
  { id: 'cat-vegetables', nameEn: 'Vegetables', nameTa: 'காய்கறிகள்' },
  { id: 'cat-fruits', nameEn: 'Fruits', nameTa: 'பழங்கள்' },
  { id: 'cat-spices', nameEn: 'Spices & Masala', nameTa: 'மசாலாப் பொருட்கள்' },
  { id: 'cat-oils', nameEn: 'Oils & Other Ingredients', nameTa: 'எண்ணெய் மற்றும் பிற பொருட்கள்' },
  { id: 'cat-pooja', nameEn: 'Pooja Items', nameTa: 'பூசை சாமான்கள்' },
  { id: 'cat-disposables', nameEn: 'Leaves, Cups & Disposables', nameTa: 'இலைகள் & டிஸ்போசபிள் பொருட்கள்' },
  { id: 'cat-hall-supplies', nameEn: 'Hall, Cleaning & Packing Supplies', nameTa: 'மண்டபம் & பிற சாமான்கள்' },
  { id: 'cat-other', nameEn: 'Other Items', nameTa: 'பிற பொருட்கள்' },
];

export interface UnitDefinition {
  id: string;
  labelEn: string;
  labelTa: string;
  shortEn: string;
  shortTa: string;
}

export const SUPPORTED_UNITS: UnitDefinition[] = [
  { id: 'kg', labelEn: 'Kilogram (kg)', labelTa: 'கிலோகிராம் (கிலோ)', shortEn: 'kg', shortTa: 'கிலோ' },
  { id: 'g', labelEn: 'Gram (g)', labelTa: 'கிராம் (கி)', shortEn: 'g', shortTa: 'கி' },
  { id: 'L', labelEn: 'Litre (L)', labelTa: 'லிட்டர் (லி)', shortEn: 'L', shortTa: 'லி' },
  { id: 'ml', labelEn: 'Millilitre (ml)', labelTa: 'மில்லிலிட்டர் (மி.லி)', shortEn: 'ml', shortTa: 'மி.லி' },
  { id: 'pcs', labelEn: 'Pieces (pcs)', labelTa: 'எண்ணிக்கை (பீஸ்)', shortEn: 'pcs', shortTa: 'பீஸ்' },
  { id: 'packets', labelEn: 'Packets', labelTa: 'பாக்கெட்', shortEn: 'pkts', shortTa: 'பாக்கெட்' },
  { id: 'bags', labelEn: 'Bags', labelTa: 'மூட்டை / பை', shortEn: 'bags', shortTa: 'மூட்டை' },
  { id: 'boxes', labelEn: 'Boxes', labelTa: 'பெட்டி', shortEn: 'boxes', shortTa: 'பெட்டி' },
  { id: 'bundles', labelEn: 'Bundles', labelTa: 'கட்டு', shortEn: 'bundles', shortTa: 'கட்டு' },
  { id: 'dozens', labelEn: 'Dozens', labelTa: 'டஜன்', shortEn: 'doz', shortTa: 'டஜன்' },
  { id: 'bottles', labelEn: 'Bottles', labelTa: 'பாட்டில்', shortEn: 'bottles', shortTa: 'பாட்டில்' },
  { id: 'rolls', labelEn: 'Rolls', labelTa: 'ரோல்', shortEn: 'rolls', shortTa: 'ரோல்' },
];

export function formatUnitLabel(unit: string, lang: 'en' | 'ta' = 'en'): string {
  const found = SUPPORTED_UNITS.find(
    (u) => u.id === unit || u.shortEn.toLowerCase() === unit.toLowerCase()
  );
  if (found) {
    return lang === 'ta' ? found.shortTa : found.shortEn;
  }
  return unit;
}

export type SeededInventoryItem = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export const INITIAL_INVENTORY_ITEMS: SeededInventoryItem[] = [
  // Existing Grocery Items (0001 - 0027)
  { id: '10000000-0000-4000-8000-000000000001', nameEn: 'Rice', nameTa: 'அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000002', nameEn: 'Idli Rice', nameTa: 'இட்லி அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000003', nameEn: 'Raw Rice', nameTa: 'பச்சரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000004', nameEn: 'Basmati Rice', nameTa: 'பாஸ்மதி அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000005', nameEn: 'Wheat Flour', nameTa: 'கோதுமை மாவு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000006', nameEn: 'Maida', nameTa: 'மைதா', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000007', nameEn: 'Rava / Sooji', nameTa: 'ரவை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000008', nameEn: 'Vermicelli', nameTa: 'சேமியா', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000009', nameEn: 'Toor Dal', nameTa: 'துவரம் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000010', nameEn: 'Urad Dal', nameTa: 'உளுத்தம் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000011', nameEn: 'Moong Dal', nameTa: 'பாசிப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000012', nameEn: 'Chana Dal', nameTa: 'கடலைப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000013', nameEn: 'Chickpeas', nameTa: 'கொண்டைக்கடலை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000014', nameEn: 'Green Gram', nameTa: 'பச்சைப்பயறு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000015', nameEn: 'Tamarind', nameTa: 'புளி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000016', nameEn: 'Jaggery', nameTa: 'வெல்லம்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000017', nameEn: 'Sugar', nameTa: 'சர்க்கரை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000018', nameEn: 'Salt', nameTa: 'உப்பு', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000019', nameEn: 'Cashew Nuts', nameTa: 'முந்திரிப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000020', nameEn: 'Raisins', nameTa: 'உலர் திராட்சை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000021', nameEn: 'Coconut', nameTa: 'தேங்காய்', categoryId: 'cat-grocery', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000022', nameEn: 'Desiccated Coconut', nameTa: 'கொப்பரைத் தேங்காய்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000023', nameEn: 'Papad / Appalam', nameTa: 'அப்பளம்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000024', nameEn: 'Pickle', nameTa: 'ஊறுகாய்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000025', nameEn: 'Tea Powder', nameTa: 'தேயிலைத் தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000026', nameEn: 'Coffee Powder', nameTa: 'காபித் தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000027', nameEn: 'Milk Powder', nameTa: 'பால் பவுடர்', categoryId: 'cat-grocery', unit: 'packets' },

  // Existing Spices & Masala (0028 - 0043)
  { id: '10000000-0000-4000-8000-000000000028', nameEn: 'Mustard Seeds', nameTa: 'கடுகு', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000029', nameEn: 'Cumin Seeds', nameTa: 'சீரகம்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000030', nameEn: 'Black Pepper', nameTa: 'மிளகு', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000031', nameEn: 'Fenugreek Seeds', nameTa: 'வெந்தயம்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000032', nameEn: 'Turmeric Powder', nameTa: 'மஞ்சள் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000033', nameEn: 'Chilli Powder', nameTa: 'மிளகாய் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000034', nameEn: 'Coriander Powder', nameTa: 'மல்லித் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000035', nameEn: 'Garam Masala', nameTa: 'கரம் மசாலா', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000036', nameEn: 'Asafoetida', nameTa: 'பெருங்காயம்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000037', nameEn: 'Cardamom', nameTa: 'ஏலக்காய்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000038', nameEn: 'Cloves', nameTa: 'கிராம்பு', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000039', nameEn: 'Cinnamon', nameTa: 'பட்டை', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000040', nameEn: 'Biryani Leaves', nameTa: 'பிரியாணி இலை', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000041', nameEn: 'Fennel Seeds', nameTa: 'சோம்பு', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000042', nameEn: 'Sambar Powder', nameTa: 'சாம்பார் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000043', nameEn: 'Rasam Powder', nameTa: 'ரசம் தூள்', categoryId: 'cat-spices', unit: 'packets' },

  // Existing Oils & Ingredients (0044 - 0051)
  { id: '10000000-0000-4000-8000-000000000044', nameEn: 'Sunflower Oil', nameTa: 'சூரியகாந்தி எண்ணெய்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000045', nameEn: 'Gingelly Oil / Sesame Oil', nameTa: 'நல்லெண்ணெய்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000046', nameEn: 'Pure Ghee', nameTa: 'நெய்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000047', nameEn: 'Vanaspati', nameTa: 'வனஸ்பதி', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000048', nameEn: 'Butter', nameTa: 'வெண்ணெய்', categoryId: 'cat-oils', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000049', nameEn: 'Paneer', nameTa: 'பன்னீர்', categoryId: 'cat-oils', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000050', nameEn: 'Curd', nameTa: 'தயிர்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000051', nameEn: 'Fresh Milk', nameTa: 'பால்', categoryId: 'cat-oils', unit: 'L' },

  // Existing Vegetables (0052 - 0084)
  { id: '10000000-0000-4000-8000-000000000052', nameEn: 'Onion (Big)', nameTa: 'பெரிய வெங்காயம்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000053', nameEn: 'Small Onion / Shallots', nameTa: 'சின்ன வெங்காயம்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000054', nameEn: 'Tomato', nameTa: 'தக்காளி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000055', nameEn: 'Potato', nameTa: 'உருளைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000056', nameEn: 'Carrot', nameTa: 'கேரட்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000057', nameEn: 'Beans', nameTa: 'பீன்ஸ்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000058', nameEn: 'Cabbage', nameTa: 'முட்டைகோஸ்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000059', nameEn: 'Beetroot', nameTa: 'பீட்ரூட்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000060', nameEn: 'Brinjal / Eggplant', nameTa: 'கத்திரிக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000061', nameEn: 'Ladies Finger / Okra', nameTa: 'வெண்டைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000062', nameEn: 'Drumstick', nameTa: 'முருங்கைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000063', nameEn: 'Cauliflower', nameTa: 'காலிஃபிளவர்', categoryId: 'cat-vegetables', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000064', nameEn: 'Green Chilli', nameTa: 'பச்சை மிளகாய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000065', nameEn: 'Ginger', nameTa: 'இஞ்சி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000066', nameEn: 'Garlic', nameTa: 'பூண்டு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000067', nameEn: 'Coriander Leaves', nameTa: 'கொத்தமல்லி தழை', categoryId: 'cat-vegetables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000068', nameEn: 'Curry Leaves', nameTa: 'கறிவேப்பிலை', categoryId: 'cat-vegetables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000069', nameEn: 'Mint Leaves', nameTa: 'புதினா', categoryId: 'cat-vegetables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000070', nameEn: 'Raw Banana', nameTa: 'வாழைக்காய்', categoryId: 'cat-vegetables', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000071', nameEn: 'Chayote / Chow Chow', nameTa: 'சௌசௌ', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000072', nameEn: 'Ash Gourd / White Pumpkin', nameTa: 'வெண்பூசணி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000073', nameEn: 'Yellow Pumpkin', nameTa: 'மஞ்சள் பூசணி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000074', nameEn: 'Snake Gourd', nameTa: 'புடலங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000075', nameEn: 'Bottle Gourd', nameTa: 'சுரைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000076', nameEn: 'Ridge Gourd', nameTa: 'பீர்க்கங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000077', nameEn: 'Bitter Gourd', nameTa: 'பாகற்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000078', nameEn: 'Colocasia / Seppankizhangu', nameTa: 'சேப்பங்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000079', nameEn: 'Elephant Yam / Senai', nameTa: 'சேனைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000080', nameEn: 'Mushroom', nameTa: 'காளான்', categoryId: 'cat-vegetables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000081', nameEn: 'Baby Corn', nameTa: 'பேபி கார்ன்', categoryId: 'cat-vegetables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000082', nameEn: 'Capsicum', nameTa: 'குடைமிளகாய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000083', nameEn: 'Cucumber', nameTa: 'வெள்ளரிக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000084', nameEn: 'Lemon', nameTa: 'எலுமிச்சை', categoryId: 'cat-vegetables', unit: 'pcs' },

  // Existing Fruits (0085 - 0093)
  { id: '10000000-0000-4000-8000-000000000085', nameEn: 'Banana (Poovan)', nameTa: 'பூவன் வாழைப்பழம்', categoryId: 'cat-fruits', unit: 'dozens' },
  { id: '10000000-0000-4000-8000-000000000086', nameEn: 'Banana (Sevvalai)', nameTa: 'செவ்வாழை', categoryId: 'cat-fruits', unit: 'dozens' },
  { id: '10000000-0000-4000-8000-000000000087', nameEn: 'Apple', nameTa: 'ஆப்பிள்', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000088', nameEn: 'Sweet Orange / Mosambi', nameTa: 'சாத்துக்குடி', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000089', nameEn: 'Pomegranate', nameTa: 'மாதுளை', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000090', nameEn: 'Grapes', nameTa: 'திராட்சை', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000091', nameEn: 'Pineapple', nameTa: 'அன்னாசிப்பழம்', categoryId: 'cat-fruits', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000092', nameEn: 'Watermelon', nameTa: 'தர்பூசணி', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000093', nameEn: 'Mango', nameTa: 'மாம்பழம்', categoryId: 'cat-fruits', unit: 'kg' },

  // Existing Other Items (0094 - 0099)
  { id: '10000000-0000-4000-8000-000000000094', nameEn: 'Banana Leaf (Meals)', nameTa: 'சாப்பாட்டு வாழை இலை', categoryId: 'cat-other', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000095', nameEn: 'Tiffin Leaf', nameTa: 'டிபன் இலை', categoryId: 'cat-other', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000096', nameEn: 'Betel Leaves & Areca Nut', nameTa: 'வெற்றிலை பாக்கு', categoryId: 'cat-other', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000097', nameEn: 'Paper Rolls / Napkins', nameTa: 'டிஷ்யூ பேப்பர் / நேப்கின்', categoryId: 'cat-other', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000098', nameEn: 'Water Cans (20L)', nameTa: 'மினரல் வாட்டர் கேன்', categoryId: 'cat-other', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000099', nameEn: 'Paper Cups', nameTa: 'பேப்பர் கப்', categoryId: 'cat-other', unit: 'packets' },

  // Catering Book Missing Items (0100 - 0232)
  { id: '10000000-0000-4000-8000-000000000100', nameEn: 'Pooja Turmeric Powder', nameTa: 'பூசை மஞ்சள்', categoryId: 'cat-pooja', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000101', nameEn: 'Kumkum Powder', nameTa: 'குங்குமம்', categoryId: 'cat-pooja', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000102', nameEn: 'Camphor (Pooja)', nameTa: 'கற்பூரம்', categoryId: 'cat-pooja', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000103', nameEn: 'Incense Sticks (Agarbathi)', nameTa: 'ஊதுவத்தி', categoryId: 'cat-pooja', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000104', nameEn: 'Matchbox', nameTa: 'தீப்பெட்டி', categoryId: 'cat-pooja', unit: 'boxes' },
  { id: '10000000-0000-4000-8000-000000000105', nameEn: 'Flower String / Garland (Poocharam)', nameTa: 'பூச்சரம்', categoryId: 'cat-pooja', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000106', nameEn: 'Almonds', nameTa: 'பாதாம் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000107', nameEn: 'Pistachios', nameTa: 'பிஸ்தா பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000108', nameEn: 'Chironji / Charoli Nuts', nameTa: 'சாரை பருப்பு', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000109', nameEn: 'Cucumber / Melon Seeds (Vellari Vithai)', nameTa: 'வெள்ளரி விதை', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000110', nameEn: 'Split Cashew Nuts', nameTa: 'பத்தை முந்திரி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000111', nameEn: 'Dried Red Chilli (Whole)', nameTa: 'வர மிளகாய் (மிளகாய்)', categoryId: 'cat-spices', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000112', nameEn: 'Coriander Seeds (Whole)', nameTa: 'தனியா', categoryId: 'cat-spices', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000113', nameEn: 'Asafoetida Solid / Cake (LG)', nameTa: 'பெருங்காயம் கட்டி (எல்.ஜி)', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000114', nameEn: 'Old Tamarind', nameTa: 'புளி பழையது', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000115', nameEn: 'Crystal Salt / Rock Salt', nameTa: 'கல் உப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000116', nameEn: 'Field Beans (Mochai)', nameTa: 'மொச்சை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000117', nameEn: 'Black Chickpeas (Kala Chana)', nameTa: 'கருப்பு மூக்கடலை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000118', nameEn: 'White Chickpeas (Kabuli Chana)', nameTa: 'வெள்ள மூக்கடலை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000119', nameEn: 'Cowpeas / Lobia (Karamani)', nameTa: 'காராமணி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000120', nameEn: 'Manathakkali Vathal (Dried Sunberry)', nameTa: 'மணத்தக்காளி வற்றல்', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000121', nameEn: 'Sundakkai Vathal (Dried Turkey Berry)', nameTa: 'சுண்டைக்காய் வற்றல்', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000122', nameEn: 'Nylon Sago (Javvarisi)', nameTa: 'ஜவ்வரிசி (நைலான்)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000123', nameEn: 'Long Appalam (Neettu Appalam)', nameTa: 'அப்பளம் (நீட்டு)', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000124', nameEn: 'Cooking Soda / Baking Soda', nameTa: 'ஆப்ப சோடா', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000125', nameEn: 'Roasted Gram (Pottukadalai)', nameTa: 'பொட்டுக்கடலை (உடைத்தகடலை)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000126', nameEn: 'Besan / Gram Flour', nameTa: 'கடலை மாவு (வாங்கி அரைக்கவும்)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000127', nameEn: 'Raw Rice Flour', nameTa: 'பச்சரிசி மாவு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000128', nameEn: 'Instant Coffee Powder (Sunrise Strong)', nameTa: 'சன்ரைஸ் காபி தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000129', nameEn: 'Chicory', nameTa: 'சிக்கரி', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000130', nameEn: 'Corn Flour', nameTa: 'கார்ன் பிளவர் மாவு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000131', nameEn: 'Dry Green Peas', nameTa: 'பச்சை பட்டாணி (உலர்)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000132', nameEn: 'Poppy Seeds (Khus Khus)', nameTa: 'கசகசா', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000133', nameEn: 'Mace (Jathipatri)', nameTa: 'ஜாபத்திரி', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000134', nameEn: 'Kapok Buds (Marathi Mokku)', nameTa: 'மராட்டி மொக்கு', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000135', nameEn: 'Edible Camphor (Pacha Karpooram)', nameTa: 'பச்சைக் கற்பூரம்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000136', nameEn: 'Rose Essence', nameTa: 'ரோஸ் எசன்ஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000137', nameEn: 'Pineapple Essence', nameTa: 'பைனாப்பிள் எசன்ஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000138', nameEn: 'Lemon Yellow Food Colour (Bush)', nameTa: 'லெமன் பவுடர் (புஷ்)', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000139', nameEn: 'Orange Red Food Colour (Bush)', nameTa: 'ஆரஞ்சு ரெட் பவுடர் (புஷ்)', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000140', nameEn: 'Apple Green Food Colour (Bush)', nameTa: 'ஆப்பிள் கிரீன் (புஷ்)', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000141', nameEn: 'Lemon Salt / Citric Acid', nameTa: 'லெமன் சால்ட்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000142', nameEn: 'Vinegar', nameTa: 'வினிகர்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000143', nameEn: 'Baking Powder', nameTa: 'பேக்கிங் பவுடர்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000144', nameEn: 'Hydros (Food Whitener)', nameTa: 'ஹைட்ரோஸ்', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000145', nameEn: 'Kesari Food Colour Powder', nameTa: 'கேசரி பவுடர்', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000146', nameEn: 'Butter Paper', nameTa: 'பட்டர் பேப்பர்', categoryId: 'cat-disposables', unit: 'rolls' },
  { id: '10000000-0000-4000-8000-000000000147', nameEn: 'Dried Rice Sevai (Rice Noodles)', nameTa: 'ரைஸ் சேவை', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000148', nameEn: 'Rusk Crumbs / Bread Crumbs', nameTa: 'ரஸ்க் தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000149', nameEn: 'Honey', nameTa: 'தேன்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000150', nameEn: 'Saffron', nameTa: 'குங்குமப்பூ', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000151', nameEn: 'Dry Ginger Powder (Sukku)', nameTa: 'சுக்குத் தூள்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000152', nameEn: 'Curd Chilli (Mor Milagai Vathal)', nameTa: 'மோர் மிளகாய் வற்றல்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000153', nameEn: 'Ajinomoto (MSG)', nameTa: 'அஜினாமோட்டோ', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000154', nameEn: '65 Masala Powder (Sakthi)', nameTa: '65 மசாலா (சக்தி)', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000155', nameEn: 'Chana Masala Powder', nameTa: 'சென்னா மசாலா', categoryId: 'cat-spices', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000156', nameEn: 'Colour Fryums (Colour Vathal)', nameTa: 'கலர் வற்றல்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000157', nameEn: 'Thick Flattened Rice (Getti Aval)', nameTa: 'கெட்டி அவல்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000158', nameEn: 'Peanuts / Groundnuts', nameTa: 'வேர்க்கடலை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000159', nameEn: 'Idli Rava (Broken Boiled Rice)', nameTa: 'இட்லி ரவை (புழுங்கல் அரிசி உடைத்தது)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000160', nameEn: 'Short-Grain Rice (Gundu Arisi)', nameTa: 'குண்டு அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000161', nameEn: 'SVS Refined Groundnut Oil', nameTa: 'எஸ்.வி.எஸ். ஆயில்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000162', nameEn: 'Coconut Oil (KPL)', nameTa: 'தேங்காய் எண்ணெய் (கே.பி.எல்)', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000163', nameEn: 'Salt Bread', nameTa: 'சால்ட் பிரட்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000164', nameEn: 'Salt Biscuits', nameTa: 'சால்ட் பிஸ்கட்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000165', nameEn: 'Tomato Soup Powder', nameTa: 'தக்காளி சூப் பவுடர்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000166', nameEn: 'Dried Figs (Anjeer)', nameTa: 'அத்திப்பழம் (உலர்)', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000167', nameEn: 'Walnuts', nameTa: 'அக்ரூட் பழம்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000168', nameEn: 'Gulkand (Rose Petal Preserve)', nameTa: 'குல்குந்து', categoryId: 'cat-grocery', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000169', nameEn: 'Tomato Sauce', nameTa: 'தக்காளி சாஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000170', nameEn: 'Chilli Sauce', nameTa: 'சில்லி சாஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000171', nameEn: 'Soy Sauce', nameTa: 'சோயா சாஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000172', nameEn: 'White Pepper Powder', nameTa: 'வெள்ளை மிளகுத் தூள்', categoryId: 'cat-spices', unit: 'g' },
  { id: '10000000-0000-4000-8000-000000000173', nameEn: 'Noodles', nameTa: 'நூடுல்ஸ்', categoryId: 'cat-grocery', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000174', nameEn: 'White Grated / Flaked Coconut', nameTa: 'தேங்காய்ப்பூ வெள்ளை', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000175', nameEn: 'Grape Juice Pulp', nameTa: 'கிரேப் ஜூஸ் பல்ப்', categoryId: 'cat-oils', unit: 'L' },
  { id: '10000000-0000-4000-8000-000000000176', nameEn: 'Grape Essence', nameTa: 'கிரேப் எசன்ஸ்', categoryId: 'cat-oils', unit: 'bottles' },
  { id: '10000000-0000-4000-8000-000000000177', nameEn: 'Condensed Milk (Milkmaid)', nameTa: 'மில்க் மெய்ட்', categoryId: 'cat-oils', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000178', nameEn: 'Soya Chunks (Meal Maker)', nameTa: 'மீல் மேக்கர்', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000179', nameEn: 'Rock Candy Sugar (Kalkandu)', nameTa: 'கற்கண்டு', categoryId: 'cat-grocery', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000180', nameEn: 'Disposable Water Tumbler', nameTa: 'தண்ணீர் டம்ளர் (டிஸ்போசபிள்)', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000181', nameEn: 'Disposable Payasam Cup', nameTa: 'பாயச கப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000182', nameEn: 'Disposable Coffee Cup', nameTa: 'காபி கப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000183', nameEn: 'Table Paper Roll', nameTa: 'டேபிள் பேப்பர் ரோல்', categoryId: 'cat-disposables', unit: 'rolls' },
  { id: '10000000-0000-4000-8000-000000000184', nameEn: 'Disposable Plastic Bowl', nameTa: 'பிளாஸ்டிக் பௌல்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000185', nameEn: 'Disposable Juice Cup', nameTa: 'ஜூஸ் கப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000186', nameEn: '5-Idli Parcel Container / Cup', nameTa: '5 இட்லி கப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000187', nameEn: 'Paper Plate (Large)', nameTa: 'பேப்பர் பிளேட் பெரியது', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000188', nameEn: 'Paper Plate (Small)', nameTa: 'பேப்பர் பிளேட் சிறியது', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000189', nameEn: 'Fruit Salad Cup (Disposable)', nameTa: 'புரூட் சாலட் கப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000190', nameEn: 'Cake Cup No. 7', nameTa: 'கேக் கப் 7ஆம் நெம்பர்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000191', nameEn: 'Disposable Hand Gloves', nameTa: 'ஹாண்ட் கிளவுஸ்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000192', nameEn: 'Disposable Head Cap', nameTa: 'ஹெட் கேப்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000193', nameEn: 'Disposable Fork Spoon', nameTa: 'முள் கரண்டி (போர்க் ஸ்பூன்)', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000194', nameEn: 'Disposable Teaspoon', nameTa: 'டீஸ்பூன்', categoryId: 'cat-disposables', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000195', nameEn: 'Sabena Scouring Powder', nameTa: 'சபீனா தூள்', categoryId: 'cat-hall-supplies', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000196', nameEn: 'Mandara Leaf (Packing Leaf)', nameTa: 'மந்தார இலை', categoryId: 'cat-disposables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000197', nameEn: 'Stitched Leaf Plate Bundle', nameTa: 'தையல் இலை கட்டு', categoryId: 'cat-disposables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000198', nameEn: 'Old Newspaper (Packing)', nameTa: 'நியூஸ் பேப்பர்', categoryId: 'cat-hall-supplies', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000199', nameEn: 'Talcum Powder (Ponds)', nameTa: 'பான்ஸ் பவுடர்', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000200', nameEn: 'Sacred Ash (Vibhuti)', nameTa: 'திருநீறு', categoryId: 'cat-pooja', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000201', nameEn: 'Sandalwood Paste / Powder (Chandanam)', nameTa: 'சந்தனம்', categoryId: 'cat-pooja', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000202', nameEn: 'Tooth Powder', nameTa: 'பல்பொடி', categoryId: 'cat-hall-supplies', unit: 'packets' },
  { id: '10000000-0000-4000-8000-000000000203', nameEn: 'Bath Soap (Rexona)', nameTa: 'ரெக்சோனா சோப்', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000204', nameEn: 'Khoya / Khoa (Mawa)', nameTa: 'கோவா', categoryId: 'cat-oils', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000205', nameEn: 'Spiny Brinjal (Mullu Kathirikkai)', nameTa: 'முள்ளு கத்தரிக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000206', nameEn: 'Broad Beans (Avaraikkai)', nameTa: 'அவரைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000207', nameEn: 'Cluster Beans (Kothavarangai)', nameTa: 'கொத்தவரங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000208', nameEn: 'Chips Potato', nameTa: 'சிப்ஸ் உருளைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000209', nameEn: 'Baby / Balls Potato', nameTa: 'பால்ஸ் உருளைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000210', nameEn: 'Knol Khol / Kohlrabi (Nookal)', nameTa: 'நூக்கல்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000211', nameEn: 'Taro / Karunai Kizhangu', nameTa: 'கருணைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000212', nameEn: 'Double Beans', nameTa: 'டபுள் பீன்ஸ்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000213', nameEn: 'Fresh Green Peas', nameTa: 'பச்சைப் பட்டாணி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000214', nameEn: 'Bajji Chilli', nameTa: 'பஜ்ஜி மிளகாய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000215', nameEn: 'Spring Onion', nameTa: 'வெங்காயத்தாள்', categoryId: 'cat-vegetables', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000216', nameEn: 'Raw Mango', nameTa: 'மாங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000217', nameEn: 'Mango Ginger (Manga Inji)', nameTa: 'மாங்காய் இஞ்சி', categoryId: 'cat-vegetables', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000218', nameEn: 'Hill Banana (Malai Vazhai)', nameTa: 'மலைவாழை', categoryId: 'cat-fruits', unit: 'dozens' },
  { id: '10000000-0000-4000-8000-000000000219', nameEn: 'Orange', nameTa: 'ஆரஞ்சு', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000220', nameEn: 'Paneer Grapes (Black Grapes)', nameTa: 'பன்னீர் திராட்சை', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000221', nameEn: 'Seedless Grapes', nameTa: 'சீட்லெஸ் திராட்சை', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000222', nameEn: 'Seedless Dates', nameTa: 'சீட்லெஸ் பேரீச்சை', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000223', nameEn: 'Papaya', nameTa: 'பப்பாளி பழம்', categoryId: 'cat-fruits', unit: 'kg' },
  { id: '10000000-0000-4000-8000-000000000224', nameEn: 'Jackfruit', nameTa: 'பலாப்பழம்', categoryId: 'cat-fruits', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000225', nameEn: 'Ice Bar (Block Ice)', nameTa: 'ஐஸ் பார்', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000226', nameEn: 'Jute Gunny Cloth', nameTa: 'கோணிக் கித்தான்', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000227', nameEn: 'Coir / Palm Fiber Rope', nameTa: 'பாளைகயிறு', categoryId: 'cat-hall-supplies', unit: 'bundles' },
  { id: '10000000-0000-4000-8000-000000000228', nameEn: 'Meenakshi Kada Straining Cloth', nameTa: 'மீனாட்சி காடா துணி', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000229', nameEn: 'Muslin Straining Cloth', nameTa: 'மல் துணி', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000230', nameEn: 'Kitchen Hand Towel', nameTa: 'டவல் (துண்டு)', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000231', nameEn: 'Supplier Serving Cloth', nameTa: 'சப்ளையர் துண்டு', categoryId: 'cat-hall-supplies', unit: 'pcs' },
  { id: '10000000-0000-4000-8000-000000000232', nameEn: 'Coconut Leaf Broom', nameTa: 'புதிய தென்னந்துடைப்பம்', categoryId: 'cat-hall-supplies', unit: 'pcs' },
];

type InventoryItemMeta = {
  currentStock?: number;
  stockQuantity?: number;
  purchaseQuantity?: number;
  unitPrice?: number;
  supplierName?: string;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
  isActive?: boolean;
};

function extractInventoryMeta(item: Partial<InventoryItem>): InventoryItemMeta {
  const stock = item.currentStock !== undefined ? item.currentStock : item.stockQuantity;
  const meta: InventoryItemMeta = {};
  if (stock !== undefined) {
    meta.currentStock = stock;
    meta.stockQuantity = stock;
  }
  if (item.purchaseQuantity !== undefined) meta.purchaseQuantity = item.purchaseQuantity;
  if (item.unitPrice !== undefined) meta.unitPrice = item.unitPrice;
  if (item.supplierName) meta.supplierName = item.supplierName;
  if (item.purchaseDate) meta.purchaseDate = item.purchaseDate;
  if (item.expiryDate) meta.expiryDate = item.expiryDate;
  if (item.notes) meta.notes = item.notes;
  if (item.isActive !== undefined && item.isActive !== true) meta.isActive = item.isActive;
  return meta;
}

function getLocalMetaMap(): Record<string, InventoryItemMeta> {
  try {
    return JSON.parse(localStorage.getItem(INVENTORY_META_KEY) || '{}') as Record<
      string,
      InventoryItemMeta
    >;
  } catch {
    return {};
  }
}

function saveLocalMetaMap(metaMap: Record<string, InventoryItemMeta>): void {
  localStorage.setItem(INVENTORY_META_KEY, JSON.stringify(metaMap));
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

function mergeInventoryCategories(
  storedCats: InventoryCategory[],
  remoteCats: InventoryCategory[] = []
): InventoryCategory[] {
  const map = new Map<string, InventoryCategory>();
  DEFAULT_INVENTORY_CATEGORIES.forEach((c) => map.set(c.id, c));
  storedCats.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  remoteCats.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  return Array.from(map.values());
}

export const inventoryService = {
  /**
   * Synchronizes items, categories, metadata, and purchase documents from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const [{ data: itemData, error: itemErr }, { data: settingsRows }] = await Promise.all([
        supabase.from('inventory_items').select('*'),
        supabase
          .from('site_settings')
          .select('*')
          .in('setting_key', [SITE_KEY_INVENTORY_META, SITE_KEY_INVENTORY_CATS]),
      ]);

      let remoteMetaMap: Record<string, InventoryItemMeta> = {};
      let remoteCats: InventoryCategory[] = [];
      if (Array.isArray(settingsRows)) {
        for (const row of settingsRows as Array<Record<string, any>>) {
          const sKey = row.setting_key ?? row.key;
          const sVal = row.setting_value !== undefined ? row.setting_value : row.value;
          if (sKey === SITE_KEY_INVENTORY_META && sVal && typeof sVal === 'object') {
            remoteMetaMap = sVal as Record<string, InventoryItemMeta>;
          } else if (sKey === SITE_KEY_INVENTORY_CATS && Array.isArray(sVal)) {
            remoteCats = sVal as InventoryCategory[];
          }
        }
      }

      const localCatsRaw = (() => {
        try {
          return JSON.parse(localStorage.getItem(INVENTORY_CATEGORIES_KEY) || '[]') as InventoryCategory[];
        } catch {
          return [];
        }
      })();
      const mergedCategories = mergeInventoryCategories(localCatsRaw, remoteCats);
      localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(mergedCategories));

      const localMetaMap = getLocalMetaMap();
      const mergedMetaMap: Record<string, InventoryItemMeta> = {
        ...localMetaMap,
        ...remoteMetaMap,
      };
      saveLocalMetaMap(mergedMetaMap);

      // 1. Items (Supabase is authoritative when populated)
      if (!itemErr && Array.isArray(itemData) && itemData.length > 0) {
        const local = this.getItems();
        const localMap = new Map(local.map((i) => [i.id, i]));

        const syncedItems: InventoryItem[] = itemData.map((it: Record<string, any>) => {
          const localExisting = localMap.get(it.id);
          const storedMeta = mergedMetaMap[it.id] || {};
          const fallbackLocalMeta = localExisting ? extractInventoryMeta(localExisting) : {};
          const meta: InventoryItemMeta = { ...fallbackLocalMeta, ...storedMeta };

          const resolvedStock =
            meta.currentStock ??
            meta.stockQuantity ??
            (it.stock_quantity != null ? Number(it.stock_quantity) : undefined);

          return {
            id: it.id,
            nameEn: it.name || it.name_en || '',
            nameTa: it.tamil_name || it.name_ta || '',
            categoryId: it.category || it.category_id || 'cat-grocery',
            unit: it.unit || 'kg',
            currentStock: resolvedStock,
            stockQuantity: resolvedStock,
            purchaseQuantity: meta.purchaseQuantity,
            unitPrice:
              meta.unitPrice ?? (it.unit_price != null ? Number(it.unit_price) : undefined),
            supplierName: meta.supplierName,
            purchaseDate: meta.purchaseDate,
            expiryDate: meta.expiryDate,
            notes: meta.notes,
            isActive: meta.isActive ?? (it.is_active ?? true),
            createdAt: it.created_at || localExisting?.createdAt || new Date().toISOString(),
            updatedAt:
              it.updated_at || it.created_at || localExisting?.updatedAt || new Date().toISOString(),
          };
        });

        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(syncedItems));
        localStorage.setItem(INVENTORY_CATALOG_VERSION_KEY, '1');
      }

      // 2. Purchase Documents & Items
      const { data: docData, error: docErr } = await supabase
        .from('purchase_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!docErr && Array.isArray(docData)) {
        if (docData.length === 0) {
          localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify([]));
        } else {
          const docIds = docData.map((d) => d.id);
          const { data: itemRows } = await supabase
            .from('purchase_items')
            .select('*')
            .in('document_id', docIds);

          const itemsByDocId: Record<string, InventoryDocumentItem[]> = {};
          if (Array.isArray(itemRows)) {
            itemRows.forEach((r) => {
              if (!itemsByDocId[r.document_id]) itemsByDocId[r.document_id] = [];
              itemsByDocId[r.document_id].push({
                id: r.id,
                catalogueItemId: r.item_id || undefined,
                nameEn: r.item_name || r.name_en || '',
                nameTa: r.notes || r.name_ta || '',
                quantity: r.quantity != null ? Number(r.quantity) : 0,
                unit: r.unit || 'kg',
                unitPrice: r.price != null ? Number(r.price) : undefined,
                totalPrice:
                  r.price != null && r.quantity != null
                    ? Math.round(Number(r.price) * Number(r.quantity) * 100) / 100
                    : undefined,
              });
            });
          }

          const mappedDocs: InventoryDocument[] = docData.map((d) => {
            let meta: Record<string, any> = {};
            if (d.notes && d.notes.startsWith('{')) {
              try {
                meta = JSON.parse(d.notes);
              } catch {
                meta = {};
              }
            }

            const docItems =
              itemsByDocId[d.id] || meta.items || (Array.isArray(d.items) ? d.items : []);
            return {
              id: d.id,
              docNumber: meta.docNumber || d.doc_number || `DOC-${d.id.substring(0, 8)}`,
              title: meta.title || d.title || 'Grocery Purchase Document',
              eventName: meta.eventName || d.event_name || 'Catering Event',
              customerName: meta.customerName || d.customer_name || undefined,
              eventDate: meta.eventDate || d.event_date || undefined,
              documentDate: d.document_date || new Date().toISOString().split('T')[0],
              preparedBy: meta.preparedBy || d.prepared_by || undefined,
              notes: meta.notes || (meta.docNumber ? undefined : d.notes) || undefined,
              language: meta.language || d.language || 'both',
              totalAmount:
                meta.totalAmount != null
                  ? Number(meta.totalAmount)
                  : d.total_amount
                  ? Number(d.total_amount)
                  : undefined,
              items: docItems,
              createdAt: d.created_at || new Date().toISOString(),
            };
          });

          localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(mappedDocs));
        }
      }
    } catch (err) {
      console.warn('Inventory sync error:', err);
    }
  },

  // ─── CATEGORIES ──────────────────────────────────────────
  getCategories(): InventoryCategory[] {
    try {
      const stored = localStorage.getItem(INVENTORY_CATEGORIES_KEY);
      const parsed = stored ? (JSON.parse(stored) as InventoryCategory[]) : [];
      const merged = mergeInventoryCategories(Array.isArray(parsed) ? parsed : []);
      if (!stored || merged.length !== parsed.length) {
        localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(merged));
      }
      return merged;
    } catch {
      return DEFAULT_INVENTORY_CATEGORIES;
    }
  },

  addCategory(nameEn: string, nameTa: string): InventoryCategory {
    const cleanEn = nameEn.trim();
    const cleanTa = nameTa.trim() || cleanEn;
    const categories = this.getCategories();
    const existing = categories.find(
      (c) => c.nameEn.trim().toLowerCase() === cleanEn.toLowerCase()
    );
    if (existing) return existing;

    const id = `cat-${Date.now()}`;
    const newCat: InventoryCategory = { id, nameEn: cleanEn, nameTa: cleanTa, isCustom: true };
    categories.push(newCat);
    localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(categories));
    persistRemoteSetting(SITE_KEY_INVENTORY_CATS, categories).catch(() => {});
    return newCat;
  },

  // ─── ITEMS ───────────────────────────────────────────────
  getItems(): InventoryItem[] {
    try {
      const stored = localStorage.getItem(INVENTORY_ITEMS_KEY);
      if (!stored) {
        const now = new Date().toISOString();
        const initial: InventoryItem[] = INITIAL_INVENTORY_ITEMS.map((item) => ({
          ...item,
          id: item.id || generateUUID(),
          createdAt: now,
          updatedAt: now,
        }));
        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(initial));
        localStorage.setItem(INVENTORY_CATALOG_VERSION_KEY, '1');
        return initial;
      }

      const parsed = JSON.parse(stored) as InventoryItem[];
      const isUpgraded = localStorage.getItem(INVENTORY_CATALOG_VERSION_KEY) === '1';

      if (!isUpgraded && Array.isArray(parsed)) {
        const now = new Date().toISOString();
        const byEnName = new Map<string, InventoryItem>();
        parsed.forEach((it) => {
          if (it?.nameEn) byEnName.set(it.nameEn.trim().toLowerCase(), it);
        });

        const metaMap = getLocalMetaMap();
        const seededById = new Set<string>();
        const merged: InventoryItem[] = INITIAL_INVENTORY_ITEMS.map((seed) => {
          const seedId = seed.id || generateUUID();
          seededById.add(seedId);
          const legacy = byEnName.get(seed.nameEn.trim().toLowerCase());
          const stock = legacy?.currentStock ?? legacy?.stockQuantity;
          const item: InventoryItem = {
            ...legacy,
            id: seedId,
            nameEn: seed.nameEn,
            nameTa: seed.nameTa,
            categoryId: seed.categoryId,
            unit: seed.unit,
            currentStock: stock,
            stockQuantity: stock,
            createdAt: legacy?.createdAt || now,
            updatedAt: legacy?.updatedAt || now,
          };
          const itemMeta = extractInventoryMeta(item);
          if (Object.keys(itemMeta).length > 0) {
            metaMap[seedId] = itemMeta;
          }
          return item;
        });

        const seededNames = new Set(
          INITIAL_INVENTORY_ITEMS.map((s) => s.nameEn.trim().toLowerCase())
        );
        parsed.forEach((it) => {
          if (it?.nameEn && !seededNames.has(it.nameEn.trim().toLowerCase()) && !seededById.has(it.id)) {
            merged.push(it);
          }
        });

        saveLocalMetaMap(metaMap);
        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(merged));
        localStorage.setItem(INVENTORY_CATALOG_VERSION_KEY, '1');
        return merged;
      }

      return parsed;
    } catch {
      return [];
    }
  },

  getItemById(id: string): InventoryItem | undefined {
    return this.getItems().find((item) => item.id === id);
  },

  async addItem(
    itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<InventoryItem> {
    const items = this.getItems();
    const now = new Date().toISOString();
    const id = generateUUID();
    const resolvedStock =
      itemData.currentStock !== undefined ? itemData.currentStock : itemData.stockQuantity;

    const newItem: InventoryItem = {
      ...itemData,
      id,
      currentStock: resolvedStock,
      stockQuantity: resolvedStock,
      createdAt: now,
      updatedAt: now,
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('inventory_items').insert({
        id,
        name: newItem.nameEn,
        tamil_name: newItem.nameTa,
        category: newItem.categoryId,
        unit: newItem.unit,
      });
      if (error) {
        console.error('Failed to add item in Supabase:', error);
        throw new Error(error.message);
      }

      const itemMeta = extractInventoryMeta(newItem);
      const metaMap = getLocalMetaMap();
      if (Object.keys(itemMeta).length > 0) {
        metaMap[id] = itemMeta;
        saveLocalMetaMap(metaMap);
        await persistRemoteSetting(SITE_KEY_INVENTORY_META, metaMap);
      }
    } else {
      const itemMeta = extractInventoryMeta(newItem);
      if (Object.keys(itemMeta).length > 0) {
        const metaMap = getLocalMetaMap();
        metaMap[id] = itemMeta;
        saveLocalMetaMap(metaMap);
      }
    }

    items.unshift(newItem);
    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));
    return newItem;
  },

  async updateItem(item: InventoryItem): Promise<InventoryItem> {
    const items = this.getItems();
    const now = new Date().toISOString();
    const resolvedStock =
      item.currentStock !== undefined ? item.currentStock : item.stockQuantity;
    const updated: InventoryItem = {
      ...item,
      currentStock: resolvedStock,
      stockQuantity: resolvedStock,
      updatedAt: now,
    };

    if (isSupabaseConfigured && isUuid(item.id)) {
      const { error } = await supabase.from('inventory_items').upsert(
        {
          id: item.id,
          name: updated.nameEn,
          tamil_name: updated.nameTa,
          category: updated.categoryId,
          unit: updated.unit,
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.error('Failed to update item in Supabase:', error.message);
        throw new Error(error.message);
      }
    }

    const metaMap = getLocalMetaMap();
    const itemMeta = extractInventoryMeta(updated);
    if (Object.keys(itemMeta).length > 0) {
      metaMap[updated.id] = itemMeta;
    } else {
      delete metaMap[updated.id];
    }
    saveLocalMetaMap(metaMap);
    if (isSupabaseConfigured) {
      await persistRemoteSetting(SITE_KEY_INVENTORY_META, metaMap);
    }

    const index = items.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      items[index] = updated;
    } else {
      items.unshift(updated);
    }
    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));

    return updated;
  },

  async deleteItem(id: string): Promise<boolean> {
    const items = this.getItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) {
      return false;
    }

    if (isSupabaseConfigured && isUuid(id)) {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete item in Supabase:', error.message);
        throw new Error(error.message);
      }
    }

    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(filtered));
    const metaMap = getLocalMetaMap();
    if (metaMap[id]) {
      delete metaMap[id];
      saveLocalMetaMap(metaMap);
      if (isSupabaseConfigured) {
        await persistRemoteSetting(SITE_KEY_INVENTORY_META, metaMap);
      }
    }
    return true;
  },

  // ─── DOCUMENTS ──────────────────────────────────────────
  getDocuments(): InventoryDocument[] {
    try {
      const stored = localStorage.getItem(INVENTORY_DOCS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  getDocumentById(id: string): InventoryDocument | undefined {
    return this.getDocuments().find((d) => d.id === id);
  },

  createDocumentNumber(): string {
    let counter = 1;
    try {
      const stored = localStorage.getItem(INVENTORY_COUNTER_KEY);
      if (stored) {
        counter = parseInt(stored, 10) + 1;
      }
    } catch {
      counter = 1;
    }
    localStorage.setItem(INVENTORY_COUNTER_KEY, String(counter));
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    return `DOC-${dateStr}-${String(counter).padStart(3, '0')}`;
  },

  async saveDocument(
    docData: Omit<InventoryDocument, 'id' | 'docNumber' | 'createdAt'> & {
      id?: string;
      docNumber?: string;
    }
  ): Promise<InventoryDocument> {
    const docs = this.getDocuments();
    const now = new Date().toISOString();
    const id = docData.id && isUuid(docData.id) ? docData.id : generateUUID();
    const docNumber = docData.docNumber || this.createDocumentNumber();

    let totalAmount: number | undefined = undefined;
    const itemsWithTotals = docData.items.map((it) => {
      const qVal =
        typeof it.quantity === 'number' ? it.quantity : parseFloat(String(it.quantity)) || 0;
      const itemTotal =
        typeof it.unitPrice === 'number' && !isNaN(it.unitPrice) && it.unitPrice > 0
          ? Math.round(qVal * it.unitPrice * 100) / 100
          : undefined;
      if (itemTotal !== undefined) {
        totalAmount = (totalAmount || 0) + itemTotal;
      }
      return {
        ...it,
        id: it.id && isUuid(it.id) ? it.id : generateUUID(),
        quantity: qVal,
        totalPrice: itemTotal,
      };
    });

    const newDoc: InventoryDocument = {
      ...docData,
      id,
      docNumber,
      items: itemsWithTotals,
      totalAmount,
      createdAt: now,
    };

    // Save to Supabase purchase_documents & purchase_items
    if (isSupabaseConfigured) {
      const meta = {
        docNumber,
        title: newDoc.title,
        eventName: newDoc.eventName,
        customerName: newDoc.customerName || null,
        eventDate: newDoc.eventDate || null,
        preparedBy: newDoc.preparedBy || null,
        notes: newDoc.notes || null,
        language: newDoc.language || 'both',
        totalAmount: totalAmount || null,
      };

      const { error: docErr } = await supabase.from('purchase_documents').upsert(
        {
          id,
          document_date: newDoc.documentDate || now.split('T')[0],
          notes: JSON.stringify(meta),
        },
        { onConflict: 'id' }
      );

      if (docErr) {
        console.error('Failed to save purchase document to Supabase:', docErr);
        throw new Error(docErr.message);
      }

      // Delete prior items if updating
      await supabase.from('purchase_items').delete().eq('document_id', id);

      if (itemsWithTotals.length > 0) {
        const itemRows = itemsWithTotals.map((it) => ({
          id: it.id,
          document_id: id,
          item_id: it.catalogueItemId && isUuid(it.catalogueItemId) ? it.catalogueItemId : null,
          item_name: it.nameEn,
          quantity: it.quantity,
          unit: it.unit,
          price: it.unitPrice || null,
          notes: it.nameTa || it.notes || null,
        }));

        const { error: itemErr } = await supabase.from('purchase_items').insert(itemRows);
        if (itemErr) {
          console.error('Failed to insert purchase items to Supabase:', itemErr);
          throw new Error(itemErr.message);
        }
      }
    }

    const existingIdx = docs.findIndex((d) => d.id === id);
    if (existingIdx !== -1) {
      docs[existingIdx] = newDoc;
    } else {
      docs.unshift(newDoc);
    }
    localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(docs));

    return newDoc;
  },

  async deleteDocument(id: string): Promise<boolean> {
    const docs = this.getDocuments();
    const filtered = docs.filter((d) => d.id !== id);
    if (filtered.length === docs.length) {
      return false;
    }

    if (isSupabaseConfigured && isUuid(id)) {
      await supabase.from('purchase_items').delete().eq('document_id', id);
      const { error } = await supabase.from('purchase_documents').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete purchase document in Supabase:', error);
        throw new Error(error.message);
      }
    }

    localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(filtered));
    return true;
  },

  // ─── CSV EXPORT ──────────────────────────────────────────
  exportToCsv(doc: InventoryDocument, lang: 'en' | 'ta' = 'en'): void {
    const isTa = lang === 'ta';
    const headers = isTa
      ? ['வ.எண்', 'பொருளின் பெயர்', 'வகை', 'அளவு', 'அலகு', 'விலை (₹)', 'மொத்தம் (₹)', 'குறிப்பு']
      : ['S.No.', 'Item Name', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Total Price', 'Notes'];

    const rows = doc.items.map((item, index) => {
      const name = isTa ? item.nameTa || item.nameEn : item.nameEn;
      const cat = isTa ? item.categoryNameTa || item.categoryNameEn || '' : item.categoryNameEn || '';
      const unit = formatUnitLabel(item.unit, lang);
      const unitPrice = item.unitPrice !== undefined && item.unitPrice > 0 ? `₹${item.unitPrice}` : '';
      const totalPrice = item.totalPrice !== undefined && item.totalPrice > 0 ? `₹${item.totalPrice}` : '';
      const notes = item.notes ? `"${item.notes.replace(/"/g, '""')}"` : '';

      return [
        index + 1,
        `"${name.replace(/"/g, '""')}"`,
        `"${cat.replace(/"/g, '""')}"`,
        item.quantity,
        `"${unit}"`,
        unitPrice,
        totalPrice,
        notes,
      ].join(',');
    });

    const titleRow = `"${doc.title} - ${doc.eventName}"`;
    const metaRow = isTa
      ? `"ஆவண எண்: ${doc.docNumber} | தேதி: ${doc.documentDate} | நிகழ்வு தேதி: ${doc.eventDate || '—'} | வாடிக்கையாளர்: ${doc.customerName || '—'}"`
      : `"Doc No: ${doc.docNumber} | Date: ${doc.documentDate} | Event Date: ${doc.eventDate || '—'} | Customer: ${doc.customerName || '—'}"`;

    const csvContent = '\uFEFF' + [titleRow, metaRow, '', headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.docNumber}-${doc.eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${lang.toUpperCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    inventoryService.syncFromSupabase().catch(() => {});
  }, 1200);
}
