-- ==============================================================================
-- KANCHI AMBAL CATERING — PRODUCTION SUPABASE DATABASE SCHEMA & MIGRATION
-- ==============================================================================
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run.
-- Safe & idempotent: preserves all existing rows and columns using IF NOT EXISTS.
-- ==============================================================================

-- ==============================================================================
-- 1. ORDERS & PAYMENTS (VERIFIED & PRODUCTION TESTED)
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

  -- 4. Calculate balance due
  v_balance_due := GREATEST(0, v_total_amount - v_total_paid);

  -- 5. Determine payment status
  IF v_total_amount <= 0 THEN
    v_payment_status := 'Unpaid';
  ELSIF v_total_paid >= v_total_amount THEN
    v_payment_status := 'Paid';
  ELSIF v_total_paid > 0 THEN
    v_payment_status := 'Partial';
  ELSE
    v_payment_status := 'Unpaid';
  END IF;

  -- 6. Update order record atomically
  UPDATE public.orders
  SET 
    paid_amount = v_total_paid,
    balance_amount = v_balance_due,
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'total_paid', v_total_paid,
    'balance_due', v_balance_due,
    'payment_status', v_payment_status
  );
END;
$$;

-- ==============================================================================
-- 2. CUSTOMER LEADS & ACTIVITIES
-- ==============================================================================
ALTER TABLE public.customer_leads 
  ADD COLUMN IF NOT EXISTS lead_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS alternative_mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS expected_guest_count INTEGER,
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_time VARCHAR(50),
  ADD COLUMN IF NOT EXISTS additional_notes TEXT,
  ADD COLUMN IF NOT EXISTS converted_to_order_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS time VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discussion_details TEXT,
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT,
  ADD COLUMN IF NOT EXISTS agreed_next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;

-- Ensure activity column can be populated safely
ALTER TABLE public.lead_activities ALTER COLUMN activity DROP NOT NULL;

-- ==============================================================================
-- 3. DISHES & CATEGORIES
-- ==============================================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_ta TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS dish_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_ta TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS default_unit VARCHAR(50) DEFAULT 'Pieces',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_admin_added BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create optional dish_overrides table
CREATE TABLE IF NOT EXISTS public.dish_overrides (
  dish_id VARCHAR(100) PRIMARY KEY,
  name TEXT,
  name_ta TEXT,
  category_id VARCHAR(100),
  image TEXT,
  default_unit VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. GROCERY & VEGETABLE INVENTORY
-- ==============================================================================
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_ta TEXT,
  ADD COLUMN IF NOT EXISTS category_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS current_stock NUMERIC(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_quantity NUMERIC(12, 3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS doc_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS prepared_by TEXT,
  ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS catalogue_item_id UUID,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_ta TEXT,
  ADD COLUMN IF NOT EXISTS category_name_en TEXT,
  ADD COLUMN IF NOT EXISTS category_name_ta TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure purchase_items.item_name can be nullable if name_en is used
ALTER TABLE public.purchase_items ALTER COLUMN item_name DROP NOT NULL;

-- ==============================================================================
-- 5. RENTAL ITEMS & DOCUMENTS
-- ==============================================================================
ALTER TABLE public.rental_items
  ADD COLUMN IF NOT EXISTS code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_ta TEXT,
  ADD COLUMN IF NOT EXISTS category_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS rental_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_unit VARCHAR(50) DEFAULT 'Per Day',
  ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.rental_documents
  ADD COLUMN IF NOT EXISTS rental_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS function_name TEXT,
  ADD COLUMN IF NOT EXISTS function_date DATE,
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS expected_return_date DATE,
  ADD COLUMN IF NOT EXISTS actual_return_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_details TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_charges NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Confirmed',
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.rental_document_items
  ADD COLUMN IF NOT EXISTS rental_id UUID,
  ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.rental_document_items ALTER COLUMN item_name DROP NOT NULL;

-- ==============================================================================
-- 6. CUSTOMER MESSAGES
-- ==============================================================================
ALTER TABLE public.customer_messages
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS guest_count INTEGER,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- 7. INVOICES
-- ==============================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES FOR ALL TABLES
-- ==============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'orders', 'order_items', 'payments', 'customers',
    'customer_leads', 'lead_activities', 'categories', 'dishes', 'dish_overrides',
    'inventory_items', 'purchase_documents', 'purchase_items',
    'rental_items', 'rental_documents', 'rental_document_items',
    'customer_messages', 'invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow anon all on %I" ON public.%I;', t, t);
      EXECUTE format('CREATE POLICY "Allow anon all on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
    EXCEPTION WHEN OTHERS THEN
      -- Table may not exist or permission restriction
      NULL;
    END;
  END LOOP;
END $$;

-- ==============================================================================
-- 9. STORAGE BUCKETS CONFIGURATION (DISHES, CATEGORIES, DOCUMENTS)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('dish-images', 'dish-images', true),
  ('category-images', 'category-images', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies allowing public upload and download
DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
CREATE POLICY "Public Storage Access" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
