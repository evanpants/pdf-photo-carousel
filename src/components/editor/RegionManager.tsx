import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

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

  const handleUploadPhoto = async (file: File) => {
    if (!selectedRegion) {
      toast.error('Please select a region first');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('carousel-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          region_id: selectedRegion,
          image_path: fileName,
          order_index: photos.length,
        });

      if (insertError) throw insertError;

      toast.success('Photo uploaded!');
      loadPhotos();
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
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
              <Label htmlFor="photo-upload">Upload Photos</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadPhoto(file);
                  }}
                  disabled={uploading}
                />
                <Button size="icon" disabled={uploading}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Photos ({photos.length})</Label>
              {photos.map((photo) => {
                const { data: { publicUrl } } = supabase.storage
                  .from('carousel-photos')
                  .getPublicUrl(photo.image_path);

                return (
                  <div key={photo.id} className="border rounded-lg p-3 space-y-2">
                    <div className="relative aspect-video rounded overflow-hidden bg-muted">
                      <img
                        src={publicUrl}
                        alt="Carousel"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleDeletePhoto(photo.id, photo.image_path)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Add caption..."
                      defaultValue={photo.caption || ''}
                      onBlur={(e) => handleUpdateCaption(photo.id, e.target.value)}
                    />
                  </div>
                );
              })}
              {photos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No photos yet</p>
                  <p className="text-xs text-muted-foreground">Upload images for this region</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
