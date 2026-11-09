import type { Customer, Order } from '../types/admin';
import { orderService } from './orderService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CUSTOMERS_KEY = 'annapoorna_customers';
const CUSTOMER_COUNTER_KEY = 'annapoorna_customer_counter';

export function normalizeMobile(input: string | undefined | null): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  return digits;
}

function getCounter(): number {
  return parseInt(localStorage.getItem(CUSTOMER_COUNTER_KEY) || '0', 10);
}

function incrementCounter(): number {
  const next = getCounter() + 1;
  localStorage.setItem(CUSTOMER_COUNTER_KEY, String(next));
  return next;
}

function generateCustomerId(): string {
  const next = incrementCounter();
  return `CUST-${String(next).padStart(4, '0')}`;
}

interface SupabaseCustomerRow {
  id: string;
  name: string;
  mobile: string;
  alternative_mobile?: string | null;
  email?: string | null;
  birthday?: string | null;
  anniversary_date?: string | null;
  preferred_language?: string | null;
  marketing_consent?: boolean | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

function mapRowToCustomer(row: SupabaseCustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    alternativeMobile: row.alternative_mobile || undefined,
    email: row.email || undefined,
    birthday: row.birthday || undefined,
    anniversaryDate: row.anniversary_date || undefined,
    preferredLanguage: (row.preferred_language as 'en' | 'ta') || 'ta',
    marketingConsent: row.marketing_consent ?? true,
    notes: row.notes || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapCustomerToRow(customer: Customer): SupabaseCustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    alternative_mobile: customer.alternativeMobile || null,
    email: customer.email || null,
    birthday: customer.birthday || null,
    anniversary_date: customer.anniversaryDate || null,
    preferred_language: customer.preferredLanguage || 'ta',
    marketing_consent: customer.marketingConsent ?? true,
    notes: customer.notes || null,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  };
}

export const customerService = {
  /**
   * Synchronize all customers from Supabase into local cache
   */
  async syncFromSupabase(): Promise<Customer[]> {
    if (!isSupabaseConfigured) return this.getAll();

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch customers from Supabase:', error.message);
        return this.getAll();
      }

      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapRowToCustomer);
        // Merge with existing local to prevent loss
        const existing = this.getAll();
        const existingMap = new Map(existing.map((c) => [c.id, c]));
        mapped.forEach((c) => existingMap.set(c.id, c));
        const merged = Array.from(existingMap.values());
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Customer sync error:', err);
    }
    return this.getAll();
  },

  getAll(): Customer[] {
    try {
      const data = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]') as Customer[];
      if (!Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  },

  getById(id: string): Customer | undefined {
    return this.getAll().find((c) => c.id === id);
  },

  getByMobile(mobile: string): Customer | undefined {
    const norm = normalizeMobile(mobile);
    if (!norm) return undefined;
    return this.getAll().find((c) => normalizeMobile(c.mobile) === norm);
  },

  search(query: string): Customer[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();
    const normDigits = query.replace(/\D/g, '');

    return this.getAll().filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const mobMatch = c.mobile.includes(normDigits);
      const altMatch = c.alternativeMobile ? c.alternativeMobile.includes(normDigits) : false;
      const emailMatch = c.email ? c.email.toLowerCase().includes(q) : false;
      return nameMatch || mobMatch || altMatch || emailMatch;
    });
  },

  create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer {
    const customers = this.getAll();
    const norm = normalizeMobile(data.mobile);

    // Check if customer with this normalized mobile already exists
    const existing = customers.find((c) => normalizeMobile(c.mobile) === norm);
    if (existing) {
      return this.update(existing.id, {
        name: data.name || existing.name,
        alternativeMobile: data.alternativeMobile || existing.alternativeMobile,
        email: data.email || existing.email,
        birthday: data.birthday || existing.birthday,
        anniversaryDate: data.anniversaryDate || existing.anniversaryDate,
        preferredLanguage: data.preferredLanguage || existing.preferredLanguage,
        marketingConsent: data.marketingConsent !== undefined ? data.marketingConsent : existing.marketingConsent,
        notes: data.notes ? (existing.notes ? `${existing.notes}\n${data.notes}` : data.notes) : existing.notes,
      }) || existing;
    }

    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...data,
      id: generateCustomerId(),
      mobile: norm,
      alternativeMobile: data.alternativeMobile ? normalizeMobile(data.alternativeMobile) : undefined,
      createdAt: now,
      updatedAt: now,
      marketingConsent: data.marketingConsent ?? true,
    };

    customers.push(newCustomer);
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));

    // Save asynchronously to Supabase
    if (isSupabaseConfigured) {
      Promise.resolve(
        supabase
          .from('customers')
          .upsert(mapCustomerToRow(newCustomer), { onConflict: 'id' })
      )
        .then(({ error }) => {
          if (error) console.warn('Supabase customer create error:', error.message);
        })
        .catch((err: any) => console.warn('Supabase customer create network error:', err));
    }

    return newCustomer;
  },

  update(id: string, changes: Partial<Customer>): Customer | undefined {
    const customers = this.getAll();
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const updated: Customer = {
      ...customers[idx],
      ...changes,
      mobile: changes.mobile ? normalizeMobile(changes.mobile) : customers[idx].mobile,
      alternativeMobile: changes.alternativeMobile !== undefined ? (changes.alternativeMobile ? normalizeMobile(changes.alternativeMobile) : undefined) : customers[idx].alternativeMobile,
      updatedAt: new Date().toISOString(),
    };

    customers[idx] = updated;
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));

    // Update asynchronously in Supabase
    if (isSupabaseConfigured) {
      Promise.resolve(
        supabase
          .from('customers')
          .upsert(mapCustomerToRow(updated), { onConflict: 'id' })
      )
        .then(({ error }) => {
          if (error) console.warn('Supabase customer update error:', error.message);
        })
        .catch((err: any) => console.warn('Supabase customer update network error:', err));
    }

    return updated;
  },

  delete(id: string): void {
    const customers = this.getAll().filter((c) => c.id !== id);
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));

    if (isSupabaseConfigured) {
      Promise.resolve(
        supabase
          .from('customers')
          .delete()
          .eq('id', id)
      )
        .then(({ error }) => {
          if (error) console.warn('Supabase customer delete error:', error.message);
        })
        .catch((err: any) => console.warn('Supabase customer delete network error:', err));
    }
  },

  findOrCreateFromOrder(info: {
    customerName: string;
    mobile: string;
    alternativeMobile?: string;
    notes?: string;
    preferredLanguage?: 'en' | 'ta';
  }): Customer {
    const norm = normalizeMobile(info.mobile);
    const existing = this.getByMobile(norm);
    if (existing) {
      if (info.customerName && (!existing.name || existing.name.length < info.customerName.length)) {
        this.update(existing.id, { name: info.customerName });
      }
      return existing;
    }

    return this.create({
      name: info.customerName.trim(),
      mobile: norm,
      alternativeMobile: info.alternativeMobile,
      preferredLanguage: info.preferredLanguage || 'ta',
      marketingConsent: true,
      notes: info.notes ? `Created from order. Notes: ${info.notes}` : undefined,
    });
  },

  getCustomerOrders(customerIdOrMobile: string): Order[] {
    const norm = normalizeMobile(customerIdOrMobile);
    const allOrders = orderService.getAll();
    return allOrders.filter(
      (o) => o.customerId === customerIdOrMobile || (norm && normalizeMobile(o.mobile) === norm)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getCustomerMetrics(customerIdOrMobile: string): {
    orderCount: number;
    totalSpent: number;
    lastOrderDate: string | null;
  } {
    const orders = this.getCustomerOrders(customerIdOrMobile);
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const lastOrderDate = orders.length > 0 ? (orders[0].orderDate || orders[0].createdAt.split('T')[0]) : null;

    return {
      orderCount: orders.length,
      totalSpent,
      lastOrderDate,
    };
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    customerService.syncFromSupabase().catch(() => {});
  }, 1000);
}
