export type FactionId =
  | 'pla'
  | 'roc'
  | 'jsdf'
  | 'us'
  | 'anzac'
  | 'sea_asean'
  | 'ind'
  | 'uk_fr'
  | 'kor_usfk'
  | 'dprk';

export type DomainId = 'land' | 'sea' | 'air' | 'missile';

export type UnitClass =
  | 'fighter'
  | 'bomber'
  | 'awacs'
  | 'airlift'
  | 'tanker_isr'
  | 'electronic_warfare'
  | 'uav_swarm'
  | 'helicopter'
  | 'carrier'
  | 'destroyer'
  | 'amphibious'
  | 'corvette'
  | 'coast_guard'
  | 'mine_warfare'
  | 'submarine'
  | 'armor'
  | 'airborne'
  | 'special_ops'
  | 'artillery_mlrs'
  | 'sam'
  | 'coastal_missile'
  | 'rocket_force';

export interface UnitSpecs {
  branchLabel: string;
  platforms: string;
  weaponRangeKm: string;
  munitionsOrSortie: string;
  survivabilityTag: string;
  logisticsFactor: string;
}

export interface GeoPoint {
  lon: number;
  lat: number;
  alt: number; // meters above ellipsoid
}

export interface TimedWaypoint extends GeoPoint {
  time: number; // simulation hour (0..2160)
}

export type TheaterSectorId =
  | 'strait_taiwan'
  | 'east_pacific'
  | 'south_china_sea'
  | 'yellow_sea';

export interface UnitDefinition {
  id: string;
  name: string;
  callsign: string;
  theaterTag: string;
  theaterSector?: TheaterSectorId;
  faction: FactionId;
  domain: DomainId;
  unitClass: UnitClass;
  baseStrength: number;
  unitLabel: string;
  sourceRef?: string;
  specs?: UnitSpecs;
  activeFrom: number;
  activeUntil: number;
  missionByPhase: Record<number, string>;
  speedKnots: number;
  waypoints: TimedWaypoint[];
  patrolLoop?: {
    fromHour: number;
    toHour: number;
    center: GeoPoint;
    radiusDegLon: number;
    radiusDegLat: number;
    periodHours: number;
    phaseOffset?: number;
  };
  integrityCurve: Array<{ time: number; integrity: number }>;
  /** Zone ID this unit defends or attacks for dynamic position/attrition coupling */
  linkedZoneId?: string;
  /** Forward objective coordinate if offensive momentum breaks through */
  offensivePushPoint?: GeoPoint;
}

export interface MissileSalvoDefinition {
  id: string;
  label: string;
  faction: FactionId;
  weaponType: 'ballistic' | 'hypersonic' | 'mlrs' | 'cruise' | 'antiship' | 'asbm';
  origin: GeoPoint;
  target: GeoPoint;
  apogeeMeters: number;
  startHour: number;
  endHour: number;
  cycleHours: number;
  flightDurationHours: number;
  phaseOffsetHours: number;
  launcherUnitId?: string;
  theaterSector?: TheaterSectorId;
  intercept?: {
    defenderFaction: FactionId;
    defenderOrigin: GeoPoint;
    interceptFraction: number;
    interceptorLabel: string;
  };
}

export interface RadarDomeDefinition {
  id: string;
  label: string;
  faction: FactionId;
  position: GeoPoint;
  radiusMeters: number;
  activeFrom: number;
  activeUntil: number;
  followUnitId?: string;
  linkedZoneId?: string;
}

export interface EngagementZoneDefinition {
  id: string;
  label: string;
  position: GeoPoint;
  radiusMeters: number;
  startHour: number;
  endHour: number;
  intensity: 'high' | 'medium';
  category: 'air' | 'naval' | 'beachhead' | 'strike' | 'standoff';
  linkedZoneId?: string;
}

export interface PhaseDefinition {
  index: number;
  shortTitle: string;
  fullTitle: string;
  startHour: number;
  endHour: number;
  summary: string;
  keyDynamics: string[];
  activeFactions: FactionId[];
}

export interface BattleEventDefinition {
  id: string;
  time: number;
  faction: FactionId;
  theaterTag?: string;
  domain: DomainId;
  title: string;
  detail: string;
  location: GeoPoint;
  severity: 'critical' | 'major' | 'info';
}

export interface CameraViewSpec {
  id: string;
  label: string;
  lon: number;
  lat: number;
  height: number;
  headingDeg: number;
  pitchDeg: number;
  duration?: number;
}

export interface DirectorShot extends CameraViewSpec {
  startHour: number;
  caption: string;
}

export interface LayerVisibility {
  land: boolean;
  sea: boolean;
  air: boolean;
  missile: boolean;
  radar: boolean;
  territory: boolean;
  references: boolean;
}

export interface EvaluatedUnit {
  def: UnitDefinition;
  active: boolean;
  lon: number;
  lat: number;
  alt: number;
  headingDeg: number;
  integrity: number;
  effectiveCount: number;
  trail: GeoPoint[];
  currentMission: string;
}

export interface EvaluatedMissile {
  def: MissileSalvoDefinition;
  active: boolean;
  progress: number;
  head: GeoPoint;
  trail: GeoPoint[];
  interceptActive: boolean;
  interceptorHead?: GeoPoint;
  interceptorTrail?: GeoPoint[];
  burstActive: boolean;
  burstPoint?: GeoPoint;
  burstProgress: number;
  burstIsIntercept: boolean;
}

export interface EvaluatedRadar {
  def: RadarDomeDefinition;
  active: boolean;
  lon: number;
  lat: number;
  alt: number;
}

export interface FactionDomainStats {
  faction: FactionId;
  readinessPct: number;
  byDomain: Record<DomainId, { active: number; total: number; readinessPct: number }>;
  activeUnits: number;
}

export interface StrategicMetrics {
  amphibiousLiftPct: number;
  plaMissileStockPct: number;
  alliedMunitionStockPct: number;
  rocAsymmetricCorePct: number;
  alliedInterventionPct: number;
  ntcPinningPct: number;
  scsCoalitionPressurePct: number;
  koreanTensionLabel: string;
}

export interface NationalComparisonRow {
  id: string;
  domainLabel: string;
  prcNational: string;
  prcTheater: string;
  rocTotal: string;
  ratioLabel: string;
  source: string;
  bottleneckNote: string;
}

export type TerritoryControlState =
  | 'roc'
  | 'pla'
  | 'contested'
  | 'jsdf'
  | 'us'
  | 'anzac'
  | 'sea_asean'
  | 'ind'
  | 'uk_fr';

export type TerritoryRegionGroup = 'taiwan_outlying' | 'indo_pacific' | 'prc_mainland';

export interface TerritoryZoneDefinition {
  id: string;
  name: string;
  regionTag: string;
  regionGroup: TerritoryRegionGroup;
  initialController: Exclude<TerritoryControlState, 'contested'>;
  theaterSector: TheaterSectorId;
  strategicWeight: number;
  defenseHardness: number;
  coastalCounterTarget?: boolean;
  center: GeoPoint;
  polygon: Array<{ lon: number; lat: number }>;
  timeline: Array<{
    time: number;
    controller: TerritoryControlState;
    statusLabel: string;
    detail: string;
  }>;
}

export interface EvaluatedTerritoryZone {
  def: TerritoryZoneDefinition;
  controller: TerritoryControlState;
  controlScore: number; // -100 (Red dominant) .. +100 (Coalition/Blue dominant)
  statusLabel: string;
  detail: string;
}

export interface CampaignVariables {
  seed: number;
  firstStrikeEffectiveness: number; // 0.58 .. 1.42
  weatherSeaState: number; // 0.55 .. 1.38 (higher = calmer seas favoring amphibious ops)
  usInterventionDelayHours: number; // 54 .. 264h
  usSurgeIntensity: number; // 0.65 .. 1.40
  anzacCommitment: number; // 0.52 .. 1.42
  aseanScsEscalation: number; // 0.28 .. 1.45
  indiaIntervention: number; // 0.35 .. 1.45 (Andaman chokepoint + INS Vikrant SCS surge)
  euroFleetIntervention: number; // 0.25 .. 1.45 (Late-stage UK & France carrier transit)
  koreaPinningFactor: number; // 0.40 .. 1.45
  plaStockpileDepth: number; // 0.68 .. 1.38
  rocDefenseResilience: number; // 0.68 .. 1.38
}

export interface CampaignVerdict {
  headline: string;
  outcomeType: 'red_advantage' | 'contested_stalemate' | 'allied_counteroffensive';
  taiwanHeldZones: number;
  taiwanOccupiedZones: number;
  mainlandBreachedZones: number;
  mainlandOccupiedZones: number;
  summary: string;
}

export interface CompiledCampaign {
  variables: CampaignVariables;
  stepHours: number;
  numSteps: number;
  /** unitId -> sampled integrity per step */
  unitIntegritySeries: Record<string, Float32Array>;
  /** unitId -> dynamic active start/end hours in this run */
  unitActiveWindows: Record<string, { from: number; until: number }>;
  /** unitId -> dynamic offensive push factor (0..1) per step */
  unitPushSeries: Record<string, Float32Array>;
  /** territoryId -> controlScore (-100..+100) per step */
  territoryScoreSeries: Record<string, Float32Array>;
  /** territoryId -> state transitions computed by solver */
  territoryTimelines: Record<
    string,
    Array<{
      time: number;
      controller: TerritoryControlState;
      statusLabel: string;
      detail: string;
    }>
  >;
  /** engagementId -> active window computed by solver */
  engagementWindows: Record<string, { startHour: number; endHour: number }>;
  /** missileId -> firing intensity factor per step & intercept probability */
  missileStateByStep: Record<string, { activeFrom: number; activeUntil: number; interceptRate: number }>;
  /** telemetry curves computed directly by solver */
  plaMissileStockSeries: Float32Array;
  alliedMunitionStockSeries: Float32Array;
  amphibiousLiftSeries: Float32Array;
  scsPressureSeries: Float32Array;
  /** dynamically generated battle events based on actual run outcomes */
  events: BattleEventDefinition[];
  verdict: CampaignVerdict;
}

export interface SimulationSnapshot {
  simHours: number;
  formattedClock: string;
  phase: PhaseDefinition;
  units: EvaluatedUnit[];
  missiles: EvaluatedMissile[];
  radars: EvaluatedRadar[];
  engagements: Array<EngagementZoneDefinition & { active: boolean; pulse: number }>;
  territories: EvaluatedTerritoryZone[];
  factionStats: Record<FactionId, FactionDomainStats>;
  strategicMetrics: StrategicMetrics;
  recentEvents: BattleEventDefinition[];
  activeDirectorShot: DirectorShot;
  variables: CampaignVariables;
  verdict: CampaignVerdict;
}
