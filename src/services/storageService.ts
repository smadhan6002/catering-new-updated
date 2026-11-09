import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

export const storageService = {
  /**
   * Upload an image to Supabase Storage 'dish-images' bucket
   */
  async uploadDishImage(file: File | Blob, customName?: string): Promise<UploadResult> {
    if (!isSupabaseConfigured) {
      // Fallback: create an object URL or local data URL
      const fallbackUrl = URL.createObjectURL(file);
      return { url: fallbackUrl, path: 'local-fallback' };
    }

    try {
      const extension = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const cleanName = (customName || `dish-${Date.now()}`)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const filePath = `${cleanName}-${Date.now()}.${extension}`;

      const { data, error } = await supabase.storage
        .from('dish-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload error, falling back:', error.message);
        return {
          url: URL.createObjectURL(file),
          path: filePath,
          error: error.message,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from('dish-images')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
      };
    } catch (err) {
      console.error('Storage upload failed:', err);
      return {
        url: URL.createObjectURL(file),
        path: 'local-error',
        error: String(err),
      };
    }
  },

  /**
   * Upload category image to 'category-images' bucket
   */
  async uploadCategoryImage(file: File | Blob, categoryId: string): Promise<UploadResult> {
    if (!isSupabaseConfigured) {
      return { url: URL.createObjectURL(file), path: 'local-fallback' };
    }

    try {
      const extension = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const filePath = `cat-${categoryId}-${Date.now()}.${extension}`;

      const { data, error } = await supabase.storage
        .from('category-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        return { url: URL.createObjectURL(file), path: filePath, error: error.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('category-images')
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
      };
    } catch (err) {
      return { url: URL.createObjectURL(file), path: 'local-error', error: String(err) };
    }
  },

  /**
   * Delete image from Supabase Storage
   */
  async deleteFile(bucket: 'dish-images' | 'category-images' | 'documents', path: string): Promise<boolean> {
    if (!isSupabaseConfigured || !path || path.startsWith('local-')) return false;

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      return !error;
    } catch {
      return false;
    }
  },
};

