-- ==============================================================================
-- KANCHI AMBAL CATERING — PRODUCTION SUPABASE DATABASE SCHEMA & MIGRATION
-- ==============================================================================
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run.
-- ==============================================================================

-- ==============================================================================
-- 0. SCHEMA UPGRADE & REPAIR FOR EXISTING TABLES
-- ==============================================================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS order_source VARCHAR(50) DEFAULT 'Website',
  ADD COLUMN IF NOT EXISTS event_address TEXT,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS delivery_time VARCHAR(50),
  ADD COLUMN IF NOT EXISTS food_quantities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kitchen_sheet_status VARCHAR(50) DEFAULT 'Not Prepared',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS order_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS balance_paid NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop strict dish UUID foreign key constraint on order_items so text dish IDs ('bb1', 'st7', etc.) work
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_dish_id_fkey;
ALTER TABLE public.order_items ALTER COLUMN dish_id TYPE VARCHAR(100);
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS category_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;

-- Ensure public.payments table exists with correct schema and indices
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);

-- Enable RLS and setup policies for public.payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read payments" ON public.payments;
CREATE POLICY "Allow anon read payments" ON public.payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert payments" ON public.payments;
CREATE POLICY "Allow anon insert payments" ON public.payments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update payments" ON public.payments;
CREATE POLICY "Allow anon update payments" ON public.payments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete payments" ON public.payments;
CREATE POLICY "Allow anon delete payments" ON public.payments FOR DELETE USING (true);

-- Atomic PostgreSQL RPC function to add payment and update order totals
CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_date TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_total_paid NUMERIC;
  v_total_amount NUMERIC;
  v_balance_due NUMERIC;
  v_payment_status TEXT;
BEGIN
  -- 1. Insert new payment record
  INSERT INTO public.payments (order_id, amount, payment_method, payment_date, notes)
  VALUES (p_order_id, p_amount, p_payment_method, p_payment_date, p_notes)
  RETURNING id INTO v_payment_id;

  -- 2. Calculate Total Paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.payments
  WHERE order_id = p_order_id;

  -- 3. Retrieve order total amount
  SELECT COALESCE(total_amount, 0)
  INTO v_total_amount
  FROM public.orders
  WHERE id = p_order_id;

  -- 4. Calculate Balance Due & Status
  v_balance_due := GREATEST(0, v_total_amount - v_total_paid);

  IF v_total_paid <= 0 THEN
    v_payment_status := 'Unpaid';
  ELSIF v_total_paid >= v_total_amount AND v_total_amount > 0 THEN
    v_payment_status := 'Paid';
  ELSE
    v_payment_status := 'Partial';
  END IF;

  -- 5. Update order record
  UPDATE public.orders
  SET
    advance_amount = v_total_paid,
    balance_amount = v_balance_due,
    payment_status = v_payment_status
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'total_paid', v_total_paid,
    'balance_due', v_balance_due,
    'payment_status', v_payment_status
  );
END;
$$;

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CUSTOMERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  alternative_mobile VARCHAR(20),
  email VARCHAR(255),
  birthday DATE,
  anniversary_date DATE,
  preferred_language VARCHAR(10) DEFAULT 'ta',
  marketing_consent BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

-- ==============================================================================
-- 2. DISH CATEGORIES & DISHES TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dishes (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  category_id VARCHAR(100) NOT NULL,
  image TEXT,
  is_admin_added BOOLEAN DEFAULT FALSE,
  default_unit VARCHAR(50) DEFAULT 'kg',
  supported_units TEXT[] DEFAULT ARRAY['kg', 'g', 'Pieces', 'Portions'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dishes_category ON public.dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_is_active ON public.dishes(is_active);

CREATE TABLE IF NOT EXISTS public.dish_overrides (
  dish_id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  name_ta VARCHAR(255),
  category_id VARCHAR(100),
  image TEXT,
  default_unit VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ORDERS, ORDER ITEMS, & ORDER PAYMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  alternative_mobile VARCHAR(20),
  order_source VARCHAR(50) DEFAULT 'Website',
  event_address TEXT NOT NULL,
  event_type VARCHAR(100),
  order_date DATE NOT NULL,
  delivery_time VARCHAR(50),
  guest_count INTEGER,
  food_quantities JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  advance_amount NUMERIC(12, 2) DEFAULT 0,
  balance_paid NUMERIC(12, 2) DEFAULT 0,
  payments JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'Pending',
  kitchen_sheet_status VARCHAR(50) DEFAULT 'Not Prepared',
  notes TEXT,
  admin_notes TEXT,
  invoice_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_mobile ON public.orders(mobile);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(64) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dish_id VARCHAR(100) NOT NULL,
  dish_name VARCHAR(255) NOT NULL,
  category_id VARCHAR(100) NOT NULL,
  quantity NUMERIC(10, 2),
  unit VARCHAR(50),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  method VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);

-- ==============================================================================
-- 4. CUSTOMER LEADS & LEAD ACTIVITIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customer_leads (
  id VARCHAR(64) PRIMARY KEY,
  lead_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  alternative_mobile VARCHAR(20),
  event_type VARCHAR(100),
  event_date DATE,
  expected_guest_count INTEGER,
  customer_requirement TEXT,
  discussion_details TEXT NOT NULL,
  follow_up_date DATE,
  follow_up_time VARCHAR(50),
  status VARCHAR(50) DEFAULT 'New',
  additional_notes TEXT,
  converted_to_order_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON public.customer_leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.customer_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_mobile ON public.customer_leads(mobile);

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.customer_leads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time VARCHAR(50),
  discussion_details TEXT NOT NULL,
  customer_requirement TEXT,
  agreed_next_action TEXT,
  next_follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);

-- ==============================================================================
-- 5. KITCHEN ORDER SHEETS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kitchen_sheets (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  alternative_mobile VARCHAR(20),
  event_address TEXT,
  event_type VARCHAR(100),
  order_date DATE NOT NULL,
  delivery_time VARCHAR(50),
  guest_count INTEGER,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'Not Prepared',
  cooking_instructions TEXT,
  chef_notes TEXT,
  pdf_language VARCHAR(10) DEFAULT 'both',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_sheets_order_date ON public.kitchen_sheets(order_date);

-- ==============================================================================
-- 6. GROCERY & VEGETABLE INVENTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'kg',
  stock_quantity NUMERIC(10, 2),
  unit_price NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category_id);

CREATE TABLE IF NOT EXISTS public.purchase_documents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  event_date DATE,
  document_date DATE NOT NULL,
  prepared_by VARCHAR(255),
  notes TEXT,
  language VARCHAR(10) DEFAULT 'both',
  total_amount NUMERIC(12, 2) DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  catalogue_item_id VARCHAR(64),
  name_en VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  category_name_en VARCHAR(255),
  category_name_ta VARCHAR(255),
  quantity NUMERIC(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_document ON public.purchase_items(document_id);

-- ==============================================================================
-- 7. RENTAL ITEMS & TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rental_categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rental_items (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) REFERENCES public.rental_categories(id) ON DELETE SET NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  rental_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pricing_unit VARCHAR(50) NOT NULL DEFAULT 'Per Day',
  security_deposit NUMERIC(10, 2) DEFAULT 0,
  description TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rental_documents (
  id VARCHAR(64) PRIMARY KEY,
  rental_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  address TEXT,
  function_name VARCHAR(255),
  document_date DATE NOT NULL,
  function_date DATE NOT NULL,
  rental_start_date DATE NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  delivery_details TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  additional_charges NUMERIC(12, 2) DEFAULT 0,
  discount NUMERIC(12, 2) DEFAULT 0,
  security_deposit NUMERIC(12, 2) DEFAULT 0,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advance_paid NUMERIC(12, 2) DEFAULT 0,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
  notes TEXT,
  terms TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. INVOICES, MESSAGES & CAMPAIGNS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_messages (
  id VARCHAR(64) PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  event_type VARCHAR(100),
  event_date DATE,
  guest_count INTEGER,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'New',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL,
  message_template TEXT NOT NULL,
  recipient_filter VARCHAR(50) NOT NULL,
  recipient_ids TEXT[],
  recipient_count INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'Ready',
  channel VARCHAR(50) DEFAULT 'whatsapp_direct',
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. PUBLIC ACCESS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Public can view active dishes" ON public.dishes
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Public can view categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can view dish overrides" ON public.dish_overrides
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can view rental items" ON public.rental_items
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Public can view rental categories" ON public.rental_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can view site settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can insert orders" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public can insert order items" ON public.order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public can insert customer record" ON public.customers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public can insert website messages" ON public.customer_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- B. ADMIN FULL ACCESS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Admin full access customers" ON public.customers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access categories" ON public.categories
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access dishes" ON public.dishes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access dish_overrides" ON public.dish_overrides
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access orders" ON public.orders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access order_items" ON public.order_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access order_payments" ON public.order_payments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access customer_leads" ON public.customer_leads
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access lead_activities" ON public.lead_activities
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access kitchen_sheets" ON public.kitchen_sheets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access inventory_categories" ON public.inventory_categories
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access inventory_items" ON public.inventory_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access purchase_documents" ON public.purchase_documents
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access purchase_items" ON public.purchase_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access rental_categories" ON public.rental_categories
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access rental_items" ON public.rental_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access rental_documents" ON public.rental_documents
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access invoices" ON public.invoices
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access customer_messages" ON public.customer_messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access campaigns" ON public.campaigns
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access site_settings" ON public.site_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 10. STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('dish-images', 'dish-images', true),
  ('category-images', 'category-images', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read dish-images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'dish-images');

CREATE POLICY "Upload dish-images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'dish-images');

CREATE POLICY "Update dish-images" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'dish-images');

CREATE POLICY "Delete dish-images" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'dish-images');

CREATE POLICY "Public read category-images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'category-images');

CREATE POLICY "Upload category-images" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'category-images');

CREATE POLICY "Public read documents" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');

CREATE POLICY "Upload documents" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'documents');
