import { z } from 'zod';

export interface BoundingBox {
  xMin: number; // 0 - 1000
  yMin: number; // 0 - 1000
  xMax: number; // 0 - 1000
  yMax: number; // 0 - 1000
}

export type IdentificationStatus = 'identified' | 'uncertain' | 'unclassified';

export interface AnimalDetection {
  detectionId: string;
  animalLabel: string;
  category: string;
  confidence: number;
  boundingBox: BoundingBox;
  xMin?: number;
  yMin?: number;
  xMax?: number;
  yMax?: number;
  identificationStatus: IdentificationStatus;
}

export interface SpeciesCount {
  animalLabel: string;
  category?: string;
  count: number;
  status: IdentificationStatus;
}

export interface PerformanceMetrics {
  clientPreprocessingMs: number;
  networkUploadMs: number;
  aiInferenceMs: number;
  validationAndDeduplicationMs: number;
  totalTimeMs: number;
  payloadSizeOriginalKb: number;
  payloadSizeOptimizedKb: number;
  optimizationRatioPct: number;
}

export interface DroneGpsCoordinate {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  locationName?: string;
  source?: 'exif' | 'manual' | 'preset' | 'survey';
  accuracyMeters?: number;
  timestamp?: string;
}

export interface AnalysisDroneMetadata {
  altitudeMeters?: number;
  sensorType?: string;
  locationDesc?: string;
  gps?: DroneGpsCoordinate | null;
  droneModel?: string;
  missionId?: string;
  habitatType?: string;
  notes?: string;
}

export interface AnalysisResult {
  analysisId: string;
  filename: string;
  timestamp: string;
  imageWidth: number;
  imageHeight: number;
  imageDataUrl: string;
  detections: AnimalDetection[];
  totalAnimals: number;
  distinctSpeciesCount: number;
  speciesCounts: SpeciesCount[];
  uncertainCount: number;
  summary: string;
  warnings: string[];
  status: 'completed' | 'no_animals_detected' | 'failed';
  processingTimeMs?: number;
  performanceMetrics?: PerformanceMetrics;
  droneMetadata?: AnalysisDroneMetadata;
}

export type AppTab = 'overview' | 'analyze' | 'video' | 'batch' | 'analytics' | 'reports' | 'map' | 'history' | 'settings';

export interface TrackKeyframe {
  timestampSec: number;
  frameIndex: number;
  boundingBox: BoundingBox;
  confidence: number;
}

export type TrackStatus = 'tentative' | 'confirmed' | 'temporarily_lost' | 'terminated';

export interface AnimalTrack {
  trackId: string;
  animalLabel: string;
  category: string;
  identificationStatus: IdentificationStatus;
  averageConfidence: number;
  firstSeenSec: number;
  lastSeenSec: number;
  firstObservedFrame?: number;
  lastObservedFrame?: number;
  durationSec: number;
  detectionCount: number;
  color?: string;
  keyframes: TrackKeyframe[];
  notes?: string;
  status: TrackStatus;
  confidenceHistory?: number[];
  speciesVotes?: Record<string, number>;
  mergedTrackIds?: string[];
  currentBoundingBox?: BoundingBox;
  previousBoundingBox?: BoundingBox;
}

export interface VideoKeyframeDetection {
  frameIndex: number;
  timestampSec: number;
  detections: AnimalDetection[];
  detectionCount: number;
  imageDataUrl?: string;
}

export interface VideoSpeciesCount {
  animalLabel: string;
  category: string;
  trackCount: number; // Unique confirmed individuals (tracks)
  totalDetections: number; // Total frame sightings
  status: IdentificationStatus;
  tentativeCount?: number;
}

export interface VideoAnalysisResult {
  analysisId: string;
  filename: string;
  timestamp: string;
  videoUrl: string;
  durationSec: number;
  videoWidth: number;
  videoHeight: number;
  fps?: number;
  fileSizeMb?: number;
  totalTrackedAnimals: number; // Confirmed unique individuals
  totalConfirmedTracks?: number;
  totalTentativeTracks?: number;
  totalFrameDetections: number; // Total detections across all processed frames
  distinctSpeciesCount: number;
  speciesCounts: VideoSpeciesCount[];
  tracks: AnimalTrack[];
  analyzedFrames: VideoKeyframeDetection[];
  totalFramesAnalyzed: number;
  samplingIntervalSec: number;
  summary: string;
  warnings: string[];
  methodology: string;
  processingTimeMs: number;
  status: 'completed' | 'no_animals_detected' | 'failed';
  mediaType: 'video';
  droneMetadata?: AnalysisDroneMetadata;
  auditLog?: {
    mergedTracksCount: number;
    duplicateSuppressionCount: number;
    lostTracksReconnectedCount: number;
  };
}

export type BatchItemStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BatchImageItem {
  id: string;
  file?: File;
  filename: string;
  sizeKb: number;
  width: number;
  height: number;
  previewUrl: string;
  status: BatchItemStatus;
  progressPercent?: number;
  error?: string;
  result?: AnalysisResult;
}

export interface BatchSurveySummary {
  batchId: string;
  totalImages: number;
  completedImages: number;
  failedImages: number;
  totalAnimalsDetected: number;
  distinctSpeciesCount: number;
  speciesCounts: SpeciesCount[];
  uncertainDetections: number;
  startTime: string;
  endTime?: string;
}

// Zod schemas for runtime validation
export const BoundingBoxSchema = z.object({
  xMin: z.number().min(0).max(1000),
  yMin: z.number().min(0).max(1000),
  xMax: z.number().min(0).max(1000),
  yMax: z.number().min(0).max(1000),
});

export const RawGeminiDetectionSchema = z.object({
  animalLabel: z.string().min(1),
  category: z.string().default('Wildlife'),
  confidence: z.number().min(0).max(1).default(0.85),
  identificationStatus: z.enum(['identified', 'uncertain', 'unclassified']).default('identified'),
  xMin: z.number(),
  yMin: z.number(),
  xMax: z.number(),
  yMax: z.number(),
});

export const RawGeminiResponseSchema = z.object({
  hasAnimals: z.boolean(),
  summary: z.string().default(''),
  warnings: z.array(z.string()).default([]),
  detections: z.array(RawGeminiDetectionSchema).default([]),
});

export type RawGeminiResponse = z.infer<typeof RawGeminiResponseSchema>;
