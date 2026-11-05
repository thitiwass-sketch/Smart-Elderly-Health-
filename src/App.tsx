/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  FileText,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Type,
  UserCheck,
  UserPlus,
  Watch,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import {
  COMMUNITY_BASELINE_STATS,
  INITIAL_ELDERS,
  INITIAL_FOLLOW_UPS,
  INITIAL_REFERRALS,
  INITIAL_SUS_EVALUATIONS,
} from './data/koratHealthData';
import { UI_LABELS } from './constants/uiLabels';
import {
  ElderProfile,
  FollowUpRecord,
  MedicationAdherenceLogEvent,
  OfflineQueueItem,
  PersonalHealthPlan,
  ReferralRecord,
  SusEvaluationEntry,
  VoiceMemoAttachment,
} from './types/health';
import {
  buildDeterministicHealthPlan,
  calculateBmi,
  evaluateHealthRisk,
} from './utils/riskEngine';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RphDashboardView } from './components/RphDashboardView';
import { VhvMobilePwaView } from './components/VhvMobilePwaView';
import { ElderlySelfPortalView } from './components/ElderlySelfPortalView';
import { FollowUpAndReferralView } from './components/FollowUpAndReferralView';
import { ResearchAnalyticsView } from './components/ResearchAnalyticsView';
import { MonthlyHealthReport } from './components/MonthlyHealthReport';
import { ElderDetailDrawer } from './components/ElderDetailDrawer';
import { ScreeningEngineModal } from './components/ScreeningEngineModal';
import { SmartWatchSosModal } from './components/SmartWatchSosModal';
import {
  ActiveUserSession,
  PRESET_ROLE_PROFILES,
  RoleLoginAndWorkflowHub,
  TargetedFallPushNotification,
} from './components/RoleLoginAndWorkflowHub';

type MainWorkspaceTab =
  | 'rph_dashboard'
  | 'monthly_report'
  | 'vhv_pwa'
  | 'elderly_portal'
  | 'followup_referral'
  | 'research_sssrfe';

const MAIN_MENU_ITEMS: Array<{
  id: MainWorkspaceTab;
  label: string;
  shortLabel: string;
  roleTag: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'rph_dashboard',
    label: 'แดชบอร์ด รพ.สต.',
    shortLabel: 'รพ.สต. Dashboard',
    roleTag: 'เจ้าหน้าที่ รพ.สต.',
    icon: LayoutDashboard,
  },
  {
    id: 'monthly_report',
    label: 'รายงานประจำเดือน',
    shortLabel: 'รายงาน PDF',
    roleTag: 'ผู้บริหาร/รพ.สต.',
    icon: FileText,
  },
  {
    id: 'vhv_pwa',
    label: 'อสม. ภาคสนาม (PWA)',
    shortLabel: 'อสม. (PWA)',
    roleTag: 'อสม. ประจำบ้าน',
    icon: Smartphone,
  },
  {
    id: 'elderly_portal',
    label: 'สำหรับผู้สูงอายุ',
    shortLabel: 'ผู้สูงอายุ/ญาติ',
    roleTag: 'ผู้สูงอายุ/ญาติ',
    icon: HeartHandshake,
  },
  {
    id: 'followup_referral',
    label: 'ติดตามและส่งต่อ',
    shortLabel: 'ติดตาม/ส่งต่อ',
    roleTag: 'อสม. ↔ รพ.สต.',
    icon: Send,
  },
  {
    id: 'research_sssrfe',
    label: 'กรอบวิจัย SSSRFE',
    shortLabel: 'วิจัย SSSRFE',
    roleTag: 'งานวิจัย NRRU',
    icon: FlaskConical,
  },
];

const STORAGE_KEYS = {
  ELDERS: 'korat_ehw_elders_v1',
  FOLLOW_UPS: 'korat_ehw_followups_v1',
  REFERRALS: 'korat_ehw_referrals_v1',
  OFFLINE_QUEUE: 'korat_ehw_offline_queue_v1',
  SUS_ENTRIES: 'korat_ehw_sus_v1',
};

export default function App() {
  const browserOnline = useOnlineStatus();
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const isOfflineMode = !browserOnline || simulatedOffline;

  const [activeTab, setActiveTab] = useState<MainWorkspaceTab>('rph_dashboard');

  const [elders, setElders] = useState<ElderProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ELDERS);
      return saved ? JSON.parse(saved) : INITIAL_ELDERS;
    } catch {
      return INITIAL_ELDERS;
    }
  });

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FOLLOW_UPS);
      return saved ? JSON.parse(saved) : INITIAL_FOLLOW_UPS;
    } catch {
      return INITIAL_FOLLOW_UPS;
    }
  });

  const [referrals, setReferrals] = useState<ReferralRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REFERRALS);
      return saved ? JSON.parse(saved) : INITIAL_REFERRALS;
    } catch {
      return INITIAL_REFERRALS;
    }
  });

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [susEntries, setSusEntries] = useState<SusEvaluationEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUS_ENTRIES);
      return saved ? JSON.parse(saved) : INITIAL_SUS_EVALUATIONS;
    } catch {
      return INITIAL_SUS_EVALUATIONS;
    }
  });

  const [selectedElder, setSelectedElder] = useState<ElderProfile | null>(null);
  const [isScreeningModalOpen, setIsScreeningModalOpen] = useState(false);
  const [elderToRescreen, setElderToRescreen] = useState<ElderProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [largeTextScale, setLargeTextScale] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [sosTargetElder, setSosTargetElder] = useState<ElderProfile | null>(null);
  const [lastSosIncidentTime, setLastSosIncidentTime] = useState<string | null>(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isDevToolsDrawerOpen, setIsDevToolsDrawerOpen] = useState(false);
  const [selectedGlobalSubdistrict, setSelectedGlobalSubdistrict] = useState<string>('ALL');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [dismissedSosAlertIds, setDismissedSosAlertIds] = useState<string[]>([]);
  const [isSosAlertMinimized, setIsSosAlertMinimized] = useState<boolean>(false);
  const [isSubdistrictListExpanded, setIsSubdistrictListExpanded] = useState<boolean>(false);

  // Active User Session (Login & Switch Role: ADMIN / RPH Officer / VHV / Caregiver)
  const [currentSession, setCurrentSession] = useState<ActiveUserSession>(
    () => PRESET_ROLE_PROFILES.admin[0]
  );

  // Targeted Push Notifications (2-Tier Routing: Assigned House VHV first + Simultaneous RPH Escalation)
  const [targetedFallAlerts, setTargetedFallAlerts] = useState<TargetedFallPushNotification[]>([
    {
      id: 'TPUSH-001',
      elderId: 'KORAT-ELD-001',
      elderName: 'นางสมพร ดอนกระโทก',
      elderAge: 78,
      village: 'หมู่ที่ 4 บ้านดอนขวาง',
      subdistrict: 'ต.หัวทะเล',
      assignedVhv: 'อสม.วันเพ็ญ ศรีโคราช',
      rphFacility: 'รพ.สต.หัวทะเล',
      caregiverName: 'น.ส.กัญญา ดอนกระโทก',
      caregiverPhone: '081-977-4102',
      impactForceG: 4.8,
      heartRateBpm: 118,
      spo2Pct: 93,
      createdAt: 'วันนี้ · 09:12 น.',
      vhvDistanceMeters: 220,
      vhvEtaMinutes: 2,
      vhvStatus: 'notified_push',
      rphStatus: 'escalated_immediate',
      caregiverNotified: true,
    },
    {
      id: 'TPUSH-002',
      elderId: 'KORAT-ELD-002',
      elderName: 'นายทองคำ พิมายกลาง',
      elderAge: 82,
      village: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม',
      subdistrict: 'ต.โพธิ์กลาง',
      assignedVhv: 'อสม.ประเสริฐ วงศ์นคร',
      rphFacility: 'รพ.สต.โพธิ์กลาง',
      caregiverName: 'นายสมศักดิ์ พิมายกลาง',
      caregiverPhone: '084-512-6639',
      impactForceG: 4.2,
      heartRateBpm: 112,
      spo2Pct: 94,
      createdAt: 'วันนี้ · 08:35 น.',
      vhvDistanceMeters: 180,
      vhvEtaMinutes: 2,
      vhvStatus: 'vhv_accepted_enroute',
      vhvRespondedAt: '08:36 น.',
      rphStatus: 'rph_monitoring_dispatch',
      caregiverNotified: true,
    },
  ]);

  // Auto-open ElderDetailDrawer when staff scan a QR Code Deep-Link (?elderId=ELD-xxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qrElderId = params.get('elderId');
    if (qrElderId) {
      const matched = elders.find(
        (e) => e.id.toUpperCase() === qrElderId.trim().toUpperCase()
      );
      if (matched) {
        setSelectedElder(matched);
        showToast(
          `📱 สแกน QR Code สำเร็จ: เปิดแฟ้มสุขภาพดิจิทัลของ ${matched.name} (${matched.id}) เรียบร้อยแล้ว`
        );
      }
    }
  }, []);

  const dispatchTargetedFallPush = (target: ElderProfile, openSosPopup = false) => {
    const timeStr = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newAlert: TargetedFallPushNotification = {
      id: `TPUSH-${Date.now().toString().slice(-5)}`,
      elderId: target.id,
      elderName: target.name,
      elderAge: target.age,
      village: target.village,
      subdistrict: target.subdistrict,
      assignedVhv: target.assignedVhv,
      rphFacility: `รพ.สต.${target.subdistrict.replace('ต.', '')}`,
      caregiverName: target.caregiverName,
      caregiverPhone: target.phone,
      impactForceG: Number((4.1 + (target.age % 9) * 0.1).toFixed(1)),
      heartRateBpm: 114 + (target.age % 12),
      spo2Pct: 93,
      createdAt: `เมื่อสักครู่ · ${timeStr} น.`,
      vhvDistanceMeters: 150 + (target.age % 5) * 35,
      vhvEtaMinutes: 2,
      vhvStatus: 'notified_push',
      rphStatus: 'escalated_immediate',
      caregiverNotified: true,
    };

    setTargetedFallAlerts((prev) => [newAlert, ...prev]);

    if (openSosPopup) {
      setSosTargetElder(target);
      setLastSosIncidentTime(timeStr);
      setIsSosModalOpen(true);
    }

    showToast(
      `🚨 Targeted Push: แจ้งเหตุล้มของ ${target.name} ไปยัง ${target.assignedVhv} (ผู้รับผิดชอบบ้าน) ก่อน พร้อมส่งเรื่องหา รพ.สต.${target.subdistrict.replace('ต.', '')} ทันที!`
    );
  };

  const handleTriggerSmartWatchSos = (elder?: ElderProfile) => {
    const highRiskElders = elders.filter((e) => e.riskProfile.matrixGroup === 'D');
    const pool = highRiskElders.length > 0 ? highRiskElders : elders;
    const nextElder =
      elder ||
      (sosTargetElder
        ? pool[(pool.findIndex((e) => e.id === sosTargetElder.id) + 1) % pool.length]
        : pool[0]) ||
      elders[0] ||
      null;

    if (nextElder) {
      dispatchTargetedFallPush(nextElder, true);
    } else {
      setIsSosModalOpen(true);
    }
  };

  const handleUpdateTargetedAlertStatus = (
    alertId: string,
    updates: Partial<TargetedFallPushNotification>
  ) => {
    setTargetedFallAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, ...updates } : a))
    );
  };

  const handleChangeUserSession = (
    nextSession: ActiveUserSession,
    syncWorkspaceTab = false
  ) => {
    setCurrentSession(nextSession);
    if (syncWorkspaceTab) {
      const targetTab: MainWorkspaceTab =
        nextSession.role === 'vhv'
          ? 'vhv_pwa'
          : nextSession.role === 'elderly'
          ? 'elderly_portal'
          : 'rph_dashboard';
      setActiveTab(targetTab);
      const matchedMenu = MAIN_MENU_ITEMS.find((m) => m.id === targetTab);
      showToast(
        `สลับสิทธิ์เป็น "${nextSession.displayName}" (${nextSession.roleBadgeLabel}) · เมนู Active: ${matchedMenu?.label || targetTab}`
      );
    } else {
      showToast(
        `สลับสิทธิ์ผู้ใช้งานเป็น "${nextSession.displayName}" (${nextSession.roleBadgeLabel}) สำเร็จ`
      );
    }
  };

  const handleSaveQuickOfflineVisit = (payload: {
    elder: ElderProfile;
    sbp: number;
    dbp: number;
    weight: number;
    visitNote: string;
    vhvName: string;
  }) => {
    const { elder, sbp, dbp, weight, visitNote, vhvName } = payload;
    setSimulatedOffline(true);

    const todayStr = new Date().toISOString().slice(0, 10);
    const bmi = calculateBmi(weight, elder.chronicMetrics.height);
    const updatedMetrics = {
      ...elder.chronicMetrics,
      sbp,
      dbp,
      weight,
      bmi,
    };
    const { riskProfile, ruleAudit } = evaluateHealthRisk(
      elder.frailtyDomains,
      updatedMetrics,
      elder.gender,
      elder.livingArrangement,
      elder.protocolUsed
    );
    const personalPlan = buildDeterministicHealthPlan(
      elder.name,
      riskProfile,
      elder.frailtyDomains,
      updatedMetrics
    );

    setElders((prev) =>
      prev.map((e) =>
        e.id === elder.id
          ? {
              ...e,
              chronicMetrics: updatedMetrics,
              riskProfile,
              ruleAudit,
              personalPlan,
              syncStatus: 'pending_offline',
              history: [
                ...e.history.slice(-4),
                {
                  date: todayStr,
                  sbp,
                  dbp,
                  weight,
                  bmi,
                  frailtyScore: riskProfile.frailtyScore,
                },
              ],
            }
          : e
      )
    );

    const qItem: OfflineQueueItem = {
      id: `OFF-VISIT-${Date.now()}`,
      type: 'FOLLOW_UP',
      elderName: elder.name,
      summary: `เยี่ยมบ้านจุดอับสัญญาณ: BP ${sbp}/${dbp} mmHg · น้ำหนัก ${weight} กก. · ${visitNote.slice(0, 42)}`,
      createdAt: new Date().toISOString(),
      vhvName,
    };
    setOfflineQueue((prev) => [qItem, ...prev]);
    showToast(
      `📡 บันทึกข้อมูลเยี่ยมบ้านของ ${elder.name} ลงเครื่องแบบ Offline สำเร็จ (${offlineQueue.length + 1} รายการรอ Sync เมื่อมีอินเทอร์เน็ต)`
    );
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ELDERS, JSON.stringify(elders));
    } catch {
      // Ignore storage quota errors
    }
  }, [elders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FOLLOW_UPS, JSON.stringify(followUps));
    } catch {
      // Ignore
    }
  }, [followUps]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REFERRALS, JSON.stringify(referrals));
    } catch {
      // Ignore
    }
  }, [referrals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(offlineQueue));
    } catch {
      // Ignore
    }
  }, [offlineQueue]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SUS_ENTRIES, JSON.stringify(susEntries));
    } catch {
      // Ignore
    }
  }, [susEntries]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleOpenScreening = (elder?: ElderProfile) => {
    setElderToRescreen(elder || null);
    setIsScreeningModalOpen(true);
  };

  const handleSaveElderScreening = (savedProfile: ElderProfile, isNew: boolean) => {
    setElders((prev) => {
      if (isNew) {
        return [savedProfile, ...prev];
      }
      return prev.map((e) => (e.id === savedProfile.id ? savedProfile : e));
    });

    if (selectedElder && selectedElder.id === savedProfile.id) {
      setSelectedElder(savedProfile);
    }

    // Automatically create or update follow-up schedule for Groups B, C, D
    if (savedProfile.riskProfile.matrixGroup !== 'A') {
      const newFu: FollowUpRecord = {
        id: `FU-${Date.now().toString().slice(-5)}`,
        elderId: savedProfile.id,
        elderName: savedProfile.name,
        age: savedProfile.age,
        village: savedProfile.village,
        subdistrict: savedProfile.subdistrict,
        matrixGroup: savedProfile.riskProfile.matrixGroup,
        dueDate: savedProfile.nextFollowUpDate,
        status:
          savedProfile.riskProfile.matrixGroup === 'D'
            ? 'overdue'
            : savedProfile.riskProfile.matrixGroup === 'C'
            ? 'due_soon'
            : 'scheduled',
        vhvName: savedProfile.assignedVhv,
        purpose: `ถึงกำหนดติดตาม ${savedProfile.name}: กลุ่ม ${savedProfile.riskProfile.matrixGroup} (${savedProfile.riskProfile.matrixAction})`,
        notes: `Frailty Score ${savedProfile.riskProfile.frailtyScore}/100 · BP ${savedProfile.chronicMetrics.sbp}/${savedProfile.chronicMetrics.dbp} mmHg`,
        syncStatus: isOfflineMode ? 'pending_offline' : 'synced',
      };
      setFollowUps((prev) => [newFu, ...prev]);
    }

    if (isOfflineMode) {
      const qItem: OfflineQueueItem = {
        id: `OFF-${Date.now()}`,
        type: isNew ? 'NEW_ELDER' : 'SCREENING',
        elderName: savedProfile.name,
        summary: `กลุ่ม ${savedProfile.riskProfile.matrixGroup} · Frailty ${savedProfile.riskProfile.frailtyScore}/100`,
        createdAt: new Date().toISOString(),
        vhvName: savedProfile.assignedVhv,
      };
      setOfflineQueue((prev) => [...prev, qItem]);
      showToast(
        `บันทึกข้อมูล ${savedProfile.name} ลงเครื่องแบบ Offline แล้ว (${offlineQueue.length + 1} รายการรอ Sync)`
      );
    } else {
      showToast(
        `บันทึกผลคัดกรอง ${savedProfile.name} สำเร็จ — จัดอยู่กลุ่ม ${savedProfile.riskProfile.matrixGroup} (${savedProfile.riskProfile.matrixAction})`
      );
    }

    // Automatically open the SOS Pop-Up when a critical incident/risk escalation occurs
    if (
      savedProfile.riskProfile.matrixGroup === 'D' ||
      savedProfile.chronicMetrics.sbp >= 180 ||
      savedProfile.chronicMetrics.dbp >= 110 ||
      savedProfile.frailtyDomains.physical >= 16
    ) {
      handleTriggerSmartWatchSos(savedProfile);
    }
  };

  const handleSyncOfflineQueue = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const itemsToSync: OfflineQueueItem[] =
        offlineQueue.length > 0
          ? offlineQueue
          : elders.slice(0, 3).map((e) => ({
              id: `SYNC-${e.id}`,
              type: 'SCREENING',
              elderName: e.name,
              summary: `กลุ่ม ${e.riskProfile.matrixGroup} · Frailty ${e.riskProfile.frailtyScore}/100`,
              createdAt: new Date().toISOString(),
              vhvName: e.assignedVhv,
            }));

      // Staged visual upload duration so the VHV sees real-time progress bar & item status
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSync }),
      });
      const data = await res.json();
      setElders((prev) =>
        prev.map((e) => ({
          ...e,
          syncStatus: 'synced',
        }))
      );
      setFollowUps((prev) =>
        prev.map((f) => ({
          ...f,
          syncStatus: 'synced',
        }))
      );
      const count = itemsToSync.length;
      setOfflineQueue([]);
      setSimulatedOffline(false);
      const timeFormatted = new Date(data.syncedAt || Date.now()).toLocaleTimeString('th-TH');
      setLastSyncedAt(timeFormatted);
      showToast(`ซิงก์ข้อมูลภาคสนามจำนวน ${count} รายการขึ้นระบบกลาง รพ.สต. เรียบร้อยแล้ว`);
    } catch {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ข้อมูลยังคงปลอดภัยอยู่ในเครื่อง');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyElder = (elderId: string) => {
    setElders((prev) =>
      prev.map((e) => (e.id === elderId ? { ...e, verifiedByRph: true } : e))
    );
    showToast('เจ้าหน้าที่ รพ.สต. ตรวจสอบและยืนยันผลคัดกรองของ อสม. เรียบร้อยแล้ว');
  };

  const handleUpdateElderPlan = (elderId: string, newPlan: PersonalHealthPlan) => {
    setElders((prev) =>
      prev.map((e) => (e.id === elderId ? { ...e, personalPlan: newPlan } : e))
    );
    setSelectedElder((prev) =>
      prev && prev.id === elderId ? { ...prev, personalPlan: newPlan } : prev
    );
    showToast('อัปเดตแผนดูแลสุขภาพรายบุคคล 4 สัปดาห์ด้วย Gemini AI สำเร็จ');
  };

  const handleCreateReferral = (elder: ElderProfile) => {
    const existing = referrals.find(
      (r) => r.elderId === elder.id && r.status !== 'ส่งกลับ อสม. ติดตามต่อเนื่อง'
    );
    if (existing) {
      setActiveTab('followup_referral');
      showToast(`ผู้สูงอายุ ${elder.name} มีรายการส่งต่อในระบบแล้ว (${existing.id})`);
      return;
    }

    const newReferral: ReferralRecord = {
      id: `REF-NRRU-0${referrals.length + 1}`,
      elderId: elder.id,
      elderName: elder.name,
      age: elder.age,
      village: elder.village,
      subdistrict: elder.subdistrict,
      matrixGroup: elder.riskProfile.matrixGroup,
      frailtyScore: elder.riskProfile.frailtyScore,
      bpReading: `${elder.chronicMetrics.sbp}/${elder.chronicMetrics.dbp} mmHg`,
      reason: `กลุ่มความเสี่ยง ${elder.riskProfile.matrixGroup} (${elder.riskProfile.matrixAction}) คะแนนภาวะเปราะบาง ${elder.riskProfile.frailtyScore}/100`,
      triggeredRules: elder.ruleAudit.map((r) => r.code),
      referredByVhv: elder.assignedVhv,
      targetFacility: `รพ.สต.${elder.subdistrict.replace('ต.', '')} / เครือข่าย รพ.มหาราชนครราชสีมา`,
      urgency:
        elder.riskProfile.matrixGroup === 'D' ? 'เร่งด่วนภายใน 24 ชม.' : 'ภายใน 7 วัน',
      status: 'รอ รพ.สต. ตรวจสอบ',
      createdAt: new Date().toISOString().slice(0, 10),
      clinicalNote: 'ส่งต่อจากระบบคัดกรองความเสี่ยงอัตโนมัติ รอพยาบาลเวชปฏิบัติประเมินคลินิก',
    };

    setReferrals((prev) => [newReferral, ...prev]);
    setActiveTab('followup_referral');
    showToast(`สร้างใบส่งต่อดิจิทัล ${newReferral.id} สำหรับ ${elder.name} ไปยัง รพ.สต. แล้ว`);
  };

  const handleCompleteFollowUp = (
    followUpId: string,
    sbp: number,
    dbp: number,
    weight: number,
    adherence: 'ดีมาก' | 'ปานกลาง' | 'ต้องกระตุ้น',
    note: string
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === followUpId
          ? {
              ...f,
              status: 'completed',
              completedDate: todayStr,
              sbpRecorded: sbp,
              dbpRecorded: dbp,
              weightRecorded: weight,
              adherenceLevel: adherence,
              notes: note,
            }
          : f
      )
    );
    showToast('บันทึกผลการติดตามเยี่ยมบ้านของ อสม. เรียบร้อยแล้ว');
  };

  const handleAttachVoiceMemoToFollowUp = (
    followUpId: string,
    voiceMemo: VoiceMemoAttachment
  ) => {
    setFollowUps((prev) =>
      prev.map((f) => {
        if (f.id !== followUpId) return f;
        const cleanedTranscript = voiceMemo.transcriptNote.trim();
        const combinedNotes = cleanedTranscript
          ? `${f.notes ? `${f.notes} · ` : ''}[บันทึกเสียง อสม. ${voiceMemo.durationSec}s]: ${cleanedTranscript}`
          : f.notes;
        return {
          ...f,
          notes: combinedNotes,
          voiceMemo,
          syncStatus: isOfflineMode ? 'pending_offline' : 'synced',
        };
      })
    );

    if (isOfflineMode) {
      const qItem: OfflineQueueItem = {
        id: `OFF-VM-${Date.now()}`,
        type: 'FOLLOW_UP',
        elderName: voiceMemo.elderName,
        summary: `บันทึกเสียงเยี่ยมบ้าน (${voiceMemo.durationSec} วินาที): ${voiceMemo.transcriptNote.slice(0, 48)}`,
        createdAt: new Date().toISOString(),
        vhvName: voiceMemo.vhvName,
      };
      setOfflineQueue((prev) => [...prev, qItem]);
      showToast(
        `แนบบันทึกเสียงเยี่ยมบ้านของ ${voiceMemo.elderName} (${voiceMemo.durationSec} วินาที) ลงคิว Offline เรียบร้อยแล้ว`
      );
    } else {
      showToast(
        `แนบบันทึกเสียงเยี่ยมบ้านและบริบทเพิ่มเติมของ ${voiceMemo.elderName} (${voiceMemo.durationSec} วินาที) สำเร็จ`
      );
    }
  };

  const handleUpdateReferralStatus = (
    referralId: string,
    status: ReferralRecord['status'],
    clinicalNote: string
  ) => {
    setReferrals((prev) =>
      prev.map((r) =>
        r.id === referralId
          ? {
              ...r,
              status,
              clinicalNote:
                status === 'รพ.สต. รับเรื่องแล้ว'
                  ? 'รพ.สต. รับเรื่องและนัดตรวจประเมินคลินิกผู้สูงอายุเรียบร้อยแล้ว'
                  : status === 'ประเมินคลินิกเสร็จสิ้น'
                  ? 'แพทย์/พยาบาลเวชปฏิบัติประเมินแล้ว ปรับแผนดูแลสุขภาพและโภชนาการ'
                  : status === 'ส่งกลับ อสม. ติดตามต่อเนื่อง'
                  ? 'อาการคงที่ ส่งกลับให้ อสม. ติดตามเยี่ยมบ้านตามแผน 4 สัปดาห์'
                  : clinicalNote,
            }
          : r
      )
    );
    showToast(`อัปเดตสถานะใบส่งต่อ ${referralId} เป็น "${status}" แล้ว`);
  };

  const handleSelfRecordVitals = (
    elderId: string,
    sbp: number,
    dbp: number,
    weight: number
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let escalatedElder: ElderProfile | null = null;
    setElders((prev) =>
      prev.map((e) => {
        if (e.id !== elderId) return e;
        const bmi = calculateBmi(weight, e.chronicMetrics.height);
        const updatedMetrics = {
          ...e.chronicMetrics,
          sbp,
          dbp,
          weight,
          bmi,
        };
        const { riskProfile, ruleAudit } = evaluateHealthRisk(
          e.frailtyDomains,
          updatedMetrics,
          e.gender,
          e.livingArrangement,
          e.protocolUsed
        );
        const personalPlan = buildDeterministicHealthPlan(
          e.name,
          riskProfile,
          e.frailtyDomains,
          updatedMetrics
        );
        const updatedProfile: ElderProfile = {
          ...e,
          chronicMetrics: updatedMetrics,
          riskProfile,
          ruleAudit,
          personalPlan,
          history: [
            ...e.history,
            {
              date: todayStr,
              sbp,
              dbp,
              weight,
              bmi,
              frailtyScore: riskProfile.frailtyScore,
            },
          ],
        };
        if (sbp >= 180 || dbp >= 110 || riskProfile.matrixGroup === 'D') {
          escalatedElder = updatedProfile;
        }
        return updatedProfile;
      })
    );
    if (escalatedElder) {
      handleTriggerSmartWatchSos(escalatedElder);
    }
  };

  const handleSelectElderById = (elderId: string) => {
    const found = elders.find((e) => e.id === elderId);
    if (found) setSelectedElder(found);
  };

  const handleRecordMedicationTaken = (
    elderId: string,
    logEvent: MedicationAdherenceLogEvent
  ) => {
    setElders((prev) => {
      const updated = prev.map((e) => {
        if (e.id !== elderId) return e;
        const existingLogs = e.medicationAdherenceLogs || [];
        return {
          ...e,
          medicationAdherenceLogs: [logEvent, ...existingLogs],
        };
      });
      try {
        localStorage.setItem(STORAGE_KEYS.ELDERS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });

    setSelectedElder((prev) => {
      if (!prev || prev.id !== elderId) return prev;
      const existingLogs = prev.medicationAdherenceLogs || [];
      return {
        ...prev,
        medicationAdherenceLogs: [logEvent, ...existingLogs],
      };
    });

    showToast(
      `💊 บันทึกการรับประทานยา “${logEvent.medicationName}” (${logEvent.scheduledPeriodLabel}) เข้าสู่ไทม์ไลน์สุขภาพของ ${logEvent.elderName} แล้ว`
    );
  };

  const handleUndoMedicationTaken = (elderId: string, logId: string) => {
    setElders((prev) => {
      const updated = prev.map((e) => {
        if (e.id !== elderId) return e;
        const existingLogs = e.medicationAdherenceLogs || [];
        return {
          ...e,
          medicationAdherenceLogs: existingLogs.filter((l) => l.id !== logId),
        };
      });
      try {
        localStorage.setItem(STORAGE_KEYS.ELDERS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });

    setSelectedElder((prev) => {
      if (!prev || prev.id !== elderId) return prev;
      const existingLogs = prev.medicationAdherenceLogs || [];
      return {
        ...prev,
        medicationAdherenceLogs: existingLogs.filter((l) => l.id !== logId),
      };
    });

    showToast('ยกเลิกรายการบันทึกการรับประทานยาแล้ว');
  };

  const handleApproveAgenticPlan = (elder: ElderProfile) => {
    handleVerifyElder(elder.id);
    showToast(
      `อนุมัติแผนสุขภาพ 4 สัปดาห์ของ ${elder.name} และส่งแจ้งเตือนงานติดตามไปยัง ${elder.assignedVhv} แล้ว`
    );
  };

  const activeMenuMeta =
    MAIN_MENU_ITEMS.find((item) => item.id === activeTab) || MAIN_MENU_ITEMS[0];

  const activeSosEmergency = targetedFallAlerts.find(
    (a) => !dismissedSosAlertIds.includes(a.id)
  );
  const activeSosElder = activeSosEmergency
    ? elders.find((e) => e.id === activeSosEmergency.elderId)
    : null;

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#0B1120] text-slate-100 transition-colors duration-150 ux-theme-dark ${
        largeTextScale ? 'ux-scale-large' : ''
      }`}
    >
      {/* Single Unified Accessible Header */}
      <header className="sticky top-0 z-40 h-16 bg-[#0F172A]/95 backdrop-blur-md border-b border-[#334155] shadow-lg px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Hamburger (Mobile) + Brand + System Name + RPH Subdistrict Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            aria-label={isMobileNavOpen ? 'ปิดเมนูการนำทาง' : 'เปิดเมนูการนำทางหลัก'}
            aria-expanded={isMobileNavOpen}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
          >
            {isMobileNavOpen ? (
              <X className="w-5 h-5 text-emerald-400" />
            ) : (
              <Menu className="w-5 h-5 text-slate-200" />
            )}
          </button>

          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('rph_dashboard');
            }}
            className="flex items-center gap-2.5 group cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-xs">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-white leading-none">
                Smart Elderly <span className="text-emerald-400">Health Watch</span>
              </span>
              <span className="text-[10px] text-slate-300 font-medium leading-tight mt-0.5">
                ระบบเฝ้าระวังสุขภาพผู้สูงอายุ
              </span>
            </div>
          </a>

          {/* RPH Subdistrict Selection Dropdown (Desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-slate-700/80">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <label htmlFor="desktop-subdistrict-select" className="sr-only">
              เลือก รพ.สต. หรือตำบลเป้าหมาย
            </label>
            <select
              id="desktop-subdistrict-select"
              value={selectedGlobalSubdistrict}
              onChange={(e) => setSelectedGlobalSubdistrict(e.target.value)}
              aria-label="เลือก รพ.สต. หรือตำบลเป้าหมาย"
              className="min-h-[40px] py-1.5 px-2.5 text-xs font-medium border border-slate-700 rounded-lg bg-slate-900 text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none cursor-pointer max-w-[210px] truncate"
            >
              <option value="ALL">เครือข่าย อ.เมืองนครราชสีมา (25 ตำบล)</option>
              {COMMUNITY_BASELINE_STATS.subdistrictCoverage.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name} ({s.rphName.split('/')[0].trim()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Main Navigation Tabs (Desktop >= 1024px) */}
        <nav
          aria-label="เมนูหลักของระบบ"
          className="hidden lg:flex items-center gap-1 overflow-x-auto py-1"
        >
          {MAIN_MENU_ITEMS.map((nav) => {
            const IconComponent = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(nav.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                  isActive
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <IconComponent
                  className={`w-4 h-4 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Emergency SOS + Font Scale + PWA + Screening + User Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Minimized SOS Alert Indicator Tag (if user minimized the main banner) */}
          {activeSosEmergency && isSosAlertMinimized && (
            <button
              type="button"
              onClick={() => setIsSosAlertMinimized(false)}
              className="animate-pulse flex items-center gap-1.5 min-h-[44px] px-2.5 py-1.5 rounded-lg bg-red-950 border border-red-500/80 text-red-200 text-xs font-bold hover:bg-red-900 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
              title="แตะเพื่อเปิดการแจ้งเตือนฉุกเฉิน SOS"
              aria-label="มีเหตุฉุกเฉิน SOS กำลังเกิดขึ้น แตะเพื่อดูรายละเอียด"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span className="hidden md:inline">🚨 มีเหตุ SOS ({activeSosEmergency.elderName})</span>
              <span className="md:hidden font-mono-num font-extrabold">🚨 SOS</span>
            </button>
          )}

          {/* SOS Status (1669) Button - Strictly Red with Minimum 44x44px Touch Target */}
          <button
            type="button"
            onClick={() => handleTriggerSmartWatchSos()}
            title="คลิกจำลองสัญญาณฉุกเฉิน Smart Watch SOS (1669)"
            aria-label="สัญญาณฉุกเฉิน Smart Watch SOS 1669"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow-md shadow-red-950/50 transition-all cursor-pointer focus-visible:ring-4 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <Watch className="w-4 h-4 text-amber-200 shrink-0" aria-hidden="true" />
            <span className="font-extrabold">SOS 1669</span>
          </button>

          {/* Text scale toggle with Minimum 44x44px Touch Target */}
          <button
            type="button"
            onClick={() => setLargeTextScale((prev) => !prev)}
            aria-pressed={largeTextScale}
            aria-label={largeTextScale ? 'ตัวอักษรขนาดปกติ (100%)' : 'ขยายตัวอักษรใหญ่ขึ้น (ก+)'}
            title={largeTextScale ? 'ตัวอักษรขนาดปกติ (100%)' : 'ขยายตัวอักษรใหญ่ขึ้น (ก+)'}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
              largeTextScale
                ? 'bg-amber-400 border-amber-300 text-slate-950 font-extrabold shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Type className="w-4 h-4" aria-hidden="true" />
          </button>

          <PWAInstallButton />

          {/* Primary Action Button: คัดกรองสุขภาพ (Blue, Desktop/Tablet) */}
          <button
            type="button"
            onClick={() => handleOpenScreening()}
            className="hidden sm:flex min-h-[44px] items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:outline-none"
          >
            <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
            <span>+ คัดกรองสุขภาพ</span>
          </button>

          {/* Consolidated User Profile & Settings Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
              aria-expanded={isProfileDropdownOpen}
              aria-haspopup="true"
              aria-label="เมนูโปรไฟล์ผู้ใช้งานและสลับสิทธิ์"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 font-extrabold flex items-center justify-center text-xs">
                {currentSession.displayName.charAt(0)}
              </div>
              <span className="hidden xl:inline font-semibold text-xs max-w-[110px] truncate text-slate-200">
                {currentSession.displayName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isProfileDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Consolidated User Profile & Switch Role Popover */}
            {isProfileDropdownOpen && (
              <div
                role="menu"
                aria-label="เมนูผู้ใช้งานและการตั้งค่าระบบ"
                className="absolute right-0 mt-2 w-88 max-w-[95vw] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 text-xs space-y-3.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* User Identity Card */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="font-extrabold text-white text-sm">
                      {currentSession.displayName}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-[11px]">
                      {currentSession.roleBadgeLabel}
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      {currentSession.unitOrVillage}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono-num text-[10px] font-bold">
                    {currentSession.adminIdCode || currentSession.id?.slice(0, 10) || 'USER'}
                  </span>
                </div>

                {/* Profile Details */}
                <div className="space-y-1.5 text-slate-200 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">บทบาท:</span>
                    <span className="font-bold text-white capitalize">{currentSession.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">เบอร์โทรศัพท์:</span>
                    <span className="font-mono-num font-semibold">{currentSession.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">พื้นที่รับผิดชอบ:</span>
                    <span className="font-medium text-slate-200">{currentSession.subdistrict}</span>
                  </div>
                </div>

                {/* Consolidated Quick Role Switcher */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      สลับสิทธิ์ผู้ใช้งาน (Switch Role):
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ● Active: {currentSession.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleChangeUserSession(PRESET_ROLE_PROFILES.admin[0]);
                        setIsProfileDropdownOpen(false);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] text-left font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                        currentSession.role === 'admin'
                          ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0 text-blue-300" aria-hidden="true" />
                      <div>
                        <div>Admin</div>
                        <div className="text-[10px] opacity-80 font-normal">ผู้ดูแลระบบ</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleChangeUserSession(PRESET_ROLE_PROFILES.rph[0]);
                        setIsProfileDropdownOpen(false);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] text-left font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                        currentSession.role === 'rph'
                          ? 'bg-teal-600 border-teal-400 text-white shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      <Stethoscope className="w-4 h-4 shrink-0 text-teal-300" aria-hidden="true" />
                      <div>
                        <div>รพ.สต.</div>
                        <div className="text-[10px] opacity-80 font-normal">เจ้าหน้าที่ รพ.สต.</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleChangeUserSession(PRESET_ROLE_PROFILES.vhv[0]);
                        setIsProfileDropdownOpen(false);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] text-left font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                        currentSession.role === 'vhv'
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 shrink-0 text-emerald-300" aria-hidden="true" />
                      <div>
                        <div>อสม.</div>
                        <div className="text-[10px] opacity-80 font-normal">อสม. ประจำบ้าน</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleChangeUserSession(PRESET_ROLE_PROFILES.elderly[0]);
                        setIsProfileDropdownOpen(false);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] text-left font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                        currentSession.role === 'elderly'
                          ? 'bg-amber-600 border-amber-400 text-white shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                    >
                      <HeartHandshake className="w-4 h-4 shrink-0 text-amber-300" aria-hidden="true" />
                      <div>
                        <div>ผู้สูงอายุ</div>
                        <div className="text-[10px] opacity-80 font-normal">ญาติ / ผู้ดูแล</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Consolidated Admin Creation Action */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setIsDevToolsDrawerOpen(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    <span>+ {UI_LABELS.actions.createAdminAccount}</span>
                  </button>
                </div>

                {/* Collapsible 25 Subdistricts in jurisdiction */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSubdistrictListExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between text-[11px] text-slate-300 font-semibold py-1 hover:text-white cursor-pointer"
                  >
                    <span>พื้นที่เครือข่าย อ.เมือง (25 ตำบล)</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isSubdistrictListExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isSubdistrictListExpanded && (
                    <div className="mt-2 max-h-28 overflow-y-auto pr-1 flex flex-wrap gap-1">
                      {COMMUNITY_BASELINE_STATS.subdistrictCoverage.map((sub) => (
                        <span
                          key={sub.code}
                          className="text-[10px] bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300"
                        >
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setIsDevToolsDrawerOpen(true);
                    }}
                    className="min-h-[40px] text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4" aria-hidden="true" />
                    <span>คอนโซลทดสอบระบบ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation Drawer (< 1024px) */}
      {isMobileNavOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูหลักสำหรับหน้าจอมือถือ"
          className="fixed inset-0 z-50 overflow-hidden lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
          />

          {/* Drawer container */}
          <div className="fixed inset-y-0 left-0 max-w-full flex pr-10">
            <div className="w-screen max-w-xs bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col justify-between">
              {/* Top Drawer Header */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-sm text-white">Smart Elderly Health Watch</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="ปิดเมนูการนำทาง"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Navigation Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Mobile Subdistrict Selector */}
                <div className="space-y-1">
                  <label htmlFor="mobile-subdistrict-select" className="text-xs font-semibold text-slate-300">
                    พื้นที่ รพ.สต. ในความดูแล:
                  </label>
                  <select
                    id="mobile-subdistrict-select"
                    value={selectedGlobalSubdistrict}
                    onChange={(e) => setSelectedGlobalSubdistrict(e.target.value)}
                    className="w-full min-h-[44px] py-2 px-3 text-xs font-medium border border-slate-700 rounded-xl bg-slate-950 text-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
                  >
                    <option value="ALL">เครือข่าย อ.เมืองนครราชสีมา (25 ตำบล)</option>
                    {COMMUNITY_BASELINE_STATS.subdistrictCoverage.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name} ({s.rphName.split('/')[0].trim()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Workspaces List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    หมวดหมู่การใช้งานหลัก:
                  </div>
                  {MAIN_MENU_ITEMS.map((nav) => {
                    const IconComponent = nav.icon;
                    const isActive = activeTab === nav.id;
                    return (
                      <button
                        key={nav.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                          setActiveTab(nav.id);
                          setIsMobileNavOpen(false);
                        }}
                        className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 font-extrabold shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent
                            className={`w-4 h-4 ${
                              isActive ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span>{nav.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {nav.roleTag}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Quick Action Buttons */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      handleOpenScreening();
                    }}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
                    <span>+ คัดกรองสุขภาพผู้สูงอายุ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      handleTriggerSmartWatchSos();
                    }}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Watch className="w-4 h-4 text-amber-200" aria-hidden="true" />
                    <span>จำลองสัญญาณ SOS (1669)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      setIsDevToolsDrawerOpen(true);
                    }}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <span>เครื่องมือทดสอบระบบ &amp; สลับสิทธิ์</span>
                  </button>
                </div>
              </div>

              {/* Mobile Drawer Bottom User Session Info */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold flex items-center justify-center text-xs">
                    {currentSession.displayName.charAt(0)}
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-white max-w-[150px] truncate">
                      {currentSession.displayName}
                    </div>
                    <div className="text-[10px] text-emerald-400 capitalize">
                      {currentSession.roleBadgeLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container with Safe Area Padding */}
      <main className="flex-1 w-full max-w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 pb-24 sm:pb-8 bg-[#0F172A] text-slate-100">
        {/* Dedicated Non-Overlapping Emergency SOS Sticky Alert Banner (Problem 1 Solution) */}
        {activeSosEmergency && !isSosAlertMinimized && (
          <section
            role="alert"
            aria-live="assertive"
            aria-label="แจ้งเตือนเหตุฉุกเฉิน Smart Watch SOS"
            className="mb-6 rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500/90 p-4 sm:p-5 shadow-2xl z-20 transition-all"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-red-600 text-white shrink-0 shadow-lg shadow-red-950/60 animate-pulse">
                  <Watch className="w-6 h-6 text-amber-200" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-mono-num font-extrabold uppercase tracking-wide">
                      🚨 สัญญาณ SOS Smart Watch (1669) ตรวจพบแรงกระแทก
                    </span>
                    <span className="text-xs font-mono-num font-bold text-amber-300">
                      แรงกระแทก {activeSosEmergency.impactForceG}G · HR {activeSosEmergency.heartRateBpm} bpm
                    </span>
                    <span className="text-xs text-slate-300 font-mono-num">
                      ({activeSosEmergency.createdAt})
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    {activeSosEmergency.elderName}{' '}
                    <span className="text-xs font-normal text-slate-300">
                      (อายุ {activeSosEmergency.elderAge} ปี · {activeSosEmergency.village} {activeSosEmergency.subdistrict})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    ระบบ 2-Tier แจ้งเตือนด่วน: อสม.ประจำบ้าน <strong>{activeSosEmergency.assignedVhv}</strong> (ห่าง ~{activeSosEmergency.vhvDistanceMeters} ม. · ถึงบ้านใน {activeSosEmergency.vhvEtaMinutes} นาที) และส่งเรื่องคู่ขนานหา <strong>{activeSosEmergency.rphFacility}</strong> ทันที
                  </p>
                </div>
              </div>

              {/* Action Buttons with Minimum 44x44px Touch Target */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTriggerSmartWatchSos(activeSosElder || undefined)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow-md shadow-red-950/50 flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Watch className="w-4 h-4 text-amber-300" aria-hidden="true" />
                  <span>เปิดหน้าต่างสั่งการ SOS 1669</span>
                </button>

                {activeSosElder && (
                  <button
                    type="button"
                    onClick={() => setSelectedElder(activeSosElder)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span>ดูแฟ้มสุขภาพ / พิกัด</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsSosAlertMinimized(true)}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
                  title="ย่อการแจ้งเตือนไปไว้ที่แถบด้านบนเพื่อลดพื้นที่"
                >
                  ย่อการแจ้งเตือน
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDismissedSosAlertIds((prev) => [...prev, activeSosEmergency.id])
                  }
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                  title="รับทราบและปิดการแจ้งเตือนนี้"
                  aria-label="ปิดการแจ้งเตือนเหตุฉุกเฉินนี้"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}
        {/* Floating Bottom-Right Dev & Test Tools Trigger Dock */}
        <aside
          aria-label="เครื่องมือสำหรับทดสอบระบบ"
          className="fixed bottom-18 sm:bottom-4 right-3 sm:right-4 z-30 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setIsDevToolsDrawerOpen(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 border border-slate-700 hover:border-slate-500 text-slate-100 text-xs font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="คลิกเพื่อเปิดเครื่องมือทดสอบระบบ, สลับสิทธิ์ผู้ใช้ (Switch Role), และจำลองการล้ม"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>เครื่องมือทดสอบระบบ</span>
            {targetedFallAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-[10px] font-mono-num font-extrabold text-white">
                {targetedFallAlerts.length}
              </span>
            )}
            {isOfflineMode && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                OFFLINE
              </span>
            )}
          </button>
        </aside>

        {/* Slide-over Dev / Test Tools Console Drawer */}
        {isDevToolsDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
              onClick={() => setIsDevToolsDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-4xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wrench className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        เครื่องมือทดสอบระบบและสลับบทบาท (Dev &amp; Testing Console)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        สลับบทบาทผู้ใช้งาน (Switch Role), จำลองเหตุการณ์ล้ม (Targeted Push), และจัดการคิวออฟไลน์
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDevToolsDrawerOpen(false)}
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <RoleLoginAndWorkflowHub
                    elders={elders}
                    currentSession={currentSession}
                    activeWorkspaceTab={activeTab}
                    onNavigateWorkspaceTab={(tab) => {
                      setActiveTab(tab);
                      setIsDevToolsDrawerOpen(false);
                    }}
                    onChangeSession={handleChangeUserSession}
                    targetedFallAlerts={targetedFallAlerts}
                    onSimulateTargetedFallAlert={(elder) =>
                      dispatchTargetedFallPush(elder, false)
                    }
                    onUpdateTargetedAlertStatus={handleUpdateTargetedAlertStatus}
                    isOfflineMode={isOfflineMode}
                    onToggleOfflineMode={() =>
                      setSimulatedOffline((prev) => !prev)
                    }
                    offlineQueue={offlineQueue}
                    isSyncing={isSyncing}
                    lastSyncedAt={lastSyncedAt}
                    onSyncOfflineQueue={handleSyncOfflineQueue}
                    onSaveQuickOfflineVisit={handleSaveQuickOfflineVisit}
                    onSelectElder={(elder) => setSelectedElder(elder)}
                    onOpenSmartWatchSos={(elder) =>
                      handleTriggerSmartWatchSos(elder)
                    }
                    onCreateReferral={handleCreateReferral}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-teal-950 border border-teal-500/60 text-teal-100 text-xs font-medium flex items-center justify-between shadow-lg">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-4 text-teal-300 hover:text-white font-semibold cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {activeTab === 'rph_dashboard' && (
          <RphDashboardView
            elders={elders}
            onSelectElder={(elder) => setSelectedElder(elder)}
            onOpenScreening={handleOpenScreening}
            onVerifyElder={handleVerifyElder}
            onCreateReferral={handleCreateReferral}
            onOpenMonthlyReport={() => setActiveTab('monthly_report')}
            onEscalateElderRisk={(updatedElder) =>
              handleSaveElderScreening(updatedElder, false)
            }
            onTriggerSmartWatchSos={handleTriggerSmartWatchSos}
          />
        )}

        {activeTab === 'monthly_report' && (
          <MonthlyHealthReport
            elders={elders}
            followUps={followUps}
            referrals={referrals}
            onSelectElder={(elder) => setSelectedElder(elder)}
            onCreateReferral={handleCreateReferral}
          />
        )}

        {activeTab === 'vhv_pwa' && (
          <VhvMobilePwaView
            elders={elders}
            followUps={followUps}
            isOfflineMode={isOfflineMode}
            onToggleOfflineMode={() => setSimulatedOffline((prev) => !prev)}
            offlineQueue={offlineQueue}
            onSyncOfflineQueue={handleSyncOfflineQueue}
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncedAt}
            onSelectElder={(elder) => setSelectedElder(elder)}
            onOpenScreening={handleOpenScreening}
            onCreateReferral={handleCreateReferral}
            onAttachVoiceMemo={handleAttachVoiceMemoToFollowUp}
            onReportCommunityHazard={(report) => {
              if (isOfflineMode) {
                setOfflineQueue((prev) => [
                  {
                    id: `OQ-HAZ-${Date.now().toString().slice(-4)}`,
                    type: 'HAZARD_REPORT',
                    elderName: report.elderName,
                    summary: `ปักหมุดจุดเสี่ยงชุมชน: ${report.title} (${report.targetAgency})`,
                    createdAt: report.reportedAt,
                    vhvName: report.reportedByVhv,
                  },
                  ...prev,
                ]);
                showToast(
                  `📍 บันทึกหมุดจุดเสี่ยงชุมชนของ ${report.elderName} ลงคิว Offline แล้ว (รอซิงก์เมื่อมีสัญญาณ)`
                );
              } else {
                showToast(
                  `📍 ปักหมุดจุดเสี่ยงชุมชน “${report.title}” และส่งประสาน ${report.targetAgency} สำเร็จ`
                );
              }
            }}
          />
        )}

        {activeTab === 'elderly_portal' && (
          <ElderlySelfPortalView
            elders={elders}
            onSelfRecordVitals={handleSelfRecordVitals}
            onOpenFullDetail={(elder) => setSelectedElder(elder)}
            onTriggerSmartWatchSos={handleTriggerSmartWatchSos}
            onRecordMedicationTaken={handleRecordMedicationTaken}
            onUndoMedicationTaken={handleUndoMedicationTaken}
          />
        )}

        {activeTab === 'followup_referral' && (
          <FollowUpAndReferralView
            elders={elders}
            followUps={followUps}
            referrals={referrals}
            onCompleteFollowUp={handleCompleteFollowUp}
            onUpdateReferralStatus={handleUpdateReferralStatus}
            onSelectElderById={handleSelectElderById}
          />
        )}

        {activeTab === 'research_sssrfe' && (
          <ResearchAnalyticsView
            elders={elders}
            followUps={followUps}
            referrals={referrals}
            susEntries={susEntries}
            onAddSusEntry={(entry) => setSusEntries((prev) => [entry, ...prev])}
          />
        )}
      </main>

      {/* Non-intrusive Offline Connectivity Indicator */}
      {isOfflineMode && (
        <div className="fixed bottom-18 sm:bottom-4 left-3 sm:left-4 z-40 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>
            โหมด Offline-First — ข้อมูลถูกเก็บในเครื่องชั่วคราว ({offlineQueue.length} รายการรอ Sync)
          </span>
        </div>
      )}

      {/* Mobile-First Bottom Navigation Bar (< 1024px) */}
      <nav
        aria-label="แถบเมนูด้านล่างสำหรับมือถือ"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A]/95 border-t border-slate-800 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-14 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rph_dashboard')}
            aria-label="แดชบอร์ด รพ.สต."
            aria-current={activeTab === 'rph_dashboard' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeTab === 'rph_dashboard' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">รพ.สต.</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vhv_pwa')}
            aria-label="อสม. ภาคสนาม (PWA)"
            aria-current={activeTab === 'vhv_pwa' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeTab === 'vhv_pwa' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">อสม.</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('elderly_portal')}
            aria-label="พอร์ทัลผู้สูงอายุและญาติ"
            aria-current={activeTab === 'elderly_portal' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeTab === 'elderly_portal' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">ผู้สูงอายุ</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerSmartWatchSos()}
            aria-label="ส่งสัญญาณฉุกเฉิน Smart Watch SOS 1669"
            className="flex flex-col items-center justify-center min-h-[44px] text-red-400 hover:text-red-300 font-extrabold cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <span className="relative flex h-2 w-2 mb-0.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <Watch className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-extrabold">SOS 1669</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="เปิดเมนูการนำทางและเครื่องมือทั้งหมด"
            className="flex flex-col items-center justify-center min-h-[44px] text-slate-400 hover:text-slate-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Menu className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">เมนู</span>
          </button>
        </div>
      </nav>

      {/* Academic & Institutional Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 sm:px-8 py-6 mt-12 mb-14 lg:mb-0">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-300">
          <div>
            <p className="font-semibold text-white">
              Smart Elderly Health Watch — ระบบอัจฉริยะเฝ้าระวังสุขภาพผู้สูงอายุระดับชุมชน ในจังหวัดนครราชสีมา
            </p>
            <p className="mt-0.5 text-slate-300">
              ออกแบบพัฒนา: อาจารย์ฐิติวัสส์ กาญจนพิมาย · สาขาวิชาอุตสาหกรรมศิลป์ · คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏนครราชสีมา
            </p>
          </div>
          <div className="flex items-center gap-3 text-teal-300 shrink-0 font-medium">
            <span>กรอบแนวคิดวิจัย: SSSRFE Model</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span>Safety Guardrail: ประเมินความเสี่ยง (ไม่วินิจฉัยโรค)</span>
          </div>
        </div>
      </footer>

      {/* Elder Detail & Hybrid AI Plan Drawer */}
      <ElderDetailDrawer
        elder={selectedElder}
        allElders={elders}
        onSelectElder={(elder) => {
          setSelectedElder(elder);
          showToast(
            `📱 สแกน QR Code เปิดแฟ้มสุขภาพดิจิทัลของ ${elder.name} (${elder.id}) สำเร็จ`
          );
        }}
        onClose={() => setSelectedElder(null)}
        onUpdatePlan={handleUpdateElderPlan}
        onOpenRescreen={(elder) => handleOpenScreening(elder)}
        onCreateReferral={handleCreateReferral}
        onApproveAgenticPlan={handleApproveAgenticPlan}
      />

      {/* Modular Frailty & Chronic Disease Risk Screening Modal */}
      <ScreeningEngineModal
        isOpen={isScreeningModalOpen}
        initialElder={elderToRescreen}
        isOfflineMode={isOfflineMode}
        onClose={() => setIsScreeningModalOpen(false)}
        onSaveElderScreening={handleSaveElderScreening}
      />

      {/* Smart Watch SOS Impact & 1669 Emergency Dispatch Pop-Up Modal */}
      <SmartWatchSosModal
        isOpen={isSosModalOpen}
        elders={elders}
        activeElder={sosTargetElder || elders[0] || null}
        onSelectElder={(elder) => setSosTargetElder(elder)}
        onClose={() => setIsSosModalOpen(false)}
        onOpenElderProfile={(elder) => setSelectedElder(elder)}
        onCreateEmergencyReferral={handleCreateReferral}
      />
    </div>
  );
}
