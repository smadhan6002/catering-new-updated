/**
 * orderService — Order persistence with Supabase production backend & local storage fallback.
 * Keeps orders, items, food quantities, and split payment history synchronized permanently.
 */
import type { Order, OrderPayment, OrderStatus, PaymentStatus } from '../types/admin';
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

export function getOrderPaymentStatus(order: Order): PaymentStatus {
  const total = Number(order.totalAmount) || 0;
  const totalPaid = getOrderTotalPaid(order);

  if (totalPaid <= 0) return 'Unpaid';
  if (totalPaid >= total && total > 0) return 'Paid';
  return 'Partial';
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
    paymentStatus: (row.payment_status || 'Unpaid') as PaymentStatus,
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
        const paymentsByOrderId: Record<string, OrderPayment[]> = {};

        if (orderRows.length > 0) {
          const orderIds = orderRows.map((r) => r.id);

          // Fetch items
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

          // Fetch payments from public.payments
          try {
            const { data: payRows } = await supabase
              .from('payments')
              .select('*')
              .in('order_id', orderIds)
              .order('payment_date', { ascending: true });

            if (Array.isArray(payRows)) {
              payRows.forEach((p) => {
                if (!paymentsByOrderId[p.order_id]) paymentsByOrderId[p.order_id] = [];
                paymentsByOrderId[p.order_id].push({
                  id: p.id,
                  orderId: p.order_id,
                  amount: Number(p.amount) || 0,
                  date: (p.payment_date || '').split('T')[0] || p.payment_date,
                  method: p.payment_method || 'UPI',
                  note: p.notes || undefined,
                });
              });
            }
          } catch (payErr) {
            console.warn('[orderService] Failed to load payments in sync:', payErr);
          }
        }

        const localOrders = this.getAll();
        const localMap = new Map(localOrders.map((o) => [o.orderNumber || o.id, o]));

        const mappedOrders: Order[] = orderRows.map((row) => {
          const ord = mapRowToOrder(row);
          const dbItems = itemsByOrderId[ord.id] || (ord.orderNumber ? itemsByOrderId[ord.orderNumber] : null);
          const localMatch = localMap.get(ord.orderNumber || ord.id);
          ord.items = (dbItems && dbItems.length > 0) ? dbItems : (localMatch?.items || []);

          // Map payments directly from Supabase public.payments
          const dbPayments = paymentsByOrderId[ord.id] || (ord.orderNumber ? paymentsByOrderId[ord.orderNumber] : null);
          const payments = (dbPayments && dbPayments.length > 0) ? dbPayments : (localMatch?.payments || []);
          ord.payments = payments;

          const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const totalAmt = Number(ord.totalAmount) || 0;
          ord.advanceAmount = totalPaid;
          ord.balancePaid = Math.max(0, totalAmt - totalPaid);
          ord.paymentStatus = totalPaid <= 0 ? 'Unpaid' : (totalPaid >= totalAmt && totalAmt > 0) ? 'Paid' : 'Partial';

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
      const totalPaid = updatedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const total = Number(order.totalAmount) || 0;
      const balanceDue = Math.max(0, total - totalPaid);
      const paymentStatus: PaymentStatus =
        totalPaid <= 0 ? 'Unpaid' : (totalPaid >= total && total > 0) ? 'Paid' : 'Partial';

      const updateData: Record<string, any> = {
        customer_name: order.customerName,
        phone: order.mobile,
        delivery_date: order.orderDate,
        guest_count: order.guestCount,
        order_status: order.status,
        total_amount: order.totalAmount,
        advance_amount: totalPaid,
        balance_amount: balanceDue,
        payment_status: paymentStatus,
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

  async resolveOrderUuid(orderId: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (isUuid) return orderId;

    const local = this.getById(orderId);
    if (local && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(local.id)) {
      return local.id;
    }

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderId)
        .maybeSingle();

      if (data?.id) return data.id;
    }

    return orderId;
  },

  /**
   * Fetches all payments for a specific order from Supabase public.payments
   */
  async getPaymentsForOrder(orderId: string): Promise<OrderPayment[]> {
    if (!isSupabaseConfigured) {
      const order = this.getById(orderId);
      return order ? normalizeOrderPayments(order) : [];
    }

    try {
      const orderUuid = await this.resolveOrderUuid(orderId);
      const { data: rows, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderUuid)
        .order('payment_date', { ascending: true });

      if (error) {
        console.warn('[orderService] getPaymentsForOrder warning:', error.message);
        const order = this.getById(orderId);
        return order ? normalizeOrderPayments(order) : [];
      }

      if (Array.isArray(rows)) {
        const payments: OrderPayment[] = rows.map((p) => ({
          id: p.id,
          orderId: p.order_id,
          amount: Number(p.amount) || 0,
          date: (p.payment_date || '').split('T')[0] || p.payment_date,
          method: p.payment_method || 'UPI',
          note: p.notes || undefined,
        }));

        // Keep local cache synchronized
        const all = this.getAll();
        const idx = all.findIndex((o) => o.id === orderId || o.orderNumber === orderId || o.id === orderUuid);
        if (idx !== -1) {
          all[idx].payments = payments;
          const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
          const total = Number(all[idx].totalAmount) || 0;
          all[idx].advanceAmount = totalPaid;
          all[idx].balancePaid = Math.max(0, total - totalPaid);
          all[idx].paymentStatus = totalPaid <= 0 ? 'Unpaid' : (totalPaid >= total && total > 0) ? 'Paid' : 'Partial';
          localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
        }

        return payments;
      }
    } catch (err) {
      console.warn('[orderService] getPaymentsForOrder exception:', err);
    }

    const order = this.getById(orderId);
    return order ? normalizeOrderPayments(order) : [];
  },

  /**
   * Adds a payment into public.payments, recalculates totals, and updates public.orders
   */
  async addPayment(
    orderId: string,
    payment: Omit<OrderPayment, 'id'>,
    currentTotalAmount?: number
  ): Promise<{ order: Order; payments: OrderPayment[]; payment: OrderPayment }> {
    const amt = Number(payment.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Payment amount must be greater than ₹0.');
    }
    if (!payment.date) {
      throw new Error('Payment date is required.');
    }
    if (!payment.method) {
      throw new Error('Payment method is required.');
    }

    const orderUuid = await this.resolveOrderUuid(orderId);
    let newPaymentId: string | undefined;
    let rpcDone = false;

    if (isSupabaseConfigured) {
      // 1. Attempt PostgreSQL atomic RPC function
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_order_payment', {
          p_order_id: orderUuid,
          p_amount: amt,
          p_payment_method: payment.method,
          p_payment_date: `${payment.date}T00:00:00.000Z`,
          p_notes: payment.note?.trim() || null,
        });

        if (!rpcErr && rpcRes && rpcRes.payment_id) {
          newPaymentId = rpcRes.payment_id;
          rpcDone = true;
        }
      } catch {
        rpcDone = false;
      }

      // 2. Direct transactional insert if RPC is not present
      if (!rpcDone) {
        const { data: insRows, error: insErr } = await supabase
          .from('payments')
          .insert({
            order_id: orderUuid,
            amount: amt,
            payment_method: payment.method,
            payment_date: `${payment.date}T00:00:00.000Z`,
            notes: payment.note?.trim() || null,
          })
          .select();

        if (insErr) {
          console.error('[orderService] Failed to insert payment into public.payments:', insErr);
          throw new Error(`Failed to save payment to Supabase (${insErr.code || 'DB_ERROR'}): ${insErr.message}`);
        }

        if (!insRows || insRows.length === 0) {
          throw new Error('Supabase did not return the inserted payment record.');
        }

        newPaymentId = insRows[0].id;
      }
    }

    // 3. Fetch all confirmed payments from Supabase
    const freshPayments = await this.getPaymentsForOrder(orderUuid);
    const totalPaid = freshPayments.reduce((s, p) => s + p.amount, 0);

    const order = this.getById(orderId) || this.getById(orderUuid);
    const totalAmt = currentTotalAmount !== undefined
      ? currentTotalAmount
      : (order ? Number(order.totalAmount) : 0);
    const balanceDue = Math.max(0, totalAmt - totalPaid);
    const paymentStatus: PaymentStatus =
      totalPaid <= 0 ? 'Unpaid' : (totalPaid >= totalAmt && totalAmt > 0) ? 'Paid' : 'Partial';

    // 4. Update order totals in public.orders
    if (isSupabaseConfigured) {
      await supabase
        .from('orders')
        .update({
          total_amount: totalAmt,
          advance_amount: totalPaid,
          balance_amount: balanceDue,
          payment_status: paymentStatus,
        })
        .eq('id', orderUuid);
    }

    // 5. Update local cache
    const all = this.getAll();
    const idx = all.findIndex((o) => o.id === orderId || o.orderNumber === orderId || o.id === orderUuid);
    let updatedOrder: Order;
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        payments: freshPayments,
        paymentStatus,
      };
      updatedOrder = all[idx];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
    } else {
      updatedOrder = {
        ...order!,
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        payments: freshPayments,
        paymentStatus,
      };
    }

    const createdPayment = freshPayments.find((p) => p.id === newPaymentId) || {
      id: newPaymentId || `pay-${Date.now()}`,
      orderId: orderUuid,
      amount: amt,
      date: payment.date,
      method: payment.method,
      note: payment.note,
    };

    return { order: updatedOrder, payments: freshPayments, payment: createdPayment };
  },

  /**
   * Updates an existing payment in public.payments and recalculates order totals
   */
  async updatePayment(
    orderId: string,
    paymentId: string,
    changes: Partial<OrderPayment>,
    currentTotalAmount?: number
  ): Promise<{ order: Order; payments: OrderPayment[] }> {
    const orderUuid = await this.resolveOrderUuid(orderId);

    if (isSupabaseConfigured) {
      const updateData: Record<string, any> = {};
      if (changes.amount !== undefined) {
        const amt = Number(changes.amount);
        if (isNaN(amt) || amt <= 0) throw new Error('Payment amount must be greater than ₹0.');
        updateData.amount = amt;
      }
      if (changes.method !== undefined) updateData.payment_method = changes.method;
      if (changes.date !== undefined) updateData.payment_date = `${changes.date}T00:00:00.000Z`;
      if (changes.note !== undefined) updateData.notes = changes.note?.trim() || null;

      const { error: updErr } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId);

      if (updErr) {
        throw new Error(`Failed to update payment in Supabase: ${updErr.message}`);
      }
    }

    const freshPayments = await this.getPaymentsForOrder(orderUuid);
    const totalPaid = freshPayments.reduce((s, p) => s + p.amount, 0);

    const order = this.getById(orderId) || this.getById(orderUuid);
    const totalAmt = currentTotalAmount !== undefined
      ? currentTotalAmount
      : (order ? Number(order.totalAmount) : 0);
    const balanceDue = Math.max(0, totalAmt - totalPaid);
    const paymentStatus: PaymentStatus =
      totalPaid <= 0 ? 'Unpaid' : (totalPaid >= totalAmt && totalAmt > 0) ? 'Paid' : 'Partial';

    if (isSupabaseConfigured) {
      await supabase
        .from('orders')
        .update({
          total_amount: totalAmt,
          advance_amount: totalPaid,
          balance_amount: balanceDue,
          payment_status: paymentStatus,
        })
        .eq('id', orderUuid);
    }

    const all = this.getAll();
    const idx = all.findIndex((o) => o.id === orderId || o.orderNumber === orderId || o.id === orderUuid);
    let updatedOrder: Order;
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        payments: freshPayments,
        paymentStatus,
      };
      updatedOrder = all[idx];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
    } else {
      updatedOrder = order!;
    }

    return { order: updatedOrder, payments: freshPayments };
  },

  /**
   * Deletes a payment record from public.payments and updates order totals
   */
  async deletePayment(
    orderId: string,
    paymentId: string,
    currentTotalAmount?: number
  ): Promise<{ order: Order; payments: OrderPayment[] }> {
    const orderUuid = await this.resolveOrderUuid(orderId);

    if (isSupabaseConfigured) {
      const { error: delErr } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (delErr) {
        throw new Error(`Failed to delete payment from Supabase: ${delErr.message}`);
      }
    }

    const freshPayments = await this.getPaymentsForOrder(orderUuid);
    const totalPaid = freshPayments.reduce((s, p) => s + p.amount, 0);

    const order = this.getById(orderId) || this.getById(orderUuid);
    const totalAmt = currentTotalAmount !== undefined
      ? currentTotalAmount
      : (order ? Number(order.totalAmount) : 0);
    const balanceDue = Math.max(0, totalAmt - totalPaid);
    const paymentStatus: PaymentStatus =
      totalPaid <= 0 ? 'Unpaid' : (totalPaid >= totalAmt && totalAmt > 0) ? 'Paid' : 'Partial';

    if (isSupabaseConfigured) {
      await supabase
        .from('orders')
        .update({
          total_amount: totalAmt,
          advance_amount: totalPaid,
          balance_amount: balanceDue,
          payment_status: paymentStatus,
        })
        .eq('id', orderUuid);
    }

    const all = this.getAll();
    const idx = all.findIndex((o) => o.id === orderId || o.orderNumber === orderId || o.id === orderUuid);
    let updatedOrder: Order;
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        payments: freshPayments,
        paymentStatus,
      };
      updatedOrder = all[idx];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
    } else {
      updatedOrder = order!;
    }

    return { order: updatedOrder, payments: freshPayments };
  },

  /**
   * Updates Total Amount and order details in Supabase, recalculating balance & payment_status
   * while strictly preserving all existing payment history records
   */
  async updateOrderTotalAndDetails(
    orderId: string,
    data: {
      totalAmount: number;
      status?: OrderStatus;
      notes?: string;
      adminNotes?: string;
    }
  ): Promise<Order> {
    const totalAmt = Number(data.totalAmount);
    if (isNaN(totalAmt) || totalAmt < 0) {
      throw new Error('Total amount must be a positive number.');
    }

    const orderUuid = await this.resolveOrderUuid(orderId);

    // Fetch existing payment history to recalculate balance & status correctly without touching payments table
    const freshPayments = await this.getPaymentsForOrder(orderUuid);
    const totalPaid = freshPayments.reduce((s, p) => s + p.amount, 0);
    const balanceDue = Math.max(0, totalAmt - totalPaid);
    const paymentStatus: PaymentStatus =
      totalPaid <= 0 ? 'Unpaid' : (totalPaid >= totalAmt && totalAmt > 0) ? 'Paid' : 'Partial';

    const order = this.getById(orderId) || this.getById(orderUuid);
    const combinedNotes = `[Address: ${order?.eventAddress || 'Not specified'}] [Event: ${order?.eventType || 'Catering'}] [Source: ${order?.orderSource || 'Website'}] ${data.notes || ''}`.trim();

    if (isSupabaseConfigured) {
      const updatePayload: Record<string, any> = {
        total_amount: totalAmt,
        advance_amount: totalPaid,
        balance_amount: balanceDue,
        payment_status: paymentStatus,
      };
      if (data.status) {
        updatePayload.order_status = data.status;
      }
      if (data.notes !== undefined) {
        updatePayload.notes = combinedNotes;
      }

      const { error: updErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderUuid);

      if (updErr) {
        throw new Error(`Failed to update order in Supabase: ${updErr.message}`);
      }
    }

    // Update in local cache
    const all = this.getAll();
    const idx = all.findIndex((o) => o.id === orderId || o.orderNumber === orderId || o.id === orderUuid);
    let updatedOrder: Order;
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        paymentStatus,
        payments: freshPayments,
        status: data.status ?? all[idx].status,
        notes: data.notes ?? all[idx].notes,
        adminNotes: data.adminNotes ?? all[idx].adminNotes,
      };
      updatedOrder = all[idx];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
    } else {
      updatedOrder = {
        id: orderUuid,
        orderNumber: order?.orderNumber || orderId,
        customerName: order?.customerName || 'Customer',
        mobile: order?.mobile || '',
        eventAddress: order?.eventAddress || '',
        orderDate: order?.orderDate || new Date().toISOString().split('T')[0],
        totalAmount: totalAmt,
        advanceAmount: totalPaid,
        balancePaid: balanceDue,
        payments: freshPayments,
        paymentStatus,
        status: data.status || order?.status || 'Pending',
        items: order?.items || [],
        notes: data.notes ?? order?.notes ?? '',
        adminNotes: data.adminNotes ?? order?.adminNotes,
        guestCount: order?.guestCount || null,
        invoiceGenerated: false,
        createdAt: order?.createdAt || new Date().toISOString(),
      };
    }

    return updatedOrder;
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
        await supabase.from('payments').delete().eq('order_id', id);
        await supabase.from('order_items').delete().eq('order_id', id);
        await supabase.from('orders').delete().eq('id', id);
      } else {
        const { data } = await supabase.from('orders').select('id').eq('order_number', id).maybeSingle();
        if (data && data.id) {
          await supabase.from('payments').delete().eq('order_id', data.id);
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
