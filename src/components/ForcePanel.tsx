import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Layers, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import {
  DOMAIN_META,
  FACTION_META,
  PRC_NATIONAL_TOTALS,
  getUnitSpecs,
} from '../simulation/scenarioData';
import type {
  CampaignVariables,
  CampaignVerdict,
  DomainId,
  EvaluatedTerritoryZone,
  EvaluatedUnit,
  FactionDomainStats,
  FactionId,
  LayerVisibility,
  StrategicMetrics,
  TerritoryControlState,
  TerritoryRegionGroup,
} from '../simulation/types';

interface ForcePanelProps {
  open: boolean;
  onToggleOpen: () => void;
  factionStats: Record<FactionId, FactionDomainStats>;
  strategicMetrics: StrategicMetrics;
  territories: EvaluatedTerritoryZone[];
  units: EvaluatedUnit[];
  variables: CampaignVariables;
  verdict: CampaignVerdict;
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  selectedUnit: EvaluatedUnit | null;
  onSelectUnit: (unitId: string) => void;
  onCloseSelectedUnit: () => void;
  onFocusUnit: (unit: EvaluatedUnit) => void;
}

type PanelTab = 'strategy' | 'forces' | 'layers';

const FACTION_GROUPS: Array<{ title: string; subtitle: string; factions: FactionId[] }> = [
  {
    title: '台海核心戰區攻防',
    subtitle: '五大戰區＋三航母群 vs 洞庫與岸置不對稱防衛',
    factions: ['pla', 'roc'],
  },
  {
    title: '東北亞／美軍四航母與日自',
    subtitle: '日本自衛隊（含水陸機動團）· 美軍 4 航母輪戰與 SSGN',
    factions: ['jsdf', 'us'],
  },
  {
    title: '澳紐與東南亞／南海勢力',
    subtitle: '澳洲 F-35A／科林斯／紐西蘭艦隊 · 菲越星馬六甲封鎖',
    factions: ['anzac', 'sea_asean'],
  },
  {
    title: '印度洋與英法遠征末期聯軍',
    subtitle: '印度安達曼／維克蘭特號 · 英法戴高樂／威爾斯末期進駐南海',
    factions: ['ind', 'uk_fr'],
  },
  {
    title: '朝鮮半島牽制軸',
    subtitle: '南北韓三八線高戒備對峙 · 牽制北方戰區主力',
    factions: ['kor_usfk', 'dprk'],
  },
];

const DOMAIN_ORDER: DomainId[] = ['land', 'sea', 'air', 'missile'];

const LAYER_ITEMS: Array<{ key: keyof LayerVisibility; label: string }> = [
  { key: 'land', label: '陸軍／陸戰、空降與兩棲登陸' },
  { key: 'sea', label: '海軍／潛艦與海警船團' },
  { key: 'air', label: '空中戰機、電戰、加油與無人機' },
  { key: 'missile', label: '彈道／遠火／巡弋飛彈與攔截' },
  { key: 'radar', label: '3D 雷達與區域防空傘' },
  { key: 'territory', label: '全印太與中國本土佔領／控制區 (16區)' },
  { key: 'references', label: '海峽中線、三八線與第一島鏈地標' },
];

const TERRITORY_STYLE: Record<
  TerritoryControlState,
  { swatchClass: string; textClass: string }
> = {
  roc: { swatchClass: 'bg-blue-500', textClass: 'text-blue-300' },
  pla: { swatchClass: 'bg-red-500', textClass: 'text-red-300' },
  contested: { swatchClass: 'bg-orange-400', textClass: 'text-orange-300' },
  jsdf: { swatchClass: 'bg-amber-400', textClass: 'text-amber-300' },
  us: { swatchClass: 'bg-cyan-400', textClass: 'text-cyan-300' },
  anzac: { swatchClass: 'bg-teal-400', textClass: 'text-teal-300' },
  sea_asean: { swatchClass: 'bg-indigo-400', textClass: 'text-indigo-300' },
  ind: { swatchClass: 'bg-lime-400', textClass: 'text-lime-300' },
  uk_fr: { swatchClass: 'bg-purple-400', textClass: 'text-purple-300' },
};

const TERRITORY_GROUP_LABELS: Array<{ group: TerritoryRegionGroup; title: string }> = [
  { group: 'taiwan_outlying', title: '台澎金馬東沙（8 區）' },
  { group: 'indo_pacific', title: '日本、菲律賓與南海島礁（4 區）' },
  { group: 'prc_mainland', title: '中國本土沿海戰區（4 區 · 可遭反推佔領）' },
];

const SOURCE_CITATIONS = [
  {
    title: '美國國防部《2024 中國軍力報告 (CMPR)》與三航母對抗基準',
    detail:
      '解放軍全軍 203.5 萬、戰機 3,150+ 架、370+ 艘艦艇（含遼寧 CV-16、山東 CV-17、福建 CV-18 三航母群）；美軍依艦隊反應計畫 (FRP) 於 D+22–38 加派第三梯次雙航母與俄亥俄級 SSGN 反航母群。',
  },
  {
    title: '歷史航程推估：印度 (安達曼／維克蘭特) ＆ 英法雙航母 (CSG21／克里蒙梭)',
    detail:
      '印度距麻六甲西口僅 650 浬（安達曼 P-8I/潛艦約 D+10–23 鎖喉，維克蘭特航母約 D+32–55 進南海）；英法自朴茨茅斯／土倫遠航 9,500–10,500 浬經蘇伊士或好望角，推估於戰爭末期（D+45–70）抵達南海。',
  },
  {
    title: '90 日無預設結果之蘭徹斯特變量演算核心',
    detail:
      '系統依每局抽樣之 11 項變量進行 721 步階數值推進，完全不鎖定結局：任何戰區（含台灣本島、日本琉球及中國沿海四戰區）皆可動態轉換佔領權。',
  },
];

const DEFAULT_SOURCE_BY_FACTION: Record<FactionId, string> = {
  pla: 'DoD CMPR 2024 / IISS Military Balance 2024（解放軍戰區與三航母編制）',
  roc: 'DoD CMPR 2024 / 中華民國國防報告書・IISS 2024',
  jsdf: 'IISS Military Balance 2024 / 日本防衛白皮書',
  us: 'IISS 2024 / USN Fleet Response Plan (FRP) 4 航母輪戰與 SSGN 反航母模型',
  anzac: 'IISS 2024 / 澳洲國防白皮書 (DSR) 與紐西蘭國防軍公開編制',
  sea_asean: 'IISS Military Balance 2024（菲・越・星・印南海聯防與咽喉軍力）',
  ind: 'IISS 2024 / 2020 安達曼動員與印度東方艦隊南海部署航程推估',
  uk_fr: '英國 CSG21 (Queen Elizabeth/PoW) ＆ 法國克里蒙梭 25 (CdG) 印太航程推估',
  kor_usfk: 'IISS Military Balance 2024 / 駐韓美軍公開部署報告',
  dprk: 'IISS Military Balance 2024 / 韓國國防白皮書',
};

function getUnitSourceRef(unit: EvaluatedUnit['def']): string {
  return unit.sourceRef ?? DEFAULT_SOURCE_BY_FACTION[unit.faction];
}

export function ForcePanel({
  open,
  onToggleOpen,
  factionStats,
  strategicMetrics,
  territories,
  units,
  variables,
  verdict,
  layers,
  onToggleLayer,
  selectedUnit,
  onSelectUnit,
  onCloseSelectedUnit,
  onFocusUnit,
}: ForcePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('strategy');
  const [expandedFaction, setExpandedFaction] = useState<FactionId | null>('pla');

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        aria-label="展開戰略分析與兵力面板"
        className="pointer-events-auto fixed right-3 top-16 z-20 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#070B12]/82 hover:bg-[#0D1422]/90 backdrop-blur-md border border-white/12 rounded-md transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        <span>戰略與兵力</span>
      </button>
    );
  }

  const plaAir = factionStats.pla.byDomain.air;
  const rocAir = factionStats.roc.byDomain.air;

  const metricRows = [
    {
      label: '紅方跨海兩棲投送運力',
      value: strategicMetrics.amphibiousLiftPct,
      barClass: 'bg-red-500',
      valueClass:
        strategicMetrics.amphibiousLiftPct <= 35 ? 'text-sky-300' : 'text-red-300',
      note: '運力若守住 50%+ 則紅軍可持續擴張台澎橋頭堡；一旦跌破三成即面臨斷補崩解。',
    },
    {
      label: '解放軍遠程精準飛彈庫存',
      value: strategicMetrics.plaMissileStockPct,
      barClass: 'bg-orange-400',
      valueClass:
        strategicMetrics.plaMissileStockPct <= 25 ? 'text-sky-300' : 'text-orange-300',
      note: '多戰區飽和齊射消耗庫存，見底後難再壓制美日澳紐基地與沿岸反擊群。',
    },
    {
      label: '聯軍防空攔截／長程反艦彈庫',
      value: strategicMetrics.alliedMunitionStockPct,
      barClass: 'bg-sky-400',
      valueClass:
        strategicMetrics.alliedMunitionStockPct <= 35 ? 'text-amber-300' : 'text-sky-300',
      note: 'PAC-3、天弓三、SM-6 與 LRASM／JASSM-ER 前三週高速消耗，待第 25 日後美本土補給船團回補。',
    },
    {
      label: '台灣洞庫與不對稱核心保存率',
      value: strategicMetrics.rocAsymmetricCorePct,
      barClass: 'bg-blue-500',
      valueClass: 'text-blue-300',
      note: '取決首擊損耗變量與洞庫防護率，決定本島能否撐到第二個月國際援軍匯流。',
    },
    {
      label: '美日澳紐印英法聯合介入強度',
      value: strategicMetrics.alliedInterventionPct,
      barClass: 'bg-cyan-400',
      valueClass: 'text-cyan-300',
      note: '含美軍 4 航母輪戰、SSGN 反航母、日澳紐東南亞，以及中後期印度與末期英法雙航母群。',
    },
    {
      label: '南海／麻六甲東西雙門封鎖壓迫',
      value: strategicMetrics.scsCoalitionPressurePct,
      barClass: 'bg-indigo-400',
      valueClass: 'text-indigo-300',
      note: '新加坡（東口）＋印度安達曼（西口）＋澳紐潛艦＋越南南海，末期隨英法抵達進一步鎖死。',
    },
    {
      label: '北部戰區受韓半島牽制留守比',
      value: strategicMetrics.ntcPinningPct,
      barClass: 'bg-emerald-400',
      valueClass: 'text-emerald-300',
      note: `${strategicMetrics.koreanTensionLabel}`,
    },
  ];

  const varBadges = [
    { label: '首擊效能', val: `${Math.round(variables.firstStrikeEffectiveness * 100)}%` },
    { label: '海象利空/平穩', val: `${Math.round(variables.weatherSeaState * 100)}%` },
    { label: '美軍介入延遲', val: `${variables.usInterventionDelayHours}h` },
    { label: '美軍增援強度', val: `${Math.round(variables.usSurgeIntensity * 100)}%` },
    { label: '澳紐遠征強度', val: `${Math.round(variables.anzacCommitment * 100)}%` },
    { label: '南海東協升溫', val: `${Math.round(variables.aseanScsEscalation * 100)}%` },
    { label: '印度介入/鎖喉', val: `${Math.round(variables.indiaIntervention * 100)}%` },
    { label: '英法末期遠征', val: `${Math.round(variables.euroFleetIntervention * 100)}%` },
    { label: '韓半島牽制度', val: `${Math.round(variables.koreaPinningFactor * 100)}%` },
    { label: '紅方彈庫深度', val: `${Math.round(variables.plaStockpileDepth * 100)}%` },
  ];

  return (
    <aside className="pointer-events-auto fixed right-3 top-16 bottom-20 z-20 w-[318px] xl:w-[358px] flex flex-col bg-[#070B12]/84 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
        <h2 className="text-xs font-semibold tracking-wider text-slate-200 whitespace-nowrap">
          90 日印太變量推演與佔領圖譜
        </h2>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="收合戰略與兵力面板"
          className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Segmented Tabs */}
      <div className="px-3 py-2 border-b border-white/10 grid grid-cols-3 gap-1 bg-white/[0.02] shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('strategy')}
          className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
            activeTab === 'strategy'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>佔領與變量</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('forces')}
          className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
            activeTab === 'forces'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>十方兵力</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>考據與圖層</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto tactical-scroll">
        {selectedUnit && (
          <section className="px-4 py-3.5 bg-white/[0.045] border-b border-white/12">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                  <span
                    className={`w-2 h-2 rounded-[1px] shrink-0 ${FACTION_META[selectedUnit.def.faction].bgSwatchClass}`}
                  />
                  <span className={`font-medium ${FACTION_META[selectedUnit.def.faction].textClass}`}>
                    {FACTION_META[selectedUnit.def.faction].shortName}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">{selectedUnit.def.theaterTag}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono-tabular text-slate-400">
                    {selectedUnit.def.callsign}
                  </span>
                </div>
                <h3 className="mt-1 text-xs font-semibold text-white leading-snug">
                  {selectedUnit.def.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseSelectedUnit}
                aria-label="關閉單位資訊"
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-slate-400">現存兵力</span>
                <div className="font-mono-tabular text-slate-100 font-medium">
                  {selectedUnit.effectiveCount} / {selectedUnit.def.baseStrength}{' '}
                  {selectedUnit.def.unitLabel}
                </div>
              </div>
              <div>
                <span className="text-slate-400">戰力完好率</span>
                <div className="font-mono-tabular text-slate-100 font-medium">
                  {Math.round(selectedUnit.integrity)}%
                </div>
              </div>
              <div>
                <span className="text-slate-400">即時座標</span>
                <div className="font-mono-tabular text-slate-200">
                  {selectedUnit.lat.toFixed(2)}°{selectedUnit.lat >= 0 ? 'N' : 'S'},{' '}
                  {selectedUnit.lon.toFixed(2)}°E
                </div>
              </div>
              <div>
                <span className="text-slate-400">高度 / 航速</span>
                <div className="font-mono-tabular text-slate-200">
                  {Math.round(selectedUnit.alt)}m · {selectedUnit.def.speedKnots}kt
                </div>
              </div>
            </div>

            {(() => {
              const specs = getUnitSpecs(selectedUnit.def);
              return (
                <div className="mt-2.5 pt-2.5 border-t border-white/[0.08] space-y-1.5 text-[11px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-400 shrink-0">兵種分類</span>
                    <span className="text-sky-200 font-medium text-right">
                      {specs.branchLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">主力裝備：</span>
                    <span className="text-slate-200">{specs.platforms}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">射程／半徑：</span>
                    <span className="font-mono-tabular text-amber-200">
                      {specs.weaponRangeKm}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">彈藥／出擊：</span>
                    <span className="text-slate-300">{specs.munitionsOrSortie}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">抗毀／匿蹤：</span>
                    <span className="text-slate-300">{specs.survivabilityTag}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">後勤瓶頸：</span>
                    <span className="text-slate-400">{specs.logisticsFactor}</span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-2 text-[10px] text-sky-300/90 leading-snug">
              考據來源：{getUnitSourceRef(selectedUnit.def)}
            </div>

            <div className="mt-2 pt-2 border-t border-white/[0.08] text-[11px] text-slate-300 leading-relaxed">
              <span className="text-slate-400">當前任務：</span>
              {selectedUnit.currentMission}
            </div>

            <button
              type="button"
              onClick={() => onFocusUnit(selectedUnit)}
              className="mt-2.5 w-full py-1.5 text-[11px] font-medium text-sky-300 hover:text-white bg-sky-500/12 hover:bg-sky-500/22 border border-sky-400/25 rounded transition-colors cursor-pointer"
            >
              移動鏡頭檢視此單位
            </button>
          </section>
        )}

        {activeTab === 'strategy' && (
          <div>
            {/* STOCHASTIC VARIABLES FOR THIS SPECIFIC RUN */}
            <section className="px-4 py-3 border-b border-white/12 bg-white/[0.03]">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-amber-200">
                  本局隨機戰略變量（無預設結局）
                </h3>
                <span className="text-[10px] font-mono-tabular text-amber-300">
                  局 #{variables.seed}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {varBadges.map((vb) => (
                  <div
                    key={vb.label}
                    className="flex items-center justify-between px-2 py-1 bg-white/[0.03] border border-white/[0.06] rounded-xs text-[10px]"
                  >
                    <span className="text-slate-400">{vb.label}</span>
                    <span className="font-mono-tabular font-semibold text-slate-100">{vb.val}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                {verdict.summary}
              </p>
            </section>

            {/* DYNAMIC BIDIRECTIONAL TERRITORY CONTROL (ALL 16 ZONES INCL. MAINLAND CHINA) */}
            <section className="px-4 py-3 border-b border-white/12 bg-white/[0.015]">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  全印太與中國本土控制／佔領態勢
                </h3>
                <span className="text-[10px] text-slate-400 font-mono-tabular">
                  -100紅 ↔ +100藍
                </span>
              </div>

              <div className="mt-2.5 space-y-3">
                {TERRITORY_GROUP_LABELS.map((grp) => {
                  const groupZones = territories.filter((t) => t.def.regionGroup === grp.group);
                  return (
                    <div key={grp.group}>
                      <div className="text-[10px] font-semibold text-sky-300/90 mb-1">
                        {grp.title}
                      </div>
                      <div className="space-y-1">
                        {groupZones.map((tz) => {
                          const st = TERRITORY_STYLE[tz.controller];
                          return (
                            <div
                              key={tz.def.id}
                              className="flex items-center justify-between gap-2 py-1 border-b border-white/[0.05] last:border-b-0 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-[1px] shrink-0 ${st.swatchClass}`}
                                />
                                <span className="text-slate-200 truncate">{tz.def.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`font-medium ${st.textClass}`}>
                                  {tz.statusLabel}
                                </span>
                                <span className="font-mono-tabular text-[10px] text-slate-400 w-9 text-right">
                                  {tz.controlScore > 0 ? `+${tz.controlScore}` : tz.controlScore}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* DYNAMIC STRATEGIC LEVERS */}
            <section className="divide-y divide-white/[0.08] border-b border-white/12">
              {metricRows.map((m) => (
                <div key={m.label} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-slate-100">{m.label}</span>
                    <span className={`text-xs font-mono-tabular font-semibold ${m.valueClass}`}>
                      {m.value}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-white/[0.08] rounded-xs overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${m.barClass}`}
                      style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">{m.note}</p>
                </div>
              ))}
            </section>

            {/* PRC NATIONAL TOTALS REFERENCE TABLE */}
            <section className="px-4 py-3 bg-white/[0.02]">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  全中國總軍力基準（DoD / IISS）
                </h3>
                <span className="text-[10px] text-sky-300 font-mono-tabular">基準對照</span>
              </div>

              <div className="mt-2.5 divide-y divide-white/[0.07]">
                {PRC_NATIONAL_TOTALS.map((row) => (
                  <div key={row.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium text-slate-200">{row.domainLabel}</span>
                      <span className="font-mono-tabular font-semibold text-red-300">
                        {row.ratioLabel}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] font-mono-tabular">
                      <div className="text-slate-300">
                        <span className="text-red-400">中(全軍)</span> {row.prcNational}
                      </div>
                      <div className="text-slate-300 text-right">
                        <span className="text-blue-400">台</span> {row.rocTotal}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'forces' && (
          <div className="divide-y divide-white/12">
            {/* Explicit National Total + 5-Theater PLA Support Breakdown + South China Sea */}
            <section className="px-4 py-3 bg-white/[0.025]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold text-red-300">
                  紅方參戰空中 {plaAir.total} 架（含南沙）
                </span>
                <span className="text-[10px] font-mono-tabular text-sky-300">
                  現役 {plaAir.active} vs 台 {rocAir.active}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono-tabular text-slate-300">
                <div>澳紐參戰空軍：{factionStats.anzac.byDomain.air.total} 架</div>
                <div>東南亞/南海空軍：{factionStats.sea_asean.byDomain.air.total} 架</div>
                <div>美軍印太戰機群：{factionStats.us.byDomain.air.total} 架</div>
                <div>日本自衛隊空軍：{factionStats.jsdf.byDomain.air.total} 架</div>
              </div>
              <div className="mt-1.5 text-[10px] text-slate-400">
                來源：DoD CMPR 2024 / IISS 2024 / 澳洲國防白皮書 DSR · 共計 {units.length} 個實戰編制單位
              </div>
            </section>

            {FACTION_GROUPS.map((group) => (
              <section key={group.title}>
                <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
                  <div className="text-[11px] font-semibold text-slate-200">{group.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{group.subtitle}</div>
                </div>

                <div className="divide-y divide-white/[0.07]">
                  {group.factions.map((fid) => {
                    const meta = FACTION_META[fid];
                    const stat = factionStats[fid];
                    const isDeployed = stat.activeUnits > 0;
                    const isExpanded = expandedFaction === fid;
                    const factionUnits = units.filter((u) => u.def.faction === fid);

                    return (
                      <div key={fid} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-[1px] shrink-0 ${meta.bgSwatchClass}`}
                            />
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              {meta.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                            <span className="text-slate-400">{meta.roleTag}</span>
                            <span className="text-slate-600">/</span>
                            <span className="font-mono-tabular font-semibold text-slate-100">
                              {isDeployed ? `${stat.readinessPct}%` : '待命'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 h-1 w-full bg-white/[0.08] rounded-xs overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${meta.bgSwatchClass}`}
                            style={{ width: `${isDeployed ? stat.readinessPct : 0}%` }}
                          />
                        </div>

                        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[11px]">
                          {DOMAIN_ORDER.map((dom) => {
                            const d = stat.byDomain[dom];
                            return (
                              <div
                                key={dom}
                                className="px-1.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-xs"
                              >
                                <div className="text-[10px] text-slate-400">
                                  {DOMAIN_META[dom].short}
                                </div>
                                <div className="mt-0.5 font-mono-tabular text-slate-100 font-medium text-[11px]">
                                  {d.total > 0 ? `${d.active}/${d.total}` : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedFaction(isExpanded ? null : fid)}
                          className="mt-2 w-full flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 hover:text-sky-200 bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] rounded transition-colors cursor-pointer"
                        >
                          <span>檢視 {factionUnits.length} 個實戰兵種與參數</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                            {factionUnits.map((u) => {
                              const specs = getUnitSpecs(u.def);
                              const isSel = selectedUnit?.def.id === u.def.id;
                              return (
                                <button
                                  key={u.def.id}
                                  type="button"
                                  onClick={() => {
                                    if (u.active) {
                                      onSelectUnit(u.def.id);
                                      onFocusUnit(u);
                                    }
                                  }}
                                  className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                                    isSel
                                      ? 'bg-sky-500/18 border-sky-400/40'
                                      : u.active
                                        ? 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] cursor-pointer'
                                        : 'bg-white/[0.01] border-white/[0.03] opacity-55 cursor-default'
                                  }`}
                                >
                                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                    <span className="font-medium text-slate-100 truncate">
                                      {u.def.callsign} · {specs.branchLabel}
                                    </span>
                                    <span className="font-mono-tabular text-[10px] text-slate-300 shrink-0">
                                      {u.active
                                        ? `${u.effectiveCount}/${u.def.baseStrength}${u.def.unitLabel}`
                                        : '待命/停戰'}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                                    {specs.platforms} · {specs.weaponRangeKm}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {activeTab === 'layers' && (
          <div className="divide-y divide-white/10">
            <section className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-2.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>3D 視覺圖層篩選</span>
              </div>

              <div className="space-y-1.5">
                {LAYER_ITEMS.map((item) => {
                  const checked = layers[item.key];
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleLayer(item.key)}
                        className="w-3.5 h-3.5 accent-sky-400 rounded-xs cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-2.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>兵力數據考據與動態模型</span>
              </div>

              <div className="space-y-3">
                {SOURCE_CITATIONS.map((src) => (
                  <div key={src.title} className="text-[11px] leading-relaxed">
                    <div className="font-semibold text-sky-300">{src.title}</div>
                    <p className="mt-0.5 text-slate-400">{src.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
