import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Image as ImageIcon, MoveUp, MoveDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  order_index: number;
}

interface PhotoListProps {
  photos: Photo[];
  onReorder: (photoId: string, direction: 'up' | 'down') => void;
  onDelete: (photoId: string, imagePath: string) => void;
  onUpdateCaption: (photoId: string, caption: string) => void;
}

export function PhotoList({ photos, onReorder, onDelete, onUpdateCaption }: PhotoListProps) {
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (photos.length === 0) {
      setPhotoUrls(new Map());
      return;
    }

    const loadPhotoUrls = async () => {
      setLoading(true);
      const newUrls = new Map<string, string>();

      for (const photo of photos) {
        // Skip if already loaded
        if (photoUrls.has(photo.image_path)) {
          newUrls.set(photo.image_path, photoUrls.get(photo.image_path)!);
          continue;
        }

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
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="space-y-3">
        <Label>Photos (0)</Label>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
          <p className="text-xs text-muted-foreground">Upload images for this region</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Photos ({photos.length})</Label>
      {loading && photos.length > 0 && photoUrls.size === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {photos.map((photo, index) => {
        const photoUrl = photoUrls.get(photo.image_path) || '/placeholder.svg';

        return (
          <div key={photo.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === 0}
                  onClick={() => onReorder(photo.id, 'up')}
                >
                  <MoveUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === photos.length - 1}
                  onClick={() => onReorder(photo.id, 'down')}
                >
                  <MoveDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 space-y-2">
                <div className="relative aspect-video rounded overflow-hidden bg-muted">
                  <img
                    src={photoUrl}
                    alt="Carousel"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => onDelete(photo.id, photo.image_path)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Add caption..."
                  defaultValue={photo.caption || ''}
                  onBlur={(e) => onUpdateCaption(photo.id, e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
