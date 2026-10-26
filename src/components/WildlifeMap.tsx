/**
 * Geospatial Wildlife Drone Survey Map powered by Leaflet.
 * Plots real drone survey locations with verified GPS coordinates,
 * species sightings, census breakdowns, and filtering controls.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AnalysisResult, VideoAnalysisResult, DroneGpsCoordinate } from '../types/wildlife';
import { getSpeciesColor } from '../utils/colorPalette';
import { formatCoordinates, isValidGpsCoordinate, calculateDistanceKm } from '../utils/exifGps';
import {
  MapPin,
  Layers,
  Compass,
  Filter,
  Search,
  ExternalLink,
  Navigation,
  Calendar,
  Eye,
  AlertTriangle,
  PlusCircle,
  X,
  CheckCircle2,
  Camera,
  Film,
  Crosshair,
  Maximize2,
  Info,
} from 'lucide-react';

interface WildlifeMapProps {
  history: (AnalysisResult | VideoAnalysisResult | any)[];
  onSelectSurvey: (survey: any) => void;
  onUpdateSurveyGps?: (analysisId: string, gps: DroneGpsCoordinate) => void;
}

// Tile layer providers
const TILE_LAYERS = {
  satellite: {
    name: 'Forest Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; USDA, USGS, AeroGRID',
    maxZoom: 18,
  },
  topo: {
    name: 'Topographic Forest (OpenTopo)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM',
    maxZoom: 17,
  },
  streets: {
    name: 'Conservation Basemap (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

// Popular real-world wildlife conservation park presets for user geotagging convenience
const CONSERVATION_PRESETS = [
  { name: 'Maasai Mara National Reserve, Kenya', lat: -1.5034, lng: 35.1432, alt: 48 },
  { name: 'Serengeti National Park, Tanzania', lat: -2.3333, lng: 34.8333, alt: 45 },
  { name: 'Kruger National Park, South Africa', lat: -24.0116, lng: 31.4853, alt: 42 },
  { name: 'Shenandoah National Park, USA', lat: 38.4755, lng: -78.4535, alt: 36 },
  { name: 'Yellowstone National Park, USA', lat: 44.428, lng: -110.5885, alt: 60 },
  { name: 'Tsavo East National Park, Kenya', lat: -2.7667, lng: 38.4667, alt: 55 },
  { name: 'Monteverde Cloud Forest, Costa Rica', lat: 10.3163, lng: -84.8255, alt: 30 },
];

export const WildlifeMap: React.FC<WildlifeMapProps> = ({
  history,
  onSelectSurvey,
  onUpdateSurveyGps,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  // Filter states
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTileType, setActiveTileType] = useState<keyof typeof TILE_LAYERS>('satellite');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);

  // Map readiness & error states
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [isEmptyDismissed, setIsEmptyDismissed] = useState<boolean>(false);

  // Tab between Geotagged map and Ungeotagged records list
  const [activeViewMode, setActiveViewMode] = useState<'map' | 'ungeotagged'>('map');

  // Manual Geotag modal state
  const [geotagModalTarget, setGeotagModalTarget] = useState<any | null>(null);
  const [modalLat, setModalLat] = useState<string>('');
  const [modalLng, setModalLng] = useState<string>('');
  const [modalAlt, setModalAlt] = useState<string>('40');
  const [modalLocationName, setModalLocationName] = useState<string>('');
  const [modalMissionId, setModalMissionId] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSavingGps, setIsSavingGps] = useState<boolean>(false);
  const [gpsSaveSuccess, setGpsSaveSuccess] = useState<boolean>(false);

  // Pick coordinates on map mode
  const [isClickToLocateActive, setIsClickToLocateActive] = useState<boolean>(false);

  // Separate records with and without verified GPS
  const { geotaggedRecords, ungeotaggedRecords } = useMemo(() => {
    const geotagged: any[] = [];
    const ungeotagged: any[] = [];

    history.forEach((item) => {
      const gps = item.droneMetadata?.gps || item.gps;
      if (gps && isValidGpsCoordinate(gps.latitude, gps.longitude)) {
        geotagged.push(item);
      } else {
        ungeotagged.push(item);
      }
    });

    return { geotaggedRecords: geotagged, ungeotaggedRecords: ungeotagged };
  }, [history]);

  // Extract all distinct species present across geotagged records for filtering
  const availableSpecies = useMemo(() => {
    const speciesSet = new Set<string>();
    geotaggedRecords.forEach((rec) => {
      (rec.speciesCounts || []).forEach((sc: any) => {
        if (sc.animalLabel) speciesSet.add(sc.animalLabel);
      });
      (rec.tracks || []).forEach((t: any) => {
        if (t.animalLabel) speciesSet.add(t.animalLabel);
      });
    });
    return Array.from(speciesSet).sort();
  }, [geotaggedRecords]);

  // Filter geotagged records based on selected criteria
  const filteredGeotaggedRecords = useMemo(() => {
    return geotaggedRecords.filter((item) => {
      // 1. Species filter
      if (selectedSpecies !== 'all') {
        const hasSpecies =
          (item.speciesCounts || []).some((sc: any) => sc.animalLabel === selectedSpecies) ||
          (item.tracks || []).some((t: any) => t.animalLabel === selectedSpecies) ||
          (item.detections || []).some((d: any) => d.animalLabel === selectedSpecies);
        if (!hasSpecies) return false;
      }

      // 2. Media Type filter
      if (selectedMediaType === 'image' && item.mediaType === 'video') return false;
      if (selectedMediaType === 'video' && item.mediaType !== 'video') return false;

      // 3. Date range filter
      if (selectedDateRange !== 'all') {
        const itemTime = new Date(item.timestamp).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (selectedDateRange === '24h' && now - itemTime > dayMs) return false;
        if (selectedDateRange === '7d' && now - itemTime > 7 * dayMs) return false;
        if (selectedDateRange === '30d' && now - itemTime > 30 * dayMs) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const gps = item.droneMetadata?.gps || item.gps;
        const matchesFilename = (item.filename || '').toLowerCase().includes(q);
        const matchesLocation = (gps?.locationName || item.droneMetadata?.locationDesc || '').toLowerCase().includes(q);
        const matchesMission = (item.droneMetadata?.missionId || '').toLowerCase().includes(q);
        const matchesSummary = (item.summary || '').toLowerCase().includes(q);
        const matchesSpecies = (item.speciesCounts || []).some((sc: any) =>
          (sc.animalLabel || '').toLowerCase().includes(q)
        );
        if (!matchesFilename && !matchesLocation && !matchesMission && !matchesSummary && !matchesSpecies) {
          return false;
        }
      }

      return true;
    });
  }, [geotaggedRecords, selectedSpecies, selectedMediaType, selectedDateRange, searchQuery]);

  // Selected active survey details
  const activeSurvey = useMemo(() => {
    return history.find((h) => h.analysisId === selectedSurveyId) || null;
  }, [history, selectedSurveyId]);

  // Compute map summary metrics
  const mapStats = useMemo(() => {
    const totalWaypoints = filteredGeotaggedRecords.length;
    const totalAnimals = filteredGeotaggedRecords.reduce(
      (sum, r) => sum + (r.totalTrackedAnimals ?? r.totalAnimals ?? 0),
      0
    );
    const speciesSeen = new Set<string>();
    filteredGeotaggedRecords.forEach((r) => {
      (r.speciesCounts || []).forEach((sc: any) => {
        if (sc.animalLabel) speciesSeen.add(sc.animalLabel);
      });
    });

    return {
      totalWaypoints,
      totalAnimals,
      speciesCount: speciesSeen.size,
      geotaggedPct:
        history.length > 0 ? Math.round((geotaggedRecords.length / history.length) * 100) : 0,
    };
  }, [filteredGeotaggedRecords, geotaggedRecords.length, history.length]);

  // Initialize or reinitialize Leaflet Map safely
  const initMap = () => {
    if (!mapContainerRef.current) return;

    try {
      setMapInitError(null);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      // Center around first valid geotagged record or world reserve baseline
      const initialLat = geotaggedRecords[0]?.droneMetadata?.gps?.latitude ?? -1.5;
      const initialLng = geotaggedRecords[0]?.droneMetadata?.gps?.longitude ?? 35.0;
      const initialZoom = geotaggedRecords.length > 0 ? 8 : 4;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true,
      });

      // Add initial tile layer
      const tileConf = TILE_LAYERS[activeTileType];
      const tileLayer = L.tileLayer(tileConf.url, {
        attribution: tileConf.attribution,
        maxZoom: tileConf.maxZoom,
      }).addTo(map);

      activeTileLayerRef.current = tileLayer;

      // Create marker layer group
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Handle map clicks for "Click-to-locate" mode
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (isClickToLocateActive && geotagModalTarget) {
          setModalLat(e.latlng.lat.toFixed(6));
          setModalLng(e.latlng.lng.toFixed(6));
          setIsClickToLocateActive(false);
        }
      });

      mapInstanceRef.current = map;
      setIsMapReady(true);

      // Force initial layout size sync
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } catch (err: any) {
      console.error('Forest Map initialization error:', err);
      setMapInitError(err?.message || 'Error initializing Forest Map view.');
      setIsMapReady(false);
    }
  };

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ResizeObserver to always keep Leaflet canvas sized correctly across desktop & mobile
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Ensure map tiles redraw immediately when switching back from ungeotagged view
  useEffect(() => {
    if (activeViewMode === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  }, [activeViewMode]);

  // Update Base Tile Layer when activeTileType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    const tileConf = TILE_LAYERS[activeTileType];
    const newTileLayer = L.tileLayer(tileConf.url, {
      attribution: tileConf.attribution,
      maxZoom: tileConf.maxZoom,
    }).addTo(map);

    activeTileLayerRef.current = newTileLayer;
  }, [activeTileType]);

  // Update Markers on filtered records change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (filteredGeotaggedRecords.length === 0) return;

    const bounds = L.latLngBounds([]);

    filteredGeotaggedRecords.forEach((item) => {
      const gps = item.droneMetadata?.gps || item.gps;
      if (!gps || !isValidGpsCoordinate(gps.latitude, gps.longitude)) return;

      const lat = gps.latitude;
      const lng = gps.longitude;
      bounds.extend([lat, lng]);

      // Primary species color for pin
      const primarySpecies =
        item.speciesCounts?.[0]?.animalLabel ||
        item.tracks?.[0]?.animalLabel ||
        item.detections?.[0]?.animalLabel ||
        'Wildlife';
      const colorConfig = getSpeciesColor(primarySpecies);
      const colorHex = colorConfig.stroke;
      const isSelected = item.analysisId === selectedSurveyId;
      const isVideo = item.mediaType === 'video';
      const count = item.totalTrackedAnimals ?? item.totalAnimals ?? 0;

      // Custom SVG DivIcon
      const iconHtml = `
        <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-full cursor-pointer transition duration-200 hover:scale-110">
          ${isSelected ? `<div class="absolute -inset-2 rounded-full bg-emerald-400/40 animate-ping"></div>` : ''}
          <div class="w-10 h-10 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 ${
            isSelected ? 'border-white ring-4 ring-emerald-500 scale-110' : 'border-stone-900/60'
          }" style="background-color: ${colorHex};">
            <span class="text-[10px] font-black text-white leading-none tracking-tight">${count}</span>
            <span class="text-[8px] text-white/90 uppercase font-semibold leading-none mt-0.5">${isVideo ? 'VID' : 'AIR'}</span>
          </div>
          <div class="w-2.5 h-2.5 bg-stone-900 rotate-45 -mt-1 shadow-md border-r border-b border-white/40"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'wildlife-drone-pin',
        html: iconHtml,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);

      // Add survey coverage swath circle (e.g. 150m - 300m radius)
      const circleRadiusMeters = Math.max(100, Math.min(500, (gps.altitudeMeters || 40) * 4));
      L.circle([lat, lng], {
        radius: circleRadiusMeters,
        color: colorHex,
        fillColor: colorHex,
        fillOpacity: isSelected ? 0.25 : 0.12,
        weight: isSelected ? 2.5 : 1.5,
        dashArray: isSelected ? undefined : '4, 4',
      }).addTo(markersLayer);

      // Create rich popup content
      const speciesListHtml = (item.speciesCounts || [])
        .map(
          (sc: any) =>
            `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-800 border border-stone-200 mr-1 mb-1">
              ${sc.trackCount ?? sc.count} ${sc.animalLabel}
            </span>`
        )
        .join('');

      const popupHtml = `
        <div class="p-2 min-w-[240px] max-w-[280px] font-sans text-stone-900">
          <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-stone-200">
            <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${colorHex}"></div>
            <div class="flex-1 truncate">
              <span class="text-xs font-bold block truncate">${item.filename || 'Drone Survey'}</span>
              <span class="text-[10px] text-stone-500">${new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isVideo ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
            }">${isVideo ? 'Video' : 'Aerial'}</span>
          </div>

          <div class="space-y-1 text-xs mb-2.5">
            <div class="flex items-center justify-between text-stone-600">
              <span class="text-[11px]">Coordinates:</span>
              <span class="font-mono text-[10px] font-bold text-stone-900">${formatCoordinates(lat, lng, 3)}</span>
            </div>
            ${
              gps.locationName
                ? `<div class="text-[11px] text-stone-600 truncate"><strong>Location:</strong> ${gps.locationName}</div>`
                : ''
            }
            <div class="flex items-center justify-between text-stone-600">
              <span class="text-[11px]">Animals Sighted:</span>
              <span class="font-bold text-emerald-800">${count}</span>
            </div>
            ${
              gps.altitudeMeters
                ? `<div class="flex items-center justify-between text-stone-600">
                    <span class="text-[11px]">Flight Altitude:</span>
                    <span class="font-semibold text-stone-800">${gps.altitudeMeters}m AGL</span>
                  </div>`
                : ''
            }
          </div>

          <div class="mb-2">
            <div class="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Taxonomic Breakdown</div>
            <div class="flex flex-wrap">${speciesListHtml || '<span class="text-[10px] text-stone-400">Zero animals</span>'}</div>
          </div>

          <button
            id="popup-inspect-btn-${item.analysisId}"
            class="w-full mt-1 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            Inspect Detection Census &rarr;
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });

      // Click on marker
      marker.on('click', () => {
        setSelectedSurveyId(item.analysisId);
      });

      // Hook click on popup button
      marker.on('popupopen', () => {
        setSelectedSurveyId(item.analysisId);
        setTimeout(() => {
          const btn = document.getElementById(`popup-inspect-btn-${item.analysisId}`);
          if (btn) {
            btn.onclick = () => {
              onSelectSurvey(item);
            };
          }
        }, 50);
      });
    });

    // Auto fit bounds on initial population if valid bounds
    if (bounds.isValid() && filteredGeotaggedRecords.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredGeotaggedRecords, selectedSurveyId, onSelectSurvey]);

  // Center on survey when clicking from sidebar
  const handleFlyToSurvey = (item: any) => {
    setSelectedSurveyId(item.analysisId);
    const gps = item.droneMetadata?.gps || item.gps;
    if (mapInstanceRef.current && gps && isValidGpsCoordinate(gps.latitude, gps.longitude)) {
      mapInstanceRef.current.flyTo([gps.latitude, gps.longitude], 15, {
        duration: 1.2,
      });
    }
  };

  // Zoom to fit all bounds
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredGeotaggedRecords.length === 0) return;

    const bounds = L.latLngBounds([]);
    filteredGeotaggedRecords.forEach((item) => {
      const gps = item.droneMetadata?.gps || item.gps;
      if (gps && isValidGpsCoordinate(gps.latitude, gps.longitude)) {
        bounds.extend([gps.latitude, gps.longitude]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // Open Geotag Modal for an un-geotagged (or existing) record
  const handleOpenGeotagModal = (item: any) => {
    setGeotagModalTarget(item);
    const existingGps = item.droneMetadata?.gps || item.gps;
    setModalLat(existingGps?.latitude ? String(existingGps.latitude) : '');
    setModalLng(existingGps?.longitude ? String(existingGps.longitude) : '');
    setModalAlt(existingGps?.altitudeMeters ? String(existingGps.altitudeMeters) : '40');
    setModalLocationName(existingGps?.locationName || item.droneMetadata?.locationDesc || '');
    setModalMissionId(item.droneMetadata?.missionId || '');
    setModalError(null);
    setGpsSaveSuccess(false);
  };

  // Save GPS coordinates to backend and local state
  const handleSaveGps = async () => {
    setModalError(null);
    const lat = parseFloat(modalLat);
    const lng = parseFloat(modalLng);
    const alt = parseFloat(modalAlt) || 40;

    if (!isValidGpsCoordinate(lat, lng)) {
      setModalError('Please enter valid GPS coordinates (Latitude: -90 to 90, Longitude: -180 to 180).');
      return;
    }

    if (!geotagModalTarget) return;

    setIsSavingGps(true);
    try {
      const gpsData: DroneGpsCoordinate = {
        latitude: lat,
        longitude: lng,
        altitudeMeters: alt,
        locationName: modalLocationName || 'Verified Drone Survey Waypoint',
        source: 'manual',
        timestamp: new Date().toISOString(),
      };

      // Call backend PATCH
      const res = await fetch(`/api/history/${geotagModalTarget.analysisId}/gps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps: gpsData,
          droneMetadata: {
            missionId: modalMissionId || undefined,
            locationDesc: modalLocationName || undefined,
          },
        }),
      });

      if (res.ok) {
        // Update local object
        if (!geotagModalTarget.droneMetadata) geotagModalTarget.droneMetadata = {};
        geotagModalTarget.droneMetadata.gps = gpsData;
        if (modalMissionId) geotagModalTarget.droneMetadata.missionId = modalMissionId;
        if (modalLocationName) geotagModalTarget.droneMetadata.locationDesc = modalLocationName;

        if (onUpdateSurveyGps) {
          onUpdateSurveyGps(geotagModalTarget.analysisId, gpsData);
        }

        setGpsSaveSuccess(true);
        setTimeout(() => {
          setGeotagModalTarget(null);
          setIsSavingGps(false);
          setActiveViewMode('map');
          handleFlyToSurvey(geotagModalTarget);
        }, 800);
      } else {
        setModalError('Failed to save GPS coordinates to survey record.');
      }
    } catch (err) {
      console.error('Error saving GPS:', err);
      setModalError('Error updating GPS coordinates.');
    } finally {
      setIsSavingGps(false);
    }
  };

  // Apply Conservation Preset in Modal
  const handleApplyPreset = (preset: typeof CONSERVATION_PRESETS[0]) => {
    setModalError(null);
    setModalLat(String(preset.lat));
    setModalLng(String(preset.lng));
    setModalAlt(String(preset.alt));
    setModalLocationName(preset.name);
  };

  // Use Browser Geolocation in Modal
  const handleUseBrowserLocation = () => {
    setModalError(null);
    if (!navigator.geolocation) {
      setModalError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setModalLat(pos.coords.latitude.toFixed(6));
        setModalLng(pos.coords.longitude.toFixed(6));
        setModalAlt(pos.coords.altitude ? String(Math.round(pos.coords.altitude)) : '40');
        setModalLocationName('Current Ground Operator Position');
      },
      (err) => {
        setModalError(`Could not retrieve location: ${err.message}`);
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Geospatial Summary Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Forest Geospatial Intelligence &bull; Leaflet</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
              Forest Map — Drone Wildlife Sightings
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Geographic tracking of drone survey transects, animal sightings, and forest canopy observations with verified GPS telemetry.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            <div className="px-3.5 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 text-center min-w-[90px]">
              <span className="text-xs font-semibold text-stone-500 block uppercase">Waypoints</span>
              <span className="text-base font-extrabold text-stone-900 dark:text-white">
                {mapStats.totalWaypoints}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-center min-w-[90px]">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block uppercase">Sightings</span>
              <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                {mapStats.totalAnimals}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-center min-w-[90px]">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 block uppercase">Species</span>
              <span className="text-base font-extrabold text-blue-800 dark:text-blue-300">
                {mapStats.speciesCount}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 text-center min-w-[90px]">
              <span className="text-xs font-semibold text-stone-500 block uppercase">Geotagged</span>
              <span className="text-base font-extrabold text-stone-900 dark:text-white">
                {mapStats.geotaggedPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Filters and Controls Strip */}
        <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Species Filter */}
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              <select
                value={selectedSpecies}
                onChange={(e) => setSelectedSpecies(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Species ({availableSpecies.length})</option>
                {availableSpecies.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Media Type Filter */}
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <select
                value={selectedMediaType}
                onChange={(e) => setSelectedMediaType(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Media</option>
                <option value="image">Aerial Photos</option>
                <option value="video">Drone Videos</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="24h">Past 24 Hours</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search location, mission..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-2" />
            </div>
          </div>

          {/* Right: Map Layers & View Toggle */}
          <div className="flex items-center gap-2">
            {/* Tile Layer Selector */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
              <Layers className="w-3.5 h-3.5 text-stone-500 ml-1.5 mr-1" />
              {(['streets', 'satellite', 'topo'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveTileType(type)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    activeTileType === type
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  {TILE_LAYERS[type].name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Fit Bounds Button */}
            <button
              type="button"
              onClick={handleFitAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
              title="Zoom to Fit All Survey Waypoints"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit All</span>
            </button>

            {/* View Mode: Map vs Ungeotagged Records */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setActiveViewMode('map')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeViewMode === 'map'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                Map View
              </button>
              <button
                type="button"
                onClick={() => setActiveViewMode('ungeotagged')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeViewMode === 'ungeotagged'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <span>Awaiting GPS</span>
                {ungeotaggedRecords.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {ungeotaggedRecords.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map Viewport or Ungeotagged List */}
      <div className={activeViewMode === 'map' ? 'block' : 'hidden'}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left 3 Columns: Interactive Leaflet Map Container */}
          <div className="lg:col-span-3 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm relative flex flex-col h-[600px] sm:h-[680px]">
            {/* The Map Div */}
            <div ref={mapContainerRef} className="w-full flex-1 z-10" />

            {/* Map Initialization Error Overlay */}
            {mapInitError && (
              <div className="absolute inset-0 z-30 bg-stone-900/90 backdrop-blur-xs flex items-center justify-center p-6 text-center text-white pointer-events-auto">
                <div className="max-w-md bg-stone-900/95 border border-red-500/60 rounded-3xl p-6 shadow-2xl space-y-3">
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
                  <h3 className="text-base font-bold text-red-200">Forest Map Rendering Error</h3>
                  <p className="text-xs text-stone-300 leading-relaxed">{mapInitError}</p>
                  <button
                    type="button"
                    onClick={initMap}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer transition shadow-md"
                  >
                    Retry Map Initialization
                  </button>
                </div>
              </div>
            )}

            {/* Empty state notice banner if no geotagged records match */}
            {!mapInitError && filteredGeotaggedRecords.length === 0 && !isEmptyDismissed && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-lg w-[92%] bg-stone-900/95 backdrop-blur-md border border-stone-700/80 rounded-2xl p-4 shadow-2xl pointer-events-auto">
                <div className="flex items-start gap-3 text-white">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      {geotaggedRecords.length === 0
                        ? 'No Geotagged Survey Waypoints Yet'
                        : 'No Survey Locations Match Filters'}
                    </h3>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      {geotaggedRecords.length === 0
                        ? 'Drone surveys require valid GPS coordinates to plot pins on the map. You can assign coordinates in the "Awaiting GPS" tab, or analyze a preset sample.'
                        : 'No survey locations match your active filter criteria. Try clearing species or date filters.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1.5">
                      {geotaggedRecords.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveViewMode('ungeotagged')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs cursor-pointer transition shadow"
                        >
                          Geotag Existing Records ({ungeotaggedRecords.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEmptyDismissed(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer transition"
                      >
                        Explore Map
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEmptyDismissed(true)}
                    className="text-stone-400 hover:text-white p-1 cursor-pointer"
                    title="Dismiss notice"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Click-to-locate banner if active */}
            {isClickToLocateActive && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-emerald-900 text-white px-4 py-2 rounded-2xl shadow-xl border border-emerald-400 flex items-center gap-2 text-xs font-semibold">
                <Crosshair className="w-4 h-4 text-emerald-300 animate-spin" />
                <span>Click anywhere on the map to set coordinates for {geotagModalTarget?.filename}</span>
                <button
                  type="button"
                  onClick={() => setIsClickToLocateActive(false)}
                  className="ml-2 text-stone-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Map overlay legend */}
            <div className="absolute bottom-4 left-4 z-20 bg-stone-900/85 backdrop-blur border border-stone-700/80 rounded-2xl p-3 text-white text-[11px] shadow-lg max-w-xs pointer-events-auto hidden sm:block">
              <span className="font-bold text-xs block mb-1 text-emerald-400">Drone Geospatial Legend</span>
              <div className="space-y-1 text-stone-300">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500 border border-white"></div>
                  <span>High density animal sightings (&ge;5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500 border border-white"></div>
                  <span>Medium density transect (2-4 animals)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500 border border-white"></div>
                  <span>Single individual sighting</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-400 border-t border-stone-800 pt-1">
                  <span>Dashed circles represent drone sensor footprint</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Column: Survey Waypoints Inspector Drawer */}
          <div className="lg:col-span-1 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 shadow-sm flex flex-col h-[600px] sm:h-[680px]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">Survey Waypoints</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                {filteredGeotaggedRecords.length}
              </span>
            </div>

            {/* Waypoint Cards List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
              {filteredGeotaggedRecords.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  <p>No waypoints match current filters.</p>
                </div>
              ) : (
                filteredGeotaggedRecords.map((item) => {
                  const gps = item.droneMetadata?.gps || item.gps;
                  const isSelected = item.analysisId === selectedSurveyId;
                  const isVideo = item.mediaType === 'video';
                  const count = item.totalTrackedAnimals ?? item.totalAnimals ?? 0;
                  const primarySpecies =
                    item.speciesCounts?.[0]?.animalLabel ||
                    item.tracks?.[0]?.animalLabel ||
                    'Wildlife';

                  return (
                    <div
                      key={item.analysisId}
                      onClick={() => handleFlyToSurvey(item)}
                      className={`p-3 rounded-2xl border transition cursor-pointer select-none ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                          : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700/80 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-stone-900 dark:text-white block truncate">
                            {item.filename || 'Drone Survey'}
                          </span>
                          <span className="text-[11px] text-stone-500 block truncate mt-0.5">
                            {gps?.locationName || item.droneMetadata?.locationDesc || 'Aerial Transect'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            isVideo
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {count} {isVideo ? 'tracks' : 'animals'}
                        </span>
                      </div>

                      {/* Coordinates & Altitude */}
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-stone-500 border-t border-stone-200/60 dark:border-stone-700/60 pt-1.5">
                        <span>{formatCoordinates(gps.latitude, gps.longitude, 2)}</span>
                        {gps.altitudeMeters && (
                          <span className="font-sans font-semibold text-stone-700 dark:text-stone-300">
                            Alt: {gps.altitudeMeters}m
                          </span>
                        )}
                      </div>

                      {/* Quick Inspect button */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-400">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSurvey(item);
                          }}
                          className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom active survey preview bar */}
            {activeSurvey && (
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 mt-auto">
                <button
                  type="button"
                  onClick={() => onSelectSurvey(activeSurvey)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Full Detection Census</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ungeotagged Records View */}
      <div className={activeViewMode === 'ungeotagged' ? 'block' : 'hidden'}>
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Survey Records Awaiting Verified GPS Telemetry</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
                To guarantee scientific accuracy, coordinates are never fabricated. Records without EXIF GPS metadata appear here until verified GPS coordinates or mission coordinates are attached.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveViewMode('map')}
              className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
            >
              &larr; Back to Map View
            </button>
          </div>

          {ungeotaggedRecords.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-stone-900 dark:text-white">All Records Geotagged</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Every analyzed drone photograph and flight video currently in your history has verified GPS coordinates plotted on the map.
              </p>
              <button
                type="button"
                onClick={() => setActiveViewMode('map')}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition cursor-pointer"
              >
                Inspect Map
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ungeotaggedRecords.map((rec) => {
                const isVideo = rec.mediaType === 'video';
                const count = rec.totalTrackedAnimals ?? rec.totalAnimals ?? 0;
                return (
                  <div
                    key={rec.analysisId}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/80 flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 truncate">
                          {isVideo ? (
                            <Film className="w-4 h-4 text-purple-600 shrink-0" />
                          ) : (
                            <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                            {rec.filename || 'Survey Mission'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          No GPS
                        </span>
                      </div>

                      {/* Thumbnail if available */}
                      {rec.imageDataUrl && (
                        <div className="w-full h-28 rounded-xl overflow-hidden bg-stone-900 mb-2.5">
                          <img
                            src={rec.imageDataUrl}
                            alt="Drone thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-stone-600 dark:text-stone-300">
                        <div className="flex justify-between">
                          <span>Sighted Animals:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Survey Date:</span>
                          <span>{new Date(rec.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mission ID:</span>
                          <span className="font-mono text-[11px]">{rec.analysisId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectSurvey(rec)}
                        className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
                      >
                        Inspect
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenGeotagModal(rec)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Add GPS Geotag</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Geotag Input Modal */}
      {geotagModalTarget && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    Attach Verified GPS Geotag
                  </h3>
                  <span className="text-[11px] text-stone-500 block truncate max-w-xs">
                    {geotagModalTarget.filename}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeotagModalTarget(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state */}
            {gpsSaveSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-stone-900 dark:text-white">GPS Attached Successfully</h4>
                <p className="text-xs text-stone-500">
                  Flying to coordinates on the wildlife map...
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Modal Validation Error */}
                {modalError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Popular Conservation Presets */}
                <div>
                  <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                    Quick Conservation Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CONSERVATION_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        {p.name.split(',')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coordinate Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Latitude (-90 to 90) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="-1.5034"
                      value={modalLat}
                      onChange={(e) => setModalLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Longitude (-180 to 180) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="35.1432"
                      value={modalLng}
                      onChange={(e) => setModalLng(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Flight Altitude (meters AGL)
                    </label>
                    <input
                      type="number"
                      placeholder="40"
                      value={modalAlt}
                      onChange={(e) => setModalAlt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Mission / Drone ID
                    </label>
                    <input
                      type="text"
                      placeholder="MISSION-DRONE-07"
                      value={modalMissionId}
                      onChange={(e) => setModalMissionId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Location Description / Park Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maasai Mara Riverine Transect"
                    value={modalLocationName}
                    onChange={(e) => setModalLocationName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUseBrowserLocation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Use Device Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsClickToLocateActive(true);
                      setActiveViewMode('map');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Pick on Map</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGeotagModalTarget(null)}
                    className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-200 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingGps || !modalLat || !modalLng}
                    onClick={handleSaveGps}
                    className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition shadow-md flex items-center gap-2"
                  >
                    {isSavingGps ? (
                      <span>Saving Telemetry...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Plot on Wildlife Map</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
