/**
 * invoiceService — Invoice persistence with Supabase & local storage
 */
import type { Invoice } from '../types/admin';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { orderService } from './orderService';

const INVOICES_KEY = 'annapoorna_invoices';
const INV_COUNTER_KEY = 'annapoorna_invoice_counter';

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

function getCounter(): number {
  return parseInt(localStorage.getItem(INV_COUNTER_KEY) || '0', 10);
}

function generateInvoiceNumber(): string {
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
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: Invoice[] = data.map((row) => ({
          id: row.invoice_number || row.id,
          orderId: row.order_id,
          generatedAt: row.created_at || row.invoice_date || new Date().toISOString(),
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

  async create(orderId: string): Promise<Invoice> {
    const existing = this.getByOrderId(orderId);
    if (existing) return existing;

    const invoices = this.getAll();
    const invoiceNum = generateInvoiceNumber();
    const now = new Date().toISOString();

    const invoice: Invoice = {
      id: invoiceNum,
      orderId,
      generatedAt: now,
    };
    invoices.push(invoice);
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));

    if (isSupabaseConfigured) {
      const order = orderService.getById(orderId);
      const uuid = generateUUID();
      const { error } = await supabase.from('invoices').insert({
        id: uuid,
        invoice_number: invoiceNum,
        order_id: orderId,
        invoice_date: now.split('T')[0],
        total_amount: order?.totalAmount || 0,
      });

      if (error) {
        console.error('Failed to create invoice in Supabase:', error);
      }
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
