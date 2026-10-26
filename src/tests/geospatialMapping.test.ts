/**
 * Unit Test Suite for Geospatial Drone Mapping & GPS Telemetry
 */

import {
  isValidGpsCoordinate,
  formatCoordinates,
  calculateDistanceKm,
} from '../utils/exifGps';
import { DRONE_SAMPLE_PRESETS } from '../utils/sampleImages';
import { SAMPLE_VIDEO_PRESETS } from '../utils/sampleVideos';

export function runGeospatialTestSuite(): { passed: number; failed: number; errors: string[] } {
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

  console.log('\n--- Running WildlifeVision AI Geospatial Mapping & GPS Test Suite ---');

  // Test 1: Coordinate Validation
  console.log('\n[1] GPS Coordinate Boundary Validation');
  assert(isValidGpsCoordinate(-1.5034, 35.1432), 'Valid coordinates (-1.5034, 35.1432) pass validation');
  assert(isValidGpsCoordinate(38.4755, -78.4535), 'Valid coordinates (38.4755, -78.4535) pass validation');
  assert(!isValidGpsCoordinate(95.0, 35.0), 'Latitude > 90 is rejected');
  assert(!isValidGpsCoordinate(-95.0, 35.0), 'Latitude < -90 is rejected');
  assert(!isValidGpsCoordinate(10.0, 185.0), 'Longitude > 180 is rejected');
  assert(!isValidGpsCoordinate(10.0, -185.0), 'Longitude < -180 is rejected');
  assert(!isValidGpsCoordinate(0, 0), 'Null island (0, 0) default is rejected to prevent bad device fallbacks');
  assert(!isValidGpsCoordinate(NaN, 35.0), 'NaN coordinate is rejected');
  assert(!isValidGpsCoordinate('10.5', 35.0), 'Non-number type is rejected');

  // Test 2: Coordinate Formatting
  console.log('\n[2] Geospatial Coordinate Formatting Math');
  const kenyaFmt = formatCoordinates(-1.5034, 35.1432, 4);
  assert(kenyaFmt.includes('1.5034° S') && kenyaFmt.includes('35.1432° E'), 'Negative latitude correctly maps to South and positive to East');

  const usaFmt = formatCoordinates(38.4755, -78.4535, 4);
  assert(usaFmt.includes('38.4755° N') && usaFmt.includes('78.4535° W'), 'Positive latitude correctly maps to North and negative to West');

  // Test 3: Haversine Distance Calculation
  console.log('\n[3] Great-Circle Haversine Distance Calculation');
  // Distance between Maasai Mara (-1.5034, 35.1432) and Serengeti (-2.3333, 34.8333) is ~98 km
  const distKm = calculateDistanceKm(-1.5034, 35.1432, -2.3333, 34.8333);
  assert(distKm >= 90 && distKm <= 110, `Calculated distance (~${distKm} km) is within expected ecological corridor bounds (90-110 km)`);

  // Distance to identical point is 0
  const distZero = calculateDistanceKm(10.0, 20.0, 10.0, 20.0);
  assert(distZero === 0, 'Distance between identical points is 0 km');

  // Test 4: Drone Aerial Sample Presets Geospatial Integrity
  console.log('\n[4] Preset Sample Geotag Integrity');
  assert(DRONE_SAMPLE_PRESETS.length >= 3, 'At least 3 drone aerial image presets exist');
  DRONE_SAMPLE_PRESETS.forEach((preset) => {
    assert(
      isValidGpsCoordinate(preset.gps.latitude, preset.gps.longitude),
      `Preset "${preset.name}" has valid GPS coordinates (${preset.gps.latitude}, ${preset.gps.longitude})`
    );
    assert(
      typeof preset.gps.locationName === 'string' && preset.gps.locationName.length > 5,
      `Preset "${preset.name}" has authentic conservation reserve location name: "${preset.gps.locationName}"`
    );
    assert(
      preset.gps.altitudeMeters > 0 && preset.gps.altitudeMeters <= 120,
      `Preset "${preset.name}" flight altitude (${preset.gps.altitudeMeters}m) is within legal drone ceiling (<120m AGL)`
    );
  });

  // Test 5: Drone Video Presets Geospatial Integrity
  console.log('\n[5] Video Presets Geotag Integrity');
  assert(SAMPLE_VIDEO_PRESETS.length >= 2, 'At least 2 drone video presets exist');
  SAMPLE_VIDEO_PRESETS.forEach((preset) => {
    assert(
      preset.gps !== undefined && isValidGpsCoordinate(preset.gps.latitude, preset.gps.longitude),
      `Video preset "${preset.title}" has verified GPS coordinates`
    );
  });

  console.log(`\nGeospatial Results: ${passed} passed, ${failed} failed`);
  return { passed, failed, errors };
}
