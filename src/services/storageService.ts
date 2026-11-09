import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
  isCloudStorage?: boolean;
}

function sanitizeFileName(name: string, fallback: string): string {
  const clean = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback;
}

export const storageService = {
  /**
   * Upload an image to Supabase Storage 'dish-images' bucket
   */
  async uploadDishImage(file: File | Blob, customName?: string): Promise<UploadResult> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, using local blob preview');
      const fallbackUrl = URL.createObjectURL(file);
      return { url: fallbackUrl, path: 'local-fallback', isCloudStorage: false };
    }

    try {
      const extension = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const cleanName = sanitizeFileName(customName || '', 'dish');
      const filePath = `${cleanName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${extension}`;
      const contentType = file.type || (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg');

      const { data, error } = await supabase.storage
        .from('dish-images')
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.warn('Supabase Storage upload error (dish-images):', error.message);
        if (error.message.includes('row-level security') || (error as any).statusCode === 403) {
          console.error(
            '⚠️ SUPABASE STORAGE RLS BLOCKED: Run the SQL in supabase_storage_policies.sql to enable anon uploads.'
          );
        }
        return {
          url: URL.createObjectURL(file),
          path: filePath,
          error: error.message,
          isCloudStorage: false,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from('dish-images')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
        isCloudStorage: true,
      };
    } catch (err: any) {
      console.error('Storage upload failed:', err);
      return {
        url: URL.createObjectURL(file),
        path: 'local-error',
        error: String(err?.message || err),
        isCloudStorage: false,
      };
    }
  },

  /**
   * Upload category image to 'category-images' bucket
   */
  async uploadCategoryImage(file: File | Blob, categoryId: string): Promise<UploadResult> {
    if (!isSupabaseConfigured) {
      return { url: URL.createObjectURL(file), path: 'local-fallback', isCloudStorage: false };
    }

    try {
      const extension = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const cleanId = sanitizeFileName(categoryId, 'category');
      const filePath = `cat-${cleanId}-${Date.now()}.${extension}`;
      const contentType = file.type || 'image/jpeg';

      const { data, error } = await supabase.storage
        .from('category-images')
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.warn('Supabase Storage upload error (category-images):', error.message);
        return {
          url: URL.createObjectURL(file),
          path: filePath,
          error: error.message,
          isCloudStorage: false,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from('category-images')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
        isCloudStorage: true,
      };
    } catch (err: any) {
      return {
        url: URL.createObjectURL(file),
        path: 'local-error',
        error: String(err?.message || err),
        isCloudStorage: false,
      };
    }
  },

  /**
   * Upload document / PDF to 'documents' bucket
   */
  async uploadDocument(file: File | Blob, docName?: string): Promise<UploadResult> {
    if (!isSupabaseConfigured) {
      return { url: URL.createObjectURL(file), path: 'local-fallback', isCloudStorage: false };
    }

    try {
      const extension = file instanceof File ? file.name.split('.').pop() || 'pdf' : 'pdf';
      const cleanName = sanitizeFileName(docName || '', 'doc');
      const filePath = `${cleanName}-${Date.now()}.${extension}`;
      const contentType = file.type || 'application/pdf';

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.warn('Supabase Storage upload error (documents):', error.message);
        return {
          url: URL.createObjectURL(file),
          path: filePath,
          error: error.message,
          isCloudStorage: false,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
        isCloudStorage: true,
      };
    } catch (err: any) {
      return {
        url: URL.createObjectURL(file),
        path: 'local-error',
        error: String(err?.message || err),
        isCloudStorage: false,
      };
    }
  },

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(bucket: 'dish-images' | 'category-images' | 'documents', path: string): Promise<boolean> {
    if (!isSupabaseConfigured || !path || path.startsWith('local-') || path.startsWith('blob:')) return false;

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Health check to test if Supabase Storage buckets and policies are functional
   */
  async checkStorageHealth(): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: 'Supabase client is not configured' };
    }

    try {
      const testBlob = new Blob(['ping'], { type: 'text/plain' });
      const testPath = `.health-check-${Date.now()}.txt`;
      const { error: uploadErr } = await supabase.storage
        .from('dish-images')
        .upload(testPath, testBlob, { upsert: true });

      if (uploadErr) {
        return {
          ok: false,
          message: `Storage RLS Policy Error: ${uploadErr.message}. Run supabase_storage_policies.sql in SQL Editor.`,
        };
      }

      // Cleanup
      await supabase.storage.from('dish-images').remove([testPath]);
      return { ok: true, message: 'Supabase Storage is operational and public uploads are permitted.' };
    } catch (err: any) {
      return { ok: false, message: String(err?.message || err) };
    }
  },
};
