import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Copy,
  Eye,
  EyeOff,
  HeartHandshake,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlusCircle,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { ElderProfile, OfflineQueueItem, UserRole } from '../types/health';
import { UI_LABELS } from '../constants/uiLabels';

export type AdminPrivilegeTier = 'super_admin' | 'district_admin' | 'research_admin';

export interface ActiveUserSession {
  id?: string;
  role: UserRole;
  displayName: string;
  roleBadgeLabel: string;
  unitOrVillage: string;
  subdistrict: string;
  phone: string;
  emailOrUsername?: string;
  adminIdCode?: string;
  adminPinOrPass?: string;
  privilegeTier?: AdminPrivilegeTier;
  permissions?: string[];
  createdAt?: string;
  loginMethod:
    | 'LINE OA'
    | 'เบอร์โทรศัพท์ + OTP'
    | 'สแกนบัตร QR Code'
    | 'รหัสเจ้าหน้าที่ รพ.สต.'
    | 'บัญชีผู้ดูแลระบบ (ADMIN Account)';
  assignedVhvName?: string; // When role === 'vhv', matches elder.assignedVhv
  linkedElderId?: string; // When role === 'elderly', matches specific elder
}

export interface TargetedFallPushNotification {
  id: string;
  elderId: string;
  elderName: string;
  elderAge: number;
  village: string;
  subdistrict: string;
  assignedVhv: string;
  rphFacility: string;
  caregiverName: string;
  caregiverPhone: string;
  impactForceG: number;
  heartRateBpm: number;
  spo2Pct: number;
  createdAt: string;
  vhvDistanceMeters: number;
  vhvEtaMinutes: number;
  vhvStatus: 'notified_push' | 'vhv_accepted_enroute' | 'vhv_on_scene';
  vhvRespondedAt?: string;
  rphStatus: 'escalated_immediate' | 'rph_monitoring_dispatch' | 'ems_dispatched';
  rphRespondedAt?: string;
  caregiverNotified: boolean;
}

interface RoleLoginAndWorkflowHubProps {
  elders: ElderProfile[];
  currentSession: ActiveUserSession;
  activeWorkspaceTab?:
    | 'rph_dashboard'
    | 'monthly_report'
    | 'vhv_pwa'
    | 'elderly_portal'
    | 'followup_referral'
    | 'research_sssrfe';
  onNavigateWorkspaceTab?: (
    tab:
      | 'rph_dashboard'
      | 'monthly_report'
      | 'vhv_pwa'
      | 'elderly_portal'
      | 'followup_referral'
      | 'research_sssrfe'
  ) => void;
  onChangeSession: (nextSession: ActiveUserSession, syncWorkspaceTab?: boolean) => void;
  targetedFallAlerts: TargetedFallPushNotification[];
  onSimulateTargetedFallAlert: (elder: ElderProfile) => void;
  onUpdateTargetedAlertStatus: (
    alertId: string,
    updates: Partial<TargetedFallPushNotification>
  ) => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: (forceOffline?: boolean) => void;
  offlineQueue: OfflineQueueItem[];
  isSyncing: boolean;
  lastSyncedAt: string | null;
  onSyncOfflineQueue: () => Promise<void>;
  onSaveQuickOfflineVisit: (payload: {
    elder: ElderProfile;
    sbp: number;
    dbp: number;
    weight: number;
    visitNote: string;
    vhvName: string;
  }) => void;
  onSelectElder: (elder: ElderProfile) => void;
  onOpenSmartWatchSos: (elder: ElderProfile) => void;
  onCreateReferral: (elder: ElderProfile) => void;
}

const ADMIN_ACCOUNTS_STORAGE_KEY = 'korat_ehw_admin_accounts_v1';

export const AVAILABLE_ADMIN_PERMISSIONS: readonly string[] = [
  'จัดการบัญชีผู้ใช้ทั้งหมด (Admin / รพ.สต. / อสม.)',
  'อนุมัติใบส่งต่อฉุกเฉินและสั่งการ 25 ตำบล',
  'ตั้งค่าเกณฑ์ AI Risk Matrix & D3 Geospatial Heatmap',
  'ส่งออกฐานข้อมูลผู้สูงอายุ CSV / รายงานประจำเดือน PDF',
  'ควบคุมศูนย์แจ้งเตือน Smart Watch SOS (1669) & แบตเตอรี่',
  'จัดการข้อมูลกรอบวิจัย SSSRFE & ประเมิน SUS',
] as const;

export const PRESET_ROLE_PROFILES: Record<UserRole, ActiveUserSession[]> = {
  admin: [
    {
      id: 'ADM-PRESET-01',
      role: 'admin',
      displayName: 'ดร.ฐิติวัสส์ (System Super Admin)',
      roleBadgeLabel: 'ผู้ดูแลระบบสูงสุด (Super Admin · สสอ.เมืองนครราชสีมา / NRRU)',
      unitOrVillage: 'ศูนย์บัญชาการสุขภาพผู้สูงอายุ อ.เมืองนครราชสีมา & มรภ.นครราชสีมา',
      subdistrict: 'ครบทั้ง 25 ตำบล อ.เมืองนครราชสีมา',
      phone: '044-009-555',
      emailOrUsername: 'thitiwas.k@nrru.ac.th',
      adminIdCode: 'ADM-KORAT-001',
      adminPinOrPass: 'KORAT-ADMIN#2026',
      privilegeTier: 'super_admin',
      permissions: [...AVAILABLE_ADMIN_PERMISSIONS],
      createdAt: '2026-10-01',
      loginMethod: 'บัญชีผู้ดูแลระบบ (ADMIN Account)',
    },
    {
      id: 'ADM-PRESET-02',
      role: 'admin',
      displayName: 'ผู้ดูแลระบบเครือข่าย รพ.สต. (District Admin)',
      roleBadgeLabel: 'ผู้ดูแลระบบระดับอำเภอ (District Health Admin · สสอ.เมืองฯ)',
      unitOrVillage: 'สำนักงานสาธารณสุขอำเภอเมืองนครราชสีมา (เครือข่าย 25 ตำบล)',
      subdistrict: 'ครบทั้ง 25 ตำบล อ.เมืองนครราชสีมา',
      phone: '044-242-899',
      emailOrUsername: 'admin@korat-smarthealth.go.th',
      adminIdCode: 'ADM-KORAT-002',
      adminPinOrPass: 'MOPH-3001#ADMIN',
      privilegeTier: 'district_admin',
      permissions: [
        'จัดการบัญชีผู้ใช้ทั้งหมด (Admin / รพ.สต. / อสม.)',
        'อนุมัติใบส่งต่อฉุกเฉินและสั่งการ 25 ตำบล',
        'ส่งออกฐานข้อมูลผู้สูงอายุ CSV / รายงานประจำเดือน PDF',
        'ควบคุมศูนย์แจ้งเตือน Smart Watch SOS (1669) & แบตเตอรี่',
      ],
      createdAt: '2026-10-03',
      loginMethod: 'บัญชีผู้ดูแลระบบ (ADMIN Account)',
    },
  ],
  rph: [
    {
      role: 'rph',
      displayName: 'พว.ศิริพร ใจดี',
      roleBadgeLabel: 'เจ้าหน้าที่ รพ.สต. (พยาบาลเวชปฏิบัติ)',
      unitOrVillage: 'รพ.สต.หัวทะเล (แม่ข่าย อ.เมืองนครราชสีมา)',
      subdistrict: 'ต.หัวทะเล',
      phone: '044-244-169',
      loginMethod: 'รหัสเจ้าหน้าที่ รพ.สต.',
    },
    {
      role: 'rph',
      displayName: 'นพ.กิตติพงศ์ นครราช',
      roleBadgeLabel: 'แพทย์เวชศาสตร์ครอบครัว / รพ.สต.',
      unitOrVillage: 'ศูนย์บริการสาธารณสุข โพธิ์กลาง',
      subdistrict: 'ต.โพธิ์กลาง',
      phone: '044-251-880',
      loginMethod: 'รหัสเจ้าหน้าที่ รพ.สต.',
    },
  ],
  vhv: [
    {
      role: 'vhv',
      displayName: 'อสม.วันเพ็ญ ศรีโคราช',
      roleBadgeLabel: 'อสม. ประจำหมู่บ้าน (เขตรับผิดชอบ หมู่ 4)',
      unitOrVillage: 'หมู่ที่ 4 บ้านดอนขวาง',
      subdistrict: 'ต.หัวทะเล',
      phone: '081-742-9011',
      loginMethod: 'LINE OA',
      assignedVhvName: 'อสม.วันเพ็ญ ศรีโคราช',
    },
    {
      role: 'vhv',
      displayName: 'อสม.ประเสริฐ วงศ์นคร',
      roleBadgeLabel: 'อสม. ประจำหมู่บ้าน (เขตรับผิดชอบ หมู่ 2)',
      unitOrVillage: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม',
      subdistrict: 'ต.โพธิ์กลาง',
      phone: '089-415-3320',
      loginMethod: 'เบอร์โทรศัพท์ + OTP',
      assignedVhvName: 'อสม.ประเสริฐ วงศ์นคร',
    },
    {
      role: 'vhv',
      displayName: 'อสม.สมจิตร โคราช',
      roleBadgeLabel: 'อสม. ประจำหมู่บ้าน (เขตรับผิดชอบ หมู่ 7)',
      unitOrVillage: 'หมู่ที่ 7 บ้านหัวทะเล',
      subdistrict: 'ต.หัวทะเล',
      phone: '086-229-7841',
      loginMethod: 'สแกนบัตร QR Code',
      assignedVhvName: 'อสม.สมจิตร โคราช',
    },
  ],
  elderly: [
    {
      role: 'elderly',
      displayName: 'น.ส.กัญญา ดอนกระโทก (ญาติ/ผู้ดูแล)',
      roleBadgeLabel: 'ญาติผู้ดูแลผู้สูงอายุ (บุตรสาว นางสมพร)',
      unitOrVillage: 'หมู่ที่ 4 บ้านดอนขวาง',
      subdistrict: 'ต.หัวทะเล',
      phone: '081-977-4102',
      loginMethod: 'LINE OA',
      linkedElderId: 'KORAT-ELD-001',
    },
    {
      role: 'elderly',
      displayName: 'นายสมศักดิ์ พิมายกลาง (ญาติ/ผู้ดูแล)',
      roleBadgeLabel: 'ญาติผู้ดูแลผู้สูงอายุ (หลานชาย นายทองคำ)',
      unitOrVillage: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม',
      subdistrict: 'ต.โพธิ์กลาง',
      phone: '084-512-6639',
      loginMethod: 'เบอร์โทรศัพท์ + OTP',
      linkedElderId: 'KORAT-ELD-002',
    },
  ],
};

export const RoleLoginAndWorkflowHub: React.FC<RoleLoginAndWorkflowHubProps> = ({
  elders,
  currentSession,
  activeWorkspaceTab = 'rph_dashboard',
  onNavigateWorkspaceTab,
  onChangeSession,
  targetedFallAlerts,
  onSimulateTargetedFallAlert,
  onUpdateTargetedAlertStatus,
  isOfflineMode,
  onToggleOfflineMode,
  offlineQueue,
  isSyncing,
  lastSyncedAt,
  onSyncOfflineQueue,
  onSaveQuickOfflineVisit,
  onSelectElder,
  onOpenSmartWatchSos,
  onCreateReferral,
}) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTab, setLoginTab] = useState<
    'phone_otp' | 'qr_scan' | 'line_oa' | 'rph_id' | 'admin_login'
  >('phone_otp');
  const [selectedLoginRole, setSelectedLoginRole] = useState<UserRole>('admin');
  const [phoneInput, setPhoneInput] = useState<string>('081-742-9011');
  const [otpSent, setOtpSent] = useState<boolean>(true);
  const [otpCode, setOtpCode] = useState<string>('482915');
  const [qrScanningAnim, setQrScanningAnim] = useState<boolean>(false);

  // Admin Account Management & "Create Account for ADMIN" State
  const [customAdminAccounts, setCustomAdminAccounts] = useState<ActiveUserSession[]>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_ACCOUNTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_ACCOUNTS_STORAGE_KEY, JSON.stringify(customAdminAccounts));
    } catch {
      // Ignore storage quota errors
    }
  }, [customAdminAccounts]);

  const allAdminAccounts = useMemo(
    () => [...customAdminAccounts, ...PRESET_ROLE_PROFILES.admin],
    [customAdminAccounts]
  );

  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState<boolean>(false);
  const [isAdminConsoleExpanded, setIsAdminConsoleExpanded] = useState<boolean>(true);
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminUsername, setNewAdminUsername] = useState<string>('');
  const [newAdminIdCode, setNewAdminIdCode] = useState<string>(
    () => `ADM-KORAT-00${3 + customAdminAccounts.length}`
  );
  const [newAdminPassword, setNewAdminPassword] = useState<string>('Admin@Korat2026');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [newAdminUnit, setNewAdminUnit] = useState<string>(
    'สำนักงานสาธารณสุขอำเภอเมืองนครราชสีมา (แม่ข่าย รพ.สต. 25 ตำบล)'
  );
  const [newAdminSubdistrict, setNewAdminSubdistrict] = useState<string>(
    'ครบทั้ง 25 ตำบล อ.เมืองนครราชสีมา'
  );
  const [newAdminPhone, setNewAdminPhone] = useState<string>('044-244-900');
  const [newAdminTier, setNewAdminTier] = useState<AdminPrivilegeTier>('super_admin');
  const [newAdminPermissions, setNewAdminPermissions] = useState<string[]>([
    ...AVAILABLE_ADMIN_PERMISSIONS,
  ]);
  const [createdAdminSuccessBanner, setCreatedAdminSuccessBanner] =
    useState<ActiveUserSession | null>(null);
  const [copiedAdminCredsId, setCopiedAdminCredsId] = useState<string | null>(null);

  // Admin Direct Login credentials in Login Modal
  const [adminLoginIdentifier, setAdminLoginIdentifier] = useState<string>(
    'thitiwas.k@nrru.ac.th'
  );
  const [adminLoginPassword, setAdminLoginPassword] = useState<string>('KORAT-ADMIN#2026');

  const handleToggleAdminPermission = (perm: string) => {
    setNewAdminPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleGenerateAdminPassword = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setNewAdminPassword(`KORAT-ADM#${randomNum}`);
    setShowAdminPassword(true);
  };

  const handleCreateAdminAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newAdminName.trim() || 'ผู้ดูแลระบบ รพ.สต. (System Admin)';
    const trimmedUsername =
      newAdminUsername.trim() ||
      `admin.${Date.now().toString().slice(-4)}@korat-smarthealth.go.th`;
    const trimmedCode =
      newAdminIdCode.trim() || `ADM-KORAT-00${allAdminAccounts.length + 1}`;

    const tierLabel =
      newAdminTier === 'super_admin'
        ? 'ผู้ดูแลระบบสูงสุด (Super Admin · สิทธิ์ครบทุกโมดูล)'
        : newAdminTier === 'district_admin'
        ? 'ผู้ดูแลระบบระดับอำเภอ (District Health Admin · 25 ตำบล)'
        : 'ผู้ดูแลระบบวิจัยและ AI (Research & AI Admin · SSSRFE)';

    const todayStr = new Date().toISOString().slice(0, 10);

    const newAdminSession: ActiveUserSession = {
      id: `ADM-CUSTOM-${Date.now()}`,
      role: 'admin',
      displayName: trimmedName,
      roleBadgeLabel: tierLabel,
      unitOrVillage: newAdminUnit.trim() || 'เครือข่าย รพ.สต. อำเภอเมืองนครราชสีมา',
      subdistrict: newAdminSubdistrict,
      phone: newAdminPhone.trim() || '044-009-555',
      emailOrUsername: trimmedUsername,
      adminIdCode: trimmedCode,
      adminPinOrPass: newAdminPassword || 'KORAT-ADMIN#2026',
      privilegeTier: newAdminTier,
      permissions:
        newAdminPermissions.length > 0
          ? newAdminPermissions
          : [...AVAILABLE_ADMIN_PERMISSIONS],
      createdAt: todayStr,
      loginMethod: 'บัญชีผู้ดูแลระบบ (ADMIN Account)',
    };

    setCustomAdminAccounts((prev) => [newAdminSession, ...prev]);
    onChangeSession(newAdminSession, autoSwitchMenuOnRoleChange);
    setCreatedAdminSuccessBanner(newAdminSession);
    setIsAdminConsoleExpanded(true);

    // Prepare next default code for subsequent creation
    setNewAdminName('');
    setNewAdminUsername('');
    setNewAdminIdCode(`ADM-KORAT-00${allAdminAccounts.length + 2}`);
    setIsCreateAdminModalOpen(false);
  };

  const handleDeleteCustomAdmin = (id?: string) => {
    if (!id) return;
    setCustomAdminAccounts((prev) => prev.filter((acc) => acc.id !== id));
    if (currentSession.id === id) {
      onChangeSession(PRESET_ROLE_PROFILES.admin[0], false);
    }
  };

  const handleCopyAdminCredentials = async (acc: ActiveUserSession) => {
    const text = `ADMIN Account: ${acc.displayName} | ID: ${acc.adminIdCode || 'ADM-KORAT-001'} | Username: ${acc.emailOrUsername || 'admin'} | Pass/PIN: ${acc.adminPinOrPass || 'KORAT-ADMIN#2026'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAdminCredsId(acc.id || acc.displayName);
      setTimeout(() => setCopiedAdminCredsId(null), 2200);
    } catch {
      // Ignore clipboard errors
    }
  };

  // Offline quick field recording state
  const [isOfflineFormExpanded, setIsOfflineFormExpanded] = useState<boolean>(false);
  const [selectedOfflineElderId, setSelectedOfflineElderId] = useState<string>(
    () => elders[0]?.id || 'KORAT-ELD-001'
  );
  const [offlineSbp, setOfflineSbp] = useState<number>(142);
  const [offlineDbp, setOfflineDbp] = useState<number>(88);
  const [offlineWeight, setOfflineWeight] = useState<number>(54.5);
  const [offlineNote, setOfflineNote] = useState<string>(
    'ลงพื้นที่เยี่ยมบ้านจุดอับสัญญาณท้ายหมู่บ้าน วัดความดันโลหิต ตรวจสอบการกินยา และเช็กแบตเตอรี่นาฬิกา Smart Watch เรียบร้อย'
  );

  // Determine which elders belong to the currently logged-in VHV (if role === 'vhv')
  const myAssignedElders = useMemo(() => {
    if (currentSession.role === 'vhv' && currentSession.assignedVhvName) {
      const exact = elders.filter((e) => e.assignedVhv === currentSession.assignedVhvName);
      return exact.length > 0 ? exact : elders.slice(0, 3);
    }
    if (currentSession.role === 'elderly' && currentSession.linkedElderId) {
      const linked = elders.filter((e) => e.id === currentSession.linkedElderId);
      return linked.length > 0 ? linked : elders.slice(0, 1);
    }
    return elders;
  }, [elders, currentSession]);

  // Filter targeted push notifications relevant to the current role/person
  const roleHighlightedAlerts = useMemo(() => {
    if (currentSession.role === 'vhv' && currentSession.assignedVhvName) {
      return targetedFallAlerts.filter(
        (a) => a.assignedVhv === currentSession.assignedVhvName
      );
    }
    if (currentSession.role === 'elderly' && currentSession.linkedElderId) {
      return targetedFallAlerts.filter((a) => a.elderId === currentSession.linkedElderId);
    }
    return targetedFallAlerts;
  }, [targetedFallAlerts, currentSession]);

  const [autoSwitchMenuOnRoleChange, setAutoSwitchMenuOnRoleChange] =
    useState<boolean>(false);

  const handleQuickRoleSwitch = (
    role: UserRole,
    presetIndex = 0,
    forceSyncTab = false
  ) => {
    if (role === 'admin') {
      const adminProfile = allAdminAccounts[presetIndex] || allAdminAccounts[0];
      onChangeSession(adminProfile, forceSyncTab || autoSwitchMenuOnRoleChange);
      return;
    }
    const profile =
      PRESET_ROLE_PROFILES[role][presetIndex] || PRESET_ROLE_PROFILES[role][0];
    onChangeSession(profile, forceSyncTab || autoSwitchMenuOnRoleChange);
  };

  const handleCompleteEasyLogin = (
    method: ActiveUserSession['loginMethod'],
    customProfile?: ActiveUserSession
  ) => {
    const baseProfile =
      customProfile ||
      PRESET_ROLE_PROFILES[selectedLoginRole][0] ||
      PRESET_ROLE_PROFILES.vhv[0];
    onChangeSession(
      {
        ...baseProfile,
        loginMethod: method,
      },
      autoSwitchMenuOnRoleChange
    );
    setIsLoginModalOpen(false);
  };

  const handleSubmitQuickOfflineRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const targetElder =
      elders.find((el) => el.id === selectedOfflineElderId) || elders[0];
    if (!targetElder) return;

    onSaveQuickOfflineVisit({
      elder: targetElder,
      sbp: offlineSbp,
      dbp: offlineDbp,
      weight: offlineWeight,
      visitNote: offlineNote,
      vhvName:
        currentSession.role === 'vhv'
          ? currentSession.displayName
          : targetElder.assignedVhv,
    });
  };

  return (
    <section
      aria-label="ระบบสลับสิทธิ์ผู้ใช้งาน การแจ้งเตือนแบบระบุตัวบุคคล และโหมดทำงานออฟไลน์"
      className="mb-6 rounded-2xl bg-slate-900/95 border border-teal-500/45 p-4 sm:p-5 shadow-xl space-y-4"
    >
      {/* Top Row: Role & Persona Switcher Bar (RPH / VHV / Caregiver) + Easy Login Trigger */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-4 border-b border-slate-800">
        {/* Current Active User Session Identity */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              currentSession.role === 'admin'
                ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-sm'
                : currentSession.role === 'rph'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                : currentSession.role === 'vhv'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-amber-500/20 border-amber-400 text-amber-300'
            }`}
          >
            {currentSession.role === 'admin' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : currentSession.role === 'rph' ? (
              <Stethoscope className="w-5 h-5" />
            ) : currentSession.role === 'vhv' ? (
              <UserCheck className="w-5 h-5" />
            ) : (
              <HeartHandshake className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono-num font-black uppercase ${
                  currentSession.role === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-400 text-slate-950'
                }`}
              >
                {currentSession.role === 'admin' ? '★ ADMIN ACTIVE' : '● ACTIVE ROLE'}
              </span>
              <span className="font-bold text-teal-300">
                ผู้ใช้งานที่กำลังล็อกอิน:
              </span>
              <span className="font-extrabold text-white text-sm">
                {currentSession.displayName}
              </span>
              {currentSession.adminIdCode && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-blue-400/50 text-[11px] font-mono-num font-bold text-blue-300">
                  {currentSession.adminIdCode}
                </span>
              )}
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-semibold text-amber-300">
                {currentSession.roleBadgeLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span>พื้นที่: {currentSession.unitOrVillage} ({currentSession.subdistrict})</span>
              {currentSession.emailOrUsername && (
                <>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono-num text-teal-300">
                    บัญชี: {currentSession.emailOrUsername}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono-num">โทร: {currentSession.phone}</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-emerald-300 font-semibold">
                วิธีเข้าสู่ระบบ: {currentSession.loginMethod} ✓
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Role Switcher Controls (ADMIN / RPH / VHV / Caregiver) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300 mr-1">
            สลับสิทธิ์ทดสอบเวิร์กโฟลว์ (Switch Role):
          </span>

          <div
            role="group"
            aria-label="สลับบทบาทผู้ใช้งาน (Role Switcher Menu Bar)"
            className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-700"
          >
            <button
              type="button"
              aria-pressed={currentSession.role === 'admin'}
              onClick={() => handleQuickRoleSwitch('admin', 0)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 ${
                currentSession.role === 'admin'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                  : 'bg-slate-900 text-blue-200 hover:text-white hover:bg-slate-800 border border-blue-500/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ผู้ดูแลระบบ</span>
              {currentSession.role === 'admin' && (
                <span className="ml-0.5 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono-num font-black text-amber-300">
                  ● Active
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={currentSession.role === 'rph'}
              onClick={() => handleQuickRoleSwitch('rph', 0)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-400 ${
                currentSession.role === 'rph'
                  ? 'bg-teal-400 text-slate-950 shadow-md ring-2 ring-teal-200'
                  : 'bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>เจ้าหน้าที่ รพ.สต.</span>
              {currentSession.role === 'rph' && (
                <span className="ml-0.5 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono-num font-black text-teal-300">
                  ● Active
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={currentSession.role === 'vhv'}
              onClick={() => handleQuickRoleSwitch('vhv', 0)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                currentSession.role === 'vhv'
                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-2 ring-emerald-200'
                  : 'bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>อสม. ประจำบ้าน</span>
              {currentSession.role === 'vhv' && (
                <span className="ml-0.5 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono-num font-black text-emerald-300">
                  ● Active
                </span>
              )}
            </button>

            <button
              type="button"
              aria-pressed={currentSession.role === 'elderly'}
              onClick={() => handleQuickRoleSwitch('elderly', 0)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
                currentSession.role === 'elderly'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-200'
                  : 'bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>ญาติ / ผู้ดูแล</span>
              {currentSession.role === 'elderly' && (
                <span className="ml-0.5 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono-num font-black text-amber-300">
                  ● Active
                </span>
              )}
            </button>
          </div>

          {/* Quick Jump to Matching Menu Bar Tab for Current Active Role */}
          {onNavigateWorkspaceTab && (
            <button
              type="button"
              onClick={() => {
                const targetTab =
                  currentSession.role === 'vhv'
                    ? 'vhv_pwa'
                    : currentSession.role === 'elderly'
                    ? 'elderly_portal'
                    : 'rph_dashboard';
                onNavigateWorkspaceTab(targetTab);
              }}
              title="เปิดหน้าเมนูหลักที่ตรงกับบทบาทผู้ใช้งานปัจจุบัน"
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-teal-400 text-[11px] font-bold text-slate-200 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {currentSession.role === 'vhv'
                  ? activeWorkspaceTab === 'vhv_pwa'
                    ? 'หน้า อสม. (Active ✓)'
                    : 'เปิดเมนู อสม. ภาคสนาม'
                  : currentSession.role === 'elderly'
                  ? activeWorkspaceTab === 'elderly_portal'
                    ? 'หน้าผู้สูงอายุ (Active ✓)'
                    : 'เปิดเมนูสำหรับผู้สูงอายุ'
                  : activeWorkspaceTab === 'rph_dashboard'
                  ? 'หน้า รพ.สต. (Active ✓)'
                  : 'เปิดแดชบอร์ด รพ.สต.'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setAutoSwitchMenuOnRoleChange((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
              autoSwitchMenuOnRoleChange
                ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="เมื่อเปิด ระบบจะสลับหน้า Menu Bar ไปยังหน้าของบทบาทนั้นอัตโนมัติทันทีที่กดสลับสิทธิ์"
          >
            {autoSwitchMenuOnRoleChange
              ? 'ซิงก์ Menu Bar ตามสิทธิ์: Active ✓'
              : 'ซิงก์ Menu Bar อัตโนมัติ: ปิด'}
          </button>

          {/* Specific VHV Persona Selector when in VHV mode */}
          {currentSession.role === 'vhv' && (
            <select
              value={currentSession.displayName}
              onChange={(e) => {
                const idx = PRESET_ROLE_PROFILES.vhv.findIndex(
                  (p) => p.displayName === e.target.value
                );
                if (idx >= 0) handleQuickRoleSwitch('vhv', idx);
              }}
              aria-label="เลือกชื่อ อสม. ผู้รับผิดชอบบ้าน"
              className="py-1.5 px-2.5 text-xs font-bold border border-emerald-500/60 rounded-lg bg-slate-950 text-emerald-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              {PRESET_ROLE_PROFILES.vhv.map((vhv) => (
                <option key={vhv.displayName} value={vhv.displayName}>
                  {vhv.displayName} ({vhv.unitOrVillage})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsCreateAdminModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ {UI_LABELS.actions.createAdminAccount}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-teal-400/70 bg-slate-950 hover:bg-slate-800 text-teal-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>หน้าล็อกอิน (ADMIN / อสม. OTP / QR / LINE OA)</span>
          </button>
        </div>
      </div>

      {/* Newly Created Admin Account Confirmation Banner */}
      {createdAdminSuccessBanner && (
        <div
          role="status"
          className="rounded-xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-400/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-white">
                สร้างบัญชีผู้ดูแลระบบ (ADMIN Account) สำเร็จและเข้าสู่ระบบอัตโนมัติแล้ว!
              </p>
              <p className="text-emerald-200 font-mono-num mt-0.5">
                ชื่อ: <strong>{createdAdminSuccessBanner.displayName}</strong> · รหัส:{' '}
                <strong>{createdAdminSuccessBanner.adminIdCode}</strong> · บัญชี:{' '}
                <strong>{createdAdminSuccessBanner.emailOrUsername}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyAdminCredentials(createdAdminSuccessBanner)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-400/60 text-emerald-200 hover:text-white font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>
                {copiedAdminCredsId ===
                (createdAdminSuccessBanner.id || createdAdminSuccessBanner.displayName)
                  ? 'คัดลอกข้อมูลบัญชีแล้ว ✓'
                  : 'คัดลอกรหัสผ่าน/บัญชี'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCreatedAdminSuccessBanner(null)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-semibold cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* ADMIN Account Directory & Privilege Console (Always accessible when role === 'admin' or expandable) */}
      <div className="rounded-xl bg-slate-950/95 border border-rose-500/45 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-300 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-white">
                  ศูนย์จัดการบัญชีผู้ดูแลระบบ (ADMIN Account Directory &amp; Access Control)
                </h3>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono-num font-extrabold">
                  {allAdminAccounts.length} บัญชี ADMIN พร้อมใช้งาน
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                รองรับการสร้างบัญชีผู้ดูแลระบบใหม่ (Create Account for ADMIN) กำหนดระดับสิทธิ์ Super Admin / District Admin / Research Admin และสลับเข้าใช้งานได้ทันที
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreateAdminModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ {UI_LABELS.actions.createNewAdmin}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAdminConsoleExpanded((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer"
            >
              {isAdminConsoleExpanded ? 'ซ่อนรายชื่อ Admin' : `ดูรายชื่อ Admin (${allAdminAccounts.length})`}
            </button>
          </div>
        </div>

        {isAdminConsoleExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 border-t border-slate-800/90">
            {allAdminAccounts.map((adminAcc) => {
              const isCurrentAdmin =
                currentSession.role === 'admin' &&
                (currentSession.id === adminAcc.id ||
                  currentSession.displayName === adminAcc.displayName);
              const isCustom = Boolean(adminAcc.id?.startsWith('ADM-CUSTOM-'));

              return (
                <div
                  key={adminAcc.id || adminAcc.displayName}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                    isCurrentAdmin
                      ? 'bg-blue-950/40 border-blue-400 ring-1 ring-blue-400/60 shadow-md'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/50 text-blue-300 font-mono-num text-[10px] font-extrabold">
                        {adminAcc.adminIdCode || 'ADM-KORAT'}
                      </span>
                      {isCurrentAdmin ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-mono-num font-black">
                          ● กำลังใช้งาน
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono-num text-slate-400">
                          {isCustom ? 'บัญชีสร้างใหม่' : 'บัญชีมาตรฐาน'}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-white">
                        {adminAcc.displayName}
                      </h4>
                      <p className="text-[11px] font-semibold text-amber-300">
                        {adminAcc.roleBadgeLabel}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 text-[11px] font-mono-num space-y-0.5 text-slate-300">
                      <div>
                        ชื่อผู้ใช้/อีเมล:{' '}
                        <strong className="text-teal-300">
                          {adminAcc.emailOrUsername || 'admin@korat-smarthealth.go.th'}
                        </strong>
                      </div>
                      <div>
                        รหัสผ่าน/PIN:{' '}
                        <strong className="text-amber-300">
                          {adminAcc.adminPinOrPass || 'KORAT-ADMIN#2026'}
                        </strong>
                      </div>
                      <div className="font-sans text-[10px] text-slate-400 truncate">
                        สังกัด: {adminAcc.unitOrVillage}
                      </div>
                    </div>

                    {adminAcc.permissions && adminAcc.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {adminAcc.permissions.slice(0, 3).map((perm) => (
                          <span
                            key={perm}
                            className="text-[10px] text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                          >
                            ✓ {perm.split(' ')[0]}
                          </span>
                        ))}
                        {adminAcc.permissions.length > 3 && (
                          <span className="text-[10px] text-teal-300 font-mono-num px-1 py-0.5">
                            +{adminAcc.permissions.length - 3} สิทธิ์
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSession(adminAcc, autoSwitchMenuOnRoleChange)
                      }
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isCurrentAdmin
                          ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-200'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {isCurrentAdmin
                        ? '✓ ใช้งานบัญชีนี้อยู่'
                        : 'เข้าใช้งานบัญชีนี้'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyAdminCredentials(adminAcc)}
                      title="คัดลอกรหัสผู้ดูแลระบบ"
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white cursor-pointer"
                    >
                      {copiedAdminCredsId === (adminAcc.id || adminAcc.displayName) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomAdmin(adminAcc.id)}
                        title="ลบบัญชีผู้ดูแลระบบนี้"
                        className="p-1.5 rounded-lg border border-rose-500/40 bg-rose-950/50 text-rose-300 hover:bg-rose-600 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-Column Interactive Operational Showcase:
          Left (7 cols): Targeted Push Notification (แจ้งเตือนระบุตัวบุคคล: อสม. ประจำบ้านก่อน + ส่ง รพ.สต. ทันที)
          Right (5 cols): Offline Field Mode (โหมดทำงานออฟไลน์ในจุดอับสัญญาณ + คิว Sync อัตโนมัติ) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols: Targeted Push Notification Routing Engine */}
        <div className="lg:col-span-7 rounded-xl bg-slate-950/90 border border-rose-500/45 p-4 flex flex-col justify-between space-y-3.5">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <BellRing className="w-4 h-4 text-rose-400 animate-bounce" />
                  <span className="font-extrabold text-white">
                    ระบบแจ้งเตือนแบบระบุตัวบุคคล ({UI_LABELS.pushNotification.targetedPushTitle})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  เมื่อผู้สูงอายุล้ม ระบบยิง Push Notification ระบุตัวไปยัง <strong>1) {UI_LABELS.pushNotification.tier1VhvFirst}</strong> (เข้าช่วยใน 2 นาที) พร้อม <strong>2) {UI_LABELS.pushNotification.tier2RphImmediate}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const targetElder =
                      myAssignedElders[0] || elders[0];
                    if (targetElder) onSimulateTargetedFallAlert(targetElder);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-amber-300" />
                  <span>{UI_LABELS.pushNotification.simulateFallPush}</span>
                </button>
              </div>
            </div>

            {/* Visual 2-Tier Routing Pipeline Diagram */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-mono-num text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-bold text-rose-300">ตรวจจับการล้ม (Smart Watch)</p>
                  <p className="text-[11px] text-slate-300">
                    เซ็นเซอร์วัดแรงกระแทก &gt;3.5G + พิกัดบ้านผู้สูงอายุ
                  </p>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                  currentSession.role === 'vhv'
                    ? 'bg-emerald-950/60 border-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-mono-num text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-bold text-emerald-300">
                    แจ้ง อสม. ประจำบ้านนั้นก่อน!
                  </p>
                  <p className="text-[11px] text-slate-300">
                    ยิง LINE OA + แอป อสม. ที่อยู่ใกล้บ้านที่สุด (~200 ม.)
                  </p>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                  currentSession.role === 'rph'
                    ? 'bg-teal-950/60 border-teal-400 ring-1 ring-teal-400/50'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-teal-400 text-slate-950 font-mono-num text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-bold text-teal-300">
                    {UI_LABELS.pushNotification.tier2RphImmediate}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    เปิดเคสฉุกเฉินที่โต๊ะพยาบาล รพ.สต. พร้อมประสาน 1669
                  </p>
                </div>
              </div>
            </div>

            {/* Active Targeted Push Notifications List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {(roleHighlightedAlerts.length > 0
                ? roleHighlightedAlerts
                : targetedFallAlerts
              ).map((alert) => {
                const isTargetedToCurrentVhv =
                  currentSession.role === 'vhv' &&
                  currentSession.assignedVhvName === alert.assignedVhv;
                const matchedElder = elders.find((e) => e.id === alert.elderId);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 transition-all shadow-md ${
                      isTargetedToCurrentVhv
                        ? 'bg-emerald-950/40 border-emerald-400/80 ring-1 ring-emerald-400/30'
                        : 'bg-slate-900/95 border-rose-500/60'
                    }`}
                  >
                    {/* Header Row: Severity Badge + Elder Details + Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2 border-b border-slate-800">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-mono-num font-extrabold text-xs">
                            🚨 แรงกระแทก {alert.impactForceG}G
                          </span>
                          <h4 className="font-extrabold text-white text-sm sm:text-base">
                            {alert.elderName}{' '}
                            <span className="text-xs font-normal text-slate-300">
                              (อายุ {alert.elderAge} ปี)
                            </span>
                          </h4>
                          <span className="text-teal-300 font-semibold text-xs">
                            {alert.village} {alert.subdistrict}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                          <span>
                            🎯 <strong>ผู้รับแจ้งด่านหน้า:</strong>{' '}
                            <span className="text-emerald-300 font-bold">
                              {alert.assignedVhv}
                            </span>{' '}
                            (ห่าง ~{alert.vhvDistanceMeters} ม. · ถึงใน {alert.vhvEtaMinutes} นาที)
                          </span>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span>
                            🏥 <strong>{UI_LABELS.pushNotification.rphEscalationForward}:</strong>{' '}
                            <span className="text-teal-300 font-bold">
                              {alert.rphFacility}
                            </span>
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-mono-num text-slate-300 shrink-0">
                        {alert.createdAt}
                      </span>
                    </div>

                    {/* Dual Status Track: Assigned VHV Status + RPH Facility Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* VHV Action Track */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5">
                        <div>
                          <span className="text-slate-300 block text-[11px] mb-0.5">
                            สถานะ อสม. ประจำบ้าน ({alert.assignedVhv}):
                          </span>
                          <span
                            className={`font-bold leading-tight ${
                              alert.vhvStatus === 'vhv_on_scene'
                                ? 'text-emerald-400'
                                : alert.vhvStatus === 'vhv_accepted_enroute'
                                ? 'text-amber-300'
                                : 'text-rose-300'
                            }`}
                          >
                            {alert.vhvStatus === 'vhv_on_scene'
                              ? `✓ ถึงบ้านผู้สูงอายุแล้ว (${alert.vhvRespondedAt})`
                              : alert.vhvStatus === 'vhv_accepted_enroute'
                              ? `กำลังเดินทางเข้าบ้าน (${alert.vhvRespondedAt})`
                              : 'ส่ง Push แจ้งเตือนแล้ว · รอ อสม. กดรับเคส'}
                          </span>
                        </div>

                        {alert.vhvStatus !== 'vhv_on_scene' && (
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date().toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              onUpdateTargetedAlertStatus(alert.id, {
                                vhvStatus:
                                  alert.vhvStatus === 'notified_push'
                                    ? 'vhv_accepted_enroute'
                                    : 'vhv_on_scene',
                                vhvRespondedAt: `${now} น.`,
                              });
                            }}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold whitespace-nowrap cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300"
                          >
                            {alert.vhvStatus === 'notified_push'
                              ? 'อสม. กดรับเคสเข้าช่วยเหลือ'
                              : 'อสม. ยืนยันถึงบ้านแล้ว'}
                          </button>
                        )}
                      </div>

                      {/* RPH Action Track */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5">
                        <div>
                          <span className="text-slate-300 block text-[11px] mb-0.5">
                            สถานะ {alert.rphFacility} (รับเรื่องพร้อมกัน):
                          </span>
                          <span
                            className={`font-bold leading-tight ${
                              alert.rphStatus === 'ems_dispatched'
                                ? 'text-emerald-400'
                                : 'text-teal-300'
                            }`}
                          >
                            {alert.rphStatus === 'ems_dispatched'
                              ? `✓ รพ.สต. ประสานรถกู้ชีพแล้ว (${alert.rphRespondedAt})`
                              : '✓ ส่งเรื่องถึง รพ.สต. ทันที · เตรียมระบบ 1669'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {alert.rphStatus !== 'ems_dispatched' && (
                            <button
                              type="button"
                              onClick={() => {
                                const now = new Date().toLocaleTimeString('th-TH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                                onUpdateTargetedAlertStatus(alert.id, {
                                  rphStatus: 'ems_dispatched',
                                  rphRespondedAt: `${now} น.`,
                                });
                                if (matchedElder) {
                                  onCreateReferral(matchedElder);
                                }
                              }}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold whitespace-nowrap cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-teal-300"
                            >
                              รพ.สต. สั่งการ/ส่งต่อ
                            </button>
                          )}
                          {matchedElder && (
                            <button
                              type="button"
                              onClick={() => onOpenSmartWatchSos(matchedElder)}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-500/80 bg-rose-950 text-rose-200 hover:bg-rose-600 hover:text-white font-extrabold whitespace-nowrap cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
                            >
                              SOS 1669
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Offline Field Mode & Auto/Manual Cloud Sync */}
        <div
          className={`lg:col-span-5 rounded-xl border p-4 flex flex-col justify-between space-y-3.5 transition-colors ${
            isOfflineMode
              ? 'bg-amber-950/30 border-amber-400/80 shadow-lg'
              : 'bg-slate-950/90 border-slate-700/90'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isOfflineMode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  }`}
                >
                  {isOfflineMode ? (
                    <WifiOff className="w-4 h-4" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-extrabold text-white">
                      โหมดทำงานออฟไลน์ (Offline-First Field Mode)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    บันทึกข้อมูลเยี่ยมบ้านในจุดอับสัญญาณลงเครื่องก่อน แล้วค่อยกด Sync เมื่อมีอินเทอร์เน็ต
                  </p>
                </div>
              </div>

              {/* Toggle Online / Offline Mode Button */}
              <button
                type="button"
                onClick={() => onToggleOfflineMode()}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                  isOfflineMode
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-slate-800 border border-slate-600 text-slate-200 hover:border-amber-400 hover:text-amber-200'
                }`}
              >
                {isOfflineMode
                  ? '📡 สถานะ: จุดอับสัญญาณ (Offline)'
                  : 'จำลองเข้าจุดอับสัญญาณ (Offline)'}
              </button>
            </div>

            {/* Offline Queue Status & Sync Trigger */}
            <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOfflineMode ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-bold text-slate-200">
                    {UI_LABELS.offlineSync.localQueuePending}:{' '}
                    <strong className="text-amber-300 font-mono-num">
                      {offlineQueue.length} รายการ
                    </strong>
                  </span>
                </div>

                {lastSyncedAt && (
                  <span className="text-[11px] font-mono-num text-emerald-300">
                    ✓ Sync ล่าสุด: {lastSyncedAt}
                  </span>
                )}
              </div>

              {/* Queued Offline Items Preview */}
              {offlineQueue.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="truncate">
                        <span className="font-bold text-amber-200">
                          [รอ Sync] {item.elderName}
                        </span>
                        <span className="text-slate-300 ml-1.5">· {item.summary}</span>
                      </div>
                      <span className="text-slate-400 shrink-0">{item.vhvName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  ข้อมูลทั้งหมดถูกซิงก์ขึ้นฐานข้อมูลกลาง รพ.สต. เรียบร้อยแล้ว สามารถเปิดโหมดจุดอับสัญญาณเพื่อทดสอบบันทึกข้อมูลออฟไลน์ได้ทันที
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOfflineFormExpanded((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg border border-amber-400/70 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>
                    {isOfflineFormExpanded
                      ? 'ซ่อนฟอร์มบันทึกออฟไลน์'
                      : 'บันทึกเยี่ยมบ้านในจุดอับสัญญาณ'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onSyncOfflineQueue}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <CloudUpload
                    className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`}
                  />
                  <span>
                    {isSyncing
                      ? 'กำลัง Sync ขึ้น รพ.สต. ...'
                      : `มีสัญญาณเน็ต → Sync ข้อมูลทันที (${offlineQueue.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Expandable Quick Offline Field Recording Form */}
            {isOfflineFormExpanded && (
              <form
                onSubmit={handleSubmitQuickOfflineRecord}
                className="p-3 rounded-xl bg-slate-900 border border-amber-400/60 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-200 flex items-center gap-1.5">
                    <CloudOff className="w-3.5 h-3.5 text-amber-300" />
                    ฟอร์มบันทึกเยี่ยมบ้านแบบ Offline (เก็บในเครื่องอัตโนมัติ)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      เลือกผู้สูงอายุที่เยี่ยมบ้าน:
                    </label>
                    <select
                      value={selectedOfflineElderId}
                      onChange={(e) => setSelectedOfflineElderId(e.target.value)}
                      className="w-full py-1.5 px-2 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      {elders.map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.name} ({el.village})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        SBP
                      </label>
                      <input
                        type="number"
                        value={offlineSbp}
                        onChange={(e) => setOfflineSbp(Number(e.target.value))}
                        className="w-full py-1.5 px-2 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        DBP
                      </label>
                      <input
                        type="number"
                        value={offlineDbp}
                        onChange={(e) => setOfflineDbp(Number(e.target.value))}
                        className="w-full py-1.5 px-2 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        น้ำหนัก
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={offlineWeight}
                        onChange={(e) => setOfflineWeight(Number(e.target.value))}
                        className="w-full py-1.5 px-2 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={offlineNote}
                    onChange={(e) => setOfflineNote(e.target.value)}
                    placeholder="บันทึกอาการ / การเยี่ยมบ้านในจุดอับสัญญาณ..."
                    className="w-full py-1.5 px-2.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    บันทึกข้อมูลลงคิว Offline ทันที
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Easy Senior-Friendly Login Modal for VHV / RPH / Caregiver */}
      {isLoginModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="หน้าเข้าสู่ระบบที่ง่ายและไม่ซับซ้อนสำหรับ อสม. และเจ้าหน้าที่ รพ.สต."
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border-2 border-teal-500/70 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div>
                <p className="text-xs font-bold text-teal-300">
                  SENIOR-FRIENDLY AUTHENTICATION &amp; ROLE SWITCHER
                </p>
                <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                  เข้าสู่ระบบแบบง่ายสำหรับ อสม. / เจ้าหน้าที่ รพ.สต. / ญาติผู้ดูแล
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  ออกแบบพิเศษสำหรับพี่ป้าน้าอา อสม. ในชุมชน ไม่ต้องจำรหัสผ่านซับซ้อน เลือกใช้เบอร์โทรศัพท์ + OTP, สแกนบัตร QR Code หรือกดเข้าผ่าน LINE OA ได้ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Select User Role */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200">
                  1. เลือกบทบาทผู้ใช้งาน (Select Role):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginModalOpen(false);
                    setIsCreateAdminModalOpen(true);
                  }}
                  className="text-xs font-extrabold text-rose-300 hover:text-white underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ สร้างบัญชีผู้ดูแลระบบใหม่ (Create Account for ADMIN)</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'admin' as UserRole,
                    title: 'ผู้ดูแลระบบ (ADMIN)',
                    desc: 'สิทธิ์สูงสุด จัดการบัญชีผู้ใช้ & ควบคุมทั้ง 25 ตำบล',
                  },
                  {
                    id: 'vhv' as UserRole,
                    title: 'อสม. ประจำหมู่บ้าน',
                    desc: 'รับแจ้งเตือนบ้านที่รับผิดชอบ & เยี่ยมบ้าน Offline',
                  },
                  {
                    id: 'rph' as UserRole,
                    title: 'เจ้าหน้าที่ รพ.สต.',
                    desc: 'ศูนย์สั่งการ รพ.สต. ประเมินคลินิก & ส่งต่อแพทย์',
                  },
                  {
                    id: 'elderly' as UserRole,
                    title: 'ญาติ / ผู้ดูแลผู้สูงอายุ',
                    desc: 'ติดตามสัญญาณชีพและรับแจ้งเตือนเหตุฉุกเฉิน',
                  },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedLoginRole(r.id);
                      if (r.id === 'admin') {
                        setLoginTab('admin_login');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedLoginRole === r.id
                        ? r.id === 'admin'
                          ? 'bg-rose-500/20 border-rose-400 ring-1 ring-rose-400'
                          : 'bg-teal-500/20 border-teal-400 ring-1 ring-teal-400'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-sm font-extrabold text-white">{r.title}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Easy Login Method */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                2. เลือกวิธีเข้าสู่ระบบที่สะดวกที่สุด:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  {
                    id: 'admin_login' as const,
                    label: 'บัญชี ADMIN',
                    icon: ShieldCheck,
                  },
                  {
                    id: 'phone_otp' as const,
                    label: 'เบอร์โทร + OTP',
                    icon: Smartphone,
                  },
                  {
                    id: 'qr_scan' as const,
                    label: 'สแกน QR Code',
                    icon: QrCode,
                  },
                  {
                    id: 'line_oa' as const,
                    label: 'ผ่าน LINE OA',
                    icon: MessageCircle,
                  },
                  {
                    id: 'rph_id' as const,
                    label: 'รหัส รพ.สต.',
                    icon: KeyRound,
                  },
                ].map((tab) => {
                  const IconComp = tab.icon;
                  const isTabActive = loginTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={isTabActive}
                      onClick={() => setLoginTab(tab.id)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isTabActive
                          ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-md ring-2 ring-amber-300/80'
                          : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                      {isTabActive && (
                        <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-mono-num font-black text-amber-300">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Method Content Panel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                {loginTab === 'admin_login' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-rose-300">
                        เข้าสู่ระบบผู้ดูแลระบบ (System Administrator Login)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLoginModalOpen(false);
                          setIsCreateAdminModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ สร้างบัญชี ADMIN ใหม่</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          ชื่อผู้ใช้ / อีเมล / รหัส ADMIN:
                        </label>
                        <input
                          type="text"
                          value={adminLoginIdentifier}
                          onChange={(e) => setAdminLoginIdentifier(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono-num text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          รหัสผ่านผู้ดูแลระบบ (Admin Password / PIN):
                        </label>
                        <input
                          type="text"
                          value={adminLoginPassword}
                          onChange={(e) => setAdminLoginPassword(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-rose-500/60 text-amber-300 font-mono-num text-xs font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const matched =
                          allAdminAccounts.find(
                            (a) =>
                              a.emailOrUsername?.toLowerCase() ===
                                adminLoginIdentifier.trim().toLowerCase() ||
                              a.adminIdCode?.toLowerCase() ===
                                adminLoginIdentifier.trim().toLowerCase()
                          ) || allAdminAccounts[0];
                        handleCompleteEasyLogin(
                          'บัญชีผู้ดูแลระบบ (ADMIN Account)',
                          matched
                        );
                      }}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-md cursor-pointer"
                    >
                      เข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ (ADMIN) ทันที
                    </button>
                  </div>
                )}
                {loginTab === 'phone_otp' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          เบอร์โทรศัพท์มือถือ (10 หลัก):
                        </label>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="w-full py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono-num text-base font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          รหัส OTP 6 หลักจาก SMS:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            className="w-full py-2.5 px-3 rounded-lg bg-slate-900 border border-teal-500/70 text-teal-300 font-mono-num text-base font-extrabold tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setOtpSent(true);
                              setOtpCode('839204');
                            }}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 whitespace-nowrap cursor-pointer"
                          >
                            ขอ OTP ใหม่
                          </button>
                        </div>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center justify-between">
                        <span>
                          💬 ระบบส่งรหัส OTP <strong>{otpCode}</strong> ไปยังเบอร์ {phoneInput} แล้ว (กรอกอัตโนมัติสำหรับ อสม.)
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCompleteEasyLogin('เบอร์โทรศัพท์ + OTP')}
                      className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-sm shadow-md cursor-pointer"
                    >
                      ยืนยันรหัส OTP และเข้าสู่ระบบทันที
                    </button>
                  </div>
                )}

                {loginTab === 'qr_scan' && (
                  <div className="text-center space-y-3 py-2">
                    <div className="mx-auto w-44 h-44 rounded-2xl border-2 border-dashed border-teal-400 bg-slate-900 flex flex-col items-center justify-center p-4">
                      <QrCode
                        className={`w-20 h-20 text-teal-300 ${
                          qrScanningAnim ? 'animate-pulse scale-110' : ''
                        }`}
                      />
                      <span className="mt-2 text-[11px] font-bold text-slate-300">
                        ส่องบัตรประจำตัว อสม. / รพ.สต.
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      ไม่ต้องพิมพ์รหัสผ่าน เพียงนำบัตรประจำตัว อสม. ที่มี QR Code ส่องหน้ากล้องเพื่อเข้าสู่ระบบ
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQrScanningAnim(true);
                        setTimeout(() => {
                          setQrScanningAnim(false);
                          handleCompleteEasyLogin('สแกนบัตร QR Code');
                        }, 350);
                      }}
                      className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md cursor-pointer"
                    >
                      จำลองสแกนบัตร QR Code อสม. สำเร็จ (1-Tap Login)
                    </button>
                  </div>
                )}

                {loginTab === 'line_oa' && (
                  <div className="space-y-3 text-center py-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-xs font-bold">
                      <MessageCircle className="w-4 h-4" />
                      <span>เชื่อมต่อกับ LINE Official Account: @KoratSmartHealth</span>
                    </div>
                    <p className="text-xs text-slate-300 max-w-lg mx-auto">
                      อสม. และญาติผู้สูงอายุสามารถกดปุ่มด้านล่างเพื่อเข้าใช้งานด้วยบัญชี LINE ที่ใช้อยู่ประจำ พร้อมรับแจ้งเตือนเหตุผู้สูงอายุล้มทางแชท LINE ทันที
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCompleteEasyLogin('LINE OA')}
                      className="w-full py-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-slate-950 font-extrabold text-sm shadow-md cursor-pointer"
                    >
                      เข้าสู่ระบบด่วนด้วย LINE OA (คลิกเดียวไม่ต้องจำรหัส)
                    </button>
                  </div>
                )}

                {loginTab === 'rph_id' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300">
                      เลือกบัญชีผู้ใช้งานตัวอย่างเพื่อเข้าสู่ระบบและทดสอบสิทธิ์ทันที:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        ...allAdminAccounts,
                        ...PRESET_ROLE_PROFILES.rph,
                        ...PRESET_ROLE_PROFILES.vhv,
                        ...PRESET_ROLE_PROFILES.elderly,
                      ].map((prof) => (
                        <button
                          key={prof.id || prof.displayName}
                          type="button"
                          onClick={() =>
                            handleCompleteEasyLogin(prof.loginMethod, prof)
                          }
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-teal-400 text-left transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-extrabold text-white">
                            {prof.displayName}
                          </p>
                          <p className="text-[11px] text-teal-300">
                            {prof.roleBadgeLabel}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {prof.unitOrVillage} · {prof.loginMethod}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated "Create Account for ADMIN" (สร้างบัญชีผู้ดูแลระบบใหม่) Modal */}
      {isCreateAdminModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={UI_LABELS.actions.createNewAdmin}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border-2 border-blue-500/80 p-5 sm:p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400 text-blue-300 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-mono-num font-extrabold text-blue-300 uppercase tracking-wider">
                    SYSTEM ADMINISTRATOR PROVISIONING
                  </p>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                    {UI_LABELS.actions.createNewAdmin}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    กำหนดชื่อบัญชี รหัสประจำตัวแอดมิน รหัสผ่าน และชุดสิทธิ์การควบคุมระบบเฝ้าระวังสุขภาพผู้สูงอายุระดับอำเภอ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateAdminModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminAccountSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    ชื่อ-นามสกุล / ชื่อแสดงผลผู้ดูแลระบบ <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="เช่น ดร.ฐิติวัสส์ (System Admin) หรือ ผอ.รพ.สต."
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    อีเมล / ชื่อผู้ใช้ล็อกอิน (Admin Username / Email) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="เช่น admin.korat@moph.go.th หรือ thitiwas.k@nrru.ac.th"
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono-num focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    รหัสประจำตัวผู้ดูแลระบบ (Admin ID Code)
                  </label>
                  <input
                    type="text"
                    value={newAdminIdCode}
                    onChange={(e) => setNewAdminIdCode(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-rose-300 font-mono-num font-bold focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    รหัสผ่าน / Security Key (Password / PIN)
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="w-full py-2.5 pl-3 pr-8 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono-num font-bold focus:outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((p) => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showAdminPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateAdminPassword}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold whitespace-nowrap cursor-pointer"
                    >
                      สุ่มรหัสปลอดภัย
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    หน่วยงานต้นสังกัด (Organization / Command Unit)
                  </label>
                  <input
                    type="text"
                    value={newAdminUnit}
                    onChange={(e) => setNewAdminUnit(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">
                    เบอร์โทรศัพท์ติดต่อศูนย์สั่งการ
                  </label>
                  <input
                    type="tel"
                    value={newAdminPhone}
                    onChange={(e) => setNewAdminPhone(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono-num focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Admin Privilege Tier Selector */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-200">
                  ระดับสิทธิ์ผู้ดูแลระบบ (Admin Privilege Tier):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'super_admin' as const,
                      title: 'Super Admin (สิทธิ์สูงสุด)',
                      desc: 'ควบคุมทุกโมดูล จัดการผู้ใช้ & ตั้งค่าระบบทั้งหมด',
                    },
                    {
                      id: 'district_admin' as const,
                      title: 'District Health Admin',
                      desc: 'ผู้บริหารระดับอำเภอ กำกับดูแล รพ.สต. 25 ตำบล',
                    },
                    {
                      id: 'research_admin' as const,
                      title: 'Research & AI Admin',
                      desc: 'ผู้ดูแลระบบวิจัย SSSRFE & เกณฑ์ความเสี่ยง AI',
                    },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setNewAdminTier(tier.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newAdminTier === tier.id
                          ? 'bg-rose-500/20 border-rose-400 ring-1 ring-rose-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-extrabold text-white">{tier.title}</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Permissions Checkboxes */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-200">
                  กำหนดชุดสิทธิ์การเข้าถึง (Admin Capabilities &amp; Permissions):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_ADMIN_PERMISSIONS.map((perm) => {
                    const checked = newAdminPermissions.includes(perm);
                    return (
                      <label
                        key={perm}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-slate-950 border-teal-500/60 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleAdminPermission(perm)}
                          className="accent-rose-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-medium">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateAdminModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:text-white font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ยืนยัน{UI_LABELS.actions.createAdminAccount} และเข้าสู่ระบบทันที</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
