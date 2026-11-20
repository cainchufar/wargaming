import { Eye, EyeOff, Globe, Map as MapIcon, Video } from 'lucide-react';
import type { MapMode } from '../cesium/CesiumViewport';
import { CAMERA_PRESETS } from '../simulation/scenarioData';
import type { CameraViewSpec, PhaseDefinition } from '../simulation/types';

interface TopBarProps {
  formattedClock: string;
  phase: PhaseDefinition;
  seed: number;
  autoCamera: boolean;
  activePresetId: string | null;
  mapMode: MapMode;
  tilesStatus: 'loading' | 'google3d' | 'fallback';
  hudVisible: boolean;
  onToggleAutoCamera: () => void;
  onSelectPreset: (preset: CameraViewSpec) => void;
  onToggleMapMode: () => void;
  onToggleHudVisible: () => void;
}

export function TopBar({
  formattedClock,
  phase,
  seed,
  autoCamera,
  activePresetId,
  mapMode,
  tilesStatus,
  hudVisible,
  onToggleAutoCamera,
  onSelectPreset,
  onToggleMapMode,
  onToggleHudVisible,
}: TopBarProps) {
  return (
    <header className="pointer-events-auto fixed top-0 left-0 right-0 z-30 h-12 px-4 flex items-center justify-between gap-3 bg-[#070B12]/84 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <h1 className="text-sm font-semibold tracking-wide text-slate-100 whitespace-nowrap shrink-0">
          台海暨印太聯合作戰推演
        </h1>
        <span className="h-4 w-px bg-white/15 shrink-0" aria-hidden="true" />
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
          <span className="font-mono-tabular font-semibold text-sky-300">{formattedClock}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono-tabular text-[11px] text-amber-300/90">局 #{seed}</span>
          <span className="hidden 2xl:inline text-slate-500" aria-hidden="true">·</span>
          <span className="hidden 2xl:inline text-slate-300 truncate max-w-[200px]">
            {phase.shortTitle}
          </span>
        </div>
      </div>

      <nav
        aria-label="戰區觀測視角"
        className="hidden lg:flex items-center gap-0.5 p-1 bg-white/[0.04] border border-white/10 rounded-md"
      >
        <button
          type="button"
          onClick={onToggleAutoCamera}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            autoCamera
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
              : 'text-slate-400 hover:text-slate-100 border border-transparent'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>自動導覽</span>
        </button>

        <span className="h-3.5 w-px bg-white/10 mx-0.5 shrink-0" aria-hidden="true" />

        {CAMERA_PRESETS.map((preset) => {
          const isActive = !autoCamera && activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white/14 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleMapMode}
          title="切換 Google 3D 實景與戰術暗色底圖"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {mapMode === 'google3d' ? (
            <>
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xl:inline">
                {tilesStatus === 'fallback' ? '衛星地形圖資' : 'Google 3D 實景'}
              </span>
            </>
          ) : (
            <>
              <MapIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">戰術暗色底圖</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleHudVisible}
          title={hudVisible ? '收合兩側面板以純淨觀賞 3D 畫面' : '展開戰情觀測面板'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hudVisible ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">純淨觀景</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">顯示面板</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
