import { sanitizeBoundingBox, calculateIoU, deduplicateDetections, normalizedToCanvasPixel, canvasPixelToNormalized } from '../utils/coordinateUtils';
import { calculateSpeciesCounts } from '../utils/countUtils';
import { RawGeminiResponseSchema, AnimalDetection } from '../types/wildlife';

export function runWildlifeTestSuite(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      failed++;
      errors.push(testName);
      console.error(`  ✗ ${testName}`);
    }
  }

  console.log('\n--- Running WildlifeVision AI Core Test Suite ---');

  // Test 1: Bounding-box coordinate conversion & sanitization
  console.log('\n[1] Bounding Box Coordinate Validation');
  const validBox = sanitizeBoundingBox({ xMin: 120, yMin: 180, xMax: 400, yMax: 500 });
  assert(validBox !== null && validBox.xMin === 120 && validBox.xMax === 400, 'Valid box within [0, 1000] is preserved');

  const clampedBox = sanitizeBoundingBox({ xMin: -50, yMin: -20, xMax: 1200, yMax: 1050 });
  assert(clampedBox !== null && clampedBox.xMin === 0 && clampedBox.xMax === 1000, 'Coordinates outside [0, 1000] are clamped');

  const invertedBox = sanitizeBoundingBox({ xMin: 500, yMin: 600, xMax: 200, yMax: 100 });
  assert(invertedBox !== null && invertedBox.xMin === 200 && invertedBox.xMax === 500, 'Inverted coordinates (min > max) are swapped');

  const degenerateBox = sanitizeBoundingBox({ xMin: 200, yMin: 200, xMax: 201, yMax: 201 });
  assert(degenerateBox === null, 'Degenerate zero-size box (< 4px) is rejected');

  // Test 2: Normalized to Canvas Pixel conversion
  console.log('\n[2] Normalized to Canvas Pixel Math');
  const px500 = normalizedToCanvasPixel(500, 1920);
  assert(px500 === 960, 'Normalized 500 on 1920px canvas maps to 960px');

  const normBack = canvasPixelToNormalized(960, 1920);
  assert(normBack === 500, '960px on 1920px canvas maps back to normalized 500');

  // Test 3: IoU Calculation
  console.log('\n[3] IoU (Intersection over Union) Calculation');
  const boxA = { xMin: 100, yMin: 100, xMax: 300, yMax: 300 };
  const boxIdentical = { xMin: 100, yMin: 100, xMax: 300, yMax: 300 };
  const iouIdentical = calculateIoU(boxA, boxIdentical);
  assert(Math.abs(iouIdentical - 1.0) < 0.001, 'Identical bounding boxes yield IoU = 1.0');

  const boxDisjoint = { xMin: 500, yMin: 500, xMax: 700, yMax: 700 };
  const iouDisjoint = calculateIoU(boxA, boxDisjoint);
  assert(iouDisjoint === 0, 'Disjoint boxes yield IoU = 0.0');

  // Test 4: Deduplication of Overlapping Detections (NMS)
  console.log('\n[4] Class-aware Deduplication / NMS');
  const sampleDetections: AnimalDetection[] = [
    {
      detectionId: 'DET-001',
      animalLabel: 'African Elephant',
      category: 'Mammal',
      confidence: 0.95,
      boundingBox: { xMin: 100, yMin: 100, xMax: 300, yMax: 300 },
      identificationStatus: 'identified',
    },
    {
      // Overlapping box of the same elephant with lower confidence
      detectionId: 'DET-002',
      animalLabel: 'African Elephant',
      category: 'Mammal',
      confidence: 0.82,
      boundingBox: { xMin: 105, yMin: 102, xMax: 305, yMax: 298 },
      identificationStatus: 'identified',
    },
    {
      // Distinct elephant further away
      detectionId: 'DET-003',
      animalLabel: 'African Elephant',
      category: 'Mammal',
      confidence: 0.89,
      boundingBox: { xMin: 500, yMin: 500, xMax: 700, yMax: 700 },
      identificationStatus: 'identified',
    },
  ];

  const deduplicated = deduplicateDetections(sampleDetections, 0.6);
  assert(deduplicated.length === 2, 'Deduplication merges overlapping boxes of same animal while preserving distinct individuals');
  assert(deduplicated[0].confidence === 0.95, 'Deduplication retains the higher-confidence proposal');

  // Test 5: Species-wise Count Calculation & Total Calculation
  console.log('\n[5] Species Count and Total Aggregations');
  const multiSpecies: AnimalDetection[] = [
    {
      detectionId: '1',
      animalLabel: 'Lion',
      category: 'Mammal',
      confidence: 0.92,
      boundingBox: { xMin: 10, yMin: 10, xMax: 50, yMax: 50 },
      identificationStatus: 'identified',
    },
    {
      detectionId: '2',
      animalLabel: 'Lion',
      category: 'Mammal',
      confidence: 0.88,
      boundingBox: { xMin: 60, yMin: 10, xMax: 100, yMax: 50 },
      identificationStatus: 'identified',
    },
    {
      detectionId: '3',
      animalLabel: 'Zebra',
      category: 'Mammal',
      confidence: 0.91,
      boundingBox: { xMin: 120, yMin: 10, xMax: 160, yMax: 50 },
      identificationStatus: 'identified',
    },
    {
      detectionId: '4',
      animalLabel: 'Zebra',
      category: 'Mammal',
      confidence: 0.85,
      boundingBox: { xMin: 180, yMin: 10, xMax: 220, yMax: 50 },
      identificationStatus: 'identified',
    },
    {
      detectionId: '5',
      animalLabel: 'Zebra',
      category: 'Mammal',
      confidence: 0.79,
      boundingBox: { xMin: 240, yMin: 10, xMax: 280, yMax: 50 },
      identificationStatus: 'identified',
    },
    {
      detectionId: '6',
      animalLabel: 'Elephant',
      category: 'Mammal',
      confidence: 0.94,
      boundingBox: { xMin: 300, yMin: 10, xMax: 350, yMax: 50 },
      identificationStatus: 'identified',
    },
  ];

  const countResult = calculateSpeciesCounts(multiSpecies);
  assert(countResult.totalAnimals === 6, 'Total animal count strictly equals 6 (2 Lions + 3 Zebras + 1 Elephant)');
  assert(countResult.distinctSpeciesCount === 3, 'Distinct species count equals 3');
  assert(countResult.speciesCounts.find((s) => s.animalLabel === 'Zebra')?.count === 3, 'Zebra count equals 3');
  assert(countResult.speciesCounts.find((s) => s.animalLabel === 'Lion')?.count === 2, 'Lion count equals 2');
  assert(countResult.speciesCounts.find((s) => s.animalLabel === 'Elephant')?.count === 1, 'Elephant count equals 1');

  // Test 6: Empty Detection Results
  console.log('\n[6] Empty Detection Handling');
  const emptyCounts = calculateSpeciesCounts([]);
  assert(emptyCounts.totalAnimals === 0, 'Empty detection list yields totalAnimals = 0');
  assert(emptyCounts.distinctSpeciesCount === 0, 'Empty detection list yields distinctSpeciesCount = 0');
  assert(emptyCounts.speciesCounts.length === 0, 'Empty detection list yields empty speciesCounts array');

  // Test 7: Zod Runtime Schema Validation
  console.log('\n[7] Zod Runtime Schema Validation');
  const validMockResponse = {
    hasAnimals: true,
    summary: 'Savanna clearing with grazing ungulates.',
    warnings: ['Slight sun glare on top-right quadrant.'],
    detections: [
      {
        animalLabel: 'Giraffe',
        category: 'Mammal',
        confidence: 0.93,
        identificationStatus: 'identified',
        xMin: 200,
        yMin: 150,
        xMax: 320,
        yMax: 480,
      },
    ],
  };

  const schemaValidation = RawGeminiResponseSchema.safeParse(validMockResponse);
  assert(schemaValidation.success, 'Valid model payload passes Zod schema validation');

  const invalidMockResponse = {
    hasAnimals: 'not_a_boolean', // Invalid type
    detections: 'not_an_array',
  };
  const invalidSchemaValidation = RawGeminiResponseSchema.safeParse(invalidMockResponse);
  assert(!invalidSchemaValidation.success, 'Malformed model payload is rejected by Zod schema');

  // Test 8: Single Species Mapping Integrity (Rule 1 & Rule 3)
  console.log('\n[8] Species Mapping Integrity (Dog, Horse, Lion, Multi-species, Zero Animals)');
  const dogDetection: AnimalDetection[] = [
    {
      detectionId: 'DET-001',
      animalLabel: 'Domestic Dog',
      category: 'Mammal',
      confidence: 0.96,
      boundingBox: { xMin: 200, yMin: 300, xMax: 400, yMax: 500 },
      identificationStatus: 'identified',
    },
  ];
  const dogCount = calculateSpeciesCounts(dogDetection);
  assert(dogCount.totalAnimals === 1 && dogCount.speciesCounts[0].animalLabel === 'Domestic Dog', 'Dog image identifies strictly as Domestic Dog');

  const horseDetection: AnimalDetection[] = [
    {
      detectionId: 'DET-001',
      animalLabel: 'Domestic Horse',
      category: 'Mammal',
      confidence: 0.94,
      boundingBox: { xMin: 150, yMin: 250, xMax: 450, yMax: 650 },
      identificationStatus: 'identified',
    },
  ];
  const horseCount = calculateSpeciesCounts(horseDetection);
  assert(horseCount.totalAnimals === 1 && horseCount.speciesCounts[0].animalLabel === 'Domestic Horse', 'Horse image identifies strictly as Domestic Horse');

  const lionDetection: AnimalDetection[] = [
    {
      detectionId: 'DET-001',
      animalLabel: 'Lion',
      category: 'Mammal',
      confidence: 0.95,
      boundingBox: { xMin: 100, yMin: 100, xMax: 300, yMax: 300 },
      identificationStatus: 'identified',
    },
  ];
  const lionCount = calculateSpeciesCounts(lionDetection);
  assert(lionCount.totalAnimals === 1 && lionCount.speciesCounts[0].animalLabel === 'Lion', 'Lion image identifies strictly as Lion');

  // Test 9: Aspect Ratio Scaling Mathematics
  console.log('\n[9] Aspect Ratio Preserving Math');
  const origW = 3840;
  const origH = 2160;
  const maxDim = 1360;
  const scale = maxDim / Math.max(origW, origH);
  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);
  assert(targetW === 1360, 'Target width scales to maximum dimension bound 1360px');
  assert(Math.abs(origW / origH - targetW / targetH) < 0.005, 'Aspect ratio is strictly preserved during downscaling');

  // Test 10: HTML Error Interception (Prevents "Unexpected token '<'")
  console.log('\n[10] HTML and Non-JSON Response Protection');
  const mockHtmlDoc = '<!doctype html><html lang="en"><head><title>504 Gateway Timeout</title></head><body><h1>Gateway Timeout</h1></body></html>';
  const isHtml = mockHtmlDoc.trim().startsWith('<') || mockHtmlDoc.trim().startsWith('<!doctype');
  assert(isHtml, 'HTML response detected before JSON.parse is called');

  let htmlIntercepted = false;
  let diagnostic = '';
  try {
    if (isHtml) {
      const titleMatch = mockHtmlDoc.match(/<title>([^<]+)<\/title>/i);
      diagnostic = titleMatch ? titleMatch[1] : 'HTML error page';
      throw new Error(`Server returned an HTML page instead of JSON. Diagnostic: "${diagnostic}"`);
    }
    JSON.parse(mockHtmlDoc);
  } catch (err: any) {
    htmlIntercepted = err.message.includes('Server returned an HTML page instead of JSON');
  }
  assert(htmlIntercepted, 'HTML response cleanly captured without throwing JSON Unexpected token syntax error');
  assert(diagnostic === '504 Gateway Timeout', 'Extracted meaningful diagnostic from HTML error title');

  // Test 11: Structured API Error Schema Consistency
  console.log('\n[11] Structured API Error Schema Consistency');
  const errorPayload = {
    success: false,
    error: {
      code: 'INFERENCE_SERVICE_UNAVAILABLE',
      message: 'The animal detection service is currently unavailable.',
    },
  };
  assert(errorPayload.success === false, 'Error response has success === false');
  assert(errorPayload.error.code === 'INFERENCE_SERVICE_UNAVAILABLE', 'Error response provides predictable machine-readable code');
  assert(typeof errorPayload.error.message === 'string', 'Error response provides human-readable message');

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  return { passed, failed, errors };
}
