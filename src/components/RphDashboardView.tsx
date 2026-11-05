import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BatteryFull,
  BatteryLow,
  BatteryWarning,
  Bell,
  BellRing,
  Cake,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Gift,
  Heart,
  MapPin,
  Navigation,
  Search,
  Send,
  ShieldAlert,
  Truck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Watch,
  X,
} from 'lucide-react';
import {
  COMMUNITY_BASELINE_STATS,
  MUEANG_KORAT_SUBDISTRICTS,
  VILLAGE_HIGH_RISK_MAP_NODES,
} from '../data/koratHealthData';
import { ElderProfile, MatrixGroup, RiskLevel } from '../types/health';
import {
  buildDeterministicHealthPlan,
  calculateBmi,
  evaluateHealthRisk,
} from '../utils/riskEngine';
import {
  ElderSmartWatchBatteryRecord,
  evaluateElderSmartWatchBattery,
} from '../utils/smartWatchBatteryUtils';
import {
  ProactiveBatteryReplacementLog,
  SmartWatchBatteryNotificationCenter,
} from './SmartWatchBatteryNotificationCenter';
import { VillageRiskDistributionChart } from './VillageRiskDistributionChart';
import { KoratGroupDGeospatialHeatmap } from './KoratGroupDGeospatialHeatmap';
import { VisualTrendAnalysisSection } from './VisualTrendAnalysisSection';
import { SubdistrictRiskDensityHeatmap } from './SubdistrictRiskDensityHeatmap';

export interface RiskEscalationAlertItem {
  id: string;
  elderId: string;
  elderName: string;
  age: number;
  village: string;
  subdistrict: string;
  assignedVhv: string;
  previousColor: 'Green' | 'Yellow';
  previousGroup: 'A' | 'B';
  newColor: 'Red';
  newGroup: 'D';
  previousFrailtyScore: number;
  newFrailtyScore: number;
  previousBp: string;
  newBp: string;
  triggerReason: string;
  createdAt: string;
  acknowledged: boolean;
  browserAlertSent: boolean;
}

const INITIAL_RISK_ESCALATION_ALERTS: RiskEscalationAlertItem[] = [
  {
    id: 'ESC-ALERT-01',
    elderId: 'KORAT-ELD-001',
    elderName: 'นางสมพร ดอนกระโทก',
    age: 78,
    village: 'หมู่ที่ 4 บ้านดอนขวาง',
    subdistrict: 'ต.หัวทะเล',
    assignedVhv: 'อสม.วันเพ็ญ ศรีโคราช',
    previousColor: 'Yellow',
    previousGroup: 'B',
    newColor: 'Red',
    newGroup: 'D',
    previousFrailtyScore: 52,
    newFrailtyScore: 69,
    previousBp: '146/88 mmHg',
    newBp: '166/98 mmHg',
    triggerReason:
      'ความดันโลหิตพุ่งสูง 166/98 mmHg ร่วมกับน้ำหนักลดลงต่อเนื่องและคะแนน Frailty ขยับจาก 52 เป็น 69/100 (เปลี่ยนจาก 🟡 Yellow กลุ่ม B → 🔴 Red กลุ่ม D)',
    createdAt: 'วันนี้ · 08:45 น.',
    acknowledged: false,
    browserAlertSent: true,
  },
  {
    id: 'ESC-ALERT-02',
    elderId: 'KORAT-ELD-002',
    elderName: 'นายทองคำ พิมายกลาง',
    age: 82,
    village: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม',
    subdistrict: 'ต.โพธิ์กลาง',
    assignedVhv: 'อสม.ประเสริฐ วงศ์นคร',
    previousColor: 'Green',
    previousGroup: 'A',
    newColor: 'Red',
    newGroup: 'D',
    previousFrailtyScore: 28,
    newFrailtyScore: 73,
    previousBp: '136/84 mmHg',
    newBp: '162/102 mmHg',
    triggerReason:
      'อาศัยอยู่ลำพัง ขาดยาลดความดันโลหิต ความดันพุ่ง 162/102 mmHg และมีภาวะอ่อนแรง (เปลี่ยนจาก 🟢 Green กลุ่ม A → 🔴 Red กลุ่ม D)',
    createdAt: 'วันนี้ · 09:20 น.',
    acknowledged: false,
    browserAlertSent: true,
  },
];

function getElderColorCategory(elder: ElderProfile): 'Green' | 'Yellow' | 'Orange' | 'Red' {
  if (
    elder.riskProfile.matrixGroup === 'D' ||
    (elder.riskProfile.frailtyRisk === 'High' && elder.riskProfile.chronicRisk === 'High')
  ) {
    return 'Red';
  }
  if (elder.riskProfile.matrixGroup === 'C') {
    return 'Orange';
  }
  if (elder.riskProfile.matrixGroup === 'B' || elder.riskProfile.frailtyRisk === 'Moderate') {
    return 'Yellow';
  }
  return 'Green';
}

interface RphDashboardViewProps {
  elders: ElderProfile[];
  onSelectElder: (elder: ElderProfile) => void;
  onOpenScreening: (elder?: ElderProfile) => void;
  onVerifyElder: (elderId: string) => void;
  onCreateReferral: (elder: ElderProfile) => void;
  onOpenMonthlyReport?: () => void;
  onEscalateElderRisk?: (updatedElder: ElderProfile) => void;
  onTriggerSmartWatchSos?: (elder?: ElderProfile) => void;
}

export const RphDashboardView: React.FC<RphDashboardViewProps> = ({
  elders,
  onSelectElder,
  onOpenScreening,
  onVerifyElder,
  onCreateReferral,
  onOpenMonthlyReport,
  onEscalateElderRisk,
  onTriggerSmartWatchSos,
}) => {
  const [selectedMatrixGroup, setSelectedMatrixGroup] = useState<MatrixGroup | 'ALL'>('ALL');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel | 'ALL'>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<
    'ALL' | 'urgent' | 'within_7d' | 'routine' | 'promotion'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [subdistrictFilter, setSubdistrictFilter] = useState<string>('ALL');
  const [selectedMapVillageId, setSelectedMapVillageId] = useState<string>('VIL-KORAT-01');
  const [mapDensityFilter, setMapDensityFilter] = useState<
    'ALL' | 'SURGE_7D' | 'CRITICAL' | 'ACTIVE_CASES'
  >('ALL');

  // Notification Center & Browser Alert state for Green/Yellow -> Red transitions
  const [escalationAlerts, setEscalationAlerts] = useState<RiskEscalationAlertItem[]>(
    INITIAL_RISK_ESCALATION_ALERTS
  );
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(true);
  const [notificationFilter, setNotificationFilter] = useState<
    'ALL' | 'UNREAD' | 'FROM_YELLOW' | 'FROM_GREEN'
  >('ALL');
  const [activeBrowserAlert, setActiveBrowserAlert] = useState<RiskEscalationAlertItem | null>(
    null
  );
  const [browserSoundEnabled, setBrowserSoundEnabled] = useState<boolean>(true);
  const [browserNotificationPerm, setBrowserNotificationPerm] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'unsupported';
  });

  const trendAnalysisRef = useRef<HTMLDivElement>(null);
  const subdistrictHeatmapRef = useRef<HTMLDivElement>(null);

  // Track previous elder risk states to automatically detect Green/Yellow -> Red transitions
  const prevElderSnapshotRef = useRef<
    Record<
      string,
      {
        color: 'Green' | 'Yellow' | 'Orange' | 'Red';
        group: MatrixGroup;
        frailtyScore: number;
        sbp: number;
        dbp: number;
      }
    >
  >({});

  // Play a crisp 2-tone browser clinical alert chime via Web Audio API
  const playBrowserAlertChime = () => {
    if (!browserSoundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174.66, now + 0.14);
      gain1.gain.setValueAtTime(0.14, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.39);
    } catch {
      // Ignore audio errors if browser autoplay policy blocks sound
    }
  };

  // Dispatch Browser Alert (Web Notification API + Audio Chime + In-Viewport Browser Alert Banner)
  const triggerBrowserRiskAlert = (alertItem: RiskEscalationAlertItem) => {
    setActiveBrowserAlert(alertItem);
    playBrowserAlertChime();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'granted') {
        try {
          new window.Notification(
            `🚨 แจ้งเตือนเคสเสี่ยงสูงรายใหม่ (${alertItem.previousColor} → Red Risk)`,
            {
              body: `${alertItem.elderName} (${alertItem.village}) เปลี่ยนสถานะจาก ${alertItem.previousColor} (กลุ่ม ${alertItem.previousGroup}) เป็น Red (กลุ่ม D) · BP ${alertItem.newBp} · Frailty ${alertItem.newFrailtyScore}/100`,
            }
          );
        } catch {
          // Fallback handled by activeBrowserAlert banner
        }
      }
    }
  };

  const handleRequestBrowserNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPerm('unsupported');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setBrowserNotificationPerm(result);
    } catch {
      setBrowserNotificationPerm('denied');
    }
  };

  // Watch elders state for real-time transitions from Green (A) or Yellow (B) to Red (D)
  useEffect(() => {
    const previousMap = prevElderSnapshotRef.current;
    const isInitialMount = Object.keys(previousMap).length === 0;

    if (!isInitialMount) {
      elders.forEach((elder) => {
        const prev = previousMap[elder.id];
        const currentColor = getElderColorCategory(elder);

        if (
          prev &&
          (prev.color === 'Green' || prev.color === 'Yellow') &&
          currentColor === 'Red'
        ) {
          const nowTime = new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const newAlert: RiskEscalationAlertItem = {
            id: `ESC-${Date.now()}-${elder.id.slice(-3)}`,
            elderId: elder.id,
            elderName: elder.name,
            age: elder.age,
            village: elder.village,
            subdistrict: elder.subdistrict,
            assignedVhv: elder.assignedVhv,
            previousColor: prev.color,
            previousGroup: prev.color === 'Green' ? 'A' : 'B',
            newColor: 'Red',
            newGroup: 'D',
            previousFrailtyScore: prev.frailtyScore,
            newFrailtyScore: elder.riskProfile.frailtyScore,
            previousBp: `${prev.sbp}/${prev.dbp} mmHg`,
            newBp: `${elder.chronicMetrics.sbp}/${elder.chronicMetrics.dbp} mmHg`,
            triggerReason: `ผลการคัดกรองล่าสุดพบความเสี่ยงพุ่งสูง (Frailty ${prev.frailtyScore} → ${elder.riskProfile.frailtyScore}/100, BP ${elder.chronicMetrics.sbp}/${elder.chronicMetrics.dbp} mmHg) เปลี่ยนสถานะจาก ${
              prev.color === 'Green' ? '🟢 Green (กลุ่ม A)' : '🟡 Yellow (กลุ่ม B)'
            } เข้าสู่ 🔴 Red Risk (กลุ่ม D) ต้องประเมินคลินิกเร่งด่วน`,
            createdAt: `เมื่อสักครู่ · ${nowTime} น.`,
            acknowledged: false,
            browserAlertSent: true,
          };

          setEscalationAlerts((curr) => [newAlert, ...curr]);
          setIsNotificationCenterOpen(true);
          triggerBrowserRiskAlert(newAlert);
        }
      });
    }

    const nextSnapshot: typeof prevElderSnapshotRef.current = {};
    elders.forEach((elder) => {
      nextSnapshot[elder.id] = {
        color: getElderColorCategory(elder),
        group: elder.riskProfile.matrixGroup,
        frailtyScore: elder.riskProfile.frailtyScore,
        sbp: elder.chronicMetrics.sbp,
        dbp: elder.chronicMetrics.dbp,
      };
    });
    prevElderSnapshotRef.current = nextSnapshot;
  }, [elders]);

  // Simulate or execute a live transition of a Green or Yellow elder into Red risk category
  const handleSimulateEscalationToRed = (sourceColor: 'Green' | 'Yellow') => {
    const candidate = elders.find((e) => {
      const cat = getElderColorCategory(e);
      return cat === sourceColor;
    });

    if (candidate && onEscalateElderRisk) {
      const newDomains = {
        physical: 16,
        functional: 14,
        nutrition: 10,
        cognitive: 9,
        social: 6,
        activity: 8,
        chronicDisease: 8,
      };
      const newWeight = Number(Math.max(41, candidate.chronicMetrics.weight - 3.2).toFixed(1));
      const newBmi = calculateBmi(newWeight, candidate.chronicMetrics.height);
      const newSbp = 168;
      const newDbp = 102;
      const updatedMetrics = {
        ...candidate.chronicMetrics,
        weight: newWeight,
        bmi: newBmi,
        sbp: newSbp,
        dbp: newDbp,
        medicationAdherence: 'irregular' as const,
      };
      const { riskProfile, ruleAudit } = evaluateHealthRisk(
        newDomains,
        updatedMetrics,
        candidate.gender,
        candidate.livingArrangement,
        candidate.protocolUsed
      );
      const personalPlan = buildDeterministicHealthPlan(
        candidate.name,
        riskProfile,
        newDomains,
        updatedMetrics
      );
      const todayIso = new Date().toISOString().slice(0, 10);

      const updatedElder: ElderProfile = {
        ...candidate,
        lastScreenedAt: todayIso,
        frailtyDomains: newDomains,
        chronicMetrics: updatedMetrics,
        riskProfile,
        ruleAudit,
        personalPlan,
        verifiedByRph: false,
        history: [
          ...candidate.history.slice(-4),
          {
            date: todayIso,
            sbp: newSbp,
            dbp: newDbp,
            weight: newWeight,
            bmi: newBmi,
            frailtyScore: riskProfile.frailtyScore,
          },
        ],
      };
      onEscalateElderRisk(updatedElder);
      return;
    }

    // Fallback if all elders in that color were already escalated in the session
    const fallbackElder =
      sourceColor === 'Yellow'
        ? elders.find((e) => e.id === 'KORAT-ELD-005') || elders[0]
        : elders.find((e) => e.id === 'KORAT-ELD-007') || elders[0];
    const nowTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const simulatedAlert: RiskEscalationAlertItem = {
      id: `ESC-SIM-${Date.now()}`,
      elderId: fallbackElder.id,
      elderName: fallbackElder.name,
      age: fallbackElder.age,
      village: fallbackElder.village,
      subdistrict: fallbackElder.subdistrict,
      assignedVhv: fallbackElder.assignedVhv,
      previousColor: sourceColor,
      previousGroup: sourceColor === 'Green' ? 'A' : 'B',
      newColor: 'Red',
      newGroup: 'D',
      previousFrailtyScore: sourceColor === 'Green' ? 14 : 41,
      newFrailtyScore: 71,
      previousBp: sourceColor === 'Green' ? '124/78 mmHg' : '134/82 mmHg',
      newBp: '168/102 mmHg',
      triggerReason: `อสม. ส่งผลคัดกรองซ้ำด่วน: ความดันโลหิตสูงวิกฤต 168/102 mmHg ร่วมกับภาวะเปราะบาง 71/100 (เปลี่ยนจาก ${
        sourceColor === 'Green' ? '🟢 Green กลุ่ม A' : '🟡 Yellow กลุ่ม B'
      } → 🔴 Red กลุ่ม D)`,
      createdAt: `เมื่อสักครู่ · ${nowTime} น.`,
      acknowledged: false,
      browserAlertSent: true,
    };
    setEscalationAlerts((curr) => [simulatedAlert, ...curr]);
    setIsNotificationCenterOpen(true);
    triggerBrowserRiskAlert(simulatedAlert);
  };

  const unreadAlertsCount = escalationAlerts.filter((a) => !a.acknowledged).length;
  const filteredNotifications = escalationAlerts.filter((item) => {
    if (notificationFilter === 'UNREAD') return !item.acknowledged;
    if (notificationFilter === 'FROM_YELLOW') return item.previousColor === 'Yellow';
    if (notificationFilter === 'FROM_GREEN') return item.previousColor === 'Green';
    return true;
  });

  // Coordinate bounds for Mueang Nakhon Ratchasima District map canvas
  const MAP_BOUNDS = {
    minLat: 14.91,
    maxLat: 15.05,
    minLng: 101.98,
    maxLng: 102.16,
  };

  // Enrich village coordinate nodes with live Group D elders from session state & 7-day growth calculation
  const villageOutreachPoints = VILLAGE_HIGH_RISK_MAP_NODES.map((node) => {
    const matchingElders = elders.filter(
      (e) => e.village === node.village || e.subdistrict === node.subdistrict
    );
    const exactVillageElders = elders.filter((e) => e.village === node.village);
    const liveGroupDInVillage = exactVillageElders.filter(
      (e) => e.riskProfile.matrixGroup === 'D'
    );
    // Dynamic Group D count reflects any newly screened Group D elders in this village
    const dynamicGroupDCount =
      node.baselineGroupDCount + Math.max(0, liveGroupDInVillage.length - 1);
    const densityPct = Number(((dynamicGroupDCount / node.screenedElders) * 100).toFixed(1));

    // Calculate 7-day Group D patient increase vs 7 days ago baseline
    const previous7dCount = node.previous7DayGroupDCount;
    const sevenDayDeltaCount = Math.max(0, dynamicGroupDCount - previous7dCount);
    const sevenDayGrowthPct =
      previous7dCount > 0
        ? Number((((dynamicGroupDCount - previous7dCount) / previous7dCount) * 100).toFixed(1))
        : 0;
    const isHighRiskSurge7d = sevenDayGrowthPct > 10;

    // Project geographic (lat, lng) to 0-100% viewport coordinates
    const xPct = Math.min(
      92,
      Math.max(
        8,
        ((node.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100
      )
    );
    const yPct = Math.min(
      90,
      Math.max(
        10,
        ((MAP_BOUNDS.maxLat - node.lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100
      )
    );

    return {
      ...node,
      groupDCount: dynamicGroupDCount,
      previous7dCount,
      sevenDayDeltaCount,
      sevenDayGrowthPct,
      isHighRiskSurge7d,
      densityPct,
      xPct,
      yPct,
      matchingElders,
      exactVillageElders,
      liveGroupDInVillage,
    };
  });

  // Villages where Group D patients increased by > 10% in the last 7 days
  const surging7dVillages = [...villageOutreachPoints]
    .filter((pt) => pt.isHighRiskSurge7d)
    .sort((a, b) => b.sevenDayGrowthPct - a.sevenDayGrowthPct);

  const visibleMapNodes = villageOutreachPoints.filter((pt) => {
    if (mapDensityFilter === 'SURGE_7D') {
      return pt.isHighRiskSurge7d;
    }
    if (mapDensityFilter === 'CRITICAL') {
      return pt.groupDCount >= 8 || pt.priorityLevel === 'critical';
    }
    if (mapDensityFilter === 'ACTIVE_CASES') {
      return pt.liveGroupDInVillage.length > 0 || pt.exactVillageElders.length > 0;
    }
    return true;
  });

  const selectedVillageNode =
    villageOutreachPoints.find((pt) => pt.id === selectedMapVillageId) ||
    villageOutreachPoints[0];

  const totalOutreachTeamsNeeded = villageOutreachPoints.reduce(
    (acc, pt) => acc + pt.outreachTeamRequired,
    0
  );
  const totalBpKitsNeeded = villageOutreachPoints.reduce(
    (acc, pt) => acc + pt.bpKitsAllocated,
    0
  );

  // Dynamic adjustments on top of the 1,250 baseline when new elders are added in session
  const extraEldersCount = Math.max(0, elders.length - 8);
  const totalPopulation = COMMUNITY_BASELINE_STATS.totalPopulationBase + extraEldersCount;
  const totalScreened = COMMUNITY_BASELINE_STATS.screenedBase + extraEldersCount;
  const totalUnscreened = Math.max(0, totalPopulation - totalScreened);

  const groupDCount = elders.filter((e) => e.riskProfile.matrixGroup === 'D').length;
  const groupCCount = elders.filter((e) => e.riskProfile.matrixGroup === 'C').length;
  const groupBCount = elders.filter((e) => e.riskProfile.matrixGroup === 'B').length;
  const groupACount = elders.filter((e) => e.riskProfile.matrixGroup === 'A').length;

  // Quick Report (รายงานด่วน) — Group D High-Risk CSV Summary & Export
  const [isQuickReportOpen, setIsQuickReportOpen] = useState<boolean>(false);
  const [quickReportSubdistrictFilter, setQuickReportSubdistrictFilter] = useState<string>('ALL');
  const [lastQuickReportExportedAt, setLastQuickReportExportedAt] = useState<string | null>(null);
  const [csvCopiedFeedback, setCsvCopiedFeedback] = useState<boolean>(false);

  // Birthday Celebration Notification (แจ้งเตือนวันคล้ายวันเกิดผู้สูงอายุในสัปดาห์ปัจจุบัน สำหรับ อสม. เยี่ยมให้กำลังใจ)
  const [isBirthdayBannerExpanded, setIsBirthdayBannerExpanded] = useState<boolean>(true);
  const [onlyBirthdayWeekFilter, setOnlyBirthdayWeekFilter] = useState<boolean>(false);
  const [birthdayCheckInDoneIds, setBirthdayCheckInDoneIds] = useState<Record<string, boolean>>({
    'KORAT-ELD-005': true,
  });

  // Smart Watch Low Battery (<20%) Notification Center & Proactive Battery Replacement State
  const [isBatteryAlertCenterOpen, setIsBatteryAlertCenterOpen] = useState<boolean>(true);
  const [onlyLowBatteryWatchFilter, setOnlyLowBatteryWatchFilter] = useState<boolean>(false);
  const [batteryOverrides, setBatteryOverrides] = useState<Record<string, number>>({});
  const [batteryReplacementLogs, setBatteryReplacementLogs] = useState<
    Record<string, ProactiveBatteryReplacementLog>
  >({});

  const elderBatteryMap = useMemo<Record<string, ElderSmartWatchBatteryRecord>>(() => {
    const map: Record<string, ElderSmartWatchBatteryRecord> = {};
    elders.forEach((elder, idx) => {
      map[elder.id] = evaluateElderSmartWatchBattery(elder, idx, {
        overrideBatteryPct: batteryOverrides[elder.id],
      });
    });
    return map;
  }, [elders, batteryOverrides]);

  const lowBatteryWatchCount = useMemo(
    () => Object.values(elderBatteryMap).filter((rec) => rec.isLowBattery).length,
    [elderBatteryMap]
  );

  const handleUpdateBatteryOverride = (elderId: string, newBatteryPct: number) => {
    setBatteryOverrides((prev) => ({
      ...prev,
      [elderId]: newBatteryPct,
    }));
  };

  const handleLogProactiveBatteryAction = (log: ProactiveBatteryReplacementLog) => {
    setBatteryReplacementLogs((prev) => ({
      ...prev,
      [log.elderId]: log,
    }));
  };

  const handleResetBatterySimulation = () => {
    setBatteryOverrides({});
    setBatteryReplacementLogs({});
    setOnlyLowBatteryWatchFilter(false);
  };

  const formatThaiShortDate = (dateObj: Date): string => {
    return dateObj.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const todayDate = new Date();
  const weekEndDate = new Date(todayDate);
  weekEndDate.setDate(todayDate.getDate() + 6);
  const currentWeekRangeLabel = `${formatThaiShortDate(todayDate)} – ${formatThaiShortDate(
    weekEndDate
  )}`;

  // Deterministic current-week birthday schedule linked to registered elders
  const BIRTHDAY_WEEK_SCHEDULE: Record<
    string,
    {
      daysFromToday: number;
      socialSupportNote: string;
      suggestedGiftOrCheckIn: string;
    }
  > = {
    'KORAT-ELD-001': {
      daysFromToday: 0,
      socialSupportNote:
        'อาศัยอยู่ลำพัง (Living Alone) และอยู่ในกลุ่มเสี่ยงสูง (Group D) ควรให้ อสม. เข้าเยี่ยมอวยพรวันเกิด พูดคุยลดความเหงา และวัดความดันโลหิตที่บ้าน',
      suggestedGiftOrCheckIn: 'เยี่ยมบ้านมอบการ์ดอวยพร รพ.สต. + ตรวจความดันโลหิต & ประเมินความเครียด',
    },
    'KORAT-ELD-003': {
      daysFromToday: 2,
      socialSupportNote:
        'อาศัยอยู่กับคู่สมรสสูงอายุ ควรแวะเยี่ยมให้กำลังใจทั้งคู่สมรส พร้อมติดตามสมุดบันทึกค่าน้ำตาลและการรับประทานยาเบาหวาน',
      suggestedGiftOrCheckIn: 'เยี่ยมบ้านให้กำลังใจคู่สมรสสูงวัย + แนะนำโภชนาการลดหวานในโอกาสวันเกิด',
    },
    'KORAT-ELD-005': {
      daysFromToday: 4,
      socialSupportNote:
        'สุขภาพแข็งแรงดี (Group A) เหมาะแก่การเชิญชวนร่วมกิจกรรมชมรมผู้สูงอายุประจำเดือนและเป็นต้นแบบผู้สูงวัยสุขภาพดีในชุมชน',
      suggestedGiftOrCheckIn: 'โทรศัพท์/แวะเยี่ยมอวยพรวันเกิด + เชิญร่วมกิจกรรมชมรมผู้สูงอายุ ต.บ้านใหม่',
    },
  };

  const currentWeekBirthdayElders = elders
    .filter((e) => Boolean(BIRTHDAY_WEEK_SCHEDULE[e.id]))
    .map((elder) => {
      const meta = BIRTHDAY_WEEK_SCHEDULE[elder.id];
      const bdayDate = new Date(todayDate);
      bdayDate.setDate(todayDate.getDate() + meta.daysFromToday);
      const birthYearBuddhist = bdayDate.getFullYear() + 543 - elder.age;
      return {
        elder,
        daysFromToday: meta.daysFromToday,
        birthdayDateLabel: formatThaiShortDate(bdayDate),
        birthYearBuddhist,
        socialSupportNote: meta.socialSupportNote,
        suggestedGiftOrCheckIn: meta.suggestedGiftOrCheckIn,
        isCheckInCompleted: Boolean(birthdayCheckInDoneIds[elder.id]),
      };
    })
    .sort((a, b) => a.daysFromToday - b.daysFromToday);

  const completedBirthdayVisitsCount = currentWeekBirthdayElders.filter(
    (item) => item.isCheckInCompleted
  ).length;

  const handleToggleBirthdayCheckIn = (elderId: string) => {
    setBirthdayCheckInDoneIds((prev) => ({
      ...prev,
      [elderId]: !prev[elderId],
    }));
  };

  const groupDElders = elders
    .filter((e) => e.riskProfile.matrixGroup === 'D')
    .sort((a, b) => b.riskProfile.frailtyScore - a.riskProfile.frailtyScore);

  const quickReportGroupDElders =
    quickReportSubdistrictFilter === 'ALL'
      ? groupDElders
      : groupDElders.filter((e) => e.subdistrict === quickReportSubdistrictFilter);

  const escapeCsvCell = (value: string | number | boolean | undefined | null): string => {
    const str = value === undefined || value === null ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const buildGroupDUrgentCsv = (targetList: ElderProfile[]): string => {
    const headers = [
      'ลำดับ',
      'รหัสผู้สูงอายุ',
      'ชื่อ-นามสกุล',
      'อายุ (ปี)',
      'เพศ',
      'หมู่บ้าน',
      'ตำบล',
      'เบอร์โทรศัพท์',
      'ผู้ดูแลหลัก',
      'ลักษณะการอยู่อาศัย',
      'กลุ่มความเสี่ยง (Matrix Group)',
      'คะแนนความเปราะบาง (Frailty Score /100)',
      'ระดับความเสี่ยงเปราะบาง',
      'คะแนนโรคเรื้อรัง (Chronic Score /100)',
      'ความดันโลหิต (SBP/DBP mmHg)',
      'ดัชนีมวลกาย (BMI kg/m2)',
      'โรคประจำตัว',
      'แนวทางจัดการเร่งด่วน (Matrix Action)',
      'อสม. ผู้รับผิดชอบ',
      'กำหนดติดตามครั้งถัดไป',
      'สถานะการติดตาม',
      'ยืนยันผลโดย รพ.สต.',
    ];

    const rows = targetList.map((elder, idx) => [
      idx + 1,
      elder.id,
      elder.name,
      elder.age,
      elder.gender,
      elder.village,
      `ต.${elder.subdistrict}`,
      elder.phone,
      elder.caregiverName,
      elder.livingArrangement,
      `Group ${elder.riskProfile.matrixGroup} (High Risk)`,
      elder.riskProfile.frailtyScore,
      elder.riskProfile.frailtyRisk,
      elder.riskProfile.chronicScore,
      `${elder.chronicMetrics.sbp}/${elder.chronicMetrics.dbp}`,
      elder.chronicMetrics.bmi.toFixed(1),
      elder.chronicConditions.length > 0 ? elder.chronicConditions.join(' | ') : 'ไม่มีโรคประจำตัวระบุ',
      elder.riskProfile.matrixAction,
      elder.assignedVhv,
      elder.nextFollowUpDate,
      elder.followUpStatus === 'overdue'
        ? 'เกินกำหนดติดตาม (Overdue)'
        : elder.followUpStatus === 'due_soon'
        ? 'ใกล้ถึงกำหนด (Due Soon)'
        : elder.followUpStatus === 'completed'
        ? 'ดำเนินการแล้ว'
        : 'ตามนัดหมาย',
      elder.verifiedByRph ? 'ยืนยันแล้ว' : 'รอตรวจทาน',
    ]);

    return [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\r\n');
  };

  const handleDownloadGroupDCsv = (openPreviewPanel = true) => {
    const targetList = quickReportGroupDElders.length > 0 ? quickReportGroupDElders : groupDElders;
    const csvString = buildGroupDUrgentCsv(targetList);
    // Prepend UTF-8 BOM (\uFEFF) so Thai characters render cleanly in Microsoft Excel & Google Sheets
    const blob = new Blob(['\uFEFF' + csvString], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `korat_group_d_urgent_report_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const nowTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastQuickReportExportedAt(`${nowTime} น. (${targetList.length} รายการ)`);
    if (openPreviewPanel) {
      setIsQuickReportOpen(true);
    }
  };

  const handleCopyGroupDCsv = async () => {
    try {
      const targetList = quickReportGroupDElders.length > 0 ? quickReportGroupDElders : groupDElders;
      const csvString = buildGroupDUrgentCsv(targetList);
      await navigator.clipboard.writeText(csvString);
      setCsvCopiedFeedback(true);
      setTimeout(() => setCsvCopiedFeedback(false), 2500);
    } catch {
      // Ignore clipboard permission errors in restricted contexts
    }
  };

  const urgentCount =
    COMMUNITY_BASELINE_STATS.priorityTiersBase.urgent + Math.max(0, groupDCount - 2);
  const within7dCount =
    COMMUNITY_BASELINE_STATS.priorityTiersBase.within7d + Math.max(0, groupCCount - 2);
  const routineCount =
    COMMUNITY_BASELINE_STATS.priorityTiersBase.routine + Math.max(0, groupBCount - 2);
  const promotionCount =
    COMMUNITY_BASELINE_STATS.priorityTiersBase.promotion + Math.max(0, groupACount - 2);

  const highRiskTotal = COMMUNITY_BASELINE_STATS.highRiskBase + Math.max(0, groupDCount - 2);
  const followUpTotal =
    COMMUNITY_BASELINE_STATS.followUpRequiredBase +
    Math.max(0, groupDCount + groupCCount + groupBCount - 6);

  const filteredElders = elders
    .filter((e) => {
      if (selectedMatrixGroup !== 'ALL' && e.riskProfile.matrixGroup !== selectedMatrixGroup) {
        return false;
      }
      if (selectedRiskLevel !== 'ALL') {
        const matchesFrailty = e.riskProfile.frailtyRisk === selectedRiskLevel;
        const matchesChronic = e.riskProfile.chronicRisk === selectedRiskLevel;
        if (!matchesFrailty && !matchesChronic) {
          return false;
        }
      }
      if (selectedPriority !== 'ALL' && e.riskProfile.priorityTier !== selectedPriority) {
        return false;
      }
      if (subdistrictFilter !== 'ALL' && e.subdistrict !== subdistrictFilter) {
        return false;
      }
      if (onlyBirthdayWeekFilter && !BIRTHDAY_WEEK_SCHEDULE[e.id]) {
        return false;
      }
      if (onlyLowBatteryWatchFilter && !elderBatteryMap[e.id]?.isLowBattery) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const frailtyThaiLabel =
          e.riskProfile.frailtyRisk === 'High'
            ? 'ความเสี่ยงสูง frailty สูง'
            : e.riskProfile.frailtyRisk === 'Moderate'
            ? 'ความเสี่ยงปานกลาง pre-frailty กลาง'
            : 'ความเสี่ยงต่ำ low risk ต่ำ ปกติ';
        const chronicThaiLabel =
          e.riskProfile.chronicRisk === 'High'
            ? 'โรคเรื้อรังสูง เสี่ยงสูง'
            : e.riskProfile.chronicRisk === 'Moderate'
            ? 'โรคเรื้อรังปานกลาง เสี่ยงปานกลาง'
            : 'โรคเรื้อรังต่ำ เสี่ยงต่ำ';
        const matrixSearchText = `กลุ่ม ${e.riskProfile.matrixGroup.toLowerCase()} group ${e.riskProfile.matrixGroup.toLowerCase()} ${e.riskProfile.matrixAction.toLowerCase()}`;
        const riskLevelSearchText = [
          e.riskProfile.frailtyRisk.toLowerCase(),
          e.riskProfile.chronicRisk.toLowerCase(),
          e.riskProfile.cvdRisk.toLowerCase(),
          e.riskProfile.diabetesRisk.toLowerCase(),
          e.riskProfile.nutritionRisk.toLowerCase(),
          frailtyThaiLabel,
          chronicThaiLabel,
          matrixSearchText,
        ].join(' ');

        const matchesSingleLetterGroup =
          ['a', 'b', 'c', 'd'].includes(q) &&
          e.riskProfile.matrixGroup.toLowerCase() === q;

        return (
          matchesSingleLetterGroup ||
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.village.toLowerCase().includes(q) ||
          e.subdistrict.toLowerCase().includes(q) ||
          e.assignedVhv.toLowerCase().includes(q) ||
          riskLevelSearchText.includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.riskProfile.frailtyScore - a.riskProfile.frailtyScore);

  return (
    <div className="space-y-8">
      {/* Live Browser Alert Overlay Banner when an elder moves from Green/Yellow to Red */}
      {activeBrowserAlert && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl bg-gradient-to-r from-rose-950 via-red-950 to-slate-900 border-2 border-rose-500 p-4 sm:p-5 shadow-2xl"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-md">
                <BellRing className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono-num font-extrabold uppercase tracking-wide">
                    BROWSER ALERT · RED RISK ESCALATION
                  </span>
                  <span className="text-xs font-mono-num font-bold text-rose-200">
                    {activeBrowserAlert.previousColor === 'Green'
                      ? '🟢 Green (กลุ่ม A)'
                      : '🟡 Yellow (กลุ่ม B)'}{' '}
                    → 🔴 Red (กลุ่ม D · High Risk)
                  </span>
                  <span className="text-xs text-slate-300 font-mono-num">
                    ({activeBrowserAlert.createdAt})
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  แจ้งเตือนด่วน: {activeBrowserAlert.elderName} (อายุ {activeBrowserAlert.age} ปี ·{' '}
                  {activeBrowserAlert.village} {activeBrowserAlert.subdistrict}) เปลี่ยนสถานะเป็นความเสี่ยงสีแดง (Red Risk)
                </h3>
                <p className="text-xs text-rose-100/95 leading-relaxed">
                  {activeBrowserAlert.triggerReason}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono-num text-amber-200">
                  <span>
                    ความดันโลหิต: <strong>{activeBrowserAlert.previousBp}</strong> →{' '}
                    <strong className="text-rose-300">{activeBrowserAlert.newBp}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    คะแนน Frailty:{' '}
                    <strong>{activeBrowserAlert.previousFrailtyScore}/100</strong> →{' '}
                    <strong className="text-rose-300">
                      {activeBrowserAlert.newFrailtyScore}/100
                    </strong>
                  </span>
                  <span>·</span>
                  <span className="font-sans text-slate-200">
                    ผู้คัดกรอง: {activeBrowserAlert.assignedVhv}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const found = elders.find((e) => e.id === activeBrowserAlert.elderId);
                  if (found) onSelectElder(found);
                  setEscalationAlerts((prev) =>
                    prev.map((a) =>
                      a.id === activeBrowserAlert.id ? { ...a, acknowledged: true } : a
                    )
                  );
                }}
                className="px-3.5 py-2 rounded-lg bg-white text-slate-950 text-xs font-extrabold hover:bg-rose-100 transition-colors cursor-pointer"
              >
                เปิดดูโปรไฟล์ / แผนดูแลทันที
              </button>
              <button
                type="button"
                onClick={() => {
                  const found = elders.find((e) => e.id === activeBrowserAlert.elderId);
                  if (found) onCreateReferral(found);
                  setEscalationAlerts((prev) =>
                    prev.map((a) =>
                      a.id === activeBrowserAlert.id ? { ...a, acknowledged: true } : a
                    )
                  );
                  setActiveBrowserAlert(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 border border-rose-300/60 text-white text-xs font-bold hover:bg-rose-500 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งต่อแพทย์ด่วน</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEscalationAlerts((prev) =>
                    prev.map((a) =>
                      a.id === activeBrowserAlert.id ? { ...a, acknowledged: true } : a
                    )
                  );
                  setActiveBrowserAlert(null);
                }}
                className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/90 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer"
              >
                รับทราบแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Area Overview Banner & Macro Metrics */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800/95 to-slate-900 border border-teal-500/45 rounded-2xl p-5 sm:p-7 shadow-xl">
        {/* Framed Hero Header Composition */}
        <div className="rounded-xl bg-slate-950/70 border border-teal-500/30 p-5 sm:p-6 shadow-inner">
          <div className="space-y-2.5">
            {/* Institutional Kicker — Single Flowing Typographic Line (No Orphan Separator) */}
            <p className="text-xs sm:text-sm text-teal-300 font-semibold tracking-wide leading-relaxed">
              <span>ศูนย์สนับสนุนการตัดสินใจระดับปฐมภูมิ (Decision Support System)</span>
              <span aria-hidden="true" className="mx-2 text-teal-400 font-bold">
                ·
              </span>
              <span className="text-teal-200">
                เครือข่าย รพ.สต. อำเภอเมือง จังหวัดนครราชสีมา
              </span>
            </p>

            {/* Primary Title */}
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
              <span className="text-teal-300">Smart Elderly Health Watch</span>
              <span className="text-slate-400 font-bold mx-1.5">:</span>
              <span>ระบบอัจฉริยะเฝ้าระวังสุขภาพผู้สูงอายุ</span>
            </h2>

            {/* Core Mission Subtitle */}
            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed max-w-5xl">
              ยกระดับการดูแลผู้สูงวัยด้วยเทคโนโลยี IoT และ AI วิเคราะห์ความเสี่ยงสุขภาพแบบ Real-time การเฝ้าระวังและจัดลำดับความเสี่ยงสุขภาพผู้สูงอายุระดับชุมชน
            </p>

            {/* Proactive Care Paradigm Strip */}
            <div className="pt-1">
              <p className="inline-block rounded-lg bg-slate-900/90 border border-slate-700/90 px-3.5 py-2 text-xs text-slate-300 leading-relaxed">
                เปลี่ยนกระบวนการจาก{' '}
                <span className="text-rose-300 font-semibold">
                  &ldquo;ตรวจพบเมื่อป่วย → ส่งต่อเพื่อรักษา&rdquo;
                </span>{' '}
                เป็น{' '}
                <span className="text-teal-300 font-semibold">
                  &ldquo;คัดกรอง → วิเคราะห์ความเสี่ยง → เฝ้าระวัง → แนะนำ → ติดตาม → ส่งต่อเมื่อจำเป็น&rdquo;
                </span>
              </p>
            </div>
          </div>

          {/* Dedicated Operational Command Bar */}
          <div className="mt-5 pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                aria-pressed={isNotificationCenterOpen}
                onClick={() => setIsNotificationCenterOpen((prev) => !prev)}
                className={`relative flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                  isNotificationCenterOpen
                    ? 'border-rose-300 bg-rose-600 text-white ring-2 ring-rose-300/80 shadow-md'
                    : unreadAlertsCount > 0
                    ? 'border-rose-500/80 bg-rose-950/80 text-rose-200 hover:bg-rose-900'
                    : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Bell
                  className={`w-4 h-4 ${
                    isNotificationCenterOpen ? 'text-amber-200' : 'text-rose-400'
                  }`}
                />
                <span>ศูนย์แจ้งเตือนความเสี่ยง</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono-num font-extrabold ${
                    isNotificationCenterOpen
                      ? 'bg-slate-950 text-amber-300'
                      : unreadAlertsCount > 0
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {unreadAlertsCount} ใหม่
                </span>
                {isNotificationCenterOpen && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-teal-300 text-[10px] font-mono-num font-black">
                    ● Active
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-pressed={isBatteryAlertCenterOpen}
                onClick={() => setIsBatteryAlertCenterOpen((prev) => !prev)}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                  isBatteryAlertCenterOpen
                    ? 'border-amber-200 bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-md font-extrabold'
                    : lowBatteryWatchCount > 0
                    ? 'border-amber-400/80 bg-amber-950/70 text-amber-200 hover:bg-amber-900/80'
                    : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700'
                }`}
                title="เปิด/ปิดศูนย์แจ้งเตือนแบตเตอรี่ Smart Watch ต่ำกว่า 20% เพื่อสั่งการเปลี่ยนแบตเตอรี่เชิงรุก"
              >
                <BatteryWarning
                  className={`w-4 h-4 ${
                    isBatteryAlertCenterOpen
                      ? 'text-slate-950'
                      : lowBatteryWatchCount > 0
                      ? 'text-rose-400 animate-pulse'
                      : 'text-emerald-400'
                  }`}
                />
                <span>แจ้งเตือนแบต Smart Watch &lt;20%</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono-num font-extrabold ${
                    isBatteryAlertCenterOpen
                      ? 'bg-slate-950 text-amber-300'
                      : lowBatteryWatchCount > 0
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {lowBatteryWatchCount} เครื่อง
                </span>
                {isBatteryAlertCenterOpen && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-teal-300 text-[10px] font-mono-num font-black">
                    ● Active
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-pressed={isBirthdayBannerExpanded}
                onClick={() => setIsBirthdayBannerExpanded((prev) => !prev)}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                  isBirthdayBannerExpanded
                    ? 'border-pink-200 bg-pink-500 text-slate-950 ring-2 ring-pink-200 shadow-md font-extrabold'
                    : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700'
                }`}
                title="แจ้งเตือนวันคล้ายวันเกิดผู้สูงอายุประจำสัปดาห์นี้ เพื่อให้ อสม. เข้าเยี่ยมให้กำลังใจและดูแลทางสังคม"
              >
                <Cake
                  className={`w-4 h-4 ${
                    isBirthdayBannerExpanded ? 'text-slate-950' : 'text-pink-300'
                  }`}
                />
                <span>วันเกิดสัปดาห์นี้</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono-num font-extrabold ${
                    isBirthdayBannerExpanded
                      ? 'bg-slate-950 text-pink-300'
                      : 'bg-pink-500 text-slate-950'
                  }`}
                >
                  {currentWeekBirthdayElders.length} ราย
                </span>
                {isBirthdayBannerExpanded && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-teal-300 text-[10px] font-mono-num font-black">
                    ● Active
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-pressed={isQuickReportOpen}
                onClick={() => {
                  if (isQuickReportOpen) {
                    setIsQuickReportOpen(false);
                  } else {
                    handleDownloadGroupDCsv(true);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                  isQuickReportOpen
                    ? 'border-amber-200 bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-md'
                    : 'border-amber-400/70 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 hover:text-white'
                }`}
                title="ดึงข้อมูลผู้สูงอายุที่มีความเสี่ยงสูง (Group D) ออกมาเป็นตารางสรุปแบบ CSV เพื่อนำไปจัดการต่อทันที"
              >
                <FileSpreadsheet
                  className={`w-4 h-4 ${
                    isQuickReportOpen ? 'text-slate-950' : 'text-amber-300'
                  }`}
                />
                <span>รายงานด่วน</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono-num font-extrabold ${
                    isQuickReportOpen
                      ? 'bg-slate-950 text-amber-300'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  CSV · Group D ({groupDCount})
                </span>
                {isQuickReportOpen && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-teal-300 text-[10px] font-mono-num font-black">
                    ● Active
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenMonthlyReport && (
                <button
                  type="button"
                  onClick={onOpenMonthlyReport}
                  className="flex items-center gap-2 rounded-lg border border-teal-400/60 bg-slate-900 px-4 py-2.5 text-xs font-bold text-teal-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-teal-400" />
                  <span>รายงานสรุปประจำเดือน (PDF-Ready)</span>
                </button>
              )}

              <button
                onClick={() => onOpenScreening()}
                className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shadow-md cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>ลงทะเบียนและคัดกรองผู้สูงอายุใหม่</span>
              </button>
            </div>
          </div>
        </div>

        {/* RPH Notification Center: Green / Yellow -> Red Risk Category Escalation Monitor */}
        {isNotificationCenterOpen && (
          <div className="mt-5 rounded-xl bg-slate-950/95 border border-rose-500/50 p-4 sm:p-5 space-y-4 shadow-lg">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    ศูนย์แจ้งเตือนความเสี่ยงเปลี่ยนระดับ (Risk Escalation Notification Center: Green / Yellow → Red)
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono-num font-bold">
                    รอดำเนินการ {unreadAlertsCount} เคส
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  ตรวจจับอัตโนมัติและส่ง Browser Alert ทันทีเมื่อผลคัดกรองของผู้สูงอายุเปลี่ยนจากกลุ่มความเสี่ยงต่ำ/ปานกลาง (🟢 Green กลุ่ม A หรือ 🟡 Yellow กลุ่ม B) เข้าสู่กลุ่มความเสี่ยงสูงสีแดง (🔴 Red กลุ่ม D)
                </p>
              </div>

              {/* Browser Alert Controls & Live Simulation Triggers */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrowserSoundEnabled((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:border-teal-400 flex items-center gap-1.5 cursor-pointer"
                >
                  {browserSoundEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>เสียงแจ้งเตือน: เปิด</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                      <span>เสียงแจ้งเตือน: ปิด</span>
                    </>
                  )}
                </button>

                {browserNotificationPerm !== 'granted' ? (
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotificationPermission}
                    className="px-2.5 py-1.5 rounded-lg border border-teal-500/60 bg-slate-900 text-xs font-semibold text-teal-300 hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>อนุญาต Browser Notification</span>
                  </button>
                ) : (
                  <span className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/50 text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Browser Notification: เปิดใช้งาน</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleSimulateEscalationToRed('Yellow')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/70 text-amber-200 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  ทดสอบ: 🟡 Yellow → 🔴 Red
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateEscalationToRed('Green')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/70 text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  ทดสอบ: 🟢 Green → 🔴 Red
                </button>

                {onTriggerSmartWatchSos && (
                  <button
                    type="button"
                    onClick={() => onTriggerSmartWatchSos(elders[0])}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Watch className="w-3.5 h-3.5 text-amber-300" />
                    <span>จำลอง SOS Smart Watch (1669)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Filter Bar & Mark All Read */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL' as const, label: `ทั้งหมด (${escalationAlerts.length})` },
                  {
                    id: 'UNREAD' as const,
                    label: `รอเจ้าหน้าที่ตอบสนอง (${unreadAlertsCount})`,
                  },
                  {
                    id: 'FROM_YELLOW' as const,
                    label: `🟡 Yellow → 🔴 Red (${
                      escalationAlerts.filter((a) => a.previousColor === 'Yellow').length
                    })`,
                  },
                  {
                    id: 'FROM_GREEN' as const,
                    label: `🟢 Green → 🔴 Red (${
                      escalationAlerts.filter((a) => a.previousColor === 'Green').length
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setNotificationFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      notificationFilter === tab.id
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {unreadAlertsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEscalationAlerts((prev) =>
                      prev.map((a) => ({ ...a, acknowledged: true }))
                    );
                    setActiveBrowserAlert(null);
                  }}
                  className="text-xs font-semibold text-teal-300 hover:text-white underline cursor-pointer"
                >
                  ทำเครื่องหมายรับทราบทั้งหมด ({unreadAlertsCount})
                </button>
              )}
            </div>

            {/* Notification List */}
            {filteredNotifications.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-xs text-slate-300">
                ไม่มีรายการแจ้งเตือนในหมวดหมู่นี้
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {filteredNotifications.map((item) => {
                  const matchedElder = elders.find((e) => e.id === item.elderId);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                        !item.acknowledged
                          ? 'bg-rose-950/35 border-rose-500/70'
                          : 'bg-slate-900/90 border-slate-800 opacity-85'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-mono-num font-bold">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                item.previousColor === 'Green'
                                  ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300'
                                  : 'bg-amber-500/20 border border-amber-400/60 text-amber-300'
                              }`}
                            >
                              {item.previousColor === 'Green'
                                ? '🟢 Green (กลุ่ม A)'
                                : '🟡 Yellow (กลุ่ม B)'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold">
                              🔴 Red (กลุ่ม D · High Risk)
                            </span>
                          </div>
                          <span className="text-[11px] font-mono-num text-slate-300">
                            {item.createdAt}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {item.elderName}{' '}
                            <span className="text-xs font-normal text-slate-300">
                              (อายุ {item.age} ปี · {item.village} {item.subdistrict})
                            </span>
                          </h4>
                          {!item.acknowledged ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/60 text-rose-300 text-[10px] font-bold whitespace-nowrap">
                              รอตอบสนองด่วน
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-semibold whitespace-nowrap">
                              ✓ รับทราบแล้ว
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed">
                          {item.triggerReason}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-mono-num text-slate-300">
                          BP: <strong className="text-rose-300">{item.newBp}</strong> · Frailty:{' '}
                          <strong>{item.previousFrailtyScore}</strong> →{' '}
                          <strong className="text-rose-300">{item.newFrailtyScore}/100</strong>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {matchedElder && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectElder(matchedElder);
                                setEscalationAlerts((prev) =>
                                  prev.map((a) =>
                                    a.id === item.id ? { ...a, acknowledged: true } : a
                                  )
                                );
                              }}
                              className="px-2.5 py-1 rounded-md bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 transition-colors cursor-pointer"
                            >
                              ตอบสนอง / ดูโปรไฟล์
                            </button>
                          )}
                          {matchedElder && (
                            <button
                              type="button"
                              onClick={() => {
                                onCreateReferral(matchedElder);
                                setEscalationAlerts((prev) =>
                                  prev.map((a) =>
                                    a.id === item.id ? { ...a, acknowledged: true } : a
                                  )
                                );
                              }}
                              className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>ส่งต่อด่วน</span>
                            </button>
                          )}
                          {!item.acknowledged && (
                            <button
                              type="button"
                              onClick={() =>
                                setEscalationAlerts((prev) =>
                                  prev.map((a) =>
                                    a.id === item.id ? { ...a, acknowledged: true } : a
                                  )
                                )
                              }
                              className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
                            >
                              รับทราบ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Smart Watch Low Battery (<20%) Notification Center for Proactive Battery Replacement */}
        {isBatteryAlertCenterOpen && (
          <SmartWatchBatteryNotificationCenter
            elders={elders}
            batteryOverrides={batteryOverrides}
            replacementLogs={batteryReplacementLogs}
            onUpdateBatteryOverride={handleUpdateBatteryOverride}
            onLogProactiveAction={handleLogProactiveBatteryAction}
            onResetBatterySimulation={handleResetBatterySimulation}
            onSelectElder={onSelectElder}
            onOpenSmartWatchMonitor={onTriggerSmartWatchSos}
            onFilterRegistryByLowBattery={(onlyLow) => setOnlyLowBatteryWatchFilter(onlyLow)}
            isRegistryFilteredByLowBattery={onlyLowBatteryWatchFilter}
          />
        )}

        {/* Quick Report Panel (รายงานด่วน — ตารางสรุปผู้สูงอายุความเสี่ยงสูง Group D แบบ CSV) */}
        {isQuickReportOpen && (
          <div className="mt-5 rounded-xl bg-slate-950/95 border border-amber-400/60 p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 text-xs font-mono-num font-extrabold">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    รายงานด่วน · GROUP D HIGH-RISK CSV SUMMARY
                  </span>
                  <span className="text-xs font-mono-num font-bold text-rose-300">
                    ผู้สูงอายุความเสี่ยงสูง (กลุ่ม D): {quickReportGroupDElders.length} ราย
                  </span>
                  {lastQuickReportExportedAt && (
                    <span className="text-xs font-mono-num text-emerald-300">
                      ✓ ดาวน์โหลดไฟล์ CSV ล่าสุดเมื่อ {lastQuickReportExportedAt}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  ตารางสรุปข้อมูลผู้สูงอายุกลุ่มเสี่ยงสูงวิกฤต (Group D — เปราะบางสูงและเสี่ยงโรคเรื้อรังสูง) รองรับการเปิดใน Microsoft Excel / Google Sheets (UTF-8 BOM) เพื่อให้เจ้าหน้าที่ รพ.สต. นำไปจัดคิวเยี่ยมบ้านและส่งต่อแพทย์ได้ทันที
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={quickReportSubdistrictFilter}
                  onChange={(e) => setQuickReportSubdistrictFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="ALL">ทุกตำบล (Group D ทั้งหมด {groupDElders.length} ราย)</option>
                  {Array.from(new Set(groupDElders.map((e) => e.subdistrict))).map((sub) => (
                    <option key={sub} value={sub}>
                      ต.{sub} ({groupDElders.filter((e) => e.subdistrict === sub).length} ราย)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleDownloadGroupDCsv(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดไฟล์ .CSV ({quickReportGroupDElders.length} ราย)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyGroupDCsv}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {csvCopiedFeedback ? '✓ คัดลอกข้อมูล CSV แล้ว' : 'คัดลอกข้อความ CSV'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickReportOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Summary Preview Table of Group D CSV Rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300 font-bold">
                    <th className="py-2.5 px-3">ลำดับ / รหัส</th>
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3 text-right">อายุ</th>
                    <th className="py-2.5 px-3">พื้นที่ (หมู่บ้าน / ตำบล)</th>
                    <th className="py-2.5 px-3 text-right">Frailty / Chronic</th>
                    <th className="py-2.5 px-3 text-right">BP (mmHg) / BMI</th>
                    <th className="py-2.5 px-3">โรคประจำตัว / แนวทางจัดการเร่งด่วน</th>
                    <th className="py-2.5 px-3">อสม. / กำหนดติดตาม</th>
                    <th className="py-2.5 px-3 text-right">ดำเนินการด่วน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {quickReportGroupDElders.map((elder, idx) => (
                    <tr key={elder.id} className="hover:bg-slate-900/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono-num text-slate-300 whitespace-nowrap">
                        <span className="font-bold text-amber-300">#{idx + 1}</span> · {elder.id}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                        {elder.name}
                        <div className="text-[11px] font-normal text-slate-400 font-mono-num">
                          โทร: {elder.phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-200 whitespace-nowrap">
                        {elder.age} ปี ({elder.gender})
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                        {elder.village}
                        <div className="text-[11px] text-teal-300">ต.{elder.subdistrict}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num whitespace-nowrap">
                        <span className="font-bold text-rose-300">
                          {elder.riskProfile.frailtyScore}/100
                        </span>
                        <div className="text-[11px] text-amber-300">
                          Chronic: {elder.riskProfile.chronicScore}/100
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num whitespace-nowrap">
                        <span className="font-bold text-white">
                          {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          BMI {elder.chronicMetrics.bmi.toFixed(1)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-xs">
                        <div className="font-semibold text-rose-200 truncate">
                          {elder.riskProfile.matrixAction}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {elder.chronicConditions.join(', ') || 'ไม่มีโรคประจำตัวระบุ'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                        <div>{elder.assignedVhv}</div>
                        <div className="text-[11px] font-mono-num text-amber-300">
                          นัด: {elder.nextFollowUpDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectElder(elder)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold cursor-pointer"
                          >
                            เปิดโปรไฟล์
                          </button>
                          <button
                            type="button"
                            onClick={() => onCreateReferral(elder)}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                          >
                            ส่งต่อ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Birthday Celebration Notification Banner (แจ้งเตือนวันคล้ายวันเกิดผู้สูงอายุในสัปดาห์นี้ สำหรับ อสม. เยี่ยมให้กำลังใจ) */}
        {isBirthdayBannerExpanded && currentWeekBirthdayElders.length > 0 && (
          <div
            role="region"
            aria-label="Birthday Celebration Notification"
            className="mt-5 rounded-xl bg-slate-900/95 border border-pink-400/50 p-4 sm:p-5 shadow-lg space-y-4"
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-300 shrink-0">
                  <Cake className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-pink-500 text-slate-950 text-[11px] font-mono-num font-extrabold uppercase tracking-wide">
                      BIRTHDAY CELEBRATION · SOCIAL SUPPORT ALERT
                    </span>
                    <span className="text-xs font-mono-num font-bold text-pink-200">
                      สัปดาห์นี้ ({currentWeekRangeLabel}) · มีผู้สูงอายุคล้ายวันเกิด{' '}
                      {currentWeekBirthdayElders.length} ราย
                    </span>
                    <span className="text-xs font-mono-num text-emerald-300">
                      (อสม. เช็กอินเยี่ยมอวยพรแล้ว {completedBirthdayVisitsCount}/
                      {currentWeekBirthdayElders.length} ราย)
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    แจ้งเตือนวันคล้ายวันเกิดผู้สูงอายุประจำสัปดาห์ — สนับสนุนให้ อสม. แวะเยี่ยมอวยพร เสริมพลังใจ และตรวจเช็กสุขภาพเบื้องต้น
                  </h3>
                  <p className="text-xs text-slate-300">
                    การเยี่ยมเยียนในสัปดาห์วันเกิดช่วยลดภาวะซึมเศร้าและความโดดเดี่ยวในผู้สูงอายุ (โดยเฉพาะผู้ที่อาศัยอยู่ลำพัง) พร้อมเปิดโอกาสให้ อสม. ติดตามวัดความดันและทบทวนการใช้ยาอย่างเป็นกันเอง
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setOnlyBirthdayWeekFilter((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    onlyBirthdayWeekFilter
                      ? 'bg-pink-500 border-pink-300 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-pink-200 hover:bg-slate-700'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>
                    {onlyBirthdayWeekFilter
                      ? 'กำลังกรองเฉพาะเจ้าของวันเกิดในตาราง ✓'
                      : 'กรองดูในตารางทะเบียน'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBirthdayBannerExpanded(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  ซ่อนแถบแจ้งเตือน
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              {currentWeekBirthdayElders.map((item) => {
                const { elder } = item;
                const isToday = item.daysFromToday === 0;
                const isLivingAlone = elder.livingArrangement === 'อยู่ลำพัง';

                return (
                  <div
                    key={elder.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isToday
                        ? 'bg-pink-950/35 border-pink-400/80 shadow-md'
                        : 'bg-slate-950/90 border-slate-800 hover:border-pink-400/50'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-extrabold ${
                              isToday
                                ? 'bg-pink-500 text-slate-950'
                                : 'bg-pink-500/20 border border-pink-400/50 text-pink-200'
                            }`}
                          >
                            <Cake className="w-3 h-3" />
                            {isToday
                              ? 'วันเกิดวันนี้! (Today)'
                              : `อีก ${item.daysFromToday} วัน (${item.birthdayDateLabel})`}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[11px] font-mono-num font-bold">
                            ครบ {elder.age} ปี (พ.ศ. {item.birthYearBuddhist})
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold ${
                            elder.riskProfile.matrixGroup === 'D'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                              : elder.riskProfile.matrixGroup === 'C'
                              ? 'bg-orange-950 text-orange-300 border border-orange-500/50'
                              : elder.riskProfile.matrixGroup === 'B'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                          }`}
                        >
                          กลุ่ม {elder.riskProfile.matrixGroup}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-white">{elder.name}</h4>
                          {isLivingAlone && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/60 text-rose-200 text-[10px] font-bold">
                              อยู่ลำพัง · ควรเยี่ยมพิเศษ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {elder.village} · <span className="text-teal-300">{elder.subdistrict}</span> ·{' '}
                          <span className="font-mono-num">โทร {elder.phone}</span>
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-200">
                          <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          <span>แนวทางดูแลจิตสังคม & กิจกรรมเยี่ยมบ้าน:</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {item.socialSupportNote}
                        </p>
                        <p className="text-[11px] text-teal-300 font-medium pt-0.5">
                          ผู้รับผิดชอบ: <strong>{elder.assignedVhv}</strong> ({item.suggestedGiftOrCheckIn})
                        </p>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleBirthdayCheckIn(elder.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          item.isCheckInCompleted
                            ? 'bg-emerald-500/20 border border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/30'
                            : 'bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-sm'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {item.isCheckInCompleted
                            ? 'อสม. เยี่ยมอวยพรและเช็กอินแล้ว ✓'
                            : 'บันทึก อสม. เข้าเยี่ยมอวยพร'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectElder(elder)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer"
                      >
                        ดูโปรไฟล์
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dedicated RPH Staff Quick Search Bar (Name, Village, or Current Risk Level) */}
        <div className="mt-5 p-4 rounded-xl bg-slate-900/95 border border-teal-500/40 shadow-inner">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="ค้นหาผู้สูงอายุด้วยชื่อ หมู่บ้าน หรือระดับความเสี่ยง"
                placeholder="ค้นหาผู้สูงอายุด้วย ชื่อ-สกุล, หมู่บ้าน/ตำบล หรือระดับความเสี่ยงปัจจุบัน (เช่น High, Moderate, Low, กลุ่ม D, บ้านดอนขวาง)..."
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm border border-slate-600 rounded-lg bg-slate-950 text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={selectedRiskLevel}
                onChange={(e) => setSelectedRiskLevel(e.target.value as RiskLevel | 'ALL')}
                aria-label="กรองตามระดับความเสี่ยงปัจจุบัน"
                className="py-2.5 px-3 text-xs font-semibold border border-slate-600 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="ALL">ทุกระดับความเสี่ยง (All Risk Levels)</option>
                <option value="High">ความเสี่ยงสูง (High Risk)</option>
                <option value="Moderate">ความเสี่ยงปานกลาง (Moderate Risk)</option>
                <option value="Low">ความเสี่ยงต่ำ (Low Risk)</option>
              </select>

              {(searchQuery.trim() !== '' ||
                selectedRiskLevel !== 'ALL' ||
                selectedMatrixGroup !== 'ALL' ||
                subdistrictFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRiskLevel('ALL');
                    setSelectedMatrixGroup('ALL');
                    setSelectedPriority('ALL');
                    setSubdistrictFilter('ALL');
                  }}
                  className="px-3 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
              <span className="font-semibold text-teal-300">คำค้นหาด่วน:</span>
              {[
                { label: 'กลุ่ม D (เสี่ยงสูง)', query: 'กลุ่ม D' },
                { label: 'High Risk', query: 'High' },
                { label: 'Moderate / Pre-Frailty', query: 'Moderate' },
                { label: 'Low Risk', query: 'Low' },
                { label: 'บ้านดอนขวาง', query: 'บ้านดอนขวาง' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setSearchQuery((prev) => (prev === preset.query ? '' : preset.query))
                  }
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    searchQuery.toLowerCase() === preset.query.toLowerCase()
                      ? 'border-teal-400 bg-teal-500 text-slate-950 font-bold'
                      : 'border-slate-700 bg-slate-800/90 text-slate-200 hover:border-teal-400/60 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <span className="font-mono-num text-slate-200 font-semibold">
              พบผู้สูงอายุที่ตรงเงื่อนไข:{' '}
              <strong className="text-teal-300">{filteredElders.length}</strong> จาก{' '}
              {elders.length} ราย
            </span>
          </div>

          {/* Instant Quick-Jump Results when staff types in the search bar */}
          {(searchQuery.trim() !== '' || selectedRiskLevel !== 'ALL') &&
            filteredElders.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  ผลลัพธ์ด่วน (คลิกเพื่อดูแผนสุขภาพ):
                </span>
                {filteredElders.slice(0, 5).map((elder) => (
                  <button
                    key={elder.id}
                    type="button"
                    onClick={() => onSelectElder(elder)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 hover:border-teal-400 text-xs text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-teal-300">{elder.name}</span>
                    <span className="text-slate-300">({elder.village})</span>
                    <span className="font-mono-num text-[11px] text-amber-300">
                      · กลุ่ม {elder.riskProfile.matrixGroup} / {elder.riskProfile.frailtyRisk}
                    </span>
                  </button>
                ))}
              </div>
            )}
        </div>

        {/* 5 Key Macro Indicators from User Spec — High-Clarity Contrast */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-6">
          <div className="bg-slate-900/90 border border-slate-700 border-l-4 border-l-sky-400 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-200">ผู้สูงอายุทั้งหมดในพื้นที่</p>
            <p className="mt-1.5 text-2xl font-extrabold text-white font-mono-num">
              {totalPopulation.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-300">คน</span>
            </p>
            <p className="mt-1 text-xs font-medium text-sky-300">
              ครบทั้ง 25 ตำบล อ.เมืองนครราชสีมา
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 border-l-4 border-l-emerald-400 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-200">ได้รับการคัดกรองแล้ว</p>
            <p className="mt-1.5 text-2xl font-extrabold text-emerald-400 font-mono-num">
              {totalScreened.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-300">คน</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-300 font-mono-num">
              ความครอบคลุม {((totalScreened / totalPopulation) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 border-l-4 border-l-cyan-400 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-200">ยังไม่ได้คัดกรอง</p>
            <p className="mt-1.5 text-2xl font-extrabold text-cyan-300 font-mono-num">
              {totalUnscreened.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-300">คน</span>
            </p>
            <p className="mt-1 text-xs font-medium text-cyan-200">
              มอบหมาย อสม. เชิงรุกในชุมชน
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 border-l-4 border-l-rose-500 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-200">กลุ่มเสี่ยงสูง (Frailty/Chronic)</p>
            <p className="mt-1.5 text-2xl font-extrabold text-rose-400 font-mono-num">
              {highRiskTotal.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-300">คน</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-rose-300">
              ต้องประเมินคลินิก/เฝ้าระวังเข้มข้น
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 border-l-4 border-l-amber-400 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-200">ต้องติดตามเยี่ยมบ้าน</p>
            <p className="mt-1.5 text-2xl font-extrabold text-amber-300 font-mono-num">
              {followUpTotal.toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-300">คน</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-200">
              ตามแผน Personal Plan 4 สัปดาห์
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Royal Cobalt 4-Column Community Health Risk Matrix & Priority Triage Table */}
      <section className="matrix-showcase-shell rounded-2xl overflow-hidden shadow-xl border border-[#1E40AF] bg-[#0D328A] text-white">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column (4 cols): Matrix Header & 6 Clinical Criteria Rows */}
          <div className="lg:col-span-4 bg-[#0A2770] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-blue-400/25">
            {/* Diagonal Header Block */}
            <div className="p-6 pb-10 bg-gradient-to-br from-[#0F3CA6] via-[#0B2D82] to-[#1E1B4B] diagonal-title-banner">
              <p className="text-[11px] font-mono-num tracking-wider text-cyan-300 uppercase">
                Community Health Risk Matrix
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
                RISK MATRIX &amp; TRIAGE
              </h2>
              <p className="mt-1 text-xs text-blue-100/90">
                ตารางเปรียบเทียบเกณฑ์จัดกลุ่มความเสี่ยง 4 ระดับ (A, B, C, D) และชุดสิทธิการดูแลผู้สูงอายุ รพ.สต.
              </p>
            </div>

            {/* 6 Criteria Label Rows matching the 4 tier columns */}
            <div className="divide-y divide-dashed divide-blue-300/25 text-xs px-5 flex-1 flex flex-col justify-around">
              <div className="py-3.5 flex items-center">
                <span className="font-semibold text-blue-50">
                  ระดับภาวะเปราะบาง (Frailty) และความเสี่ยงโรคเรื้อรัง (Chronic Risk)
                </span>
              </div>
              <div className="py-3.5 flex items-center">
                <span className="text-blue-100">
                  1. ประเมินสุขภาพตนเองและร่วมกิจกรรมชมรมผู้สูงอายุในชุมชน
                </span>
              </div>
              <div className="py-3.5 flex items-center">
                <span className="text-blue-100">
                  2. สร้างแผนดูแลสุขภาพรายบุคคล 4 สัปดาห์ (AI &amp; Rule Personal Plan)
                </span>
              </div>
              <div className="py-3.5 flex items-center">
                <span className="text-blue-100">
                  3. อสม. ติดตามเยี่ยมบ้านเชิงรุกและวัดความดันโลหิตซ้ำภายใน 7 วัน
                </span>
              </div>
              <div className="py-3.5 flex items-center">
                <span className="text-blue-100">
                  4. พยาบาลเวชปฏิบัติ รพ.สต. ประเมินคลินิกและตรวจเยี่ยมเคสเสี่ยงสูง
                </span>
              </div>
              <div className="py-3.5 flex items-center">
                <span className="text-blue-100">
                  5. ออกใบส่งต่อดิจิทัลพบแพทย์เวชศาสตร์ครอบครัว / รพ.แม่ข่ายเร่งด่วน
                </span>
              </div>
            </div>

            {/* Bottom Filter Status / Reset Bar */}
            <div className="p-4 bg-[#08205E] border-t border-blue-400/25 flex items-center justify-between text-xs">
              <span className="text-blue-200 font-mono-num">
                {selectedMatrixGroup === 'ALL' && selectedPriority === 'ALL'
                  ? `กำลังแสดงทุกกลุ่ม (${elders.length} ราย)`
                  : `ตัวกรอง: กลุ่ม ${selectedMatrixGroup}`}
              </span>
              {(selectedMatrixGroup !== 'ALL' || selectedPriority !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMatrixGroup('ALL');
                    setSelectedPriority('ALL');
                  }}
                  className="px-3 py-1.5 rounded-md border border-white/60 text-white font-semibold hover:bg-white/10 transition-colors cursor-pointer"
                >
                  รีเซ็ตตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* Right 4 Tier Columns (2 cols each = 8 cols total) */}
          {[
            {
              group: 'A' as MatrixGroup,
              priority: 'promotion' as const,
              title: 'กลุ่ม A (Low Risk)',
              subtitle: 'ส่งเสริมสุขภาพ',
              areaCount: promotionCount,
              cohortCount: groupACount,
              criteriaText: 'Frailty ต่ำ · Chronic ต่ำ',
              headerGradient: 'bg-gradient-to-b from-[#16A34A] to-[#84CC16]',
              footerGradient: 'bg-gradient-to-r from-[#16A34A] to-[#84CC16]',
              colBg: 'bg-[#123C9E]',
              checks: [true, true, false, false, false],
              ctaLabel: 'ดูรายชื่อกลุ่ม A',
            },
            {
              group: 'B' as MatrixGroup,
              priority: 'routine' as const,
              title: 'กลุ่ม B (Pre-Frailty)',
              subtitle: 'ติดตามตามรอบ',
              areaCount: routineCount,
              cohortCount: groupBCount,
              criteriaText: 'Frailty กลาง · Chronic ต่ำ',
              headerGradient: 'bg-gradient-to-b from-[#06B6D4] to-[#0D9488]',
              footerGradient: 'bg-gradient-to-r from-[#06B6D4] to-[#0D9488]',
              colBg: 'bg-[#0F348C]',
              checks: [true, true, true, false, false],
              ctaLabel: 'ดูรายชื่อกลุ่ม B',
            },
            {
              group: 'C' as MatrixGroup,
              priority: 'within_7d' as const,
              title: 'กลุ่ม C (Surveillance)',
              subtitle: 'เฝ้าระวังภายใน 7 วัน',
              areaCount: within7dCount,
              cohortCount: groupCCount,
              criteriaText: 'Frailty ต่ำ · Chronic สูง',
              headerGradient: 'bg-gradient-to-b from-[#9333EA] to-[#4338CA]',
              footerGradient: 'bg-gradient-to-r from-[#9333EA] to-[#4338CA]',
              colBg: 'bg-[#123C9E]',
              checks: [true, true, true, true, false],
              ctaLabel: 'ดูรายชื่อกลุ่ม C',
            },
            {
              group: 'D' as MatrixGroup,
              priority: 'urgent' as const,
              title: 'กลุ่ม D (High Risk)',
              subtitle: 'ประเมินคลินิก/ส่งต่อ',
              areaCount: urgentCount,
              cohortCount: groupDCount,
              criteriaText: 'Frailty สูง · Chronic สูง',
              headerGradient: 'bg-gradient-to-b from-[#FACC15] via-[#F59E0B] to-[#EA580C]',
              footerGradient: 'bg-gradient-to-r from-[#F59E0B] to-[#EA580C]',
              colBg: 'bg-[#0F348C]',
              checks: [true, true, true, true, true],
              ctaLabel: 'ดูรายชื่อกลุ่ม D',
            },
          ].map((col) => {
            const isSelected = selectedMatrixGroup === col.group;
            return (
              <div
                key={col.group}
                className={`lg:col-span-2 ${col.colBg} flex flex-col justify-between border-b lg:border-b-0 lg:border-r last:border-r-0 border-blue-400/25 transition-transform ${
                  isSelected ? 'ring-2 ring-inset ring-white' : ''
                }`}
              >
                {/* Pointed Chevron Header */}
                <div
                  className={`${col.headerGradient} chevron-header-bottom px-3 pt-5 pb-9 text-center text-white shadow-md`}
                >
                  <p className="text-xs font-bold tracking-wide">{col.title}</p>
                  <div className="mt-1 flex items-baseline justify-center gap-1 font-mono-num">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {col.areaCount}
                    </span>
                    <span className="text-xs font-semibold opacity-90">ราย</span>
                  </div>
                  <p className="text-[11px] font-medium opacity-95 mt-0.5">
                    {col.subtitle} ({col.cohortCount} เคสเชิงลึก)
                  </p>
                </div>

                {/* 6 Comparison Rows */}
                <div className="divide-y divide-dashed divide-blue-300/25 text-xs px-3 flex-1 flex flex-col justify-around text-center">
                  <div className="py-3.5 font-bold text-white text-sm tracking-tight">
                    {col.criteriaText}
                  </div>
                  {col.checks.map((passed, idx) => (
                    <div
                      key={idx}
                      className="py-3.5 flex items-center justify-center font-mono-num text-base font-bold"
                    >
                      {passed ? (
                        <span className="text-white" aria-label="รองรับ">
                          ✓
                        </span>
                      ) : (
                        <span className="text-blue-300/60" aria-label="ไม่รวม">
                          ✕
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                  {/* Matching Colored Bottom Action Bar */}
                <div className={`${col.footerGradient} p-4 text-center`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMatrixGroup(isSelected ? 'ALL' : col.group);
                      setSelectedPriority('ALL');
                    }}
                    className={`w-full py-2 px-3 rounded-md border-2 border-white text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-slate-900'
                        : 'bg-transparent text-white hover:bg-white/20'
                    }`}
                  >
                    {isSelected ? `✓ กำลังกรองกลุ่ม ${col.group}` : col.ctaLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2.2: Village-Level Risk Distribution Bar Chart (Matrix Groups A, B, C, D) */}
      <VillageRiskDistributionChart
        elders={elders}
        selectedMatrixGroup={selectedMatrixGroup}
        selectedSubdistrict={subdistrictFilter}
        selectedVillageId={selectedVillageNode?.id}
        onSelectVillageFilter={({ village, subdistrict, matrixGroup, villageId }) => {
          if (village !== undefined) {
            setSearchQuery(village);
          }
          if (subdistrict !== undefined) {
            setSubdistrictFilter(subdistrict);
          }
          if (matrixGroup !== undefined) {
            setSelectedMatrixGroup(matrixGroup);
            setSelectedPriority('ALL');
          }
          if (villageId && villageOutreachPoints.some((pt) => pt.id === villageId)) {
            setSelectedMapVillageId(villageId);
          }
        }}
      />

      {/* Section 2.5: D3.js Geospatial Heatmap View — High-Risk (Group D) Density & Community Outreach Resource Allocation */}
      <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold">
              <Compass className="w-4 h-4" />
              <span>D3.js Geospatial Epidemiology &amp; Community Outreach Allocation</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-300">
                พิกัดภูมิศาสตร์ อ.เมืองนครราชสีมา (14.91°N–15.05°N, 101.98°E–102.16°E)
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">
              แผนที่ความร้อนภูมิศาสตร์ (D3.js Geospatial Heatmap) แสดงความหนาแน่นผู้สูงอายุกลุ่มเสี่ยงสูง (Group D) และการวางแผนจัดสรรทรัพยากรเชิงรุก
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              จำลองชั้นความร้อน Kernel Density Estimation (KDE Iso-Contours) ซ้อนทับบนแผนที่โซนตำบลในเขตอำเภอเมืองนครราชสีมา เพื่อวางแผนเส้นทางทีมสหวิชาชีพ รพ.สต. ชุดตรวจเยี่ยมบ้าน และรถรับ-ส่งคลินิกอย่างแม่นยำ
            </p>
          </div>

          {/* Map Filter Controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 border border-slate-700 rounded-lg shrink-0">
            {[
              { id: 'ALL' as const, label: `ทุกจุดพิกัด (${villageOutreachPoints.length} หมู่บ้าน)` },
              {
                id: 'SURGE_7D' as const,
                label: `เพิ่มขึ้น >10% ใน 7 วัน (${surging7dVillages.length} หมู่บ้าน)`,
              },
              { id: 'CRITICAL' as const, label: 'หนาแน่นวิกฤต (Group D ≥ 8 ราย)' },
              { id: 'ACTIVE_CASES' as const, label: 'มีเคสในบัญชีปฏิบัติการ' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMapDensityFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mapDensityFilter === tab.id
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 7-Day Group D Surge (>10%) Village High-Risk Summary Badges Strip */}
        <div className="rounded-xl bg-slate-950/95 border border-rose-500/40 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">
                สรุปหมู่บ้านที่ผู้สูงอายุกลุ่ม D เพิ่มขึ้นมากกว่า 10% ในรอบ 7 วันล่าสุด (7-Day Group D Surge &gt; 10%)
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono-num font-extrabold">
                High Risk · {surging7dVillages.length} หมู่บ้าน
              </span>
            </div>
            <span className="text-[11px] text-slate-300 font-mono-num">
              เกณฑ์แจ้งเตือนระบาดวิทยาชุมชน: อัตราเพิ่มของกลุ่ม D &gt; +10.0% ภายใน 7 วัน · คลิกเพื่อเลือกหมู่บ้าน
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {surging7dVillages.map((vil) => {
              const isSelected = selectedVillageNode.id === vil.id;
              return (
                <button
                  key={vil.id}
                  type="button"
                  onClick={() => {
                    setSelectedMapVillageId(vil.id);
                    setSearchQuery(vil.village);
                  }}
                  className={`text-left p-3 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-rose-950/70 border-rose-400 ring-1 ring-rose-400'
                      : 'bg-slate-900/90 border-slate-800 hover:border-rose-400/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold tracking-wide uppercase">
                      <ArrowUpRight className="w-3 h-3" />
                      High Risk
                    </span>
                    <span className="font-mono-num text-xs font-extrabold text-rose-300">
                      +{vil.sevenDayGrowthPct}% (7d)
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white truncate">
                      {vil.village}
                    </p>
                    <p className="text-[11px] text-slate-300 truncate">
                      {vil.subdistrict} · {vil.rphFacility}
                    </p>
                  </div>
                  <div className="pt-1 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-mono-num">
                    <span className="text-slate-300">
                      7 วันก่อน: <strong className="text-slate-100">{vil.previous7dCount}</strong> →{' '}
                      <strong className="text-rose-300">{vil.groupDCount} ราย</strong>
                    </span>
                    <span className="text-amber-300 font-bold">
                      +{vil.sevenDayDeltaCount} ราย
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Outreach Resource Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300">หมู่บ้านเป้าหมายความหนาแน่นสูงสุด (Hotspot)</p>
              <p className="mt-1 text-sm font-bold text-rose-400">
                หมู่ที่ 4 บ้านดอนขวาง (ต.หัวทะเล)
              </p>
              <p className="text-[11px] text-slate-400 font-mono-num">
                14.9452° N, 102.1264° E · Group D 11 ราย (9.3%)
              </p>
            </div>
            <MapPin className="w-6 h-6 text-rose-400 shrink-0" />
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300">ทีมสหวิชาชีพ รพ.สต. ที่ต้องจัดสรรลงชุมชน</p>
              <p className="mt-1 text-lg font-extrabold text-teal-300 font-mono-num">
                {totalOutreachTeamsNeeded} ทีมปฏิบัติการ/สัปดาห์
              </p>
              <p className="text-[11px] text-slate-400">
                พยาบาลเวชปฏิบัติ + นักกายภาพบำบัด + อสม.
              </p>
            </div>
            <Users className="w-6 h-6 text-teal-400 shrink-0" />
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-300">ชุดกระเป๋าเยี่ยมบ้านความดัน/DTX เชิงรุก</p>
              <p className="mt-1 text-lg font-extrabold text-amber-300 font-mono-num">
                {totalBpKitsNeeded} ชุดอุปกรณ์สนาม
              </p>
              <p className="text-[11px] text-slate-400">
                จัดสรรตามสัดส่วนความหนาแน่นผู้สูงอายุกลุ่ม D
              </p>
            </div>
            <Truck className="w-6 h-6 text-amber-400 shrink-0" />
          </div>
        </div>

        {/* Main Coordinate Map & Selected Village Resource Allocation Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 7 Cols: Interactive D3.js Geospatial Heatmap of Mueang Nakhon Ratchasima */}
          <KoratGroupDGeospatialHeatmap
            villageOutreachPoints={villageOutreachPoints}
            visibleMapNodes={visibleMapNodes}
            selectedVillageNode={selectedVillageNode}
            onSelectVillage={(villageId) => setSelectedMapVillageId(villageId)}
            onFilterByVillageAndSubdistrict={(village, subdistrict) => {
              setSubdistrictFilter(subdistrict);
              setSearchQuery(village);
            }}
          />

          {/* Right 5 Cols: Selected Village Outreach & Resource Allocation Inspector */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="pb-3.5 border-b border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono-num text-teal-300">
                    <span>พิกัด GPS: {selectedVillageNode.lat.toFixed(4)}° N, {selectedVillageNode.lng.toFixed(4)}° E</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedVillageNode.subdistrict}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedVillageNode.village} ({selectedVillageNode.subdistrict})
                    </h3>
                    {selectedVillageNode.isHighRiskSurge7d && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono-num font-extrabold">
                        <ArrowUpRight className="w-3 h-3" />
                        High Risk (+{selectedVillageNode.sevenDayGrowthPct}% ใน 7 วัน)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    หน่วยบริการรับผิดชอบ: {selectedVillageNode.rphFacility} · หัวหน้าทีม อสม.: {selectedVillageNode.vhvLead}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSubdistrictFilter(selectedVillageNode.subdistrict);
                    setSearchQuery(selectedVillageNode.village);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  กรองตารางทะเบียน
                </button>
              </div>

              {/* Density & Resource Allocation Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono-num">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-[11px] font-sans text-slate-300">
                    ผู้สูงอายุกลุ่มเสี่ยงสูง (Group D)
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-rose-400">
                    {selectedVillageNode.groupDCount} ราย{' '}
                    <span className="text-xs font-semibold text-rose-300">
                      ({selectedVillageNode.densityPct}%)
                    </span>
                  </p>
                  <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                    จากผู้สูงอายุที่คัดกรอง {selectedVillageNode.screenedElders} ราย · 7 วันก่อน:{' '}
                    {selectedVillageNode.previous7dCount} ราย (
                    {selectedVillageNode.sevenDayGrowthPct > 0
                      ? `+${selectedVillageNode.sevenDayGrowthPct}%`
                      : 'คงที่'}
                    )
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-[11px] font-sans text-slate-300">
                    การจัดสรรทรัพยากรเชิงรุก (Outreach)
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-teal-300">
                    {selectedVillageNode.outreachTeamRequired} ทีม · {selectedVillageNode.bpKitsAllocated} ชุดตรวจ
                  </p>
                  <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                    ระดับความเร่งด่วน:{' '}
                    {selectedVillageNode.priorityLevel === 'critical'
                      ? 'สูงสุด (ลงพื้นที่ทุกสัปดาห์)'
                      : selectedVillageNode.priorityLevel === 'high'
                      ? 'สูง (ลงพื้นที่ทุก 2 สัปดาห์)'
                      : 'ปกติ (ตามรอบเดือน)'}
                  </p>
                </div>
              </div>

              {/* Outreach Action Note */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-teal-500/30 text-xs space-y-1">
                <p className="font-bold text-teal-300">
                  ข้อเสนอแนะการจัดสรรทรัพยากรเชิงรุก (Resource Allocation Plan):
                </p>
                <p className="text-slate-200 leading-relaxed">
                  {selectedVillageNode.outreachNote}
                </p>
              </div>

              {/* Matching Elders in Selected Village/Subdistrict */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    ผู้สูงอายุในพื้นที่นี้จากฐานข้อมูลปฏิบัติการ ({selectedVillageNode.matchingElders.length} ราย):
                  </span>
                  <span className="text-[11px] text-slate-400">คลิกเพื่อดูกราฟความดัน/แผนสุขภาพ</span>
                </div>

                {selectedVillageNode.matchingElders.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                    แสดงข้อมูลความหนาแน่นระดับชุมชนจากฐานข้อมูล รพ.สต. ({selectedVillageNode.groupDCount} เคสกลุ่ม D)
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {selectedVillageNode.matchingElders.map((elder) => (
                      <div
                        key={elder.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-400/60 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{elder.name}</span>
                            <span
                              className={`font-mono-num font-bold ${
                                elder.riskProfile.matrixGroup === 'D'
                                  ? 'text-rose-400'
                                  : elder.riskProfile.matrixGroup === 'C'
                                  ? 'text-orange-400'
                                  : 'text-teal-300'
                              }`}
                            >
                              กลุ่ม {elder.riskProfile.matrixGroup}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-mono-num">
                            {elder.village} · BP {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp} mmHg · Frailty {elder.riskProfile.frailtyScore}/100
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectElder(elder)}
                          className="px-2.5 py-1.5 rounded-md bg-slate-800 border border-teal-500/50 text-teal-300 hover:bg-teal-500 hover:text-slate-950 font-semibold whitespace-nowrap cursor-pointer"
                        >
                          เปิดดูโปรไฟล์
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Village Switcher Strip */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-[11px] text-slate-400 mb-2">
                เลือกสลับหมู่บ้านเป้าหมายตามความหนาแน่นกลุ่มเสี่ยงสูง (Group D):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {villageOutreachPoints.slice(0, 6).map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setSelectedMapVillageId(pt.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                      selectedVillageNode.id === pt.id
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-slate-900 border border-slate-700 text-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <span>
                      {pt.village.replace('หมู่ที่ ', 'ม.')} ({pt.groupDCount})
                    </span>
                    {pt.isHighRiskSurge7d && (
                      <span
                        className={`px-1 rounded text-[9px] font-mono-num font-extrabold ${
                          selectedVillageNode.id === pt.id
                            ? 'bg-rose-700 text-white'
                            : 'bg-rose-600/90 text-white'
                        }`}
                      >
                        High Risk +{pt.sevenDayGrowthPct}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Actionable Elderly Surveillance & Triage Table */}
      <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              บัญชีรายชื่อผู้สูงอายุและผลการวิเคราะห์ความเสี่ยงรายบุคคล (Health Intelligence Registry)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              แสดงผลเชื่อมโยงจาก อสม. ภาคสนาม พร้อมระบบตรวจสอบความถูกต้องและสั่งการส่งต่อ
            </p>
          </div>

          {/* Search & Subdistrict Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-teal-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ, หมู่บ้าน, หรือระดับความเสี่ยง (High/Low/กลุ่ม D)..."
                className="pl-9 pr-8 py-1.5 text-xs border border-slate-600 rounded-lg bg-slate-950 text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400 w-72 sm:w-80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value as RiskLevel | 'ALL')}
              className="py-1.5 px-2.5 text-xs border border-slate-600 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="ALL">ทุกระดับความเสี่ยง (Risk Level)</option>
              <option value="High">High Risk (ความเสี่ยงสูง)</option>
              <option value="Moderate">Moderate Risk (ปานกลาง)</option>
              <option value="Low">Low Risk (ความเสี่ยงต่ำ)</option>
            </select>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <select
                value={subdistrictFilter}
                onChange={(e) => setSubdistrictFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs border border-slate-600 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="ALL">ทุกตำบล — อ.เมืองนครราชสีมา (25 ตำบล)</option>
                {MUEANG_KORAT_SUBDISTRICTS.map((sub, idx) => (
                  <option key={sub} value={sub}>
                    {String(idx + 1).padStart(2, '0')}. {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Group Filter Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-700 rounded-lg overflow-x-auto">
            {(['ALL', 'D', 'C', 'B', 'A'] as const).map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedMatrixGroup(grp)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  selectedMatrixGroup === grp
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800'
                }`}
              >
                {grp === 'ALL'
                  ? `ทั้งหมด (${elders.length})`
                  : grp === 'D'
                  ? `🔴 กลุ่ม D (${groupDCount})`
                  : grp === 'C'
                  ? `🟠 กลุ่ม C (${groupCCount})`
                  : grp === 'B'
                  ? `🟡 กลุ่ม B (${groupBCount})`
                  : `🟢 กลุ่ม A (${groupACount})`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleDownloadGroupDCsv(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-400/70 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>รายงานด่วน: โหลด CSV กลุ่ม D ({groupDCount} ราย)</span>
            </button>
            <div className="text-xs text-slate-300 font-mono-num">
              แสดง {filteredElders.length} จาก {elders.length} รายการในฐานข้อมูลปฏิบัติการ
            </div>
          </div>
        </div>

        {/* High-Density Clinical Table */}
        {filteredElders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-white">
              ไม่พบข้อมูลผู้สูงอายุตามเงื่อนไขที่เลือก
            </p>
            <p className="mt-1 text-xs text-slate-300">
              ลองเปลี่ยนตัวกรองกลุ่มความเสี่ยง หรือเพิ่มข้อมูลผู้สูงอายุรายใหม่
            </p>
            <button
              onClick={() => {
                setSelectedMatrixGroup('ALL');
                setSelectedRiskLevel('ALL');
                setSelectedPriority('ALL');
                setSubdistrictFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-3 px-4 py-2 text-xs font-bold text-slate-950 bg-teal-500 rounded-lg hover:bg-teal-400 cursor-pointer"
            >
              แสดงรายชื่อทั้งหมด
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-xs font-bold text-slate-200 bg-slate-800/60">
                  <th className="py-3 px-3">ชื่อ-สกุล / พื้นที่</th>
                  <th className="py-3 px-3 text-right">อายุ / BMI</th>
                  <th className="py-3 px-3 text-right">ความดัน (mmHg)</th>
                  <th className="py-3 px-3 text-right">คะแนน Frailty</th>
                  <th className="py-3 px-3">ความเสี่ยงโรคเรื้อรัง (Risk Profile)</th>
                  <th className="py-3 px-3">Risk Matrix / การดำเนินการ</th>
                  <th className="py-3 px-3">สถานะ อสม. / รพ.สต.</th>
                  <th className="py-3 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredElders.map((elder) => {
                  const { riskProfile, chronicMetrics } = elder;
                  const matrixColor =
                    riskProfile.matrixGroup === 'D'
                      ? 'text-rose-400 font-bold'
                      : riskProfile.matrixGroup === 'C'
                      ? 'text-orange-400 font-bold'
                      : riskProfile.matrixGroup === 'B'
                      ? 'text-amber-300 font-bold'
                      : 'text-emerald-400 font-bold';

                  return (
                    <tr
                      key={elder.id}
                      className="hover:bg-slate-800/70 transition-colors"
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => onSelectElder(elder)}
                            className="font-bold text-white hover:text-teal-300 text-left cursor-pointer"
                          >
                            {elder.name}
                          </button>
                          {BIRTHDAY_WEEK_SCHEDULE[elder.id] && (
                            <span
                              title={`วันคล้ายวันเกิดในสัปดาห์นี้ (${
                                BIRTHDAY_WEEK_SCHEDULE[elder.id].daysFromToday === 0
                                  ? 'วันนี้!'
                                  : `อีก ${BIRTHDAY_WEEK_SCHEDULE[elder.id].daysFromToday} วัน`
                              }) — แนะนำให้ ${elder.assignedVhv} แวะเยี่ยมให้กำลังใจ`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-400/60 text-pink-200 text-[10px] font-bold"
                            >
                              <Cake className="w-2.5 h-2.5 text-pink-300" />
                              {BIRTHDAY_WEEK_SCHEDULE[elder.id].daysFromToday === 0
                                ? 'วันเกิดวันนี้!'
                                : `วันเกิดสัปดาห์นี้ (อีก ${BIRTHDAY_WEEK_SCHEDULE[elder.id].daysFromToday} วัน)`}
                            </span>
                          )}
                          {elderBatteryMap[elder.id] && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsBatteryAlertCenterOpen(true);
                                if (onTriggerSmartWatchSos) {
                                  onTriggerSmartWatchSos(elder);
                                }
                              }}
                              title={
                                elderBatteryMap[elder.id].isLowBattery
                                  ? `คำเตือน: แบตเตอรี่ Smart Watch เหลือ ${elderBatteryMap[elder.id].batteryPct}% (<20%) ต้องเปลี่ยนแบตเตอรี่เชิงรุก คลิกเพื่อดูรายละเอียด`
                                  : `แบตเตอรี่ Smart Watch ปกติ (${elderBatteryMap[elder.id].batteryPct}%)`
                              }
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold cursor-pointer transition-colors ${
                                elderBatteryMap[elder.id].isLowBattery
                                  ? 'bg-rose-600/90 border border-amber-300 text-white hover:bg-rose-500'
                                  : 'bg-slate-800 border border-slate-700 text-emerald-300 hover:border-teal-400'
                              }`}
                            >
                              {elderBatteryMap[elder.id].isLowBattery ? (
                                <>
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-200" />
                                  <BatteryLow className="w-3 h-3 text-white" />
                                  <span>แบตต่ำ {elderBatteryMap[elder.id].batteryPct}% (&lt;20%)</span>
                                </>
                              ) : (
                                <>
                                  <BatteryFull className="w-3 h-3 text-emerald-400" />
                                  <span>Watch {elderBatteryMap[elder.id].batteryPct}%</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-300">
                          <span>{elder.village}</span>
                          {(() => {
                            const matchedNode = villageOutreachPoints.find(
                              (pt) => pt.village === elder.village
                            );
                            if (!matchedNode || !matchedNode.isHighRiskSurge7d) return null;
                            return (
                              <span
                                title={`จำนวนผู้สูงอายุกลุ่ม D ใน${elder.village} เพิ่มขึ้น +${matchedNode.sevenDayGrowthPct}% ในรอบ 7 วัน (${matchedNode.previous7dCount} → ${matchedNode.groupDCount} ราย)`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-mono-num font-bold"
                              >
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                High Risk +{matchedNode.sevenDayGrowthPct}% (7d)
                              </span>
                            );
                          })()}
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span className="text-teal-300 font-medium">{elder.subdistrict}</span>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span>{elder.livingArrangement}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono-num whitespace-nowrap">
                        <span className="font-bold text-white">{elder.age} ปี</span>
                        <span className="block text-slate-300">BMI {chronicMetrics.bmi}</span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono-num whitespace-nowrap">
                        <span
                          className={
                            chronicMetrics.sbp >= 160 || chronicMetrics.dbp >= 100
                              ? 'font-extrabold text-rose-400'
                              : chronicMetrics.sbp >= 140 || chronicMetrics.dbp >= 90
                              ? 'font-bold text-amber-300'
                              : 'font-semibold text-emerald-300'
                          }
                        >
                          {chronicMetrics.sbp}/{chronicMetrics.dbp}
                        </span>
                        <span className="block text-slate-300">รอบเอว {chronicMetrics.waist} ซม.</span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono-num whitespace-nowrap">
                        <span
                          className={
                            riskProfile.frailtyRisk === 'High'
                              ? 'font-extrabold text-rose-400'
                              : riskProfile.frailtyRisk === 'Moderate'
                              ? 'font-bold text-amber-300'
                              : 'font-bold text-emerald-400'
                          }
                        >
                          {riskProfile.frailtyScore}/100
                        </span>
                        <span className="block text-slate-300">
                          {riskProfile.frailtyRisk === 'High'
                            ? 'Frailty (สูง)'
                            : riskProfile.frailtyRisk === 'Moderate'
                            ? 'Pre-Frailty (กลาง)'
                            : 'Low Risk (ต่ำ)'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 text-slate-100 font-medium">
                          <span>CVD: {riskProfile.cvdRisk}</span>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span>DM: {riskProfile.diabetesRisk}</span>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span>Nutrition: {riskProfile.nutritionRisk}</span>
                        </div>
                        <div className="mt-0.5 text-slate-300">
                          {elder.chronicConditions.length > 0
                            ? elder.chronicConditions.join(', ')
                            : 'ไม่มีโรคประจำตัวที่แจ้ง'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className={matrixColor}>
                          กลุ่ม {riskProfile.matrixGroup} — {riskProfile.matrixAction}
                        </div>
                        <div className="mt-0.5 text-slate-300 font-mono-num">
                          กำหนดติดตาม: {elder.nextFollowUpDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="text-slate-100 font-medium">{elder.assignedVhv}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {elder.verifiedByRph ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              รพ.สต. ตรวจสอบแล้ว
                            </span>
                          ) : (
                            <button
                              onClick={() => onVerifyElder(elder.id)}
                              className="text-amber-300 hover:text-amber-200 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              คลิกยืนยันข้อมูล อสม.
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {onTriggerSmartWatchSos && (
                            <button
                              type="button"
                              onClick={() => onTriggerSmartWatchSos(elder)}
                              title={`จำลองสัญญาณ SOS นาฬิกา Smart Watch ตรวจจับแรงกระแทกของ ${elder.name} (1669)`}
                              className="px-2.5 py-1.5 rounded-md bg-rose-950/90 border border-rose-500/70 text-rose-200 hover:bg-rose-600 hover:text-white font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Watch className="w-3 h-3 text-amber-300" />
                              <span>SOS 1669</span>
                            </button>
                          )}
                          <button
                            onClick={() => onSelectElder(elder)}
                            className="px-2.5 py-1.5 rounded-md border border-teal-500/60 bg-slate-800 text-teal-300 hover:bg-teal-500 hover:text-slate-950 font-semibold transition-colors cursor-pointer"
                          >
                            แผนสุขภาพ / AI
                          </button>
                          <button
                            onClick={() => onOpenScreening(elder)}
                            className="px-2.5 py-1.5 rounded-md border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 font-medium transition-colors cursor-pointer"
                          >
                            คัดกรองซ้ำ
                          </button>
                          {(riskProfile.matrixGroup === 'D' || riskProfile.matrixGroup === 'C') && (
                            <button
                              onClick={() => onCreateReferral(elder)}
                              className="px-2.5 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-500 font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>ส่งต่อ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 4: Sub-district Screening Progress in Mueang Nakhon Ratchasima (All 25 Sub-districts) */}
      <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg">
        <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">
              ความก้าวหน้าการคัดกรองและเฝ้าระวังรายตำบล — อำเภอเมืองนครราชสีมา (ครบทั้ง 25 ตำบล)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              ข้อมูลบูรณาการระหว่าง อสม. ประจำหมู่บ้าน และ รพ.สต. / ศบส. ทั้ง 25 ตำบล ในเขตอำเภอเมืองนครราชสีมา (คลิกที่แถวเพื่อกรองรายชื่อ)
            </p>
          </div>
          <span className="text-xs text-teal-300 font-mono-num font-semibold">
            ครอบคลุม 25 ตำบล · อัปเดตล่าสุด: ตุลาคม 2569
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60 text-slate-200 font-bold">
                <th className="py-2.5 px-3">ลำดับ / รหัสตำบล</th>
                <th className="py-2.5 px-3">ตำบล (อ.เมืองนครราชสีมา)</th>
                <th className="py-2.5 px-3">หน่วยบริการปฐมภูมิ (รพ.สต. / ศบส.)</th>
                <th className="py-2.5 px-3 text-right">ประชากรผู้สูงอายุ</th>
                <th className="py-2.5 px-3 text-right">คัดกรองแล้ว</th>
                <th className="py-2.5 px-3 text-right">ร้อยละความครอบคลุม</th>
                <th className="py-2.5 px-3 text-right">กลุ่มเสี่ยงสูง (กลุ่ม D)</th>
                <th className="py-2.5 px-3 text-right">ต้องติดตามต่อเนื่อง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono-num">
              {COMMUNITY_BASELINE_STATS.subdistrictCoverage.map((sub, idx) => {
                const pct = ((sub.screened / sub.total) * 100).toFixed(1);
                const isFilteredSub = subdistrictFilter === sub.name;
                return (
                  <tr
                    key={sub.name}
                    onClick={() =>
                      setSubdistrictFilter(isFilteredSub ? 'ALL' : sub.name)
                    }
                    className={`transition-colors cursor-pointer ${
                      isFilteredSub
                        ? 'bg-teal-950/90 ring-1 ring-inset ring-teal-400'
                        : 'hover:bg-slate-800/70'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-300">
                      {String(idx + 1).padStart(2, '0')} · {sub.code}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white">
                      {sub.name}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">
                      {sub.rphName}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-100 font-medium">
                      {sub.total.toLocaleString()} คน
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      {sub.screened.toLocaleString()} คน
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                          <div
                            className="h-full bg-teal-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-white font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-bold">
                      {sub.highRisk} คน
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                      {sub.followUp} คน
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-800 font-mono-num font-bold text-white">
                <td colSpan={3} className="py-3 px-3 font-sans text-teal-300">
                  รวมทั้งสิ้น 25 ตำบล (อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา)
                </td>
                <td className="py-3 px-3 text-right text-white">
                  {COMMUNITY_BASELINE_STATS.totalPopulationBase.toLocaleString()} คน
                </td>
                <td className="py-3 px-3 text-right text-emerald-400">
                  {COMMUNITY_BASELINE_STATS.screenedBase.toLocaleString()} คน
                </td>
                <td className="py-3 px-3 text-right text-teal-300">
                  {(
                    (COMMUNITY_BASELINE_STATS.screenedBase /
                      COMMUNITY_BASELINE_STATS.totalPopulationBase) *
                    100
                  ).toFixed(1)}
                  %
                </td>
                <td className="py-3 px-3 text-right text-rose-400">
                  {COMMUNITY_BASELINE_STATS.highRiskBase.toLocaleString()} คน
                </td>
                <td className="py-3 px-3 text-right text-amber-300">
                  {COMMUNITY_BASELINE_STATS.followUpRequiredBase.toLocaleString()} คน
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};
