import React, { useState, useEffect, useMemo } from 'react';
import {
  IndianRupee,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { orderService, getOrderTotalPaid, getOrderBalanceDue, getOrderPaymentStatus } from '../../services/orderService';
import { useLanguage } from '../../context/LanguageContext';
import type { Order, PaymentMethod } from '../../types/admin';

interface PaymentRow {
  paymentId: string;
  orderId: string;
  customerName: string;
  mobile: string;
  amount: number;
  date: string;
  method: PaymentMethod | string;
  note?: string;
  totalOrderAmount: number;
  balanceDue: number;
  orderStatus: string;
}

export const AdminPayments: React.FC = () => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  useEffect(() => {
    setOrders(orderService.getAll());
    orderService.syncFromSupabase().then((synced) => {
      if (synced && Array.isArray(synced)) {
        setOrders(synced);
      }
    }).catch(() => {});
  }, []);

  const totalCollected = useMemo(() => {
    return orders.reduce((sum, o) => sum + getOrderTotalPaid(o), 0);
  }, [orders]);

  const totalBalancePending = useMemo(() => {
    return orders.reduce((sum, o) => sum + getOrderBalanceDue(o), 0);
  }, [orders]);

  const fullyPaidOrders = useMemo(() => {
    return orders.filter((o) => getOrderPaymentStatus(o) === 'Paid').length;
  }, [orders]);

  // Extract all payment transaction rows from orders
  const allPaymentRows = useMemo<PaymentRow[]>(() => {
    const rows: PaymentRow[] = [];

    orders.forEach((order) => {
      const balance = getOrderBalanceDue(order);
      if (order.payments && order.payments.length > 0) {
        order.payments.forEach((p) => {
          rows.push({
            paymentId: p.id,
            orderId: order.id,
            customerName: order.customerName,
            mobile: order.mobile,
            amount: p.amount,
            date: p.date,
            method: p.method,
            note: p.note,
            totalOrderAmount: order.totalAmount,
            balanceDue: balance,
            orderStatus: order.status,
          });
        });
      } else if (order.advanceAmount && order.advanceAmount > 0) {
        rows.push({
          paymentId: `${order.id}-adv`,
          orderId: order.id,
          customerName: order.customerName,
          mobile: order.mobile,
          amount: order.advanceAmount,
          date: order.orderDate,
          method: 'Cash',
          note: 'Advance payment',
          totalOrderAmount: order.totalAmount,
          balanceDue: balance,
          orderStatus: order.status,
        });
      }
    });

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return allPaymentRows.filter((row) => {
      const matchSearch =
        !q ||
        row.orderId.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.mobile.includes(q);

      const matchMethod = methodFilter === 'all' || row.method === methodFilter;

      return matchSearch && matchMethod;
    });
  }, [allPaymentRows, search, methodFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {isTa ? 'கட்டணங்கள் & வசூல் மேலாண்மை' : 'Payments & Revenue Tracking'}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {isTa
            ? 'அனைத்து முன்பணங்கள், தவணைக் கட்டணங்கள் மற்றும் நிலுவைத் தொகைகளைக் கண்காணிக்கவும்'
            : 'Track customer advance installments, payment modes, and pending balances'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">₹{totalCollected.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'வசூலிக்கப்பட்ட கட்டணம்' : 'Total Revenue Collected'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">₹{totalBalancePending.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'நிலுவையில் உள்ள தொகை' : 'Pending Balance Due'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{fullyPaidOrders} / {orders.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'முழுமையாக செலுத்திய ஆர்டர்கள்' : 'Fully Paid Orders'}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isTa ? 'ஆர்டர் எண், வாடிக்கையாளர் பெயர் அல்லது மொபைல்...' : 'Search by Order ID, Customer, or Mobile…'}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">{isTa ? 'அனைத்து கட்டண முறைகள்' : 'All Payment Methods'}</option>
          <option value="UPI">UPI</option>
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Card">Card</option>
          <option value="Cheque">Cheque</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Payments Table */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
          <IndianRupee size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-semibold text-slate-600">No payment transactions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5 text-left">Date</th>
                  <th className="px-5 py-3.5 text-left">Order ID</th>
                  <th className="px-5 py-3.5 text-left">Customer</th>
                  <th className="px-5 py-3.5 text-left">Method</th>
                  <th className="px-5 py-3.5 text-left">Paid Amount</th>
                  <th className="px-5 py-3.5 text-left">Balance Due</th>
                  <th className="px-5 py-3.5 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr key={`${row.paymentId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">
                      {row.date}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-primary font-bold text-xs">
                      {row.orderId}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900">{row.customerName}</p>
                      <p className="text-xs text-slate-400">{row.mobile}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                        {row.method}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-extrabold text-slate-900">
                      ₹{row.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-600 text-xs">
                      ₹{row.balanceDue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                      {row.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
