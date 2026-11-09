/**
 * Grocery & Vegetable Inventory Module Types
 * Manages ingredients, grocery items, vegetables, spices, oils, fruits, and purchase/stock documents.
 */

export interface InventoryCategory {
  id: string;
  nameEn: string;
  nameTa: string;
  isCustom?: boolean;
}

export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'L'
  | 'ml'
  | 'pcs'
  | 'packets'
  | 'bags'
  | 'boxes'
  | 'bundles'
  | 'dozens'
  | string;

export interface InventoryItem {
  id: string;
  nameEn: string;
  nameTa: string;
  categoryId: string;
  unit: InventoryUnit;
  currentStock?: number;
  stockQuantity?: number;
  isActive?: boolean;
  purchaseQuantity?: number;
  unitPrice?: number;
  supplierName?: string;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDocumentItem {
  id: string;
  catalogueItemId?: string;
  nameEn: string;
  nameTa: string;
  categoryNameEn?: string;
  categoryNameTa?: string;
  quantity: number | string;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export interface InventoryDocument {
  id: string;
  docNumber: string;
  title: string;
  eventName: string;
  customerName?: string;
  eventDate: string;
  documentDate: string;
  preparedBy?: string;
  notes?: string;
  language: 'en' | 'ta';
  items: InventoryDocumentItem[];
  totalAmount?: number;
  createdAt: string;
}

