/**
 * inventoryService — Grocery & Vegetable Inventory Management System
 * Connected to Supabase (inventory_items, inventory_categories, purchase_documents, purchase_items)
 * with robust local cache fallback and exact decimal quantity preservation.
 */
import type {
  InventoryCategory,
  InventoryItem,
  InventoryDocument,
} from '../types/inventory';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const INVENTORY_ITEMS_KEY = 'kanchi_inventory_items';
const INVENTORY_CATEGORIES_KEY = 'kanchi_inventory_categories';
const INVENTORY_DOCS_KEY = 'kanchi_inventory_documents';
const INVENTORY_COUNTER_KEY = 'kanchi_inventory_counter';

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategory[] = [
  { id: 'cat-grocery', nameEn: 'Grocery Items', nameTa: 'மளிகைப் பொருட்கள்' },
  { id: 'cat-vegetables', nameEn: 'Vegetables', nameTa: 'காய்கறிகள்' },
  { id: 'cat-fruits', nameEn: 'Fruits', nameTa: 'பழங்கள்' },
  { id: 'cat-spices', nameEn: 'Spices & Masala', nameTa: 'மசாலாப் பொருட்கள்' },
  { id: 'cat-oils', nameEn: 'Oils & Other Ingredients', nameTa: 'எண்ணெய் மற்றும் பிற பொருட்கள்' },
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
];

export function formatUnitLabel(unit: string, lang: 'en' | 'ta' = 'en'): string {
  const found = SUPPORTED_UNITS.find((u) => u.id === unit || u.shortEn.toLowerCase() === unit.toLowerCase());
  if (found) {
    return lang === 'ta' ? found.shortTa : found.shortEn;
  }
  return unit;
}

export const INITIAL_INVENTORY_ITEMS: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Grocery Items
  { nameEn: 'Rice', nameTa: 'அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Idli Rice', nameTa: 'இட்லி அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Raw Rice', nameTa: 'பச்சரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Basmati Rice', nameTa: 'பாஸ்மதி அரிசி', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Wheat Flour', nameTa: 'கோதுமை மாவு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Maida', nameTa: 'மைதா', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Rava / Sooji', nameTa: 'ரவை', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Vermicelli', nameTa: 'சேமியா', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Toor Dal', nameTa: 'துவரம் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Urad Dal', nameTa: 'உளுத்தம் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Moong Dal', nameTa: 'பாசிப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Chana Dal', nameTa: 'கடலைப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Chickpeas', nameTa: 'கொண்டைக்கடலை', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Green Gram', nameTa: 'பச்சைப்பயறு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Tamarind', nameTa: 'புளி', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Jaggery', nameTa: 'வெல்லம்', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Sugar', nameTa: 'சர்க்கரை', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Salt', nameTa: 'உப்பு', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Cashew Nuts', nameTa: 'முந்திரிப் பருப்பு', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Raisins', nameTa: 'உலர் திராட்சை', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Coconut', nameTa: 'தேங்காய்', categoryId: 'cat-grocery', unit: 'pcs' },
  { nameEn: 'Desiccated Coconut', nameTa: 'கொப்பரைத் தேங்காய்', categoryId: 'cat-grocery', unit: 'kg' },
  { nameEn: 'Papad / Appalam', nameTa: 'அப்பளம்', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Pickle', nameTa: 'ஊறுகாய்', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Tea Powder', nameTa: 'தேயிலைத் தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Coffee Powder', nameTa: 'காபித் தூள்', categoryId: 'cat-grocery', unit: 'packets' },
  { nameEn: 'Milk Powder', nameTa: 'பால் பவுடர்', categoryId: 'cat-grocery', unit: 'packets' },

  // Spices & Masala
  { nameEn: 'Mustard Seeds', nameTa: 'கடுகு', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Cumin Seeds', nameTa: 'சீரகம்', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Black Pepper', nameTa: 'மிளகு', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Fenugreek Seeds', nameTa: 'வெந்தயம்', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Turmeric Powder', nameTa: 'மஞ்சள் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Chilli Powder', nameTa: 'மிளகாய் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Coriander Powder', nameTa: 'மல்லித் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Garam Masala', nameTa: 'கரம் மசாலா', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Asafoetida', nameTa: 'பெருங்காயம்', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Cardamom', nameTa: 'ஏலக்காய்', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Cloves', nameTa: 'கிராம்பு', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Cinnamon', nameTa: 'பட்டை', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Biryani Leaves', nameTa: 'பிரியாணி இலை', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Fennel Seeds', nameTa: 'சோம்பு', categoryId: 'cat-spices', unit: 'g' },
  { nameEn: 'Sambar Powder', nameTa: 'சாம்பார் தூள்', categoryId: 'cat-spices', unit: 'packets' },
  { nameEn: 'Rasam Powder', nameTa: 'ரசம் தூள்', categoryId: 'cat-spices', unit: 'packets' },

  // Oils & Ingredients
  { nameEn: 'Sunflower Oil', nameTa: 'சூரியகாந்தி எண்ணெய்', categoryId: 'cat-oils', unit: 'L' },
  { nameEn: 'Gingelly Oil / Sesame Oil', nameTa: 'நல்லெண்ணெய்', categoryId: 'cat-oils', unit: 'L' },
  { nameEn: 'Pure Ghee', nameTa: 'நெய்', categoryId: 'cat-oils', unit: 'L' },
  { nameEn: 'Vanaspati', nameTa: 'வனஸ்பதி', categoryId: 'cat-oils', unit: 'L' },
  { nameEn: 'Butter', nameTa: 'வெண்ணெய்', categoryId: 'cat-oils', unit: 'kg' },
  { nameEn: 'Paneer', nameTa: 'பன்னீர்', categoryId: 'cat-oils', unit: 'kg' },
  { nameEn: 'Curd', nameTa: 'தயிர்', categoryId: 'cat-oils', unit: 'L' },
  { nameEn: 'Fresh Milk', nameTa: 'பால்', categoryId: 'cat-oils', unit: 'L' },

  // Vegetables
  { nameEn: 'Onion (Big)', nameTa: 'பெரிய வெங்காயம்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Small Onion / Shallots', nameTa: 'சின்ன வெங்காயம்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Tomato', nameTa: 'தக்காளி', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Potato', nameTa: 'உருளைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Carrot', nameTa: 'கேரட்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Beans', nameTa: 'பீன்ஸ்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Cabbage', nameTa: 'முட்டைகோஸ்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Beetroot', nameTa: 'பீட்ரூட்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Brinjal / Eggplant', nameTa: 'கத்திரிக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Ladies Finger / Okra', nameTa: 'வெண்டைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Drumstick', nameTa: 'முருங்கைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Cauliflower', nameTa: 'காலிஃபிளவர்', categoryId: 'cat-vegetables', unit: 'pcs' },
  { nameEn: 'Green Chilli', nameTa: 'பச்சை மிளகாய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Ginger', nameTa: 'இஞ்சி', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Garlic', nameTa: 'பூண்டு', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Coriander Leaves', nameTa: 'கொத்தமல்லி தழை', categoryId: 'cat-vegetables', unit: 'bundles' },
  { nameEn: 'Curry Leaves', nameTa: 'கறிவேப்பிலை', categoryId: 'cat-vegetables', unit: 'bundles' },
  { nameEn: 'Mint Leaves', nameTa: 'புதினா', categoryId: 'cat-vegetables', unit: 'bundles' },
  { nameEn: 'Raw Banana', nameTa: 'வாழைக்காய்', categoryId: 'cat-vegetables', unit: 'pcs' },
  { nameEn: 'Chayote / Chow Chow', nameTa: 'சௌசௌ', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Ash Gourd / White Pumpkin', nameTa: 'வெண்பூசணி', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Yellow Pumpkin', nameTa: 'மஞ்சள் பூசணி', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Snake Gourd', nameTa: 'புடலங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Bottle Gourd', nameTa: 'சுரைக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Ridge Gourd', nameTa: 'பீர்க்கங்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Bitter Gourd', nameTa: 'பாகற்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Colocasia / Seppankizhangu', nameTa: 'சேப்பங்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Elephant Yam / Senai', nameTa: 'சேனைக்கிழங்கு', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Mushroom', nameTa: 'காளான்', categoryId: 'cat-vegetables', unit: 'packets' },
  { nameEn: 'Baby Corn', nameTa: 'பேபி கார்ன்', categoryId: 'cat-vegetables', unit: 'packets' },
  { nameEn: 'Capsicum', nameTa: 'குடைமிளகாய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Cucumber', nameTa: 'வெள்ளரிக்காய்', categoryId: 'cat-vegetables', unit: 'kg' },
  { nameEn: 'Lemon', nameTa: 'எலுமிச்சை', categoryId: 'cat-vegetables', unit: 'pcs' },

  // Fruits
  { nameEn: 'Banana (Poovan)', nameTa: 'பூவன் வாழைப்பழம்', categoryId: 'cat-fruits', unit: 'dozens' },
  { nameEn: 'Banana (Sevvalai)', nameTa: 'செவ்வாழை', categoryId: 'cat-fruits', unit: 'dozens' },
  { nameEn: 'Apple', nameTa: 'ஆப்பிள்', categoryId: 'cat-fruits', unit: 'kg' },
  { nameEn: 'Sweet Orange / Mosambi', nameTa: 'சாத்துக்குடி', categoryId: 'cat-fruits', unit: 'kg' },
  { nameEn: 'Pomegranate', nameTa: 'மாதுளை', categoryId: 'cat-fruits', unit: 'kg' },
  { nameEn: 'Grapes', nameTa: 'திராட்சை', categoryId: 'cat-fruits', unit: 'kg' },
  { nameEn: 'Pineapple', nameTa: 'அன்னாசிப்பழம்', categoryId: 'cat-fruits', unit: 'pcs' },
  { nameEn: 'Watermelon', nameTa: 'தர்பூசணி', categoryId: 'cat-fruits', unit: 'kg' },
  { nameEn: 'Mango', nameTa: 'மாம்பழம்', categoryId: 'cat-fruits', unit: 'kg' },

  // Other Items
  { nameEn: 'Banana Leaf (Meals)', nameTa: 'சாப்பாட்டு வாழை இலை', categoryId: 'cat-other', unit: 'pcs' },
  { nameEn: 'Tiffin Leaf', nameTa: 'டிபன் இலை', categoryId: 'cat-other', unit: 'pcs' },
  { nameEn: 'Betel Leaves & Areca Nut', nameTa: 'வெற்றிலை பாக்கு', categoryId: 'cat-other', unit: 'packets' },
  { nameEn: 'Paper Rolls / Napkins', nameTa: 'டிஷ்யூ பேப்பர் / நேப்கின்', categoryId: 'cat-other', unit: 'packets' },
  { nameEn: 'Water Cans (20L)', nameTa: 'மினரல் வாட்டர் கேன்', categoryId: 'cat-other', unit: 'pcs' },
  { nameEn: 'Paper Cups', nameTa: 'பேப்பர் கப்', categoryId: 'cat-other', unit: 'packets' },
];

export const inventoryService = {
  /**
   * Synchronizes categories, items, and purchase docs from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Categories
      const { data: catData, error: catErr } = await supabase.from('inventory_categories').select('*');
      if (!catErr && Array.isArray(catData) && catData.length > 0) {
        const mappedCats: InventoryCategory[] = catData.map((c) => ({
          id: c.id,
          nameEn: c.name_en,
          nameTa: c.name_ta,
        }));
        localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(mappedCats));
      }

      // 2. Items
      const { data: itemData, error: itemErr } = await supabase.from('inventory_items').select('*');
      if (!itemErr && Array.isArray(itemData) && itemData.length > 0) {
        const mappedItems: InventoryItem[] = itemData.map((it) => ({
          id: it.id,
          nameEn: it.name_en,
          nameTa: it.name_ta,
          categoryId: it.category_id,
          unit: it.unit,
          currentStock: it.stock_quantity ?? undefined,
          unitPrice: it.unit_price ?? undefined,
          createdAt: it.created_at,
          updatedAt: it.updated_at,
        }));
        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(mappedItems));
      }

      // 3. Purchase Documents
      const { data: docData, error: docErr } = await supabase.from('purchase_documents').select('*');
      if (!docErr && Array.isArray(docData) && docData.length > 0) {
        const mappedDocs: InventoryDocument[] = docData.map((d) => ({
          id: d.id,
          docNumber: d.doc_number || d.docNumber || `DOC-${d.id.slice(-6)}`,
          title: d.title,
          eventName: d.event_name,
          customerName: d.customer_name || undefined,
          eventDate: d.event_date || d.document_date || new Date().toISOString(),
          documentDate: d.document_date,
          preparedBy: d.prepared_by || undefined,
          notes: d.notes || undefined,
          language: (d.language === 'ta' ? 'ta' : 'en') as 'en' | 'ta',
          totalAmount: d.total_amount ? Number(d.total_amount) : undefined,
          items: Array.isArray(d.items) ? d.items : [],
          createdAt: d.created_at,
        }));
        localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(mappedDocs));
      }
    } catch (err) {
      console.warn('Inventory sync error:', err);
    }
  },

  // ─── CATEGORIES ──────────────────────────────────────────
  getCategories(): InventoryCategory[] {
    try {
      const stored = localStorage.getItem(INVENTORY_CATEGORIES_KEY);
      if (!stored) {
        localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(DEFAULT_INVENTORY_CATEGORIES));
        return DEFAULT_INVENTORY_CATEGORIES;
      }
      return JSON.parse(stored);
    } catch {
      return DEFAULT_INVENTORY_CATEGORIES;
    }
  },

  addCategory(categoryOrEn: { nameEn: string; nameTa: string } | string, maybeTa?: string): InventoryCategory {
    const categories = this.getCategories();
    const id = `cat-${Date.now()}`;
    const nameEn = typeof categoryOrEn === 'object' ? categoryOrEn.nameEn : categoryOrEn;
    const nameTa = typeof categoryOrEn === 'object' ? categoryOrEn.nameTa : (maybeTa || '');
    const newCat: InventoryCategory = { id, nameEn, nameTa };
    categories.push(newCat);
    localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(categories));

    if (isSupabaseConfigured) {
      supabase.from('inventory_categories').insert({ id, name_en: nameEn, name_ta: nameTa }).then(() => {}, () => {});
    }

    return newCat;
  },

  // ─── ITEMS ───────────────────────────────────────────────
  getItems(): InventoryItem[] {
    try {
      const stored = localStorage.getItem(INVENTORY_ITEMS_KEY);
      if (!stored) {
        const now = new Date().toISOString();
        const initial = INITIAL_INVENTORY_ITEMS.map((item, idx) => ({
          ...item,
          id: `inv-${idx + 1}`,
          createdAt: now,
          updatedAt: now,
        }));
        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  getItemById(id: string): InventoryItem | undefined {
    return this.getItems().find((item) => item.id === id);
  },

  addItem(
    itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): InventoryItem {
    const items = this.getItems();
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      ...itemData,
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };
    items.unshift(newItem);
    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured) {
      supabase.from('inventory_items').insert({
        id: newItem.id,
        name_en: newItem.nameEn,
        name_ta: newItem.nameTa,
        category_id: newItem.categoryId,
        unit: newItem.unit,
        stock_quantity: newItem.currentStock || null,
        unit_price: newItem.unitPrice || null,
        is_active: true,
      }).then(() => {}, () => {});
    }

    return newItem;
  },

  updateItem(item: InventoryItem): InventoryItem {
    const items = this.getItems();
    const index = items.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      items[index] = {
        ...item,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));

      if (isSupabaseConfigured) {
        supabase.from('inventory_items').upsert({
          id: item.id,
          name_en: item.nameEn,
          name_ta: item.nameTa,
          category_id: item.categoryId,
          unit: item.unit,
          stock_quantity: item.currentStock || null,
          unit_price: item.unitPrice || null,
          is_active: true,
          updated_at: items[index].updatedAt,
        }, { onConflict: 'id' }).then(() => {}, () => {});
      }

      return items[index];
    }
    return item;
  },

  deleteItem(id: string): boolean {
    const items = this.getItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length !== items.length) {
      localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured) {
        supabase.from('inventory_items').delete().eq('id', id).then(() => {}, () => {});
      }
      return true;
    }
    return false;
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

  saveDocument(
    docData: Omit<InventoryDocument, 'id' | 'docNumber' | 'createdAt'> & {
      id?: string;
      docNumber?: string;
    }
  ): InventoryDocument {
    const docs = this.getDocuments();
    const now = new Date().toISOString();
    const id = docData.id || `invdoc-${Date.now()}`;
    const docNumber = docData.docNumber || this.createDocumentNumber();

    let totalAmount: number | undefined = undefined;
    const itemsWithTotals = docData.items.map((it) => {
      const qVal = typeof it.quantity === 'number' ? it.quantity : parseFloat(String(it.quantity)) || 0;
      const itemTotal =
        typeof it.unitPrice === 'number' && !isNaN(it.unitPrice) && it.unitPrice > 0
          ? Math.round(qVal * it.unitPrice * 100) / 100
          : undefined;
      if (itemTotal !== undefined) {
        totalAmount = (totalAmount || 0) + itemTotal;
      }
      return {
        ...it,
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

    const existingIdx = docs.findIndex((d) => d.id === id);
    if (existingIdx !== -1) {
      docs[existingIdx] = newDoc;
    } else {
      docs.unshift(newDoc);
    }

    localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(docs));

    // Save to Supabase
    if (isSupabaseConfigured) {
      supabase.from('purchase_documents').upsert({
        id: newDoc.id,
        title: newDoc.title,
        event_name: newDoc.eventName,
        customer_name: newDoc.customerName || null,
        event_date: newDoc.eventDate || null,
        document_date: newDoc.documentDate,
        prepared_by: newDoc.preparedBy || null,
        notes: newDoc.notes || null,
        language: newDoc.language || 'both',
        total_amount: newDoc.totalAmount || 0,
        items: newDoc.items,
        created_at: newDoc.createdAt,
      }, { onConflict: 'id' }).then(async ({ error }) => {
        if (!error && Array.isArray(newDoc.items)) {
          const itemRows = newDoc.items.map((it) => ({
            id: it.id || `pit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            document_id: newDoc.id,
            catalogue_item_id: it.catalogueItemId || null,
            name_en: it.nameEn,
            name_ta: it.nameTa,
            category_name_en: it.categoryNameEn || null,
            category_name_ta: it.categoryNameTa || null,
            quantity: typeof it.quantity === 'number' ? it.quantity : parseFloat(String(it.quantity)) || 0,
            unit: it.unit,
            unit_price: it.unitPrice || null,
            total_price: it.totalPrice || null,
          }));
          await supabase.from('purchase_items').upsert(itemRows, { onConflict: 'id' });
        }
      }, () => {});
    }

    return newDoc;
  },

  deleteDocument(id: string): boolean {
    const docs = this.getDocuments();
    const filtered = docs.filter((d) => d.id !== id);
    if (filtered.length !== docs.length) {
      localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured) {
        supabase.from('purchase_documents').delete().eq('id', id).then(() => {}, () => {});
      }
      return true;
    }
    return false;
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
  }, 1800);
}
