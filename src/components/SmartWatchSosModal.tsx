import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  BarChart3,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  HeartPulse,
  MapPin,
  PhoneCall,
  Radio,
  Send,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Volume2,
  VolumeX,
  Watch,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { VILLAGE_HIGH_RISK_MAP_NODES } from '../data/koratHealthData';
import { ElderProfile } from '../types/health';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';
import { UI_LABELS } from '../constants/uiLabels';

interface DailyFallTrendPoint {
  dayIndex: number;
  dateLabel: string;
  fullDateLabel: string;
  criticalFalls: number;
  nearFalls: number;
  totalEvents: number;
  maxImpactG: number;
  rollingAvgEvents: number;
  timeSlot: 'ดึก (00:00-05:59)' | 'เช้า (06:00-11:59)' | 'บ่าย (12:00-17:59)' | 'ค่ำ (18:00-23:59)';
  clinicalContext: string;
  isToday: boolean;
}

interface WeeklyFallSummaryPoint {
  weekLabel: string;
  dateRange: string;
  criticalFalls: number;
  nearFalls: number;
  totalEvents: number;
  maxImpactG: number;
}

interface TimeSlotPatternPoint {
  slotLabel: string;
  shortLabel: string;
  criticalFalls: number;
  nearFalls: number;
  totalEvents: number;
  clinicalMechanism: string;
}

interface ElderDeviceBatteryStatus {
  elder: ElderProfile;
  batteryPct: number;
  isLowBattery: boolean; // true when < 20%
  batteryHealthPct: number; // Long-term battery cell capacity health (85% - 99%)
  estimatedHoursLeft: number;
  voltageVolts: number;
  lastSyncMinutesAgo: number;
  statusLabel: string;
  disruptionRiskNote: string;
}

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

function hashElderSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PRESET_BATTERY_LEVELS: Record<string, number> = {
  'KORAT-ELD-001': 14, // < 20% Low battery warning (Group D high risk)
  'KORAT-ELD-002': 11, // < 20% Critical low battery (Living alone, Group D)
  'KORAT-ELD-003': 78,
  'KORAT-ELD-004': 18, // < 20% Low battery warning
  'KORAT-ELD-005': 64,
  'KORAT-ELD-006': 16, // < 20% Low battery warning
  'KORAT-ELD-007': 89,
  'KORAT-ELD-008': 52,
  'KORAT-ELD-009': 19, // < 20% Low battery warning
  'KORAT-ELD-010': 93,
  'KORAT-ELD-011': 34,
  'KORAT-ELD-012': 82,
};

interface SmartWatchSosModalProps {
  isOpen: boolean;
  elders: ElderProfile[];
  activeElder: ElderProfile | null;
  onSelectElder: (elder: ElderProfile) => void;
  onClose: () => void;
  onOpenElderProfile: (elder: ElderProfile) => void;
  onCreateEmergencyReferral: (elder: ElderProfile) => void;
}

export const SmartWatchSosModal: React.FC<SmartWatchSosModalProps> = ({
  isOpen,
  elders,
  activeElder,
  onSelectElder,
  onClose,
  onOpenElderProfile,
  onCreateEmergencyReferral,
}) => {
  const [dispatchStatus, setDispatchStatus] = useState<
    'idle' | 'dispatching' | 'dispatched'
  >('idle');
  const [dispatchTimestamp, setDispatchTimestamp] = useState<string>('');
  const [call1669State, setCall1669State] = useState<
    'standby' | 'dialing' | 'connected'
  >('standby');
  const [callDurationSec, setCallDurationSec] = useState<number>(0);
  const [isVoicePlaying, setIsVoicePlaying] = useState<boolean>(false);
  const [impactForceG, setImpactForceG] = useState<number>(4.8);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(118);
  const [spo2Pct, setSpo2Pct] = useState<number>(93);
  const [trendViewMode, setTrendViewMode] = useState<'daily30d' | 'weekly4w' | 'timeOfDay'>('daily30d');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'criticalOnly'>('all');
  const [selectedDayPoint, setSelectedDayPoint] = useState<DailyFallTrendPoint | null>(null);
  const [batteryFilter, setBatteryFilter] = useState<'all' | 'low_under_20' | 'healthy_20_plus'>('all');
  const [notifiedChargeByElderId, setNotifiedChargeByElderId] = useState<Record<string, string>>({});
  const [lowPowerModeByElderId, setLowPowerModeByElderId] = useState<Record<string, boolean>>({});

  const targetElder = activeElder || elders[0];

  // Compute deterministic battery health monitoring status for every registered elderly person
  const elderBatteryStatuses = useMemo<ElderDeviceBatteryStatus[]>(() => {
    return elders.map((elder, idx) => {
      const seed = hashElderSeed(`${elder.id}-${elder.name}-battery`);
      const fallbackPct = idx % 3 === 0 ? 12 + (seed % 7) : 35 + (seed % 60);
      const rawPct =
        PRESET_BATTERY_LEVELS[elder.id] !== undefined
          ? PRESET_BATTERY_LEVELS[elder.id]
          : fallbackPct;

      const isLowPowerEnabled = Boolean(lowPowerModeByElderId[elder.id]);
      const isLowBattery = rawPct < 20;
      const batteryHealthPct = 86 + (seed % 13); // 86% - 98% cell health
      const baseHours = Number(((rawPct / 100) * 32).toFixed(1));
      const estimatedHoursLeft = isLowPowerEnabled
        ? Number((baseHours + 4.5).toFixed(1))
        : Math.max(0.8, baseHours);
      const voltageVolts = Number((3.42 + (rawPct / 100) * 0.76).toFixed(2));
      const lastSyncMinutesAgo = (seed % 4) + 1;

      const statusLabel = isLowBattery
        ? 'แบตเตอรี่ต่ำกว่า 20% · เสี่ยงสัญญาณขาดหาย'
        : rawPct < 35
        ? 'ควรชาร์จเร็วๆ นี้ (ปานกลาง)'
        : 'แบตเตอรี่ปกติ · พร้อมเฝ้าระวัง 24 ชม.';

      const disruptionRiskNote = isLowBattery
        ? elder.livingArrangement === 'อยู่ลำพัง'
          ? `ผู้สูงอายุอาศัยอยู่ลำพัง แบตเหลือ ${rawPct}% (~${estimatedHoursLeft} ชม.) เสี่ยงเครื่องดับก่อนกู้ชีพเข้าถึง ต้องประสาน ${elder.assignedVhv} เข้าชาร์จทันที`
          : `แบตเตอรี่เหลือเพียง ${rawPct}% (~${estimatedHoursLeft} ชม.) เสี่ยงขาดการติดต่อระหว่างส่งพิกัด GPS ฉุกเฉิน แจ้งผู้ดูแล (${elder.caregiverName}) ชาร์จทันที`
        : `เซลล์แบตเตอรี่สมบูรณ์ ${batteryHealthPct}% สำรองไฟได้อีกประมาณ ${estimatedHoursLeft} ชม. ไม่มีความเสี่ยงสัญญาณขาดหาย`;

      return {
        elder,
        batteryPct: rawPct,
        isLowBattery,
        batteryHealthPct,
        estimatedHoursLeft,
        voltageVolts,
        lastSyncMinutesAgo,
        statusLabel,
        disruptionRiskNote,
      };
    });
  }, [elders, lowPowerModeByElderId]);

  const targetElderBattery = useMemo<ElderDeviceBatteryStatus | null>(() => {
    if (!targetElder) return null;
    return (
      elderBatteryStatuses.find((item) => item.elder.id === targetElder.id) ||
      elderBatteryStatuses[0] ||
      null
    );
  }, [elderBatteryStatuses, targetElder]);

  const lowBatteryCount = useMemo(
    () => elderBatteryStatuses.filter((item) => item.isLowBattery).length,
    [elderBatteryStatuses]
  );

  const healthyBatteryCount = useMemo(
    () => elderBatteryStatuses.filter((item) => !item.isLowBattery).length,
    [elderBatteryStatuses]
  );

  const avgBatteryHealthPct = useMemo(() => {
    if (!elderBatteryStatuses.length) return 92;
    const sum = elderBatteryStatuses.reduce((acc, item) => acc + item.batteryHealthPct, 0);
    return Math.round(sum / elderBatteryStatuses.length);
  }, [elderBatteryStatuses]);

  const filteredBatteryStatuses = useMemo(() => {
    if (batteryFilter === 'low_under_20') {
      return elderBatteryStatuses.filter((item) => item.isLowBattery);
    }
    if (batteryFilter === 'healthy_20_plus') {
      return elderBatteryStatuses.filter((item) => !item.isLowBattery);
    }
    return elderBatteryStatuses;
  }, [elderBatteryStatuses, batteryFilter]);

  const handleNotifyChargeElder = (elderId: string) => {
    const nowStr = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setNotifiedChargeByElderId((prev) => ({
      ...prev,
      [elderId]: `${nowStr} น.`,
    }));
  };

  const handleNotifyAllLowBattery = () => {
    const nowStr = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextMap: Record<string, string> = { ...notifiedChargeByElderId };
    elderBatteryStatuses.forEach((item) => {
      if (item.isLowBattery) {
        nextMap[item.elder.id] = `${nowStr} น.`;
      }
    });
    setNotifiedChargeByElderId(nextMap);
  };

  const handleToggleLowPowerBeacon = (elderId: string) => {
    setLowPowerModeByElderId((prev) => ({
      ...prev,
      [elderId]: !prev[elderId],
    }));
  };

  const renderBatteryIcon = (batteryPct: number, isLowPowerMode = false, className = 'w-4 h-4') => {
    if (isLowPowerMode) {
      return <BatteryCharging className={`${className} text-amber-300`} />;
    }
    if (batteryPct < 20) {
      return <BatteryWarning className={`${className} text-rose-400 animate-pulse`} />;
    }
    if (batteryPct < 40) {
      return <BatteryLow className={`${className} text-amber-300`} />;
    }
    if (batteryPct < 75) {
      return <BatteryMedium className={`${className} text-teal-300`} />;
    }
    return <BatteryFull className={`${className} text-emerald-400`} />;
  };

  // Reset dispatch state and generate realistic Smart Watch impact telemetry when elder changes or modal opens
  useEffect(() => {
    if (!targetElder || !isOpen) return;
    setDispatchStatus('idle');
    setDispatchTimestamp('');
    setCall1669State('standby');
    setCallDurationSec(0);
    setSelectedDayPoint(null);
    const seedForce =
      targetElder.riskProfile.matrixGroup === 'D'
        ? 4.8
        : targetElder.riskProfile.matrixGroup === 'C'
        ? 4.2
        : 3.7;
    setImpactForceG(seedForce);
    setHeartRateBpm(Math.min(132, Math.max(96, Math.round(targetElder.chronicMetrics.sbp * 0.72))));
    setSpo2Pct(targetElder.riskProfile.matrixGroup === 'D' ? 92 : 95);
  }, [targetElder?.id, isOpen]);

  // Build deterministic 30-day fall & near-fall telemetry series for the active elder
  const fallTrendAnalytics = useMemo(() => {
    if (!targetElder) {
      return {
        dailySeries: [] as DailyFallTrendPoint[],
        weeklySeries: [] as WeeklyFallSummaryPoint[],
        timeSlotSeries: [] as TimeSlotPatternPoint[],
        totalCritical30d: 0,
        totalNearFalls30d: 0,
        totalEvents30d: 0,
        recent7dEvents: 0,
        prev7dEvents: 0,
        dominantTimeSlot: 'ดึก (00:00-05:59)',
        patternInsight: '',
        clinicalActionNote: '',
      };
    }

    const seed = hashElderSeed(
      `${targetElder.id}-${targetElder.name}-${targetElder.riskProfile.matrixGroup}-${targetElder.riskProfile.frailtyScore}`
    );
    const group = targetElder.riskProfile.matrixGroup;
    const physicalDomain = targetElder.frailtyDomains.physical;
    const hasHypertension =
      targetElder.chronicMetrics.sbp >= 140 ||
      targetElder.chronicConditions.some((c) => c.includes('ความดัน'));
    const hasDiabetes = targetElder.chronicConditions.some((c) => c.includes('เบาหวาน'));

    // Determine primary vulnerable time window based on elder's clinical profile
    const timeSlots: Array<DailyFallTrendPoint['timeSlot']> = [
      'ดึก (00:00-05:59)',
      'เช้า (06:00-11:59)',
      'บ่าย (12:00-17:59)',
      'ค่ำ (18:00-23:59)',
    ];
    const primarySlotIdx = hasHypertension
      ? seed % 2 // Nocturia (00-06) or Morning orthostatic drop (06-12)
      : (seed + 1) % 4;
    const secondarySlotIdx = (primarySlotIdx + 1) % 4;

    // Anchor date (October 8, 2026) for 30-day window
    const anchorDate = new Date(2026, 9, 8);
    const rawDaily: Omit<DailyFallTrendPoint, 'rollingAvgEvents'>[] = [];

    for (let offset = 29; offset >= 0; offset -= 1) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - offset);
      const dayNum = d.getDate();
      const monthLabel = THAI_SHORT_MONTHS[d.getMonth()];
      const dayIndex = 30 - offset;
      const isToday = offset === 0;

      const dayHash = hashElderSeed(`${seed}-day-${offset}`);
      // Escalation factor increases in the last 10 days to reflect clinical prodrome before SOS event
      const recencyBoost = offset <= 7 ? 28 : offset <= 14 ? 14 : 0;
      const groupThreshold =
        group === 'D' ? 68 : group === 'C' ? 76 : group === 'B' ? 84 : 90;

      let criticalFalls = 0;
      let nearFalls = 0;

      if (isToday) {
        criticalFalls = 1;
        nearFalls = group === 'D' || group === 'C' ? 1 : 0;
      } else {
        const roll = (dayHash % 100) + recencyBoost;
        // Historical critical fall spikes on specific days for high/moderate risk elders
        if (
          (group === 'D' && (offset === 4 || offset === 11 || offset === 21)) ||
          (group === 'C' && (offset === 6 || offset === 18)) ||
          (group === 'B' && offset === 13 && seed % 2 === 0)
        ) {
          criticalFalls = 1;
          nearFalls = dayHash % 2;
        } else if (roll >= groupThreshold) {
          nearFalls = roll >= groupThreshold + 18 && (group === 'D' || group === 'C') ? 2 : 1;
        }
      }

      const totalEvents = criticalFalls + nearFalls;
      const baseG = 1.1 + ((dayHash % 4) * 0.1);
      const maxImpactG = isToday
        ? impactForceG
        : criticalFalls > 0
        ? Number((3.6 + ((dayHash % 11) * 0.1)).toFixed(1))
        : nearFalls > 0
        ? Number((2.1 + nearFalls * 0.4 + ((dayHash % 5) * 0.1)).toFixed(1))
        : Number(baseG.toFixed(1));

      const slotChoice =
        totalEvents === 0
          ? timeSlots[dayHash % 4]
          : dayHash % 10 < 6
          ? timeSlots[primarySlotIdx]
          : dayHash % 10 < 9
          ? timeSlots[secondarySlotIdx]
          : timeSlots[dayHash % 4];

      let clinicalContext = 'การเคลื่อนไหวปกติ ไม่พบแรงกระแทกผิดปกติ';
      if (isToday) {
        clinicalContext = `เกิดเหตุ SOS ฉุกเฉิน (${impactForceG}G) · ตรวจพบเดินเซนำมาก่อนในรอบสัปดาห์`;
      } else if (criticalFalls > 0) {
        clinicalContext =
          slotChoice === 'ดึก (00:00-05:59)'
            ? 'ลื่นล้มขณะลุกเข้าห้องน้ำกลางดึก (Nocturia / แสงสว่างไม่เพียงพอ)'
            : slotChoice === 'เช้า (06:00-11:59)'
            ? 'หน้ามืดเสียการทรงตัวหลังตื่นนอน (Orthostatic Hypotension)'
            : 'สะดุดพื้นต่างระดับ/เสียหลักขณะเดินในบ้าน';
      } else if (nearFalls > 0) {
        clinicalContext =
          nearFalls > 1
            ? 'เซเสียการทรงตัวซ้ำ 2 ครั้งในวันเดียว · สัญญาณเตือนความเสี่ยงหกล้มรุนแรง'
            : 'นาฬิกาตรวจจับการเดินเซ/ก้าวสั้นผิดปกติ (Gait Instability Precursor)';
      }

      rawDaily.push({
        dayIndex,
        dateLabel: isToday ? `${dayNum} ${monthLabel} (วันนี้)` : `${dayNum} ${monthLabel}`,
        fullDateLabel: `${dayNum} ${monthLabel} 2569${isToday ? ' · วันเกิดเหตุ SOS ปัจจุบัน' : ''}`,
        criticalFalls,
        nearFalls,
        totalEvents,
        maxImpactG,
        timeSlot: slotChoice,
        clinicalContext,
        isToday,
      });
    }

    // Compute 7-day rolling event frequency (events per 7-day window)
    const dailySeries: DailyFallTrendPoint[] = rawDaily.map((pt, idx) => {
      const startIdx = Math.max(0, idx - 6);
      const windowSlice = rawDaily.slice(startIdx, idx + 1);
      const sumEvents = windowSlice.reduce((acc, item) => acc + item.totalEvents, 0);
      return {
        ...pt,
        rollingAvgEvents: Number((sumEvents / windowSlice.length).toFixed(2)),
      };
    });

    // Build 4-week summary series
    const weeklyBuckets = [
      { label: 'สัปดาห์ที่ 1 (วันที่ 1-7)', slice: dailySeries.slice(0, 7) },
      { label: 'สัปดาห์ที่ 2 (วันที่ 8-14)', slice: dailySeries.slice(7, 14) },
      { label: 'สัปดาห์ที่ 3 (วันที่ 15-21)', slice: dailySeries.slice(14, 21) },
      { label: 'สัปดาห์ที่ 4 (7 วันล่าสุด)', slice: dailySeries.slice(21, 30) },
    ];

    const weeklySeries: WeeklyFallSummaryPoint[] = weeklyBuckets.map((bucket) => {
      const criticalFalls = bucket.slice.reduce((s, d) => s + d.criticalFalls, 0);
      const nearFalls = bucket.slice.reduce((s, d) => s + d.nearFalls, 0);
      const maxImpactG = bucket.slice.reduce((m, d) => Math.max(m, d.maxImpactG), 1.1);
      const firstDate = bucket.slice[0]?.dateLabel.replace(' (วันนี้)', '') || '';
      const lastDate = bucket.slice[bucket.slice.length - 1]?.dateLabel.replace(' (วันนี้)', '') || '';
      return {
        weekLabel: bucket.label,
        dateRange: `${firstDate} – ${lastDate}`,
        criticalFalls,
        nearFalls,
        totalEvents: criticalFalls + nearFalls,
        maxImpactG: Number(maxImpactG.toFixed(1)),
      };
    });

    // Build Time-of-Day clinical pattern series
    const slotMechanisms: Record<DailyFallTrendPoint['timeSlot'], string> = {
      'ดึก (00:00-05:59)': 'ลุกปัสสาวะกลางดึก (Nocturia) · ทางเดินมืด/พื้นห้องน้ำลื่น',
      'เช้า (06:00-11:59)': 'ความดันโลหิตตกขณะเปลี่ยนท่าหลังตื่นนอน (Orthostatic BP Drop)',
      'บ่าย (12:00-17:59)': 'อ่อนล้ากล้ามเนื้อขา/ก้าวข้ามธรณีประตูหรือพื้นต่างระดับ',
      'ค่ำ (18:00-23:59)': 'อาการมึนงงหลังรับประทานยาลดความดันโลหิต/ยาประจำตัวช่วงเย็น',
    };

    const timeSlotSeries: TimeSlotPatternPoint[] = timeSlots.map((slot) => {
      const matching = dailySeries.filter((d) => d.totalEvents > 0 && d.timeSlot === slot);
      const criticalFalls = matching.reduce((s, d) => s + d.criticalFalls, 0);
      const nearFalls = matching.reduce((s, d) => s + d.nearFalls, 0);
      return {
        slotLabel: slot,
        shortLabel: slot.split(' ')[0],
        criticalFalls,
        nearFalls,
        totalEvents: criticalFalls + nearFalls,
        clinicalMechanism: slotMechanisms[slot],
      };
    });

    const totalCritical30d = dailySeries.reduce((s, d) => s + d.criticalFalls, 0);
    const totalNearFalls30d = dailySeries.reduce((s, d) => s + d.nearFalls, 0);
    const totalEvents30d = totalCritical30d + totalNearFalls30d;

    const recent7dEvents = dailySeries.slice(23, 30).reduce((s, d) => s + d.totalEvents, 0);
    const prev7dEvents = dailySeries.slice(16, 23).reduce((s, d) => s + d.totalEvents, 0);

    const sortedSlots = [...timeSlotSeries].sort((a, b) => b.totalEvents - a.totalEvents);
    const dominantSlot = sortedSlots[0] || timeSlotSeries[0];

    const patternInsight =
      recent7dEvents > prev7dEvents
        ? `พบความถี่การเดินเซและหกล้มเพิ่มขึ้นใน 7 วันล่าสุด (${recent7dEvents} ครั้ง เทียบกับ ${prev7dEvents} ครั้งในสัปดาห์ก่อนหน้า) มักเกิดช่วง${dominantSlot.slotLabel}`
        : `พบประวัติเสียการทรงตัวสะสม ${totalEvents30d} ครั้งในรอบ 30 วัน โดยกระจุกตัวสูงสุดในช่วง${dominantSlot.slotLabel}`;

    const clinicalActionNote = hasHypertension
      ? `ผู้ป่วยมีความดันโลหิต ${targetElder.chronicMetrics.sbp}/${targetElder.chronicMetrics.dbp} mmHg ควรประเมินภาวะความดันตกเมื่อลุกยืน (Orthostatic Hypotension) ปรับมื้อยาลดความดัน และติดไฟส่องสว่างทางเดินไปห้องน้ำ (${physicalDomain >= 12 ? 'คะแนนกายภาพเสื่อมสูง' : 'เฝ้าระวังการทรงตัว'})`
      : hasDiabetes
      ? `ผู้ป่วยมีประวัติเบาหวานร่วมกับคะแนนความเปราะบาง ${targetElder.riskProfile.frailtyScore}/100 ควรตรวจภาวะน้ำตาลต่ำช่วงดึก/เช้า และประเมินอาการชาปลายเท้า (Peripheral Neuropathy)`
      : `คะแนนความเปราะบาง ${targetElder.riskProfile.frailtyScore}/100 (${targetElder.livingArrangement}) แนะนำประเมินการทรงตัว TUG Test และจัดสิ่งแวดล้อมในบ้านร่วมกับ อสม. ${targetElder.assignedVhv}`;

    return {
      dailySeries,
      weeklySeries,
      timeSlotSeries,
      totalCritical30d,
      totalNearFalls30d,
      totalEvents30d,
      recent7dEvents,
      prev7dEvents,
      dominantTimeSlot: dominantSlot.slotLabel,
      patternInsight,
      clinicalActionNote,
    };
  }, [targetElder, impactForceG]);

  // Live timer when 1669 call is connected
  useEffect(() => {
    if (call1669State !== 'connected') {
      setCallDurationSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallDurationSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [call1669State]);

  // Play browser emergency SOS beacon sound when modal opens
  useEffect(() => {
    if (!isOpen || !targetElder) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(784, now);
      osc.frequency.setValueAtTime(1046.5, now + 0.16);
      osc.frequency.setValueAtTime(784, now + 0.32);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.54);
    } catch {
      // Ignore audio errors if blocked by browser autoplay policy
    }

    return () => {
      stopSpeakingThai();
      setIsVoicePlaying(false);
    };
  }, [isOpen, targetElder?.id]);

  if (!isOpen || !targetElder) return null;

  // Match village GPS coordinates from Korat map nodes
  const matchedVillageNode =
    VILLAGE_HIGH_RISK_MAP_NODES.find(
      (node) =>
        node.village === targetElder.village || node.subdistrict === targetElder.subdistrict
    ) || VILLAGE_HIGH_RISK_MAP_NODES[0];

  const handleToggleVoiceAlert = () => {
    if (isVoicePlaying) {
      stopSpeakingThai();
      setIsVoicePlaying(false);
      return;
    }
    const alertScript = `สัญญาณ เอสโอเอส ขอความช่วยเหลือ! นาฬิกา สมาร์ทวอทช์ ตรวจจับแรงกระแทกผิดปกติของ ${targetElder.name} อายุ ${targetElder.age} ปี พิกัด ${targetElder.village} ${targetElder.subdistrict} ความดันโลหิตล่าสุด ${targetElder.chronicMetrics.sbp} ตัวล่าง ${targetElder.chronicMetrics.dbp} มิลลิเมตรปรอท กรุณาประสานสายด่วนกู้ชีพ 1 6 6 9 ทันที`;
    setIsVoicePlaying(true);
    speakThaiText(
      alertScript,
      () => setIsVoicePlaying(false),
      () => setIsVoicePlaying(false)
    );
  };

  const handleDispatch1669 = () => {
    if (dispatchStatus !== 'idle') return;
    setDispatchStatus('dispatching');
    setTimeout(() => {
      const nowStr = new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setDispatchTimestamp(nowStr);
      setDispatchStatus('dispatched');
    }, 900);
  };

  const play1669CallTone = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Dual-tone DTMF / Emergency Dispatch ring sequence
      const freqs = [697, 1209, 852, 1336];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.09, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.1);
      });
    } catch {
      // Ignore audio errors if blocked by browser policy
    }
  };

  const handleTriggerDirect1669Call = () => {
    play1669CallTone();
    handleDispatch1669();

    if (call1669State === 'standby') {
      setCall1669State('dialing');
      window.setTimeout(() => {
        setCall1669State('connected');
      }, 1100);
    }
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartwatch-sos-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border-2 border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.45)] overflow-hidden my-auto">
        {/* Top Flashing Emergency Red Header Bar */}
        <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 px-5 py-4 border-b border-rose-400/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-white text-rose-600 shadow-lg shrink-0">
              <Watch className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-300 ring-2 ring-rose-700 animate-ping" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-950/90 text-amber-300 font-mono-num text-[11px] font-extrabold tracking-wider uppercase">
                  IOT SMART WATCH FALL &amp; IMPACT DETECTION
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-rose-700 font-mono-num text-[11px] font-extrabold">
                  สายด่วนกู้ชีพ 1669
                </span>
              </div>
              <h2
                id="smartwatch-sos-modal-title"
                className="mt-1 text-lg sm:text-xl font-extrabold text-white tracking-tight"
              >
                สัญญาณ SOS ขอความช่วยเหลือ!
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleVoiceAlert}
              className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/30 text-white hover:bg-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isVoicePlaying ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300" />
                  <span>หยุดเสียงประกาศ</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-amber-300" />
                  <span>เสียงเตือนภาษาไทย</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างแจ้งเตือน SOS"
              className="p-2 rounded-lg bg-slate-950/70 text-white hover:bg-slate-950 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Pop-Up Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Core SOS Impact Statement Box for Registered Elder */}
          <div className="rounded-xl bg-rose-950/60 border-2 border-rose-500/80 p-4 sm:p-5 text-center space-y-2.5 shadow-inner">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-extrabold tracking-wide">
              <BellRing className="w-4 h-4 animate-bounce" />
              <span>ตรวจพบอุบัติเหตุพลัดตกหกล้ม / แรงกระแทกฉุกเฉิน (Emergency Fall Alert)</span>
            </div>

            <p className="text-base sm:text-lg font-bold text-rose-100 leading-snug">
              นาฬิกา Smart Watch ตรวจจับแรงกระแทกผิดปกติของ
            </p>

            {/* Registered Elder Name Highlight */}
            <div className="py-2.5 px-4 rounded-xl bg-slate-950/90 border border-rose-400/60 inline-block max-w-full space-y-1.5">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300 tracking-tight">
                “{targetElder.name}”
              </p>
              <p className="text-xs font-mono-num text-slate-300">
                ผู้ลงทะเบียนในระบบรหัส: <strong className="text-white">{targetElder.id}</strong> · อายุ{' '}
                <strong className="text-white">{targetElder.age} ปี</strong> · กลุ่มความเสี่ยง{' '}
                <strong className="text-rose-400">
                  กลุ่ม {targetElder.riskProfile.matrixGroup} ({targetElder.riskProfile.matrixAction})
                </strong>
              </p>

              {/* Active Elder Device Battery Health Status Strip */}
              {targetElderBattery && (
                <div
                  className={`mt-1.5 pt-1.5 border-t flex flex-wrap items-center justify-center gap-2 text-xs ${
                    targetElderBattery.isLowBattery
                      ? 'border-rose-500/40 text-amber-200'
                      : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    {targetElderBattery.isLowBattery && (
                      <AlertTriangle
                        className="w-4 h-4 text-amber-300 animate-bounce shrink-0"
                        aria-label="คำเตือนแบตเตอรี่ต่ำกว่า 20%"
                      />
                    )}
                    {renderBatteryIcon(
                      targetElderBattery.batteryPct,
                      Boolean(lowPowerModeByElderId[targetElder.id]),
                      'w-4 h-4 shrink-0'
                    )}
                    <span>
                      แบตเตอรี่อุปกรณ์:{' '}
                      <strong
                        className={`font-mono-num ${
                          targetElderBattery.isLowBattery ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {targetElderBattery.batteryPct}%
                      </strong>
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono-num">
                    สุขภาพแบต <strong className="text-white">{targetElderBattery.batteryHealthPct}%</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono-num">
                    สำรองไฟได้อีก{' '}
                    <strong className="text-teal-300">~{targetElderBattery.estimatedHoursLeft} ชม.</strong>
                  </span>
                  {targetElderBattery.isLowBattery && (
                    <span className="inline-flex items-center gap-1 text-rose-300 font-extrabold">
                      <span aria-hidden="true">·</span>
                      <span>ต่ำกว่า 20% เสี่ยงสัญญาณขาดหาย!</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Switch Registered Elder inside Pop-Up to inspect any registered user */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
              <label
                htmlFor="sos-registered-elder-select"
                className="font-semibold text-slate-300"
              >
                เลือกผู้ลงทะเบียนในระบบ ({elders.length} ราย · แบตต่ำกว่า 20% จำนวน {lowBatteryCount} ราย):
              </label>
              <select
                id="sos-registered-elder-select"
                value={targetElder.id}
                onChange={(e) => {
                  const found = elders.find((el) => el.id === e.target.value);
                  if (found) onSelectElder(found);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-white font-semibold text-xs focus:outline-none focus:border-rose-400 cursor-pointer"
              >
                {elderBatteryStatuses.map(({ elder: el, batteryPct, isLowBattery }) => (
                  <option key={el.id} value={el.id}>
                    {isLowBattery ? `⚠️ [แบตต่ำ ${batteryPct}%] ` : `[แบต ${batteryPct}%] `}
                    {el.name} ({el.id} · {el.village} · กลุ่ม {el.riskProfile.matrixGroup})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Targeted Push Notification 2-Tier Routing Status (Assigned House VHV First + Simultaneous RPH Escalation) */}
          <div className="rounded-xl bg-slate-950/95 border border-emerald-500/50 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                <span className="font-extrabold text-white">
                  ระบบแจ้งเตือนแบบระบุตัวบุคคล ({UI_LABELS.pushNotification.targetedPushTitle} — 2-Tier Routing)
                </span>
              </div>
              <span className="font-mono-num text-[11px] font-bold text-emerald-300">
                ✓ ส่งแจ้งเตือนอัตโนมัติสำเร็จ (T+0.4 วินาที)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/60 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-emerald-300">
                    1. แจ้ง อสม. ผู้รับผิดชอบบ้านหลังนี้ก่อน (ด่านหน้าใกล้บ้านที่สุด):
                  </p>
                  <p className="text-sm font-extrabold text-white mt-0.5">
                    {targetElder.assignedVhv}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    พื้นที่รับผิดชอบ: {targetElder.village} · LINE OA Push + เสียงเตือนภัยฉุกเฉิน
                  </p>
                </div>
                <span className="text-[10px] font-mono-num font-bold text-emerald-300 shrink-0">
                  แจ้งเตือนแล้ว ✓
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/60 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-teal-300">
                    2. {UI_LABELS.pushNotification.tier2RphImmediate} (คู่ขนานแบบ Real-time):
                  </p>
                  <p className="text-sm font-extrabold text-white mt-0.5">
                    รพ.สต.{targetElder.subdistrict.replace('ต.', '')} &amp; ศูนย์กู้ชีพ 1669
                  </p>
                  <p className="text-[11px] text-slate-300">
                    ส่งพิกัดบ้าน + สัญญาณชีพ ({impactForceG}G, HR {heartRateBpm} bpm) เข้าโต๊ะพยาบาลเวชปฏิบัติทันที
                  </p>
                </div>
                <span className="text-[10px] font-mono-num font-bold text-teal-300 shrink-0">
                  รับเรื่องทันที ✓
                </span>
              </div>
            </div>
          </div>

          {/* Smart Watch Real-time Sensor Telemetry & 1669 Emergency Hotline Hero Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
            {/* Left 7 cols: Smart Watch Telemetry */}
            <div className="sm:col-span-7 rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-teal-300 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                  ข้อมูลเซนเซอร์นาฬิกา Smart Watch แบบ Real-time
                </span>
                <span className="font-mono-num text-[11px] text-rose-300 font-semibold">
                  สถานะ: ส่งสัญญาณ SOS อัตโนมัติ
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono-num">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-rose-500/40 text-center">
                  <p className="text-[10px] font-sans text-slate-300">แรงกระแทก (Impact)</p>
                  <p className="mt-0.5 text-lg font-extrabold text-rose-400">
                    {impactForceG} G
                  </p>
                  <p className="text-[10px] font-sans text-rose-300">เกินเกณฑ์ปลอดภัย</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-300">ชีพจรขณะเกิดเหตุ</p>
                  <p className="mt-0.5 text-lg font-extrabold text-amber-300">
                    {heartRateBpm} <span className="text-[10px] font-normal">BPM</span>
                  </p>
                  <p className="text-[10px] font-sans text-slate-400">SpO₂ {spo2Pct}%</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-300">ความดันล่าสุด</p>
                  <p className="mt-0.5 text-lg font-extrabold text-white">
                    {targetElder.chronicMetrics.sbp}/{targetElder.chronicMetrics.dbp}
                  </p>
                  <p className="text-[10px] font-sans text-slate-400">
                    Frailty {targetElder.riskProfile.frailtyScore}/100
                  </p>
                </div>

                {/* Battery Health Telemetry Tile with < 20% Warning Icon */}
                {targetElderBattery && (
                  <div
                    className={`p-2.5 rounded-lg text-center transition-colors ${
                      targetElderBattery.isLowBattery
                        ? 'bg-rose-950/60 border border-amber-400/80'
                        : 'bg-slate-900 border border-slate-800'
                    }`}
                  >
                    <p className="text-[10px] font-sans text-slate-300 flex items-center justify-center gap-1">
                      {targetElderBattery.isLowBattery && (
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-amber-300 animate-bounce shrink-0"
                          aria-label="แบตเตอรี่ต่ำกว่า 20%"
                        />
                      )}
                      <span>แบตเตอรี่นาฬิกา</span>
                    </p>
                    <div className="mt-0.5 flex items-center justify-center gap-1">
                      {renderBatteryIcon(
                        targetElderBattery.batteryPct,
                        Boolean(lowPowerModeByElderId[targetElder.id]),
                        'w-4 h-4 shrink-0'
                      )}
                      <span
                        className={`text-lg font-extrabold ${
                          targetElderBattery.isLowBattery ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {targetElderBattery.batteryPct}%
                      </span>
                    </div>
                    <p
                      className={`text-[10px] font-sans ${
                        targetElderBattery.isLowBattery
                          ? 'text-amber-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {targetElderBattery.isLowBattery
                        ? 'ต่ำกว่า 20% · เสี่ยงดับ!'
                        : `สุขภาพแบต ${targetElderBattery.batteryHealthPct}%`}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-300 space-y-1 pt-1 border-t border-slate-800/90">
                <div className="flex items-center gap-1.5 text-slate-200">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    พิกัดเกิดเหตุ: <strong className="text-white">{targetElder.village}</strong>{' '}
                    {targetElder.subdistrict} {targetElder.district} (GPS:{' '}
                    <span className="font-mono-num text-teal-300">
                      {matchedVillageNode.lat.toFixed(4)}°N, {matchedVillageNode.lng.toFixed(4)}°E
                    </span>
                    )
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>
                    ผู้ดูแล: <strong className="text-white">{targetElder.caregiverName}</strong> · โทร:{' '}
                    <strong className="font-mono-num text-amber-300">{targetElder.phone}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Prominent 1669 Emergency Rescue Callout Box */}
            <div
              className={`sm:col-span-5 rounded-xl border-2 p-4 text-white flex flex-col justify-between shadow-lg transition-all duration-300 ${
                call1669State === 'connected'
                  ? 'bg-gradient-to-b from-emerald-700 via-teal-800 to-slate-900 border-emerald-300 shadow-[0_0_32px_rgba(16,185,129,0.5)]'
                  : call1669State === 'dialing'
                  ? 'bg-gradient-to-b from-amber-600 via-rose-700 to-red-900 border-amber-200 shadow-[0_0_35px_rgba(251,191,36,0.65)]'
                  : 'bg-gradient-to-b from-rose-600 to-red-800 border-amber-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider bg-slate-950/45 px-2 py-0.5 rounded text-amber-200 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        call1669State === 'connected'
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-amber-300 animate-pulse'
                      }`}
                    />
                    สถาบันการแพทย์ฉุกเฉิน
                  </span>
                  <div className="relative flex items-center justify-center">
                    {call1669State !== 'standby' && (
                      <span className="absolute -inset-1.5 rounded-full bg-amber-300/35 animate-ping" />
                    )}
                    <Ambulance
                      className={`w-6 h-6 text-amber-300 relative ${
                        call1669State === 'dialing' ? 'animate-bounce' : ''
                      }`}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono-num text-4xl sm:text-5xl font-extrabold tracking-tight text-amber-300 drop-shadow">
                    1669
                  </span>
                  <span className="text-xs font-bold text-white leading-tight">
                    สายด่วนกู้ชีพฉุกเฉิน
                    <br />
                    รพ.มหาราชนครราชสีมา
                  </span>
                </div>
                <p className="mt-2 text-xs text-rose-100 leading-relaxed">
                  ส่งพิกัด GPS บ้านผู้สูงอายุ ประวัติโรคประจำตัว ({targetElder.chronicConditions.join(', ') || 'ไม่มีโรคประจำตัว'}) และค่าสัญญาณชีพไปยังศูนย์สั่งการ 1669
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {/* Direct 1669 Call Trigger Button with Multi-Stage Animation when Activated */}
                <button
                  type="button"
                  onClick={handleTriggerDirect1669Call}
                  aria-live="polite"
                  className={`relative w-full py-3 px-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all duration-300 overflow-hidden cursor-pointer ${
                    call1669State === 'connected'
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-4 ring-emerald-300/50 scale-[1.01]'
                      : call1669State === 'dialing'
                      ? 'bg-amber-300 text-slate-950 ring-4 ring-amber-200/70 scale-[1.02]'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 hover:scale-[1.01]'
                  }`}
                >
                  {/* Animated Concentric Ripple Waves when Activated */}
                  {call1669State !== 'standby' && (
                    <>
                      <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/25 animate-pulse" />
                      <span className="pointer-events-none absolute -left-3 w-12 h-12 rounded-full bg-rose-500/20 animate-ping" />
                    </>
                  )}

                  <span className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950 text-amber-300 shrink-0">
                    {call1669State !== 'standby' && (
                      <span className="absolute inset-0 rounded-lg bg-amber-400/40 animate-ping" />
                    )}
                    <PhoneCall
                      className={`w-4 h-4 relative ${
                        call1669State === 'dialing'
                          ? 'animate-bounce text-rose-400'
                          : call1669State === 'connected'
                          ? 'text-emerald-400 animate-pulse'
                          : 'text-amber-300'
                      }`}
                    />
                  </span>

                  <span className="relative flex flex-col items-start text-left leading-tight">
                    {call1669State === 'standby' && (
                      <>
                        <span>กดโทรฉุกเฉิน 1669 ทันที (Direct Call)</span>
                        <span className="text-[10px] font-bold text-slate-800">
                          เชื่อมสัญญาณเสียง + ส่งพิกัด GPS กู้ชีพฉุกเฉิน
                        </span>
                      </>
                    )}
                    {call1669State === 'dialing' && (
                      <>
                        <span>กำลังต่อสายด่วนกู้ชีพ 1669...</span>
                        <span className="text-[10px] font-bold text-rose-900">
                          กำลังส่งพิกัด {matchedVillageNode.lat.toFixed(4)}°N, {matchedVillageNode.lng.toFixed(4)}°E
                        </span>
                      </>
                    )}
                    {call1669State === 'connected' && (
                      <>
                        <span>เชื่อมต่อศูนย์กู้ชีพ 1669 แล้ว ({formatCallDuration(callDurationSec)})</span>
                        <span className="text-[10px] font-bold text-slate-900">
                          สายด่วนกำลังรับแจ้งเหตุ · หน่วยกู้ชีพกำลังออกเดินทาง
                        </span>
                      </>
                    )}
                  </span>

                  {/* Animated Voice Waveform Bars when Dialing or Connected */}
                  {call1669State !== 'standby' && (
                    <span
                      aria-hidden="true"
                      className="relative ml-auto flex items-end gap-0.5 h-4 px-1"
                    >
                      <span className="w-1 h-2 bg-slate-950 rounded-full animate-bounce" />
                      <span className="w-1 h-4 bg-rose-600 rounded-full animate-pulse" />
                      <span className="w-1 h-3 bg-slate-950 rounded-full animate-bounce" />
                      <span className="w-1 h-4 bg-rose-600 rounded-full animate-pulse" />
                    </span>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <a
                    href="tel:1669"
                    onClick={handleTriggerDirect1669Call}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-950 text-amber-300 border border-amber-300/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>เปิดแป้นโทรศัพท์ 1669</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleDispatch1669}
                    disabled={dispatchStatus !== 'idle'}
                    className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      dispatchStatus === 'dispatched'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950/85 hover:bg-slate-950 text-white border border-white/30'
                    }`}
                  >
                    {dispatchStatus === 'idle' && (
                      <>
                        <Send className="w-3.5 h-3.5 text-amber-300" />
                        <span>ส่งพิกัดแจ้ง อสม.</span>
                      </>
                    )}
                    {dispatchStatus === 'dispatching' && <span>กำลังส่งพิกัด...</span>}
                    {dispatchStatus === 'dispatched' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ส่งพิกัดแล้ว</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Registered Elders Smart Watch Battery Health Monitoring Status (Prevent Service Disruption) */}
          <div className="rounded-xl bg-slate-950 border border-amber-500/45 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 shrink-0">
                    <BatteryWarning className="w-4 h-4 animate-pulse" />
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                    ระบบเฝ้าระวังสถานะแบตเตอรี่และสุขภาพอุปกรณ์ผู้สูงอายุรายบุคคล (Battery Health Monitor)
                  </h3>
                  {lowBatteryCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce shrink-0" />
                      <span>พบแบตเตอรี่ต่ำกว่า 20% จำนวน {lowBatteryCount} เครื่อง</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  ตรวจสอบระดับพลังงานและสุขภาพเซลล์แบตเตอรี่ของผู้ลงทะเบียนทั้ง {elderBatteryStatuses.length} ราย · แสดงไอคอนแจ้งเตือนเมื่อแบตเตอรี่ต่ำกว่า 20% เพื่อป้องกันสัญญาณขาดหาย
                </p>
              </div>

              {/* Filter & Batch Prevent Disruption Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setBatteryFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      batteryFilter === 'all'
                        ? 'bg-teal-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ทั้งหมด ({elderBatteryStatuses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatteryFilter('low_under_20')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      batteryFilter === 'low_under_20'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-rose-300 hover:text-white'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>ต่ำกว่า 20% ({lowBatteryCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatteryFilter('healthy_20_plus')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      batteryFilter === 'healthy_20_plus'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ปกติ ≥20% ({healthyBatteryCount})
                  </button>
                </div>

                {lowBatteryCount > 0 && (
                  <button
                    type="button"
                    onClick={handleNotifyAllLowBattery}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>แจ้ง อสม./ญาติ ชาร์จทุกราย (&lt;20%)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Battery Fleet Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <p className="text-[11px] text-slate-400">ผู้สูงอายุลงทะเบียนทั้งหมด</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-white">
                    {elderBatteryStatuses.length} ราย
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono-num">Online 100%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">เชื่อมต่อโครงข่าย IoT รพ.สต.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40">
                <p className="text-[11px] text-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>แบตเตอรี่ต่ำกว่า 20%</span>
                </p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-rose-400">
                    {lowBatteryCount} ราย
                  </span>
                  <span className="text-[10px] text-amber-300 font-semibold">เสี่ยงเครื่องดับ</span>
                </div>
                <p className="text-[10px] text-rose-200/80 mt-0.5">ต้องชาร์จเพื่อป้องกันบริการหยุดชะงัก</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/30">
                <p className="text-[11px] text-slate-400">ระดับพลังงานปกติ (≥20%)</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-emerald-400">
                    {healthyBatteryCount} ราย
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono-num">พร้อมเฝ้าระวัง</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">ส่งพิกัดและชีพจรต่อเนื่อง</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-teal-500/30">
                <p className="text-[11px] text-slate-400">สุขภาพเซลล์แบตเฉลี่ย</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-teal-300">
                    {avgBatteryHealthPct}%
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono-num">Li-Po Health</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">เสื่อมสภาพต่ำ · เก็บประจุดี</p>
              </div>
            </div>

            {/* Per-Elder Registered Device Battery Health Roster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredBatteryStatuses.map((item) => {
                const {
                  elder,
                  batteryPct,
                  isLowBattery,
                  batteryHealthPct,
                  estimatedHoursLeft,
                  voltageVolts,
                  lastSyncMinutesAgo,
                  statusLabel,
                  disruptionRiskNote,
                } = item;
                const isSelected = elder.id === targetElder.id;
                const notifiedTime = notifiedChargeByElderId[elder.id];
                const isLowPowerMode = Boolean(lowPowerModeByElderId[elder.id]);

                return (
                  <div
                    key={elder.id}
                    className={`rounded-xl p-3 border transition-all flex flex-col justify-between gap-2.5 ${
                      isLowBattery
                        ? isSelected
                          ? 'bg-rose-950/70 border-amber-400 shadow-[0_0_18px_rgba(244,63,94,0.3)]'
                          : 'bg-rose-950/35 border-rose-500/50 hover:border-amber-400/70'
                        : isSelected
                        ? 'bg-slate-900 border-teal-400'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Elder Identity & Battery Percentage Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isLowBattery && (
                              <span
                                title="คำเตือน: แบตเตอรี่ต่ำกว่า 20% เสี่ยงสัญญาณขาดหาย"
                                className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-rose-500/20 border border-amber-400/60 text-amber-300 shrink-0"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectElder(elder)}
                              className="text-xs sm:text-sm font-extrabold text-white hover:text-amber-300 text-left truncate cursor-pointer"
                            >
                              {elder.name}
                            </button>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-amber-300">
                                · กำลังตรวจสอบ
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {elder.id} · {elder.village} · กลุ่ม {elder.riskProfile.matrixGroup}
                          </p>
                        </div>

                        {/* Battery Percentage & Warning Icon Readout */}
                        <div className="flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1">
                            {isLowBattery && (
                              <AlertTriangle
                                className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0"
                                aria-label="ไอคอนเตือนแบตเตอรี่ต่ำกว่า 20%"
                              />
                            )}
                            {renderBatteryIcon(batteryPct, isLowPowerMode, 'w-4 h-4 shrink-0')}
                            <span
                              className={`font-mono-num text-sm sm:text-base font-extrabold ${
                                isLowBattery
                                  ? 'text-rose-400'
                                  : batteryPct < 35
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {batteryPct}%
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold ${
                              isLowBattery ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* Visual Battery Level Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isLowBattery
                              ? 'bg-gradient-to-r from-rose-600 to-amber-400 animate-pulse'
                              : batteryPct < 35
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          }`}
                          style={{ width: `${Math.max(6, batteryPct)}%` }}
                        />
                      </div>

                      {/* Telemetry Metadata Unboxed Line */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono-num">
                        <span>
                          สุขภาพแบต: <strong className="text-white">{batteryHealthPct}%</strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>
                          สำรองไฟ: <strong className="text-teal-300">~{estimatedHoursLeft} ชม.</strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span>{voltageVolts}V</span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="font-sans text-slate-400">
                          ซิงค์ {lastSyncMinutesAgo} นาทีที่แล้ว
                        </span>
                      </div>

                      {/* Clinical / Service Continuity Note */}
                      <p
                        className={`text-[11px] leading-snug ${
                          isLowBattery ? 'text-rose-200' : 'text-slate-400'
                        }`}
                      >
                        {disruptionRiskNote}
                      </p>
                    </div>

                    {/* Action Controls per Elder to Prevent Service Disruption */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectElder(elder)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800 text-amber-300 border border-amber-400/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isSelected ? 'กำลังแสดงข้อมูลอยู่' : 'เลือกดูข้อมูล SOS'}
                      </button>

                      {isLowBattery ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleLowPowerBeacon(elder.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              isLowPowerMode
                                ? 'bg-teal-500/20 border border-teal-400 text-teal-200'
                                : 'bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200'
                            }`}
                          >
                            <Zap className="w-3 h-3 text-amber-300 shrink-0" />
                            <span>
                              {isLowPowerMode ? 'เปิดประหยัดพลังงานแล้ว (+4.5 ชม.)' : 'โหมดประหยัดพลังงาน'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNotifyChargeElder(elder.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              notifiedTime
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-rose-600 hover:bg-rose-500 text-white'
                            }`}
                          >
                            {notifiedTime ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>แจ้งชาร์จแล้ว ({notifiedTime})</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" />
                                <span>แจ้งญาติ/อสม. ชาร์จแบตด่วน</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>พร้อมเฝ้าระวังต่อเนื่อง</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 30-Day Fall Event Frequency & Gait Instability Historical Trend Chart for Medical Officers */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-rose-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                    แนวโน้มความถี่อุบัติเหตุพลัดตกหกล้มและการเสียการทรงตัวย้อนหลัง 30 วัน
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ข้อมูลเซนเซอร์ Accelerometer &amp; Gyroscope รายบุคคลของ <strong className="text-slate-200">{targetElder.name}</strong> · ช่วยเจ้าหน้าที่วิเคราะห์รูปแบบและช่วงเวลาเสี่ยง
                </p>
              </div>

              {/* Segmented View Controls */}
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTrendViewMode('daily30d')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      trendViewMode === 'daily30d'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    รายวัน (30 วัน)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendViewMode('weekly4w')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      trendViewMode === 'weekly4w'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    รายสัปดาห์ (4 สัปดาห์)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendViewMode('timeOfDay')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      trendViewMode === 'timeOfDay'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ช่วงเวลาเกิดเหตุ
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSeverityFilter((prev) => (prev === 'all' ? 'criticalOnly' : 'all'))
                  }
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                    severityFilter === 'criticalOnly'
                      ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {severityFilter === 'criticalOnly'
                    ? 'แสดงเฉพาะหกล้ม SOS (≥3.5G)'
                    : 'รวมสัญญาณเดินเซ/เกือบล้ม'}
                </button>
              </div>
            </div>

            {/* Key 30-Day Clinical Pattern Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/30">
                <p className="text-[11px] text-slate-400">หกล้มฉุกเฉิน (30 วัน)</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-rose-400">
                    {fallTrendAnalytics.totalCritical30d} ครั้ง
                  </span>
                  <span className="text-[10px] text-rose-300 font-mono-num">≥ 3.5G</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">รวมเหตุ SOS วันนี้</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30">
                <p className="text-[11px] text-slate-400">เดินเซ/เกือบล้มสะสม</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-amber-300">
                    {fallTrendAnalytics.totalNearFalls30d} ครั้ง
                  </span>
                  <span className="text-[10px] text-amber-200/80 font-mono-num">1.8–3.4G</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">สัญญาณเตือนล่วงหน้า</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                <p className="text-[11px] text-slate-400">ความถี่ 7 วันล่าสุด</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-extrabold text-white">
                    {fallTrendAnalytics.recent7dEvents} ครั้ง
                  </span>
                  <span className="text-[10px] text-rose-300 flex items-center gap-0.5 font-semibold">
                    <TrendingUp className="w-3 h-3" />
                    {fallTrendAnalytics.recent7dEvents >= fallTrendAnalytics.prev7dEvents
                      ? `เพิ่มขึ้นจาก ${fallTrendAnalytics.prev7dEvents}`
                      : `ลดลงจาก ${fallTrendAnalytics.prev7dEvents}`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">เทียบสัปดาห์ก่อนหน้า</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-teal-500/30">
                <p className="text-[11px] text-slate-400">ช่วงเวลาที่พบบ่อยที่สุด</p>
                <p className="mt-0.5 text-sm font-extrabold text-teal-300 truncate">
                  {fallTrendAnalytics.dominantTimeSlot}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">รูปแบบเวลาเสี่ยงหลัก</p>
              </div>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 px-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                  <span>พลัดตกหกล้มรุนแรง / SOS (≥3.5G)</span>
                </span>
                {severityFilter === 'all' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
                    <span>เดินเซ / เสียการทรงตัว (1.8–3.4G)</span>
                  </span>
                )}
                {trendViewMode === 'daily30d' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-0.5 bg-teal-400 inline-block" />
                    <span>แรงกระแทกสูงสุดรายวัน (Peak G-Force)</span>
                  </span>
                )}
              </div>
              <span className="text-slate-400">
                {trendViewMode === 'daily30d'
                  ? 'คลิกที่แท่งกราฟเพื่อดูรายละเอียดเหตุการณ์รายวัน'
                  : trendViewMode === 'weekly4w'
                  ? 'เปรียบเทียบแนวโน้มความถี่รายสัปดาห์ (Week 1 – Week 4)'
                  : 'จำแนกตามช่วงเวลาของวันเพื่อวางแผนป้องกัน'}
              </span>
            </div>

            {/* Recharts Historical Trend Visualization */}
            <div className="h-56 w-full bg-slate-900/60 rounded-xl border border-slate-800/80 p-2.5">
              {trendViewMode === 'daily30d' && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={fallTrendAnalytics.dailySeries}
                    margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedPoint = state.activePayload[0].payload as DailyFallTrendPoint;
                        setSelectedDayPoint(clickedPoint);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      interval={4}
                    />
                    <YAxis
                      yAxisId="events"
                      allowDecimals={false}
                      domain={[0, 3]}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: 'จำนวนครั้ง',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#64748b',
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      yAxisId="gforce"
                      orientation="right"
                      domain={[0, 6]}
                      tick={{ fill: '#5eead4', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      unit="G"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload as DailyFallTrendPoint;
                        return (
                          <div className="rounded-xl bg-slate-950/95 border border-rose-500/60 p-3 shadow-xl text-xs space-y-1.5 max-w-xs">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                              <span className="font-extrabold text-white">{pt.fullDateLabel}</span>
                              <span className="font-mono-num text-rose-400 font-bold">
                                Peak {pt.maxImpactG}G
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px]">
                              <div className="text-rose-300">
                                หกล้ม SOS: <strong>{pt.criticalFalls} ครั้ง</strong>
                              </div>
                              <div className="text-amber-300">
                                เดินเซ/เกือบล้ม: <strong>{pt.nearFalls} ครั้ง</strong>
                              </div>
                            </div>
                            {pt.totalEvents > 0 && (
                              <p className="text-[11px] text-teal-300">
                                ช่วงเวลา: <strong>{pt.timeSlot}</strong>
                              </p>
                            )}
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {pt.clinicalContext}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      yAxisId="gforce"
                      y={3.5}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: 'เกณฑ์ SOS 3.5G',
                        position: 'insideTopRight',
                        fill: '#fda4af',
                        fontSize: 10,
                      }}
                    />
                    {severityFilter === 'all' && (
                      <Bar
                        yAxisId="events"
                        dataKey="nearFalls"
                        name="เดินเซ/เกือบล้ม"
                        stackId="fallStack"
                        fill="#fbbf24"
                        radius={[2, 2, 0, 0]}
                        cursor="pointer"
                      />
                    )}
                    <Bar
                      yAxisId="events"
                      dataKey="criticalFalls"
                      name="หกล้มฉุกเฉิน SOS"
                      stackId="fallStack"
                      fill="#f43f5e"
                      radius={[3, 3, 0, 0]}
                      cursor="pointer"
                    >
                      {fallTrendAnalytics.dailySeries.map((entry) => (
                        <Cell
                          key={`cell-${entry.dayIndex}`}
                          fill={entry.isToday ? '#e11d48' : '#f43f5e'}
                          stroke={entry.isToday ? '#fde047' : 'none'}
                          strokeWidth={entry.isToday ? 1.5 : 0}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="gforce"
                      type="monotone"
                      dataKey="maxImpactG"
                      name="แรงกระแทกสูงสุด (G)"
                      stroke="#2dd4bf"
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, payload } = props as {
                          cx: number;
                          cy: number;
                          payload: DailyFallTrendPoint;
                        };
                        if (payload.criticalFalls > 0) {
                          return (
                            <circle
                              key={`dot-${payload.dayIndex}`}
                              cx={cx}
                              cy={cy}
                              r={payload.isToday ? 5 : 3.5}
                              fill={payload.isToday ? '#fde047' : '#f43f5e'}
                              stroke="#0f172a"
                              strokeWidth={1.5}
                            />
                          );
                        }
                        return <g key={`dot-empty-${payload.dayIndex}`} />;
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {trendViewMode === 'weekly4w' && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={fallTrendAnalytics.weeklySeries}
                    margin={{ top: 10, right: 12, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fill: '#cbd5e1', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const wk = payload[0].payload as WeeklyFallSummaryPoint;
                        return (
                          <div className="rounded-xl bg-slate-950/95 border border-rose-500/60 p-3 shadow-xl text-xs space-y-1">
                            <p className="font-extrabold text-white">{wk.weekLabel}</p>
                            <p className="text-[11px] text-slate-400">ช่วงวันที่ {wk.dateRange}</p>
                            <p className="text-rose-300 font-mono-num">
                              หกล้มฉุกเฉิน SOS: <strong>{wk.criticalFalls} ครั้ง</strong>
                            </p>
                            <p className="text-amber-300 font-mono-num">
                              เดินเซ/เสียการทรงตัว: <strong>{wk.nearFalls} ครั้ง</strong>
                            </p>
                            <p className="text-teal-300 font-mono-num">
                              แรงกระแทกสูงสุดในสัปดาห์: <strong>{wk.maxImpactG} G</strong>
                            </p>
                          </div>
                        );
                      }}
                    />
                    {severityFilter === 'all' && (
                      <Bar
                        dataKey="nearFalls"
                        name="เดินเซ/เกือบล้ม"
                        stackId="weekStack"
                        fill="#fbbf24"
                        barSize={38}
                        radius={[0, 0, 0, 0]}
                      />
                    )}
                    <Bar
                      dataKey="criticalFalls"
                      name="หกล้มฉุกเฉิน SOS"
                      stackId="weekStack"
                      fill="#f43f5e"
                      barSize={38}
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {trendViewMode === 'timeOfDay' && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={fallTrendAnalytics.timeSlotSeries}
                    margin={{ top: 10, right: 12, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="slotLabel"
                      tick={{ fill: '#cbd5e1', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const slot = payload[0].payload as TimeSlotPatternPoint;
                        return (
                          <div className="rounded-xl bg-slate-950/95 border border-teal-500/60 p-3 shadow-xl text-xs space-y-1 max-w-xs">
                            <p className="font-extrabold text-white">ช่วงเวลา {slot.slotLabel}</p>
                            <p className="text-rose-300 font-mono-num">
                              หกล้มฉุกเฉิน SOS: <strong>{slot.criticalFalls} ครั้ง</strong>
                            </p>
                            <p className="text-amber-300 font-mono-num">
                              เดินเซ/เสียการทรงตัว: <strong>{slot.nearFalls} ครั้ง</strong>
                            </p>
                            <p className="text-[11px] text-teal-200 pt-1 border-t border-slate-800">
                              ปัจจัยเสี่ยงทางคลินิก: {slot.clinicalMechanism}
                            </p>
                          </div>
                        );
                      }}
                    />
                    {severityFilter === 'all' && (
                      <Bar
                        dataKey="nearFalls"
                        name="เดินเซ/เกือบล้ม"
                        stackId="slotStack"
                        fill="#fbbf24"
                        barSize={42}
                      />
                    )}
                    <Bar
                      dataKey="criticalFalls"
                      name="หกล้มฉุกเฉิน SOS"
                      stackId="slotStack"
                      fill="#f43f5e"
                      barSize={42}
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Selected Day Inspection Card OR Medical Officer Pattern Interpretation Summary */}
            {selectedDayPoint ? (
              <div className="rounded-xl bg-slate-900 border border-rose-500/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span className="font-extrabold text-white">
                      ข้อมูลวันที่เลือก: {selectedDayPoint.fullDateLabel}
                    </span>
                    <span className="font-mono-num text-amber-300 font-bold">
                      แรงกระแทกสูงสุด {selectedDayPoint.maxImpactG}G
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-teal-300 font-semibold">
                      ช่วงเวลา: {selectedDayPoint.timeSlot}
                    </span>
                  </div>
                  <p className="text-slate-200">
                    หกล้มฉุกเฉิน <strong className="text-rose-400">{selectedDayPoint.criticalFalls} ครั้ง</strong> · เดินเซ/เกือบล้ม{' '}
                    <strong className="text-amber-300">{selectedDayPoint.nearFalls} ครั้ง</strong> — {selectedDayPoint.clinicalContext}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayPoint(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] shrink-0 cursor-pointer"
                >
                  ดูสรุปรูปแบบ 30 วัน
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>สรุปรูปแบบความเสี่ยงสำหรับแพทย์/เจ้าหน้าที่ รพ.สต. (30-Day Clinical Pattern)</span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  • <strong>แนวโน้มความถี่:</strong> {fallTrendAnalytics.patternInsight}
                </p>
                <p className="text-teal-200/90 leading-relaxed">
                  • <strong>ข้อเสนอแนะเพื่อวางแผนดูแล:</strong> {fallTrendAnalytics.clinicalActionNote}
                </p>
              </div>
            )}
          </div>

          {/* Animated Live 1669 Call & Emergency Dispatch Console when Call Trigger is Activated */}
          {(call1669State !== 'standby' || dispatchStatus === 'dispatched') && (
            <div
              className={`rounded-xl border-2 p-4 space-y-3 text-xs transition-all duration-300 ${
                call1669State === 'connected'
                  ? 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                  : 'bg-amber-950/90 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.3)]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-950 border border-emerald-400/60 text-emerald-300 shrink-0">
                    <span className="absolute -inset-1 rounded-xl bg-emerald-400/25 animate-ping" />
                    <PhoneCall className="w-4 h-4 relative animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">
                        {call1669State === 'dialing'
                          ? 'กำลังเรียกสายด่วนกู้ชีพ 1669 (Emergency Dialing...)'
                          : 'สายด่วนกู้ชีพ 1669 กำลังสนทนาและรับพิกัดฉุกเฉิน (Active 1669 Call)'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-mono-num text-[11px] font-extrabold">
                        {call1669State === 'connected'
                          ? `LIVE ${formatCallDuration(callDurationSec)}`
                          : 'CONNECTING...'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-200 mt-0.5">
                      ศูนย์สั่งการกู้ชีพ รพ.มหาราชนครราชสีมา · แจ้งเหตุเมื่อ {dispatchTimestamp || 'สักครู่'} น.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleVoiceAlert}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-400/50 text-emerald-200 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>
                      {isVoicePlaying ? 'หยุดอ่านพิกัด' : 'อ่านพิกัดแจ้ง 1669 อัตโนมัติ'}
                    </span>
                  </button>
                  {call1669State !== 'standby' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCall1669State('standby');
                        setCallDurationSec(0);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                    >
                      วางสาย
                    </button>
                  )}
                </div>
              </div>

              <p className="text-slate-100 leading-relaxed pt-1 border-t border-emerald-500/30">
                ระบบส่งข้อมูลผู้ลงทะเบียน <strong>{targetElder.name}</strong> ({targetElder.id}) พิกัด{' '}
                <strong>
                  {targetElder.village} {targetElder.subdistrict}
                </strong>{' '}
                (GPS: <span className="font-mono-num text-amber-300">{matchedVillageNode.lat.toFixed(4)}°N, {matchedVillageNode.lng.toFixed(4)}°E</span>) ไปยัง{' '}
                <strong>ศูนย์สั่งการกู้ชีพ 1669 นครราชสีมา</strong> และแจ้งเตือน{' '}
                <strong>{targetElder.assignedVhv}</strong> เพื่อเข้าปฐมพยาบาลเบื้องต้นเรียบร้อยแล้ว
              </p>
            </div>
          )}

          {/* Footer Action Controls */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-rose-400" />
              <span>
                อสม. ประจำพื้นที่: <strong className="text-white">{targetElder.assignedVhv}</strong> ({matchedVillageNode.rphFacility})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenElderProfile(targetElder);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 border border-teal-500/60 text-teal-300 hover:bg-teal-500 hover:text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                เปิดแฟ้มประวัติสุขภาพ
              </button>

              <button
                type="button"
                onClick={() => {
                  onCreateEmergencyReferral(targetElder);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HeartPulse className="w-4 h-4" />
                <span>ออกใบส่งต่อฉุกเฉิน 1669</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง Pop-up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
