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

export const AdminPage: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(authService.isLoggedIn());
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [selectedKitchenOrderId, setSelectedKitchenOrderId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Re-check session whenever the component mounts
  useEffect(() => {
    setIsLoggedIn(authService.isLoggedIn());
  }, []);

  function handleLogin() {
    setIsLoggedIn(true);
    setActiveView('dashboard');
  }

  function handleLogout() {
    authService.logout();
    setIsLoggedIn(false);
  }

  function handleNavigateToKitchenSheet(orderId?: string) {
    setSelectedKitchenOrderId(orderId);
    setActiveView('kitchen-sheet');
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
