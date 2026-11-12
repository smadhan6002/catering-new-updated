import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  Phone,
  Clock,
  Printer,
  FileText,
  Boxes,
} from 'lucide-react';
import type {
  RentalItem,
  RentalDocument,
  RentalCategory,
  RentalStatus,
  RentalPricingUnit,
} from '../../types/rental';
import { rentalService } from '../../services/rentalService';
import { RentalDocumentModal } from './RentalDocumentModal';
import { generateRentalPDF } from '../../utils/generateRentalPDF';
import { useLanguage } from '../../context/LanguageContext';

export const AdminRentalItems: React.FC = () => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [activeTab, setActiveTab] = useState<'documents' | 'inventory' | 'categories'>('documents');
  const [documents, setDocuments] = useState<RentalDocument[]>([]);
  const [items, setItems] = useState<RentalItem[]>([]);
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modals
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // Item Add/Edit modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    code: '',
    nameEn: '',
    nameTa: '',
    categoryId: '',
    totalQuantity: 10,
    rentalPrice: 50,
    pricingUnit: 'Per Day' as RentalPricingUnit,
    securityDeposit: 100,
    description: '',
    notes: '',
    isActive: true,
  });
  const [itemFormError, setItemFormError] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // Category Add/Edit modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', nameTa: '', description: '' });
  const [catSaving, setCatSaving] = useState(false);

  // Return Document Modal
  const [returnModalDoc, setReturnModalDoc] = useState<RentalDocument | null>(null);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnNotes, setReturnNotes] = useState('');

  // Delete Confirmations
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<RentalDocument | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<RentalItem | null>(null);

  // PDF downloading states
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Search & Filters for Documents
  const [docSearch, setDocSearch] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState('all');
  const [docDateFilter, setDocDateFilter] = useState('');

  // Search & Filters for Inventory
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all');
  const [itemStockFilter, setItemStockFilter] = useState<'all' | 'available' | 'low' | 'out' | 'unset'>('all');

  function reloadAll() {
    setDocuments(rentalService.getAllDocuments());
    setItems(rentalService.getAllItems());
    setCategories(rentalService.getCategories());

    rentalService.syncFromSupabase().then(() => {
      setDocuments(rentalService.getAllDocuments());
      setItems(rentalService.getAllItems());
      setCategories(rentalService.getCategories());
    }).catch(() => {});
  }

  useEffect(() => {
    reloadAll();
  }, []);

  function showToast(msg: string, isError = false) {
    setToast({ text: msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── DOCUMENT ACTIONS ───────────────────────────────────────────
  function openNewDocument() {
    setEditingDocId(null);
    setDocModalOpen(true);
  }

  function openEditDocument(doc: RentalDocument) {
    setEditingDocId(doc.id);
    setDocModalOpen(true);
  }

  async function handleDownloadPDF(doc: RentalDocument, pdfLang: 'en' | 'ta') {
    setDownloadingDocId(`${doc.id}-${pdfLang}`);
    try {
      await generateRentalPDF(doc, pdfLang);
      showToast(
        isTa
          ? `வாடகை ஆவணம் (${pdfLang.toUpperCase()}) பதிவிறக்கப்பட்டது!`
          : `Rental Document (${pdfLang.toUpperCase()}) downloaded!`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error generating PDF');
    } finally {
      setDownloadingDocId(null);
    }
  }

  function handlePrintDocument(doc: RentalDocument) {
    handleDownloadPDF(doc, isTa ? 'ta' : 'en');
  }

  function openReturnModal(doc: RentalDocument) {
    setReturnModalDoc(doc);
    setActualReturnDate(new Date().toISOString().split('T')[0]);
    setReturnNotes('');
  }

  async function handleConfirmReturn() {
    if (!returnModalDoc) return;
    try {
      await rentalService.updateStatus(returnModalDoc.id, 'Returned', actualReturnDate, returnNotes);
      showToast(
        isTa
          ? `வாடகை ஆவணம் ${returnModalDoc.rentalNumber} திரும்பப் பெறப்பட்டது என குறிக்கப்பட்டது!`
          : `Rental ${returnModalDoc.rentalNumber} marked as returned!`
      );
      setReturnModalDoc(null);
      reloadAll();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update return status.', true);
    }
  }

  async function handleDeleteDocument(doc: RentalDocument) {
    try {
      await rentalService.deleteDocument(doc.id);
      setDeleteDocConfirm(null);
      showToast(isTa ? `வாடகை ஆவணம் ${doc.rentalNumber} நீக்கப்பட்டது.` : `Document ${doc.rentalNumber} deleted.`);
      reloadAll();
    } catch (err: any) {
      setDeleteDocConfirm(null);
      showToast(err?.message || 'Failed to delete rental document.', true);
    }
  }

  // ─── ITEM ACTIONS ───────────────────────────────────────────────
  function openAddItem() {
    setEditingItemId(null);
    const cats = rentalService.getCategories();
    const maxCodeNum = items.reduce((max, it) => {
      const m = /^RNT-(\d+)$/i.exec(it.code.trim());
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const nextCode = `RNT-${String(Math.max(items.length + 1, maxCodeNum + 1)).padStart(3, '0')}`;
    setItemForm({
      code: nextCode,
      nameEn: '',
      nameTa: '',
      categoryId: cats[0]?.id || 'cat-cooking',
      totalQuantity: 10,
      rentalPrice: 50,
      pricingUnit: 'Per Day',
      securityDeposit: 100,
      description: '',
      notes: '',
      isActive: true,
    });
    setItemFormError('');
    setItemModalOpen(true);
  }

  function openEditItem(item: RentalItem) {
    setEditingItemId(item.id);
    setItemForm({
      code: item.code,
      nameEn: item.nameEn,
      nameTa: item.nameTa,
      categoryId: item.categoryId,
      totalQuantity: item.totalQuantity,
      rentalPrice: item.rentalPrice,
      pricingUnit: item.pricingUnit as RentalPricingUnit,
      securityDeposit: item.securityDeposit || 0,
      description: item.description || '',
      notes: item.notes || '',
      isActive: item.isActive,
    });
    setItemFormError('');
    setItemModalOpen(true);
  }

  async function handleSaveItem() {
    setItemFormError('');
    if (!itemForm.nameEn.trim() && !itemForm.nameTa.trim()) {
      setItemFormError(isTa ? 'பொருளின் பெயர் (ஆங்கிலம் அல்லது தமிழ்) அவசியம்.' : 'Item name (English or Tamil) is required.');
      return;
    }
    if (!itemForm.code.trim()) {
      setItemFormError(isTa ? 'பொருள் குறியீடு (Item Code) அவசியம்.' : 'Item code is required.');
      return;
    }
    if (itemForm.rentalPrice < 0) {
      setItemFormError(isTa ? 'வாடகை விலை எதிர்மறையாக இருக்க முடியாது.' : 'Rental price cannot be negative.');
      return;
    }
    if (itemForm.totalQuantity < 0) {
      setItemFormError(isTa ? 'மொத்த இருப்பு எதிர்மறையாக இருக்க முடியாது.' : 'Inventory quantity cannot be negative.');
      return;
    }

    setItemSaving(true);
    try {
      if (editingItemId) {
        await rentalService.updateItem(editingItemId, {
          code: itemForm.code.trim(),
          nameEn: itemForm.nameEn.trim() || itemForm.nameTa.trim(),
          nameTa: itemForm.nameTa.trim() || itemForm.nameEn.trim(),
          categoryId: itemForm.categoryId,
          totalQuantity: Number(itemForm.totalQuantity),
          rentalPrice: Number(itemForm.rentalPrice),
          pricingUnit: itemForm.pricingUnit,
          securityDeposit: Number(itemForm.securityDeposit),
          description: itemForm.description.trim(),
          notes: itemForm.notes.trim(),
          isActive: itemForm.isActive,
        });
        showToast(isTa ? 'வாடகை பொருள் புதுப்பிக்கப்பட்டது!' : 'Rental item updated successfully.');
      } else {
        await rentalService.addItem({
          code: itemForm.code.trim(),
          nameEn: itemForm.nameEn.trim() || itemForm.nameTa.trim(),
          nameTa: itemForm.nameTa.trim() || itemForm.nameEn.trim(),
          categoryId: itemForm.categoryId,
          totalQuantity: Number(itemForm.totalQuantity),
          rentalPrice: Number(itemForm.rentalPrice),
          pricingUnit: itemForm.pricingUnit,
          securityDeposit: Number(itemForm.securityDeposit),
          description: itemForm.description.trim(),
          notes: itemForm.notes.trim(),
          isActive: itemForm.isActive,
        });
        showToast(isTa ? 'புதிய வாடகை பொருள் சேர்க்கப்பட்டது!' : 'New rental item added.');
      }
      setItemModalOpen(false);
      reloadAll();
    } catch (err: any) {
      setItemFormError(err?.message || 'Error saving rental item');
    } finally {
      setItemSaving(false);
    }
  }

  async function handleDeleteItem(item: RentalItem) {
    try {
      const res = await rentalService.deleteItem(item.id);
      setDeleteItemConfirm(null);
      if (res.softDeleted) {
        showToast(
          isTa
            ? `"${item.nameTa || item.nameEn}" முந்தைய ஆர்டர்களில் உள்ளதால் பாதுகாப்பாக செயலிழக்கப்பட்டது.`
            : `"${item.nameEn}" is referenced in rental documents and has been safely deactivated.`
        );
      } else {
        showToast(isTa ? `"${item.nameTa || item.nameEn}" நீக்கப்பட்டது.` : `"${item.nameEn}" removed.`);
      }
      reloadAll();
    } catch (err: any) {
      setDeleteItemConfirm(null);
      showToast(err?.message || 'Failed to delete rental item.', true);
    }
  }

  async function handleToggleItemActive(item: RentalItem) {
    try {
      await rentalService.updateItem(item.id, { isActive: !item.isActive });
      showToast(item.isActive ? 'Item deactivated.' : 'Item reactivated.');
      reloadAll();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update item status.', true);
    }
  }

  // ─── CATEGORY ACTIONS ───────────────────────────────────────────
  function handleSaveCategory() {
    if (!catForm.name.trim() && !catForm.nameTa.trim()) return;
    setCatSaving(true);
    try {
      rentalService.addCategory({
        name: catForm.name.trim() || catForm.nameTa.trim(),
        nameTa: catForm.nameTa.trim() || catForm.name.trim(),
        description: catForm.description.trim(),
      });
      setCatModalOpen(false);
      setCatForm({ name: '', nameTa: '', description: '' });
      showToast(isTa ? 'புதிய வாடகைப் பிரிவு சேர்க்கப்பட்டது!' : 'Rental category added.');
      reloadAll();
    } finally {
      setCatSaving(false);
    }
  }

  // ─── FILTERED DATA ──────────────────────────────────────────────
  const filteredDocuments = useMemo(() => {
    let list = [...documents];

    if (docStatusFilter !== 'all') {
      list = list.filter((d) => d.status === docStatusFilter);
    }

    if (docDateFilter) {
      list = list.filter((d) => d.functionDate === docDateFilter || d.documentDate === docDateFilter);
    }

    if (docSearch.trim()) {
      const q = docSearch.toLowerCase().trim();
      list = list.filter((d) => {
        const noMatch = d.rentalNumber.toLowerCase().includes(q);
        const nameMatch = d.customerName.toLowerCase().includes(q);
        const phoneMatch = d.mobile.includes(q);
        const funcMatch = (d.functionName || '').toLowerCase().includes(q);
        return noMatch || nameMatch || phoneMatch || funcMatch;
      });
    }

    return list;
  }, [documents, docStatusFilter, docDateFilter, docSearch]);

  const filteredItems = useMemo(() => {
    let list = [...items];

    if (itemCategoryFilter !== 'all') {
      list = list.filter((i) => i.categoryId === itemCategoryFilter);
    }

    if (itemStockFilter === 'available') {
      list = list.filter((i) => i.availableQuantity > 0);
    } else if (itemStockFilter === 'low') {
      list = list.filter((i) => i.totalQuantity > 0 && i.availableQuantity > 0 && i.availableQuantity <= 5);
    } else if (itemStockFilter === 'out') {
      list = list.filter((i) => i.totalQuantity > 0 && i.availableQuantity === 0);
    } else if (itemStockFilter === 'unset') {
      list = list.filter((i) => i.totalQuantity === 0);
    }

    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim();
      list = list.filter((i) => {
        const codeMatch = i.code.toLowerCase().includes(q);
        const enMatch = i.nameEn.toLowerCase().includes(q);
        const taMatch = (i.nameTa || '').toLowerCase().includes(q);
        return codeMatch || enMatch || taMatch;
      });
    }

    return list;
  }, [items, itemCategoryFilter, itemStockFilter, itemSearch]);

  // Overall Statistics
  const activeRentalDocs = documents.filter(
    (d) => d.status === 'Confirmed' || d.status === 'Items Issued' || d.status === 'Partially Returned'
  ).length;
  const totalItemsOwned = items.reduce((s, i) => s + (Number(i.totalQuantity) || 0), 0);
  const totalItemsAvailable = items.reduce((s, i) => s + (Number(i.availableQuantity) || 0), 0);
  const totalRentedOut = Math.max(0, totalItemsOwned - totalItemsAvailable);

  const statusBadge = (st: RentalStatus) => {
    const config: Record<RentalStatus, { bg: string; text: string }> = {
      Draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
      Confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Items Issued': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'Partially Returned': { bg: 'bg-amber-100', text: 'text-amber-800' },
      Returned: { bg: 'bg-green-100', text: 'text-green-800' },
      Cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
    };
    const c = config[st] || config.Confirmed;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
        {st}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[200] px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm border animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.isError
              ? 'bg-red-950 text-red-100 border-red-800'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.isError ? (
            <AlertTriangle size={16} className="text-red-400" />
          ) : (
            <Check size={16} className="text-green-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Boxes className="text-primary" size={26} />
            <span>{isTa ? 'வாடகை பொருட்கள் & ஆவணங்கள் மேலாண்மை' : 'Rental Items & Equipment Management'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isTa
              ? 'விசேஷங்களுக்கான பாத்திரங்கள், கேரியர்கள் மற்றும் ஹாட்பாக்ஸ் வாடகை பரிவர்த்தனைகள்'
              : 'Manage catering vessel rentals, equipment stock, and customer rental documents'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={openNewDocument}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Plus size={18} />
            <span>{isTa ? 'புதிய வாடகை ஆவணம்' : 'New Rental Document'}</span>
          </button>

          <button
            onClick={openAddItem}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Package size={17} />
            <span>{isTa ? 'பொருள் சேர்க்க' : 'Add Rental Item'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase">{isTa ? 'செயலில் உள்ள வாடகைகள்' : 'Active Rentals'}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeRentalDocs}</p>
          <p className="text-[11px] text-primary font-medium mt-0.5">{documents.length} {isTa ? 'மொத்த ஆவணங்கள்' : 'total documents'}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase">{isTa ? 'வாடகை பொருட்கள் வகைகள்' : 'Rental Catalog Items'}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{items.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{categories.length} {isTa ? 'பிரிவுகள்' : 'categories'}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase">{isTa ? 'தற்போது வாடகையில் உள்ளவை' : 'Currently Rented Out'}</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalRentedOut}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{isTa ? 'பாத்திரங்கள் / உபகரணங்கள்' : 'units out on rent'}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase">{isTa ? 'கிடைக்கும் இருப்பு (Available)' : 'Available Stock'}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalItemsAvailable}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">/ {totalItemsOwned} {isTa ? 'மொத்த இருப்பு' : 'total owned'}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={16} />
          <span>{isTa ? 'வாடகை பரிவர்த்தனைகள் (Documents)' : 'Rental Transactions'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {documents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'inventory'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package size={16} />
          <span>{isTa ? 'வாடகை பொருட்கள் இருப்பு (Inventory)' : 'Inventory & Catalogue'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={16} />
          <span>{isTa ? 'வாடகை பிரிவுகள் (Categories)' : 'Rental Categories'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {categories.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: RENTAL TRANSACTIONS / DOCUMENTS ───────────────────────── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder={isTa ? 'வாடகை எண், வாடிக்கையாளர் பெயர் அல்லது மொபைல் மூலம் தேடவும்...' : 'Search by Rental No, Customer Name, or Mobile…'}
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <select
                value={docStatusFilter}
                onChange={(e) => setDocStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="all">{isTa ? 'அனைத்து நிலைகள்' : 'All Statuses'}</option>
                <option value="Draft">Draft</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Items Issued">Items Issued</option>
                <option value="Partially Returned">Partially Returned</option>
                <option value="Returned">Returned</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={docDateFilter}
                  onChange={(e) => setDocDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer"
                />
                {docDateFilter && (
                  <button onClick={() => setDocDateFilter('')} className="text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Documents Table */}
          {filteredDocuments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 py-16 text-center text-slate-400 p-4">
              <FileText size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-800">
                {isTa ? 'வாடகை ஆவணங்கள் எதுவும் இல்லை' : 'No rental transactions found'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isTa
                  ? 'விசேஷங்களுக்கு பாத்திரங்கள் வாடகைக்கு வழங்க "புதிய வாடகை ஆவணம்" பொத்தானை அழுத்தவும்.'
                  : 'Click "New Rental Document" to create an invoice/agreement for a customer function.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'வாடகை எண்' : 'Rental No.'}</th>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'வாடிக்கையாளர்' : 'Customer'}</th>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'விசேஷ தேதி' : 'Function Date'}</th>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'பொருட்கள்' : 'Items'}</th>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'மொத்தத் தொகை' : 'Total Amount'}</th>
                      <th className="px-4 py-3.5 text-left">{isTa ? 'நிலை' : 'Status'}</th>
                      <th className="px-4 py-3.5 text-right">{isTa ? 'செயல்கள் / PDF' : 'Actions / PDF'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocuments.map((doc) => {
                      const totalQty = doc.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                      const isReturnable = doc.status === 'Confirmed' || doc.status === 'Items Issued' || doc.status === 'Partially Returned';

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Rental No */}
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-primary font-mono">{doc.rentalNumber}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{doc.documentDate}</p>
                          </td>

                          {/* Customer */}
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900">{doc.customerName}</p>
                            <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              <span>{doc.mobile}</span>
                            </p>
                            {doc.functionName && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">{doc.functionName}</p>
                            )}
                          </td>

                          {/* Dates */}
                          <td className="px-4 py-3.5 text-xs text-slate-700">
                            <div className="flex items-center gap-1 font-semibold text-slate-900">
                              <Calendar size={13} className="text-primary" />
                              <span>{doc.functionDate}</span>
                            </div>
                            <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                              <Clock size={11} />
                              <span>Return: {doc.expectedReturnDate}</span>
                            </p>
                          </td>

                          {/* Items count */}
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-slate-800 text-xs">
                              {doc.items.length} {isTa ? 'வகைகள்' : 'types'}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              ({totalQty} {isTa ? 'எண்ணிக்கை' : 'units'})
                            </span>
                          </td>

                          {/* Total & Balance */}
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900">₹{doc.grandTotal.toLocaleString('en-IN')}</p>
                            {doc.balanceDue > 0 ? (
                              <span className="text-[11px] font-bold text-red-600 block">
                                Bal: ₹{doc.balanceDue.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-green-600 block">Paid Full</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            {statusBadge(doc.status)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Return Button */}
                              {isReturnable && (
                                <button
                                  onClick={() => openReturnModal(doc)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 rounded-lg cursor-pointer transition-colors"
                                  title={isTa ? 'பொருட்கள் திரும்பப் பெறப்பட்டன என குறிக்க' : 'Mark items returned'}
                                >
                                  {isTa ? 'திரும்பப் பெறப்பட்டது' : 'Return'}
                                </button>
                              )}

                              {/* Download Tamil PDF */}
                              <button
                                onClick={() => handleDownloadPDF(doc, 'ta')}
                                disabled={downloadingDocId !== null}
                                className="p-1.5 text-primary hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                title="Download Tamil PDF (தமிழ் PDF)"
                              >
                                <span className="text-[10px] font-bold border border-blue-300 px-1.5 py-0.5 rounded bg-blue-50">
                                  தமிழ்
                                </span>
                              </button>

                              {/* Download English PDF */}
                              <button
                                onClick={() => handleDownloadPDF(doc, 'en')}
                                disabled={downloadingDocId !== null}
                                className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title="Download English PDF"
                              >
                                <span className="text-[10px] font-bold border border-slate-300 px-1.5 py-0.5 rounded bg-slate-50">
                                  EN
                                </span>
                              </button>

                              {/* Print / View Document */}
                              <button
                                onClick={() => handlePrintDocument(doc)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title={isTa ? 'அச்சிடு / பதிவிறக்கு' : 'Print / Download PDF'}
                              >
                                <Printer size={15} />
                              </button>

                              {/* Edit Document */}
                              <button
                                onClick={() => openEditDocument(doc)}
                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                title="Edit document"
                              >
                                <Pencil size={15} />
                              </button>

                              {/* Delete Document */}
                              <button
                                onClick={() => setDeleteDocConfirm(doc)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                title="Delete document"
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
        </div>
      )}

      {/* ─── TAB 2: INVENTORY & CATALOGUE ────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={isTa ? 'பொருள் பெயர் (தமிழ் / English) அல்லது குறியீடு மூலம் தேடவும்...' : 'Search by item code, English or தமிழ் name…'}
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <select
                value={itemCategoryFilter}
                onChange={(e) => setItemCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="all">{isTa ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isTa ? c.nameTa : c.name}
                  </option>
                ))}
              </select>

              <select
                value={itemStockFilter}
                onChange={(e) => setItemStockFilter(e.target.value as any)}
                className="px-3 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="all">{isTa ? 'அனைத்து இருப்பு நிலைகள்' : 'All Stock Status'}</option>
                <option value="available">{isTa ? 'இருப்பில் உள்ளவை (>0)' : 'In Stock (>0)'}</option>
                <option value="low">{isTa ? 'குறைந்த இருப்பு (1-5)' : 'Low Stock (1-5)'}</option>
                <option value="out">{isTa ? 'தீர்ந்துவிட்டது (0)' : 'Out of Stock (0)'}</option>
                <option value="unset">{isTa ? 'இருப்பு அமைக்கப்படவில்லை' : 'Stock Not Set'}</option>
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3.5 text-left">{isTa ? 'குறியீடு' : 'Code'}</th>
                    <th className="px-4 py-3.5 text-left">{isTa ? 'பொருள் பெயர் (தமிழ் & English)' : 'Item Name'}</th>
                    <th className="px-4 py-3.5 text-left">{isTa ? 'பிரிவு' : 'Category'}</th>
                    <th className="px-4 py-3.5 text-center">{isTa ? 'மொத்த இருப்பு' : 'Total Stock'}</th>
                    <th className="px-4 py-3.5 text-center">{isTa ? 'கிடைக்கும் இருப்பு' : 'Available'}</th>
                    <th className="px-4 py-3.5 text-left">{isTa ? 'வாடகை விலை' : 'Rental Rate'}</th>
                    <th className="px-4 py-3.5 text-left">{isTa ? 'வைப்புத்தொகை' : 'Security Deposit'}</th>
                    <th className="px-4 py-3.5 text-right">{isTa ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    const catName = isTa ? cat?.nameTa || cat?.name : cat?.name;
                    const isUnsetStock = item.totalQuantity === 0;
                    const isOutOfStock = item.totalQuantity > 0 && item.availableQuantity === 0;
                    const isLowStock = item.totalQuantity > 0 && item.availableQuantity > 0 && item.availableQuantity <= 5;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Code */}
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                          {item.code}
                        </td>

                        {/* Names */}
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-900">{item.nameEn}</p>
                          {item.nameTa && (
                            <p className="text-xs font-semibold text-primary font-tamil mt-0.5">
                              {item.nameTa}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {catName || item.categoryId}
                          </span>
                        </td>

                        {/* Total Stock */}
                        <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                          {isUnsetStock ? (
                            <span className="text-xs font-medium text-slate-400">
                              {isTa ? 'அமைக்கப்படவில்லை' : 'Not set'}
                            </span>
                          ) : (
                            item.totalQuantity
                          )}
                        </td>

                        {/* Available */}
                        <td className="px-4 py-3.5 text-center">
                          {isUnsetStock ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              —
                            </span>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                isOutOfStock
                                  ? 'bg-red-100 text-red-700'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {item.availableQuantity}
                            </span>
                          )}
                        </td>

                        {/* Rental Rate */}
                        <td className="px-4 py-3.5">
                          {item.rentalPrice > 0 ? (
                            <>
                              <span className="font-bold text-slate-900">₹{item.rentalPrice}</span>
                              <span className="text-[11px] text-slate-500 block">/ {item.pricingUnit}</span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">
                              {isTa ? 'விலை இல்லை' : 'Not set'}
                            </span>
                          )}
                        </td>

                        {/* Deposit */}
                        <td className="px-4 py-3.5 text-xs text-slate-600 font-medium">
                          {item.securityDeposit ? `₹${item.securityDeposit}` : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleItemActive(item)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                                item.isActive
                                  ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                              title={item.isActive ? (isTa ? 'செயலிழக்கச் செய்' : 'Deactivate') : (isTa ? 'மீண்டும் இயக்கு' : 'Activate')}
                            >
                              {item.isActive ? (isTa ? 'செயலில்' : 'Active') : (isTa ? 'மறைக்கப்பட்டது' : 'Inactive')}
                            </button>

                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              title="Edit item"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              onClick={() => setDeleteItemConfirm(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                              title="Delete or deactivate"
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
        </div>
      )}

      {/* ─── TAB 3: CATEGORIES MANAGEMENT ────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">
              {isTa ? 'வாடகை பிரிவுகள் பட்டியல்' : 'Rental Categories'}
            </h3>
            <button
              onClick={() => {
                setCatForm({ name: '', nameTa: '', description: '' });
                setCatModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>{isTa ? 'புதிய பிரிவு சேர்க்க' : 'Add Category'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = items.filter((i) => i.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">{cat.name}</h4>
                    <span className="text-xs bg-blue-100 text-primary font-bold px-2 py-0.5 rounded-full">
                      {count} items
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-primary font-tamil">{cat.nameTa}</p>
                  {cat.description && <p className="text-xs text-slate-500 mt-1">{cat.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RENTAL TRANSACTION DOCUMENT MODAL */}
      <RentalDocumentModal
        documentId={editingDocId}
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        onSaved={() => {
          showToast(isTa ? 'வாடகை ஆவணம் வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : 'Rental document saved successfully!');
          reloadAll();
        }}
      />

      {/* RETURN DOCUMENT MODAL */}
      {returnModalDoc && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="text-green-600" size={18} />
                <span>{isTa ? 'பொருட்கள் திரும்பப் பெறுதல்' : 'Record Rental Items Return'}</span>
              </h3>
              <button onClick={() => setReturnModalDoc(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {isTa
                ? `வாடகை எண் ${returnModalDoc.rentalNumber} க்கான பொருட்கள் அனைத்தும் திரும்பப் பெறப்பட்டனவா என்பதை உறுதிப்படுத்தவும்.`
                : `Confirm items returned for Rental ${returnModalDoc.rentalNumber} (${returnModalDoc.customerName}). Stock will be automatically restored.`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isTa ? 'உண்மையான திரும்பிய தேதி' : 'Actual Return Date'}
              </label>
              <input
                type="date"
                value={actualReturnDate}
                onChange={(e) => setActualReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isTa ? 'சேதம் / திரும்ப வராதவை பற்றிய குறிப்புகள்' : 'Damage / Missing Items Notes'}
              </label>
              <textarea
                rows={3}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder={isTa ? 'அனைத்து பாத்திரங்களும் சுத்தமாக திரும்பப் பெறப்பட்டன...' : 'e.g. All vessels returned clean, deposit refunded…'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReturnModalDoc(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmReturn}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                {isTa ? 'திரும்பப் பெறப்பட்டது என உறுதிசெய்' : 'Confirm Return & Restore Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT RENTAL ITEM MODAL */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingItemId
                  ? (isTa ? 'வாடகை பொருளைத் திருத்து' : 'Edit Rental Item')
                  : (isTa ? 'புதிய வாடகை பொருள் சேர்க்க' : 'Add New Rental Item')}
              </h3>
              <button onClick={() => setItemModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            {itemFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {itemFormError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isTa ? 'குறியீடு (Item Code)' : 'Item Code'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemForm.code}
                    onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. RNT-015"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isTa ? 'பிரிவு (Category)' : 'Category'}
                  </label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isTa ? c.nameTa : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isTa ? 'ஆங்கிலப் பெயர்' : 'English Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemForm.nameEn}
                  onChange={(e) => setItemForm((f) => ({ ...f, nameEn: e.target.value }))}
                  placeholder="e.g. Anda (Large Cauldron)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isTa ? 'தமிழ் பெயர் (Tamil Name)' : 'Tamil Name (தமிழில்)'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemForm.nameTa}
                  onChange={(e) => setItemForm((f) => ({ ...f, nameTa: e.target.value }))}
                  placeholder="உதாரணம்: அண்டா"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-tamil"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isTa ? 'மொத்த இருப்பு' : 'Total Stock'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.totalQuantity}
                    onChange={(e) => setItemForm((f) => ({ ...f, totalQuantity: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isTa ? 'வாடகை விலை (₹)' : 'Rental Price (₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.rentalPrice}
                    onChange={(e) => setItemForm((f) => ({ ...f, rentalPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isTa ? 'அலகு' : 'Unit'}
                  </label>
                  <select
                    value={itemForm.pricingUnit}
                    onChange={(e) => setItemForm((f) => ({ ...f, pricingUnit: e.target.value as any }))}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Per Day">Per Day</option>
                    <option value="Per Piece">Per Piece</option>
                    <option value="Per Item">Per Item</option>
                    <option value="Per Function">Per Function</option>
                    <option value="Per Set">Per Set</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isTa ? 'பாதுகாப்பு வைப்புத்தொகை (Security Deposit ₹)' : 'Security Deposit (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={itemForm.securityDeposit}
                  onChange={(e) => setItemForm((f) => ({ ...f, securityDeposit: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isTa ? 'விளக்கம் (Description)' : 'Description (optional)'}
                </label>
                <input
                  type="text"
                  value={itemForm.description}
                  onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Stainless steel heavy base…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                disabled={itemSaving}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-60"
              >
                {itemSaving ? (isTa ? 'சேமிக்கப்படுகிறது...' : 'Saving…') : (isTa ? 'சேமி' : 'Save Item')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              {isTa ? 'புதிய வாடகைப் பிரிவு' : 'Add Rental Category'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">English Category Name</label>
              <input
                type="text"
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Copper Vessels"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">தமிழ் பிரிவு பெயர்</label>
              <input
                type="text"
                value={catForm.nameTa}
                onChange={(e) => setCatForm((f) => ({ ...f, nameTa: e.target.value }))}
                placeholder="உதாரணம்: தாமிர பாத்திரங்கள்"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-tamil"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCatModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={catSaving}
                className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                {isTa ? 'சேர்' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DOCUMENT CONFIRM MODAL */}
      {deleteDocConfirm && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-bold text-center text-slate-900 text-sm">
              {isTa ? 'வாடகை ஆவணத்தை நீக்கவா?' : 'Delete Rental Document?'}
            </h4>
            <p className="text-xs text-slate-500 text-center">
              {isTa
                ? `வாடகை ஆவணம் "${deleteDocConfirm.rentalNumber}" நிரந்தரமாக நீக்கப்படும்.`
                : `Are you sure you want to permanently delete document "${deleteDocConfirm.rentalNumber}"?`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteDocConfirm(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteDocument(deleteDocConfirm)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isTa ? 'நீக்கு' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ITEM CONFIRM MODAL */}
      {deleteItemConfirm && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <h4 className="font-bold text-center text-slate-900 text-sm">
              {isTa ? 'பொருளை நீக்க / செயலிழக்க வேண்டுமா?' : 'Remove or Deactivate Item?'}
            </h4>
            <p className="text-xs text-slate-500 text-center">
              {isTa
                ? `"${deleteItemConfirm.nameTa || deleteItemConfirm.nameEn}" நீக்கப்படும். முந்தைய வாடகை ஆவணங்கள் பாதுகாக்கப்படும்.`
                : `Are you sure you want to remove "${deleteItemConfirm.nameEn}"? If referenced in existing rental documents, it will be safely deactivated.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteItemConfirm(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteItem(deleteItemConfirm)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isTa ? 'உறுதி செய்' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
