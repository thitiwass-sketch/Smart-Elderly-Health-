import { ElderProfile } from '../types/health';

export interface ElderSmartWatchBatteryRecord {
  elder: ElderProfile;
  batteryPct: number;
  isLowBattery: boolean; // true when < 20%
  isCriticalBattery: boolean; // true when < 15%
  batteryHealthPct: number; // Long-term battery cell capacity health (82% - 98%)
  estimatedHoursLeft: number;
  voltageVolts: number;
  lastSyncMinutesAgo: number;
  deviceSerial: string;
  replacementRecommended: boolean; // true when battery < 20%
  replacementType: 'swap_battery_cell' | 'urgent_field_charge' | 'normal';
  statusLabel: string;
  disruptionRiskNote: string;
  proactiveActionLabel: string;
}

export const PRESET_SMARTWATCH_BATTERY_LEVELS: Record<string, number> = {
  'KORAT-ELD-001': 14, // < 20% Low battery warning (Group D high risk, Living Alone)
  'KORAT-ELD-002': 11, // < 20% Critical low battery (Group D high risk, Living Alone)
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

export function hashElderBatterySeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function evaluateElderSmartWatchBattery(
  elder: ElderProfile,
  index: number,
  options?: {
    overrideBatteryPct?: number;
    lowPowerModeEnabled?: boolean;
  }
): ElderSmartWatchBatteryRecord {
  const seed = hashElderBatterySeed(`${elder.id}-${elder.name}-battery`);
  const fallbackPct = index % 3 === 0 ? 12 + (seed % 7) : 35 + (seed % 60);
  const basePct =
    PRESET_SMARTWATCH_BATTERY_LEVELS[elder.id] !== undefined
      ? PRESET_SMARTWATCH_BATTERY_LEVELS[elder.id]
      : fallbackPct;

  const rawPct =
    options?.overrideBatteryPct !== undefined
      ? Math.max(1, Math.min(100, options.overrideBatteryPct))
      : basePct;

  const isLowPowerEnabled = Boolean(options?.lowPowerModeEnabled);
  const isLowBattery = rawPct < 20;
  const isCriticalBattery = rawPct < 15;
  const batteryHealthPct = isLowBattery ? 82 + (seed % 9) : 88 + (seed % 11);
  const baseHours = Number(((rawPct / 100) * 32).toFixed(1));
  const estimatedHoursLeft = isLowPowerEnabled
    ? Number((baseHours + 4.5).toFixed(1))
    : Math.max(0.8, baseHours);
  const voltageVolts = Number((3.42 + (rawPct / 100) * 0.76).toFixed(2));
  const lastSyncMinutesAgo = (seed % 4) + 1;
  const deviceSerial = `SW-KORAT-${elder.id.replace('KORAT-ELD-', '')}`;

  const replacementType: ElderSmartWatchBatteryRecord['replacementType'] = isCriticalBattery
    ? 'swap_battery_cell'
    : isLowBattery
    ? 'urgent_field_charge'
    : 'normal';

  const statusLabel = isLowBattery
    ? `แบตเตอรี่ต่ำกว่า 20% (${rawPct}%) · เสี่ยงสัญญาณขาดหาย`
    : rawPct < 35
    ? 'ควรชาร์จเร็วๆ นี้ (ปานกลาง)'
    : 'แบตเตอรี่ปกติ · พร้อมเฝ้าระวัง 24 ชม.';

  const disruptionRiskNote = isLowBattery
    ? elder.livingArrangement === 'อยู่ลำพัง'
      ? `ผู้สูงอายุอาศัยอยู่ลำพัง แบตเตอรี่เหลือ ${rawPct}% (~${estimatedHoursLeft} ชม.) เสี่ยงเครื่องดับก่อนกู้ชีพเข้าถึง ต้องให้ ${elder.assignedVhv} นำแบตเตอรี่สำรอง/สายชาร์จเข้าเปลี่ยนเชิงรุกทันที`
      : `แบตเตอรี่เหลือเพียง ${rawPct}% (~${estimatedHoursLeft} ชม.) เสี่ยงขาดการติดต่อระหว่างส่งพิกัด GPS ฉุกเฉิน แจ้ง ${elder.assignedVhv} และผู้ดูแล (${elder.caregiverName}) เปลี่ยนแบตเตอรี่/ชาร์จทันที`
    : `เซลล์แบตเตอรี่สมบูรณ์ ${batteryHealthPct}% สำรองไฟได้อีกประมาณ ${estimatedHoursLeft} ชม. ไม่มีความเสี่ยงสัญญาณขาดหาย`;

  const proactiveActionLabel = isCriticalBattery
    ? 'ต้องเปลี่ยนแบตเตอรี่/สลับเครื่องสำรองด่วน (<15%)'
    : isLowBattery
    ? 'แจ้ง อสม. เข้าเปลี่ยนแบตเตอรี่/ชาร์จเชิงรุก (<20%)'
    : 'พร้อมใช้งานปกติ';

  return {
    elder,
    batteryPct: rawPct,
    isLowBattery,
    isCriticalBattery,
    batteryHealthPct,
    estimatedHoursLeft,
    voltageVolts,
    lastSyncMinutesAgo,
    deviceSerial,
    replacementRecommended: isLowBattery,
    replacementType,
    statusLabel,
    disruptionRiskNote,
    proactiveActionLabel,
  };
}
