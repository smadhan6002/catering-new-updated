import React, { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { invoiceService } from '../../services/invoiceService';
import { generateInvoicePDF } from '../../utils/generateInvoicePDF';
import type { Order } from '../../types/admin';

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export const AdminInvoices: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const all = orderService.getAll().filter((o) => o.invoiceGenerated);
    setOrders(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  async function handleDownload(order: Order) {
    setDownloading(order.id);
    try {
      const invoice = await invoiceService.create(order.id);
      generateInvoicePDF(order, invoice);
    } finally {
      setTimeout(() => setDownloading(null), 1000);
    }
  }

  const statusColor: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Confirmed: 'bg-blue-100 text-blue-800',
    'In Preparation': 'bg-purple-100 text-purple-800',
    Ready: 'bg-cyan-100 text-cyan-800',
    Completed: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
        <p className="text-sm text-slate-500 mt-0.5">All generated invoices. Re-download any time.</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-12 text-center text-slate-400">
          <FileText size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">No invoices generated yet.</p>
          <p className="text-xs mt-1">Generate invoices from the Orders section.</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Invoice No</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Order ID</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Customer</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Order Date</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Total</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const invoice = invoiceService.getByOrderId(order.id);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-primary font-medium">{invoice?.id ?? '—'}</td>
                        <td className="px-5 py-3 font-mono text-slate-700">{order.id}</td>
                        <td className="px-5 py-3 font-medium text-slate-900">{order.customerName}</td>
                        <td className="px-5 py-3 text-slate-600">{formatDate(order.orderDate)}</td>
                        <td className="px-5 py-3 text-slate-700 font-medium">₹{order.totalAmount.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status] ?? ''}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleDownload(order)}
                            disabled={downloading === order.id}
                            className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-xs font-medium disabled:opacity-50"
                          >
                            <Download size={14} />
                            {downloading === order.id ? 'Downloading…' : 'Download PDF'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const invoice = invoiceService.getByOrderId(order.id);
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-primary font-semibold text-sm">{invoice?.id ?? '—'}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status] ?? ''}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{order.customerName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{order.id} · {formatDate(order.orderDate)}</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">₹{order.totalAmount.toLocaleString('en-IN')}</p>
                  <button
                    onClick={() => handleDownload(order)}
                    disabled={downloading === order.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-primary/10 text-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Download size={14} />
                    {downloading === order.id ? 'Downloading…' : 'Download PDF'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
