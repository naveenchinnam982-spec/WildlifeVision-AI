import React from 'react';
import { Binoculars, LayoutDashboard, Upload, History, Settings, Menu, X, ShieldCheck, Layers, Activity, Film, MapPin, Download } from 'lucide-react';
import { AppTab } from '../types/wildlife';

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  hasApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  mobileMenuOpen,
  onToggleMobileMenu,
  hasApiKey,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur border-b border-stone-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onSelectTab('overview')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-md shadow-emerald-950">
              <Binoculars className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block leading-none">
                WildlifeVision<span className="text-emerald-400"> AI</span>
              </span>
              <span className="text-[10px] text-stone-400 font-medium tracking-wider uppercase block mt-0.5">
                Drone Wildlife Monitoring
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'overview'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* 2. Image Detection */}
          <button
            type="button"
            onClick={() => onSelectTab('analyze')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'analyze'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
            title="Aerial Drone Image Wildlife Detection"
          >
            <Upload className="w-4 h-4" />
            <span>Image Detection</span>
          </button>

          {/* 3. Video Tracking */}
          <button
            type="button"
            onClick={() => onSelectTab('video')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'video'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
            title="Drone Video Animal Tracking & Census"
          >
            <Film className="w-4 h-4 text-emerald-400" />
            <span>Video Tracking</span>
          </button>

          {/* 4. Batch Survey */}
          <button
            type="button"
            onClick={() => onSelectTab('batch')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'batch'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
            title="Batch Drone Photos Analysis"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Batch Survey</span>
          </button>

          {/* 3. Forest Map */}
          <button
            type="button"
            onClick={() => onSelectTab('map')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'map'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Forest Map</span>
          </button>

          {/* 4. Analysis History */}
          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'history'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Analysis History</span>
          </button>

          {/* 5. Reports */}
          <button
            type="button"
            onClick={() => onSelectTab('reports')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'reports' || currentTab === 'analytics'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Reports</span>
          </button>

          {/* 6. Settings */}
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Sensor & Pipeline Status & Download Action */}
        <div className="flex items-center gap-2.5">
          <a
            href="/wildlifevision-ai.zip"
            download="wildlifevision-ai.zip"
            title="Download Complete Project Source Code (.ZIP)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-950/40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download ZIP</span>
          </a>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-800/80 border border-stone-700/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                hasApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-stone-300 text-[11px] font-medium">
              {hasApiKey ? 'Drone CV Online' : 'API Key Checking'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline text-[11px]">Gemini 3.8 Flash</span>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-800 bg-stone-900 px-4 py-3 space-y-1">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('overview');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'overview' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* 2. Image Detection */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('analyze');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'analyze' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Image Detection</span>
          </button>

          {/* 3. Video Tracking */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('video');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'video' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Film className="w-4 h-4 text-emerald-400" />
            <span>Video Tracking</span>
          </button>

          {/* 4. Batch Survey */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('batch');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'batch' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Batch Survey</span>
          </button>

          {/* 3. Forest Map */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('map');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'map' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Forest Map</span>
          </button>

          {/* 4. Analysis History */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('history');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'history' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Analysis History</span>
          </button>

          {/* 5. Reports */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('reports');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'reports' || currentTab === 'analytics' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Reports</span>
          </button>

          {/* 6. Settings */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('settings');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'settings' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          {/* Download Project ZIP */}
          <div className="pt-2 border-t border-stone-800">
            <a
              href="/wildlifevision-ai.zip"
              download="wildlifevision-ai.zip"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Project (.ZIP)</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
