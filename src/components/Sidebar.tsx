import { AppTab } from '../types/wildlife';
import {
  LayoutDashboard,
  Upload,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plane,
  Activity,
  Layers,
  ShieldAlert,
  Film,
  MapPin,
} from 'lucide-react';

interface SidebarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  historyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  historyCount,
}) => {
  return (
    <aside
      className={`hidden md:flex flex-col bg-stone-900 border-r border-stone-800 transition-all duration-200 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header with Collapse Button */}
      <div className="p-4 flex items-center justify-between border-b border-stone-800/80">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Drone Navigation
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 space-y-1.5 flex-1">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'overview'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Overview Dashboard"
        >
          <LayoutDashboard className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Dashboard</span>}
        </button>

        {/* 2. Image Detection */}
        <button
          type="button"
          onClick={() => onSelectTab('analyze')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'analyze'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Aerial Drone Image Wildlife Detection"
        >
          <Upload className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Image Detection</span>}
        </button>

        {/* 3. Video Tracking */}
        <button
          type="button"
          onClick={() => onSelectTab('video')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'video'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Drone Video Animal Tracking & Census"
        >
          <Film className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Video Tracking</span>}
        </button>

        {/* 4. Batch Survey */}
        <button
          type="button"
          onClick={() => onSelectTab('batch')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'batch'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Batch Drone Photos Analysis"
        >
          <Layers className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Batch Survey</span>}
        </button>

        {/* 3. Forest Map */}
        <button
          type="button"
          onClick={() => onSelectTab('map')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'map'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Geospatial Forest Map & Wildlife Sightings"
        >
          <MapPin className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Forest Map</span>}
        </button>

        {/* 4. Analysis History */}
        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'history'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Permanent Analysis History"
        >
          <div className="flex items-center gap-3 min-w-0">
            <History className="w-4 h-4 shrink-0 text-emerald-400" />
            {!isCollapsed && <span>Analysis History</span>}
          </div>
          {!isCollapsed && historyCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300">
              {historyCount}
            </span>
          )}
        </button>

        {/* 5. Reports */}
        <button
          type="button"
          onClick={() => onSelectTab('reports')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'reports' || currentTab === 'analytics'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="Ecological Reports & Census Summary"
        >
          <Activity className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Reports</span>}
        </button>

        {/* 6. Settings */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
          title="System Settings & Wildlife Ethics"
        >
          <Settings className="w-4 h-4 shrink-0 text-emerald-400" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </nav>

      {/* Drone Hardware / Mission Telemetry Widget */}
      {!isCollapsed ? (
        <div className="p-3 m-3 rounded-2xl bg-stone-950/70 border border-stone-800 text-stone-300 text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-400">
            <span className="flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-emerald-500" />
              <span>Survey Payload</span>
            </span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
          <div className="space-y-1 text-[11px] text-stone-400 font-mono">
            <div className="flex justify-between">
              <span>Sensor:</span>
              <span className="text-stone-200">4K Optical RGB</span>
            </div>
            <div className="flex justify-between">
              <span>Altitude Ref:</span>
              <span className="text-stone-200">35 - 60m AGL</span>
            </div>
            <div className="flex justify-between">
              <span>Bounding Engine:</span>
              <span className="text-emerald-400 font-bold">1000 Normalized</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 text-center text-stone-500">
          <Activity className="w-4 h-4 mx-auto text-emerald-500" />
        </div>
      )}
    </aside>
  );
};
