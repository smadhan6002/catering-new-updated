import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
  X,
  Check,
  AlertTriangle,
  IndianRupee,
  Plus,
  Pencil,
  Download,
  Phone,
  MessageSquare,
  Globe,
  Store,
  FileText,
  ChefHat,
  Loader2,
} from 'lucide-react';
import {
  orderService,
  normalizeOrderPayments,
  getOrderTotalPaid,
  getOrderBalanceDue,
  getOrderPaymentStatus,
} from '../../services/orderService';
import { invoiceService } from '../../services/invoiceService';
import { kitchenSheetService } from '../../services/kitchenSheetService';
import { generateInvoicePDF } from '../../utils/generateInvoicePDF';
import { AdminAddOrderModal } from './AdminAddOrderModal';
import { KitchenOrderSheetModal } from './KitchenOrderSheetModal';
import { useLanguage } from '../../context/LanguageContext';
import type { Order, OrderStatus, OrderPayment, PaymentMethod, OrderSource, PaymentStatus } from '../../types/admin';
import { ta } from '../../locales/ta';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending', 'Confirmed', 'In Preparation', 'Ready', 'Completed', 'Cancelled',
];

const ORDER_SOURCES: OrderSource[] = [
  'Phone Call', 'WhatsApp', 'Website', 'Direct / Walk-in', 'Other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other',
];

const statusColor: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  'In Preparation': 'bg-purple-100 text-purple-800',
  Ready: 'bg-cyan-100 text-cyan-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const payStatusColors: Record<string, string> = {
  'Paid': 'bg-green-100 text-green-800',
  'Fully Paid': 'bg-green-100 text-green-800',
  'Partial': 'bg-amber-100 text-amber-800',
  'Partially Paid': 'bg-amber-100 text-amber-800',
  'Advance Paid': 'bg-blue-100 text-blue-800',
  'Unpaid': 'bg-red-100 text-red-800',
};

const sourceBadgeStyles: Record<string, { bg: string; text: string; border: string }> = {
  'Phone Call': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'WhatsApp': { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  'Website': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'Direct / Walk-in': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  'Other': { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' },
};

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function getSourceIcon(src?: string) {
  switch (src) {
    case 'Phone Call':
      return <Phone size={12} className="text-emerald-600" />;
    case 'WhatsApp':
      return <MessageSquare size={12} className="text-green-600" />;
    case 'Direct / Walk-in':
      return <Store size={12} className="text-purple-600" />;
    case 'Website':
      return <Globe size={12} className="text-blue-600" />;
    default:
      return <FileText size={12} className="text-slate-500" />;
  }
}

// ─── ORDER DETAIL MODAL ────────────────────────────────────────────────
interface OrderDetailProps {
  order: Order;
  onClose: () => void;
  onUpdated: () => void;
  onOpenKitchenSheet: (order: Order) => void;
}

const OrderDetail: React.FC<OrderDetailProps> = ({ order: initialOrder, onClose, onUpdated, onOpenKitchenSheet }) => {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [totalAmt, setTotalAmt] = useState(String(initialOrder.totalAmount || ''));
  const [payments, setPayments] = useState<OrderPayment[]>(normalizeOrderPayments(initialOrder));
  const [notes, setNotes] = useState(initialOrder.notes || '');
  const [adminNotes, setAdminNotes] = useState(initialOrder.adminNotes || '');
  const [status, setStatus] = useState<OrderStatus>(initialOrder.status);
  const [payError, setPayError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // Payment Add / Edit Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payDateInput, setPayDateInput] = useState('');
  const [payMethodInput, setPayMethodInput] = useState<PaymentMethod>('UPI');
  const [payNoteInput, setPayNoteInput] = useState('');
  const [modalError, setModalError] = useState('');

  // Delete Payment Confirmation Modal state
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // Fetch real-time fresh payments from Supabase when order is viewed
  useEffect(() => {
    let isMounted = true;
    async function loadFreshPayments() {
      if (!initialOrder?.id) return;
      setLoadingPayments(true);
      try {
        const fresh = await orderService.getPaymentsForOrder(initialOrder.id);
        if (isMounted && Array.isArray(fresh)) {
          setPayments(fresh);
        }
      } catch (err) {
        console.warn('Failed to load fresh payments from Supabase:', err);
      } finally {
        if (isMounted) setLoadingPayments(false);
      }
    }
    loadFreshPayments();
    return () => { isMounted = false; };
  }, [initialOrder?.id]);

  // Automatic Dynamic Calculations
  const total = parseFloat(totalAmt) || 0;
  const currentTotalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const currentBalanceDue = Math.max(0, total - currentTotalPaid);
  const currentPayStatus: PaymentStatus =
    currentTotalPaid <= 0 ? 'Unpaid' : currentTotalPaid >= total && total > 0 ? 'Paid' : 'Partial';

  function openAddPaymentModal() {
    setEditingPaymentId(null);
    setPayAmountInput('');
    setPayDateInput(new Date().toISOString().split('T')[0]);
    setPayMethodInput('UPI');
    setPayNoteInput('');
    setModalError('');
    setIsPaymentModalOpen(true);
  }

  function openEditPaymentModal(payment: OrderPayment) {
    setEditingPaymentId(payment.id);
    setPayAmountInput(String(payment.amount));
    setPayDateInput(payment.date || new Date().toISOString().split('T')[0]);
    setPayMethodInput((payment.method as PaymentMethod) || 'UPI');
    setPayNoteInput(payment.note || '');
    setModalError('');
    setIsPaymentModalOpen(true);
  }

  async function handleSavePayment(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setModalError('');

    const amt = parseFloat(payAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Payment amount must be greater than ₹0.');
      return;
    }
    if (!payDateInput) {
      setModalError('Please select a valid payment date.');
      return;
    }
    if (!payMethodInput) {
      setModalError('Please select a payment method.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (editingPaymentId) {
        const result = await orderService.updatePayment(
          order.id,
          editingPaymentId,
          {
            amount: amt,
            date: payDateInput,
            method: payMethodInput,
            note: payNoteInput.trim() || undefined,
          },
          total
        );
        setOrder(result.order);
        setPayments(result.payments);
        setIsPaymentModalOpen(false);
        onUpdated();
        showToast('Payment updated successfully.');
      } else {
        const result = await orderService.addPayment(
          order.id,
          {
            amount: amt,
            date: payDateInput,
            method: payMethodInput,
            note: payNoteInput.trim() || undefined,
          },
          total
        );
        setOrder(result.order);
        setPayments(result.payments);
        setIsPaymentModalOpen(false);
        onUpdated();
        showToast('Payment added successfully.');
      }
    } catch (err: any) {
      console.error('Save payment error:', err);
      setModalError(err.message || 'Failed to save payment to Supabase.');
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  async function handleDeletePayment() {
    if (!deletingPaymentId) return;
    setIsDeletingPayment(true);
    try {
      const result = await orderService.deletePayment(order.id, deletingPaymentId, total);
      setOrder(result.order);
      setPayments(result.payments);
      setDeletingPaymentId(null);
      onUpdated();
      showToast('Payment deleted successfully.');
    } catch (err: any) {
      console.error('Delete payment error:', err);
      showToast(err.message || 'Failed to delete payment from Supabase.');
    } finally {
      setIsDeletingPayment(false);
    }
  }

  async function handleSave() {
    setPayError('');
    if (isNaN(total) || total < 0) {
      setPayError('Total amount must be a positive number.');
      return;
    }

    setSaving(true);
    try {
      const updated = await orderService.updateOrderTotalAndDetails(order.id, {
        totalAmount: total,
        status,
        notes,
        adminNotes,
      });
      if (updated) {
        setOrder(updated);
        setPayments(updated.payments || payments);
      }
      onUpdated();
      showToast('Order saved successfully.');
    } catch (err: any) {
      console.error('Save order error:', err);
      setPayError(err.message || 'Failed to save order to Supabase.');
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadInvoice() {
    setDownloadingInvoice(true);
    try {
      const inv = invoiceService.create(order.id);
      generateInvoicePDF(order, inv);
      orderService.markInvoiceGenerated(order.id);
      onUpdated();
      showToast('Invoice generated and downloaded.');
    } finally {
      setTimeout(() => setDownloadingInvoice(false), 1000);
    }
  }

  const srcBadge = sourceBadgeStyles[order.orderSource || 'Website'] || sourceBadgeStyles['Other'];

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm">
          <Check size={16} className="text-green-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Scrollable modal wrapper */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center p-3 sm:p-4 pt-6 overflow-y-auto pointer-events-none">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden pointer-events-auto border border-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg">{order.orderNumber || order.id}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${srcBadge.bg} ${srcBadge.text} ${srcBadge.border}`}
                  >
                    {getSourceIcon(order.orderSource)}
                    {order.orderSource || 'Website'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Created: {formatDate(order.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenKitchenSheet(order)}
                className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Generate / View Kitchen Order Sheet"
              >
                <ChefHat size={14} />
                <span>Kitchen Sheet</span>
              </button>
              <button
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className="px-3 py-1.5 text-xs font-semibold text-primary bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download size={14} />
                <span>{downloadingInvoice ? 'Generating…' : 'Invoice PDF'}</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Customer Name</p>
                <p className="font-semibold text-slate-900">{order.customerName}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Mobile Number</p>
                <p className="font-semibold text-slate-900">{order.mobile}</p>
                {order.alternativeMobile && (
                  <p className="text-xs text-slate-400">Alt: {order.alternativeMobile}</p>
                )}
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Order Source</p>
                <p className="font-semibold text-slate-900">{order.orderSource || 'Website'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Delivery Date & Time</p>
                <p className="font-semibold text-slate-900">
                  {formatDate(order.orderDate)} {order.deliveryTime ? `• ${order.deliveryTime}` : ''}
                </p>
              </div>
              {order.eventAddress && (
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-0.5">Delivery Address</p>
                  <p className="font-semibold text-slate-900">{order.eventAddress}</p>
                </div>
              )}
              {order.guestCount && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Number of Guests</p>
                  <p className="font-semibold text-slate-900">{order.guestCount} guests</p>
                </div>
              )}
            </div>

            {/* Kitchen Preparation Sheet Status Block */}
            {(() => {
              const savedSheet = kitchenSheetService.getByOrderId(order.id);
              const kStatus = savedSheet?.status || order.kitchenSheetStatus || 'Not Prepared';
              return (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 border border-amber-200">
                      <ChefHat size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          Kitchen Prep Status:
                        </span>
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white text-amber-800 border border-amber-300 shadow-2xs">
                          {kStatus}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {savedSheet
                          ? `${savedSheet.items.length} confirmed preparation items saved for cooking master`
                          : 'No preparation sheet saved yet. Click to generate cooking master copy.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenKitchenSheet(order)}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                  >
                    <ChefHat size={14} />
                    <span>Generate Kitchen Sheet</span>
                  </button>
                </div>
              );
            })()}

            {/* Selected Dishes & Flexible Quantities */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                Selected Dishes & Measurement Units ({order.items.length})
              </h4>
              <div className="space-y-2">
                {order.items.map((item, i) => {
                  const tamilName =
                    ta.dishTranslationsByEnglishName?.[item.dishName] ||
                    (item.dishId && (ta.dishes as Record<string, string>)[item.dishId]);

                  // Look up quantity and unit
                  const matchedFq = order.foodQuantities?.find(
                    (fq) => fq.dishId === item.dishId || fq.dishName === item.dishName
                  );
                  const qty = item.quantity ?? matchedFq?.quantity;
                  const unit = item.unit ?? matchedFq?.unit;
                  const itemNote = item.notes ?? matchedFq?.note;

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm bg-white p-3 rounded-xl border border-slate-100 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary font-bold mr-1">{i + 1}.</span>
                          <span className="font-semibold text-slate-900">{item.dishName}</span>
                          {tamilName && (
                            <span className="text-xs text-slate-500 font-normal">
                              ({tamilName})
                            </span>
                          )}
                        </div>
                        {itemNote && (
                          <p className="text-[11px] text-slate-500 italic ml-5 mt-0.5">
                            Note: {itemNote}
                          </p>
                        )}
                      </div>

                      {qty !== undefined && qty !== null && (
                        <span className="font-bold text-slate-900 bg-blue-50 text-blue-950 px-2.5 py-1 rounded-lg text-xs border border-blue-200/60 whitespace-nowrap">
                          {qty} {unit || 'Units'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional Food Quantities (Legacy kg items if distinct) */}
            {order.foodQuantities &&
              order.foodQuantities.length > 0 &&
              order.foodQuantities.some((fq) => !order.items.some((it) => it.dishId === fq.dishId)) && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                    Additional Quantities
                  </h4>
                  <div className="space-y-2">
                    {order.foodQuantities
                      .filter((fq) => !order.items.some((it) => it.dishId === fq.dishId))
                      .map((fq, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm bg-white p-2.5 rounded-lg border border-slate-100"
                        >
                          <span className="font-medium text-slate-800">{fq.dishName}</span>
                          <span className="font-bold text-slate-900">
                            {fq.quantity} {fq.unit}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* PAYMENT DETAILS - MULTIPLE SPLIT PAYMENTS SYSTEM */}
            <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Payment Details</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Record customer installment and advance payments</p>
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${payStatusColors[currentPayStatus]}`}
                >
                  {currentPayStatus}
                </span>
              </div>

              {payError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {payError}
                </div>
              )}

              {/* Total Order Amount Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Total Amount (₹)</label>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    value={totalAmt}
                    onChange={(e) => setTotalAmt(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Payment History Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Payment History {payments.length > 0 && `(${payments.length})`}
                  </h5>
                  <button
                    type="button"
                    onClick={openAddPaymentModal}
                    className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Payment
                  </button>
                </div>

                {loadingPayments ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span>Loading payment history from Supabase…</span>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No payments recorded yet. Click "Add Payment" to record an advance.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              ₹{Number(p.amount).toLocaleString('en-IN')}
                            </span>
                            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">
                              {p.method}
                            </span>
                            <span className="text-slate-400">{p.date}</span>
                          </div>
                          {p.note && <p className="text-slate-500 mt-1 italic">{p.note}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditPaymentModal(p)}
                            className="p-1.5 text-slate-500 hover:text-primary rounded"
                            title="Edit payment"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPaymentId(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                            title="Delete payment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Summary Box */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100">
                <div className="flex justify-between items-center text-slate-600 text-xs">
                  <span>Total Amount:</span>
                  <span className="font-bold text-sm text-slate-900">₹{total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-xs">
                  <span>Total Paid:</span>
                  <span className="font-bold text-sm text-green-700">₹{currentTotalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-xs">
                  <span>Balance Due:</span>
                  <span className="font-bold text-sm text-slate-900">₹{currentBalanceDue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-xs pt-2 border-t border-slate-200">
                  <span>Status:</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${payStatusColors[currentPayStatus]}`}>
                    {currentPayStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Order Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer Instructions / Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                placeholder="Customer instructions, allergies, delivery requests…"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Internal Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none bg-slate-50/50"
                placeholder="Internal catering notes, cook assigned, vessel return reminders…"
              />
            </div>

            {/* Actions */}
            <div className="flex pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-sm"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ADD / EDIT PAYMENT MODAL ───────────────────────────── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsPaymentModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden z-10">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPaymentId ? 'Edit Payment' : 'Add Payment'}
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Amount (₹) *</label>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    autoFocus
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Remaining balance allowed: <strong>₹{currentBalanceDue.toLocaleString('en-IN')}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={payDateInput}
                  onChange={(e) => setPayDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={payMethodInput}
                  onChange={(e) => setPayMethodInput(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Note (Optional)</label>
                <input
                  type="text"
                  value={payNoteInput}
                  onChange={(e) => setPayNoteInput(e.target.value)}
                  placeholder="e.g. Advance payment, installment 2, cheque #1234"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Saving to Supabase…</span>
                    </>
                  ) : (
                    <span>{editingPaymentId ? 'Update Payment' : 'Add Payment'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE PAYMENT CONFIRMATION MODAL ───────────────────── */}
      {deletingPaymentId && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !isDeletingPayment && setDeletingPaymentId(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <h3 className="font-semibold text-slate-900 mb-2">Delete Payment</h3>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete this payment? This will immediately recalculate the total paid and balance due.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingPaymentId(null)}
                disabled={isDeletingPayment}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={isDeletingPayment}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeletingPayment ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete Payment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── MAIN ORDERS LIST ─────────────────────────────────────────────────
interface AdminOrdersProps {
  onOpenKitchenSheet?: (orderId: string) => void;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({ onOpenKitchenSheet: _onOpenKitchenSheet }) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<OrderSource | ''>('');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [kitchenSheetOrder, setKitchenSheetOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  async function loadOrders() {
    setIsLoading(true);
    try {
      // 1. Auto-migrate any unmigrated local orders to Supabase
      await orderService.migrateExistingOrdersToSupabase();
      // 2. Fetch directly from Supabase
      const synced = await orderService.syncFromSupabase();
      if (synced && Array.isArray(synced)) {
        setOrders(synced.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } else {
        setOrders(orderService.getAll().sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    } catch (err) {
      console.warn('loadOrders error:', err);
      setOrders(orderService.getAll().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      o.customerName.toLowerCase().includes(q) ||
      o.mobile.includes(q);

    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchSource = !sourceFilter || (o.orderSource || 'Website') === sourceFilter;
    const matchDate = !deliveryDateFilter || o.orderDate === deliveryDateFilter;

    return matchSearch && matchStatus && matchSource && matchDate;
  });

  async function handleDelete(id: string) {
    await orderService.delete(id);
    await loadOrders();
    setDeleteConfirm(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Prominent Add New Order Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isTa ? 'ஆர்டர்கள் மேலாண்மை' : 'Orders'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {orders.length} {isTa ? 'மொத்த ஆர்டர்கள்' : 'total order(s)'}
          </p>
        </div>

        <button
          onClick={() => setIsAddOrderModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>{isTa ? 'புதிய ஆர்டர் சேர்க்க' : 'Add New Order'}</span>
        </button>
      </div>

      {/* Search & Multifaceted Filters (Requirement 1.12) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isTa ? 'பெயர், எண், ஆர்டர் ID தேடவும்…' : 'Search by name, mobile, order ID…'}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Order Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as any)}
          className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
        >
          <option value="">{isTa ? 'அனைத்து மூலங்கள் (Sources)' : 'All Order Sources'}</option>
          {ORDER_SOURCES.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>

        {/* Order Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
          className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
        >
          <option value="">{isTa ? 'அனைத்து நிலைகள்' : 'All Statuses'}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Delivery Date Filter */}
        <div className="relative">
          <input
            type="date"
            value={deliveryDateFilter}
            onChange={(e) => setDeliveryDateFilter(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-700"
            title="Filter by delivery date"
          />
          {deliveryDateFilter && (
            <button
              onClick={() => setDeliveryDateFilter('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-500">
          <Loader2 size={36} className="mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-700">
            {isTa ? 'ஆர்டர்கள் ஏற்றப்படுகின்றன...' : 'Loading orders from Supabase...'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
          <FileText size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="text-base font-semibold text-slate-600">
            {orders.length === 0
              ? isTa ? 'ஆர்டர்கள் எதுவும் இல்லை' : 'No orders yet.'
              : isTa ? 'பொருத்தமான ஆர்டர்கள் எதுவும் இல்லை' : 'No orders match your search filters.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {orders.length === 0 ? 'Click "Add New Order" to create a phone order.' : 'Try adjusting the search criteria.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5 text-left">Order ID</th>
                    <th className="px-5 py-3.5 text-left">Customer</th>
                    <th className="px-5 py-3.5 text-left">Source</th>
                    <th className="px-5 py-3.5 text-left">Delivery Date</th>
                    <th className="px-5 py-3.5 text-left">Items & Quantities</th>
                    <th className="px-5 py-3.5 text-left">Payment</th>
                    <th className="px-5 py-3.5 text-left">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((order) => {
                    const paid = getOrderTotalPaid(order);
                    const balance = getOrderBalanceDue(order);
                    const pStatus = getOrderPaymentStatus(order);
                    const src = order.orderSource || 'Website';
                    const srcStyle = sourceBadgeStyles[src] || sourceBadgeStyles['Other'];

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-primary font-bold text-xs">{order.orderNumber || order.id}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900">{order.customerName}</p>
                          <p className="text-xs text-slate-500">{order.mobile}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${srcStyle.bg} ${srcStyle.text} ${srcStyle.border}`}
                          >
                            {getSourceIcon(src)}
                            <span>{src}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 text-xs font-medium">
                          {formatDate(order.orderDate)}
                          {order.deliveryTime && (
                            <span className="block text-slate-400 font-normal">{order.deliveryTime}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          <span className="font-semibold text-slate-900">{order.items.length} dish(es)</span>
                          {order.foodQuantities && order.foodQuantities.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] truncate">
                              {order.foodQuantities.slice(0, 2).map((fq) => `${fq.dishName} (${fq.quantity} ${fq.unit})`).join(', ')}
                              {order.foodQuantities.length > 2 && ` +${order.foodQuantities.length - 2} more`}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900">
                            ₹{paid.toLocaleString('en-IN')}{' '}
                            <span className="font-normal text-slate-400">/ ₹{order.totalAmount.toLocaleString('en-IN')}</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                            <span className="text-slate-500">Bal: ₹{balance.toLocaleString('en-IN')}</span>
                            <span className={`inline-flex px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${payStatusColors[pStatus]}`}>
                              {pStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[order.status]}`}>
                            {order.status}
                          </span>
                          {(() => {
                            const kStatus = kitchenSheetService.getByOrderId(order.id)?.status || order.kitchenSheetStatus;
                            if (!kStatus) return null;
                            const kStyle =
                              kStatus === 'Completed'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : kStatus === 'Ready'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : kStatus === 'In Preparation'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200';
                            return (
                              <span
                                className={`block text-[10px] font-bold px-1.5 py-0.5 rounded border ${kStyle} mt-1 w-max`}
                                title="Kitchen Prep Status"
                              >
                                🍳 {kStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setKitchenSheetOrder(order)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="Generate / View Kitchen Order Sheet"
                            >
                              <ChefHat size={14} />
                              <span className="hidden xl:inline">Kitchen Sheet</span>
                            </button>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 text-slate-500 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(order.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Order"
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((order) => {
              const paid = getOrderTotalPaid(order);
              const balance = getOrderBalanceDue(order);
              const pStatus = getOrderPaymentStatus(order);
              const src = order.orderSource || 'Website';
              const srcStyle = sourceBadgeStyles[src] || sourceBadgeStyles['Other'];

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
                    onClick={() => setExpandedMobile(expandedMobile === order.id ? null : order.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{order.orderNumber || order.id}</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${srcStyle.bg} ${srcStyle.text} ${srcStyle.border}`}
                        >
                          {getSourceIcon(src)}
                          {src}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1">{order.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status]}`}>
                        {order.status}
                      </span>
                      {expandedMobile === order.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>
                  {expandedMobile === order.id && (
                    <div className="px-4 pb-4 pt-0 space-y-2 border-t border-slate-100">
                      <div className="text-xs sm:text-sm text-slate-600 space-y-1.5 pt-2">
                        <p><span className="font-semibold text-slate-700">Mobile:</span> {order.mobile}</p>
                        <p><span className="font-semibold text-slate-700">Delivery Date:</span> {formatDate(order.orderDate)}</p>
                        <p>
                          <span className="font-semibold text-slate-700">Items:</span> {order.items.length} dish(es)
                          {order.foodQuantities && order.foodQuantities.length > 0 && (
                            <span className="text-slate-500 text-xs ml-1">
                              (+ {order.foodQuantities.length} custom unit items)
                            </span>
                          )}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Payment:</span>{' '}
                          <strong className="text-slate-900">₹{paid.toLocaleString('en-IN')}</strong> / ₹{order.totalAmount.toLocaleString('en-IN')}{' '}
                          <span className="text-[11px] font-semibold text-slate-500">({pStatus})</span>
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Balance Due:</span>{' '}
                          <strong className="text-slate-900">₹{balance.toLocaleString('en-IN')}</strong>
                        </p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setKitchenSheetOrder(order)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 py-2 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          <ChefHat size={14} /> Kitchen Sheet
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-primary py-2 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          <Eye size={14} /> Details
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(order.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-xl text-xs font-semibold cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Manual Order Creation Modal */}
      {isAddOrderModalOpen && (
        <AdminAddOrderModal
          isOpen={isAddOrderModalOpen}
          onClose={() => setIsAddOrderModalOpen(false)}
          onOrderSaved={(newOrder, openDetail) => {
            loadOrders();
            if (openDetail) {
              setSelectedOrder(newOrder);
            }
          }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOpenKitchenSheet={(ord) => setKitchenSheetOrder(ord)}
          onUpdated={() => {
            loadOrders();
            const updated = orderService.getById(selectedOrder.id);
            if (updated) setSelectedOrder(updated);
          }}
        />
      )}

      {/* Kitchen Order Sheet Modal */}
      {kitchenSheetOrder && (
        <KitchenOrderSheetModal
          order={kitchenSheetOrder}
          isOpen={!!kitchenSheetOrder}
          onClose={() => setKitchenSheetOrder(null)}
          onSaved={() => {
            loadOrders();
            if (selectedOrder && selectedOrder.id === kitchenSheetOrder.id) {
              const updated = orderService.getById(kitchenSheetOrder.id);
              if (updated) setSelectedOrder(updated);
            }
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-2">Delete Order</h3>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete order <strong>{deleteConfirm}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium cursor-pointer"
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
