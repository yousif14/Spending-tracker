import { useMemo, useState } from 'react';
import { Summary } from '@/types';
import { formatBHD } from '@/lib/mockData';

interface CategoryChartProps {
  data: Summary['totalsByCategory'];
}

interface BubbleData {
  category: string;
  amount: number;
  color: string;
  radius: number;
  x: number;
  y: number;
}

export function CategoryChart({ data }: CategoryChartProps) {
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  // Process data into positioned bubbles
  const bubbles = useMemo(() => {
    if (data.length === 0) return [];

    // Calculate radii based on amounts (using square root for better visual proportion)
    const maxAmount = Math.max(...data.map(d => d.amount));
    const minRadius = 25;
    const maxRadius = 80;

    const bubblesWithRadius = data.map(item => ({
      ...item,
      radius: minRadius + (maxRadius - minRadius) * Math.sqrt(item.amount / maxAmount),
    }));

    // Deterministic circle-packing algorithm
    const width = 400;
    const height = 320;
    const positioned: BubbleData[] = [];
    const padding = 5; // Spacing between bubbles

    // Sort by size (largest first) for better packing
    const sorted = [...bubblesWithRadius].sort((a, b) => b.radius - a.radius);

    // Helper function to check if a position is valid (no overlaps)
    const isValidPosition = (x: number, y: number, radius: number): boolean => {
      return positioned.every(other => {
        const dx = x - other.x;
        const dy = y - other.y;
        const minDist = radius + other.radius + padding;
        return Math.sqrt(dx * dx + dy * dy) >= minDist;
      });
    };

    // Helper function to find the closest valid position to a target
    const findClosestPosition = (targetX: number, targetY: number, radius: number): { x: number; y: number } | null => {
      // Try the target position first
      if (isValidPosition(targetX, targetY, radius)) {
        return { x: targetX, y: targetY };
      }

      // Search in expanding circles around the target
      const searchRadius = 10;
      const maxSearchDistance = Math.max(width, height);

      for (let distance = searchRadius; distance <= maxSearchDistance; distance += searchRadius) {
        // Try 16 points around the circle at this distance
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * 2 * Math.PI;
          const x = targetX + distance * Math.cos(angle);
          const y = targetY + distance * Math.sin(angle);

          if (isValidPosition(x, y, radius)) {
            return { x, y };
          }
        }
      }

      return null;
    };

    // Pack bubbles from largest to smallest
    sorted.forEach((bubble, index) => {
      let position: { x: number; y: number } | null = null;

      if (index === 0) {
        // Place the largest bubble at the center
        position = { x: width / 2, y: height / 2 };
      } else {
        // Try to place near the center of mass of existing bubbles
        const centerX = positioned.reduce((sum, b) => sum + b.x, 0) / positioned.length;
        const centerY = positioned.reduce((sum, b) => sum + b.y, 0) / positioned.length;

        position = findClosestPosition(centerX, centerY, bubble.radius);
      }

      if (position) {
        positioned.push({
          category: bubble.category,
          amount: bubble.amount,
          color: bubble.color,
          radius: bubble.radius,
          x: position.x,
          y: position.y,
        });
      }
    });

    // Center the entire layout by calculating bounds and shifting
    if (positioned.length > 0) {
      const minX = Math.min(...positioned.map(b => b.x - b.radius));
      const maxX = Math.max(...positioned.map(b => b.x + b.radius));
      const minY = Math.min(...positioned.map(b => b.y - b.radius));
      const maxY = Math.max(...positioned.map(b => b.y + b.radius));

      const layoutWidth = maxX - minX;
      const layoutHeight = maxY - minY;

      const shiftX = (width - layoutWidth) / 2 - minX;
      const shiftY = (height - layoutHeight) / 2 - minY;

      positioned.forEach(bubble => {
        bubble.x += shiftX;
        bubble.y += shiftY;
      });
    }

    return positioned;
  }, [data]);

  const percentage = (amount: number) =>
    total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="kpi-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Spending by Category</h3>
        <p className="text-sm text-muted-foreground">
          {data.length} {data.length === 1 ? 'category' : 'categories'} • {formatBHD(total)} total
        </p>
      </div>

      {/* Bubble Chart */}
      <div className="relative h-80 mb-4 overflow-hidden rounded-lg bg-card/30">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 320"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {bubbles.map((bubble, index) => {
            const isHovered = hoveredBubble === bubble.category;

            // Estimate text width (rough approximation: 6px per character for 10px font)
            const categoryText = bubble.category.length > 12
              ? bubble.category.substring(0, 10) + '...'
              : bubble.category;
            const percentText = `${percentage(bubble.amount)}%`;

            // Estimate if text fits within circle (with some padding)
            const fontSize = bubble.radius > 50 ? 12 : 10;
            const estimatedTextWidth = Math.max(
              categoryText.length * (fontSize * 0.6),
              percentText.length * (fontSize * 0.6)
            );
            const textFitsInCircle = estimatedTextWidth < bubble.radius * 1.6; // Diameter with padding

            const showLabel = (textFitsInCircle && bubble.radius > 35) || isHovered;

            return (
              <g key={bubble.category}>
                {/* Bubble circle with glow effect */}
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  r={isHovered ? bubble.radius + 3 : bubble.radius}
                  fill={bubble.color}
                  opacity={isHovered ? 0.95 : 0.85}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 12px ${bubble.color})` : 'none',
                  }}
                  onMouseEnter={() => setHoveredBubble(bubble.category)}
                  onMouseLeave={() => setHoveredBubble(null)}
                  onTouchStart={() => setHoveredBubble(bubble.category)}
                />

                {/* Label for bubbles with sufficient space */}
                {showLabel && textFitsInCircle && (
                  <>
                    <text
                      x={bubble.x}
                      y={bubble.y - 5}
                      textAnchor="middle"
                      className="text-xs font-bold fill-white pointer-events-none"
                      style={{
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        fontSize: bubble.radius > 50 ? '12px' : '10px'
                      }}
                    >
                      {categoryText}
                    </text>
                    <text
                      x={bubble.x}
                      y={bubble.y + 10}
                      textAnchor="middle"
                      className="text-xs font-semibold fill-white pointer-events-none"
                      style={{
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        fontSize: bubble.radius > 50 ? '11px' : '9px'
                      }}
                    >
                      {percentText}
                    </text>
                  </>
                )}

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={bubble.x - 60}
                      y={bubble.y + bubble.radius + 10}
                      width="120"
                      height="50"
                      rx="6"
                      className="fill-card stroke-border"
                      strokeWidth="1"
                      style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
                    />
                    <text
                      x={bubble.x}
                      y={bubble.y + bubble.radius + 28}
                      textAnchor="middle"
                      className="text-xs font-semibold fill-foreground"
                    >
                      {bubble.category}
                    </text>
                    <text
                      x={bubble.x}
                      y={bubble.y + bubble.radius + 44}
                      textAnchor="middle"
                      className="text-xs fill-muted-foreground"
                    >
                      BD {bubble.amount.toFixed(3)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Compact Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {data.map((item) => (
          <div
            key={item.category}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredBubble(item.category)}
            onMouseLeave={() => setHoveredBubble(null)}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate flex-1">{item.category}</span>
            <span className="font-semibold text-foreground">{percentage(item.amount)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
