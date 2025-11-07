import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu, Upload, Save, Eye, Globe } from 'lucide-react';

interface MobileNavMenuProps {
  isDrawing: boolean;
  onToggleDrawing: () => void;
  onSaveRegions: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onReplacePdf: () => void;
  published: boolean;
  hasUnsavedChanges: boolean;
  isReplacingPdf: boolean;
}

export function MobileNavMenu({
  isDrawing,
  onToggleDrawing,
  onSaveRegions,
  onPreview,
  onPublish,
  onReplacePdf,
  published,
  hasUnsavedChanges,
  isReplacingPdf,
}: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-64">
        <SheetHeader>
          <SheetTitle>Actions</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleAction(onReplacePdf)}
            disabled={isReplacingPdf}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isReplacingPdf ? 'Replacing...' : 'Replace PDF'}
          </Button>
          
          <Button
            variant={isDrawing ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => handleAction(onToggleDrawing)}
          >
            {isDrawing ? 'Stop Drawing' : 'Draw Region'}
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleAction(onSaveRegions)}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Regions
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleAction(onPreview)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
          <Button
            className="w-full justify-start"
            onClick={() => handleAction(onPublish)}
          >
            <Globe className="h-4 w-4 mr-2" />
            {published && !hasUnsavedChanges ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
