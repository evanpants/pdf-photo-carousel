import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { InteractiveRegions } from '@/components/public/InteractiveRegions';
import { PhotoGalleryModal } from '@/components/public/PhotoGalleryModal';
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
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProject();
  }, [slug, projectId]);

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
    }
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
        <p className="text-muted-foreground">Interactive Resume</p>
      </div>

      <div className="flex-1 flex justify-center items-start">
        <div className="relative w-full max-w-[210mm]" ref={pdfContainerRef}>
            {pdfUrl && (
              <>
                <Document 
                  file={pdfUrl}
                  onLoadSuccess={handlePdfLoadSuccess}
                  loading={<div className="p-8">Loading PDF...</div>}
                  className="w-full"
                >
                  <Page 
                    pageNumber={1} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={Math.min(window.innerWidth - 32, 794)}
                    className="!w-full"
                  />
                </Document>
                {pdfDimensions.width > 0 && (
                  <InteractiveRegions
                    regions={regions}
                    pdfWidth={pdfDimensions.width}
                    pdfHeight={pdfDimensions.height}
                    onRegionClick={setSelectedRegion}
                  />
                )}
              </>
            )}
        </div>
      </div>

      <PhotoGalleryModal
        photos={selectedRegion ? photosByRegion[selectedRegion] || [] : []}
        isOpen={selectedRegion !== null}
        onClose={() => setSelectedRegion(null)}
      />
    </div>
  );
}
