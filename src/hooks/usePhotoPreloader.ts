import { useState, useEffect, useRef } from 'react';

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  order_index: number;
}

interface PreloadedPhotos {
  urls: Map<string, string>;
  loading: boolean;
  progress: number; // 0-100
  totalPhotos: number;
  loadedPhotos: number;
}

export function usePhotoPreloader(photosByRegion: Record<string, Photo[]>): PreloadedPhotos {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const loadingRef = useRef(false);
  const loadedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Get all unique photo paths
    const allPhotos: Photo[] = [];
    Object.values(photosByRegion).forEach(photos => {
      photos.forEach(photo => {
        if (!loadedPathsRef.current.has(photo.image_path)) {
          allPhotos.push(photo);
        }
      });
    });

    if (allPhotos.length === 0 || loadingRef.current) return;

    const loadPhotos = async () => {
      loadingRef.current = true;
      setLoading(true);
      setTotalCount(prev => prev + allPhotos.length);

      for (const photo of allPhotos) {
        // Skip if already loaded
        if (loadedPathsRef.current.has(photo.image_path)) {
          continue;
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-photo`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ filePath: photo.image_path }),
            }
          );

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            loadedPathsRef.current.add(photo.image_path);
            setUrls(prev => {
              const newMap = new Map(prev);
              newMap.set(photo.image_path, url);
              return newMap;
            });
            setLoadedCount(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error preloading photo:', error);
          setLoadedCount(prev => prev + 1); // Still count as processed
        }
      }

      loadingRef.current = false;
      setLoading(false);
    };

    // Start preloading with a small delay to prioritize UI
    const timeoutId = setTimeout(loadPhotos, 500);
    return () => clearTimeout(timeoutId);
  }, [photosByRegion]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const progress = totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 0;

  return {
    urls,
    loading,
    progress,
    totalPhotos: totalCount,
    loadedPhotos: loadedCount,
  };
}
