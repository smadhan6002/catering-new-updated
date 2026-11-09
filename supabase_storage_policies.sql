-- ==============================================================================
-- KANCHI AMBAL CATERING - SUPABASE STORAGE RLS POLICIES
-- ==============================================================================
-- Run this script in: Supabase Dashboard -> SQL Editor -> Click 'Run'
-- This fixes the issue: "buckets la images lam save agala"
-- It allows the website and admin panel to upload, read, update, and delete
-- images and documents in the dish-images, category-images, and documents buckets.
-- ==============================================================================

-- 1. Ensure storage buckets exist and are marked PUBLIC
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('dish-images', 'dish-images', true, 52428800, NULL),
  ('category-images', 'category-images', true, 52428800, NULL),
  ('documents', 'documents', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

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

-- 4. Policy: Allow Public SELECT (View / Download images and documents)
CREATE POLICY "Public Select Objects"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('dish-images', 'category-images', 'documents'));

-- 5. Policy: Allow Public INSERT (Upload images and documents from website / admin panel)
CREATE POLICY "Public Insert Objects"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id IN ('dish-images', 'category-images', 'documents'));

-- 6. Policy: Allow Public UPDATE (Update / Overwrite files)
CREATE POLICY "Public Update Objects"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id IN ('dish-images', 'category-images', 'documents'))
WITH CHECK (bucket_id IN ('dish-images', 'category-images', 'documents'));

-- 7. Policy: Allow Public DELETE (Remove files when dish or document is deleted)
CREATE POLICY "Public Delete Objects"
ON storage.objects FOR DELETE
TO public
USING (bucket_id IN ('dish-images', 'category-images', 'documents'));

