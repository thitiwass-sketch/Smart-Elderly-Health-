import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  WifiOff,
  X,
} from 'lucide-react';
import {
  ChronicRiskMetrics,
  ElderProfile,
  FrailtyDomainScores,
  FrailtyProtocolId,
} from '../types/health';
import {
  buildDeterministicHealthPlan,
  calculateBmi,
  evaluateHealthRisk,
  FRAILTY_PROTOCOLS,
} from '../utils/riskEngine';
import { MUEANG_KORAT_SUBDISTRICTS } from '../data/koratHealthData';
import { UI_LABELS } from '../constants/uiLabels';

interface ScreeningEngineModalProps {
  isOpen: boolean;
  initialElder?: ElderProfile | null;
  isOfflineMode: boolean;
  onClose: () => void;
  onSaveElderScreening: (elder: ElderProfile, isNew: boolean) => void;
}

export const ScreeningEngineModal: React.FC<ScreeningEngineModalProps> = ({
  isOpen,
  initialElder,
  isOfflineMode,
  onClose,
  onSaveElderScreening,
}) => {
  const isEditing = !!initialElder;

  const [name, setName] = useState('');
  const [age, setAge] = useState(72);
  const [gender, setGender] = useState<'หญิง' | 'ชาย'>('หญิง');
  const [village, setVillage] = useState('หมู่ที่ 4 บ้านดอนขวาง');
  const [subdistrict, setSubdistrict] = useState('ต.หัวทะเล');
  const [phone, setPhone] = useState('081-550-4421');
  const [caregiverName, setCaregiverName] = useState('บุตรหลานในครัวเรือน');
  const [livingArrangement, setLivingArrangement] = useState<
    'อยู่กับครอบครัว' | 'อยู่กับคู่สมรสสูงอายุ' | 'อยู่ลำพัง'
  >('อยู่กับครอบครัว');
  const [assignedVhv, setAssignedVhv] = useState('อสม.วันเพ็ญ ศรีโคราช');
  const [chronicText, setChronicText] = useState('ความดันโลหิตสูง');
  const [protocolUsed, setProtocolUsed] = useState<FrailtyProtocolId>('moph_7d');

  // 7 Modular Frailty Domains
  const [domains, setDomains] = useState<FrailtyDomainScores>({
    physical: 8,
    functional: 6,
    nutrition: 5,
    cognitive: 4,
    social: 3,
    activity: 5,
    chronicDisease: 4,
  });

  // Chronic Disease Risk Metrics
  const [weight, setWeight] = useState(52.0);
  const [height, setHeight] = useState(156);
  const [waist, setWaist] = useState(82);
  const [sbp, setSbp] = useState(138);
  const [dbp, setDbp] = useState(86);
  const [dietaryHabit, setDietaryHabit] =
    useState<ChronicRiskMetrics['dietaryHabit']>('normal');
  const [exerciseFrequency, setExerciseFrequency] =
    useState<ChronicRiskMetrics['exerciseFrequency']>('occasional');
  const [smoking, setSmoking] = useState<ChronicRiskMetrics['smoking']>('never');
  const [alcohol, setAlcohol] = useState<ChronicRiskMetrics['alcohol']>('none');
  const [familyHistory, setFamilyHistory] = useState(false);
  const [medicationAdherence, setMedicationAdherence] =
    useState<ChronicRiskMetrics['medicationAdherence']>('good');

  const [startTimeMs, setStartTimeMs] = useState<number>(Date.now());

  useEffect(() => {
    if (isOpen) {
      setStartTimeMs(Date.now());
      if (initialElder) {
        setName(initialElder.name);
        setAge(initialElder.age);
        setGender(initialElder.gender);
        setVillage(initialElder.village);
        setSubdistrict(initialElder.subdistrict);
        setPhone(initialElder.phone);
        setCaregiverName(initialElder.caregiverName);
        setLivingArrangement(initialElder.livingArrangement);
        setAssignedVhv(initialElder.assignedVhv);
        setChronicText(initialElder.chronicConditions.join(', '));
        setProtocolUsed(initialElder.protocolUsed);
        setDomains({ ...initialElder.frailtyDomains });
        setWeight(initialElder.chronicMetrics.weight);
        setHeight(initialElder.chronicMetrics.height);
        setWaist(initialElder.chronicMetrics.waist);
        setSbp(initialElder.chronicMetrics.sbp);
        setDbp(initialElder.chronicMetrics.dbp);
        setDietaryHabit(initialElder.chronicMetrics.dietaryHabit);
        setExerciseFrequency(initialElder.chronicMetrics.exerciseFrequency);
        setSmoking(initialElder.chronicMetrics.smoking);
        setAlcohol(initialElder.chronicMetrics.alcohol);
        setFamilyHistory(initialElder.chronicMetrics.familyHistory);
        setMedicationAdherence(initialElder.chronicMetrics.medicationAdherence);
      } else {
        setName('');
        setAge(70);
        setGender('หญิง');
        setVillage('หมู่ที่ 4 บ้านดอนขวาง');
        setSubdistrict('ต.หัวทะเล');
        setPhone('081-432-9901');
        setCaregiverName('บุตรหลานในครอบครัว');
        setLivingArrangement('อยู่กับครอบครัว');
        setAssignedVhv('อสม.วันเพ็ญ ศรีโคราช');
        setChronicText('ความดันโลหิตสูง');
        setProtocolUsed('moph_7d');
        setDomains({
          physical: 9,
          functional: 6,
          nutrition: 6,
          cognitive: 4,
          social: 3,
          activity: 5,
          chronicDisease: 4,
        });
        setWeight(50.0);
        setHeight(155);
        setWaist(80);
        setSbp(142);
        setDbp(88);
        setDietaryHabit('high_salt');
        setExerciseFrequency('occasional');
        setSmoking('never');
        setAlcohol('none');
        setFamilyHistory(true);
        setMedicationAdherence('good');
      }
    }
  }, [isOpen, initialElder]);

  if (!isOpen) return null;

  const bmi = calculateBmi(weight, height);
  const fullMetrics: ChronicRiskMetrics = {
    weight,
    height,
    bmi,
    waist,
    sbp,
    dbp,
    dietaryHabit,
    exerciseFrequency,
    smoking,
    alcohol,
    familyHistory,
    medicationAdherence,
  };

  const { riskProfile, ruleAudit } = evaluateHealthRisk(
    domains,
    fullMetrics,
    gender,
    livingArrangement,
    protocolUsed
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || 'นางสาวจำเนียร โคราชพัฒนา';
    const elapsedSec = Math.max(
      95,
      Math.min(420, Math.round((Date.now() - startTimeMs) / 1000) + 120)
    );
    const todayStr = new Date().toISOString().slice(0, 10);

    const personalPlan = buildDeterministicHealthPlan(
      finalName,
      riskProfile,
      domains,
      fullMetrics
    );

    const nextDate = new Date();
    if (riskProfile.matrixGroup === 'D') nextDate.setDate(nextDate.getDate() + 3);
    else if (riskProfile.matrixGroup === 'C') nextDate.setDate(nextDate.getDate() + 7);
    else if (riskProfile.matrixGroup === 'B') nextDate.setDate(nextDate.getDate() + 14);
    else nextDate.setDate(nextDate.getDate() + 60);

    const updatedHistory = initialElder
      ? [
          ...initialElder.history,
          {
            date: todayStr,
            sbp,
            dbp,
            weight,
            bmi,
            frailtyScore: riskProfile.frailtyScore,
          },
        ]
      : [
          {
            date: todayStr,
            sbp,
            dbp,
            weight,
            bmi,
            frailtyScore: riskProfile.frailtyScore,
          },
        ];

    const savedProfile: ElderProfile = {
      id: initialElder ? initialElder.id : `KORAT-ELD-${String(Math.floor(100 + Math.random() * 899))}`,
      cidMasked: initialElder ? initialElder.cidMasked : '3-3001-04512-XX-6',
      name: finalName,
      age,
      gender,
      village,
      subdistrict,
      district: 'อ.เมืองนครราชสีมา',
      phone,
      caregiverName,
      livingArrangement,
      chronicConditions: chronicText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      assignedVhv,
      lastScreenedAt: todayStr,
      screeningDurationSec: elapsedSec,
      protocolUsed,
      frailtyDomains: domains,
      chronicMetrics: fullMetrics,
      riskProfile,
      ruleAudit,
      personalPlan,
      history: updatedHistory,
      nextFollowUpDate: nextDate.toISOString().slice(0, 10),
      followUpStatus:
        riskProfile.matrixGroup === 'D'
          ? 'overdue'
          : riskProfile.matrixGroup === 'C'
          ? 'due_soon'
          : 'scheduled',
      syncStatus: isOfflineMode ? 'pending_offline' : 'synced',
      verifiedByRph: false,
    };

    onSaveElderScreening(savedProfile, !isEditing);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white text-slate-900 rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs text-teal-800 font-medium">
              <span>Modular Screening Engine (M03 · M04 · M05)</span>
              <span aria-hidden="true">·</span>
              <span>SSSRFE Model: Screen → Score → Stratify</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing
                ? `บันทึกการคัดกรองและประเมินความเสี่ยงซ้ำ: ${initialElder?.name}`
                : 'ลงทะเบียนและคัดกรองสุขภาพผู้สูงอายุรายใหม่'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 bg-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {isOfflineMode && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>โหมด Offline-First ทำงานอยู่:</strong> ข้อมูลการคัดกรองจะถูกบันทึกเก็บในเครื่องชั่วคราว (Local Storage Queue) และพร้อม Sync ขึ้นระบบกลาง รพ.สต. เมื่อมีสัญญาณอินเทอร์เน็ต
              </span>
            </div>
          )}

          {/* Step 1: Demographic & Community Registration */}
          <div className="border-b border-slate-200 pb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              ส่วนที่ 1: ข้อมูลทั่วไปและบริบทการอยู่อาศัยในชุมชน (จ.นครราชสีมา)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  ชื่อ-นามสกุล ผู้สูงอายุ *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น นางสมจิตร โคราชเจริญ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">อายุ (ปี)</label>
                  <input
                    type="number"
                    min={60}
                    max={110}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">เพศ</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'หญิง' | 'ชาย')}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="หญิง">หญิง</option>
                    <option value="ชาย">ชาย</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  ตำบล (อ.เมืองนครราชสีมา — 25 ตำบล)
                </label>
                <select
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {MUEANG_KORAT_SUBDISTRICTS.map((sub, idx) => (
                    <option key={sub} value={sub}>
                      {String(idx + 1).padStart(2, '0')}. {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">หมู่บ้าน / ชุมชน</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">การอยู่อาศัย (Social Context)</label>
                <select
                  value={livingArrangement}
                  onChange={(e) =>
                    setLivingArrangement(
                      e.target.value as
                        | 'อยู่กับครอบครัว'
                        | 'อยู่กับคู่สมรสสูงอายุ'
                        | 'อยู่ลำพัง'
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="อยู่กับครอบครัว">อยู่กับครอบครัว</option>
                  <option value="อยู่กับคู่สมรสสูงอายุ">อยู่กับคู่สมรสสูงอายุ</option>
                  <option value="อยู่ลำพัง">อยู่ลำพัง</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">ผู้ดูแลหลัก</label>
                <input
                  type="text"
                  value={caregiverName}
                  onChange={(e) => setCaregiverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">โรคประจำตัว (คั่นด้วยจุลภาค)</label>
                <input
                  type="text"
                  value={chronicText}
                  onChange={(e) => setChronicText(e.target.value)}
                  placeholder="เช่น ความดันโลหิตสูง, เบาหวาน"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">อสม. ผู้คัดกรอง</label>
                <input
                  type="text"
                  value={assignedVhv}
                  onChange={(e) => setAssignedVhv(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Modular Frailty Screening Engine */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-b border-slate-200 pb-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    ส่วนที่ 2: ประเมินภาวะเปราะบาง 7 มิติ (Modular Frailty Engine — M04)
                  </h3>
                  <p className="text-xs text-slate-500">
                    เลือกเกณฑ์มาตรฐานแบบประเมินตามบริบทพื้นที่และปรับคะแนนความเสี่ยงแต่ละด้าน
                  </p>
                </div>

                <select
                  value={protocolUsed}
                  onChange={(e) => setProtocolUsed(e.target.value as FrailtyProtocolId)}
                  className="px-2.5 py-1.5 text-xs font-medium border border-teal-600 rounded-lg bg-teal-50/50 text-teal-900"
                >
                  {Object.values(FRAILTY_PROTOCOLS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">หลักฐานอ้างอิง: </span>
                {FRAILTY_PROTOCOLS[protocolUsed].referenceStandard}
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    key: 'physical' as const,
                    label: '1. Physical (น้ำหนักลดโดยไม่ตั้งใจ · แรงกล้ามเนื้ออ่อนแรง · การเดินช้า)',
                    max: 20,
                  },
                  {
                    key: 'functional' as const,
                    label: '2. Functional (ความสามารถทำกิจวัตรประจำวัน ADL/IADL ถดถอย)',
                    max: 20,
                  },
                  {
                    key: 'nutrition' as const,
                    label: '3. Nutrition (ภาวะโภชนาการ · เบื่ออาหาร · การเคี้ยวกลืน)',
                    max: 15,
                  },
                  {
                    key: 'cognitive' as const,
                    label: '4. Cognitive (การรับรู้ · ความจำ · การหลงลืมวันเวลา)',
                    max: 15,
                  },
                  {
                    key: 'social' as const,
                    label: '5. Social (การอยู่ลำพัง · ขาดผู้ดูแล · การแยกตัวทางสังคม)',
                    max: 10,
                  },
                  {
                    key: 'activity' as const,
                    label: '6. Activity (ระดับกิจกรรมทางกายต่ำ · เนือยนิ่ง)',
                    max: 10,
                  },
                  {
                    key: 'chronicDisease' as const,
                    label: '7. Chronic Disease (โรคประจำตัวหลายโรค · การใช้ยาหลายขนาน)',
                    max: 10,
                  },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between">
                      <label className="font-medium text-slate-700">{item.label}</label>
                      <span className="font-mono-num font-semibold text-slate-900">
                        {domains[item.key]} / {item.max} คะแนน
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={item.max}
                      value={domains[item.key]}
                      onChange={(e) =>
                        setDomains((prev) => ({
                          ...prev,
                          [item.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Chronic Disease Risk Factors */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  ส่วนที่ 3: ปัจจัยเสี่ยงโรคเรื้อรังและพฤติกรรมสุขภาพ (M05)
                </h3>
                <p className="text-xs text-slate-500">
                  บันทึกสัญญาณชีพ สัดส่วนร่างกาย และพฤติกรรมสุขภาพ
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">น้ำหนัก (กก.)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ส่วนสูง (ซม.)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    BMI (คำนวณอัตโนมัติ)
                  </label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono-num font-bold text-slate-900">
                    {bmi} กก./ตร.ม.
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">รอบเอว (ซม.)</label>
                  <input
                    type="number"
                    value={waist}
                    onChange={(e) => setWaist(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    ความดันตัวบน SBP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={sbp}
                    onChange={(e) => setSbp(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    ความดันตัวล่าง DBP (mmHg)
                  </label>
                  <input
                    type="number"
                    value={dbp}
                    onChange={(e) => setDbp(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">พฤติกรรมการกิน</label>
                  <select
                    value={dietaryHabit}
                    onChange={(e) =>
                      setDietaryHabit(e.target.value as ChronicRiskMetrics['dietaryHabit'])
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="normal">รสชาติปกติ ถูกสัดส่วน</option>
                    <option value="high_salt">รสเค็มจัด / อาหารหมักดอง</option>
                    <option value="high_sugar">รสหวานจัด / เครื่องดื่มชง</option>
                    <option value="high_fat">อาหารมัน / กะทิ / ของทอด</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">การออกกำลังกาย</label>
                  <select
                    value={exerciseFrequency}
                    onChange={(e) =>
                      setExerciseFrequency(
                        e.target.value as ChronicRiskMetrics['exerciseFrequency']
                      )
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="regular">สม่ำเสมอ (≥ 3 วัน/สัปดาห์)</option>
                    <option value="occasional">บางครั้ง (1–2 วัน/สัปดาห์)</option>
                    <option value="sedentary">ไม่ได้ออกกำลังกาย / เนือยนิ่ง</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">การรับประทานยา</label>
                  <select
                    value={medicationAdherence}
                    onChange={(e) =>
                      setMedicationAdherence(
                        e.target.value as ChronicRiskMetrics['medicationAdherence']
                      )
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="good">สม่ำเสมอตามแพทย์สั่ง</option>
                    <option value="irregular">ลืมกินยาบ่อย / ขาดยา</option>
                    <option value="none">ไม่ได้รับประทานยา</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">การสูบบุหรี่</label>
                  <select
                    value={smoking}
                    onChange={(e) => setSmoking(e.target.value as ChronicRiskMetrics['smoking'])}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="never">ไม่เคยสูบ</option>
                    <option value="former">เคยสูบ (เลิกแล้ว)</option>
                    <option value="current">สูบอยู่ในปัจจุบัน</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Live Real-Time Rule-Based & Risk Matrix Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  ผลวิเคราะห์ความเสี่ยงอัตโนมัติ (Real-Time Rule-Based & Risk Matrix Stratification)
                </h4>
                <p className="text-xs text-slate-500">
                  คำนวณตามเกณฑ์เครื่องมือคัดกรอง (ไม่ใช่การวินิจฉัยโรค)
                </p>
              </div>
              <div className="text-right font-mono-num">
                <span
                  className={`text-sm font-bold ${
                    riskProfile.matrixGroup === 'D'
                      ? 'text-red-700'
                      : riskProfile.matrixGroup === 'C'
                      ? 'text-orange-700'
                      : riskProfile.matrixGroup === 'B'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  จัดอยู่กลุ่ม {riskProfile.matrixGroup} — {riskProfile.matrixAction}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
              <div>
                <span className="text-slate-500">Frailty Risk Score:</span>
                <p className="font-mono-num text-base font-bold text-slate-900">
                  {riskProfile.frailtyScore}/100 ({riskProfile.frailtyRisk})
                </p>
              </div>
              <div>
                <span className="text-slate-500">Cardiovascular Risk:</span>
                <p className="text-base font-bold text-slate-900">{riskProfile.cvdRisk}</p>
              </div>
              <div>
                <span className="text-slate-500">Diabetes Risk:</span>
                <p className="text-base font-bold text-slate-900">{riskProfile.diabetesRisk}</p>
              </div>
              <div>
                <span className="text-slate-500">Nutrition Risk:</span>
                <p className="text-base font-bold text-slate-900">{riskProfile.nutritionRisk}</p>
              </div>
            </div>
          </div>

          {/* Modal Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-teal-700 text-xs font-medium text-white hover:bg-teal-800 inline-flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isOfflineMode
                  ? `บันทึกลงเครื่องแบบ Offline (${UI_LABELS.offlineSync.localQueuePending})`
                  : 'บันทึกผลคัดกรองและสร้างแผนสุขภาพ 4 สัปดาห์'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
