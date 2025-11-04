import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
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

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

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

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const { data: { publicUrl } } = supabase.storage
    .from('carousel-photos')
    .getPublicUrl(currentPhoto.image_path);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center bg-muted p-8">
            <img
              src={publicUrl}
              alt={currentPhoto.caption || 'Gallery image'}
              className="max-w-full max-h-[60vh] object-contain"
            />
          </div>
          
          {currentPhoto.caption && (
            <div className="px-8 py-4 bg-background">
              <p className="text-sm text-muted-foreground text-center">{currentPhoto.caption}</p>
            </div>
          )}
          
          {photos.length > 1 && (
            <div className="flex gap-2 p-4 bg-background overflow-x-auto justify-center">
              {photos.map((photo, idx) => {
                const { data: { publicUrl: thumbUrl } } = supabase.storage
                  .from('carousel-photos')
                  .getPublicUrl(photo.image_path);
                
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
