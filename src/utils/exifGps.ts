/**
 * Geospatial GPS & EXIF extraction utilities for drone aerial photography.
 * Safely parses EXIF APP1 metadata from JPEG images to extract verified GPS coordinates.
 */

import { DroneGpsCoordinate } from '../types/wildlife';

export interface ParsedExifGps {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

/**
 * Checks if a pair of coordinates is valid (lat: [-90, 90], lng: [-180, 180]).
 */
export function isValidGpsCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // Exclude literal 0,0 unless explicitly verified, as 0,0 is Null Island default in bad GPS devices
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Formats decimal latitude and longitude into standard geospatial string.
 * Example: -1.5034, 35.1432 -> "1.5034° S, 35.1432° E"
 */
export function formatCoordinates(lat: number, lng: number, precision: number = 4): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat).toFixed(precision);
  const absLng = Math.abs(lng).toFixed(precision);
  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`;
}

/**
 * Computes Haversine great-circle distance between two GPS coordinates in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Safely extracts EXIF GPS information from an ArrayBuffer of a JPEG image.
 */
export function parseExifGpsFromArrayBuffer(buffer: ArrayBuffer): ParsedExifGps | null {
  try {
    const dataView = new DataView(buffer);
    const length = dataView.byteLength;

    // Check for JPEG SOI marker (0xFFD8)
    if (length < 4 || dataView.getUint16(0, false) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    while (offset < length - 4) {
      const marker = dataView.getUint16(offset, false);
      offset += 2;

      // APP1 Marker: 0xFFE1 (EXIF data)
      if (marker === 0xffe1) {
        const app1Length = dataView.getUint16(offset, false);
        const exifHeaderOffset = offset + 2;

        // Verify "Exif\0\0" header
        const exifMagic =
          String.fromCharCode(dataView.getUint8(exifHeaderOffset)) +
          String.fromCharCode(dataView.getUint8(exifHeaderOffset + 1)) +
          String.fromCharCode(dataView.getUint8(exifHeaderOffset + 2)) +
          String.fromCharCode(dataView.getUint8(exifHeaderOffset + 3));

        if (exifMagic === 'Exif') {
          const tiffOffset = exifHeaderOffset + 6;
          return parseTiffGps(dataView, tiffOffset, app1Length);
        }

        offset += app1Length;
      } else if ((marker & 0xff00) === 0xff00) {
        // Skip other markers
        const segmentLength = dataView.getUint16(offset, false);
        offset += segmentLength;
      } else {
        break;
      }
    }
  } catch (err) {
    console.debug('EXIF GPS parse encountered non-critical error:', err);
  }
  return null;
}

function parseTiffGps(
  view: DataView,
  tiffOffset: number,
  _maxLength: number
): ParsedExifGps | null {
  try {
    // Endianness
    const byteOrder = view.getUint16(tiffOffset, false);
    const littleEndian = byteOrder === 0x4949; // 'II'

    // TIFF verification (42)
    if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002a) {
      return null;
    }

    const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian);
    let currentOffset = tiffOffset + ifd0Offset;

    const numEntries = view.getUint16(currentOffset, littleEndian);
    currentOffset += 2;

    let gpsIfdOffset = 0;

    for (let i = 0; i < numEntries; i++) {
      const tag = view.getUint16(currentOffset, littleEndian);
      if (tag === 0x8825) {
        // GPS Info IFD Pointer
        gpsIfdOffset = view.getUint32(currentOffset + 8, littleEndian);
        break;
      }
      currentOffset += 12;
    }

    if (!gpsIfdOffset) return null;

    const gpsOffset = tiffOffset + gpsIfdOffset;
    const numGpsEntries = view.getUint16(gpsOffset, littleEndian);
    let gpsEntryOffset = gpsOffset + 2;

    let latRef: string | null = null;
    let lonRef: string | null = null;
    let rawLat: number[] | null = null;
    let rawLon: number[] | null = null;
    let rawAlt: number | null = null;

    for (let i = 0; i < numGpsEntries; i++) {
      const tag = view.getUint16(gpsEntryOffset, littleEndian);
      const valueOffset = tiffOffset + view.getUint32(gpsEntryOffset + 8, littleEndian);

      if (tag === 0x0001) {
        // GPSLatitudeRef ('N' or 'S')
        latRef = String.fromCharCode(view.getUint8(gpsEntryOffset + 8));
      } else if (tag === 0x0002) {
        // GPSLatitude (3 RATIONALs: degrees, minutes, seconds)
        rawLat = readRationals(view, valueOffset, 3, littleEndian);
      } else if (tag === 0x0003) {
        // GPSLongitudeRef ('E' or 'W')
        lonRef = String.fromCharCode(view.getUint8(gpsEntryOffset + 8));
      } else if (tag === 0x0004) {
        // GPSLongitude (3 RATIONALs)
        rawLon = readRationals(view, valueOffset, 3, littleEndian);
      } else if (tag === 0x0006) {
        // GPSAltitude (1 RATIONAL)
        const alt = readRationals(view, valueOffset, 1, littleEndian);
        if (alt && alt[0]) rawAlt = alt[0];
      }

      gpsEntryOffset += 12;
    }

    if (rawLat && rawLon && latRef && lonRef) {
      let lat = rawLat[0] + rawLat[1] / 60 + rawLat[2] / 3600;
      let lon = rawLon[0] + rawLon[1] / 60 + rawLon[2] / 3600;

      if (latRef.toUpperCase() === 'S') lat = -lat;
      if (lonRef.toUpperCase() === 'W') lon = -lon;

      if (isValidGpsCoordinate(lat, lon)) {
        return {
          latitude: Math.round(lat * 1000000) / 1000000,
          longitude: Math.round(lon * 1000000) / 1000000,
          altitudeMeters: rawAlt ? Math.round(rawAlt * 10) / 10 : undefined,
        };
      }
    }
  } catch (err) {
    console.debug('TIFF GPS extraction error:', err);
  }
  return null;
}

function readRationals(
  view: DataView,
  offset: number,
  count: number,
  littleEndian: boolean
): number[] | null {
  try {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      const num = view.getUint32(offset + i * 8, littleEndian);
      const den = view.getUint32(offset + i * 8 + 4, littleEndian);
      if (den === 0) return null;
      results.push(num / den);
    }
    return results;
  } catch {
    return null;
  }
}

/**
 * Extracts GPS coordinates from a File object.
 */
export async function extractGpsFromFile(file: File): Promise<DroneGpsCoordinate | null> {
  try {
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return null;
    }
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const gps = parseExifGpsFromArrayBuffer(buffer);
    if (gps) {
      return {
        latitude: gps.latitude,
        longitude: gps.longitude,
        altitudeMeters: gps.altitudeMeters,
        source: 'exif',
        locationName: 'Geotagged Drone EXIF Sighting',
      };
    }
  } catch (err) {
    console.debug('Failed to extract GPS from file:', err);
  }
  return null;
}
