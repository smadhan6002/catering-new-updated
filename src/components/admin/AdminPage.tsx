import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { AdminLogin } from './AdminLogin';
import { AdminSidebar, AdminTopbar } from './AdminSidebar';
import { AdminDashboard } from './AdminDashboard';
import { AdminDishes } from './AdminDishes';
import { AdminOrders } from './AdminOrders';
import { AdminLeads } from './AdminLeads';
import { AdminCustomers } from './AdminCustomers';
import { AdminMenuPDF } from './AdminMenuPDF';
import { AdminCampaigns } from './AdminCampaigns';
import { AdminPayments } from './AdminPayments';
import { AdminInvoices } from './AdminInvoices';
import { AdminKitchenSheet } from './AdminKitchenSheet';
import { AdminRentalItems } from './AdminRentalItems';
import { AdminInventory } from './AdminInventory';
import { AdminSettings } from './AdminSettings';
import type { AdminView } from './AdminSidebar';
import { ChefHat } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const AdminPage: React.FC = () => {
  const { businessName } = useLanguage();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [selectedKitchenOrderId, setSelectedKitchenOrderId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check Supabase session & admin authorization on mount, prevent flickering
  useEffect(() => {
    let isMounted = true;

    async function verifyAuth() {
      try {
        const { isAuthorized } = await authService.checkCurrentSession();
        if (isMounted) {
          setIsLoggedIn(isAuthorized);
          setIsCheckingAuth(false);
        }
      } catch {
        if (isMounted) {
          setIsLoggedIn(false);
          setIsCheckingAuth(false);
        }
      }
    }

    verifyAuth();

    // Listen to live Supabase auth state changes
    const unsubscribe = authService.onAuthStateChange((_event, _session, isAuthorized) => {
      if (isMounted) {
        setIsLoggedIn(isAuthorized);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  function handleLogin() {
    setIsLoggedIn(true);
    setActiveView('dashboard');
  }

  async function handleLogout() {
    await authService.logout();
    setIsLoggedIn(false);
  }

  function handleNavigateToKitchenSheet(orderId?: string) {
    setSelectedKitchenOrderId(orderId);
    setActiveView('kitchen-sheet');
  }

  // Prevent login page flickering while resolving Supabase session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col items-center justify-center p-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg mb-4">
          <ChefHat size={32} className="text-white animate-pulse" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">{businessName}</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span>Verifying admin session…</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const viewMap: Record<AdminView, React.ReactNode> = {
    dashboard: <AdminDashboard onNavigate={(v) => setActiveView(v as AdminView)} />,
    orders: <AdminOrders onOpenKitchenSheet={handleNavigateToKitchenSheet} />,
    leads: <AdminLeads onNavigateToOrders={() => setActiveView('orders')} />,
    'kitchen-sheet': <AdminKitchenSheet initialOrderId={selectedKitchenOrderId} />,
    dishes: <AdminDishes />,
    inventory: <AdminInventory />,
    'rental-items': <AdminRentalItems />,
    customers: <AdminCustomers />,
    'menu-pdf': <AdminMenuPDF />,
    messages: <AdminCampaigns />,
    payments: <AdminPayments />,
    invoices: <AdminInvoices />,
    settings: <AdminSettings />,
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <AdminSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar activeView={activeView} onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {viewMap[activeView]}
        </main>
      </div>
    </div>
  );
};
