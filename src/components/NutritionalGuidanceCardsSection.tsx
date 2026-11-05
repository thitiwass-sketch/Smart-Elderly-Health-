import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Droplets,
  Flame,
  HeartPulse,
  Printer,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ElderProfile,
  NutritionalCardCategory,
  NutritionalGuidanceCard,
} from '../types/health';
import {
  calculateBmi,
  evaluateHealthRisk,
  generatePersonalizedNutritionalGuidance,
} from '../utils/riskEngine';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';

interface NutritionalGuidanceCardsSectionProps {
  elder: ElderProfile;
  allElders?: ElderProfile[];
  onSelectElder?: (elder: ElderProfile) => void;
  compactMode?: boolean;
}

const COUNSELED_STORAGE_KEY = 'korat_ehw_nutrition_cards_counseled_v1';

export const NutritionalGuidanceCardsSection: React.FC<
  NutritionalGuidanceCardsSectionProps
> = ({ elder, allElders = [], onSelectElder, compactMode = false }) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | NutritionalCardCategory
  >('all');
  const [viewMode, setViewMode] = useState<'cards' | 'meal_schedule'>('cards');
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [copiedAllSummary, setCopiedAllSummary] = useState(false);
  const [showGroupAPreview, setShowGroupAPreview] = useState(false);

  // Interactive Risk-Engine What-If Nutrition Simulator state
  const [showRiskSimulator, setShowRiskSimulator] = useState(false);
  const [simWeight, setSimWeight] = useState<number>(elder.chronicMetrics.weight);
  const [simSbp, setSimSbp] = useState<number>(elder.chronicMetrics.sbp);
  const [simDbp, setSimDbp] = useState<number>(elder.chronicMetrics.dbp);
  const [simDietaryHabit, setSimDietaryHabit] = useState<
    ElderProfile['chronicMetrics']['dietaryHabit']
  >(elder.chronicMetrics.dietaryHabit);
  const [simNutritionDomain, setSimNutritionDomain] = useState<number>(
    elder.frailtyDomains.nutrition
  );

  // Persistent counseled status per card ID
  const [counseledCards, setCounseledCards] = useState<Record<string, string>>(
    () => {
      if (typeof window === 'undefined') return {};
      try {
        const raw = window.localStorage.getItem(COUNSELED_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );

  useEffect(() => {
    setSimWeight(elder.chronicMetrics.weight);
    setSimSbp(elder.chronicMetrics.sbp);
    setSimDbp(elder.chronicMetrics.dbp);
    setSimDietaryHabit(elder.chronicMetrics.dietaryHabit);
    setSimNutritionDomain(elder.frailtyDomains.nutrition);
    setSelectedCategory('all');
    setShowGroupAPreview(false);
    return () => {
      stopSpeakingThai();
      setSpeakingCardId(null);
    };
  }, [elder.id]);

  // Compute effective elder profile (either live elder profile or simulated adjustments)
  const effectiveElderInput = useMemo(() => {
    if (!showRiskSimulator) {
      return elder;
    }
    const updatedBmi = calculateBmi(simWeight, elder.chronicMetrics.height);
    const updatedDomains = {
      ...elder.frailtyDomains,
      nutrition: simNutritionDomain,
    };
    const updatedMetrics = {
      ...elder.chronicMetrics,
      weight: simWeight,
      bmi: updatedBmi,
      sbp: simSbp,
      dbp: simDbp,
      dietaryHabit: simDietaryHabit,
    };
    const evaluated = evaluateHealthRisk(
      updatedDomains,
      updatedMetrics,
      elder.gender,
      elder.livingArrangement,
      elder.protocolUsed
    );
    return {
      ...elder,
      frailtyDomains: updatedDomains,
      chronicMetrics: updatedMetrics,
      riskProfile: evaluated.riskProfile,
      ruleAudit: evaluated.ruleAudit,
    };
  }, [
    elder,
    showRiskSimulator,
    simWeight,
    simSbp,
    simDbp,
    simDietaryHabit,
    simNutritionDomain,
  ]);

  const guidanceProfile = useMemo(
    () => generatePersonalizedNutritionalGuidance(effectiveElderInput),
    [effectiveElderInput]
  );

  const filteredCards = useMemo(() => {
    if (selectedCategory === 'all') return guidanceProfile.cards;
    return guidanceProfile.cards.filter((c) => c.category === selectedCategory);
  }, [guidanceProfile.cards, selectedCategory]);

  const bcdElders = useMemo(
    () =>
      allElders.filter(
        (e) =>
          e.riskProfile.matrixGroup === 'B' ||
          e.riskProfile.matrixGroup === 'C' ||
          e.riskProfile.matrixGroup === 'D'
      ),
    [allElders]
  );

  const handleToggleCounselCard = (cardId: string) => {
    setCounseledCards((prev) => {
      const next = { ...prev };
      if (next[cardId]) {
        delete next[cardId];
      } else {
        next[cardId] = new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      try {
        window.localStorage.setItem(COUNSELED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleSpeakCard = (card: NutritionalGuidanceCard) => {
    if (speakingCardId === card.id) {
      stopSpeakingThai();
      setSpeakingCardId(null);
      return;
    }
    const script = `${card.title} สำหรับ ${elder.name} กลุ่มความเสี่ยง ${guidanceProfile.matrixGroup}. เป้าหมายรายวันคือ ${card.dailyTargetMetric}. เมนูท้องถิ่นโคราชที่แนะนำ ได้แก่ ${card.koratLocalMenuExamples.join(' และ ')}. คำแนะนำสำหรับผู้ดูแลคือ ${card.caregiverAndVhvInstruction}`;
    setSpeakingCardId(card.id);
    speakThaiText(
      script,
      () => setSpeakingCardId(null),
      () => setSpeakingCardId(null)
    );
  };

  const handleCopyCardText = async (card: NutritionalGuidanceCard) => {
    const text = [
      `🥗 [${card.cardCode}] ${card.title}`,
      `ผู้สูงอายุ: ${elder.name} (อายุ ${elder.age} ปี · กลุ่มความเสี่ยง Group ${guidanceProfile.matrixGroup})`,
      `เกณฑ์อ้างอิง Risk Engine: ${card.triggeredByProfile}`,
      `เป้าหมายต่อวัน: ${card.dailyTargetMetric}`,
      `เมนูท้องถิ่นโคราชแนะนำ: ${card.koratLocalMenuExamples.join(' | ')}`,
      `อาหารที่ควรเน้น: ${card.foodsToPrioritize.join(' / ')}`,
      `อาหารที่ควรเลี่ยง: ${card.foodsToAvoid.join(' / ')}`,
      `คำแนะนำผู้ดูแล/อสม.: ${card.caregiverAndVhvInstruction}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedCardId(card.id);
    setTimeout(() => setCopiedCardId(null), 2200);
  };

  const handleCopyAllGuidanceSummary = async () => {
    const fullText = [
      `📋 บัตรคำแนะนำโภชนาการเฉพาะบุคคล (Personalized Nutritional Guidance Cards)`,
      `ชื่อ-สกุล: ${elder.name} (อายุ ${elder.age} ปี · รหัส ${elder.id})`,
      `กลุ่มความเสี่ยง: Group ${guidanceProfile.matrixGroup} — ${guidanceProfile.groupNutritionalStrategyTitle}`,
      `เป้าหมายรายวัน: พลังงาน ${guidanceProfile.dailyCalorieTargetKcal} kcal | โปรตีน ${guidanceProfile.dailyProteinTargetGrams} กรัม/วัน | โซเดียม ≤ ${guidanceProfile.dailySodiumLimitMg} มก./วัน | น้ำดื่ม ${guidanceProfile.dailyFluidTargetMl} มล./วัน`,
      `สัดส่วนจานอาหาร: ${guidanceProfile.plateRatioModel.label}`,
      `---`,
      ...guidanceProfile.cards.map(
        (c, i) =>
          `${i + 1}. [${c.cardCode}] ${c.title}\n   • เป้าหมาย: ${c.dailyTargetMetric}\n   • เมนูแนะนำ: ${c.koratLocalMenuExamples.slice(0, 2).join(', ')}\n   • การดูแล: ${c.caregiverAndVhvInstruction}`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      // fallback
    }
    setCopiedAllSummary(true);
    setTimeout(() => setCopiedAllSummary(false), 2500);
  };

  const handleResetSimulation = () => {
    setSimWeight(elder.chronicMetrics.weight);
    setSimSbp(elder.chronicMetrics.sbp);
    setSimDbp(elder.chronicMetrics.dbp);
    setSimDietaryHabit(elder.chronicMetrics.dietaryHabit);
    setSimNutritionDomain(elder.frailtyDomains.nutrition);
  };

  const counseledCount = guidanceProfile.cards.filter(
    (c) => Boolean(counseledCards[c.id])
  ).length;

  // Group A Notice (Since feature specifically targets elders in Groups B, C, and D)
  if (!guidanceProfile.isEligibleGroupBCD && !showGroupAPreview) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-emerald-800">
                  Personalized Nutritional Guidance Cards (เฉพาะกลุ่มเสี่ยง B, C และ D)
                </span>
                <span aria-hidden="true">·</span>
                <span>สถานะปัจจุบันของ {elder.name}: กลุ่ม A (ความเสี่ยงต่ำ)</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                3.5 บัตรคำแนะนำโภชนาการเฉพาะบุคคลจากโปรไฟล์ความเสี่ยง (Nutritional Guidance Cards)
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                ระบบจะสร้างการ์ดโภชนาการคลินิกเฉพาะบุคคลโดยอัตโนมัติสำหรับผู้สูงอายุใน{' '}
                <span className="font-semibold text-slate-900">
                  กลุ่ม B (ระยะเริ่มเปราะบาง), กลุ่ม C (ความเสี่ยงโรคเรื้อรังสูง) และกลุ่ม D (ภาวะเปราะบางและเสี่ยงสูงมาก)
                </span>{' '}
                ทั้งนี้ {elder.name} อยู่ในกลุ่ม A ซึ่งสามารถคงโภชนาการสมดุล 2:1:1 ตามปกติได้
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGroupAPreview(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            ดูการ์ดโภชนาการป้องกันล่วงหน้า
          </button>
        </div>

        {bcdElders.length > 0 && onSelectElder && (
          <div className="pt-3 border-t border-slate-200/80">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              คลิกสลับไปดูแฟ้มดิจิทัลของผู้สูงอายุกลุ่ม B, C หรือ D เพื่อตรวจสอบการ์ดโภชนาการเฉพาะบุคคล:
            </p>
            <div className="flex flex-wrap gap-2">
              {bcdElders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectElder(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5 text-teal-700" />
                  <span>{item.name}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-mono-num font-bold ${
                      item.riskProfile.matrixGroup === 'D'
                        ? 'text-red-700'
                        : item.riskProfile.matrixGroup === 'C'
                        ? 'text-orange-700'
                        : 'text-amber-700'
                    }`}
                  >
                    Group {item.riskProfile.matrixGroup}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      id="nutritional-guidance-cards-section"
      className={`rounded-2xl border p-5 space-y-5 ${
        guidanceProfile.matrixGroup === 'D'
          ? 'bg-rose-50/40 border-rose-200'
          : guidanceProfile.matrixGroup === 'C'
          ? 'bg-orange-50/40 border-orange-200'
          : guidanceProfile.matrixGroup === 'B'
          ? 'bg-amber-50/40 border-amber-200'
          : 'bg-emerald-50/40 border-emerald-200'
      }`}
    >
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              guidanceProfile.matrixGroup === 'D'
                ? 'bg-red-600 text-white'
                : guidanceProfile.matrixGroup === 'C'
                ? 'bg-orange-600 text-white'
                : 'bg-amber-500 text-slate-950'
            }`}
          >
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span
                className={`font-bold ${
                  guidanceProfile.matrixGroup === 'D'
                    ? 'text-red-700'
                    : guidanceProfile.matrixGroup === 'C'
                    ? 'text-orange-700'
                    : 'text-amber-800'
                }`}
              >
                Personalized Nutritional Guidance Cards · Group {guidanceProfile.matrixGroup}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">
                ประมวลผลจาก Risk Engine ({guidanceProfile.cards.length} การ์ดเฉพาะบุคคล)
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-teal-800 font-semibold">
                ส่งมอบคำแนะนำแล้ว {counseledCount}/{guidanceProfile.cards.length} การ์ด
              </span>
            </div>

            <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              3.5 บัตรคำแนะนำโภชนาการเฉพาะบุคคล (Risk-Driven Nutritional Guidance Cards)
            </h3>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              {guidanceProfile.groupNutritionalStrategySummary}
            </p>
          </div>
        </div>

        {/* Top Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!compactMode && (
            <button
              type="button"
              onClick={() => setShowRiskSimulator((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showRiskSimulator
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>
                {showRiskSimulator
                  ? 'ปิดโหมดจำลองปรับค่าความเสี่ยง'
                  : 'จำลองปรับค่า Risk Engine'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyAllGuidanceSummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {copiedAllSummary ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>คัดลอกชุดการ์ดโภชนาการแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกสรุปส่งผู้ดูแล/อสม.</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional Interactive Risk Engine Nutrition Simulator Drawer */}
      {showRiskSimulator && (
        <div className="rounded-xl bg-white border border-slate-300 p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  จำลองการเปลี่ยนแปลงโปรไฟล์ความเสี่ยงเพื่อคำนวณการ์ดโภชนาการใหม่แบบ Real-time
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ทดลองปรับน้ำหนัก ความดันโลหิต หรือพฤติกรรมการบริโภคเพื่อดูการปรับเป้าหมายโปรตีน โซเดียม และเนื้อหาในการ์ดอัตโนมัติ
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetSimulation}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>คืนค่าจริงของ {elder.name}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                น้ำหนักตัว (กก.) · BMI{' '}
                {calculateBmi(simWeight, elder.chronicMetrics.height)}
              </label>
              <input
                type="number"
                step="0.5"
                min={32}
                max={110}
                value={simWeight}
                onChange={(e) => setSimWeight(Number(e.target.value) || 45)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono-num text-slate-900 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                ความดัน SBP / DBP (mmHg)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={90}
                  max={220}
                  value={simSbp}
                  onChange={(e) => setSimSbp(Number(e.target.value) || 130)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono-num text-slate-900 bg-slate-50"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="number"
                  min={50}
                  max={140}
                  value={simDbp}
                  onChange={(e) => setSimDbp(Number(e.target.value) || 80)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono-num text-slate-900 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                คะแนนความเสี่ยงโภชนาการ ({simNutritionDomain}/15)
              </label>
              <input
                type="range"
                min={0}
                max={15}
                value={simNutritionDomain}
                onChange={(e) => setSimNutritionDomain(Number(e.target.value))}
                className="w-full accent-teal-700 mt-2 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                พฤติกรรมการบริโภคหลัก
              </label>
              <select
                value={simDietaryHabit}
                onChange={(e) =>
                  setSimDietaryHabit(
                    e.target.value as ElderProfile['chronicMetrics']['dietaryHabit']
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 bg-slate-50"
              >
                <option value="normal">รสชาติปกติ (สมดุล)</option>
                <option value="high_salt">รสเค็มจัด / อาหารหมักดอง</option>
                <option value="high_sugar">ติดรสหวาน / เครื่องดื่มชง</option>
                <option value="high_fat">อาหารมัน / ของทอด / กะทิ</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Daily Nutritional Targets & Plate Ratio Model Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>โปรตีนเป้าหมาย/วัน</span>
            <Scale className="w-4 h-4 text-teal-700" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono-num">
            {guidanceProfile.dailyProteinTargetGrams} กรัม/วัน
          </p>
          <p className="text-[11px] text-slate-600 font-mono-num">
            ({guidanceProfile.proteinPerKgRatio} ก. ต่อ นน.ตัว 1 กก.)
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>พลังงานเหมาะสม/วัน</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono-num">
            {guidanceProfile.dailyCalorieTargetKcal.toLocaleString()} kcal
          </p>
          <p className="text-[11px] text-slate-600">
            BMI ปัจจุบัน {effectiveElderInput.chronicMetrics.bmi} กก./ตร.ม.
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>เพดานโซเดียมสูงสุด</span>
            <HeartPulse className="w-4 h-4 text-red-600" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono-num">
            ≤ {guidanceProfile.dailySodiumLimitMg.toLocaleString()} มก.
          </p>
          <p className="text-[11px] text-slate-600 font-mono-num">
            BP {effectiveElderInput.chronicMetrics.sbp}/
            {effectiveElderInput.chronicMetrics.dbp} mmHg
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>น้ำสะอาดที่ควรดื่ม</span>
            <Droplets className="w-4 h-4 text-sky-600" />
          </div>
          <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono-num">
            {guidanceProfile.dailyFluidTargetMl.toLocaleString()} มล./วัน
          </p>
          <p className="text-[11px] text-slate-600">
            จิบต่อเนื่อง 7–8 แก้วตลอดวัน
          </p>
        </div>
      </div>

      {/* Personalized Plate Ratio Bar */}
      <div className="rounded-xl bg-white border border-slate-200/90 p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <span className="font-bold text-slate-900">
            สัดส่วนจานอาหารเฉพาะบุคคล: {guidanceProfile.plateRatioModel.label}
          </span>
          <span className="text-slate-500 font-mono-num">
            ผัก {guidanceProfile.plateRatioModel.vegPercent}% · โปรตีน{' '}
            {guidanceProfile.plateRatioModel.proteinPercent}% · ข้าวไม่ขัดสี{' '}
            {guidanceProfile.plateRatioModel.carbPercent}%
          </span>
        </div>

        <div className="w-full h-3.5 rounded-lg overflow-hidden flex border border-slate-200">
          <div
            style={{ width: `${guidanceProfile.plateRatioModel.vegPercent}%` }}
            className="bg-emerald-600 h-full transition-all duration-300"
            title={`ผักใบเขียวและผักพื้นบ้าน ${guidanceProfile.plateRatioModel.vegPercent}%`}
          />
          <div
            style={{ width: `${guidanceProfile.plateRatioModel.proteinPercent}%` }}
            className="bg-teal-500 h-full transition-all duration-300"
            title={`โปรตีนปลา/ไข่/เต้าหู้ ${guidanceProfile.plateRatioModel.proteinPercent}%`}
          />
          <div
            style={{ width: `${guidanceProfile.plateRatioModel.carbPercent}%` }}
            className="bg-amber-500 h-full transition-all duration-300"
            title={`ข้าวกล้อง/คาร์โบไฮเดรตเชิงซ้อน ${guidanceProfile.plateRatioModel.carbPercent}%`}
          />
        </div>

        <p className="text-xs text-slate-600">
          {guidanceProfile.plateRatioModel.description}
        </p>
      </div>

      {/* Interactive Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/90 border border-slate-200 rounded-xl">
          {[
            { id: 'all' as const, label: `ทั้งหมด (${guidanceProfile.cards.length})` },
            { id: 'protein_sarcopenia' as const, label: 'โปรตีน/กล้ามเนื้อ' },
            { id: 'sodium_bp_control' as const, label: 'ลดเค็ม/ความดัน' },
            { id: 'glycemic_metabolic' as const, label: 'น้ำตาล/พลังงาน' },
            { id: 'hydration_swallowing_bone' as const, label: 'การกลืน/น้ำดื่ม/ยา' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/90 border border-slate-200 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            แผ่นการ์ดโภชนาการ
          </button>
          <button
            type="button"
            onClick={() => setViewMode('meal_schedule')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'meal_schedule'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ตารางจัดมื้ออาหาร 1 วัน
          </button>
        </div>
      </div>

      {/* View Mode 1: Personalized Nutritional Guidance Cards Grid */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredCards.map((card) => {
            const isSpeakingThis = speakingCardId === card.id;
            const isCopiedThis = copiedCardId === card.id;
            const counseledTime = counseledCards[card.id];

            return (
              <article
                key={card.id}
                className="rounded-xl bg-white border border-slate-200/90 p-5 shadow-2xs space-y-4 transition-all"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-num font-bold text-slate-900">
                        {card.cardCode}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-medium text-teal-800">
                        {card.categoryLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span
                        className={`font-semibold ${
                          card.priority === 'Critical'
                            ? 'text-red-700'
                            : card.priority === 'High'
                            ? 'text-orange-700'
                            : 'text-amber-700'
                        }`}
                      >
                        ระดับความสำคัญ: {card.priority}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      {card.title}
                    </h4>
                    <p className="text-xs text-slate-600">{card.subtitle}</p>
                  </div>

                  {/* Interactive Card Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSpeakCard(card)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isSpeakingThis
                          ? 'bg-amber-50 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isSpeakingThis ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-amber-700" />
                          <span>หยุดเสียง</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                          <span>ฟังเสียงการ์ดนี้</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyCardText(card)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      {isCopiedThis ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>คัดลอกการ์ด</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleCounselCard(card.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        counseledTime
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {counseledTime
                          ? `แนะนำผู้ดูแลแล้ว (${counseledTime})`
                          : 'ยืนยันส่งมอบคำแนะนำ'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Risk Engine Trigger & Daily Target Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="font-semibold text-slate-900 block">
                      ปัจจัยตั้งต้นจาก Risk Engine (Profile Trigger):
                    </span>
                    <span className="font-mono-num text-slate-600 mt-0.5 block">
                      {card.triggeredByProfile}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200/80">
                    <span className="font-semibold text-teal-950 block">
                      เป้าหมายโภชนาการรายวัน (Daily Clinical Target):
                    </span>
                    <span className="font-mono-num font-bold text-teal-900 mt-0.5 block">
                      {card.dailyTargetMetric}
                    </span>
                  </div>
                </div>

                {/* Korat Local Menu Examples */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs space-y-2">
                  <p className="font-bold text-slate-900">
                    เมนูอาหารท้องถิ่นโคราช/อาหารผู้สูงวัยที่แนะนำสำหรับ {elder.name}:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {card.koratLocalMenuExamples.map((menu, mIdx) => (
                      <div
                        key={mIdx}
                        className="flex items-start gap-2 bg-white/90 p-2.5 rounded-lg border border-amber-200/60 text-slate-800"
                      >
                        <span className="font-mono-num font-bold text-amber-800 shrink-0">
                          0{mIdx + 1}.
                        </span>
                        <span>{menu}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prioritize vs Avoid Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/80 space-y-2">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>อาหารและแนวทางที่ควรเน้น (Prioritize)</span>
                    </p>
                    <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                      {card.foodsToPrioritize.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/80 space-y-2">
                    <p className="font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>อาหารและพฤติกรรมที่ควรหลีกเลี่ยง (Avoid)</span>
                    </p>
                    <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                      {card.foodsToAvoid.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Caregiver & VHV Actionable Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
                  <div>
                    <span className="font-bold text-slate-900">
                      แนวทางปฏิบัติสำหรับผู้ดูแลและ อสม.:{' '}
                    </span>
                    <span>{card.caregiverAndVhvInstruction}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* View Mode 2: Consolidated Daily Meal Schedule across all cards */
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                ตารางจัดมื้ออาหารประจำวันสำหรับ {elder.name} (กลุ่ม {guidanceProfile.matrixGroup})
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                บูรณาการจากการ์ดโภชนาการทั้ง {guidanceProfile.cards.length} ด้าน เพื่อให้ผู้ดูแล ({elder.caregiverName}) ใช้จัดเตรียมอาหารในแต่ละมื้อ
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer self-start"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ตารางอาหาร</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {[
              {
                mealKey: 'breakfast' as const,
                mealTitle: 'มื้อเช้า (07:00 – 08:30 น.)',
                focusNote: 'เน้นโปรตีนย่อยง่ายและรับประทานยาหลังอาหารเช้าให้ครบถ้วน',
              },
              {
                mealKey: 'lunch' as const,
                mealTitle: 'มื้อกลางวัน (12:00 – 13:00 น.)',
                focusNote: 'เน้นสัดส่วนผักพื้นบ้าน ปลานึ่ง/ต้ม และลดการปรุงเค็มจัด',
              },
              {
                mealKey: 'snackOrHydration' as const,
                mealTitle: 'มื้อว่างบ่ายและการดื่มน้ำ (15:00 – 16:00 น.)',
                focusNote: 'เสริมโปรตีนหลังบริหารกายภาพและจิบน้ำสะอาดต่อเนื่อง',
              },
              {
                mealKey: 'dinner' as const,
                mealTitle: 'มื้อเย็น (17:30 – 18:30 น.)',
                focusNote: 'อาหารเนื้อสัมผัสนุ่มย่อยง่าย รสอ่อน และนั่งตัวตรงหลังมื้ออาหาร 30 นาที',
              },
            ].map((slot) => (
              <div key={slot.mealKey} className="py-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    {slot.mealTitle}
                  </span>
                  <span className="text-teal-800 font-medium">{slot.focusNote}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {guidanceProfile.cards.map((c) => (
                    <div
                      key={c.id + slot.mealKey}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                    >
                      <span className="font-mono-num font-bold text-slate-900 block text-[11px]">
                        [{c.cardCode}] {c.categoryLabel}
                      </span>
                      <p className="text-slate-700 mt-0.5">
                        {c.mealTimingGuide[slot.mealKey]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
