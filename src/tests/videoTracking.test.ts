import {
  trackAnimalsAcrossFrames,
  calculateVideoSpeciesCounts,
  deduplicateDetections,
} from '../../server/api/videoAnalyze.js';

export function runVideoTrackingTestSuite(): { passed: number; failed: number; errors: string[] } {
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

  console.log('\n--- Running WildlifeVision AI Video Multi-Object Tracking Test Suite ---');

  // Test 1: Single animal visible across 6 frames yields strictly 1 unique track
  console.log('\n[1] Single Animal Continuity Across Multiple Frames');
  const singleElephantFrames = [];
  for (let f = 1; f <= 6; f++) {
    singleElephantFrames.push({
      frameIndex: f,
      timestampSec: f * 0.5,
      detections: [
        {
          detectionId: `F${f}-D1`,
          animalLabel: 'African Elephant',
          category: 'Mammal',
          confidence: 0.92,
          boundingBox: {
            xMin: 200 + f * 5, // slightly moving
            yMin: 300 + f * 2,
            xMax: 350 + f * 5,
            yMax: 450 + f * 2,
          },
          identificationStatus: 'identified',
        },
      ],
    });
  }

  const tracksSingle = trackAnimalsAcrossFrames(singleElephantFrames);
  assert(tracksSingle.length === 1, 'Single elephant visible in 6 frames produces exactly 1 persistent track');
  assert(tracksSingle[0].animalLabel === 'African Elephant', 'Track preserves correct species label');
  assert(tracksSingle[0].detectionCount === 6, 'Track records all 6 keyframe sightings');
  assert(tracksSingle[0].firstSeenSec === 0.5, 'Track first seen timestamp is 0.5s');
  assert(tracksSingle[0].lastSeenSec === 3.0, 'Track last seen timestamp is 3.0s');

  const censusSingle = calculateVideoSpeciesCounts(tracksSingle, singleElephantFrames);
  assert(censusSingle.totalTrackedAnimals === 1, 'Total estimated unique animals strictly equals 1 (NOT 6!)');
  assert(censusSingle.totalFrameDetections === 6, 'Total frame sightings equals 6');
  assert(censusSingle.speciesCounts[0].trackCount === 1, 'Elephant track count equals 1');
  assert(censusSingle.speciesCounts[0].totalDetections === 6, 'Elephant frame sightings count equals 6');

  // Test 2: Multiple animals of same and different species
  console.log('\n[2] Multi-Species Video Tracking (2 Elephants, 3 Zebras, 1 Lion)');
  const multiSpeciesFrames = [];
  for (let f = 1; f <= 5; f++) {
    multiSpeciesFrames.push({
      frameIndex: f,
      timestampSec: f * 1.0,
      detections: [
        // Elephant 1 (left)
        {
          detectionId: `F${f}-E1`,
          animalLabel: 'African Elephant',
          category: 'Mammal',
          confidence: 0.95,
          boundingBox: { xMin: 100 + f * 3, yMin: 200, xMax: 220 + f * 3, yMax: 320 },
          identificationStatus: 'identified',
        },
        // Elephant 2 (center)
        {
          detectionId: `F${f}-E2`,
          animalLabel: 'African Elephant',
          category: 'Mammal',
          confidence: 0.91,
          boundingBox: { xMin: 400 + f * 4, yMin: 250, xMax: 520 + f * 4, yMax: 370 },
          identificationStatus: 'identified',
        },
        // Zebra 1
        {
          detectionId: `F${f}-Z1`,
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.88,
          boundingBox: { xMin: 600 + f * 8, yMin: 100, xMax: 680 + f * 8, yMax: 180 },
          identificationStatus: 'identified',
        },
        // Zebra 2
        {
          detectionId: `F${f}-Z2`,
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.86,
          boundingBox: { xMin: 720 + f * 8, yMin: 140, xMax: 800 + f * 8, yMax: 220 },
          identificationStatus: 'identified',
        },
        // Zebra 3
        {
          detectionId: `F${f}-Z3`,
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.89,
          boundingBox: { xMin: 650 + f * 8, yMin: 220, xMax: 730 + f * 8, yMax: 300 },
          identificationStatus: 'identified',
        },
        // Lion 1
        {
          detectionId: `F${f}-L1`,
          animalLabel: 'Lion',
          category: 'Mammal',
          confidence: 0.93,
          boundingBox: { xMin: 250, yMin: 600, xMax: 350, yMax: 680 },
          identificationStatus: 'identified',
        },
      ],
    });
  }

  const tracksMulti = trackAnimalsAcrossFrames(multiSpeciesFrames);
  assert(tracksMulti.length === 6, 'Exactly 6 distinct persistent animal tracks identified across 5 frames');

  const censusMulti = calculateVideoSpeciesCounts(tracksMulti, multiSpeciesFrames);
  assert(censusMulti.totalTrackedAnimals === 6, 'Total estimated tracked animals equals 6 (NOT 30!)');
  assert(censusMulti.totalFrameDetections === 30, 'Total frame sightings equals 30');
  assert(censusMulti.distinctSpeciesCount === 3, 'Distinct species count equals 3 (Elephant, Zebra, Lion)');

  const zebraCount = censusMulti.speciesCounts.find((s) => s.animalLabel.toLowerCase().includes('zebra'))?.trackCount;
  const elephantCount = censusMulti.speciesCounts.find((s) => s.animalLabel.toLowerCase().includes('elephant'))?.trackCount;
  const lionCount = censusMulti.speciesCounts.find((s) => s.animalLabel.toLowerCase().includes('lion'))?.trackCount;

  assert(zebraCount === 3, 'Plains Zebra unique track count strictly equals 3');
  assert(elephantCount === 2, 'African Elephant unique track count strictly equals 2');
  assert(lionCount === 1, 'Lion unique track count strictly equals 1');

  // Test 3: New animal entering frame mid-video
  console.log('\n[3] Animal Entering Frame Mid-Video');
  const enteringFrames = [
    {
      frameIndex: 1,
      timestampSec: 0.0,
      detections: [
        {
          detectionId: 'F1-D1',
          animalLabel: 'White-tailed Deer',
          category: 'Mammal',
          confidence: 0.9,
          boundingBox: { xMin: 200, yMin: 200, xMax: 300, yMax: 300 },
          identificationStatus: 'identified',
        },
      ],
    },
    {
      frameIndex: 2,
      timestampSec: 1.0,
      detections: [
        {
          detectionId: 'F2-D1',
          animalLabel: 'White-tailed Deer',
          category: 'Mammal',
          confidence: 0.9,
          boundingBox: { xMin: 210, yMin: 205, xMax: 310, yMax: 305 },
          identificationStatus: 'identified',
        },
        // Second deer enters at t=1.0s in another region of frame
        {
          detectionId: 'F2-D2',
          animalLabel: 'White-tailed Deer',
          category: 'Mammal',
          confidence: 0.88,
          boundingBox: { xMin: 700, yMin: 500, xMax: 800, yMax: 600 },
          identificationStatus: 'identified',
        },
      ],
    },
    {
      frameIndex: 3,
      timestampSec: 2.0,
      detections: [
        {
          detectionId: 'F3-D1',
          animalLabel: 'White-tailed Deer',
          category: 'Mammal',
          confidence: 0.91,
          boundingBox: { xMin: 220, yMin: 210, xMax: 320, yMax: 310 },
          identificationStatus: 'identified',
        },
        {
          detectionId: 'F3-D2',
          animalLabel: 'White-tailed Deer',
          category: 'Mammal',
          confidence: 0.89,
          boundingBox: { xMin: 710, yMin: 505, xMax: 810, yMax: 605 },
          identificationStatus: 'identified',
        },
      ],
    },
  ];

  const tracksEntering = trackAnimalsAcrossFrames(enteringFrames);
  assert(tracksEntering.length === 2, 'Two separate tracks created when second deer enters mid-video');
  const secondTrack = tracksEntering.find((t) => t.firstSeenSec === 1.0);
  assert(secondTrack !== undefined, 'Second track has correct firstSeenSec = 1.0s');
  assert(secondTrack?.detectionCount === 2, 'Second track has 2 keyframe detections');

  // Test 4: Empty video (no wildlife detected)
  console.log('\n[4] Empty Video Handling (Zero Animals)');
  const emptyFrames = [
    { frameIndex: 1, timestampSec: 0.0, detections: [] },
    { frameIndex: 2, timestampSec: 1.0, detections: [] },
    { frameIndex: 3, timestampSec: 2.0, detections: [] },
  ];
  const emptyTracks = trackAnimalsAcrossFrames(emptyFrames);
  assert(emptyTracks.length === 0, 'Zero detections produces 0 tracks');
  const emptyCensus = calculateVideoSpeciesCounts(emptyTracks, emptyFrames);
  assert(emptyCensus.totalTrackedAnimals === 0, 'Total tracked animals is 0 for empty video');
  assert(emptyCensus.totalFrameDetections === 0, 'Total frame detections is 0 for empty video');
  assert(emptyCensus.distinctSpeciesCount === 0, 'Distinct species count is 0 for empty video');
  assert(emptyCensus.speciesCounts.length === 0, 'Species counts array is empty');

  // Test 5: Duplicate Bounding Box Suppression via NMS
  console.log('\n[5] Per-Frame Non-Maximum Suppression (Duplicate Box Prevention)');
  const duplicateBoxFrame = [
    {
      frameIndex: 1,
      timestampSec: 0.0,
      detections: [
        // Box 1: high confidence detection
        {
          detectionId: 'F1-D1',
          animalLabel: 'Lion',
          category: 'Mammal',
          confidence: 0.94,
          boundingBox: { xMin: 300, yMin: 400, xMax: 450, yMax: 550 },
          identificationStatus: 'identified',
        },
        // Box 2: duplicate overlapping detection of same lion (IoU ~0.78)
        {
          detectionId: 'F1-D2',
          animalLabel: 'Lion',
          category: 'Mammal',
          confidence: 0.81,
          boundingBox: { xMin: 305, yMin: 405, xMax: 455, yMax: 555 },
          identificationStatus: 'identified',
        },
      ],
    },
  ];

  const nmsKept = deduplicateDetections(duplicateBoxFrame[0].detections, 0.55);
  assert(nmsKept.length === 1, 'Duplicate overlapping box for same animal in single frame is suppressed to 1 box');
  assert(nmsKept[0].confidence === 0.94, 'Higher confidence proposal (0.94) is retained over lower (0.81)');

  const tracksFromDupFrame = trackAnimalsAcrossFrames(duplicateBoxFrame);
  assert(tracksFromDupFrame.length === 1, 'Single frame with duplicate boxes produces strictly 1 unique track (NOT 2)');

  // Test 6: Temporary Occlusion & Reconnection (Animal temporarily disappearing behind trees)
  console.log('\n[6] Temporary Occlusion & Track Reconnection');
  const occlusionFrames = [
    // Frame 1 at t=0.0s: Zebra visible
    {
      frameIndex: 1,
      timestampSec: 0.0,
      detections: [
        {
          detectionId: 'F1-Z1',
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.92,
          boundingBox: { xMin: 200, yMin: 300, xMax: 280, yMax: 380 },
          identificationStatus: 'identified',
        },
      ],
    },
    // Frame 2 at t=1.0s: Zebra continues moving
    {
      frameIndex: 2,
      timestampSec: 1.0,
      detections: [
        {
          detectionId: 'F2-Z1',
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.90,
          boundingBox: { xMin: 230, yMin: 305, xMax: 310, yMax: 385 },
          identificationStatus: 'identified',
        },
      ],
    },
    // Frame 3 at t=2.0s: Zebra enters dense tree canopy (zero detections in this frame!)
    {
      frameIndex: 3,
      timestampSec: 2.0,
      detections: [],
    },
    // Frame 4 at t=3.0s: Zebra still behind canopy (zero detections)
    {
      frameIndex: 4,
      timestampSec: 3.0,
      detections: [],
    },
    // Frame 5 at t=4.0s: Zebra emerges on other side of trees along its movement path
    {
      frameIndex: 5,
      timestampSec: 4.0,
      detections: [
        {
          detectionId: 'F5-Z1',
          animalLabel: 'Plains Zebra',
          category: 'Mammal',
          confidence: 0.88,
          boundingBox: { xMin: 320, yMin: 320, xMax: 400, yMax: 400 },
          identificationStatus: 'identified',
        },
      ],
    },
  ];

  const tracksOccluded = trackAnimalsAcrossFrames(occlusionFrames);
  assert(tracksOccluded.length === 1, 'Zebra occluded behind trees for 2 seconds reconnects to the SAME track');
  assert(tracksOccluded[0].firstSeenSec === 0.0, 'First seen timestamp is preserved as 0.0s');
  assert(tracksOccluded[0].lastSeenSec === 4.0, 'Last seen timestamp extends to 4.0s upon re-emergence');
  assert(tracksOccluded[0].detectionCount === 3, 'Track records all 3 visible frame sightings across occlusion gap');

  const censusOccluded = calculateVideoSpeciesCounts(tracksOccluded, occlusionFrames);
  assert(censusOccluded.totalTrackedAnimals === 1, 'Final video count is strictly 1 animal after occlusion (NOT 2)');
  assert(censusOccluded.totalFrameDetections === 3, 'Total frame sightings equals 3');

  return { passed, failed, errors };
}
