/**
 * invoiceService — Invoice persistence with Supabase & local storage
 */
import type { Invoice } from '../types/admin';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const INVOICES_KEY = 'annapoorna_invoices';
const INV_COUNTER_KEY = 'annapoorna_invoice_counter';

function getCounter(): number {
  return parseInt(localStorage.getItem(INV_COUNTER_KEY) || '0', 10);
}

function generateInvoiceId(): string {
  const n = getCounter() + 1;
  localStorage.setItem(INV_COUNTER_KEY, String(n));
  return `INV-${String(n).padStart(4, '0')}`;
}

export const invoiceService = {
  /**
   * Synchronize invoices from Supabase
   */
  async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase.from('invoices').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: Invoice[] = data.map((row) => ({
          id: row.id,
          orderId: row.order_id,
          generatedAt: row.generated_at,
        }));
        localStorage.setItem(INVOICES_KEY, JSON.stringify(mapped));
      }
    } catch (err) {
      console.warn('Invoices sync error:', err);
    }
  },

  getAll(): Invoice[] {
    try {
      return JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]') as Invoice[];
    } catch {
      return [];
    }
  },

  getByOrderId(orderId: string): Invoice | undefined {
    return this.getAll().find((i) => i.orderId === orderId);
  },

  create(orderId: string): Invoice {
    const existing = this.getByOrderId(orderId);
    if (existing) return existing;

    const invoices = this.getAll();
    const invoice: Invoice = {
      id: generateInvoiceId(),
      orderId,
      generatedAt: new Date().toISOString(),
    };
    invoices.push(invoice);
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));

    if (isSupabaseConfigured) {
      supabase.from('invoices').insert({
        id: invoice.id,
        order_id: invoice.orderId,
        generated_at: invoice.generatedAt,
      }).then(() => {}, () => {});
    }

    return invoice;
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    invoiceService.syncFromSupabase().catch(() => {});
  }, 2400);
}
