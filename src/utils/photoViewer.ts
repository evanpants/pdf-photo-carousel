/**
 * Get a photo URL by serving it through the secure edge function
 * This ensures proper authorization checks are performed
 */
export async function getSecurePhotoUrl(filePath: string): Promise<string> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-photo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ filePath }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch photo: ${response.status}`);
    }

    const blob = await response.blob();
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
    const url = await getSecurePhotoUrl(filePath);
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
