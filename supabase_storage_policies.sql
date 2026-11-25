-- ==============================================================================
-- KANCHI AMBAL CATERING - SUPABASE STORAGE RLS POLICIES
-- ==============================================================================
-- Run this script in: Supabase Dashboard -> SQL Editor -> Click 'Run'
-- This fixes the issue: "buckets la images lam save agala"
-- It allows the website and admin panel to upload, read, update, and delete
-- images and documents in the dish-images, category-images, and documents buckets.
-- ==============================================================================

-- 1. Ensure storage buckets exist with proper access settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('dish-images', 'dish-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('category-images', 'category-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('documents', 'documents', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Enable Row Level Security (RLS) on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop all previous/conflicting policies on storage.objects
DROP POLICY IF EXISTS "Public Select Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to dish-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from dish-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to category-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from category-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from documents" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_read_images" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_write_images" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_manage_documents" ON storage.objects;

-- 4. Policy: Allow Public SELECT (View menu and category images)
CREATE POLICY "storage_public_read_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('dish-images', 'category-images'));

-- 5. Policy: Allow Authenticated Admins to Upload/Update/Delete menu images
CREATE POLICY "storage_admin_write_images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id IN ('dish-images', 'category-images') AND public.is_admin())
WITH CHECK (bucket_id IN ('dish-images', 'category-images') AND public.is_admin());

-- 6. Policy: Allow Authenticated Admins Exclusive Access to purchase & invoice documents
CREATE POLICY "storage_admin_manage_documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documents' AND public.is_admin())
WITH CHECK (bucket_id = 'documents' AND public.is_admin());

