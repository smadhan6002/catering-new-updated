/**
 * messageService — Handles customer website inquiries & messages
 * Synchronized with Supabase `customer_messages` table and local fallback.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CustomerMessage {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  message: string;
  status: 'New' | 'Contacted' | 'Closed';
  isRead: boolean;
  createdAt: string;
}

const MESSAGES_KEY = 'catering_customer_messages';

export const messageService = {
  /**
   * Synchronize messages from Supabase
   */
  async syncFromSupabase(): Promise<CustomerMessage[]> {
    if (!isSupabaseConfigured) return this.getAll();

    try {
      const { data, error } = await supabase
        .from('customer_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Customer messages sync error:', error.message);
        return this.getAll();
      }

      if (Array.isArray(data)) {
        const mapped: CustomerMessage[] = data.map((m) => ({
          id: m.id,
          customerName: m.customer_name,
          phone: m.phone,
          email: m.email || undefined,
          eventType: m.event_type || undefined,
          eventDate: m.event_date || undefined,
          guestCount: m.guest_count ?? undefined,
          message: m.message,
          status: m.status || 'New',
          isRead: Boolean(m.is_read),
          createdAt: m.created_at,
        }));
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Messages sync error:', err);
    }
    return this.getAll();
  },

  getAll(): CustomerMessage[] {
    try {
      return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]') as CustomerMessage[];
    } catch {
      return [];
    }
  },

  getUnreadCount(): number {
    return this.getAll().filter((m) => !m.isRead).length;
  },

  submitMessage(data: Omit<CustomerMessage, 'id' | 'createdAt' | 'status' | 'isRead'>): CustomerMessage {
    const list = this.getAll();
    const newMessage: CustomerMessage = {
      ...data,
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'New',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    list.unshift(newMessage);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      supabase.from('customer_messages').insert({
        id: newMessage.id,
        customer_name: newMessage.customerName,
        phone: newMessage.phone,
        email: newMessage.email || null,
        event_type: newMessage.eventType || null,
        event_date: newMessage.eventDate || null,
        guest_count: newMessage.guestCount || null,
        message: newMessage.message,
        status: newMessage.status,
        is_read: newMessage.isRead,
        created_at: newMessage.createdAt,
      }).then(() => {}, () => {});
    }

    return newMessage;
  },

  updateStatus(id: string, status: CustomerMessage['status']): void {
    const list = this.getAll();
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

      if (isSupabaseConfigured) {
        supabase.from('customer_messages').update({ status, is_read: true }).eq('id', id).then(() => {}, () => {});
      }
    }
  },

  markAsRead(id: string): void {
    const list = this.getAll();
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

      if (isSupabaseConfigured) {
        supabase.from('customer_messages').update({ is_read: true }).eq('id', id).then(() => {}, () => {});
      }
    }
  },

  deleteMessage(id: string): void {
    const list = this.getAll().filter((m) => m.id !== id);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      supabase.from('customer_messages').delete().eq('id', id).then(() => {}, () => {});
    }
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    messageService.syncFromSupabase().catch(() => {});
  }, 2600);
}
