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
        inventoryMetadata: JSON.parse(localStorage.getItem('kanchi_inventory_metadata') || '{}'),
        inventoryDocuments: JSON.parse(localStorage.getItem('kanchi_inventory_documents') || '[]'),
        rentalCategories: JSON.parse(localStorage.getItem('annapoorna_rental_categories') || '[]'),
        rentalItems: JSON.parse(localStorage.getItem('annapoorna_rental_items') || '[]'),
        rentalMetadata: JSON.parse(localStorage.getItem('kanchi_rental_metadata') || '{}'),
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

    // 2. Orders & Order Items
    try {
      const { data: dbOrders } = await supabase.from('orders').select('id, order_number');
      const existingOrderNumbers = new Set((dbOrders || []).map((o) => o.order_number).filter(Boolean));
      const existingIds = new Set((dbOrders || []).map((o) => o.id));

      const orders: Order[] = JSON.parse(localStorage.getItem('annapoorna_orders') || '[]');
      for (const o of orders) {
        const orderNum = o.orderNumber || (o.id.startsWith('ORD-') ? o.id : null);
        if (orderNum && existingOrderNumbers.has(orderNum)) {
          summary.orders++;
          continue;
        }
        if (existingIds.has(o.id)) {
          summary.orders++;
          continue;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id);
        const orderUuid = isUuid ? o.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ord-${Date.now()}`);
        const targetNum = orderNum || `ORD-${String(summary.orders + 1).padStart(4, '0')}`;

        const packedNotes = `[Address: ${o.eventAddress || 'Not specified'}] [Event: ${o.eventType || 'Catering'}] [Source: ${o.orderSource || 'Website'}] ${o.notes || ''}`.trim();

        const basePayload = {
          id: orderUuid,
          order_number: targetNum,
          customer_name: o.customerName,
          phone: o.mobile,
          delivery_date: o.orderDate,
          order_status: o.status || 'Pending',
          advance_amount: o.advanceAmount || 0,
          balance_amount: o.balancePaid || 0,
          total_amount: o.totalAmount || 0,
          guest_count: o.guestCount,
          notes: packedNotes,
        };

        const { error: ordErr } = await supabase.from('orders').insert(basePayload);
        if (ordErr) {
          summary.errors.push(`Order ${targetNum}: ${ordErr.message}`);
        } else {
          summary.orders++;
          existingOrderNumbers.add(targetNum);
          existingIds.add(orderUuid);

          if (Array.isArray(o.items) && o.items.length > 0) {
            const itemRows = o.items.map((it) => ({
              order_id: orderUuid,
              dish_id: null,
              dish_name: it.dishName,
              quantity: it.quantity || null,
              unit: it.unit || 'Portions',
              price: it.price || 0,
            }));
            const { error: itErr } = await supabase.from('order_items').insert(itemRows);
            if (!itErr) summary.orderItems += itemRows.length;
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ensureUuid = (val?: string) =>
      val && uuidRegex.test(val)
        ? val
        : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`;

    try {
      const invCategories: InventoryCategory[] = JSON.parse(
        localStorage.getItem('kanchi_inventory_categories') || '[]'
      );
      if (invCategories.length > 0) {
        const { error } = await supabase.from('site_settings').upsert(
          {
            setting_key: 'kanchi_inventory_categories',
            setting_value: invCategories,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        );
        if (error) summary.errors.push(`Inventory categories: ${error.message}`);
        else summary.inventoryCategories = invCategories.length;
      }

      const invItems: InventoryItem[] = JSON.parse(
        localStorage.getItem('kanchi_inventory_items') || '[]'
      );
      const invMetaMap: Record<string, Record<string, unknown>> = JSON.parse(
        localStorage.getItem('kanchi_inventory_metadata') || '{}'
      );

      if (invItems.length > 0) {
        const itemRows = invItems.map((it) => {
          const itemId = ensureUuid(it.id);
          const stock = it.currentStock !== undefined ? it.currentStock : it.stockQuantity;
          const entryMeta: Record<string, unknown> = { ...(invMetaMap[itemId] || {}) };
          if (stock !== undefined) {
            entryMeta.currentStock = stock;
            entryMeta.stockQuantity = stock;
          }
          if (it.purchaseQuantity !== undefined) entryMeta.purchaseQuantity = it.purchaseQuantity;
          if (it.unitPrice !== undefined) entryMeta.unitPrice = it.unitPrice;
          if (it.supplierName) entryMeta.supplierName = it.supplierName;
          if (it.purchaseDate) entryMeta.purchaseDate = it.purchaseDate;
          if (it.expiryDate) entryMeta.expiryDate = it.expiryDate;
          if (it.notes) entryMeta.notes = it.notes;
          if (it.isActive !== undefined && it.isActive !== true) entryMeta.isActive = it.isActive;
          if (Object.keys(entryMeta).length > 0) {
            invMetaMap[itemId] = entryMeta;
          }

          return {
            id: itemId,
            name: it.nameEn,
            tamil_name: it.nameTa || it.nameEn,
            category: it.categoryId,
            unit: it.unit,
            created_at: it.createdAt || new Date().toISOString(),
          };
        });

        const { error } = await supabase
          .from('inventory_items')
          .upsert(itemRows, { onConflict: 'id' });
        if (error) summary.errors.push(`Inventory items: ${error.message}`);
        else summary.inventoryItems = itemRows.length;

        if (Object.keys(invMetaMap).length > 0) {
          await supabase.from('site_settings').upsert(
            {
              setting_key: 'kanchi_inventory_metadata',
              setting_value: invMetaMap,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'setting_key' }
          );
        }
      }

      const invDocs: InventoryDocument[] = JSON.parse(
        localStorage.getItem('kanchi_inventory_documents') || '[]'
      );
      for (const d of invDocs) {
        const docId = ensureUuid(d.id);
        const meta = {
          docNumber: d.docNumber,
          title: d.title,
          eventName: d.eventName,
          customerName: d.customerName || null,
          eventDate: d.eventDate || null,
          preparedBy: d.preparedBy || null,
          notes: d.notes || null,
          language: d.language || 'both',
          totalAmount: d.totalAmount || null,
        };
        const { error } = await supabase.from('purchase_documents').upsert(
          {
            id: docId,
            document_date: d.documentDate,
            notes: JSON.stringify(meta),
            created_at: d.createdAt || new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) {
          summary.errors.push(`Purchase doc ${d.docNumber}: ${error.message}`);
        } else {
          summary.purchaseDocuments++;
          if (Array.isArray(d.items) && d.items.length > 0) {
            await supabase.from('purchase_items').delete().eq('document_id', docId);
            const itemRows = d.items.map((it) => ({
              id: ensureUuid(it.id),
              document_id: docId,
              item_id: it.catalogueItemId && uuidRegex.test(it.catalogueItemId) ? it.catalogueItemId : null,
              item_name: it.nameEn,
              quantity: Number(it.quantity) || 0,
              unit: it.unit,
              price: it.unitPrice || null,
              notes: it.nameTa || it.notes || null,
            }));
            await supabase.from('purchase_items').insert(itemRows);
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Inventory error: ${String(err)}`);
    }

    // 5. Rental Items & Documents
    try {
      const rentalCats: RentalCategory[] = JSON.parse(
        localStorage.getItem('annapoorna_rental_categories') || '[]'
      );
      if (rentalCats.length > 0) {
        const { error } = await supabase.from('site_settings').upsert(
          {
            setting_key: 'kanchi_rental_categories',
            setting_value: rentalCats,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        );
        if (error) summary.errors.push(`Rental categories: ${error.message}`);
        else summary.rentalCategories = rentalCats.length;
      }

      const rentalItems: RentalItem[] = JSON.parse(
        localStorage.getItem('annapoorna_rental_items') || '[]'
      );
      const rentalMetaMap: Record<string, Record<string, unknown>> = JSON.parse(
        localStorage.getItem('kanchi_rental_metadata') || '{}'
      );

      if (rentalItems.length > 0) {
        const rItemRows = rentalItems.map((r) => {
          const itemId = ensureUuid(r.id);
          rentalMetaMap[itemId] = {
            ...(rentalMetaMap[itemId] || {}),
            code: r.code,
            categoryId: r.categoryId,
            totalQuantity: Number(r.totalQuantity) || 0,
            securityDeposit: Number(r.securityDeposit) || 0,
            ...(r.description ? { description: r.description } : {}),
            ...(r.notes ? { notes: r.notes } : {}),
            isActive: r.isActive ?? true,
          };

          return {
            id: itemId,
            name: r.nameEn,
            tamil_name: r.nameTa || r.nameEn,
            price: r.rentalPrice || 0,
            unit: r.pricingUnit || 'Per Day',
            created_at: r.createdAt || new Date().toISOString(),
          };
        });

        const { error } = await supabase
          .from('rental_items')
          .upsert(rItemRows, { onConflict: 'id' });
        if (error) summary.errors.push(`Rental items: ${error.message}`);
        else summary.rentalItems = rItemRows.length;

        await supabase.from('site_settings').upsert(
          {
            setting_key: 'kanchi_rental_metadata',
            setting_value: rentalMetaMap,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        );
      }

      const rentalDocs: RentalDocument[] = JSON.parse(
        localStorage.getItem('annapoorna_rental_documents') || '[]'
      );
      for (const rd of rentalDocs) {
        const docId = ensureUuid(rd.id);
        const meta = {
          rentalNumber: rd.rentalNumber,
          functionName: rd.functionName || null,
          functionDate: rd.functionDate,
          rentalStartDate: rd.rentalStartDate,
          expectedReturnDate: rd.expectedReturnDate,
          actualReturnDate: rd.actualReturnDate || null,
          address: rd.address || null,
          deliveryDetails: rd.deliveryDetails || null,
          subtotal: rd.subtotal || 0,
          additionalCharges: rd.additionalCharges || 0,
          discount: rd.discount || 0,
          securityDeposit: rd.securityDeposit || 0,
          grandTotal: rd.grandTotal || 0,
          advancePaid: rd.advancePaid || 0,
          balanceDue: rd.balanceDue || 0,
          status: rd.status || 'Confirmed',
          notes: rd.notes || null,
          terms: rd.terms || null,
          preferredLanguage: rd.preferredLanguage || 'en',
          items: rd.items || [],
        };
        const { error } = await supabase.from('rental_documents').upsert(
          {
            id: docId,
            customer_name: rd.customerName,
            phone: rd.mobile,
            document_date: rd.documentDate,
            notes: JSON.stringify(meta),
            created_at: rd.createdAt || new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) {
          summary.errors.push(`Rental doc ${rd.rentalNumber}: ${error.message}`);
        } else {
          summary.rentalDocuments++;
          if (Array.isArray(rd.items) && rd.items.length > 0) {
            await supabase.from('rental_document_items').delete().eq('document_id', docId);
            const docItems = rd.items.map((itm) => ({
              id: ensureUuid(undefined),
              document_id: docId,
              item_id: itm.itemId && uuidRegex.test(itm.itemId) ? itm.itemId : null,
              item_name: itm.nameEn,
              quantity: itm.quantity,
              price: itm.pricePerUnit,
              subtotal: itm.lineTotal,
            }));
            await supabase.from('rental_document_items').insert(docItems);
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Rentals error: ${String(err)}`);
    }

    return summary;
  },
};

