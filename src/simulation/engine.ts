import { SOLVER_NUM_STEPS, SOLVER_STEP_HOURS } from './campaignSolver';
import {
  DIRECTOR_SHOTS,
  ENGAGEMENT_ZONES,
  MISSILE_SALVOS,
  PHASES,
  RADAR_DOMES,
  TERRITORY_ZONES,
  TOTAL_SIM_HOURS,
  UNITS,
} from './scenarioData';
import type {
  CompiledCampaign,
  DomainId,
  EvaluatedMissile,
  EvaluatedRadar,
  EvaluatedTerritoryZone,
  EvaluatedUnit,
  FactionDomainStats,
  FactionId,
  GeoPoint,
  SimulationSnapshot,
  StrategicMetrics,
  UnitDefinition,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleFloatSeries(series: Float32Array | undefined, simHours: number, fallback = 100): number {
  if (!series || series.length === 0) return fallback;
  const exactStep = clamp(simHours / SOLVER_STEP_HOURS, 0, SOLVER_NUM_STEPS - 1);
  const idx0 = Math.floor(exactStep);
  const idx1 = Math.min(SOLVER_NUM_STEPS - 1, idx0 + 1);
  const frac = exactStep - idx0;
  return lerp(series[idx0], series[idx1], frac);
}

export function formatSimClock(simHours: number): string {
  const clamped = clamp(simHours, 0, TOTAL_SIM_HOURS);
  const day = Math.floor(clamped / 24);
  const remHours = clamped - day * 24;
  const hh = Math.floor(remHours);
  const mm = Math.floor((remHours - hh) * 60);
  return `D+${String(day).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getPhaseAtTime(simHours: number) {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (simHours >= PHASES[i].startHour) {
      return PHASES[i];
    }
  }
  return PHASES[0];
}

export function getDirectorShotAtTime(simHours: number) {
  for (let i = DIRECTOR_SHOTS.length - 1; i >= 0; i--) {
    if (simHours >= DIRECTOR_SHOTS[i].startHour) {
      return DIRECTOR_SHOTS[i];
    }
  }
  return DIRECTOR_SHOTS[0];
}

function computeHeadingDeg(fromLon: number, fromLat: number, toLon: number, toLat: number): number {
  const dLon = (toLon - fromLon) * Math.cos(((fromLat + toLat) * 0.5 * Math.PI) / 180);
  const dLat = toLat - fromLat;
  if (Math.abs(dLon) < 1e-6 && Math.abs(dLat) < 1e-6) return 0;
  const rad = Math.atan2(dLon, dLat);
  return ((rad * 180) / Math.PI + 360) % 360;
}

function sampleUnitPositionAt(
  unit: UnitDefinition,
  t: number,
  campaign: CompiledCampaign
): GeoPoint {
  const wps = unit.waypoints;
  let base: GeoPoint = wps[0];

  if (wps.length > 1) {
    if (t <= wps[0].time) {
      base = wps[0];
    } else if (t >= wps[wps.length - 1].time) {
      base = wps[wps.length - 1];
    } else {
      for (let i = 0; i < wps.length - 1; i++) {
        const a = wps[i];
        const b = wps[i + 1];
        if (t >= a.time && t <= b.time) {
          const frac = (t - a.time) / Math.max(0.0001, b.time - a.time);
          const smooth = frac * frac * (3 - 2 * frac);
          base = {
            lon: lerp(a.lon, b.lon, smooth),
            lat: lerp(a.lat, b.lat, smooth),
            alt: lerp(a.alt, b.alt, smooth),
          };
          break;
        }
      }
    }
  }

  if (unit.patrolLoop) {
    const loop = unit.patrolLoop;
    const toHour = loop.toHour >= 600 ? TOTAL_SIM_HOURS : loop.toHour;
    if (t >= loop.fromHour && t <= toHour) {
      const rampIn = clamp((t - loop.fromHour) / 2.5, 0, 1);
      const rampOut = clamp((toHour - t) / 2.5, 0, 1);
      const weight = Math.min(rampIn, rampOut);
      const theta = (t / loop.periodHours) * Math.PI * 2 + (loop.phaseOffset ?? 0);
      const orbitLon = loop.center.lon + Math.cos(theta) * loop.radiusDegLon;
      const orbitLat = loop.center.lat + Math.sin(theta) * loop.radiusDegLat;
      const orbitAlt = loop.center.alt + Math.sin(theta * 2) * 450;

      base = {
        lon: lerp(base.lon, orbitLon, weight),
        lat: lerp(base.lat, orbitLat, weight),
        alt: lerp(base.alt, orbitAlt, weight),
      };
    }
  }

  // Dynamic push offset driven by campaign solver (e.g., if Red breaks into North Taiwan
  // or Allied/ANZAC/ROC counter-land onto Mainland Fujian/Hainan/Zhoushan!)
  if (unit.offensivePushPoint) {
    const pushFactor = sampleFloatSeries(campaign.unitPushSeries[unit.id], t, 0);
    if (pushFactor > 0.38) {
      const blend = clamp((pushFactor - 0.38) / 0.52, 0, 0.85);
      base = {
        lon: lerp(base.lon, unit.offensivePushPoint.lon, blend),
        lat: lerp(base.lat, unit.offensivePushPoint.lat, blend),
        alt: lerp(base.alt, unit.offensivePushPoint.alt, blend),
      };
    }
  }

  return base;
}

function evaluateUnit(
  unit: UnitDefinition,
  simHours: number,
  phaseIndex: number,
  campaign: CompiledCampaign
): EvaluatedUnit {
  const win = campaign.unitActiveWindows[unit.id] ?? {
    from: unit.activeFrom,
    until: unit.activeUntil,
  };
  const integrity = sampleFloatSeries(campaign.unitIntegritySeries[unit.id], simHours, 100);
  const active = simHours >= win.from && simHours <= win.until && integrity > 3;

  const pos = sampleUnitPositionAt(unit, simHours, campaign);
  const lookAhead = sampleUnitPositionAt(unit, Math.min(TOTAL_SIM_HOURS, simHours + 0.35), campaign);
  const lookBehind = sampleUnitPositionAt(unit, Math.max(win.from, simHours - 0.35), campaign);

  let headingDeg = computeHeadingDeg(lookBehind.lon, lookBehind.lat, lookAhead.lon, lookAhead.lat);
  if (unit.speedKnots === 0) {
    headingDeg = 0;
  }

  const trail: GeoPoint[] = [];
  if (active && (unit.domain === 'air' || unit.domain === 'sea')) {
    const trailHours = unit.domain === 'air' ? 5.5 : 48.0;
    const steps = unit.domain === 'air' ? 14 : 10;
    for (let i = steps; i >= 0; i--) {
      const sampleT = Math.max(win.from, simHours - (trailHours * i) / steps);
      trail.push(sampleUnitPositionAt(unit, sampleT, campaign));
    }
  }

  const effectiveCount = active
    ? Math.max(1, Math.round((unit.baseStrength * integrity) / 100))
    : 0;

  let currentMission = unit.missionByPhase[phaseIndex];
  if (!currentMission) {
    for (let p = phaseIndex; p >= 0; p--) {
      if (unit.missionByPhase[p]) {
        currentMission = unit.missionByPhase[p];
        break;
      }
    }
  }
  if (!currentMission) {
    const firstKey = Number(Object.keys(unit.missionByPhase)[0] ?? 0);
    currentMission = unit.missionByPhase[firstKey] ?? '區域戰備待命';
  }

  return {
    def: unit,
    active,
    lon: pos.lon,
    lat: pos.lat,
    alt: pos.alt,
    headingDeg,
    integrity,
    effectiveCount,
    trail,
    currentMission,
  };
}

function sampleParabolicPoint(
  origin: GeoPoint,
  target: GeoPoint,
  apogeeMeters: number,
  u: number
): GeoPoint {
  const clampedU = clamp(u, 0, 1);
  const lon = lerp(origin.lon, target.lon, clampedU);
  const lat = lerp(origin.lat, target.lat, clampedU);
  const linearAlt = lerp(origin.alt, target.alt, clampedU);
  const arcAlt = 4 * clampedU * (1 - clampedU) * Math.max(0, apogeeMeters - linearAlt);
  return {
    lon,
    lat,
    alt: linearAlt + arcAlt,
  };
}

function evaluateMissiles(
  simHours: number,
  campaign: CompiledCampaign,
  unitMap: Map<string, EvaluatedUnit>
): EvaluatedMissile[] {
  return MISSILE_SALVOS.map((def) => {
    const mWin = campaign.missileStateByStep[def.id];
    const effStart = mWin ? mWin.activeFrom : def.startHour;
    const effEnd = mWin ? mWin.activeUntil : def.endHour;

    // Gate firing by launcher survival if specified
    let launcherAlive = true;
    if (def.launcherUnitId) {
      const launcher = unitMap.get(def.launcherUnitId);
      if (launcher && (!launcher.active || launcher.integrity <= 8)) {
        launcherAlive = false;
      }
    }

    if (simHours < effStart || simHours > effEnd || !launcherAlive) {
      return {
        def,
        active: false,
        progress: 0,
        head: def.origin,
        trail: [],
        interceptActive: false,
        burstActive: false,
        burstProgress: 0,
        burstIsIntercept: false,
      };
    }

    const elapsed = simHours - effStart + def.phaseOffsetHours;
    const cyclePos = ((elapsed % def.cycleHours) + def.cycleHours) % def.cycleHours;
    const burstDuration = Math.min(1.85, def.cycleHours * 0.25);

    const stopFraction = def.intercept ? def.intercept.interceptFraction : 1.0;
    const activeFlightEnd = def.flightDurationHours * stopFraction;

    if (cyclePos <= activeFlightEnd) {
      const progress = cyclePos / def.flightDurationHours;
      const head = sampleParabolicPoint(def.origin, def.target, def.apogeeMeters, progress);

      const trailPoints: GeoPoint[] = [];
      const tailStart = Math.max(0, progress - 0.55);
      const samples = 18;
      for (let i = 0; i <= samples; i++) {
        const u = lerp(tailStart, progress, i / samples);
        trailPoints.push(sampleParabolicPoint(def.origin, def.target, def.apogeeMeters, u));
      }

      let interceptActive = false;
      let interceptorHead: GeoPoint | undefined;
      let interceptorTrail: GeoPoint[] | undefined;

      if (def.intercept) {
        const launchU = Math.max(0.08, stopFraction - 0.34);
        if (progress >= launchU) {
          interceptActive = true;
          const intFrac = clamp((progress - launchU) / Math.max(0.01, stopFraction - launchU), 0, 1);
          const interceptPoint = sampleParabolicPoint(
            def.origin,
            def.target,
            def.apogeeMeters,
            stopFraction
          );
          const intOrigin = def.intercept.defenderOrigin;
          const intApogee = Math.max(interceptPoint.alt * 1.06, intOrigin.alt + 8000);

          interceptorHead = {
            lon: lerp(intOrigin.lon, interceptPoint.lon, intFrac),
            lat: lerp(intOrigin.lat, interceptPoint.lat, intFrac),
            alt:
              lerp(intOrigin.alt, interceptPoint.alt, Math.pow(intFrac, 0.78)) +
              Math.sin(intFrac * Math.PI) * Math.min(12000, intApogee * 0.08),
          };

          interceptorTrail = [];
          for (let i = 0; i <= 10; i++) {
            const sub = (intFrac * i) / 10;
            interceptorTrail.push({
              lon: lerp(intOrigin.lon, interceptPoint.lon, sub),
              lat: lerp(intOrigin.lat, interceptPoint.lat, sub),
              alt:
                lerp(intOrigin.alt, interceptPoint.alt, Math.pow(sub, 0.78)) +
                Math.sin(sub * Math.PI) * Math.min(12000, intApogee * 0.08),
            });
          }
        }
      }

      return {
        def,
        active: true,
        progress,
        head,
        trail: trailPoints,
        interceptActive,
        interceptorHead,
        interceptorTrail,
        burstActive: false,
        burstProgress: 0,
        burstIsIntercept: Boolean(def.intercept),
      };
    }

    if (cyclePos <= activeFlightEnd + burstDuration) {
      const burstProgress = (cyclePos - activeFlightEnd) / burstDuration;
      const burstPoint = sampleParabolicPoint(def.origin, def.target, def.apogeeMeters, stopFraction);
      return {
        def,
        active: false,
        progress: stopFraction,
        head: burstPoint,
        trail: [],
        interceptActive: false,
        burstActive: true,
        burstPoint,
        burstProgress,
        burstIsIntercept: Boolean(def.intercept),
      };
    }

    return {
      def,
      active: false,
      progress: 0,
      head: def.origin,
      trail: [],
      interceptActive: false,
      burstActive: false,
      burstProgress: 0,
      burstIsIntercept: false,
    };
  });
}

export function evaluateSimulation(
  simHours: number,
  campaign: CompiledCampaign
): SimulationSnapshot {
  const clampedHours = clamp(simHours, 0, TOTAL_SIM_HOURS);
  const phase = getPhaseAtTime(clampedHours);
  const units = UNITS.map((u) => evaluateUnit(u, clampedHours, phase.index, campaign));
  const unitMap = new Map(units.map((u) => [u.def.id, u]));

  const missiles = evaluateMissiles(clampedHours, campaign, unitMap);

  const territories: EvaluatedTerritoryZone[] = TERRITORY_ZONES.map((def) => {
    const timeline = campaign.territoryTimelines[def.id] ?? def.timeline;
    let current = timeline[0];
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (clampedHours >= timeline[i].time) {
        current = timeline[i];
        break;
      }
    }
    const score = sampleFloatSeries(campaign.territoryScoreSeries[def.id], clampedHours, 0);
    return {
      def,
      controller: current.controller,
      controlScore: Math.round(score),
      statusLabel: current.statusLabel,
      detail: current.detail,
    };
  });

  const terrMap = new Map(territories.map((t) => [t.def.id, t]));

  const radars: EvaluatedRadar[] = RADAR_DOMES.map((def) => {
    let active = clampedHours >= def.activeFrom && clampedHours <= def.activeUntil;
    if (def.linkedZoneId) {
      const z = terrMap.get(def.linkedZoneId);
      if (z && z.controller !== def.faction && z.controller !== 'contested') {
        active = false;
      }
    }
    if (def.followUnitId) {
      const host = unitMap.get(def.followUnitId);
      if (host && host.active) {
        return { def, active, lon: host.lon, lat: host.lat, alt: 0 };
      }
      if (host && !host.active) {
        active = false;
      }
    }
    return { def, active, lon: def.position.lon, lat: def.position.lat, alt: def.position.alt };
  });

  const engagements = ENGAGEMENT_ZONES.map((z, idx) => {
    const win = campaign.engagementWindows[z.id];
    const startH = win ? win.startHour : z.startHour;
    const endH = win ? win.endHour : z.endHour;
    const active = clampedHours >= startH && clampedHours <= endH;
    const pulse = (Math.sin(clampedHours * 0.75 + idx * 1.4) + 1) * 0.5;
    return { ...z, active, pulse };
  });

  const factions: FactionId[] = [
    'pla',
    'roc',
    'jsdf',
    'us',
    'anzac',
    'sea_asean',
    'ind',
    'uk_fr',
    'kor_usfk',
    'dprk',
  ];
  const domains: DomainId[] = ['land', 'sea', 'air', 'missile'];

  const factionStats = {} as Record<FactionId, FactionDomainStats>;

  for (const faction of factions) {
    const fUnits = units.filter((u) => u.def.faction === faction);
    const byDomain = {} as Record<DomainId, { active: number; total: number; readinessPct: number }>;

    let activeDomainSum = 0;
    let activeDomainCount = 0;
    let activeUnits = 0;

    for (const domain of domains) {
      const dUnits = fUnits.filter((u) => u.def.domain === domain);
      const total = dUnits.reduce((acc, u) => acc + u.def.baseStrength, 0);
      const deployed = dUnits.filter((u) => u.active);
      const activeCount = deployed.reduce((acc, u) => acc + u.effectiveCount, 0);
      const deployedBase = deployed.reduce((acc, u) => acc + u.def.baseStrength, 0);
      const domainPct = deployedBase > 0 ? Math.round((activeCount / deployedBase) * 100) : 0;

      byDomain[domain] = {
        active: activeCount,
        total,
        readinessPct: domainPct,
      };

      if (deployed.length > 0) {
        activeDomainSum += domainPct;
        activeDomainCount += 1;
      }
    }

    for (const u of fUnits) {
      if (u.active) activeUnits += 1;
    }

    factionStats[faction] = {
      faction,
      readinessPct: activeDomainCount > 0 ? Math.round(activeDomainSum / activeDomainCount) : 0,
      byDomain,
      activeUnits,
    };
  }

  const getWeightedUnitsPct = (items: Array<{ id: string; weight: number }>): number => {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const item of items) {
      const u = unitMap.get(item.id);
      if (!u) continue;
      const pct = u.active ? u.integrity : clampedHours < (campaign.unitActiveWindows[item.id]?.from ?? u.def.activeFrom) ? 100 : u.integrity;
      weightedSum += pct * item.weight;
      totalWeight += item.weight;
    }
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  };

  const amphibiousLiftPct = Math.round(
    sampleFloatSeries(campaign.amphibiousLiftSeries, clampedHours, 100)
  );
  const plaMissileStockPct = Math.round(
    sampleFloatSeries(campaign.plaMissileStockSeries, clampedHours, 100)
  );
  const alliedMunitionStockPct = Math.round(
    sampleFloatSeries(campaign.alliedMunitionStockSeries, clampedHours, 100)
  );
  const scsCoalitionPressurePct = Math.round(
    sampleFloatSeries(campaign.scsPressureSeries, clampedHours, 0)
  );

  const rocAsymmetricCorePct = getWeightedUnitsPct([
    { id: 'roc_coastal_hf3', weight: 18 },
    { id: 'roc_harpoon_coastal', weight: 14 },
    { id: 'roc_air_f16v', weight: 18 },
    { id: 'roc_air_ew_asw', weight: 6 },
    { id: 'roc_sea_subs', weight: 12 },
    { id: 'roc_sam_hualien', weight: 8 },
    { id: 'roc_artillery_himars', weight: 6 },
    { id: 'roc_mine_layers', weight: 5 },
    { id: 'roc_uav_cyber_ew', weight: 4 },
    { id: 'roc_reserve_urban_def', weight: 5 },
    { id: 'roc_penghu_command', weight: 4 },
    { id: 'roc_hf2e_counterstrike', weight: 4 },
  ]);

  const coalitionWeights: Array<{ id: string; weight: number }> = [
    { id: 'jsdf_sam_bmd', weight: 6 },
    { id: 'jsdf_air_sw', weight: 8 },
    { id: 'jsdf_kyushu_honshu_air', weight: 6 },
    { id: 'jsdf_sea_fleet', weight: 8 },
    { id: 'jsdf_amphib_ardb', weight: 5 },
    { id: 'jsdf_sea_subs', weight: 6 },
    { id: 'us_edca_luzon_logistics', weight: 6 },
    { id: 'us_air_tanker_awacs', weight: 8 },
    { id: 'us_ew_ea18g_uav', weight: 6 },
    { id: 'us_air_pacaf_fighters', weight: 9 },
    { id: 'us_air_conus_surge', weight: 10 },
    { id: 'us_sea_subs', weight: 12 },
    { id: 'us_ssgn_ohio_b21', weight: 11 },
    { id: 'us_air_guam_bombers', weight: 12 },
    { id: 'us_sea_csg5', weight: 10 },
    { id: 'us_sea_csg3', weight: 10 },
    { id: 'us_sea_csg_surge', weight: 13 },
    { id: 'us_air_cvw', weight: 10 },
    { id: 'anzac_raaf_f35_tanker', weight: 8 },
    { id: 'anzac_ran_subs', weight: 7 },
    { id: 'anzac_ran_rnzn_surface', weight: 6 },
    { id: 'sea_phl_brahmos_coastal', weight: 4 },
    { id: 'sea_vnm_subs_bastion', weight: 4 },
    { id: 'sea_sgp_chokepoint', weight: 5 },
    { id: 'ind_andaman_p8i_subs', weight: 7 },
    { id: 'ind_air_nicobar_su30', weight: 5 },
    { id: 'ind_ins_vikrant_csg', weight: 8 },
    { id: 'ukfr_mn_cdg_csg', weight: 8 },
    { id: 'ukfr_rn_pow_csg', weight: 8 },
  ];
  let coalitionActiveWeight = 0;
  let coalitionTotalWeight = 0;
  for (const item of coalitionWeights) {
    coalitionTotalWeight += item.weight;
    const u = unitMap.get(item.id);
    if (u && u.active) {
      coalitionActiveWeight += item.weight * (u.integrity / 100);
    }
  }
  const alliedInterventionPct =
    coalitionTotalWeight > 0
      ? Math.min(100, Math.round((coalitionActiveWeight / (coalitionTotalWeight * 0.68)) * 100))
      : 0;

  const ntcPinnedAir = unitMap.get('pla_ntc_yellow_sea_pinned');
  const ntcPinnedFleet = unitMap.get('pla_ntc_fleet_pinned');
  const ntcAirSouth = unitMap.get('pla_ntc_air_south');
  const ntcLiaoning = unitMap.get('pla_ntc_liaoning_csg');
  const pinnedForce =
    ((ntcPinnedAir && ntcPinnedAir.active ? 220 * (ntcPinnedAir.integrity / 100) : 220) +
      (ntcPinnedFleet && ntcPinnedFleet.active ? 48 * (ntcPinnedFleet.integrity / 100) : 48)) *
    campaign.variables.koreaPinningFactor;
  const southSentForce =
    (ntcAirSouth && ntcAirSouth.active ? 160 * (ntcAirSouth.integrity / 100) : 0) +
    (ntcLiaoning && ntcLiaoning.active ? 28 * (ntcLiaoning.integrity / 100) : 0);
  const ntcPinningPct = Math.round(
    clamp((pinnedForce / Math.max(1, pinnedForce + southSentForce)) * 100, 22, 88)
  );

  const koreanTensionLabel =
    campaign.variables.koreaPinningFactor >= 1.12
      ? '三八線高烈度鎖定 · 北部主力難南調'
      : campaign.variables.koreaPinningFactor >= 0.78
        ? '黃海高戒備對峙 · 牽制北部半數兵力'
        : '韓半島低烈度警戒 · 北部戰區獲釋南援';

  const strategicMetrics: StrategicMetrics = {
    amphibiousLiftPct,
    plaMissileStockPct,
    alliedMunitionStockPct,
    rocAsymmetricCorePct,
    alliedInterventionPct,
    ntcPinningPct,
    scsCoalitionPressurePct,
    koreanTensionLabel,
  };

  const recentEvents = campaign.events
    .filter((e) => e.time <= clampedHours)
    .sort((a, b) => b.time - a.time);

  return {
    simHours: clampedHours,
    formattedClock: formatSimClock(clampedHours),
    phase,
    units,
    missiles,
    radars,
    engagements,
    territories,
    factionStats,
    strategicMetrics,
    recentEvents,
    activeDirectorShot: getDirectorShotAtTime(clampedHours),
    variables: campaign.variables,
    verdict: campaign.verdict,
  };
}
