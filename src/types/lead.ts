/**
 * Customer Leads Management Types
 */

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up Required'
  | 'Confirmed'
  | 'Not Interested';

export type LeadEventType =
  | 'Wedding'
  | 'Birthday Function'
  | 'Engagement'
  | 'Corporate Event'
  | 'House Function'
  | 'Temple Function'
  | 'Other'
  | string;

export interface DiscussionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "11:30 AM" or "15:00"
  discussionDetails: string;
  customerRequirement?: string;
  agreedNextAction?: string;
  nextFollowUpDate?: string;
  createdAt: string;
}

export interface CustomerLead {
  id: string;
  leadNumber: string;
  customerName: string;
  mobile: string;
  alternativeMobile?: string;
  eventType?: LeadEventType;
  eventDate?: string;
  expectedGuestCount?: number;
  customerRequirement?: string;
  discussionDetails: string;
  followUpDate?: string;
  followUpTime?: string;
  status: LeadStatus;
  additionalNotes?: string;
  discussions: DiscussionEntry[];
  convertedToOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

