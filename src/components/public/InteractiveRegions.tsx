import { useState } from 'react';

interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InteractiveRegionsProps {
  regions: Region[];
  pdfWidth: number;
  pdfHeight: number;
  onRegionClick: (regionId: string) => void;
  originalPdfWidth?: number; // Original PDF width (default 794)
}

export function InteractiveRegions({ 
  regions, 
  pdfWidth, 
  pdfHeight, 
  onRegionClick,
  originalPdfWidth = 794 
}: InteractiveRegionsProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  
  // Calculate scale factor to convert stored coordinates to display coordinates
  const scaleFactor = pdfWidth / originalPdfWidth;

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: pdfWidth, height: pdfHeight }}
    >
      {regions.map((region) => {
        // Scale the stored coordinates to match current display size
        const scaledX = region.x * scaleFactor;
        const scaledY = region.y * scaleFactor;
        const scaledWidth = region.width * scaleFactor;
        const scaledHeight = region.height * scaleFactor;
        
        return (
          <div
            key={region.id}
            className="absolute pointer-events-auto cursor-pointer transition-all"
            style={{
              left: `${scaledX}px`,
              top: `${scaledY}px`,
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
              backgroundColor: hoveredRegion === region.id ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
              border: hoveredRegion === region.id ? '1px solid rgba(0, 0, 0, 0.3)' : '1px solid transparent',
            }}
            onMouseEnter={() => setHoveredRegion(region.id)}
            onMouseLeave={() => setHoveredRegion(null)}
            onClick={() => onRegionClick(region.id)}
          />
        );
      })}
    </div>
  );
}
