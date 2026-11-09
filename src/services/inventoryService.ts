/**
 * inventoryService — Grocery & Vegetable Inventory Management System
 * Connected to Supabase (inventory_items, purchase_documents, purchase_items)
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
   * Synchronizes items and purchase documents from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Items
      const { data: itemData, error: itemErr } = await supabase.from('inventory_items').select('*');
      if (!itemErr && Array.isArray(itemData) && itemData.length > 0) {
        const local = this.getItems();
        const localMap = new Map(local.map((i) => [i.id, i]));

        itemData.forEach((it) => {
          localMap.set(it.id, {
            id: it.id,
            nameEn: it.name || it.name_en || '',
            nameTa: it.tamil_name || it.name_ta || '',
            categoryId: it.category || it.category_id || 'cat-grocery',
            unit: it.unit || 'kg',
            stockQuantity: it.stock_quantity != null ? Number(it.stock_quantity) : undefined,
            unitPrice: it.unit_price != null ? Number(it.unit_price) : undefined,
            isActive: it.is_active ?? true,
            createdAt: it.created_at || new Date().toISOString(),
            updatedAt: it.updated_at || it.created_at || new Date().toISOString(),
          });
        });

        localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(Array.from(localMap.values())));
      }

      // 2. Purchase Documents & Items
      const { data: docData, error: docErr } = await supabase
        .from('purchase_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!docErr && Array.isArray(docData) && docData.length > 0) {
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
              totalPrice: r.price != null && r.quantity != null ? Math.round(Number(r.price) * Number(r.quantity) * 100) / 100 : undefined,
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

          const docItems = itemsByDocId[d.id] || meta.items || (Array.isArray(d.items) ? d.items : []);
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
            totalAmount: meta.totalAmount != null ? Number(meta.totalAmount) : (d.total_amount ? Number(d.total_amount) : undefined),
            items: docItems,
            createdAt: d.created_at || new Date().toISOString(),
          };
        });

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

  addCategory(nameEn: string, nameTa: string): InventoryCategory {
    const categories = this.getCategories();
    const id = `cat-${Date.now()}`;
    const newCat: InventoryCategory = { id, nameEn, nameTa };
    categories.push(newCat);
    localStorage.setItem(INVENTORY_CATEGORIES_KEY, JSON.stringify(categories));
    return newCat;
  },

  // ─── ITEMS ───────────────────────────────────────────────
  getItems(): InventoryItem[] {
    try {
      const stored = localStorage.getItem(INVENTORY_ITEMS_KEY);
      if (!stored) {
        const now = new Date().toISOString();
        const initial = INITIAL_INVENTORY_ITEMS.map((item) => ({
          ...item,
          id: generateUUID(),
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

  async addItem(
    itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<InventoryItem> {
    const items = this.getItems();
    const now = new Date().toISOString();
    const id = generateUUID();

    const newItem: InventoryItem = {
      ...itemData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    items.unshift(newItem);
    localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));

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
    }

    return newItem;
  },

  async updateItem(item: InventoryItem): Promise<InventoryItem> {
    const items = this.getItems();
    const index = items.findIndex((i) => i.id === item.id);
    const now = new Date().toISOString();
    const updated = {
      ...item,
      updatedAt: now,
    };

    if (index !== -1) {
      items[index] = updated;
      localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(items));
    }

    if (isSupabaseConfigured && item.id.length >= 32 && item.id.includes('-')) {
      const { error } = await supabase.from('inventory_items').update({
        name: item.nameEn,
        tamil_name: item.nameTa,
        category: item.categoryId,
        unit: item.unit,
      }).eq('id', item.id);
      if (error) console.warn('Supabase item update warning:', error.message);
    }

    return updated;
  },

  async deleteItem(id: string): Promise<boolean> {
    const items = this.getItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length !== items.length) {
      localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
        await supabase.from('inventory_items').delete().eq('id', id);
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

  async saveDocument(
    docData: Omit<InventoryDocument, 'id' | 'docNumber' | 'createdAt'> & {
      id?: string;
      docNumber?: string;
    }
  ): Promise<InventoryDocument> {
    const docs = this.getDocuments();
    const now = new Date().toISOString();
    const id = docData.id && docData.id.length >= 32 && docData.id.includes('-')
      ? docData.id
      : generateUUID();
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
        id: it.id && it.id.length >= 32 && it.id.includes('-') ? it.id : generateUUID(),
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

    const existingIdx = docs.findIndex((d) => d.id === id);
    if (existingIdx !== -1) {
      docs[existingIdx] = newDoc;
    } else {
      docs.unshift(newDoc);
    }
    localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(docs));

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

      const { error: docErr } = await supabase.from('purchase_documents').upsert({
        id,
        document_date: newDoc.documentDate || now.split('T')[0],
        notes: JSON.stringify(meta),
      }, { onConflict: 'id' });

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
          item_id: it.catalogueItemId && it.catalogueItemId.length >= 32 && it.catalogueItemId.includes('-')
            ? it.catalogueItemId
            : null,
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

    return newDoc;
  },

  async deleteDocument(id: string): Promise<boolean> {
    const docs = this.getDocuments();
    const filtered = docs.filter((d) => d.id !== id);
    if (filtered.length !== docs.length) {
      localStorage.setItem(INVENTORY_DOCS_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured) {
        await supabase.from('purchase_items').delete().eq('document_id', id);
        const { error } = await supabase.from('purchase_documents').delete().eq('id', id);
        if (error) {
          console.error('Failed to delete purchase document in Supabase:', error);
          return false;
        }
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
  }, 1200);
}
