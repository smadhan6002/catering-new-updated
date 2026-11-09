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
      // 1. Categories
      const { data: catData } = await supabase.from('rental_categories').select('*');
      if (Array.isArray(catData) && catData.length > 0) {
        const mappedCats: RentalCategory[] = catData.map((c) => ({
          id: c.id,
          name: c.name,
          nameTa: c.name_ta,
          description: c.description || undefined,
        }));
        localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(mappedCats));
      }

      // 2. Items
      const { data: itemData } = await supabase.from('rental_items').select('*');
      if (Array.isArray(itemData) && itemData.length > 0) {
        const mappedItems: RentalItem[] = itemData.map((r) => ({
          id: r.id,
          code: r.code,
          nameEn: r.name_en,
          nameTa: r.name_ta,
          categoryId: r.category_id,
          totalQuantity: r.total_quantity || 0,
          rentalPrice: Number(r.rental_price) || 0,
          pricingUnit: r.pricing_unit || 'Per Day',
          securityDeposit: Number(r.security_deposit) || 0,
          description: r.description || undefined,
          notes: r.notes || undefined,
          isActive: r.is_active ?? true,
          availableQuantity: r.total_quantity || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(mappedItems));
      }

      // 3. Documents
      const { data: docData } = await supabase.from('rental_documents').select('*');
      if (Array.isArray(docData) && docData.length > 0) {
        const mappedDocs: RentalDocument[] = docData.map((rd) => ({
          id: rd.id,
          rentalNumber: rd.rental_number,
          customerName: rd.customer_name,
          mobile: rd.mobile,
          address: rd.address || undefined,
          functionName: rd.function_name || undefined,
          documentDate: rd.document_date,
          functionDate: rd.function_date,
          rentalStartDate: rd.rental_start_date,
          expectedReturnDate: rd.expected_return_date,
          actualReturnDate: rd.actual_return_date || undefined,
          deliveryDetails: rd.delivery_details || undefined,
          items: Array.isArray(rd.items) ? rd.items : [],
          subtotal: Number(rd.subtotal) || 0,
          additionalCharges: Number(rd.additional_charges) || 0,
          discount: Number(rd.discount) || 0,
          securityDeposit: Number(rd.security_deposit) || 0,
          grandTotal: Number(rd.grand_total) || 0,
          advancePaid: Number(rd.advance_paid) || 0,
          balanceDue: Number(rd.balance_due) || 0,
          status: rd.status || 'Confirmed',
          notes: rd.notes || undefined,
          terms: rd.terms || undefined,
          preferredLanguage: rd.preferred_language || 'en',
          createdAt: rd.created_at,
          updatedAt: rd.updated_at,
        }));
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

    if (isSupabaseConfigured) {
      supabase.from('rental_categories').insert({
        id,
        name: data.name,
        name_ta: data.nameTa,
        description: data.description || null,
      }).then(() => {}, () => {});
    }

    return newCat;
  },

  updateCategory(id: string, data: Partial<RentalCategory>): RentalCategory | undefined {
    const cats = this.getCategories();
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    cats[idx] = { ...cats[idx], ...data };
    localStorage.setItem(RENTAL_CATEGORIES_KEY, JSON.stringify(cats));

    if (isSupabaseConfigured) {
      supabase.from('rental_categories').upsert({
        id,
        name: cats[idx].name,
        name_ta: cats[idx].nameTa,
        description: cats[idx].description || null,
      }, { onConflict: 'id' }).then(() => {}, () => {});
    }

    return cats[idx];
  },

  // ─── ITEMS ─────────────────────────────────────────────────────────────
  getRawItems(): RentalItem[] {
    try {
      const stored = localStorage.getItem(RENTAL_ITEMS_KEY);
      if (!stored) {
        const seeded: RentalItem[] = INITIAL_RENTAL_ITEMS.map((item, idx) => ({
          id: `rnt-itm-${String(idx + 1).padStart(4, '0')}`,
          ...item,
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

  addItem(
    data: Omit<RentalItem, 'id' | 'availableQuantity' | 'createdAt' | 'updatedAt'>
  ): RentalItem {
    const items = this.getRawItems();

    const code = data.code.trim();
    if (items.some((i) => i.code.toLowerCase() === code.toLowerCase())) {
      throw new Error(`Item code "${code}" already exists. Please choose a unique code.`);
    }

    const nextId = `rnt-itm-${String(items.length + 1).padStart(4, '0')}`;
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
      supabase.from('rental_items').insert({
        id: nextId,
        code,
        name_en: data.nameEn,
        name_ta: data.nameTa,
        category_id: data.categoryId,
        total_quantity: data.totalQuantity,
        rental_price: data.rentalPrice,
        pricing_unit: data.pricingUnit,
        security_deposit: data.securityDeposit,
        description: data.description || null,
        notes: data.notes || null,
        is_active: data.isActive ?? true,
      }).then(() => {}, () => {});
    }

    return newItem;
  },

  updateItem(
    id: string,
    changes: Partial<Omit<RentalItem, 'id' | 'createdAt'>>
  ): RentalItem | undefined {
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

    items[idx] = {
      ...items[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured) {
      supabase.from('rental_items').upsert({
        id,
        code: items[idx].code,
        name_en: items[idx].nameEn,
        name_ta: items[idx].nameTa,
        category_id: items[idx].categoryId,
        total_quantity: items[idx].totalQuantity,
        rental_price: items[idx].rentalPrice,
        pricing_unit: items[idx].pricingUnit,
        security_deposit: items[idx].securityDeposit,
        description: items[idx].description || null,
        notes: items[idx].notes || null,
        is_active: items[idx].isActive ?? true,
        updated_at: items[idx].updatedAt,
      }, { onConflict: 'id' }).then(() => {}, () => {});
    }

    return items[idx];
  },

  deleteItem(id: string): { softDeleted: boolean } {
    const documents = this.getAllDocuments();
    const isReferenced = documents.some((doc) => doc.items.some((i) => i.itemId === id));

    if (isReferenced) {
      this.updateItem(id, { isActive: false });
      return { softDeleted: true };
    }

    const items = this.getRawItems().filter((i) => i.id !== id);
    localStorage.setItem(RENTAL_ITEMS_KEY, JSON.stringify(items));

    if (isSupabaseConfigured) {
      supabase.from('rental_items').delete().eq('id', id).then(() => {}, () => {});
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

  addDocument(
    data: Omit<RentalDocument, 'id' | 'rentalNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'grandTotal' | 'balanceDue'>
  ): RentalDocument {
    const documents = this.getAllDocuments();
    const rentalNumber = generateRentalNumber();
    const totals = this.computeTotals(data);

    const preparedItems = data.items.map((i) => ({
      ...i,
      lineTotal: i.quantity * i.pricePerUnit,
      returnedQuantity: i.returnedQuantity || 0,
    }));

    const newDoc: RentalDocument = {
      ...data,
      id: `rent-doc-${Date.now()}`,
      rentalNumber,
      items: preparedItems,
      ...totals,
      createdAt: new Date().toISOString(),
    };

    documents.unshift(newDoc);
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    if (isSupabaseConfigured) {
      supabase.from('rental_documents').insert({
        id: newDoc.id,
        rental_number: newDoc.rentalNumber,
        customer_name: newDoc.customerName,
        mobile: newDoc.mobile,
        address: newDoc.address || null,
        function_name: newDoc.functionName || null,
        document_date: newDoc.documentDate,
        function_date: newDoc.functionDate,
        rental_start_date: newDoc.rentalStartDate,
        expected_return_date: newDoc.expectedReturnDate,
        actual_return_date: newDoc.actualReturnDate || null,
        delivery_details: newDoc.deliveryDetails || null,
        items: newDoc.items,
        subtotal: newDoc.subtotal,
        additional_charges: newDoc.additionalCharges,
        discount: newDoc.discount,
        security_deposit: newDoc.securityDeposit,
        grand_total: newDoc.grandTotal,
        advance_paid: newDoc.advancePaid,
        balance_due: newDoc.balanceDue,
        status: newDoc.status,
        notes: newDoc.notes || null,
        terms: newDoc.terms || null,
        preferred_language: newDoc.preferredLanguage || 'en',
      }).then(() => {}, () => {});
    }

    return newDoc;
  },

  updateDocument(
    id: string,
    changes: Partial<Omit<RentalDocument, 'id' | 'rentalNumber' | 'createdAt'>>
  ): RentalDocument | undefined {
    const documents = this.getAllDocuments();
    const idx = documents.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;

    const existing = documents[idx];
    const items = changes.items || existing.items;

    const preparedItems = items.map((i) => ({
      ...i,
      lineTotal: i.quantity * i.pricePerUnit,
    }));

    const totals = this.computeTotals({
      items: preparedItems,
      additionalCharges: changes.additionalCharges ?? existing.additionalCharges,
      discount: changes.discount ?? existing.discount,
      securityDeposit: changes.securityDeposit ?? existing.securityDeposit,
      advancePaid: changes.advancePaid ?? existing.advancePaid,
    });

    documents[idx] = {
      ...existing,
      ...changes,
      items: preparedItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    if (isSupabaseConfigured) {
      supabase.from('rental_documents').upsert({
        id,
        rental_number: documents[idx].rentalNumber,
        customer_name: documents[idx].customerName,
        mobile: documents[idx].mobile,
        address: documents[idx].address || null,
        function_name: documents[idx].functionName || null,
        document_date: documents[idx].documentDate,
        function_date: documents[idx].functionDate,
        rental_start_date: documents[idx].rentalStartDate,
        expected_return_date: documents[idx].expectedReturnDate,
        actual_return_date: documents[idx].actualReturnDate || null,
        delivery_details: documents[idx].deliveryDetails || null,
        items: documents[idx].items,
        subtotal: documents[idx].subtotal,
        additional_charges: documents[idx].additionalCharges,
        discount: documents[idx].discount,
        security_deposit: documents[idx].securityDeposit,
        grand_total: documents[idx].grandTotal,
        advance_paid: documents[idx].advancePaid,
        balance_due: documents[idx].balanceDue,
        status: documents[idx].status,
        notes: documents[idx].notes || null,
        terms: documents[idx].terms || null,
        preferred_language: documents[idx].preferredLanguage || 'en',
        updated_at: documents[idx].updatedAt,
      }, { onConflict: 'id' }).then(() => {}, () => {});
    }

    return documents[idx];
  },

  updateStatus(
    id: string,
    status: RentalStatus,
    actualReturnDate?: string,
    notes?: string
  ): RentalDocument | undefined {
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

    return this.updateDocument(id, updates);
  },

  deleteDocument(id: string): void {
    const documents = this.getAllDocuments().filter((d) => d.id !== id);
    localStorage.setItem(RENTAL_DOCS_KEY, JSON.stringify(documents));

    if (isSupabaseConfigured) {
      supabase.from('rental_documents').delete().eq('id', id).then(() => {}, () => {});
    }
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    rentalService.syncFromSupabase().catch(() => {});
  }, 2000);
}
