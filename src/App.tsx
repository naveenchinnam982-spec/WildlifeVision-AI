/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { ImageUploader } from './components/ImageUploader';
import { DetectionResults } from './components/DetectionResults';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { BatchAnalyzer } from './components/BatchAnalyzer';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { WildlifeMap } from './components/WildlifeMap';
import { VideoAnalyzer } from './components/VideoAnalyzer';
import { VideoResults } from './components/VideoResults';
import { AnalysisResult, VideoAnalysisResult, AppTab } from './types/wildlife';
import { safeApiPost, ApiError } from './utils/apiClient';
import { AlertCircle, RefreshCw, XCircle, Upload, Film, Layers } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Analysis workflow state
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [currentVideoAnalysis, setCurrentVideoAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>('Preparing image...');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [lastPayload, setLastPayload] = useState<{
    imageDataUrl: string;
    originalImageDataUrl: string;
    filename: string;
    imageWidth: number;
    imageHeight: number;
    clientPreprocessingMs: number;
    gps?: any;
    droneMetadata?: any;
  } | null>(null);

  // Active abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Survey history state with instant local cache and permanent disk synchronization
  const [history, setHistory] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('wildlife_history_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(false);

  // Sync history state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wildlife_history_cache', JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      console.warn('LocalStorage sync notice:', e);
    }
  }, [history]);

  // Fetch initial history and configuration from permanent server storage
  const fetchHistoryAndConfig = useCallback(async () => {
    setIsCheckingKey(true);
    try {
      const configRes = await fetch('/api/config');
      if (configRes.ok) {
        const cType = configRes.headers.get('content-type') || '';
        if (cType.includes('application/json')) {
          const configData = await configRes.json();
          setHasApiKey(Boolean(configData.hasApiKey));
        }
      }

      const historyRes = await fetch('/api/history');
      if (historyRes.ok) {
        const cType = historyRes.headers.get('content-type') || '';
        if (cType.includes('application/json')) {
          const historyJson = await historyRes.json();
          const historyData = Array.isArray(historyJson) ? historyJson : historyJson.data;
          if (Array.isArray(historyData)) {
            setHistory(historyData);
          }
        }
      }
    } catch (err) {
      console.warn('Initial data fetch warning:', err);
    } finally {
      setIsCheckingKey(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoryAndConfig();
  }, [fetchHistoryAndConfig]);

  // Cancel any running analysis
  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setAnalysisStage('');
  };

  // Start AI Animal Image Analysis
  const handleStartAnalysis = async (payload: {
    imageDataUrl: string;
    originalImageDataUrl: string;
    filename: string;
    imageWidth: number;
    imageHeight: number;
    clientPreprocessingMs: number;
    gps?: any;
    droneMetadata?: any;
  }) => {
    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLastPayload(payload);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsRateLimited(false);
    setAnalysisStage('Uploading optimized drone image to server...');

    try {
      setAnalysisStage('Executing Gemini multimodal vision inference...');

      // Strip raw oversized original data URL to keep payload tiny (<300KB) and prevent Lambda 413 limits
      const apiPayload = {
        imageDataUrl: payload.imageDataUrl,
        originalImageDataUrl:
          payload.originalImageDataUrl && payload.originalImageDataUrl.length < 1_500_000
            ? payload.originalImageDataUrl
            : undefined,
        filename: payload.filename,
        imageWidth: payload.imageWidth,
        imageHeight: payload.imageHeight,
        clientPreprocessingMs: payload.clientPreprocessingMs,
        gps: payload.gps,
        droneMetadata: payload.droneMetadata,
      };

      const result = await safeApiPost<AnalysisResult>(
        '/api/analyze-animal',
        apiPayload,
        controller.signal
      );

      // Restore client original high-resolution image for canvas inspection HUD
      if (payload.originalImageDataUrl) {
        result.imageDataUrl = payload.originalImageDataUrl;
      }

      // Check if user cancelled while receiving response
      if (controller.signal.aborted) return;

      setAnalysisStage('Validating bounding coordinates & rendering census...');
      setCurrentAnalysis(result);
      setHistory((prev) => [result, ...prev.filter((p) => p.analysisId !== result.analysisId)]);
      setCurrentTab('analyze');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled deliberately, no error display needed
        return;
      }
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setIsRateLimited(true);
        }
        setAnalysisError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Analysis failed. Please check network and API configuration.';
        setAnalysisError(msg);
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleSelectHistoryItem = (item: any) => {
    if (item.mediaType === 'video' || Array.isArray(item.tracks)) {
      setCurrentVideoAnalysis(item as VideoAnalysisResult);
      setCurrentTab('video');
    } else {
      setCurrentAnalysis(item as AnalysisResult);
      setCurrentTab('analyze');
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((h) => h.analysisId !== id));
      if (currentAnalysis?.analysisId === id) {
        setCurrentAnalysis(null);
      }
      if (currentVideoAnalysis?.analysisId === id) {
        setCurrentVideoAnalysis(null);
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await fetch('/api/history/clear', { method: 'POST' });
      setHistory([]);
      setCurrentAnalysis(null);
      setCurrentVideoAnalysis(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'analyze' && !currentAnalysis) {
            // Keep on upload form
          }
        }}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        hasApiKey={hasApiKey}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Collapsible Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
          }}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          historyCount={history.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Missing API Key Warning if not configured */}
          {!hasApiKey && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm">GEMINI_API_KEY Required for Live Detections</p>
                  <p className="text-stone-600 dark:text-stone-300">
                    To enable live wildlife detections with Gemini Vision on Netlify:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-stone-600 dark:text-stone-300 font-mono text-[11px] pt-1">
                    <li>Go to Netlify Dashboard &rarr; <strong>Site configuration</strong> &rarr; <strong>Environment variables</strong></li>
                    <li>Add <strong>GEMINI_API_KEY</strong> with your key from Google AI Studio</li>
                    <li>Go to <strong>Deploys</strong> &rarr; <strong>Trigger deploy</strong> &rarr; <strong>Deploy site</strong></li>
                  </ol>
                </div>
              </div>
              <div className="shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => fetchHistoryAndConfig()}
                  disabled={isCheckingKey}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingKey ? 'animate-spin' : ''}`} />
                  <span>{isCheckingKey ? 'Checking...' : 'Check Connection'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Analysis Error Alert */}
          {analysisError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm">
                    {isRateLimited ? 'API Rate Limit Reached' : 'Computer Vision Analysis Error'}
                  </p>
                  <p>{analysisError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {lastPayload && (
                  <button
                    type="button"
                    onClick={() => handleStartAnalysis(lastPayload)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer transition shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Analysis</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAnalysisError(null)}
                  className="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold cursor-pointer transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Tab 1: Dashboard Overview */}
          {currentTab === 'overview' && (
            <DashboardOverview
              history={history}
              onAnalyzeNew={() => {
                setCurrentAnalysis(null);
                setCurrentTab('analyze');
              }}
              onAnalyzeImage={() => {
                setCurrentAnalysis(null);
                setCurrentTab('analyze');
              }}
              onTrackVideo={() => {
                setCurrentVideoAnalysis(null);
                setCurrentTab('video');
              }}
              onSelectHistoryItem={handleSelectHistoryItem}
              onOpenMap={() => setCurrentTab('map')}
            />
          )}

          {/* Tab 2: Aerial Image Wildlife Detection */}
          {currentTab === 'analyze' && (
            <div>
              {currentAnalysis ? (
                <DetectionResults
                  analysis={currentAnalysis}
                  onReset={() => {
                    setCurrentAnalysis(null);
                    setPendingImageFile(null);
                  }}
                  onViewOnMap={() => {
                    setCurrentTab('map');
                  }}
                />
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Mode Selector Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Aerial Photo Survey Mode</span>
                      </div>
                      <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                        Aerial Image Wildlife Detection
                      </h2>
                      <p className="text-xs text-stone-500">
                        Upload drone photographs to detect wild animals, classify taxonomic species, and localize individuals.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('video');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 cursor-pointer transition"
                      >
                        <Film className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Switch to Video Tracking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentTab('batch')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 cursor-pointer transition"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Batch Photos</span>
                      </button>
                    </div>
                  </div>

                  <ImageUploader
                    onStartAnalysis={handleStartAnalysis}
                    onCancelAnalysis={handleCancelAnalysis}
                    isAnalyzing={isAnalyzing}
                    analysisStage={analysisStage}
                    initialFile={pendingImageFile}
                    onSwitchToVideo={(file) => {
                      if (file) setPendingVideoFile(file);
                      setCurrentTab('video');
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Drone Video Animal Tracking */}
          {currentTab === 'video' && (
            <div>
              {currentVideoAnalysis ? (
                <VideoResults
                  videoResult={currentVideoAnalysis}
                  onReset={() => {
                    setCurrentVideoAnalysis(null);
                    setPendingVideoFile(null);
                  }}
                  onViewOnMap={() => {
                    setCurrentTab('map');
                  }}
                />
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Mode Selector Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                        <Film className="w-3.5 h-3.5" />
                        <span>Drone Video Tracking Engine</span>
                      </div>
                      <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                        Drone Video Wildlife Tracking & Census
                      </h2>
                      <p className="text-xs text-stone-500">
                        Upload aerial transect video to track animal movement trajectories and compute accurate unique counts.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('analyze');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 cursor-pointer transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Switch to Image Detection</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentTab('batch')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 cursor-pointer transition"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Batch Photos</span>
                      </button>
                    </div>
                  </div>

                  <VideoAnalyzer
                    initialFile={pendingVideoFile}
                    onAnalysisComplete={(res) => {
                      setCurrentVideoAnalysis(res);
                      setHistory((prev: any) => [
                        res,
                        ...prev.filter((p: any) => p.analysisId !== res.analysisId),
                      ]);
                    }}
                    onSwitchToImage={(file) => {
                      if (file) setPendingImageFile(file);
                      setCurrentTab('analyze');
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Batch Analysis Mode */}
          {currentTab === 'batch' && (
            <BatchAnalyzer
              onSelectResult={(result) => {
                setCurrentAnalysis(result);
                setCurrentTab('analyze');
              }}
              onAnalysisComplete={(results) => {
                setHistory((prev) => {
                  const existingIds = new Set(prev.map((p) => p.analysisId));
                  const newItems = results.filter((r) => !existingIds.has(r.analysisId));
                  return [...newItems, ...prev];
                });
              }}
            />
          )}

          {/* Tab 4: Ecological Census Reports & Population Analytics */}
          {(currentTab === 'reports' || currentTab === 'analytics') && (
            <AnalyticsDashboard
              history={history}
              onSelectSurvey={handleSelectHistoryItem}
            />
          )}

          {/* Tab: Geospatial Wildlife Map (Leaflet) */}
          {currentTab === 'map' && (
            <WildlifeMap
              history={history}
              onSelectSurvey={handleSelectHistoryItem}
              onUpdateSurveyGps={(analysisId, gps) => {
                setHistory((prev) =>
                  prev.map((item) => {
                    if (item.analysisId === analysisId) {
                      return {
                        ...item,
                        droneMetadata: {
                          ...(item.droneMetadata || {}),
                          gps,
                        },
                      };
                    }
                    return item;
                  })
                );
              }}
            />
          )}

          {/* Tab 5: Survey Mission History */}
          {currentTab === 'history' && (
            <HistoryView
              history={history}
              onSelectHistoryItem={handleSelectHistoryItem}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              onClearAllHistory={handleClearAllHistory}
              onAnalyzeNew={() => {
                setCurrentAnalysis(null);
                setCurrentTab('analyze');
              }}
            />
          )}

          {/* Tab 4: Guidelines & Settings */}
          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
