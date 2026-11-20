import { ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import { formatSimClock } from '../simulation/engine';
import { DOMAIN_META, FACTION_META } from '../simulation/scenarioData';
import type {
  BattleEventDefinition,
  CampaignVerdict,
  PhaseDefinition,
} from '../simulation/types';

interface IntelDrawerProps {
  open: boolean;
  onToggleOpen: () => void;
  phase: PhaseDefinition;
  verdict: CampaignVerdict;
  events: BattleEventDefinition[];
  onFocusEvent: (event: BattleEventDefinition) => void;
}

export function IntelDrawer({
  open,
  onToggleOpen,
  phase,
  verdict,
  events,
  onFocusEvent,
}: IntelDrawerProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        aria-label="展開戰情推演簡報"
        className="pointer-events-auto fixed left-3 top-16 z-20 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#070B12]/82 hover:bg-[#0D1422]/90 backdrop-blur-md border border-white/12 rounded-md transition-colors cursor-pointer"
      >
        <span>戰情簡報</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      </button>
    );
  }

  const verdictColor =
    verdict.outcomeType === 'red_advantage'
      ? 'text-red-300 bg-red-500/10 border-red-400/25'
      : verdict.outcomeType === 'allied_counteroffensive'
        ? 'text-cyan-200 bg-cyan-500/10 border-cyan-400/25'
        : 'text-amber-200 bg-amber-500/10 border-amber-400/25';

  return (
    <aside className="pointer-events-auto fixed left-3 top-16 bottom-20 z-20 w-[306px] xl:w-[328px] flex flex-col bg-[#070B12]/80 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold tracking-wider text-slate-200 whitespace-nowrap">
            九十日戰情簡報與動態
          </h2>
          <span className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap">
            · 唯讀觀測
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="收合戰情推演簡報"
          className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <section className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>當前階段 ({phase.index + 1}/6)</span>
          <span className="font-mono-tabular">
            {formatSimClock(phase.startHour)} – {formatSimClock(phase.endHour)}
          </span>
        </div>

        <h3 className="mt-1 text-sm font-semibold text-white leading-snug">
          {phase.fullTitle}
        </h3>

        <p className="mt-1.5 text-[11px] text-slate-300 leading-relaxed">{phase.summary}</p>

        {/* Live data-driven 90-day strategic trajectory banner */}
        <div className={`mt-2.5 px-2.5 py-2 border rounded ${verdictColor}`}>
          <div className="text-[10px] opacity-80">本局實時數值演算終局趨勢</div>
          <div className="text-[11px] font-semibold leading-snug mt-0.5">{verdict.headline}</div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
          <span className="text-slate-400">參演方</span>
          {phase.activeFactions.map((fid) => (
            <span key={fid} className="inline-flex items-center gap-1 text-slate-200">
              <span className={`w-1.5 h-1.5 rounded-[1px] ${FACTION_META[fid].bgSwatchClass}`} />
              <span>{FACTION_META[fid].shortName}</span>
            </span>
          ))}
        </div>

        <ul className="mt-2 space-y-1 text-[11px] text-slate-400 leading-relaxed">
          {phase.keyDynamics.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-sky-400 font-mono-tabular shrink-0">{idx + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="px-4 py-2 flex items-center justify-between border-b border-white/[0.07] shrink-0">
        <span className="text-xs font-medium text-slate-300">即時推演戰場事件</span>
        <span className="text-[11px] text-slate-400 font-mono-tabular">
          已發生 {events.length} 則
        </span>
      </div>

      <div className="flex-1 overflow-y-auto tactical-scroll divide-y divide-white/[0.07]">
        {events.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-400 text-center">
            推演即將展開，等待首波戰場動態回報…
          </div>
        ) : (
          events.map((ev) => {
            const meta = FACTION_META[ev.faction];
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onFocusEvent(ev)}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${meta.bgSwatchClass}`} />
                    <span className={`font-medium whitespace-nowrap ${meta.textClass}`}>
                      {meta.shortName}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="text-slate-400 truncate">
                      {ev.theaterTag || DOMAIN_META[ev.domain].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono-tabular text-slate-400">
                      {formatSimClock(ev.time)}
                    </span>
                    <Crosshair className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </div>
                </div>
                <div className="mt-1 text-xs font-medium text-slate-100 leading-snug">
                  {ev.title}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{ev.detail}</p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
