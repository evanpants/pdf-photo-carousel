import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  order_index: number;
}

interface DrawingCanvasProps {
  regions: Region[];
  onRegionsChange: (regions: Region[]) => void;
  isDrawing: boolean;
  pdfWidth: number;
  pdfHeight: number;
  originalPdfWidth?: number; // Original PDF width for coordinate scaling (default 794)
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function DrawingCanvas({ 
  regions, 
  onRegionsChange, 
  isDrawing,
  pdfWidth,
  pdfHeight,
  originalPdfWidth = 794
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentRegion, setCurrentRegion] = useState<{ startX: number; startY: number } | null>(null);
  const [tempRegion, setTempRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; regionId: string } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<{ handle: ResizeHandle; regionId: string; startX: number; startY: number; originalRegion: Region } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const SNAP_THRESHOLD = 10;
  
  // Scale factor: convert display coordinates to stored coordinates (794px base)
  const displayToStored = originalPdfWidth / pdfWidth;
  const storedToDisplay = pdfWidth / originalPdfWidth;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentRegion({ startX: x, startY: y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!currentRegion || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const x = Math.min(currentRegion.startX, currentX);
    const y = Math.min(currentRegion.startY, currentY);
    const width = Math.abs(currentX - currentRegion.startX);
    const height = Math.abs(currentY - currentRegion.startY);
    
    setTempRegion({ x, y, width, height });
  };

  const applySnap = (value: number, targets: number[]) => {
    if (!snapEnabled) return value;
    for (const target of targets) {
      if (Math.abs(value - target) < SNAP_THRESHOLD) {
        return target;
      }
    }
    return value;
  };

  const getSnapTargets = (excludeId?: string) => {
    const targets = {
      x: [0, pdfWidth],
      y: [0, pdfHeight],
      width: [] as number[],
      height: [] as number[],
    };
    
    regions.forEach(r => {
      if (r.id !== excludeId) {
        targets.x.push(r.x, r.x + r.width);
        targets.y.push(r.y, r.y + r.height);
        targets.width.push(r.width);
        targets.height.push(r.height);
      }
    });
    
    return targets;
  };

  const handleMouseUp = () => {
    if (tempRegion && currentRegion) {
      const targets = getSnapTargets();
      const snappedX = applySnap(tempRegion.x, targets.x);
      const snappedY = applySnap(tempRegion.y, targets.y);
      const snappedWidth = applySnap(tempRegion.width, targets.width);
      const snappedHeight = applySnap(tempRegion.height, targets.height);
      
      // Convert display coordinates to stored coordinates (794px base)
      const newRegion: Region = {
        id: `temp-${Date.now()}`,
        x: snappedX * displayToStored,
        y: snappedY * displayToStored,
        width: (snappedWidth || tempRegion.width) * displayToStored,
        height: (snappedHeight || tempRegion.height) * displayToStored,
        page_number: 1,
        order_index: regions.length,
      };
      onRegionsChange([...regions, newRegion]);
    }
    
    setCurrentRegion(null);
    setTempRegion(null);
  };

  const handleRegionMouseDown = (e: React.MouseEvent, regionId: string) => {
    if (isDrawing) return;
    e.stopPropagation();
    
    setSelectedId(regionId);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      regionId,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, regionId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    const region = regions.find(r => r.id === regionId);
    if (!region) return;
    
    setSelectedId(regionId);
    setResizeHandle({
      handle,
      regionId,
      startX: e.clientX,
      startY: e.clientY,
      originalRegion: { ...region }
    });
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!resizeHandle) return;
    
    const deltaX = (e.clientX - resizeHandle.startX) * displayToStored;
    const deltaY = (e.clientY - resizeHandle.startY) * displayToStored;
    const orig = resizeHandle.originalRegion;
    const targets = getSnapTargets(resizeHandle.regionId);
    
    let newRegion = { ...orig };
    
    switch (resizeHandle.handle) {
      case 'nw':
        newRegion.x = orig.x + deltaX;
        newRegion.y = orig.y + deltaY;
        newRegion.width = orig.width - deltaX;
        newRegion.height = orig.height - deltaY;
        break;
      case 'n':
        newRegion.y = orig.y + deltaY;
        newRegion.height = orig.height - deltaY;
        break;
      case 'ne':
        newRegion.y = orig.y + deltaY;
        newRegion.width = orig.width + deltaX;
        newRegion.height = orig.height - deltaY;
        break;
      case 'e':
        newRegion.width = orig.width + deltaX;
        break;
      case 'se':
        newRegion.width = orig.width + deltaX;
        newRegion.height = orig.height + deltaY;
        break;
      case 's':
        newRegion.height = orig.height + deltaY;
        break;
      case 'sw':
        newRegion.x = orig.x + deltaX;
        newRegion.width = orig.width - deltaX;
        newRegion.height = orig.height + deltaY;
        break;
      case 'w':
        newRegion.x = orig.x + deltaX;
        newRegion.width = orig.width - deltaX;
        break;
    }
    
    // Apply snap in display coordinates
    const displayX = newRegion.x * storedToDisplay;
    const displayY = newRegion.y * storedToDisplay;
    newRegion.x = Math.max(0, applySnap(displayX, targets.x) * displayToStored);
    newRegion.y = Math.max(0, applySnap(displayY, targets.y) * displayToStored);
    
    // Calculate right and bottom edges in display coordinates
    const rightEdge = (newRegion.x + newRegion.width) * storedToDisplay;
    const bottomEdge = (newRegion.y + newRegion.height) * storedToDisplay;
    
    // Apply snap to right and bottom edges
    const snappedRight = applySnap(rightEdge, targets.x);
    const snappedBottom = applySnap(bottomEdge, targets.y);
    
    // Adjust width and height based on snapped edges (convert back to stored)
    if (snappedRight !== rightEdge) {
      newRegion.width = snappedRight * displayToStored - newRegion.x;
    }
    if (snappedBottom !== bottomEdge) {
      newRegion.height = snappedBottom * displayToStored - newRegion.y;
    }
    
    // Constrain to PDF boundaries (in stored coordinates)
    newRegion.x = Math.min(originalPdfWidth - 20 * displayToStored, newRegion.x);
    newRegion.y = Math.min(originalPdfWidth * (pdfHeight / pdfWidth) - 20 * displayToStored, newRegion.y);
    newRegion.width = Math.max(20 * displayToStored, Math.min(originalPdfWidth - newRegion.x, newRegion.width));
    newRegion.height = Math.max(20 * displayToStored, Math.min(originalPdfWidth * (pdfHeight / pdfWidth) - newRegion.y, newRegion.height));
    
    const updatedRegions = regions.map(r => r.id === resizeHandle.regionId ? newRegion : r);
    onRegionsChange(updatedRegions);
  };

  const handleRegionDrag = (e: React.MouseEvent) => {
    if (!dragStart || !containerRef.current) return;
    
    const deltaX = (e.clientX - dragStart.x) * displayToStored;
    const deltaY = (e.clientY - dragStart.y) * displayToStored;
    const targets = getSnapTargets(dragStart.regionId);
    
    const updatedRegions = regions.map(r => {
      if (r.id === dragStart.regionId) {
        const newX = r.x + deltaX;
        const newY = r.y + deltaY;
        const displayNewX = newX * storedToDisplay;
        const displayNewY = newY * storedToDisplay;
        return {
          ...r,
          x: Math.max(0, Math.min(originalPdfWidth - r.width, applySnap(displayNewX, targets.x) * displayToStored)),
          y: Math.max(0, Math.min(originalPdfWidth * (pdfHeight / pdfWidth) - r.height, applySnap(displayNewY, targets.y) * displayToStored)),
        };
      }
      return r;
    });
    
    onRegionsChange(updatedRegions);
    setDragStart({ ...dragStart, x: e.clientX, y: e.clientY });
  };

  const handleRegionDragEnd = () => {
    setDragStart(null);
    setResizeHandle(null);
  };

  const handleDeleteRegion = (regionId: string) => {
    onRegionsChange(regions.filter(r => r.id !== regionId));
    setSelectedId(null);
  };

  useEffect(() => {
    if (dragStart || resizeHandle) {
      const moveHandler = resizeHandle ? handleResize : handleRegionDrag;
      window.addEventListener('mousemove', moveHandler as any);
      window.addEventListener('mouseup', handleRegionDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', moveHandler as any);
        window.removeEventListener('mouseup', handleRegionDragEnd);
      };
    }
  }, [dragStart, resizeHandle]);

  const renderResizeHandles = (region: Region) => {
    if (selectedId !== region.id) return null;
    
    const handles: { handle: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
      { handle: 'nw', cursor: 'nwse-resize', style: { top: -4, left: -4 } },
      { handle: 'n', cursor: 'ns-resize', style: { top: -4, left: '50%', transform: 'translateX(-50%)' } },
      { handle: 'ne', cursor: 'nesw-resize', style: { top: -4, right: -4 } },
      { handle: 'e', cursor: 'ew-resize', style: { top: '50%', right: -4, transform: 'translateY(-50%)' } },
      { handle: 'se', cursor: 'nwse-resize', style: { bottom: -4, right: -4 } },
      { handle: 's', cursor: 'ns-resize', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' } },
      { handle: 'sw', cursor: 'nesw-resize', style: { bottom: -4, left: -4 } },
      { handle: 'w', cursor: 'ew-resize', style: { top: '50%', left: -4, transform: 'translateY(-50%)' } },
    ];
    
    return handles.map(({ handle, cursor, style }) => (
      <div
        key={handle}
        className="absolute w-2 h-2 bg-blue-500 border border-white rounded-full hover:scale-150 transition-transform"
        style={{ ...style, cursor }}
        onMouseDown={(e) => handleResizeStart(e, region.id, handle)}
      />
    ));
  };

  return (
    <>
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button
          size="sm"
          variant={snapEnabled ? "default" : "outline"}
          onClick={() => setSnapEnabled(!snapEnabled)}
        >
          Snap: {snapEnabled ? 'ON' : 'OFF'}
        </Button>
      </div>
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ 
          width: pdfWidth,
          height: pdfHeight,
          pointerEvents: isDrawing || regions.length > 0 ? 'auto' : 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Render saved regions */}
        {regions.map((region) => {
          // Scale stored coordinates to display coordinates
          const displayX = region.x * storedToDisplay;
          const displayY = region.y * storedToDisplay;
          const displayWidth = region.width * storedToDisplay;
          const displayHeight = region.height * storedToDisplay;
          
          return (
            <div
              key={region.id}
              className={`absolute border-2 ${
                selectedId === region.id 
                  ? 'border-blue-500 bg-blue-500/20' 
                  : 'border-blue-400 bg-blue-400/10'
              } hover:border-blue-500 hover:bg-blue-500/20 transition-colors`}
              style={{
                left: displayX,
                top: displayY,
                width: displayWidth,
                height: displayHeight,
                cursor: isDrawing ? 'crosshair' : 'move',
              }}
              onMouseDown={(e) => handleRegionMouseDown(e, region.id)}
            >
              {selectedId === region.id && (
                <>
                  <button
                    onClick={() => handleDeleteRegion(region.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                  >
                    ×
                  </button>
                  {renderResizeHandles(region)}
                </>
              )}
            </div>
          );
        })}
        
        {/* Render temporary region while drawing */}
        {tempRegion && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/20"
            style={{
              left: tempRegion.x,
              top: tempRegion.y,
              width: tempRegion.width,
              height: tempRegion.height,
            }}
          />
        )}
      </div>
    </>
  );
}
