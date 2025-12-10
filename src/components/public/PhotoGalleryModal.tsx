import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
}

interface PhotoGalleryModalProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoGalleryModal({ photos, isOpen, onClose }: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  // Load photo URLs through edge function when modal opens
  useEffect(() => {
    if (!isOpen || photos.length === 0) return;

    const loadPhotoUrls = async () => {
      setLoading(true);
      const newUrls = new Map<string, string>();

      for (const photo of photos) {
        try {
          const response = await supabase.functions.invoke('serve-photo', {
            body: { filePath: photo.image_path }
          });

          if (!response.error && response.data) {
            const blob = new Blob([response.data], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            newUrls.set(photo.image_path, url);
          }
        } catch (error) {
          console.error('Error loading photo:', error);
        }
      }

      setPhotoUrls(newUrls);
      setLoading(false);
    };

    loadPhotoUrls();

    // Cleanup blob URLs on unmount
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isOpen, photos]);

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
      // Swipe left - next photo
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
    if (touchEndX.current - touchStartX.current > 75) {
      // Swipe right - previous photo
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const currentPhotoUrl = photoUrls.get(currentPhoto.image_path) || '/placeholder.svg';

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
          <div className="flex-1 flex items-center justify-center bg-muted p-4 md:p-8 overflow-hidden min-h-[300px]">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <img
                src={currentPhotoUrl}
                alt={currentPhoto.caption || 'Gallery image'}
                className="w-full h-auto max-h-[60vh] object-contain"
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
                const thumbUrl = photoUrls.get(photo.image_path) || '/placeholder.svg';
                
                return (
                  <button
                    key={photo.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all ${
                      idx === currentIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
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
