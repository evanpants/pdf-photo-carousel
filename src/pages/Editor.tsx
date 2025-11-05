import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, Globe, Copy, Check } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { RegionManager } from '@/components/editor/RegionManager';
import { DrawingCanvas } from '@/components/editor/DrawingCanvas';

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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
            width: pdfElement.offsetWidth,
            height: pdfElement.offsetHeight
          });
        }
      }
    }, 100);
  };

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

  const handleSaveRegions = async () => {
    if (regions.length === 0) {
      toast.error('No regions to save');
      return;
    }

    // Get existing regions from database
    const { data: existingRegions } = await supabase
      .from('regions')
      .select('*')
      .eq('project_id', projectId);

    const existingRegionsMap = new Map(existingRegions?.map(r => [r.id, r]) || []);
    
    // Separate regions into updates and inserts
    const regionsToUpdate = regions.filter(r => !r.id.startsWith('temp-') && existingRegionsMap.has(r.id));
    const regionsToInsert = regions.filter(r => r.id.startsWith('temp-') || !existingRegionsMap.has(r.id));
    
    // Update existing regions to preserve their IDs and associated photos
    for (const region of regionsToUpdate) {
      await supabase
        .from('regions')
        .update({
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          order_index: region.order_index,
        })
        .eq('id', region.id);
    }

    // Insert new regions
    if (regionsToInsert.length > 0) {
      const newRegions = regionsToInsert.map((region, index) => ({
        project_id: projectId!,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        page_number: 1,
        order_index: regionsToUpdate.length + index,
      }));

      await supabase.from('regions').insert(newRegions);
    }
    
    // Delete regions that were removed
    const currentRegionIds = regions.filter(r => !r.id.startsWith('temp-')).map(r => r.id);
    const regionsToDelete = existingRegions?.filter(r => !currentRegionIds.includes(r.id)) || [];
    
    for (const region of regionsToDelete) {
      await supabase.from('regions').delete().eq('id', region.id);
    }

    toast.success('Regions saved successfully!');
    setHasUnsavedChanges(false);
    loadRegions();
  };

  // Track changes to regions
  useEffect(() => {
    if (project?.published) {
      setHasUnsavedChanges(true);
    }
  }, [regions]);

  const handlePublish = async () => {
    const newPublishedState = hasUnsavedChanges ? true : !project?.published;
    
    const { error } = await supabase
      .from('projects')
      .update({ published: newPublishedState })
      .eq('id', projectId);

    if (error) {
      toast.error('Failed to update project');
      return;
    }

    // Update local state immediately
    setProject(prev => prev ? { ...prev, published: newPublishedState } : null);
    setHasUnsavedChanges(false);

    if (newPublishedState) {
      const publicUrl = `${window.location.origin}/view/${project?.slug}`;
      
      // Copy to clipboard automatically
      navigator.clipboard.writeText(publicUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
      
      // Open in new tab
      window.open(publicUrl, '_blank');
      
      toast.success('Published! URL copied to clipboard');
    } else {
      toast.success('Project unpublished');
    }
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
            <Button 
              variant={isDrawing ? "default" : "outline"} 
              onClick={() => setIsDrawing(!isDrawing)}
            >
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
              {project?.published && !hasUnsavedChanges ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>
        {project?.published && !hasUnsavedChanges && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex items-center gap-2">
            <Input
              readOnly
              value={`${window.location.origin}/view/${project?.slug}`}
              className="flex-1 text-sm"
            />
            <Button variant="outline" size="icon" onClick={copyPublicUrl}>
              {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2 flex justify-center">
          <div className="relative inline-block border-2 border-border bg-muted/30" ref={pdfContainerRef}>
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
                      width={Math.min(window.innerWidth * 0.6, 794)}
                    />
                  </Document>
                  {pdfDimensions.width > 0 && (
                    <DrawingCanvas
                      regions={regions}
                      onRegionsChange={setRegions}
                      isDrawing={isDrawing}
                      pdfWidth={pdfDimensions.width}
                      pdfHeight={pdfDimensions.height}
                    />
                  )}
                </>
              )}
          </div>
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
