import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Compass,
  Crosshair,
  Eye,
  Flame,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  RotateCcw,
  Route,
  Sliders,
  Sparkles,
  Truck,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { COMMUNITY_BASELINE_STATS } from '../data/koratHealthData';
import { ElderProfile } from '../types/health';

export interface EnrichedVillageOutreachPoint {
  id: string;
  village: string;
  subdistrict: string;
  rphFacility: string;
  lat: number;
  lng: number;
  screenedElders: number;
  baselineGroupDCount: number;
  previous7DayGroupDCount: number;
  vhvLead: string;
  outreachTeamRequired: number;
  bpKitsAllocated: number;
  priorityLevel: 'critical' | 'high' | 'moderate';
  outreachNote: string;
  groupDCount: number;
  previous7dCount: number;
  sevenDayDeltaCount: number;
  sevenDayGrowthPct: number;
  isHighRiskSurge7d: boolean;
  densityPct: number;
  xPct: number;
  yPct: number;
  matchingElders: ElderProfile[];
  exactVillageElders: ElderProfile[];
  liveGroupDInVillage: ElderProfile[];
}

interface SubdistrictPolygonSpec {
  id: string;
  subdistrict: string;
  zoneLabel: string;
  rphHub: string;
  centerLngLat: [number, number];
  coordinates: Array<[number, number]>; // [lng, lat]
  baselineGroupD: number;
  screenedPop: number;
}

// Stylized geospatial subdistrict zones of Mueang Nakhon Ratchasima District (WGS84 [lng, lat])
const KORAT_SUBDISTRICT_ZONES: SubdistrictPolygonSpec[] = [
  {
    id: 'ZONE-NAI-MUEANG',
    subdistrict: 'ต.ในเมือง',
    zoneLabel: 'เขตเทศบาลนคร (ต.ในเมือง / คูเมือง)',
    rphHub: 'ศบส.เทศบาลนคร / รพ.มหาราชฯ',
    centerLngLat: [102.098, 14.976],
    coordinates: [
      [102.078, 14.992],
      [102.114, 14.993],
      [102.118, 14.966],
      [102.082, 14.963],
    ],
    baselineGroupD: 28,
    screenedPop: 382,
  },
  {
    id: 'ZONE-HUA-THALE',
    subdistrict: 'ต.หัวทะเล',
    zoneLabel: 'โซนตะวันออกเฉียงใต้ (ต.หัวทะเล / บ้านดอนขวาง)',
    rphHub: 'รพ.สต.หัวทะเล',
    centerLngLat: [102.132, 14.953],
    coordinates: [
      [102.118, 14.966],
      [102.114, 14.993],
      [102.154, 14.982],
      [102.158, 14.942],
      [102.114, 14.938],
    ],
    baselineGroupD: 25,
    screenedPop: 312,
  },
  {
    id: 'ZONE-PHO-KLANG',
    subdistrict: 'ต.โพธิ์กลาง',
    zoneLabel: 'โซนกลาง-ใต้ (ต.โพธิ์กลาง / หนองไผ่ล้อม)',
    rphHub: 'รพ.สต.โพธิ์กลาง',
    centerLngLat: [102.088, 14.944],
    coordinates: [
      [102.064, 14.962],
      [102.082, 14.963],
      [102.118, 14.966],
      [102.114, 14.938],
      [102.106, 14.918],
      [102.066, 14.922],
    ],
    baselineGroupD: 22,
    screenedPop: 284,
  },
  {
    id: 'ZONE-NONG-BUA-SALA',
    subdistrict: 'ต.หนองบัวศาลา',
    zoneLabel: 'โซนใต้ (ต.หนองบัวศาลา / หนองระเวียง)',
    rphHub: 'รพ.สต.หนองบัวศาลา',
    centerLngLat: [102.134, 14.923],
    coordinates: [
      [102.114, 14.938],
      [102.158, 14.942],
      [102.152, 14.912],
      [102.106, 14.914],
    ],
    baselineGroupD: 18,
    screenedPop: 228,
  },
  {
    id: 'ZONE-CHO-HO',
    subdistrict: 'ต.จอหอ',
    zoneLabel: 'โซนตะวันออกเฉียงเหนือ (ต.จอหอ / บ้านเกาะ)',
    rphHub: 'รพ.สต.จอหอ',
    centerLngLat: [102.131, 15.018],
    coordinates: [
      [102.104, 15.044],
      [102.148, 15.042],
      [102.154, 14.982],
      [102.114, 14.993],
      [102.102, 15.012],
    ],
    baselineGroupD: 21,
    screenedPop: 276,
  },
  {
    id: 'ZONE-MUEN-WAI',
    subdistrict: 'ต.หมื่นไวย',
    zoneLabel: 'โซนเหนือลุ่มน้ำลำตะคอง (ต.หมื่นไวย / โคกสูง)',
    rphHub: 'รพ.สต.หมื่นไวย',
    centerLngLat: [102.078, 15.016],
    coordinates: [
      [102.048, 15.038],
      [102.104, 15.044],
      [102.102, 15.012],
      [102.114, 14.993],
      [102.078, 14.992],
      [102.052, 14.995],
    ],
    baselineGroupD: 16,
    screenedPop: 210,
  },
  {
    id: 'ZONE-BAN-MAI',
    subdistrict: 'ต.บ้านใหม่',
    zoneLabel: 'โซนตะวันตก (ต.บ้านใหม่ / ศีรษะละเลิง)',
    rphHub: 'รพ.สต.บ้านใหม่',
    centerLngLat: [102.036, 14.972],
    coordinates: [
      [102.008, 15.002],
      [102.048, 15.038],
      [102.052, 14.995],
      [102.078, 14.992],
      [102.082, 14.963],
      [102.064, 14.962],
      [102.012, 14.952],
    ],
    baselineGroupD: 17,
    screenedPop: 224,
  },
  {
    id: 'ZONE-KHOK-KRUAT',
    subdistrict: 'ต.โคกกรวด',
    zoneLabel: 'โซนตะวันตกเฉียงใต้ (ต.โคกกรวด / สุรนารี)',
    rphHub: 'รพ.สต.โคกกรวด',
    centerLngLat: [102.018, 14.934],
    coordinates: [
      [101.986, 14.954],
      [102.012, 14.952],
      [102.064, 14.962],
      [102.066, 14.922],
      [102.022, 14.914],
      [101.988, 14.922],
    ],
    baselineGroupD: 20,
    screenedPop: 255,
  },
];

interface HeatmapSamplePoint {
  x: number;
  y: number;
  weight: number;
  villageId?: string;
}

export type HeatmapLayerMode = 'kde_contour' | 'choropleth_hybrid' | 'voronoi_catchment';
export type HeatmapWeightMetric = 'group_d_count' | 'prevalence_pct' | 'surge_7d';

interface KoratGroupDGeospatialHeatmapProps {
  villageOutreachPoints: EnrichedVillageOutreachPoint[];
  visibleMapNodes: EnrichedVillageOutreachPoint[];
  selectedVillageNode: EnrichedVillageOutreachPoint;
  onSelectVillage: (villageId: string) => void;
  onFilterByVillageAndSubdistrict?: (village: string, subdistrict: string) => void;
}

const SVG_WIDTH = 860;
const SVG_HEIGHT = 520;

export const KoratGroupDGeospatialHeatmap: React.FC<KoratGroupDGeospatialHeatmapProps> = ({
  villageOutreachPoints,
  visibleMapNodes,
  selectedVillageNode,
  onSelectVillage,
  onFilterByVillageAndSubdistrict,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);

  const [layerMode, setLayerMode] = useState<HeatmapLayerMode>('kde_contour');
  const [weightMetric, setWeightMetric] = useState<HeatmapWeightMetric>('group_d_count');
  const [kdeBandwidth, setKdeBandwidth] = useState<number>(38);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.78);
  const [showOutreachCorridor, setShowOutreachCorridor] = useState<boolean>(true);
  const [showSubdistrictLabels, setShowSubdistrictLabels] = useState<boolean>(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  // 1. D3 GeoMercator Projection calibrated for Mueang Nakhon Ratchasima District
  const projection = useMemo(() => {
    return d3
      .geoMercator()
      .center([102.075, 14.976])
      .scale(245000)
      .translate([SVG_WIDTH / 2, SVG_HEIGHT / 2]);
  }, []);

  // Helper to project [lng, lat] -> [x, y]
  const projectCoord = (lngLat: [number, number]): [number, number] => {
    const res = projection(lngLat);
    return res ? [res[0], res[1]] : [SVG_WIDTH / 2, SVG_HEIGHT / 2];
  };

  // Closed polygon path generator using D3 line + projection
  const polygonLineGenerator = useMemo(() => {
    return d3
      .line<[number, number]>()
      .x((d) => projectCoord(d)[0])
      .y((d) => projectCoord(d)[1])
      .curve(d3.curveCatmullRomClosed.alpha(0.35));
  }, [projection]);

  const linearPolygonGenerator = useMemo(() => {
    return d3
      .line<[number, number]>()
      .x((d) => projectCoord(d)[0])
      .y((d) => projectCoord(d)[1])
      .curve(d3.curveLinearClosed);
  }, [projection]);

  const openPathGenerator = useMemo(() => {
    return d3
      .line<[number, number]>()
      .x((d) => projectCoord(d)[0])
      .y((d) => projectCoord(d)[1])
      .curve(d3.curveCatmullRom.alpha(0.5));
  }, [projection]);

  // 2. Project all village outreach nodes into D3 SVG coordinate space
  const projectedAllNodes = useMemo(() => {
    return villageOutreachPoints.map((node) => {
      const [x, y] = projectCoord([node.lng, node.lat]);
      return {
        ...node,
        x,
        y,
      };
    });
  }, [villageOutreachPoints, projection]);

  const projectedVisibleNodes = useMemo(() => {
    const visibleIds = new Set(visibleMapNodes.map((n) => n.id));
    return projectedAllNodes.filter((n) => visibleIds.has(n.id));
  }, [projectedAllNodes, visibleMapNodes]);

  // 3. Build weighted spatial sample points for D3 Kernel Density Estimation (d3.contourDensity)
  const kdeSamplePoints = useMemo<HeatmapSamplePoint[]>(() => {
    const samples: HeatmapSamplePoint[] = [];

    // Primary village nodes with satellite radial micro-samples so D3 contourDensity produces smooth, realistic epidemiological plumes
    projectedVisibleNodes.forEach((node) => {
      const rawMetricValue =
        weightMetric === 'group_d_count'
          ? node.groupDCount
          : weightMetric === 'prevalence_pct'
          ? node.densityPct * 1.35
          : Math.max(2, node.sevenDayGrowthPct * 0.65 + node.groupDCount * 0.4);

      // Core epicenter weight
      samples.push({
        x: node.x,
        y: node.y,
        weight: rawMetricValue * 1.6,
        villageId: node.id,
      });

      // Individual Group D case distribution around village center (deterministic Golden-Angle spiral)
      const caseCount = Math.max(3, node.groupDCount);
      for (let i = 0; i < caseCount; i++) {
        const angle = i * 2.39996; // Golden angle in radians
        const radiusPx = 6 + Math.sqrt(i) * 7.5;
        samples.push({
          x: node.x + Math.cos(angle) * radiusPx,
          y: node.y + Math.sin(angle) * radiusPx,
          weight: (rawMetricValue / caseCount) * 2.2,
          villageId: node.id,
        });
      }
    });

    // Secondary background subdistrict baseline points for full-district continuity
    KORAT_SUBDISTRICT_ZONES.forEach((zone) => {
      const [zx, zy] = projectCoord(zone.centerLngLat);
      const subdistrictWeight =
        weightMetric === 'group_d_count'
          ? zone.baselineGroupD * 0.25
          : weightMetric === 'prevalence_pct'
          ? ((zone.baselineGroupD / zone.screenedPop) * 100) * 0.6
          : zone.baselineGroupD * 0.2;
      samples.push({
        x: zx,
        y: zy,
        weight: subdistrictWeight,
      });
    });

    return samples;
  }, [projectedVisibleNodes, weightMetric, projection]);

  // 4. Compute D3 Contour Density Polygons (d3.contourDensity)
  const { contours, maxContourValue } = useMemo(() => {
    if (kdeSamplePoints.length === 0) {
      return { contours: [] as d3.ContourMultiPolygon[], maxContourValue: 1 };
    }
    const densityGen = d3
      .contourDensity<HeatmapSamplePoint>()
      .x((d) => d.x)
      .y((d) => d.y)
      .weight((d) => d.weight)
      .size([SVG_WIDTH, SVG_HEIGHT])
      .bandwidth(kdeBandwidth)
      .thresholds(14);

    const computed = densityGen(kdeSamplePoints);
    const maxVal = d3.max(computed, (c) => c.value) || 1;
    return { contours: computed, maxContourValue: maxVal };
  }, [kdeSamplePoints, kdeBandwidth]);

  // D3 GeoPath generator for planar pixel contours
  const contourPathGenerator = useMemo(() => d3.geoPath(), []);

  // D3 Sequential Thermal Color Scale (Epidemiological Heat: Deep Teal -> Amber -> Orange -> Crimson Red)
  const heatColorScale = useMemo(() => {
    return d3
      .scaleSequential<string>((t) => {
        if (t < 0.25) {
          return d3.interpolateRgb('#0d9488', '#facc15')(t / 0.25);
        }
        if (t < 0.6) {
          return d3.interpolateRgb('#facc15', '#f97316')((t - 0.25) / 0.35);
        }
        return d3.interpolateRgb('#f97316', '#e11d48')((t - 0.6) / 0.4);
      })
      .domain([0, maxContourValue]);
  }, [maxContourValue]);

  // Subdistrict Choropleth Color Scale
  const choroplethColorScale = useMemo(() => {
    return d3
      .scaleSequential<string>((t) =>
        d3.interpolateRgb('#0f172a', '#be123c')(Math.min(1, Math.max(0, t)))
      )
      .domain([10, 30]);
  }, []);

  // 5. Compute D3 Delaunay / Voronoi Outreach Catchment Polygons for each village node
  const voronoiCells = useMemo(() => {
    if (projectedVisibleNodes.length < 3) return [];
    const delaunay = d3.Delaunay.from(
      projectedVisibleNodes,
      (d) => d.x,
      (d) => d.y
    );
    const voronoi = delaunay.voronoi([35, 25, SVG_WIDTH - 35, SVG_HEIGHT - 25]);
    return projectedVisibleNodes.map((node, idx) => ({
      node,
      pathData: voronoi.renderCell(idx),
    }));
  }, [projectedVisibleNodes]);

  // 6. Compute Optimal Community Outreach Deployment Route (connecting top Group D hotspots)
  const outreachRoutePlan = useMemo(() => {
    // Select top priority hotspots sorted from central Maharaj/Nai Mueang hub outward
    const priorityNodes = [...projectedVisibleNodes]
      .filter((n) => n.groupDCount >= 6 || n.priorityLevel !== 'moderate')
      .sort((a, b) => b.groupDCount - a.groupDCount)
      .slice(0, 6);

    if (priorityNodes.length < 2) {
      return {
        orderedNodes: priorityNodes,
        svgPath: '',
        totalDistanceKm: 0,
        totalCoveredGroupD: priorityNodes.reduce((acc, n) => acc + n.groupDCount, 0),
        totalTeams: priorityNodes.reduce((acc, n) => acc + n.outreachTeamRequired, 0),
      };
    }

    // Nearest-neighbor greedy route starting from central urban hub (VIL-KORAT-03 or highest node)
    const remaining = [...priorityNodes];
    const startIdx = remaining.findIndex((n) => n.id === 'VIL-KORAT-03');
    const ordered: typeof priorityNodes = [
      remaining.splice(startIdx >= 0 ? startIdx : 0, 1)[0],
    ];

    let totalKm = 0;
    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((candidate, idx) => {
        const dLat = (candidate.lat - last.lat) * 111.32;
        const dLng = (candidate.lng - last.lng) * 107.5;
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distKm < bestDist) {
          bestDist = distKm;
          bestIdx = idx;
        }
      });
      totalKm += bestDist;
      ordered.push(remaining.splice(bestIdx, 1)[0]);
    }

    const lineGen = d3
      .line<(typeof ordered)[0]>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveCatmullRom.alpha(0.5));

    return {
      orderedNodes: ordered,
      svgPath: lineGen(ordered) || '',
      totalDistanceKm: Number(totalKm.toFixed(1)),
      totalCoveredGroupD: ordered.reduce((acc, n) => acc + n.groupDCount, 0),
      totalTeams: ordered.reduce((acc, n) => acc + n.outreachTeamRequired, 0),
    };
  }, [projectedVisibleNodes]);

  // 7. Wire up D3 Zoom & Pan behavior on the SVG
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svgSelection = d3.select(svgRef.current);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.85, 3.5])
      .translateExtent([
        [-120, -100],
        [SVG_WIDTH + 120, SVG_HEIGHT + 100],
      ])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        setZoomTransform(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svgSelection.call(zoom);

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, []);

  const handleZoomBy = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(260)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(320)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  const handleFocusSelectedVillage = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const target = projectedAllNodes.find((n) => n.id === selectedVillageNode.id);
    if (!target) return;
    const scale = 1.65;
    const tx = SVG_WIDTH / 2 - target.x * scale;
    const ty = SVG_HEIGHT / 2 - target.y * scale;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    d3.select(svgRef.current)
      .transition()
      .duration(380)
      .call(zoomBehaviorRef.current.transform, transform);
  };

  // District outer boundary polygon coordinates [lng, lat]
  const districtOuterRing: Array<[number, number]> = [
    [101.984, 14.954],
    [102.008, 15.004],
    [102.048, 15.04],
    [102.104, 15.046],
    [102.15, 15.043],
    [102.158, 14.982],
    [102.16, 14.94],
    [102.152, 14.91],
    [102.104, 14.912],
    [102.062, 14.918],
    [102.02, 14.912],
    [101.986, 14.92],
  ];

  // Key rivers & highways in Mueang Nakhon Ratchasima ([lng, lat])
  const lamTakhongRiverCoords: Array<[number, number]> = [
    [101.986, 14.962],
    [102.028, 14.971],
    [102.068, 14.978],
    [102.098, 14.981],
    [102.126, 14.992],
    [102.156, 15.012],
  ];

  const mittraphapHighwayCoords: Array<[number, number]> = [
    [101.986, 14.932],
    [102.035, 14.954],
    [102.082, 14.972],
    [102.112, 14.996],
    [102.142, 15.042],
  ];

  const route224HuaThaleCoords: Array<[number, number]> = [
    [102.098, 14.974],
    [102.118, 14.958],
    [102.136, 14.938],
    [102.152, 14.912],
  ];

  const route304PakThongChaiCoords: Array<[number, number]> = [
    [102.084, 14.97],
    [102.078, 14.944],
    [102.072, 14.914],
  ];

  const hoveredNode = useMemo(
    () => projectedAllNodes.find((n) => n.id === hoveredNodeId) || null,
    [projectedAllNodes, hoveredNodeId]
  );

  const hoveredZone = useMemo(
    () => KORAT_SUBDISTRICT_ZONES.find((z) => z.id === hoveredZoneId) || null,
    [hoveredZoneId]
  );

  const totalDistrictGroupD = useMemo(
    () => COMMUNITY_BASELINE_STATS.subdistrictCoverage.reduce((acc, s) => acc + s.highRisk, 0),
    []
  );

  return (
    <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-700 bg-slate-950 overflow-hidden relative min-h-[540px] shadow-inner">
      {/* Top D3 Geospatial Heatmap Control Bar */}
      <div className="p-3.5 bg-slate-900/95 border-b border-slate-800 space-y-2.5 z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300">
              <Flame className="w-4 h-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-white">
                  D3.js Geospatial Heatmap · ความหนาแน่นเคสกลุ่มเสี่ยงสูง (Group D)
                </h3>
                <span className="px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-mono-num font-bold uppercase">
                  KDE Iso-Contour Overlay
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                แผนที่จำลองพิกัดภูมิศาสตร์ อ.เมืองนครราชสีมา (Mercator Projection + D3 Kernel Density Estimation) เพื่อวางแผนจัดสรรทีมสหวิชาชีพเชิงรุก
              </p>
            </div>
          </div>

          {/* Zoom & Focus Controls */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => handleZoomBy(1.25)}
              title="ซูมเข้า (Zoom In)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoomBy(0.8)}
              title="ซูมออก (Zoom Out)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFocusSelectedVillage}
              title="โฟกัสหมู่บ้านที่เลือก"
              className="px-2 py-1 rounded hover:bg-slate-800 text-teal-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              <span className="hidden sm:inline">โฟกัสจุดที่เลือก</span>
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="รีเซ็ตมุมมองแผนที่"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Layer Mode, Weighting Metric, and KDE Bandwidth Controls */}
        <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Layer Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="px-2 text-[11px] text-slate-400 font-semibold inline-flex items-center gap-1">
              <Layers className="w-3 h-3 text-teal-400" />
              โหมดชั้นข้อมูล:
            </span>
            {[
              { id: 'kde_contour' as const, label: 'D3 Thermal Heatmap (KDE)' },
              { id: 'choropleth_hybrid' as const, label: 'Choropleth รายตำบล + KDE' },
              { id: 'voronoi_catchment' as const, label: 'โซนรับผิดชอบ รพ.สต. (Voronoi)' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setLayerMode(mode.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  layerMode === mode.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Metric Weight Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="ตัวแปรคำนวณความหนาแน่น Heatmap"
              value={weightMetric}
              onChange={(e) => setWeightMetric(e.target.value as HeatmapWeightMetric)}
              className="py-1 px-2.5 text-[11px] font-semibold rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="group_d_count">น้ำหนักสี: จำนวนผู้สูงอายุกลุ่ม D (ราย)</option>
              <option value="prevalence_pct">น้ำหนักสี: อัตราความชุกกลุ่ม D (% ต่อผู้คัดกรอง)</option>
              <option value="surge_7d">น้ำหนักสี: อัตราพุ่งสูงในรอบ 7 วัน (7d Surge)</option>
            </select>

            <button
              type="button"
              aria-pressed={showOutreachCorridor}
              onClick={() => setShowOutreachCorridor((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                showOutreachCorridor
                  ? 'border-teal-400 bg-teal-500/20 text-teal-200'
                  : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Route className="w-3.5 h-3.5 text-teal-400" />
              <span>เส้นทางหน่วยเชิงรุก ({outreachRoutePlan.totalDistanceKm} กม.)</span>
            </button>
          </div>
        </div>

        {/* Interactive D3 Kernel Bandwidth & Opacity Sliders */}
        <div className="pt-1.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>รัศมีกระจายความร้อน (KDE Bandwidth):</span>
              <input
                type="range"
                min={22}
                max={58}
                step={2}
                value={kdeBandwidth}
                onChange={(e) => setKdeBandwidth(Number(e.target.value))}
                className="w-24 accent-rose-500 cursor-pointer"
              />
              <span className="font-mono-num font-bold text-amber-300">{kdeBandwidth}px</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span>ความเข้ม Heatmap:</span>
              <input
                type="range"
                min={0.35}
                max={0.95}
                step={0.05}
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                className="w-20 accent-teal-400 cursor-pointer"
              />
              <span className="font-mono-num font-bold text-teal-300">
                {Math.round(heatmapOpacity * 100)}%
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowSubdistrictLabels((prev) => !prev)}
            className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
          >
            {showSubdistrictLabels ? 'ซ่อนชื่อโซนตำบล' : 'แสดงชื่อโซนตำบล'}
          </button>
        </div>
      </div>

      {/* Main Interactive D3 SVG Map Canvas */}
      <div className="relative flex-1 w-full min-h-[390px] select-none overflow-hidden bg-[#050D1A]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="แผนที่ D3 Geospatial Heatmap แสดงความหนาแน่นผู้สูงอายุกลุ่มเสี่ยงสูง Group D อำเภอเมืองนครราชสีมา"
        >
          <defs>
            {/* Radial background glow */}
            <radialGradient id="d3KoratBgGlow" cx="52%" cy="50%" r="58%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.55" />
              <stop offset="65%" stopColor="#0f172a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>

            {/* Clip path to keep thermal heatmap inside stylized Mueang Nakhon Ratchasima district border */}
            <clipPath id="koratDistrictClip">
              <path d={polygonLineGenerator(districtOuterRing) || ''} />
            </clipPath>

            {/* Soft Gaussian blur filter for smooth thermal heatmap fusion */}
            <filter id="d3HeatmapSoftGlow" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pulsing glow for critical Group D epicenters */}
            <radialGradient id="criticalHotspotPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.65" />
              <stop offset="60%" stopColor="#e11d48" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#be123c" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#d3KoratBgGlow)" />

          {/* Zoomable & Pannable D3 Layer Group */}
          <g
            ref={zoomGroupRef}
            transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`}
          >
            {/* 1. WGS84 Longitude & Latitude Coordinate Graticule Grid */}
            {[102.0, 102.04, 102.08, 102.12, 102.16].map((lng) => {
              const [x] = projectCoord([lng, 14.975]);
              return (
                <g key={`lng-${lng}`}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={SVG_HEIGHT}
                    stroke="#1e293b"
                    strokeWidth={1 / zoomTransform.k}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={x + 5}
                    y={SVG_HEIGHT - 10}
                    fill="#64748b"
                    fontSize={10 / Math.sqrt(zoomTransform.k)}
                    fontFamily="monospace"
                  >
                    {lng.toFixed(2)}°E
                  </text>
                </g>
              );
            })}

            {[15.04, 15.0, 14.96, 14.92].map((lat) => {
              const [, y] = projectCoord([102.075, lat]);
              return (
                <g key={`lat-${lat}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={SVG_WIDTH}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth={1 / zoomTransform.k}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={10}
                    y={y - 5}
                    fill="#64748b"
                    fontSize={10 / Math.sqrt(zoomTransform.k)}
                    fontFamily="monospace"
                  >
                    {lat.toFixed(2)}°N
                  </text>
                </g>
              );
            })}

            {/* 2. Stylized Subdistrict Polygons (ต.ในเมือง, ต.หัวทะเล, ต.โพธิ์กลาง, ต.จอหอ, etc.) */}
            <g>
              {KORAT_SUBDISTRICT_ZONES.map((zone) => {
                const pathD = linearPolygonGenerator(zone.coordinates) || '';
                const [cx, cy] = projectCoord(zone.centerLngLat);
                const isZoneHovered = hoveredZoneId === zone.id;
                const isSelectedSubdistrict =
                  selectedVillageNode.subdistrict === zone.subdistrict;

                const fillColor =
                  layerMode === 'choropleth_hybrid'
                    ? choroplethColorScale(zone.baselineGroupD)
                    : isSelectedSubdistrict
                    ? '#112240'
                    : '#0b162c';

                return (
                  <g
                    key={zone.id}
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseLeave={() => setHoveredZoneId(null)}
                    onClick={() => {
                      const matchingVil = villageOutreachPoints.find(
                        (v) => v.subdistrict === zone.subdistrict
                      );
                      if (matchingVil) {
                        onSelectVillage(matchingVil.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <path
                      d={pathD}
                      fill={fillColor}
                      fillOpacity={layerMode === 'choropleth_hybrid' ? 0.72 : 0.65}
                      stroke={
                        isSelectedSubdistrict
                          ? '#2dd4bf'
                          : isZoneHovered
                          ? '#94a3b8'
                          : '#334155'
                      }
                      strokeWidth={
                        (isSelectedSubdistrict ? 2 : 1.1) / Math.sqrt(zoomTransform.k)
                      }
                      strokeDasharray={isSelectedSubdistrict ? undefined : '5 3'}
                    />

                    {showSubdistrictLabels && (
                      <g transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
                        <text
                          textAnchor="middle"
                          y={-4}
                          fill={isSelectedSubdistrict ? '#5eead4' : '#94a3b8'}
                          fontSize={10 / Math.sqrt(zoomTransform.k)}
                          fontWeight={isSelectedSubdistrict ? '700' : '600'}
                          opacity={0.85}
                        >
                          {zone.subdistrict}
                        </text>
                        <text
                          textAnchor="middle"
                          y={8}
                          fill="#cbd5e1"
                          fontSize={8.5 / Math.sqrt(zoomTransform.k)}
                          fontFamily="monospace"
                          opacity={0.65}
                        >
                          Group D: {zone.baselineGroupD} ราย
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 3. District Outer Perimeter Glow & Border */}
            <path
              d={polygonLineGenerator(districtOuterRing) || ''}
              fill="none"
              stroke="#475569"
              strokeWidth={2 / Math.sqrt(zoomTransform.k)}
              strokeDasharray="8 4"
              className="pointer-events-none"
            />

            {/* 4. D3 Kernel Density Estimation (d3.contourDensity) Geospatial Heatmap Layer */}
            <g
              clipPath="url(#koratDistrictClip)"
              filter="url(#d3HeatmapSoftGlow)"
              opacity={heatmapOpacity}
              className="pointer-events-none"
            >
              {contours.map((contour, idx) => {
                const normalized = contour.value / maxContourValue;
                const fill = heatColorScale(contour.value);
                // Smoothly step opacity from outer low-density ring to inner critical core
                const bandOpacity =
                  layerMode === 'voronoi_catchment'
                    ? 0.14 + normalized * 0.32
                    : 0.18 + normalized * 0.68;

                return (
                  <path
                    key={`contour-${idx}-${contour.value}`}
                    d={contourPathGenerator(contour) || ''}
                    fill={fill}
                    fillOpacity={bandOpacity}
                    stroke={normalized > 0.55 ? '#fda4af' : fill}
                    strokeWidth={normalized > 0.65 ? 0.9 : 0.45}
                    strokeOpacity={0.55}
                  />
                );
              })}
            </g>

            {/* 5. Optional D3 Voronoi Outreach Catchment Overlay */}
            {layerMode === 'voronoi_catchment' && (
              <g clipPath="url(#koratDistrictClip)" className="pointer-events-none">
                {voronoiCells.map(({ node, pathData }) => {
                  const isSel = node.id === selectedVillageNode.id;
                  const cellFill =
                    node.priorityLevel === 'critical'
                      ? '#e11d48'
                      : node.priorityLevel === 'high'
                      ? '#f59e0b'
                      : '#14b8a6';
                  return (
                    <path
                      key={`voronoi-${node.id}`}
                      d={pathData}
                      fill={cellFill}
                      fillOpacity={isSel ? 0.28 : 0.12}
                      stroke={isSel ? '#ffffff' : '#38bdf8'}
                      strokeWidth={isSel ? 1.8 : 1}
                      strokeDasharray="4 3"
                      strokeOpacity={0.75}
                    />
                  );
                })}
              </g>
            )}

            {/* 6. Geographic Reference Landmarks: Lam Takhong River & Major Highways */}
            <g className="pointer-events-none">
              {/* Lam Takhong River */}
              <path
                d={openPathGenerator(lamTakhongRiverCoords) || ''}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={3 / Math.sqrt(zoomTransform.k)}
                strokeOpacity={0.45}
              />
              <text
                x={projectCoord([102.14, 15.004])[0]}
                y={projectCoord([102.14, 15.004])[1] - 6}
                fill="#38bdf8"
                fontSize={9.5 / Math.sqrt(zoomTransform.k)}
                opacity={0.85}
              >
                ลำตะคอง
              </text>

              {/* Mittraphap Road (AH12) */}
              <path
                d={openPathGenerator(mittraphapHighwayCoords) || ''}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.8 / Math.sqrt(zoomTransform.k)}
                strokeDasharray="7 4"
                strokeOpacity={0.55}
              />
              <text
                x={projectCoord([102.025, 14.946])[0]}
                y={projectCoord([102.025, 14.946])[1] - 7}
                fill="#cbd5e1"
                fontSize={9.5 / Math.sqrt(zoomTransform.k)}
                opacity={0.75}
              >
                ถ.มิตรภาพ (AH12)
              </text>

              {/* Route 224 (Hua Thale - Chok Chai) */}
              <path
                d={openPathGenerator(route224HuaThaleCoords) || ''}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.6 / Math.sqrt(zoomTransform.k)}
                strokeDasharray="5 4"
                strokeOpacity={0.5}
              />
              <text
                x={projectCoord([102.142, 14.925])[0] + 6}
                y={projectCoord([102.142, 14.925])[1]}
                fill="#cbd5e1"
                fontSize={9.5 / Math.sqrt(zoomTransform.k)}
                opacity={0.75}
              >
                ทล.224 (หัวทะเล)
              </text>

              {/* Route 304 (Pak Thong Chai) */}
              <path
                d={openPathGenerator(route304PakThongChaiCoords) || ''}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.5 / Math.sqrt(zoomTransform.k)}
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />
            </g>

            {/* 7. Community Outreach Mobile Clinic Corridor (เส้นทางเดินรถทีมเยี่ยมบ้านเชิงรุก) */}
            {showOutreachCorridor && outreachRoutePlan.svgPath && (
              <g className="pointer-events-none">
                <path
                  d={outreachRoutePlan.svgPath}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={5 / Math.sqrt(zoomTransform.k)}
                  strokeOpacity={0.8}
                />
                <path
                  d={outreachRoutePlan.svgPath}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth={2.4 / Math.sqrt(zoomTransform.k)}
                  strokeDasharray="8 4"
                  strokeOpacity={0.95}
                />
                {outreachRoutePlan.orderedNodes.map((stopNode, idx) => (
                  <g
                    key={`route-stop-${stopNode.id}`}
                    transform={`translate(${stopNode.x + 15}, ${stopNode.y - 15})`}
                  >
                    <circle
                      r={8 / Math.sqrt(zoomTransform.k)}
                      fill="#0f766e"
                      stroke="#5eead4"
                      strokeWidth={1.2 / Math.sqrt(zoomTransform.k)}
                    />
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill="#ffffff"
                      fontSize={8.5 / Math.sqrt(zoomTransform.k)}
                      fontFamily="monospace"
                      fontWeight="800"
                    >
                      #{idx + 1}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* 8. Interactive Village Hotspot Epicenters (Group D Case Nodes) */}
            {projectedVisibleNodes.map((node) => {
              const isSelected = selectedVillageNode.id === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isCritical = node.priorityLevel === 'critical' || node.groupDCount >= 9;
              const isHigh = node.priorityLevel === 'high' || node.groupDCount >= 6;

              const outerRadius =
                Math.min(34, Math.max(17, node.groupDCount * 2.8)) /
                Math.sqrt(zoomTransform.k);
              const coreRadius = (isSelected ? 14.5 : 12.5) / Math.sqrt(zoomTransform.k);

              const coreFill = isCritical
                ? '#e11d48'
                : isHigh
                ? '#f59e0b'
                : '#14b8a6';
              const coreTextColor = isCritical ? '#ffffff' : '#020617';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectVillage(node.id);
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.village} ${node.subdistrict} ผู้สูงอายุกลุ่ม D ${node.groupDCount} ราย (${node.densityPct}%)`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectVillage(node.id);
                    }
                  }}
                >
                  {/* Thermal Epicenter Halo */}
                  {isCritical && (
                    <circle
                      r={outerRadius * 1.45}
                      fill="url(#criticalHotspotPulse)"
                      className="pointer-events-none"
                    />
                  )}

                  {/* Concentric Outreach Ring */}
                  <circle
                    r={outerRadius}
                    fill={coreFill}
                    fillOpacity={isSelected ? 0.35 : 0.2}
                    stroke={isSelected ? '#ffffff' : coreFill}
                    strokeWidth={(isSelected ? 2.2 : 1.3) / Math.sqrt(zoomTransform.k)}
                  />

                  {/* Core Marker Circle with Group D Count */}
                  <circle
                    r={coreRadius}
                    fill={coreFill}
                    stroke={isSelected || isHovered ? '#ffffff' : '#020617'}
                    strokeWidth={(isSelected ? 2.4 : 1.5) / Math.sqrt(zoomTransform.k)}
                  />

                  <text
                    textAnchor="middle"
                    dy="0.36em"
                    fill={coreTextColor}
                    fontSize={10.5 / Math.sqrt(zoomTransform.k)}
                    fontFamily="monospace"
                    fontWeight="800"
                  >
                    {node.groupDCount}
                  </text>

                  {/* Village Label Pill under Node */}
                  <g
                    transform={`translate(0, ${
                      outerRadius + 11 / Math.sqrt(zoomTransform.k)
                    })`}
                  >
                    <rect
                      x={-68 / Math.sqrt(zoomTransform.k)}
                      y={-8 / Math.sqrt(zoomTransform.k)}
                      width={136 / Math.sqrt(zoomTransform.k)}
                      height={16 / Math.sqrt(zoomTransform.k)}
                      rx={4 / Math.sqrt(zoomTransform.k)}
                      fill={isSelected ? '#ffffff' : '#0f172a'}
                      fillOpacity={0.92}
                      stroke={
                        isSelected
                          ? '#2dd4bf'
                          : node.isHighRiskSurge7d
                          ? '#f43f5e'
                          : '#334155'
                      }
                      strokeWidth={1 / Math.sqrt(zoomTransform.k)}
                    />
                    <text
                      textAnchor="middle"
                      dy="0.32em"
                      fill={isSelected ? '#020617' : '#f8fafc'}
                      fontSize={9.2 / Math.sqrt(zoomTransform.k)}
                      fontWeight={isSelected ? '800' : '600'}
                    >
                      {node.village.replace('หมู่ที่ ', 'ม.')} ({node.densityPct}%)
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Live Epidemiological Tooltip (Top-Right Overlay) */}
        {(hoveredNode || hoveredZone) && (
          <div className="absolute top-3 right-3 z-20 max-w-xs rounded-xl bg-slate-950/95 border border-rose-500/60 p-3 shadow-2xl text-xs space-y-1.5 pointer-events-none">
            {hoveredNode ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white">{hoveredNode.village}</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono-num font-extrabold">
                    Group D: {hoveredNode.groupDCount} ราย
                  </span>
                </div>
                <p className="text-[11px] text-teal-300 font-mono-num">
                  {hoveredNode.subdistrict} · {hoveredNode.rphFacility}
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800 text-[11px] font-mono-num">
                  <span className="text-slate-300">
                    ความชุก: <strong className="text-rose-300">{hoveredNode.densityPct}%</strong>
                  </span>
                  <span className="text-slate-300">
                    แนวโน้ม 7 วัน:{' '}
                    <strong className="text-amber-300">+{hoveredNode.sevenDayGrowthPct}%</strong>
                  </span>
                  <span className="text-slate-300">
                    ทีมเชิงรุก:{' '}
                    <strong className="text-teal-300">
                      {hoveredNode.outreachTeamRequired} ทีม
                    </strong>
                  </span>
                  <span className="text-slate-300">
                    ชุดตรวจ BP:{' '}
                    <strong className="text-amber-300">{hoveredNode.bpKitsAllocated} ชุด</strong>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  คลิกจุดพิกัดเพื่อล็อกเป้าหมายและดูรายชื่อผู้สูงอายุในพื้นที่
                </p>
              </>
            ) : hoveredZone ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white">{hoveredZone.zoneLabel}</span>
                </div>
                <p className="text-[11px] text-teal-300">{hoveredZone.rphHub}</p>
                <p className="text-[11px] text-slate-300 font-mono-num">
                  เคสความเสี่ยงสูง (Group D) สะสมโซนนี้:{' '}
                  <strong className="text-rose-300">{hoveredZone.baselineGroupD} ราย</strong> (จากผู้คัดกรอง{' '}
                  {hoveredZone.screenedPop} ราย)
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* Bottom-Left Continuous D3 Colorbar Scale & Route Summary */}
        <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2 text-[11px] space-y-1.5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-slate-200">
              ระดับความหนาแน่นความร้อน (D3 KDE Density Scale)
            </span>
            <span className="font-mono-num text-[10px] text-slate-400">
              ทั้งอำเภอ {totalDistrictGroupD} เคสกลุ่ม D
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-teal-300 font-mono-num">ต่ำ (Low)</span>
            <div
              className="h-2.5 w-36 sm:w-44 rounded-full border border-slate-700"
              style={{
                background:
                  'linear-gradient(90deg, rgba(13,148,136,0.75) 0%, rgba(250,204,21,0.85) 38%, rgba(249,115,22,0.92) 70%, rgba(225,29,72,1) 100%)',
              }}
            />
            <span className="text-[10px] text-rose-400 font-mono-num font-bold">
              วิกฤต (Hotspot)
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Legend & Community Outreach Route Sequence Footer */}
      <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
              <span>จุดศูนย์กลางความร้อนวิกฤต (Group D ≥ 9 ราย · 3 ทีมสหวิชาชีพ)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span>ความหนาแน่นสูง (Group D 6–8 ราย · 2 ทีม)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="w-3 h-3 rounded-full bg-teal-500 inline-block" />
              <span>เฝ้าระวังตามรอบ (Group D 1–5 ราย · 1 ทีม)</span>
            </span>
          </div>
          <span className="font-mono-num text-[11px] text-slate-400">
            ลากเมาส์เพื่อเลื่อนแผนที่ · หมุนลูกกลิ้งเพื่อซูม
          </span>
        </div>

        {/* Recommended Mobile Outreach Route Sequence Bar */}
        {showOutreachCorridor && outreachRoutePlan.orderedNodes.length > 0 && (
          <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-teal-300 inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                ลำดับเส้นทางหน่วยแพทย์เคลื่อนที่เชิงรุก (Outreach Route):
              </span>
              {outreachRoutePlan.orderedNodes.map((stop, idx) => (
                <React.Fragment key={stop.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVillage(stop.id);
                      if (onFilterByVillageAndSubdistrict) {
                        onFilterByVillageAndSubdistrict(stop.village, stop.subdistrict);
                      }
                    }}
                    className={`px-2 py-0.5 rounded font-mono-num transition-colors cursor-pointer ${
                      selectedVillageNode.id === stop.id
                        ? 'bg-teal-500 text-slate-950 font-extrabold'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    #{idx + 1} {stop.village.replace('หมู่ที่ ', 'ม.')} ({stop.groupDCount})
                  </button>
                  {idx < outreachRoutePlan.orderedNodes.length - 1 && (
                    <span className="text-slate-500">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <span className="font-mono-num text-amber-300 font-semibold">
              ครอบคลุม {outreachRoutePlan.totalCoveredGroupD} เคสกลุ่ม D · ใช้{' '}
              {outreachRoutePlan.totalTeams} ทีมปฏิบัติการ
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
