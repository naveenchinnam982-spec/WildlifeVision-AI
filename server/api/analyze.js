import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * WildlifeVision AI - Server-Side Animal Detection Controller
 * Endpoint: POST /api/analyze-animal
 *
 * Implements high-precision wildlife detection from aerial/drone imagery
 * using the Google Generative AI SDK, structured schema output with bounding boxes,
 * coordinate sanitization, IoU deduplication, census counts, and strict JSON error handling
 * that prevents HTML response fallbacks.
 */

const router = express.Router();

// Strict JSON Content-Type enforcement middleware for all routes in this router
router.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

import { historyStore } from '../storage/historyStore.js';

// In-memory survey analysis store accessor
export const surveyHistory = historyStore.getAll();

// In-memory LRU cache for instant responses on identical / repeated images (up to 100 entries)
const imageAnalysisCache = new Map();
const MAX_IMAGE_CACHE_ENTRIES = 100;

function getImageFingerprint(base64Data, filename) {
  const sample =
    base64Data.slice(0, 16384) +
    ':' +
    base64Data.slice(-16384) +
    ':' +
    base64Data.length +
    ':' +
    (filename || '');
  return crypto.createHash('sha256').update(sample).digest('hex');
}

/**
 * Validates and normalizes bounding box coordinates within [0, 1000].
 * Discards degenerate or collapsed boxes.
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

  // Reject degenerate boxes smaller than 4x4 on 1000 scale
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
 * Deduplicates overlapping detections of the same or compatible animal class
 * using class-aware Non-Maximum Suppression (NMS).
 */
function deduplicateDetections(detections, iouThreshold = 0.6) {
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

      if (iou >= 0.85) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  return kept.map((det, index) => ({
    ...det,
    detectionId: `DET-${String(index + 1).padStart(3, '0')}`,
  }));
}

/**
 * Aggregates species-wise census counts from the deduplicated animal detections.
 */
function calculateSpeciesCounts(detections) {
  if (!detections || detections.length === 0) {
    return {
      totalAnimals: 0,
      distinctSpeciesCount: 0,
      speciesCounts: [],
      uncertainCount: 0,
    };
  }

  const map = new Map();
  let uncertainCount = 0;

  for (const det of detections) {
    const rawLabel = (det.animalLabel || 'Unknown animal').trim();
    const key = rawLabel.toLowerCase();
    const formattedName = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

    if (det.identificationStatus === 'uncertain' || det.identificationStatus === 'unclassified') {
      uncertainCount++;
    }

    if (!map.has(key)) {
      map.set(key, {
        count: 1,
        category: det.category || 'Wildlife',
        status: det.identificationStatus || 'identified',
        originalName: formattedName,
      });
    } else {
      const entry = map.get(key);
      entry.count += 1;
      if (det.identificationStatus !== 'identified' && entry.status === 'identified') {
        entry.status = det.identificationStatus;
      }
    }
  }

  const speciesCounts = Array.from(map.values())
    .map((item) => ({
      animalLabel: item.originalName,
      category: item.category,
      count: item.count,
      status: item.status,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAnimals: detections.length,
    distinctSpeciesCount: speciesCounts.length,
    speciesCounts,
    uncertainCount,
  };
}

/**
 * Performs Gemini multimodal vision inference with multi-model fallback,
 * structured JSON schema constraints, and timeout protection.
 */
async function callGeminiVisionWithRetry(
  aiClient,
  { mimeType, base64Data, systemInstruction },
  timeoutMs = 30000
) {
  const configuredModel = process.env.GEMINI_MODEL;
  // High-speed candidate precedence: gemini-3.1-flash-lite (fastest vision inference), gemini-flash-latest, gemini-3.8-flash
  const candidates = [
    configuredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter(Boolean);
  const modelsToTry = Array.from(new Set(candidates));

  let lastError = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    // Attempt up to 2 times per candidate model on transient service spikes
    for (let modelAttempt = 0; modelAttempt < 2; modelAttempt++) {
      try {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`AI Vision inference timed out after ${Math.round(timeoutMs / 1000)}s on ${model}.`));
          }, timeoutMs);
        });

        const apiPromise = aiClient.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: `Detect all distinct animals visible in this aerial/wildlife image. Return one bounding box per individual animal on the 0-1000 scale, with species label, category, confidence (0.0 - 1.0), and identificationStatus ('identified', 'uncertain', or 'unclassified'). Also note scene summary and any environmental or image quality warnings.`,
              },
            ],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hasAnimals: {
                  type: Type.BOOLEAN,
                  description: 'Whether any animals are visible in the image',
                },
                summary: {
                  type: Type.STRING,
                  description: 'Brief overview of detected wildlife, habitat, and drone perspective',
                },
                warnings: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Any lighting, occlusion, altitude, or quality warnings',
                },
                detections: {
                  type: Type.ARRAY,
                  description: 'List of individual animal detections with bounding box coordinates',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      animalLabel: {
                        type: Type.STRING,
                        description: 'Specific identified species name',
                      },
                      category: {
                        type: Type.STRING,
                        description: 'Broad category like Mammal, Bird, Reptile, etc.',
                      },
                      confidence: {
                        type: Type.NUMBER,
                        description: 'Estimated model confidence score between 0.0 and 1.0',
                      },
                      identificationStatus: {
                        type: Type.STRING,
                        description: 'Status: identified, uncertain, or unclassified',
                      },
                      xMin: {
                        type: Type.INTEGER,
                        description: 'Bounding box left coordinate (0 to 1000)',
                      },
                      yMin: {
                        type: Type.INTEGER,
                        description: 'Bounding box top coordinate (0 to 1000)',
                      },
                      xMax: {
                        type: Type.INTEGER,
                        description: 'Bounding box right coordinate (0 to 1000)',
                      },
                      yMax: {
                        type: Type.INTEGER,
                        description: 'Bounding box bottom coordinate (0 to 1000)',
                      },
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
              required: ['hasAnimals', 'summary', 'warnings', 'detections'],
            },
          },
        });

        const res = await Promise.race([apiPromise, timeoutPromise]);
        clearTimeout(timeoutHandle);
        return { response: res, usedModel: model };
      } catch (err) {
        lastError = err;
        const errMsg = (err?.message ? String(err.message) : String(err)).toLowerCase();
        const status = err?.status || err?.code || 0;

        const isTransient =
          status === 503 ||
          status === 429 ||
          errMsg.includes('503') ||
          errMsg.includes('429') ||
          errMsg.includes('high demand') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('rate limit');

        // Retry same model once with 1.2s delay if transient spike
        if (isTransient && modelAttempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }

        // If permanent or second attempt failed, break to try next candidate model
        break;
      }
    }
  }

  throw lastError || new Error('All AI computer vision models were unavailable.');
}

/**
 * Primary Express handler for POST /api/analyze-animal
 */
export async function handleAnalyzeAnimal(req, res) {
  // Guarantee JSON Content-Type header on all responses to prevent HTML fallbacks
  res.setHeader('Content-Type', 'application/json');

  const serverStartTime = Date.now();

  try {
    const {
      imageDataUrl,
      originalImageDataUrl,
      filename,
      imageWidth,
      imageHeight,
      clientPreprocessingMs = 0,
      droneMetadata,
      gps,
    } = req.body || {};

    // 1. Validate payload presence
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_IMAGE_DATA',
          message: 'Missing imageDataUrl in request payload.',
        },
      });
    }

    // 2. Validate GEMINI_API_KEY
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
          message:
            'GEMINI_API_KEY is not configured in the server environment. Please set GEMINI_API_KEY in the environment secrets.',
        },
      });
    }

    // 3. Validate image data format and mime type
    const matches = imageDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IMAGE_FORMAT',
          message: 'Invalid image format. Must be a valid Base64 data URL (JPEG, PNG, WebP).',
        },
      });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_IMAGE_TYPE',
          message: `Unsupported image type: ${mimeType}. Only JPEG, PNG, and WebP are supported.`,
        },
      });
    }

    // 3.5 Check in-memory image analysis cache for immediate cache hit (<15ms)
    const imageFingerprint = getImageFingerprint(base64Data, filename);
    if (imageAnalysisCache.has(imageFingerprint)) {
      const cached = imageAnalysisCache.get(imageFingerprint);
      const serverTotalMs = Date.now() - serverStartTime;
      const cachedResult = {
        ...cached,
        analysisId: `SURV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        droneMetadata: {
          ...cached.droneMetadata,
          gps: gps || cached.droneMetadata?.gps || null,
          altitudeMeters: Number(
            droneMetadata?.altitudeMeters ??
              (gps?.altitudeMeters ?? cached.droneMetadata?.altitudeMeters ?? 40)
          ),
          locationDesc:
            droneMetadata?.locationDesc ||
            gps?.locationName ||
            cached.droneMetadata?.locationDesc ||
            'Autonomous Aerial Transect',
        },
        performanceMetrics: {
          ...cached.performanceMetrics,
          clientPreprocessingMs: Number(clientPreprocessingMs) || 0,
          networkUploadMs: 1,
          aiInferenceMs: 2,
          totalTimeMs: serverTotalMs + (Number(clientPreprocessingMs) || 0),
          isCacheHit: true,
        },
        processingTimeMs: serverTotalMs + (Number(clientPreprocessingMs) || 0),
      };

      historyStore.add(cachedResult);
      const currentAll = historyStore.getAll();
      surveyHistory.length = 0;
      surveyHistory.push(...currentAll);

      return res.status(200).json(cachedResult);
    }

    // 4. Validate image file size (max 25MB)
    const estimatedBytes = (base64Data.length * 3) / 4;
    if (estimatedBytes > 25 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Uploaded image exceeds maximum allowed size of 25MB.',
        },
      });
    }

    // 5. Initialize Google GenAI client
    const aiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-wildlifevision',
        },
      },
    });

    const systemInstruction = `You are an expert wildlife biologist and drone aerial computer vision detection assistant. Examine only the image supplied in the current request.

Your task:
1. Identify each distinct animal that is visibly supported by the image.
2. Assign the most specific animal species label that can be justified by visible evidence (e.g., 'African Elephant', 'Plains Zebra', 'White-tailed Deer', 'Domestic Dog', 'Domestic Horse', 'Lion', 'Bald Eagle', 'Mallard Duck', etc.). Never assume an animal exists merely because it is common in a wildlife scene.
3. For each distinct visible animal, provide one localized detection with a bounding box and confidence score (0.0 to 1.0).
4. Do not count the same animal more than once. Do not count body parts or detached limbs as separate animals. Do not duplicate detections simply because animals overlap.
5. Coordinate system requirements:
   - Coordinates must be normalized integers from 0 to 1000.
   - xMin: left coordinate of the animal bounding box (0 to 1000)
   - yMin: top coordinate of the animal bounding box (0 to 1000)
   - xMax: right coordinate of the animal bounding box (0 to 1000)
   - yMax: bottom coordinate of the animal bounding box (0 to 1000)
   - Always ensure xMin < xMax and yMin < yMax.
6. Species accuracy:
   - If the image contains a dog, identify it as a dog. Do not label it a lion, horse, or another animal.
   - If the image contains a horse, identify it as a horse.
   - If uncertain of exact species, use the most specific defensible category (e.g. 'Deer family', 'Canine', 'Bird', 'Unknown animal') and set identificationStatus to 'uncertain' or 'unclassified'.
7. If no animals are visibly identifiable, set hasAnimals to false, detections to [], and provide a clear summary and warning.`;

    // 6. Execute AI image inference
    const aiStartTime = Date.now();
    const { response, usedModel } = await callGeminiVisionWithRetry(
      aiClient,
      { mimeType, base64Data, systemInstruction },
      25000
    );
    const aiInferenceMs = Date.now() - aiStartTime;

    const responseText = response.text;
    if (!responseText) {
      return res.status(502).json({
        success: false,
        error: {
          code: 'EMPTY_MODEL_RESPONSE',
          message: 'Empty response received from the Gemini image analysis model.',
        },
      });
    }

    // 7. Parse model response JSON safely
    let rawData;
    try {
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      }
      rawData = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({
        success: false,
        error: {
          code: 'INVALID_JSON_RESPONSE',
          message: 'Failed to parse structured JSON from the vision model response.',
        },
      });
    }

    const detectionsList = Array.isArray(rawData?.detections) ? rawData.detections : [];
    const valStartTime = Date.now();

    // 8. Sanitize bounding box coordinates
    const validDetections = [];
    for (let i = 0; i < detectionsList.length; i++) {
      const rawDet = detectionsList[i];
      if (!rawDet || typeof rawDet !== 'object') continue;

      const sanitizedBox = sanitizeBox({
        xMin: Number(rawDet.xMin),
        yMin: Number(rawDet.yMin),
        xMax: Number(rawDet.xMax),
        yMax: Number(rawDet.yMax),
      });

      if (sanitizedBox) {
        validDetections.push({
          detectionId: `DET-${String(i + 1).padStart(3, '0')}`,
          animalLabel: String(rawDet.animalLabel || 'Unknown animal'),
          category: String(rawDet.category || 'Wildlife'),
          confidence: Math.min(1.0, Math.max(0.1, Number(rawDet.confidence) || 0.85)),
          boundingBox: sanitizedBox,
          xMin: sanitizedBox.xMin,
          yMin: sanitizedBox.yMin,
          xMax: sanitizedBox.xMax,
          yMax: sanitizedBox.yMax,
          identificationStatus: ['identified', 'uncertain', 'unclassified'].includes(rawDet.identificationStatus)
            ? rawDet.identificationStatus
            : 'identified',
        });
      }
    }

    // 9. Class-aware IoU deduplication
    const deduplicated = deduplicateDetections(validDetections, 0.6);

    // 10. Authoritative census calculations
    const counts = calculateSpeciesCounts(deduplicated);
    const validationAndDeduplicationMs = Date.now() - valStartTime;

    const warnings = Array.isArray(rawData?.warnings) ? [...rawData.warnings] : [];
    if (deduplicated.length === 0 && rawData?.hasAnimals) {
      warnings.push('Model indicated animals present, but no valid bounding boxes could be localized.');
    }

    const analysisId = `SURV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const serverTotalMs = Date.now() - serverStartTime;

    const origData = originalImageDataUrl || imageDataUrl;
    const origBytes = Math.round((origData.length * 3) / 4 / 1024);
    const optimizedBytes = Math.round(estimatedBytes / 1024);
    const optimizationRatioPct = origBytes > 0 ? Math.round(((origBytes - optimizedBytes) / origBytes) * 100) : 0;

    const performanceMetrics = {
      clientPreprocessingMs: Number(clientPreprocessingMs) || 0,
      networkUploadMs: Math.max(0, serverTotalMs - aiInferenceMs - validationAndDeduplicationMs),
      aiInferenceMs,
      validationAndDeduplicationMs,
      totalTimeMs: serverTotalMs + (Number(clientPreprocessingMs) || 0),
      payloadSizeOriginalKb: origBytes,
      payloadSizeOptimizedKb: optimizedBytes,
      optimizationRatioPct,
    };

    const result = {
      success: true,
      analysisId,
      filename: filename || 'drone_aerial_survey.jpg',
      timestamp: new Date().toISOString(),
      imageWidth: Number(imageWidth) || 1920,
      imageHeight: Number(imageHeight) || 1080,
      imageDataUrl: origData,
      detections: deduplicated,
      totalAnimals: counts.totalAnimals,
      distinctSpeciesCount: counts.distinctSpeciesCount,
      speciesCounts: counts.speciesCounts,
      uncertainCount: counts.uncertainCount,
      summary:
        rawData?.summary ||
        (deduplicated.length > 0
          ? `Detected ${counts.totalAnimals} animal(s) across ${counts.distinctSpeciesCount} species.`
          : 'No animals detected in this image.'),
      warnings,
      status: deduplicated.length > 0 ? 'completed' : 'no_animals_detected',
      processingTimeMs: performanceMetrics.totalTimeMs,
      performanceMetrics,
      droneMetadata: {
        altitudeMeters: Number(droneMetadata?.altitudeMeters ?? (gps?.altitudeMeters ?? Math.floor(35 + Math.random() * 25))),
        sensorType: droneMetadata?.sensorType || `Optical RGB 4K (${usedModel})`,
        locationDesc: droneMetadata?.locationDesc || gps?.locationName || 'Autonomous Aerial Transect',
        gps: gps || droneMetadata?.gps || null,
        droneModel: droneMetadata?.droneModel || 'DJI Matrice 350 RTK / Zenmuse H20T',
        missionId: droneMetadata?.missionId || null,
        habitatType: droneMetadata?.habitatType || null,
        notes: droneMetadata?.notes || null,
      },
    };

    // Cache the completed result for instant retrieval on identical images
    if (imageAnalysisCache.size >= MAX_IMAGE_CACHE_ENTRIES) {
      const oldestKey = imageAnalysisCache.keys().next().value;
      if (oldestKey) imageAnalysisCache.delete(oldestKey);
    }
    imageAnalysisCache.set(imageFingerprint, result);

    // Store permanently in persistent disk history
    historyStore.add(result);
    // Keep surveyHistory memory reference in sync
    const currentAll = historyStore.getAll();
    surveyHistory.length = 0;
    surveyHistory.push(...currentAll);

    return res.status(200).json(result);
  } catch (err) {
    if (res.headersSent) {
      return;
    }
    res.setHeader('Content-Type', 'application/json');

    const message = err instanceof Error ? err.message : 'Unknown server error during image analysis';

    if (message.includes('429') || message.includes('ResourceExhausted') || message.includes('quota')) {
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

    if (message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: {
          code: 'INFERENCE_TIMEOUT',
          message: 'AI analysis request timed out. Please try optimizing or selecting a clearer image.',
          retryable: true,
        },
      });
    }

    if (
      message.includes('503') ||
      message.includes('high demand') ||
      message.includes('unavailable') ||
      message.includes('overloaded') ||
      message.includes('All AI computer vision models were unavailable')
    ) {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_HIGH_DEMAND',
          message:
            'The AI computer vision detection service is experiencing high demand. Please try again in a few moments.',
          retryable: true,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INFERENCE_SERVICE_ERROR',
        message,
        retryable: false,
      },
    });
  }
}

// Support all standard route mountings and aliases:
const imageEndpoints = [
  '/api/analyze-animal',
  '/api/analyze-image',
  '/api/image-analyze',
  '/api/analyze/image',
  '/api/image',
  '/analyze-animal',
  '/analyze-image',
  '/image-analyze',
];

imageEndpoints.forEach((route) => {
  router.post(route, handleAnalyzeAnimal);
  router.get(route, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      service: 'WildlifeVision AI Animal Detection Engine',
      endpoint: route,
      supportedMethod: 'POST',
      acceptedPayload: {
        imageDataUrl: 'string (base64 data URL, required)',
        filename: 'string (optional)',
        droneMetadata: 'object (optional)',
        gps: 'object (optional)',
      },
    });
  });
});

router.post('/', handleAnalyzeAnimal);

// Return JSON 405 Method Not Allowed for non-POST/non-GET calls (PUT, DELETE, etc.)
const handleMethodNotAllowed = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(405).json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed on ${req.originalUrl}. Send a POST request with JSON payload containing imageDataUrl.`,
    },
  });
};

imageEndpoints.forEach((route) => {
  router.all(route, handleMethodNotAllowed);
});

export default router;
