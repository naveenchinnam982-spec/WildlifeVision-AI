import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Film,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Activity,
  Compass,
  ArrowRight,
  Filter,
  MapPin,
  MapPinOff,
} from 'lucide-react';
import { VideoAnalysisResult } from '../types/wildlife';
import { VideoPlayerOverlay } from './VideoPlayerOverlay';
import {
  downloadVideoPdfReport,
  downloadVideoTracksCsv,
  downloadVideoFramesCsv,
} from '../utils/reportUtils';

interface VideoResultsProps {
  videoResult: VideoAnalysisResult;
  onReset: () => void;
  onViewOnMap?: () => void;
}

export const VideoResults: React.FC<VideoResultsProps> = ({ videoResult, onReset, onViewOnMap }) => {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadVideoPdfReport(videoResult);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filteredTracks = React.useMemo(() => {
    if (!selectedSpecies) return videoResult.tracks;
    return videoResult.tracks.filter(
      (t) => t.animalLabel.toLowerCase() === selectedSpecies.toLowerCase()
    );
  }, [videoResult.tracks, selectedSpecies]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Video Survey Complete
            </span>
            <span className="text-xs font-mono text-stone-500">
              {videoResult.analysisId}
            </span>
            {videoResult.droneMetadata?.gps && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-600" />
                <span>
                  {videoResult.droneMetadata.gps.latitude.toFixed(4)}°, {videoResult.droneMetadata.gps.longitude.toFixed(4)}°
                  {videoResult.droneMetadata.gps.altitudeMeters ? ` (Alt: ${videoResult.droneMetadata.gps.altitudeMeters}m)` : ''}
                </span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-600" />
            <span>{videoResult.filename}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Duration: {videoResult.durationSec.toFixed(1)}s
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Analyzed Keyframes: {videoResult.totalFramesAnalyzed} ({videoResult.samplingIntervalSec}s interval)
            </span>
            <span>•</span>
            <span>Proc: {(videoResult.processingTimeMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Export & Reset Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer transition shadow-sm disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => downloadVideoTracksCsv(videoResult)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition border border-stone-300 dark:border-stone-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tracks CSV</span>
          </button>

          <button
            type="button"
            onClick={() => downloadVideoFramesCsv(videoResult)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition border border-stone-300 dark:border-stone-700"
            title="Download detailed per-frame detections CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Frame Detections</span>
          </button>

          {onViewOnMap && (
            <button
              type="button"
              onClick={onViewOnMap}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 text-xs font-semibold cursor-pointer transition shadow-xs"
              title="View this drone video mission on the Geospatial Wildlife Map"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>View on Map</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Analyze Another Video</span>
          </button>
        </div>
      </div>

      {/* Primary Census Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Final Video Count / Unique Tracked Animals */}
        <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Final Video Count
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
              {videoResult.totalTrackedAnimals}
            </span>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 mt-0.5">
              Unique animals confirmed (ByteTrack deduplicated)
            </p>
          </div>
        </div>

        {/* Metric 2: Total Frame Sightings */}
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Frame Sightings
            </span>
            <Film className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {videoResult.totalFrameDetections}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Raw frame detections before tracking deduplication
            </p>
          </div>
        </div>

        {/* Metric 3: Species Diversity */}
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Distinct Species
            </span>
            <Layers className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {videoResult.distinctSpeciesCount}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Identified wildlife taxa
            </p>
          </div>
        </div>

        {/* Metric 4: Keyframe Sampling Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Frames Analyzed
            </span>
            <Activity className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
              {videoResult.totalFramesAnalyzed}
            </span>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Sampled every {videoResult.samplingIntervalSec}s
            </p>
          </div>
        </div>
      </div>

      {/* Main View: Synchronized Video Player Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Player (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span>Synchronized Video & Track Overlay</span>
              </h3>
              <span className="text-xs text-stone-500">
                Click any box to inspect track details
              </span>
            </div>
            <VideoPlayerOverlay
              videoResult={videoResult}
              selectedTrackId={selectedTrackId}
              selectedSpecies={selectedSpecies}
              onSelectTrack={(id) => setSelectedTrackId(id)}
            />
          </div>

          {/* Interactive Species Filter Badges */}
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>Species-Wise Unique Track Counts</span>
              </span>
              {selectedSpecies && (
                <button
                  type="button"
                  onClick={() => setSelectedSpecies(null)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {videoResult.speciesCounts.map((sc) => {
                const isSelected =
                  selectedSpecies?.toLowerCase() === sc.animalLabel.toLowerCase();
                return (
                  <button
                    key={sc.animalLabel}
                    type="button"
                    onClick={() =>
                      setSelectedSpecies(isSelected ? null : sc.animalLabel)
                    }
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition border ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <span>{sc.animalLabel}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelected
                          ? 'bg-emerald-700 text-emerald-100'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      }`}
                    >
                      {sc.trackCount} track{sc.trackCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] opacity-70">
                      ({sc.totalDetections} frame sightings)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Track Timeline & Manifest (1 col) */}
        <div className="space-y-4">
          {/* Visual Track Timeline (Gantt view) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
              <span>Animal Sighting Timeline</span>
              <span className="font-mono text-[10px] text-stone-400">
                0s – {videoResult.durationSec.toFixed(1)}s
              </span>
            </h3>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredTracks.map((track) => {
                const isSelected = selectedTrackId === track.trackId;
                const leftPct = (track.firstSeenSec / (videoResult.durationSec || 1)) * 100;
                const widthPct = Math.max(
                  8,
                  ((track.durationSec || 0.8) / (videoResult.durationSec || 1)) * 100
                );
                const color = track.color || '#10b981';

                return (
                  <div
                    key={track.trackId}
                    onClick={() =>
                      setSelectedTrackId(isSelected ? null : track.trackId)
                    }
                    className={`p-2.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{ backgroundColor: color }}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                        />
                        <span className="font-mono font-bold text-stone-900 dark:text-white">
                          {track.trackId}
                        </span>
                        <span className="font-semibold text-stone-700 dark:text-stone-300">
                          {track.animalLabel}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-stone-500">
                        {track.firstSeenSec.toFixed(1)}s – {track.lastSeenSec.toFixed(1)}s
                      </span>
                    </div>

                    {/* Timeline bar */}
                    <div className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full relative overflow-hidden">
                      <div
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: color,
                        }}
                        className="absolute h-full rounded-full transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
                      <span>Visible in {track.detectionCount} frames</span>
                      <span>Avg Conf: {(track.averageConfidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drone Mission Telemetry & GPS */}
          {videoResult.droneMetadata && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white">
                <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Drone Flight Telemetry & GPS</span>
              </div>
              <div className="space-y-1.5 text-stone-600 dark:text-stone-300">
                <div className="flex justify-between">
                  <span className="text-stone-500">Sensor Altitude:</span>
                  <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                    {videoResult.droneMetadata.altitudeMeters || 45}m AGL
                  </span>
                </div>
                {videoResult.droneMetadata.gps ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">GPS Coordinates:</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        {videoResult.droneMetadata.gps.latitude.toFixed(5)}°, {videoResult.droneMetadata.gps.longitude.toFixed(5)}°
                      </span>
                    </div>
                    {videoResult.droneMetadata.gps?.locationName && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Survey Site:</span>
                        <span className="text-stone-800 dark:text-stone-200 font-medium truncate max-w-[190px]" title={videoResult.droneMetadata.gps.locationName}>
                          {videoResult.droneMetadata.gps.locationName}
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
                <div className="flex justify-between">
                  <span className="text-stone-500">Sensor Payload:</span>
                  <span className="text-stone-800 dark:text-stone-200 truncate max-w-[190px]">
                    {videoResult.droneMetadata.sensorType || 'Optical RGB 4K'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Biologist Methodology & Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>Tracking Methodology Disclosure</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {videoResult.methodology} A track represents an estimated individual animal sighting across consecutive flight frames. Temporary occlusions or camera turns may create separate track IDs.
            </p>
          </div>
        </div>
      </div>

      {/* Persistent Track Manifest Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Persistent Animal Tracks Manifest
            </h3>
            <p className="text-xs text-stone-500">
              Full registry of distinct tracked animals localized across video keyframes
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            {filteredTracks.length} active record{filteredTracks.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <th className="py-2.5 px-3">Track ID</th>
                <th className="py-2.5 px-3">Species Taxon</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Time Window</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Sightings</th>
                <th className="py-2.5 px-3">Avg Confidence</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredTracks.map((t) => (
                <tr
                  key={t.trackId}
                  onClick={() => setSelectedTrackId(t.trackId)}
                  className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition ${
                    selectedTrackId === t.trackId
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                      : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold flex items-center gap-2">
                    <span
                      style={{ backgroundColor: t.color || '#10b981' }}
                      className="w-2.5 h-2.5 rounded-full"
                    />
                    <span>{t.trackId}</span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-stone-900 dark:text-white">
                    {t.animalLabel}
                  </td>
                  <td className="py-2.5 px-3 text-stone-500">{t.category}</td>
                  <td className="py-2.5 px-3 font-mono text-stone-600 dark:text-stone-300">
                    {t.firstSeenSec.toFixed(1)}s – {t.lastSeenSec.toFixed(1)}s
                  </td>
                  <td className="py-2.5 px-3">{t.durationSec.toFixed(1)}s</td>
                  <td className="py-2.5 px-3">{t.detectionCount} frames</td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                    {(t.averageConfidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      {t.identificationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
