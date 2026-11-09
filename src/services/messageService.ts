/**
 * messageService — Handles customer website inquiries & messages
 * Synchronized with Supabase `customer_messages` table and local fallback.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
        const mapped: CustomerMessage[] = data.map((m) => {
          let eventType = m.event_type;
          let eventDate = m.event_date;
          let guestCount = m.guest_count;
          let cleanMessage = m.message || '';

          // Check if metadata was packed into message header [Wedding | 2026-12-10 | 400 Guests]
          if (cleanMessage.startsWith('[')) {
            const match = cleanMessage.match(/^\[(.*?)\]\s*(.*)$/s);
            if (match) {
              const parts = match[1].split('|').map((s: string) => s.trim());
              if (!eventType && parts[0]) eventType = parts[0];
              if (!eventDate && parts[1]) eventDate = parts[1];
              if (guestCount == null && parts[2]) {
                const countNum = parseInt(parts[2].replace(/\D/g, ''), 10);
                if (!isNaN(countNum)) guestCount = countNum;
              }
              cleanMessage = match[2];
            }
          }

          return {
            id: m.id,
            customerName: m.customer_name || m.name || '',
            phone: m.phone || m.mobile || '',
            email: m.email || undefined,
            eventType: eventType || undefined,
            eventDate: eventDate || undefined,
            guestCount: guestCount != null ? Number(guestCount) : undefined,
            message: cleanMessage,
            status: (m.status as CustomerMessage['status']) || 'New',
            isRead: Boolean(m.is_read || m.status === 'Contacted' || m.status === 'Closed'),
            createdAt: m.created_at || new Date().toISOString(),
          };
        });

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

  async submitMessage(
    data: Omit<CustomerMessage, 'id' | 'createdAt' | 'status' | 'isRead'>
  ): Promise<CustomerMessage> {
    const list = this.getAll();
    const id = generateUUID();
    const now = new Date().toISOString();

    const newMessage: CustomerMessage = {
      ...data,
      id,
      status: 'New',
      isRead: false,
      createdAt: now,
    };

    list.unshift(newMessage);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

    if (isSupabaseConfigured) {
      // Pack event metadata if eventType is present
      let messagePayload = data.message.trim();
      if (data.eventType || data.eventDate || data.guestCount) {
        const metaPrefix = `[${data.eventType || 'Event'} | ${data.eventDate || 'Date TBD'} | ${data.guestCount || 0} Guests]`;
        messagePayload = `${metaPrefix} ${messagePayload}`.trim();
      }

      const { error } = await supabase.from('customer_messages').insert({
        id,
        customer_name: data.customerName.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        message: messagePayload,
        status: 'New',
      });

      if (error) {
        console.error('Failed to submit message to Supabase:', error);
        throw new Error(error.message);
      }
    }

    return newMessage;
  },

  async updateStatus(id: string, status: CustomerMessage['status']): Promise<void> {
    const list = this.getAll();
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

      if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
        await supabase.from('customer_messages').update({ status }).eq('id', id);
      }
    }
  },

  async markAsRead(id: string): Promise<void> {
    const list = this.getAll();
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

      if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
        await supabase.from('customer_messages').update({ status: 'Contacted' }).eq('id', id);
      }
    }
  },

  async deleteMessage(id: string): Promise<void> {
    const list = this.getAll().filter((m) => m.id !== id);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));

    if (isSupabaseConfigured && id.length >= 32 && id.includes('-')) {
      await supabase.from('customer_messages').delete().eq('id', id);
    }
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    messageService.syncFromSupabase().catch(() => {});
  }, 1400);
}
