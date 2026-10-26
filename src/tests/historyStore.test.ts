import { historyStore } from '../../server/storage/historyStore.js';

export function runHistoryStoreTestSuite(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  console.log('\n--- Running WildlifeVision AI Permanent History Store Test Suite ---');

  console.log('[1] Record Addition & Persistence');
  const mockId1 = `TEST-SURV-${Date.now()}-001`;
  const mockRecord1 = {
    analysisId: mockId1,
    filename: 'forest_canopy_elephants.jpg',
    timestamp: new Date().toISOString(),
    imageWidth: 1920,
    imageHeight: 1080,
    imageDataUrl: 'data:image/jpeg;base64,mock',
    detections: [
      {
        detectionId: 'DET-001',
        animalLabel: 'African Elephant',
        category: 'Mammal',
        confidence: 0.94,
        boundingBox: { xMin: 100, yMin: 150, xMax: 400, yMax: 500 },
        xMin: 100,
        yMin: 150,
        xMax: 400,
        yMax: 500,
        identificationStatus: 'identified',
      },
    ],
    totalAnimals: 1,
    distinctSpeciesCount: 1,
    speciesCounts: [{ animalLabel: 'African Elephant', category: 'Mammal', count: 1, status: 'identified' }],
    status: 'completed' as const,
    droneMetadata: {
      altitudeMeters: 45,
      sensorType: 'Optical RGB 4K',
      locationDesc: 'Maasai Mara National Reserve, Kenya',
      gps: {
        latitude: -1.5034,
        longitude: 35.1432,
        altitudeMeters: 45,
        locationName: 'Maasai Mara National Reserve, Kenya',
        source: 'exif' as const,
      },
    },
  };

  historyStore.add(mockRecord1);
  const allRecords = historyStore.getAll();
  const found1 = allRecords.find((r) => r.analysisId === mockId1);

  assert(Boolean(found1), 'Record is successfully stored in permanent history');
  assert(found1?.totalAnimals === 1, 'Total animals count is preserved exactly');
  assert(found1?.speciesCounts?.[0]?.animalLabel === 'African Elephant', 'Species label is preserved');
  assert(found1?.droneMetadata?.gps?.latitude === -1.5034, 'GPS latitude is accurately preserved');

  console.log('[2] Idempotency & Duplicate Prevention');
  // Re-adding the identical record with same analysisId must not duplicate entries
  historyStore.add(mockRecord1);
  const recordsAfterDuplicate = historyStore.getAll();
  const countWithSameId = recordsAfterDuplicate.filter((r) => r.analysisId === mockId1).length;
  assert(countWithSameId === 1, 'Duplicate submissions with same analysisId do NOT create duplicate entries');

  console.log('[3] GPS Telemetry Attachment & Patching');
  const mockId2 = `TEST-SURV-${Date.now()}-002`;
  const mockRecord2 = {
    analysisId: mockId2,
    filename: 'ungeotagged_aerial_deer.jpg',
    timestamp: new Date().toISOString(),
    imageWidth: 1920,
    imageHeight: 1080,
    imageDataUrl: 'data:image/jpeg;base64,mock',
    detections: [],
    totalAnimals: 0,
    distinctSpeciesCount: 0,
    speciesCounts: [],
    status: 'no_animals_detected' as const,
    droneMetadata: {},
  };

  historyStore.add(mockRecord2);
  const newGps = {
    latitude: 38.4755,
    longitude: -78.4535,
    altitudeMeters: 36,
    locationName: 'Shenandoah National Park, Virginia',
    source: 'manual' as const,
  };

  historyStore.updateGps(mockId2, newGps, { missionId: 'MISSION-DRONE-99' });
  const updated2 = historyStore.getAll().find((r) => r.analysisId === mockId2);

  assert(updated2?.droneMetadata?.gps?.latitude === 38.4755, 'Patched GPS latitude is correctly saved');
  assert(updated2?.droneMetadata?.gps?.longitude === -78.4535, 'Patched GPS longitude is correctly saved');
  assert(updated2?.droneMetadata?.locationDesc === 'Shenandoah National Park, Virginia', 'Location description is updated');

  console.log('[4] Record Deletion');
  historyStore.remove(mockId1);
  const afterDelete = historyStore.getAll().find((r) => r.analysisId === mockId1);
  assert(afterDelete === undefined, 'Specific record is cleanly removed upon deletion');

  // Clean up mock record 2
  historyStore.remove(mockId2);

  return { passed, failed };
}
