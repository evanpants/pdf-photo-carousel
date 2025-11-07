import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, Globe, Copy, Check, Upload } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { RegionManager } from '@/components/editor/RegionManager';
import { DrawingCanvas } from '@/components/editor/DrawingCanvas';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const isMobile = useIsMobile();
  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isReplacingPdf, setIsReplacingPdf] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(794);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProject();
    loadRegions();
  }, [projectId]);

  // Calculate responsive PDF width
  useEffect(() => {
    const updatePdfWidth = () => {
      if (typeof window !== 'undefined') {
        const viewportWidth = window.innerWidth;
        if (viewportWidth < 768) {
          // Mobile: use 95% of viewport width with some padding
          setPdfWidth(Math.min(viewportWidth - 32, 794));
        } else if (viewportWidth < 1024) {
          // Tablet: fit within container
          setPdfWidth(Math.min(viewportWidth * 0.55, 794));
        } else {
          // Desktop: use standard size
          setPdfWidth(794);
        }
      }
    };

    updatePdfWidth();
    window.addEventListener('resize', updatePdfWidth);
    return () => window.removeEventListener('resize', updatePdfWidth);
  }, []);

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

  const handleReplacePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    if (!file.type.includes('pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsReplacingPdf(true);

    try {
      // Upload new PDF to storage with a unique name
      const fileExt = 'pdf';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${project.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resume-pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Delete old PDF from storage
      const oldPath = project.pdf_path;
      await supabase.storage
        .from('resume-pdfs')
        .remove([oldPath]);

      // Update project with new pdf_path
      const { error: updateError } = await supabase
        .from('projects')
        .update({ pdf_path: filePath })
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Update local state and reload PDF
      setProject({ ...project, pdf_path: filePath });
      
      const { data: { publicUrl } } = supabase.storage
        .from('resume-pdfs')
        .getPublicUrl(filePath);
      
      setPdfUrl(publicUrl);
      
      toast.success('PDF replaced successfully! Your regions and photos are unchanged.');
    } catch (error) {
      console.error('Error replacing PDF:', error);
      toast.error('Failed to replace PDF');
    } finally {
      setIsReplacingPdf(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card p-2 md:p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">{project.title}</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {project.published ? 'Published' : 'Draft'}
                </p>
              </div>
            </div>
            <div className="flex gap-1 md:gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleReplacePdf}
                className="hidden"
              />
              {!isMobile && (
                <Button 
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReplacingPdf}
                >
                  <Upload className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{isReplacingPdf ? 'Replacing...' : 'Replace PDF'}</span>
                </Button>
              )}
              <Button 
                variant={isDrawing ? "default" : "outline"}
                size={isMobile ? "sm" : "default"}
                onClick={() => setIsDrawing(!isDrawing)}
              >
                <span className="text-xs md:text-sm">{isDrawing ? 'Stop' : 'Draw'}</span>
              </Button>
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "default"}
                onClick={handleSaveRegions}
              >
                <Save className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Save</span>
              </Button>
              {!isMobile && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/preview/${project.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              )}
              <Button size={isMobile ? "sm" : "default"} onClick={handlePublish}>
                <Globe className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">
                  {project?.published && !hasUnsavedChanges ? 'Unpublish' : 'Publish'}
                </span>
              </Button>
            </div>
          </div>
          {project?.published && !hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/view/${project?.slug}`}
                className="flex-1 text-xs md:text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyPublicUrl}>
                {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 p-2 md:p-6 max-w-7xl mx-auto">
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
                          width={pdfWidth}
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
        </ScrollArea>
      </div>
    </div>
  );
}
