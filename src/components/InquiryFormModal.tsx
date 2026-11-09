import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { generateWhatsAppLink } from '../utils/whatsapp';
import { orderService } from '../services/orderService';
import { customerService } from '../services/customerService';
import { messageService } from '../services/messageService';
import type { OrderItem } from '../types/admin';

interface InquiryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InquiryFormModal: React.FC<InquiryFormModalProps> = ({ isOpen, onClose }) => {
  const { cartItems, guestCount, foodQuantities, clearCart } = useCart();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    eventAddress: '',
    eventType: '',
    eventDate: '',
    notes: ''
  });

  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (errors[e.target.name]) {
      setErrors(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
    }
  };

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = t.nameRequired;
    if (!formData.phone.trim()) errs.phone = t.phoneRequired;
    else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\s/g, ''))) errs.phone = t.phoneInvalid;
    if (!formData.eventAddress.trim()) errs.eventAddress = t.addressRequired;
    if (!formData.eventDate) errs.eventDate = t.dateRequired;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Map cart items into snapshot order items
      const orderItems: OrderItem[] = cartItems.map((item) => ({
        dishId: item.id,
        dishName: item.name,   // snapshot — safe even if dish is later renamed/deleted
        categoryId: item.categoryId,
      }));

      // Find or create customer record
      const customer = customerService.findOrCreateFromOrder({
        customerName: formData.name.trim(),
        mobile: formData.phone.replace(/\s/g, ''),
        notes: formData.notes.trim() || undefined,
        preferredLanguage: t.lang === 'ta' ? 'ta' : 'en',
      });

      // Save order permanently to Supabase
      const order = await orderService.create({
        customerId: customer.id,
        customerName: formData.name.trim(),
        mobile: formData.phone.replace(/\s/g, ''),
        orderSource: 'Website',
        eventAddress: formData.eventAddress.trim(),
        eventType: formData.eventType.trim(),
        orderDate: formData.eventDate,
        items: orderItems,
        guestCount,
        foodQuantities, // Include food quantities in the order
        totalAmount: 0,
        advanceAmount: 0,
        balancePaid: 0,
        payments: [],
        status: 'Pending',
        notes: formData.notes.trim(),
      });

      // Also record in customer_messages table
      messageService.submitMessage({
        customerName: formData.name.trim(),
        phone: formData.phone.replace(/\s/g, ''),
        eventType: formData.eventType.trim(),
        eventDate: formData.eventDate,
        guestCount: guestCount || undefined,
        message: formData.notes.trim() || `Website inquiry for ${formData.eventType || 'Event'} at ${formData.eventAddress.trim()}`,
      }).catch((e) => console.warn('Customer message record error:', e));

      const displayNum = order.orderNumber || order.id;
      setOrderId(displayNum);
      setSubmitted(true);

      // Send via WhatsApp
      const url = generateWhatsAppLink(order, t);
      window.open(url, '_blank');

      clearCart();
    } catch (err: any) {
      console.error('Order submission error:', err);
      setSubmitError(
        t.lang === 'ta'
          ? `ஆர்டரைச் சேமிப்பதில் பிழை ஏற்பட்டது: ${err.message || 'மீண்டும் முயற்சிக்கவும்.'}`
          : `Failed to save order to database: ${err.message || 'Please check your connection and try again.'}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && orderId) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t.orderPlaced}</h2>
          <p className="text-slate-600 text-sm mb-4">
            {t.orderSuccess}
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs text-primary font-semibold">{t.yourOrderId}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{orderId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-[#c2410c] text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            {t.done}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-5 sm:p-6 overflow-y-auto max-h-[90vh] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-blue-950">{t.yourDetails}</h2>
          <button
            onClick={onClose}
            className="text-blue-400 hover:text-blue-700 transition-colors p-2 -mr-2"
            aria-label="Close form"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.name} *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.phone} *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.phone ? 'border-red-400' : 'border-gray-300'}`}
              placeholder={t.phonePlaceholder}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.eventAddress} *</label>
            <input
              type="text"
              name="eventAddress"
              value={formData.eventAddress}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.eventAddress ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.eventAddress && <p className="text-red-500 text-xs mt-1">{errors.eventAddress}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.eventType}</label>
            <input
              type="text"
              name="eventType"
              value={formData.eventType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.eventDate} *</label>
            <input
              type="date"
              name="eventDate"
              value={formData.eventDate}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.eventDate ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-blue-900 mb-1">{t.additionalNotes}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={(e) => handleChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder={t.notePlaceholder}
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs sm:text-sm">
              <p className="font-semibold">{t.lang === 'ta' ? 'ஆர்டர் சேமிப்பில் பிழை:' : 'Order submission error:'}</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-[#c2410c] disabled:bg-orange-300 text-white py-3.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg cursor-pointer mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>{t.lang === 'ta' ? 'பதிவாகிறது...' : 'Saving to Database & Opening WhatsApp...'}</span>
              ) : (
                <span>{t.sendWhatsApp}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

