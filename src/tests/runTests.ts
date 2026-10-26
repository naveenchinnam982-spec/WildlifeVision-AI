import { runWildlifeTestSuite } from './wildlife.test';
import { runVideoTrackingTestSuite } from './videoTracking.test';
import { runGeospatialTestSuite } from './geospatialMapping.test';
import { runHistoryStoreTestSuite } from './historyStore.test';

const coreResult = runWildlifeTestSuite();
const videoResult = runVideoTrackingTestSuite();
const geoResult = runGeospatialTestSuite();
const historyResult = runHistoryStoreTestSuite();

const totalPassed = coreResult.passed + videoResult.passed + geoResult.passed + historyResult.passed;
const totalFailed = coreResult.failed + videoResult.failed + geoResult.failed + historyResult.failed;

if (totalFailed > 0) {
  console.error(`Tests failed with ${totalFailed} failures.`);
  process.exit(1);
} else {
  console.log(`\n========================================`);
  console.log(`All ${totalPassed} WildlifeVision AI tests passed successfully!`);
  console.log(`Core Image Tests: ${coreResult.passed} passed`);
  console.log(`Video Tracking Tests: ${videoResult.passed} passed`);
  console.log(`Geospatial Mapping Tests: ${geoResult.passed} passed`);
  console.log(`Permanent History Store Tests: ${historyResult.passed} passed`);
  console.log(`========================================\n`);
  process.exit(0);
}
