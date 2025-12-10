import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { PhotoList } from './PhotoList';

interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  order_index: number;
}

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  order_index: number;
}

interface RegionManagerProps {
  projectId: string;
  regions: Region[];
  selectedRegion: string | null;
  onSelectRegion: (id: string | null) => void;
  onRegionsChange: () => void;
}

export function RegionManager({
  projectId,
  regions,
  selectedRegion,
  onSelectRegion,
  onRegionsChange,
}: RegionManagerProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedRegion) {
      loadPhotos();
    }
  }, [selectedRegion]);

  const loadPhotos = async () => {
    if (!selectedRegion) return;

    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('region_id', selectedRegion)
      .order('order_index');

    if (data) setPhotos(data);
  };

  const handleUploadPhotos = async (files: FileList | File[]) => {
    if (!selectedRegion) {
      toast.error('Please select a region first');
      return;
    }

    const fileArray = Array.from(files).slice(0, 5); // Limit to 5 files
    if (fileArray.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        setUploading(false);
        return;
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Validate file type (MIME type + extension)
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!file.type.startsWith('image/') || !validExtensions.includes(fileExtension)) {
          failCount++;
          continue;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          toast.error(`Image "${file.name}" exceeds 5MB limit`);
          failCount++;
          continue;
        }

        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('carousel-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { error: insertError } = await supabase
            .from('photos')
            .insert({
              region_id: selectedRegion,
              image_path: fileName,
              order_index: photos.length + successCount,
            });

          if (insertError) throw insertError;
          successCount++;
        } catch (error) {
          console.error('Upload error:', error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded!`);
        loadPhotos();
      }
      if (failCount > 0) {
        toast.error(`${failCount} photo${failCount > 1 ? 's' : ''} failed to upload`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUploadPhotos(files);
    }
  };

  const handleDeletePhoto = async (id: string, imagePath: string) => {
    try {
      await supabase.storage.from('carousel-photos').remove([imagePath]);
      await supabase.from('photos').delete().eq('id', id);
      toast.success('Photo deleted');
      loadPhotos();
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  const handleUpdateCaption = async (id: string, caption: string) => {
    const { error } = await supabase
      .from('photos')
      .update({ caption })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update caption');
    } else {
      toast.success('Caption updated');
      loadPhotos();
    }
  };

  const handleReorderPhoto = async (photoId: string, direction: 'up' | 'down') => {
    const currentIndex = photos.findIndex(p => p.id === photoId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= photos.length) return;
    
    const reorderedPhotos = [...photos];
    [reorderedPhotos[currentIndex], reorderedPhotos[newIndex]] = [reorderedPhotos[newIndex], reorderedPhotos[currentIndex]];
    
    // Update order_index for all affected photos
    const updates = reorderedPhotos.map((photo, index) => 
      supabase.from('photos').update({ order_index: index }).eq('id', photo.id)
    );
    
    try {
      await Promise.all(updates);
      toast.success('Order updated');
      loadPhotos();
    } catch (error) {
      toast.error('Failed to reorder photos');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo Carousels</CardTitle>
        <CardDescription>
          {regions.length === 0
            ? 'Draw regions on the PDF to add photo carousels'
            : selectedRegion
            ? 'Manage photos for this region'
            : 'Select a region to manage photos'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Regions</Label>
          <div className="space-y-2">
            {regions.map((region, index) => (
              <Button
                key={region.id}
                variant={selectedRegion === region.id ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => onSelectRegion(region.id)}
              >
                Region {index + 1}
              </Button>
            ))}
          </div>
        </div>

        {selectedRegion && (
          <>
            <div className="space-y-2">
              <Label htmlFor="photo-upload">Upload Photos (up to 5)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Drag and drop images here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse (max 5 images)
                    </p>
                  </div>
                  <Input
                    ref={fileInputRef}
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleUploadPhotos(files);
                      }
                    }}
                    disabled={uploading}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Select Files'}
                  </Button>
                </div>
              </div>
            </div>

            <PhotoList
              photos={photos}
              onReorder={handleReorderPhoto}
              onDelete={handleDeletePhoto}
              onUpdateCaption={handleUpdateCaption}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
