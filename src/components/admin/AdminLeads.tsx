import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  ShoppingBag,
  RotateCcw,
  Users,
  FileText,
  ClockAlert,
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { useLanguage } from '../../context/LanguageContext';
import { getBusinessName } from '../../config/site';
import { AdminAddOrderModal } from './AdminAddOrderModal';
import type { CustomerLead, LeadStatus, LeadEventType } from '../../types/lead';
import type { Order } from '../../types/admin';

interface AdminLeadsProps {
  onNavigateToOrders?: () => void;
}

const EVENT_TYPES: LeadEventType[] = [
  'Wedding',
  'Birthday Function',
  'Engagement',
  'Corporate Event',
  'House Function',
  'Temple Function',
  'Other',
];

const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Confirmed',
  'Not Interested',
];

const statusBadgeStyles: Record<LeadStatus, string> = {
  New: 'bg-blue-100 text-blue-800 border-blue-200',
  Contacted: 'bg-purple-100 text-purple-800 border-purple-200',
  Interested: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Follow-up Required': 'bg-amber-100 text-amber-800 border-amber-200 font-semibold',
  Confirmed: 'bg-green-100 text-green-800 border-green-200 font-bold',
  'Not Interested': 'bg-slate-100 text-slate-600 border-slate-200',
};

export const AdminLeads: React.FC<AdminLeadsProps> = ({ onNavigateToOrders }) => {
  const { lang } = useLanguage();
  const businessName = getBusinessName(lang);

  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>('all');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CustomerLead | null>(null);
  const [viewingLead, setViewingLead] = useState<CustomerLead | null>(null);
  const [rescheduleLead, setRescheduleLead] = useState<CustomerLead | null>(null);
  const [convertingLead, setConvertingLead] = useState<CustomerLead | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for Add / Edit
  const [formData, setFormData] = useState({
    customerName: '',
    mobile: '',
    alternativeMobile: '',
    eventType: 'Wedding' as LeadEventType,
    eventDate: '',
    expectedGuestCount: '' as string | number,
    customerRequirement: '',
    discussionDetails: '',
    followUpDate: '',
    followUpTime: '10:00 AM',
    status: 'New' as LeadStatus,
    additionalNotes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form state for New Discussion Entry (inside View Details modal)
  const [newDiscussion, setNewDiscussion] = useState({
    details: '',
    customerRequirement: '',
    agreedNextAction: '',
    nextFollowUpDate: '',
    nextFollowUpTime: '11:00 AM',
    newStatus: '' as LeadStatus | '',
  });

  // Reschedule follow-up modal state
  const [rescheduleData, setRescheduleData] = useState({
    date: '',
    time: '11:00 AM',
    note: '',
  });

  // Refresh leads from service
  const refreshLeads = useCallback(() => {
    const all = leadService.getAll();
    setLeads(all);
    if (viewingLead) {
      const updated = all.find((l) => l.id === viewingLead.id);
      if (updated) setViewingLead(updated);
    }
    leadService.syncFromSupabase().then((synced) => {
      if (synced && Array.isArray(synced)) {
        setLeads(synced);
        if (viewingLead) {
          const up = synced.find((l) => l.id === viewingLead.id);
          if (up) setViewingLead(up);
        }
      }
    }).catch(() => {});
  }, [viewingLead]);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  // Follow-up categorization
  const followUps = useMemo(() => leadService.getFollowUps(leads), [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list: CustomerLead[] = [];

    if (activeTab === 'all') {
      list = [...leads];
    } else if (activeTab === 'today') {
      list = followUps.today;
    } else if (activeTab === 'overdue') {
      list = followUps.overdue;
    } else if (activeTab === 'upcoming') {
      list = followUps.upcoming;
    } else if (activeTab === 'completed') {
      list = followUps.completed;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.customerName.toLowerCase().includes(q) ||
          l.mobile.includes(q) ||
          (l.alternativeMobile && l.alternativeMobile.includes(q)) ||
          l.leadNumber.toLowerCase().includes(q) ||
          (l.customerRequirement && l.customerRequirement.toLowerCase().includes(q)) ||
          (l.discussionDetails && l.discussionDetails.toLowerCase().includes(q))
      );
    }

    if (selectedStatus !== 'ALL') {
      list = list.filter((l) => l.status === selectedStatus);
    }

    if (selectedEventType !== 'ALL') {
      list = list.filter((l) => l.eventType === selectedEventType);
    }

    return list;
  }, [leads, activeTab, followUps, searchQuery, selectedStatus, selectedEventType]);

  // Open Add Lead modal
  const handleOpenAddModal = () => {
    setEditingLead(null);
    setFormData({
      customerName: '',
      mobile: '',
      alternativeMobile: '',
      eventType: 'Wedding',
      eventDate: '',
      expectedGuestCount: '',
      customerRequirement: '',
      discussionDetails: '',
      followUpDate: '',
      followUpTime: '10:00 AM',
      status: 'New',
      additionalNotes: '',
    });
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  // Open Edit Lead modal
  const handleOpenEditModal = (lead: CustomerLead) => {
    setEditingLead(lead);
    setFormData({
      customerName: lead.customerName,
      mobile: lead.mobile,
      alternativeMobile: lead.alternativeMobile || '',
      eventType: lead.eventType || 'Wedding',
      eventDate: lead.eventDate || '',
      expectedGuestCount: lead.expectedGuestCount || '',
      customerRequirement: lead.customerRequirement || '',
      discussionDetails: lead.discussionDetails || '',
      followUpDate: lead.followUpDate || '',
      followUpTime: lead.followUpTime || '10:00 AM',
      status: lead.status,
      additionalNotes: lead.additionalNotes || '',
    });
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  // Save Lead
  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      errors.customerName = lang === 'ta' ? 'வாடிக்கையாளர் பெயர் அவசியம்' : 'Customer Name is required';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile) {
      errors.mobile = lang === 'ta' ? 'மொபைல் எண் அவசியம்' : 'Mobile number is required';
    } else if (cleanMobile.length < 10) {
      errors.mobile = lang === 'ta' ? 'சரியான 10 இலக்க மொபைல் எண் உள்ளிடவும்' : 'Enter valid 10-digit mobile number';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await leadService.saveLead({
        ...(editingLead ? { id: editingLead.id, leadNumber: editingLead.leadNumber } : {}),
        customerName: formData.customerName.trim(),
        mobile: cleanMobile,
        alternativeMobile: formData.alternativeMobile.trim() || undefined,
        eventType: formData.eventType,
        eventDate: formData.eventDate || undefined,
        expectedGuestCount: formData.expectedGuestCount ? Number(formData.expectedGuestCount) : undefined,
        customerRequirement: formData.customerRequirement.trim() || undefined,
        discussionDetails: formData.discussionDetails.trim(),
        followUpDate: formData.followUpDate || undefined,
        followUpTime: formData.followUpDate ? formData.followUpTime : undefined,
        status: formData.status,
        additionalNotes: formData.additionalNotes.trim() || undefined,
      });

      setIsAddEditOpen(false);
      refreshLeads();
    } catch (err: any) {
      alert((lang === 'ta' ? 'சேமிக்க முடியவில்லை: ' : 'Failed to save lead: ') + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Lead
  const handleDeleteLead = async (id: string) => {
    setIsSubmitting(true);
    try {
      await leadService.deleteLead(id);
      setDeleteConfirmId(null);
      if (viewingLead?.id === id) setViewingLead(null);
      refreshLeads();
    } catch (err: any) {
      alert((lang === 'ta' ? 'நீக்க முடியவில்லை: ' : 'Failed to delete lead: ') + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add discussion entry
  const handleAddDiscussionEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingLead || !newDiscussion.details.trim()) return;

    setIsSubmitting(true);
    try {
      await leadService.addDiscussion(
        viewingLead.id,
        {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          discussionDetails: newDiscussion.details.trim(),
          customerRequirement: newDiscussion.customerRequirement.trim() || undefined,
          agreedNextAction: newDiscussion.agreedNextAction.trim() || undefined,
          nextFollowUpDate: newDiscussion.nextFollowUpDate || undefined,
        },
        newDiscussion.newStatus || undefined
      );

      setNewDiscussion({
        details: '',
        customerRequirement: '',
        agreedNextAction: '',
        nextFollowUpDate: '',
        nextFollowUpTime: '11:00 AM',
        newStatus: '',
      });

      refreshLeads();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reschedule follow-up
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleLead || !rescheduleData.date) return;

    setIsSubmitting(true);
    try {
      await leadService.updateFollowUp(
        rescheduleLead.id,
        rescheduleData.date,
        rescheduleData.time,
        'Follow-up Required'
      );

      if (rescheduleData.note.trim()) {
        await leadService.addDiscussion(rescheduleLead.id, {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          discussionDetails: `Rescheduled follow-up to ${rescheduleData.date}: ${rescheduleData.note.trim()}`,
          nextFollowUpDate: rescheduleData.date,
        });
      }

      setRescheduleLead(null);
      setRescheduleData({ date: '', time: '11:00 AM', note: '' });
      refreshLeads();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark follow-up completed
  const handleMarkFollowUpCompleted = async (lead: CustomerLead) => {
    setIsSubmitting(true);
    try {
      await leadService.markFollowUpCompleted(lead.id, 'Follow-up call completed');
      refreshLeads();
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp click handler
  const handleOpenWhatsApp = (lead: CustomerLead) => {
    const phone = lead.mobile.replace(/\D/g, '');
    const cleanPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const dateFormatted = lead.eventDate || (lang === 'ta' ? 'விரைவில்' : 'upcoming date');
    const eventType = lead.eventType || (lang === 'ta' ? 'நிகழ்வு' : 'Event');

    const message =
      lang === 'ta'
        ? `வணக்கம் ${lead.customerName} அய்யா/அம்மா, ${businessName}-ல் இருந்து அன்பான வணக்கங்கள்! உங்கள் ${eventType} (${dateFormatted}) கேட்டரிங் தேவைகள் பற்றி மேலும் விவரங்களை பகிர்ந்து கொள்ள விரும்புகிறோம். எப்போது பேசலாம்? நன்றி!`
        : `Hello ${lead.customerName}, greetings from ${businessName}! We are following up regarding your catering requirements for ${eventType} on ${dateFormatted}. We would love to share our menu packages and best quote with you. Thank you!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Convert to order completed
  const handleOrderSavedFromLead = async (newOrder: Order) => {
    if (convertingLead) {
      await leadService.saveLead({
        ...convertingLead,
        status: 'Confirmed',
        convertedToOrderId: newOrder.id,
      });
      await leadService.addDiscussion(convertingLead.id, {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        discussionDetails: `Successfully converted lead to Order #${newOrder.id} for ₹${newOrder.totalAmount?.toLocaleString('en-IN') || 0}.`,
        agreedNextAction: 'Order confirmed and placed into system.',
      });
      setConvertingLead(null);
      refreshLeads();
      if (onNavigateToOrders) {
        onNavigateToOrders();
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="text-primary w-8 h-8" />
            {lang === 'ta' ? 'வாடிக்கையாளர் தொடர்புகள் (Leads)' : 'Customer Leads'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'ta'
              ? 'விசாரணைகள், விவாதங்கள் மற்றும் பின்தொடர்வுகளை திறம்பட நிர்வகியுங்கள்'
              : 'Track enquiries, discussion logs, and follow-up reminders seamlessly'}
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-[#c2410c] text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          <span>{lang === 'ta' ? '+ புதிய லீட் சேர்க்க' : '+ Add New Lead'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => {
            setActiveTab('all');
            setSelectedStatus('ALL');
          }}
          className="cursor-pointer bg-white p-4 rounded-xl border border-slate-200 hover:border-primary/50 shadow-sm transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm font-medium">
            <span>{lang === 'ta' ? 'மொத்த லீட்கள்' : 'Total Leads'}</span>
            <Users size={18} className="text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{leads.length}</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('all');
            setSelectedStatus('New');
          }}
          className="cursor-pointer bg-white p-4 rounded-xl border border-blue-200 hover:border-blue-400 shadow-sm transition-all"
        >
          <div className="flex items-center justify-between text-blue-700 text-xs sm:text-sm font-medium">
            <span>{lang === 'ta' ? 'புதிய விசாரணைகள்' : 'New Leads'}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-900 mt-2">
            {leads.filter((l) => l.status === 'New').length}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('overdue')}
          className="cursor-pointer bg-amber-50 p-4 rounded-xl border border-amber-300 hover:border-amber-500 shadow-sm transition-all"
        >
          <div className="flex items-center justify-between text-amber-800 text-xs sm:text-sm font-medium">
            <span>{lang === 'ta' ? 'தாமதமான ஃபாலோ-அப்' : 'Overdue Follow-ups'}</span>
            <ClockAlert size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-900 mt-2">
            {followUps.overdue.length}
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab('all');
            setSelectedStatus('Confirmed');
          }}
          className="cursor-pointer bg-green-50 p-4 rounded-xl border border-green-300 hover:border-green-500 shadow-sm transition-all"
        >
          <div className="flex items-center justify-between text-green-800 text-xs sm:text-sm font-medium">
            <span>{lang === 'ta' ? 'உறுதி செய்யப்பட்டது' : 'Confirmed'}</span>
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-green-900 mt-2">
            {leads.filter((l) => l.status === 'Confirmed').length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {lang === 'ta' ? 'அனைத்து தொடர்புகள்' : 'All Leads'} ({leads.length})
        </button>

        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'today'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar size={15} />
          <span>{lang === 'ta' ? 'இன்றைய பின்தொடர்வு' : "Today's Follow-ups"}</span>
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
            {followUps.today.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'overdue'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-red-700 hover:bg-red-50'
          }`}
        >
          <ClockAlert size={15} />
          <span>{lang === 'ta' ? 'தாமதமானது' : 'Overdue'}</span>
          {followUps.overdue.length > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
              {followUps.overdue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={15} />
          <span>{lang === 'ta' ? 'வரவிருக்கும்' : 'Upcoming'}</span>
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
            {followUps.upcoming.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'completed'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {lang === 'ta' ? 'முடிவடைந்தது / உறுதியானது' : 'Completed / Confirmed'} ({followUps.completed.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ta'
                ? 'பெயர், மொபைல், எண் அல்லது தேவை மூலம் தேடுக...'
                : 'Search by customer name, phone, lead ID, requirement...'
            }
            className="w-full pl-10 pr-9 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">{lang === 'ta' ? 'அனைத்து நிலைகள்' : 'All Statuses'}</option>
            {LEAD_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Event Type Filter */}
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">{lang === 'ta' ? 'அனைத்து நிகழ்வுகள்' : 'All Event Types'}</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table / Cards */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <UserCheck className="mx-auto w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            {lang === 'ta' ? 'தொடர்புகள் ஏதும் கிடைக்கவில்லை' : 'No leads found'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery || selectedStatus !== 'ALL' || selectedEventType !== 'ALL'
              ? lang === 'ta'
                ? 'உங்கள் தேடல் அல்லது வடிகட்டலுக்கு பொருத்தமான பதிவுகள் இல்லை.'
                : 'No leads match your current search or filter criteria.'
              : lang === 'ta'
              ? 'புதிய விசாரணையை பதிவு செய்ய "+ புதிய லீட் சேர்க்க" பொத்தானை அழுத்தவும்.'
              : 'Get started by creating your first customer enquiry lead.'}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-[#c2410c] transition-colors"
          >
            <Plus size={16} />
            {lang === 'ta' ? 'புதிய லீட் சேர்க்க' : 'Add Lead'}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'எண் / தேதி' : 'Lead / Date'}</th>
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'வாடிக்கையாளர் & தொடர்பு' : 'Customer & Phone'}</th>
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'நிகழ்வு & விருந்தினர்கள்' : 'Event & Guests'}</th>
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'தேவை & குறிப்புகள்' : 'Requirement & Notes'}</th>
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'அடுத்த தொடர்பு' : 'Follow-up'}</th>
                    <th className="py-3.5 px-4">{lang === 'ta' ? 'நிலை' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-right">{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue =
                      lead.followUpDate &&
                      lead.followUpDate < todayStr &&
                      lead.status !== 'Confirmed' &&
                      lead.status !== 'Not Interested';
                    const isToday = lead.followUpDate === todayStr;

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">{lead.leadNumber}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">{lead.customerName}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`tel:${lead.mobile}`}
                              className="text-xs text-slate-600 hover:text-primary flex items-center gap-1 font-mono"
                              title="Call Customer"
                            >
                              <Phone size={12} className="text-primary" />
                              {lead.mobile}
                            </a>
                            <button
                              onClick={() => handleOpenWhatsApp(lead)}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Open WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </div>
                          {lead.alternativeMobile && (
                            <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                              Alt: {lead.alternativeMobile}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 mb-1">
                            {lead.eventType || 'Event'}
                          </span>
                          {lead.eventDate && (
                            <div className="text-xs text-slate-600 flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              <span>{lead.eventDate}</span>
                            </div>
                          )}
                          {lead.expectedGuestCount && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Users size={12} className="text-slate-400" />
                              <span>{lead.expectedGuestCount} guests</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          {lead.customerRequirement && (
                            <p className="text-xs text-slate-800 line-clamp-2 font-medium">
                              {lead.customerRequirement}
                            </p>
                          )}
                          {lead.discussionDetails && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 italic">
                              "{lead.discussionDetails}"
                            </p>
                          )}
                          {lead.discussions && lead.discussions.length > 1 && (
                            <span className="text-[10px] text-primary font-semibold block mt-1">
                              +{lead.discussions.length - 1} more history entries
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {lead.followUpDate ? (
                            <div>
                              <div
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${
                                  isOverdue
                                    ? 'bg-red-100 text-red-800 border border-red-300 font-bold'
                                    : isToday
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isOverdue && <ClockAlert size={12} />}
                                <span>{lead.followUpDate}</span>
                                {lead.followUpTime && <span>({lead.followUpTime})</span>}
                              </div>
                              {isOverdue && (
                                <span className="block text-[11px] text-red-600 font-bold mt-0.5">
                                  {lang === 'ta' ? 'தாமதமானது!' : 'Overdue!'}
                                </span>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => handleMarkFollowUpCompleted(lead)}
                                  className="text-[11px] text-emerald-700 hover:underline font-medium"
                                  title="Mark Completed"
                                >
                                  {lang === 'ta' ? 'முடிந்தது' : 'Done'}
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  onClick={() => {
                                    setRescheduleLead(lead);
                                    setRescheduleData({
                                      date: lead.followUpDate || '',
                                      time: lead.followUpTime || '11:00 AM',
                                      note: '',
                                    });
                                  }}
                                  className="text-[11px] text-primary hover:underline font-medium"
                                  title="Reschedule Follow-up"
                                >
                                  {lang === 'ta' ? 'மாற்றி அமைக்க' : 'Reschedule'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {lead.status === 'Confirmed'
                                ? lang === 'ta'
                                  ? 'உறுதி செய்யப்பட்டது'
                                  : 'Converted'
                                : '—'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs border ${
                              statusBadgeStyles[lead.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {lead.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewingLead(lead)}
                              className="p-1.5 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                              title={lang === 'ta' ? 'விவரங்களை பார்க்க' : 'View Details & History'}
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(lead)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={lang === 'ta' ? 'திருத்த' : 'Edit Lead'}
                            >
                              <Pencil size={16} />
                            </button>

                            {lead.status !== 'Confirmed' && (
                              <button
                                onClick={() => setConvertingLead(lead)}
                                className="p-1.5 text-emerald-700 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors"
                                title={lang === 'ta' ? 'ஆர்டராக மாற்றுக' : 'Convert to Order'}
                              >
                                <ShoppingBag size={16} />
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteConfirmId(lead.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={lang === 'ta' ? 'நீக்க' : 'Delete'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="lg:hidden space-y-3">
            {filteredLeads.map((lead) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isOverdue =
                lead.followUpDate &&
                lead.followUpDate < todayStr &&
                lead.status !== 'Confirmed' &&
                lead.status !== 'Not Interested';
              const isToday = lead.followUpDate === todayStr;

              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm space-y-3 ${
                    isOverdue ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{lead.customerName}</span>
                        <span className="text-xs text-slate-400 font-mono">({lead.leadNumber})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {lead.eventType || 'Event'} • {lead.eventDate || 'Date TBD'}
                        {lead.expectedGuestCount ? ` • ${lead.expectedGuestCount} guests` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                        statusBadgeStyles[lead.status]
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>

                  {lead.customerRequirement && (
                    <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-700">
                      <span className="font-semibold block text-slate-900 mb-0.5">
                        {lang === 'ta' ? 'தேவை:' : 'Requirement:'}
                      </span>
                      {lead.customerRequirement}
                    </div>
                  )}

                  {/* Follow-up banner if present */}
                  {lead.followUpDate && (
                    <div
                      className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                        isOverdue
                          ? 'bg-red-100 text-red-900 font-bold border border-red-200'
                          : isToday
                          ? 'bg-amber-100 text-amber-900 font-semibold border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        <span>
                          {isOverdue
                            ? lang === 'ta'
                              ? 'தாமதமான ஃபாலோ-அப்: '
                              : 'Overdue Follow-up: '
                            : lang === 'ta'
                            ? 'அடுத்த ஃபாலோ-அப்: '
                            : 'Next Follow-up: '}
                          {lead.followUpDate} {lead.followUpTime ? `(${lead.followUpTime})` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => handleMarkFollowUpCompleted(lead)}
                        className="text-xs font-bold text-emerald-800 underline ml-2"
                      >
                        {lang === 'ta' ? 'முடிந்தது' : 'Done'}
                      </button>
                    </div>
                  )}

                  {/* Mobile Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${lead.mobile}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Phone size={13} className="text-primary" />
                        <span>{lang === 'ta' ? 'அழைக்க' : 'Call'}</span>
                      </a>
                      <button
                        onClick={() => handleOpenWhatsApp(lead)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <MessageSquare size={13} className="text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingLead(lead)}
                        className="p-2 text-slate-600 hover:text-primary rounded-lg"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(lead)}
                        className="p-2 text-slate-600 hover:text-blue-600 rounded-lg"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {lead.status !== 'Confirmed' && (
                        <button
                          onClick={() => setConvertingLead(lead)}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <ShoppingBag size={13} />
                          <span>{lang === 'ta' ? 'ஆர்டர்' : 'Order'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =========================================
          MODAL 1: ADD / EDIT LEAD MODAL (12 FIELDS)
          ========================================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <UserCheck size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingLead
                    ? lang === 'ta'
                      ? `லீட் திருத்து - ${editingLead.leadNumber}`
                      : `Edit Lead - ${editingLead.leadNumber}`
                    : lang === 'ta'
                    ? 'புதிய வாடிக்கையாளர் லீட் சேர்க்க'
                    : 'Add New Customer Lead'}
                </h2>
              </div>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLead} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name'} *
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Suresh Kumar"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      formErrors.customerName ? 'border-red-500 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.customerName && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.customerName}</p>
                  )}
                </div>

                {/* 2. Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'மொபைல் எண்' : 'Mobile Number'} *
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. 9840123456"
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary ${
                      formErrors.mobile ? 'border-red-500 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.mobile && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.mobile}</p>
                  )}
                </div>

                {/* 3. Alternative Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'மாற்று மொபைல் எண்' : 'Alternative Mobile Number'}
                  </label>
                  <input
                    type="tel"
                    value={formData.alternativeMobile}
                    onChange={(e) => setFormData({ ...formData, alternativeMobile: e.target.value })}
                    placeholder="Optional second number"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* 4. Event Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'நிகழ்வு வகை' : 'Event Type'}
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value as LeadEventType })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {EVENT_TYPES.map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Event Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'நிகழ்வு தேதி' : 'Event Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* 6. Expected Guests */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ta' ? 'எதிர்பார்க்கப்படும் விருந்தினர்கள்' : 'Expected Guests Count'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.expectedGuestCount}
                    onChange={(e) => setFormData({ ...formData, expectedGuestCount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 7. Customer Requirement */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'வாடிக்கையாளர் தேவை & மெனு விருப்பங்கள்' : 'Customer Requirement'}
                </label>
                <textarea
                  rows={2}
                  value={formData.customerRequirement}
                  onChange={(e) => setFormData({ ...formData, customerRequirement: e.target.value })}
                  placeholder={
                    lang === 'ta'
                      ? 'உதாரணம்: காலை சிற்றுண்டி, மதிய இலை விருந்து 3 பாயாசம் வகைகளுடன்...'
                      : 'e.g. Traditional banana leaf lunch with 3 payasam varieties, evening snack counter...'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 8. Discussion Details */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'விவாத விவரங்கள்' : 'Discussion Details'}
                </label>
                <textarea
                  rows={2}
                  value={formData.discussionDetails}
                  onChange={(e) => setFormData({ ...formData, discussionDetails: e.target.value })}
                  placeholder={
                    lang === 'ta'
                      ? 'தொலைபேசி அழைப்பு அல்லது நேரில் பேசிய விவரங்கள், பட்ஜெட் விவரங்கள்...'
                      : 'Details discussed over call/visit, agreed price points, special tastes...'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 9 & 10. Follow-up Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-orange-50/50 p-3.5 rounded-xl border border-orange-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-primary" />
                    <span>{lang === 'ta' ? 'அடுத்த தொடர்பு தேதி (Follow-up)' : 'Follow-up Date'}</span>
                  </label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                    <Clock size={13} className="text-primary" />
                    <span>{lang === 'ta' ? 'நேரம்' : 'Follow-up Time'}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.followUpTime}
                    onChange={(e) => setFormData({ ...formData, followUpTime: e.target.value })}
                    placeholder="e.g. 11:00 AM"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 11. Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'லீட் நிலை' : 'Lead Status'}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* 12. Additional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'கூடுதல் குறிப்புகள்' : 'Additional Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  placeholder={
                    lang === 'ta'
                      ? 'மண்டபம் இருப்பிடம், அறிமுகப்படுத்தியவர், பிற நிபந்தனைகள்...'
                      : 'Hall address, referral source, special terms...'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {lang === 'ta' ? 'ரத்து செய்க' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary hover:bg-[#c2410c] text-white rounded-lg text-sm font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting
                    ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...')
                    : (editingLead
                        ? (lang === 'ta' ? 'புதுப்பிக்க' : 'Update Lead')
                        : (lang === 'ta' ? 'சேமிக்க' : 'Save Lead'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL 2: VIEW DETAILS & CHRONOLOGICAL DISCUSSION HISTORY MODAL
          ============================================================== */}
      {viewingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <UserCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{viewingLead.customerName}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 font-mono font-semibold">
                      {viewingLead.leadNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Created on {new Date(viewingLead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingLead(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Quick Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block">{lang === 'ta' ? 'மொபைல் எண்' : 'Mobile'}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <a href={`tel:${viewingLead.mobile}`} className="text-sm font-semibold text-slate-900 font-mono hover:text-primary">
                      {viewingLead.mobile}
                    </a>
                  </div>
                  {viewingLead.alternativeMobile && (
                    <span className="text-[11px] text-slate-500 font-mono block">Alt: {viewingLead.alternativeMobile}</span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">{lang === 'ta' ? 'நிகழ்வு வகை' : 'Event Type'}</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                    {viewingLead.eventType || '—'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">{viewingLead.eventDate || 'Date TBD'}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">{lang === 'ta' ? 'விருந்தினர்கள்' : 'Expected Guests'}</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                    {viewingLead.expectedGuestCount ? `${viewingLead.expectedGuestCount} pax` : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">{lang === 'ta' ? 'நிலை' : 'Status'}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 border ${
                      statusBadgeStyles[viewingLead.status]
                    }`}
                  >
                    {viewingLead.status}
                  </span>
                </div>
              </div>

              {/* Requirement & Notes */}
              <div className="space-y-3">
                {viewingLead.customerRequirement && (
                  <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200 text-sm">
                    <span className="font-bold text-orange-900 block mb-1">
                      {lang === 'ta' ? 'வாடிக்கையாளர் தேவை & மெனு விருப்பம்:' : 'Customer Requirement:'}
                    </span>
                    <p className="text-slate-800">{viewingLead.customerRequirement}</p>
                  </div>
                )}

                {viewingLead.additionalNotes && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold block text-slate-900 mb-0.5">
                      {lang === 'ta' ? 'கூடுதல் குறிப்புகள்:' : 'Additional Notes:'}
                    </span>
                    <p>{viewingLead.additionalNotes}</p>
                  </div>
                )}
              </div>

              {/* Quick Communication Buttons */}
              <div className="flex items-center gap-3">
                <a
                  href={`tel:${viewingLead.mobile}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
                >
                  <Phone size={16} className="text-primary" />
                  <span>{lang === 'ta' ? 'அழைக்க' : 'Call Customer'}</span>
                </a>

                <button
                  onClick={() => handleOpenWhatsApp(viewingLead)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp</span>
                </button>

                {viewingLead.status !== 'Confirmed' && (
                  <button
                    onClick={() => {
                      setConvertingLead(viewingLead);
                      setViewingLead(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary hover:bg-[#c2410c] text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    <ShoppingBag size={16} />
                    <span>{lang === 'ta' ? 'ஆர்டராக மாற்றுக' : 'Convert to Order'}</span>
                  </button>
                )}
              </div>

              {/* Chronological Discussion History Section */}
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    <span>
                      {lang === 'ta' ? 'விவாத வரலாறு (Discussion History)' : 'Discussion History'}
                    </span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {viewingLead.discussions?.length || 0} {lang === 'ta' ? 'பதிவுகள்' : 'entries'}
                  </span>
                </div>

                {/* Add New Discussion Entry Form */}
                <form
                  onSubmit={handleAddDiscussionEntry}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                >
                  <span className="text-xs font-bold text-slate-800 block">
                    {lang === 'ta' ? '+ புதிய விவாத பதிவு சேர்க்க' : '+ Add New Discussion Log'}
                  </span>

                  <textarea
                    rows={2}
                    required
                    value={newDiscussion.details}
                    onChange={(e) => setNewDiscussion({ ...newDiscussion, details: e.target.value })}
                    placeholder={
                      lang === 'ta'
                        ? 'இன்றைய அழைப்பு / விவாத விவரங்களை உள்ளிடவும்...'
                        : 'Enter discussion notes from today call or meeting...'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newDiscussion.agreedNextAction}
                      onChange={(e) =>
                        setNewDiscussion({ ...newDiscussion, agreedNextAction: e.target.value })
                      }
                      placeholder={
                        lang === 'ta'
                          ? 'ஒப்புக்கொண்ட அடுத்த நடவடிக்கை (Agreed Next Action)'
                          : 'Agreed next action (e.g. Call to finalize sweet selection)'
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={newDiscussion.nextFollowUpDate}
                        onChange={(e) =>
                          setNewDiscussion({ ...newDiscussion, nextFollowUpDate: e.target.value })
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <select
                        value={newDiscussion.newStatus}
                        onChange={(e) =>
                          setNewDiscussion({
                            ...newDiscussion,
                            newStatus: e.target.value as LeadStatus,
                          })
                        }
                        className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">{lang === 'ta' ? 'நிலையை மாற்று' : 'Status...'}</option>
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newDiscussion.details.trim()}
                      className="px-4 py-1.5 bg-primary hover:bg-[#c2410c] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                      {lang === 'ta' ? 'விவாதத்தை பதிவு செய்' : 'Add Discussion Entry'}
                    </button>
                  </div>
                </form>

                {/* Timeline of past discussions */}
                <div className="space-y-3">
                  {!viewingLead.discussions || viewingLead.discussions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">
                      {lang === 'ta' ? 'விவாத பதிவுகள் எதுவும் இல்லை.' : 'No discussion entries recorded yet.'}
                    </p>
                  ) : (
                    viewingLead.discussions.map((entry, index) => (
                      <div
                        key={entry.id || index}
                        className="relative pl-6 border-l-2 border-primary/30 pb-3 last:pb-0"
                      >
                        <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="font-semibold text-slate-800">
                              {entry.date} {entry.time ? `at ${entry.time}` : ''}
                            </span>
                            {entry.nextFollowUpDate && (
                              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                                Next Follow-up: {entry.nextFollowUpDate}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">
                            {entry.discussionDetails}
                          </p>
                          {entry.agreedNextAction && (
                            <p className="text-xs text-emerald-800 mt-1 font-medium bg-emerald-50/50 p-1 rounded">
                              ✓ Next Action: {entry.agreedNextAction}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL 3: RESCHEDULE FOLLOW-UP QUICK MODAL
          ========================================= */}
      {rescheduleLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <RotateCcw size={18} className="text-primary" />
                <span>
                  {lang === 'ta' ? 'ஃபாலோ-அப் மாற்றி அமைக்க' : 'Reschedule Follow-up'}
                </span>
              </h3>
              <button
                onClick={() => setRescheduleLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Customer: <strong className="text-slate-900">{rescheduleLead.customerName}</strong> (
              {rescheduleLead.mobile})
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'புதிய தேதி' : 'New Follow-up Date'} *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'நேரம்' : 'Time'}
                </label>
                <input
                  type="text"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                  placeholder="e.g. 11:00 AM"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ta' ? 'குறிப்பு (காரணம்)' : 'Reschedule Reason / Note'}
                </label>
                <textarea
                  rows={2}
                  value={rescheduleData.note}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, note: e.target.value })}
                  placeholder="e.g. Customer requested to call back next Monday after hall booking confirmation"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleLead(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {lang === 'ta' ? 'ரத்து செய்க' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white rounded-lg text-xs font-semibold shadow-md"
                >
                  {lang === 'ta' ? 'மாற்றி அமைக்க' : 'Save Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL 4: DELETE CONFIRMATION MODAL
          ========================================= */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {lang === 'ta' ? 'லீட் நீக்க விரும்புகிறீர்களா?' : 'Delete Customer Lead?'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {lang === 'ta'
                ? 'இந்த பதிவை நீக்கினால் அதன் விவாத வரலாறும் அகற்றப்படும்.'
                : 'This action cannot be undone. All discussion logs for this lead will be removed.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {lang === 'ta' ? 'ரத்து செய்க' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteLead(deleteConfirmId)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                {lang === 'ta' ? 'ஆம், நீக்கு' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 5: CONVERT TO ORDER MODAL (USES AdminAddOrderModal)
          ========================================================= */}
      {convertingLead && (
        <AdminAddOrderModal
          isOpen={Boolean(convertingLead)}
          onClose={() => setConvertingLead(null)}
          onOrderSaved={handleOrderSavedFromLead}
          initialCustomer={{
            name: convertingLead.customerName,
            mobile: convertingLead.mobile,
            alternativeMobile: convertingLead.alternativeMobile,
            preferredLanguage: lang,
          }}
        />
      )}
    </div>
  );
};
