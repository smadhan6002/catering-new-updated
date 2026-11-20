-- ==============================================================================
-- KANCHI AMBAL CATERING — BANANA LEAF MEALS CUSTOMIZATION TABLE
-- ==============================================================================
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run.
-- Safe & idempotent: preserves all existing rows and columns using IF NOT EXISTS.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.meal_customization_configs (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'banana-leaf-meals',
  dish_id VARCHAR(100) NOT NULL DEFAULT 'ms1',
  is_enabled BOOLEAN DEFAULT TRUE,
  title_en TEXT DEFAULT 'Customize Your Banana Leaf Meals',
  title_ta TEXT DEFAULT 'உங்கள் வாழை இலை உணவைத் தேர்வு செய்யுங்கள்',
  subtitle_en TEXT DEFAULT 'Choose the dishes you want to include in your meal.',
  subtitle_ta TEXT DEFAULT 'உங்கள் உணவில் சேர்க்க விரும்பும் உணவுகளைத் தேர்ந்தெடுக்கவும்.',
  groups JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.meal_customization_configs ENABLE ROW LEVEL SECURITY;

-- Allow public read access so website customers can see meal customization options
DROP POLICY IF EXISTS "Public can view meal customization configs" ON public.meal_customization_configs;
CREATE POLICY "Public can view meal customization configs"
  ON public.meal_customization_configs
  FOR SELECT
  USING (true);

-- Allow authenticated admins to update meal customization configs
DROP POLICY IF EXISTS "Admins can manage meal customization configs" ON public.meal_customization_configs;
CREATE POLICY "Admins can manage meal customization configs"
  ON public.meal_customization_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to insert/update during local dev/admin if needed
DROP POLICY IF EXISTS "Anon can manage meal customization configs" ON public.meal_customization_configs;
CREATE POLICY "Anon can manage meal customization configs"
  ON public.meal_customization_configs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
