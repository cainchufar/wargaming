import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CesiumViewport,
  type CameraFlyRequest,
  type MapMode,
} from './cesium/CesiumViewport';
import { ForcePanel } from './components/ForcePanel';
import { IntelDrawer } from './components/IntelDrawer';
import { TimelineBar } from './components/TimelineBar';
import { TopBar } from './components/TopBar';
import { compileCampaign, generateRandomVariables } from './simulation/campaignSolver';
import { evaluateSimulation } from './simulation/engine';
import { TOTAL_SIM_HOURS } from './simulation/scenarioData';
import type {
  BattleEventDefinition,
  CameraViewSpec,
  CompiledCampaign,
  EvaluatedUnit,
  LayerVisibility,
  SimulationSnapshot,
} from './simulation/types';

// At 1x speed, 2.0 simulated hours pass per real second (keeps D+00 saturation crisp; use 16x/48x to sweep 90 days)
const BASE_HOURS_PER_SECOND = 2.0;
const INITIAL_START_HOUR = 0.8;

const DEFAULT_LAYERS: LayerVisibility = {
  land: true,
  sea: true,
  air: true,
  missile: true,
  radar: true,
  territory: true,
  references: true,
};

export default function App() {
  const campaignRef = useRef<CompiledCampaign>(compileCampaign(generateRandomVariables()));
  const simHoursRef = useRef<number>(INITIAL_START_HOUR);
  const snapshotRef = useRef<SimulationSnapshot>(
    evaluateSimulation(INITIAL_START_HOUR, campaignRef.current)
  );

  const [uiSnapshot, setUiSnapshot] = useState<SimulationSnapshot>(() => snapshotRef.current);
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [autoCamera, setAutoCamera] = useState<boolean>(true);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('google3d');
  const [tilesStatus, setTilesStatus] = useState<'loading' | 'google3d' | 'fallback'>('loading');
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);

  const [leftOpen, setLeftOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1120 : true
  );
  const [rightOpen, setRightOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1120 : true
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [flyRequest, setFlyRequest] = useState<CameraFlyRequest | null>(null);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  // Continuous 60 FPS simulation ticker backed by compiled stochastic campaign
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let lastUiSync = lastTs;
    let endHoldSec = 0;

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      if (playingRef.current) {
        if (simHoursRef.current >= TOTAL_SIM_HOURS) {
          endHoldSec += dtSec;
          // Hold 5s at Day 90 verdict, then automatically roll a brand new stochastic campaign run
          if (endHoldSec >= 5.0) {
            endHoldSec = 0;
            campaignRef.current = compileCampaign(generateRandomVariables());
            simHoursRef.current = INITIAL_START_HOUR;
          }
        } else {
          endHoldSec = 0;
          simHoursRef.current = Math.min(
            TOTAL_SIM_HOURS,
            simHoursRef.current + dtSec * BASE_HOURS_PER_SECOND * speedRef.current
          );
        }
        snapshotRef.current = evaluateSimulation(simHoursRef.current, campaignRef.current);
      }

      if (now - lastUiSync >= 165) {
        lastUiSync = now;
        setUiSnapshot(snapshotRef.current);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const syncImmediately = useCallback((nextHours: number) => {
    simHoursRef.current = nextHours;
    const nextSnap = evaluateSimulation(nextHours, campaignRef.current);
    snapshotRef.current = nextSnap;
    setUiSnapshot(nextSnap);
  }, []);

  const handleSeekHours = useCallback(
    (hours: number) => {
      syncImmediately(hours);
    },
    [syncImmediately]
  );

  const handleRestart = useCallback(() => {
    syncImmediately(INITIAL_START_HOUR);
    setPlaying(true);
    setAutoCamera(true);
    setActivePresetId(null);
  }, [syncImmediately]);

  const handleRerollCampaign = useCallback(() => {
    campaignRef.current = compileCampaign(generateRandomVariables());
    syncImmediately(INITIAL_START_HOUR);
    setPlaying(true);
    setAutoCamera(true);
    setActivePresetId(null);
  }, [syncImmediately]);

  const handleToggleAutoCamera = useCallback(() => {
    setAutoCamera((prev) => {
      const next = !prev;
      if (next) {
        setActivePresetId(null);
      }
      return next;
    });
  }, []);

  const handleUserManualCamera = useCallback(() => {
    setAutoCamera(false);
    setActivePresetId(null);
  }, []);

  const handleSelectPreset = useCallback((preset: CameraViewSpec) => {
    setAutoCamera(false);
    setActivePresetId(preset.id);
    setFlyRequest((prev) => ({ seq: (prev?.seq ?? 0) + 1, spec: preset }));
  }, []);

  const handleFocusEvent = useCallback((event: BattleEventDefinition) => {
    setAutoCamera(false);
    setActivePresetId(null);
    setFlyRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      spec: {
        id: `event_${event.id}`,
        label: event.title,
        lon: event.location.lon,
        lat: event.location.lat - 1.35,
        height: 260000,
        headingDeg: 0,
        pitchDeg: -42,
        duration: 1.9,
      },
    }));
  }, []);

  const handleFocusUnit = useCallback((unit: EvaluatedUnit) => {
    setAutoCamera(false);
    setActivePresetId(null);
    setFlyRequest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      spec: {
        id: `unit_${unit.def.id}`,
        label: unit.def.name,
        lon: unit.lon,
        lat: unit.lat - 0.85,
        height: Math.max(120000, unit.alt + 110000),
        headingDeg: 0,
        pitchDeg: -44,
        duration: 1.8,
      },
    }));
  }, []);

  const handleSelectUnit = useCallback((unitId: string | null) => {
    setSelectedUnitId(unitId);
    if (unitId) {
      setRightOpen(true);
    }
  }, []);

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleMapMode = useCallback(() => {
    setMapMode((prev) => (prev === 'google3d' ? 'tactical_dark' : 'google3d'));
  }, []);

  const hudVisible = leftOpen || rightOpen;
  const handleToggleHudVisible = useCallback(() => {
    if (leftOpen || rightOpen) {
      setLeftOpen(false);
      setRightOpen(false);
    } else {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [leftOpen, rightOpen]);

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return uiSnapshot.units.find((u) => u.def.id === selectedUnitId && u.active) ?? null;
  }, [selectedUnitId, uiSnapshot.units]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050912] select-none">
      {/* Full-Viewport 3D Digital Twin Stage (CesiumJS + Google Photorealistic 3D Tiles) */}
      <CesiumViewport
        snapshotRef={snapshotRef}
        layers={layers}
        mapMode={mapMode}
        autoCamera={autoCamera}
        flyRequest={flyRequest}
        selectedUnitId={selectedUnitId}
        onSelectUnit={handleSelectUnit}
        onUserManualCamera={handleUserManualCamera}
        onTilesStatusChange={setTilesStatus}
      />

      {/* Semantic Observer HUD Overlay Layer */}
      <TopBar
        formattedClock={uiSnapshot.formattedClock}
        phase={uiSnapshot.phase}
        seed={uiSnapshot.variables.seed}
        autoCamera={autoCamera}
        activePresetId={activePresetId}
        mapMode={mapMode}
        tilesStatus={tilesStatus}
        hudVisible={hudVisible}
        onToggleAutoCamera={handleToggleAutoCamera}
        onSelectPreset={handleSelectPreset}
        onToggleMapMode={handleToggleMapMode}
        onToggleHudVisible={handleToggleHudVisible}
      />

      <IntelDrawer
        open={leftOpen}
        onToggleOpen={() => setLeftOpen((v) => !v)}
        phase={uiSnapshot.phase}
        verdict={uiSnapshot.verdict}
        events={uiSnapshot.recentEvents}
        onFocusEvent={handleFocusEvent}
      />

      <ForcePanel
        open={rightOpen}
        onToggleOpen={() => setRightOpen((v) => !v)}
        factionStats={uiSnapshot.factionStats}
        strategicMetrics={uiSnapshot.strategicMetrics}
        territories={uiSnapshot.territories}
        units={uiSnapshot.units}
        variables={uiSnapshot.variables}
        verdict={uiSnapshot.verdict}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        selectedUnit={selectedUnit}
        onSelectUnit={handleSelectUnit}
        onCloseSelectedUnit={() => setSelectedUnitId(null)}
        onFocusUnit={handleFocusUnit}
      />

      <TimelineBar
        simHours={uiSnapshot.simHours}
        formattedClock={uiSnapshot.formattedClock}
        playing={playing}
        speed={speed}
        autoCamera={autoCamera}
        activeDirectorShot={uiSnapshot.activeDirectorShot}
        onTogglePlay={() => setPlaying((p) => !p)}
        onChangeSpeed={setSpeed}
        onRestart={handleRestart}
        onRerollCampaign={handleRerollCampaign}
        onSeekHours={handleSeekHours}
      />
    </main>
  );
}
