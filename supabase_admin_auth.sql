-- ==============================================================================
-- KANCHI AMBAL CATERING - ADMIN AUTHENTICATION & AUTHORIZATION SETUP
-- ==============================================================================
-- Run this in: Supabase Dashboard -> SQL Editor -> Click 'Run'
-- This grants admin privileges to your existing Supabase Authentication account.
-- ==============================================================================

-- 1. Ensure public.admin_users table exists
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Setup RLS policies so the app can verify admin authorization
DROP POLICY IF EXISTS "Allow users to read admin_users" ON public.admin_users;
CREATE POLICY "Allow users to read admin_users"
ON public.admin_users FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow admins to manage admin_users" ON public.admin_users;
CREATE POLICY "Allow admins to manage admin_users"
ON public.admin_users FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Automatically authorize all registered Supabase Auth users as Admins:
INSERT INTO public.admin_users (id, name)
SELECT id, coalesce(raw_user_meta_data->>'full_name', email, 'Admin Owner')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. Verification query to confirm authorized admins
SELECT 
  au.id AS user_id,
  u.email AS auth_email,
  au.name AS admin_name,
  au.created_at AS authorized_at
FROM public.admin_users au
JOIN auth.users u ON au.id = u.id;

