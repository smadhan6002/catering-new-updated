import type { CustomerLead, DiscussionEntry, LeadStatus } from '../types/lead';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const LEADS_STORAGE_KEY = 'catering_customer_leads';

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

function mapRowToLead(row: any, discussions: DiscussionEntry[] = []): CustomerLead {
  // Extract leadNumber from notes if stored there as [LEAD-xxx]
  let leadNum = row.lead_number;
  let notesClean = row.notes || row.additional_notes || '';
  if (!leadNum && notesClean.includes('[LEAD-')) {
    const match = notesClean.match(/\[(LEAD-\d+)\]/i);
    if (match) {
      leadNum = match[1];
      notesClean = notesClean.replace(/\[LEAD-\d+\]\s*/i, '');
    }
  }

  return {
    id: row.id,
    leadNumber: leadNum || `LEAD-${row.id.substring(0, 4).toUpperCase()}`,
    customerName: row.name || row.customer_name || '',
    mobile: row.phone || row.mobile || '',
    alternativeMobile: row.alternate_phone || row.alternative_mobile || undefined,
    eventType: row.event_type || undefined,
    eventDate: row.event_date || undefined,
    expectedGuestCount: row.guest_count != null ? Number(row.guest_count) : (row.expected_guest_count != null ? Number(row.expected_guest_count) : undefined),
    customerRequirement: row.requirements || row.customer_requirement || undefined,
    discussionDetails: row.discussion_details || '',
    followUpDate: row.follow_up_date || undefined,
    followUpTime: row.follow_up_time || undefined,
    status: (row.status as LeadStatus) || 'New',
    additionalNotes: notesClean || undefined,
    convertedToOrderId: row.converted_to_order_id || undefined,
    discussions,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export const leadService = {
  /**
   * Sync leads and discussion history from Supabase
   */
  async syncFromSupabase(): Promise<CustomerLead[]> {
    if (!isSupabaseConfigured) return this.getAll();

    try {
      const { data: leadRows, error: leadErr } = await supabase
        .from('customer_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadErr) {
        console.warn('Failed to sync leads from Supabase:', leadErr.message);
        return this.getAll();
      }

      if (Array.isArray(leadRows) && leadRows.length > 0) {
        // Fetch discussion activities
        const leadIds = leadRows.map((r) => r.id);
        const { data: actRows } = await supabase
          .from('lead_activities')
          .select('*')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false });

        const discByLeadId: Record<string, DiscussionEntry[]> = {};
        if (Array.isArray(actRows)) {
          actRows.forEach((act) => {
            if (!discByLeadId[act.lead_id]) discByLeadId[act.lead_id] = [];
            discByLeadId[act.lead_id].push({
              id: act.id,
              date: act.date || (act.created_at ? act.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
              time: act.time || '',
              discussionDetails: act.activity || act.discussion_details || '',
              customerRequirement: act.notes || act.customer_requirement || undefined,
              agreedNextAction: act.agreed_next_action || undefined,
              nextFollowUpDate: act.next_follow_up || act.next_follow_up_date || undefined,
              createdAt: act.created_at || new Date().toISOString(),
            });
          });
        }

        const mappedLeads: CustomerLead[] = leadRows.map((row) => {
          const discs = discByLeadId[row.id] || [];
          return mapRowToLead(row, discs);
        });

        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(mappedLeads));
        return mappedLeads;
      } else {
        // Table exists but is empty
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify([]));
        return [];
      }
    } catch (err) {
      console.warn('Leads sync error:', err);
    }
    return this.getAll();
  },

  getAll(): CustomerLead[] {
    try {
      const stored = localStorage.getItem(LEADS_STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as CustomerLead[];
    } catch (err) {
      console.error('Failed to parse customer leads:', err);
      return [];
    }
  },

  getById(id: string): CustomerLead | undefined {
    return this.getAll().find((l) => l.id === id);
  },

  generateLeadNumber(): string {
    const leads = this.getAll();
    let max = 100;
    leads.forEach((l) => {
      const match = l.leadNumber?.match(/LEAD-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    return `LEAD-${max + 1}`;
  },

  /**
   * Save (insert or update) lead in Supabase and local cache
   */
  async saveLead(
    leadData: Omit<CustomerLead, 'id' | 'leadNumber' | 'createdAt' | 'updatedAt' | 'discussions'> & {
      id?: string;
      leadNumber?: string;
      discussions?: DiscussionEntry[];
    }
  ): Promise<CustomerLead> {
    const leads = this.getAll();
    const now = new Date().toISOString();
    const isEdit = Boolean(leadData.id);

    const leadId = (leadData.id && leadData.id.includes('-') && leadData.id.length >= 32)
      ? leadData.id
      : generateUUID();
    const leadNumber = leadData.leadNumber || this.generateLeadNumber();

    // Notes packed with lead number tag so it's always preserved even if lead_number column isn't migrated
    const packedNotes = `[${leadNumber}] ${leadData.additionalNotes || ''}`.trim();

    // Supabase row payload
    const baseRow: Record<string, any> = {
      id: leadId,
      name: leadData.customerName,
      phone: leadData.mobile,
      alternate_phone: leadData.alternativeMobile || null,
      event_type: leadData.eventType || null,
      event_date: leadData.eventDate || null,
      guest_count: leadData.expectedGuestCount || null,
      requirements: leadData.customerRequirement || null,
      discussion_details: leadData.discussionDetails || '',
      follow_up_date: leadData.followUpDate || null,
      status: leadData.status || 'New',
      notes: packedNotes || null,
    };

    if (isSupabaseConfigured) {
      // Try base row upsert
      const { error: upsertErr } = await supabase
        .from('customer_leads')
        .upsert(baseRow, { onConflict: 'id' });

      if (upsertErr) {
        console.error('Failed to save lead to Supabase:', upsertErr);
        throw new Error(upsertErr.message);
      }
    }

    if (isEdit) {
      const existingIdx = leads.findIndex((l) => l.id === leadId);
      const existing = existingIdx !== -1 ? leads[existingIdx] : null;
      const updated: CustomerLead = {
        ...existing,
        ...leadData,
        id: leadId,
        leadNumber,
        discussions: leadData.discussions || existing?.discussions || [],
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      if (existingIdx !== -1) {
        leads[existingIdx] = updated;
      } else {
        leads.unshift(updated);
      }
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
      return updated;
    }

    // New Lead
    const initialDiscussions: DiscussionEntry[] = [];
    if (leadData.discussionDetails && leadData.discussionDetails.trim()) {
      const discId = generateUUID();
      const discEntry: DiscussionEntry = {
        id: discId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        discussionDetails: leadData.discussionDetails.trim(),
        customerRequirement: leadData.customerRequirement?.trim() || undefined,
        agreedNextAction: leadData.followUpDate ? `Follow up on ${leadData.followUpDate}` : undefined,
        nextFollowUpDate: leadData.followUpDate || undefined,
        createdAt: now,
      };
      initialDiscussions.push(discEntry);

      if (isSupabaseConfigured) {
        await supabase.from('lead_activities').insert({
          id: discId,
          lead_id: leadId,
          activity: discEntry.discussionDetails,
          notes: discEntry.customerRequirement || null,
          next_follow_up: discEntry.nextFollowUpDate || null,
          created_at: now,
        });
      }
    }

    const newLead: CustomerLead = {
      ...leadData,
      id: leadId,
      leadNumber,
      discussions: initialDiscussions,
      createdAt: now,
      updatedAt: now,
    };

    leads.unshift(newLead);
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return newLead;
  },

  /**
   * Add a new discussion record to a lead in Supabase
   */
  async addDiscussion(
    leadId: string,
    entry: Omit<DiscussionEntry, 'id' | 'createdAt'>,
    newStatus?: LeadStatus
  ): Promise<CustomerLead | null> {
    const leads = this.getAll();
    const idx = leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const now = new Date().toISOString();
    const discId = generateUUID();

    const newDiscEntry: DiscussionEntry = {
      ...entry,
      id: discId,
      createdAt: now,
    };

    const updatedDiscussions = [newDiscEntry, ...(lead.discussions || [])];
    const updatedLead: CustomerLead = {
      ...lead,
      discussions: updatedDiscussions,
      discussionDetails: entry.discussionDetails,
      customerRequirement: entry.customerRequirement || lead.customerRequirement,
      followUpDate: entry.nextFollowUpDate || lead.followUpDate,
      status: newStatus || (entry.nextFollowUpDate ? 'Follow-up Required' : lead.status),
      updatedAt: now,
    };

    if (isSupabaseConfigured) {
      // Insert into lead_activities
      const { error: actErr } = await supabase.from('lead_activities').insert({
        id: discId,
        lead_id: leadId,
        activity: entry.discussionDetails,
        notes: entry.customerRequirement || null,
        next_follow_up: entry.nextFollowUpDate || null,
        created_at: now,
      });
      if (actErr) console.warn('Supabase lead_activities insert failed:', actErr.message);

      // Update customer_leads
      const { error: leadErr } = await supabase.from('customer_leads').update({
        discussion_details: entry.discussionDetails,
        requirements: updatedLead.customerRequirement || null,
        follow_up_date: updatedLead.followUpDate || null,
        status: updatedLead.status,
      }).eq('id', leadId);
      if (leadErr) console.warn('Supabase customer_leads update failed:', leadErr.message);
    }

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  /**
   * Update follow-up schedule in Supabase
   */
  async updateFollowUp(
    leadId: string,
    followUpDate: string,
    followUpTime?: string,
    status?: LeadStatus
  ): Promise<CustomerLead | null> {
    const leads = this.getAll();
    const idx = leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const updatedLead: CustomerLead = {
      ...lead,
      followUpDate,
      followUpTime: followUpTime ?? lead.followUpTime,
      status: status ?? (followUpDate ? 'Follow-up Required' : lead.status),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('customer_leads').update({
        follow_up_date: followUpDate,
        status: updatedLead.status,
      }).eq('id', leadId);
      if (error) console.error('Failed to update follow-up in Supabase:', error);
    }

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  /**
   * Mark follow up completed
   */
  async markFollowUpCompleted(leadId: string, note = 'Follow-up completed'): Promise<CustomerLead | null> {
    const leads = this.getAll();
    const idx = leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const now = new Date().toISOString();
    const discId = generateUUID();

    const completionEntry: DiscussionEntry = {
      id: discId,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      discussionDetails: note,
      agreedNextAction: 'Follow-up marked completed',
      createdAt: now,
    };

    const updatedLead: CustomerLead = {
      ...lead,
      status: lead.status === 'Follow-up Required' ? 'Contacted' : lead.status,
      followUpDate: undefined,
      followUpTime: undefined,
      discussions: [completionEntry, ...(lead.discussions || [])],
      updatedAt: now,
    };

    if (isSupabaseConfigured) {
      await supabase.from('lead_activities').insert({
        id: discId,
        lead_id: leadId,
        activity: note,
        notes: 'Follow-up marked completed',
        created_at: now,
      });

      await supabase.from('customer_leads').update({
        status: updatedLead.status,
        follow_up_date: null,
      }).eq('id', leadId);
    }

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  /**
   * Delete lead from Supabase and cache
   */
  async deleteLead(id: string): Promise<boolean> {
    const leads = this.getAll();
    const filtered = leads.filter((l) => l.id !== id);
    if (filtered.length !== leads.length) {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(filtered));
      if (isSupabaseConfigured) {
        // Delete activities first due to FK
        await supabase.from('lead_activities').delete().eq('lead_id', id);
        const { error } = await supabase.from('customer_leads').delete().eq('id', id);
        if (error) {
          console.error('Failed to delete lead from Supabase:', error);
          return false;
        }
      }
      return true;
    }
    return false;
  },

  getFollowUps(leadList?: CustomerLead[]): {
    today: CustomerLead[];
    upcoming: CustomerLead[];
    overdue: CustomerLead[];
    completed: CustomerLead[];
  } {
    const leads = leadList ?? this.getAll();
    const todayStr = new Date().toISOString().split('T')[0];

    const today: CustomerLead[] = [];
    const upcoming: CustomerLead[] = [];
    const overdue: CustomerLead[] = [];
    const completed: CustomerLead[] = [];

    leads.forEach((l) => {
      if (l.status === 'Confirmed' || l.status === 'Not Interested' || !l.followUpDate) {
        completed.push(l);
        return;
      }

      if (l.followUpDate === todayStr) {
        today.push(l);
      } else if (l.followUpDate < todayStr) {
        overdue.push(l);
      } else {
        upcoming.push(l);
      }
    });

    overdue.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));
    today.sort((a, b) => (a.followUpTime || '').localeCompare(b.followUpTime || ''));
    upcoming.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));

    return { today, upcoming, overdue, completed };
  },
};

// Initial background sync
if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    leadService.syncFromSupabase().catch(() => {});
  }, 1200);
}
