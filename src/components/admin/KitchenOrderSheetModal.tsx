import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Save,
  Eye,
  Edit3,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  ArrowLeft,
  ChefHat,
  Globe,
} from 'lucide-react';
import type { Order, KitchenOrderSheet, KitchenSheetItem, KitchenPrepStatus } from '../../types/admin';
import {
  kitchenSheetService,
  KITCHEN_UNIT_OPTIONS,
  formatUnitLabel,
  getTamilDishName,
} from '../../services/kitchenSheetService';
import { generateKitchenSheetPDF } from '../../utils/generateKitchenSheetPDF';
import { siteConfig } from '../../config/site';
import { useLanguage } from '../../context/LanguageContext';
import logoImg from '../../assets/LOGO.png';

interface KitchenOrderSheetModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (sheet: KitchenOrderSheet) => void;
}

const STATUS_BADGE: Record<KitchenPrepStatus, { bg: string; text: string; border: string }> = {
  'Not Prepared': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  'In Preparation': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  'Ready': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'Completed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
};

function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate.includes('T') ? isoDate : isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const KitchenOrderSheetModal: React.FC<KitchenOrderSheetModalProps> = ({
  order,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [sheet, setSheet] = useState<KitchenOrderSheet>(() =>
    kitchenSheetService.getOrCreateForOrder(order, lang === 'ta' ? 'ta' : 'en')
  );

  const [isEditMode, setIsEditMode] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ta' | 'both'>('en');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const existingOrNew = kitchenSheetService.getOrCreateForOrder(order, lang === 'ta' ? 'ta' : 'en');
    setSheet(existingOrNew);
    setSelectedLanguage(lang === 'ta' ? 'ta' : 'en');
  }, [order, lang]);

  if (!isOpen) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // Update item fields
  function updateItem(id: string, updates: Partial<KitchenSheetItem>) {
    if (updates.dishName && updates.dishNameTa === undefined) {
      updates.dishNameTa = getTamilDishName(updates.dishName);
    }
    setSheet((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    }));
    // Clear validation error if corrected
    if (updates.prepQuantity !== undefined && validationErrors[id]) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }

  // Remove item from kitchen sheet only (does not delete from customer order!)
  function removeItem(id: string) {
    setSheet((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));
    showToast(isTa ? 'உணவு நீக்கப்பட்டது' : 'Item removed from kitchen sheet.');
  }

  // Add custom dish item
  function addItem() {
    const newItem: KitchenSheetItem = {
      id: `kos-custom-${Date.now()}`,
      dishId: `custom-${Date.now()}`,
      dishName: 'New Dish',
      dishNameTa: '',
      customerQuantity: null,
      customerUnit: '',
      prepQuantity: '',
      unit: 'kg',
      isCustomUnit: false,
      kitchenNotes: '',
    };
    setSheet((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  }

  // Validate quantities before finalizing or saving
  function validateSheet(): boolean {
    const errors: Record<string, string> = {};
    sheet.items.forEach((item) => {
      if (item.prepQuantity === '' || item.prepQuantity === null || item.prepQuantity === undefined) {
        errors[item.id] = isTa ? 'தயாரிப்பு அளவை உள்ளிடவும்' : 'Enter prep quantity';
      } else {
        const num = Number(item.prepQuantity);
        if (isNaN(num) || num <= 0) {
          errors[item.id] = isTa ? 'அளவு 0-ஐ விட அதிகமாக இருக்க வேண்டும்' : 'Must be > 0';
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Save changes
  function handleSave() {
    setSaving(true);
    try {
      const saved = kitchenSheetService.save(sheet);
      setSheet(saved);
      onSaved?.(saved);
      showToast(isTa ? 'சமையல் குறிப்பு தாள் சேமிக்கப்பட்டது!' : 'Kitchen sheet saved successfully!');
    } finally {
      setSaving(false);
    }
  }

  // Download PDF
  async function handleDownloadPDF() {
    const isValid = validateSheet();
    if (!isValid) {
      showToast(isTa ? 'தயவுசெய்து விடுபட்ட அளவுகளை நிரப்பவும்' : 'Please fill in all missing preparation quantities.');
      setIsEditMode(true);
      return;
    }

    setDownloading(true);
    try {
      // Save latest state first
      const saved = kitchenSheetService.save(sheet);
      setSheet(saved);
      await generateKitchenSheetPDF(saved, selectedLanguage);
      showToast(isTa ? 'PDF பதிவிறக்கம் தொடங்கியது!' : 'Kitchen Order PDF downloaded!');
    } catch (err) {
      console.error(err);
      showToast(isTa ? 'PDF உருவாக்க பிழை ஏற்பட்டது' : 'Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  // Print Kitchen Sheet directly
  function handlePrint() {
    const isValid = validateSheet();
    if (!isValid) {
      showToast(isTa ? 'தயவுசெய்து விடுபட்ட அளவுகளை நிரப்பவும்' : 'Please fill in all missing preparation quantities.');
      setIsEditMode(true);
      return;
    }
    // Save state
    kitchenSheetService.save(sheet);
    // Switch to preview mode and trigger print
    setIsEditMode(false);
    setTimeout(() => {
      window.print();
    }, 400);
  }

  const missingGuestAndQuantities =
    (!sheet.guestCount || sheet.guestCount <= 0) &&
    !order.foodQuantities?.length &&
    !order.items.some((i) => i.quantity && i.quantity > 0);

  const statusStyle = STATUS_BADGE[sheet.status];

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[300] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm animate-fade-in border border-slate-700">
          <Check size={18} className="text-green-400 flex-shrink-0" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      {/* Main Container */}
      <div className="fixed inset-0 z-[125] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto pointer-events-none">
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden pointer-events-auto border border-slate-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-primary flex items-center justify-center flex-shrink-0 shadow-xs border border-blue-200">
                <ChefHat size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    {isTa ? 'சமையல் தயாரிப்பு பட்டியல்' : 'Kitchen Order Sheet'}
                  </h3>
                  <span className="font-mono text-xs font-bold text-primary bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-lg">
                    {sheet.orderId}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                  >
                    {sheet.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sheet.customerName} • {sheet.mobile} • {formatDate(sheet.orderDate)}
                  {sheet.deliveryTime && ` (${sheet.deliveryTime})`}
                </p>
              </div>
            </div>

            {/* Quick Language Toggle & Close */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-medium">
                <Globe size={14} className="text-slate-400 ml-1.5 mr-1" />
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    selectedLanguage === 'en' ? 'bg-primary text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Generate English Kitchen Sheet"
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('ta')}
                  className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    selectedLanguage === 'ta' ? 'bg-primary text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="தமிழ் சமையல் தாள்"
                >
                  தமிழ்
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('both')}
                  className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    selectedLanguage === 'both' ? 'bg-primary text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Bilingual (English + Tamil)"
                >
                  Both
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Action Toolbar with the 6 Explicit Required Buttons */}
          <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto">
            {/* Mode Toggle Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* 1. Preview Kitchen Sheet */}
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  !isEditMode
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Eye size={14} />
                <span>{isTa ? 'தாள் முன்னோட்டம்' : 'Preview Kitchen Sheet'}</span>
              </button>

              {/* 2. Edit Quantities */}
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isEditMode
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Edit3 size={14} />
                <span>{isTa ? 'அளவுகளைத் திருத்து' : 'Edit Quantities'}</span>
              </button>
            </div>

            {/* Status Selector + Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Preparation Status */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 hidden md:inline font-medium">Status:</span>
                <select
                  value={sheet.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as KitchenPrepStatus;
                    setSheet((prev) => ({ ...prev, status: newStatus }));
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="Not Prepared">Not Prepared</option>
                  <option value="In Preparation">In Preparation</option>
                  <option value="Ready">Ready</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* 3. Download PDF */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-[#c2410c] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                <span>{downloading ? (isTa ? 'பதிவிறக்குகிறது…' : 'Downloading…') : (isTa ? 'PDF பதிவிறக்கு' : 'Download PDF')}</span>
              </button>

              {/* 4. Print Kitchen Sheet */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Printer size={14} />
                <span>{isTa ? 'அச்சிடு' : 'Print Kitchen Sheet'}</span>
              </button>

              {/* 5. Save Changes */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                <span>{saving ? 'Saving…' : (isTa ? 'சேமி' : 'Save Changes')}</span>
              </button>

              {/* 6. Back to Orders */}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">{isTa ? 'ஆர்டர்களுக்குத் திரும்பு' : 'Back to Orders'}</span>
              </button>
            </div>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
            {/* Warning if neither guest count nor custom kg provided */}
            {missingGuestAndQuantities && (
              <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {isTa
                      ? 'குறிப்பு: விருந்தினர் எண்ணிக்கை மற்றும் உணவு அளவுகள் கொடுக்கப்படவில்லை'
                      : 'Notice: No guest count or customer food quantity was provided in the original order'}
                  </p>
                  <p className="mt-0.5 text-amber-700">
                    {isTa
                      ? 'தயவுசெய்து அனைத்து உணவுகளுக்கும் தேவையான இறுதி தயாரிப்பு அளவை கீழே உள்ளிட்டு உறுதிப்படுத்தவும்.'
                      : 'Please enter the confirmed preparation quantities and units for each dish below before printing or downloading the PDF.'}
                  </p>
                </div>
              </div>
            )}

            {/* EDIT MODE */}
            {isEditMode ? (
              <div className="space-y-4">
                {/* Meta details card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Customer Name:</span>
                    <strong className="text-slate-900 text-sm block truncate">{sheet.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Mobile Number:</span>
                    <strong className="text-slate-900 text-sm block">{sheet.mobile}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Event Date:</span>
                    <strong className="text-slate-900 text-sm block">
                      {formatDate(sheet.orderDate)} {sheet.deliveryTime ? `• ${sheet.deliveryTime}` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Guests / People:</span>
                    <strong className="text-slate-900 text-sm block">
                      {sheet.guestCount && sheet.guestCount > 0 ? `${sheet.guestCount} Guests` : 'Not Specified'}
                    </strong>
                  </div>
                  {sheet.eventAddress && (
                    <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100">
                      <span className="text-slate-400 block mb-0.5">Delivery Address:</span>
                      <p className="text-slate-800 font-medium">{sheet.eventAddress}</p>
                    </div>
                  )}
                </div>

                {/* Preparation Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isTa ? 'உணவு தயாரிப்பு அட்டவணை' : 'Food Preparation Table'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isTa
                          ? 'இறுதி தயாரிப்பு அளவுகள் மற்றும் அலகுகளை உள்ளிடவும்'
                          : 'Enter final preparation quantities, units, and cooking instructions for the cooking master'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{isTa ? '+ உணவு சேர்க்க' : '+ Add Food Item'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-3 text-center w-12">#</th>
                          <th className="py-3 px-4 text-left min-w-[200px]">Food Item / Dish Name</th>
                          <th className="py-3 px-3 text-center w-28">Customer Qty</th>
                          <th className="py-3 px-3 text-left w-36">Final Prep Qty *</th>
                          <th className="py-3 px-3 text-left w-36">Unit</th>
                          <th className="py-3 px-4 text-left min-w-[180px]">Kitchen Notes</th>
                          <th className="py-3 px-3 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sheet.items.map((item, idx) => {
                          const hasError = !!validationErrors[item.id];
                          const custQtyLabel =
                            item.customerQuantity !== null && item.customerQuantity !== undefined
                              ? `${item.customerQuantity} ${item.customerUnit || item.unit}`
                              : '—';

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                hasError ? 'bg-red-50/60' : ''
                              }`}
                            >
                              {/* S.No */}
                              <td className="py-3 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              {/* Dish Name */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={item.dishName}
                                  onChange={(e) => updateItem(item.id, { dishName: e.target.value })}
                                  className="w-full font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none py-1"
                                />
                                {item.dishNameTa && (
                                  <span className="text-[11px] text-slate-500 block font-normal">
                                    {item.dishNameTa}
                                  </span>
                                )}
                              </td>

                              {/* Customer Quantity (read-only reference) */}
                              <td className="py-3 px-3 text-center">
                                <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 font-medium rounded-lg text-xs">
                                  {custQtyLabel}
                                </span>
                              </td>

                              {/* Final Preparation Quantity (Editable) */}
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.01"
                                    placeholder="Enter qty"
                                    value={item.prepQuantity !== null ? item.prepQuantity : ''}
                                    onChange={(e) => updateItem(item.id, { prepQuantity: e.target.value })}
                                    className={`w-full px-2.5 py-1.5 rounded-xl border text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                                      hasError
                                        ? 'border-red-400 bg-red-50 focus:ring-red-400 text-red-900'
                                        : 'border-slate-300 bg-white focus:ring-primary/40'
                                    }`}
                                  />
                                  {hasError && (
                                    <span className="text-[10px] text-red-600 font-bold block">
                                      {validationErrors[item.id]}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Unit Selector */}
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <select
                                    value={item.isCustomUnit ? 'Custom' : item.unit}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'Custom') {
                                        updateItem(item.id, { isCustomUnit: true });
                                      } else {
                                        updateItem(item.id, { unit: val, isCustomUnit: false });
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                                  >
                                    {KITCHEN_UNIT_OPTIONS.map((u) => (
                                      <option key={u.value} value={u.value}>
                                        {isTa ? u.labelTa : u.labelEn}
                                      </option>
                                    ))}
                                  </select>

                                  {item.isCustomUnit && (
                                    <input
                                      type="text"
                                      placeholder="Custom unit"
                                      value={item.unit}
                                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                      className="w-full px-2 py-1 border border-primary/50 rounded-lg text-xs font-semibold focus:outline-none"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Kitchen Notes */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  placeholder="e.g. Less spicy, keep warm"
                                  value={item.kitchenNotes || ''}
                                  onChange={(e) => updateItem(item.id, { kitchenNotes: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              </td>

                              {/* Delete Action */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove item from kitchen sheet"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* General Cooking Instructions / Kitchen Notes */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    {isTa
                      ? 'சமையல் மாஸ்டருக்கான பொதுவான குறிப்புகள் (Special Cooking Instructions)'
                      : 'General Cooking & Kitchen Instructions'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      isTa
                        ? 'எ.கா: உணவு 11:30 மணிக்கு முன்பே தயாராக இருக்க வேண்டும். காரம் குறைவாக வைக்கவும்.'
                        : 'e.g. Food must be ready before 11:30 AM. Pack beverages separately. Moderate spice level.'
                    }
                    value={sheet.cookingInstructions || ''}
                    onChange={(e) => setSheet((prev) => ({ ...prev, cookingInstructions: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            ) : (
              /* PREVIEW MODE (A4 PAPER PREVIEW) */
              <div className="flex justify-center">
                <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none p-6 sm:p-8 space-y-6">
                  {/* Business Header */}
                  <div className="flex items-start justify-between border-b-2 border-primary pb-4 gap-4">
                    <div className="flex items-center gap-3.5 max-w-[70%]">
                      <img src={logoImg} alt={siteConfig.name} className="w-14 h-14 object-contain rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                          {siteConfig.name}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Ph: +91 {siteConfig.whatsappNumber} • Traditional South Indian Catering
                        </p>
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mt-0.5">
                          {selectedLanguage === 'ta'
                            ? 'சமையல் தயாரிப்பு பட்டியல்'
                            : 'Kitchen Preparation Order Sheet'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                          Order ID
                        </span>
                        <span className="font-mono text-base font-bold text-primary">{sheet.orderId}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Status: <strong className="text-slate-800">{sheet.status}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Customer Name:</span>
                      <strong className="text-slate-900 text-sm">{sheet.customerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mobile:</span>
                      <strong className="text-slate-900 text-sm">{sheet.mobile}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Delivery Date & Time:</span>
                      <strong className="text-slate-900 text-sm">
                        {formatDate(sheet.orderDate)} {sheet.deliveryTime ? `• ${sheet.deliveryTime}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Number of People:</span>
                      <strong className="text-slate-900 text-sm">
                        {sheet.guestCount && sheet.guestCount > 0
                          ? `${sheet.guestCount} Guests / People`
                          : 'Kg-based / Custom order'}
                      </strong>
                    </div>
                    {sheet.eventAddress && (
                      <div className="col-span-2 pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 block">Delivery Address:</span>
                        <p className="text-slate-800 font-medium">{sheet.eventAddress}</p>
                      </div>
                    )}
                  </div>

                  {/* Clean Preparation Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-primary text-white font-bold uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-4 text-left">Food Item / Dish Name</th>
                          <th className="py-2.5 px-3 text-center w-28">Customer Qty</th>
                          <th className="py-2.5 px-3 text-center w-28 bg-slate-800">Final Prep Qty</th>
                          <th className="py-2.5 px-3 text-center w-24">Unit</th>
                          <th className="py-2.5 px-4 text-left">Kitchen Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sheet.items.map((item, i) => {
                          const custQtyStr =
                            item.customerQuantity !== null && item.customerQuantity !== undefined
                              ? `${item.customerQuantity} ${item.customerUnit || item.unit}`
                              : '—';

                          const displayName =
                            selectedLanguage === 'ta' && item.dishNameTa
                              ? item.dishNameTa
                              : selectedLanguage === 'both' && item.dishNameTa
                              ? `${item.dishName} (${item.dishNameTa})`
                              : item.dishName;

                          return (
                            <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">{i + 1}</td>
                              <td className="py-2.5 px-4 font-bold text-slate-900">{displayName}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500">{custQtyStr}</td>
                              <td className="py-2.5 px-3 text-center font-extrabold text-primary text-sm bg-blue-50/60">
                                {item.prepQuantity || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                                {formatUnitLabel(item.unit, selectedLanguage === 'ta')}
                              </td>
                              <td className="py-2.5 px-4 italic text-slate-500">
                                {item.kitchenNotes || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cooking Instructions */}
                  {sheet.cookingInstructions && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                      <strong className="text-amber-900 block font-bold uppercase tracking-wider">
                        Special Cooking Instructions:
                      </strong>
                      <p className="text-amber-800">{sheet.cookingInstructions}</p>
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs text-slate-500">
                    <div className="border-t border-slate-300 pt-2 font-medium">
                      Prepared by
                    </div>
                    <div className="border-t border-slate-300 pt-2 font-bold text-slate-800">
                      Cooking Master Sign
                    </div>
                    <div className="border-t border-slate-300 pt-2 font-medium">
                      Verified & Dispatched
                    </div>
                  </div>

                  {/* Computer-generated document notice */}
                  <div className="pt-3 border-t border-dashed border-slate-200 text-center text-[11px] text-slate-500 italic">
                    {selectedLanguage === 'ta'
                      ? 'இது காஞ்சி அம்பாள் கேட்டரிங் இணையதளம் மூலம் கணினியில் உருவாக்கப்பட்ட ஆவணமாகும். கையொப்பம் தேவையில்லை.'
                      : 'This is a computer-generated document from Kanchi Ambal Catering. No handwritten signature is required.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
