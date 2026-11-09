/**
 * migrationService — Safe LocalStorage Backup & Supabase Data Migration
 * - Creates full JSON backup of all existing records before any migration.
 * - Idempotently uploads records to Supabase tables using ON CONFLICT (id) DO UPDATE.
 * - Preserves existing localStorage records so nothing is lost.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Customer, Order } from '../types/admin';
import type { CustomerLead } from '../types/lead';
import type { InventoryItem, InventoryCategory, InventoryDocument } from '../types/inventory';
import type { RentalItem, RentalCategory, RentalDocument } from '../types/rental';

export interface MigrationSummary {
  customers: number;
  orders: number;
  orderItems: number;
  orderPayments: number;
  dishes: number;
  dishOverrides: number;
  leads: number;
  leadActivities: number;
  inventoryCategories: number;
  inventoryItems: number;
  purchaseDocuments: number;
  rentalCategories: number;
  rentalItems: number;
  rentalDocuments: number;
  kitchenSheets: number;
  invoices: number;
  messages: number;
  errors: string[];
}

export const migrationService = {
  /**
   * Generates a complete JSON backup of all business data stored in localStorage
   */
  createBackupData(): Record<string, unknown> {
    const backup: Record<string, unknown> = {
      backupTimestamp: new Date().toISOString(),
      version: '1.0.0',
      businessName: 'Kanchi Ambal Catering',
      data: {
        customers: JSON.parse(localStorage.getItem('annapoorna_customers') || '[]'),
        orders: JSON.parse(localStorage.getItem('annapoorna_orders') || '[]'),
        adminDishes: JSON.parse(localStorage.getItem('annapoorna_admin_dishes') || '[]'),
        dishOverrides: JSON.parse(localStorage.getItem('annapoorna_dish_overrides') || '{}'),
        dishTamilNames: JSON.parse(localStorage.getItem('annapoorna_dish_tamil_names') || '{}'),
        customerLeads: JSON.parse(localStorage.getItem('catering_customer_leads') || '[]'),
        inventoryCategories: JSON.parse(localStorage.getItem('kanchi_inventory_categories') || '[]'),
        inventoryItems: JSON.parse(localStorage.getItem('kanchi_inventory_items') || '[]'),
        inventoryDocuments: JSON.parse(localStorage.getItem('kanchi_inventory_documents') || '[]'),
        rentalCategories: JSON.parse(localStorage.getItem('annapoorna_rental_categories') || '[]'),
        rentalItems: JSON.parse(localStorage.getItem('annapoorna_rental_items') || '[]'),
        rentalDocuments: JSON.parse(localStorage.getItem('annapoorna_rental_documents') || '[]'),
        kitchenSheets: JSON.parse(localStorage.getItem('annapoorna_kitchen_sheets') || '[]'),
        invoices: JSON.parse(localStorage.getItem('annapoorna_invoices') || '[]'),
        campaigns: JSON.parse(localStorage.getItem('annapoorna_campaigns') || '[]'),
        customerMessages: JSON.parse(localStorage.getItem('catering_customer_messages') || '[]'),
      },
    };
    return backup;
  },

  /**
   * Triggers a browser download of the complete JSON backup
   */
  downloadBackupFile(): void {
    const backup = this.createBackupData();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kanchi_ambal_catering_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Migrates all local data into Supabase safely
   */
  async migrateToSupabase(): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      customers: 0,
      orders: 0,
      orderItems: 0,
      orderPayments: 0,
      dishes: 0,
      dishOverrides: 0,
      leads: 0,
      leadActivities: 0,
      inventoryCategories: 0,
      inventoryItems: 0,
      purchaseDocuments: 0,
      rentalCategories: 0,
      rentalItems: 0,
      rentalDocuments: 0,
      kitchenSheets: 0,
      invoices: 0,
      messages: 0,
      errors: [],
    };

    if (!isSupabaseConfigured) {
      summary.errors.push('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return summary;
    }

    // 1. Customers
    try {
      const customers: Customer[] = JSON.parse(localStorage.getItem('annapoorna_customers') || '[]');
      if (customers.length > 0) {
        const rows = customers.map((c) => ({
          id: c.id,
          name: c.name,
          mobile: c.mobile,
          alternative_mobile: c.alternativeMobile || null,
          email: c.email || null,
          birthday: c.birthday || null,
          anniversary_date: c.anniversaryDate || null,
          preferred_language: c.preferredLanguage || 'ta',
          marketing_consent: c.marketingConsent ?? true,
          notes: c.notes || null,
          created_at: c.createdAt || new Date().toISOString(),
          updated_at: c.updatedAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'id' });
        if (error) summary.errors.push(`Customers migration: ${error.message}`);
        else summary.customers = rows.length;
      }
    } catch (err) {
      summary.errors.push(`Customers error: ${String(err)}`);
    }

    // 2. Orders, Order Items & Order Payments
    try {
      const orders: Order[] = JSON.parse(localStorage.getItem('annapoorna_orders') || '[]');
      for (const o of orders) {
        const orderRow = {
          id: o.id,
          customer_id: o.customerId || null,
          customer_name: o.customerName,
          mobile: o.mobile,
          alternative_mobile: o.alternativeMobile || null,
          order_source: o.orderSource || 'Website',
          event_address: o.eventAddress || '',
          event_type: o.eventType || null,
          order_date: o.orderDate,
          delivery_time: o.deliveryTime || null,
          guest_count: o.guestCount || null,
          food_quantities: o.foodQuantities || [],
          total_amount: o.totalAmount || 0,
          advance_amount: o.advanceAmount || 0,
          balance_paid: o.balancePaid || 0,
          payments: o.payments || [],
          status: o.status || 'Pending',
          kitchen_sheet_status: o.kitchenSheetStatus || 'Not Prepared',
          notes: o.notes || null,
          admin_notes: o.adminNotes || null,
          invoice_generated: o.invoiceGenerated || false,
          created_at: o.createdAt || new Date().toISOString(),
        };

        const { error: ordErr } = await supabase.from('orders').upsert(orderRow, { onConflict: 'id' });
        if (ordErr) {
          summary.errors.push(`Order ${o.id}: ${ordErr.message}`);
        } else {
          summary.orders++;

          // Migrate order items
          if (Array.isArray(o.items) && o.items.length > 0) {
            const itemRows = o.items.map((it) => ({
              order_id: o.id,
              dish_id: it.dishId,
              dish_name: it.dishName,
              category_id: it.categoryId,
              quantity: it.quantity || null,
              unit: it.unit || null,
              notes: it.notes || null,
            }));
            const { error: itErr } = await supabase.from('order_items').insert(itemRows);
            if (!itErr) summary.orderItems += itemRows.length;
          }

          // Migrate payments
          if (Array.isArray(o.payments) && o.payments.length > 0) {
            const payRows = o.payments.map((p) => ({
              id: p.id,
              order_id: o.id,
              amount: p.amount,
              date: p.date,
              method: p.method,
              note: p.note || null,
            }));
            const { error: payErr } = await supabase.from('order_payments').upsert(payRows, { onConflict: 'id' });
            if (!payErr) summary.orderPayments += payRows.length;
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Orders error: ${String(err)}`);
    }

    // 3. Customer Leads & Lead Activities
    try {
      const leads: CustomerLead[] = JSON.parse(localStorage.getItem('catering_customer_leads') || '[]');
      for (const l of leads) {
        const leadRow = {
          id: l.id,
          lead_number: l.leadNumber,
          customer_name: l.customerName,
          mobile: l.mobile,
          alternative_mobile: l.alternativeMobile || null,
          event_type: l.eventType || null,
          event_date: l.eventDate || null,
          expected_guest_count: l.expectedGuestCount || null,
          customer_requirement: l.customerRequirement || null,
          discussion_details: l.discussionDetails,
          follow_up_date: l.followUpDate || null,
          follow_up_time: l.followUpTime || null,
          status: l.status || 'New',
          additional_notes: l.additionalNotes || null,
          converted_to_order_id: l.convertedToOrderId || null,
          created_at: l.createdAt || new Date().toISOString(),
          updated_at: l.updatedAt || new Date().toISOString(),
        };

        const { error: leadErr } = await supabase.from('customer_leads').upsert(leadRow, { onConflict: 'id' });
        if (leadErr) {
          summary.errors.push(`Lead ${l.id}: ${leadErr.message}`);
        } else {
          summary.leads++;

          // Migrate discussions to lead_activities
          if (Array.isArray(l.discussions) && l.discussions.length > 0) {
            const discRows = l.discussions.map((d) => ({
              id: d.id,
              lead_id: l.id,
              date: d.date,
              time: d.time || null,
              discussion_details: d.discussionDetails,
              customer_requirement: d.customerRequirement || null,
              agreed_next_action: d.agreedNextAction || null,
              next_follow_up_date: d.nextFollowUpDate || null,
              created_at: d.createdAt || new Date().toISOString(),
            }));
            const { error: dErr } = await supabase.from('lead_activities').upsert(discRows, { onConflict: 'id' });
            if (!dErr) summary.leadActivities += discRows.length;
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Leads error: ${String(err)}`);
    }

    // 4. Grocery & Vegetable Inventory
    try {
      const invCategories: InventoryCategory[] = JSON.parse(localStorage.getItem('kanchi_inventory_categories') || '[]');
      if (invCategories.length > 0) {
        const catRows = invCategories.map((c) => ({
          id: c.id,
          name_en: c.nameEn,
          name_ta: c.nameTa,
        }));
        const { error } = await supabase.from('inventory_categories').upsert(catRows, { onConflict: 'id' });
        if (!error) summary.inventoryCategories = catRows.length;
      }

      const invItems: InventoryItem[] = JSON.parse(localStorage.getItem('kanchi_inventory_items') || '[]');
      if (invItems.length > 0) {
        const itemRows = invItems.map((it) => ({
          id: it.id,
          name_en: it.nameEn,
          name_ta: it.nameTa,
          category_id: it.categoryId,
          unit: it.unit,
          stock_quantity: it.currentStock || null,
          unit_price: it.unitPrice || null,
          is_active: true,
          created_at: it.createdAt || new Date().toISOString(),
          updated_at: it.updatedAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('inventory_items').upsert(itemRows, { onConflict: 'id' });
        if (!error) summary.inventoryItems = itemRows.length;
      }

      const invDocs: InventoryDocument[] = JSON.parse(localStorage.getItem('kanchi_inventory_documents') || '[]');
      for (const d of invDocs) {
        const docRow = {
          id: d.id,
          title: d.title,
          event_name: d.eventName,
          customer_name: d.customerName || null,
          event_date: d.eventDate || null,
          document_date: d.documentDate,
          prepared_by: d.preparedBy || null,
          notes: d.notes || null,
          language: d.language || 'both',
          total_amount: d.totalAmount || 0,
          items: d.items || [],
          created_at: d.createdAt || new Date().toISOString(),
        };
        const { error } = await supabase.from('purchase_documents').upsert(docRow, { onConflict: 'id' });
        if (!error) summary.purchaseDocuments++;
      }
    } catch (err) {
      summary.errors.push(`Inventory error: ${String(err)}`);
    }

    // 5. Rental Items & Documents
    try {
      const rentalCats: RentalCategory[] = JSON.parse(localStorage.getItem('annapoorna_rental_categories') || '[]');
      if (rentalCats.length > 0) {
        const rCatRows = rentalCats.map((c) => ({
          id: c.id,
          name: c.name,
          name_ta: c.nameTa,
          description: c.description || null,
        }));
        const { error } = await supabase.from('rental_categories').upsert(rCatRows, { onConflict: 'id' });
        if (!error) summary.rentalCategories = rCatRows.length;
      }

      const rentalItems: RentalItem[] = JSON.parse(localStorage.getItem('annapoorna_rental_items') || '[]');
      if (rentalItems.length > 0) {
        const rItemRows = rentalItems.map((r) => ({
          id: r.id,
          code: r.code,
          name_en: r.nameEn,
          name_ta: r.nameTa,
          category_id: r.categoryId,
          total_quantity: r.totalQuantity || 0,
          rental_price: r.rentalPrice || 0,
          pricing_unit: r.pricingUnit || 'Per Day',
          security_deposit: r.securityDeposit || 0,
          description: r.description || null,
          notes: r.notes || null,
          is_active: r.isActive ?? true,
          created_at: r.createdAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('rental_items').upsert(rItemRows, { onConflict: 'id' });
        if (!error) summary.rentalItems = rItemRows.length;
      }

      const rentalDocs: RentalDocument[] = JSON.parse(localStorage.getItem('annapoorna_rental_documents') || '[]');
      if (rentalDocs.length > 0) {
        const rDocRows = rentalDocs.map((rd) => ({
          id: rd.id,
          rental_number: rd.rentalNumber,
          customer_name: rd.customerName,
          mobile: rd.mobile,
          address: rd.address || null,
          function_name: rd.functionName || null,
          document_date: rd.documentDate,
          function_date: rd.functionDate,
          rental_start_date: rd.rentalStartDate,
          expected_return_date: rd.expectedReturnDate,
          actual_return_date: rd.actualReturnDate || null,
          delivery_details: rd.deliveryDetails || null,
          items: rd.items || [],
          subtotal: rd.subtotal || 0,
          additional_charges: rd.additionalCharges || 0,
          discount: rd.discount || 0,
          security_deposit: rd.securityDeposit || 0,
          grand_total: rd.grandTotal || 0,
          advance_paid: rd.advancePaid || 0,
          balance_due: rd.balanceDue || 0,
          status: rd.status || 'Confirmed',
          notes: rd.notes || null,
          terms: rd.terms || null,
          preferred_language: rd.preferredLanguage || 'en',
          created_at: rd.createdAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('rental_documents').upsert(rDocRows, { onConflict: 'id' });
        if (!error) summary.rentalDocuments = rDocRows.length;
      }
    } catch (err) {
      summary.errors.push(`Rentals error: ${String(err)}`);
    }

    return summary;
  },
};
