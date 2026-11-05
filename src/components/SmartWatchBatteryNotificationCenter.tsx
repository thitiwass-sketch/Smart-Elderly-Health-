import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryWarning,
  BellRing,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Watch,
  Wrench,
  Zap,
} from 'lucide-react';
import { ElderProfile } from '../types/health';
import {
  ElderSmartWatchBatteryRecord,
  evaluateElderSmartWatchBattery,
} from '../utils/smartWatchBatteryUtils';

export interface ProactiveBatteryReplacementLog {
  elderId: string;
  actionType: 'vhv_dispatched' | 'battery_replaced_100';
  timestamp: string;
  assignedVhv: string;
  previousBatteryPct: number;
  note: string;
}

interface SmartWatchBatteryNotificationCenterProps {
  elders: ElderProfile[];
  batteryOverrides: Record<string, number>;
  replacementLogs: Record<string, ProactiveBatteryReplacementLog>;
  onUpdateBatteryOverride: (elderId: string, newBatteryPct: number) => void;
  onLogProactiveAction: (log: ProactiveBatteryReplacementLog) => void;
  onResetBatterySimulation: () => void;
  onSelectElder: (elder: ElderProfile) => void;
  onOpenSmartWatchMonitor?: (elder: ElderProfile) => void;
  onFilterRegistryByLowBattery?: (onlyLowBattery: boolean) => void;
  isRegistryFilteredByLowBattery?: boolean;
}

export const SmartWatchBatteryNotificationCenter: React.FC<
  SmartWatchBatteryNotificationCenterProps
> = ({
  elders,
  batteryOverrides,
  replacementLogs,
  onUpdateBatteryOverride,
  onLogProactiveAction,
  onResetBatterySimulation,
  onSelectElder,
  onOpenSmartWatchMonitor,
  onFilterRegistryByLowBattery,
  isRegistryFilteredByLowBattery = false,
}) => {
  const [filterMode, setFilterMode] = useState<
    'LOW_UNDER_20' | 'CRITICAL_OR_ALONE' | 'PENDING_ACTION' | 'ALL_SCANNED'
  >('LOW_UNDER_20');
  const [subdistrictFilter, setSubdistrictFilter] = useState<string>('ALL');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScannedAt, setLastScannedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  // Scan all registered elderly individuals for Smart Watch battery levels
  const scannedRecords = useMemo<ElderSmartWatchBatteryRecord[]>(() => {
    return elders
      .map((elder, idx) =>
        evaluateElderSmartWatchBattery(elder, idx, {
          overrideBatteryPct: batteryOverrides[elder.id],
        })
      )
      .sort((a, b) => a.batteryPct - b.batteryPct);
  }, [elders, batteryOverrides]);

  const lowBatteryRecords = useMemo(
    () => scannedRecords.filter((rec) => rec.isLowBattery),
    [scannedRecords]
  );

  const criticalOrLivingAloneLowRecords = useMemo(
    () =>
      lowBatteryRecords.filter(
        (rec) =>
          rec.isCriticalBattery ||
          rec.elder.livingArrangement === 'อยู่ลำพัง' ||
          rec.elder.riskProfile.matrixGroup === 'D'
      ),
    [lowBatteryRecords]
  );

  const pendingLowBatteryRecords = useMemo(
    () =>
      lowBatteryRecords.filter(
        (rec) => !replacementLogs[rec.elder.id]
      ),
    [lowBatteryRecords, replacementLogs]
  );

  const completedProactiveCount = useMemo(
    () => Object.keys(replacementLogs).length,
    [replacementLogs]
  );

  const availableSubdistricts = useMemo(
    () => Array.from(new Set(elders.map((e) => e.subdistrict))),
    [elders]
  );

  const visibleRecords = useMemo(() => {
    let baseList = scannedRecords;
    if (filterMode === 'LOW_UNDER_20') {
      baseList = lowBatteryRecords;
    } else if (filterMode === 'CRITICAL_OR_ALONE') {
      baseList = criticalOrLivingAloneLowRecords;
    } else if (filterMode === 'PENDING_ACTION') {
      baseList = pendingLowBatteryRecords;
    }

    if (subdistrictFilter !== 'ALL') {
      baseList = baseList.filter((rec) => rec.elder.subdistrict === subdistrictFilter);
    }

    return baseList;
  }, [
    scannedRecords,
    lowBatteryRecords,
    criticalOrLivingAloneLowRecords,
    pendingLowBatteryRecords,
    filterMode,
    subdistrictFilter,
  ]);

  const handleRunFullDeviceScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setLastScannedAt(
        new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 450);
  };

  const handleDispatchVhvForBattery = (record: ElderSmartWatchBatteryRecord) => {
    const nowTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    onLogProactiveAction({
      elderId: record.elder.id,
      actionType: 'vhv_dispatched',
      timestamp: `${nowTime} น.`,
      assignedVhv: record.elder.assignedVhv,
      previousBatteryPct: record.batteryPct,
      note: `สั่งการ ${record.elder.assignedVhv} นำแบตเตอรี่สำรอง/ชุดชาร์จเข้าเปลี่ยนเชิงรุกที่ ${record.elder.village}`,
    });
  };

  const handleConfirmBatteryReplaced = (record: ElderSmartWatchBatteryRecord) => {
    const nowTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    onUpdateBatteryOverride(record.elder.id, 100);
    onLogProactiveAction({
      elderId: record.elder.id,
      actionType: 'battery_replaced_100',
      timestamp: `${nowTime} น.`,
      assignedVhv: record.elder.assignedVhv,
      previousBatteryPct: record.batteryPct,
      note: `เปลี่ยนแบตเตอรี่ก้อนใหม่ / สลับเครื่องสำรองเรียบร้อย (จาก ${record.batteryPct}% → 100%)`,
    });
  };

  const handleDispatchAllLowBattery = () => {
    const nowTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    lowBatteryRecords.forEach((rec) => {
      if (!replacementLogs[rec.elder.id]) {
        onLogProactiveAction({
          elderId: rec.elder.id,
          actionType: 'vhv_dispatched',
          timestamp: `${nowTime} น.`,
          assignedVhv: rec.elder.assignedVhv,
          previousBatteryPct: rec.batteryPct,
          note: `สั่งการด่วนแบบกลุ่มให้ ${rec.elder.assignedVhv} เข้าเปลี่ยนแบตเตอรี่เชิงรุก (<20%)`,
        });
      }
    });
  };

  const handleSimulateNewLowBatteryDrop = () => {
    const healthyCandidate = scannedRecords.find((rec) => !rec.isLowBattery);
    if (!healthyCandidate) return;
    const simulatedLowPct = 13;
    onUpdateBatteryOverride(healthyCandidate.elder.id, simulatedLowPct);
    setFilterMode('LOW_UNDER_20');
    setLastScannedAt(
      new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  return (
    <div
      role="region"
      aria-label="ศูนย์แจ้งเตือนสถานะแบตเตอรี่ Smart Watch ต่ำกว่า 20% เพื่อการเปลี่ยนแบตเตอรี่เชิงรุก"
      className="mt-5 rounded-xl bg-slate-950/95 border-2 border-amber-500/70 p-4 sm:p-5 shadow-xl space-y-4"
    >
      {/* Top Header & Real-Time Scanner Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl border shrink-0 shadow-md ${
              lowBatteryRecords.length > 0
                ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}
          >
            {lowBatteryRecords.length > 0 ? (
              <BatteryWarning className="w-6 h-6 text-rose-400 animate-pulse" />
            ) : (
              <BatteryFull className="w-6 h-6 text-emerald-400" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono-num font-extrabold text-amber-300 uppercase tracking-wide">
                SMART WATCH BATTERY NOTIFICATION CENTER · PROACTIVE REPLACEMENT
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono-num font-bold text-rose-300">
                พบแบตเตอรี่ต่ำกว่า 20% จำนวน {lowBatteryRecords.length} จาก {elders.length} เครื่อง
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono-num text-slate-300">
                สแกนล่าสุด: {lastScannedAt} น.
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-white">
              ศูนย์แจ้งเตือนแบตเตอรี่ Smart Watch ต่ำกว่า 20% และระบบสั่งการเปลี่ยนแบตเตอรี่เชิงรุก (Proactive Battery Replacement Alert)
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              สแกนตรวจสอบระดับพลังงานนาฬิกาผู้สูงอายุที่ลงทะเบียนทั้งหมดอัตโนมัติ เพื่อแจ้งเตือนให้เจ้าหน้าที่ รพ.สต. และ อสม. นำแบตเตอรี่สำรองหรือชุดชาร์จเข้าเปลี่ยนล่วงหน้าก่อนอุปกรณ์ดับและสัญญาณชีพ/พิกัดฉุกเฉิน 1669 ขาดหาย
            </p>
          </div>
        </div>

        {/* Scanner Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunFullDeviceScan}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-lg border border-teal-400/70 bg-slate-900 hover:bg-slate-800 text-teal-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>
              {isScanning
                ? 'กำลังสแกนทุกเครื่อง...'
                : `สแกนซ้ำทั้งหมด (${elders.length} เครื่อง)`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSimulateNewLowBatteryDrop}
            className="px-3 py-1.5 rounded-lg border border-amber-400/70 bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title="จำลองเหตุการณ์แบตเตอรี่ลดต่ำกว่า 20% เพิ่มอีก 1 เครื่องเพื่อทดสอบระบบแจ้งเตือน"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>จำลองแบตต่ำ &lt;20% เพิ่ม</span>
          </button>

          {(Object.keys(batteryOverrides).length > 0 ||
            Object.keys(replacementLogs).length > 0) && (
            <button
              type="button"
              onClick={onResetBatterySimulation}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ตค่าเริ่มต้น</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Warning Alert Banner when any device has <20% battery */}
      {lowBatteryRecords.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl bg-gradient-to-r from-rose-950/90 via-amber-950/75 to-slate-900 border border-rose-500/80 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-extrabold text-rose-200">
                  คำเตือนวิกฤต (LOW BATTERY WARNING &lt; 20%):
                </span>
                <span className="font-mono-num font-bold text-amber-300">
                  ต้องเปลี่ยนแบตเตอรี่/ชาร์จเชิงรุกทันที {lowBatteryRecords.length} ราย
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="font-mono-num text-rose-200">
                  กลุ่มเสี่ยงสูง/อยู่ลำพัง {criticalOrLivingAloneLowRecords.length} ราย
                </span>
              </div>
              <p className="text-xs text-slate-100 leading-relaxed">
                พบผู้สูงอายุที่มีระดับแบตเตอรี่ Smart Watch ต่ำกว่าเกณฑ์ปลอดภัย 20% ได้แก่{' '}
                <strong className="text-amber-300">
                  {lowBatteryRecords
                    .map((r) => `${r.elder.name} (${r.batteryPct}%)`)
                    .join(', ')}
                </strong>{' '}
                หากไม่ดำเนินการเปลี่ยนแบตเตอรี่หรือชาร์จภายใน 2–5 ชั่วโมง อุปกรณ์จะดับและไม่สามารถส่งสัญญาณตรวจจับการหกล้ม (Fall Detection) มายังศูนย์ 1669 ได้
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingLowBatteryRecords.length > 0 && (
              <button
                type="button"
                onClick={handleDispatchAllLowBattery}
                className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>
                  สั่งการ อสม. เปลี่ยนแบตเชิงรุกทั้งหมด ({pendingLowBatteryRecords.length} ราย)
                </span>
              </button>
            )}

            {onFilterRegistryByLowBattery && (
              <button
                type="button"
                onClick={() => onFilterRegistryByLowBattery(!isRegistryFilteredByLowBattery)}
                className={`px-3 py-2 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isRegistryFilteredByLowBattery
                    ? 'bg-rose-600 border-rose-300 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-200 hover:border-amber-400 hover:text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {isRegistryFilteredByLowBattery
                    ? 'กำลังกรองเฉพาะแบต <20% ในตารางทะเบียน ✓'
                    : 'กรองดูเฉพาะแบต <20% ในตารางทะเบียน'}
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/60 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-emerald-200">
                อุปกรณ์ Smart Watch ของผู้สูงอายุที่ลงทะเบียนทั้งหมด ({elders.length} เครื่อง) มีระดับแบตเตอรี่อยู่ในเกณฑ์ปลอดภัย (≥ 20%)
              </p>
              <p className="text-xs text-slate-300">
                ดำเนินการเปลี่ยนแบตเตอรี่และชาร์จไฟเชิงรุกครบถ้วนแล้ว พร้อมเฝ้าระวังสัญญาณชีพและการพลัดตกหกล้มตลอด 24 ชั่วโมง
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Telemetry Summary Strips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5">
          <p className="text-[11px] font-semibold text-slate-300">
            อุปกรณ์ที่สแกนทั้งหมด (Registered Watches)
          </p>
          <p className="mt-1 text-xl font-mono-num font-extrabold text-white">
            {elders.length}{' '}
            <span className="text-xs font-sans font-normal text-slate-300">เครื่อง</span>
          </p>
          <p className="mt-0.5 text-[11px] text-teal-300 font-mono-num">
            ออนไลน์พร้อมซิงก์ 100% · พ้นขีดอันตราย {elders.length - lowBatteryRecords.length} เครื่อง
          </p>
        </div>

        <div className="rounded-xl bg-rose-950/45 border border-rose-500/60 p-3.5">
          <p className="text-[11px] font-semibold text-rose-200">
            แจ้งเตือนแบตเตอรี่ต่ำกว่า 20% (&lt;20% Alert)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-xl font-mono-num font-extrabold text-rose-400">
              {lowBatteryRecords.length}{' '}
              <span className="text-xs font-sans font-normal text-rose-200">เครื่อง</span>
            </p>
            {lowBatteryRecords.length > 0 && (
              <span className="text-[11px] font-mono-num font-bold text-amber-300">
                (ต่ำสุด {lowBatteryRecords[0].batteryPct}%)
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-rose-200">
            ต้องส่ง อสม. เปลี่ยนแบตเตอรี่/ชาร์จเชิงรุก
          </p>
        </div>

        <div className="rounded-xl bg-amber-950/35 border border-amber-500/50 p-3.5">
          <p className="text-[11px] font-semibold text-amber-200">
            เร่งด่วนสูง: แบต &lt;15% หรืออยู่ลำพัง/กลุ่ม D
          </p>
          <p className="mt-1 text-xl font-mono-num font-extrabold text-amber-300">
            {criticalOrLivingAloneLowRecords.length}{' '}
            <span className="text-xs font-sans font-normal text-amber-100">ราย</span>
          </p>
          <p className="mt-0.5 text-[11px] text-amber-200/90">
            เสี่ยงเครื่องดับขณะเกิดเหตุฉุกเฉินในผู้สูงอายุเปราะบาง
          </p>
        </div>

        <div className="rounded-xl bg-emerald-950/35 border border-emerald-500/50 p-3.5">
          <p className="text-[11px] font-semibold text-emerald-200">
            ดำเนินการเปลี่ยนแบตเตอรี่/สั่งการ อสม. แล้ว
          </p>
          <p className="mt-1 text-xl font-mono-num font-extrabold text-emerald-400">
            {completedProactiveCount}{' '}
            <span className="text-xs font-sans font-normal text-emerald-100">รายการ</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-300">
            รอดำเนินการอีก {pendingLowBatteryRecords.length} เครื่อง
          </p>
        </div>
      </div>

      {/* Filter Tabs & Subdistrict Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: 'LOW_UNDER_20' as const,
              label: `⚠️ แบตเตอรี่ต่ำกว่า 20% (${lowBatteryRecords.length})`,
            },
            {
              id: 'CRITICAL_OR_ALONE' as const,
              label: `🚨 วิกฤต <15% / อยู่ลำพัง (${criticalOrLivingAloneLowRecords.length})`,
            },
            {
              id: 'PENDING_ACTION' as const,
              label: `รอดำเนินการเปลี่ยนแบต (${pendingLowBatteryRecords.length})`,
            },
            {
              id: 'ALL_SCANNED' as const,
              label: `อุปกรณ์ที่สแกนทั้งหมด (${scannedRecords.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={subdistrictFilter}
            onChange={(e) => setSubdistrictFilter(e.target.value)}
            aria-label="กรองรายการแบตเตอรี่ตามตำบล"
            className="py-1.5 px-2.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="ALL">ทุกตำบล ({elders.length} เครื่อง)</option>
            {availableSubdistricts.map((sub) => (
              <option key={sub} value={sub}>
                ต.{sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Per-Elder Proactive Battery Replacement Cards Grid */}
      {visibleRecords.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-2">
          <p className="text-sm font-bold text-emerald-300">
            ไม่พบอุปกรณ์ที่มีแบตเตอรี่ต่ำกว่า 20% ในหมวดหมู่นี้
          </p>
          <p className="text-xs text-slate-300">
            ผู้สูงอายุทุกรายในตัวกรองนี้ได้รับการเปลี่ยนแบตเตอรี่เชิงรุกหรือมีพลังงานเพียงพอแล้ว
          </p>
          {filterMode !== 'ALL_SCANNED' && (
            <button
              type="button"
              onClick={() => setFilterMode('ALL_SCANNED')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold cursor-pointer"
            >
              ดูผลสแกนอุปกรณ์ทั้งหมด ({scannedRecords.length} เครื่อง)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {visibleRecords.map((record) => {
            const { elder } = record;
            const actionLog = replacementLogs[elder.id];
            const isLivingAlone = elder.livingArrangement === 'อยู่ลำพัง';
            const isGroupD = elder.riskProfile.matrixGroup === 'D';

            return (
              <div
                key={elder.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                  record.isLowBattery
                    ? record.isCriticalBattery
                      ? 'bg-rose-950/45 border-rose-500/85 shadow-md'
                      : 'bg-amber-950/30 border-amber-500/75'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Top Row: Elder Identity & Prominent <20% Warning Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-extrabold text-white">{elder.name}</h4>
                        <span className="text-[11px] font-mono-num text-slate-300">
                          ({elder.age} ปี)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-1">
                        <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                        <span>{elder.village}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-teal-300">ต.{elder.subdistrict}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-slate-400">{record.deviceSerial}</span>
                      </p>
                    </div>

                    {/* Battery Percentage + Warning Icon when <20% */}
                    <div
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 font-mono-num ${
                        record.isLowBattery
                          ? 'bg-rose-600 text-white border-amber-300 shadow-sm'
                          : record.batteryPct < 35
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/60'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      }`}
                      title={
                        record.isLowBattery
                          ? `คำเตือน: แบตเตอรี่ของ ${elder.name} เหลือ ${record.batteryPct}% (<20%) ต้องเปลี่ยนแบตเตอรี่เชิงรุก`
                          : `แบตเตอรี่ปกติ ${record.batteryPct}%`
                      }
                    >
                      {record.isLowBattery ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0 animate-bounce" />
                          <BatteryLow className="w-4 h-4 text-white shrink-0" />
                        </>
                      ) : record.batteryPct < 35 ? (
                        <BatteryCharging className="w-4 h-4 text-amber-300 shrink-0" />
                      ) : (
                        <BatteryFull className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span className="text-xs font-extrabold">{record.batteryPct}%</span>
                    </div>
                  </div>

                  {/* Clinical Vulnerability Context Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span
                      className={`font-mono-num font-bold ${
                        isGroupD
                          ? 'text-rose-300'
                          : elder.riskProfile.matrixGroup === 'C'
                          ? 'text-orange-300'
                          : elder.riskProfile.matrixGroup === 'B'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      กลุ่ม {elder.riskProfile.matrixGroup} ({elder.riskProfile.frailtyRisk} Risk)
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      className={
                        isLivingAlone ? 'text-rose-300 font-bold' : 'text-slate-300'
                      }
                    >
                      {elder.livingArrangement}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-300 font-mono-num">
                      โทร {elder.phone}
                    </span>
                  </div>

                  {/* Visual Battery Gauge & Telemetry Metrics */}
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          record.isLowBattery
                            ? 'text-rose-300'
                            : record.batteryPct < 35
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {record.isLowBattery && (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        )}
                        <span>{record.proactiveActionLabel}</span>
                      </span>
                      <span className="font-mono-num text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        เหลือ ~{record.estimatedHoursLeft} ชม.
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          record.isLowBattery
                            ? 'bg-gradient-to-r from-rose-600 to-amber-400'
                            : record.batteryPct < 35
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(6, record.batteryPct)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[11px] font-mono-num text-slate-300">
                      <div>
                        สุขภาพเซลล์:{' '}
                        <strong className="text-teal-300">{record.batteryHealthPct}%</strong>
                      </div>
                      <div className="text-center">
                        แรงดัน: <strong className="text-slate-100">{record.voltageVolts}V</strong>
                      </div>
                      <div className="text-right">
                        ซิงก์: <strong className="text-slate-200">{record.lastSyncMinutesAgo} นาที</strong>
                      </div>
                    </div>
                  </div>

                  {/* Service Disruption Explanation & VHV Assignment */}
                  <div className="text-xs text-slate-200 leading-relaxed space-y-1">
                    <p>{record.disruptionRiskNote}</p>
                    <p className="text-[11px] text-teal-300 flex items-center justify-between gap-2 pt-0.5">
                      <span>
                        ผู้รับผิดชอบ: <strong>{elder.assignedVhv}</strong>
                      </span>
                      <span className="text-slate-400">ผู้ดูแล: {elder.caregiverName}</span>
                    </p>
                  </div>

                  {/* Proactive Replacement Log Feedback */}
                  {actionLog && (
                    <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-[11px] text-emerald-200 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">
                          [{actionLog.timestamp}] {actionLog.note}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Proactive Battery Replacement Action Bar */}
                <div className="pt-2.5 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {record.isLowBattery ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirmBatteryReplaced(record)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                          title="บันทึกว่าเจ้าหน้าที่/อสม. ได้เปลี่ยนแบตเตอรี่ก้อนใหม่หรือสลับเครื่องสำรองเรียบร้อยแล้ว (รีเซ็ตแบตเตอรี่เป็น 100%)"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>เปลี่ยนแบตใหม่แล้ว (100%)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDispatchVhvForBattery(record)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                            actionLog?.actionType === 'vhv_dispatched'
                              ? 'bg-amber-500/20 border border-amber-400 text-amber-200'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>
                            {actionLog?.actionType === 'vhv_dispatched'
                              ? 'แจ้ง อสม. แล้ว ✓'
                              : 'สั่งการ อสม. เปลี่ยนแบต'}
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateBatteryOverride(elder.id, 14)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:border-amber-400 text-slate-300 hover:text-amber-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <BatteryLow className="w-3.5 h-3.5" />
                        <span>จำลองแบตต่ำ (14%)</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenSmartWatchMonitor && (
                      <button
                        type="button"
                        onClick={() => onOpenSmartWatchMonitor(elder)}
                        className="px-2 py-1.5 rounded-lg border border-rose-500/60 bg-slate-900 hover:bg-rose-950 text-rose-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        title="เปิดหน้าต่างมอนิเตอร์ Smart Watch SOS รายบุคคล"
                      >
                        <Watch className="w-3 h-3 text-amber-300" />
                        <span>มอนิเตอร์</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectElder(elder)}
                      className="px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-semibold cursor-pointer"
                    >
                      ดูโปรไฟล์
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
