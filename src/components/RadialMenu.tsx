
import React from 'react';
import { clsx } from 'clsx';

interface RadialMenuProps {
  items: string[];
  selectedIndex: number | null;
  isActive: boolean; // e.g. trigger pulled
  label?: string;
  className?: string;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({ items, selectedIndex, isActive, label, className }) => {
  const radius = 100;
  const center = 100;
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
      <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
        {items.map((item, index) => {
          // Start and end angles for this slice
          // We offset by -0.5 slice so index 0 is centered at 0 degrees (which is East in SVG, but we rotated parent by -90 so it's North).
          const startAngle = (index - 0.5) / count;
          const endAngle = (index + 0.5) / count;
          
          const [startX, startY] = getCoordinatesForPercent(startAngle);
          const [endX, endY] = getCoordinatesForPercent(endAngle);
          
          const largeArcFlag = anglePerSlice > 180 ? 1 : 0;
          
          const isSelected = index === selectedIndex;
          
          const pathData = [
            `M ${center} ${center}`,
            `L ${startX} ${startY}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            'Z'
          ].join(' ');

          return (
            <g key={index}>
              <path
                d={pathData}
                fill={isSelected ? (isActive ? '#3b82f6' : '#60a5fa') : '#1e293b'}
                stroke="#0f172a"
                strokeWidth="2"
                className={clsx("transition-colors duration-75", isSelected && "opacity-100", !isSelected && "opacity-50")}
              />
              {/* Text Label */}
              {/* We need to position text at the centroid of the slice */}
              {(() => {
                 const textAngle = index / count; // Centered
                 const textRadius = radius * 0.7;
                 const tx = center + textRadius * Math.cos(2 * Math.PI * textAngle);
                 const ty = center + textRadius * Math.sin(2 * Math.PI * textAngle);
                 
                 return (
                   <text
                     x={tx}
                     y={ty}
                     fill="white"
                     fontSize="14"
                     fontWeight="bold"
                     textAnchor="middle"
                     dominantBaseline="middle"
                     transform={`rotate(90 ${tx} ${ty})`} // Counter-rotate text because parent is rotated -90
                     className="pointer-events-none select-none"
                   >
                     {item}
                   </text>
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
        <span className="text-white font-bold text-sm text-center">{label}</span>
      </div>
    </div>
  );
};

