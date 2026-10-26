import { BoundingBox, AnimalDetection } from '../types/wildlife';

/**
 * Validates and normalizes bounding box coordinates to ensure:
 * 1. Coordinates are bounded within [0, 1000]
 * 2. xMin < xMax and yMin < yMax (swaps if inverted)
 * 3. Degenerate boxes (zero area or collapsed dimension) are discarded
 */
export function sanitizeBoundingBox(raw: {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}): BoundingBox | null {
  if (
    typeof raw.xMin !== 'number' ||
    typeof raw.yMin !== 'number' ||
    typeof raw.xMax !== 'number' ||
    typeof raw.yMax !== 'number' ||
    !Number.isFinite(raw.xMin) ||
    !Number.isFinite(raw.yMin) ||
    !Number.isFinite(raw.xMax) ||
    !Number.isFinite(raw.yMax)
  ) {
    return null;
  }

  let x1 = Math.min(Math.max(0, Math.round(raw.xMin)), 1000);
  let y1 = Math.min(Math.max(0, Math.round(raw.yMin)), 1000);
  let x2 = Math.min(Math.max(0, Math.round(raw.xMax)), 1000);
  let y2 = Math.min(Math.max(0, Math.round(raw.yMax)), 1000);

  if (x1 > x2) {
    const tmp = x1;
    x1 = x2;
    x2 = tmp;
  }
  if (y1 > y2) {
    const tmp = y1;
    y1 = y2;
    y2 = tmp;
  }

  // Check minimum dimensions (at least 5 units out of 1000 to be a visible entity)
  if (x2 - x1 < 4 || y2 - y1 < 4) {
    return null;
  }

  return {
    xMin: x1,
    yMin: y1,
    xMax: x2,
    yMax: y2,
  };
}

/**
 * Calculates Intersection over Union (IoU) of two bounding boxes (0-1000 scale).
 */
export function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const interXMin = Math.max(boxA.xMin, boxB.xMin);
  const interYMin = Math.max(boxA.yMin, boxB.yMin);
  const interXMax = Math.min(boxA.xMax, boxB.xMax);
  const interYMax = Math.min(boxA.yMax, boxB.yMax);

  const interWidth = Math.max(0, interXMax - interXMin);
  const interHeight = Math.max(0, interYMax - interYMin);
  const intersectionArea = interWidth * interHeight;

  if (intersectionArea <= 0) return 0;

  const areaA = (boxA.xMax - boxA.xMin) * (boxA.yMax - boxA.yMin);
  const areaB = (boxB.xMax - boxB.xMin) * (boxB.yMax - boxB.yMin);

  const unionArea = areaA + areaB - intersectionArea;
  if (unionArea <= 0) return 0;

  return intersectionArea / unionArea;
}

/**
 * Deduplicates overlapping detections of the same or compatible animal class
 * using class-aware Non-Maximum Suppression (NMS).
 * Prevents counting the exact same animal multiple times when multiple proposal boxes overlap heavily.
 */
export function deduplicateDetections(
  detections: AnimalDetection[],
  iouThreshold: number = 0.6
): AnimalDetection[] {
  if (detections.length <= 1) return detections;

  // Sort by confidence descending
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: AnimalDetection[] = [];

  for (const candidate of sorted) {
    let isDuplicate = false;
    for (const existing of kept) {
      // Check if candidate labels match (or are variants)
      const sameSpecies =
        candidate.animalLabel.toLowerCase().trim() ===
        existing.animalLabel.toLowerCase().trim();

      const iou = calculateIoU(candidate.boundingBox, existing.boundingBox);

      // If same species and IoU exceeds threshold, it's a duplicate of the same animal
      if (sameSpecies && iou >= iouThreshold) {
        isDuplicate = true;
        break;
      }

      // If high overlap (> 0.85) even across generic categories, keep the more specific/confident one
      if (iou >= 0.85) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  // Re-index detection IDs to be clean and sequential
  return kept.map((det, index) => ({
    ...det,
    detectionId: `DET-${String(index + 1).padStart(3, '0')}`,
  }));
}

/**
 * Converts normalized 0-1000 coordinate to canvas pixel coordinate.
 */
export function normalizedToCanvasPixel(
  normalizedCoord: number,
  canvasDimension: number
): number {
  return (normalizedCoord / 1000) * canvasDimension;
}

/**
 * Converts canvas pixel coordinate back to 0-1000 normalized coordinate.
 */
export function canvasPixelToNormalized(
  pixelCoord: number,
  canvasDimension: number
): number {
  if (canvasDimension <= 0) return 0;
  return Math.min(1000, Math.max(0, Math.round((pixelCoord / canvasDimension) * 1000)));
}
