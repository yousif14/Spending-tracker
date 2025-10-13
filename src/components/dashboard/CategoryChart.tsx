import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Summary } from '@/types';
import { formatBHD } from '@/lib/mockData';

interface CategoryChartProps {
  data: Summary['totalsByCategory'];
}

export function CategoryChart({ data }: CategoryChartProps) {
  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? (data.amount / total * 100).toFixed(1) : 0;
      return (
        <div className="chart-tooltip">
          <p className="text-sm font-semibold">{data.category}</p>
          <p className="text-sm">
            <span className="currency-bhd">{data.amount.toFixed(3)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-48 overflow-y-auto">
        {payload.map((entry: any, index: number) => {
          const percentage = total > 0 ? (entry.payload.amount / total * 100).toFixed(1) : 0;
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground truncate flex-1">{entry.value}</span>
              <span className="font-semibold text-foreground">{percentage}%</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Only show percentage labels for segments > 5%
  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.65;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-bold"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="kpi-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Spending by Category</h3>
        <p className="text-sm text-muted-foreground">
          {data.length} {data.length === 1 ? 'category' : 'categories'} • {formatBHD(total)} total
        </p>
      </div>

      <div className="h-64 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={85}
              innerRadius={50}
              fill="#8884d8"
              dataKey="amount"
              animationDuration={800}
              animationBegin={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with all categories */}
      <CustomLegend payload={data.map(item => ({ value: item.category, color: item.color, payload: item }))} />
    </div>
  );
}
