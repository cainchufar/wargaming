import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useRef, useState } from 'react';
import {
  DIRECTOR_SHOTS,
  DMZ_38_LINE_COORDS,
  ENGAGEMENT_ZONES,
  FACTION_META,
  FIRST_ISLAND_CHAIN_COORDS,
  MEDIAN_LINE_COORDS,
  MISSILE_SALVOS,
  RADAR_DOMES,
  TERRITORY_ZONES,
  UNITS,
} from '../simulation/scenarioData';
import type {
  CameraViewSpec,
  FactionId,
  LayerVisibility,
  SimulationSnapshot,
  TerritoryControlState,
} from '../simulation/types';
import { getTacticalIconDataUrl } from './tacticalIcons';

(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium/';

export const DEFAULT_CESIUM_ION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhOWYyY2MxMy0wMmJjLTQ0MzItOTFhYS0xYjg0YmI4NWQ4NzciLCJpZCI6NDYyNTY0LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODU0OTA2OTV9.0tvu5E5s3Rrq7XpWWlQlrUeOD10CUP8iZSYah3lzDpY';

export type MapMode = 'google3d' | 'tactical_dark';

export interface CameraFlyRequest {
  seq: number;
  spec: CameraViewSpec;
}

interface CesiumViewportProps {
  snapshotRef: React.MutableRefObject<SimulationSnapshot>;
  layers: LayerVisibility;
  mapMode: MapMode;
  autoCamera: boolean;
  flyRequest: CameraFlyRequest | null;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string | null) => void;
  onUserManualCamera: () => void;
  onTilesStatusChange: (status: 'loading' | 'google3d' | 'fallback') => void;
}

function getFactionCesiumColor(faction: FactionId, alpha = 1): Cesium.Color {
  return Cesium.Color.fromCssColorString(FACTION_META[faction].colorHex).withAlpha(alpha);
}

function getFactionSoftColor(faction: FactionId, alpha = 1): Cesium.Color {
  return Cesium.Color.fromCssColorString(FACTION_META[faction].softHex).withAlpha(alpha);
}

function getTerritoryColor(state: TerritoryControlState, alpha: number): Cesium.Color {
  const hex =
    state === 'pla'
      ? '#EF4444'
      : state === 'contested'
        ? '#F97316'
        : state === 'jsdf'
          ? '#F59E0B'
          : state === 'us'
            ? '#06B6D4'
            : state === 'anzac'
              ? '#14B8A6'
              : state === 'sea_asean'
                ? '#818CF8'
                : state === 'ind'
                  ? '#A3E635'
                  : state === 'uk_fr'
                    ? '#C084FC'
                    : '#3B82F6';
  return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
}

export function CesiumViewport({
  snapshotRef,
  layers,
  mapMode,
  autoCamera,
  flyRequest,
  selectedUnitId,
  onSelectUnit,
  onUserManualCamera,
  onTilesStatusChange,
}: CesiumViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const googleTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const googleTilesReadyRef = useRef<boolean>(false);
  const baseImageryLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  const layersRef = useRef<LayerVisibility>(layers);
  const mapModeRef = useRef<MapMode>(mapMode);
  const autoCameraRef = useRef<boolean>(autoCamera);
  const selectedUnitIdRef = useRef<string | null>(selectedUnitId);
  const lastDirectorShotIdRef = useRef<string>('');
  const onSelectUnitRef = useRef(onSelectUnit);
  const onUserManualCameraRef = useRef(onUserManualCamera);

  const [webglLost, setWebglLost] = useState(false);
  const [initializing, setInitializing] = useState(true);

  layersRef.current = layers;
  mapModeRef.current = mapMode;
  autoCameraRef.current = autoCamera;
  selectedUnitIdRef.current = selectedUnitId;
  onSelectUnitRef.current = onSelectUnit;
  onUserManualCameraRef.current = onUserManualCamera;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const tileset = googleTilesetRef.current;
    const baseLayer = baseImageryLayerRef.current;

    if (mapMode === 'google3d' && tileset) {
      tileset.show = true;
      viewer.scene.globe.show = !googleTilesReadyRef.current;
    } else {
      if (tileset) {
        tileset.show = false;
      }
      viewer.scene.globe.show = true;
      if (baseLayer) {
        baseLayer.brightness = 0.42;
        baseLayer.contrast = 1.25;
        baseLayer.saturation = 0.25;
      }
    }
  }, [mapMode]);

  useEffect(() => {
    if (!flyRequest) return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const { spec } = flyRequest;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(spec.lon, spec.lat, spec.height),
      orientation: {
        heading: Cesium.Math.toRadians(spec.headingDeg),
        pitch: Cesium.Math.toRadians(spec.pitchDeg),
        roll: 0,
      },
      duration: spec.duration ?? 2.0,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }, [flyRequest]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    const ionToken =
      (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) || DEFAULT_CESIUM_ION_TOKEN;
    Cesium.Ion.defaultAccessToken = ionToken;

    const viewer = new Cesium.Viewer(container, {
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
      requestRenderMode: false,
      msaaSamples: 4,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      baseLayer: false,
    });

    viewerRef.current = viewer;

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050912');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#081322');
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
    if (viewer.scene.sun) {
      viewer.scene.sun.show = false;
    }
    if (viewer.scene.moon) {
      viewer.scene.moon.show = false;
    }

    const openShot = DIRECTOR_SHOTS[0];
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        openShot.lon,
        openShot.lat,
        openShot.height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(openShot.headingDeg),
        pitch: Cesium.Math.toRadians(openShot.pitchDeg),
        roll: 0,
      },
    });

    const canvas = viewer.scene.canvas;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    (async () => {
      try {
        const ionImagery = await Cesium.IonImageryProvider.fromAssetId(2);
        if (disposed || viewer.isDestroyed()) return;
        const layer = viewer.imageryLayers.addImageryProvider(ionImagery);
        layer.brightness = 0.45;
        layer.contrast = 1.22;
        layer.saturation = 0.28;
        baseImageryLayerRef.current = layer;
      } catch {
        if (disposed || viewer.isDestroyed()) return;
        try {
          const osm = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
          const layer = viewer.imageryLayers.addImageryProvider(osm);
          layer.brightness = 0.35;
          layer.contrast = 1.3;
          layer.saturation = 0.18;
          baseImageryLayerRef.current = layer;
        } catch {
          // Globe solid color remains clean fallback
        }
      }
    })();

    onTilesStatusChange('loading');
    (async () => {
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset(
          { onlyUsingWithGoogleGeocoder: true },
          {
            maximumScreenSpaceError: 14,
            showCreditsOnScreen: true,
          }
        );
        if (disposed || viewer.isDestroyed()) return;

        googleTilesetRef.current = tileset;
        viewer.scene.primitives.add(tileset);
        tileset.show = mapModeRef.current === 'google3d';

        const markTilesLoaded = () => {
          if (disposed || viewer.isDestroyed()) return;
          googleTilesReadyRef.current = true;
          if (mapModeRef.current === 'google3d') {
            viewer.scene.globe.show = false;
          }
          setInitializing(false);
          onTilesStatusChange('google3d');
        };

        tileset.initialTilesLoaded.addEventListener(markTilesLoaded);
        if (tileset.tilesLoaded) {
          markTilesLoaded();
        }

        window.setTimeout(() => {
          if (!disposed && !viewer.isDestroyed()) {
            setInitializing(false);
          }
        }, 2600);
      } catch (err) {
        console.warn('Google Photorealistic 3D Tiles failed to load, falling back to satellite globe:', err);
        if (!disposed && !viewer.isDestroyed()) {
          viewer.scene.globe.show = true;
          setInitializing(false);
          onTilesStatusChange('fallback');
        }
      }
    })();

    // =========================================================================
    // REGISTER PERSISTENT 3D STRATEGIC REFERENCE LINES & LANDMARKS
    // =========================================================================
    viewer.entities.add({
      id: 'ref_median_line',
      polyline: {
        show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
        positions: MEDIAN_LINE_COORDS.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)),
        width: 2.2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#F59E0B').withAlpha(0.72),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: 18,
        }),
      },
    });

    viewer.entities.add({
      id: 'ref_median_label',
      position: Cesium.Cartesian3.fromDegrees(119.55, 24.3, 1800),
      label: {
        show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
        text: '海峽中線',
        font: '600 11px "Noto Sans TC", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#FDE68A').withAlpha(0.92),
        outlineColor: Cesium.Color.fromCssColorString('#060A12'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#070B12').withAlpha(0.65),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1500000),
      },
    });

    viewer.entities.add({
      id: 'ref_first_island_chain',
      polyline: {
        show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
        positions: FIRST_ISLAND_CHAIN_COORDS.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        ),
        width: 1.6,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#38BDF8').withAlpha(0.4),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: 24,
        }),
      },
    });

    viewer.entities.add({
      id: 'ref_dmz_line',
      polyline: {
        show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
        positions: DMZ_38_LINE_COORDS.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
        ),
        width: 2.4,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#FB7185').withAlpha(0.84),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: 14,
        }),
      },
    });

    viewer.entities.add({
      id: 'ref_dmz_label',
      position: Cesium.Cartesian3.fromDegrees(127.05, 38.05, 1900),
      label: {
        show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
        text: '南北韓三八線 (DMZ)',
        font: '600 11px "Noto Sans TC", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#FDA4AF').withAlpha(0.95),
        outlineColor: Cesium.Color.fromCssColorString('#060A12'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#070B12').withAlpha(0.68),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2200000),
      },
    });

    const STRATEGIC_LANDMARKS: Array<{ id: string; text: string; lon: number; lat: number }> = [
      { id: 'lm_taipei', text: '大台北 / 台北港', lon: 121.48, lat: 25.12 },
      { id: 'lm_taichung', text: '台中清水港', lon: 120.53, lat: 24.25 },
      { id: 'lm_hualien', text: '花蓮佳山基地', lon: 121.62, lat: 23.98 },
      { id: 'lm_zuoying', text: '高雄左營港', lon: 120.26, lat: 22.68 },
      { id: 'lm_penghu', text: '澎湖群島', lon: 119.58, lat: 23.56 },
      { id: 'lm_kinmen', text: '金門', lon: 118.38, lat: 24.44 },
      { id: 'lm_matsu', text: '馬祖', lon: 119.95, lat: 26.16 },
      { id: 'lm_dongsha', text: '東沙島', lon: 116.73, lat: 20.7 },
      { id: 'lm_strait', text: '台灣海峽', lon: 119.35, lat: 24.45 },
      { id: 'lm_pingtan', text: '福建平潭', lon: 119.79, lat: 25.51 },
      { id: 'lm_xiamen', text: '廈門', lon: 118.09, lat: 24.48 },
      { id: 'lm_zhanjiang', text: '湛江／海南亞龍灣', lon: 110.36, lat: 20.6 },
      { id: 'lm_zhoushan', text: '浙東舟山／寧波母港', lon: 122.15, lat: 29.96 },
      { id: 'lm_wuhan', text: '武漢／中部戰區樞紐', lon: 114.3, lat: 30.59 },
      { id: 'lm_chengdu', text: '成都／西部轉場樞紐', lon: 104.06, lat: 30.67 },
      { id: 'lm_yonaguni', text: '與那國島', lon: 123.0, lat: 24.46 },
      { id: 'lm_miyako', text: '宮古海峽', lon: 125.45, lat: 25.1 },
      { id: 'lm_kadena', text: '沖繩嘉手納 / 那霸', lon: 127.72, lat: 26.28 },
      { id: 'lm_sasebo', text: '日本九州・佐世保', lon: 129.72, lat: 33.16 },
      { id: 'lm_yokosuka', text: '日本本州・橫須賀', lon: 139.66, lat: 35.29 },
      { id: 'lm_bashi', text: '巴士海峽', lon: 121.1, lat: 20.95 },
      { id: 'lm_luzon_edca', text: '呂宋 EDCA 前進基地', lon: 121.75, lat: 17.62 },
      { id: 'lm_spratlys', text: '南海永暑／美濟島礁', lon: 113.5, lat: 9.8 },
      { id: 'lm_camranh', text: '越南金蘭灣', lon: 109.25, lat: 11.88 },
      { id: 'lm_singapore', text: '新加坡／馬六甲咽喉', lon: 103.85, lat: 1.35 },
      { id: 'lm_andaman', text: '印度安達曼／布萊爾港', lon: 92.73, lat: 11.62 },
      { id: 'lm_malacca_west', text: '麻六甲西口／印度洋入口', lon: 96.8, lat: 6.2 },
      { id: 'lm_natuna', text: '印尼納土納群島', lon: 108.15, lat: 3.9 },
      { id: 'lm_darwin', text: '澳洲達爾文／廷達爾', lon: 130.9, lat: -12.46 },
      { id: 'lm_auckland', text: '紐西蘭奧克蘭基地', lon: 174.76, lat: -36.84 },
      { id: 'lm_qingdao', text: '北部戰區青島', lon: 120.38, lat: 36.07 },
      { id: 'lm_seoul_osan', text: '韓美首爾／烏山基地', lon: 127.03, lat: 37.09 },
      { id: 'lm_pyongyang', text: '北韓平壤', lon: 125.76, lat: 39.03 },
    ];

    STRATEGIC_LANDMARKS.forEach((lm) => {
      viewer.entities.add({
        id: lm.id,
        position: Cesium.Cartesian3.fromDegrees(lm.lon, lm.lat, 850),
        point: {
          show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
          pixelSize: 4,
          color: Cesium.Color.fromCssColorString('#CBD5E1').withAlpha(0.8),
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          show: new Cesium.CallbackProperty(() => layersRef.current.references, false),
          text: lm.text,
          font: '500 11px "Noto Sans TC", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#E2E8F0').withAlpha(0.85),
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6800000),
        },
      });
    });

    // =========================================================================
    // REGISTER PERSISTENT 3D HEMISPHERICAL RADAR & AIR-DEFENSE DOMES (LOCAL ENU)
    // =========================================================================
    const zeroHpr = new Cesium.HeadingPitchRoll(0, 0, 0);
    RADAR_DOMES.forEach((radarDef, rIdx) => {
      const fillCol = getFactionCesiumColor(radarDef.faction, 0.085);
      const outlineCol = getFactionCesiumColor(radarDef.faction, 0.34);

      viewer.entities.add({
        id: `radar_${radarDef.id}`,
        position: new Cesium.CallbackProperty(() => {
          const r = snapshotRef.current.radars[rIdx];
          return Cesium.Cartesian3.fromDegrees(r.lon, r.lat, r.alt);
        }, false) as unknown as Cesium.PositionProperty,
        orientation: new Cesium.CallbackProperty(() => {
          const r = snapshotRef.current.radars[rIdx];
          const pos = Cesium.Cartesian3.fromDegrees(r.lon, r.lat, r.alt);
          return Cesium.Transforms.headingPitchRollQuaternion(pos, zeroHpr);
        }, false) as unknown as Cesium.Property,
        ellipsoid: {
          show: new Cesium.CallbackProperty(
            () => layersRef.current.radar && snapshotRef.current.radars[rIdx].active,
            false
          ),
          radii: new Cesium.Cartesian3(
            radarDef.radiusMeters,
            radarDef.radiusMeters,
            Math.min(radarDef.radiusMeters * 0.42, 72000)
          ),
          maximumCone: Cesium.Math.PI_OVER_TWO,
          material: fillCol,
          outline: true,
          outlineColor: outlineCol,
          outlineWidth: 1,
          stackPartitions: 10,
          slicePartitions: 24,
        },
      });
    });

    // =========================================================================
    // REGISTER PERSISTENT COMBAT FLASHPOINT ZONES
    // =========================================================================
    ENGAGEMENT_ZONES.forEach((zoneDef, zIdx) => {
      const zoneColor =
        zoneDef.category === 'beachhead'
          ? '#F97316'
          : zoneDef.category === 'naval'
            ? '#EF4444'
            : zoneDef.category === 'standoff'
              ? '#FB7185'
              : '#F59E0B';

      viewer.entities.add({
        id: `zone_${zoneDef.id}`,
        position: Cesium.Cartesian3.fromDegrees(
          zoneDef.position.lon,
          zoneDef.position.lat,
          zoneDef.position.alt
        ),
        ellipse: {
          show: new Cesium.CallbackProperty(
            () => layersRef.current.references && snapshotRef.current.engagements[zIdx].active,
            false
          ),
          semiMajorAxis: new Cesium.CallbackProperty(() => {
            const z = snapshotRef.current.engagements[zIdx];
            return zoneDef.radiusMeters * (0.86 + z.pulse * 0.24);
          }, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => {
            const z = snapshotRef.current.engagements[zIdx];
            return zoneDef.radiusMeters * (0.86 + z.pulse * 0.24);
          }, false),
          height: zoneDef.position.alt,
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const z = snapshotRef.current.engagements[zIdx];
              return Cesium.Color.fromCssColorString(zoneColor).withAlpha(0.08 + z.pulse * 0.08);
            }, false)
          ),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(zoneColor).withAlpha(0.65),
          outlineWidth: 1.5,
        },
      });
    });

    // =========================================================================
    // REGISTER OCCUPIED & CONTESTED TERRITORY CONTROL POLYGONS
    // =========================================================================
    TERRITORY_ZONES.forEach((tzDef, tIdx) => {
      const flatDegs: number[] = [];
      tzDef.polygon.forEach((pt) => {
        flatDegs.push(pt.lon, pt.lat);
      });

      viewer.entities.add({
        id: `territory_poly_${tzDef.id}`,
        position: Cesium.Cartesian3.fromDegrees(tzDef.center.lon, tzDef.center.lat, 520),
        polygon: {
          show: new Cesium.CallbackProperty(() => layersRef.current.territory, false),
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegs),
          height: 360,
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const t = snapshotRef.current.territories[tIdx];
              const alpha = t.controller === 'contested' ? 0.24 : 0.2;
              return getTerritoryColor(t.controller, alpha);
            }, false)
          ),
          outline: true,
          outlineColor: new Cesium.CallbackProperty(() => {
            const t = snapshotRef.current.territories[tIdx];
            return getTerritoryColor(t.controller, 0.88);
          }, false),
          outlineWidth: 2,
        },
        label: {
          show: new Cesium.CallbackProperty(() => layersRef.current.territory, false),
          text: new Cesium.CallbackProperty(() => {
            const t = snapshotRef.current.territories[tIdx];
            return `${tzDef.name} · ${t.statusLabel}`;
          }, false),
          font: '600 11px "Noto Sans TC", sans-serif',
          fillColor: new Cesium.CallbackProperty(() => {
            const t = snapshotRef.current.territories[tIdx];
            if (t.controller === 'pla') return Cesium.Color.fromCssColorString('#FECACA');
            if (t.controller === 'contested') return Cesium.Color.fromCssColorString('#FED7AA');
            if (t.controller === 'jsdf') return Cesium.Color.fromCssColorString('#FDE68A');
            if (t.controller === 'us') return Cesium.Color.fromCssColorString('#A5F3FC');
            if (t.controller === 'anzac') return Cesium.Color.fromCssColorString('#99F6E4');
            if (t.controller === 'sea_asean') return Cesium.Color.fromCssColorString('#C7D2FE');
            if (t.controller === 'ind') return Cesium.Color.fromCssColorString('#ECFCCB');
            if (t.controller === 'uk_fr') return Cesium.Color.fromCssColorString('#F3E8FF');
            return Cesium.Color.fromCssColorString('#BFDBFE');
          }, false),
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#070B12').withAlpha(0.76),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5600000),
        },
      });
    });

    // =========================================================================
    // REGISTER ALL MULTI-DOMAIN FORCE UNITS
    // =========================================================================
    UNITS.forEach((unitDef, uIdx) => {
      const iconUrl = getTacticalIconDataUrl(unitDef.faction, unitDef.unitClass);
      const isAir = unitDef.domain === 'air';
      const isSea = unitDef.domain === 'sea';

      const isDomainVisible = () => {
        const l = layersRef.current;
        if (unitDef.domain === 'land') return l.land;
        if (unitDef.domain === 'sea') return l.sea;
        if (unitDef.domain === 'air') return l.air;
        return l.missile;
      };

      const unitEntity = viewer.entities.add({
        id: `unit_${unitDef.id}`,
        position: new Cesium.CallbackProperty(() => {
          const u = snapshotRef.current.units[uIdx];
          return Cesium.Cartesian3.fromDegrees(u.lon, u.lat, u.alt);
        }, false) as unknown as Cesium.PositionProperty,
        billboard: {
          show: new Cesium.CallbackProperty(
            () => isDomainVisible() && snapshotRef.current.units[uIdx].active,
            false
          ),
          image: iconUrl,
          scale: new Cesium.CallbackProperty(() => {
            const isSelected = selectedUnitIdRef.current === unitDef.id;
            const baseScale = unitDef.unitClass === 'carrier' ? 0.46 : isAir ? 0.36 : 0.38;
            return isSelected ? baseScale * 1.28 : baseScale;
          }, false),
          alignedAxis: isAir ? Cesium.Cartesian3.UNIT_Z : Cesium.Cartesian3.ZERO,
          rotation: isAir
            ? new Cesium.CallbackProperty(
                () => -Cesium.Math.toRadians(snapshotRef.current.units[uIdx].headingDeg),
                false
              )
            : 0,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(80000, 1.15, 2400000, 0.58),
        },
        label: {
          show: new Cesium.CallbackProperty(
            () => isDomainVisible() && snapshotRef.current.units[uIdx].active,
            false
          ),
          text: new Cesium.CallbackProperty(() => {
            const u = snapshotRef.current.units[uIdx];
            return `${unitDef.callsign} · ${u.effectiveCount}${unitDef.unitLabel}`;
          }, false),
          font: '600 11px "JetBrains Mono", "Noto Sans TC", sans-serif',
          fillColor: getFactionSoftColor(unitDef.faction, 0.98),
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#070B12').withAlpha(0.76),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          pixelOffset: new Cesium.Cartesian2(0, 24),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2600000),
        },
      });

      (unitEntity as unknown as { __unitId?: string }).__unitId = unitDef.id;

      if (isAir || isSea) {
        viewer.entities.add({
          id: `trail_${unitDef.id}`,
          polyline: {
            show: new Cesium.CallbackProperty(
              () =>
                isDomainVisible() &&
                snapshotRef.current.units[uIdx].active &&
                snapshotRef.current.units[uIdx].trail.length >= 2,
              false
            ),
            positions: new Cesium.CallbackProperty(() => {
              const pts = snapshotRef.current.units[uIdx].trail;
              if (pts.length < 2) return undefined;
              return pts.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt));
            }, false),
            width: isAir ? 2.4 : 2.0,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              taperPower: 0.6,
              color: getFactionCesiumColor(unitDef.faction, isAir ? 0.72 : 0.45),
            }),
          },
        });
      }

      if (isAir) {
        viewer.entities.add({
          id: `stem_${unitDef.id}`,
          polyline: {
            show: new Cesium.CallbackProperty(
              () => isDomainVisible() && snapshotRef.current.units[uIdx].active,
              false
            ),
            positions: new Cesium.CallbackProperty(() => {
              const u = snapshotRef.current.units[uIdx];
              return [
                Cesium.Cartesian3.fromDegrees(u.lon, u.lat, u.alt),
                Cesium.Cartesian3.fromDegrees(u.lon, u.lat, 120),
              ];
            }, false),
            width: 1.0,
            material: getFactionCesiumColor(unitDef.faction, 0.26),
          },
        });
      }
    });

    // =========================================================================
    // REGISTER BALLISTIC / CRUISE / ANTI-SHIP MISSILES & MID-AIR INTERCEPTS
    // =========================================================================
    MISSILE_SALVOS.forEach((salvoDef, mIdx) => {
      const mColor =
        salvoDef.weaponType === 'hypersonic'
          ? Cesium.Color.fromCssColorString('#FB7185').withAlpha(0.98)
          : salvoDef.weaponType === 'mlrs'
            ? Cesium.Color.fromCssColorString('#F97316').withAlpha(0.96)
            : getFactionCesiumColor(salvoDef.faction, 0.96);
      const isHeavyBallistic =
        salvoDef.weaponType === 'asbm' ||
        salvoDef.weaponType === 'ballistic' ||
        salvoDef.weaponType === 'hypersonic';

      viewer.entities.add({
        id: `msl_arc_${salvoDef.id}`,
        polyline: {
          show: new Cesium.CallbackProperty(
            () =>
              layersRef.current.missile &&
              snapshotRef.current.missiles[mIdx].active &&
              snapshotRef.current.missiles[mIdx].trail.length >= 2,
            false
          ),
          positions: new Cesium.CallbackProperty(() => {
            const m = snapshotRef.current.missiles[mIdx];
            if (!m.active || m.trail.length < 2) return undefined;
            return m.trail.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt));
          }, false),
          width: isHeavyBallistic ? 4.4 : 3.4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.36,
            taperPower: 0.45,
            color: mColor,
          }),
        },
      });

      viewer.entities.add({
        id: `msl_head_${salvoDef.id}`,
        position: new Cesium.CallbackProperty(() => {
          const h = snapshotRef.current.missiles[mIdx].head;
          return Cesium.Cartesian3.fromDegrees(h.lon, h.lat, h.alt);
        }, false) as unknown as Cesium.PositionProperty,
        point: {
          show: new Cesium.CallbackProperty(
            () => layersRef.current.missile && snapshotRef.current.missiles[mIdx].active,
            false
          ),
          pixelSize: isHeavyBallistic ? 8.5 : 7,
          color: Cesium.Color.WHITE,
          outlineColor: mColor,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          show: new Cesium.CallbackProperty(
            () => layersRef.current.missile && snapshotRef.current.missiles[mIdx].active,
            false
          ),
          text:
            salvoDef.weaponType === 'asbm'
              ? 'DF-26 ASBM'
              : salvoDef.weaponType === 'hypersonic'
                ? salvoDef.id === 'msl_pla_fujian_yj21'
                  ? 'YJ-21 高超音速'
                  : 'DF-17 高超音速'
                : salvoDef.weaponType === 'mlrs'
                  ? 'PHL-191 遠火齊射'
                  : salvoDef.weaponType === 'antiship'
                    ? salvoDef.faction === 'us'
                      ? 'LRASM / 戰斧'
                      : salvoDef.faction === 'anzac'
                        ? 'JSM / LRASM'
                        : salvoDef.faction === 'ind'
                          ? 'BrahMos 反艦'
                          : salvoDef.faction === 'sea_asean'
                            ? 'BrahMos / 縞瑪瑙'
                            : salvoDef.faction === 'jsdf'
                              ? '12式反艦'
                              : salvoDef.faction === 'pla'
                                ? '鷹擊-18 反艦'
                                : salvoDef.id === 'msl_roc_harpoon_cross'
                                  ? '岸置魚叉 RGM-84'
                                  : '雄風三型'
                    : salvoDef.weaponType === 'cruise'
                      ? salvoDef.faction === 'us'
                        ? salvoDef.id === 'msl_us_conus_jassm_er'
                          ? 'JASSM-ER 匿蹤巡弋'
                          : '戰斧飛彈'
                        : salvoDef.faction === 'uk_fr'
                          ? 'SCALP / 風暴陰影'
                          : salvoDef.faction === 'anzac'
                            ? 'PrSM 遠打'
                            : salvoDef.faction === 'roc'
                              ? '雄二E 巡弋反擊'
                              : '長劍巡弋'
                      : salvoDef.faction === 'dprk'
                        ? 'KN-23 彈道試射'
                        : '東風彈道飛彈',
          font: '600 10px "JetBrains Mono", "Noto Sans TC", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -10),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2900000),
        },
      });

      if (salvoDef.intercept) {
        const defColor = getFactionCesiumColor(salvoDef.intercept.defenderFaction, 0.98);
        viewer.entities.add({
          id: `msl_int_arc_${salvoDef.id}`,
          polyline: {
            show: new Cesium.CallbackProperty(
              () =>
                layersRef.current.missile &&
                snapshotRef.current.missiles[mIdx].interceptActive &&
                (snapshotRef.current.missiles[mIdx].interceptorTrail?.length ?? 0) >= 2,
              false
            ),
            positions: new Cesium.CallbackProperty(() => {
              const pts = snapshotRef.current.missiles[mIdx].interceptorTrail;
              if (!pts || pts.length < 2) return undefined;
              return pts.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt));
            }, false),
            width: 3.0,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.42,
              taperPower: 0.5,
              color: defColor,
            }),
          },
        });

        viewer.entities.add({
          id: `msl_int_head_${salvoDef.id}`,
          position: new Cesium.CallbackProperty(() => {
            const p =
              snapshotRef.current.missiles[mIdx].interceptorHead ??
              salvoDef.intercept!.defenderOrigin;
            return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt);
          }, false) as unknown as Cesium.PositionProperty,
          point: {
            show: new Cesium.CallbackProperty(
              () =>
                layersRef.current.missile && snapshotRef.current.missiles[mIdx].interceptActive,
              false
            ),
            pixelSize: 6.5,
            color: Cesium.Color.fromCssColorString('#E0F2FE'),
            outlineColor: defColor,
            outlineWidth: 2.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }

      viewer.entities.add({
        id: `msl_burst_${salvoDef.id}`,
        position: new Cesium.CallbackProperty(() => {
          const p = snapshotRef.current.missiles[mIdx].burstPoint ?? salvoDef.target;
          return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt);
        }, false) as unknown as Cesium.PositionProperty,
        ellipsoid: {
          show: new Cesium.CallbackProperty(
            () => layersRef.current.missile && snapshotRef.current.missiles[mIdx].burstActive,
            false
          ),
          radii: new Cesium.CallbackProperty(() => {
            const m = snapshotRef.current.missiles[mIdx];
            const maxR = salvoDef.weaponType === 'asbm' ? 28000 : 12500;
            const r = Math.max(900, maxR * Math.sin(m.burstProgress * Math.PI * 0.85));
            return new Cesium.Cartesian3(r, r, r);
          }, false),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const m = snapshotRef.current.missiles[mIdx];
              const alpha = Math.max(0.02, (1 - m.burstProgress) * 0.72);
              const hex = m.burstIsIntercept ? '#38BDF8' : '#FB923C';
              return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
            }, false)
          ),
          outline: true,
          outlineColor: new Cesium.CallbackProperty(() => {
            const m = snapshotRef.current.missiles[mIdx];
            const alpha = Math.max(0.05, (1 - m.burstProgress) * 0.9);
            const hex = m.burstIsIntercept ? '#E0F2FE' : '#FDE047';
            return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
          }, false),
          stackPartitions: 10,
          slicePartitions: 14,
        },
        label: {
          show: new Cesium.CallbackProperty(
            () =>
              layersRef.current.missile &&
              snapshotRef.current.missiles[mIdx].burstActive &&
              snapshotRef.current.missiles[mIdx].burstProgress < 0.75,
            false
          ),
          text: salvoDef.intercept
            ? `攔截成功 · ${salvoDef.intercept.interceptorLabel}`
            : '高烈度命中目標區',
          font: '600 10px "Noto Sans TC", sans-serif',
          fillColor: salvoDef.intercept
            ? Cesium.Color.fromCssColorString('#BAE6FD')
            : Cesium.Color.fromCssColorString('#FED7AA'),
          outlineColor: Cesium.Color.fromCssColorString('#050912'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2900000),
        },
      });
    });

    const removePreUpdate = viewer.scene.preUpdate.addEventListener(() => {
      if (!autoCameraRef.current) return;
      const shot = snapshotRef.current.activeDirectorShot;
      if (shot.id !== lastDirectorShotIdRef.current) {
        lastDirectorShotIdRef.current = shot.id;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(shot.lon, shot.lat, shot.height),
          orientation: {
            heading: Cesium.Math.toRadians(shot.headingDeg),
            pitch: Cesium.Math.toRadians(shot.pitchDeg),
            roll: 0,
          },
          duration: shot.duration ?? 2.8,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
      }
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    let pointerDownPos: Cesium.Cartesian2 | null = null;
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      pointerDownPos = movement.position.clone();
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (pointerDownPos && autoCameraRef.current) {
        const dist = Cesium.Cartesian2.distance(pointerDownPos, movement.endPosition);
        if (dist > 8) {
          onUserManualCameraRef.current();
          pointerDownPos = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      pointerDownPos = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    handler.setInputAction(() => {
      if (autoCameraRef.current) onUserManualCameraRef.current();
    }, Cesium.ScreenSpaceEventType.WHEEL);

    handler.setInputAction(() => {
      if (autoCameraRef.current) onUserManualCameraRef.current();
    }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) {
        const unitId = (picked.id as { __unitId?: string }).__unitId;
        if (unitId) {
          onSelectUnitRef.current(unitId);
          return;
        }
      }
      onSelectUnitRef.current(null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      disposed = true;
      removePreUpdate();
      handler.destroy();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      googleTilesetRef.current = null;
      googleTilesReadyRef.current = false;
    };
  }, [snapshotRef, onTilesStatusChange]);

  useEffect(() => {
    if (autoCamera) {
      lastDirectorShotIdRef.current = '';
    }
  }, [autoCamera]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050912]">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {initializing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#050912]/72 backdrop-blur-xs transition-opacity duration-500">
          <div className="flex flex-col items-center gap-3 px-6 py-5 bg-[#080E1A]/90 border border-white/10 rounded-lg">
            <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
            <div className="text-sm font-medium text-slate-100">
              正在載入 Google 3D 實景圖資與多戰區聯動推演場域
            </div>
            <div className="text-xs text-slate-400 font-mono-tabular">
              CesiumJS · WGS84 · 第一島鏈與西太平洋戰區
            </div>
          </div>
        </div>
      )}

      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050912]/90">
          <div className="max-w-md px-6 py-5 bg-[#0B1220] border border-white/15 rounded-lg text-center">
            <h2 className="text-base font-semibold text-slate-100">WebGL 3D 繪圖環境已中斷</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              瀏覽器暫時釋放了 3D 圖形加速資源，系統正嘗試自動恢復地球視圖。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
