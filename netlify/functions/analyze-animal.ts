import type { Handler, HandlerEvent } from './types.js';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

/**
 * Netlify Serverless Function for Aerial Animal Detection
 * Route: POST /api/analyze-animal (redirected to /.netlify/functions/analyze-animal)
 *
 * Provides high-precision wildlife computer vision inference using Google Gemini,
 * structured JSON schema outputs, normalized coordinates [0, 1000], IoU deduplication,
 * and reliable JSON responses on all execution paths.
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// In-memory cache across serverless warm container invocations
const warmImageCache = new Map<string, any>();
const MAX_CACHE_ENTRIES = 50;

function getImageFingerprint(base64Data: string, filename?: string): string {
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

  // Reject degenerate boxes smaller than 4x4 on 1000 scale
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

function deduplicateDetections(detections: any[], iouThreshold = 0.60): any[] {
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

function calculateSpeciesCounts(detections: any[]) {
  if (!detections || detections.length === 0) {
    return {
      totalAnimals: 0,
      distinctSpeciesCount: 0,
      speciesCounts: [],
      uncertainCount: 0,
    };
  }

  const map = new Map<string, { count: number; category: string; status: string; originalName: string }>();
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
      const entry = map.get(key)!;
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

async function callGeminiVision(
  aiClient: GoogleGenAI,
  { mimeType, base64Data, systemInstruction }: { mimeType: string; base64Data: string; systemInstruction: string }
) {
  const configuredModel = process.env.GEMINI_MODEL;
  const modelsToTry = [
    configuredModel,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ].filter(Boolean) as string[];

  let lastError: any = null;

  for (const model of Array.from(new Set(modelsToTry))) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await aiClient.models.generateContent({
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

        return { response, usedModel: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err).toLowerCase();
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('high demand') ||
          msg.includes('unavailable') ||
          msg.includes('overloaded');

        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error('All AI computer vision models were unavailable.');
}

export const handler: Handler = async (event: HandlerEvent) => {
  const serverStartTime = Date.now();

  // 1. Handle HTTP OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'CORS OK' }),
    };
  }

  // 2. Handle HTTP GET status check
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        service: 'WildlifeVision AI Animal Detection Engine (Netlify Serverless)',
        endpoint: '/api/analyze-animal',
        supportedMethod: 'POST',
        acceptedPayload: {
          imageDataUrl: 'string (base64 data URL, required)',
          filename: 'string (optional)',
          droneMetadata: 'object (optional)',
          gps: 'object (optional)',
        },
      }),
    };
  }

  // 3. Only POST is accepted for inference
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `HTTP method ${event.httpMethod} is not supported. Please send a POST request with imageDataUrl.`,
        },
      }),
    };
  }

  try {
    // 4. Parse request payload
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
            error: {
              code: 'INVALID_REQUEST_BODY',
              message: 'Request body must be a valid JSON object containing imageDataUrl.',
            },
          }),
        };
      }
    }

    const {
      imageDataUrl,
      originalImageDataUrl,
      filename = 'drone_aerial_survey.jpg',
      imageWidth = 1920,
      imageHeight = 1080,
      clientPreprocessingMs = 0,
      droneMetadata,
      gps,
    } = body;

    // 5. Validate image data presence
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_IMAGE_DATA',
            message: 'Missing imageDataUrl in request payload.',
          },
        }),
      };
    }

    // 6. Check GEMINI_API_KEY in environment
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
              'GEMINI_API_KEY is not configured in Netlify environment variables. Please go to Netlify Site Settings > Environment Variables, add GEMINI_API_KEY with your Google Gemini API key from Google AI Studio, and trigger a new deploy.',
          },
        }),
      };
    }

    // 7. Validate image format
    const matches = imageDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_IMAGE_FORMAT',
            message: 'Invalid image format. Must be a valid Base64 data URL (JPEG, PNG, WebP).',
          },
        }),
      };
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'UNSUPPORTED_IMAGE_TYPE',
            message: `Unsupported image type: ${mimeType}. Only JPEG, PNG, and WebP are supported.`,
          },
        }),
      };
    }

    // 8. Cache lookup for fast repeated calls
    const imageFingerprint = getImageFingerprint(base64Data, filename);
    if (warmImageCache.has(imageFingerprint)) {
      const cached = warmImageCache.get(imageFingerprint);
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

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(cachedResult),
      };
    }

    // 9. Initialize Google Gemini AI SDK
    const aiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'wildlifevision-netlify',
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
   - If the image contains a dog, identify it as a dog.
   - If the image contains a horse, identify it as a horse.
   - If uncertain of exact species, use the most specific defensible category (e.g. 'Deer family', 'Canine', 'Bird', 'Unknown animal') and set identificationStatus to 'uncertain' or 'unclassified'.
7. If no animals are visibly identifiable, set hasAnimals to false, detections to [], and provide a clear summary and warning.`;

    // 10. Execute AI Vision inference
    const aiStartTime = Date.now();
    const { response, usedModel } = await callGeminiVision(aiClient, {
      mimeType,
      base64Data,
      systemInstruction,
    });
    const aiInferenceMs = Date.now() - aiStartTime;

    const responseText = response.text;
    if (!responseText) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'EMPTY_MODEL_RESPONSE',
            message: 'Empty response received from the Gemini image analysis model.',
          },
        }),
      };
    }

    // 11. Parse structured JSON safely
    let rawData: any;
    try {
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      }
      rawData = JSON.parse(jsonStr);
    } catch {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON_RESPONSE',
            message: 'Failed to parse structured JSON from the vision model response.',
          },
        }),
      };
    }

    const detectionsList = Array.isArray(rawData?.detections) ? rawData.detections : [];
    const valStartTime = Date.now();

    // 12. Sanitize bounding box coordinates
    const validDetections: any[] = [];
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

    // 13. Class-aware IoU deduplication
    const deduplicated = deduplicateDetections(validDetections, 0.60);

    // 14. Species census counts
    const counts = calculateSpeciesCounts(deduplicated);
    const validationAndDeduplicationMs = Date.now() - valStartTime;

    const warnings = Array.isArray(rawData?.warnings) ? [...rawData.warnings] : [];
    if (deduplicated.length === 0 && rawData?.hasAnimals) {
      warnings.push('Model indicated animals present, but no valid bounding boxes could be localized.');
    }

    const analysisId = `SURV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const serverTotalMs = Date.now() - serverStartTime;

    const origData = originalImageDataUrl || imageDataUrl;
    const estimatedBytes = (base64Data.length * 3) / 4;
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
        altitudeMeters: Number(droneMetadata?.altitudeMeters ?? (gps?.altitudeMeters ?? 40)),
        sensorType: droneMetadata?.sensorType || `Optical RGB 4K (${usedModel})`,
        locationDesc: droneMetadata?.locationDesc || gps?.locationName || 'Autonomous Aerial Transect',
        gps: gps || droneMetadata?.gps || null,
        droneModel: droneMetadata?.droneModel || 'DJI Matrice 350 RTK / Zenmuse H20T',
        missionId: droneMetadata?.missionId || null,
        habitatType: droneMetadata?.habitatType || null,
        notes: droneMetadata?.notes || null,
      },
    };

    // Cache warm container entry
    if (warmImageCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = warmImageCache.keys().next().value;
      if (oldestKey) warmImageCache.delete(oldestKey);
    }
    warmImageCache.set(imageFingerprint, result);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown server error during image analysis';

    if (message.includes('429') || message.includes('ResourceExhausted') || message.includes('quota')) {
      return {
        statusCode: 429,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': '3',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Gemini API rate limit reached. Please wait a few moments before trying again.',
            retryable: true,
          },
        }),
      };
    }

    if (message.includes('timed out')) {
      return {
        statusCode: 504,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INFERENCE_TIMEOUT',
            message: 'AI analysis request timed out. Please try optimizing or selecting a clearer image.',
            retryable: true,
          },
        }),
      };
    }

    if (
      message.includes('503') ||
      message.includes('high demand') ||
      message.includes('unavailable') ||
      message.includes('overloaded') ||
      message.includes('All AI computer vision models were unavailable')
    ) {
      return {
        statusCode: 503,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': '3',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'SERVICE_HIGH_DEMAND',
            message:
              'The AI computer vision detection service is experiencing high demand. Please try again in a few moments.',
            retryable: true,
          },
        }),
      };
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INFERENCE_SERVICE_ERROR',
          message,
          retryable: false,
        },
      }),
    };
  }
};
