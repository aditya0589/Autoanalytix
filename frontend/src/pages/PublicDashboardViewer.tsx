import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { ChartRenderer } from "../components/ChartRenderer";
import { Globe, ShieldCheck, BarChart2 } from "lucide-react";

export const PublicDashboardViewer: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    setLoading(true);
    api.publicDashboards
      .get(shareId)
      .then((data) => setDashboard(data))
      .catch((err) => setError(err.message || "Shared dashboard is not accessible."))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-xs text-slate-400">
        Loading shared dashboard...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Dashboard Unavailable</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || "This shared link may have expired or public access has been revoked by the owner."}
          </p>
          <div className="pt-2">
            <Link to="/" className="text-xs font-semibold text-blue-600 hover:underline">
              Back to Autoanalytix
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items = dashboard.items || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Banner */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            A
          </div>
          <span className="font-bold text-base text-slate-900 tracking-tight">Autoanalytix</span>
          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full ml-2">
            Public View
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verified Secure View</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-1">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{dashboard.title}</h1>
          {dashboard.description && (
            <p className="text-xs text-slate-500 leading-relaxed">{dashboard.description}</p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-xs text-slate-400">
            No widgets configured for this dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {items.map((item: any, idx: number) => {
              const span = item.grid_pos?.w || 6;
              const spanClass = `lg:col-span-${Math.min(span, 12)}`;
              const spec = item.chart_spec || {
                type: item.widget_type,
                title: item.title,
                data: item.cached_data?.rows || [],
              };

              return (
                <div key={idx} className={`${spanClass} col-span-12 min-h-[280px]`}>
                  <ChartRenderer spec={spec} height={250} allowTypeSwitch={true} />
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Powered by Autoanalytix • AI-Powered Business Intelligence
      </footer>
    </div>
  );
};
