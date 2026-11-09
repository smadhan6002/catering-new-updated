/**
 * Types for the Order Management System
 * These types are designed to be backend-agnostic.
 * When migrating to Supabase, these shapes map directly to DB table rows.
 */

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'In Preparation'
  | 'Ready'
  | 'Completed'
  | 'Cancelled';

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Bank Transfer'
  | 'Card'
  | 'Cheque'
  | 'Other';

export type OrderSource =
  | 'Website'
  | 'Phone Call'
  | 'WhatsApp'
  | 'Direct / Walk-in'
  | 'Other';

export type MeasurementUnit =
  | 'Kilograms'
  | 'kg'
  | 'Litres'
  | 'Cups'
  | 'Pieces'
  | 'Boxes'
  | 'Packets'
  | 'Portions'
  | 'Plates';

export interface OrderPayment {
  id: string;           // e.g. pay-001 or unique ID
  amount: number;
  date: string;         // ISO date yyyy-mm-dd
  method: PaymentMethod | string;
  note?: string;
}

export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Advance Paid' | 'Fully Paid';

export interface OrderItem {
  dishId: string;
  dishName: string;     // Snapshot — never changes even if dish is renamed/deleted
  categoryId: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  price?: number;
}

export interface OrderFoodQuantity {
  dishId: string;
  dishName: string;
  quantity: number;
  unit: string;
  note?: string;
}

export type KitchenPrepStatus =
  | 'Not Prepared'
  | 'In Preparation'
  | 'Ready'
  | 'Completed';

export interface KitchenSheetItem {
  id: string;
  dishId: string;
  dishName: string;
  dishNameTa?: string;
  customerQuantity?: number | null;
  customerUnit?: string;
  prepQuantity: number | string;
  unit: string;
  isCustomUnit?: boolean;
  kitchenNotes?: string;
}

export interface KitchenOrderSheet {
  id: string;
  orderId: string;
  customerName: string;
  mobile: string;
  alternativeMobile?: string;
  eventAddress?: string;
  eventType?: string;
  orderDate: string;
  deliveryTime?: string;
  createdAt: string;
  updatedAt: string;
  guestCount?: number | null;
  items: KitchenSheetItem[];
  status: KitchenPrepStatus;
  cookingInstructions?: string;
  chefNotes?: string;
  pdfLanguage?: 'en' | 'ta' | 'both';
}

export interface Order {
  id: string;           // e.g. ORD-0001 or UUID
  orderNumber?: string; // Displayed order number e.g. ORD-0001
  customerId?: string;  // Associated customer ID
  customerName: string;
  mobile: string;
  alternativeMobile?: string;
  orderSource?: OrderSource;
  eventAddress: string;
  eventType?: string;
  orderDate: string;    // Delivery date / event date yyyy-mm-dd
  deliveryTime?: string;
  createdAt: string;    // ISO datetime
  items: OrderItem[];
  guestCount: number | null;
  foodQuantities?: OrderFoodQuantity[];
  totalAmount: number;
  advanceAmount?: number;   // Maintained for backward compatibility
  balancePaid?: number;     // Maintained for backward compatibility
  payments?: OrderPayment[]; // Multiple split payments / installment history
  status: OrderStatus;
  kitchenSheetStatus?: KitchenPrepStatus;
  notes: string;            // Special instructions
  adminNotes?: string;      // Internal admin notes
  invoiceGenerated: boolean;
}

export interface Invoice {
  id: string;           // INV-0001
  orderId: string;
  generatedAt: string;
}

export interface AdminDish {
  id: string;
  name: string;
  categoryId: string;
  image: string;        // base64 data URL for admin-added dishes
  isAdminAdded: boolean;
  defaultUnit?: string;
  supportedUnits?: string[];
}

export interface Customer {
  id: string;           // CUST-0001
  name: string;
  mobile: string;       // Normalized 10 digits
  alternativeMobile?: string;
  email?: string;
  birthday?: string;    // YYYY-MM-DD
  anniversaryDate?: string; // YYYY-MM-DD
  preferredLanguage?: 'en' | 'ta';
  notes?: string;
  marketingConsent: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CampaignType =
  | 'Birthday Greetings'
  | 'Anniversary Greetings'
  | 'Festival Wishes'
  | 'Catering Offers'
  | 'Seasonal Promotions'
  | 'Custom Messages';

export type CampaignStatus =
  | 'Draft'
  | 'Ready'
  | 'Sending'
  | 'Sent'
  | 'Partially Failed'
  | 'Failed';

export interface Campaign {
  id: string;           // CMP-0001
  title: string;
  type: CampaignType;
  language: 'en' | 'ta';
  messageTemplate: string;
  recipientFilter: 'all_consented' | 'birthdays_this_month' | 'anniversaries_this_month' | 'selected';
  recipientIds: string[];
  recipientCount: number;
  status: CampaignStatus;
  createdAt: string;
  sentAt?: string;
  channel: 'whatsapp_api' | 'whatsapp_direct';
  testNumber?: string;
  notes?: string;
}
