import {
  ENGAGEMENT_ZONES,
  MISSILE_SALVOS,
  PHASES,
  TERRITORY_ZONES,
  TOTAL_SIM_HOURS,
  UNITS,
} from './scenarioData';
import type {
  BattleEventDefinition,
  CampaignVariables,
  CampaignVerdict,
  CompiledCampaign,
  FactionId,
  TerritoryControlState,
  TheaterSectorId,
  UnitDefinition,
} from './types';

export const SOLVER_STEP_HOURS = 3;
export const SOLVER_NUM_STEPS = Math.floor(TOTAL_SIM_HOURS / SOLVER_STEP_HOURS) + 1; // 721 steps (0..2160h)

// Fast deterministic PRNG (Mulberry32) so timeline scrubbing within a seed is 100% consistent,
// while every new seed yields a genuinely distinct campaign outcome.
function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function generateRandomVariables(seedInput?: number): CampaignVariables {
  const seed =
    typeof seedInput === 'number' && Number.isFinite(seedInput)
      ? Math.abs(Math.floor(seedInput)) % 999999 || 100001
      : Math.floor(100000 + Math.random() * 899999);

  const rng = createPrng(seed);

  return {
    seed,
    firstStrikeEffectiveness: Number(randRange(rng, 0.58, 1.42).toFixed(2)),
    weatherSeaState: Number(randRange(rng, 0.55, 1.38).toFixed(2)),
    usInterventionDelayHours: Math.round(randRange(rng, 54, 264)),
    usSurgeIntensity: Number(randRange(rng, 0.65, 1.4).toFixed(2)),
    anzacCommitment: Number(randRange(rng, 0.52, 1.42).toFixed(2)),
    aseanScsEscalation: Number(randRange(rng, 0.28, 1.45).toFixed(2)),
    indiaIntervention: Number(randRange(rng, 0.35, 1.45).toFixed(2)),
    euroFleetIntervention: Number(randRange(rng, 0.25, 1.45).toFixed(2)),
    koreaPinningFactor: Number(randRange(rng, 0.4, 1.45).toFixed(2)),
    plaStockpileDepth: Number(randRange(rng, 0.68, 1.38).toFixed(2)),
    rocDefenseResilience: Number(randRange(rng, 0.68, 1.38).toFixed(2)),
  };
}

function inferUnitSector(def: UnitDefinition): TheaterSectorId {
  if (def.theaterSector) return def.theaterSector;
  const id = def.id;
  if (
    id.includes('korea') ||
    id.includes('dprk') ||
    id.includes('rok_') ||
    id.includes('usfk') ||
    id.includes('yellow_sea') ||
    id.includes('ntc_fleet_pinned')
  ) {
    return 'yellow_sea';
  }
  if (
    id.includes('stc_') ||
    id.includes('dongsha') ||
    id.includes('luzon') ||
    id.includes('anzac') ||
    id.includes('sea_') ||
    id.includes('scs') ||
    id.includes('hainan') ||
    id.includes('ind_') ||
    id.includes('ukfr_') ||
    id.includes('ssgn')
  ) {
    return 'south_china_sea';
  }
  if (
    id.includes('jsdf') ||
    id.includes('csg') ||
    id.includes('cvw') ||
    id.includes('guam') ||
    id.includes('pacaf') ||
    id.includes('liaoning') ||
    id.includes('fujian') ||
    id.includes('zhejiang') ||
    id.includes('east') ||
    id.includes('hualien')
  ) {
    return 'east_pacific';
  }
  return 'strait_taiwan';
}

function isRedFaction(f: FactionId): boolean {
  return f === 'pla' || f === 'dprk';
}

function getZoneControllerFromScore(
  score: number,
  initial: Exclude<TerritoryControlState, 'contested'>,
  regionGroup: 'taiwan_outlying' | 'indo_pacific' | 'prc_mainland',
  sectorCoalitionLeader: Exclude<TerritoryControlState, 'contested' | 'pla'>
): { controller: TerritoryControlState; label: string } {
  if (initial === 'pla' || regionGroup === 'prc_mainland') {
    if (score <= -28) {
      return {
        controller: 'pla',
        label: regionGroup === 'prc_mainland' ? '解放軍防衛穩固' : '紅方島礁控制',
      };
    }
    if (score < 28) {
      return {
        controller: 'contested',
        label: regionGroup === 'prc_mainland' ? '本土沿海交戰／搶灘拉鋸' : '島礁爭奪激戰區',
      };
    }
    const occupier = sectorCoalitionLeader;
    const tag =
      occupier === 'roc'
        ? '國軍／聯軍登陸佔領'
        : occupier === 'anzac'
          ? '澳紐／聯軍佔領區'
          : occupier === 'sea_asean'
            ? '南海聯軍／美軍接管'
            : occupier === 'ind'
              ? '印度／多國聯軍進駐'
              : occupier === 'uk_fr'
                ? '英法／美澳聯軍接管'
                : occupier === 'jsdf'
                  ? '日美聯軍奪控區'
                  : '美軍遠征聯軍佔領';
    return { controller: occupier, label: tag };
  }

  // Allied / ROC / JSDF / SEA home territory
  if (score >= 28) {
    const labelMap: Record<string, string> = {
      roc: '國軍主權控管／收復',
      jsdf: '日美聯防穩固',
      sea_asean: '美菲聯防穩固',
      us: '盟軍防禦穩固',
      anzac: '澳紐聯軍固守',
      ind: '印度聯軍固守',
      uk_fr: '英法聯軍固守',
    };
    return { controller: initial, label: labelMap[initial] ?? '守方穩固' };
  }
  if (score > -28) {
    return { controller: 'contested', label: '搶灘／海空激烈拉鋸' };
  }
  return {
    controller: 'pla',
    label:
      regionGroup === 'taiwan_outlying'
        ? '紅方實質佔領區'
        : '紅方前出奪佔區',
  };
}

export function compileCampaign(variables: CampaignVariables): CompiledCampaign {
  const rng = createPrng(variables.seed ^ 0x9e3779b9);

  // Per-phase stochastic battle noise shocks so tactical breakthroughs/mishaps vary uniquely
  const phaseShockRed: number[] = Array.from({ length: 12 }, () => randRange(rng, 0.84, 1.18));
  const phaseShockBlue: number[] = Array.from({ length: 12 }, () => randRange(rng, 0.84, 1.18));

  const unitIntegritySeries: Record<string, Float32Array> = {};
  const unitPushSeries: Record<string, Float32Array> = {};
  const unitActiveWindows: Record<string, { from: number; until: number }> = {};

  const currentIntegrity: Record<string, number> = {};
  const unitSectors: Record<string, TheaterSectorId> = {};

  // Adjust dynamic arrival windows based on operational variables + historical transit distances
  const usDelayRatio = variables.usInterventionDelayHours / 150; // ~0.36 .. 1.76
  const anzacDelayFactor = clamp(1.35 - variables.anzacCommitment * 0.35, 0.65, 1.45);
  const aseanDelayFactor = clamp(1.4 - variables.aseanScsEscalation * 0.4, 0.6, 1.5);
  const indiaDelayFactor = clamp(1.38 - variables.indiaIntervention * 0.36, 0.72, 1.55);
  const euroDelayFactor = clamp(1.32 - variables.euroFleetIntervention * 0.28, 0.84, 1.52);

  for (const u of UNITS) {
    unitIntegritySeries[u.id] = new Float32Array(SOLVER_NUM_STEPS);
    unitPushSeries[u.id] = new Float32Array(SOLVER_NUM_STEPS);
    currentIntegrity[u.id] = 100;
    unitSectors[u.id] = inferUnitSector(u);

    let dynFrom = u.activeFrom;
    if (u.id === 'us_sea_csg_surge') {
      // Fleet Response Plan cross-ocean West Coast/Atlantic CSG surge: ~22-38 days
      dynFrom = clamp(u.activeFrom * clamp(1.26 - variables.usSurgeIntensity * 0.24, 0.78, 1.35), 520, 920);
    } else if (u.id === 'us_air_conus_surge') {
      dynFrom = clamp(u.activeFrom * usDelayRatio, 260, 540);
    } else if (u.id === 'us_ssgn_ohio_b21') {
      dynFrom = clamp(u.activeFrom * usDelayRatio, 180, 480);
    } else if (u.faction === 'us' && u.activeFrom > 30) {
      dynFrom = clamp(u.activeFrom * usDelayRatio, 36, 480);
    } else if (u.faction === 'anzac' && u.activeFrom > 24) {
      dynFrom = clamp(u.activeFrom * anzacDelayFactor, 24, 360);
    } else if (u.faction === 'sea_asean' && u.activeFrom > 36) {
      dynFrom = clamp(u.activeFrom * aseanDelayFactor, 24, 420);
    } else if (u.faction === 'ind') {
      // Andaman chokepoint/Su-30 D+10..D+23; INS Vikrant SCS entry D+32..D+60
      dynFrom = clamp(u.activeFrom * indiaDelayFactor, 240, 1480);
    } else if (u.faction === 'uk_fr') {
      // Historical 9,500-10,500 nm transit from Portsmouth/Toulon via Suez/Cape: late-stage D+42..D+72!
      dynFrom = clamp(u.activeFrom * euroDelayFactor, 1020, 1780);
    } else if (u.id === 'pla_roro_sealift') {
      dynFrom = clamp(u.activeFrom * clamp(1.32 - variables.firstStrikeEffectiveness * 0.28, 0.72, 1.45), 48, 132);
    } else if (u.id === 'pla_ntc_liaoning_csg' || u.id === 'pla_ntc_air_south') {
      // High Korea pinning delays Northern Theater southern detachment
      dynFrom = clamp(u.activeFrom * clamp(0.75 + variables.koreaPinningFactor * 0.45, 0.8, 1.6), 12, 220);
    }

    unitActiveWindows[u.id] = {
      from: dynFrom,
      until: u.activeUntil >= 600 ? TOTAL_SIM_HOURS : u.activeUntil,
    };
  }

  // Initialize territory scores (-100 = full Red, +100 = full Blue/Coalition)
  const territoryScoreSeries: Record<string, Float32Array> = {};
  const currentTerrScore: Record<string, number> = {};
  const territoryTimelines: CompiledCampaign['territoryTimelines'] = {};

  for (const z of TERRITORY_ZONES) {
    territoryScoreSeries[z.id] = new Float32Array(SOLVER_NUM_STEPS);
    const startScore =
      z.initialController === 'pla'
        ? z.id === 'terr_scs_spratlys'
          ? -68
          : -90
        : z.id === 'terr_kinmen' || z.id === 'terr_matsu'
          ? 56
          : z.id === 'terr_dongsha'
            ? 46
            : z.id === 'terr_luzon_north'
              ? 68
              : 88;
    currentTerrScore[z.id] = startScore;
    territoryScoreSeries[z.id][0] = startScore;
    territoryTimelines[z.id] = [
      {
        time: 0,
        controller: z.initialController,
        statusLabel: z.timeline[0]?.statusLabel ?? '開戰初態勢',
        detail: z.timeline[0]?.detail ?? '',
      },
    ];
  }

  const plaMissileStockSeries = new Float32Array(SOLVER_NUM_STEPS);
  const alliedMunitionStockSeries = new Float32Array(SOLVER_NUM_STEPS);
  const amphibiousLiftSeries = new Float32Array(SOLVER_NUM_STEPS);
  const scsPressureSeries = new Float32Array(SOLVER_NUM_STEPS);

  let plaMissileStock = 100 * variables.plaStockpileDepth;
  let alliedMunitionStock = 100;
  let malaccaSupplyDrag = 0;

  // Track previous state for dynamic milestone events
  const lastControllerByZone: Record<string, TerritoryControlState> = {};
  for (const z of TERRITORY_ZONES) {
    lastControllerByZone[z.id] = z.initialController;
  }

  const generatedEvents: BattleEventDefinition[] = [
    {
      id: `dyn_open_${variables.seed}`,
      time: 0.6,
      faction: 'pla',
      theaterTag: '印太全域開戰',
      domain: 'missile',
      title: `D+00 首波飽和突擊展開（首擊效能 ${Math.round(variables.firstStrikeEffectiveness * 100)}%／海象指數 ${Math.round(variables.weatherSeaState * 100)}%）`,
      detail: `火箭軍、PHL-191 遠火與電戰機率先突襲台灣與島鏈陣地；本局美軍反應延遲 ${variables.usInterventionDelayHours}h、澳紐動員度 ${Math.round(variables.anzacCommitment * 100)}%、東南亞南海升溫係數 ${Math.round(variables.aseanScsEscalation * 100)}%。`,
      location: { lon: 120.4, lat: 24.4, alt: 400 },
      severity: 'critical',
    },
  ];
  const firedMilestones = new Set<string>();

  const missileFirstActive: Record<string, number> = {};
  const missileLastActive: Record<string, number> = {};
  const missileInterceptSum: Record<string, { sum: number; count: number }> = {};

  for (const m of MISSILE_SALVOS) {
    missileFirstActive[m.id] = m.startHour;
    missileLastActive[m.id] = m.endHour;
    missileInterceptSum[m.id] = { sum: 0, count: 0 };
  }

  const sectors: TheaterSectorId[] = [
    'strait_taiwan',
    'east_pacific',
    'south_china_sea',
    'yellow_sea',
  ];

  const zonePushFactor: Record<string, number> = {};
  for (const z of TERRITORY_ZONES) {
    zonePushFactor[z.id] = 0;
  }

  // =========================================================================
  // MAIN 721-STEP DISCRETE-TIME LANCHESTER + LOGISTICS + TERRITORY SOLVER
  // =========================================================================
  for (let step = 0; step < SOLVER_NUM_STEPS; step++) {
    const h = step * SOLVER_STEP_HOURS;
    const shockIdx = Math.min(phaseShockRed.length - 1, Math.floor((h / TOTAL_SIM_HOURS) * phaseShockRed.length));
    const shockR = phaseShockRed[shockIdx];
    const shockB = phaseShockBlue[shockIdx];

    // 1) Aggregate domain power per sector & overall
    const sectorAirRed: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorAirBlue: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorSeaRed: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorSeaBlue: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorSamRed: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorSamBlue: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };

    // Tanker + AWACS readiness multipliers for long-range theater air projection
    const redTankerAwacsHealth = clamp(
      ((currentIntegrity['pla_etc_kj500'] ?? 80) * 0.45 +
        (currentIntegrity['pla_ctc_yy20_tanker'] ?? 80) * 0.35 +
        (currentIntegrity['pla_etc_naval_asw'] ?? 80) * 0.2) /
        100,
      0.35,
      1.0
    );
    const blueTankerAwacsHealth = clamp(
      ((currentIntegrity['us_air_tanker_awacs'] ?? 80) * 0.45 +
        (currentIntegrity['jsdf_air_e767'] ?? 80) * 0.2 +
        (currentIntegrity['anzac_raaf_e7_p8'] ?? 80) * 0.2 +
        (currentIntegrity['roc_air_ew_asw'] ?? 80) * 0.15) /
        100,
      0.35,
      1.0
    );

    const redSortieMult = lerp(0.76, 1.08, redTankerAwacsHealth);
    const blueSortieMult = lerp(0.7, 1.04, blueTankerAwacsHealth);
    const runwaySuppressionBlue =
      h < 120 ? clamp(1 - 0.3 * variables.firstStrikeEffectiveness * (plaMissileStock / 100), 0.52, 0.96) : 1.0;

    const FIFTH_GEN_IDS = new Set([
      'pla_etc_j20',
      'us_air_pacaf_fighters',
      'us_air_conus_surge',
      'us_air_cvw',
      'anzac_raaf_f35_tanker',
      'rok_air_f35_f15k',
    ]);
    const GEN45_IDS = new Set(['jsdf_air_sw', 'roc_air_f16v', 'pla_etc_j16']);

    const unitWeight = (u: UnitDefinition): number => {
      const integ = currentIntegrity[u.id] / 100;
      if (integ <= 0.04) return 0;
      let mult = 1.0;
      if (u.faction === 'us') mult = variables.usSurgeIntensity;
      if (u.faction === 'anzac') mult = variables.anzacCommitment;
      if (u.faction === 'sea_asean') {
        mult = u.id.includes('phl')
          ? 0.55 + 0.5 * variables.aseanScsEscalation
          : Math.pow(variables.aseanScsEscalation, 1.35) * 0.85;
      }
      if (u.faction === 'ind') mult = variables.indiaIntervention;
      if (u.faction === 'uk_fr') mult = variables.euroFleetIntervention;
      if (u.faction === 'roc') mult = variables.rocDefenseResilience;
      if (u.id === 'rok_air_f35_f15k') {
        // ROKAF stays largely pinned to the 38th Parallel unless DPRK pressure is low
        mult *= clamp(1.12 - variables.koreaPinningFactor * 0.62, 0.16, 0.72);
      }
      if (u.faction === 'pla' && u.unitClass === 'rocket_force') mult = clamp(plaMissileStock / 65, 0.12, 1.35);
      if (!isRedFaction(u.faction) && (u.unitClass === 'sam' || u.unitClass === 'bomber')) {
        mult *= clamp(0.68 + (alliedMunitionStock / 100) * 0.36, 0.68, 1.06);
      }

      // Apply tanker/AWACS sortie multiplier + first-strike runway cratering on forward tactical air
      if (u.domain === 'air' && u.unitClass === 'fighter') {
        if (isRedFaction(u.faction)) {
          if (u.id.includes('ctc') || u.id.includes('wtc') || u.id.includes('stc')) mult *= redSortieMult;
        } else {
          if (u.faction === 'us' || u.faction === 'anzac' || u.faction === 'jsdf') mult *= blueSortieMult;
          if (u.id === 'roc_air_idf_mirage' || u.id === 'jsdf_air_sw' || u.id === 'us_air_pacaf_fighters') {
            mult *= runwaySuppressionBlue;
          } else if (u.id === 'roc_air_f16v') {
            mult *= lerp(runwaySuppressionBlue, 1.0, 0.65); // Protected in Chiashan/Chihhang caves
          }
        }
      }

      // Normalize mixed-unit baseStrength so Kilo+trucks or P-8I+subs don't outweigh full CSGs
      let classBonus =
        u.unitClass === 'carrier'
          ? 4.2
          : u.unitClass === 'submarine'
            ? 3.8
            : u.unitClass === 'destroyer'
              ? 2.0
              : u.unitClass === 'coastal_missile'
                ? 2.15
                : u.unitClass === 'electronic_warfare'
                  ? 1.55
                  : u.unitClass === 'awacs' || u.unitClass === 'tanker_isr'
                    ? 0.62
                    : u.unitClass === 'bomber'
                      ? 1.65
                      : u.unitClass === 'helicopter'
                        ? 0.25
                        : u.unitClass === 'uav_swarm'
                          ? 0.34
                          : u.unitClass === 'airlift'
                            ? 0.18
                            : u.unitClass === 'fighter'
                              ? FIFTH_GEN_IDS.has(u.id)
                                ? 1.32
                                : GEN45_IDS.has(u.id)
                                  ? 1.12
                                  : 0.94
                              : 1.2;

      if (u.id === 'sea_vnm_subs_bastion') classBonus = 1.75;
      else if (u.id === 'ind_andaman_p8i_subs') classBonus = 2.05;
      else if (u.id === 'us_ssgn_ohio_b21') classBonus = 3.2;

      return u.baseStrength * integ * mult * classBonus;
    };

    let amphibRedCap = 0;
    let amphibRedTotal = 0;
    let blueCounterAmphibCap = 0;
    let scsAlliedNavalAir = 0;

    for (const u of UNITS) {
      unitIntegritySeries[u.id][step] = currentIntegrity[u.id];
      const win = unitActiveWindows[u.id];
      const active = h >= win.from && h <= win.until && currentIntegrity[u.id] > 3;
      const sec = unitSectors[u.id];
      const w = active ? unitWeight(u) : 0;

      if (u.unitClass === 'amphibious' && u.faction === 'pla') {
        const liftScale = u.id === 'pla_roro_sealift' ? 0.72 : 1.0;
        amphibRedTotal += u.baseStrength * liftScale;
        if (active) amphibRedCap += u.baseStrength * liftScale * (currentIntegrity[u.id] / 100);
      }
      if (
        (u.faction === 'us' ||
          u.faction === 'anzac' ||
          u.faction === 'jsdf' ||
          u.faction === 'roc' ||
          u.faction === 'ind' ||
          u.faction === 'uk_fr') &&
        (u.unitClass === 'amphibious' ||
          u.unitClass === 'airborne' ||
          u.unitClass === 'special_ops' ||
          u.unitClass === 'carrier') &&
        active
      ) {
        blueCounterAmphibCap +=
          u.baseStrength *
          (currentIntegrity[u.id] / 100) *
          (u.unitClass === 'amphibious' ? 2.1 : u.unitClass === 'carrier' ? 0.14 : 1.25);
      }

      if (!active) continue;

      if (u.id === 'ind_andaman_p8i_subs') {
        // Stationed at Andaman/Malacca West Gate: primarily squeezes China's Indian Ocean oil/supply lifeline
        scsAlliedNavalAir += w * 0.56;
        sectorSeaBlue.south_china_sea += w * 0.3;
        continue;
      }

      if (u.id === 'us_ssgn_ohio_b21') {
        // Hunts PLA's 3-carrier triangle across both Philippine Sea (EastPac) & northern SCS
        sectorSeaBlue.east_pacific += w * 0.45;
        sectorSeaBlue.south_china_sea += w * 0.55;
        scsAlliedNavalAir += w * 0.14;
        continue;
      }

      if (
        u.faction === 'anzac' ||
        u.faction === 'sea_asean' ||
        u.faction === 'ind' ||
        u.faction === 'uk_fr' ||
        (u.faction === 'us' && sec === 'south_china_sea')
      ) {
        scsAlliedNavalAir += w * 0.24;
      }

      if (isRedFaction(u.faction)) {
        if (u.domain === 'air') sectorAirRed[sec] += w;
        else if (u.domain === 'sea') {
          sectorSeaRed[sec] += w;
          // Embarked carrier air wing (J-15/J-35) also projects air superiority
          if (u.unitClass === 'carrier') sectorAirRed[sec] += w * 0.52;
        } else if (u.domain === 'missile') sectorSamRed[sec] += w;
      } else {
        if (u.domain === 'air') sectorAirBlue[sec] += w;
        else if (u.domain === 'sea') {
          sectorSeaBlue[sec] += w;
          // CSG-5/CSG-3 already have separate us_air_cvw; only add embarked air wing for Surge/Vikrant/UK-FR carriers
          if (u.unitClass === 'carrier' && u.id !== 'us_sea_csg5' && u.id !== 'us_sea_csg3') {
            sectorAirBlue[sec] += w * 0.46;
          }
        } else if (u.domain === 'missile') sectorSamBlue[sec] += w;
      }
    }

    // Cross-theater force projection (real-world war is connected across Bashi, East China Sea, and Yellow Sea)
    // 1) PLA Strait/Interior air & rocket power contests East China Sea / Ryukyu
    const eastPacRedAirProj = sectorAirRed.strait_taiwan * 0.44 + sectorSamRed.strait_taiwan * 0.3;
    const eastPacRedSeaProj = sectorSeaRed.strait_taiwan * 0.36;

    // 2) US/JSDF in EastPac project air/stealth/missile/sub power into Strait once deployed (subject to tanker distance)
    const eastPacStability = clamp(
      (sectorAirBlue.east_pacific + sectorSeaBlue.east_pacific) /
        Math.max(120, sectorAirRed.east_pacific + eastPacRedAirProj + sectorSeaRed.east_pacific + eastPacRedSeaProj),
      0.22,
      1.45
    );
    const straitBlueAirProj = sectorAirBlue.east_pacific * 0.36 * clamp(eastPacStability, 0.22, 1.15);
    const straitBlueSeaProj = sectorSeaBlue.east_pacific * 0.34 * clamp(eastPacStability, 0.22, 1.15);

    // 3) SCS Coalition (ANZAC + Luzon + US SCS) projects power north via Bashi when SCS isn't overwhelmed
    const scsStability = clamp(
      (sectorAirBlue.south_china_sea + sectorSeaBlue.south_china_sea) /
        Math.max(100, sectorAirRed.south_china_sea + sectorSeaRed.south_china_sea),
      0.2,
      1.5
    );
    const straitBlueFromScsAir = sectorAirBlue.south_china_sea * 0.26 * clamp(scsStability - 0.35, 0, 1.0);
    const straitBlueFromScsSea = sectorSeaBlue.south_china_sea * 0.26 * clamp(scsStability - 0.35, 0, 1.0);

    // 4) PLA Southern Theater + interior PLAAF reinforcements contest SCS heavily in Phases 1-3 until late blockade bites
    const stcScsDraw = clamp(0.45 + variables.aseanScsEscalation * 0.2 + variables.anzacCommitment * 0.15, 0.38, 0.86);
    const straitRedFromScsAir = sectorAirRed.south_china_sea * (1 - stcScsDraw) * 0.36;
    const straitRedFromScsSea = sectorSeaRed.south_china_sea * (1 - stcScsDraw) * 0.28;

    // 5) Korea pinning drains PLA Northern Theater reinforcements; if low pinning, NTC sends spillover to Strait/EastPac
    const ntcOverflow = clamp((1.15 - variables.koreaPinningFactor) * 0.36, 0.04, 0.44);
    const korUsfkOverflow = clamp((variables.usSurgeIntensity - variables.koreaPinningFactor * 0.55) * 0.22, 0, 0.3);
    const yellowSeaSpillover = clamp((1.15 - variables.koreaPinningFactor * 0.42) * 0.19 * variables.usSurgeIntensity, 0.08, 0.25);

    const effAirRed: Record<TheaterSectorId, number> = {
      strait_taiwan:
        sectorAirRed.strait_taiwan +
        sectorAirRed.yellow_sea * ntcOverflow * 0.7 +
        straitRedFromScsAir,
      east_pacific:
        sectorAirRed.east_pacific +
        eastPacRedAirProj +
        sectorAirRed.yellow_sea * ntcOverflow * 0.5,
      south_china_sea: sectorAirRed.south_china_sea * (1.33 + stcScsDraw * 0.34),
      yellow_sea: sectorAirRed.yellow_sea * (1 - ntcOverflow * 0.34),
    };
    const effAirBlue: Record<TheaterSectorId, number> = {
      strait_taiwan: sectorAirBlue.strait_taiwan + straitBlueAirProj + straitBlueFromScsAir,
      east_pacific: sectorAirBlue.east_pacific + sectorAirBlue.yellow_sea * korUsfkOverflow,
      south_china_sea: sectorAirBlue.south_china_sea + sectorAirBlue.east_pacific * 0.11,
      yellow_sea: sectorAirBlue.yellow_sea + sectorAirBlue.east_pacific * yellowSeaSpillover,
    };
    const effSeaRed: Record<TheaterSectorId, number> = {
      strait_taiwan: sectorSeaRed.strait_taiwan + straitRedFromScsSea + sectorSeaRed.yellow_sea * ntcOverflow * 0.5,
      east_pacific: sectorSeaRed.east_pacific + eastPacRedSeaProj + sectorSeaRed.yellow_sea * ntcOverflow * 0.55,
      south_china_sea: sectorSeaRed.south_china_sea * 1.44,
      yellow_sea: sectorSeaRed.yellow_sea * 1.04,
    };
    const effSeaBlue: Record<TheaterSectorId, number> = {
      strait_taiwan: sectorSeaBlue.strait_taiwan + straitBlueSeaProj + straitBlueFromScsSea,
      east_pacific: sectorSeaBlue.east_pacific + sectorSeaBlue.yellow_sea * korUsfkOverflow,
      south_china_sea: sectorSeaBlue.south_china_sea + sectorSeaBlue.east_pacific * 0.11,
      yellow_sea: sectorSeaBlue.yellow_sea + sectorSeaBlue.east_pacific * (yellowSeaSpillover * 0.92),
    };

    // Cross-sector spillover from Interior / SCS reserves
    const scsInterdictionFactor = clamp(scsAlliedNavalAir / 260, 0, 1.4);
    scsPressureSeries[step] = Math.round(clamp(scsInterdictionFactor * 78, 0, 100));

    // Malacca + SCS blockade squeezes PLA logistics after Week 2 (300h+)
    if (h > 300) {
      const blockadeRate =
        (0.05 * variables.aseanScsEscalation + 0.04 * variables.anzacCommitment) *
        clamp(scsInterdictionFactor, 0.25, 1.45);
      malaccaSupplyDrag = clamp(malaccaSupplyDrag + blockadeRate * (SOLVER_STEP_HOURS / 24), 0, 0.48);
    }

    const amphibPct = amphibRedTotal > 0 ? clamp((amphibRedCap / amphibRedTotal) * 100, 0, 100) : 0;
    amphibiousLiftSeries[step] = Math.round(amphibPct);

    const stockNormalized = clamp((plaMissileStock / (100 * variables.plaStockpileDepth)) * 100, 0, 100);
    plaMissileStockSeries[step] = Math.round(stockNormalized);
    alliedMunitionStockSeries[step] = Math.round(clamp(alliedMunitionStock, 0, 100));

    if (step === SOLVER_NUM_STEPS - 1) break;

    // 2) Compute sector superiority (-1 Red .. +1 Blue)
    const sectorAirBalance: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };
    const sectorSeaBalance: Record<TheaterSectorId, number> = {
      strait_taiwan: 0,
      east_pacific: 0,
      south_china_sea: 0,
      yellow_sea: 0,
    };

    for (const sec of sectors) {
      const aR = effAirRed[sec] * (1 - malaccaSupplyDrag * 0.45) + sectorSamRed[sec] * 0.45;
      const aB = effAirBlue[sec] + sectorSamBlue[sec] * 0.55;
      sectorAirBalance[sec] = (aB - aR) / Math.max(40, aB + aR);

      const sR = effSeaRed[sec] * (1 - malaccaSupplyDrag * 0.35);
      const sB = effSeaBlue[sec] + sectorSamBlue[sec] * 0.22;
      sectorSeaBalance[sec] = (sB - sR) / Math.max(30, sB + sR);
    }

    // 3) Advance PLA & Allied precision munition/SAM stockpiles
    const activeMissileBurn = h < 96 ? 0.56 : h < 450 ? 0.24 : h < 1000 ? 0.11 : 0.04;
    plaMissileStock = Math.max(4, plaMissileStock - activeMissileBurn * SOLVER_STEP_HOURS * (0.85 + 0.3 * shockR));

    const alliedBurn = h < 120 ? 0.28 : h < 540 ? 0.16 : 0.07;
    const alliedResupply = h > 600 ? 0.095 * variables.usSurgeIntensity : 0;
    alliedMunitionStock = clamp(
      alliedMunitionStock - (alliedBurn - alliedResupply) * SOLVER_STEP_HOURS * (0.88 + 0.24 * shockB),
      18,
      100
    );

    // 4) Step each Unit's integrity using Lanchester pressure in its sector
    for (const u of UNITS) {
      const win = unitActiveWindows[u.id];
      if (h < win.from || h > win.until) continue;

      const sec = unitSectors[u.id];
      const redTeam = isRedFaction(u.faction);
      const opposingAir = redTeam ? effAirBlue[sec] : effAirRed[sec];
      const opposingSea = redTeam ? effSeaBlue[sec] : effSeaRed[sec];
      const opposingMissile = redTeam
        ? sectorSamBlue[sec]
        : sectorSamRed[sec] + (h < 120 ? plaMissileStock * 3.6 * variables.firstStrikeEffectiveness : 0);

      let attritionPerHour = 0;

      if (u.domain === 'air') {
        const pressure = opposingAir * 0.00012 + opposingMissile * 0.0001;
        const tunnelShelter =
          u.id === 'roc_air_f16v' && h < 120
            ? 0.32
            : u.unitClass === 'awacs' || u.unitClass === 'tanker_isr'
              ? 0.42
              : 1.0;
        const firstStrikeMult = !redTeam && h < 72 ? variables.firstStrikeEffectiveness * 1.45 : 1.0;
        attritionPerHour = pressure * tunnelShelter * firstStrikeMult;
      } else if (u.domain === 'sea') {
        const subStealth = u.unitClass === 'submarine' ? 0.45 : 1.0;
        const amphibExposure =
          u.id === 'pla_roro_sealift'
            ? 2.05
            : u.unitClass === 'amphibious' || u.unitClass === 'mine_warfare'
              ? 1.75
              : 1.0;
        const weatherDrag = u.unitClass === 'amphibious' ? 1.35 - variables.weatherSeaState * 0.35 : 1.0;
        attritionPerHour =
          (opposingSea * 0.00017 + opposingAir * 0.0001 + opposingMissile * 0.000085) *
          subStealth *
          amphibExposure *
          weatherDrag;
      } else if (u.domain === 'missile') {
        if (redTeam && u.unitClass === 'rocket_force') {
          attritionPerHour =
            (activeMissileBurn / Math.max(40, 100 * variables.plaStockpileDepth)) * 22 + opposingAir * 0.000045;
        } else {
          attritionPerHour =
            (opposingAir * 0.00009 + opposingMissile * 0.00009) * (u.unitClass === 'coastal_missile' ? 0.58 : 0.85);
        }
      } else {
        const isCrossingStrait =
          u.id === 'pla_etc_army_beach' || u.id === 'pla_ctc_airborne_15' || u.id === 'pla_stc_marines_land';
        if (isCrossingStrait) {
          const liftPenalty = amphibPct < 35 ? 1.8 : 1.0;
          attritionPerHour = (opposingAir * 0.00013 + opposingSea * 0.00008 + 0.025) * liftPenalty;
        } else {
          const garrisonArmor = u.id.includes('dprk') || u.id.includes('rok_') ? 0.14 : 0.62;
          attritionPerHour = (opposingAir * 0.000075 + opposingMissile * 0.000075 + opposingSea * 0.00004) * garrisonArmor;
        }
      }

      const shock = redTeam ? shockB : shockR;
      const blockadePenalty = redTeam && h > 420 ? 1 + malaccaSupplyDrag * 0.65 : 1.0;
      const delta = attritionPerHour * shock * blockadePenalty * SOLVER_STEP_HOURS * 0.62;

      const recoveryPerHour =
        u.faction === 'pla' && (u.id.includes('_def') || u.id.includes('interior'))
          ? 0.011 * (1 - malaccaSupplyDrag)
          : u.faction === 'us' || u.faction === 'anzac'
            ? 0.012
            : 0;

      const minFloor = u.id.includes('dprk') || u.id.includes('rok_') ? 82 : 6;
      currentIntegrity[u.id] = clamp(
        currentIntegrity[u.id] - delta + recoveryPerHour * SOLVER_STEP_HOURS,
        minFloor,
        100
      );

      if (u.linkedZoneId) {
        const score = currentTerrScore[u.linkedZoneId] ?? 0;
        const push = redTeam ? clamp((-score + 20) / 110, 0, 1) : clamp((score + 20) / 110, 0, 1);
        unitPushSeries[u.id][step] = push;
      }
    }

    // Lookup defender unit integrity for coastal/garrison resistance
    const garrisonIntegrity = (zoneId: string): number => {
      const match = UNITS.find((u) => u.linkedZoneId === zoneId && u.domain === 'land');
      return match ? currentIntegrity[match.id] / 100 : 0.7;
    };

    // 5) Step all 16 Territory Zones (bidirectional, zero predetermined winner — including Chinese Mainland!)
    for (const z of TERRITORY_ZONES) {
      const sec = z.theaterSector;
      const airBal =
        z.id === 'terr_dongsha'
          ? sectorAirBalance.strait_taiwan * 0.62 + sectorAirBalance.south_china_sea * 0.38
          : sectorAirBalance[sec];
      const seaBal =
        z.id === 'terr_dongsha'
          ? sectorSeaBalance.strait_taiwan * 0.62 + sectorSeaBalance.south_china_sea * 0.38
          : sectorSeaBalance[sec];
      const combinedDom = airBal * 0.52 + seaBal * 0.48;

      const redCrossLift =
        z.regionGroup === 'prc_mainland'
          ? 1.2
          : z.id === 'terr_kinmen' || z.id === 'terr_matsu'
            ? clamp((amphibPct / 100) * 1.32 * variables.weatherSeaState, 0.25, 1.3)
            : clamp((amphibPct / 100) * variables.weatherSeaState * 1.12, 0.12, 1.25);

      const blueCounterLift =
        z.regionGroup === 'prc_mainland'
          ? clamp((blueCounterAmphibCap / 70) * (combinedDom > 0.16 ? 1.15 : 0.2), 0.06, 1.3)
          : clamp((blueCounterAmphibCap / 62) * 1.1, 0.24, 1.34);

      let drift = 0;

      // Opening D+00-D+06 missile bombardment & SCS raid gives Red initial pressure on Taiwan/Outlying/Dongsha/Luzon
      if (h < 132 && z.regionGroup !== 'prc_mainland') {
        const dongshaRaid = z.id === 'terr_dongsha' ? 2.1 : 1.0;
        drift -= 0.15 * dongshaRaid * variables.firstStrikeEffectiveness * shockR;
      }

      const defInteg = garrisonIntegrity(z.id);

      if (combinedDom < 0) {
        // Red controls air/sea in this sector -> pushes zone toward Red (-100)
        const redAdv = Math.abs(combinedDom);
        const rocHoldDamp =
          z.regionGroup === 'taiwan_outlying' ? 1.26 - variables.rocDefenseResilience * 0.42 : 1.0;
        drift -= redAdv * redCrossLift * rocHoldDamp * 0.42 * shockR;
      } else {
        // Blue/Coalition controls air/sea in this sector -> pushes zone toward Blue (+100)
        const blueAdv = combinedDom;
        const mainlandOpenness =
          z.regionGroup === 'prc_mainland'
            ? h > 480 && blueAdv > 0.21
              ? lerp(0.55, 1.15, clamp((blueAdv - 0.21) * 2.5, 0, 1)) * lerp(0.82, 1.25, 1 - defInteg)
              : 0.08
            : 1.0;
        drift += blueAdv * blueCounterLift * mainlandOpenness * 0.41 * shockB;
      }

      const isPushingInitialOwner =
        (z.initialController === 'pla' && drift > 0) ||
        (z.initialController !== 'pla' && drift < 0);
      const effectiveDrift = (drift / (isPushingInitialOwner ? z.defenseHardness : 0.85)) * SOLVER_STEP_HOURS;

      const nextScore = clamp(currentTerrScore[z.id] + effectiveDrift, -100, 100);
      currentTerrScore[z.id] = nextScore;
      territoryScoreSeries[z.id][step + 1] = nextScore;
      zonePushFactor[z.id] = clamp(Math.abs(nextScore) / 100, 0, 1);

      const sectorLeader: Exclude<TerritoryControlState, 'contested' | 'pla'> =
        z.id === 'terr_prc_fujian' || z.id === 'terr_kinmen' || z.id === 'terr_matsu' || z.id === 'terr_dongsha'
          ? 'roc'
          : z.id === 'terr_prc_zhejiang' || z.id === 'terr_sakishima' || z.id === 'terr_okinawa_main'
            ? 'jsdf'
            : z.id === 'terr_prc_guangdong_hainan' || z.id === 'terr_scs_spratlys'
              ? variables.euroFleetIntervention >= 0.96 &&
                variables.euroFleetIntervention >= variables.indiaIntervention &&
                h >= (unitActiveWindows['ukfr_mn_cdg_csg']?.from ?? 1176)
                ? 'uk_fr'
                : variables.indiaIntervention >= Math.max(variables.anzacCommitment, variables.aseanScsEscalation) &&
                    h >= (unitActiveWindows['ind_ins_vikrant_csg']?.from ?? 960)
                  ? 'ind'
                  : variables.anzacCommitment >= variables.aseanScsEscalation
                    ? 'anzac'
                    : 'sea_asean'
              : 'us';

      const evalState = getZoneControllerFromScore(
        nextScore,
        z.initialController,
        z.regionGroup,
        sectorLeader
      );

      if (evalState.controller !== lastControllerByZone[z.id]) {
        const prev = lastControllerByZone[z.id];
        lastControllerByZone[z.id] = evalState.controller;

        const detailText =
          evalState.controller === 'pla'
            ? `${z.name}在海空火力與渡海部隊推進下轉入解放軍實質佔領態勢。`
            : evalState.controller === 'contested'
              ? `${z.name}爆發高烈度海空與地面交火，控制權進入雙邊拉鋸（前態：${prev.toUpperCase()}）。`
              : z.regionGroup === 'prc_mainland'
                ? `印太聯軍突破東南／華南沿海防空傘，於${z.name}建立反登陸控制區！`
                : `聯軍／守軍成功穩住海空走廊，奪回並鞏固${z.name}主權防務。`;

        territoryTimelines[z.id].push({
          time: h + SOLVER_STEP_HOURS,
          controller: evalState.controller,
          statusLabel: evalState.label,
          detail: detailText,
        });

        const evKey = `zone_${z.id}_${evalState.controller}`;
        if (!firedMilestones.has(evKey) && generatedEvents.length < 40) {
          firedMilestones.add(evKey);
          const evFaction: FactionId =
            evalState.controller === 'contested'
              ? z.initialController === 'pla'
                ? 'us'
                : 'pla'
              : evalState.controller;
          generatedEvents.push({
            id: evKey,
            time: h + SOLVER_STEP_HOURS,
            faction: evFaction,
            theaterTag: z.regionTag,
            domain: 'land',
            title: `${z.name}態勢轉換：${evalState.label}`,
            detail: detailText,
            location: z.center,
            severity:
              z.regionGroup === 'prc_mainland' ||
              z.id === 'terr_taiwan_north' ||
              z.id === 'terr_okinawa_main'
                ? 'critical'
                : 'major',
          });
        }
      }
    }

    // Emit dynamic operational milestones (non-territory)
    if (!firedMilestones.has('pla_fujian_cv18') && h >= 96) {
      firedMilestones.add('pla_fujian_cv18');
      generatedEvents.push({
        id: 'dyn_pla_fujian_cv18',
        time: h,
        faction: 'pla',
        theaterTag: '解放軍三航母集結',
        domain: 'sea',
        title: '解放軍第三航母「福建號 (CV-18)」突破島鏈，與遼寧・山東組成三航母遠海聯動',
        detail: '配備電磁彈射殲-35 與空警-600 的福建艦編隊前推菲律賓海，結合 055 鷹擊-21 擴張反介入縱深。',
        location: { lon: 124.8, lat: 25.4, alt: 300 },
        severity: 'critical',
      });
    }
    if (!firedMilestones.has('us_arrive') && h >= variables.usInterventionDelayHours) {
      firedMilestones.add('us_arrive');
      generatedEvents.push({
        id: 'dyn_us_arrive',
        time: h,
        faction: 'us',
        theaterTag: '美軍印太增援',
        domain: 'sea',
        title: `美軍核潛艦與航母打擊群於第 ${Math.floor(h / 24)} 日正式介入西太戰線`,
        detail: `美軍投入強度指數 ${Math.round(variables.usSurgeIntensity * 100)}%，結合關島 B-1B LRASM 與日本九州／呂宋前進基地展開反擊。`,
        location: { lon: 126.5, lat: 22.8, alt: 300 },
        severity: 'critical',
      });
    }
    if (!firedMilestones.has('us_surge_csg') && h >= (unitActiveWindows['us_sea_csg_surge']?.from ?? 672)) {
      firedMilestones.add('us_surge_csg');
      generatedEvents.push({
        id: 'dyn_us_surge_csg',
        time: h,
        faction: 'us',
        theaterTag: '美軍跨洋雙航母增援',
        domain: 'sea',
        title: `美軍依艦隊反應計畫 (FRP) 加派第三梯次雙航母群抵西太反制中國三航母`,
        detail: 'CSG-1/CSG-9 滿編進場與第 5／第 3 航母群輪戰換班，結合俄亥俄 SSGN 飽和反艦火力逼退紅方外線艦隊。',
        location: { lon: 128.4, lat: 21.8, alt: 300 },
        severity: 'critical',
      });
    }
    if (!firedMilestones.has('ind_andaman') && h >= (unitActiveWindows['ind_andaman_p8i_subs']?.from ?? 360)) {
      firedMilestones.add('ind_andaman');
      generatedEvents.push({
        id: 'dyn_ind_andaman',
        time: h,
        faction: 'ind',
        theaterTag: '印度安達曼—麻六甲',
        domain: 'sea',
        title: `印度安達曼司令部 P-8I 與潛艦封鎖麻六甲西口（介入係數 ${Math.round(variables.indiaIntervention * 100)}%）`,
        detail: '複製 2020 加勒萬與紅海護航模式，鎖定中東輸往南海之戰略油輪與水下通道，與新加坡形成東西夾鎖。',
        location: { lon: 96.8, lat: 7.2, alt: 280 },
        severity: 'major',
      });
    }
    if (!firedMilestones.has('ind_vikrant') && h >= (unitActiveWindows['ind_ins_vikrant_csg']?.from ?? 960)) {
      firedMilestones.add('ind_vikrant');
      generatedEvents.push({
        id: 'dyn_ind_vikrant',
        time: h,
        faction: 'ind',
        theaterTag: '印度航母東進南海',
        domain: 'sea',
        title: `印度「維克蘭特號 (INS Vikrant)」航母群於第 ${Math.floor(h / 24)} 日跨越麻六甲進駐南海`,
        detail: '搭載 MiG-29K 與艦載 BrahMos 飛彈增援南翼，協助澳紐與東協封鎖南海南部。',
        location: { lon: 109.5, lat: 6.8, alt: 280 },
        severity: 'major',
      });
    }
    if (!firedMilestones.has('ukfr_late_scs') && h >= (unitActiveWindows['ukfr_mn_cdg_csg']?.from ?? 1176)) {
      firedMilestones.add('ukfr_late_scs');
      generatedEvents.push({
        id: 'dyn_ukfr_late_scs',
        time: h,
        faction: 'uk_fr',
        theaterTag: '英法末期遠征雙航母',
        domain: 'sea',
        title: `戰局末期（D+${Math.floor(h / 24)}）：法「戴高樂號」與英「威爾斯親王號」雙航母群抵達南海`,
        detail: `依歷史遠征航程推估（介入強度 ${Math.round(variables.euroFleetIntervention * 100)}%），歐洲艦隊帶著滿編 F-35B／飆風-M 與核潛艦切入耗竭後期的南海戰區！`,
        location: { lon: 111.2, lat: 9.6, alt: 300 },
        severity: 'critical',
      });
    }
    if (!firedMilestones.has('anzac_scs') && h >= 144 * anzacDelayFactor) {
      firedMilestones.add('anzac_scs');
      generatedEvents.push({
        id: 'dyn_anzac_scs',
        time: h,
        faction: 'anzac',
        theaterTag: '澳紐／南海走廊',
        domain: 'air',
        title: `澳洲 F-35A、科林斯潛艦與紐西蘭艦隊切入南海並對接馬六甲封鎖`,
        detail: `澳紐聯軍投送強度 ${Math.round(variables.anzacCommitment * 100)}%，與新加坡馬六甲巡邏網及呂宋基地連動壓迫南海後勤線。`,
        location: { lon: 116.5, lat: 11.8, alt: 400 },
        severity: 'major',
      });
    }
    if (!firedMilestones.has('malacca_pinch') && malaccaSupplyDrag >= 0.18) {
      firedMilestones.add('malacca_pinch');
      generatedEvents.push({
        id: 'dyn_malacca_pinch',
        time: h,
        faction: 'sea_asean',
        theaterTag: '馬六甲—南海咽喉',
        domain: 'sea',
        title: '馬六甲與安達曼封鎖效應顯現：長程戰爭油彈補給拖累指數攀升',
        detail: `東南亞與印度海軍聯手封控印度洋至南海能源航道，解放軍遠海編隊持續作戰回復能力下降 ${Math.round(malaccaSupplyDrag * 100)}%。`,
        location: { lon: 105.6, lat: 2.8, alt: 250 },
        severity: 'critical',
      });
    }
    if (!firedMilestones.has('missile_low') && stockNormalized <= 24) {
      firedMilestones.add('missile_low');
      generatedEvents.push({
        id: 'dyn_missile_low',
        time: h,
        faction: 'pla',
        theaterTag: '火箭軍庫存警戒',
        domain: 'missile',
        title: '解放軍遠程精準彈道與巡弋飛彈庫存跌破 25%',
        detail: '跨台海、沖繩與呂宋多戰區高強度齊射導致火箭軍庫存緊縮，外線壓制力開始下降。',
        location: { lon: 117.75, lat: 25.9, alt: 400 },
        severity: 'major',
      });
    }
    if (!firedMilestones.has('amphib_collapse') && amphibPct <= 30 && h >= 120) {
      firedMilestones.add('amphib_collapse');
      generatedEvents.push({
        id: 'dyn_amphib_collapse',
        time: h,
        faction: 'roc',
        theaterTag: '跨海補給瓶頸',
        domain: 'sea',
        title: '紅方跨海兩棲運力跌破 30%，登陸部隊補運面臨斷裂危機',
        detail: '在機動反艦飛彈、水雷陣與美澳台潛艦聯合獵殺下，兩棲船團與滾裝船損失慘重。',
        location: { lon: 120.1, lat: 24.4, alt: 250 },
        severity: 'critical',
      });
    }
  }

  // Finalize engagement zone active windows and dynamic missile windows
  const engagementWindows: Record<string, { startHour: number; endHour: number }> = {};
  for (const ez of ENGAGEMENT_ZONES) {
    engagementWindows[ez.id] = {
      startHour: ez.startHour,
      endHour: ez.endHour >= 480 ? TOTAL_SIM_HOURS : ez.endHour,
    };
  }

  const missileStateByStep: CompiledCampaign['missileStateByStep'] = {};
  for (const m of MISSILE_SALVOS) {
    let activeUntil = m.endHour >= 480 ? TOTAL_SIM_HOURS : m.endHour;
    if (m.faction === 'pla' && (m.weaponType === 'ballistic' || m.weaponType === 'hypersonic' || m.weaponType === 'asbm')) {
      for (let s = 0; s < SOLVER_NUM_STEPS; s++) {
        if (plaMissileStockSeries[s] < 14 && s * SOLVER_STEP_HOURS >= m.startHour + 72) {
          activeUntil = Math.min(activeUntil, s * SOLVER_STEP_HOURS);
          break;
        }
      }
    }
    missileStateByStep[m.id] = {
      activeFrom: m.startHour,
      activeUntil,
      interceptRate: m.intercept ? m.intercept.interceptFraction : 0,
    };
  }

  // Compute Day 90 Campaign Verdict purely from final territory scores
  let taiwanHeldZones = 0;
  let taiwanOccupiedZones = 0;
  let mainlandBreachedZones = 0;
  let mainlandOccupiedZones = 0;

  for (const z of TERRITORY_ZONES) {
    const finalTimeline = territoryTimelines[z.id];
    const finalState = finalTimeline[finalTimeline.length - 1]?.controller ?? z.initialController;
    if (z.regionGroup === 'taiwan_outlying') {
      if (finalState === 'roc') taiwanHeldZones += 1;
      else if (finalState === 'pla') taiwanOccupiedZones += 1;
    } else if (z.regionGroup === 'prc_mainland') {
      if (finalState !== 'pla') {
        mainlandBreachedZones += 1;
        if (finalState !== 'contested') mainlandOccupiedZones += 1;
      }
    }
  }

  let outcomeType: CampaignVerdict['outcomeType'] = 'contested_stalemate';
  let headline = '九十日極限消耗戰：多區拉鋸分治與跨區對峙定型';
  let summary =
    '歷經三個月全印太消耗後，雙方均承受極高海空戰損，台灣本島、離島、南海或沿海樞紐進入高代價拉鋸分治態勢。';

  if (taiwanHeldZones >= 5 && (mainlandOccupiedZones >= 1 || mainlandBreachedZones >= 2)) {
    outcomeType = 'allied_counteroffensive';
    headline = `印太聯軍海空翻盤：台灣防衛穩固，且反推進入 ${mainlandBreachedZones} 處中國本土沿海區`;
    summary = `美日澳紐與東南亞聯軍擊穿紅方跨海運力與南海補給線，台澎保有 ${taiwanHeldZones}/8 戰區，並於中國沿海建立 ${mainlandOccupiedZones} 處實質控制區／${mainlandBreachedZones} 處交戰橋頭堡。`;
  } else if (taiwanOccupiedZones >= 4 && mainlandOccupiedZones === 0) {
    outcomeType = 'red_advantage';
    headline = `解放軍取得實質佔領優勢：奪控 ${taiwanOccupiedZones}/8 台澎離島防區`;
    summary = `在首擊高毀傷與外援延遲變數推演下，紅方維持足夠兩棲運力跨海增援，進佔 ${taiwanOccupiedZones} 處台澎外島區域；聯軍轉入外線長期圍堵。`;
  } else if (taiwanHeldZones >= 5 && taiwanOccupiedZones <= 2) {
    outcomeType = 'allied_counteroffensive';
    headline = `台灣不對稱防衛與印太援軍成功：穩守 ${taiwanHeldZones}/8 台澎戰區`;
    summary = `台灣依託洞庫與機動火力撐過前期消耗，配合美日澳紐南海包抄切斷跨海補給線，成功維持本島與核心離島控制權。`;
  } else if (taiwanOccupiedZones >= 4 && mainlandBreachedZones >= 1) {
    outcomeType = 'contested_stalemate';
    headline = `全印太高烈度交換戰：台澎 ${taiwanOccupiedZones} 區失守與中國沿海 ${mainlandBreachedZones} 區遭反推並存`;
    summary = `雙方在不同戰區各自突破防線——紅方跨海控制部份台澎區域，同時聯軍也在東南亞與東海方向反推中國沿海據點，戰局進入長期分治消耗。`;
  }

  const verdict: CampaignVerdict = {
    headline,
    outcomeType,
    taiwanHeldZones,
    taiwanOccupiedZones,
    mainlandBreachedZones,
    mainlandOccupiedZones,
    summary,
  };

  return {
    variables,
    stepHours: SOLVER_STEP_HOURS,
    numSteps: SOLVER_NUM_STEPS,
    unitIntegritySeries,
    unitActiveWindows,
    unitPushSeries,
    territoryScoreSeries,
    territoryTimelines,
    engagementWindows,
    missileStateByStep,
    plaMissileStockSeries,
    alliedMunitionStockSeries,
    amphibiousLiftSeries,
    scsPressureSeries,
    events: generatedEvents.sort((a, b) => a.time - b.time),
    verdict,
  };
}
