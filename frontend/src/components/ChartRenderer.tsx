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
import { useThemeStore } from "../stores/useThemeStore";

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
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, height = 300, allowTypeSwitch = true }) => {
  const [currentType, setCurrentType] = useState<string>(spec.type || "bar");
  const { isDark } = useThemeStore();
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

  const tooltipStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    color: isDark ? "#f8fafc" : "#0f172a",
    borderRadius: "12px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
    fontSize: "12px",
  };

  const axisTickColor = isDark ? "#94a3b8" : "#64748b";
  const gridStroke = isDark ? "#1e293b" : "#f1f5f9";

  if (currentType === "kpi" || (spec.kpi_value !== undefined && spec.kpi_value !== null)) {
    const formattedKpi =
      typeof spec.kpi_value === "number" && spec.kpi_value > 100
        ? `$${spec.kpi_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : formatValue(spec.kpi_value);

    return (
      <div className="flex flex-col justify-center items-center p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full transition-colors">
        <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          {spec.title}
        </h4>
        <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {formattedKpi}
        </div>
        {spec.kpi_subtext && (
          <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/40 px-3 py-1 rounded-full">
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
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-full transition-colors">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{spec.title}</h4>
        {allowTypeSwitch && (
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-slate-600 dark:text-slate-300 shrink-0">
            <button
              onClick={() => setCurrentType("bar")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "bar"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("line")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "line"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Line Chart"
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("area")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "area"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Area Chart"
            >
              <AreaIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("pie")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "pie"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Pie Chart"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentType("table")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "table"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Data Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 w-full" style={{ minHeight: height }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-400 dark:text-slate-500">
            No chart data available
          </div>
        ) : currentType === "table" ? (
          <div className="overflow-x-auto max-h-[300px]">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {Object.keys(data[0] || {}).map((col) => (
                    <th key={col} className="py-2.5 px-3">
                      {col.replace(/_/g, " ").toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    {Object.values(row).map((v, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
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
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatValue(value), yKey]}
              />
              <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: "11px", color: axisTickColor }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisTickColor }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: axisTickColor }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatValue(value), yKey]} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: "11px", color: axisTickColor }} />
              <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : currentType === "area" ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisTickColor }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: axisTickColor }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatValue(value), yKey]} />
              <Area type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorArea)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisTickColor }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: axisTickColor }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatValue(value), yKey]} />
              <Bar dataKey={yKey} fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
