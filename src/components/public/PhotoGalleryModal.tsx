import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
}

interface PhotoGalleryModalProps {
  photos: Photo[];
  preloadedUrls?: Map<string, string>;
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoGalleryModal({ photos, preloadedUrls, isOpen, onClose }: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loadingPhotos, setLoadingPhotos] = useState<Set<string>>(new Set());
  const [loadedCount, setLoadedCount] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setLoadedCount(0);
    }
  }, [isOpen]);

  // Use preloaded URLs if available, otherwise load on demand
  useEffect(() => {
    if (!isOpen || photos.length === 0) return;

    // Check which photos are already preloaded
    const newUrls = new Map<string, string>();
    const photosToLoad: Photo[] = [];

    for (const photo of photos) {
      if (preloadedUrls?.has(photo.image_path)) {
        newUrls.set(photo.image_path, preloadedUrls.get(photo.image_path)!);
      } else if (!photoUrls.has(photo.image_path) && !loadingPhotos.has(photo.image_path)) {
        photosToLoad.push(photo);
      }
    }

    if (newUrls.size > 0) {
      setPhotoUrls(prev => {
        const merged = new Map(prev);
        newUrls.forEach((url, path) => merged.set(path, url));
        return merged;
      });
      setLoadedCount(prev => prev + newUrls.size);
    }

    // Load remaining photos
    if (photosToLoad.length > 0) {
      const loadRemainingPhotos = async () => {
        setLoadingPhotos(prev => {
          const newSet = new Set(prev);
          photosToLoad.forEach(p => newSet.add(p.image_path));
          return newSet;
        });

        for (const photo of photosToLoad) {
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
              setPhotoUrls(prev => {
                const newMap = new Map(prev);
                newMap.set(photo.image_path, url);
                return newMap;
              });
              setLoadedCount(prev => prev + 1);
            }
          } catch (error) {
            console.error('Error loading photo:', error);
            setLoadedCount(prev => prev + 1);
          } finally {
            setLoadingPhotos(prev => {
              const newSet = new Set(prev);
              newSet.delete(photo.image_path);
              return newSet;
            });
          }
        }
      };

      loadRemainingPhotos();
    }
  }, [isOpen, photos, preloadedUrls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, photos.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 75) {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
    if (touchEndX.current - touchStartX.current > 75) {
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const currentPhotoUrl = photoUrls.get(currentPhoto.image_path);
  const isCurrentPhotoLoading = !currentPhotoUrl;
  const loadProgress = photos.length > 0 ? Math.round((loadedCount / photos.length) * 100) : 0;
  const allPhotosLoaded = loadedCount >= photos.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 md:right-4 md:top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-background/80 p-1"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div 
          className="flex flex-col h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Loading progress bar */}
          {!allPhotosLoaded && (
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading photos... {loadProgress}%</span>
              </div>
              <Progress value={loadProgress} className="h-1" />
            </div>
          )}

          <div className="flex-1 flex items-center justify-center bg-muted p-4 md:p-8 overflow-hidden min-h-[300px]">
            {isCurrentPhotoLoading ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading image...</span>
                </div>
              </div>
            ) : (
              <img
                src={currentPhotoUrl}
                alt={currentPhoto.caption || 'Gallery image'}
                className="w-full h-auto max-h-[60vh] object-contain animate-fade-in"
              />
            )}
          </div>
          
          {currentPhoto.caption && (
            <div className="px-8 py-4 bg-background">
              <p className="text-sm text-muted-foreground text-center">{currentPhoto.caption}</p>
            </div>
          )}
          
          {photos.length > 1 && (
            <div className="flex gap-2 p-4 bg-background overflow-x-auto justify-center">
              {photos.map((photo, idx) => {
                const thumbUrl = photoUrls.get(photo.image_path);
                const isThumbLoading = !thumbUrl;
                
                return (
                  <button
                    key={photo.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all ${
                      idx === currentIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    {isThumbLoading ? (
                      <Skeleton className="w-full h-full" />
                    ) : (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
