import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBasket,
  Plus,
  Search,
  Filter,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  FolderPlus,
  Calendar,
  Layers,
  ArrowUpDown,
  History,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  inventoryService,
  SUPPORTED_UNITS,
  formatUnitLabel,
} from '../../services/inventoryService';
import type {
  InventoryItem,
  InventoryCategory,
  InventoryDocument,
  InventoryDocumentItem,
} from '../../types/inventory';
import {
  generateInventoryPDF,
  printInventoryDocument,
} from '../../utils/generateInventoryPDF';

export const AdminInventory: React.FC = () => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'catalogue' | 'history'>('catalogue');

  // Data states
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [documents, setDocuments] = useState<InventoryDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'stock'>('name');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<InventoryDocument | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameTa, setNewCatNameTa] = useState('');

  // Document Creation Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docStep, setDocStep] = useState<'details' | 'select' | 'quantities' | 'preview'>('details');
  const [docTitle, setDocTitle] = useState('');
  const [docEventName, setDocEventName] = useState('');
  const [docCustomerName, setDocCustomerName] = useState('');
  const [docEventDate, setDocEventDate] = useState('');
  const [docDocumentDate, setDocDocumentDate] = useState('');
  const [docPreparedBy, setDocPreparedBy] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docLanguage, setDocLanguage] = useState<'en' | 'ta'>('ta');

  // Selected items in doc creator
  const [selectedDocItems, setSelectedDocItems] = useState<InventoryDocumentItem[]>([]);
  const [docItemSearch, setDocItemSearch] = useState('');
  const [docItemCategory, setDocItemCategory] = useState('all');

  // Custom inline item in doc creator
  const [showCustomItemRow, setShowCustomItemRow] = useState(false);
  const [customItemNameEn, setCustomItemNameEn] = useState('');
  const [customItemNameTa, setCustomItemNameTa] = useState('');
  const [customItemUnit, setCustomItemUnit] = useState('kg');
  const [customItemQty, setCustomItemQty] = useState('');

  // Mandatory quantity validation states
  const [missingQtyItemIds, setMissingQtyItemIds] = useState<string[]>([]);
  const [qtyValidationError, setQtyValidationError] = useState<string | null>(null);

  // Preview / Saved Document View modal
  const [previewDoc, setPreviewDoc] = useState<InventoryDocument | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ percent: number; status: string }>({
    percent: 0,
    status: '',
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    const itms = inventoryService.getItems();
    const cats = inventoryService.getCategories();
    const docs = inventoryService.getDocuments();
    setItems(itms);
    setCategories(cats);
    setDocuments(docs);
    setLoading(false);

    inventoryService.syncFromSupabase().then(() => {
      setItems(inventoryService.getItems());
      setCategories(inventoryService.getCategories());
      setDocuments(inventoryService.getDocuments());
    }).catch(() => {});
  }

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          item.nameEn.toLowerCase().includes(query) ||
          item.nameTa.toLowerCase().includes(query) ||
          (item.supplierName && item.supplierName.toLowerCase().includes(query));

        const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;

        const matchesLowStock = !filterLowStock || (typeof item.currentStock === 'number' && item.currentStock <= 5);

        return matchesSearch && matchesCat && matchesLowStock;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return isTa ? a.nameTa.localeCompare(b.nameTa, 'ta') : a.nameEn.localeCompare(b.nameEn);
        }
        if (sortBy === 'category') {
          return a.categoryId.localeCompare(b.categoryId);
        }
        if (sortBy === 'stock') {
          return (a.currentStock || 0) - (b.currentStock || 0);
        }
        return 0;
      });
  }, [items, searchQuery, selectedCategory, filterLowStock, sortBy, isTa]);

  // Category helper
  function getCategoryName(catId: string): string {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return isTa ? 'பிற பொருட்கள்' : 'Other';
    return isTa ? cat.nameTa : cat.nameEn;
  }

  // Summary counts
  const totalItemsCount = items.length;
  const lowStockCount = items.filter((i) => typeof i.currentStock === 'number' && i.currentStock <= 5).length;
  const categoriesCount = categories.length;

  // ─── ADD / EDIT ITEM ──────────────────────────────────────
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameTa, setFormNameTa] = useState('');
  const [formCategory, setFormCategory] = useState('cat-grocery');
  const [formUnit, setFormUnit] = useState('kg');
  const [formStock, setFormStock] = useState('');
  const [formPurchaseQty, setFormPurchaseQty] = useState('');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  function openAddItemModal() {
    setEditingItem(null);
    setFormNameEn('');
    setFormNameTa('');
    setFormCategory(categories[0]?.id || 'cat-grocery');
    setFormUnit('kg');
    setFormStock('');
    setFormPurchaseQty('');
    setFormUnitPrice('');
    setFormSupplier('');
    setFormPurchaseDate('');
    setFormExpiryDate('');
    setFormNotes('');
    setFormError('');
    setIsItemModalOpen(true);
  }

  function openEditItemModal(item: InventoryItem) {
    setEditingItem(item);
    setFormNameEn(item.nameEn);
    setFormNameTa(item.nameTa);
    setFormCategory(item.categoryId);
    setFormUnit(item.unit);
    setFormStock(item.currentStock !== undefined ? String(item.currentStock) : '');
    setFormPurchaseQty(item.purchaseQuantity !== undefined ? String(item.purchaseQuantity) : '');
    setFormUnitPrice(item.unitPrice !== undefined ? String(item.unitPrice) : '');
    setFormSupplier(item.supplierName || '');
    setFormPurchaseDate(item.purchaseDate || '');
    setFormExpiryDate(item.expiryDate || '');
    setFormNotes(item.notes || '');
    setFormError('');
    setIsItemModalOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!formNameEn.trim()) {
      setFormError(isTa ? 'பொருளின் ஆங்கிலப் பெயர் தேவை.' : 'Item name in English is required.');
      return;
    }

    const stockNum = formStock.trim() !== '' ? parseFloat(formStock) : undefined;
    if (stockNum !== undefined && (isNaN(stockNum) || stockNum < 0)) {
      setFormError(isTa ? 'இருப்பு அளவு 0 அல்லது அதற்கு மேல் இருக்க வேண்டும்.' : 'Stock quantity must be 0 or greater.');
      return;
    }

    const purchaseQtyNum = formPurchaseQty.trim() !== '' ? parseFloat(formPurchaseQty) : undefined;
    if (purchaseQtyNum !== undefined && (isNaN(purchaseQtyNum) || purchaseQtyNum < 0)) {
      setFormError(isTa ? 'கொள்முதல் அளவு 0 அல்லது அதற்கு மேல் இருக்க வேண்டும்.' : 'Purchase quantity must be 0 or greater.');
      return;
    }

    const priceNum = formUnitPrice.trim() !== '' ? parseFloat(formUnitPrice) : undefined;
    if (priceNum !== undefined && (isNaN(priceNum) || priceNum < 0)) {
      setFormError(isTa ? 'விலை 0 அல்லது அதற்கு மேல் இருக்க வேண்டும்.' : 'Unit price must be 0 or greater.');
      return;
    }

    if (editingItem) {
      await inventoryService.updateItem({
        ...editingItem,
        nameEn: formNameEn.trim(),
        nameTa: formNameTa.trim() || formNameEn.trim(),
        categoryId: formCategory,
        unit: formUnit,
        currentStock: stockNum,
        purchaseQuantity: purchaseQtyNum,
        unitPrice: priceNum,
        supplierName: formSupplier.trim() || undefined,
        purchaseDate: formPurchaseDate.trim() || undefined,
        expiryDate: formExpiryDate.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      await inventoryService.addItem({
        nameEn: formNameEn.trim(),
        nameTa: formNameTa.trim() || formNameEn.trim(),
        categoryId: formCategory,
        unit: formUnit,
        currentStock: stockNum,
        purchaseQuantity: purchaseQtyNum,
        unitPrice: priceNum,
        supplierName: formSupplier.trim() || undefined,
        purchaseDate: formPurchaseDate.trim() || undefined,
        expiryDate: formExpiryDate.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsItemModalOpen(false);
    loadData();
  }

  async function handleDeleteItem(item: InventoryItem) {
    await inventoryService.deleteItem(item.id);
    setDeleteConfirmItem(null);
    loadData();
  }

  function handleSaveNewCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatNameEn.trim()) return;
    const created = inventoryService.addCategory(
      newCatNameEn.trim(),
      newCatNameTa.trim(),
    );
    setCategories(inventoryService.getCategories());
    setFormCategory(created.id);
    setNewCatNameEn('');
    setNewCatNameTa('');
    setIsCategoryModalOpen(false);
  }

  // ─── DOCUMENT CREATOR WORKFLOW ────────────────────────────
  function startCreateDocument() {
    const today = new Date().toISOString().split('T')[0];
    setDocTitle(isTa ? 'மளிகைப் பொருட்கள் & காய்கறி கொள்முதல் பட்டியல்' : 'Grocery & Vegetable Purchase / Stock List');
    setDocEventName('');
    setDocCustomerName('');
    setDocEventDate(today);
    setDocDocumentDate(today);
    setDocPreparedBy('');
    setDocNotes('');
    setDocLanguage(isTa ? 'ta' : 'en');
    setSelectedDocItems([]);
    setDocStep('details');
    setShowCustomItemRow(false);
    setCustomItemQty('');
    setMissingQtyItemIds([]);
    setQtyValidationError(null);
    setIsDocModalOpen(true);
  }

  function toggleDocItemSelection(item: InventoryItem) {
    const exists = selectedDocItems.find((i) => i.catalogueItemId === item.id);
    if (exists) {
      setSelectedDocItems(selectedDocItems.filter((i) => i.catalogueItemId !== item.id));
      setMissingQtyItemIds((prev) => prev.filter((id) => id !== exists.id));
    } else {
      const cat = categories.find((c) => c.id === item.categoryId);
      const newDocItem: InventoryDocumentItem = {
        id: `docit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        catalogueItemId: item.id,
        nameEn: item.nameEn,
        nameTa: item.nameTa,
        categoryNameEn: cat?.nameEn || 'Other',
        categoryNameTa: cat?.nameTa || 'பிற பொருட்கள்',
        quantity: '', // Empty by default as requested
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: undefined,
      };
      setSelectedDocItems([...selectedDocItems, newDocItem]);
    }
  }

  function handleAddCustomDocItem() {
    if (!customItemNameEn.trim()) return;
    const cleanQty = customItemQty.trim();
    const newDocItem: InventoryDocumentItem = {
      id: `docit-custom-${Date.now()}`,
      nameEn: customItemNameEn.trim(),
      nameTa: customItemNameTa.trim() || customItemNameEn.trim(),
      categoryNameEn: 'Custom / Other',
      categoryNameTa: 'சிறப்பு / இதர பொருட்கள்',
      quantity: cleanQty, // Empty if not entered
      unit: customItemUnit,
    };
    setSelectedDocItems([...selectedDocItems, newDocItem]);
    setCustomItemNameEn('');
    setCustomItemNameTa('');
    setCustomItemQty('');
    setShowCustomItemRow(false);
  }

  function updateDocItemQuantity(id: string, val: string) {
    // Allow digits and at most one dot so user can type e.g. "0.", "0.99", "1.25"
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;

    setSelectedDocItems(
      selectedDocItems.map((item) => {
        if (item.id === id) {
          const parsed = parseFloat(val);
          const total =
            item.unitPrice && !isNaN(parsed) && parsed > 0
              ? Math.round(parsed * item.unitPrice * 100) / 100
              : undefined;
          return { ...item, quantity: val, totalPrice: total };
        }
        return item;
      })
    );

    // If valid positive quantity was entered, clear from missing IDs
    if (val.trim() !== '' && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
      setMissingQtyItemIds((prev) => {
        const next = prev.filter((itemId) => itemId !== id);
        if (next.length === 0) {
          setQtyValidationError(null);
        }
        return next;
      });
    }
  }

  function handleBlurDocItemQuantity(id: string) {
    setSelectedDocItems(
      selectedDocItems.map((item) => {
        if (item.id === id) {
          const raw = String(item.quantity ?? '').trim();
          if (raw === '') {
            // Keep empty by default; do NOT auto-insert 1
            return { ...item, quantity: '', totalPrice: undefined };
          }
          const parsed = parseFloat(raw);
          if (isNaN(parsed) || parsed <= 0) {
            return { ...item, quantity: raw, totalPrice: undefined };
          }
          // Clean up dangling decimal points e.g. "2." -> "2"
          const cleanVal = raw.endsWith('.') ? String(parsed) : raw;
          const total = item.unitPrice ? Math.round(parsed * item.unitPrice * 100) / 100 : undefined;
          return { ...item, quantity: cleanVal, totalPrice: total };
        }
        return item;
      })
    );
  }

  function updateDocItemUnit(id: string, unit: string) {
    setSelectedDocItems(
      selectedDocItems.map((item) => (item.id === id ? { ...item, unit } : item))
    );
  }

  function updateDocItemPrice(id: string, priceStr: string) {
    // Only allow decimal input
    if (priceStr !== '' && !/^\d*\.?\d*$/.test(priceStr)) return;
    setSelectedDocItems(
      selectedDocItems.map((item) => {
        if (item.id === id) {
          const price = priceStr.trim() !== '' ? parseFloat(priceStr) : undefined;
          const validPrice = price !== undefined && !isNaN(price) && price >= 0 ? price : undefined;
          const qtyNum = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity)) || 0;
          const total = validPrice !== undefined && qtyNum > 0 ? Math.round(qtyNum * validPrice * 100) / 100 : undefined;
          return { ...item, unitPrice: validPrice, totalPrice: total };
        }
        return item;
      })
    );
  }

  function updateDocItemNotes(id: string, notes: string) {
    setSelectedDocItems(
      selectedDocItems.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  }

  function removeDocItem(id: string) {
    setSelectedDocItems(selectedDocItems.filter((item) => item.id !== id));
    setMissingQtyItemIds((prev) => prev.filter((mId) => mId !== id));
  }

  async function handleSaveAndPreviewDocument() {
    if (!docEventName.trim()) {
      alert(isTa ? 'தயவுசெய்து நிகழ்வு / சுபமுகூர்த்த பெயரை உள்ளிடவும்.' : 'Please enter the event / function name.');
      return;
    }
    if (selectedDocItems.length === 0) {
      alert(isTa ? 'தயவுசெய்து குறைந்தபட்சம் ஒரு பொருளையாவது தேர்ந்தெடுக்கவும்.' : 'Please select at least one item.');
      return;
    }

    // MANDATORY VALIDATION: Check that EVERY item has a positive decimal quantity entered
    const missing = selectedDocItems.filter((it) => {
      const qStr = String(it.quantity ?? '').trim();
      const qNum = parseFloat(qStr);
      return qStr === '' || isNaN(qNum) || qNum <= 0;
    });

    if (missing.length > 0) {
      const missingIds = missing.map((m) => m.id);
      setMissingQtyItemIds(missingIds);

      const itemNames = missing
        .map((it) => (isTa ? it.nameTa || it.nameEn : it.nameEn))
        .join(', ');

      const errorMsg = isTa
        ? `ஆவணத்தை உருவாக்குவதற்கு முன் அனைத்து பொருட்களுக்கும் தேவையான அளவுகளை உள்ளிடவும். அளவு உள்ளிடப்படாத பொருட்கள்: ${missing.length}. (பொருட்கள்: ${itemNames})`
        : `Please enter quantities for all selected items before generating the document. Missing quantities: ${missing.length}. (Items: ${itemNames})`;

      setQtyValidationError(errorMsg);

      // Auto-scroll to first missing item quantity field and focus it
      setTimeout(() => {
        const firstEl = document.getElementById(`doc-qty-input-${missingIds[0]}`);
        if (firstEl) {
          firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (firstEl as HTMLInputElement).focus();
          (firstEl as HTMLInputElement).select();
        }
      }, 60);

      return;
    }

    // All quantities are valid: Clear validation errors
    setMissingQtyItemIds([]);
    setQtyValidationError(null);

    // Ensure all items have clean valid numbers/strings before saving
    const sanitizedItems: InventoryDocumentItem[] = selectedDocItems.map((item) => {
      const raw = String(item.quantity).trim();
      const parsed = parseFloat(raw);
      return {
        ...item,
        quantity: parsed,
      };
    });

    const saved = await inventoryService.saveDocument({
      title: docTitle.trim() || 'Grocery & Vegetable Purchase List',
      eventName: docEventName.trim(),
      customerName: docCustomerName.trim() || undefined,
      eventDate: docEventDate,
      documentDate: docDocumentDate || new Date().toISOString().split('T')[0],
      preparedBy: docPreparedBy.trim() || undefined,
      notes: docNotes.trim() || undefined,
      language: docLanguage,
      items: sanitizedItems,
    });

    setPreviewDoc(saved);
    setDocuments(inventoryService.getDocuments());
    setDocStep('preview');
  }

  async function handleDownloadPDF(docToDownload: InventoryDocument, docLang: 'en' | 'ta') {
    setIsPdfGenerating(true);
    setPdfProgress({ percent: 10, status: 'Initializing…' });
    try {
      await generateInventoryPDF(docToDownload, docLang, (percent, status) => {
        setPdfProgress({ percent, status });
      });
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsPdfGenerating(false);
    }
  }

  async function handleDeleteDocument(doc: InventoryDocument) {
    await inventoryService.deleteDocument(doc.id);
    setDeleteConfirmDoc(null);
    setDocuments(inventoryService.getDocuments());
    if (previewDoc?.id === doc.id) {
      setPreviewDoc(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[360px] gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600">
          {isTa ? 'சரக்கு பட்டியல் ஏற்றப்படுகிறது…' : 'Loading inventory catalogue…'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── TOP HEADER ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 border border-orange-200 text-primary rounded-2xl shadow-xs">
              <ShoppingBasket className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isTa ? 'மளிகைப் பொருட்கள் மற்றும் காய்கறிகள்' : 'Grocery & Vegetable Inventory'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isTa
                  ? 'சுபகாரியங்களுக்கான மளிகை, காய்கறி இருப்பு & கொள்முதல் பட்டியல் மேலாண்மை'
                  : 'Manage ingredient inventory and create function-wise purchase orders'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={startCreateDocument}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#c2410c] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer border border-orange-600/30 active:scale-[0.98]"
          >
            <FileText size={16} />
            <span>{isTa ? 'கொள்முதல் பட்டியல் உருவாக்கு' : 'Create Purchase / Stock List'}</span>
          </button>

          <button
            onClick={openAddItemModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-orange-50 text-primary rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer border border-orange-200 active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>{isTa ? '+ பொருள் சேர்' : '+ Add Item'}</span>
          </button>
        </div>
      </div>

      {/* ─── SUMMARY STATS ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isTa ? 'மொத்த பொருட்கள்' : 'Total Items'}
            </span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{totalItemsCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isTa ? 'வகைகள்' : 'Categories'}
            </span>
            <FolderPlus className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{categoriesCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {isTa ? 'குறைந்த இருப்பு (<= 5)' : 'Low Stock (<= 5)'}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{lowStockCount}</p>
        </div>
      </div>

      {/* ─── MODULE TABS ──────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'catalogue'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingBasket size={16} />
          <span>{isTa ? 'சரக்கு பட்டியல் (Catalogue)' : 'Inventory Catalogue'}</span>
          <span className="ml-1 px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700">
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={16} />
          <span>{isTa ? 'தயாரிக்கப்பட்ட ஆவணங்கள் (History)' : 'Document History'}</span>
          <span className="ml-1 px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700">
            {documents.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: CATALOGUE VIEW ────────────────────────────── */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          {/* Search, Filter & Sort Controls */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isTa ? 'பொருளின் பெயர் அல்லது சப்ளையர் தேடவும்…' : 'Search item name or supplier…'}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-1.5 min-w-max">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">{isTa ? 'அனைத்து வகைகள் (All)' : 'All Categories'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isTa ? c.nameTa : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Low Stock Filter Button */}
              <button
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  filterLowStock
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isTa ? '⚠️ குறைந்த இருப்பு மட்டும்' : '⚠️ Low Stock Only'}
              </button>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 min-w-max">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="name">{isTa ? 'பெயர் வாரியாக (Name)' : 'Sort: Name'}</option>
                  <option value="category">{isTa ? 'வகை வாரியாக (Category)' : 'Sort: Category'}</option>
                  <option value="stock">{isTa ? 'இருப்பு வாரியாக (Stock)' : 'Sort: Stock'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── DESKTOP TABLE ────────────────────────────────── */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">{isTa ? 'பொருளின் பெயர் (தமிழ் & English)' : 'Item Name'}</th>
                    <th className="py-3 px-4">{isTa ? 'வகை' : 'Category'}</th>
                    <th className="py-3 px-4">{isTa ? 'அலகு' : 'Unit'}</th>
                    <th className="py-3 px-4 text-right">{isTa ? 'இருப்பு' : 'Current Stock'}</th>
                    <th className="py-3 px-4 text-right">{isTa ? 'விலை (₹)' : 'Unit Price'}</th>
                    <th className="py-3 px-4">{isTa ? 'சப்ளையர் / விவரம்' : 'Supplier / Notes'}</th>
                    <th className="py-3 px-4 text-center w-28">{isTa ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const isLow = typeof item.currentStock === 'number' && item.currentStock <= 5;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{isTa ? item.nameTa : item.nameEn}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {isTa ? item.nameEn : item.nameTa}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-primary border border-orange-200/70">
                            {getCategoryName(item.categoryId)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {formatUnitLabel(item.unit, lang)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.currentStock !== undefined ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                isLow ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md' : 'text-slate-800'
                              }`}
                            >
                              {item.currentStock} {formatUnitLabel(item.unit, lang)}
                              {isLow && <span title="Low stock alert">⚠️</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {item.unitPrice ? `₹${item.unitPrice.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          <p className="truncate max-w-[160px] font-medium">{item.supplierName || '—'}</p>
                          {item.notes && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setViewingItem(item);
                                setIsViewModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title={isTa ? 'விவரங்களைப் பார்' : 'View Details'}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => openEditItemModal(item)}
                              className="p-1.5 text-primary hover:text-[#c2410c] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                              title={isTa ? 'திருத்து' : 'Edit Item'}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmItem(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title={isTa ? 'நீக்கு' : 'Delete Item'}
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

          {/* ─── MOBILE CARD VIEW ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:hidden gap-3">
            {filteredItems.map((item) => {
              const isLow = typeof item.currentStock === 'number' && item.currentStock <= 5;
              return (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {isTa ? item.nameTa : item.nameEn}
                      </h3>
                      <p className="text-xs text-slate-500">{isTa ? item.nameEn : item.nameTa}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-primary border border-orange-200/70 whitespace-nowrap">
                      {getCategoryName(item.categoryId)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">{isTa ? 'அலகு' : 'Unit'}</span>
                      <span className="font-semibold text-slate-800">{formatUnitLabel(item.unit, lang)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">{isTa ? 'இருப்பு' : 'Stock'}</span>
                      <span className={`font-bold ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                        {item.currentStock !== undefined
                          ? `${item.currentStock} ${formatUnitLabel(item.unit, lang)}`
                          : '—'}
                      </span>
                    </div>
                    {item.unitPrice ? (
                      <div>
                        <span className="text-slate-400 block text-[10px]">{isTa ? 'விலை' : 'Price'}</span>
                        <span className="font-semibold text-slate-800">₹{item.unitPrice}</span>
                      </div>
                    ) : null}
                    {item.supplierName ? (
                      <div>
                        <span className="text-slate-400 block text-[10px]">{isTa ? 'சப்ளையர்' : 'Supplier'}</span>
                        <span className="font-medium text-slate-700 truncate block">{item.supplierName}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setViewingItem(item);
                        setIsViewModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 rounded-lg font-medium cursor-pointer"
                    >
                      {isTa ? 'பார்' : 'View'}
                    </button>
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="px-2.5 py-1 text-xs text-primary bg-orange-50 rounded-lg font-semibold cursor-pointer border border-orange-200"
                    >
                      {isTa ? 'திருத்து' : 'Edit'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="px-2.5 py-1 text-xs text-red-600 bg-red-50 rounded-lg font-semibold cursor-pointer"
                    >
                      {isTa ? 'நீக்கு' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
              <ShoppingBasket className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-700 font-semibold text-sm">
                {isTa ? 'பொருட்கள் எதுவும் கிடைக்கவில்லை' : 'No items match your criteria'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isTa
                  ? 'தேடல் சொல் அல்லது வடிகட்டிகளை மாற்றி முயற்சிக்கவும், அல்லது புதிய பொருளைச் சேர்க்கவும்.'
                  : 'Try clearing your search query or filters, or add a new ingredient item.'}
              </p>
              <button
                onClick={openAddItemModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>{isTa ? '+ புதிய பொருள் சேர்' : '+ Add New Item'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: DOCUMENT HISTORY VIEW ────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {isTa ? 'சேமிக்கப்பட்ட கொள்முதல் / இருப்புப் பட்டியல்கள்' : 'Saved Purchase & Stock Documents'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTa
                  ? 'கடந்த காலங்களில் உருவாக்கப்பட்ட அனைத்து ஆவணங்களின் வரலாறு மற்றும் நகல்கள்'
                  : 'Historical records of all previously generated function purchase lists'}
              </p>
            </div>
            <button
              onClick={startCreateDocument}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-[#c2410c] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>{isTa ? 'புதிய ஆவணம்' : 'New Document'}</span>
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-orange-50 text-primary border border-orange-200">
                        {doc.docNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(doc.createdAt).toLocaleDateString(isTa ? 'ta-IN' : 'en-IN')}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base line-clamp-1">{doc.eventName}</h3>
                    {doc.customerName && (
                      <p className="text-xs text-slate-600 font-medium truncate">
                        {isTa ? 'வாடிக்கையாளர்: ' : 'Customer: '}
                        {doc.customerName}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-primary" />
                        {doc.eventDate}
                      </span>
                      <span>
                        <strong>{doc.items.length}</strong> {isTa ? 'பொருட்கள்' : 'items'}
                      </span>
                    </div>

                    {doc.totalAmount && doc.totalAmount > 0 ? (
                      <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                        {isTa ? 'மதிப்பு: ' : 'Est. Total: '}₹{doc.totalAmount.toLocaleString('en-IN')}
                      </p>
                    ) : null}
                  </div>

                  {/* Actions for each doc */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDownloadPDF(doc, 'en')}
                        disabled={isPdfGenerating}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Download English PDF"
                      >
                        <Download size={13} /> EN
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(doc, 'ta')}
                        disabled={isPdfGenerating}
                        className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-orange-200"
                        title="தமிழ் PDF பதிவிறக்கு"
                      >
                        <Download size={13} /> தமிழ்
                      </button>
                      <button
                        onClick={() => printInventoryDocument(doc, isTa ? 'ta' : 'en')}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title={isTa ? 'அச்சிடு' : 'Print'}
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        onClick={() => inventoryService.exportToCsv(doc, isTa ? 'ta' : 'en')}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Export CSV"
                      >
                        <FileSpreadsheet size={15} />
                      </button>
                    </div>

                    <button
                      onClick={() => setDeleteConfirmDoc(doc)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title={isTa ? 'ஆவணத்தை நீக்கு' : 'Delete Document'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-700 font-semibold text-sm">
                {isTa ? 'இதுவரை ஆவணங்கள் எதுவும் உருவாக்கப்படவில்லை' : 'No purchase documents created yet'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isTa
                  ? 'சுபநிகழ்வுகளுக்கான மளிகைப் பொருட்கள் & காய்கறி பட்டியலை உடனே உருவாக்கவும்.'
                  : 'Select required ingredients and generate your first catering purchase document.'}
              </p>
              <button
                onClick={startCreateDocument}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>{isTa ? 'புதிய ஆவணம் உருவாக்கு' : 'Create First Document'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: ADD / EDIT ITEM MODAL ───────────────────── */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingItem
                    ? isTa ? 'பொருளைத் திருத்து (Edit Item)' : 'Edit Inventory Item'
                    : isTa ? 'புதிய பொருள் சேர் (Add New Item)' : 'Add New Inventory Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name English */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTa ? 'பொருளின் பெயர் (ஆங்கிலத்தில்) *' : 'Item Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g. Basmati Rice, Onion"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Name Tamil */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTa ? 'பொருளின் பெயர் (தமிழில்)' : 'Item Name in Tamil'}
                  </label>
                  <input
                    type="text"
                    value={formNameTa}
                    onChange={(e) => setFormNameTa(e.target.value)}
                    placeholder="எ.கா. பாஸ்மதி அரிசி, வெங்காயம்"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category with option to add custom */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {isTa ? 'வகை (Category) *' : 'Category *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {isTa ? '+ புதிய வகை' : '+ New Category'}
                    </button>
                  </div>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white cursor-pointer font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isTa ? c.nameTa : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit of Measurement */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isTa ? 'அளவீட்டு அலகு (Unit) *' : 'Unit of Measurement *'}
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white cursor-pointer font-medium"
                  >
                    {SUPPORTED_UNITS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {isTa ? u.labelTa : u.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional quantities and pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'தற்போதைய இருப்பு (விருப்பம்)' : 'Current Stock (Optional)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={formStock}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setFormStock(v);
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'இயல்பு கொள்முதல் அளவு' : 'Default Purchase Qty'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={formPurchaseQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setFormPurchaseQty(v);
                    }}
                    placeholder="e.g. 10"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'அலகு விலை (₹) (விருப்பம்)' : 'Unit Price (₹) (Optional)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={formUnitPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setFormUnitPrice(v);
                    }}
                    placeholder="e.g. 55"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Supplier & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'சப்ளையர் பெயர் (விருப்பம்)' : 'Supplier Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Vendor / Shop name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'வாங்கிய தேதி' : 'Purchase Date'}
                  </label>
                  <input
                    type="date"
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {isTa ? 'காலாவதி தேதி' : 'Expiry Date'}
                  </label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {isTa ? 'குறிப்புகள் (Notes)' : 'Internal Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isTa ? 'தரம், வகை போன்ற விவரங்கள்…' : 'Quality grade, storage instructions…'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {isTa ? 'ரத்து செய்' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingItem
                    ? isTa ? 'மாற்றங்களைச் சேமி' : 'Save Changes'
                    : isTa ? 'பொருளைச் சேர்' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ADD CUSTOM CATEGORY MODAL ───────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {isTa ? 'புதிய வகையைச் சேர்' : 'Add Custom Category'}
            </h3>
            <form onSubmit={handleSaveNewCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isTa ? 'வகை பெயர் (ஆங்கிலத்தில்) *' : 'Category Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  value={newCatNameEn}
                  onChange={(e) => setNewCatNameEn(e.target.value)}
                  placeholder="e.g. Dairy Products, Beverages"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isTa ? 'வகை பெயர் (தமிழில்)' : 'Category Name (Tamil)'}
                </label>
                <input
                  type="text"
                  value={newCatNameTa}
                  onChange={(e) => setNewCatNameTa(e.target.value)}
                  placeholder="எ.கா. பால் பொருட்கள்"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {isTa ? 'ரத்து' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-primary hover:bg-[#c2410c] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  {isTa ? 'சேமி' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: VIEW ITEM DETAILS MODAL ─────────────────── */}
      {isViewModalOpen && viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {isTa ? viewingItem.nameTa : viewingItem.nameEn}
                </h3>
                <p className="text-xs text-slate-500">{isTa ? viewingItem.nameEn : viewingItem.nameTa}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-primary border border-orange-200">
                {getCategoryName(viewingItem.categoryId)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100">
              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-slate-400 block">{isTa ? 'அலகு' : 'Unit'}</span>
                <span className="font-bold text-slate-800 text-sm">{formatUnitLabel(viewingItem.unit, lang)}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-slate-400 block">{isTa ? 'தற்போதைய இருப்பு' : 'Current Stock'}</span>
                <span className="font-bold text-slate-800 text-sm">
                  {viewingItem.currentStock !== undefined
                    ? `${viewingItem.currentStock} ${formatUnitLabel(viewingItem.unit, lang)}`
                    : '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-slate-400 block">{isTa ? 'அலகு விலை' : 'Unit Price'}</span>
                <span className="font-bold text-slate-800 text-sm">
                  {viewingItem.unitPrice ? `₹${viewingItem.unitPrice}` : '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl">
                <span className="text-slate-400 block">{isTa ? 'சப்ளையர்' : 'Supplier'}</span>
                <span className="font-bold text-slate-800 text-sm">{viewingItem.supplierName || '—'}</span>
              </div>
            </div>

            {viewingItem.purchaseDate && (
              <p className="text-xs text-slate-600">
                <strong>{isTa ? 'வாங்கிய தேதி: ' : 'Purchase Date: '}</strong>
                {viewingItem.purchaseDate}
              </p>
            )}

            {viewingItem.notes && (
              <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 text-xs text-slate-700">
                <strong>{isTa ? 'குறிப்புகள்: ' : 'Notes: '}</strong>
                {viewingItem.notes}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                {isTa ? 'மூடு' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: DELETE CONFIRMATION MODAL ──────────────── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">
                {isTa ? 'பொருளை நீக்க உறுதிப்படுத்துக' : 'Confirm Item Deletion'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {isTa
                  ? `"${deleteConfirmItem.nameTa || deleteConfirmItem.nameEn}" என்ற பொருளை சரக்கு பட்டியலில் இருந்து நிரந்தரமாக நீக்க விரும்புகிறீர்களா?`
                  : `Are you sure you want to permanently remove "${deleteConfirmItem.nameEn}" from your inventory catalogue?`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteItem(deleteConfirmItem)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                {isTa ? 'ஆம், நீக்கு' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Doc Confirm */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">
                {isTa ? 'ஆவணத்தை நீக்க உறுதிப்படுத்துக' : 'Delete Document'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {isTa
                  ? `ஆவணம் "${deleteConfirmDoc.docNumber} - ${deleteConfirmDoc.eventName}" நிரந்தரமாக நீக்கப்படும்.`
                  : `Document "${deleteConfirmDoc.docNumber} - ${deleteConfirmDoc.eventName}" will be deleted.`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteDocument(deleteConfirmDoc)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                {isTa ? 'நீக்கு' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: CREATE PURCHASE / STOCK DOCUMENT ───────── */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {isTa
                      ? 'கொள்முதல் / இருப்புப் பட்டியல் உருவாக்கு'
                      : 'Create Grocery & Vegetable Purchase Document'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isTa
                      ? 'பொருட்களைத் தேர்ந்தெடுத்து, அளவுகளை உள்ளிட்டு PDF ஆகப் பதிவிறக்கவும்'
                      : 'Select ingredients, specify function quantities, and export printable PDF'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setDocStep('details')}
                className={`py-2.5 text-center border-b-2 cursor-pointer ${
                  docStep === 'details'
                    ? 'border-primary text-primary bg-orange-50/50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                1. {isTa ? 'நிகழ்வு விவரங்கள்' : 'Event Details'}
              </button>

              <button
                onClick={() => {
                  if (!docEventName.trim()) {
                    alert(isTa ? 'தயவுசெய்து நிகழ்வு பெயரை உள்ளிடவும்.' : 'Please enter the event name first.');
                    return;
                  }
                  setDocStep('select');
                }}
                className={`py-2.5 text-center border-b-2 cursor-pointer ${
                  docStep === 'select'
                    ? 'border-primary text-primary bg-orange-50/50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                2. {isTa ? 'பொருட்கள் தேர்வு' : 'Select Items'} ({selectedDocItems.length})
              </button>

              <button
                onClick={() => {
                  if (selectedDocItems.length === 0) {
                    alert(isTa ? 'பொருட்களைத் தேர்ந்தெடுக்கவும்.' : 'Select items first.');
                    return;
                  }
                  setDocStep('quantities');
                }}
                className={`py-2.5 text-center border-b-2 cursor-pointer ${
                  docStep === 'quantities' || docStep === 'preview'
                    ? 'border-primary text-primary bg-orange-50/50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                3. {isTa ? 'அளவுகள் & முன்னோட்டம்' : 'Quantities & Preview'}
              </button>
            </div>

            {/* Step Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* STEP 1: DETAILS */}
              {docStep === 'details' && (
                <div className="space-y-4 max-w-xl mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'நிகழ்வு / சுபமுகூர்த்தப் பெயர் *' : 'Function / Event Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={docEventName}
                      onChange={(e) => setDocEventName(e.target.value)}
                      placeholder={isTa ? 'எ.கா. ஆனந்த் - வித்யா திருமணம் (Muhurtham Feast)' : 'e.g. Wedding Reception, Birthday Catering'}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isTa ? 'வாடிக்கையாளர் பெயர் (விருப்பம்)' : 'Customer Name (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={docCustomerName}
                        onChange={(e) => setDocCustomerName(e.target.value)}
                        placeholder="Mr. Ramesh"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isTa ? 'நிகழ்வுத் தேதி *' : 'Event Date *'}
                      </label>
                      <input
                        type="date"
                        required
                        value={docEventDate}
                        onChange={(e) => setDocEventDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isTa ? 'தயாரித்தவர் பெயர்' : 'Prepared By (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={docPreparedBy}
                        onChange={(e) => setDocPreparedBy(e.target.value)}
                        placeholder="Admin / Head Cook"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isTa ? 'ஆவண மொழி' : 'Document Language'}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDocLanguage('ta')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            docLanguage === 'ta'
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          தமிழ் (Tamil)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocLanguage('en')}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            docLanguage === 'en'
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          English
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'சிறப்புக் குறிப்புகள்' : 'Special Notes for Purchase / Kitchen'}
                    </label>
                    <textarea
                      rows={2}
                      value={docNotes}
                      onChange={(e) => setDocNotes(e.target.value)}
                      placeholder={isTa ? 'எ.கா. பொருட்கள் காலை 6 மணிக்குள் வந்து சேர வேண்டும்.' : 'e.g. Deliver to venue kitchen before 6 AM.'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT ITEMS */}
              {docStep === 'select' && (
                <div className="space-y-4">
                  {/* Search & Category Filter */}
                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={docItemSearch}
                        onChange={(e) => setDocItemSearch(e.target.value)}
                        placeholder={isTa ? 'பொருட்களைத் தேடவும்…' : 'Search items to add…'}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <select
                      value={docItemCategory}
                      onChange={(e) => setDocItemCategory(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white cursor-pointer"
                    >
                      <option value="all">{isTa ? 'அனைத்து வகைகள்' : 'All Categories'}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {isTa ? c.nameTa : c.nameEn}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowCustomItemRow(!showCustomItemRow)}
                      className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-primary rounded-xl text-xs font-bold border border-orange-200 cursor-pointer whitespace-nowrap"
                    >
                      {isTa ? '+ புதிய பொருள் உள்ளீடு' : '+ Quick Add Item'}
                    </button>
                  </div>

                  {/* Inline quick add custom item if not in catalogue */}
                  {showCustomItemRow && (
                    <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-slate-800">
                        {isTa ? 'பட்டியலில் இல்லாத தனிப்பொருள் சேர்:' : 'Add Custom Item directly to document:'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={customItemNameEn}
                          onChange={(e) => setCustomItemNameEn(e.target.value)}
                          placeholder="Item Name (English) *"
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={customItemNameTa}
                          onChange={(e) => setCustomItemNameTa(e.target.value)}
                          placeholder="பெயர் (தமிழில்)"
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <div className="flex gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={customItemQty}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '' || /^\d*\.?\d*$/.test(v)) setCustomItemQty(v);
                            }}
                            onBlur={() => {
                              const v = customItemQty.trim();
                              if (!v || isNaN(parseFloat(v)) || parseFloat(v) <= 0) {
                                setCustomItemQty('1');
                              } else if (v.endsWith('.')) {
                                setCustomItemQty(String(parseFloat(v)));
                              }
                            }}
                            placeholder="Qty"
                            className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <select
                            value={customItemUnit}
                            onChange={(e) => setCustomItemUnit(e.target.value)}
                            className="flex-1 px-1 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                          >
                            {SUPPORTED_UNITS.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.shortEn}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCustomDocItem}
                          className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                        >
                          {isTa ? 'சேர்' : 'Add to List'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Items checkbox selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto p-1">
                    {items
                      .filter((item) => {
                        const q = docItemSearch.trim().toLowerCase();
                        const matchQ =
                          !q ||
                          item.nameEn.toLowerCase().includes(q) ||
                          item.nameTa.toLowerCase().includes(q);
                        const matchC = docItemCategory === 'all' || item.categoryId === docItemCategory;
                        return matchQ && matchC;
                      })
                      .map((item) => {
                        const isSelected = selectedDocItems.some(
                          (si) => si.catalogueItemId === item.id
                        );
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleDocItemSelection(item)}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-orange-50 border-primary text-primary font-semibold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {isTa ? item.nameTa : item.nameEn}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {isTa ? item.nameEn : item.nameTa} • {formatUnitLabel(item.unit, lang)}
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ${
                                isSelected
                                  ? 'bg-primary border-primary text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check size={14} className="stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {isTa ? 'தேர்ந்தெடுக்கப்பட்ட பொருட்கள்: ' : 'Selected items count: '}
                      <strong className="text-primary">{selectedDocItems.length}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocStep('quantities')}
                      disabled={selectedDocItems.length === 0}
                      className="px-4 py-1.5 bg-primary disabled:opacity-50 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                    >
                      {isTa ? 'அளவுகள் உள்ளிட அடுத்து செல்க →' : 'Proceed to Enter Quantities →'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: ENTER QUANTITIES & PREVIEW */}
              {docStep === 'quantities' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isTa ? 'தேவையான அளவுகளை உள்ளிடவும்' : 'Enter Required Quantities for Function'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {isTa
                          ? 'விலை விருப்பத்தேர்வு மட்டுமே. தேவைப்படாவிட்டால் விலையை காலியாக விடலாம்.'
                          : 'Prices are completely optional. Leave blank if you only need a quantity list.'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-primary border border-orange-200">
                      {selectedDocItems.length} {isTa ? 'பொருட்கள்' : 'items'}
                    </span>
                  </div>

                  {/* Validation error banner if any quantities are missing */}
                  {qtyValidationError && (
                    <div className="p-3.5 sm:p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 text-red-800 animate-in fade-in">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs sm:text-sm">
                        <p className="font-bold">{isTa ? 'அளவு சரிபார்ப்பு பிழை (Validation Error):' : 'Validation Error:'}</p>
                        <p className="mt-0.5 font-medium leading-relaxed">{qtyValidationError}</p>
                      </div>
                    </div>
                  )}

                  {/* Selected items table with editable inputs */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[46vh]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3">{isTa ? 'பொருள்' : 'Item Name'}</th>
                            <th className="py-2.5 px-3 w-28 text-center">{isTa ? 'அளவு *' : 'Quantity *'}</th>
                            <th className="py-2.5 px-3 w-24">{isTa ? 'அலகு' : 'Unit'}</th>
                            <th className="py-2.5 px-3 w-28">{isTa ? 'விலை (₹) (விருப்பம்)' : 'Price (₹) (Opt)'}</th>
                            <th className="py-2.5 px-3 w-32">{isTa ? 'குறிப்பு' : 'Notes / Remarks'}</th>
                            <th className="py-2.5 px-2 w-8 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedDocItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <p className="font-bold text-slate-900">
                                  {docLanguage === 'ta' ? item.nameTa || item.nameEn : item.nameEn}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {docLanguage === 'ta' ? item.nameEn : item.nameTa}
                                </p>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex flex-col items-center">
                                  <input
                                    id={`doc-qty-input-${item.id}`}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={item.quantity}
                                    onChange={(e) => updateDocItemQuantity(item.id, e.target.value)}
                                    onBlur={() => handleBlurDocItemQuantity(item.id)}
                                    placeholder={isTa ? 'அளவு' : 'Qty'}
                                    className={`w-20 px-2 py-1 text-center border rounded-lg text-xs font-bold bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                                      missingQtyItemIds.includes(item.id)
                                        ? 'border-2 border-red-500 bg-red-50/70 text-red-700 ring-2 ring-red-400 focus:ring-red-500'
                                        : 'border-slate-200 text-primary focus:ring-1 focus:ring-primary'
                                    }`}
                                  />
                                  {missingQtyItemIds.includes(item.id) && (
                                    <span className="text-[10px] text-red-600 font-bold block mt-0.5 whitespace-nowrap animate-pulse">
                                      {isTa ? 'அளவு தேவை *' : 'Qty required *'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={item.unit}
                                  onChange={(e) => updateDocItemUnit(item.id, e.target.value)}
                                  className="px-1.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                                >
                                  {SUPPORTED_UNITS.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {formatUnitLabel(u.id, docLanguage)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={item.unitPrice !== undefined ? item.unitPrice : ''}
                                  onChange={(e) => updateDocItemPrice(item.id, e.target.value)}
                                  placeholder="—"
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) => updateDocItemNotes(item.id, e.target.value)}
                                  placeholder="e.g. 1st grade"
                                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeDocItem(item.id)}
                                  className="text-slate-300 hover:text-red-500 cursor-pointer p-1"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PREVIEW & DOWNLOAD */}
              {docStep === 'preview' && previewDoc && (
                <div className="space-y-4">
                  {/* Action Banner */}
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isTa ? 'ஆவணம் வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : 'Document Successfully Saved!'}
                      </h4>
                      <p className="text-xs text-slate-600">
                        {previewDoc.docNumber} • {previewDoc.eventName} ({previewDoc.items.length} {isTa ? 'பொருட்கள்' : 'items'})
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleDownloadPDF(previewDoc, 'en')}
                        disabled={isPdfGenerating}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Download size={14} /> English PDF
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(previewDoc, 'ta')}
                        disabled={isPdfGenerating}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-[#c2410c] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Download size={14} /> தமிழ் PDF
                      </button>

                      <button
                        onClick={() => printInventoryDocument(previewDoc, docLanguage)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <Printer size={14} /> {isTa ? 'அச்சிடு' : 'Print'}
                      </button>

                      <button
                        onClick={() => inventoryService.exportToCsv(previewDoc, docLanguage)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <FileSpreadsheet size={14} /> CSV / Excel
                      </button>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  {isPdfGenerating && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-primary">
                        <span>{pdfProgress.status}</span>
                        <span>{pdfProgress.percent}%</span>
                      </div>
                      <div className="w-full bg-orange-200/60 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-300"
                          style={{ width: `${pdfProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Paper-like Preview Container */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    {/* Header */}
                    <div className="border-b-2 border-primary pb-4 flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold text-primary">{previewDoc.title}</h2>
                        <p className="text-xs text-slate-500 font-medium">Kanchi Ambal Catering Service • காஞ்சி அம்பாள் கேட்டரிங்</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-orange-50 text-primary border border-orange-200">
                          {previewDoc.docNumber}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">{previewDoc.documentDate}</p>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isTa ? 'நிகழ்வு' : 'Event'}</span>
                        <span className="font-bold text-slate-900">{previewDoc.eventName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isTa ? 'வாடிக்கையாளர்' : 'Customer'}</span>
                        <span className="font-semibold text-slate-800">{previewDoc.customerName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isTa ? 'நிகழ்வுத் தேதி' : 'Event Date'}</span>
                        <span className="font-semibold text-slate-800">{previewDoc.eventDate}</span>
                      </div>
                    </div>

                    {/* Table Preview */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-primary text-white font-semibold">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-10">#</th>
                            <th className="py-2.5 px-3">{isTa ? 'பொருள்' : 'Item'}</th>
                            <th className="py-2.5 px-3">{isTa ? 'வகை' : 'Category'}</th>
                            <th className="py-2.5 px-3 text-center">{isTa ? 'தேவையான அளவு' : 'Required Qty'}</th>
                            {previewDoc.items.some((i) => i.unitPrice) && (
                              <th className="py-2.5 px-3 text-right">{isTa ? 'விலை' : 'Unit Price'}</th>
                            )}
                            {previewDoc.items.some((i) => i.unitPrice) && (
                              <th className="py-2.5 px-3 text-right">{isTa ? 'மொத்தம்' : 'Total'}</th>
                            )}
                            <th className="py-2.5 px-3">{isTa ? 'குறிப்பு' : 'Remarks'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewDoc.items.map((it, idx) => (
                            <tr key={it.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {docLanguage === 'ta' ? it.nameTa || it.nameEn : it.nameEn}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {docLanguage === 'ta' ? it.categoryNameTa || it.categoryNameEn : it.categoryNameEn}
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-primary">
                                {it.quantity} {formatUnitLabel(it.unit, docLanguage)}
                              </td>
                              {previewDoc.items.some((i) => i.unitPrice) && (
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {it.unitPrice ? `₹${it.unitPrice}` : '—'}
                                </td>
                              )}
                              {previewDoc.items.some((i) => i.unitPrice) && (
                                <td className="py-2 px-3 text-right font-bold text-primary">
                                  {it.totalPrice ? `₹${it.totalPrice}` : '—'}
                                </td>
                              )}
                              <td className="py-2 px-3 text-slate-500 text-[11px]">{it.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary row */}
                    <div className="flex justify-between items-center bg-orange-50/50 p-3.5 rounded-xl border border-orange-100 text-xs">
                      <span className="font-bold text-slate-700">
                        {isTa ? 'மொத்த பொருட்கள்: ' : 'Total Items: '} {previewDoc.items.length}
                      </span>
                      {previewDoc.totalAmount && previewDoc.totalAmount > 0 ? (
                        <span className="text-base font-bold text-primary">
                          {isTa ? 'மதிப்பிடப்பட்ட மொத்தத் தொகை: ' : 'Total Estimated: '} ₹{previewDoc.totalAmount.toLocaleString('en-IN')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Navigation */}
            <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                {docStep !== 'details' && docStep !== 'preview' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (docStep === 'quantities') setDocStep('select');
                      else if (docStep === 'select') setDocStep('details');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    ← {isTa ? 'முந்தைய படி' : 'Back'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  {isTa ? 'மூடு' : 'Close'}
                </button>

                {docStep === 'details' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!docEventName.trim()) {
                        alert(isTa ? 'தயவுசெய்து நிகழ்வு பெயரை உள்ளிடவும்.' : 'Please enter event name.');
                        return;
                      }
                      setDocStep('select');
                    }}
                    className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {isTa ? 'பொருட்கள் தேர்வு செய்ய செல்க →' : 'Next: Select Items →'}
                  </button>
                )}

                {docStep === 'select' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDocItems.length === 0) {
                        alert(isTa ? 'குறைந்தது ஒரு பொருளையாவது தேர்ந்தெடுக்கவும்.' : 'Select at least one item.');
                        return;
                      }
                      setDocStep('quantities');
                    }}
                    className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {isTa ? 'அளவுகள் உள்ளிட செல்க →' : 'Next: Enter Quantities →'}
                  </button>
                )}

                {docStep === 'quantities' && (
                  <button
                    type="button"
                    onClick={handleSaveAndPreviewDocument}
                    className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <span>{isTa ? 'ஆவணத்தைச் சேமி & முன்னோட்டம் காண் ✓' : 'Save Document & Preview ✓'}</span>
                    {missingQtyItemIds.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
                        {missingQtyItemIds.length} {isTa ? 'அளவு விடுபட்டுள்ளது' : 'missing'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
