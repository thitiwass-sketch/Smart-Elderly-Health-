import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Pill,
  Printer,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ElderProfile,
  MedicationScheduleItem,
  MedicationSlotTime,
} from '../types/health';
import {
  evaluateHealthRisk,
  generateMedicationSupplementTimeline,
} from '../utils/riskEngine';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';

interface MedicationSupplementTimelineSectionProps {
  elder: ElderProfile;
}

type TimelineFilterMode = 'all' | 'flagged_only' | 'medications' | 'supplements';
type DoseLogState = 'taken' | 'missed_risk_flagged' | 'due_pending' | 'missed_logged_vhv';

const SLOT_ORDER: {
  time: MedicationSlotTime;
  shortLabel: string;
  mealTag: string;
}[] = [
  { time: '06:30', shortLabel: 'ก่อนอาหารเช้า', mealTag: '06:15–06:45 น.' },
  { time: '08:00', shortLabel: 'หลังอาหารเช้า', mealTag: '07:45–08:30 น.' },
  { time: '12:30', shortLabel: 'หลังอาหารกลางวัน', mealTag: '12:00–13:15 น.' },
  { time: '18:00', shortLabel: 'หลังอาหารเย็น', mealTag: '17:30–18:45 น.' },
  { time: '21:00', shortLabel: 'ก่อนนอน', mealTag: '20:30–21:30 น.' },
];

export const MedicationSupplementTimelineSection: React.FC<
  MedicationSupplementTimelineSectionProps
> = ({ elder }) => {
  const [filterMode, setFilterMode] = useState<TimelineFilterMode>('all');
  const [selectedSlotTime, setSelectedSlotTime] = useState<MedicationSlotTime | 'ALL'>('ALL');
  const [doseStatusMap, setDoseStatusMap] = useState<Record<string, DoseLogState>>({});
  const [vhvReminderSentMap, setVhvReminderSentMap] = useState<Record<string, boolean>>({});
  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState(false);

  // Risk Profile Simulator States for testing dynamic missed-dose flagging
  const [showRiskSimulator, setShowRiskSimulator] = useState(false);
  const [simAdherence, setSimAdherence] = useState<'good' | 'irregular' | 'none'>(
    elder.chronicMetrics.medicationAdherence
  );
  const [simCognitiveScore, setSimCognitiveScore] = useState<number>(
    elder.frailtyDomains.cognitive
  );
  const [simLivingArrangement, setSimLivingArrangement] = useState<
    'อยู่กับครอบครัว' | 'อยู่กับคู่สมรสสูงอายุ' | 'อยู่ลำพัง'
  >(elder.livingArrangement);
  const [simFunctionalScore, setSimFunctionalScore] = useState<number>(
    elder.frailtyDomains.functional
  );

  // Sync simulator & default dose statuses when switching elders
  useEffect(() => {
    setSimAdherence(elder.chronicMetrics.medicationAdherence);
    setSimCognitiveScore(elder.frailtyDomains.cognitive);
    setSimLivingArrangement(elder.livingArrangement);
    setSimFunctionalScore(elder.frailtyDomains.functional);
    setFilterMode('all');
    setSelectedSlotTime('ALL');
    setVhvReminderSentMap({});
    setSpeakingItemId(null);
  }, [elder.id]);

  // Compute simulated or actual ElderProfile for the Medication & Supplement Timeline
  const effectiveElder = useMemo<ElderProfile>(() => {
    const isModified =
      simAdherence !== elder.chronicMetrics.medicationAdherence ||
      simCognitiveScore !== elder.frailtyDomains.cognitive ||
      simLivingArrangement !== elder.livingArrangement ||
      simFunctionalScore !== elder.frailtyDomains.functional;

    if (!isModified) return elder;

    const updatedDomains = {
      ...elder.frailtyDomains,
      cognitive: simCognitiveScore,
      functional: simFunctionalScore,
      social:
        simLivingArrangement === 'อยู่ลำพัง'
          ? Math.max(elder.frailtyDomains.social, 8)
          : simLivingArrangement === 'อยู่กับคู่สมรสสูงอายุ'
          ? Math.max(elder.frailtyDomains.social, 5)
          : elder.frailtyDomains.social,
    };

    const updatedMetrics = {
      ...elder.chronicMetrics,
      medicationAdherence: simAdherence,
    };

    const reevaluated = evaluateHealthRisk(
      updatedDomains,
      updatedMetrics,
      elder.gender,
      simLivingArrangement,
      elder.protocolUsed
    );

    return {
      ...elder,
      livingArrangement: simLivingArrangement,
      frailtyDomains: updatedDomains,
      chronicMetrics: updatedMetrics,
      riskProfile: reevaluated.riskProfile,
      ruleAudit: reevaluated.ruleAudit,
    };
  }, [
    elder,
    simAdherence,
    simCognitiveScore,
    simLivingArrangement,
    simFunctionalScore,
  ]);

  const timelineProfile = useMemo(
    () => generateMedicationSupplementTimeline(effectiveElder),
    [effectiveElder]
  );

  // Initialize dose status map whenever timeline items regenerate
  useEffect(() => {
    const initialMap: Record<string, DoseLogState> = {};
    timelineProfile.items.forEach((item) => {
      initialMap[item.id] = item.defaultStatus;
    });
    setDoseStatusMap(initialMap);
  }, [timelineProfile]);

  const filteredItems = useMemo(() => {
    return timelineProfile.items.filter((item) => {
      if (selectedSlotTime !== 'ALL' && item.slotTime !== selectedSlotTime) {
        return false;
      }
      if (filterMode === 'flagged_only') {
        return (
          item.missedDoseFlagged ||
          doseStatusMap[item.id] === 'missed_risk_flagged' ||
          doseStatusMap[item.id] === 'missed_logged_vhv'
        );
      }
      if (filterMode === 'medications') {
        return item.itemType === 'prescription_med';
      }
      if (filterMode === 'supplements') {
        return item.itemType === 'supplement';
      }
      return true;
    });
  }, [timelineProfile.items, selectedSlotTime, filterMode, doseStatusMap]);

  const handleSetDoseState = (itemId: string, nextState: DoseLogState) => {
    setDoseStatusMap((prev) => ({
      ...prev,
      [itemId]: nextState,
    }));
    if (nextState === 'missed_logged_vhv') {
      setVhvReminderSentMap((prev) => ({
        ...prev,
        [itemId]: true,
      }));
    }
  };

  const handleVerifyAllDosesTaken = () => {
    const nextMap: Record<string, DoseLogState> = {};
    timelineProfile.items.forEach((item) => {
      nextMap[item.id] = 'taken';
    });
    setDoseStatusMap(nextMap);
  };

  const handleResetDoseStates = () => {
    const resetMap: Record<string, DoseLogState> = {};
    timelineProfile.items.forEach((item) => {
      resetMap[item.id] = item.defaultStatus;
    });
    setDoseStatusMap(resetMap);
    setVhvReminderSentMap({});
  };

  const handleResetSimulator = () => {
    setSimAdherence(elder.chronicMetrics.medicationAdherence);
    setSimCognitiveScore(elder.frailtyDomains.cognitive);
    setSimLivingArrangement(elder.livingArrangement);
    setSimFunctionalScore(elder.frailtyDomains.functional);
  };

  const handleSpeakTimelineSummary = () => {
    if (speakingItemId === 'ALL_SUMMARY') {
      stopSpeakingThai();
      setSpeakingItemId(null);
      return;
    }

    const flaggedListText = timelineProfile.items
      .filter((i) => i.missedDoseFlagged)
      .map((i) => `เวลา ${i.slotTime} นาฬิกา ${i.name} โอกาสเสี่ยงลืมร้อยละ ${i.missedDoseProbabilityPercent}`)
      .join(' ');

    const text = `ตารางเวลาการใช้ยาและอาหารเสริมประจำวันของ ${elder.name} กลุ่มความเสี่ยง ${
      timelineProfile.matrixGroup
    } มีรายการทั้งหมด ${timelineProfile.totalDailyItems} รายการ เป็นยารักษาโรคประจำตัว ${
      timelineProfile.prescriptionCount
    } รายการ และวิตามินอาหารเสริม ${timelineProfile.supplementCount} รายการ ${
      timelineProfile.flaggedSlotCount > 0
        ? `พบช่วงเวลาที่ต้องเฝ้าระวังการลืมรับประทานยาจำนวน ${timelineProfile.flaggedSlotCount} รายการ ได้แก่ ${flaggedListText}`
        : 'มีความสม่ำเสมอในการใช้ยาอยู่ในเกณฑ์ดี'
    }`;

    setSpeakingItemId('ALL_SUMMARY');
    speakThaiText(
      text,
      () => setSpeakingItemId('ALL_SUMMARY'),
      () => setSpeakingItemId(null)
    );
  };

  const handleSpeakSingleItem = (item: MedicationScheduleItem) => {
    if (speakingItemId === item.id) {
      stopSpeakingThai();
      setSpeakingItemId(null);
      return;
    }

    const text = `เวลา ${item.slotPeriodLabel} รายการ ${item.name} ${item.dosageText} ข้อบ่งใช้เพื่อ ${
      item.indication
    } ${
      item.missedDoseFlagged
        ? `คำเตือนความเสี่ยงลืมรับประทานยา ร้อยละ ${item.missedDoseProbabilityPercent} สาเหตุจาก ${item.flagTriggerReason} แนวทางป้องกันคือ ${item.caregiverMitigationAction}`
        : ''
    }`;

    setSpeakingItemId(item.id);
    speakThaiText(
      text,
      () => setSpeakingItemId(item.id),
      () => setSpeakingItemId(null)
    );
  };

  const handleCopyTimelineText = async () => {
    const lines = [
      `ตารางเวลาการใช้ยาและวิตามินเสริมประจำวัน (Medication & Supplement Timeline)`,
      `ผู้สูงอายุ: ${elder.name} (${elder.age} ปี) · กลุ่ม ${timelineProfile.matrixGroup} · อสม. ผู้รับผิดชอบ: ${elder.assignedVhv}`,
      `ระดับความเสี่ยงการลืมโดส: ${timelineProfile.missedDoseVulnerabilityLevel} · คะแนนความสม่ำเสมอคาดการณ์: ${timelineProfile.overallAdherenceScorePercent}%`,
      `----------------------------------------`,
      ...timelineProfile.items.map(
        (item, idx) =>
          `${idx + 1}. [${item.slotTime} น. - ${item.mealRelationLabel}] ${item.name}\n   ขนาดวิธีใช้: ${
            item.dosageText
          }\n   สถานะเฝ้าระวัง: ${
            item.missedDoseFlagged
              ? `⚠️ เสี่ยงลืมโดส (${item.missedDoseProbabilityPercent}%) — ${item.flagTriggerReason}`
              : `✅ ความเสี่ยงต่ำ (${item.missedDoseProbabilityPercent}%)`
          }\n   คำแนะนำผู้ดูแล/อสม.: ${item.caregiverMitigationAction}`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2500);
    } catch {
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2500);
    }
  };

  // Count how many items are currently verified taken vs flagged
  const verifiedTakenCount = timelineProfile.items.filter(
    (item) => doseStatusMap[item.id] === 'taken'
  ).length;
  const activeFlaggedCount = timelineProfile.items.filter(
    (item) =>
      doseStatusMap[item.id] === 'missed_risk_flagged' ||
      doseStatusMap[item.id] === 'missed_logged_vhv'
  ).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
      {/* Top Clinical Header Banner */}
      <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-300 font-medium">
              <Pill className="w-3.5 h-3.5 shrink-0" />
              <span>CHRONOLOGICAL MEDICATION & SUPPLEMENT TIMELINE</span>
              <span aria-hidden="true">·</span>
              <span>วิเคราะห์ความเสี่ยงการลืมโดสจาก Risk Engine</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Matrix Group {timelineProfile.matrixGroup}</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
              3.8 ตารางเวลาการใช้ยาและวิตามินเสริมประจำวัน (Medication & Supplement Timeline)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              แสดงลำดับเวลาการใช้ยาประจำตัวและผลิตภัณฑ์เสริมอาหารตลอด 24 ชั่วโมง พร้อมระบบแจ้งเตือนมื้อที่เสี่ยงลืมรับประทาน (Missed-Dose Risk Flags) จากคะแนนความจำ การอยู่อาศัย และวินัยการใช้ยาของ {elder.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSpeakTimelineSummary}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                speakingItemId === 'ALL_SUMMARY'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
              }`}
            >
              {speakingItemId === 'ALL_SUMMARY' ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>หยุดอ่านเสียง</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-teal-300" />
                  <span>ฟังสรุปตารางยา</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowRiskSimulator((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                showRiskSimulator
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>จำลองความเสี่ยงลืมยา</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTimelineText}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedSchedule ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">คัดลอกตารางยาแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>คัดลอกส่ง LINE</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="พิมพ์ใบกำกับเวลาการใช้ยาประจำตัวผู้สูงอายุ"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">พิมพ์ใบตารางยา</span>
            </button>
          </div>
        </div>

        {/* Key Adherence & Risk Metrics Strip */}
        <div className="mt-4 pt-3.5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-slate-400 text-[11px]">รายการยาและอาหารเสริมต่อวัน</p>
            <p className="text-base font-bold font-mono-num text-white mt-0.5">
              {timelineProfile.totalDailyItems} รายการ/วัน
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              ยาประจำตัว {timelineProfile.prescriptionCount} · เสริมอาหาร {timelineProfile.supplementCount}
            </p>
          </div>

          <div
            className={`rounded-xl p-3 border ${
              timelineProfile.missedDoseVulnerabilityLevel === 'High'
                ? 'bg-red-950/60 border-red-700/70'
                : timelineProfile.missedDoseVulnerabilityLevel === 'Moderate'
                ? 'bg-amber-950/50 border-amber-700/70'
                : 'bg-emerald-950/40 border-emerald-700/60'
            }`}
          >
            <p className="text-slate-300 text-[11px]">มื้อที่เสี่ยงลืมรับประทาน (Risk Flagged)</p>
            <p
              className={`text-base font-bold font-mono-num mt-0.5 ${
                timelineProfile.flaggedSlotCount > 0 ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {timelineProfile.flaggedSlotCount} / {timelineProfile.totalDailyItems} มื้อ
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              ระดับความเปราะบางต่อการลืมยา: {timelineProfile.missedDoseVulnerabilityLevel}
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-slate-400 text-[11px]">ความสม่ำเสมอคาดการณ์ (Adherence)</p>
            <p className="text-base font-bold font-mono-num text-teal-300 mt-0.5">
              {timelineProfile.overallAdherenceScorePercent}%
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              ประวัติเดิม:{' '}
              {effectiveElder.chronicMetrics.medicationAdherence === 'good'
                ? 'สม่ำเสมอดี'
                : effectiveElder.chronicMetrics.medicationAdherence === 'irregular'
                ? 'ลืมบางมื้อ'
                : 'ขาดยาต่อเนื่อง'}
            </p>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-slate-400 text-[11px]">สถานะตรวจสอบมื้อยาวันนี้</p>
            <p className="text-base font-bold font-mono-num text-emerald-300 mt-0.5">
              ยืนยันแล้ว {verifiedTakenCount}/{timelineProfile.totalDailyItems}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              รอติดตามเฝ้าระวัง {activeFlaggedCount} รายการ
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Interactive Risk Profile Simulator for Missed-Dose Detection */}
        {showRiskSimulator && (
          <div className="rounded-xl border border-teal-300 bg-teal-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-teal-950">
                  โหมดจำลองการประเมินความเสี่ยงการลืมรับประทานยา (Risk Profile Missed-Dose Simulator)
                </p>
                <p className="text-[11px] text-teal-800">
                  ทดลองปรับตัวแปรในโปรไฟล์ความเสี่ยง เพื่อดูการเปลี่ยนแปลงของธงแจ้งเตือน (Missed-Dose Flags) ในแต่ละช่วงเวลาแบบ Real-time
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetSimulator}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-teal-300 text-xs font-semibold text-teal-900 hover:bg-teal-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>คืนค่าตามข้อมูลจริง</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1.5">
                <label className="block font-semibold text-slate-800">
                  ประวัติวินัยการใช้ยา (Adherence)
                </label>
                <select
                  value={simAdherence}
                  onChange={(e) =>
                    setSimAdherence(e.target.value as 'good' | 'irregular' | 'none')
                  }
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="good">สม่ำเสมอดี (Good)</option>
                  <option value="irregular">ลืมรับประทานบางมื้อ (Irregular)</option>
                  <option value="none">ขาดยาต่อเนื่อง (None)</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800">
                    คะแนนการรับรู้/ความจำ (Cognitive)
                  </label>
                  <span className="font-mono-num font-bold text-teal-900">
                    {simCognitiveScore}/15
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  value={simCognitiveScore}
                  onChange={(e) => setSimCognitiveScore(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  เกณฑ์เสี่ยงลืมซ้ำซ้อน: คะแนน ≥ 8/15
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1.5">
                <label className="block font-semibold text-slate-800">
                  รูปแบบการอยู่อาศัย (Living)
                </label>
                <select
                  value={simLivingArrangement}
                  onChange={(e) =>
                    setSimLivingArrangement(
                      e.target.value as
                        | 'อยู่กับครอบครัว'
                        | 'อยู่กับคู่สมรสสูงอายุ'
                        | 'อยู่ลำพัง'
                    )
                  }
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="อยู่กับครอบครัว">อยู่กับครอบครัว</option>
                  <option value="อยู่กับคู่สมรสสูงอายุ">อยู่กับคู่สมรสสูงอายุ</option>
                  <option value="อยู่ลำพัง">อยู่ลำพัง (เสี่ยงจุดบอดมื้อเที่ยง/ก่อนนอน)</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800">
                    ข้อจำกัดกิจวัตร (Functional ADL)
                  </label>
                  <span className="font-mono-num font-bold text-teal-900">
                    {simFunctionalScore}/20
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={simFunctionalScore}
                  onChange={(e) => setSimFunctionalScore(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  มีผลต่อการแกะซองยาและเตรียมน้ำดื่มเอง
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Profile Missed-Dose Alert & Trigger Summary Box */}
        <div
          className={`rounded-xl border p-4 ${
            timelineProfile.missedDoseVulnerabilityLevel === 'High'
              ? 'border-red-300 bg-red-50/75'
              : timelineProfile.missedDoseVulnerabilityLevel === 'Moderate'
              ? 'border-amber-300 bg-amber-50/75'
              : 'border-emerald-300 bg-emerald-50/70'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  timelineProfile.missedDoseVulnerabilityLevel === 'High'
                    ? 'bg-red-600 text-white'
                    : timelineProfile.missedDoseVulnerabilityLevel === 'Moderate'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  ผลการวิเคราะห์ความเสี่ยงการลืมรับประทานยาจาก Risk Engine:{' '}
                  <span className="underline decoration-2">
                    {timelineProfile.missedDoseVulnerabilityLevel === 'High'
                      ? 'ความเสี่ยงสูง (ต้องจัดตลับยาและติดตามรายวัน)'
                      : timelineProfile.missedDoseVulnerabilityLevel === 'Moderate'
                      ? 'ความเสี่ยงปานกลาง (เฝ้าระวังมื้อกลางวันและก่อนนอน)'
                      : 'ความเสี่ยงต่ำ (คงวินัยการใช้ยาตามปกติ)'}
                  </span>
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {timelineProfile.missedDoseRiskSummary}
                </p>
                <div className="pt-1 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-800">
                    ตัวแปรจากโปรไฟล์ความเสี่ยงที่ใช้ประมวลผล (Risk Engine Drivers):
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {timelineProfile.riskEngineTriggers.map((trigger, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-400 font-bold select-none">•</span>
                        <span>{trigger}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 24-Hour Chronological Visual Time-Node Strip */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Clock className="w-4 h-4 text-teal-700" />
              <span>แผนผังลำดับเวลาตลอด 24 ชั่วโมง (คลิกช่วงเวลาเพื่อกรองเฉพาะมื้อนั้น)</span>
            </div>
            {selectedSlotTime !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedSlotTime('ALL')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
              >
                แสดงครบทุกช่วงเวลา (24 ชม.)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {SLOT_ORDER.map((slot) => {
              const slotItems = timelineProfile.items.filter(
                (i) => i.slotTime === slot.time
              );
              const hasSlotItems = slotItems.length > 0;
              const flaggedInSlot = slotItems.filter((i) => i.missedDoseFlagged);
              const maxProb = slotItems.reduce(
                (max, cur) => Math.max(max, cur.missedDoseProbabilityPercent),
                0
              );
              const isSelected = selectedSlotTime === slot.time;

              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!hasSlotItems}
                  onClick={() =>
                    setSelectedSlotTime((prev) =>
                      prev === slot.time ? 'ALL' : slot.time
                    )
                  }
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : flaggedInSlot.length > 0
                      ? 'bg-white border-red-300 hover:border-red-400 text-slate-900'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-sm font-extrabold font-mono-num ${
                        isSelected ? 'text-teal-300' : 'text-slate-900'
                      }`}
                    >
                      {slot.time} น.
                    </span>
                    {flaggedInSlot.length > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold font-mono-num ${
                          isSelected ? 'text-amber-300' : 'text-red-700'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>เสี่ยง {maxProb}%</span>
                      </span>
                    ) : hasSlotItems ? (
                      <span
                        className={`text-[11px] font-mono-num ${
                          isSelected ? 'text-emerald-300' : 'text-emerald-700 font-semibold'
                        }`}
                      >
                        ปกติ ({maxProb}%)
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`text-xs font-semibold mt-1 ${
                      isSelected ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {slot.shortLabel}
                  </p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {hasSlotItems
                      ? `${slotItems.length} รายการ · ${
                          flaggedInSlot.length > 0
                            ? `เฝ้าระวัง ${flaggedInSlot.length} โดส`
                            : 'ตามเกณฑ์ปกติ'
                        }`
                      : 'ไม่มีรายการในมื้อนี้'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Filter Tabs & Batch Verification Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมดตามลำดับเวลา ({timelineProfile.totalDailyItems})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('flagged_only')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterMode === 'flagged_only'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-red-700 hover:text-red-900'
              }`}
            >
              เฉพาะมื้อเสี่ยงลืมโดส ({timelineProfile.flaggedSlotCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('medications')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterMode === 'medications'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ยารักษาโรคประจำตัว ({timelineProfile.prescriptionCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('supplements')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                filterMode === 'supplements'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              วิตามินและอาหารเสริม ({timelineProfile.supplementCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyAllDosesTaken}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ยืนยันรับประทานครบทุกมื้อวันนี้</span>
            </button>
            <button
              type="button"
              onClick={handleResetDoseStates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเซ็ตสถานะ</span>
            </button>
          </div>
        </div>

        {/* Chronological Vertical Timeline Feed */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              ไม่พบรายการยาหรืออาหารเสริมตามตัวกรองที่เลือก
            </p>
            <p className="text-xs text-slate-500">
              คลิกปุ่มด้านล่างเพื่อกลับไปดูตารางเวลาทั้งหมดตลอด 24 ชั่วโมง
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setSelectedSlotTime('ALL');
              }}
              className="mt-1 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
            >
              แสดงทุกรายการตามลำดับเวลา
            </button>
          </div>
        ) : (
          <div className="relative pl-5 sm:pl-7 border-l-2 border-slate-200 space-y-4">
            {filteredItems.map((item) => {
              const currentStatus = doseStatusMap[item.id] || item.defaultStatus;
              const isFlaggedActive =
                item.missedDoseFlagged && currentStatus !== 'taken';
              const isCriticalFlag =
                item.missedDoseRiskLevel === 'critical_flag' && currentStatus !== 'taken';
              const isSpeakingThis = speakingItemId === item.id;
              const isVhvNotified = Boolean(vhvReminderSentMap[item.id]);

              return (
                <div
                  key={item.id}
                  className={`relative rounded-xl border p-4 transition-all ${
                    currentStatus === 'taken'
                      ? 'border-emerald-300 bg-emerald-50/35'
                      : currentStatus === 'missed_logged_vhv'
                      ? 'border-red-400 bg-red-50/70'
                      : isCriticalFlag
                      ? 'border-red-300 bg-red-50/40'
                      : isFlaggedActive
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Timeline Chronological Node Dot on Left Rail */}
                  <div
                    className={`absolute -left-[27px] sm:-left-[35px] top-5 w-4 h-4 rounded-full border-2 border-white shadow-2xs ${
                      currentStatus === 'taken'
                        ? 'bg-emerald-600'
                        : isCriticalFlag || currentStatus === 'missed_logged_vhv'
                        ? 'bg-red-600'
                        : isFlaggedActive
                        ? 'bg-amber-500'
                        : 'bg-teal-600'
                    }`}
                  />

                  {/* Top Metadata Kicker Line (Zero-Pill Unboxed Discipline) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-num text-sm font-extrabold text-slate-900">
                        {item.slotTime} น.
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className="font-semibold text-slate-800">
                        {item.mealRelationLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className="text-slate-500 font-mono-num">
                        ช่วงเวลา {item.windowRange}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span
                        className={`font-semibold ${
                          item.itemType === 'prescription_med'
                            ? 'text-teal-800'
                            : 'text-indigo-800'
                        }`}
                      >
                        {item.itemTypeLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono-num">
                      {item.missedDoseFlagged ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            item.missedDoseRiskLevel === 'critical_flag'
                              ? 'text-red-700'
                              : 'text-amber-800'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {item.missedDoseRiskLevel === 'critical_flag'
                              ? 'ธงเตือนเสี่ยงลืมโดสระดับวิกฤต'
                              : 'เฝ้าระวังเสี่ยงลืมโดส'}{' '}
                            ({item.missedDoseProbabilityPercent}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          โอกาสลืมต่ำ ({item.missedDoseProbabilityPercent}%)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSpeakSingleItem(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-sans font-medium cursor-pointer"
                      >
                        {isSpeakingThis ? (
                          <>
                            <VolumeX className="w-3 h-3 text-red-600" />
                            <span>หยุดฟัง</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-teal-700" />
                            <span>ฟังเสียง</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Primary Medication / Supplement Name & Dosage */}
                  <div className="mt-3 space-y-1.5">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-600">{item.thaiClinicalName}</p>

                    <div className="pt-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          ขนาดและวิธีรับประทาน (Dosage Schedule)
                        </span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {item.dosageText}
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          ข้อบ่งใช้ทางคลินิก (Clinical Indication)
                        </span>
                        <span className="font-medium text-slate-800 mt-0.5 block">
                          {item.indication}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Risk-Engine Flagged Missed Dose Explanation Box */}
                  {item.missedDoseFlagged && (
                    <div
                      className={`mt-3 rounded-xl border p-3.5 space-y-2 text-xs ${
                        item.missedDoseRiskLevel === 'critical_flag'
                          ? 'border-red-300 bg-red-100/55 text-red-950'
                          : 'border-amber-300 bg-amber-100/50 text-amber-950'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                        <div className="space-y-1">
                          <p className="font-bold">
                            ทำไมมื้อเวลานี้จึงถูกปักธงเสี่ยงลืมโดส (Flagged by Elder Risk Profile):
                          </p>
                          <p className="leading-relaxed">{item.flagTriggerReason}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        <div className="bg-white/85 rounded-lg p-2.5 border border-red-200/80">
                          <p className="text-[11px] font-bold text-red-800">
                            ผลกระทบหากลืมรับประทานโดสนี้:
                          </p>
                          <p className="text-slate-800 mt-0.5 leading-relaxed">
                            {item.clinicalConsequenceIfMissed}
                          </p>
                        </div>
                        <div className="bg-white/85 rounded-lg p-2.5 border border-teal-200/80">
                          <p className="text-[11px] font-bold text-teal-900">
                            การจัดการเชิงรุกโดย อสม. / ผู้ดูแล:
                          </p>
                          <p className="text-slate-800 mt-0.5 leading-relaxed">
                            {item.caregiverMitigationAction}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Drug-Nutrient / Safety Precaution Note */}
                  <div className="mt-2.5 text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-800">
                      ข้อควรระวัง/ปฏิกิริยากับอาหาร:
                    </span>
                    <span>{item.interactionOrPrecautionNote}</span>
                  </div>

                  {/* Interactive Dose Status Action Controls */}
                  <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      <span>สถานะบันทึกประจำวัน: </span>
                      <span
                        className={`font-bold ${
                          currentStatus === 'taken'
                            ? 'text-emerald-700'
                            : currentStatus === 'missed_logged_vhv'
                            ? 'text-red-700'
                            : currentStatus === 'missed_risk_flagged'
                            ? 'text-amber-800'
                            : 'text-slate-800'
                        }`}
                      >
                        {currentStatus === 'taken'
                          ? 'ยืนยันรับประทานแล้ว'
                          : currentStatus === 'missed_logged_vhv'
                          ? `บันทึกว่าลืมโดส · แจ้งเตือน ${elder.assignedVhv} แล้ว`
                          : currentStatus === 'missed_risk_flagged'
                          ? 'ปักธงเฝ้าระวังเสี่ยงลืมรับประทานยา'
                          : 'รอถึงเวลารับประทานยา'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetDoseState(item.id, 'taken')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          currentStatus === 'taken'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>รับประทานแล้ว</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDoseState(item.id, 'missed_risk_flagged')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          currentStatus === 'missed_risk_flagged'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>รอติดตามมื้อเสี่ยง</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDoseState(item.id, 'missed_logged_vhv')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          currentStatus === 'missed_logged_vhv'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-800 border border-slate-200'
                        }`}
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>
                          {isVhvNotified ? 'แจ้ง อสม. ติดตามแล้ว' : 'บันทึกลืมยา + แจ้ง อสม.'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
