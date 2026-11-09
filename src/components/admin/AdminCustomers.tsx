import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Phone,
  Check,
  ShoppingBag,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { customerService, normalizeMobile } from '../../services/customerService';
import { useLanguage } from '../../context/LanguageContext';
import type { Customer } from '../../types/admin';

interface CustomerFormData {
  name: string;
  mobile: string;
  alternativeMobile: string;
  email: string;
  birthday: string;
  anniversaryDate: string;
  preferredLanguage: 'en' | 'ta';
  notes: string;
  marketingConsent: boolean;
}

const emptyCustomerForm = (): CustomerFormData => ({
  name: '',
  mobile: '',
  alternativeMobile: '',
  email: '',
  birthday: '',
  anniversaryDate: '',
  preferredLanguage: 'ta',
  notes: '',
  marketingConsent: true,
});

export const AdminCustomers: React.FC = () => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [consentFilter, setConsentFilter] = useState<'all' | 'consented' | 'opted_out'>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'en' | 'ta'>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormData>(emptyCustomerForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function loadCustomers() {
    setCustomers(customerService.getAll());
    customerService.syncFromSupabase().then((synced) => {
      if (synced && Array.isArray(synced)) setCustomers(synced);
    }).catch(() => {});
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  const filteredCustomers = useMemo(() => {
    let result = customers.filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });

    if (consentFilter === 'consented') {
      result = result.filter((c) => c.marketingConsent === true);
    } else if (consentFilter === 'opted_out') {
      result = result.filter((c) => c.marketingConsent === false);
    }

    if (langFilter !== 'all') {
      result = result.filter((c) => (c.preferredLanguage || 'ta') === langFilter);
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [search, consentFilter, langFilter, customers]);

  function openAddModal() {
    setEditingCustomer(null);
    setForm(emptyCustomerForm());
    setFormErrors({});
    setIsAddModalOpen(true);
  }

  function openEditModal(c: Customer) {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      mobile: c.mobile,
      alternativeMobile: c.alternativeMobile || '',
      email: c.email || '',
      birthday: c.birthday || '',
      anniversaryDate: c.anniversaryDate || '',
      preferredLanguage: c.preferredLanguage || 'ta',
      notes: c.notes || '',
      marketingConsent: c.marketingConsent,
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) {
      errs.name = isTa ? 'பெயர் அவசியம்' : 'Customer Name is required.';
    }

    const clean = normalizeMobile(form.mobile);
    if (!clean) {
      errs.mobile = isTa ? 'மொபைல் எண் அவசியம்' : 'Mobile Number is required.';
    } else if (clean.length < 10) {
      errs.mobile = isTa ? '10 இலக்க மொபைல் எண்ணை உள்ளிடவும்' : 'Enter a valid 10-digit mobile number.';
    } else {
      // Check duplicate on new customer
      const existing = customerService.getByMobile(clean);
      if (existing && (!editingCustomer || existing.id !== editingCustomer.id)) {
        errs.mobile = isTa
          ? `இந்த மொபைல் எண் முன்பே உள்ளது (${existing.name} - ${existing.id})`
          : `A customer with this mobile number already exists (${existing.name} - ${existing.id})`;
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = isTa ? 'சரியான மின்னஞ்சலை உள்ளிடவும்' : 'Enter a valid email address.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingCustomer) {
      customerService.update(editingCustomer.id, {
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ''),
        alternativeMobile: form.alternativeMobile.replace(/\D/g, '') || undefined,
        email: form.email.trim() || undefined,
        birthday: form.birthday || undefined,
        anniversaryDate: form.anniversaryDate || undefined,
        preferredLanguage: form.preferredLanguage,
        notes: form.notes.trim() || undefined,
        marketingConsent: form.marketingConsent,
      });
      showToast(isTa ? 'வாடிக்கையாளர் விவரங்கள் புதுப்பிக்கப்பட்டன' : 'Customer details updated successfully.');
    } else {
      customerService.create({
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, ''),
        alternativeMobile: form.alternativeMobile.replace(/\D/g, '') || undefined,
        email: form.email.trim() || undefined,
        birthday: form.birthday || undefined,
        anniversaryDate: form.anniversaryDate || undefined,
        preferredLanguage: form.preferredLanguage,
        notes: form.notes.trim() || undefined,
        marketingConsent: form.marketingConsent,
      });
      showToast(isTa ? 'புதிய வாடிக்கையாளர் சேர்க்கப்பட்டார்' : 'Customer created successfully.');
    }

    loadCustomers();
    setIsAddModalOpen(false);
    if (selectedCustomer && editingCustomer && selectedCustomer.id === editingCustomer.id) {
      setSelectedCustomer(customerService.getById(editingCustomer.id) || null);
    }
  }

  function handleDeleteCustomer(id: string) {
    customerService.delete(id);
    loadCustomers();
    setDeleteConfirmId(null);
    if (selectedCustomer?.id === id) {
      setSelectedCustomer(null);
    }
    showToast(isTa ? 'வாடிக்கையாளர் நீக்கப்பட்டார்' : 'Customer deleted.');
  }

  const totalCount = customers.length;
  const consentedCount = customers.filter((c) => c.marketingConsent).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm">
          <Check size={16} className="text-green-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isTa ? 'வாடிக்கையாளர்கள் மேலாண்மை' : 'Customer Management'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTa
              ? 'வாடிக்கையாளர் விவரங்கள், முந்தைய ஆர்டர்கள் மற்றும் வாழ்த்து விருப்பத்தேர்வுகள்'
              : 'Save customer profiles, view order histories, and manage promotional consent'}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>{isTa ? 'புதிய வாடிக்கையாளர் சேர்' : 'Add Customer'}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-primary flex items-center justify-center flex-shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'மொத்த வாடிக்கையாளர்கள்' : 'Total Customers'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{consentedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isTa ? 'செய்தி சம்மதம் அளித்தவர்கள்' : 'Promotional Consent Active'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {totalCount > 0 ? Math.round((consentedCount / totalCount) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'சம்மத விகிதம்' : 'Consent Rate'}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isTa
                ? 'பெயர், மொபைல் எண், மின்னஞ்சல் மூலம் தேடவும்...'
                : 'Search customers by name, phone, or email…'
            }
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <select
          value={consentFilter}
          onChange={(e) => setConsentFilter(e.target.value as any)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">{isTa ? 'அனைத்து வாடிக்கையாளர்கள்' : 'All Consent Statuses'}</option>
          <option value="consented">{isTa ? 'சம்மதம் உள்ளவர்கள்' : 'Marketing Consented'}</option>
          <option value="opted_out">{isTa ? 'விலகியவர்கள் (Opted Out)' : 'Opted Out'}</option>
        </select>

        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value as any)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">{isTa ? 'அனைத்து மொழிகள்' : 'All Languages'}</option>
          <option value="ta">தமிழ் (Tamil)</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Customer List Table */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
          <Users size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-600">
            {isTa ? 'வாடிக்கையாளர்கள் கிடைக்கவில்லை' : 'No customers found'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Try clearing your search filters.' : 'Add your first customer to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5 text-left">Customer ID</th>
                  <th className="px-5 py-3.5 text-left">Name</th>
                  <th className="px-5 py-3.5 text-left">Mobile</th>
                  <th className="px-5 py-3.5 text-left">Orders Placed</th>
                  <th className="px-5 py-3.5 text-left">Last Order Date</th>
                  <th className="px-5 py-3.5 text-left">Language</th>
                  <th className="px-5 py-3.5 text-left">Consent</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const metrics = customerService.getCustomerMetrics(customer.id);
                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <td className="px-5 py-3.5 font-mono text-primary font-bold text-xs">
                        {customer.id}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900">{customer.name}</p>
                        {customer.email && (
                          <p className="text-xs text-slate-400">{customer.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {customer.mobile}
                        {customer.alternativeMobile && (
                          <span className="block text-[11px] text-slate-400">
                            Alt: {customer.alternativeMobile}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                          <ShoppingBag size={14} className="text-slate-400" />
                          {metrics.orderCount} order(s)
                        </span>
                        {metrics.totalSpent > 0 && (
                          <span className="block text-[11px] text-slate-500 font-mono">
                            ₹{metrics.totalSpent.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">
                        {metrics.lastOrderDate || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {customer.preferredLanguage === 'ta' ? 'தமிழ்' : 'English'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {customer.marketingConsent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={12} /> Consented
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                            <ShieldAlert size={12} /> Opted-out
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1.5 text-slate-500 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Customer"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(customer.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Customer"
                          >
                            <Trash2 size={15} />
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
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <span className="text-xs font-mono text-primary font-bold">{selectedCustomer.id}</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedCustomer)}
                  className="px-3 py-1.5 text-xs font-semibold text-primary bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Pencil size={13} />
                  <span>{isTa ? 'திருத்து' : 'Edit'}</span>
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Contact Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-100 text-xs sm:text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Primary Mobile</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Phone size={14} className="text-primary" /> {selectedCustomer.mobile}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Alternative Mobile</p>
                  <p className="font-semibold text-slate-900">
                    {selectedCustomer.alternativeMobile || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Email</p>
                  <p className="font-semibold text-slate-900">
                    {selectedCustomer.email || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Preferred Language</p>
                  <p className="font-semibold text-slate-900">
                    {selectedCustomer.preferredLanguage === 'ta' ? 'தமிழ் (Tamil)' : 'English'}
                  </p>
                </div>
                {selectedCustomer.birthday && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Birthday</p>
                    <p className="font-semibold text-slate-900">{selectedCustomer.birthday}</p>
                  </div>
                )}
                {selectedCustomer.anniversaryDate && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Anniversary Date</p>
                    <p className="font-semibold text-slate-900">{selectedCustomer.anniversaryDate}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">Promotional Consent</p>
                  <p className="font-semibold">
                    {selectedCustomer.marketingConsent ? (
                      <span className="text-green-700">Consented (Active)</span>
                    ) : (
                      <span className="text-red-600">Opted Out</span>
                    )}
                  </p>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3.5">
                  <p className="text-xs font-bold text-orange-900 uppercase tracking-wider mb-1">
                    Customer Notes
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                </div>
              )}

              {/* Order History */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-primary" />
                  Order History
                </h4>

                {(() => {
                  const orders = customerService.getCustomerOrders(selectedCustomer.id);
                  if (orders.length === 0) {
                    return (
                      <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                        No orders recorded for this customer yet.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:border-primary/40 transition-colors"
                        >
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900">{ord.id}</span>
                            <p className="text-xs text-slate-500">
                              Date: {ord.orderDate} • {ord.items.length} items • Source: {ord.orderSource || 'Website'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-slate-900">
                              ₹{ord.totalAmount.toLocaleString('en-IN')}
                            </p>
                            <span className="text-[11px] font-semibold text-slate-600">
                              {ord.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10 overflow-hidden my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCustomer
                  ? isTa ? 'வாடிக்கையாளர் விவரங்களைத் திருத்து' : 'Edit Customer'
                  : isTa ? 'புதிய வாடிக்கையாளர் சேர்த்தல்' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    formErrors.name ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="9876543210"
                    className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      formErrors.mobile ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.mobile && <p className="text-red-500 text-xs mt-1">{formErrors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alternative Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={form.alternativeMobile}
                    onChange={(e) =>
                      setForm({ ...form, alternativeMobile: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="Secondary phone"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ramesh@example.com"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Language
                  </label>
                  <select
                    value={form.preferredLanguage}
                    onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Birthday (Optional)
                  </label>
                  <input
                    type="date"
                    value={form.birthday}
                    onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Anniversary Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={form.anniversaryDate}
                    onChange={(e) => setForm({ ...form, anniversaryDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special preferences, allergies, VIP customer..."
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              {/* Marketing Consent Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.marketingConsent}
                  onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
                  className="w-4 h-4 text-primary rounded mt-0.5"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-semibold block">Marketing & Greeting Messages Consent</span>
                  Customer agreed to receive festive greetings, discounts, and anniversary wishes.
                </div>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  {editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <h3 className="font-semibold text-slate-900 mb-2">Delete Customer Record</h3>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete this customer record? Existing order records will remain safe and intact.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomer(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
