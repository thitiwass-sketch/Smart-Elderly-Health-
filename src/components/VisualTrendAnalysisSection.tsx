import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Heart,
  Info,
  LineChart as LineChartIcon,
  Minus,
  RefreshCcw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ElderProfile, MatrixGroup } from '../types/health';

interface VisualTrendAnalysisSectionProps {
  elders: ElderProfile[];
  selectedElderId?: string;
  onSelectElder?: (elder: ElderProfile) => void;
}

type MetricViewMode = 'both' | 'bp_only' | 'weight_only';

interface TrendDataPoint {
  date: string;
  displayDate: string;
  monthLabel: string;
  sbp: number;
  dbp: number;
  weight: number;
  bmi: number;
  frailtyScore: number;
  pulsePressure: number;
  bpStatus: 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';
  weightChangeFromStart: number;
}

export const VisualTrendAnalysisSection: React.FC<VisualTrendAnalysisSectionProps> = ({
  elders,
  selectedElderId,
  onSelectElder,
}) => {
  // Current selected elder for trend inspection
  const [activeElderId, setActiveElderId] = useState<string>(
    selectedElderId || elders[0]?.id || 'KORAT-ELD-001'
  );
  const [metricView, setMetricView] = useState<MetricViewMode>('both');
  const [showCohortBenchmark, setShowCohortBenchmark] = useState(true);

  // Sync if parent updates selectedElderId
  React.useEffect(() => {
    if (selectedElderId && selectedElderId !== activeElderId) {
      setActiveElderId(selectedElderId);
    }
  }, [selectedElderId]);

  const currentElder = useMemo(() => {
    return elders.find((e) => e.id === activeElderId) || elders[0];
  }, [elders, activeElderId]);

  // Format historical trend points (6 months) for Recharts
  const trendData = useMemo<TrendDataPoint[]>(() => {
    if (!currentElder || !currentElder.history || currentElder.history.length === 0) {
      return [];
    }

    const baselineWeight = currentElder.history[0]?.weight || currentElder.chronicMetrics.weight;

    return currentElder.history.map((pt, idx) => {
      const pulsePressure = pt.sbp - pt.dbp;
      let bpStatus: TrendDataPoint['bpStatus'] = 'normal';
      if (pt.sbp >= 180 || pt.dbp >= 120) bpStatus = 'crisis';
      else if (pt.sbp >= 160 || pt.dbp >= 100) bpStatus = 'stage2';
      else if (pt.sbp >= 140 || pt.dbp >= 90) bpStatus = 'stage1';
      else if (pt.sbp >= 130 && pt.dbp < 80) bpStatus = 'elevated';

      // Parse date to Thai readable format
      const [year, month, day] = pt.date.split('-');
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ];
      const mIdx = Number(month) - 1;
      const monthLabel = `${thaiMonths[mIdx] || month} ${year ? String(Number(year) + 543).slice(-2) : ''}`;
      const displayDate = `${Number(day)} ${thaiMonths[mIdx] || month}`;

      return {
        date: pt.date,
        displayDate,
        monthLabel,
        sbp: pt.sbp,
        dbp: pt.dbp,
        weight: Number(pt.weight.toFixed(1)),
        bmi: Number(pt.bmi.toFixed(1)),
        frailtyScore: pt.frailtyScore,
        pulsePressure,
        bpStatus,
        weightChangeFromStart: Number((pt.weight - baselineWeight).toFixed(1)),
      };
    });
  }, [currentElder]);

  // Trajectory analytics calculations
  const trajectoryAnalysis = useMemo(() => {
    if (trendData.length < 2) {
      return {
        deltaSbp: 0,
        deltaDbp: 0,
        deltaWeight: 0,
        deltaFrailty: 0,
        pctWeightLoss: 0,
        isBpRising: false,
        isSevereWeightLoss: false,
        isFrailtyWorsening: false,
        clinicalRecommendation: 'ข้อมูลยังไม่เพียงพอสำหรับการประเมินแนวโน้ม',
      };
    }

    const first = trendData[0];
    const last = trendData[trendData.length - 1];

    const deltaSbp = last.sbp - first.sbp;
    const deltaDbp = last.dbp - first.dbp;
    const deltaWeight = Number((last.weight - first.weight).toFixed(1));
    const deltaFrailty = last.frailtyScore - first.frailtyScore;
    const pctWeightLoss = Number((((first.weight - last.weight) / first.weight) * 100).toFixed(1));

    const isBpRising = deltaSbp >= 10;
    const isSevereWeightLoss = pctWeightLoss >= 5.0; // >5% weight loss over 6 months indicates malnutrition/sarcopenia
    const isFrailtyWorsening = deltaFrailty >= 8;

    let recommendation = 'ระดับความดันโลหิตและน้ำหนักตัวคงที่ อยู่ในเกณฑ์ที่วางแผนติดตามตามรอบปกติ';
    if (last.sbp >= 160 && isSevereWeightLoss) {
      recommendation =
        '⚠️ ตรวจพบสัญญาณวิกฤตคู่: ความดันพุ่งสูงเกิน 160 mmHg ร่วมกับน้ำหนักลดลงอย่างรวดเร็ว (>5% ใน 6 เดือน) บ่งชี้ภาวะ Sarcopenia และเสี่ยงโรคหลอดเลือดสมอง/หัวใจกำเริบ แนะนำส่งต่อแพทย์เวชปฏิบัติปรับยาและส่งนักกายภาพบำบัดฟื้นฟูมวลกล้ามเนื้อด่วน';
    } else if (last.sbp >= 160) {
      recommendation =
        '🔴 ความดันโลหิตตัวบนมีแนวโน้มสูงขึ้นต่อเนื่องและเกินเกณฑ์ควบคุม (>160 mmHg) ควรประสาน อสม. ตรวจสอบการรับประทานยา (Adherence) และนัดพบแพทย์ปรับเพิ่มขนาดยา';
    } else if (isSevereWeightLoss) {
      recommendation =
        '🟡 น้ำหนักตัวลดลงผิดปกติมากกว่า 5% ในรอบ 6 เดือน มีความเสี่ยงต่อภาวะเปราะบางทางโภชนาการและมวลกล้ามเนื้อน้อย (Sarcopenia) แนะนำเสริมไข่ต้ม นมถั่วเหลือง หรือโปรตีนเสริมตามการ์ดโภชนาการ';
    } else if (last.sbp <= 135 && last.dbp <= 85) {
      recommendation =
        '🟢 ผลการดูแลสุขภาพตนเองดีมาก: ความดันโลหิตสามารถควบคุมได้ตามเกณฑ์เป้าหมาย (<140/90 mmHg) และน้ำหนักตัวคงที่ แนะนำส่งเสริมกิจกรรมทางกายต่อเนื่อง';
    }

    return {
      deltaSbp,
      deltaDbp,
      deltaWeight,
      deltaFrailty,
      pctWeightLoss,
      isBpRising,
      isSevereWeightLoss,
      isFrailtyWorsening,
      clinicalRecommendation: recommendation,
    };
  }, [trendData]);

  // Group D & C elders for quick switcher
  const highRiskElders = useMemo(() => {
    return elders.filter(
      (e) => e.riskProfile.matrixGroup === 'D' || e.riskProfile.matrixGroup === 'C'
    );
  }, [elders]);

  return (
    <section className="bg-slate-900 border border-teal-500/40 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <LineChartIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  โมดูลวิเคราะห์แนวโน้มสุขภาพย้อนหลัง 6 เดือน (Visual Trend Analysis)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-950 text-teal-300 border border-teal-500/40">
                  Recharts BP &amp; Weight
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ติดตามวิถีสุขภาพ (Health Trajectory) แสดงกราฟเส้นความดันโลหิต (SBP/DBP) และน้ำหนักตัวย้อนหลัง 6 เดือน เพื่อให้เจ้าหน้าที่ รพ.สต. ตรวจจับภาวะแทรกซ้อนล่วงหน้า
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Elder Selector */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg p-1">
            <User className="w-3.5 h-3.5 text-teal-400 ml-1.5" />
            <select
              value={currentElder.id}
              onChange={(e) => {
                setActiveElderId(e.target.value);
                const match = elders.find((el) => el.id === e.target.value);
                if (match && onSelectElder) {
                  onSelectElder(match);
                }
              }}
              className="px-2 py-1 text-xs font-semibold bg-transparent text-white border-0 focus:outline-none cursor-pointer"
            >
              {elders.map((e) => (
                <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                  {e.name} (กลุ่ม {e.riskProfile.matrixGroup} · {e.village.split(' ')[1] || e.village})
                </option>
              ))}
            </select>
          </div>

          {/* View Filter Mode Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1">
            {[
              { id: 'both' as const, label: 'ทั้ง BP และ น้ำหนัก' },
              { id: 'bp_only' as const, label: 'เฉพาะความดัน (BP)' },
              { id: 'weight_only' as const, label: 'เฉพาะน้ำหนัก (Weight)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMetricView(tab.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  metricView === tab.id
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Elder Shortcut Selector for High-Risk Cases */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-semibold">ลัดไปยังเคสเสี่ยงสูง (Group C &amp; D):</span>
        {highRiskElders.slice(0, 6).map((e) => {
          const isSelected = e.id === currentElder.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setActiveElderId(e.id);
                if (onSelectElder) onSelectElder(e);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-teal-500/20 border-teal-400 text-teal-200 font-bold'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  e.riskProfile.matrixGroup === 'D' ? 'bg-rose-500' : 'bg-orange-500'
                }`}
              />
              <span>{e.name.split(' ')[0]}</span>
              <span className="text-[10px] text-slate-400 font-mono-num">
                (BP {e.chronicMetrics.sbp}/{e.chronicMetrics.dbp})
              </span>
            </button>
          );
        })}
      </div>

      {/* 4 Summary Trajectory KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Delta SBP */}
        <div
          className={`p-4 rounded-xl border ${
            trajectoryAnalysis.deltaSbp > 0
              ? 'bg-rose-950/40 border-rose-500/40'
              : 'bg-emerald-950/30 border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">ความดันตัวบน 6 เดือน (SBP Trajectory)</span>
            {trajectoryAnalysis.deltaSbp > 0 ? (
              <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                <TrendingUp className="w-4 h-4" />
                <span>เพิ่มขึ้น</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                <TrendingDown className="w-4 h-4" />
                <span>ลดลง/คงที่</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              {trendData[trendData.length - 1]?.sbp || currentElder.chronicMetrics.sbp}
            </span>
            <span className="text-xs text-slate-400 font-mono-num">mmHg</span>
            <span
              className={`text-xs font-bold font-mono-num ml-auto px-2 py-0.5 rounded ${
                trajectoryAnalysis.deltaSbp > 0
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {trajectoryAnalysis.deltaSbp >= 0 ? `+${trajectoryAnalysis.deltaSbp}` : trajectoryAnalysis.deltaSbp} mmHg (6m)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            เริ่มต้น {trendData[0]?.sbp || 135} mmHg → ล่าสุด {trendData[trendData.length - 1]?.sbp} mmHg
          </p>
        </div>

        {/* Card 2: Delta DBP */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>ความดันตัวล่าง (DBP Trajectory)</span>
            <span className="text-sky-400 font-mono-num">
              Pulse Pressure: {trendData[trendData.length - 1]?.pulsePressure || 40} mmHg
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              {trendData[trendData.length - 1]?.dbp || currentElder.chronicMetrics.dbp}
            </span>
            <span className="text-xs text-slate-400 font-mono-num">mmHg</span>
            <span className="text-xs font-bold font-mono-num ml-auto px-2 py-0.5 rounded bg-slate-800 text-sky-300">
              {trajectoryAnalysis.deltaDbp >= 0 ? `+${trajectoryAnalysis.deltaDbp}` : trajectoryAnalysis.deltaDbp} mmHg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            เป้าหมายสมาคมความดัน: &lt; 90 mmHg (ควบคุมได้)
          </p>
        </div>

        {/* Card 3: Delta Weight & Sarcopenia Flag */}
        <div
          className={`p-4 rounded-xl border ${
            trajectoryAnalysis.isSevereWeightLoss
              ? 'bg-amber-950/40 border-amber-500/50'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">น้ำหนักตัว (Body Weight 6m)</span>
            {trajectoryAnalysis.isSevereWeightLoss && (
              <span className="inline-flex items-center gap-1 text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px]">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>เสี่ยง Sarcopenia</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              {trendData[trendData.length - 1]?.weight || currentElder.chronicMetrics.weight}
            </span>
            <span className="text-xs text-slate-400">กก. (BMI {trendData[trendData.length - 1]?.bmi || currentElder.chronicMetrics.bmi})</span>
            <span
              className={`text-xs font-bold font-mono-num ml-auto px-2 py-0.5 rounded ${
                trajectoryAnalysis.deltaWeight < 0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {trajectoryAnalysis.deltaWeight} กก. ({trajectoryAnalysis.pctWeightLoss > 0 ? `-${trajectoryAnalysis.pctWeightLoss}%` : `${trajectoryAnalysis.pctWeightLoss}%`})
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            6 เดือนก่อน: {trendData[0]?.weight || 50} กก. → ปัจจุบัน: {trendData[trendData.length - 1]?.weight} กก.
          </p>
        </div>

        {/* Card 4: Frailty Score Progression */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>คะแนนภาวะเปราะบาง (Frailty Index)</span>
            <span className="text-xs font-bold text-teal-300">
              กลุ่ม {currentElder.riskProfile.matrixGroup}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-teal-300 font-mono-num">
              {currentElder.riskProfile.frailtyScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
            <span
              className={`text-xs font-bold font-mono-num ml-auto px-2 py-0.5 rounded ${
                trajectoryAnalysis.deltaFrailty > 0
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {trajectoryAnalysis.deltaFrailty >= 0 ? `+${trajectoryAnalysis.deltaFrailty}` : trajectoryAnalysis.deltaFrailty} คะแนน
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            เกณฑ์: 0-30 แข็งแรง, 31-60 เปราะบางปานกลาง, 61-100 เปราะบางสูง
          </p>
        </div>
      </div>

      {/* Main Recharts Line Chart Visualization */}
      <div className="space-y-6">
        {/* Chart A: Blood Pressure Trajectory (SBP & DBP) */}
        {(metricView === 'both' || metricView === 'bp_only') && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  แนวโน้มความดันโลหิต 6 เดือน (Systolic &amp; Diastolic Blood Pressure — mmHg)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-rose-300 font-semibold">
                  <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                  <span>SBP (ตัวบน)</span>
                </span>
                <span className="flex items-center gap-1.5 text-sky-300 font-semibold">
                  <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                  <span>DBP (ตัวล่าง)</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                  <span>เกณฑ์เป้าหมาย 140/90</span>
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[60, 200]}
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    unit=" mmHg"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as TrendDataPoint;
                      return (
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1.5 min-w-[210px]">
                          <p className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>วันที่ตรวจ: {data.date}</span>
                            <span className="text-[10px] text-teal-400 font-mono-num">{data.monthLabel}</span>
                          </p>
                          <div className="space-y-1 font-mono-num">
                            <div className="flex items-center justify-between text-rose-300">
                              <span>ความดันตัวบน (SBP):</span>
                              <strong className="text-sm">{data.sbp} mmHg</strong>
                            </div>
                            <div className="flex items-center justify-between text-sky-300">
                              <span>ความดันตัวล่าง (DBP):</span>
                              <strong className="text-sm">{data.dbp} mmHg</strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                              <span>Pulse Pressure:</span>
                              <span className="text-amber-300 font-bold">{data.pulsePressure} mmHg</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                              <span>สถานะทางคลินิก:</span>
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  data.sbp >= 160
                                    ? 'bg-rose-950 text-rose-300'
                                    : data.sbp >= 140
                                    ? 'bg-amber-950 text-amber-300'
                                    : 'bg-emerald-950 text-emerald-300'
                                }`}
                              >
                                {data.sbp >= 160
                                  ? 'Stage 2 HT (สูงมาก)'
                                  : data.sbp >= 140
                                  ? 'Stage 1 HT'
                                  : 'ควบคุมได้ดี'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Clinical Target Reference Lines */}
                  <ReferenceLine
                    y={140}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{
                      value: 'เป้าหมาย SBP ≤ 140',
                      fill: '#F59E0B',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={90}
                    stroke="#38BDF8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'เป้าหมาย DBP ≤ 90',
                      fill: '#38BDF8',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={160}
                    stroke="#EF4444"
                    strokeDasharray="3 3"
                    label={{
                      value: 'วิกฤตความดันสูง ≥ 160',
                      fill: '#EF4444',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="sbp"
                    name="ความดันตัวบน (SBP)"
                    stroke="#F43F5E"
                    strokeWidth={3}
                    dot={{ fill: '#F43F5E', r: 5, strokeWidth: 2, stroke: '#0F172A' }}
                    activeDot={{ r: 8, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dbp"
                    name="ความดันตัวล่าง (DBP)"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    dot={{ fill: '#38BDF8', r: 4, strokeWidth: 2, stroke: '#0F172A' }}
                    activeDot={{ r: 7, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart B: Weight & BMI Trajectory */}
        {(metricView === 'both' || metricView === 'weight_only') && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  แนวโน้มน้ำหนักตัวและดัชนีมวลกาย 6 เดือน (Body Weight &amp; BMI Trajectory)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  <span>น้ำหนัก (กก.)</span>
                </span>
                <span className="flex items-center gap-1.5 text-teal-300 font-semibold">
                  <span className="w-3 h-0.5 bg-teal-400 inline-block" />
                  <span>BMI (กก./ม.²)</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <span>จุดเริ่มต้น: {trendData[0]?.weight || 50} กก.</span>
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    domain={['dataMin - 3', 'dataMax + 3']}
                    stroke="#34D399"
                    fontSize={11}
                    tickLine={false}
                    unit=" กก."
                  />
                  <YAxis
                    yAxisId="bmi"
                    orientation="right"
                    domain={[15, 30]}
                    stroke="#2DD4BF"
                    fontSize={11}
                    tickLine={false}
                    unit=" BMI"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as TrendDataPoint;
                      return (
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-white border-b border-slate-800 pb-1">
                            บันทึกวันที่: {data.date}
                          </p>
                          <div className="space-y-1 font-mono-num">
                            <div className="flex items-center justify-between text-emerald-300">
                              <span>น้ำหนักตัว:</span>
                              <strong className="text-sm">{data.weight} กก.</strong>
                            </div>
                            <div className="flex items-center justify-between text-teal-300">
                              <span>ดัชนีมวลกาย (BMI):</span>
                              <strong className="text-sm">{data.bmi}</strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                              <span>การเปลี่ยนแปลงสุทธิ:</span>
                              <span
                                className={`font-bold ${
                                  data.weightChangeFromStart < 0 ? 'text-amber-300' : 'text-emerald-300'
                                }`}
                              >
                                {data.weightChangeFromStart >= 0 ? `+${data.weightChangeFromStart}` : data.weightChangeFromStart} กก.
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    yAxisId="bmi"
                    y={18.5}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{
                      value: 'เกณฑ์ผอม/เสี่ยงเปราะบาง BMI < 18.5',
                      fill: '#F59E0B',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    name="น้ำหนัก (กก.)"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ fill: '#10B981', r: 5, strokeWidth: 2, stroke: '#0F172A' }}
                    activeDot={{ r: 7, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                  <Line
                    yAxisId="bmi"
                    type="monotone"
                    dataKey="bmi"
                    name="ดัชนีมวลกาย (BMI)"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={{ fill: '#14B8A6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Decision Support Takeaway Banner */}
      <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-teal-500/20 text-teal-300 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wide">
              ข้อสรุปและการแปลผลแนวโน้มสุขภาพ 6 เดือน (Clinical Decision Support):
            </h4>
            <p className="mt-1 text-xs text-slate-200 leading-relaxed">
              {trajectoryAnalysis.clinicalRecommendation}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onSelectElder) {
                onSelectElder(currentElder);
              }
            }}
            className="px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>เปิดแฟ้มสุขภาพดิจิทัล</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
