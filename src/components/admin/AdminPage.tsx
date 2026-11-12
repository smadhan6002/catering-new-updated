import React, { useState, useEffect, lazy, Suspense } from 'react';
import { authService } from '../../services/authService';
import { AdminLogin } from './AdminLogin';
import { AdminSidebar, AdminTopbar } from './AdminSidebar';
import type { AdminView } from './AdminSidebar';
import { ChefHat } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AdminDashboard = lazy(() => import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminDishes = lazy(() => import('./AdminDishes').then((m) => ({ default: m.AdminDishes })));
const AdminOrders = lazy(() => import('./AdminOrders').then((m) => ({ default: m.AdminOrders })));
const AdminLeads = lazy(() => import('./AdminLeads').then((m) => ({ default: m.AdminLeads })));
const AdminCustomers = lazy(() => import('./AdminCustomers').then((m) => ({ default: m.AdminCustomers })));
const AdminMenuPDF = lazy(() => import('./AdminMenuPDF').then((m) => ({ default: m.AdminMenuPDF })));
const AdminCampaigns = lazy(() => import('./AdminCampaigns').then((m) => ({ default: m.AdminCampaigns })));
const AdminPayments = lazy(() => import('./AdminPayments').then((m) => ({ default: m.AdminPayments })));
const AdminInvoices = lazy(() => import('./AdminInvoices').then((m) => ({ default: m.AdminInvoices })));
const AdminKitchenSheet = lazy(() => import('./AdminKitchenSheet').then((m) => ({ default: m.AdminKitchenSheet })));
const AdminRentalItems = lazy(() => import('./AdminRentalItems').then((m) => ({ default: m.AdminRentalItems })));
const AdminInventory = lazy(() => import('./AdminInventory').then((m) => ({ default: m.AdminInventory })));
const AdminSettings = lazy(() => import('./AdminSettings').then((m) => ({ default: m.AdminSettings })));

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
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2.5" />
                <span>Loading section…</span>
              </div>
            }
          >
            {viewMap[activeView]}
          </Suspense>
        </main>
      </div>
    </div>
  );
};
