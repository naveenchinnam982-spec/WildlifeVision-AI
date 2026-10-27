import React, { useState, useRef } from 'react';
import {
  Upload,
  Film,
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
  X,
  ArrowRight,
  StopCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Layers,
  Compass,
} from 'lucide-react';
import { VideoAnalysisResult } from '../types/wildlife';
import { SAMPLE_VIDEO_PRESETS } from '../utils/sampleVideos';
import { safeApiPost, ApiError } from '../utils/apiClient';

interface VideoAnalyzerProps {
  onAnalysisComplete: (result: VideoAnalysisResult) => void;
  onSwitchToImage?: (file?: File) => void;
  initialFile?: File | null;
}

export const VideoAnalyzer: React.FC<VideoAnalyzerProps> = ({
  onAnalysisComplete,
  onSwitchToImage,
  initialFile,
}) => {
  const [selectedVideo, setSelectedVideo] = useState<{
    file?: File;
    url: string;
    name: string;
    sizeMb: number;
    durationSec: number;
    width: number;
    height: number;
  } | null>(null);

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [analysisProgressPct, setAnalysisProgressPct] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isGeneratingPreset, setIsGeneratingPreset] = useState<boolean>(false);
  const [videoGps, setVideoGps] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Live timer effect during video processing
  React.useEffect(() => {
    if (!isAnalyzing) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - start) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const MAX_SIZE_MB = 50;
  const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

  // Read video file metadata
  const handleFileSelected = (file: File) => {
    setValidationError(null);

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase()) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
      setValidationError(
        `Unsupported video format "${file.type || 'unknown'}". Please upload an MP4 or WebM video.`
      );
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setValidationError(
        `Video size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${MAX_SIZE_MB}MB.`
      );
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      setSelectedVideo({
        file,
        url,
        name: file.name,
        sizeMb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
        durationSec: video.duration || 0,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      });
    };

    video.onerror = () => {
      setValidationError('Failed to decode video metadata. The file may be corrupt.');
    };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // Load a synthetic preset video with one click
  const handleLoadPreset = async (presetId: string) => {
    const preset = SAMPLE_VIDEO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setIsGeneratingPreset(true);
    setValidationError(null);

    try {
      const blob = await preset.generateBlob();
      const url = URL.createObjectURL(blob);
      const filename = `${preset.id}_drone.webm`;
      const file = new File([blob], filename, { type: blob.type });

      setSelectedVideo({
        file,
        url,
        name: `${preset.title} (${preset.durationSec.toFixed(1)}s)`,
        sizeMb: Math.round((blob.size / (1024 * 1024)) * 10) / 10 || 0.8,
        durationSec: preset.durationSec,
        width: preset.width,
        height: preset.height,
      });

      if (preset.gps) {
        setVideoGps(preset.gps);
      } else {
        setVideoGps(null);
      }
    } catch (err) {
      console.error('Failed to load preset video:', err);
      setValidationError('Failed to generate preset video.');
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  // Extract keyframes from video adaptively using offscreen HTML5 canvas
  const extractKeyframesFromVideo = async (
    videoUrl: string,
    durationSec: number
  ): Promise<{ frames: { timestampSec: number; frameIndex: number; imageDataUrl: string }[]; stepSec: number }> => {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
      };

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        return reject(new Error('Canvas 2D context not available'));
      }

      const keyframes: { timestampSec: number; frameIndex: number; imageDataUrl: string }[] = [];
      const timestampsToSample: number[] = [];

      // Adaptive sampling: 4 to 6 frames depending on duration for fast analysis and high tracking fidelity
      const safeDuration = Math.min(60, Math.max(0.5, durationSec));
      let stepSec = 1.0;
      if (safeDuration <= 4) {
        stepSec = 0.8;
      } else if (safeDuration <= 12) {
        stepSec = 2.0;
      } else if (safeDuration <= 25) {
        stepSec = 3.5;
      } else {
        stepSec = 5.0;
      }

      for (let t = 0; t <= safeDuration; t += stepSec) {
        timestampsToSample.push(Math.round(t * 10) / 10);
        if (timestampsToSample.length >= 6) break;
      }
      if (timestampsToSample.length === 0) timestampsToSample.push(0);

      let currentIndex = 0;
      let seekTimeoutTimer: any = null;

      // Timeout safeguard in case browser never fires metadata event
      const metadataTimeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error('Timed out waiting for video decoder. Browser could not extract frames from this video format.'));
        }
      }, 12000);

      video.onloadedmetadata = () => {
        clearTimeout(metadataTimeout);
        // High-efficiency inference resolution (max 800px) preserves aspect ratio and details while cutting payload by 80%
        const origW = video.videoWidth || 800;
        const origH = video.videoHeight || 450;
        const scale = Math.min(1, 800 / Math.max(origW, origH));
        canvas.width = Math.round(origW * scale);
        canvas.height = Math.round(origH * scale);

        const seekNext = () => {
          if (currentIndex >= timestampsToSample.length) {
            if (seekTimeoutTimer) clearTimeout(seekTimeoutTimer);
            if (!isSettled) {
              isSettled = true;
              cleanup();
              resolve({ frames: keyframes, stepSec });
            }
            return;
          }
          const targetTime = Math.min(safeDuration, timestampsToSample[currentIndex]);
          setAnalysisStage(
            `Extracting keyframe ${currentIndex + 1} of ${timestampsToSample.length} (${targetTime.toFixed(1)}s)...`
          );
          setAnalysisProgressPct(Math.round(((currentIndex + 1) / (timestampsToSample.length + 2)) * 45));

          if (seekTimeoutTimer) clearTimeout(seekTimeoutTimer);
          seekTimeoutTimer = setTimeout(() => {
            // If seek event hangs, capture current frame and continue
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
              keyframes.push({
                timestampSec: timestampsToSample[currentIndex],
                frameIndex: currentIndex + 1,
                imageDataUrl: dataUrl,
              });
            } catch {}
            currentIndex++;
            seekNext();
          }, 3500);

          video.currentTime = targetTime;
        };

        video.onseeked = () => {
          if (seekTimeoutTimer) clearTimeout(seekTimeoutTimer);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          keyframes.push({
            timestampSec: timestampsToSample[currentIndex],
            frameIndex: currentIndex + 1,
            imageDataUrl: dataUrl,
          });
          currentIndex++;
          seekNext();
        };

        seekNext();
      };

      video.onerror = () => {
        clearTimeout(metadataTimeout);
        if (seekTimeoutTimer) clearTimeout(seekTimeoutTimer);
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error('Failed to seek video frames. Format or codec may not be supported by browser.'));
        }
      };

      video.src = videoUrl;
      video.load();
    });
  };

  // Start Video Wildlife Analysis Pipeline
  const handleStartAnalysis = async () => {
    if (!selectedVideo) return;

    setIsAnalyzing(true);
    setValidationError(null);
    setAnalysisStage('Extracting sampled video keyframes...');
    setAnalysisProgressPct(10);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Extract frames
      const { frames, stepSec } = await extractKeyframesFromVideo(
        selectedVideo.url,
        selectedVideo.durationSec
      );

      if (controller.signal.aborted) return;

      // 2. Transmit to server
      setAnalysisStage('Running high-speed AI detection & multi-object tracking (ByteTrack)...');
      setAnalysisProgressPct(70);

      const payload = {
        filename: selectedVideo.name,
        durationSec: selectedVideo.durationSec,
        videoWidth: selectedVideo.width,
        videoHeight: selectedVideo.height,
        samplingIntervalSec: stepSec,
        videoUrl: selectedVideo.url,
        frames,
        gps: videoGps,
        droneMetadata: videoGps
          ? {
              gps: videoGps,
              altitudeMeters: videoGps.altitudeMeters,
              locationDesc: videoGps.locationName,
            }
          : undefined,
      };

      // Try primary video endpoint with fallback to alias routes if 404 is encountered
      let result: VideoAnalysisResult | null = null;
      let lastApiErr: any = null;
      const endpointsToTry = ['/api/analyze-video', '/api/video-analyze', '/api/analyze'];

      for (const ep of endpointsToTry) {
        try {
          result = await safeApiPost<VideoAnalysisResult>(
            ep,
            payload,
            controller.signal,
            1
          );
          if (result && (result as any).success !== false) {
            break;
          }
        } catch (postErr: any) {
          lastApiErr = postErr;
          if (postErr instanceof ApiError && postErr.status === 404) {
            console.warn(`Endpoint ${ep} returned 404, falling back to alternative route...`);
            continue;
          }
          throw postErr;
        }
      }

      if (!result) {
        throw lastApiErr || new Error('Video tracking service failed to return results.');
      }

      if (controller.signal.aborted) return;

      setAnalysisStage('Aggregating unique track counts & census report...');
      setAnalysisProgressPct(100);

      // Keep video URL accessible for playback
      result.videoUrl = selectedVideo.url;

      onAnalysisComplete(result);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (err instanceof ApiError) {
        setValidationError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Video analysis failed.';
        setValidationError(msg);
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setAnalysisStage('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
          <Film className="w-3.5 h-3.5" />
          <span>Drone Video Animal Tracking Engine</span>
        </div>
        <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">
          Wildlife Drone Video Analysis & Animal Counting
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          Upload an aerial transect video (MP4/WebM). The system samples keyframes, localizes wildlife, associates tracks across timestamps, and calculates <strong>unique animal counts</strong> without inflating totals.
        </p>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Video Analysis Error</p>
            <p>{validationError}</p>
          </div>
        </div>
      )}

      {/* Upload Drop Zone / Selected Video View */}
      {!selectedVideo ? (
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition cursor-pointer flex flex-col items-center justify-center gap-4 ${
              dragActive
                ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-emerald-600 dark:hover:border-emerald-700'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-inner">
              <Film className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <p className="text-base font-bold text-stone-900 dark:text-white">
                Drag & drop your drone wildlife video here
              </p>
              <p className="text-xs text-stone-500">
                Supports MP4 and WebM up to {MAX_SIZE_MB}MB
              </p>
            </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer shadow-sm transition"
            >
              Browse Drone Video File
            </button>
          </div>

          {/* Quick One-Click Drone Sample Presets */}
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant Test Drone Video Presets</span>
              </span>
              <span className="text-[11px] text-stone-500">
                Generate and test video tracking in seconds
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_VIDEO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleLoadPreset(preset.id)}
                  disabled={isGeneratingPreset}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 text-left transition cursor-pointer flex items-start gap-3 group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-stone-900 dark:text-white">
                        {preset.title}
                      </p>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        {preset.durationSec}s
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 line-clamp-1">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-600 dark:text-stone-400 font-medium">
                      <span>Expected: {preset.expectedTrackCount} tracked animals</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Video Selected - Preview & Actions */
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-md space-y-5">
          {/* Top Video Metadata Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  {selectedVideo.name}
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedVideo.width} × {selectedVideo.height} • {selectedVideo.durationSec.toFixed(1)}s • {selectedVideo.sizeMb}MB
                </p>
              </div>
            </div>

            {!isAnalyzing && (
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="self-end sm:self-auto text-xs text-stone-500 hover:text-red-600 flex items-center gap-1 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
                <span>Replace Video</span>
              </button>
            )}
          </div>

          {/* HTML5 Video Preview Player */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[380px] flex items-center justify-center">
            <video
              src={selectedVideo.url}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Analysis Progress Box */}
          {isAnalyzing && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>{analysisStage}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-stone-500">
                    ⏱ {elapsedSec.toFixed(1)}s
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {analysisProgressPct}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-emerald-200/60 dark:bg-emerald-900/60 rounded-full overflow-hidden">
                <div
                  style={{ width: `${analysisProgressPct}%` }}
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                />
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-stone-500 space-y-0.5">
              <p>Adaptive keyframe sampling (high-speed parallel detection).</p>
              <p>Multi-object ByteTrack tracking deduplicates sightings to count unique animals.</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isAnalyzing ? (
                <button
                  type="button"
                  onClick={handleCancelAnalysis}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cancel Analysis</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-md hover:shadow-lg transition transform hover:scale-[1.01]"
                >
                  <span>Analyze Drone Video</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
