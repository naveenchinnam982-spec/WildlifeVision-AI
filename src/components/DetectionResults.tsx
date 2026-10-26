import React, { useState } from 'react';
import { AnalysisResult } from '../types/wildlife';
import { AnnotatedCanvas } from './AnnotatedCanvas';
import { getSpeciesColor } from '../utils/colorPalette';
import {
  downloadPdfReport,
  downloadDetailedCsv,
  downloadSpeciesSummaryCsv,
} from '../utils/reportUtils';
import {
  FileText,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Compass,
  Crosshair,
  Filter,
  Zap,
  Gauge,
  MapPin,
  MapPinOff,
} from 'lucide-react';

interface DetectionResultsProps {
  analysis: AnalysisResult;
  onReset: () => void;
  onViewOnMap?: () => void;
}

export const DetectionResults: React.FC<DetectionResultsProps> = ({
  analysis,
  onReset,
  onViewOnMap,
}) => {
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [filteredSpecies, setFilteredSpecies] = useState<string | null>(null);
  const [annotatedCanvasElem, setAnnotatedCanvasElem] = useState<HTMLCanvasElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const canvasDataUrl = annotatedCanvasElem ? annotatedCanvasElem.toDataURL('image/jpeg', 0.9) : undefined;
      await downloadPdfReport(analysis, canvasDataUrl);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {analysis.analysisId}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(analysis.timestamp).toLocaleString()}
            </span>
            {analysis.processingTimeMs && (
              <span className="text-xs text-stone-400">
                • {analysis.processingTimeMs}ms
              </span>
            )}
            {analysis.droneMetadata?.gps && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-600" />
                <span>
                  {analysis.droneMetadata.gps.latitude.toFixed(4)}°, {analysis.droneMetadata.gps.longitude.toFixed(4)}°
                  {analysis.droneMetadata.gps.altitudeMeters ? ` (Alt: ${analysis.droneMetadata.gps.altitudeMeters}m)` : ''}
                </span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">
            Aerial Wildlife Survey Results
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Image: {analysis.filename} ({analysis.imageWidth} × {analysis.imageHeight} px)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Generate and download formatted PDF Wildlife Survey Report"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPdf ? 'Exporting PDF...' : 'Download PDF Report'}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadDetailedCsv(analysis)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 text-xs font-medium transition cursor-pointer"
            title="Download row-by-row detection CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Detailed CSV</span>
          </button>

          <button
            type="button"
            onClick={() => downloadSpeciesSummaryCsv(analysis)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 text-xs font-medium transition cursor-pointer"
            title="Download species-level census summary CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            <span>Species CSV</span>
          </button>

          {onViewOnMap && (
            <button
              type="button"
              onClick={onViewOnMap}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 text-xs font-semibold transition cursor-pointer"
              title="View on Geospatial Wildlife Map"
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>View on Map</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 transition cursor-pointer"
            title="Print Survey Report"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Analyze Another</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Animals */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Total Animals
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-400">
              {analysis.totalAnimals}
            </span>
            <span className="text-xs text-stone-500">individuals</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Validated distinct counts
          </p>
        </div>

        {/* Distinct Species */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Species Diversity
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {analysis.distinctSpeciesCount}
            </span>
            <span className="text-xs text-stone-500">taxa</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Species identified
          </p>
        </div>

        {/* Status / Confidence */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Analysis Status
          </p>
          <div className="flex items-center gap-2 mt-2">
            {analysis.totalAnimals > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                <HelpCircle className="w-3.5 h-3.5" />
                Zero Wildlife
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5">
            Multimodal CV Pipeline
          </p>
        </div>

        {/* Review / Uncertainty */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Review Flag
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-3xl font-extrabold ${
                analysis.uncertainCount > 0 ? 'text-amber-600' : 'text-stone-700 dark:text-stone-300'
              }`}
            >
              {analysis.uncertainCount}
            </span>
            <span className="text-xs text-stone-500">uncertain</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            {analysis.uncertainCount > 0 ? 'Requires biologist review' : 'High certainty'}
          </p>
        </div>
      </div>

      {/* Optimized Performance & Inference Telemetry Bar */}
      {analysis.performanceMetrics && (
        <div className="bg-emerald-950/20 dark:bg-emerald-950/40 rounded-2xl border border-emerald-800/40 p-4 shadow-sm text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-emerald-800/30">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold">
              <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Pipeline Performance & Latency Telemetry</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
              <Gauge className="w-3.5 h-3.5" />
              <span>Total Pipeline: <strong>{analysis.performanceMetrics.totalTimeMs}ms</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="space-y-0.5">
              <span className="text-stone-500 dark:text-stone-400 text-[11px]">Client Preprocessing</span>
              <p className="font-mono font-bold text-stone-900 dark:text-white">
                {analysis.performanceMetrics.clientPreprocessingMs}ms
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-stone-500 dark:text-stone-400 text-[11px]">AI Vision Inference</span>
              <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {analysis.performanceMetrics.aiInferenceMs}ms
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-stone-500 dark:text-stone-400 text-[11px]">Validation & Deduplication</span>
              <p className="font-mono font-bold text-stone-900 dark:text-white">
                {analysis.performanceMetrics.validationAndDeduplicationMs}ms
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-stone-500 dark:text-stone-400 text-[11px]">Payload Optimization</span>
              <p className="font-mono font-bold text-stone-900 dark:text-white">
                {analysis.performanceMetrics.optimizationRatioPct > 0
                  ? `-${analysis.performanceMetrics.optimizationRatioPct}% (${analysis.performanceMetrics.payloadSizeOptimizedKb}KB)`
                  : `${analysis.performanceMetrics.payloadSizeOptimizedKb}KB`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Annotation Canvas */}
      <AnnotatedCanvas
        imageDataUrl={analysis.imageDataUrl}
        detections={analysis.detections}
        imageWidth={analysis.imageWidth}
        imageHeight={analysis.imageHeight}
        selectedDetectionId={selectedDetectionId}
        onSelectDetection={setSelectedDetectionId}
        filteredSpecies={filteredSpecies}
        onAnnotatedCanvasReady={setAnnotatedCanvasElem}
      />

      {/* Species Filter Pills & Legend */}
      {analysis.speciesCounts.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 mr-2">
            <Filter className="w-3.5 h-3.5 text-emerald-700" />
            <span>Filter Canvas:</span>
          </div>

          <button
            type="button"
            onClick={() => setFilteredSpecies(null)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              filteredSpecies === null
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            All Species ({analysis.totalAnimals})
          </button>

          {analysis.speciesCounts.map((sc) => {
            const color = getSpeciesColor(sc.animalLabel);
            const isSelected = filteredSpecies?.toLowerCase() === sc.animalLabel.toLowerCase();
            return (
              <button
                key={sc.animalLabel}
                type="button"
                onClick={() =>
                  setFilteredSpecies(isSelected ? null : sc.animalLabel)
                }
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium border transition ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 shadow-sm'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color.stroke }}
                />
                <span>{sc.animalLabel}</span>
                <span className="font-bold">({sc.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Species Census Table & Environmental Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Species Breakdown Table */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Species Census Summary
            </h3>
            <span className="text-xs text-stone-500">
              {analysis.speciesCounts.length} Distinct taxa
            </span>
          </div>

          {analysis.speciesCounts.length === 0 ? (
            <div className="py-8 text-center text-stone-500 dark:text-stone-400 text-sm">
              No animals detected in this image.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 uppercase tracking-wider text-[11px]">
                    <th className="pb-3 font-semibold">Species</th>
                    <th className="pb-3 font-semibold">Taxonomic Category</th>
                    <th className="pb-3 font-semibold text-center">Count</th>
                    <th className="pb-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {analysis.speciesCounts.map((sc) => {
                    const color = getSpeciesColor(sc.animalLabel);
                    return (
                      <tr key={sc.animalLabel} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                        <td className="py-3 font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color.stroke }}
                          />
                          {sc.animalLabel}
                        </td>
                        <td className="py-3 text-stone-600 dark:text-stone-400">
                          {sc.category || 'Wildlife'}
                        </td>
                        <td className="py-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-bold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                            {sc.count}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              sc.status === 'identified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {sc.status === 'identified' ? 'Identified' : 'Needs Review'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-white bg-stone-50/50 dark:bg-stone-800/30">
                    <td className="py-3">Total Detections</td>
                    <td className="py-3 text-stone-500 font-normal">All Categories</td>
                    <td className="py-3 text-center text-emerald-700 dark:text-emerald-400 text-sm">
                      {analysis.totalAnimals}
                    </td>
                    <td className="py-3 text-right text-stone-500 font-normal">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Environmental Summary & Drone Mission Metadata */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-700" />
            Field & Scene Context
          </h3>

          <div className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/60 leading-relaxed">
            {analysis.summary || 'Aerial computer vision survey successfully completed.'}
          </div>

          {/* Warnings if any */}
          {analysis.warnings && analysis.warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Environmental & Sensor Observations:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400 pl-1">
                {analysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Drone Telemetry Info */}
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-xs space-y-2">
            <div className="flex justify-between text-stone-500">
              <span>Sensor Altitude:</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">
                {analysis.droneMetadata?.altitudeMeters || 45}m AGL
              </span>
            </div>
            {analysis.droneMetadata?.gps ? (
              <>
                <div className="flex justify-between text-stone-500">
                  <span>GPS Coordinates:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    {analysis.droneMetadata.gps.latitude.toFixed(5)}°, {analysis.droneMetadata.gps.longitude.toFixed(5)}°
                  </span>
                </div>
                {analysis.droneMetadata.gps.locationName && (
                  <div className="flex justify-between text-stone-500">
                    <span>Survey Site:</span>
                    <span className="text-stone-800 dark:text-stone-200 font-medium truncate max-w-[200px]" title={analysis.droneMetadata.gps.locationName}>
                      {analysis.droneMetadata.gps.locationName}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between items-center text-stone-500">
                <span>GPS Coordinates:</span>
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-xs">
                  <MapPinOff className="w-3.5 h-3.5" />
                  Location unavailable
                </span>
              </div>
            )}
            <div className="flex justify-between text-stone-500">
              <span>Coordinate Scale:</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">
                0-1000 Normalized
              </span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Computer Vision Engine:</span>
              <span className="text-stone-800 dark:text-stone-200">
                Gemini 3.8 Flash
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Detections Log Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Individual Detection Records
            </h3>
            <p className="text-xs text-stone-500">
              Every localized animal with model-estimated confidence and bounding box boundaries
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
            {analysis.detections.length} Total Localized Boxes
          </span>
        </div>

        {analysis.detections.length === 0 ? (
          <div className="py-6 text-center text-stone-500 text-xs">
            No animal bounding boxes to display.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-semibold">ID</th>
                  <th className="pb-3 font-semibold">Animal Species</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Confidence</th>
                  <th className="pb-3 font-semibold">Bounding Box [xMin, yMin, xMax, yMax]</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Highlight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-mono text-[12px]">
                {analysis.detections.map((det) => {
                  const isSelected = selectedDetectionId === det.detectionId;
                  const color = getSpeciesColor(det.animalLabel);
                  const b = det.boundingBox;
                  const confPct = Math.round(det.confidence * 100);

                  return (
                    <tr
                      key={det.detectionId}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                          : 'hover:bg-stone-50/70 dark:hover:bg-stone-800/40 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <td className="py-3 font-bold text-stone-900 dark:text-white">
                        {det.detectionId}
                      </td>
                      <td className="py-3 font-sans font-semibold flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color.stroke }}
                        />
                        {det.animalLabel}
                      </td>
                      <td className="py-3 font-sans text-stone-500">
                        {det.category}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${confPct}%` }}
                            />
                          </div>
                          <span>{confPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-stone-600 dark:text-stone-400">
                        [{b.xMin}, {b.yMin}, {b.xMax}, {b.yMax}]
                      </td>
                      <td className="py-3 font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            det.identificationStatus === 'identified'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {det.identificationStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDetectionId(
                              isSelected ? null : det.detectionId
                            )
                          }
                          className={`p-1.5 rounded transition ${
                            isSelected
                              ? 'bg-amber-500 text-white'
                              : 'hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-700'
                          }`}
                          title="Locate and highlight bounding box on image"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
