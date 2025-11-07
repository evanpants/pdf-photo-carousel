import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InteractiveRegions } from '@/components/public/InteractiveRegions';
import { PhotoGalleryModal } from '@/components/public/PhotoGalleryModal';
import { ArrowLeft, Globe, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Project {
  id: string;
  title: string;
  pdf_path: string;
  published: boolean;
  slug: string;
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

export default function Preview() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [photosByRegion, setPhotosByRegion] = useState<Record<string, Photo[]>>({});
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [urlCopied, setUrlCopied] = useState(false);
  const [scale, setScale] = useState(1);
  const [pdfWidth, setPdfWidth] = useState(794);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistance = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    loadProject();
  }, [projectId]);

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

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistance.current = distance;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance.current) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = (distance / touchStartDistance.current) * scale;
      setScale(Math.max(0.5, Math.min(3, newScale)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDistance.current = 0;
    }

    // Double-tap to zoom
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      setScale(prev => prev === 1 ? 2 : 1);
    }
    lastTapTime.current = now;
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
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

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
    }
  };

  const handlePublish = async () => {
    const { error } = await supabase
      .from('projects')
      .update({ published: true })
      .eq('id', projectId);

    if (error) {
      toast.error('Failed to publish project');
      return;
    }

    const publicUrl = `${window.location.origin}/view/${project?.slug}`;
    navigator.clipboard.writeText(publicUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
    
    window.open(publicUrl, '_blank');
    toast.success('Published! URL copied to clipboard');
    
    setProject(prev => prev ? { ...prev, published: true } : null);
  };

  const copyPublicUrl = () => {
    const publicUrl = `${window.location.origin}/view/${project?.slug}`;
    navigator.clipboard.writeText(publicUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
    toast.success('URL copied!');
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card p-2 md:p-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/editor/${projectId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold truncate">{project.title}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Preview {isMobile && '• Pinch/double-tap to zoom'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {project.published ? (
              <>
                <Input
                  readOnly
                  value={`${window.location.origin}/view/${project.slug}`}
                  className="w-32 md:w-64 text-xs md:text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyPublicUrl}>
                  {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button size={isMobile ? "sm" : "default"} onClick={handlePublish}>
                <Globe className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Publish</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div 
          ref={scrollContainerRef}
          className="flex justify-center items-start p-2 md:p-6 min-h-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="relative inline-block border-2 border-border bg-muted/30 touch-pan-x touch-pan-y" 
            ref={pdfContainerRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease-out',
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
                      onRegionClick={setSelectedRegion}
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
        isOpen={selectedRegion !== null}
        onClose={() => setSelectedRegion(null)}
      />
    </div>
  );
}
