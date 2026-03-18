import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Table as TableIcon, BarChart2 } from 'lucide-react';

interface ChartDataPayload {
  labels: string[];
  values: number[];
  value_label: string;
  columns: string[];
  rows: Record<string, any>[];
}

interface VisualizationProps {
  data: ChartDataPayload;
}

const COLORS = [
  '#ff6b6b', '#2ed573', '#1e90ff', '#ffa502', '#a29bfe',
  '#fd79a8', '#00cec9', '#e17055', '#6c5ce7', '#55efc4',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#18181b]/95 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl z-50">
        <p className="text-neutral-200 font-medium mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3 text-sm mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-neutral-400 capitalize">{entry.name}:</span>
            <span className="text-neutral-100 font-semibold">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function Visualization({ data }: VisualizationProps) {
  // Guard against empty or incorrectly formatted data
  if (!data || !data.rows || data.rows.length === 0) {
    return null;
  }

  const { labels, values, value_label, columns, rows } = data;
  const hasChartData = labels && labels.length > 1 && values && values.length > 1;

  // Auto-default to chart view when we have comparative chart data (multiple bars)
  const [view, setView] = useState<'table' | 'chart'>(hasChartData ? 'chart' : 'table');

  // Transform data for recharts if we have valid chart info
  const chartDataTransform = hasChartData ? labels.map((label, i) => ({
    name: String(label).length > 15 ? String(label).substring(0, 15) + '…' : String(label),
    fullName: String(label),
    [value_label || 'value']: values[i]
  })) : [];

  // Compute the max value for better Y-axis scaling
  const maxValue = hasChartData ? Math.max(...values) : 0;

  return (
    <div className="w-full bg-[#0a0a0a]/50 rounded-xl border border-white/5 overflow-hidden">
      
      {/* Header controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#18181b]/50">
        <h4 className="text-sm font-medium text-neutral-300">
          Query Results
          <span className="ml-2 text-xs text-neutral-500">({rows.length} rows)</span>
        </h4>
        
        {hasChartData && (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md flex items-center gap-2 text-xs transition-colors ${view === 'table' ? 'bg-[#ff6b6b] text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <TableIcon size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setView('chart')}
              className={`p-1.5 rounded-md flex items-center gap-2 text-xs transition-colors ${view === 'chart' ? 'bg-[#ff6b6b] text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <BarChart2 size={14} />
              <span className="hidden sm:inline">Chart</span>
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4">
        {view === 'chart' && hasChartData ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartDataTransform}
                margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff50" 
                  fontSize={13}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  angle={labels.length > 6 ? -35 : 0}
                  textAnchor={labels.length > 6 ? "end" : "middle"}
                  height={labels.length > 6 ? 70 : 40}
                  interval={0}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value/1000).toFixed(1)}k`;
                    return `${value}`;
                  }}
                  domain={[0, Math.ceil(maxValue * 1.15)]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Bar
                  dataKey={value_label || 'value'}
                  name={value_label ? value_label.replace(/_/g, ' ') : 'Value'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                  animationDuration={800}
                  animationBegin={100}
                >
                  {chartDataTransform.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend beneath chart */}
            <div className="flex flex-wrap gap-3 justify-center mt-2 px-4">
              {chartDataTransform.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span>{item.fullName}: <span className="text-neutral-200 font-medium">{values[idx]?.toLocaleString()}</span></span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto custom-scrollbar border border-white/5 rounded-lg bg-black/40">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-[#18181b]">
                  {columns.map((col, idx) => (
                    <th key={idx} className="px-4 py-3 text-xs font-semibold text-neutral-400 border-b border-white/5 tracking-wider uppercase">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                    {columns.map((col, cIdx) => {
                      const val = row[col];
                      const isNumber = typeof val === 'number';
                      return (
                        <td key={cIdx} className={`px-4 py-3 text-sm font-mono ${isNumber ? 'text-[#1e90ff]' : 'text-neutral-300'}`}>
                          {val !== null && val !== undefined
                            ? (isNumber ? val.toLocaleString() : String(val))
                            : <span className="text-neutral-600 italic">null</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {rows.length === 50 && (
              <div className="px-4 py-2 text-xs text-neutral-500 bg-[#18181b]/50 border-t border-white/5 italic text-center">
                Showing top 50 rows only.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
