import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Trash2,
  Check,
  User,
  IndianRupee,
  Layers,
  Sparkles,
} from 'lucide-react';
import { categories as staticCategories, type MenuItem } from '../../data/menu';
import { dishService } from '../../services/dishService';
import { orderService } from '../../services/orderService';
import { customerService } from '../../services/customerService';
import { getDishUnitConfig, MEASUREMENT_UNITS } from '../../data/units';
import { useLanguage } from '../../context/LanguageContext';
import type { Order, OrderStatus, OrderSource, PaymentMethod, OrderPayment } from '../../types/admin';

interface SelectedOrderItem {
  tempId: string;
  dishId: string;
  dishName: string;
  categoryId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface AdminAddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSaved: (order: Order, openDetail?: boolean) => void;
  initialCustomer?: {
    id?: string;
    name: string;
    mobile: string;
    alternativeMobile?: string;
    preferredLanguage?: 'en' | 'ta';
  };
}

const ORDER_SOURCES: OrderSource[] = [
  'Phone Call',
  'WhatsApp',
  'Website',
  'Direct / Walk-in',
  'Other',
];

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'In Preparation',
  'Ready',
  'Completed',
  'Cancelled',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Bank Transfer',
  'Card',
  'Cheque',
  'Other',
];

export const AdminAddOrderModal: React.FC<AdminAddOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderSaved,
  initialCustomer,
}) => {
  const { dishName: getDishNameTa, lang } = useLanguage();
  const isTa = lang === 'ta';

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(
    initialCustomer?.id
  );
  const [customerName, setCustomerName] = useState(initialCustomer?.name || '');
  const [mobile, setMobile] = useState(initialCustomer?.mobile || '');
  const [altMobile, setAltMobile] = useState(initialCustomer?.alternativeMobile || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Order Details
  const [orderSource, setOrderSource] = useState<OrderSource>('Phone Call');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [guestCount, setGuestCount] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Confirmed');

  // Food Items selection
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [dishSearch, setDishSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Payment state
  const [totalAmountInput, setTotalAmountInput] = useState('');
  const [advanceAmountInput, setAdvanceAmountInput] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('UPI');
  const [advanceNote] = useState('Initial advance payment');

  // Form feedback & loading
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Combine static and admin-added dishes
  const allDishes = useMemo(() => {
    const list: (MenuItem & { isAdminAdded?: boolean })[] = [];
    staticCategories.forEach((cat) => {
      cat.items.forEach((item) => {
        list.push(item);
      });
    });

    const adminDishes = dishService.getAll();
    adminDishes.forEach((ad) => {
      list.push({
        id: ad.id,
        name: ad.name,
        categoryId: ad.categoryId,
        image: ad.image,
        isAdminAdded: true,
      });
    });

    return list;
  }, []);

  // Customer search suggestions
  const customerSuggestions = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    return customerService.search(customerSearchQuery).slice(0, 5);
  }, [customerSearchQuery]);

  // Filtered dishes for selection
  const filteredDishes = useMemo(() => {
    let result = allDishes;

    if (selectedCategoryFilter !== 'all') {
      result = result.filter((d) => d.categoryId === selectedCategoryFilter);
    }

    if (dishSearch.trim()) {
      const q = dishSearch.toLowerCase();
      result = result.filter((d) => {
        const enMatch = d.name.toLowerCase().includes(q);
        const taName = getDishNameTa(d.id, d.name).toLowerCase();
        return enMatch || taName.includes(q);
      });
    }

    return result;
  }, [allDishes, selectedCategoryFilter, dishSearch, getDishNameTa]);

  if (!isOpen) return null;

  // Add a dish to the order
  function handleAddDish(dish: MenuItem) {
    const unitConfig = getDishUnitConfig(dish.categoryId);
    const existingCount = selectedItems.filter((i) => i.dishId === dish.id).length;

    const newItem: SelectedOrderItem = {
      tempId: `${dish.id}-${existingCount + 1}-${selectedItems.length + 1}`,
      dishId: dish.id,
      dishName: dish.name,
      categoryId: dish.categoryId,
      quantity: unitConfig.defaultUnit === 'Cups' ? 50 : unitConfig.defaultUnit === 'Pieces' ? 50 : 2,
      unit: unitConfig.defaultUnit,
      notes: '',
    };

    setSelectedItems((prev) => [...prev, newItem]);
    if (errors.items) {
      setErrors((prev) => {
        const cp = { ...prev };
        delete cp.items;
        return cp;
      });
    }
  }

  function handleRemoveItem(tempId: string) {
    setSelectedItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  function handleUpdateItem(tempId: string, changes: Partial<SelectedOrderItem>) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, ...changes } : i))
    );
  }

  function handleSelectExistingCustomer(c: ReturnType<typeof customerService.getAll>[0]) {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setMobile(c.mobile);
    setAltMobile(c.alternativeMobile || '');
    setShowCustomerSuggestions(false);
    setCustomerSearchQuery('');
  }

  // Payment calculations
  const totalAmount = parseFloat(totalAmountInput) || 0;
  const advanceAmount = parseFloat(advanceAmountInput) || 0;
  const balanceDue = Math.max(0, totalAmount - advanceAmount);
  const paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' =
    advanceAmount <= 0
      ? 'Unpaid'
      : advanceAmount >= totalAmount && totalAmount > 0
      ? 'Paid'
      : 'Partially Paid';

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!customerName.trim()) {
      errs.customerName = isTa ? 'வாடிக்கையாளர் பெயர் அவசியம்' : 'Customer Name is required.';
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.mobile = isTa ? 'மொபைல் எண் அவசியம்' : 'Mobile Number is required.';
    } else if (cleanMobile.length < 10) {
      errs.mobile = isTa ? 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்' : 'Enter a valid 10-digit mobile number.';
    }

    if (!deliveryDate) {
      errs.deliveryDate = isTa ? 'டெலிவரி தேதி அவசியம்' : 'Delivery Date is required.';
    }

    if (selectedItems.length === 0) {
      errs.items = isTa ? 'குறைந்தது ஒரு உணவுப் பொருளை சேர்க்கவும்' : 'Please select at least one dish.';
    }

    // Validate quantities
    for (const item of selectedItems) {
      if (isNaN(item.quantity) || item.quantity <= 0) {
        errs.items = isTa
          ? 'அனைத்து உணவுப் பொருட்களுக்கும் சரியான அளவு உள்ளிடவும்'
          : 'All selected dishes must have a quantity greater than 0.';
        break;
      }
    }

    if (totalAmount < 0) {
      errs.totalAmount = isTa ? 'மொத்தத் தொகை 0 அல்லது அதற்கு மேல் இருக்க வேண்டும்' : 'Total amount cannot be negative.';
    }

    if (advanceAmount < 0 || (totalAmount > 0 && advanceAmount > totalAmount)) {
      errs.advanceAmount = isTa
        ? 'முன்பணம் மொத்த தொகையை விட அதிகமாக இருக்க முடியாது'
        : 'Advance payment cannot exceed the total amount.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave(openDetail = false) {
    if (!validate()) return;
    setSaving(true);

    try {
      const cleanMobile = mobile.replace(/\D/g, '');

      // 1. Find or create Customer
      let customerId = selectedCustomerId;
      if (!customerId) {
        const customer = customerService.findOrCreateFromOrder({
          customerName: customerName.trim(),
          mobile: cleanMobile,
          alternativeMobile: altMobile.replace(/\D/g, '') || undefined,
          notes: specialInstructions.trim() || undefined,
          preferredLanguage: isTa ? 'ta' : 'en',
        });
        customerId = customer.id;
      }

      // 2. Format Order Items
      const orderItems = selectedItems.map((item) => ({
        dishId: item.dishId,
        dishName: item.dishName,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes?.trim() || undefined,
      }));

      // 3. Format Food Quantities for flexible measurement unit tracking
      const foodQuantities = selectedItems.map((item) => ({
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        unit: item.unit,
        note: item.notes?.trim() || undefined,
      }));

      // 4. Initial Payments array
      const initialPayments: OrderPayment[] = [];
      if (advanceAmount > 0) {
        initialPayments.push({
          id: `pay-${Date.now()}-adv`,
          amount: advanceAmount,
          date: orderDate,
          method: advanceMethod,
          note: advanceNote || 'Initial advance payment',
        });
      }

      // 5. Create Order
      const newOrder = await orderService.create({
        customerId,
        customerName: customerName.trim(),
        mobile: cleanMobile,
        alternativeMobile: altMobile.replace(/\D/g, '') || undefined,
        orderSource,
        eventAddress: deliveryAddress.trim() || 'Not specified',
        eventType: orderSource,
        orderDate: deliveryDate,
        deliveryTime: deliveryTime.trim() || undefined,
        items: orderItems,
        guestCount: guestCount ? parseInt(guestCount, 10) : null,
        foodQuantities,
        totalAmount,
        advanceAmount,
        balancePaid: 0,
        payments: initialPayments,
        status,
        notes: specialInstructions.trim(),
        adminNotes: adminNotes.trim() || undefined,
      });

      onOrderSaved(newOrder, openDetail);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col z-10 border border-slate-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-orange-100 text-primary flex items-center justify-center font-bold text-sm">
                <Plus size={18} />
              </span>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">
                {isTa ? 'புதிய ஆர்டரை உருவாக்கவும்' : 'Add New Order (Manual Entry)'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 ml-10">
              {isTa
                ? 'தொலைபேசி அழைப்பு அல்லது நேரடி வாடிக்கையாளர் ஆர்டர்களை உள்ளிடவும்'
                : 'Enter phone orders, WhatsApp inquiries, or walk-in customer bookings'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Customer Details */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <User size={16} className="text-primary" />
                {isTa ? '1. வாடிக்கையாளர் விவரங்கள்' : '1. Customer Information'}
              </h3>
              {selectedCustomerId && (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={12} /> {selectedCustomerId}
                </span>
              )}
            </div>

            {/* Quick Customer Search / Autocomplete */}
            <div className="relative">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder={
                    isTa
                      ? 'முன்பே உள்ள வாடிக்கையாளரை பெயர் / எண்ணால் தேடவும்...'
                      : 'Search existing customer by name or mobile to auto-fill...'
                  }
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectExistingCustomer(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-orange-50/60 flex items-center justify-between text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-slate-500 text-xs">
                          Ph: {c.mobile} {c.alternativeMobile ? `| Alt: ${c.alternativeMobile}` : ''}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'வாடிக்கையாளர் பெயர் *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (errors.customerName) setErrors((p) => ({ ...p, customerName: '' }));
                  }}
                  placeholder={isTa ? 'எ.கா. ஆர். சுரேஷ்' : 'e.g. Suresh Kumar'}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    errors.customerName ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
                {errors.customerName && (
                  <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'முதன்மை மொபைல் எண் *' : 'Mobile Number *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value.replace(/\D/g, ''));
                      if (errors.mobile) setErrors((p) => ({ ...p, mobile: '' }));
                    }}
                    placeholder="9876543210"
                    className={`w-full pl-11 pr-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      errors.mobile ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'மாற்று மொபைல் எண் (விருப்பம்)' : 'Alternative Mobile (Optional)'}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={altMobile}
                  onChange={(e) => setAltMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder={isTa ? 'மாற்று எண்' : 'Secondary phone number'}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'ஆர்டர் மூலம் (Order Source)' : 'Order Source'}
                </label>
                <select
                  value={orderSource}
                  onChange={(e) => setOrderSource(e.target.value as OrderSource)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {ORDER_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'ஆர்டர் பதிவு செய்த தேதி' : 'Order Placed Date'}
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'டெலிவரி / நிகழ்வு தேதி *' : 'Delivery / Event Date *'}
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => {
                    setDeliveryDate(e.target.value);
                    if (errors.deliveryDate) setErrors((p) => ({ ...p, deliveryDate: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    errors.deliveryDate ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
                {errors.deliveryDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.deliveryDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'டெலிவரி நேரம் (விருப்பம்)' : 'Delivery Time (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isTa ? 'எ.கா. காலை 7:30 அல்லது மதியம் 12:00' : 'e.g. 7:30 AM or 12:30 PM'}
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'நபர்களின் எண்ணிக்கை (விருப்பம்)' : 'Number of People / Guests (Optional)'}
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={isTa ? 'எ.கா. 150' : 'e.g. 150'}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'டெலிவரி முகவரி (விருப்பம்)' : 'Delivery Address (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isTa ? 'முகவரி / மண்டபம் பெயர்' : 'Event hall or delivery address'}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Notes row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'வாடிக்கையாளர் சிறப்பு குறிப்புகள்' : 'Customer Special Instructions'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isTa ? 'கார அளவு, உணவு நேரம், பேக்கிங் தேவைகள்...' : 'Spice preferences, hot delivery packing...'}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'உள் நிர்வாக குறிப்புகள் (Internal Admin Notes)' : 'Internal Admin Notes'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isTa ? 'சமையல் குழு, பாத்திரங்கள் அல்லது உள் நினைவூட்டல்...' : 'Cook assigned, vessel return notes, driver info...'}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Food Selection & Measurement Units */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers size={16} className="text-primary" />
                  {isTa ? '2. உணவுத் தேர்வுகள் & அளவீடுகள்' : '2. Food Selection & Flexible Units'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isTa
                    ? 'உணவை தேர்ந்தெடுத்து தேவையான அளவு மற்றும் அலகை (Units) உள்ளிடவும்'
                    : 'Search dishes, select appropriate measurement units (kg, litres, cups, pieces) and quantity'}
                </p>
              </div>
              <span className="text-xs bg-orange-100 text-primary font-semibold px-2.5 py-1 rounded-full">
                {selectedItems.length} {isTa ? 'உணவுகள்' : 'items'}
              </span>
            </div>

            {/* Dish Search & Category Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder={isTa ? 'உணவுப் பெயரை தேடவும் (தமிழ் / ஆங்கிலம்)...' : 'Search dishes by English or Tamil name...'}
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              >
                <option value="all">{isTa ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
                {staticCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dish Picker Grid */}
            <div className="border border-slate-200 bg-white rounded-xl p-3 max-h-48 overflow-y-auto">
              {filteredDishes.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">
                  {isTa ? 'உணவுகள் எதுவும் கிடைக்கவில்லை' : 'No matching dishes found.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredDishes.map((dish) => {
                    const isSelected = selectedItems.some((i) => i.dishId === dish.id);
                    const displayName = isTa ? getDishNameTa(dish.id, dish.name) : dish.name;
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => handleAddDish(dish)}
                        className={`text-left p-2 rounded-lg border text-xs flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-orange-300 bg-orange-50/50 text-slate-900 font-semibold'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{displayName}</span>
                        <Plus
                          size={14}
                          className={`flex-shrink-0 ${
                            isSelected ? 'text-primary' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Items Table / List */}
            {errors.items && <p className="text-red-500 text-xs">{errors.items}</p>}

            {selectedItems.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isTa ? 'ஆர்டரில் சேர்க்கப்பட்ட உணவுகள்' : 'Selected Order Items'}
                </p>
                <div className="space-y-2">
                  {selectedItems.map((item, index) => {
                    const unitConfig = getDishUnitConfig(item.categoryId);
                    const displayName = isTa ? getDishNameTa(item.dishId, item.dishName) : item.dishName;

                    return (
                      <div
                        key={item.tempId}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2.5 justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0 sm:w-1/3">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px] flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {displayName}
                            </p>
                            {isTa && (
                              <p className="text-[11px] text-slate-500 truncate">{item.dishName}</p>
                            )}
                          </div>
                        </div>

                        {/* Quantity and Unit Controls */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <label className="text-[11px] text-slate-400 font-medium">
                              {isTa ? 'அளவு:' : 'Qty:'}
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.tempId, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-20 px-2 py-1 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                            />
                          </div>

                          {/* Unit Selector */}
                          <select
                            value={item.unit}
                            onChange={(e) =>
                              handleUpdateItem(item.tempId, { unit: e.target.value })
                            }
                            className="px-2.5 py-1 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            {unitConfig.options.map((u) => {
                              const found = MEASUREMENT_UNITS.find((mu) => mu.id === u);
                              return (
                                <option key={u} value={u}>
                                  {isTa && found ? found.labelTa : u}
                                </option>
                              );
                            })}
                          </select>

                          {/* Item Note */}
                          <input
                            type="text"
                            placeholder={isTa ? 'குறிப்பு (கார அளவு...)' : 'Item note (e.g. less spicy)'}
                            value={item.notes || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.tempId, { notes: e.target.value })
                            }
                            className="flex-1 min-w-[120px] px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />

                          {/* Duplicate / extra batch button */}
                          <button
                            type="button"
                            title={isTa ? 'கூடுதல் அளவு சேர்க்க' : 'Add another quantity entry for this dish'}
                            onClick={() => {
                              const duplicate: SelectedOrderItem = {
                                tempId: `${item.dishId}-${Date.now()}-extra`,
                                dishId: item.dishId,
                                dishName: item.dishName,
                                categoryId: item.categoryId,
                                quantity: item.quantity,
                                unit: item.unit,
                                notes: item.notes,
                              };
                              setSelectedItems((p) => [...p, duplicate]);
                            }}
                            className="p-1 text-slate-400 hover:text-primary hover:bg-orange-50 rounded transition-colors"
                          >
                            <Plus size={15} />
                          </button>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.tempId)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Payment & Initial Status */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <IndianRupee size={16} className="text-primary" />
              {isTa ? '3. கட்டண விவரங்கள் & நிலை' : '3. Payment & Order Status'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'மொத்தத் தொகை (₹)' : 'Total Amount (₹)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={totalAmountInput}
                    onChange={(e) => setTotalAmountInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {errors.totalAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'முன்பணம் (Advance) (₹)' : 'Advance Payment (₹)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={advanceAmountInput}
                    onChange={(e) => setAdvanceAmountInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {errors.advanceAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.advanceAmount}</p>
                )}
              </div>

              {advanceAmount > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isTa ? 'முன்பண முறை' : 'Advance Payment Method'}
                  </label>
                  <select
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isTa ? 'ஆர்டர் நிலை' : 'Initial Order Status'}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Balance Due calculation summary */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-slate-500">
                  {isTa ? 'மீதமுள்ள தொகை (Balance Due):' : 'Calculated Balance Due:'}
                </p>
                <p className="text-lg font-extrabold text-slate-900">
                  ₹{balanceDue.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{isTa ? 'கட்டண நிலை:' : 'Payment Status:'}</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    paymentStatus === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : paymentStatus === 'Partially Paid'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {paymentStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {isTa ? 'ரத்து செய்' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (isTa ? 'சேமிக்கிறது...' : 'Saving...') : isTa ? 'ஆர்டரைச் சேமி' : 'Save Order'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>{isTa ? 'சேமித்து பார்க்க' : 'Save and View Order'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
