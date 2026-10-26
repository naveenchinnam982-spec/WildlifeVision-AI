import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Camera,
  Layers,
  Tag,
  Crosshair,
} from 'lucide-react';
import { VideoAnalysisResult, AnimalTrack } from '../types/wildlife';

interface VideoPlayerOverlayProps {
  videoResult: VideoAnalysisResult;
  selectedTrackId?: string | null;
  selectedSpecies?: string | null;
  onSelectTrack?: (trackId: string | null) => void;
}

export const VideoPlayerOverlay: React.FC<VideoPlayerOverlayProps> = ({
  videoResult,
  selectedTrackId,
  selectedSpecies,
  onSelectTrack,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoResult.durationSec || 0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showTrackIds, setShowTrackIds] = useState<boolean>(true);

  // Sync duration once video metadata loads
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || videoResult.durationSec || 0);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSpeedToggle = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 0.5 : 1;
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  // Find active tracks at currentTime
  const activeBoxes = React.useMemo(() => {
    if (!showBoxes) return [];

    const boxes: {
      track: AnimalTrack;
      box: { xMin: number; yMin: number; xMax: number; yMax: number };
      confidence: number;
      isHighlighted: boolean;
    }[] = [];

    for (const track of videoResult.tracks) {
      // Filter by selected species if filter active
      if (
        selectedSpecies &&
        track.animalLabel.toLowerCase() !== selectedSpecies.toLowerCase()
      ) {
        continue;
      }

      // Check if track is active within window around currentTime
      if (
        currentTime < track.firstSeenSec - 0.6 ||
        currentTime > track.lastSeenSec + 0.6
      ) {
        continue;
      }

      // Find closest keyframe in this track
      let closestKf = track.keyframes[0];
      let minDiff = Infinity;

      for (const kf of track.keyframes) {
        const diff = Math.abs(kf.timestampSec - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestKf = kf;
        }
      }

      if (closestKf && minDiff <= 1.8) {
        const isHighlighted = selectedTrackId === track.trackId;
        boxes.push({
          track,
          box: closestKf.boundingBox,
          confidence: closestKf.confidence,
          isHighlighted,
        });
      }
    }

    // Apply Non-Maximum Suppression so the same animal never receives duplicate boxes in a frame
    const nmsBoxes: typeof boxes = [];
    for (const item of boxes.sort((a, b) => b.confidence - a.confidence)) {
      const isDup = nmsBoxes.some((existing) => {
        const sameSpecies =
          item.track.animalLabel.toLowerCase().trim() ===
          existing.track.animalLabel.toLowerCase().trim();
        const interXMin = Math.max(item.box.xMin, existing.box.xMin);
        const interYMin = Math.max(item.box.yMin, existing.box.yMin);
        const interXMax = Math.min(item.box.xMax, existing.box.xMax);
        const interYMax = Math.min(item.box.yMax, existing.box.yMax);
        const interW = Math.max(0, interXMax - interXMin);
        const interH = Math.max(0, interYMax - interYMin);
        const interArea = interW * interH;
        if (interArea <= 0) return false;
        const areaA = (item.box.xMax - item.box.xMin) * (item.box.yMax - item.box.yMin);
        const areaB = (existing.box.xMax - existing.box.xMin) * (existing.box.yMax - existing.box.yMin);
        const union = areaA + areaB - interArea;
        const iou = union > 0 ? interArea / union : 0;
        return (sameSpecies && iou >= 0.55) || iou >= 0.8;
      });
      if (!isDup) {
        nmsBoxes.push(item);
      }
    }

    return nmsBoxes;
  }, [
    videoResult.tracks,
    currentTime,
    showBoxes,
    selectedTrackId,
    selectedSpecies,
  ]);

  // Jump to specific track if selected from outside
  useEffect(() => {
    if (selectedTrackId && videoRef.current) {
      const track = videoResult.tracks.find((t) => t.trackId === selectedTrackId);
      if (track) {
        videoRef.current.currentTime = track.firstSeenSec;
        setCurrentTime(track.firstSeenSec);
      }
    }
  }, [selectedTrackId, videoResult.tracks]);

  // Capture current annotated video frame to PNG
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Draw active bounding boxes
    if (showBoxes) {
      activeBoxes.forEach(({ track, box, confidence }) => {
        const x = (box.xMin / 1000) * canvas.width;
        const y = (box.yMin / 1000) * canvas.height;
        const w = ((box.xMax - box.xMin) / 1000) * canvas.width;
        const h = ((box.yMax - box.yMin) / 1000) * canvas.height;

        ctx.strokeStyle = track.color || '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        if (showLabels) {
          const label = `${track.trackId}: ${track.animalLabel} ${(confidence * 100).toFixed(0)}%`;
          ctx.font = 'bold 14px sans-serif';
          const textW = ctx.measureText(label).width + 10;
          ctx.fillStyle = track.color || '#10b981';
          ctx.fillRect(x, Math.max(0, y - 24), textW, 22);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x + 5, Math.max(16, y - 8));
        }
      });
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `wildlife_video_frame_${videoResult.analysisId}_${currentTime.toFixed(1)}s.png`;
    a.click();
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 shadow-xl flex flex-col group"
    >
      {/* Video display container with overlays */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={videoResult.videoUrl}
          playsInline
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Synchronized Bounding Box Overlay Layer */}
        {showBoxes && (
          <div className="absolute inset-0 pointer-events-none">
            {activeBoxes.map(({ track, box, confidence, isHighlighted }) => {
              const leftPct = (box.xMin / 1000) * 100;
              const topPct = (box.yMin / 1000) * 100;
              const widthPct = ((box.xMax - box.xMin) / 1000) * 100;
              const heightPct = ((box.yMax - box.yMin) / 1000) * 100;
              const color = track.color || '#10b981';

              return (
                <div
                  key={`${track.trackId}-${currentTime.toFixed(1)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrack?.(track.trackId);
                  }}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    borderColor: color,
                  }}
                  className={`absolute border-2 pointer-events-auto cursor-pointer transition-all ${
                    isHighlighted
                      ? 'ring-4 ring-white shadow-2xl scale-[1.01] z-30'
                      : 'hover:border-white z-10'
                  }`}
                >
                  {/* Label badge */}
                  {showLabels && (
                    <div
                      style={{ backgroundColor: color }}
                      className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow flex items-center gap-1 leading-tight select-none"
                    >
                      {showTrackIds && (
                        <span className="opacity-90 font-mono">
                          {track.trackId}
                        </span>
                      )}
                      <span>{track.animalLabel}</span>
                      <span className="opacity-80 text-[9px]">
                        {(confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Corner Reticles */}
                  <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />
                </div>
              );
            })}
          </div>
        )}

        {/* Center Play Button Overlay on Pause */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-emerald-600/80 hover:bg-emerald-600 text-white flex items-center justify-center cursor-pointer shadow-xl backdrop-blur transition transform hover:scale-105"
          >
            <Play className="w-6 h-6 ml-0.5 fill-current" />
          </button>
        )}

        {/* Live Active Animals Pill in Top-Right */}
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-stone-900/85 backdrop-blur border border-stone-700/80 text-white text-[11px] font-semibold flex items-center gap-2 z-20 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-300 font-bold">
            Current Frame: {activeBoxes.length}
          </span>
          <span className="text-stone-500">|</span>
          <span className="text-stone-300">
            Unique Animals: {videoResult.totalTrackedAnimals}
          </span>
        </div>
      </div>

      {/* Synchronized Video Playback Controls Bar */}
      <div className="p-3 bg-stone-900/95 border-t border-stone-800 text-stone-300 flex flex-col gap-2">
        {/* Scrubber Timeline */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono w-10 text-right">
            {currentTime.toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[11px] font-mono w-10">
            {duration.toFixed(1)}s
          </span>
        </div>

        {/* Buttons and Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Play/Pause & Speed */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white cursor-pointer transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer transition"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSpeedToggle}
              className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 font-mono text-[11px] text-stone-200 cursor-pointer transition"
            >
              {playbackRate}x
            </button>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Overlay Toggles & Frame Snapshot */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowBoxes(!showBoxes)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                showBoxes
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Boxes</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLabels(!showLabels)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                showLabels
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Labels</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTrackIds(!showTrackIds)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                showTrackIds
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>IDs</span>
            </button>

            <button
              type="button"
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold transition cursor-pointer"
              title="Capture annotated frame snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
