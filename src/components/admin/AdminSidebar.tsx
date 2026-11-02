import React from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Users,
  FileDown,
  MessageSquare,
  IndianRupee,
  FileText,
  Settings,
  LogOut,
  X,
  Menu,
  Globe,
  ArrowLeft,
  ChefHat,
  Boxes,
  ShoppingBasket,
  UserCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import logoImg from '../../assets/LOGO.png';

export type AdminView =
  | 'dashboard'
  | 'orders'
  | 'leads'
  | 'kitchen-sheet'
  | 'dishes'
  | 'inventory'
  | 'rental-items'
  | 'customers'
  | 'menu-pdf'
  | 'messages'
  | 'payments'
  | 'invoices'
  | 'settings';

interface AdminSidebarProps {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeView,
  onNavigate,
  onLogout,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { lang, setLang, businessName } = useLanguage();
  const isTa = lang === 'ta';

  const navItems: { view: AdminView; labelEn: string; labelTa: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', labelEn: 'Dashboard', labelTa: 'டாஷ்போர்டு', icon: <LayoutDashboard size={18} /> },
    { view: 'orders', labelEn: 'Orders', labelTa: 'ஆர்டர்கள்', icon: <ClipboardList size={18} /> },
    { view: 'leads', labelEn: 'Customer Leads', labelTa: 'வாடிக்கையாளர் தொடர்புகள் (Leads)', icon: <UserCheck size={18} /> },
    { view: 'kitchen-sheet', labelEn: 'Kitchen Order Sheet', labelTa: 'சமையல் குறிப்பு தாள்', icon: <ChefHat size={18} /> },
    { view: 'dishes', labelEn: 'Dishes', labelTa: 'உணவு வகைகள்', icon: <UtensilsCrossed size={18} /> },
    { view: 'inventory', labelEn: 'Grocery & Vegetable Inventory', labelTa: 'மளிகைப் பொருட்கள் மற்றும் காய்கறிகள்', icon: <ShoppingBasket size={18} /> },
    { view: 'rental-items', labelEn: 'Rental Items', labelTa: 'வாடகை பொருட்கள்', icon: <Boxes size={18} /> },
    { view: 'customers', labelEn: 'Customers', labelTa: 'வாடிக்கையாளர்கள்', icon: <Users size={18} /> },
    { view: 'menu-pdf', labelEn: 'Food Menu PDF', labelTa: 'உணவு மெனு PDF', icon: <FileDown size={18} /> },
    { view: 'messages', labelEn: 'Customer Messages', labelTa: 'வாடிக்கையாளர் செய்திகள்', icon: <MessageSquare size={18} /> },
    { view: 'payments', labelEn: 'Payments', labelTa: 'கட்டணங்கள்', icon: <IndianRupee size={18} /> },
    { view: 'invoices', labelEn: 'Invoices', labelTa: 'இன்வாய்ஸ்கள்', icon: <FileText size={18} /> },
    { view: 'settings', labelEn: 'Settings', labelTa: 'அமைப்புகள்', icon: <Settings size={18} /> },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200/50 flex items-center justify-center bg-white flex-shrink-0">
            <img src={logoImg} alt={businessName} className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{businessName}</p>
            <p className="text-xs text-slate-500">{isTa ? 'நிர்வாகப் பலகை' : 'Admin Panel'}</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-700 p-1">
          <X size={20} />
        </button>
      </div>

      {/* Language Toggle in Sidebar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-semibold">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Globe size={14} className="text-primary" />
            <span>{isTa ? 'மொழி:' : 'Language:'}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setLang('ta')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                isTa ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              தமிழ்
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                !isTa ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => {
              onNavigate(item.view);
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors text-left cursor-pointer ${
              activeView === item.view
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span>{isTa ? item.labelTa : item.labelEn}</span>
          </button>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-200 space-y-1">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>{isTa ? 'இணையதளத்திற்குத் திரும்பு' : 'Back to Website'}</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          <span>{isTa ? 'வெளியேறு (Logout)' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 z-30">
        {content}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};

interface AdminTopbarProps {
  activeView: AdminView;
  onMenuOpen: () => void;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({ activeView, onMenuOpen }) => {
  const { lang, setLang } = useLanguage();
  const isTa = lang === 'ta';

  const viewTitles: Record<AdminView, { en: string; ta: string }> = {
    dashboard: { en: 'Dashboard', ta: 'டாஷ்போர்டு' },
    orders: { en: 'Order Management', ta: 'ஆர்டர்கள் மேலாண்மை' },
    leads: { en: 'Customer Leads Management', ta: 'வாடிக்கையாளர் தொடர்புகள் (Customer Leads)' },
    'kitchen-sheet': { en: 'Kitchen Order Sheet', ta: 'சமையல் குறிப்பு தாள்' },
    dishes: { en: 'Dish Management', ta: 'உணவு வகைகள் மேலாண்மை' },
    inventory: { en: 'Grocery & Vegetable Inventory', ta: 'மளிகைப் பொருட்கள் மற்றும் காய்கறிகள்' },
    'rental-items': { en: 'Rental Items Management', ta: 'வாடகை பொருட்கள் மேலாண்மை' },
    customers: { en: 'Customer Management', ta: 'வாடிக்கையாளர்கள் மேலாண்மை' },
    'menu-pdf': { en: 'Food Menu PDF', ta: 'உணவு மெனு PDF' },
    messages: { en: 'Customer Messages', ta: 'வாடிக்கையாளர் செய்திகள்' },
    payments: { en: 'Payments & Revenue', ta: 'கட்டணங்கள் & வசூல்' },
    invoices: { en: 'Invoices', ta: 'இன்வாய்ஸ்கள்' },
    settings: { en: 'Settings', ta: 'அமைப்புகள்' },
  };

  const title = viewTitles[activeView] || viewTitles.dashboard;

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-bold text-slate-900 text-base sm:text-lg">
          {isTa ? title.ta : title.en}
        </h1>
      </div>

      {/* Topbar Language Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setLang('ta')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              isTa ? 'bg-white text-primary font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            தமிழ்
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              !isTa ? 'bg-white text-primary font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
        </div>
      </div>
    </header>
  );
};
