
import React from 'react';
import { clsx } from 'clsx';

export interface RadialMenuItem {
  main: string;
  sub?: string;
}

interface RadialMenuProps {
  items: (string | RadialMenuItem)[];
  selectedIndex: number | null;
  previewIndex?: number | null;
  secondaryIndices?: number[]; // Indices to highlight subtly (e.g. notes in active chord)
  isActive: boolean; // e.g. trigger pulled
  color?: 'blue' | 'purple';
  label?: React.ReactNode;
  className?: string;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({ 
  items, 
  selectedIndex, 
  previewIndex, 
  secondaryIndices = [], 
  isActive, 
  color = 'blue', 
  label, 
  className 
}) => {
  const radius = 100;
  const center = 110; // Center shifted to accommodate stroke width
  const viewBoxSize = 220; // Increased from 200 to prevent clipping
  const count = items.length;
  const anglePerSlice = 360 / count;
  
  // Helper to calculate coordinates
  // SVG 0 is East. We want 0 (first slice) to be centered at Top? 
  // Or starts at Top?
  // Usually Radial menus have the first item at top.
  // So Item 0 is at -90 deg (North).
  // But if we want Item 0 to be centered at North, it should span -90 +/- half_slice.
  
  // Let's say we want Item 0 to be at 12 o'clock.
  // Start angle = -90 - anglePerSlice/2
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = center + radius * Math.cos(2 * Math.PI * percent);
    const y = center + radius * Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className={clsx("relative w-64 h-64", className)}>
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="w-full h-full transform -rotate-90 overflow-visible">
        {items.map((item, index) => {
          // Handle string vs object items
          const mainLabel = typeof item === 'string' ? item : item.main;
          const subLabel = typeof item === 'string' ? undefined : item.sub;

          // Start and end angles for this slice
          // We offset by -0.5 slice so index 0 is centered at 0 degrees (which is East in SVG, but we rotated parent by -90 so it's North).
          const startAngle = (index - 0.5) / count;
          const endAngle = (index + 0.5) / count;
          
          const [startX, startY] = getCoordinatesForPercent(startAngle);
          const [endX, endY] = getCoordinatesForPercent(endAngle);
          
          const largeArcFlag = anglePerSlice > 180 ? 1 : 0;
          
          const isSelected = index === selectedIndex;
          const isPreview = index === previewIndex && !isSelected;
          const isSecondary = secondaryIndices.includes(index) && !isSelected;
          
          const pathData = [
            `M ${center} ${center}`,
            `L ${startX} ${startY}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            'Z'
          ].join(' ');

          const getFillColor = () => {
            if (isSelected) {
              if (isActive) return color === 'blue' ? '#3b82f6' : '#a855f7'; // Active (Bright)
              return color === 'blue' ? '#60a5fa' : '#c084fc'; // Selected (Dim)
            }
            if (isSecondary) {
               // Use the same purple as the active state but rely on opacity to make it subtle
               return '#a855f7'; // purple-500
            }
            if (isPreview) return '#334155';
            return '#1e293b';
          };
          
          const getStrokeColor = () => {
             return '#0f172a';
          };
          
          const getOpacity = () => {
             if (isSelected) return "opacity-100";
             if (isSecondary) return "opacity-25"; // Very subtle but distinctly purple
             if (isPreview) return "opacity-80";
             return "opacity-50";
          };

          return (
            <g key={index}>
              <path
                d={pathData}
                fill={getFillColor()}
                stroke={getStrokeColor()}
                strokeWidth="2"
                className={clsx("transition-colors duration-75", getOpacity())}
              />
              {/* Text Label */}
              {/* We need to position text at the centroid of the slice */}
              {(() => {
                 const textAngle = index / count; // Centered
                 const textRadius = radius * 0.65;
                 const tx = center + textRadius * Math.cos(2 * Math.PI * textAngle);
                 const ty = center + textRadius * Math.sin(2 * Math.PI * textAngle);
                 
                 return (
                   <g transform={`rotate(90 ${tx} ${ty})`}>
                     <text
                       x={tx}
                       y={subLabel ? ty - 6 : ty}
                       fill="white"
                       fontSize="18"
                       fontWeight="bold"
                       textAnchor="middle"
                       dominantBaseline="middle"
                       className="pointer-events-none select-none"
                     >
                       {mainLabel}
                     </text>
                     {subLabel && (
                       <text
                         x={tx}
                         y={ty + 10}
                         fill="rgba(255,255,255,0.6)"
                         fontSize="10"
                         fontWeight="normal"
                         textAnchor="middle"
                         dominantBaseline="middle"
                         className="pointer-events-none select-none font-mono"
                       >
                         {subLabel}
                       </text>
                     )}
                   </g>
                 );
              })()}
            </g>
          );
        })}
        
        {/* Inner Circle for Label */}
        <circle cx={center} cy={center} r={30} fill="#0f172a" />
      </svg>
      
      {/* Center Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {typeof label === 'string' ? (
          <span className="text-white font-bold text-sm text-center">{label}</span>
        ) : (
          label
        )}
      </div>
    </div>
  );
};

