import React from 'react';
import { Binoculars, LayoutDashboard, Upload, History, Settings, Menu, X, ShieldCheck, Layers, Activity, Film, MapPin } from 'lucide-react';
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

          {/* 2. Analyze Image / Video */}
          <button
            type="button"
            onClick={() => onSelectTab('analyze')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'analyze' || currentTab === 'video'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Analyze Image / Video</span>
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

        {/* Sensor & Pipeline Status */}
        <div className="flex items-center gap-3">
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

          {/* 2. Analyze Image / Video */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('analyze');
              onToggleMobileMenu();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentTab === 'analyze' || currentTab === 'video' ? 'bg-emerald-800 text-white' : 'text-stone-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Analyze Image / Video</span>
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
        </div>
      )}
    </header>
  );
};
