import React, { useState } from 'react';
import { AnalysisResult } from '../types/wildlife';
import {
  Trash2,
  Eye,
  FileSpreadsheet,
  Search,
  Calendar,
  Layers,
  Camera,
  AlertCircle,
  Film,
} from 'lucide-react';
import { downloadDetailedCsv } from '../utils/reportUtils';

interface HistoryViewProps {
  history: any[];
  onSelectHistoryItem: (item: any) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onAnalyzeNew: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onClearAllHistory,
  onAnalyzeNew,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const filteredHistory = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const idMatch = item.analysisId.toLowerCase().includes(term);
    const fileMatch = item.filename.toLowerCase().includes(term);
    const speciesMatch = (item.speciesCounts || []).some((sc: any) =>
      (sc.animalLabel || '').toLowerCase().includes(term)
    );
    return idMatch || fileMatch || speciesMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">
            Survey Mission History
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Archived aerial animal detections, bounding box logs, and census records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {history.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">Delete all records?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllHistory();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-300 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )
          )}
          <button
            type="button"
            onClick={onAnalyzeNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition cursor-pointer"
          >
            <span>New Drone Survey</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      {history.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Survey ID, species name (e.g. Elephant, Zebra), or filename..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
      )}

      {/* List or Empty State */}
      {history.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-stone-900 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 p-8 space-y-3">
          <Camera className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
            No Survey History Found
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Analyze your first drone aerial image to create and store persistent wildlife census records.
          </p>
          <button
            type="button"
            onClick={onAnalyzeNew}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition cursor-pointer"
          >
            <span>Analyze Drone Image Now</span>
          </button>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 text-stone-500 text-xs">
          No missions match your search query &quot;{searchTerm}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.map((item) => (
            <div
              key={item.analysisId}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm hover:border-emerald-600/60 dark:hover:border-emerald-500/60 transition flex flex-col justify-between group"
            >
              {/* Media Preview Thumbnail */}
              <div
                className="relative h-44 bg-stone-950 cursor-pointer overflow-hidden flex items-center justify-center"
                onClick={() => onSelectHistoryItem(item)}
              >
                {item.mediaType === 'video' || item.videoUrl ? (
                  item.imageDataUrl ? (
                    <img
                      src={item.imageDataUrl}
                      alt={item.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center text-emerald-400 gap-2">
                      <Film className="w-12 h-12" />
                      <span className="text-xs font-mono text-stone-300">{item.durationSec?.toFixed(1)}s Video Survey</span>
                    </div>
                  )
                ) : (
                  <img
                    src={item.imageDataUrl}
                    alt={item.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                )}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-black/75 text-emerald-400 backdrop-blur flex items-center gap-1">
                  {item.mediaType === 'video' && <Film className="w-3 h-3 text-emerald-400" />}
                  <span>{item.analysisId}</span>
                </div>
                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-800/90 text-white backdrop-blur">
                  {item.totalTrackedAnimals ?? item.totalAnimals ?? 0} {item.mediaType === 'video' ? 'Tracked' : 'Animal'}{(item.totalTrackedAnimals ?? item.totalAnimals) === 1 ? '' : 's'}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                    <span>{item.imageWidth}×{item.imageHeight} px</span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                    {item.filename}
                  </h4>

                  {/* Species tags */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {(item.speciesCounts || []).slice(0, 3).map((sc: any) => (
                      <span
                        key={sc.animalLabel}
                        className="px-2 py-0.5 rounded text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium"
                      >
                        {sc.animalLabel} ({sc.trackCount ?? sc.count ?? 1})
                      </span>
                    ))}
                    {item.speciesCounts.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500">
                        +{item.speciesCounts.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectHistoryItem(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-800/10 hover:bg-emerald-800 text-emerald-800 hover:text-white dark:text-emerald-300 dark:hover:text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Survey</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => downloadDetailedCsv(item)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                      title="Download CSV"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHistoryItem(item.analysisId)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
