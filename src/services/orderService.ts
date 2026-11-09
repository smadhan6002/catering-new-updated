/**
 * orderService — Order persistence with Supabase production backend & local storage fallback.
 * Keeps orders, items, food quantities, and split payment history synchronized permanently.
 */
import type { Order, OrderPayment, OrderStatus } from '../types/admin';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ORDERS_KEY = 'annapoorna_orders';
const ORDER_COUNTER_KEY = 'annapoorna_order_counter';

function getCounter(): number {
  return parseInt(localStorage.getItem(ORDER_COUNTER_KEY) || '0', 10);
}

function generateOrderId(existingOrders: Order[] = []): string {
  let counter = getCounter();
  for (const o of existingOrders) {
    if (o.id && o.id.startsWith('ORD-')) {
      const parsed = parseInt(o.id.replace('ORD-', ''), 10);
      if (!isNaN(parsed) && parsed > counter) {
        counter = parsed;
      }
    }
  }

  let next = counter + 1;
  let candidate = `ORD-${String(next).padStart(4, '0')}`;
  while (existingOrders.some((o) => o.id === candidate)) {
    next++;
    candidate = `ORD-${String(next).padStart(4, '0')}`;
  }

  localStorage.setItem(ORDER_COUNTER_KEY, String(next));
  return candidate;
}

export function normalizeOrderPayments(order: Order): OrderPayment[] {
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    return order.payments;
  }

  const migrated: OrderPayment[] = [];
  const adv = Number(order.advanceAmount) || 0;
  const bal = Number(order.balancePaid) || 0;
  const baseDate = order.orderDate || (order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);

  if (adv > 0) {
    migrated.push({
      id: `${order.id}-pay-1`,
      amount: adv,
      date: baseDate,
      method: 'Cash',
      note: 'Existing advance payment',
    });
  }

  if (bal > 0) {
    migrated.push({
      id: `${order.id}-pay-2`,
      amount: bal,
      date: baseDate,
      method: 'Cash',
      note: 'Existing balance payment',
    });
  }

  return migrated;
}

export function getOrderTotalPaid(order: Order): number {
  const payments = normalizeOrderPayments(order);
  return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

export function getOrderBalanceDue(order: Order): number {
  const total = Number(order.totalAmount) || 0;
  const totalPaid = getOrderTotalPaid(order);
  return Math.max(0, total - totalPaid);
}

export function getOrderPaymentStatus(order: Order): 'Unpaid' | 'Partially Paid' | 'Paid' {
  const total = Number(order.totalAmount) || 0;
  const totalPaid = getOrderTotalPaid(order);

  if (totalPaid <= 0) return 'Unpaid';
  if (totalPaid >= total && total > 0) return 'Paid';
  return 'Partially Paid';
}

interface SupabaseOrderRow {
  id: string;
  order_number?: string | null;
  customer_id?: string | null;
  customer_name: string;
  phone?: string | null;
  mobile?: string | null;
  alternative_mobile?: string | null;
  order_source?: string | null;
  event_address?: string | null;
  event_type?: string | null;
  order_date?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  guest_count?: number | null;
  food_quantity?: number | null;
  quantity_unit?: string | null;
  food_quantities?: unknown;
  total_amount?: number | null;
  advance_amount?: number | null;
  balance_amount?: number | null;
  balance_paid?: number | null;
  payment_status?: string | null;
  order_status?: string | null;
  payments?: unknown;
  status?: string | null;
  kitchen_sheet_status?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  invoice_generated?: boolean | null;
  created_at?: string;
}

function parsePackedNotes(notesStr?: string | null): {
  eventAddress: string;
  eventType: string;
  orderSource: string;
  cleanNotes: string;
} {
  let eventAddress = '';
  let eventType = '';
  let orderSource = 'Website';
  let cleanNotes = notesStr || '';

  if (cleanNotes) {
    // Check bracket format: [Address: ...] [Event: ...] [Source: ...]
    const addrMatch = cleanNotes.match(/\[Address:\s*([^\]]+)\]/);
    if (addrMatch) {
      eventAddress = addrMatch[1].trim();
      cleanNotes = cleanNotes.replace(addrMatch[0], '').trim();
    }
    const eventMatch = cleanNotes.match(/\[Event:\s*([^\]]+)\]/);
    if (eventMatch) {
      eventType = eventMatch[1].trim();
      cleanNotes = cleanNotes.replace(eventMatch[0], '').trim();
    }
    const srcMatch = cleanNotes.match(/\[Source:\s*([^\]]+)\]/);
    if (srcMatch) {
      orderSource = srcMatch[1].trim();
      cleanNotes = cleanNotes.replace(srcMatch[0], '').trim();
    }

    // Check pipe format: Address: ... | Event: ... | Source: ...
    if (cleanNotes.includes('Address:') || cleanNotes.includes('Event:') || cleanNotes.includes('Source:')) {
      const parts = cleanNotes.split(' | ');
      const remaining: string[] = [];
      parts.forEach((p) => {
        if (p.startsWith('Address:') && !eventAddress) {
          eventAddress = p.replace('Address:', '').trim();
        } else if (p.startsWith('Event:') && !eventType) {
          eventType = p.replace('Event:', '').trim();
        } else if (p.startsWith('Source:')) {
          orderSource = p.replace('Source:', '').trim();
        } else {
          remaining.push(p);
        }
      });
      cleanNotes = remaining.join(' | ');
    }
  }

  return { eventAddress, eventType, orderSource, cleanNotes };
}

function mapRowToOrder(row: SupabaseOrderRow): Order {
  const payments = Array.isArray(row.payments) ? (row.payments as OrderPayment[]) : [];
  const parsed = parsePackedNotes(row.notes);

  const eventAddress = row.event_address || parsed.eventAddress || 'Not specified';
  const eventType = row.event_type || parsed.eventType || undefined;
  const orderSource = (row.order_source || parsed.orderSource || 'Website') as Order['orderSource'];
  const notes = parsed.cleanNotes;

  const orderNum = row.order_number || (row.id && row.id.startsWith('ORD-') ? row.id : `ORD-${String(row.id).slice(0, 4).toUpperCase()}`);

  return {
    id: row.id,
    orderNumber: orderNum,
    customerId: row.customer_id || undefined,
    customerName: row.customer_name || 'Customer',
    mobile: row.mobile || row.phone || '',
    alternativeMobile: row.alternative_mobile || undefined,
    orderSource,
    eventAddress,
    eventType,
    orderDate: row.order_date || row.delivery_date || new Date().toISOString().split('T')[0],
    deliveryTime: row.delivery_time || undefined,
    guestCount: row.guest_count !== null && row.guest_count !== undefined ? Number(row.guest_count) : null,
    items: [], // Will be filled from order_items
    foodQuantities: Array.isArray(row.food_quantities) ? row.food_quantities : undefined,
    totalAmount: Number(row.total_amount) || 0,
    advanceAmount: Number(row.advance_amount) || 0,
    balancePaid: Number(row.balance_paid ?? row.balance_amount) || 0,
    payments,
    status: (row.status || row.order_status || 'Pending') as OrderStatus,
    kitchenSheetStatus: (row.kitchen_sheet_status as Order['kitchenSheetStatus']) || 'Not Prepared',
    notes,
    adminNotes: row.admin_notes || undefined,
    invoiceGenerated: Boolean(row.invoice_generated),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapOrderToRow(order: Order, orderUuid: string, orderNumber: string): Record<string, any> {
  const combinedNotes = `[Address: ${order.eventAddress || 'Not specified'}] [Event: ${order.eventType || 'Catering'}] [Source: ${order.orderSource || 'Website'}] ${order.notes || ''}`.trim();

  return {
    id: orderUuid,
    order_number: orderNumber,
    customer_id: order.customerId || null,
    customer_name: order.customerName,
    mobile: order.mobile,
    phone: order.mobile,
    alternative_mobile: order.alternativeMobile || null,
    order_source: order.orderSource || 'Website',
    event_address: order.eventAddress,
    event_type: order.eventType || null,
    order_date: order.orderDate,
    delivery_date: order.orderDate,
    delivery_time: order.deliveryTime || null,
    guest_count: order.guestCount,
    food_quantities: order.foodQuantities || [],
    total_amount: order.totalAmount || 0,
    advance_amount: order.advanceAmount || 0,
    balance_paid: order.balancePaid || 0,
    balance_amount: order.balancePaid || 0,
    payments: order.payments || [],
    status: order.status || 'Pending',
    order_status: order.status || 'Pending',
    kitchen_sheet_status: order.kitchenSheetStatus || 'Not Prepared',
    notes: combinedNotes,
    admin_notes: order.adminNotes || null,
    invoice_generated: Boolean(order.invoiceGenerated),
    created_at: order.createdAt,
  };
}

export const orderService = {
  /**
   * Synchronizes orders and items directly from Supabase
   */
  async syncFromSupabase(): Promise<Order[]> {
    if (!isSupabaseConfigured) return this.getAll();

    try {
      const { data: orderRows, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordErr) {
        console.warn('Failed to load orders from Supabase:', ordErr.message);
        return this.getAll();
      }

      if (Array.isArray(orderRows)) {
        const itemsByOrderId: Record<string, Order['items']> = {};

        if (orderRows.length > 0) {
          const orderIds = orderRows.map((r) => r.id);
          const { data: itemRows } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);

          if (Array.isArray(itemRows)) {
            itemRows.forEach((it) => {
              if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
              itemsByOrderId[it.order_id].push({
                dishId: it.dish_id || it.dish_name,
                dishName: it.dish_name,
                categoryId: it.category_id || 'starters',
                quantity: it.quantity ? Number(it.quantity) : undefined,
                unit: it.unit || undefined,
                notes: it.notes || undefined,
              });
            });
          }
        }

        const localOrders = this.getAll();
        const localMap = new Map(localOrders.map((o) => [o.orderNumber || o.id, o]));

        const mappedOrders: Order[] = orderRows.map((row) => {
          const ord = mapRowToOrder(row);
          const dbItems = itemsByOrderId[ord.id] || (ord.orderNumber ? itemsByOrderId[ord.orderNumber] : null);
          const localMatch = localMap.get(ord.orderNumber || ord.id);
          ord.items = (dbItems && dbItems.length > 0) ? dbItems : (localMatch?.items || []);
          return ord;
        });

        // Store latest in local cache
        localStorage.setItem(ORDERS_KEY, JSON.stringify(mappedOrders));
        return mappedOrders;
      }
    } catch (err) {
      console.warn('Order sync error:', err);
    }
    return this.getAll();
  },

  getAll(): Order[] {
    try {
      const raw = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]') as Order[];
      return raw.map((order) => {
        const payments = normalizeOrderPayments(order);
        const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return {
          ...order,
          payments,
          advanceAmount: payments[0]?.amount ?? 0,
          balancePaid: payments.slice(1).reduce((s, p) => s + (Number(p.amount) || 0), 0) || (totalPaid > (payments[0]?.amount ?? 0) ? totalPaid - (payments[0]?.amount ?? 0) : 0),
        };
      });
    } catch {
      return [];
    }
  },

  getById(id: string): Order | undefined {
    return this.getAll().find((o) => o.id === id || o.orderNumber === id);
  },

  async create(data: Omit<Order, 'id' | 'createdAt' | 'invoiceGenerated'>): Promise<Order> {
    const orders = this.getAll();
    const payments = data.payments ? [...data.payments] : [];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const orderNumber = generateOrderId(orders);
    const orderUuid = generateUuid();

    const advanceAmount = payments[0]?.amount ?? data.advanceAmount ?? 0;
    const balancePaid = data.balancePaid ?? (totalPaid > advanceAmount ? totalPaid - advanceAmount : 0);

    const order: Order = {
      ...data,
      id: orderUuid,
      orderNumber,
      orderSource: data.orderSource || 'Website',
      createdAt: new Date().toISOString(),
      invoiceGenerated: false,
      payments,
      advanceAmount,
      balancePaid,
    };

    // 1. Primary permanent save to Supabase
    if (isSupabaseConfigured) {
      console.log(`[orderService] Persisting order ${orderNumber} (${orderUuid}) to Supabase...`);

      const fullRow = mapOrderToRow(order, orderUuid, orderNumber);
      let ordResult = await supabase.from('orders').insert(fullRow);

      // If full row fails due to missing schema columns, fallback to base table schema
      if (ordResult.error) {
        console.warn('[orderService] Full row insert failed, attempting base schema fallback:', ordResult.error.message);
        const combinedNotes = `[Address: ${order.eventAddress || 'Not specified'}] [Event: ${order.eventType || 'Catering'}] [Source: ${order.orderSource || 'Website'}] ${order.notes || ''}`.trim();

        const baseRow = {
          id: orderUuid,
          order_number: orderNumber,
          customer_name: data.customerName,
          phone: data.mobile,
          delivery_date: data.orderDate,
          order_status: data.status || 'Pending',
          total_amount: data.totalAmount || 0,
          advance_amount: advanceAmount,
          balance_amount: balancePaid,
          guest_count: data.guestCount,
          notes: combinedNotes,
          payment_status: getOrderPaymentStatus(order),
        };

        ordResult = await supabase.from('orders').insert(baseRow);
      }

      if (ordResult.error) {
        console.error('[orderService] Supabase order insertion failed:', {
          code: ordResult.error.code,
          message: ordResult.error.message,
          details: ordResult.error.details,
          hint: ordResult.error.hint,
        });
        throw new Error(
          `Supabase Error (${ordResult.error.code || 'UNKNOWN'}): ${ordResult.error.message}`
        );
      }

      console.log(`[orderService] Order ${orderNumber} created successfully in Supabase.`);

      // 2. Insert order items
      if (Array.isArray(data.items) && data.items.length > 0) {
        const fullItemRows = data.items.map((it) => ({
          order_id: orderUuid,
          dish_id: it.dishId,
          dish_name: it.dishName,
          category_id: it.categoryId,
          quantity: it.quantity || null,
          unit: it.unit || 'Portions',
          price: it.price || 0,
          notes: it.notes || null,
        }));

        let itemResult = await supabase.from('order_items').insert(fullItemRows);

        if (itemResult.error) {
          console.warn('[orderService] Dish item insert with dish_id failed, attempting with dish_id: null:', itemResult.error.message);
          const baseItemRows = data.items.map((it) => ({
            order_id: orderUuid,
            dish_id: null,
            dish_name: it.dishName,
            quantity: it.quantity || null,
            unit: it.unit || 'Portions',
            price: it.price || 0,
          }));

          const fallbackItemResult = await supabase.from('order_items').insert(baseItemRows);
          if (fallbackItemResult.error) {
            console.error('[orderService] Critical: order_items insert failed:', fallbackItemResult.error);
            throw new Error(`Order created, but items could not be saved: ${fallbackItemResult.error.message}`);
          }
        }
        console.log(`[orderService] Successfully persisted ${data.items.length} items to public.order_items.`);
      }
    }

    // 3. Update local cache
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    return order;
  },

  async update(id: string, changes: Partial<Order>): Promise<Order | undefined> {
    const orders = this.getAll();
    const idx = orders.findIndex((o) => o.id === id || o.orderNumber === id);
    if (idx === -1) return undefined;

    let updatedPayments = changes.payments ?? orders[idx].payments ?? [];
    if (!changes.payments && (changes.advanceAmount !== undefined || changes.balancePaid !== undefined)) {
      updatedPayments = normalizeOrderPayments({ ...orders[idx], ...changes });
    }

    orders[idx] = {
      ...orders[idx],
      ...changes,
      payments: updatedPayments,
      advanceAmount: updatedPayments[0]?.amount ?? 0,
      balancePaid: updatedPayments.slice(1).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    };
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    // Update in Supabase
    if (isSupabaseConfigured) {
      const order = orders[idx];
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const updateData: Record<string, any> = {
        customer_name: order.customerName,
        phone: order.mobile,
        delivery_date: order.orderDate,
        guest_count: order.guestCount,
        order_status: order.status,
        status: order.status,
        total_amount: order.totalAmount,
        advance_amount: order.advanceAmount,
        balance_amount: order.balancePaid,
        balance_paid: order.balancePaid,
        notes: order.notes,
      };

      let query = supabase.from('orders').update(updateData);
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('order_number', id);
      }
      const { error } = await query;
      if (error) console.warn('[orderService] Supabase update warning:', error.message);
    }

    return orders[idx];
  },

  updateStatus(id: string, status: OrderStatus): Promise<Order | undefined> {
    return this.update(id, { status });
  },

  updatePayment(
    id: string,
    totalAmount: number,
    advanceAmount: number,
    balancePaid: number
  ): Promise<Order | undefined> {
    return this.update(id, { totalAmount, advanceAmount, balancePaid });
  },

  async addPayment(
    orderId: string,
    payment: Omit<OrderPayment, 'id'>
  ): Promise<Order | undefined> {
    const order = this.getById(orderId);
    if (!order) return undefined;
    const currentPayments = normalizeOrderPayments(order);
    const newPayment: OrderPayment = {
      ...payment,
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount: Number(payment.amount) || 0,
    };
    const updatedPayments = [...currentPayments, newPayment];

    if (isSupabaseConfigured) {
      supabase
        .from('order_payments')
        .insert({
          id: newPayment.id,
          order_id: orderId,
          amount: newPayment.amount,
          date: newPayment.date,
          method: newPayment.method,
          note: newPayment.note || null,
        })
        .then(() => {}, () => {});
    }

    return this.update(orderId, { payments: updatedPayments });
  },

  async updatePaymentEntry(
    orderId: string,
    paymentId: string,
    changes: Partial<OrderPayment>
  ): Promise<Order | undefined> {
    const order = this.getById(orderId);
    if (!order) return undefined;
    const currentPayments = normalizeOrderPayments(order);
    const updatedPayments = currentPayments.map((p) => {
      if (p.id === paymentId) {
        const updated = {
          ...p,
          ...changes,
          amount: changes.amount !== undefined ? Number(changes.amount) : p.amount,
        };
        if (isSupabaseConfigured) {
          supabase
            .from('order_payments')
            .update({
              amount: updated.amount,
              date: updated.date,
              method: updated.method,
              note: updated.note || null,
            })
            .eq('id', paymentId)
            .then(() => {}, () => {});
        }
        return updated;
      }
      return p;
    });
    return this.update(orderId, { payments: updatedPayments });
  },

  async deletePaymentEntry(
    orderId: string,
    paymentId: string
  ): Promise<Order | undefined> {
    const order = this.getById(orderId);
    if (!order) return undefined;
    const currentPayments = normalizeOrderPayments(order);
    const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);

    if (isSupabaseConfigured) {
      supabase.from('order_payments').delete().eq('id', paymentId).then(() => {}, () => {});
    }

    return this.update(orderId, { payments: updatedPayments });
  },

  markInvoiceGenerated(id: string): Promise<Order | undefined> {
    return this.update(id, { invoiceGenerated: true });
  },

  async delete(id: string): Promise<void> {
    const orders = this.getAll().filter((o) => o.id !== id && o.orderNumber !== id);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    if (isSupabaseConfigured) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        await supabase.from('order_items').delete().eq('order_id', id);
        await supabase.from('orders').delete().eq('id', id);
      } else {
        const { data } = await supabase.from('orders').select('id').eq('order_number', id).maybeSingle();
        if (data && data.id) {
          await supabase.from('order_items').delete().eq('order_id', data.id);
          await supabase.from('orders').delete().eq('id', data.id);
        } else {
          await supabase.from('orders').delete().eq('order_number', id);
        }
      }
    }
  },

  /**
   * Safe idempotent migration of local storage orders into Supabase
   */
  async migrateExistingOrdersToSupabase(): Promise<{ migrated: number; errors: string[] }> {
    if (!isSupabaseConfigured) return { migrated: 0, errors: ['Supabase not configured'] };

    const localOrders = this.getAll();
    const result = { migrated: 0, errors: [] as string[] };

    try {
      const { data: dbOrders } = await supabase.from('orders').select('id, order_number');
      const existingOrderNumbers = new Set(
        (dbOrders || []).map((o) => o.order_number).filter(Boolean)
      );
      const existingIds = new Set((dbOrders || []).map((o) => o.id));

      for (const order of localOrders) {
        const orderNum = order.orderNumber || (order.id.startsWith('ORD-') ? order.id : null);
        if (orderNum && existingOrderNumbers.has(orderNum)) {
          continue; // Already migrated
        }
        if (existingIds.has(order.id)) {
          continue; // Already migrated
        }

        try {
          const orderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id)
            ? order.id
            : generateUuid();
          const targetNum = orderNum || `ORD-${String(result.migrated + 1).padStart(4, '0')}`;

          const combinedNotes = `[Address: ${order.eventAddress || 'Not specified'}] [Event: ${order.eventType || 'Catering'}] [Source: ${order.orderSource || 'Website'}] ${order.notes || ''}`.trim();

          const basePayload = {
            id: orderUuid,
            order_number: targetNum,
            customer_name: order.customerName,
            phone: order.mobile,
            delivery_date: order.orderDate,
            order_status: order.status || 'Pending',
            advance_amount: order.advanceAmount || 0,
            balance_amount: order.balancePaid || 0,
            total_amount: order.totalAmount || 0,
            guest_count: order.guestCount,
            notes: combinedNotes,
            payment_status: getOrderPaymentStatus(order),
          };

          const { error: ordErr } = await supabase.from('orders').insert(basePayload);
          if (ordErr) {
            result.errors.push(`Order ${targetNum}: ${ordErr.message}`);
            continue;
          }

          if (Array.isArray(order.items) && order.items.length > 0) {
            const itemRows = order.items.map((it) => ({
              order_id: orderUuid,
              dish_id: null,
              dish_name: it.dishName,
              quantity: it.quantity || null,
              unit: it.unit || 'Portions',
              price: it.price || 0,
            }));
            await supabase.from('order_items').insert(itemRows);
          }

          result.migrated++;
        } catch (err: any) {
          result.errors.push(`Order ${order.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.errors.push(`Migration query failed: ${err.message}`);
    }

    return result;
  },
};

// Background initial sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    orderService.syncFromSupabase().catch(() => {});
  }, 1200);
}
