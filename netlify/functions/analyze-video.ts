import type { Handler, HandlerEvent } from './types.js';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Netlify Serverless Function for Video Transect Analysis & Multi-Object Tracking
 * Route: POST /api/analyze-video (redirected to /.netlify/functions/analyze-video)
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

function sanitizeBox(raw: { xMin: number; yMin: number; xMax: number; yMax: number }) {
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

function calculateIoU(
  boxA: { xMin: number; yMin: number; xMax: number; yMax: number },
  boxB: { xMin: number; yMin: number; xMax: number; yMax: number }
): number {
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

function deduplicateDetections(detections: any[], iouThreshold = 0.55): any[] {
  if (!detections || detections.length <= 1) return detections || [];

  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: any[] = [];

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

function trackAnimalsAcrossFrames(frameDetectionsList: any[], iouThreshold = 0.20, maxCenterDist = 180): any[] {
  const tracks: any[] = [];
  let nextTrackNum = 1;

  const sortedFrames = [...frameDetectionsList].sort((a, b) => a.timestampSec - b.timestampSec);

  for (const frame of sortedFrames) {
    const { timestampSec, frameIndex, detections } = frame;
    const nmsDetections = deduplicateDetections(detections, 0.55);
    const unmatchedDetections = [...nmsDetections];

    for (const track of tracks) {
      const lastKeyframe = track.keyframes[track.keyframes.length - 1];
      if (!lastKeyframe) continue;

      const timeDelta = timestampSec - lastKeyframe.timestampSec;
      if (timeDelta > 7.0) continue;

      let bestDetIndex = -1;
      let bestScore = -1;

      for (let i = 0; i < unmatchedDetections.length; i++) {
        const candidate = unmatchedDetections[i];
        const isSameSpecies =
          candidate.animalLabel.toLowerCase().trim() === track.animalLabel.toLowerCase().trim();
        const iou = calculateIoU(lastKeyframe.boundingBox, candidate.boundingBox);

        const centerAX = (lastKeyframe.boundingBox.xMin + lastKeyframe.boundingBox.xMax) / 2;
        const centerAY = (lastKeyframe.boundingBox.yMin + lastKeyframe.boundingBox.yMax) / 2;
        const centerBX = (candidate.boundingBox.xMin + candidate.boundingBox.xMax) / 2;
        const centerBY = (candidate.boundingBox.yMin + candidate.boundingBox.yMax) / 2;
        const dist = Math.sqrt((centerAX - centerBX) ** 2 + (centerAY - centerBY) ** 2);

        let matchScore = 0;
        if (iou > 0.05) matchScore += iou * 3.0;
        if (dist <= maxCenterDist) matchScore += (1.0 - dist / maxCenterDist) * 2.0;
        if (isSameSpecies) matchScore += 1.5;

        if (matchScore > bestScore && (iou >= iouThreshold || dist <= maxCenterDist)) {
          bestScore = matchScore;
          bestDetIndex = i;
        }
      }

      if (bestDetIndex >= 0 && bestScore > 0.8) {
        const matched = unmatchedDetections.splice(bestDetIndex, 1)[0];
        const dt = Math.max(0.1, timestampSec - lastKeyframe.timestampSec);
        const centerAX = (lastKeyframe.boundingBox.xMin + lastKeyframe.boundingBox.xMax) / 2;
        const centerAY = (lastKeyframe.boundingBox.yMin + lastKeyframe.boundingBox.yMax) / 2;
        const centerBX = (matched.boundingBox.xMin + matched.boundingBox.xMax) / 2;
        const centerBY = (matched.boundingBox.yMin + matched.boundingBox.yMax) / 2;
        const distNorm = Math.sqrt((centerAX - centerBX) ** 2 + (centerAY - centerBY) ** 2);
        const estSpeedKmh = Math.min(65, Math.round(((distNorm * 0.12) / dt) * 3.6));
        const directionDeg = Math.round((Math.atan2(centerBY - centerAY, centerBX - centerAX) * 180) / Math.PI + 360) % 360;

        track.keyframes.push({
          frameIndex,
          timestampSec,
          boundingBox: matched.boundingBox,
          confidence: matched.confidence,
          estimatedSpeedKmh: estSpeedKmh,
          directionDeg,
        });

        track.lastSeenSec = timestampSec;
        track.confidence = Math.max(track.confidence, matched.confidence);
      }
    }

    for (const remaining of unmatchedDetections) {
      const colorIndex = (nextTrackNum - 1) % TRACK_COLORS.length;
      tracks.push({
        trackId: `TRK-${String(nextTrackNum++).padStart(3, '0')}`,
        animalLabel: remaining.animalLabel,
        category: remaining.category || 'Wildlife',
        confidence: remaining.confidence,
        identificationStatus: remaining.identificationStatus || 'identified',
        color: TRACK_COLORS[colorIndex],
        firstSeenSec: timestampSec,
        lastSeenSec: timestampSec,
        averageSpeedKmh: 0,
        totalDistanceMeters: 0,
        keyframes: [
          {
            frameIndex,
            timestampSec,
            boundingBox: remaining.boundingBox,
            confidence: remaining.confidence,
            estimatedSpeedKmh: 0,
            directionDeg: 0,
          },
        ],
      });
    }
  }

  return tracks.map((track) => {
    let totalSpeed = 0;
    let speedSamples = 0;
    for (const kf of track.keyframes) {
      if (kf.estimatedSpeedKmh > 0) {
        totalSpeed += kf.estimatedSpeedKmh;
        speedSamples++;
      }
    }
    const avgSpeed = speedSamples > 0 ? Math.round(totalSpeed / speedSamples) : 0;
    const duration = track.lastSeenSec - track.firstSeenSec;
    const estDistance = Math.round((avgSpeed * (duration / 3600)) * 1000);

    return {
      ...track,
      averageSpeedKmh: avgSpeed,
      totalDistanceMeters: estDistance,
    };
  });
}

function calculateVideoSpeciesCounts(tracks: any[]): any[] {
  const map = new Map<string, { count: number; category: string; status: string; originalName: string }>();

  for (const track of tracks) {
    const rawLabel = (track.animalLabel || 'Unknown animal').trim();
    const key = rawLabel.toLowerCase();
    const formattedName = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

    if (!map.has(key)) {
      map.set(key, {
        count: 1,
        category: track.category || 'Wildlife',
        status: track.identificationStatus || 'identified',
        originalName: formattedName,
      });
    } else {
      map.get(key)!.count += 1;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      animalLabel: item.originalName,
      category: item.category,
      count: item.count,
      status: item.status,
    }))
    .sort((a, b) => b.count - a.count);
}

export const handler: Handler = async (event: HandlerEvent) => {
  const startTime = Date.now();

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'CORS OK' }),
    };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        service: 'WildlifeVision AI Video Tracking Engine (Netlify Serverless)',
        endpoint: '/api/analyze-video',
        supportedMethod: 'POST',
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'POST method required.' },
      }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      const rawPayload = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      try {
        body = JSON.parse(rawPayload);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: { code: 'INVALID_REQUEST_BODY', message: 'Invalid JSON request body.' },
          }),
        };
      }
    }

    const {
      filename = 'drone_wildlife_survey.mp4',
      durationSec = 0,
      videoWidth = 1920,
      videoHeight = 1080,
      frames = [],
      droneMetadata,
      gps,
    } = body;

    if (!Array.isArray(frames) || frames.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'NO_FRAMES_PROVIDED',
            message: 'No video keyframes provided in request payload.',
          },
        }),
      };
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    if (!apiKey || apiKey.trim() === '') {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'API_KEY_NOT_CONFIGURED',
            message:
              'GEMINI_API_KEY is not configured in Netlify environment variables. Please add GEMINI_API_KEY under Site Settings > Environment Variables.',
          },
        }),
      };
    }

    const aiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: { headers: { 'User-Agent': 'wildlifevision-netlify' } },
    });

    const modelToUse = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const framesToAnalyze = frames.slice(0, 6);

    const analyzedFrames = await Promise.all(
      framesToAnalyze.map(async (frame: any) => {
        const frameIndex = Number(frame.frameIndex ?? 0);
        const timestampSec = Number(frame.timestampSec ?? 0);
        const dataUrl = frame.imageDataUrl || '';

        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!matches) {
          return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        try {
          const resp = await aiClient.models.generateContent({
            model: modelToUse,
            contents: {
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                {
                  text: `Detect all distinct animals visible in this drone video frame. Return bounding boxes on 0-1000 scale, species label, category, confidence (0.0-1.0), and identificationStatus.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
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
                      required: ['animalLabel', 'confidence', 'xMin', 'yMin', 'xMax', 'yMax'],
                    },
                  },
                },
                required: ['detections'],
              },
            },
          });

          let jsonRaw: any = {};
          const txt = (resp.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          if (txt) jsonRaw = JSON.parse(txt);

          const rawList = Array.isArray(jsonRaw?.detections) ? jsonRaw.detections : [];
          const validDets: any[] = [];

          for (let i = 0; i < rawList.length; i++) {
            const raw = rawList[i];
            const box = sanitizeBox({
              xMin: Number(raw.xMin),
              yMin: Number(raw.yMin),
              xMax: Number(raw.xMax),
              yMax: Number(raw.yMax),
            });
            if (box) {
              validDets.push({
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

          const deduplicated = deduplicateDetections(validDets, 0.55);
          return {
            frameIndex,
            timestampSec,
            detections: deduplicated,
            detectionCount: deduplicated.length,
          };
        } catch {
          return { frameIndex, timestampSec, detections: [], detectionCount: 0 };
        }
      })
    );

    const tracks = trackAnimalsAcrossFrames(analyzedFrames, 0.20, 180);
    const speciesCounts = calculateVideoSpeciesCounts(tracks);
    const totalUniqueAnimals = tracks.length;

    const analysisId = `VID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const processingTimeMs = Date.now() - startTime;

    const result = {
      success: true,
      analysisId,
      filename,
      timestamp: new Date().toISOString(),
      mediaType: 'video',
      durationSec: Number(durationSec) || 0,
      videoWidth: Number(videoWidth) || 1920,
      videoHeight: Number(videoHeight) || 1080,
      analyzedFramesCount: analyzedFrames.length,
      tracks,
      totalUniqueAnimals,
      speciesCounts,
      summary:
        totalUniqueAnimals > 0
          ? `Detected and tracked ${totalUniqueAnimals} unique animal(s) across ${speciesCounts.length} species over ${Math.round(durationSec || 0)}s transect.`
          : 'No animals detected across video keyframes.',
      warnings: [],
      status: totalUniqueAnimals > 0 ? 'completed' : 'no_animals_detected',
      processingTimeMs,
      droneMetadata: {
        altitudeMeters: Number(droneMetadata?.altitudeMeters ?? (gps?.altitudeMeters ?? 45)),
        sensorType: droneMetadata?.sensorType || 'Optical 4K Video Sensor',
        locationDesc: droneMetadata?.locationDesc || gps?.locationName || 'Aerial Video Transect',
        gps: gps || droneMetadata?.gps || null,
        droneModel: droneMetadata?.droneModel || 'DJI Matrice 350 RTK / Zenmuse H20T',
      },
      frameDetections: analyzedFrames,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'VIDEO_INFERENCE_ERROR',
          message: err?.message || 'Error occurred during video analysis.',
        },
      }),
    };
  }
};
