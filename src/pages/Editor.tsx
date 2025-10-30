import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Canvas as FabricCanvas, Rect } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, Globe } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { RegionManager } from '@/components/editor/RegionManager';

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
  page_number: number;
  order_index: number;
}

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 612, height: 792 });

  useEffect(() => {
    loadProject();
    loadRegions();
  }, [projectId]);

  const handlePdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    
    // Get the actual rendered PDF dimensions
    setTimeout(() => {
      if (pdfContainerRef.current) {
        const pdfElement = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (pdfElement) {
          setPdfDimensions({
            width: pdfElement.width,
            height: pdfElement.height
          });
        }
      }
    }, 100);
  };

  useEffect(() => {
    if (!canvasRef.current || fabricCanvas || !pdfDimensions.width) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      selection: true,
      backgroundColor: 'transparent',
      width: pdfDimensions.width,
      height: pdfDimensions.height,
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [pdfDimensions]);

  const loadProject = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      toast.error('Project not found');
      navigate('/projects');
      return;
    }

    setProject(data);

    const { data: { publicUrl } } = supabase.storage
      .from('resume-pdfs')
      .getPublicUrl(data.pdf_path);

    setPdfUrl(publicUrl);
  };

  const loadRegions = async () => {
    const { data } = await supabase
      .from('regions')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index');

    if (data) setRegions(data);
  };

  const handleDrawRegion = () => {
    if (!fabricCanvas) return;

    setIsDrawing(!isDrawing);

    if (!isDrawing) {
      const rect = new Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 150,
        fill: 'rgba(59, 130, 246, 0.3)',
        stroke: 'rgba(59, 130, 246, 1)',
        strokeWidth: 2,
      });

      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      fabricCanvas.renderAll();
    }
  };

  const handleSaveRegions = async () => {
    if (!fabricCanvas) return;

    const objects = fabricCanvas.getObjects();
    const newRegions = objects.map((obj, index) => ({
      project_id: projectId!,
      x: obj.left || 0,
      y: obj.top || 0,
      width: obj.width || 0,
      height: obj.height || 0,
      page_number: 1,
      order_index: index,
    }));

    // Delete existing regions
    await supabase.from('regions').delete().eq('project_id', projectId);

    // Insert new regions
    const { error } = await supabase.from('regions').insert(newRegions);

    if (error) {
      toast.error('Failed to save regions');
    } else {
      toast.success('Regions saved successfully!');
      loadRegions();
    }
  };

  const handlePublish = async () => {
    const newPublishedState = !project?.published;
    
    const { error } = await supabase
      .from('projects')
      .update({ published: newPublishedState })
      .eq('id', projectId);

    if (error) {
      toast.error('Failed to update project');
    } else {
      if (newPublishedState) {
        const publicUrl = `${window.location.origin}/view/${project?.slug}`;
        
        // Open in new tab
        window.open(publicUrl, '_blank');
        
        // Show success message with copy button
        toast.success(
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Project published successfully!</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                {publicUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success('URL copied to clipboard!');
                }}
              >
                Copy
              </Button>
            </div>
          </div>,
          { duration: 10000 }
        );
      } else {
        toast.success('Project unpublished');
      }
      loadProject();
    }
  };

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{project.title}</h1>
              <p className="text-sm text-muted-foreground">
                {project.published ? 'Published' : 'Draft'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDrawRegion}>
              {isDrawing ? 'Stop Drawing' : 'Draw Region'}
            </Button>
            <Button variant="outline" onClick={handleSaveRegions}>
              <Save className="mr-2 h-4 w-4" />
              Save Regions
            </Button>
            <Button variant="outline" onClick={() => navigate(`/preview/${project.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handlePublish}>
              <Globe className="mr-2 h-4 w-4" />
              {project.published ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2">
          <Card className="p-4">
            <div className="relative inline-block" ref={pdfContainerRef}>
              {pdfUrl && (
                <Document 
                  file={pdfUrl} 
                  onLoadSuccess={handlePdfLoadSuccess}
                  loading={<div className="p-8">Loading PDF...</div>}
                >
                  <Page 
                    pageNumber={1} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={pdfDimensions.width}
                  />
                </Document>
              )}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 pointer-events-auto"
                style={{ zIndex: 10 }}
              />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <RegionManager
            projectId={projectId!}
            regions={regions}
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
            onRegionsChange={loadRegions}
          />
        </div>
      </div>
    </div>
  );
}
