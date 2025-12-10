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
import { MobileNavMenu } from '@/components/editor/MobileNavMenu';

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

  // Calculate responsive PDF width and update dimensions
  useEffect(() => {
    const updatePdfWidth = () => {
      if (typeof window !== 'undefined') {
        const viewportWidth = window.innerWidth;
        let newWidth = 794;
        
        if (viewportWidth < 768) {
          newWidth = Math.min(viewportWidth - 32, 794);
        } else if (viewportWidth < 1024) {
          newWidth = Math.min(viewportWidth * 0.55, 794);
        } else {
          newWidth = 794;
        }
        
        setPdfWidth(newWidth);
        
        // Update pdfDimensions immediately to match new width
        // Height will be proportional based on PDF aspect ratio
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

    // Load PDF through edge function for secure access
    try {
      const response = await supabase.functions.invoke('serve-pdf', {
        body: { filePath: data.pdf_path }
      });

      if (response.error) {
        throw response.error;
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Error loading PDF:', err);
      toast.error('Failed to load PDF');
    }
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

    // Validate file type (MIME type + extension)
    const validExtensions = ['.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!file.type.includes('pdf') || !validExtensions.includes(fileExtension)) {
      toast.error('Please upload a valid PDF file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('PDF file must be less than 10MB');
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
      
      // Load new PDF through edge function
      const response = await supabase.functions.invoke('serve-pdf', {
        body: { filePath }
      });

      if (response.error) {
        throw response.error;
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      
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
              {isMobile ? (
                <MobileNavMenu
                  isDrawing={isDrawing}
                  onToggleDrawing={() => setIsDrawing(!isDrawing)}
                  onSaveRegions={handleSaveRegions}
                  onPreview={() => navigate(`/preview/${project.id}`)}
                  onPublish={handlePublish}
                  onReplacePdf={() => fileInputRef.current?.click()}
                  published={project.published}
                  hasUnsavedChanges={hasUnsavedChanges}
                  isReplacingPdf={isReplacingPdf}
                />
              ) : (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isReplacingPdf}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isReplacingPdf ? 'Replacing...' : 'Replace PDF'}
                  </Button>
                  <Button 
                    variant={isDrawing ? "default" : "outline"}
                    onClick={() => setIsDrawing(!isDrawing)}
                  >
                    {isDrawing ? 'Stop Drawing' : 'Draw Region'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleSaveRegions}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/preview/${project.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button onClick={handlePublish}>
                    <Globe className="mr-2 h-4 w-4" />
                    {project?.published && !hasUnsavedChanges ? 'Unpublish' : 'Publish'}
                  </Button>
                </>
              )}
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
                          originalPdfWidth={794}
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
