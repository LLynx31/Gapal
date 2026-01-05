'use client';

import { cn } from '@/lib/utils';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

// Simple Bar Chart
export function BarChart({
  data,
  height = 200,
  showLabels = true,
  showValues = true,
  className,
}: {
  data: DataPoint[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  className?: string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${height / 4}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {data.map((point, index) => {
          const barHeight = (point.value / maxValue) * (height / 4 - 10);
          const x = index * barWidth + barWidth * 0.15;
          const y = height / 4 - barHeight - 5;
          const width = barWidth * 0.7;

          return (
            <g key={point.label}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx={1}
                fill={point.color || '#f97316'}
                className="transition-all duration-300 hover:opacity-80"
              />
              {/* Value on top */}
              {showValues && point.value > 0 && (
                <text
                  x={x + width / 2}
                  y={y - 1}
                  textAnchor="middle"
                  className="fill-gray-700 dark:fill-gray-300 text-[2.5px] font-medium"
                >
                  {point.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {showLabels && (
        <div className="flex justify-between mt-2 px-1">
          {data.map((point) => (
            <div key={point.label} className="text-xs text-gray-500 dark:text-gray-400 text-center" style={{ width: `${barWidth}%` }}>
              {point.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple Line Chart
export function LineChart({
  data,
  height = 150,
  color = '#f97316',
  showDots = true,
  showArea = true,
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showArea?: boolean;
  className?: string;
}) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = 0;
  const padding = 5;
  const chartHeight = 40;
  const chartWidth = 100;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (chartWidth - padding * 2);
    const y = padding + (1 - (point.value - minValue) / (maxValue - minValue || 1)) * (chartHeight - padding * 2);
    return { x, y, ...point };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${chartHeight - padding} L ${points[0]?.x || 0} ${chartHeight - padding} Z`;

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ height }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            y1={padding + (1 - ratio) * (chartHeight - padding * 2)}
            x2={chartWidth - padding}
            y2={padding + (1 - ratio) * (chartHeight - padding * 2)}
            stroke="#e5e7eb"
            strokeWidth="0.2"
            className="dark:stroke-gray-700"
          />
        ))}

        {/* Area under line */}
        {showArea && (
          <path
            d={areaPath}
            fill={color}
            opacity="0.1"
            className="transition-all duration-300"
          />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300"
        />

        {/* Dots */}
        {showDots && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="1"
            fill={color}
            className="transition-all duration-300 hover:r-2"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-2 px-1">
        {data.map((point, index) => (
          <span key={index} className="text-xs text-gray-500 dark:text-gray-400">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Donut/Pie Chart
export function DonutChart({
  data,
  size = 150,
  strokeWidth = 20,
  className,
}: {
  data: DataPoint[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ width: size, height: size }}>
        <span className="text-gray-400 text-sm">Aucune donnée</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;

  const defaultColors = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ef4444'];

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((point, index) => {
          const percentage = point.value / total;
          const strokeDasharray = `${percentage * circumference} ${circumference}`;
          const strokeDashoffset = -cumulativePercentage * circumference;
          cumulativePercentage += percentage;

          return (
            <circle
              key={point.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={point.color || defaultColors[index % defaultColors.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{total}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">Total</span>
        </div>
      </div>
    </div>
  );
}

// Progress Ring
export function ProgressRing({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color = '#f97316',
  label,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          className="dark:stroke-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {Math.round(percentage * 100)}%
        </span>
        {label && <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

// Mini Sparkline
export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#f97316',
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Legend component
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; value?: number | string }[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center space-x-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {item.label}
            {item.value !== undefined && (
              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                ({item.value})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
