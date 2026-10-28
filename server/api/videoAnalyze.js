import express from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { surveyHistory } from './analyze.js';
import { historyStore } from '../storage/historyStore.js';

const router = express.Router();

// Strict JSON Content-Type enforcement middleware for video analysis
router.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

/**
 * Validates and normalizes bounding box coordinates within [0, 1000].
 */
function sanitizeBox(raw) {
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

  if (x2 - x1 < 4 || y2 - y1 < 4) {
    return null;
  }

  return { xMin: x1, yMin: y1, xMax: x2, yMax: y2 };
}

/**
 * Computes Intersection over Union (IoU) of two bounding boxes on the 0-1000 scale.
 */
function calculateIoU(boxA, boxB) {
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
 * Computes normalized center distance between two boxes [0, 1000].
 */
function calculateCenterDistance(boxA, boxB) {
  const centerAX = (boxA.xMin + boxA.xMax) / 2;
  const centerAY = (boxA.yMin + boxA.yMax) / 2;
  const centerBX = (boxB.xMin + boxB.xMax) / 2;
  const centerBY = (boxB.yMin + boxB.yMax) / 2;

  const dx = centerAX - centerBX;
  const dy = centerAY - centerBY;
  return Math.sqrt(dx * dx + dy * dy);
}

const TRACK_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f97316', // orange
  '#14b8a6', // teal
  '#84cc16', // lime
  '#e11d48', // rose
];

/**
 * Deduplicates overlapping detections of the same or compatible animal class
 * within a single video frame using class-aware Non-Maximum Suppression (NMS).
 * Removes duplicate bounding boxes around the same animal.
 */
export function deduplicateDetections(detections, iouThreshold = 0.55) {
  if (!detections || detections.length <= 1) return detections || [];

  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept = [];

  for (const candidate of sorted) {
    let isDuplicate = false;
    for (const existing of kept) {
      const sameSpecies =
        candidate.animalLabel.toLowerCase().trim() ===
        existing.animalLabel.toLowerCase().trim();

      const iou = calculateIoU(candidate.boundingBox, existing.boundingBox);

      if (sameSpecies && iou >= iouThreshold) {
        isDuplicate = true;
        break;
      }

      // Strong spatial overlap (> 0.82) even if species slightly differs
      if (iou >= 0.82) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  return kept;
}

/**
 * Multi-Object Tracking Engine (ByteTrack/Spatial-IoU algorithm with occlusion handling)
 * Associates detections across consecutive timestamps into persistent animal tracks.
 * Reconnects tracks through temporary occlusions (trees, vegetation, brief missed detections).
 * Prevents counting the same animal across multiple frames as multiple animals!
 */
export function trackAnimalsAcrossFrames(frameDetectionsList, iouThreshold = 0.20, maxCenterDist = 180) {
  const tracks = [];
  let nextTrackNum = 1;

  // Sort frames by timestamp ascending
  const sortedFrames = [...frameDetectionsList].sort((a, b) => a.timestampSec - b.timestampSec);

  for (const frame of sortedFrames) {
    const { timestampSec, frameIndex, detections } = frame;
    // Apply per-frame NMS so duplicate overlapping boxes on the same animal never produce phantom tracks
    const nmsDetections = deduplicateDetections(detections, 0.55);
    const unmatchedDetections = [...nmsDetections];

    // Attempt to match each active track with current frame detections
    for (const track of tracks) {
      const lastKeyframe = track.keyframes[track.keyframes.length - 1];
      if (!lastKeyframe) continue;

      // Match window: up to 7.0 seconds to handle temporary canopy/tree occlusion
      const timeDelta = timestampSec - lastKeyframe.timestampSec;
      if (timeDelta > 7.0) continue;

      // Estimate motion velocity if track has history
      let expectedBox = lastKeyframe.boundingBox;
      if (track.keyframes.length >= 2) {
        const prevKeyframe = track.keyframes[track.keyframes.length - 2];
        const dt = lastKeyframe.timestampSec - prevKeyframe.timestampSec;
        if (dt > 0.05 && dt < 4.0) {
          const vx = ((lastKeyframe.boundingBox.xMin + lastKeyframe.boundingBox.xMax) / 2 -
            (prevKeyframe.boundingBox.xMin + prevKeyframe.boundingBox.xMax) / 2) / dt;
          const vy = ((lastKeyframe.boundingBox.yMin + lastKeyframe.boundingBox.yMax) / 2 -
            (prevKeyframe.boundingBox.yMin + prevKeyframe.boundingBox.yMax) / 2) / dt;
          const shiftX = Math.max(-120, Math.min(120, vx * timeDelta));
          const shiftY = Math.max(-120, Math.min(120, vy * timeDelta));
          expectedBox = {
            xMin: Math.max(0, Math.min(1000, lastKeyframe.boundingBox.xMin + shiftX)),
            yMin: Math.max(0, Math.min(1000, lastKeyframe.boundingBox.yMin + shiftY)),
            xMax: Math.max(0, Math.min(1000, lastKeyframe.boundingBox.xMax + shiftX)),
            yMax: Math.max(0, Math.min(1000, lastKeyframe.boundingBox.yMax + shiftY)),
          };
        }
      }

      let bestMatchIdx = -1;
      let highestScore = -1;

      for (let i = 0; i < unmatchedDetections.length; i++) {
        const candidate = unmatchedDetections[i];

        // Must match species label (case-insensitive)
        const sameSpecies =
          candidate.animalLabel.toLowerCase().trim() === track.animalLabel.toLowerCase().trim();
        if (!sameSpecies) continue;

        const iou = calculateIoU(candidate.boundingBox, lastKeyframe.boundingBox);
        const distToLast = calculateCenterDistance(candidate.boundingBox, lastKeyframe.boundingBox);
        const distToExpected = calculateCenterDistance(candidate.boundingBox, expectedBox);
        const effectiveDist = Math.min(distToLast, distToExpected);

        // Combined spatial score: high IoU or close center proximity
        let score = 0;
        if (iou >= iouThreshold) {
          score = iou * 2.0;
        } else if (effectiveDist < maxCenterDist) {
          score = (1 - effectiveDist / maxCenterDist) * 1.0;
        }

        if (score > highestScore && score > 0.18) {
          highestScore = score;
          bestMatchIdx = i;
        }
      }

      if (bestMatchIdx !== -1) {
        const matched = unmatchedDetections[bestMatchIdx];
        track.keyframes.push({
          timestampSec,
          frameIndex,
          boundingBox: matched.boundingBox,
          confidence: matched.confidence,
        });
        track.lastSeenSec = timestampSec;
        track.durationSec = Math.round((track.lastSeenSec - track.firstSeenSec) * 10) / 10;
        track.detectionCount += 1;
        track.averageConfidence = Math.round(
          (track.averageConfidence * (track.detectionCount - 1) + matched.confidence) / track.detectionCount * 100
        ) / 100;

        unmatchedDetections.splice(bestMatchIdx, 1);
      }
    }

    // Any remaining detections in this frame begin new animal tracks
    for (const remaining of unmatchedDetections) {
      const color = TRACK_COLORS[(nextTrackNum - 1) % TRACK_COLORS.length];
      const trackId = `TRACK-${String(nextTrackNum).padStart(3, '0')}`;
      nextTrackNum++;

      tracks.push({
        trackId,
        animalLabel: remaining.animalLabel,
        category: remaining.category || 'Wildlife',
        identificationStatus: remaining.identificationStatus || 'identified',
        averageConfidence: remaining.confidence,
        firstSeenSec: timestampSec,
        lastSeenSec: timestampSec,
        durationSec: 0,
        detectionCount: 1,
        color,
        keyframes: [
          {
            timestampSec,
            frameIndex,
            boundingBox: remaining.boundingBox,
            confidence: remaining.confidence,
          },
        ],
        notes: `First sighted at ${timestampSec.toFixed(1)}s (Frame ${frameIndex})`,
      });
    }
  }

  // Post-processing: Reconcile / Merge tracks separated by temporary occlusion
  for (let i = 0; i < tracks.length; i++) {
    const trackA = tracks[i];
    if (!trackA) continue;

    for (let j = i + 1; j < tracks.length; j++) {
      const trackB = tracks[j];
      if (!trackB) continue;

      // Must be same species
      if (trackA.animalLabel.toLowerCase().trim() !== trackB.animalLabel.toLowerCase().trim()) {
        continue;
      }

      // Check temporal sequence: Track A ends before Track B begins (or vice versa)
      let first = trackA;
      let second = trackB;
      let secondIndex = j;

      if (trackB.lastSeenSec < trackA.firstSeenSec) {
        first = trackB;
        second = trackA;
        secondIndex = i;
      } else if (trackA.lastSeenSec > trackB.firstSeenSec) {
        // Overlapping in time: genuinely different animals sharing the scene!
        continue;
      }

      const timeGap = second.firstSeenSec - first.lastSeenSec;
      // Reconnection window: up to 8.0 seconds of occlusion
      if (timeGap >= 0 && timeGap <= 8.0) {
        const lastBoxFirst = first.keyframes[first.keyframes.length - 1].boundingBox;
        const firstBoxSecond = second.keyframes[0].boundingBox;
        const dist = calculateCenterDistance(lastBoxFirst, firstBoxSecond);
        const maxAllowedDist = Math.max(90, 40 * Math.max(1, timeGap));

        if (dist <= maxAllowedDist) {
          // Merge second track into first track
          first.keyframes.push(...second.keyframes);
          first.keyframes.sort((a, b) => a.timestampSec - b.timestampSec);
          first.lastSeenSec = Math.max(first.lastSeenSec, second.lastSeenSec);
          first.durationSec = Math.round((first.lastSeenSec - first.firstSeenSec) * 10) / 10;
          first.detectionCount += second.detectionCount;
          first.averageConfidence = Math.round(
            ((first.averageConfidence * (first.detectionCount - second.detectionCount) +
              second.averageConfidence * second.detectionCount) /
              first.detectionCount) *
              100
          ) / 100;

          // Remove merged second track
          tracks.splice(secondIndex, 1);
          j--;
          if (secondIndex === i) {
            i--;
            break;
          }
        }
      }
    }
  }

  return tracks;
}

/**
 * Aggregates species-wise track counts from persistent tracks.
 */
export function calculateVideoSpeciesCounts(tracks, frameDetectionsList) {
  if (!tracks || tracks.length === 0) {
    return {
      totalTrackedAnimals: 0,
      totalFrameDetections: 0,
      distinctSpeciesCount: 0,
      speciesCounts: [],
    };
  }

  const map = new Map();
  let totalDetections = 0;

  frameDetectionsList.forEach((fd) => {
    totalDetections += fd.detections.length;
  });

  for (const track of tracks) {
    const rawLabel = (track.animalLabel || 'Unknown animal').trim();
    const key = rawLabel.toLowerCase();
    const formattedName = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

    if (!map.has(key)) {
      map.set(key, {
        animalLabel: formattedName,
        category: track.category || 'Wildlife',
        trackCount: 1,
        totalDetections: track.detectionCount,
        status: track.identificationStatus || 'identified',
      });
    } else {
      const entry = map.get(key);
      entry.trackCount += 1;
      entry.totalDetections += track.detectionCount;
      if (track.identificationStatus !== 'identified' && entry.status === 'identified') {
        entry.status = track.identificationStatus;
      }
    }
  }

  const speciesCounts = Array.from(map.values()).sort((a, b) => b.trackCount - a.trackCount);

  return {
    totalTrackedAnimals: tracks.length,
    totalFrameDetections: totalDetections,
    distinctSpeciesCount: speciesCounts.length,
    speciesCounts,
  };
}

// In-memory LRU cache for instant resolution of identical video analysis runs
const videoAnalysisCache = new Map();

const VIDEO_FRAME_SYSTEM_INSTRUCTION = `You are an expert wildlife aerial computer vision specialist.
Examine this video keyframe captured from a conservation drone.
Your task:
1. Identify all distinct visible wild animals in the scene, including aerial wildlife sightings, drone conservation surveys, and simulation/transect footage (e.g. African Elephant, Plains Zebra, White-tailed Deer, Lion, Birds, etc.).
2. For each distinct visible animal, provide exactly one bounding box on the 0 to 1000 normalized integer scale (xMin, yMin, xMax, yMax) and confidence score (0.0 - 1.0).
3. Do not count rocks, bushes, tree stumps, shadows, or vehicle equipment as animals.
4. If no animals are visible, set hasAnimals to false and detections to [].`;

/**
 * Analyzes a single video keyframe with candidate model fallback and schema validation.
 */
async function analyzeSingleKeyframe(frame, modelsToTry, aiClient) {
  const { timestampSec = 0, frameIndex = 0, imageDataUrl } = frame;
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
  }

  const matches = imageDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) {
    return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  let response = null;
  for (const model of modelsToTry) {
    try {
      response = await aiClient.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            {
              text: `Detect all distinct animals visible in this video frame (at ${timestampSec.toFixed(1)}s). Return one bounding box per visible animal on the 0-1000 scale, species label, category, confidence (0.0-1.0), and status.`,
            },
          ],
        },
        config: {
          systemInstruction: VIDEO_FRAME_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasAnimals: { type: Type.BOOLEAN },
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    animalLabel: { type: Type.STRING },
                    category: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    identificationStatus: { type: Type.STRING },
                    xMin: { type: Type.INTEGER },
                    yMin: { type: Type.INTEGER },
                    xMax: { type: Type.INTEGER },
                    yMax: { type: Type.INTEGER },
                  },
                  required: [
                    'animalLabel',
                    'category',
                    'confidence',
                    'identificationStatus',
                    'xMin',
                    'yMin',
                    'xMax',
                    'yMax',
                  ],
                },
              },
            },
            required: ['hasAnimals', 'detections'],
          },
        },
      });
      if (response?.text) {
        break;
      }
    } catch {
      // Model error, continue to next candidate model
    }
  }

  if (!response?.text) {
    return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
  }

  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    const parsed = JSON.parse(jsonStr);
    const rawDets = Array.isArray(parsed?.detections) ? parsed.detections : [];

    const frameValidDets = [];
    for (let i = 0; i < rawDets.length; i++) {
      const raw = rawDets[i];
      const box = sanitizeBox({
        xMin: Number(raw.xMin),
        yMin: Number(raw.yMin),
        xMax: Number(raw.xMax),
        yMax: Number(raw.yMax),
      });
      if (box) {
        frameValidDets.push({
          detectionId: `F${frameIndex}-D${i + 1}`,
          animalLabel: String(raw.animalLabel || 'Unknown animal'),
          category: String(raw.category || 'Wildlife'),
          confidence: Math.min(1.0, Math.max(0.1, Number(raw.confidence) || 0.85)),
          boundingBox: box,
          xMin: box.xMin,
          yMin: box.yMin,
          xMax: box.xMax,
          yMax: box.yMax,
          identificationStatus: ['identified', 'uncertain', 'unclassified'].includes(raw.identificationStatus)
            ? raw.identificationStatus
            : 'identified',
        });
      }
    }

    const deduplicatedFrameDets = deduplicateDetections(frameValidDets, 0.55);

    return {
      frameIndex,
      timestampSec,
      detections: deduplicatedFrameDets,
      detectionCount: deduplicatedFrameDets.length,
      imageDataUrl: frame.thumbnailUrl || undefined,
    };
  } catch {
    return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
  }
}

/**
 * Primary Express handler for POST /api/analyze-video
 */
export async function handleAnalyzeVideo(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const startTime = Date.now();

  try {
    const {
      filename = 'drone_wildlife_survey.mp4',
      durationSec = 0,
      videoWidth = 1920,
      videoHeight = 1080,
      frames = [],
      videoUrl = '',
      samplingIntervalSec = 1.0,
      droneMetadata,
      gps,
    } = req.body || {};

    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FRAMES_PROVIDED',
          message: 'No video keyframes provided in request payload. Please extract keyframes from the video.',
        },
      });
    }

    // Check in-memory cache for fast resolution of identical video analysis runs
    const firstFramePreview = frames[0]?.imageDataUrl?.substring(0, 80) || '';
    const cacheKey = `${filename}_${durationSec}_${frames.length}_${firstFramePreview}`;
    if (videoAnalysisCache.has(cacheKey)) {
      const cached = videoAnalysisCache.get(cacheKey);
      return res.status(200).json(cached);
    }

    const rawApiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.API_KEY ||
      '';
    const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_CONFIGURED',
          message: 'GEMINI_API_KEY is not configured in the server environment.',
        },
      });
    }

    const aiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-wildlifevision' },
      },
    });

    const configuredModel = process.env.GEMINI_MODEL;
    const modelsToTry = [
      configuredModel,
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ].filter(Boolean);

    // Limit keyframes to analyze to max 8 for optimal latency and rate-limit safety
    const framesToAnalyze = frames.slice(0, 8);
    const analyzedFrames = await Promise.all(
      framesToAnalyze.map((frame) => analyzeSingleKeyframe(frame, modelsToTry, aiClient))
    );

    // Run Multi-Object Tracking Engine
    const tracks = trackAnimalsAcrossFrames(analyzedFrames, 0.20, 180);
    const census = calculateVideoSpeciesCounts(tracks, analyzedFrames);

    const analysisId = `V-SURV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const processingTimeMs = Date.now() - startTime;

    const warnings = [];
    if (durationSec > 30) {
      warnings.push(`Video is ${Math.round(durationSec)}s long; sampled at ${samplingIntervalSec}s intervals. Fast movements between frames may affect tracking continuity.`);
    }
    if (tracks.length === 0) {
      warnings.push('No animals were reliably tracked in the processed video frames.');
    }

    const speciesSummaryText = census.speciesCounts
      .map((sc) => `${sc.trackCount} ${sc.animalLabel}`)
      .join(', ');

    const summary =
      tracks.length > 0
        ? `Tracked ${census.totalTrackedAnimals} unique animal(s) across ${analyzedFrames.length} video keyframes (${speciesSummaryText || 'unclassified'}). Total frame sightings: ${census.totalFrameDetections}.`
        : 'No wildlife detected across the analyzed video keyframes.';

    const result = {
      success: true,
      analysisId,
      filename: filename || 'drone_flight.mp4',
      timestamp: new Date().toISOString(),
      videoUrl: videoUrl || '',
      durationSec: Number(durationSec) || 0,
      videoWidth: Number(videoWidth) || 1920,
      videoHeight: Number(videoHeight) || 1080,
      totalTrackedAnimals: census.totalTrackedAnimals,
      totalFrameDetections: census.totalFrameDetections,
      distinctSpeciesCount: census.distinctSpeciesCount,
      speciesCounts: census.speciesCounts,
      tracks,
      analyzedFrames,
      totalFramesAnalyzed: analyzedFrames.length,
      samplingIntervalSec: Number(samplingIntervalSec) || 1.0,
      summary,
      warnings,
      methodology: `Sampled at ${samplingIntervalSec}s intervals. Spatial IoU multi-object tracking (ByteTrack compatible) was applied across consecutive timestamps to calculate unique individuals rather than summing repeated frame detections.`,
      processingTimeMs,
      status: tracks.length > 0 ? 'completed' : 'no_animals_detected',
      mediaType: 'video',
      droneMetadata: {
        altitudeMeters: Number(droneMetadata?.altitudeMeters ?? (gps?.altitudeMeters ?? 45)),
        sensorType: droneMetadata?.sensorType || 'Aerial 4K UAV Telemetry',
        locationDesc: droneMetadata?.locationDesc || gps?.locationName || 'Aerial Drone Video Transect',
        gps: gps || droneMetadata?.gps || null,
        droneModel: droneMetadata?.droneModel || 'DJI Inspire 3 / Zenmuse X9-8K Air',
        missionId: droneMetadata?.missionId || null,
        habitatType: droneMetadata?.habitatType || null,
      },
    };

    // Store permanently in persistent disk history
    historyStore.add(result);
    const currentAll = historyStore.getAll();
    surveyHistory.length = 0;
    surveyHistory.push(...currentAll);

    // Cache result in memory for fast retrieval
    videoAnalysisCache.set(cacheKey, result);

    return res.status(200).json(result);
  } catch (err) {
    if (res.headersSent) return;
    res.setHeader('Content-Type', 'application/json');

    const message = err instanceof Error ? err.message : 'Unknown error during video analysis';

    if (message.includes('429') || message.includes('quota') || message.includes('ResourceExhausted')) {
      res.setHeader('Retry-After', '3');
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Gemini API rate limit reached. Please wait a few moments before trying again.',
          retryable: true,
        },
      });
    }

    if (message.includes('503') || message.includes('high demand') || message.includes('unavailable')) {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_HIGH_DEMAND',
          message: 'The video analysis engine is experiencing high demand. Please try again in a few moments.',
          retryable: true,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'VIDEO_ANALYSIS_ERROR',
        message,
        retryable: false,
      },
    });
  }
}

// Support all standard route mountings and aliases:
const videoEndpoints = [
  '/api/analyze-video',
  '/api/video-analyze',
  '/api/analyze/video',
  '/api/video/analyze',
  '/api/video-analysis',
  '/api/video',
  '/api/videos',
  '/analyze-video',
  '/video-analyze',
];

videoEndpoints.forEach((route) => {
  router.post(route, handleAnalyzeVideo);
  router.get(route, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      service: 'WildlifeVision AI Drone Video Animal Tracking Engine',
      endpoint: route,
      supportedMethod: 'POST',
      acceptedPayload: {
        filename: 'string (optional)',
        durationSec: 'number (optional)',
        samplingIntervalSec: 'number (optional)',
        frames: 'array of { timestampSec, frameIndex, imageDataUrl } (required)',
        videoUrl: 'string (optional)',
        droneMetadata: 'object (optional)',
        gps: 'object (optional)',
      },
    });
  });
});

router.post('/', handleAnalyzeVideo);

// Return JSON 405 Method Not Allowed for non-POST/non-GET calls (PUT, DELETE, etc.)
const handleMethodNotAllowed = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(405).json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed on ${req.originalUrl}. Send a POST request with video keyframes JSON payload.`,
    },
  });
};

videoEndpoints.forEach((route) => {
  router.all(route, handleMethodNotAllowed);
});

export default router;
