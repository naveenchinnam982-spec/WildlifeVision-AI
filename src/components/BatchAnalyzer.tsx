import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Files,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  Eye,
  Filter,
  Check,
  Zap,
} from 'lucide-react';
import { AnalysisResult, BatchImageItem, BatchSurveySummary, SpeciesCount } from '../types/wildlife';
import { optimizeImageForAnalysis } from '../utils/imageOptimizer';
import { safeApiPost, ApiError } from '../utils/apiClient';
import { downloadBatchPdfReport, downloadBatchDetailedCsv } from '../utils/reportUtils';
import { getSpeciesColor } from '../utils/colorPalette';
import { DRONE_SAMPLE_PRESETS } from '../utils/sampleImages';

interface BatchAnalyzerProps {
  onSelectResult: (result: AnalysisResult) => void;
  onAnalysisComplete?: (results: AnalysisResult[]) => void;
}

export const BatchAnalyzer: React.FC<BatchAnalyzerProps> = ({
  onSelectResult,
  onAnalysisComplete,
}) => {
  const [items, setItems] = useState<BatchImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(2); // 2 concurrent requests to avoid rate-limiting
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [batchSummary, setBatchSummary] = useState<BatchSurveySummary | null>(null);
  const [selectedResultItem, setSelectedResultItem] = useState<AnalysisResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Handle files added via file input or drag-and-drop
  const handleAddFiles = async (fileList: FileList | File[]) => {
    const newItems: BatchImageItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
        continue;
      }

      // Check for duplicate filenames
      const isDuplicate = items.some((it) => it.filename === file.name && it.sizeKb === Math.round(file.size / 1024));
      if (isDuplicate) continue;

      const previewUrl = URL.createObjectURL(file);
      const id = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      newItems.push({
        id,
        file,
        filename: file.name,
        sizeKb: Math.round(file.size / 1024),
        width: 0,
        height: 0,
        previewUrl,
        status: 'queued',
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      setBatchSummary(null);
    }
  };

  // Add sample drone preset batch
  const handleLoadSampleBatch = async () => {
    const sampleItems: BatchImageItem[] = [];
    for (const preset of DRONE_SAMPLE_PRESETS) {
      const dataUrl = preset.getDataUrl();
      const id = `sample-${preset.id}-${Date.now()}`;
      sampleItems.push({
        id,
        filename: `${preset.id}_aerial_survey.jpg`,
        sizeKb: 240,
        width: 1200,
        height: 800,
        previewUrl: dataUrl,
        status: 'queued',
      });
    }
    setItems((prev) => [...prev, ...sampleItems]);
    setBatchSummary(null);
  };

  // Remove individual item before or after processing
  const handleRemoveItem = (id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Clear all items
  const handleClearAll = () => {
    abortControllersRef.current.forEach((c) => c.abort());
    abortControllersRef.current.clear();
    setItems([]);
    setBatchSummary(null);
    setSelectedResultItem(null);
    setIsProcessing(false);
  };

  // Process a single item
  const processSingleItem = async (item: BatchImageItem): Promise<AnalysisResult> => {
    // 1. Prepare image dataUrl
    let dataUrl = item.previewUrl;
    if (item.file) {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(item.file!);
      });
    }

    // 2. Optimize client side
    const optResult = await optimizeImageForAnalysis(dataUrl, 1360, 0.86);

    // 3. Setup abort controller
    const controller = new AbortController();
    abortControllersRef.current.set(item.id, controller);

    // 4. Send to real POST /api/analyze-animal endpoint
    const payload = {
      imageDataUrl: optResult.optimizedDataUrl,
      originalImageDataUrl:
        optResult.originalDataUrl && optResult.originalDataUrl.length < 1_500_000
          ? optResult.originalDataUrl
          : undefined,
      filename: item.filename,
      imageWidth: optResult.originalWidth,
      imageHeight: optResult.originalHeight,
      clientPreprocessingMs: optResult.preprocessingTimeMs,
    };

    const result = await safeApiPost<AnalysisResult>(
      '/api/analyze-animal',
      payload,
      controller.signal
    );

    if (optResult.originalDataUrl) {
      result.imageDataUrl = optResult.originalDataUrl;
    }

    abortControllersRef.current.delete(item.id);
    return result;
  };

  // Run Batch Analysis with Controlled Concurrency
  const handleRunBatch = async () => {
    if (isProcessing) return;

    const queuedItems = items.filter((it) => it.status === 'queued' || it.status === 'failed');
    if (queuedItems.length === 0) return;

    setIsProcessing(true);
    const startTime = new Date().toISOString();
    const successfulResults: AnalysisResult[] = [];

    // Worker pool queue
    const queue = [...queuedItems];
    const totalToProcess = queuedItems.length;

    const runWorker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        // Set item to processing
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'processing', error: undefined } : it
          )
        );

        try {
          const res = await processSingleItem(item);
          successfulResults.push(res);

          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'completed',
                    result: res,
                    width: res.imageWidth,
                    height: res.imageHeight,
                  }
                : it
            )
          );
        } catch (err: unknown) {
          const msg =
            err instanceof ApiError
              ? `${err.code ? `[${err.code}] ` : ''}${err.message}`
              : err instanceof Error
              ? err.message
              : 'Detection failed';

          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'failed', error: msg }
                : it
            )
          );
        }
      }
    };

    // Run parallel workers up to concurrency limit
    const workers = [];
    const activeConcurrency = Math.min(concurrencyLimit, totalToProcess);
    for (let i = 0; i < activeConcurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    setIsProcessing(false);

    // Compute consolidated batch summary from validated results
    const currentCompleted = items
      .map((it) => it.result)
      .filter((r): r is AnalysisResult => Boolean(r));
    const allSuccessful = [...currentCompleted, ...successfulResults.filter(
      (sr) => !currentCompleted.some((c) => c.analysisId === sr.analysisId)
    )];

    if (allSuccessful.length > 0) {
      const speciesMap = new Map<string, { count: number; category?: string; status: string }>();
      let totalAnimals = 0;
      let totalUncertain = 0;

      allSuccessful.forEach((res) => {
        totalAnimals += res.totalAnimals;
        totalUncertain += res.uncertainCount;
        res.speciesCounts.forEach((sc) => {
          const label = sc.animalLabel.trim();
          const existing = speciesMap.get(label) || { count: 0, category: sc.category, status: sc.status };
          existing.count += sc.count;
          speciesMap.set(label, existing);
        });
      });

      const aggregatedSpecies: SpeciesCount[] = Array.from(speciesMap.entries()).map(([k, v]) => ({
        animalLabel: k,
        count: v.count,
        category: v.category,
        status: (v.status as any) || 'identified',
      })).sort((a, b) => b.count - a.count);

      const summary: BatchSurveySummary = {
        batchId: `BATCH-${Date.now().toString().slice(-6)}`,
        totalImages: items.length,
        completedImages: allSuccessful.length,
        failedImages: items.filter((it) => it.status === 'failed').length,
        totalAnimalsDetected: totalAnimals,
        distinctSpeciesCount: aggregatedSpecies.length,
        speciesCounts: aggregatedSpecies,
        uncertainDetections: totalUncertain,
        startTime,
        endTime: new Date().toISOString(),
      };

      setBatchSummary(summary);
      if (onAnalysisComplete) {
        onAnalysisComplete(allSuccessful);
      }
    }
  };

  // Retry an individual failed image
  const handleRetryItem = async (id: string) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: 'processing', error: undefined } : it))
    );

    try {
      const res = await processSingleItem(item);
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                status: 'completed',
                result: res,
                width: res.imageWidth,
                height: res.imageHeight,
              }
            : it
        )
      );
      if (onAnalysisComplete) {
        onAnalysisComplete([res]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: 'failed', error: msg } : it))
      );
    }
  };

  const handleExportConsolidatedPdf = async () => {
    if (!batchSummary) return;
    const completedResults = items
      .map((it) => it.result)
      .filter((r): r is AnalysisResult => Boolean(r));

    try {
      setIsExportingPdf(true);
      await downloadBatchPdfReport(batchSummary, completedResults);
    } catch (err) {
      console.error('Batch PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportConsolidatedCsv = () => {
    if (!batchSummary) return;
    const completedResults = items
      .map((it) => it.result)
      .filter((r): r is AnalysisResult => Boolean(r));
    downloadBatchDetailedCsv(completedResults, batchSummary.batchId);
  };

  // Filter items for display
  const displayedItems = items.filter((it) => {
    if (filterStatus === 'all') return true;
    return it.status === filterStatus;
  });

  const queuedCount = items.filter((it) => it.status === 'queued').length;
  const processingCount = items.filter((it) => it.status === 'processing').length;
  const completedCount = items.filter((it) => it.status === 'completed').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Batch Pipeline
            </span>
            <span className="text-xs text-stone-500">
              {items.length} Images Loaded • Concurrency: {concurrencyLimit}x
            </span>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
            Batch Aerial Wildlife Analysis
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xl">
            Upload multiple drone mission photographs for concurrent wildlife detection, species counting, and automated consolidated survey reporting.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleRunBatch}
              disabled={isProcessing || queuedCount + failedCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Batch ({completedCount}/{items.length})...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Analyze All ({queuedCount + failedCount})</span>
                </>
              )}
            </button>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Drop Zone & Sample Loader */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) handleAddFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
          dragActive
            ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20'
            : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900/60 hover:border-emerald-500/60 hover:bg-stone-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            if (e.target.files) handleAddFiles(e.target.files);
          }}
          className="hidden"
          id="batch-file-input"
        />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shadow-sm">
            <Files className="w-6 h-6" />
          </div>

          <div className="text-center sm:text-left">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Select or Drop Multiple Drone Survey Images
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Supports JPEG, PNG, and WebP (up to 25MB each). Queue as many images as needed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="batch-file-input"
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs transition shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Add Images
            </label>

            <button
              type="button"
              onClick={handleLoadSampleBatch}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 text-stone-700 dark:text-stone-300 text-xs font-medium transition cursor-pointer"
            >
              <span>+ Load 3 Drone Presets</span>
            </button>
          </div>
        </div>

        {/* Rate-limit Protection & Concurrency Settings */}
        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Rate-limit safe: Requests are dispatched through a controlled concurrency pool.</span>
          </span>

          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span>Concurrency limit:</span>
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setConcurrencyLimit(num)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold transition ${
                  concurrencyLimit === num
                    ? 'bg-emerald-800 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                {num}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Batch Summary & Consolidated Reporting Banner (if available) */}
      {batchSummary && (
        <div className="bg-emerald-950/20 dark:bg-emerald-950/40 rounded-2xl border border-emerald-800/40 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-800/30">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                {batchSummary.batchId}
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                Consolidated Survey Census Summary
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportConsolidatedPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{isExportingPdf ? 'Exporting PDF...' : 'Download Consolidated PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportConsolidatedCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-medium transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Batch CSV</span>
              </button>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/80 dark:bg-stone-900/80 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-semibold text-stone-500 uppercase">Total Animals</span>
              <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 mt-1">
                {batchSummary.totalAnimalsDetected}
              </p>
              <p className="text-[10px] text-stone-400">across {batchSummary.completedImages} frames</p>
            </div>

            <div className="bg-white/80 dark:bg-stone-900/80 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-semibold text-stone-500 uppercase">Species Diversity</span>
              <p className="text-2xl font-extrabold text-stone-900 dark:text-white mt-1">
                {batchSummary.distinctSpeciesCount}
              </p>
              <p className="text-[10px] text-stone-400">distinct taxa identified</p>
            </div>

            <div className="bg-white/80 dark:bg-stone-900/80 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-semibold text-stone-500 uppercase">Analysis Success</span>
              <p className="text-2xl font-extrabold text-stone-900 dark:text-white mt-1">
                {batchSummary.completedImages} / {batchSummary.totalImages}
              </p>
              <p className="text-[10px] text-stone-400">{batchSummary.failedImages} errors excluded</p>
            </div>

            <div className="bg-white/80 dark:bg-stone-900/80 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-semibold text-stone-500 uppercase">Review Flags</span>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">
                {batchSummary.uncertainDetections}
              </p>
              <p className="text-[10px] text-stone-400">uncertain classifications</p>
            </div>
          </div>

          {/* Aggregated species distribution pills */}
          {batchSummary.speciesCounts.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-2">
                Census by Species:
              </span>
              <div className="flex flex-wrap gap-2">
                {batchSummary.speciesCounts.map((sc) => {
                  const color = getSpeciesColor(sc.animalLabel);
                  return (
                    <span
                      key={sc.animalLabel}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color.stroke }}
                      />
                      <span className="text-stone-900 dark:text-stone-100">{sc.animalLabel}</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {sc.count}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Items List Table */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Queued Survey Frames ({items.length})
            </h3>

            {/* Filter status buttons */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-stone-400 mr-1">Status:</span>
              {[
                { id: 'all', label: `All (${items.length})` },
                { id: 'completed', label: `Done (${completedCount})` },
                { id: 'queued', label: `Queued (${queuedCount})` },
                { id: 'failed', label: `Failed (${failedCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    filterStatus === f.id
                      ? 'bg-emerald-800 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {displayedItems.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 dark:hover:bg-stone-850/40 rounded-xl px-2 transition"
              >
                {/* Thumbnail & File Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700 relative">
                    <img
                      src={item.previewUrl}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                    />
                    {item.status === 'processing' && (
                      <div className="absolute inset-0 bg-stone-950/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                      {item.filename}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {item.sizeKb} KB
                      {item.width > 0 && ` • ${item.width} × ${item.height} px`}
                    </p>

                    {item.result && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {item.result.totalAnimals} Animals
                        </span>
                        <span className="text-stone-400">•</span>
                        <span className="text-stone-600 dark:text-stone-300">
                          {item.result.speciesCounts.map((sc) => `${sc.count} ${sc.animalLabel}`).join(', ') || 'No wildlife'}
                        </span>
                      </div>
                    )}

                    {item.error && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{item.error}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Badge & Individual Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {item.status === 'queued' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      <Clock className="w-3 h-3 text-stone-400" />
                      Queued
                    </span>
                  )}

                  {item.status === 'processing' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      Processing
                    </span>
                  )}

                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Completed
                    </span>
                  )}

                  {item.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => handleRetryItem(item.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 hover:bg-red-200 cursor-pointer"
                      title="Retry this failed image"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  )}

                  {item.result && (
                    <button
                      type="button"
                      onClick={() => onSelectResult(item.result!)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
                      title="View full bounding box canvas & species census"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View Results</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={item.status === 'processing'}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-40"
                    title="Remove from batch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
