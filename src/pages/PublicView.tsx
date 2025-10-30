import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Project {
  id: string;
  title: string;
  pdf_path: string;
}

interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  order_index: number;
}

export default function PublicView() {
  const { slug, projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [photosByRegion, setPhotosByRegion] = useState<Record<string, Photo[]>>({});
  const [activeCarousel, setActiveCarousel] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProject();
  }, [slug, projectId]);

  const loadProject = async () => {
    // Handle both preview (by projectId) and public view (by slug)
    let query = supabase.from('projects').select('*');
    
    if (slug) {
      query = query.eq('slug', slug).eq('published', true);
    } else if (projectId) {
      query = query.eq('id', projectId);
    }
    
    const { data: projectData } = await query.single();

    if (!projectData) return;

    setProject(projectData);

    const { data: { publicUrl } } = supabase.storage
      .from('resume-pdfs')
      .getPublicUrl(projectData.pdf_path);

    setPdfUrl(publicUrl);

    // Load regions
    const { data: regionsData } = await supabase
      .from('regions')
      .select('*')
      .eq('project_id', projectData.id)
      .order('order_index');

    if (regionsData) {
      setRegions(regionsData);

      // Load photos for each region
      const photosMap: Record<string, Photo[]> = {};
      for (const region of regionsData) {
        const { data: photos } = await supabase
          .from('photos')
          .select('*')
          .eq('region_id', region.id)
          .order('order_index');

        if (photos) {
          photosMap[region.id] = photos;
        }
      }
      setPhotosByRegion(photosMap);

      // Initialize active carousel indices
      const initialActive: Record<string, number> = {};
      regionsData.forEach(region => {
        initialActive[region.id] = 0;
      });
      setActiveCarousel(initialActive);
    }
  };

  const nextPhoto = (regionId: string) => {
    const photos = photosByRegion[regionId] || [];
    setActiveCarousel(prev => ({
      ...prev,
      [regionId]: (prev[regionId] + 1) % photos.length,
    }));
  };

  const prevPhoto = (regionId: string) => {
    const photos = photosByRegion[regionId] || [];
    setActiveCarousel(prev => ({
      ...prev,
      [regionId]: (prev[regionId] - 1 + photos.length) % photos.length,
    }));
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
          <p className="text-muted-foreground">Interactive Resume</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-4">
            {pdfUrl && (
              <Document 
                file={pdfUrl}
                loading={<div className="p-8">Loading PDF...</div>}
              >
                <Page 
                  pageNumber={1} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            )}
          </Card>

          <div className="space-y-4">
            {regions.map((region, index) => {
              const photos = photosByRegion[region.id] || [];
              const currentIndex = activeCarousel[region.id] || 0;
              const currentPhoto = photos[currentIndex];

              if (photos.length === 0) return null;

              const { data: { publicUrl } } = supabase.storage
                .from('carousel-photos')
                .getPublicUrl(currentPhoto.image_path);

              return (
                <Card key={region.id} className="p-4">
                  <h3 className="text-lg font-semibold mb-3">Gallery {index + 1}</h3>
                  <div className="relative aspect-video rounded overflow-hidden bg-muted mb-3">
                    <img
                      src={publicUrl}
                      alt="Portfolio"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {currentPhoto.caption && (
                    <p className="text-sm text-muted-foreground mb-3">{currentPhoto.caption}</p>
                  )}
                  {photos.length > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => prevPhoto(region.id)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentIndex + 1} / {photos.length}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => nextPhoto(region.id)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
