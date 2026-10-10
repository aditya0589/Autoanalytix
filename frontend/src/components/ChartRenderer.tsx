import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table as TableIcon, AreaChart as AreaIcon } from "lucide-react";

export interface ChartSpec {
  type: string;
  title: string;
  x_axis?: string;
  y_axis?: string;
  series?: string[];
  kpi_value?: string | number | null;
  kpi_subtext?: string | null;
  data: Record<string, any>[];
}

interface ChartRendererProps {
  spec: ChartSpec;
  height?: number;
  allowTypeSwitch?: boolean;
}

const COLORS = [
  "#2563eb", // blue-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, height = 300, allowTypeSwitch = true }) => {
  const [currentType, setCurrentType] = useState<string>(spec.type || "bar");
  const data = spec.data || [];

  // Helper to format values
  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") {
      if (val >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return val.toString();
    }
    return String(val);
  };

  if (currentType === "kpi" || spec.kpi_value !== undefined && spec.kpi_value !== null) {
    const formattedKpi = typeof spec.kpi_value === "number" && spec.kpi_value > 100
      ? `$${spec.kpi_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : formatValue(spec.kpi_value);

    return (
      <div className="flex flex-col justify-center items-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm h-full">
        <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">{spec.title}</h4>
        <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{formattedKpi}</div>
        {spec.kpi_subtext && (
          <p className="mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {spec.kpi_subtext}
          </p>
        )}
      </div>
    );
  }

  // Detect x and y keys
  const xKey = spec.x_axis || (data[0] ? Object.keys(data[0])[0] : "");
  const yKey = spec.y_axis || (data[0] ? Object.keys(data[0])[1] : "");

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-full">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-800">{spec.title}</h4>
        {allowTypeSwitch && (
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-slate-600">
            <button
              onClick={() => setCurrentType("bar")}
              className={`p-1.5 rounded-md text-xs transition-colors ${currentType === "bar" ? "bg-white text-blue-600 shadow-sm font-medium" : "hover:text-slate-900"}`}
              title="Bar Chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("line")}
              className={`p-1.5 rounded-md text-xs transition-colors ${currentType === "line" ? "bg-white text-blue-600 shadow-sm font-medium" : "hover:text-slate-900"}`}
              title="Line Chart"
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("area")}
              className={`p-1.5 rounded-md text-xs transition-colors ${currentType === "area" ? "bg-white text-blue-600 shadow-sm font-medium" : "hover:text-slate-900"}`}
              title="Area Chart"
            >
              <AreaIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("pie")}
              className={`p-1.5 rounded-md text-xs transition-colors ${currentType === "pie" ? "bg-white text-blue-600 shadow-sm font-medium" : "hover:text-slate-900"}`}
              title="Pie Chart"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("table")}
              className={`p-1.5 rounded-md text-xs transition-colors ${currentType === "table" ? "bg-white text-blue-600 shadow-sm font-medium" : "hover:text-slate-900"}`}
              title="Data Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 w-full" style={{ minHeight: height }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            No chart data available
          </div>
        ) : currentType === "table" ? (
          <div className="overflow-x-auto max-h-[300px]">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  {Object.keys(data[0] || {}).map((col) => (
                    <th key={col} className="py-2 px-3">
                      {col.replace(/_/g, " ").toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {Object.values(row).map((v, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                        {formatValue(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : currentType === "pie" || currentType === "donut" ? (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Tooltip formatter={(value: any) => [formatValue(value), yKey]} />
              <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                innerRadius={currentType === "donut" ? 50 : 20}
                outerRadius={80}
                paddingAngle={3}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : currentType === "line" ? (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(value: any) => [formatValue(value), yKey]} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey={yKey} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : currentType === "area" ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(value: any) => [formatValue(value), yKey]} />
              <Area type="monotone" dataKey={yKey} stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorArea)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(value: any) => [formatValue(value), yKey]} />
              <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
