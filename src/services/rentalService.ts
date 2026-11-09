/**
 * rentalService — handles rental items inventory, categories, transactions and documents
 * Data is backed by Supabase with reliable offline localStorage fallback.
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

export const DEFAULT_RENTAL_CATEGORIES: RentalCategory[] = [
  { id: 'cat-cooking', name: 'Cooking Vessels', nameTa: 'சமையல் பாத்திரங்கள்', description: 'Large pots, andas, cauldrons for cooking' },
  { id: 'cat-serving', name: 'Serving Vessels', nameTa: 'பரிமாறும் பாத்திரங்கள்', description: 'Buckets, basins, spoons, serving dishes' },
  { id: 'cat-carriers', name: 'Food Carriers', nameTa: 'உணவு எடுத்துச் செல்லும் பாத்திரங்கள்', description: 'Multi-tier carriers, food drums with lids' },
  { id: 'cat-hotboxes', name: 'Hot Boxes', nameTa: 'ஹாட்பாக்ஸ் வகைகள்', description: 'Insulated hot cases and casseroles' },
  { id: 'cat-plates', name: 'Plates and Trays', nameTa: 'தட்டுகள் & தட்டகங்கள்', description: 'Dining plates, water tumblers, buffet trays' },
  { id: 'cat-beverages', name: 'Beverage Equipment', nameTa: 'பான சாதனங்கள்', description: 'Coffee flasks, tea cans, milk warmers' },
  { id: 'cat-other', name: 'Other Items', nameTa: 'இதர பொருட்கள்', description: 'Miscellaneous catering equipment & accessories' },
];

export const INITIAL_RENTAL_ITEMS: Omit<RentalItem, 'id' | 'availableQuantity' | 'createdAt'>[] = [
  {
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
];

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
   * Synchronizes rental categories, items, and transactions from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Items
      const { data: itemData, error: itemErr } = await supabase.from('rental_items').select('*');
      if (!itemErr && Array.isArray(itemData) && itemData.length > 0) {
        const local = this.getRawItems();
        const localMap = new Map(local.map((r) => [r.id, r]));

        itemData.forEach((r, idx) => {
          let meta: Record<string, any> = {};
          if (r.notes && r.notes.startsWith('{')) {
            try {
              meta = JSON.parse(r.notes);
            } catch {
              meta = {};
            }
          }

          localMap.set(r.id, {
            id: r.id,
            code: meta.code || r.code || `RNT-${String(idx + 1).padStart(3, '0')}`,
            nameEn: r.name || r.name_en || '',
            nameTa: r.tamil_name || r.name_ta || '',
            categoryId: meta.categoryId || r.category_id || 'cat-cooking',
            totalQuantity: meta.totalQuantity != null ? Number(meta.totalQuantity) : (r.total_quantity || 10),
            rentalPrice: Number(r.price || r.rental_price) || 0,
            pricingUnit: r.unit || r.pricing_unit || 'Per Day',
            securityDeposit: meta.securityDeposit != null ? Number(meta.securityDeposit) : (Number(r.security_deposit) || 0),
            description: meta.description || r.description || undefined,
            notes: meta.notes || (meta.code ? undefined : r.notes) || undefined,
            isActive: meta.isActive ?? (r.is_active ?? true),
            availableQuantity: meta.totalQuantity != null ? Number(meta.totalQuantity) : (r.total_quantity || 10),
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
          });
        });

        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(Array.from(localMap.values())));
      }

      // 2. Documents & Items
      const { data: docData, error: docErr } = await supabase
        .from('rental_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!docErr && Array.isArray(docData) && docData.length > 0) {
        const docIds = docData.map((d) => d.id);
        const { data: itemRows } = await supabase
          .from('rental_document_items')
          .select('*')
          .in('document_id', docIds);

        const itemsByDocId: Record<string, RentalDocItem[]> = {};
        if (Array.isArray(itemRows)) {
          itemRows.forEach((r) => {
            if (!itemsByDocId[r.document_id]) itemsByDocId[r.document_id] = [];
            itemsByDocId[r.document_id].push({
              itemId: r.item_id,
              itemCode: '',
              nameEn: r.item_name || '',
              nameTa: '',
              quantity: Number(r.quantity) || 0,
              returnedQuantity: 0,
              pricePerUnit: Number(r.price) || 0,
              pricingUnit: 'Per Day',
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

          const docItems = itemsByDocId[rd.id] || meta.items || (Array.isArray(rd.items) ? rd.items : []);
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
    } catch (err) {
      console.warn('Rental sync error:', err);
    }
  },

  // ─── CATEGORIES ─────────────────────────────────────────────────────────
  getCategories(): RentalCategory[] {
    try {
      const stored = localStorage.getItem(RENTAL_CATEGORIES_KEY);
      if (!stored) {
        localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(DEFAULT_RENTAL_CATEGORIES));
        return DEFAULT_RENTAL_CATEGORIES;
      }
      return JSON.parse(stored) as RentalCategory[];
    } catch {
      return DEFAULT_RENTAL_CATEGORIES;
    }
  },

  getCategoryById(id: string): RentalCategory | undefined {
    return this.getCategories().find((c) => c.id === id);
  },

  addCategory(data: { name: string; nameTa: string; description?: string }): RentalCategory {
    const cats = this.getCategories();
    const id = `cat-custom-${Date.now()}`;
    const newCat: RentalCategory = { id, ...data };
    cats.push(newCat);
    localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(cats));
    return newCat;
  },

  updateCategory(id: string, data: Partial<RentalCategory>): RentalCategory | undefined {
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    cats[idx] = { ...cats[idx], ...data };
    localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(cats));
    return cats[idx];
  },

  // ─── ITEMS ─────────────────────────────────────────────────────────────
  getRawItems(): RentalItem[] {
    try {
      const stored = localStorage.getItem(RENTAL_ITEMS_KEY);
      if (!stored) {
        const seeded: RentalItem[] = INITIAL_RENTAL_ITEMS.map((item) => ({
          ...item,
          id: generateUUID(),
          availableQuantity: item.totalQuantity,
          createdAt: new Date().toISOString(),
        }));
        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(stored) as RentalItem[];
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

    items.push(newItem);
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured) {
      const meta = {
        code,
        categoryId: data.categoryId,
        totalQuantity: data.totalQuantity,
        securityDeposit: data.securityDeposit,
        description: data.description || null,
        notes: data.notes || null,
        isActive: data.isActive ?? true,
      };

      const { error } = await supabase.from('rental_items').insert({
        id: nextId,
        name: data.nameEn,
        tamil_name: data.nameTa || data.nameEn,
        price: data.rentalPrice,
        unit: data.pricingUnit || 'Per Day',
        notes: JSON.stringify(meta),
      });

      if (error) {
        console.error('Failed to insert rental item in Supabase:', error);
        throw new Error(error.message);
      }
    }

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

    const updated = {
      ...items[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    items[idx] = updated;
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
      const meta = {
        code: updated.code,
        categoryId: updated.categoryId,
        totalQuantity: updated.totalQuantity,
        securityDeposit: updated.securityDeposit,
        description: updated.description || null,
        notes: updated.notes || null,
        isActive: updated.isActive,
      };

      const { error } = await supabase.from('rental_items').update({
        name: updated.nameEn,
        tamil_name: updated.nameTa,
        price: updated.rentalPrice,
        unit: updated.pricingUnit,
        notes: JSON.stringify(meta),
      }).eq('id', id);

      if (error) console.warn('Supabase rental item update warning:', error.message);
    }

    return items[idx];
  },

  async deleteItem(id: string): Promise<{ softDeleted: boolean }> {
    const documents = this.getAllDocuments();
    const isReferenced = documents.some((doc) => doc.items.some((i) => i.itemId === id));

    if (isReferenced) {
      await this.updateItem(id, { isActive: false });
      return { softDeleted: true };
    }

    const items = this.getRawItems().filter((i) => i.id !== id);
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
      await supabase.from('rental_items').delete().eq('id', id);
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

    documents.unshift(newDoc);
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

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
        terms: newDoc.terms || null,
        preferredLanguage: newDoc.preferredLanguage || 'en',
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
          item_id: itm.itemId && itm.itemId.length >= 32 && itm.itemId.includes('-')
            ? itm.itemId
            : null,
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

    documents[idx] = updated;
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
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
      };

      await supabase.from('rental_documents').update({
        customer_name: updated.customerName,
        phone: updated.mobile,
        document_date: updated.documentDate,
        notes: JSON.stringify(meta),
      }).eq('id', id);

      if (changes.items) {
        await supabase.from('rental_document_items').delete().eq('document_id', id);
        const itemRows = updated.items.map((itm) => ({
          id: generateUUID(),
          document_id: id,
          item_id: itm.itemId && itm.itemId.length >= 32 && itm.itemId.includes('-')
            ? itm.itemId
            : null,
          item_name: itm.nameEn,
          quantity: itm.quantity,
          price: itm.pricePerUnit,
          subtotal: itm.lineTotal,
        }));
        await supabase.from('rental_document_items').insert(itemRows);
      }
    }

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
      localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
        await supabase.from('rental_document_items').delete().eq('document_id', id);
        await supabase.from('rental_documents').delete().eq('id', id);
      }
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
