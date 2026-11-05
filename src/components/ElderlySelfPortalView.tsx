import React, { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Pill,
  Sparkles,
  Utensils,
  Volume2,
  VolumeX,
  Watch,
} from 'lucide-react';
import { ElderProfile, MedicationAdherenceLogEvent } from '../types/health';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';
import { NutritionalGuidanceCardsSection } from './NutritionalGuidanceCardsSection';
import { SmartMedicationAlarm } from './SmartMedicationAlarm';

interface ElderlySelfPortalViewProps {
  elders: ElderProfile[];
  onSelfRecordVitals: (elderId: string, sbp: number, dbp: number, weight: number) => void;
  onOpenFullDetail: (elder: ElderProfile) => void;
  onTriggerSmartWatchSos?: (elder: ElderProfile) => void;
  onRecordMedicationTaken?: (elderId: string, logEvent: MedicationAdherenceLogEvent) => void;
  onUndoMedicationTaken?: (elderId: string, logId: string) => void;
}

export const ElderlySelfPortalView: React.FC<ElderlySelfPortalViewProps> = ({
  elders,
  onSelfRecordVitals,
  onOpenFullDetail,
  onTriggerSmartWatchSos,
  onRecordMedicationTaken,
  onUndoMedicationTaken,
}) => {
  const [selectedElderId, setSelectedElderId] = useState<string>(
    elders[0]?.id || 'KORAT-ELD-001'
  );
  const currentElder =
    elders.find((e) => e.id === selectedElderId) || elders[0];

  const medicationAlarmRef = useRef<HTMLDivElement>(null);
  const nutritionSectionRef = useRef<HTMLDivElement>(null);
  const vitalsSectionRef = useRef<HTMLDivElement>(null);

  const [selfSbp, setSelfSbp] = useState(currentElder?.chronicMetrics.sbp || 135);
  const [selfDbp, setSelfDbp] = useState(currentElder?.chronicMetrics.dbp || 82);
  const [selfWeight, setSelfWeight] = useState(currentElder?.chronicMetrics.weight || 52.0);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [dailyChecks, setDailyChecks] = useState<{
    activity: boolean;
    nutrition: boolean;
    medication: boolean;
  }>({
    activity: true,
    nutrition: false,
    medication: true,
  });

  useEffect(() => {
    return () => {
      stopSpeakingThai();
    };
  }, [selectedElderId]);

  if (!currentElder) return null;

  const handleElderChange = (id: string) => {
    stopSpeakingThai();
    setIsSpeaking(false);
    setSelectedElderId(id);
    const found = elders.find((e) => e.id === id);
    if (found) {
      setSelfSbp(found.chronicMetrics.sbp);
      setSelfDbp(found.chronicMetrics.dbp);
      setSelfWeight(found.chronicMetrics.weight);
    }
    setSavedNotice(false);
  };

  const handleRecordMedicationEvent = (
    elderId: string,
    logEvent: MedicationAdherenceLogEvent
  ) => {
    setDailyChecks((prev) => ({ ...prev, medication: true }));
    if (onRecordMedicationTaken) {
      onRecordMedicationTaken(elderId, logEvent);
    }
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeakingThai();
      setIsSpeaking(false);
      return;
    }
    const text = `คำแนะนำสุขภาพสำหรับ ${currentElder.name}. ${currentElder.personalPlan.executiveSummary}. กิจกรรมที่ควรทำวันนี้คือ ${currentElder.personalPlan.physicalActivities[0]}. โภชนาการที่แนะนำคือ ${currentElder.personalPlan.nutritionAdvice[0]}.`;
    setIsSpeaking(true);
    speakThaiText(
      text,
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  const handleSaveSelfCheck = (e: React.FormEvent) => {
    e.preventDefault();
    onSelfRecordVitals(currentElder.id, selfSbp, selfDbp, selfWeight);
    setSavedNotice(true);
  };

  const { riskProfile, personalPlan, chronicMetrics } = currentElder;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Elder Selector Header */}
      <section className="bg-slate-800 border border-teal-500/40 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
          <div>
            <p className="text-xs font-semibold text-teal-300">
              ระดับผู้ใช้งานที่ 1 — ระบบดูแลสุขภาพตนเองสำหรับผู้สูงอายุและครอบครัว
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">
              สมุดสุขภาพดิจิทัลและแผนดูแลสุขภาพรายบุคคล
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-200 whitespace-nowrap">
              เลือกผู้สูงอายุ:
            </label>
            <select
              value={currentElder.id}
              onChange={(e) => handleElderChange(e.target.value)}
              className="px-3 py-2 text-sm font-medium border border-slate-600 rounded-lg bg-slate-900 text-white cursor-pointer"
            >
              {elders.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} (อายุ {e.age} ปี · {e.subdistrict})
                </option>
              ))}
            </select>
            {onTriggerSmartWatchSos && (
              <button
                type="button"
                onClick={() => onTriggerSmartWatchSos(currentElder)}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Watch className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>SOS นาฬิกา Smart Watch (1669)</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Jump Bar for Elderly Ease-of-Use */}
        <div className="pt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-300">ลัดไปยังส่วนสำคัญ:</span>
          <button
            type="button"
            onClick={() => medicationAlarmRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5 text-teal-400" />
            <span>⏰ นาฬิกาปลุกยา & บันทึกทานยา</span>
          </button>
          <button
            type="button"
            onClick={() => vitalsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>🩺 บันทึกความดัน-น้ำหนัก</span>
          </button>
          <button
            type="button"
            onClick={() => nutritionSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5 text-amber-400" />
            <span>🥗 การ์ดโภชนาการเฉพาะบุคคล</span>
          </button>
        </div>

        {/* Big Legible Summary for Seniors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 border-l-4 border-l-amber-400">
            <p className="text-xs font-semibold text-slate-200">ระดับความเสี่ยงภาพรวม</p>
            <p
              className={`mt-1 text-lg font-extrabold ${
                riskProfile.matrixGroup === 'D'
                  ? 'text-rose-400'
                  : riskProfile.matrixGroup === 'C'
                  ? 'text-orange-400'
                  : riskProfile.matrixGroup === 'B'
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              กลุ่ม {riskProfile.matrixGroup} — {riskProfile.matrixAction}
            </p>
            <p className="mt-1 text-xs text-slate-200">
              คะแนนความแข็งแรง/เปราะบาง:{' '}
              <span className="font-mono-num font-bold text-white">
                {riskProfile.frailtyScore}/100
              </span>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 border-l-4 border-l-sky-400">
            <p className="text-xs font-semibold text-slate-200">ความดันโลหิตและน้ำหนักล่าสุด</p>
            <p className="mt-1 text-lg font-extrabold text-white font-mono-num">
              {chronicMetrics.sbp}/{chronicMetrics.dbp}{' '}
              <span className="text-xs font-normal text-slate-300">mmHg</span>
            </p>
            <p className="mt-1 text-xs text-sky-300 font-mono-num font-medium">
              น้ำหนัก {chronicMetrics.weight} กก. · BMI {chronicMetrics.bmi}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 border-l-4 border-l-teal-400">
            <p className="text-xs text-teal-300 font-semibold">การแจ้งเตือนนัดหมายและผู้ดูแล</p>
            <p className="mt-1 text-base font-extrabold text-white font-mono-num">
              นัดเยี่ยมบ้าน: {currentElder.nextFollowUpDate}
            </p>
            <p className="mt-1 text-xs text-emerald-300 font-medium">
              ผู้รับผิดชอบ: {currentElder.assignedVhv}
            </p>
          </div>
        </div>
      </section>

      {/* Self-Assessment & Vital Recording */}
      <div ref={vitalsSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-6">
        <section className="lg:col-span-5 bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg">
          <h2 className="text-base font-bold text-white">
            บันทึกและประเมินสุขภาพตนเองวันนี้
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            บันทึกค่าความดันโลหิตและน้ำหนักที่วัดได้จากที่บ้าน เพื่อให้ อสม. และ รพ.สต. ร่วมเฝ้าระวัง
          </p>

          <form onSubmit={handleSaveSelfCheck} className="mt-4 space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                ความดันโลหิตตัวบน (SBP — mmHg)
              </label>
              <input
                type="number"
                value={selfSbp}
                onChange={(e) => setSelfSbp(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-600 rounded-lg bg-slate-950 text-white font-mono-num text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                ความดันโลหิตตัวล่าง (DBP — mmHg)
              </label>
              <input
                type="number"
                value={selfDbp}
                onChange={(e) => setSelfDbp(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-600 rounded-lg bg-slate-950 text-white font-mono-num text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                น้ำหนักตัววันนี้ (กิโลกรัม)
              </label>
              <input
                type="number"
                step="0.1"
                value={selfWeight}
                onChange={(e) => setSelfWeight(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 border border-slate-600 rounded-lg bg-slate-950 text-white font-mono-num text-base"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-colors cursor-pointer"
            >
              บันทึกข้อมูลสุขภาพของฉัน
            </button>

            {savedNotice && (
              <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>บันทึกข้อมูลเรียบร้อย ส่งต่อข้อมูลให้ {currentElder.assignedVhv} แล้ว</span>
              </div>
            )}
          </form>
        </section>

        {/* Personal Health Plan & Activities */}
        <section className="lg:col-span-7 bg-slate-900 border border-slate-700/80 rounded-xl p-6 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                คำแนะนำสุขภาพและกิจกรรมที่เหมาะสมสำหรับคุณ
              </h2>
              <p className="text-xs text-slate-300">
                แผนสุขภาพเฉพาะบุคคล 4 สัปดาห์ (Calm & Multimodal Voice UX)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSpeaking
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-teal-400 bg-teal-500 text-slate-950 hover:bg-teal-400'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span>หยุดเสียง</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>ฟังเสียงคำแนะนำ</span>
                  </>
                )}
              </button>
              <button
                onClick={() => onOpenFullDetail(currentElder)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
              >
                ดูแผนเต็ม / วิเคราะห์ AI
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-100 leading-relaxed">
            {personalPlan.executiveSummary}
          </p>

          {/* Calm Design Interactive Daily Habit Checklist */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-white mb-2">
              เช็กลิสต์การดูแลสุขภาพประจำวัน (แตะเพื่อบันทึกกิจกรรมวันนี้):
            </h3>
            <div className="space-y-2 text-xs">
              {[
                {
                  key: 'activity' as const,
                  title: '1. ทำกิจกรรมทางกาย / บริหารกล้ามเนื้อตามคำแนะนำแล้ว',
                },
                {
                  key: 'nutrition' as const,
                  title: '2. รับประทานอาหารโปรตีนย่อยง่าย (ปลา/ไข่/เต้าหู้) และลดเค็มแล้ว',
                },
                {
                  key: 'medication' as const,
                  title: '3. ดื่มน้ำสะอาดเพียงพอและรับประทานยาประจำตัวตามเวลา',
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setDailyChecks((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key],
                    }))
                  }
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                    dailyChecks[item.key]
                      ? 'border-teal-400 bg-teal-950/90 text-white font-bold'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750'
                  }`}
                >
                  <span>{item.title}</span>
                  <span
                    className={`font-mono-num font-bold ${
                      dailyChecks[item.key] ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    {dailyChecks[item.key] ? '✓ ทำแล้ววันนี้' : 'ยังไม่ได้ทำ'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <h3 className="text-xs font-bold text-teal-300">
                กิจกรรมทางกายที่แนะนำประจำสัปดาห์:
              </h3>
              <ul className="mt-1.5 space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                {personalPlan.physicalActivities.map((act, i) => (
                  <li key={i}>{act}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-teal-300">
                คำแนะนำด้านอาหารและโภชนาการ:
              </h3>
              <ul className="mt-1.5 space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                {personalPlan.nutritionAdvice.map((nut, i) => (
                  <li key={i}>{nut}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Smart Medication Alarm & Daily Adherence Timeline */}
      <div ref={medicationAlarmRef} className="scroll-mt-6">
        <SmartMedicationAlarm
          elder={currentElder}
          onRecordMedicationTaken={handleRecordMedicationEvent}
          onUndoMedicationTaken={onUndoMedicationTaken}
        />
      </div>

      {/* Personalized Nutritional Guidance Cards for Groups B, C, and D */}
      <div ref={nutritionSectionRef} className="scroll-mt-6 bg-white text-slate-900 rounded-2xl p-1 shadow-lg">
        <NutritionalGuidanceCardsSection
          elder={currentElder}
          allElders={elders}
          onSelectElder={(selected) => handleElderChange(selected.id)}
        />
      </div>

      {/* Health Trend Table */}
      <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-base font-bold text-white mb-3">
          แนวโน้มสุขภาพย้อนหลังของ {currentElder.name}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono-num">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60 text-slate-200 font-sans font-bold">
                <th className="py-2.5 px-3">วันที่ตรวจ</th>
                <th className="py-2.5 px-3 text-right">ความดันโลหิต (mmHg)</th>
                <th className="py-2.5 px-3 text-right">น้ำหนัก (กก.)</th>
                <th className="py-2.5 px-3 text-right">ดัชนีมวลกาย (BMI)</th>
                <th className="py-2.5 px-3 text-right">คะแนนภาวะเปราะบาง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-100">
              {currentElder.history.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/70">
                  <td className="py-2.5 px-3 font-semibold text-white">{item.date}</td>
                  <td className="py-2.5 px-3 text-right">{item.sbp}/{item.dbp}</td>
                  <td className="py-2.5 px-3 text-right">{item.weight.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right">{item.bmi.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-teal-300">
                    {item.frailtyScore}/100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
