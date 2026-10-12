import React, { useState, useEffect } from "react";
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
  LabelList,
} from "recharts";
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Table as TableIcon,
  AreaChart as AreaIcon,
  BarChart2,
} from "lucide-react";
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
  onTypeChange?: (newType: string) => void;
}

const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
];

const formatColumnName = (col: string): string => {
  if (!col) return "";
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const isCurrencyMetric = (key: string): boolean => {
  const lower = (key || "").toLowerCase();
  return (
    lower.includes("revenue") ||
    lower.includes("sales") ||
    lower.includes("price") ||
    lower.includes("profit") ||
    lower.includes("cost") ||
    lower.includes("amount") ||
    lower.includes("spend") ||
    lower.includes("arr") ||
    lower.includes("mrr") ||
    lower.includes("val") ||
    lower.includes("usd")
  );
};

const formatCompactValue = (val: any, metricKey: string = ""): string => {
  if (val === null || val === undefined) return "";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return String(val);

  const prefix = isCurrencyMetric(metricKey) ? "$" : "";
  const abs = Math.abs(num);

  if (abs >= 1_000_000_000) {
    return `${prefix}${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(num / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${prefix}${(num / 1_000).toFixed(1)}k`;
  }
  return `${prefix}${num.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  spec,
  height = 300,
  allowTypeSwitch = true,
  onTypeChange,
}) => {
  const [currentType, setCurrentType] = useState<string>(spec.type || "bar");
  const { isDark } = useThemeStore();
  const data = spec.data || [];

  useEffect(() => {
    if (spec.type && spec.type !== currentType) {
      setCurrentType(spec.type);
    }
  }, [spec.type]);

  const handleTypeChange = (newType: string) => {
    setCurrentType(newType);
    onTypeChange?.(newType);
  };

  // Helper to format general table / tooltip values
  const formatValue = (val: any, key: string = "") => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") {
      const prefix = isCurrencyMetric(key) ? "$" : "";
      return `${prefix}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
    padding: "8px 12px",
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

  // Robustly resolve xKey and yKey from data keys
  const sampleRow = data[0] || {};
  const dataKeys = Object.keys(sampleRow);

  const resolveKey = (targetKey?: string, preferNumeric = false): string => {
    if (!dataKeys.length) return "";
    
    // 1. Direct match
    if (targetKey && dataKeys.includes(targetKey)) {
      return targetKey;
    }

    // 2. Case-insensitive / normalized match (e.g. "product_category" matches "category")
    if (targetKey) {
      const cleanTarget = targetKey.toLowerCase().replace(/[\s_-]+/g, "");
      const match = dataKeys.find((k) => k.toLowerCase().replace(/[\s_-]+/g, "") === cleanTarget);
      if (match) return match;

      const subMatch = dataKeys.find((k) => {
        const cleanK = k.toLowerCase().replace(/[\s_-]+/g, "");
        return cleanTarget.includes(cleanK) || cleanK.includes(cleanTarget);
      });
      if (subMatch) return subMatch;
    }

    // 3. Fallback based on column type
    if (preferNumeric) {
      const numKey = dataKeys.find((k) => typeof sampleRow[k] === "number");
      if (numKey) return numKey;
      return dataKeys[1] || dataKeys[0];
    } else {
      const strKey = dataKeys.find((k) => typeof sampleRow[k] === "string" || sampleRow[k] instanceof Date);
      if (strKey) return strKey;
      return dataKeys[0];
    }
  };

  const xKey = resolveKey(spec.x_axis, false);
  const yKey = resolveKey(spec.y_axis, true);

  // Determine tick rotation & space needed
  const maxLabelLen = Math.max(...data.map((d) => String(d[xKey] ?? "").length), 0);
  const isAngled = maxLabelLen > 8 || data.length > 5;
  const showDataLabels = data.length > 0 && data.length <= 12;

  const formatXTick = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    return str.length > 22 ? str.substring(0, 20) + "…" : str;
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-full transition-colors">
      <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0 pr-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{spec.title}</h4>
          {xKey && yKey && (
            <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="inline-flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Y: {formatColumnName(yKey)}</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>X: {formatColumnName(xKey)}</span>
              </span>
            </div>
          )}
        </div>
        {allowTypeSwitch && (
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-slate-600 dark:text-slate-300 shrink-0">
            <button
              onClick={() => handleTypeChange("bar")}
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
              onClick={() => handleTypeChange("horizontal_bar")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                currentType === "horizontal_bar"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-medium"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Horizontal Bar Chart"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleTypeChange("line")}
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
              onClick={() => handleTypeChange("area")}
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
              onClick={() => handleTypeChange("pie")}
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
              onClick={() => handleTypeChange("table")}
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
                    {Object.entries(row).map(([colName, v], cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
                        {formatValue(v, colName)}
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
                formatter={(value: any) => [formatValue(value, yKey), formatColumnName(yKey)]}
                labelFormatter={(label: any) => `${formatColumnName(xKey)}: ${label}`}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: axisTickColor }}
                formatter={(val: string) => <span style={{ color: isDark ? "#cbd5e1" : "#475569" }}>{val}</span>}
              />
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="48%"
                innerRadius={currentType === "donut" ? 50 : 20}
                outerRadius={75}
                paddingAngle={3}
                label={({ name, percent }: any) => {
                  const labelName = name ? (name.length > 12 ? name.substring(0, 10) + "…" : name) : "";
                  return `${labelName} (${(percent * 100).toFixed(0)}%)`;
                }}
                labelLine={{ stroke: axisTickColor, strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : currentType === "line" ? (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 20, right: 25, left: 15, bottom: isAngled ? 65 : 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey={xKey}
                interval={0}
                height={isAngled ? 60 : 30}
                tick={{ fontSize: 11, fill: axisTickColor, fontWeight: 500 }}
                angle={isAngled ? -25 : 0}
                textAnchor={isAngled ? "end" : "middle"}
                dx={isAngled ? -4 : 0}
                dy={isAngled ? 4 : 8}
                tickFormatter={formatXTick}
              />
              <YAxis
                tick={{ fontSize: 11, fill: axisTickColor }}
                tickFormatter={(v) => formatCompactValue(v, yKey)}
                width={55}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatValue(value, yKey), formatColumnName(yKey)]}
                labelFormatter={(label: any) => `${formatColumnName(xKey)}: ${label}`}
              />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: "11px", color: axisTickColor }} />
              <Line
                type="monotone"
                dataKey={yKey}
                name={formatColumnName(yKey)}
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              >
                {showDataLabels && (
                  <LabelList
                    dataKey={yKey}
                    position="top"
                    fill={isDark ? "#cbd5e1" : "#475569"}
                    fontSize={10}
                    fontWeight={600}
                    formatter={(val: any) => formatCompactValue(val, yKey)}
                    offset={8}
                  />
                )}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        ) : currentType === "area" ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 20, right: 25, left: 15, bottom: isAngled ? 65 : 30 }}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey={xKey}
                interval={0}
                height={isAngled ? 60 : 30}
                tick={{ fontSize: 11, fill: axisTickColor, fontWeight: 500 }}
                angle={isAngled ? -25 : 0}
                textAnchor={isAngled ? "end" : "middle"}
                dx={isAngled ? -4 : 0}
                dy={isAngled ? 4 : 8}
                tickFormatter={formatXTick}
              />
              <YAxis
                tick={{ fontSize: 11, fill: axisTickColor }}
                tickFormatter={(v) => formatCompactValue(v, yKey)}
                width={55}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatValue(value, yKey), formatColumnName(yKey)]}
                labelFormatter={(label: any) => `${formatColumnName(xKey)}: ${label}`}
              />
              <Area
                type="monotone"
                dataKey={yKey}
                name={formatColumnName(yKey)}
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorArea)"
              >
                {showDataLabels && (
                  <LabelList
                    dataKey={yKey}
                    position="top"
                    fill={isDark ? "#cbd5e1" : "#475569"}
                    fontSize={10}
                    fontWeight={600}
                    formatter={(val: any) => formatCompactValue(val, yKey)}
                    offset={6}
                  />
                )}
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        ) : currentType === "horizontal_bar" ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart layout="vertical" data={data} margin={{ top: 20, right: 40, left: 15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompactValue(v, yKey)}
                tick={{ fontSize: 11, fill: axisTickColor }}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                interval={0}
                width={95}
                tick={{ fontSize: 11, fill: axisTickColor, fontWeight: 500 }}
                tickFormatter={formatXTick}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatValue(value, yKey), formatColumnName(yKey)]}
                labelFormatter={(label: any) => `${formatColumnName(xKey)}: ${label}`}
              />
              <Bar dataKey={yKey} name={formatColumnName(yKey)} fill="#3b82f6" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey={yKey}
                  position="right"
                  fill={isDark ? "#cbd5e1" : "#475569"}
                  fontSize={11}
                  fontWeight={600}
                  formatter={(val: any) => formatCompactValue(val, yKey)}
                  offset={6}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 25, right: 25, left: 15, bottom: isAngled ? 65 : 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey={xKey}
                interval={0}
                height={isAngled ? 60 : 30}
                tick={{ fontSize: 11, fill: axisTickColor, fontWeight: 500 }}
                angle={isAngled ? -25 : 0}
                textAnchor={isAngled ? "end" : "middle"}
                dx={isAngled ? -4 : 0}
                dy={isAngled ? 4 : 8}
                tickFormatter={formatXTick}
              />
              <YAxis
                tick={{ fontSize: 11, fill: axisTickColor }}
                tickFormatter={(v) => formatCompactValue(v, yKey)}
                width={55}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatValue(value, yKey), formatColumnName(yKey)]}
                labelFormatter={(label: any) => `${formatColumnName(xKey)}: ${label}`}
              />
              <Bar dataKey={yKey} name={formatColumnName(yKey)} fill="#3b82f6" radius={[6, 6, 0, 0]}>
                {showDataLabels && (
                  <LabelList
                    dataKey={yKey}
                    position="top"
                    fill={isDark ? "#cbd5e1" : "#475569"}
                    fontSize={11}
                    fontWeight={600}
                    formatter={(val: any) => formatCompactValue(val, yKey)}
                    offset={6}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
