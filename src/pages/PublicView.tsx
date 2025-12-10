import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { InteractiveRegions } from '@/components/public/InteractiveRegions';
import { PhotoGalleryModal } from '@/components/public/PhotoGalleryModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePhotoPreloader } from '@/hooks/usePhotoPreloader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
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
  const isMobile = useIsMobile();
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [photosByRegion, setPhotosByRegion] = useState<Record<string, Photo[]>>({});
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(794);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistance = useRef<number>(0);
  const touchStartPan = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef<number>(0);
  const isPinching = useRef(false);

  // Preload photos in background
  const { urls: preloadedUrls, loading: preloadingPhotos, progress: preloadProgress } = usePhotoPreloader(photosByRegion);

  useEffect(() => {
    loadProject();
  }, [slug, projectId]);

  // Calculate responsive PDF width and update dimensions
  useEffect(() => {
    const updatePdfWidth = () => {
      if (typeof window !== 'undefined') {
        const viewportWidth = window.innerWidth;
        let newWidth = 794;
        
        if (viewportWidth < 768) {
          newWidth = Math.min(viewportWidth - 32, 794);
        } else if (viewportWidth < 1024) {
          newWidth = Math.min(viewportWidth * 0.9, 794);
        } else {
          newWidth = 794;
        }
        
        setPdfWidth(newWidth);
        
        // Update pdfDimensions to match new width
        if (pdfDimensions.height > 0 && pdfDimensions.width > 0) {
          const aspectRatio = pdfDimensions.height / pdfDimensions.width;
          setPdfDimensions({
            width: newWidth,
            height: newWidth * aspectRatio
          });
        }
      }
    };

    updatePdfWidth();
    window.addEventListener('resize', updatePdfWidth);
    return () => window.removeEventListener('resize', updatePdfWidth);
  }, [pdfDimensions.width, pdfDimensions.height]);

  // Touch handlers for pinch-to-zoom and pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      touchStartPan.current = {
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance.current) {
      isPinching.current = true;
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = (distance / touchStartDistance.current) * scale;
      const clampedScale = Math.max(0.5, Math.min(3, newScale));
      setScale(clampedScale);
      touchStartDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1 && !isPinching.current) {
      setPanOffset({
        x: e.touches[0].clientX - touchStartPan.current.x,
        y: e.touches[0].clientY - touchStartPan.current.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
      touchStartDistance.current = 0;
    }

    // Double-tap to zoom
    if (e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        const newScale = scale === 1 ? 2 : 1;
        setScale(newScale);
        if (newScale === 1) setPanOffset({ x: 0, y: 0 });
      }
      lastTapTime.current = now;
    }
  };

  const handlePdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTimeout(() => {
      if (pdfContainerRef.current) {
        const pdfElement = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (pdfElement) {
          setPdfDimensions({
            width: pdfElement.offsetWidth,
            height: pdfElement.offsetHeight
          });
        }
      }
    }, 100);
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      // Handle both preview (by projectId) and public view (by slug)
      let query = supabase.from('projects').select('*');
      
      if (slug) {
        query = query.eq('slug', slug).eq('published', true);
      } else if (projectId) {
        query = query.eq('id', projectId);
      }
      
      const { data: projectData, error } = await query.single();

      if (error || !projectData) {
        console.error('Error loading project:', error);
        setLoading(false);
        return;
      }

      setProject(projectData);

      // Load PDF through edge function for secure access
      try {
        const response = await supabase.functions.invoke('serve-pdf', {
          body: { filePath: projectData.pdf_path }
        });

        if (response.error) {
          throw response.error;
        }

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error('Error loading PDF:', err);
      }

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
    }
    } catch (error) {
      console.error('Error in loadProject:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="text-center py-4 md:py-6 px-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{project.title}</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Interactive Resume {isMobile && '• Pinch or double-tap to zoom'}
        </p>
        {preloadingPhotos && (
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading photos ({preloadProgress}%)</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div 
          ref={scrollContainerRef}
          className="flex justify-center items-start p-2 md:p-6 min-h-full -mx-[10px] md:mx-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="relative inline-block border-2 border-border bg-muted/30" 
            ref={pdfContainerRef}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
              transformOrigin: 'top center',
              transition: isPinching.current ? 'none' : 'transform 0.2s ease-out',
            }}
          >
              {pdfUrl && (
                <>
                  <Document 
                    file={pdfUrl}
                    onLoadSuccess={handlePdfLoadSuccess}
                    loading={<div className="p-8">Loading PDF...</div>}
                  >
                    <Page 
                      pageNumber={1} 
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      width={pdfWidth}
                    />
                  </Document>
                  {pdfDimensions.width > 0 && (
                  <InteractiveRegions
                    regions={regions}
                    pdfWidth={pdfDimensions.width}
                    pdfHeight={pdfDimensions.height}
                    onRegionClick={(regionId) => {
                      setScale(1);
                      setPanOffset({ x: 0, y: 0 });
                      setSelectedRegion(regionId);
                    }}
                    originalPdfWidth={794}
                  />
                  )}
                </>
              )}
          </div>
        </div>
      </ScrollArea>

      <PhotoGalleryModal
        photos={selectedRegion ? photosByRegion[selectedRegion] || [] : []}
        preloadedUrls={preloadedUrls}
        isOpen={selectedRegion !== null}
        onClose={() => {
          setSelectedRegion(null);
          setScale(1);
          setPanOffset({ x: 0, y: 0 });
        }}
      />
    </div>
  );
}
