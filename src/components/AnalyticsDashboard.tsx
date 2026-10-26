import React, { useState } from 'react';
import { AnalysisResult } from '../types/wildlife';
import { getSpeciesColor } from '../utils/colorPalette';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  ShieldAlert,
  Calendar,
  Compass,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  history: any[];
  onSelectSurvey: (survey: any) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  history,
  onSelectSurvey,
}) => {
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<'all' | '7d' | '30d'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter history based on time window
  const filteredHistory = history.filter((h) => {
    if (selectedTimeWindow === 'all') return true;
    const time = new Date(h.timestamp).getTime();
    const now = Date.now();
    const days = selectedTimeWindow === '7d' ? 7 : 30;
    return now - time <= days * 24 * 60 * 60 * 1000;
  });

  // Calculate real statistical metrics from stored survey records
  const totalImages = filteredHistory.length;
  const totalAnimals = filteredHistory.reduce(
    (sum, h) => sum + (h.totalTrackedAnimals ?? h.totalAnimals ?? 0),
    0
  );
  const totalUncertain = filteredHistory.reduce((sum, h) => sum + (h.uncertainCount ?? 0), 0);

  // Aggregated species dictionary
  const speciesAggMap = new Map<string, { count: number; category: string; maxConfidence: number; minConfidence: number }>();
  filteredHistory.forEach((h) => {
    if (Array.isArray(h.detections) && h.detections.length > 0) {
      h.detections.forEach((d: any) => {
        const key = d.animalLabel.trim();
        const existing = speciesAggMap.get(key) || {
          count: 0,
          category: d.category || 'Wildlife',
          maxConfidence: d.confidence,
          minConfidence: d.confidence,
        };
        existing.count += 1;
        existing.maxConfidence = Math.max(existing.maxConfidence, d.confidence);
        existing.minConfidence = Math.min(existing.minConfidence, d.confidence);
        speciesAggMap.set(key, existing);
      });
    } else if (Array.isArray(h.tracks)) {
      h.tracks.forEach((t: any) => {
        const key = t.animalLabel.trim();
        const conf = t.averageConfidence || 0.85;
        const existing = speciesAggMap.get(key) || {
          count: 0,
          category: t.category || 'Wildlife',
          maxConfidence: conf,
          minConfidence: conf,
        };
        existing.count += 1;
        existing.maxConfidence = Math.max(existing.maxConfidence, conf);
        existing.minConfidence = Math.min(existing.minConfidence, conf);
        speciesAggMap.set(key, existing);
      });
    }
  });

  const distinctSpeciesCount = speciesAggMap.size;
  const sortedSpecies = Array.from(speciesAggMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  const maxSpeciesCount = sortedSpecies.length > 0 ? Math.max(...sortedSpecies.map((s) => s.count)) : 1;

  // Category breakdown
  const categoryMap = new Map<string, number>();
  sortedSpecies.forEach((s) => {
    categoryMap.set(s.category, (categoryMap.get(s.category) || 0) + s.count);
  });
  const categoryList = Array.from(categoryMap.entries()).map(([cat, cnt]) => ({
    cat,
    cnt,
    pct: totalAnimals > 0 ? ((cnt / totalAnimals) * 100).toFixed(1) : '0',
  }));

  // Average confidence calculation
  const allConfidences: number[] = [];
  filteredHistory.forEach((h) => {
    if (Array.isArray(h.detections)) {
      h.detections.forEach((d: any) => allConfidences.push(d.confidence));
    } else if (Array.isArray(h.tracks)) {
      h.tracks.forEach((t: any) => allConfidences.push(t.averageConfidence || 0.85));
    }
  });
  const avgConfidence = allConfidences.length > 0
    ? Math.round((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length) * 100)
    : 0;

  // Export analytics dataset as CSV
  const handleExportAnalyticsCsv = () => {
    const headers = ['species_label', 'category', 'total_count', 'share_percentage', 'max_confidence', 'min_confidence'];
    const rows = sortedSpecies.map((s) => [
      `"${s.name}"`,
      `"${s.category}"`,
      s.count,
      totalAnimals > 0 ? ((s.count / totalAnimals) * 100).toFixed(1) + '%' : '0%',
      (s.maxConfidence * 100).toFixed(0) + '%',
      (s.minConfidence * 100).toFixed(0) + '%',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wildlife_species_census_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export full survey missions log as CSV
  const handleExportMissionsCsv = () => {
    const headers = ['analysis_id', 'date_utc', 'media_type', 'filename', 'animal_count', 'distinct_species', 'primary_species', 'latitude', 'longitude', 'status'];
    const rows = filteredHistory.map((h) => {
      const isVideo = h.mediaType === 'video' || Array.isArray(h.tracks);
      const count = isVideo ? (h.totalTrackedAnimals ?? 0) : (h.totalAnimals ?? 0);
      const speciesList = (h.speciesCounts || []).map((s: any) => `${s.count ?? s.trackCount} ${s.animalLabel}`).join('; ');
      const gps = h.droneMetadata?.gps || h.gps;
      return [
        `"${h.analysisId}"`,
        `"${h.timestamp}"`,
        `"${isVideo ? 'video' : 'aerial_image'}"`,
        `"${h.filename || 'drone_survey'}"`,
        count,
        h.distinctSpeciesCount || 0,
        `"${speciesList || 'None'}"`,
        gps?.latitude ?? 'Unavailable',
        gps?.longitude ?? 'Unavailable',
        `"${h.status || 'completed'}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wildlife_drone_missions_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Analytics Header & Filter Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Ecological Reports
            </span>
            <span className="text-xs text-stone-500">
              Based on {totalImages} recorded drone survey missions
            </span>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
            Wildlife Census & Ecological Reports
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xl">
            Real-time population distributions, species frequency rankings, confidence indexes, and exportable survey census datasets.
          </p>
        </div>

        {/* Filters and CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Window Selector */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-semibold">
            {(['all', '30d', '7d'] as const).map((win) => (
              <button
                key={win}
                type="button"
                onClick={() => setSelectedTimeWindow(win)}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedTimeWindow === win
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {win === 'all' ? 'All Time' : win === '30d' ? 'Last 30 Days' : 'Last 7 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportAnalyticsCsv}
            disabled={sortedSpecies.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Export species population breakdown CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Species CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportMissionsCsv}
            disabled={filteredHistory.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Export all mission records CSV"
          >
            <Download className="w-4 h-4" />
            <span>Missions CSV</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Total Animals Counted
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-400">
              {totalAnimals}
            </span>
            <span className="text-xs text-stone-400">individuals</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Across all verified frames</p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Species Richness
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {distinctSpeciesCount}
            </span>
            <span className="text-xs text-stone-400">distinct taxa</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Identified and indexed</p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Average CV Confidence
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {avgConfidence > 0 ? `${avgConfidence}%` : '—'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Multimodal vision reliability</p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Uncertain Review Queue
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${totalUncertain > 0 ? 'text-amber-600' : 'text-stone-900 dark:text-white'}`}>
              {totalUncertain}
            </span>
            <span className="text-xs text-stone-400">flags</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {totalUncertain > 0 ? 'Manual check recommended' : 'Zero flags detected'}
          </p>
        </div>
      </div>

      {/* Main Charts & Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Species Population Distribution (Bar Chart) */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Species Census Frequency Distribution
              </h3>
            </div>
            <span className="text-xs text-stone-500">
              Ranked by total population
            </span>
          </div>

          {sortedSpecies.length === 0 ? (
            <div className="py-12 text-center text-stone-500 dark:text-stone-400 text-sm">
              No animal census records available for this time range.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sortedSpecies.map((species) => {
                const color = getSpeciesColor(species.name);
                const percent = Math.round((species.count / maxSpeciesCount) * 100);
                const sharePercent = totalAnimals > 0 ? ((species.count / totalAnimals) * 100).toFixed(1) : '0';

                return (
                  <div key={species.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color.stroke }}
                        />
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {species.name}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          ({species.category})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-stone-500 text-[11px]">
                          {sharePercent}% of total
                        </span>
                        <span className="font-mono font-bold text-stone-900 dark:text-white">
                          {species.count} animals
                        </span>
                      </div>
                    </div>

                    {/* Bar visualization */}
                    <div className="h-3.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, percent)}%`,
                          backgroundColor: color.stroke,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown & Ecological Guilds */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Taxonomic Diversity Guilds
              </h3>
            </div>

            {categoryList.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-sm">
                No taxonomy classifications yet.
              </div>
            ) : (
              <div className="space-y-4">
                {categoryList.map((cat) => (
                  <div
                    key={cat.cat}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-stone-900 dark:text-white">{cat.cat}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{cat.cnt} animals ({cat.pct}%)</span>
                    </div>
                    <div className="w-full bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-800 dark:bg-emerald-500 h-full rounded-full"
                        style={{ width: `${cat.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500">
            <span className="font-semibold block text-stone-700 dark:text-stone-300 mb-1">Conservation Notes:</span>
            Consistent aerial drone surveys enable reliable census estimations and early indicators of herd displacement.
          </div>
        </div>
      </div>

      {/* Recent Survey Missions Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-4">
          Survey Mission Records Log
        </h3>

        {filteredHistory.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-sm">
            No missions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-semibold">Survey ID</th>
                  <th className="pb-3 font-semibold">Mission Date</th>
                  <th className="pb-3 font-semibold">Image Source</th>
                  <th className="pb-3 font-semibold text-center">Animals</th>
                  <th className="pb-3 font-semibold">Dominant Species</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {filteredHistory.map((h) => (
                  <tr key={h.analysisId} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3 font-mono font-medium text-emerald-800 dark:text-emerald-400">
                      {h.analysisId}
                    </td>
                    <td className="py-3 text-stone-500">
                      {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 text-stone-800 dark:text-stone-200 truncate max-w-xs">
                      {h.filename}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-bold bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white">
                        {h.totalAnimals}
                      </span>
                    </td>
                    <td className="py-3 text-stone-600 dark:text-stone-400">
                      {(h.speciesCounts || []).map((s: any) => `${s.animalLabel} (${s.trackCount ?? s.count ?? 1})`).slice(0, 2).join(', ') || 'None'}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectSurvey(h)}
                        className="px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
