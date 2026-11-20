import { Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import { PHASES, TOTAL_SIM_HOURS } from '../simulation/scenarioData';
import type { DirectorShot } from '../simulation/types';

interface TimelineBarProps {
  simHours: number;
  formattedClock: string;
  playing: boolean;
  speed: number;
  autoCamera: boolean;
  activeDirectorShot: DirectorShot;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onRestart: () => void;
  onRerollCampaign: () => void;
  onSeekHours: (hours: number) => void;
}

const SPEED_OPTIONS = [1, 4, 16, 48];

export function TimelineBar({
  simHours,
  formattedClock,
  playing,
  speed,
  autoCamera,
  activeDirectorShot,
  onTogglePlay,
  onChangeSpeed,
  onRestart,
  onRerollCampaign,
  onSeekHours,
}: TimelineBarProps) {
  const progressPct = Math.max(0, Math.min(100, (simHours / TOTAL_SIM_HOURS) * 100));

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center">
      {autoCamera && (
        <div className="mb-2 px-4 py-1.5 max-w-2xl bg-[#070B12]/78 backdrop-blur-md border border-white/10 rounded-md text-center">
          <div className="text-xs text-slate-200 leading-snug">
            <span className="text-sky-300 font-medium">{activeDirectorShot.label}</span>
            <span className="mx-2 text-slate-500" aria-hidden="true">·</span>
            <span>{activeDirectorShot.caption}</span>
          </div>
        </div>
      )}

      <footer className="pointer-events-auto w-full h-16 px-4 flex items-center gap-3.5 bg-[#070B12]/88 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? '暫停推演' : '繼續推演'}
            className="w-9 h-9 flex items-center justify-center bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/35 rounded-md transition-colors cursor-pointer"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={onRestart}
            title="重播本局推演 (從 D+00 開始)"
            aria-label="重播本局"
            className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-slate-100 bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRerollCampaign}
            title="重抽戰場變量參數・展開全新平行推演"
            className="h-9 px-2.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-200 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">重抽變量新局</span>
          </button>

          <div className="hidden sm:flex items-center p-0.5 bg-white/[0.04] border border-white/10 rounded-md ml-0.5">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-1 text-[11px] font-mono-tabular font-medium rounded transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:flex flex-col shrink-0 w-[94px]">
          <span className="text-[10px] text-slate-400">推演時刻</span>
          <span className="text-xs font-mono-tabular font-semibold text-sky-300">
            {formattedClock}
          </span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="hidden md:grid grid-cols-6 gap-1">
            {PHASES.map((p) => {
              const isCurrent =
                (simHours >= p.startHour && simHours < p.endHour) ||
                (p.index === PHASES.length - 1 && simHours >= p.startHour);
              return (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => onSeekHours(p.startHour + 0.3)}
                  className={`text-left text-[11px] truncate px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    isCurrent
                      ? 'text-sky-300 font-semibold bg-sky-500/12'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                  title={p.fullTitle}
                >
                  {p.shortTitle}
                </button>
              );
            })}
          </div>

          <div className="relative h-4 flex items-center">
            <div className="w-full h-1.5 bg-white/10 rounded-xs overflow-hidden relative">
              {PHASES.slice(1).map((p) => (
                <div
                  key={p.index}
                  className="absolute top-0 bottom-0 w-px bg-[#070B12]/90 z-10"
                  style={{ left: `${(p.startHour / TOTAL_SIM_HOURS) * 100}%` }}
                />
              ))}
              <div
                className="h-full bg-sky-400 transition-none"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <input
              type="range"
              aria-label="推演時間軸"
              min={0}
              max={TOTAL_SIM_HOURS}
              step={0.5}
              value={simHours}
              onChange={(e) => onSeekHours(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-end shrink-0 w-[72px]">
          <span className="text-[10px] text-slate-400">推演週期</span>
          <span className="text-xs font-mono-tabular text-slate-300">90 日 (3月)</span>
        </div>
      </footer>
    </div>
  );
}
