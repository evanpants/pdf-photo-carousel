import { useEffect, useRef, useState } from 'react';

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
}

export function DrawingCanvas({ 
  regions, 
  onRegionsChange, 
  isDrawing,
  pdfWidth,
  pdfHeight
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentRegion, setCurrentRegion] = useState<{ startX: number; startY: number } | null>(null);
  const [tempRegion, setTempRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; regionId: string } | null>(null);

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

  const handleMouseUp = () => {
    if (tempRegion && currentRegion) {
      const newRegion: Region = {
        id: `temp-${Date.now()}`,
        x: tempRegion.x,
        y: tempRegion.y,
        width: tempRegion.width,
        height: tempRegion.height,
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

  const handleRegionDrag = (e: React.MouseEvent) => {
    if (!dragStart || !containerRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const updatedRegions = regions.map(r => {
      if (r.id === dragStart.regionId) {
        return {
          ...r,
          x: Math.max(0, Math.min(pdfWidth - r.width, r.x + deltaX)),
          y: Math.max(0, Math.min(pdfHeight - r.height, r.y + deltaY)),
        };
      }
      return r;
    });
    
    onRegionsChange(updatedRegions);
    setDragStart({ ...dragStart, x: e.clientX, y: e.clientY });
  };

  const handleRegionDragEnd = () => {
    setDragStart(null);
  };

  const handleDeleteRegion = (regionId: string) => {
    onRegionsChange(regions.filter(r => r.id !== regionId));
    setSelectedId(null);
  };

  useEffect(() => {
    if (dragStart) {
      window.addEventListener('mousemove', handleRegionDrag as any);
      window.addEventListener('mouseup', handleRegionDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleRegionDrag as any);
        window.removeEventListener('mouseup', handleRegionDragEnd);
      };
    }
  }, [dragStart]);

  return (
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
      {regions.map((region) => (
        <div
          key={region.id}
          className={`absolute border-2 cursor-move ${
            selectedId === region.id 
              ? 'border-blue-500 bg-blue-500/20' 
              : 'border-blue-400 bg-blue-400/10'
          } hover:border-blue-500 hover:bg-blue-500/20 transition-colors`}
          style={{
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
          }}
          onMouseDown={(e) => handleRegionMouseDown(e, region.id)}
        >
          {selectedId === region.id && (
            <button
              onClick={() => handleDeleteRegion(region.id)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          )}
        </div>
      ))}
      
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
  );
}
