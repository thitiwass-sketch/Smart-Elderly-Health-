import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Info,
  Pill,
  Share2,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ElderProfile,
  MedicationAdherenceLogEvent,
  MedicationAlarmConfig,
  MedicationScheduleItem,
  MedicationSlotTime,
} from '../types/health';
import {
  playConfirmationSuccessTone,
  playMedicationAlarmChime,
  requestPushNotificationPermission,
  triggerBrowserPushNotification,
} from '../utils/alarmAudioUtils';
import { generateMedicationSupplementTimeline } from '../utils/riskEngine';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';

interface SmartMedicationAlarmProps {
  elder: ElderProfile;
  onRecordMedicationTaken: (
    elderId: string,
    logEvent: MedicationAdherenceLogEvent
  ) => void;
  onUndoMedicationTaken?: (elderId: string, logId: string) => void;
}

const STORAGE_ALARM_PREFIX = 'smart_elder_alarm_configs_';
const STORAGE_LOGS_PREFIX = 'smart_elder_med_adherence_logs_';

export const SmartMedicationAlarm: React.FC<SmartMedicationAlarmProps> = ({
  elder,
  onRecordMedicationTaken,
  onUndoMedicationTaken,
}) => {
  // Generate medication & supplement items for the current elder from risk engine
  const timelineProfile = useMemo(
    () => generateMedicationSupplementTimeline(elder),
    [elder]
  );
  const items = timelineProfile.items;

  // Local storage keys
  const alarmConfigKey = `${STORAGE_ALARM_PREFIX}${elder.id}`;
  const localLogsKey = `${STORAGE_LOGS_PREFIX}${elder.id}`;

  // Alarm configurations map: [medicationId] -> MedicationAlarmConfig
  const [alarmConfigs, setAlarmConfigs] = useState<Record<string, MedicationAlarmConfig>>(() => {
    try {
      const saved = localStorage.getItem(alarmConfigKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    // Default: Enable push alarms for all items, especially high risk
    const defaults: Record<string, MedicationAlarmConfig> = {};
    items.forEach((item) => {
      defaults[item.id] = {
        id: `ALARM-${item.id}`,
        elderId: elder.id,
        medicationId: item.id,
        slotTime: item.slotTime,
        slotPeriodLabel: item.slotPeriodLabel,
        pushEnabled: true,
        soundEnabled: true,
        speechReminderEnabled: true,
        leadTimeMinutes: 0,
        customReminderNote: item.dosageText,
        updatedAt: new Date().toISOString(),
      };
    });
    return defaults;
  });

  // Local adherence logs for today
  const [adherenceLogs, setAdherenceLogs] = useState<MedicationAdherenceLogEvent[]>(() => {
    try {
      const saved = localStorage.getItem(localLogsKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return elder.medicationAdherenceLogs || [];
  });

  // UI state
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [activeSpeechItemId, setActiveSpeechItemId] = useState<string | null>(null);
  const [testedItemId, setTestedItemId] = useState<string | null>(null);
  const [justConfirmedId, setJustConfirmedId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [loggingRole, setLoggingRole] = useState<'elder_self' | 'caregiver' | 'vhv'>('elder_self');
  const [showConfigDetails, setShowConfigDetails] = useState(false);

  // Sync state when switching elders
  useEffect(() => {
    try {
      const savedAlarms = localStorage.getItem(`${STORAGE_ALARM_PREFIX}${elder.id}`);
      if (savedAlarms) {
        setAlarmConfigs(JSON.parse(savedAlarms));
      } else {
        const defaults: Record<string, MedicationAlarmConfig> = {};
        items.forEach((item) => {
          defaults[item.id] = {
            id: `ALARM-${item.id}`,
            elderId: elder.id,
            medicationId: item.id,
            slotTime: item.slotTime,
            slotPeriodLabel: item.slotPeriodLabel,
            pushEnabled: true,
            soundEnabled: true,
            speechReminderEnabled: true,
            leadTimeMinutes: 0,
            customReminderNote: item.dosageText,
            updatedAt: new Date().toISOString(),
          };
        });
        setAlarmConfigs(defaults);
      }

      const savedLogs = localStorage.getItem(`${STORAGE_LOGS_PREFIX}${elder.id}`);
      if (savedLogs) {
        setAdherenceLogs(JSON.parse(savedLogs));
      } else if (elder.medicationAdherenceLogs) {
        setAdherenceLogs(elder.medicationAdherenceLogs);
      } else {
        setAdherenceLogs([]);
      }
    } catch {
      // Ignore parse errors
    }
    setActiveSpeechItemId(null);
    setJustConfirmedId(null);
  }, [elder.id, items]);

  // Save alarm configs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(alarmConfigKey, JSON.stringify(alarmConfigs));
    } catch {
      // Ignore
    }
  }, [alarmConfigs, alarmConfigKey]);

  // Save adherence logs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(localLogsKey, JSON.stringify(adherenceLogs));
    } catch {
      // Ignore
    }
  }, [adherenceLogs, localLogsKey]);

  // Check browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter logs for today
  const todayLogs = useMemo(() => {
    return adherenceLogs.filter((log) => log.takenDate === todayStr);
  }, [adherenceLogs, todayStr]);

  // Map of medicationId -> latest today's log
  const takenTodayMap = useMemo(() => {
    const map: Record<string, MedicationAdherenceLogEvent> = {};
    todayLogs.forEach((log) => {
      map[log.medicationId] = log;
    });
    return map;
  }, [todayLogs]);

  // Calculate adherence statistics
  const totalMedCount = items.length;
  const takenCount = Object.keys(takenTodayMap).length;
  const adherenceRatePercent =
    totalMedCount > 0 ? Math.round((takenCount / totalMedCount) * 100) : 100;

  // Handle requesting browser push permission
  const handleRequestPush = async () => {
    const perm = await requestPushNotificationPermission();
    setBrowserPermission(perm);
    if (perm === 'granted') {
      triggerBrowserPushNotification('เปิดระบบแจ้งเตือนทานยาสำเร็จ 🔔', {
        body: `ระบบจะส่งสัญญาณเตือนทานยาและวิตามินของ ${elder.name} เมื่อถึงเวลาที่กำหนด`,
      });
      playMedicationAlarmChime();
    }
  };

  // Toggle Push Notification for a specific medication
  const handleToggleAlarm = (item: MedicationScheduleItem) => {
    setAlarmConfigs((prev) => {
      const current = prev[item.id] || {
        id: `ALARM-${item.id}`,
        elderId: elder.id,
        medicationId: item.id,
        slotTime: item.slotTime,
        slotPeriodLabel: item.slotPeriodLabel,
        pushEnabled: false,
        soundEnabled: true,
        speechReminderEnabled: true,
        leadTimeMinutes: 0,
        updatedAt: new Date().toISOString(),
      };
      const updated = {
        ...current,
        pushEnabled: !current.pushEnabled,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        [item.id]: updated,
      };
    });

    // If enabling and permission is default, ask for it
    if (!alarmConfigs[item.id]?.pushEnabled && browserPermission === 'default') {
      handleRequestPush();
    }
  };

  // Toggle lead time for notification
  const handleChangeLeadTime = (itemId: string, minutes: number) => {
    setAlarmConfigs((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          leadTimeMinutes: minutes,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  // Enable/Disable All Alarms
  const handleSetAllAlarms = (enable: boolean) => {
    setAlarmConfigs((prev) => {
      const updated: Record<string, MedicationAlarmConfig> = {};
      items.forEach((item) => {
        const existing = prev[item.id];
        updated[item.id] = {
          ...(existing || {
            id: `ALARM-${item.id}`,
            elderId: elder.id,
            medicationId: item.id,
            slotTime: item.slotTime,
            slotPeriodLabel: item.slotPeriodLabel,
            soundEnabled: true,
            speechReminderEnabled: true,
            leadTimeMinutes: 0,
          }),
          pushEnabled: enable,
          updatedAt: new Date().toISOString(),
        };
      });
      return updated;
    });

    if (enable && browserPermission === 'default') {
      handleRequestPush();
    }
  };

  // Enable High-Risk Missed Dose Alarms Only
  const handleSetHighRiskAlarmsOnly = () => {
    setAlarmConfigs((prev) => {
      const updated: Record<string, MedicationAlarmConfig> = {};
      items.forEach((item) => {
        const existing = prev[item.id];
        const isHighRisk = item.missedDoseFlagged || item.itemType === 'prescription_med';
        updated[item.id] = {
          ...(existing || {
            id: `ALARM-${item.id}`,
            elderId: elder.id,
            medicationId: item.id,
            slotTime: item.slotTime,
            slotPeriodLabel: item.slotPeriodLabel,
            soundEnabled: true,
            speechReminderEnabled: true,
            leadTimeMinutes: 0,
          }),
          pushEnabled: isHighRisk,
          updatedAt: new Date().toISOString(),
        };
      });
      return updated;
    });

    if (browserPermission === 'default') {
      handleRequestPush();
    }
  };

  // Test Alarm Sound, Push & Thai Voice TTS for a medication
  const handleTestAlarm = (item: MedicationScheduleItem) => {
    setTestedItemId(item.id);
    playMedicationAlarmChime();

    // Trigger web notification
    triggerBrowserPushNotification(
      `🔔 แจ้งเตือนมื้อยา: ${item.name} (${item.slotTime} น.)`,
      {
        body: `ถึงเวลาทานยา ${item.thaiClinicalName}. ขนาดยา: ${item.dosageText}`,
      }
    );

    // Multimodal Thai speech narration
    setActiveSpeechItemId(item.id);
    const speechText = `กริ๊งเตือนค่ะ! ถึงเวลารับประทานยา ${item.thaiClinicalName} ขนาด ${item.dosageText} แล้วค่ะ กรุณาดื่มน้ำตามหนึ่งแก้วนะคะ`;
    speakThaiText(
      speechText,
      () => {
        setActiveSpeechItemId(null);
        setTestedItemId(null);
      },
      () => {
        setActiveSpeechItemId(null);
        setTestedItemId(null);
      }
    );
  };

  const handleStopSpeech = () => {
    stopSpeakingThai();
    setActiveSpeechItemId(null);
    setTestedItemId(null);
  };

  // Confirm Taken action
  const handleConfirmTaken = (item: MedicationScheduleItem) => {
    const now = new Date();
    const takenTimeStr = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Determine status (on-time or delayed)
    const [slotHour, slotMin] = item.slotTime.split(':').map(Number);
    const scheduledMinutes = slotHour * 60 + slotMin;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = currentMinutes - scheduledMinutes;

    let status: 'taken_on_time' | 'taken_delayed' | 'taken_early' = 'taken_on_time';
    if (diff > 90) {
      status = 'taken_delayed';
    } else if (diff < -45) {
      status = 'taken_early';
    }

    const roleLabel =
      loggingRole === 'elder_self'
        ? 'ผู้สูงอายุบันทึกเอง'
        : loggingRole === 'caregiver'
        ? 'ผู้ดูแลบันทึกแทน'
        : 'อสม. ยืนยันขณะเยี่ยมบ้าน';

    const newLogEvent: MedicationAdherenceLogEvent = {
      id: `MEDLOG-${Date.now()}-${item.id}`,
      elderId: elder.id,
      elderName: elder.name,
      medicationId: item.id,
      medicationName: item.name,
      dosageText: item.dosageText,
      scheduledTime: item.slotTime,
      scheduledPeriodLabel: item.slotPeriodLabel,
      takenAtTime: `${takenTimeStr} น.`,
      takenDate: todayStr,
      status,
      loggedBy: loggingRole,
      loggedByLabel: roleLabel,
      notes: `${item.indication} · ${item.mealRelationLabel}`,
      verified: true,
    };

    // Update state
    setAdherenceLogs((prev) => [newLogEvent, ...prev]);
    setJustConfirmedId(item.id);

    // Audio & Voice feedback
    playConfirmationSuccessTone();
    speakThaiText(
      `บันทึกว่ารับประทานยา ${item.name} เรียบร้อยแล้วค่ะ สุขภาพแข็งแรงนะคะ`,
      () => setJustConfirmedId(null),
      () => setJustConfirmedId(null)
    );

    // Propagate to parent to update health history timeline
    onRecordMedicationTaken(elder.id, newLogEvent);
  };

  // Undo confirmation
  const handleUndoTaken = (item: MedicationScheduleItem) => {
    const existingLog = takenTodayMap[item.id];
    if (!existingLog) return;

    setAdherenceLogs((prev) => prev.filter((log) => log.id !== existingLog.id));
    if (onUndoMedicationTaken) {
      onUndoMedicationTaken(elder.id, existingLog.id);
    }
  };

  // Copy today's adherence summary for LINE / Caregiver
  const handleCopySummary = () => {
    const textLines = [
      `💊 บันทึกการทานยาของ: ${elder.name} (${elder.subdistrict})`,
      `📅 ประจำวันที่: ${todayStr}`,
      `📊 ผลความสม่ำเสมอ: ${takenCount}/${totalMedCount} มื้อ (${adherenceRatePercent}%)`,
      `----------------------------`,
      ...items.map((item) => {
        const log = takenTodayMap[item.id];
        const statusText = log ? `✅ ทานแล้วเมื่อ ${log.takenAtTime}` : `⏳ ยังไม่ได้ทาน`;
        return `• [${item.slotTime} น.] ${item.name} (${item.dosageText}) -> ${statusText}`;
      }),
      `----------------------------`,
      `🏥 เครือข่ายระบบเฝ้าระวังสุขภาพผู้สูงอายุ จ.นครราชสีมา (NRRU)`,
    ];
    const fullText = textLines.join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Main Alarm Control Panel */}
      <div className="bg-slate-900 border border-teal-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <BellRing className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    นาฬิกาปลุกเตือนทานยาอัจฉริยะ (Smart Medication Alarm)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-950 text-teal-300 border border-teal-500/40">
                    Push-Notification & Voice
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  ตั้งเวลาแจ้งเตือนรายมื้อ พร้อมเสียงสังเคราะห์ภาษาไทย และบันทึกประวัติการทานยาเข้าสู่ไทม์ไลน์สุขภาพของ {elder.name} ทันที
                </p>
              </div>
            </div>
          </div>

          {/* Adherence Rate Mini Card */}
          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-700/80 rounded-xl p-3 px-4 shrink-0">
            <div>
              <p className="text-[11px] font-semibold text-slate-400">
                ความสม่ำเสมอวันนี้ (Daily Adherence)
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white font-mono-num">
                  {takenCount}/{totalMedCount}
                </span>
                <span className="text-xs font-bold text-slate-400">มื้อ</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    adherenceRatePercent === 100
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : adherenceRatePercent >= 50
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {adherenceRatePercent}%
                </span>
              </div>
            </div>

            <div className="w-12 h-12 relative flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  className={
                    adherenceRatePercent === 100
                      ? 'text-emerald-400'
                      : adherenceRatePercent >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 - (125.6 * adherenceRatePercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-[11px] font-extrabold text-white">
                {takenCount}
              </span>
            </div>
          </div>
        </div>

        {/* Push Notification Permission & Status Bar */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                browserPermission === 'granted'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : browserPermission === 'denied'
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <div className="text-xs">
              <span className="font-bold text-white">
                สถานะการแจ้งเตือน Push Notification:{' '}
              </span>
              {browserPermission === 'granted' ? (
                <span className="text-emerald-400 font-semibold">
                  เปิดใช้งานบนอุปกรณ์นี้แล้ว (พร้อมส่งเสียงเตือนและป๊อปอัป)
                </span>
              ) : browserPermission === 'denied' ? (
                <span className="text-rose-400 font-semibold">
                  ถูกปิดกั้นในการตั้งค่าบราวเซอร์ (ยังสามารถใช้ระบบเสียงแจ้งเตือนและระบบอ่านภาษาไทยได้)
                </span>
              ) : (
                <span className="text-amber-300 font-semibold">
                  ยังไม่ได้อนุญาตการแจ้งเตือนบนเบราว์เซอร์
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {browserPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestPush}
                className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>อนุญาตการแจ้งเตือน</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSetAllAlarms(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              เปิดเตือนทุกมื้อ
            </button>

            <button
              type="button"
              onClick={handleSetHighRiskAlarmsOnly}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              เฉพาะมื้อเสี่ยงลืม
            </button>

            <button
              type="button"
              onClick={() => handleSetAllAlarms(false)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="ปิดการแจ้งเตือนทั้งหมด"
            >
              <BellOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Role Selector for Logging */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-semibold text-white">ผู้กดยืนยันการทานยา:</span>
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setLoggingRole('elder_self')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  loggingRole === 'elder_self'
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ผู้สูงอายุเอง ({elder.name.split(' ')[0]})
              </button>
              <button
                type="button"
                onClick={() => setLoggingRole('caregiver')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  loggingRole === 'caregiver'
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ผู้ดูแล / บุตรหลาน
              </button>
              <button
                type="button"
                onClick={() => setLoggingRole('vhv')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  loggingRole === 'vhv'
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                อสม. ประจำบ้าน
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-teal-400" />
              <span>{copiedSummary ? 'คัดลอกสรุปแล้ว ✓' : 'แชร์สรุปทานยาเข้า LINE'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigDetails((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>{showConfigDetails ? 'ซ่อนตั้งค่าเตือนล่วงหน้า' : 'ตั้งค่าเตือนล่วงหน้า'}</span>
            </button>
          </div>
        </div>

        {/* Global Speaking Notice */}
        {activeSpeechItemId && (
          <div className="mt-4 p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-xs text-amber-200 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                กำลังเล่นเสียงสังเคราะห์ภาษาไทย: เตือนรับประทานยาประจำมื้อ...
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopSpeech}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer"
            >
              หยุดเสียง
            </button>
          </div>
        )}

        {/* List of Medications with Scheduled Times */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>รายการยาและวิตามินตามตารางเวลาประจำวัน ({items.length} รายการ)</span>
            </h3>
            <span className="text-xs text-slate-400">
              สถานะ: วันนี้ {todayStr}
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const config = alarmConfigs[item.id] || {
                id: `ALARM-${item.id}`,
                elderId: elder.id,
                medicationId: item.id,
                slotTime: item.slotTime,
                slotPeriodLabel: item.slotPeriodLabel,
                pushEnabled: true,
                soundEnabled: true,
                speechReminderEnabled: true,
                leadTimeMinutes: 0,
              };

              const isPushActive = config.pushEnabled;
              const isTaken = Boolean(takenTodayMap[item.id]);
              const logEntry = takenTodayMap[item.id];
              const isFlaggedRisk = item.missedDoseFlagged;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isTaken
                      ? 'bg-slate-950/90 border-emerald-500/40 shadow-sm'
                      : isFlaggedRisk
                      ? 'bg-slate-950 border-amber-500/40 shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Time & Medication Identity */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Scheduled Time Badge */}
                      <div className="shrink-0 flex flex-col items-center justify-center w-20 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center">
                        <span className="text-sm font-extrabold text-teal-300 font-mono-num tracking-tight">
                          {item.slotTime} น.
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 leading-tight px-1">
                          {item.slotPeriodLabel}
                        </span>
                        <span className="text-[9px] text-teal-400/80 font-mono-num mt-0.5">
                          {item.windowRange.split('–')[0]}
                        </span>
                      </div>

                      {/* Medication Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-white tracking-tight">
                            {item.name}
                          </span>

                          {item.itemType === 'prescription_med' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-500/30">
                              ยารักษาโรคเรื้อรัง
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                              วิตามิน/อาหารเสริม
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                            {item.mealRelationLabel}
                          </span>

                          {isTaken && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>ทานแล้ว ({logEntry?.takenAtTime})</span>
                            </span>
                          )}
                        </div>

                        {/* Thai clinical name & dosage instructions */}
                        <p className="text-xs font-semibold text-teal-200 mt-1">
                          {item.thaiClinicalName}
                        </p>
                        <p className="text-xs text-slate-300 mt-0.5">
                          <span className="font-semibold text-slate-200">วิธีใช้:</span>{' '}
                          {item.dosageText}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                          <span>
                            <span className="text-slate-500">ข้อบ่งใช้:</span> {item.indication}
                          </span>
                          {item.interactionOrPrecautionNote && (
                            <span className="text-slate-400 italic">
                              · {item.interactionOrPrecautionNote}
                            </span>
                          )}
                        </div>

                        {/* Risk Engine Vulnerability Notice */}
                        {isFlaggedRisk && !isTaken && (
                          <div className="mt-2 p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">มื้อนี้มีความเสี่ยงลืมสูง ({item.missedDoseProbabilityPercent}%): </span>
                              <span>{item.flagTriggerReason} — {item.caregiverMitigationAction}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions, Push Toggle & Confirm Taken Button */}
                    <div className="flex flex-wrap items-center gap-2.5 md:flex-col md:items-end shrink-0">
                      {/* Push Notification Toggle for this item */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAlarm(item)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            isPushActive ? 'bg-teal-500' : 'bg-slate-700'
                          }`}
                          role="switch"
                          aria-checked={isPushActive}
                          title={isPushActive ? 'ปิดการแจ้งเตือนมื้อนี้' : 'เปิดการแจ้งเตือนมื้อนี้'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 transition-transform ${
                              isPushActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>

                        <span
                          className={`text-xs font-semibold ${
                            isPushActive ? 'text-teal-300' : 'text-slate-400'
                          }`}
                        >
                          {isPushActive ? '🔔 เตือน Push' : '🔕 ไม่เตือน'}
                        </span>

                        {/* Test Alarm / Sound button */}
                        <button
                          type="button"
                          onClick={() => handleTestAlarm(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs transition-colors cursor-pointer flex items-center gap-1"
                          title="ทดสอบเสียงกระดิ่งและเสียงพูดภาษาไทย"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px]">ทดสอบเสียง</span>
                        </button>
                      </div>

                      {/* Lead Time Selector if detailed settings open */}
                      {showConfigDetails && isPushActive && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-300">
                          <span className="text-slate-400">เตือน:</span>
                          {[
                            { value: 0, label: 'ตรงเวลา' },
                            { value: 15, label: 'ก่อน 15น.' },
                            { value: 30, label: 'ก่อน 30น.' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleChangeLeadTime(item.id, opt.value)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                config.leadTimeMinutes === opt.value
                                  ? 'bg-teal-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 'Confirm Taken' Button — Senior-friendly Touch Target */}
                      {isTaken ? (
                        <div className="flex items-center gap-2">
                          <div className="min-h-[46px] px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>ทานแล้ว {logEntry?.takenAtTime}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUndoTaken(item)}
                            className="text-[11px] text-slate-400 hover:text-rose-300 underline cursor-pointer p-1"
                            title="แตะเพื่อยกเลิกการบันทึก"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmTaken(item)}
                          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-98 transition-all cursor-pointer"
                        >
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>✓ ยืนยันรับประทานยาแล้ว</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Health & Medication Adherence History Timeline */}
      <section className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                ไทม์ไลน์ประวัติการรับประทานยาและสุขภาพวันนี้ (Daily Adherence Timeline)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-950 text-teal-300 border border-teal-500/40">
                {todayLogs.length} บันทึก
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              บันทึกเหตุการณ์การรับประทานยาแบบเรียลไทม์ พร้อมตรวจสอบความตรงต่อเวลาและการส่งต่อข้อมูลให้ รพ.สต.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">วันที่: {todayStr}</span>
          </div>
        </div>

        {/* Progress Bar of Daily Adherence */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300">
              ความก้าวหน้าการรับประทานยาตามแผนแพทย์วันนี้:
            </span>
            <span className="font-mono-num font-bold text-teal-300">
              {takenCount} จาก {totalMedCount} รายการ ({adherenceRatePercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                adherenceRatePercent === 100
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                  : adherenceRatePercent >= 50
                  ? 'bg-gradient-to-r from-amber-500 to-teal-400'
                  : 'bg-gradient-to-r from-rose-500 to-amber-400'
              }`}
              style={{ width: `${adherenceRatePercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {adherenceRatePercent === 100
                ? '🌟 ยอดเยี่ยมมาก! รับประทานยาครบทุกมื้อตรงตามตารางเวลา'
                : adherenceRatePercent >= 50
                ? '👍 ดีมาก! กำลังดำเนินการตามแผน ควรรับประทานมื้อถัดไปให้ตรงเวลา'
                : '⚠️ ยังมีมื้อยาที่ยังไม่ได้ยืนยัน กรุณาตรวจสอบตามเวลาที่นาฬิกาปลุกแจ้งเตือน'}
            </span>
            <span className="text-slate-400">
              ความดันล่าสุด: {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp} mmHg
            </span>
          </div>
        </div>

        {/* Chronological Event Nodes */}
        <div className="mt-6">
          {todayLogs.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-dashed border-slate-800">
              <Pill className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                ยังไม่มีการบันทึกการรับประทานยาวันนี้
              </p>
              <p className="text-xs text-slate-400 mt-1">
                เมื่อถึงเวลามื้อยา หรือเมื่อรับประทานยาแล้ว ให้แตะปุ่ม{' '}
                <span className="text-teal-400 font-bold">“✓ ยืนยันรับประทานยาแล้ว”</span>{' '}
                ในรายการด้านบน ระบบจะบันทึกลงในไทม์ไลน์นี้โดยอัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-teal-500/30 space-y-4">
              {todayLogs.map((log, idx) => (
                <div key={log.id} className="relative group">
                  {/* Timeline Node Bullet */}
                  <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-teal-500 border-2 border-slate-900 shadow-md flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  </span>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {log.medicationName}
                        </span>
                        <span className="text-xs text-slate-300">
                          ({log.dosageText})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'taken_on_time'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : log.status === 'taken_delayed'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-sky-950 text-sky-300 border border-sky-500/40'
                          }`}
                        >
                          {log.status === 'taken_on_time'
                            ? 'ตรงเวลา ✓'
                            : log.status === 'taken_delayed'
                            ? 'ช้ากว่ากำหนด'
                            : 'ทานก่อนเวลา'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono-num text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-white font-semibold">
                          บันทึกเมื่อ: {log.takenAtTime}
                        </span>
                        <span>(รอบตามแผน: {log.scheduledTime} น.)</span>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500">ผู้บันทึก:</span>{' '}
                        <span className="text-slate-300 font-medium">{log.loggedByLabel}</span>
                        {log.notes && (
                          <span className="text-slate-400 ml-2">· {log.notes}</span>
                        )}
                      </div>

                      <span className="text-[11px] text-teal-400 font-medium">
                        ✓ ซิงก์เชื่อมโยงแฟ้มสุขภาพ รพ.สต. และ อสม. แล้ว
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
