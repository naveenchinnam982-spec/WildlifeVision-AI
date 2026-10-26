import React from 'react';
import { AnalysisResult } from '../types/wildlife';
import { getSpeciesColor } from '../utils/colorPalette';
import {
  Camera,
  Layers,
  ArrowUpRight,
  Sparkles,
  Shield,
  Eye,
  PlusCircle,
  Binoculars,
  MapPin,
} from 'lucide-react';

interface DashboardOverviewProps {
  history: any[];
  onAnalyzeNew: () => void;
  onSelectHistoryItem: (item: any) => void;
  onOpenMap?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  history,
  onAnalyzeNew,
  onSelectHistoryItem,
  onOpenMap,
}) => {
  // Compute aggregate metrics from real analysis records
  const totalImagesAnalyzed = history.length;
  const totalAnimalsDetected = history.reduce(
    (sum, h) => sum + (h.totalTrackedAnimals ?? h.totalAnimals ?? 0),
    0
  );

  // Aggregate distinct species across all history records
  const allSpeciesMap = new Map<string, number>();
  history.forEach((h) => {
    (h.speciesCounts || []).forEach((sc: any) => {
      const k = (sc.animalLabel || '').trim();
      if (!k) return;
      const count = Number(sc.trackCount ?? sc.count ?? 1);
      allSpeciesMap.set(k, (allSpeciesMap.get(k) || 0) + count);
    });
  });

  const distinctSpeciesCount = allSpeciesMap.size;
  const latestAnalysis = history[0] || null;

  // Sorted species for distribution chart
  const speciesDistribution = Array.from(allSpeciesMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const maxSpeciesCount = speciesDistribution.length > 0 ? Math.max(...speciesDistribution.map((s) => s.count)) : 1;

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-800/40">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800/60 text-emerald-200 border border-emerald-700/50">
            <Binoculars className="w-3.5 h-3.5" />
            <span>Autonomous Drone Computer Vision</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            WildlifeVision AI
          </h1>
          <p className="text-stone-300 text-sm leading-relaxed">
            AI-powered drone wildlife monitoring and animal detection system. Upload high-resolution aerial imagery to detect wild animals, classify taxonomic species, localize individuals with bounding boxes, and generate environmental census reports.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAnalyzeNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm transition shadow-lg cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Analyze Image / Video</span>
            </button>

            {onOpenMap && (
              <button
                type="button"
                onClick={onOpenMap}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-white font-bold text-sm transition border border-stone-700/80 cursor-pointer shadow-sm"
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Open Forest Map</span>
              </button>
            )}
          </div>
        </div>

        {/* Ambient background graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none flex items-center justify-center">
          <Eye className="w-72 h-72 text-emerald-300" />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Images */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Images Analyzed
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {totalImagesAnalyzed}
            </span>
            <p className="text-xs text-stone-500 mt-1">
              {totalImagesAnalyzed === 0 ? 'No drone missions yet' : 'Aerial surveys recorded'}
            </p>
          </div>
        </div>

        {/* Total Animals Detected */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Animals Detected
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-400">
              {totalAnimalsDetected}
            </span>
            <p className="text-xs text-stone-500 mt-1">
              Individual specimens counted
            </p>
          </div>
        </div>

        {/* Species Diversity */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Species Identified
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {distinctSpeciesCount}
            </span>
            <p className="text-xs text-stone-500 mt-1">
              Distinct biological taxa
            </p>
          </div>
        </div>

        {/* Latest Analysis Status */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Latest Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {latestAnalysis ? (
              <div>
                <span className="text-base font-bold text-stone-900 dark:text-white block truncate">
                  {latestAnalysis.totalAnimals} animal(s)
                </span>
                <p className="text-xs text-stone-500 mt-0.5 truncate">
                  {latestAnalysis.status === 'completed' ? 'Completed Survey' : 'Zero Animals'} •{' '}
                  {new Date(latestAnalysis.timestamp).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div>
                <span className="text-base font-semibold text-stone-400 block">
                  Awaiting First Mission
                </span>
                <p className="text-xs text-stone-500 mt-0.5">
                  System operational
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Species Distribution & Recent Missions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Species-wise Distribution Chart */}
        <div className="lg:col-span-1 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Species Distribution
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Cumulative species counts across analyzed missions
            </p>

            <div className="mt-6 space-y-3">
              {speciesDistribution.length === 0 ? (
                <div className="text-center py-10 text-xs text-stone-400">
                  <p>No species detected yet.</p>
                  <p className="mt-1 text-stone-500">Analyze an aerial image to populate census chart.</p>
                </div>
              ) : (
                speciesDistribution.map((sp) => {
                  const pct = Math.round((sp.count / maxSpeciesCount) * 100);
                  const color = getSpeciesColor(sp.name);
                  return (
                    <div key={sp.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color.stroke }}
                          />
                          {sp.name}
                        </span>
                        <span className="font-mono font-bold text-stone-600 dark:text-stone-400">
                          {sp.count}
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color.stroke,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 flex justify-between items-center">
            <span>Census Diversity</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              {distinctSpeciesCount} Species Total
            </span>
          </div>
        </div>

        {/* Recent Analyzed Images & Missions */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Recent Aerial Surveys
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Past drone image detections and reports
              </p>
            </div>
            {history.length > 0 && (
              <span className="text-xs font-mono text-stone-500">
                {history.length} Saved Survey{history.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-8 space-y-3">
              <Camera className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                No drone imagery analyzed yet
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Upload a drone aerial photograph or select one of the built-in sample flight frames to run computer vision analysis.
              </p>
              <button
                type="button"
                onClick={onAnalyzeNew}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Upload First Drone Frame</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 5).map((item) => (
                <div
                  key={item.analysisId}
                  onClick={() => onSelectHistoryItem(item)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-emerald-600/60 dark:hover:border-emerald-500/60 bg-stone-50/50 dark:bg-stone-800/30 hover:bg-emerald-50/20 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={item.imageDataUrl}
                      alt={item.filename}
                      className="w-14 h-12 object-cover rounded-lg border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">
                          {item.analysisId}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 truncate mt-0.5">
                        {item.filename} • {item.totalAnimals} Animal{item.totalAnimals === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {item.distinctSpeciesCount} Species
                      </span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
