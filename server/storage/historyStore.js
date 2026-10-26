import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store history in root 'data/survey_history.json'
const DATA_DIR = path.resolve(__dirname, '../../data');
const HISTORY_FILE = path.join(DATA_DIR, 'survey_history.json');

// Memory cache synchronized with disk
let inMemoryHistory = [];
let isInitialized = false;

/**
 * Initializes and loads existing persistent history from disk.
 */
function initHistoryStore() {
  if (isInitialized) return inMemoryHistory;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryHistory = parsed;
      } else {
        inMemoryHistory = [];
      }
    } else {
      inMemoryHistory = [];
      // Initialize with empty array file
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to load persistent survey history from disk:', err);
    inMemoryHistory = [];
  }

  isInitialized = true;
  return inMemoryHistory;
}

/**
 * Atomically writes history records to disk.
 */
function persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${HISTORY_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(inMemoryHistory, null, 2), 'utf-8');
    fs.renameSync(tempFile, HISTORY_FILE);
  } catch (err) {
    console.error('Failed to write survey history to disk:', err);
  }
}

// Ensure store is initialized on module load
initHistoryStore();

export const historyStore = {
  /**
   * Returns copy of all history records
   */
  getAll() {
    initHistoryStore();
    return [...inMemoryHistory];
  },

  /**
   * Adds or updates a record idempotently by analysisId
   */
  add(record) {
    initHistoryStore();
    if (!record || !record.analysisId) return record;

    // Check if record already exists (e.g. from retry or reload)
    const existingIndex = inMemoryHistory.findIndex((r) => r.analysisId === record.analysisId);
    if (existingIndex !== -1) {
      // Update existing record
      inMemoryHistory[existingIndex] = { ...inMemoryHistory[existingIndex], ...record };
    } else {
      // Prepend newest record
      inMemoryHistory.unshift(record);
      // Keep up to 100 historical survey missions permanently on disk
      if (inMemoryHistory.length > 100) {
        inMemoryHistory.length = 100;
      }
    }

    persistToDisk();
    return record;
  },

  /**
   * Updates GPS data and drone metadata for a specific survey ID
   */
  updateGps(id, gps, droneMetadata = {}) {
    initHistoryStore();
    const record = inMemoryHistory.find((r) => r.analysisId === id);
    if (!record) return null;

    if (!record.droneMetadata) record.droneMetadata = {};
    if (gps) {
      record.droneMetadata.gps = gps;
      if (gps.locationName && !record.droneMetadata.locationDesc) {
        record.droneMetadata.locationDesc = gps.locationName;
      }
    }
    if (droneMetadata && typeof droneMetadata === 'object') {
      record.droneMetadata = { ...record.droneMetadata, ...droneMetadata };
    }

    persistToDisk();
    return record;
  },

  /**
   * Removes a specific survey record by ID
   */
  remove(id) {
    initHistoryStore();
    const index = inMemoryHistory.findIndex((r) => r.analysisId === id);
    if (index !== -1) {
      inMemoryHistory.splice(index, 1);
      persistToDisk();
      return true;
    }
    return false;
  },

  /**
   * Clears all history
   */
  clear() {
    initHistoryStore();
    inMemoryHistory.length = 0;
    persistToDisk();
  },
};
