import type { CustomerLead, DiscussionEntry, LeadStatus } from '../types/lead';

const LEADS_STORAGE_KEY = 'catering_customer_leads';

const INITIAL_SAMPLE_LEADS: CustomerLead[] = [
  {
    id: 'lead-1',
    leadNumber: 'LEAD-101',
    customerName: 'Suresh Kumar',
    mobile: '9840123456',
    alternativeMobile: '9840987654',
    eventType: 'Wedding',
    eventDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    expectedGuestCount: 500,
    customerRequirement: 'Traditional South Indian full leaf morning breakfast and grand afternoon feast with 3 payasam varieties.',
    discussionDetails: 'Enquired about wedding package menu, tasted sweet samples, requested tentative price estimate for 500 people.',
    followUpDate: new Date().toISOString().split('T')[0], // Today
    followUpTime: '11:00 AM',
    status: 'Follow-up Required',
    additionalNotes: 'Hall booked near Ekambareswarar Temple, Kanchipuram.',
    discussions: [
      {
        id: 'disc-1',
        date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        time: '10:30 AM',
        discussionDetails: 'Customer called after seeing website menu. Wants quotation for 500 guests wedding feast.',
        customerRequirement: 'Pure vegetarian feast without onion/garlic in main gravy.',
        agreedNextAction: 'Send sample menu brochure and call back to discuss custom dish inclusions.',
        nextFollowUpDate: new Date().toISOString().split('T')[0],
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'lead-2',
    leadNumber: 'LEAD-102',
    customerName: 'Meenakshi Sundaram',
    mobile: '9444112233',
    eventType: 'Birthday Function',
    eventDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    expectedGuestCount: 150,
    customerRequirement: 'Evening tiffin counter with live dosa, mini idli, chaat, and ice cream.',
    discussionDetails: 'Customer liked Live Dosa Counter and North Indian chaat options. Discussed budget of ₹300/plate.',
    followUpDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], // Overdue by 1 day
    followUpTime: '04:00 PM',
    status: 'Interested',
    additionalNotes: 'Prefers mild spice for kids.',
    discussions: [
      {
        id: 'disc-2',
        date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
        time: '04:15 PM',
        discussionDetails: 'Initial WhatsApp chat. Shared tiffin menu PDF.',
        customerRequirement: 'Live dosa counter and fruit salad.',
        agreedNextAction: 'Call customer to confirm finalize menu items.',
        nextFollowUpDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'lead-3',
    leadNumber: 'LEAD-103',
    customerName: 'Raghavan Pillai',
    mobile: '9790887766',
    eventType: 'Engagement',
    eventDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
    expectedGuestCount: 250,
    customerRequirement: 'VIP breakfast with welcome drinks, sweets, and lunch with sweets & ice cream.',
    discussionDetails: 'Customer met in office. Very keen on our catering services, awaiting hall confirmation.',
    followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], // Upcoming
    followUpTime: '10:00 AM',
    status: 'Contacted',
    additionalNotes: 'Referred by past client in Walajabad.',
    discussions: [
      {
        id: 'disc-3',
        date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        time: '11:00 AM',
        discussionDetails: 'First direct enquiry at office. Reviewed album and dish presentations.',
        customerRequirement: 'Breakfast + Lunch for 250 pax.',
        agreedNextAction: 'Follow-up after client confirms mantap reservation.',
        nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export const leadService = {
  getAll(): CustomerLead[] {
    try {
      const stored = localStorage.getItem(LEADS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_LEADS));
        return INITIAL_SAMPLE_LEADS;
      }
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

  saveLead(
    leadData: Omit<CustomerLead, 'id' | 'leadNumber' | 'createdAt' | 'updatedAt' | 'discussions'> & {
      id?: string;
      leadNumber?: string;
      discussions?: DiscussionEntry[];
    }
  ): CustomerLead {
    const leads = this.getAll();
    const now = new Date().toISOString();
    const isEdit = Boolean(leadData.id);

    if (isEdit && leadData.id) {
      const existingIdx = leads.findIndex((l) => l.id === leadData.id);
      if (existingIdx !== -1) {
        const existing = leads[existingIdx];
        const updated: CustomerLead = {
          ...existing,
          ...leadData,
          id: existing.id,
          leadNumber: existing.leadNumber,
          discussions: leadData.discussions || existing.discussions || [],
          updatedAt: now,
        };
        leads[existingIdx] = updated;
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
        return updated;
      }
    }

    // Creating new lead
    const newId = `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newLeadNumber = this.generateLeadNumber();

    // Initial discussion record automatically created from the discussion details field
    const initialDiscussions: DiscussionEntry[] = [];
    if (leadData.discussionDetails && leadData.discussionDetails.trim()) {
      initialDiscussions.push({
        id: `disc-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        discussionDetails: leadData.discussionDetails.trim(),
        customerRequirement: leadData.customerRequirement?.trim() || undefined,
        agreedNextAction: leadData.followUpDate ? `Follow up on ${leadData.followUpDate}` : undefined,
        nextFollowUpDate: leadData.followUpDate || undefined,
        createdAt: now,
      });
    }

    const newLead: CustomerLead = {
      ...leadData,
      id: newId,
      leadNumber: newLeadNumber,
      discussions: initialDiscussions,
      createdAt: now,
      updatedAt: now,
    };

    leads.unshift(newLead);
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return newLead;
  },

  addDiscussion(
    leadId: string,
    entry: Omit<DiscussionEntry, 'id' | 'createdAt'>,
    newStatus?: LeadStatus
  ): CustomerLead | null {
    const leads = this.getAll();
    const idx = leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const now = new Date().toISOString();

    const newDiscEntry: DiscussionEntry = {
      ...entry,
      id: `disc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
    };

    // Prepend new discussion so newest is first
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

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  updateFollowUp(
    leadId: string,
    followUpDate: string,
    followUpTime?: string,
    status?: LeadStatus
  ): CustomerLead | null {
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

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  markFollowUpCompleted(leadId: string, note = 'Follow-up completed'): CustomerLead | null {
    const leads = this.getAll();
    const idx = leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return null;

    const lead = leads[idx];
    const now = new Date().toISOString();

    const completionEntry: DiscussionEntry = {
      id: `disc-${Date.now()}`,
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

    leads[idx] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    return updatedLead;
  },

  deleteLead(id: string): boolean {
    const leads = this.getAll();
    const filtered = leads.filter((l) => l.id !== id);
    if (filtered.length !== leads.length) {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  },

  /**
   * Categorizes follow-ups: today, upcoming, overdue, completed
   */
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

    // Sort overdue earliest first (most overdue first)
    overdue.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));
    // Sort today by time
    today.sort((a, b) => (a.followUpTime || '').localeCompare(b.followUpTime || ''));
    // Sort upcoming soonest first
    upcoming.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));

    return { today, upcoming, overdue, completed };
  },
};
