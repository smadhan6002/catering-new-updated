import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  IndianRupee,
  AlertCircle,
  Users,
  Plus,
  FileDown,
  ArrowRight,
  Boxes,
  UserCheck,
} from 'lucide-react';
import { orderService, getOrderTotalPaid, getOrderBalanceDue } from '../../services/orderService';
import { customerService } from '../../services/customerService';
import { useLanguage } from '../../context/LanguageContext';
import type { Order } from '../../types/admin';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, bgColor }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bgColor}`}>
      <span className={color}>{icon}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

interface AdminDashboardProps {
  onNavigate?: (view: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [orders, setOrders] = useState<Order[]>([]);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    setOrders(orderService.getAll());
    setCustomerCount(customerService.getAll().length);
  }, []);

  const totalOrders = orders.length;
  const pending = orders.filter((o) => o.status === 'Pending').length;
  const confirmed = orders.filter(
    (o) => o.status === 'Confirmed' || o.status === 'In Preparation' || o.status === 'Ready'
  ).length;
  const completed = orders.filter((o) => o.status === 'Completed').length;
  const cancelled = orders.filter((o) => o.status === 'Cancelled').length;
  const totalCollected = orders.reduce((s, o) => s + getOrderTotalPaid(o), 0);
  const totalBalancePending = orders.reduce((s, o) => s + getOrderBalanceDue(o), 0);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statusColor: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Confirmed: 'bg-blue-100 text-blue-800',
    'In Preparation': 'bg-purple-100 text-purple-800',
    Ready: 'bg-cyan-100 text-cyan-800',
    Completed: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isTa ? 'நிர்வாகப் பலகை (Dashboard)' : 'Dashboard'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTa ? 'கேட்டரிங் ஆர்டர்கள், வாடிக்கையாளர்கள் மற்றும் கட்டணங்களின் மேலோட்டம்' : 'Overview of catering orders, customers, and revenue'}
          </p>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigate('orders')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>{isTa ? 'புதிய ஆர்டர்' : 'Add Order'}</span>
            </button>
            <button
              onClick={() => onNavigate('leads')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-900 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer border border-orange-200"
            >
              <UserCheck size={15} className="text-primary" />
              <span>{isTa ? 'வாடிக்கையாளர் தொடர்புகள்' : 'Customer Leads'}</span>
            </button>
            <button
              onClick={() => onNavigate('rental-items')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer border border-slate-200"
            >
              <Boxes size={15} className="text-primary" />
              <span>{isTa ? 'வாடகை பொருட்கள்' : 'Rental Items'}</span>
            </button>
            <button
              onClick={() => onNavigate('menu-pdf')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileDown size={15} />
              <span>{isTa ? 'மெனு PDF' : 'Menu PDF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={isTa ? 'மொத்த ஆர்டர்கள்' : 'Total Orders'}
          value={totalOrders}
          icon={<ShoppingBag size={22} />}
          color="text-primary"
          bgColor="bg-blue-100"
        />
        <StatCard
          label={isTa ? 'மொத்த வாடிக்கையாளர்கள்' : 'Saved Customers'}
          value={customerCount}
          icon={<Users size={22} />}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          label={isTa ? 'வசூலிக்கப்பட்ட கட்டணம்' : 'Payments Collected'}
          value={`₹${totalCollected.toLocaleString('en-IN')}`}
          icon={<IndianRupee size={22} />}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <StatCard
          label={isTa ? 'நிலுவை தொகை' : 'Balance Pending'}
          value={`₹${totalBalancePending.toLocaleString('en-IN')}`}
          icon={<AlertCircle size={22} />}
          color="text-red-600"
          bgColor="bg-red-100"
        />
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
          <p className="text-xl font-bold text-yellow-600">{pending}</p>
          <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'நிலுவை (Pending)' : 'Pending Orders'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
          <p className="text-xl font-bold text-blue-600">{confirmed}</p>
          <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'செயலில் உள்ளவை' : 'Active Preparation'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
          <p className="text-xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'நிறைவடைந்தவை' : 'Completed'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
          <p className="text-xl font-bold text-red-600">{cancelled}</p>
          <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'ரத்து செய்யப்பட்டவை' : 'Cancelled'}</p>
        </div>
      </div>

      {/* Quick Access Action Shortcuts */}
      {onNavigate && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('customers')}
            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-slate-300 transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="font-bold text-slate-900 text-sm">{isTa ? 'வாடிக்கையாளர்கள் பட்டியல்' : 'Customer Database'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{customerCount} {isTa ? 'பதிவு செய்யப்பட்டவர்கள்' : 'recorded profiles'}</p>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </button>

          <button
            onClick={() => onNavigate('messages')}
            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-slate-300 transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="font-bold text-slate-900 text-sm">{isTa ? 'வாழ்த்துக்கள் & சலுகைகள்' : 'Send Greetings & Offers'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'பிறந்தநாள், பண்டிகை செய்திகள்' : 'Birthdays & festive templates'}</p>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </button>

          <button
            onClick={() => onNavigate('payments')}
            className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-slate-300 transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="font-bold text-slate-900 text-sm">{isTa ? 'கட்டண தவணைகள்' : 'Payment Installments'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'வசூல் மற்றும் நிலுவைகள்' : 'Track revenue & balance due'}</p>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </button>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {isTa ? 'சமீபத்திய ஆர்டர்கள்' : 'Recent Orders'}
          </h3>
          {onNavigate && (
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {isTa ? 'அனைத்தையும் காண்க →' : 'View all orders →'}
            </button>
          )}
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {isTa ? 'ஆர்டர்கள் எதுவும் இல்லை.' : 'No orders recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Order ID</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">Delivery Date</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-bold text-primary">{order.id}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{order.customerName}</td>
                    <td className="px-5 py-3 text-slate-600 hidden sm:table-cell">
                      {order.orderDate}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColor[order.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
