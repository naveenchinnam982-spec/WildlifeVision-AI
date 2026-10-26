import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AnimalDetection } from '../types/wildlife';
import { getSpeciesColor } from '../utils/colorPalette';
import { Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Download, Layers } from 'lucide-react';

interface AnnotatedCanvasProps {
  imageDataUrl: string;
  detections: AnimalDetection[];
  imageWidth: number;
  imageHeight: number;
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string | null) => void;
  filteredSpecies?: string | null;
  onAnnotatedCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

export const AnnotatedCanvas: React.FC<AnnotatedCanvasProps> = ({
  imageDataUrl,
  detections,
  imageWidth,
  imageHeight,
  selectedDetectionId,
  onSelectDetection,
  filteredSpecies,
  onAnnotatedCanvasReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'annotated' | 'original'>('annotated');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredDetId, setHoveredDetId] = useState<string | null>(null);

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageDataUrl;
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [imageDataUrl]);

  // Main canvas render routine
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use intrinsic image dimensions for sharp drawing
    const w = img.naturalWidth || imageWidth || 1920;
    const h = img.naturalHeight || imageHeight || 1080;
    canvas.width = w;
    canvas.height = h;

    // Draw base image
    ctx.drawImage(img, 0, 0, w, h);

    if (viewMode === 'original' || !showBoxes) {
      if (onAnnotatedCanvasReady) onAnnotatedCanvasReady(canvas);
      return;
    }

    // Filter detections if a specific species is selected
    const activeDetections = filteredSpecies
      ? detections.filter(
          (d) => d.animalLabel.toLowerCase() === filteredSpecies.toLowerCase()
        )
      : detections;

    // Render bounding boxes
    activeDetections.forEach((det) => {
      const isSelected = selectedDetectionId === det.detectionId;
      const isHovered = hoveredDetId === det.detectionId;
      const color = getSpeciesColor(det.animalLabel);

      // Convert 0-1000 normalized to pixel coordinates
      const x1 = (det.boundingBox.xMin / 1000) * w;
      const y1 = (det.boundingBox.yMin / 1000) * h;
      const x2 = (det.boundingBox.xMax / 1000) * w;
      const y2 = (det.boundingBox.yMax / 1000) * h;
      const boxW = Math.max(8, x2 - x1);
      const boxH = Math.max(8, y2 - y1);

      ctx.save();

      // Semi-transparent fill
      ctx.fillStyle = isSelected
        ? 'rgba(255, 255, 255, 0.28)'
        : isHovered
        ? 'rgba(255, 255, 255, 0.2)'
        : color.fill;
      ctx.fillRect(x1, y1, boxW, boxH);

      // Stroke
      ctx.strokeStyle = isSelected ? '#FFFFFF' : isHovered ? '#FDE047' : color.stroke;
      ctx.lineWidth = isSelected ? Math.max(4, w * 0.0035) : isHovered ? Math.max(3, w * 0.003) : Math.max(2.5, w * 0.002);

      // High-visibility shadow for aerial contrast
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.strokeRect(x1, y1, boxW, boxH);
      ctx.restore();

      // Corner accent markers for drone aesthetic
      const cornerLen = Math.min(boxW * 0.25, boxH * 0.25, 18);
      ctx.strokeStyle = isSelected ? '#FFFFFF' : color.stroke;
      ctx.lineWidth = Math.max(3.5, w * 0.0035);
      ctx.beginPath();
      // Top-left
      ctx.moveTo(x1, y1 + cornerLen);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerLen, y1);
      // Bottom-right
      ctx.moveTo(x2, y2 - cornerLen);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - cornerLen, y2);
      ctx.stroke();

      // Draw label badge
      if (showLabels) {
        ctx.save();
        const confPercent = Math.round(det.confidence * 100);
        const labelText = `${det.animalLabel} ${confPercent}%`;
        const fontSize = Math.max(14, Math.round(w * 0.013));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textMetrics = ctx.measureText(labelText);
        const padX = 8;
        const padY = 5;
        const badgeW = textMetrics.width + padX * 2;
        const badgeH = fontSize + padY * 2;

        // Position badge above box, or inside if too close to top
        let badgeY = y1 - badgeH - 2;
        if (badgeY < 4) {
          badgeY = y1 + 4;
        }
        const badgeX = Math.min(Math.max(2, x1), w - badgeW - 2);

        // Badge background
        ctx.fillStyle = isSelected ? '#1E293B' : color.stroke;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, badgeX + padX, badgeY + padY);

        ctx.restore();
      }
    });

    if (onAnnotatedCanvasReady) {
      onAnnotatedCanvasReady(canvas);
    }
  }, [
    imageWidth,
    imageHeight,
    viewMode,
    showBoxes,
    showLabels,
    detections,
    filteredSpecies,
    selectedDetectionId,
    hoveredDetId,
    onAnnotatedCanvasReady,
  ]);

  // Re-render whenever dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle click on canvas to select corresponding detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSelectDetection) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check hit test against bounding boxes (reversed so top-most gets clicked)
    for (let i = detections.length - 1; i >= 0; i--) {
      const det = detections[i];
      const x1 = (det.boundingBox.xMin / 1000) * canvas.width;
      const y1 = (det.boundingBox.yMin / 1000) * canvas.height;
      const x2 = (det.boundingBox.xMax / 1000) * canvas.width;
      const y2 = (det.boundingBox.yMax / 1000) * canvas.height;

      if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
        onSelectDetection(selectedDetectionId === det.detectionId ? null : det.detectionId);
        return;
      }
    }

    onSelectDetection(null);
  };

  // Handle mouse move for hover effect
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    for (let i = detections.length - 1; i >= 0; i--) {
      const det = detections[i];
      const x1 = (det.boundingBox.xMin / 1000) * canvas.width;
      const y1 = (det.boundingBox.yMin / 1000) * canvas.height;
      const x2 = (det.boundingBox.xMax / 1000) * canvas.width;
      const y2 = (det.boundingBox.yMax / 1000) * canvas.height;

      if (mouseX >= x1 && mouseX <= x2 && mouseY >= y1 && mouseY <= y2) {
        if (hoveredDetId !== det.detectionId) {
          setHoveredDetId(det.detectionId);
        }
        return;
      }
    }

    if (hoveredDetId !== null) {
      setHoveredDetId(null);
    }
  };

  const handleDownloadAnnotatedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `annotated_wildlife_survey_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="bg-stone-900 rounded-xl overflow-hidden shadow-lg border border-stone-800 flex flex-col">
      {/* Canvas Tool Bar */}
      <div className="bg-stone-950/90 backdrop-blur px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 text-xs text-stone-300">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('annotated')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'annotated'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            Detected Animals ({detections.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('original')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'original'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            Original Aerial View
          </button>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'annotated' && (
            <>
              <button
                type="button"
                onClick={() => setShowBoxes(!showBoxes)}
                className={`p-1.5 rounded hover:bg-stone-800 flex items-center gap-1.5 transition ${
                  showBoxes ? 'text-emerald-400' : 'text-stone-500'
                }`}
                title={showBoxes ? 'Hide Bounding Boxes' : 'Show Bounding Boxes'}
              >
                {showBoxes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="hidden sm:inline">Boxes</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLabels(!showLabels)}
                className={`p-1.5 rounded hover:bg-stone-800 flex items-center gap-1.5 transition ${
                  showLabels ? 'text-emerald-400' : 'text-stone-500'
                }`}
                title={showLabels ? 'Hide Labels & Confidence' : 'Show Labels & Confidence'}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Labels</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-stone-700 mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center bg-stone-800/80 rounded px-1">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="p-1 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-stone-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.2, z + 0.15))}
              className="p-1 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1 hover:text-white text-stone-400"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadAnnotatedImage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition"
            title="Download high-resolution image with bounding box annotations"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export PNG</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative w-full overflow-auto bg-stone-950 flex items-center justify-center p-2 min-h-[380px] max-h-[620px]"
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
          }}
          className="relative max-w-full flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoveredDetId(null)}
            className="max-w-full h-auto object-contain rounded shadow-2xl cursor-crosshair border border-stone-800/60"
            style={{
              maxHeight: '560px',
            }}
          />
        </div>
      </div>

      {/* Status Bar / Caption */}
      <div className="bg-stone-950 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-stone-400 border-t border-stone-800/80">
        <div className="flex items-center gap-2">
          <span>Coordinate Range: 0-1000 Normalized</span>
          <span>•</span>
          <span>Click animal to highlight details</span>
        </div>
        {selectedDetectionId && (
          <div className="text-amber-400 font-medium flex items-center gap-2">
            <span>Selected: {selectedDetectionId}</span>
            <button
              type="button"
              onClick={() => onSelectDetection && onSelectDetection(null)}
              className="text-stone-400 hover:text-stone-200 underline text-[11px]"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
