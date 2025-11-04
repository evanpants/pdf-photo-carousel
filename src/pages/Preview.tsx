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
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [photosByRegion, setPhotosByRegion] = useState<Record<string, Photo[]>>({});
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [urlCopied, setUrlCopied] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

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
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/editor/${projectId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{project.title}</h1>
              <p className="text-sm text-muted-foreground">Preview Mode</p>
            </div>
          </div>
          <div className="flex gap-2">
            {project.published ? (
              <>
                <Input
                  readOnly
                  value={`${window.location.origin}/view/${project.slug}`}
                  className="w-64 text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyPublicUrl}>
                  {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button onClick={handlePublish}>
                <Globe className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 flex justify-center">
        <Card className="p-4 inline-block">
          <div className="relative inline-block" ref={pdfContainerRef}>
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
        </Card>
      </div>

      <PhotoGalleryModal
        photos={selectedRegion ? photosByRegion[selectedRegion] || [] : []}
        isOpen={selectedRegion !== null}
        onClose={() => setSelectedRegion(null)}
      />
    </div>
  );
}
