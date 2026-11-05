import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Compass,
  Filter,
  Flame,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COMMUNITY_BASELINE_STATS,
  MUEANG_KORAT_SUBDISTRICTS,
  VILLAGE_HIGH_RISK_MAP_NODES,
} from '../data/koratHealthData';
import { ElderProfile, MatrixGroup } from '../types/health';

interface SubdistrictRiskDensityHeatmapProps {
  elders: ElderProfile[];
  selectedSubdistrict?: string;
  onSelectSubdistrict: (subdistrict: string) => void;
  onFilterGroup?: (group: MatrixGroup) => void;
}

export interface SubdistrictDensityMetric {
  id: string;
  subdistrict: string;
  shortName: string;
  totalScreened: number;
  groupDCount: number;
  groupCCount: number;
  groupBCount: number;
  groupACount: number;
  combinedHighRiskCount: number; // D + C
  highRiskPercentage: number; // (D + C) / total
  densityLevel: 'critical' | 'high' | 'moderate' | 'low';
  densityLevelLabel: string;
  colorIntensityClass: string;
  borderColorClass: string;
  outreachTeamsNeeded: number;
  mobileClinicFrequency: string;
  primaryRiskDriver: string;
  rphClinicName: string;
}

// Baseline subdistrict weightings for Nakhon Ratchasima (reflecting urban vs semi-rural density)
const SUBDISTRICT_BASELINE_MODELS: Record<
  string,
  {
    baselineD: number;
    baselineC: number;
    baselineTotal: number;
    clinic: string;
    driver: string;
  }
> = {
  'ต.หัวทะเล': {
    baselineD: 18,
    baselineC: 24,
    baselineTotal: 180,
    clinic: 'รพ.สต.หัวทะเล',
    driver: 'ภาวะเปราะบางทางกายภาพและโรคความดันโลหิตสูงในชุมชนกึ่งเมือง',
  },
  'ต.โพธิ์กลาง': {
    baselineD: 15,
    baselineC: 20,
    baselineTotal: 165,
    clinic: 'รพ.สต.โพธิ์กลาง',
    driver: 'ผู้สูงอายุอยู่ลำพังและขาดยาควบคุมความดันโลหิตสูง',
  },
  'ต.ในเมือง': {
    baselineD: 22,
    baselineC: 31,
    baselineTotal: 240,
    clinic: 'ศบส.เทศบาลนครฯ / รพ.มหาราชฯ',
    driver: 'ชุมชนแออัดเขตเมือง โรคเบาหวานและหลอดเลือดสมองร่วมกับภาวะติดบ้าน',
  },
  'ต.จอหอ': {
    baselineD: 14,
    baselineC: 19,
    baselineTotal: 155,
    clinic: 'รพ.สต.จอหอ',
    driver: 'ข้อเข่าเสื่อม เสี่ยงหกล้ม และความดันโลหิตสูงในกลุ่มอายุ 75+ ปี',
  },
  'ต.หนองบัวศาลา': {
    baselineD: 12,
    baselineC: 17,
    baselineTotal: 140,
    clinic: 'รพ.สต.หนองบัวศาลา',
    driver: 'ผู้สูงอายุในเขตนิคมอุตสาหกรรม ขาดผู้ดูแลระหว่างวัน',
  },
  'ต.บ้านใหม่': {
    baselineD: 11,
    baselineC: 16,
    baselineTotal: 135,
    clinic: 'รพ.สต.บ้านใหม่',
    driver: 'ภาวะทุพโภชนาการ น้ำหนักลด และความดันโลหิตสูง',
  },
  'ต.หนองจะบก': {
    baselineD: 10,
    baselineC: 15,
    baselineTotal: 130,
    clinic: 'รพ.สต.หนองจะบก',
    driver: 'ภาวะถดถอยของกล้ามเนื้อ (Pre-frailty) และโรคเรื้อรังซ้ำซ้อน',
  },
  'ต.ปรุใหญ่': {
    baselineD: 9,
    baselineC: 14,
    baselineTotal: 120,
    clinic: 'รพ.สต.ปรุใหญ่',
    driver: 'ข้อต่อและกระดูกพรุน มีประวัติหกล้มในบ้าน',
  },
  'ต.บ้านเกาะ': {
    baselineD: 8,
    baselineC: 13,
    baselineTotal: 115,
    clinic: 'รพ.สต.บ้านเกาะ',
    driver: 'ความดันโลหิตสูงและโรคไตเรื้อรังระยะเริ่มต้น',
  },
  'ต.สุรนารี': {
    baselineD: 7,
    baselineC: 12,
    baselineTotal: 110,
    clinic: 'รพ.สต.สุรนารี',
    driver: 'ปัญหาการมองเห็นและความจำถดถอยเล็กน้อย',
  },
  'ต.โคกกรวด': {
    baselineD: 8,
    baselineC: 11,
    baselineTotal: 105,
    clinic: 'รพ.สต.โคกกรวด',
    driver: 'โรคเบาหวานชนิดที่ 2 และภาวะขาดการออกกำลังกาย',
  },
  'ต.หนองไผ่ล้อม': {
    baselineD: 9,
    baselineC: 13,
    baselineTotal: 118,
    clinic: 'ศบส.หนองไผ่ล้อม',
    driver: 'ผู้สูงอายุเกษียณอายุ มีโรคไม่ติดต่อเรื้อรังหลายชนิด',
  },
};

export const SubdistrictRiskDensityHeatmap: React.FC<SubdistrictRiskDensityHeatmapProps> = ({
  elders,
  selectedSubdistrict = 'ALL',
  onSelectSubdistrict,
  onFilterGroup,
}) => {
  const [densitySortMode, setDensitySortMode] = useState<'high_risk' | 'group_d' | 'percentage'>('high_risk');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'critical' | 'high'>('ALL');

  // Compute live subdistrict metrics combining sample registry data with epidemiological baseline
  const subdistrictMetrics = useMemo<SubdistrictDensityMetric[]>(() => {
    // 1. Count actual cohort entries per subdistrict
    const actualCounts: Record<string, { A: number; B: number; C: number; D: number; total: number }> = {};

    elders.forEach((e) => {
      const sub = e.subdistrict;
      if (!actualCounts[sub]) {
        actualCounts[sub] = { A: 0, B: 0, C: 0, D: 0, total: 0 };
      }
      actualCounts[sub][e.riskProfile.matrixGroup] += 1;
      actualCounts[sub].total += 1;
    });

    // 2. Build full list for top subdistricts in Nakhon Ratchasima
    const keys = Object.keys(SUBDISTRICT_BASELINE_MODELS);

    return keys.map((sub, idx) => {
      const base = SUBDISTRICT_BASELINE_MODELS[sub];
      const actual = actualCounts[sub] || { A: 0, B: 0, C: 0, D: 0, total: 0 };

      // Combine baseline screened community population with live active registered cases
      const groupD = base.baselineD + actual.D;
      const groupC = base.baselineC + actual.C;
      const groupB = Math.round(base.baselineTotal * 0.3) + actual.B;
      const groupA = Math.round(base.baselineTotal * 0.45) + actual.A;
      const totalScreened = groupA + groupB + groupC + groupD;

      const combinedHighRisk = groupD + groupC;
      const highRiskPct = Number(((combinedHighRisk / totalScreened) * 100).toFixed(1));

      let densityLevel: SubdistrictDensityMetric['densityLevel'] = 'moderate';
      let densityLabel = '🟡 หนาแน่นปานกลาง';
      let colorClass = 'bg-amber-950/40';
      let borderClass = 'border-amber-500/50';

      if (combinedHighRisk >= 40 || groupD >= 20) {
        densityLevel = 'critical';
        densityLabel = '🔴 วิกฤตสูงสุด (Hotspot)';
        colorClass = 'bg-rose-950/70';
        borderClass = 'border-rose-500';
      } else if (combinedHighRisk >= 28 || groupD >= 14) {
        densityLevel = 'high';
        densityLabel = '🟠 เฝ้าระวังเข้มข้น (High)';
        colorClass = 'bg-orange-950/60';
        borderClass = 'border-orange-500/60';
      } else if (combinedHighRisk < 20) {
        densityLevel = 'low';
        densityLabel = '🟢 ความเสี่ยงต่ำ (Low)';
        colorClass = 'bg-emerald-950/30';
        borderClass = 'border-emerald-500/40';
      }

      // Outreach teams formula: 1 team per 10 High-Risk cases
      const outreachTeams = Math.max(1, Math.ceil(combinedHighRisk / 10));
      const mobileClinic =
        densityLevel === 'critical'
          ? 'ทุก 2 สัปดาห์ (สัปดาห์ละ 2 วัน)'
          : densityLevel === 'high'
          ? 'เดือนละ 2 ครั้ง'
          : 'เดือนละ 1 ครั้ง';

      return {
        id: `SUB-${idx + 1}`,
        subdistrict: sub,
        shortName: sub.replace('ต.', ''),
        totalScreened,
        groupDCount: groupD,
        groupCCount: groupC,
        groupBCount: groupB,
        groupACount: groupA,
        combinedHighRiskCount: combinedHighRisk,
        highRiskPercentage: highRiskPct,
        densityLevel,
        densityLevelLabel: densityLabel,
        colorIntensityClass: colorClass,
        borderColorClass: borderClass,
        outreachTeamsNeeded: outreachTeams,
        mobileClinicFrequency: mobileClinic,
        primaryRiskDriver: base.driver,
        rphClinicName: base.clinic,
      };
    });
  }, [elders]);

  // Sorted and filtered data for visualization
  const sortedMetrics = useMemo(() => {
    let result = [...subdistrictMetrics];
    if (filterLevel !== 'ALL') {
      result = result.filter((m) => m.densityLevel === filterLevel);
    }

    if (densitySortMode === 'high_risk') {
      result.sort((a, b) => b.combinedHighRiskCount - a.combinedHighRiskCount);
    } else if (densitySortMode === 'group_d') {
      result.sort((a, b) => b.groupDCount - a.groupDCount);
    } else {
      result.sort((a, b) => b.highRiskPercentage - a.highRiskPercentage);
    }
    return result;
  }, [subdistrictMetrics, densitySortMode, filterLevel]);

  // Total high-risk cases in focus
  const totalHighRiskD = useMemo(
    () => subdistrictMetrics.reduce((acc, m) => acc + m.groupDCount, 0),
    [subdistrictMetrics]
  );
  const totalHighRiskC = useMemo(
    () => subdistrictMetrics.reduce((acc, m) => acc + m.groupCCount, 0),
    [subdistrictMetrics]
  );

  return (
    <section className="bg-slate-900 border border-teal-500/40 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
      {/* Top Banner and Description */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <Flame className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  แผนที่ความหนาแน่นกลุ่มเสี่ยงสูงรายตำบล (Community Risk Density Heatmap)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                  Groups D &amp; C Spatial Concentration
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                วิเคราะห์ความหนาแน่นเชิงพื้นที่ของผู้สูงอายุกลุ่มเสี่ยงสูงวิกฤต (กลุ่ม D) และกลุ่มเฝ้าระวังภายใน 7 วัน (กลุ่ม C) รายตำบลใน อ.เมืองนครราชสีมา เพื่อสนับสนุนการวางแผนส่งทีมสหวิชาชีพและรถคลินิกเคลื่อนที่
              </p>
            </div>
          </div>
        </div>

        {/* Sorting and Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1">
            <span className="text-[11px] text-slate-400 px-1 font-semibold">เรียงตาม:</span>
            {[
              { id: 'high_risk' as const, label: 'กลุ่ม D+C รวม' },
              { id: 'group_d' as const, label: 'เฉพาะกลุ่ม D' },
              { id: 'percentage' as const, label: '% ความหนาแน่น' },
            ].map((sortTab) => (
              <button
                key={sortTab.id}
                type="button"
                onClick={() => setDensitySortMode(sortTab.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  densitySortMode === sortTab.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {sortTab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1">
            {[
              { id: 'ALL' as const, label: 'ทุกระดับ' },
              { id: 'critical' as const, label: '🔴 เฉพาะ Hotspot' },
              { id: 'high' as const, label: '🟠 เฝ้าระวังสูง' },
            ].map((fTab) => (
              <button
                key={fTab.id}
                type="button"
                onClick={() => setFilterLevel(fTab.id)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filterLevel === fTab.id
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {fTab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3 Macro Summary Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">กลุ่ม D (High Risk วิกฤตเร่งด่วน)</p>
            <p className="mt-1 text-2xl font-extrabold text-rose-400 font-mono-num">
              {totalHighRiskD.toLocaleString()} <span className="text-xs text-slate-400">ราย</span>
            </p>
            <p className="mt-0.5 text-[11px] text-rose-300">
              ต้องประเมินคลินิกและส่งต่อแพทย์ภายใน 24 ชม.
            </p>
          </div>
          <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">กลุ่ม C (Surveillance เฝ้าระวังใน 7 วัน)</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-300 font-mono-num">
              {totalHighRiskC.toLocaleString()} <span className="text-xs text-slate-400">ราย</span>
            </p>
            <p className="mt-0.5 text-[11px] text-amber-200">
              อสม. ติดตามวัดความดัน/DTX ซ้ำตามวงรอบ
            </p>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 opacity-80" />
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/40 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">ภาระความเสี่ยงรวม (Total High-Risk Burden)</p>
            <p className="mt-1 text-2xl font-extrabold text-teal-300 font-mono-num">
              {(totalHighRiskD + totalHighRiskC).toLocaleString()}{' '}
              <span className="text-xs text-slate-400">ราย</span>
            </p>
            <p className="mt-0.5 text-[11px] text-teal-200">
              เป้าหมายจัดสรรรถคลินิกเคลื่อนที่ &amp; ทีมสหวิชาชีพ
            </p>
          </div>
          <Truck className="w-8 h-8 text-teal-400 shrink-0 opacity-80" />
        </div>
      </div>

      {/* Main Recharts Composed Stacked Bar Density Chart */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">
              กราฟแท่งเปรียบเทียบความหนาแน่นกลุ่มเสี่ยงสูง (กลุ่ม D และ C) รายตำบล (Recharts Density Breakdown)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-3 h-3 bg-rose-600 rounded-sm inline-block" />
              <span>กลุ่ม D (High Risk)</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <span className="w-3 h-3 bg-amber-500 rounded-sm inline-block" />
              <span>กลุ่ม C (Surveillance 7d)</span>
            </span>
            <span className="flex items-center gap-1.5 text-teal-300 font-semibold">
              <span className="w-3 h-0.5 bg-teal-400 inline-block" />
              <span>ทีมสหวิชาชีพที่ต้องจัดสรร (ทีม)</span>
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={sortedMetrics}
              margin={{ top: 20, right: 30, left: 0, bottom: 25 }}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  const clicked = sortedMetrics.find((m) => m.shortName === state.activeLabel);
                  if (clicked) {
                    onSelectSubdistrict(clicked.subdistrict);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="shortName"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                angle={-25}
                textAnchor="end"
                height={40}
              />
              <YAxis
                yAxisId="cases"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                unit=" ราย"
              />
              <YAxis
                yAxisId="teams"
                orientation="right"
                stroke="#2DD4BF"
                fontSize={11}
                tickLine={false}
                unit=" ทีม"
                domain={[0, 8]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as SubdistrictDensityMetric;
                  return (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-xs space-y-2 min-w-[240px]">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-white text-sm">{item.subdistrict}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-teal-300">
                          {item.densityLevelLabel}
                        </span>
                      </div>
                      <div className="space-y-1 font-mono-num">
                        <div className="flex items-center justify-between text-rose-300">
                          <span>กลุ่ม D (High Risk วิกฤต):</span>
                          <strong>{item.groupDCount} ราย</strong>
                        </div>
                        <div className="flex items-center justify-between text-amber-300">
                          <span>กลุ่ม C (เฝ้าระวัง 7 วัน):</span>
                          <strong>{item.groupCCount} ราย</strong>
                        </div>
                        <div className="flex items-center justify-between text-white pt-1 border-t border-slate-800">
                          <span className="font-sans font-bold">ภาระเสี่ยงสูงรวม (D+C):</span>
                          <strong className="text-teal-300 text-sm">{item.combinedHighRiskCount} ราย ({item.highRiskPercentage}%)</strong>
                        </div>
                        <div className="flex items-center justify-between text-teal-300">
                          <span className="font-sans">ทีมสหวิชาชีพที่ต้องจัดสรร:</span>
                          <strong>{item.outreachTeamsNeeded} ทีม</strong>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1 leading-tight">
                        <span className="text-slate-300 font-medium">หน่วยบริการ:</span> {item.rphClinicName}
                        <br />
                        <span className="text-teal-400">💡 คลิกเพื่อกรองรายชื่อผู้สูงอายุตำบลนี้</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                yAxisId="cases"
                dataKey="groupDCount"
                name="กลุ่ม D (High Risk)"
                stackId="riskStack"
                fill="#E11D48"
                radius={[0, 0, 0, 0]}
              >
                {sortedMetrics.map((entry) => (
                  <Cell
                    key={`d-${entry.id}`}
                    fill={entry.subdistrict === selectedSubdistrict ? '#FB7185' : '#E11D48'}
                    cursor="pointer"
                  />
                ))}
              </Bar>
              <Bar
                yAxisId="cases"
                dataKey="groupCCount"
                name="กลุ่ม C (Surveillance 7d)"
                stackId="riskStack"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              >
                {sortedMetrics.map((entry) => (
                  <Cell
                    key={`c-${entry.id}`}
                    fill={entry.subdistrict === selectedSubdistrict ? '#FBBF24' : '#F59E0B'}
                    cursor="pointer"
                  />
                ))}
              </Bar>
              <Line
                yAxisId="teams"
                type="monotone"
                dataKey="outreachTeamsNeeded"
                name="ทีมสหวิชาชีพ (ทีม)"
                stroke="#2DD4BF"
                strokeWidth={2.5}
                dot={{ fill: '#2DD4BF', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spatial Heatmap Cells Matrix Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-rose-400" />
            <span>ตารางความหนาแน่นเชิงพื้นที่ (Spatial Heatmap Matrix Grid — แตะเพื่อเลือกตำบล)</span>
          </h3>
          <span className="text-xs text-slate-400">
            {selectedSubdistrict !== 'ALL' ? (
              <span className="text-teal-300 font-bold">กำลังกรอง: {selectedSubdistrict}</span>
            ) : (
              'กำลังแสดงทั้งอำเภอเมือง'
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {sortedMetrics.map((sub) => {
            const isSelected = selectedSubdistrict === sub.subdistrict;
            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubdistrict(isSelected ? 'ALL' : sub.subdistrict)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'ring-2 ring-teal-400 bg-slate-900 shadow-xl'
                    : `${sub.colorIntensityClass} ${sub.borderColorClass} hover:border-teal-400/80 hover:bg-slate-900`
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-extrabold text-white tracking-tight">
                      {sub.subdistrict}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sub.densityLevel === 'critical'
                          ? 'bg-rose-600 text-white'
                          : sub.densityLevel === 'high'
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-800 text-amber-300'
                      }`}
                    >
                      {sub.densityLevelLabel.split(' ')[0]} {sub.densityLevelLabel.split(' ')[1]}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {sub.rphClinicName}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono-num text-xs">
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">กลุ่ม D (วิกฤต):</span>
                      <strong className="text-rose-400 text-sm">{sub.groupDCount}</strong> ราย
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">กลุ่ม C (7 วัน):</span>
                      <strong className="text-amber-300 text-sm">{sub.groupCCount}</strong> ราย
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] text-slate-300 leading-relaxed">
                    <span className="text-slate-400">ปัจจัยความเสี่ยงหลัก:</span> {sub.primaryRiskDriver}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-1.5 text-teal-300 font-mono-num text-[11px]">
                    <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>ทีมลงพื้นที่: <strong>{sub.outreachTeamsNeeded} ทีม</strong></span>
                  </div>

                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <span>{isSelected ? 'เลือกอยู่ ✓' : 'กรองตำบลนี้'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Targeted Outreach Action Recommendation */}
      <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wide">
              แผนจัดสรรทีมเชิงรุกและหน่วยแพทย์เคลื่อนที่ (Targeted Outreach Dispatch Strategy):
            </h4>
            <p className="mt-1 text-xs text-slate-200 leading-relaxed">
              แนะนำส่งหน่วยแพทย์เคลื่อนที่และทีมสหวิชาชีพ รพ.สต. ลงพื้นที่ Hotspot สูงสุดอันดับ 1–3 ได้แก่{' '}
              <strong className="text-rose-300">ต.ในเมือง (กลุ่ม D 22 ราย)</strong>,{' '}
              <strong className="text-rose-300">ต.หัวทะเล (กลุ่ม D 18 ราย)</strong>, และ{' '}
              <strong className="text-rose-300">ต.โพธิ์กลาง (กลุ่ม D 15 ราย)</strong> เพื่อทำการ Re-screening ซ้ำ เจาะเลือดตรวจน้ำตาล/ไขมัน และประเมินคลินิกก่อนเกิดภาวะแทรกซ้อนฉุกเฉิน
            </p>
          </div>
        </div>

        {selectedSubdistrict !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectSubdistrict('ALL')}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white font-medium shrink-0 cursor-pointer"
          >
            ล้างตัวกรองตำบล
          </button>
        )}
      </div>
    </section>
  );
};
