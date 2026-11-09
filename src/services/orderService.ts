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
  customer_id?: string | null;
  customer_name: string;
  mobile: string;
  alternative_mobile?: string | null;
  order_source?: string | null;
  event_address: string;
  event_type?: string | null;
  order_date: string;
  delivery_time?: string | null;
  guest_count?: number | null;
  food_quantities?: unknown;
  total_amount?: number | null;
  advance_amount?: number | null;
  balance_paid?: number | null;
  payments?: unknown;
  status?: string | null;
  kitchen_sheet_status?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  invoice_generated?: boolean | null;
  created_at?: string;
}

function mapRowToOrder(row: SupabaseOrderRow): Order {
  const payments = Array.isArray(row.payments) ? (row.payments as OrderPayment[]) : [];
  return {
    id: row.id,
    customerId: row.customer_id || undefined,
    customerName: row.customer_name,
    mobile: row.mobile,
    alternativeMobile: row.alternative_mobile || undefined,
    orderSource: (row.order_source as Order['orderSource']) || 'Website',
    eventAddress: row.event_address || '',
    eventType: row.event_type || undefined,
    orderDate: row.order_date,
    deliveryTime: row.delivery_time || undefined,
    guestCount: row.guest_count ?? null,
    items: [], // Will be filled from items or local snapshot
    foodQuantities: Array.isArray(row.food_quantities) ? row.food_quantities : undefined,
    totalAmount: Number(row.total_amount) || 0,
    advanceAmount: Number(row.advance_amount) || 0,
    balancePaid: Number(row.balance_paid) || 0,
    payments,
    status: (row.status as OrderStatus) || 'Pending',
    kitchenSheetStatus: (row.kitchen_sheet_status as Order['kitchenSheetStatus']) || 'Not Prepared',
    notes: row.notes || '',
    adminNotes: row.admin_notes || undefined,
    invoice_generated: Boolean(row.invoice_generated),
    invoiceGenerated: Boolean(row.invoice_generated),
    createdAt: row.created_at || new Date().toISOString(),
  } as Order;
}

function mapOrderToRow(order: Order): SupabaseOrderRow {
  return {
    id: order.id,
    customer_id: order.customerId || null,
    customer_name: order.customerName,
    mobile: order.mobile,
    alternative_mobile: order.alternativeMobile || null,
    order_source: order.orderSource || 'Website',
    event_address: order.eventAddress,
    event_type: order.eventType || null,
    order_date: order.orderDate,
    delivery_time: order.deliveryTime || null,
    guest_count: order.guestCount,
    food_quantities: order.foodQuantities || [],
    total_amount: order.totalAmount,
    advance_amount: order.advanceAmount,
    balance_paid: order.balancePaid,
    payments: order.payments || [],
    status: order.status,
    kitchen_sheet_status: order.kitchenSheetStatus || 'Not Prepared',
    notes: order.notes,
    admin_notes: order.adminNotes || null,
    invoice_generated: order.invoiceGenerated,
    created_at: order.createdAt,
  };
}

export const orderService = {
  /**
   * Synchronizes orders and items from Supabase
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

      if (Array.isArray(orderRows) && orderRows.length > 0) {
        // Fetch order items in batch
        const orderIds = orderRows.map((r) => r.id);
        const { data: itemRows } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        const itemsByOrderId: Record<string, Order['items']> = {};
        if (Array.isArray(itemRows)) {
          itemRows.forEach((it) => {
            if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
            itemsByOrderId[it.order_id].push({
              dishId: it.dish_id,
              dishName: it.dish_name,
              categoryId: it.category_id,
              quantity: it.quantity,
              unit: it.unit,
              notes: it.notes,
            });
          });
        }

        const localOrders = this.getAll();
        const localMap = new Map(localOrders.map((o) => [o.id, o]));

        const mappedOrders: Order[] = orderRows.map((row) => {
          const ord = mapRowToOrder(row);
          const dbItems = itemsByOrderId[ord.id];
          const localMatch = localMap.get(ord.id);
          ord.items = (dbItems && dbItems.length > 0) ? dbItems : (localMatch?.items || []);
          return ord;
        });

        // Merge mapped with local
        mappedOrders.forEach((o) => localMap.set(o.id, o));
        const merged = Array.from(localMap.values());
        localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
        return merged;
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
    return this.getAll().find((o) => o.id === id);
  },

  create(data: Omit<Order, 'id' | 'createdAt' | 'invoiceGenerated'>): Order {
    const orders = this.getAll();
    const payments = data.payments ? [...data.payments] : [];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const order: Order = {
      ...data,
      id: generateOrderId(orders),
      orderSource: data.orderSource || 'Website',
      createdAt: new Date().toISOString(),
      invoiceGenerated: false,
      payments,
      advanceAmount: payments[0]?.amount ?? data.advanceAmount ?? 0,
      balancePaid: data.balancePaid ?? (totalPaid > (payments[0]?.amount ?? 0) ? totalPaid - (payments[0]?.amount ?? 0) : 0),
    };
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    // Asynchronously insert into Supabase
    if (isSupabaseConfigured) {
      const row = mapOrderToRow(order);
      supabase
        .from('orders')
        .insert(row)
        .then(async ({ error: ordErr }) => {
          if (ordErr) {
            console.warn('Supabase order insert error:', ordErr.message);
            return;
          }
          // Insert order items
          if (Array.isArray(order.items) && order.items.length > 0) {
            const itemRows = order.items.map((it) => ({
              order_id: order.id,
              dish_id: it.dishId,
              dish_name: it.dishName,
              category_id: it.categoryId,
              quantity: it.quantity || null,
              unit: it.unit || null,
              notes: it.notes || null,
            }));
            await supabase.from('order_items').insert(itemRows);
          }
          // Insert payments
          if (Array.isArray(order.payments) && order.payments.length > 0) {
            const payRows = order.payments.map((p) => ({
              id: p.id,
              order_id: order.id,
              amount: p.amount,
              date: p.date,
              method: p.method,
              note: p.note || null,
            }));
            await supabase.from('order_payments').insert(payRows);
          }
        },
        (err: unknown) => console.warn('Supabase order create network error:', err)
      );
    }

    return order;
  },

  update(id: string, changes: Partial<Order>): Order | undefined {
    const orders = this.getAll();
    const idx = orders.findIndex((o) => o.id === id);
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

    // Update asynchronously in Supabase
    if (isSupabaseConfigured) {
      const row = mapOrderToRow(orders[idx]);
      supabase
        .from('orders')
        .update(row)
        .eq('id', id)
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase order update error:', error.message);
          },
          (err: unknown) => console.warn('Supabase order update network error:', err)
        );
    }

    return orders[idx];
  },

  updateStatus(id: string, status: OrderStatus): Order | undefined {
    return this.update(id, { status });
  },

  updatePayment(
    id: string,
    totalAmount: number,
    advanceAmount: number,
    balancePaid: number
  ): Order | undefined {
    return this.update(id, { totalAmount, advanceAmount, balancePaid });
  },

  addPayment(
    orderId: string,
    payment: Omit<OrderPayment, 'id'>
  ): Order | undefined {
    const order = this.getById(orderId);
    if (!order) return undefined;
    const currentPayments = normalizeOrderPayments(order);
    const newPayment: OrderPayment = {
      ...payment,
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount: Number(payment.amount) || 0,
    };
    const updatedPayments = [...currentPayments, newPayment];

    // Save payment to order_payments table in Supabase
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
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase insert payment error:', error.message);
          },
          () => {}
        );
    }

    return this.update(orderId, { payments: updatedPayments });
  },

  updatePaymentEntry(
    orderId: string,
    paymentId: string,
    changes: Partial<OrderPayment>
  ): Order | undefined {
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

  deletePaymentEntry(
    orderId: string,
    paymentId: string
  ): Order | undefined {
    const order = this.getById(orderId);
    if (!order) return undefined;
    const currentPayments = normalizeOrderPayments(order);
    const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);

    if (isSupabaseConfigured) {
      supabase.from('order_payments').delete().eq('id', paymentId).then(() => {}, () => {});
    }

    return this.update(orderId, { payments: updatedPayments });
  },

  markInvoiceGenerated(id: string): Order | undefined {
    return this.update(id, { invoiceGenerated: true });
  },

  delete(id: string): void {
    const orders = this.getAll().filter((o) => o.id !== id);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    if (isSupabaseConfigured) {
      supabase
        .from('orders')
        .delete()
        .eq('id', id)
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase order delete error:', error.message);
          },
          (err: unknown) => console.warn('Supabase order delete network error:', err)
        );
    }
  },
};

// Background initial sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    orderService.syncFromSupabase().catch(() => {});
  }, 1200);
}
