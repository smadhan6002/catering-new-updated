import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  FileDown,
  Check,
  Calendar,
  User,
  Package,
} from 'lucide-react';
import type { RentalDocument, RentalDocItem, RentalStatus } from '../../types/rental';
import { rentalService } from '../../services/rentalService';
import { generateRentalPDF } from '../../utils/generateRentalPDF';
import { useLanguage } from '../../context/LanguageContext';

interface RentalDocumentModalProps {
  documentId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (doc: RentalDocument) => void;
}

export const RentalDocumentModal: React.FC<RentalDocumentModalProps> = ({
  documentId,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [functionName, setFunctionName] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const [documentDate, setDocumentDate] = useState(today);
  const [functionDate, setFunctionDate] = useState(today);
  const [rentalStartDate, setRentalStartDate] = useState(today);
  const [expectedReturnDate, setExpectedReturnDate] = useState(today);
  const [actualReturnDate, setActualReturnDate] = useState('');
  const [deliveryDetails, setDeliveryDetails] = useState('');

  const [items, setItems] = useState<RentalDocItem[]>([]);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [securityDeposit, setSecurityDeposit] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [status, setStatus] = useState<RentalStatus>('Confirmed');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingLang, setDownloadingLang] = useState<'en' | 'ta' | null>(null);

  // Available catalog items for dropdown
  const catalogItems = rentalService.getActiveItems();

  useEffect(() => {
    if (documentId) {
      const doc = rentalService.getDocumentById(documentId);
      if (doc) {
        setCustomerName(doc.customerName);
        setMobile(doc.mobile);
        setAddress(doc.address || '');
        setFunctionName(doc.functionName || '');
        setDocumentDate(doc.documentDate);
        setFunctionDate(doc.functionDate);
        setRentalStartDate(doc.rentalStartDate);
        setExpectedReturnDate(doc.expectedReturnDate);
        setActualReturnDate(doc.actualReturnDate || '');
        setDeliveryDetails(doc.deliveryDetails || '');
        setItems(doc.items);
        setAdditionalCharges(doc.additionalCharges);
        setDiscount(doc.discount);
        setSecurityDeposit(doc.securityDeposit);
        setAdvancePaid(doc.advancePaid);
        setStatus(doc.status);
        setNotes(doc.notes || '');
      }
    } else {
      // Initialize with 1 empty item
      if (catalogItems.length > 0) {
        const first = catalogItems[0];
        setItems([
          {
            itemId: first.id,
            itemCode: first.code,
            nameEn: first.nameEn,
            nameTa: first.nameTa,
            quantity: 1,
            pricePerUnit: first.rentalPrice,
            pricingUnit: first.pricingUnit,
            lineTotal: first.rentalPrice,
            returnedQuantity: 0,
            notes: '',
          },
        ]);
        setSecurityDeposit(first.securityDeposit || 0);
      } else {
        setItems([]);
      }
      setCustomerName('');
      setMobile('');
      setAddress('');
      setFunctionName('');
      setDocumentDate(today);
      setFunctionDate(today);
      setRentalStartDate(today);
      setExpectedReturnDate(today);
      setActualReturnDate('');
      setDeliveryDetails('');
      setAdditionalCharges(0);
      setDiscount(0);
      setAdvancePaid(0);
      setStatus('Confirmed');
      setNotes('');
    }
  }, [documentId, isOpen]);

  if (!isOpen) return null;

  // Real-time calculated totals
  const subtotal = items.reduce((s, itm) => s + (Number(itm.quantity || 0) * Number(itm.pricePerUnit || 0)), 0);
  const grandTotal = Math.max(0, subtotal + Number(additionalCharges || 0) - Number(discount || 0) + Number(securityDeposit || 0));
  const balanceDue = Math.max(0, grandTotal - Number(advancePaid || 0));
  const totalQuantity = items.reduce((s, itm) => s + (Number(itm.quantity) || 0), 0);

  function handleSelectItem(index: number, itemId: string) {
    const selected = catalogItems.find((i) => i.id === itemId);
    if (!selected) return;

    setItems((prev) => {
      const next = [...prev];
      const curQty = next[index]?.quantity || 1;
      next[index] = {
        itemId: selected.id,
        itemCode: selected.code,
        nameEn: selected.nameEn,
        nameTa: selected.nameTa,
        quantity: curQty,
        pricePerUnit: selected.rentalPrice,
        pricingUnit: selected.pricingUnit,
        lineTotal: curQty * selected.rentalPrice,
        returnedQuantity: 0,
        notes: next[index]?.notes || '',
      };
      return next;
    });

    // Auto increment suggested deposit if not set
    if (securityDeposit === 0 && selected.securityDeposit) {
      setSecurityDeposit(selected.securityDeposit);
    }
  }

  function handleUpdateQuantity(index: number, qtyStr: string) {
    const qty = Math.max(0, parseInt(qtyStr, 10) || 0);
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].quantity = qty;
        next[index].lineTotal = qty * next[index].pricePerUnit;
      }
      return next;
    });
  }

  function handleUpdatePrice(index: number, priceStr: string) {
    const price = Math.max(0, parseFloat(priceStr) || 0);
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].pricePerUnit = price;
        next[index].lineTotal = next[index].quantity * price;
      }
      return next;
    });
  }

  function handleUpdateNotes(index: number, val: string) {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index].notes = val;
      }
      return next;
    });
  }

  function handleAddItem() {
    if (catalogItems.length === 0) return;
    const first = catalogItems[0];
    setItems((prev) => [
      ...prev,
      {
        itemId: first.id,
        itemCode: first.code,
        nameEn: first.nameEn,
        nameTa: first.nameTa,
        quantity: 1,
        pricePerUnit: first.rentalPrice,
        pricingUnit: first.pricingUnit,
        lineTotal: first.rentalPrice,
        returnedQuantity: 0,
        notes: '',
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) {
      setError(isTa ? 'குறைந்தது ஒரு வாடகைப் பொருளாவது இருக்க வேண்டும்.' : 'At least one rental item is required.');
      return;
    }
    setError('');
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError('');
    if (!customerName.trim()) {
      setError(isTa ? 'வாடிக்கையாளர் பெயர் அவசியம்.' : 'Customer name is required.');
      return;
    }
    if (!mobile.trim()) {
      setError(isTa ? 'மொபைல் எண் அவசியம்.' : 'Mobile number is required.');
      return;
    }
    if (items.length === 0) {
      setError(isTa ? 'தயவுசெய்து பொருட்களைச் சேர்க்கவும்.' : 'Please add at least one rental item.');
      return;
    }

    // Check non-zero quantities
    const zeroItem = items.find((i) => i.quantity <= 0);
    if (zeroItem) {
      setError(isTa ? `"${zeroItem.nameEn}" அளவு 0 ஆக இருக்க முடியாது.` : `Quantity for "${zeroItem.nameEn}" must be greater than 0.`);
      return;
    }

    setSaving(true);
    try {
      let savedDoc: RentalDocument;
      if (documentId) {
        const res = await rentalService.updateDocument(documentId, {
          customerName: customerName.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          functionName: functionName.trim(),
          documentDate,
          functionDate,
          rentalStartDate,
          expectedReturnDate,
          actualReturnDate: actualReturnDate || undefined,
          deliveryDetails: deliveryDetails.trim(),
          items,
          additionalCharges,
          discount,
          securityDeposit,
          advancePaid,
          status,
          notes: notes.trim(),
        });
        if (!res) throw new Error('Failed to update rental document');
        savedDoc = res;
      } else {
        savedDoc = await rentalService.addDocument({
          customerName: customerName.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          functionName: functionName.trim(),
          documentDate,
          functionDate,
          rentalStartDate,
          expectedReturnDate,
          actualReturnDate: actualReturnDate || undefined,
          deliveryDetails: deliveryDetails.trim(),
          items,
          additionalCharges,
          discount,
          securityDeposit,
          advancePaid,
          status,
          notes: notes.trim(),
        });
      }

      onSaved(savedDoc);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error saving rental document');
    } finally {
      setSaving(false);
    }
  }

  async function handleInstantDownload(langChoice: 'en' | 'ta') {
    if (!customerName.trim() || items.length === 0) {
      setError(isTa ? 'PDF பதிவிறக்க வாடிக்கையாளர் பெயர் மற்றும் பொருட்கள் தேவை.' : 'Customer name and items are required to generate PDF.');
      return;
    }

    setDownloadingLang(langChoice);
    try {
      // Transient doc object for immediate download
      const tempDoc: RentalDocument = {
        id: documentId || 'temp',
        rentalNumber: documentId ? (rentalService.getDocumentById(documentId)?.rentalNumber || 'RENT-PREVIEW') : 'RENT-NEW',
        customerName: customerName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        functionName: functionName.trim(),
        documentDate,
        functionDate,
        rentalStartDate,
        expectedReturnDate,
        actualReturnDate: actualReturnDate || undefined,
        deliveryDetails: deliveryDetails.trim(),
        items,
        subtotal,
        additionalCharges,
        discount,
        securityDeposit,
        grandTotal,
        advancePaid,
        balanceDue,
        status,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      await generateRentalPDF(tempDoc, langChoice);
    } finally {
      setDownloadingLang(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-primary flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {documentId
                  ? (isTa ? 'வாடகை ஆவணத்தைத் திருத்து' : 'Edit Rental Transaction')
                  : (isTa ? 'புதிய வாடகை ஆவணம் உருவாக்கு' : 'Create New Rental Transaction')}
              </h3>
              <p className="text-xs text-slate-500">
                {isTa ? 'விசேஷ பாத்திரங்கள் வாடகை பட்டியல் & ரசீது' : 'Function Utensils & Equipment Rental Invoice'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Buttons in Modal */}
            <button
              type="button"
              onClick={() => handleInstantDownload('ta')}
              disabled={downloadingLang !== null}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200 cursor-pointer transition-colors"
              title="Download Tamil PDF"
            >
              <FileDown size={14} />
              <span>தமிழ் PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleInstantDownload('en')}
              disabled={downloadingLang !== null}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 cursor-pointer transition-colors"
              title="Download English PDF"
            >
              <FileDown size={14} />
              <span>EN PDF</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer Details */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
              <User size={15} className="text-primary" />
              <span>{isTa ? 'வாடிக்கையாளர் விவரங்கள்' : 'Customer Details'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'கைப்பேசி எண் (Mobile)' : 'Mobile Number'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'நிகழ்ச்சி / விசேஷம்' : 'Function / Event Description'}
                </label>
                <input
                  type="text"
                  value={functionName}
                  onChange={(e) => setFunctionName(e.target.value)}
                  placeholder="e.g. Wedding Reception"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'முகவரி / மண்டபம்' : 'Event Address / Venue'}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Mandapam, Kanchipuram"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Schedule */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
              <Calendar size={15} className="text-primary" />
              <span>{isTa ? 'தேதி & அட்டவணை விவரங்கள்' : 'Rental Schedule & Dates'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'ஆவணத் தேதி' : 'Document Date'}
                </label>
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'விசேஷ தேதி' : 'Function Date'}
                </label>
                <input
                  type="date"
                  value={functionDate}
                  onChange={(e) => setFunctionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'வழங்கும் தேதி (Start)' : 'Rental Start Date'}
                </label>
                <input
                  type="date"
                  value={rentalStartDate}
                  onChange={(e) => setRentalStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">
                  {isTa ? 'திருப்பித் தரும் தேதி' : 'Expected Return Date'}
                </label>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'வாடகை நிலை' : 'Rental Status'}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RentalStatus)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-semibold cursor-pointer"
                >
                  <option value="Draft">Draft</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Items Issued">Items Issued</option>
                  <option value="Partially Returned">Partially Returned</option>
                  <option value="Returned">Returned</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Rental Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                <Package size={15} className="text-primary" />
                <span>{isTa ? 'வாடகைப் பொருட்கள் பட்டியல்' : 'Rented Items Table'}</span>
                <span className="text-xs bg-blue-100 text-primary px-2 py-0.5 rounded-full font-bold">
                  {items.length} {isTa ? 'வகைகள்' : 'items'} ({totalQuantity} {isTa ? 'எண்ணிக்கை' : 'units'})
                </span>
              </h4>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>{isTa ? 'பொருள் சேர்' : 'Add Item'}</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">{isTa ? 'வ.எண்' : 'S.No'}</th>
                    <th className="px-3 py-2.5 text-left">{isTa ? 'பொருள் (Item)' : 'Select Rental Item'}</th>
                    <th className="px-3 py-2.5 text-left w-24">{isTa ? 'அளவு' : 'Qty'}</th>
                    <th className="px-3 py-2.5 text-left w-28">{isTa ? 'விலை / அலகு' : 'Price / Unit'}</th>
                    <th className="px-3 py-2.5 text-left w-28">{isTa ? 'மொத்தம்' : 'Line Total'}</th>
                    <th className="px-3 py-2.5 text-left">{isTa ? 'குறிப்பு' : 'Item Notes'}</th>
                    <th className="px-3 py-2.5 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((itm, idx) => {
                    const catalogItem = catalogItems.find((c) => c.id === itm.itemId);
                    const isOverbooked = Boolean(
                      catalogItem && catalogItem.totalQuantity > 0 && itm.quantity > catalogItem.availableQuantity
                    );

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        {/* S.No */}
                        <td className="px-3 py-2.5 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Item Selector */}
                        <td className="px-3 py-2.5 min-w-[220px]">
                          <select
                            value={itm.itemId}
                            onChange={(e) => handleSelectItem(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                          >
                            {catalogItems.map((ci) => (
                              <option key={ci.id} value={ci.id}>
                                [{ci.code}] {isTa ? ci.nameTa : ci.nameEn} (
                                {ci.rentalPrice > 0
                                  ? `₹${ci.rentalPrice} / ${ci.pricingUnit}`
                                  : isTa ? 'விலை இல்லை' : 'Rate not set'}
                                {ci.totalQuantity > 0
                                  ? ` • ${isTa ? 'இருப்பு' : 'Avail'}: ${ci.availableQuantity}`
                                  : ''}
                                )
                              </option>
                            ))}
                          </select>

                          {/* Inventory Availability Warning */}
                          {isOverbooked && catalogItem && (
                            <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-semibold">
                              <AlertTriangle size={12} className="flex-shrink-0" />
                              <span>
                                {isTa
                                  ? `இருப்பு எச்சரிக்கை: தற்போதைய இருப்பு ${catalogItem.availableQuantity} மட்டுமே!`
                                  : `Stock warning: Available stock is ${catalogItem.availableQuantity} units!`}
                              </span>
                            </p>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="1"
                            value={itm.quantity}
                            onChange={(e) => handleUpdateQuantity(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </td>

                        {/* Price Per Unit */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={itm.pricePerUnit}
                              onChange={(e) => handleUpdatePrice(idx, e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                        </td>

                        {/* Line Total */}
                        <td className="px-3 py-2.5 font-bold text-primary">
                          ₹{itm.lineTotal.toLocaleString('en-IN')}
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={itm.notes || ''}
                            onChange={(e) => handleUpdateNotes(idx, e.target.value)}
                            placeholder={isTa ? 'குறிப்புகள்...' : 'Notes (condition, marks)…'}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md cursor-pointer transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Financial Summary & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Operational Notes & Delivery */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'டெலிவரி அல்லது எடுத்துச்செல்லும் விவரங்கள்' : 'Delivery & Collection Logistics'}
                </label>
                <textarea
                  rows={2}
                  value={deliveryDetails}
                  onChange={(e) => setDeliveryDetails(e.target.value)}
                  placeholder={isTa ? 'வாடிக்கையாளரே எடுத்துச் செல்கிறார் / ஆட்டோ அனுப்பப்பட்டது...' : 'e.g. Customer will collect at 9 AM / Auto dispatch…'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'உள் நிர்வாகக் குறிப்புகள் (Damage / Missing notes)' : 'Internal Notes / Damage / Missing items'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isTa ? 'சேதமடைந்தவை, திரும்ப வராதவை பற்றிய குறிப்புகள்...' : 'e.g. 1 plate dented, returned on time…'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Right: Calculations */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>{isTa ? 'வாடகைத் தொகை (Subtotal):' : 'Rental Subtotal:'}</span>
                <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">{isTa ? 'கூடுதல் கட்டணம் / வண்டி:' : 'Additional Charges:'}</span>
                <div className="w-28 flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">{isTa ? 'தள்ளுபடி (Discount):' : 'Discount:'}</span>
                <div className="w-28 flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right text-green-700 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600">{isTa ? 'பாதுகாப்பு வைப்புத்தொகை (Deposit):' : 'Security Deposit:'}</span>
                <div className="w-28 flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span>{isTa ? 'மொத்தத் தொகை (Grand Total):' : 'Grand Total:'}</span>
                <span className="text-primary text-base">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center gap-2 pt-1">
                <span className="text-slate-700 font-semibold">{isTa ? 'செலுத்தப்பட்ட முன்பணம் (Advance):' : 'Advance Paid:'}</span>
                <div className="w-28 flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-green-700"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center font-bold text-xs pt-1 border-t border-slate-200">
                <span className="text-red-700">{isTa ? 'மீதமுள்ள தொகை (Balance Due):' : 'Balance Due:'}</span>
                <span className="text-red-700 text-sm font-bold">₹{balanceDue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {isTa ? 'ஆவண மொழி:' : 'Generate PDF in:'}
            </span>
            <button
              type="button"
              onClick={() => handleInstantDownload('ta')}
              disabled={downloadingLang !== null}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              தமிழ்
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => handleInstantDownload('en')}
              disabled={downloadingLang !== null}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              English
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs sm:text-sm cursor-pointer transition-colors"
            >
              {isTa ? 'ரத்து' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm cursor-pointer transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isTa ? 'சேமிக்கப்படுகிறது...' : 'Saving…'}</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isTa ? 'ஆவணத்தைச் சேமி' : 'Save Document'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
