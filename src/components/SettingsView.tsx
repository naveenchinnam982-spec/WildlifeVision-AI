import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  Info,
  Cpu,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [boxThickness, setBoxThickness] = useState<string>('standard');
  const [savePreferencesSuccess, setSavePreferencesSuccess] = useState<boolean>(false);

  const handleSave = () => {
    setSavePreferencesSuccess(true);
    setTimeout(() => setSavePreferencesSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white">
          System Configuration & Wildlife Ethics
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Detection parameters, computer vision models, and drone survey guidelines
        </p>
      </div>

      {/* Detection Preferences Card */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <Sliders className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white uppercase tracking-wider">
            Analysis & Annotation Preferences
          </h3>
        </div>

        <div className="space-y-4">
          {/* Minimum Confidence Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                Minimum Confidence Display Threshold
              </span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {minConfidence}%
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="95"
              step="5"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full accent-emerald-700 cursor-pointer"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Detections with estimated confidence below this threshold are flagged for biological review.
            </p>
          </div>

          {/* Box thickness */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1.5">
              Bounding Box Line Thickness
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'compact', label: 'Fine (1.5px)' },
                { id: 'standard', label: 'Standard (2.5px)' },
                { id: 'bold', label: 'High Contrast (4px)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBoxThickness(opt.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition ${
                    boxThickness === opt.id
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition cursor-pointer"
          >
            Save Preferences
          </button>
          {savePreferencesSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Preferences saved
            </span>
          )}
        </div>
      </div>

      {/* Model & System Specifications */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <Cpu className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white uppercase tracking-wider">
            AI Engine & Computer Vision Pipeline
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/60 space-y-1">
            <span className="font-semibold text-stone-900 dark:text-white">Multimodal Model</span>
            <p className="text-stone-500">Gemini 3.8 Flash (`gemini-3.8-flash`)</p>
          </div>
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/60 space-y-1">
            <span className="font-semibold text-stone-900 dark:text-white">Coordinate System</span>
            <p className="text-stone-500">Normalized [0, 1000] scale, strictly mapped to pixel geometry</p>
          </div>
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/60 space-y-1">
            <span className="font-semibold text-stone-900 dark:text-white">Spatial Deduplication</span>
            <p className="text-stone-500">Class-aware Non-Maximum Suppression (IoU ≥ 0.60 threshold)</p>
          </div>
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/60 space-y-1">
            <span className="font-semibold text-stone-900 dark:text-white">Data Retention</span>
            <p className="text-stone-500">Durable session storage with on-demand CSV/PDF export</p>
          </div>
        </div>
      </div>

      {/* Ethical Wildlife Drone Survey Guidelines */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <Shield className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white uppercase tracking-wider">
            Ethical Drone Wildlife Survey Protocol
          </h3>
        </div>

        <div className="space-y-3 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          <p>
            When conducting wildlife monitoring flights, researchers must adhere to international conservation standards (IUCN, FAA Part 107, EASA Open/Specific categories) to avoid stressing animals:
          </p>

          <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-700 dark:text-stone-300">
            <li>
              <strong>Minimum Flight Altitude:</strong> Maintain at least 30 to 50 meters Above Ground Level (AGL) for large mammals (elephants, ungulates, carnivores) to avoid behavioral disturbance.
            </li>
            <li>
              <strong>Acoustic Footprint:</strong> Avoid low hover flights directly overhead. Use low-noise rotor blades and fly systematic transects rather than chasing individuals.
            </li>
            <li>
              <strong>Breeding & Nesting Seasons:</strong> Avoid low-altitude flights over avian rookeries, seal haul-outs, or maternity dens during sensitive reproductive periods.
            </li>
            <li>
              <strong>AI & Field Verification:</strong> Model-generated confidence is an analytical estimate. Distant or occluded animals should be verified through ground-truth census or multi-angle passes.
            </li>
          </ul>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-6 space-y-2 text-xs text-stone-500">
        <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200 font-bold">
          <Info className="w-4 h-4 text-emerald-700" />
          <span>WildlifeVision AI — Academic & Environmental Project</span>
        </div>
        <p>
          Version 1.0.0 • Developed for autonomous wildlife census, anti-poaching spatial monitoring, and biodiversity ecological surveys.
        </p>
      </div>
    </div>
  );
};
