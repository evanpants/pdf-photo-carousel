import { supabase } from "@/integrations/supabase/client";

/**
 * Get a photo URL by serving it through the secure edge function
 * This ensures proper authorization checks are performed
 */
export async function getSecurePhotoUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('serve-photo', {
      body: { filePath }
    });

    if (error) {
      console.error('Error fetching photo:', error);
      throw error;
    }

    // The edge function returns the raw image data, so we need to create a blob URL
    const blob = new Blob([data], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to get secure photo URL:', error);
    throw error;
  }
}

/**
 * Get photo URL using the edge function and return as blob URL
 * Returns a cached URL if available
 */
const photoUrlCache = new Map<string, string>();

export async function getCachedPhotoUrl(filePath: string): Promise<string> {
  if (photoUrlCache.has(filePath)) {
    return photoUrlCache.get(filePath)!;
  }

  try {
    const response = await supabase.functions.invoke('serve-photo', {
      body: { filePath }
    });

    if (response.error) {
      throw response.error;
    }

    // Convert ArrayBuffer to Blob
    const blob = new Blob([response.data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    photoUrlCache.set(filePath, url);
    return url;
  } catch (error) {
    console.error('Failed to get photo URL:', error);
    // Return a placeholder on error
    return '/placeholder.svg';
  }
}

/**
 * Clear the photo URL cache (e.g., on logout)
 */
export function clearPhotoUrlCache() {
  photoUrlCache.forEach((url) => URL.revokeObjectURL(url));
  photoUrlCache.clear();
}
