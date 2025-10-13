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

    // Simple circle packing algorithm - arrange in a grid-like pattern
    const width = 400;
    const height = 320;
    const positioned: BubbleData[] = [];

    // Sort by size (largest first) for better packing
    const sorted = [...bubblesWithRadius].sort((a, b) => b.radius - a.radius);

    sorted.forEach((bubble, index) => {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100;

      while (!placed && attempts < maxAttempts) {
        // Start from center and spiral outward
        const angle = (index * 137.5) * (Math.PI / 180); // Golden angle
        const distance = Math.sqrt(index) * 40;

        const x = width / 2 + distance * Math.cos(angle);
        const y = height / 2 + distance * Math.sin(angle);

        // Check if this position overlaps with existing bubbles
        const overlaps = positioned.some(other => {
          const dx = x - other.x;
          const dy = y - other.y;
          const minDist = bubble.radius + other.radius + 5; // 5px padding
          return Math.sqrt(dx * dx + dy * dy) < minDist;
        });

        // Check boundaries
        const inBounds =
          x - bubble.radius > 10 &&
          x + bubble.radius < width - 10 &&
          y - bubble.radius > 10 &&
          y + bubble.radius < height - 10;

        if (!overlaps && inBounds) {
          positioned.push({
            category: bubble.category,
            amount: bubble.amount,
            color: bubble.color,
            radius: bubble.radius,
            x,
            y,
          });
          placed = true;
        }

        attempts++;
      }

      // Fallback positioning if packing fails
      if (!placed) {
        const fallbackX = (index % 3) * (width / 3) + width / 6;
        const fallbackY = Math.floor(index / 3) * 100 + 60;
        positioned.push({
          category: bubble.category,
          amount: bubble.amount,
          color: bubble.color,
          radius: Math.min(bubble.radius, 30),
          x: fallbackX,
          y: fallbackY,
        });
      }
    });

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
            const showLabel = bubble.radius > 35 || isHovered;

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

                {/* Label for larger bubbles */}
                {showLabel && (
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
                      {bubble.category.length > 12
                        ? bubble.category.substring(0, 10) + '...'
                        : bubble.category}
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
                      {percentage(bubble.amount)}%
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
