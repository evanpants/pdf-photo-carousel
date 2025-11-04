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
}

export function InteractiveRegions({ regions, pdfWidth, pdfHeight, onRegionClick }: InteractiveRegionsProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: pdfWidth, height: pdfHeight }}
    >
      {regions.map((region) => (
        <div
          key={region.id}
          className="absolute pointer-events-auto cursor-pointer transition-all"
          style={{
            left: `${region.x}px`,
            top: `${region.y}px`,
            width: `${region.width}px`,
            height: `${region.height}px`,
            backgroundColor: hoveredRegion === region.id ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
            border: hoveredRegion === region.id ? '1px solid rgba(0, 0, 0, 0.3)' : '1px solid transparent',
          }}
          onMouseEnter={() => setHoveredRegion(region.id)}
          onMouseLeave={() => setHoveredRegion(null)}
          onClick={() => onRegionClick(region.id)}
        />
      ))}
    </div>
  );
}
