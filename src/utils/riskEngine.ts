import {
  ChronicRiskMetrics,
  ElderProfile,
  FrailtyDomainScores,
  FrailtyProtocolId,
  MatrixGroup,
  MedicationScheduleItem,
  MedicationTimelineProfile,
  MissedDoseRiskFlagLevel,
  NutritionalGuidanceCard,
  PersonalHealthPlan,
  PersonalizedNutritionalGuidanceProfile,
  RiskLevel,
  RiskProfile,
  RuleTrigger,
} from '../types/health';

export interface ProtocolMetadata {
  id: FrailtyProtocolId;
  name: string;
  shortName: string;
  referenceStandard: string;
  description: string;
  weights: {
    physical: number;
    functional: number;
    nutrition: number;
    cognitive: number;
    social: number;
    activity: number;
    chronicDisease: number;
  };
}

export const FRAILTY_PROTOCOLS: Record<FrailtyProtocolId, ProtocolMetadata> = {
  moph_7d: {
    id: 'moph_7d',
    name: 'เกณฑ์คัดกรองสุขภาวะผู้สูงอายุ 7 มิติ (บริบทชุมชนไทย)',
    shortName: 'MOPH 7-Domain',
    referenceStandard: 'แนวทางคัดกรองผู้สูงอายุ กรมอนามัย กระทรวงสาธารณสุข บูรณาการ 7 ด้าน',
    description: 'ประเมินครอบคลุม กายภาพ กิจวัตร โภชนาการ ความจำ สังคม กิจกรรมทางกาย และโรคเรื้อรัง เหมาะสำหรับ อสม. ลงพื้นที่',
    weights: {
      physical: 1.0,
      functional: 1.0,
      nutrition: 1.0,
      cognitive: 1.0,
      social: 1.0,
      activity: 1.0,
      chronicDisease: 1.0,
    },
  },
  fried_5d: {
    id: 'fried_5d',
    name: 'Fried Frailty Phenotype (เน้นสมรรถภาพทางกาย)',
    shortName: 'Fried Phenotype',
    referenceStandard: 'Fried et al. (Cardiovascular Health Study) — น้ำหนักลด แรงบีบมือ ความเหนื่อยล้า การเดิน กิจกรรมทางกาย',
    description: 'ให้น้ำหนักสูงกับภาวะมวลกล้ามเนื้อลดลง (Sarcopenia) ความเร็วในการเดิน และระดับพลังงานทางกาย',
    weights: {
      physical: 1.35,
      functional: 1.15,
      nutrition: 1.1,
      cognitive: 0.6,
      social: 0.5,
      activity: 1.3,
      chronicDisease: 0.8,
    },
  },
  tfi_15: {
    id: 'tfi_15',
    name: 'Tilburg Frailty Indicator (TFI — กาย จิต สังคม)',
    shortName: 'Tilburg TFI',
    referenceStandard: 'Gobbens et al. — Multidimensional Frailty (Physical, Psychological, Social)',
    description: 'เพิ่มน้ำหนักด้านการอยู่ลำพัง ความเปราะบางทางสังคม และการรับรู้/อารมณ์ สำหรับผู้สูงอายุในเขตเมืองและกึ่งเมือง',
    weights: {
      physical: 0.95,
      functional: 0.95,
      nutrition: 0.9,
      cognitive: 1.25,
      social: 1.45,
      activity: 0.9,
      chronicDisease: 0.9,
    },
  },
};

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (!heightCm || heightCm <= 0) return 0;
  const hMeter = heightCm / 100;
  return Number((weightKg / (hMeter * hMeter)).toFixed(1));
}

export function evaluateHealthRisk(
  domains: FrailtyDomainScores,
  metrics: ChronicRiskMetrics,
  gender: 'หญิง' | 'ชาย',
  livingArrangement: string,
  protocolId: FrailtyProtocolId = 'moph_7d'
): {
  riskProfile: RiskProfile;
  ruleAudit: RuleTrigger[];
} {
  const protocol = FRAILTY_PROTOCOLS[protocolId] || FRAILTY_PROTOCOLS.moph_7d;
  const w = protocol.weights;

  const weightedSum =
    domains.physical * w.physical +
    domains.functional * w.functional +
    domains.nutrition * w.nutrition +
    domains.cognitive * w.cognitive +
    domains.social * w.social +
    domains.activity * w.activity +
    domains.chronicDisease * w.chronicDisease;

  const maxPossible =
    20 * w.physical +
    20 * w.functional +
    15 * w.nutrition +
    15 * w.cognitive +
    10 * w.social +
    10 * w.activity +
    10 * w.chronicDisease;

  const frailtyScore = Math.min(100, Math.max(0, Math.round((weightedSum / maxPossible) * 100)));

  let frailtyRisk: RiskLevel = 'Low';
  if (frailtyScore >= 55) {
    frailtyRisk = 'High';
  } else if (frailtyScore >= 30) {
    frailtyRisk = 'Moderate';
  }

  const ruleAudit: RuleTrigger[] = [];

  // Layer 1 Rule-Based Frailty Checks
  if (frailtyRisk === 'High') {
    ruleAudit.push({
      code: 'RULE-F01',
      layer: 'Frailty Engine',
      condition: `IF Frailty Score (${frailtyScore}/100) ≥ 55 [${protocol.shortName}]`,
      action: 'จัดอยู่ในกลุ่มความเสี่ยงภาวะเปราะบางระดับสูง (High Frailty Risk)',
      severity: 'High',
    });
  } else if (frailtyRisk === 'Moderate') {
    ruleAudit.push({
      code: 'RULE-F02',
      layer: 'Frailty Engine',
      condition: `IF Frailty Score (${frailtyScore}/100) อยู่ในช่วง 30–54`,
      action: 'จัดอยู่ในระยะเริ่มเปราะบาง (Pre-Frailty / Moderate Risk) ควรฟื้นฟูสมรรถภาพ 4 สัปดาห์',
      severity: 'Moderate',
    });
  } else {
    ruleAudit.push({
      code: 'RULE-F03',
      layer: 'Frailty Engine',
      condition: `IF Frailty Score (${frailtyScore}/100) < 30`,
      action: 'ความเสี่ยงภาวะเปราะบางต่ำ (Low Frailty Risk) เน้นส่งเสริมสุขภาพต่อเนื่อง',
      severity: 'Low',
    });
  }

  if (domains.functional >= 12 && domains.physical >= 12) {
    ruleAudit.push({
      code: 'RULE-F04',
      layer: 'Frailty Engine',
      condition: `IF Physical Decline (${domains.physical}/20) ≥ 12 AND Functional ADL Decline (${domains.functional}/20) ≥ 12`,
      action: 'แนะนำประเมินคลินิกกายภาพและความเสี่ยงพลัดตกหกล้มโดยเจ้าหน้าที่ รพ.สต.',
      severity: 'High',
    });
  }

  if (livingArrangement === 'อยู่ลำพัง' && domains.social >= 6) {
    ruleAudit.push({
      code: 'RULE-S01',
      layer: 'Frailty Engine',
      condition: 'IF Living Arrangement = อยู่ลำพัง AND Social Vulnerability ≥ 6/10',
      action: 'กำหนดให้ อสม. เยี่ยมบ้านเชิงรุกและประสานเพื่อนบ้าน/เครือข่ายดูแลในชุมชน',
      severity: 'Moderate',
    });
  }

  // Chronic Disease Risk Sub-engines
  // 1. Cardiovascular Risk (BP, smoking, exercise, salt, adherence)
  let cvdPoints = 0;
  if (metrics.sbp >= 160 || metrics.dbp >= 100) cvdPoints += 50;
  else if (metrics.sbp >= 140 || metrics.dbp >= 90) cvdPoints += 30;
  else if (metrics.sbp >= 130 || metrics.dbp >= 85) cvdPoints += 15;

  if (metrics.smoking === 'current') cvdPoints += 20;
  else if (metrics.smoking === 'former') cvdPoints += 8;

  if (metrics.dietaryHabit === 'high_salt' || metrics.dietaryHabit === 'high_fat') cvdPoints += 12;
  if (metrics.exerciseFrequency === 'sedentary') cvdPoints += 10;
  if (metrics.medicationAdherence === 'irregular' || metrics.medicationAdherence === 'none') cvdPoints += 18;

  const cvdRisk: RiskLevel = cvdPoints >= 50 ? 'High' : cvdPoints >= 25 ? 'Moderate' : 'Low';

  if (metrics.sbp >= 160 || metrics.dbp >= 100) {
    ruleAudit.push({
      code: 'RULE-C01',
      layer: 'Chronic Risk Engine',
      condition: `IF Blood Pressure (${metrics.sbp}/${metrics.dbp} mmHg) ≥ 160/100 mmHg`,
      action: 'ความเสี่ยงหลอดเลือดและหัวใจสูง (High Cardiovascular Risk) ต้องวัดซ้ำและส่งต่อ รพ.สต.',
      severity: 'High',
    });
  } else if (metrics.sbp >= 140 || metrics.dbp >= 90) {
    ruleAudit.push({
      code: 'RULE-C02',
      layer: 'Chronic Risk Engine',
      condition: `IF Blood Pressure (${metrics.sbp}/${metrics.dbp} mmHg) ≥ 140/90 mmHg`,
      action: 'ความดันโลหิตสูงกว่าเกณฑ์เฝ้าระวัง แนะนำลดอาหารเค็มและให้ อสม. ติดตามความดันใน 7 วัน',
      severity: 'Moderate',
    });
  }

  // 2. Diabetes & Metabolic Risk (BMI, Waist, Sugar habit, Family history, Exercise)
  let dmPoints = 0;
  const waistLimit = gender === 'ชาย' ? 90 : 80;
  if (metrics.bmi >= 27.5) dmPoints += 30;
  else if (metrics.bmi >= 23.0) dmPoints += 18;

  if (metrics.waist >= waistLimit + 8) dmPoints += 25;
  else if (metrics.waist >= waistLimit) dmPoints += 15;

  if (metrics.dietaryHabit === 'high_sugar') dmPoints += 20;
  if (metrics.familyHistory) dmPoints += 15;
  if (metrics.exerciseFrequency === 'sedentary') dmPoints += 12;
  if (domains.chronicDisease >= 6) dmPoints += 12;

  const diabetesRisk: RiskLevel = dmPoints >= 50 ? 'High' : dmPoints >= 28 ? 'Moderate' : 'Low';

  if (diabetesRisk === 'High') {
    ruleAudit.push({
      code: 'RULE-C03',
      layer: 'Chronic Risk Engine',
      condition: `IF BMI (${metrics.bmi}) / รอบเอว (${metrics.waist} ซม.) เกินเกณฑ์ร่วมกับปัจจัยเสี่ยงเมตาบอลิก`,
      action: 'ความเสี่ยงเบาหวานและเมตาบอลิกสูง (High Diabetes Risk) แนะนำคัดกรองน้ำตาลปลายนิ้ว (DTX)',
      severity: 'High',
    });
  }

  // 3. Nutrition Risk (Underweight BMI < 18.5 or high nutrition domain deficit or severe obesity)
  let nutPoints = domains.nutrition * 4;
  if (metrics.bmi < 18.5) nutPoints += 40;
  else if (metrics.bmi < 20.0) nutPoints += 20;
  else if (metrics.bmi >= 28.0) nutPoints += 20;

  const nutritionRisk: RiskLevel = nutPoints >= 50 ? 'High' : nutPoints >= 26 ? 'Moderate' : 'Low';

  if (metrics.bmi < 18.5 || domains.nutrition >= 10) {
    ruleAudit.push({
      code: 'RULE-N01',
      layer: 'Chronic Risk Engine',
      condition: `IF BMI (${metrics.bmi} กก./ตร.ม.) < 18.5 OR คะแนนความเสี่ยงโภชนาการ (${domains.nutrition}/15) ≥ 10`,
      action: 'ความเสี่ยงภาวะทุพโภชนาการ/มวลกล้ามเนื้อพร่อง แนะนำเพิ่มโปรตีนมื้อหลักและติดตามน้ำหนัก',
      severity: nutritionRisk,
    });
  }

  // Composite Chronic Risk Score & Level
  const chronicScore = Math.min(100, Math.round(Math.max(cvdPoints, dmPoints, nutPoints * 0.85)));
  let chronicRisk: RiskLevel = 'Low';
  if (cvdRisk === 'High' || diabetesRisk === 'High' || chronicScore >= 52) {
    chronicRisk = 'High';
  } else if (cvdRisk === 'Moderate' || diabetesRisk === 'Moderate' || nutritionRisk === 'High' || chronicScore >= 28) {
    chronicRisk = 'Moderate';
  }

  // Community Health Risk Matrix Stratification (Groups A, B, C, D)
  let matrixGroup: MatrixGroup = 'A';
  let matrixAction = 'ส่งเสริมสุขภาพ';
  let priorityTier: RiskProfile['priorityTier'] = 'promotion';

  if (frailtyRisk === 'High' && (chronicRisk === 'High' || chronicRisk === 'Moderate')) {
    matrixGroup = 'D';
    matrixAction = 'ประเมินคลินิก/ส่งต่อ รพ.สต.';
    priorityTier = 'urgent';
  } else if (frailtyRisk === 'High') {
    matrixGroup = 'D';
    matrixAction = 'ประเมินคลินิก/ส่งต่อ รพ.สต.';
    priorityTier = 'urgent';
  } else if (chronicRisk === 'High') {
    matrixGroup = 'C';
    matrixAction = 'เฝ้าระวังใกล้ชิดภายใน 7 วัน';
    priorityTier = 'within_7d';
  } else if (frailtyRisk === 'Moderate' || chronicRisk === 'Moderate') {
    matrixGroup = 'B';
    matrixAction = 'ติดตามตามรอบโดย อสม.';
    priorityTier = 'routine';
  } else {
    matrixGroup = 'A';
    matrixAction = 'ส่งเสริมสุขภาพระดับชุมชน';
    priorityTier = 'promotion';
  }

  ruleAudit.push({
    code: `MATRIX-${matrixGroup}`,
    layer: 'Matrix Stratification',
    condition: `IF Frailty Risk = ${frailtyRisk} AND Chronic Risk = ${chronicRisk}`,
    action: `จัดกลุ่ม Community Health Risk Matrix = กลุ่ม ${matrixGroup} (${matrixAction})`,
    severity: matrixGroup === 'D' ? 'High' : matrixGroup === 'C' || matrixGroup === 'B' ? 'Moderate' : 'Low',
  });

  return {
    riskProfile: {
      frailtyScore,
      frailtyRisk,
      chronicScore,
      chronicRisk,
      cvdRisk,
      diabetesRisk,
      nutritionRisk,
      matrixGroup,
      matrixAction,
      priorityTier,
    },
    ruleAudit,
  };
}

export function buildDeterministicHealthPlan(
  elderName: string,
  riskProfile: RiskProfile,
  domains: FrailtyDomainScores,
  metrics: ChronicRiskMetrics
): PersonalHealthPlan {
  const isHighFrailty = riskProfile.frailtyRisk === 'High';
  const isModFrailty = riskProfile.frailtyRisk === 'Moderate';
  const isHighBp = metrics.sbp >= 140 || metrics.dbp >= 90;
  const isLowWeight = metrics.bmi < 19.5 || riskProfile.nutritionRisk !== 'Low';

  const executiveSummary =
    riskProfile.matrixGroup === 'D'
      ? `${elderName} อยู่ในกลุ่มความเสี่ยง D (ภาวะเปราะบาง ${riskProfile.frailtyRisk} ร่วมกับความเสี่ยงโรคเรื้อรัง ${riskProfile.chronicRisk}) แนะนำให้เจ้าหน้าที่ รพ.สต. ประเมินคลินิกและวางแผนดูแลร่วมกับครอบครัวและ อสม. ทันที`
      : riskProfile.matrixGroup === 'C'
      ? `${elderName} อยู่ในกลุ่มความเสี่ยง C (ความเสี่ยงโรคเรื้อรังสูง แต่สมรรถภาพความเปราะบางยังอยู่ในระดับควบคุมได้) เน้นเฝ้าระวังความดันโลหิต พฤติกรรมการบริโภค และติดตามภายใน 7 วัน`
      : riskProfile.matrixGroup === 'B'
      ? `${elderName} อยู่ในกลุ่มความเสี่ยง B (ระยะเริ่มเปราะบาง Pre-Frailty หรือมีความเสี่ยงปานกลาง) สามารถฟื้นฟูให้กลับมาแข็งแรงได้ด้วยโปรแกรมออกกำลังกายเสริมแรงกล้ามเนื้อและโภชนาการ 4 สัปดาห์`
      : `${elderName} อยู่ในกลุ่มความเสี่ยง A (ความเสี่ยงต่ำทั้งภาวะเปราะบางและโรคเรื้อรัง) แนะนำคงพฤติกรรมสุขภาพที่ดีและเข้าร่วมกิจกรรมชมรมผู้สูงอายุในชุมชน`;

  const riskExplanation = `อ้างอิงจากเกณฑ์คัดกรอง Rule-Based: คะแนนภาวะเปราะบาง ${riskProfile.frailtyScore}/100 (${riskProfile.frailtyRisk}), ความดันโลหิต ${metrics.sbp}/${metrics.dbp} mmHg (ความเสี่ยงหลอดเลือดหัวใจ: ${riskProfile.cvdRisk}), ดัชนีมวลกาย BMI ${metrics.bmi} กก./ตร.ม. รอบเอว ${metrics.waist} ซม. (ความเสี่ยงเมตาบอลิก: ${riskProfile.diabetesRisk}, ความเสี่ยงโภชนาการ: ${riskProfile.nutritionRisk})`;

  const physicalActivities = isHighFrailty
    ? [
        'บริหารข้อเท้าและยกขาขึ้น-ลงบนเก้าอี้ที่มีพนักพิงมั่นคง วันละ 2 รอบ รอบละ 10 ครั้ง โดยมีผู้ดูแลอยู่ใกล้ชิด',
        'ฝึกยืนทรงตัวจับราวหรือพนักเก้าอี้ค้างไว้ 10–15 วินาที เพื่อป้องกันการพลัดตกหกล้ม',
        'เดินระยะสั้นภายในบริเวณบ้านที่พื้นเรียบและมีแสงสว่างเพียงพอ ครั้งละ 5–10 นาที',
      ]
    : isModFrailty
    ? [
        'เดินแกว่งแขนต่อเนื่องในชุมชนหรือลานบ้าน วันละ 15–20 นาที อย่างน้อย 4 วัน/สัปดาห์',
        'ฝึกลุก-นั่งจากเก้าอี้ช้าๆ (Sit-to-Stand) 8–10 ครั้ง เพื่อเพิ่มกำลังกล้ามเนื้อต้นขา',
        'บริหารฝึกการทรงตัว ยืนต่อเท้าและยืดเหยียดกล้ามเนื้อไหล่และหลัง',
      ]
    : [
        'เดินเร็ว รำไม้พลอง หรือไทเก็กในชมรมผู้สูงอายุ ครั้งละ 25–30 นาที สัปดาห์ละ 3–5 วัน',
        'บริหารกล้ามเนื้อขาและแขนด้วยยางยืดหรือน้ำหนักตัวเพื่อคงมวลกล้ามเนื้อ',
        'ทำกิจกรรมงานบ้านหรือสวนครัวเบาๆ เพื่อรักษาความคล่องตัว',
      ];

  const nutritionAdvice = [
    isLowWeight
      ? 'เสริมอาหารโปรตีนย่อยง่ายในทุกมื้อ เช่น ไข่ต้ม ปลาช่อน/ปลานิลนึ่ง เต้าหู้ถั่วเหลือง หรือนมถั่วเหลืองหวานน้อย เพื่อชะลอการสูญเสียมวลกล้ามเนื้อ'
      : 'ควบคุมสัดส่วนอาหารแบบ 2:1:1 (ผักใบเขียว 2 ส่วน : ข้าวกล้องหรือข้าวสวยไม่ขัดสี 1 ส่วน : โปรตีนจากปลา/ไข่/เนื้อสัตว์ไม่ติดมัน 1 ส่วน)',
    isHighBp
      ? 'ลดการเติมน้ำปลา เกลือ ผงชูรส และหลีกเลี่ยงอาหารหมักดอง/ปลาร้าเค็มจัด เพื่อลดระดับความดันโลหิต'
      : 'ดื่มน้ำสะอาดวันละ 6–8 แก้ว โดยจิบต่อเนื่องตลอดวัน และลดเครื่องดื่มชงหวานจัด',
    'รับประทานผลไม้รสไม่หวานจัดหลังอาหาร เช่น ฝรั่ง มะละกอสุกพอดี หรือแก้วมังกร เพื่อเพิ่มใยอาหาร',
  ];

  const fourWeekGoals = [
    {
      week: 1,
      focus: 'สัปดาห์ที่ 1: ปรับสมดุลสภาพแวดล้อมและเริ่มขยับร่างกายอย่างปลอดภัย',
      activities: physicalActivities[0],
      nutritionTarget: nutritionAdvice[0],
      vhvCheckpoint: 'อสม. เยี่ยมประเมินความเสี่ยงจุดลื่นล้มในบ้าน และวัดความดันโลหิตซ้ำ',
    },
    {
      week: 2,
      focus: 'สัปดาห์ที่ 2: เสริมสร้างแรงกล้ามเนื้อขาและปรับมื้ออาหารประจำวัน',
      activities: physicalActivities[1] || physicalActivities[0],
      nutritionTarget: nutritionAdvice[1],
      vhvCheckpoint: 'ติดตามการรับประทานยาตามแพทย์สั่งและบันทึกตารางอาหาร 3 วัน',
    },
    {
      week: 3,
      focus: 'สัปดาห์ที่ 3: เพิ่มความต่อเนื่องของกิจกรรมทางกายและการมีส่วนร่วมทางสังคม',
      activities: `${physicalActivities[0]} ร่วมกับฝึกความจำ/พูดคุยแลกเปลี่ยนกับเพื่อนบ้าน`,
      nutritionTarget: nutritionAdvice[2],
      vhvCheckpoint: 'ชั่งน้ำหนักและสังเกตอาการเหนื่อยล้าหรือการทรงตัวขณะเดิน',
    },
    {
      week: 4,
      focus: 'สัปดาห์ที่ 4: ประเมินผลซ้ำตามกรอบ SSSRFE และวางแผนระยะถัดไป',
      activities: 'ทดสอบการเดินและการทำกิจวัตรประจำวันเทียบกับสัปดาห์แรก',
      nutritionTarget: 'สรุปเมนูอาหารที่ผู้สูงอายุรับประทานได้ดีและน้ำหนักตัวคงที่/เหมาะสม',
      vhvCheckpoint: `ถึงกำหนดติดตาม ${elderName} เพื่อประเมินคะแนนความเสี่ยงซ้ำในระบบ`,
    },
  ];

  const vhvFollowUpPlan =
    riskProfile.matrixGroup === 'D'
      ? `แจ้งเตือน อสม.: ประสานส่งต่อ รพ.สต. ทันที และติดตามเยี่ยมบ้านร่วมกับเจ้าหน้าที่สาธารณสุขภายใน 3–7 วัน`
      : riskProfile.matrixGroup === 'C'
      ? `แจ้งเตือน อสม.: ถึงกำหนดติดตามวัดความดันโลหิตและพฤติกรรมการรับประทานยาภายใน 7 วัน`
      : riskProfile.matrixGroup === 'B'
      ? `แจ้งเตือน อสม.: ติดตามความก้าวหน้าตามแผนสุขภาพ 4 สัปดาห์ ทุก 2 สัปดาห์`
      : `แจ้งเตือน อสม.: ติดตามคัดกรองตามรอบปกติทุก 3 เดือน`;

  return {
    executiveSummary,
    riskExplanation,
    fourWeekGoals,
    physicalActivities,
    nutritionAdvice,
    vhvFollowUpPlan,
    safetyDisclaimer:
      'หมายเหตุความปลอดภัย (Safety Guardrail): ข้อมูลนี้เป็นการวิเคราะห์ระดับความเสี่ยงและคำแนะนำส่งเสริมสุขภาพเบื้องต้นตามเกณฑ์คัดกรอง ไม่ใช่การวินิจฉัยโรค ไม่ใช่การสั่งยา และไม่ใช้แทนคำแนะนำของแพทย์',
    generatedBy: 'rule-hybrid',
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

export type ElderNutritionInput = Pick<
  ElderProfile,
  | 'id'
  | 'name'
  | 'age'
  | 'gender'
  | 'livingArrangement'
  | 'chronicConditions'
  | 'assignedVhv'
  | 'caregiverName'
  | 'frailtyDomains'
  | 'chronicMetrics'
  | 'riskProfile'
  | 'ruleAudit'
  | 'lastScreenedAt'
>;

export function generatePersonalizedNutritionalGuidance(
  elder: ElderNutritionInput
): PersonalizedNutritionalGuidanceProfile {
  const {
    id,
    name,
    age,
    gender,
    livingArrangement,
    chronicConditions,
    assignedVhv,
    caregiverName,
    frailtyDomains,
    chronicMetrics,
    riskProfile,
    ruleAudit,
    lastScreenedAt,
  } = elder;

  const { matrixGroup, frailtyScore, frailtyRisk, cvdRisk, diabetesRisk, nutritionRisk, chronicRisk } =
    riskProfile;
  const { weight, height, bmi, waist, sbp, dbp, dietaryHabit, medicationAdherence } = chronicMetrics;

  const isEligibleGroupBCD = matrixGroup === 'B' || matrixGroup === 'C' || matrixGroup === 'D';
  const isUnderweightOrMalnourished =
    bmi < 19.5 || nutritionRisk === 'High' || frailtyDomains.nutrition >= 9;
  const isOverweightOrCentralObesity =
    bmi >= 23.0 || waist >= (gender === 'ชาย' ? 90 : 80);
  const isHypertensiveOrHighCvd =
    sbp >= 140 ||
    dbp >= 90 ||
    cvdRisk === 'High' ||
    cvdRisk === 'Moderate' ||
    chronicConditions.some((c) => c.includes('ความดัน'));
  const isDiabeticOrMetabolic =
    diabetesRisk === 'High' ||
    diabetesRisk === 'Moderate' ||
    dietaryHabit === 'high_sugar' ||
    chronicConditions.some((c) => c.includes('เบาหวาน') || c.includes('ไขมัน'));
  const hasSwallowingOrFunctionalDecline =
    frailtyDomains.functional >= 10 ||
    frailtyDomains.physical >= 12 ||
    age >= 78 ||
    chronicConditions.some((c) => c.includes('หลอดเลือดสมอง'));
  const hasJointOrBoneCondition =
    chronicConditions.some((c) => c.includes('ข้อเข่า') || c.includes('กระดูก')) ||
    frailtyDomains.physical >= 10;

  // Protein & Calorie Calculation from Risk Profile
  const proteinPerKgRatio =
    matrixGroup === 'D'
      ? isUnderweightOrMalnourished
        ? 1.3
        : 1.2
      : matrixGroup === 'C'
      ? 1.05
      : matrixGroup === 'B'
      ? 1.15
      : 1.0;

  const dailyProteinTargetGrams = Math.max(42, Math.round(weight * proteinPerKgRatio));

  const kcalPerKg = isUnderweightOrMalnourished
    ? 32
    : isOverweightOrCentralObesity
    ? 24
    : 28;
  const dailyCalorieTargetKcal = Math.round((weight * kcalPerKg) / 50) * 50;

  const dailySodiumLimitMg =
    sbp >= 160 || dbp >= 100 || cvdRisk === 'High'
      ? 1500
      : isHypertensiveOrHighCvd || dietaryHabit === 'high_salt'
      ? 1800
      : 2000;

  const dailyFluidTargetMl = Math.max(1400, Math.min(2100, Math.round(weight * 30)));

  // Plate Ratio Model calibrated to Group & BMI/Metabolic Profile
  const plateRatioModel = isUnderweightOrMalnourished
    ? {
        label: 'จานอาหารฟื้นฟูมวลกล้ามเนื้อ (1.5 : 1.5 : 1 — เน้นโปรตีนและพลังงานย่อยง่าย)',
        vegPercent: 35,
        proteinPercent: 40,
        carbPercent: 25,
        description:
          'เพิ่มสัดส่วนโปรตีนเนื้อนิ่มย่อยง่ายเป็น 40% ของมื้ออาหาร ร่วมกับข้าวกล้องต้ม/หุงนิ่ม เพื่อชดเชยน้ำหนักตัวที่ลดลงและป้องกันภาวะมวลกล้ามเนื้อพร่อง (Sarcopenia)',
      }
    : isDiabeticOrMetabolic || isOverweightOrCentralObesity
    ? {
        label: 'จานสุขภาพควบคุมเมตาบอลิก 2 : 1 : 1 (ผักพื้นบ้าน 50% · โปรตีนปลา/เต้าหู้ 25% · ข้าวไม่ขัดสี 25%)',
        vegPercent: 50,
        proteinPercent: 25,
        carbPercent: 25,
        description:
          'เน้นผักใบเขียวและผักพื้นบ้านโคราชครึ่งจานเพื่อชะลอการดูดซึมน้ำตาล ลดขนาดรอบเอว และควบคุมระดับไขมัน/น้ำตาลในเลือด',
      }
    : {
        label: 'จานสมดุลชะลอความเปราะบางผู้สูงวัย (ผักหลากหลาย 45% · โปรตีนคุณภาพ 30% · ข้าวซ้อมมือ 25%)',
        vegPercent: 45,
        proteinPercent: 30,
        carbPercent: 25,
        description:
          'กระจายโปรตีนคุณภาพดีครบ 3 มื้อหลัก เสริมการสังเคราะห์กล้ามเนื้อหลังทำกิจกรรมกายภาพและควบคุมความดันโลหิต',
      };

  const groupNutritionalStrategyTitle =
    matrixGroup === 'D'
      ? 'แผนโภชนาการคลินิกเข้มข้นสำหรับกลุ่มเสี่ยงสูงมาก (Group D — High Frailty & Multimorbidity Nutrition)'
      : matrixGroup === 'C'
      ? 'แผนโภชนาการบำบัดควบคุมโรคเรื้อรังและหลอดเลือด (Group C — Cardiometabolic & Vascular Nutrition)'
      : matrixGroup === 'B'
      ? 'แผนโภชนาการฟื้นฟูระยะเริ่มเปราะบาง 4 สัปดาห์ (Group B — Pre-Frailty Reversal & Muscle Nutrition)'
      : 'แนวทางโภชนาการส่งเสริมสุขภาพผู้สูงอายุกลุ่มปกติ (Group A — Active Aging Nutrition)';

  const groupNutritionalStrategySummary =
    matrixGroup === 'D'
      ? `ประมวลผลจากคะแนน Frailty ${frailtyScore}/100 (${frailtyRisk}) ร่วมกับ Chronic Risk ระดับ ${chronicRisk} และ BMI ${bmi} กก./ตร.ม. เน้นอาหารเนื้อสัมผัสนิ่มเคี้ยวง่าย โปรตีนสูง ${dailyProteinTargetGrams} กรัม/วัน แบ่งย่อย 4 มื้อ และจำกัดโซเดียมไม่เกิน ${dailySodiumLimitMg.toLocaleString()} มก./วัน เพื่อป้องกันภาวะทุพโภชนาการและลดโอกาสส่งต่อฉุกเฉิน`
      : matrixGroup === 'C'
      ? `ประมวลผลจากความเสี่ยงโรคเรื้อรังระดับ ${chronicRisk} (BP ${sbp}/${dbp} mmHg · CVD Risk: ${cvdRisk} · Diabetes Risk: ${diabetesRisk}) เน้นโภชนาการแบบ DASH ประยุกต์อาหารพื้นถิ่นโคราช ลดเค็ม/ลดน้ำตาลซ่อนเร้น และควบคุมรอบเอว (${waist} ซม.) ภายใน 7–28 วัน`
      : matrixGroup === 'B'
      ? `ประมวลผลจากระยะเริ่มเปราะบาง (Frailty ${frailtyScore}/100 · Nutrition Risk: ${nutritionRisk}) มุ่งเน้นการเสริมโปรตีน ${dailyProteinTargetGrams} กรัม/วัน ควบคู่กับการออกกำลังกายเสริมแรงกล้ามเนื้อขา เพื่อให้ผู้สูงอายุกลับสู่กลุ่มแข็งแรง (Group A)`
      : `ผู้สูงอายุอยู่ในกลุ่มความเสี่ยงต่ำ (Group A) แนะนำรักษาสมดุลอาหารครบ 5 หมู่ตามสัดส่วน 2:1:1 และดื่มน้ำสะอาดอย่างเพียงพอ`;

  const triggeredRuleCodes = ruleAudit.map((r) => r.code).join(', ');

  const cards: NutritionalGuidanceCard[] = [];

  // CARD 1: Protein & Sarcopenia / Muscle Preservation Card (Tailored for Group B, C, D)
  cards.push({
    id: `${id}-nut-card-1`,
    cardCode: `NUT-PRO-${matrixGroup}`,
    category: 'protein_sarcopenia',
    categoryLabel:
      matrixGroup === 'D'
        ? 'ฟื้นฟูมวลกล้ามเนื้อและโปรตีนเนื้อนิ่ม (Group D Priority)'
        : matrixGroup === 'C'
        ? 'โปรตีนไขมันต่ำดีต่อหลอดเลือดหัวใจ (Group C Priority)'
        : 'เสริมโปรตีนต้านภาวะเริ่มเปราะบาง (Group B Priority)',
    priority:
      matrixGroup === 'D' || nutritionRisk === 'High'
        ? 'Critical'
        : matrixGroup === 'C'
        ? 'High'
        : 'Moderate',
    title: isUnderweightOrMalnourished
      ? `การ์ดที่ 1: เสริมโปรตีนคุณภาพสูงย่อยง่าย แก้ไขน้ำหนักลดและมวลกล้ามเนื้อพร่อง`
      : `การ์ดที่ 1: จัดสรรโปรตีนคุณภาพดี ${dailyProteinTargetGrams} กรัม/วัน ชะลอภาวะกล้ามเนื้อถดถอย`,
    subtitle: `คำนวณเฉพาะบุคคลจากน้ำหนัก ${weight} กก. (BMI ${bmi} กก./ตร.ม.) และคะแนนโภชนาการ ${frailtyDomains.nutrition}/15`,
    triggeredByProfile: `Frailty Score ${frailtyScore}/100 (${frailtyRisk}) · Nutrition Risk: ${nutritionRisk} · Physical Domain ${frailtyDomains.physical}/20 (${triggeredRuleCodes})`,
    riskDrivers: [
      `กลุ่มความเสี่ยง: Group ${matrixGroup}`,
      `BMI ${bmi} กก./ตร.ม. (${weight} กก. / ${height} ซม.)`,
      `คะแนนมิติโภชนาการ: ${frailtyDomains.nutrition}/15`,
      `มิติสมรรถภาพกาย: ${frailtyDomains.physical}/20`,
    ],
    dailyTargetMetric: `เป้าหมายโปรตีน ${dailyProteinTargetGrams} กรัม/วัน (${proteinPerKgRatio} ก./นน.ตัว 1 กก.) · พลังงาน ${dailyCalorieTargetKcal.toLocaleString()} kcal/วัน`,
    koratLocalMenuExamples: isUnderweightOrMalnourished
      ? [
          'ไข่ตุ๋นทรงเครื่องหมูสับเต้าหู้อ่อนโรยต้นหอม (เนื้อเนียนเคี้ยวง่าย)',
          'ปลาช่อนหรือปลานิลนึ่งสมุนไพรโคราช เลาะก้างออกให้หมด ทานคู่ข้าวสวยหุงนิ่ม',
          'ต้มจืดเต้าหู้ถั่วเหลืองหมูสับใบตำลึงริมรั้ว (ซดน้ำซุปอุ่นๆ ไม่ใส่ผงชูรส)',
          'มื้อว่าง: นมถั่วเหลืองอุ่นผสมงาดำบดหวานน้อย 1 แก้ว + กล้วยน้ำว้านึ่ง 1 ลูก',
        ]
      : [
          'ปลานิลเผา/นึ่งสมุนไพร (ข่า ตะไคร้ ใบมะกรูด) ทานคู่ผักลวกพื้นบ้าน',
          'แกงเลียงฟักทองบวบหอมใบแมงลักใส่กุ้งสดหรือเนื้อปลาสับ',
          'ผัดเต้าหู้ถั่วเหลืองใส่ถั่วงอกและใบกุยช่ายใช้น้ำมันรำข้าวเล็กน้อย',
          'ไข่ต้มยางมะตูมสุก 1 ฟอง หรือไข่ขาวต้ม 2 ฟองในมื้อเช้า-กลางวัน',
        ],
    foodsToPrioritize: [
      'เนื้อปลาน้ำจืดท้องถิ่นเลาะก้าง (ปลานิล ปลาช่อน ปลาทับทิม) ย่อยง่ายและไขมันอิ่มตัวต่ำ',
      'ไข่ไก่ เต้าหู้อ่อน เต้าหู้ถั่วเหลือง และนมถั่วเหลืองเสริมแคลเซียมหวานน้อย',
      'กระจายโปรตีนมื้อละ 15–20 กรัม ครบทั้ง 3 มื้อหลัก เพื่อกระตุ้นการสร้างกล้ามเนื้อผู้สูงวัย',
    ],
    foodsToAvoid: [
      'เนื้อสัตว์ติดมันหนังสัตว์ หมูสามชั้น แคบหมู หรือเนื้อเหนียวที่เคี้ยวกลืนลำบาก',
      'การอดอาหารมื้อเย็นหรือรับประทานเฉพาะข้าวต้มเปล่ากับผักดอง (ทำให้มวลกล้ามเนื้อสลายตัวเร็ว)',
    ],
    mealTimingGuide: {
      breakfast: '07:00–08:00 น.: ข้าวต้มปลา/โจ๊กหมูสับใส่ไข่ลวกสุก + เต้าหู้อ่อน (เน้นโปรตีนมื้อเช้า)',
      lunch: '12:00–12:30 น.: ข้าวกล้องหุงนิ่ม 1 ทัพพี + ปลานึ่งสมุนไพร 1 ชิ้นฝ่ามือ + ผักต้มเปื่อย',
      dinner: '17:30–18:30 น.: แกงจืดเต้าหู้ตำลึงหมูสับ หรือแกงเลียงปลา + ข้าวสวยหุงนิ่ม 1 ทัพพี',
      snackOrHydration: '15:00 น. (หลังบริหารร่างกาย 30 นาที): นมถั่วเหลืองหวานน้อยอุ่น 1 แก้ว (180–200 มล.)',
    },
    caregiverAndVhvInstruction: `ให้ผู้ดูแล (${caregiverName}) เตรียมเนื้อปลาเลาะก้างและหั่นชิ้นเล็กพอดีคำ และให้ ${assignedVhv} ชั่งน้ำหนักติดตามทุก 2 สัปดาห์ (เป้าหมายน้ำหนักไม่ลดลงเกิน 1 กก./เดือน)`,
  });

  // CARD 2: Sodium Reduction & Blood Pressure / Vascular Protection Card
  cards.push({
    id: `${id}-nut-card-2`,
    cardCode: `NUT-DASH-${matrixGroup}`,
    category: 'sodium_bp_control',
    categoryLabel:
      cvdRisk === 'High' || sbp >= 160
        ? 'ควบคุมโซเดียมเข้มงวด · ลดความดันวิกฤต (DASH Protocol)'
        : 'สมดุลโซเดียมและโพแทสเซียม · ปกป้องหลอดเลือด',
    priority:
      sbp >= 160 || dbp >= 100 || cvdRisk === 'High'
        ? 'Critical'
        : isHypertensiveOrHighCvd
        ? 'High'
        : 'Moderate',
    title:
      sbp >= 140 || dbp >= 90
        ? `การ์ดที่ 2: โภชนาการลดเค็มคุมความดันโลหิต (ปัจจุบัน ${sbp}/${dbp} mmHg)`
        : `การ์ดที่ 2: สมดุลเกลือแร่และสมุนไพรพื้นบ้านโคราช ป้องกันความดันโลหิตสูง`,
    subtitle: `พฤติกรรมบริโภคปัจจุบัน: ${
      dietaryHabit === 'high_salt'
        ? 'รสเค็ม/อาหารหมักดอง (ต้องปรับลดทันที)'
        : dietaryHabit === 'high_sugar'
        ? 'ติดรสหวาน'
        : dietaryHabit === 'high_fat'
        ? 'อาหารมัน/ทอด'
        : 'รสชาติทั่วไป'
    } · ความเสี่ยงหลอดเลือดหัวใจ: ${cvdRisk}`,
    triggeredByProfile: `BP ${sbp}/${dbp} mmHg · Cardiovascular Risk: ${cvdRisk} · Dietary Habit: ${dietaryHabit}`,
    riskDrivers: [
      `ความดันโลหิต: ${sbp}/${dbp} mmHg`,
      `CVD Risk: ${cvdRisk}`,
      `เพดานโซเดียม: ≤ ${dailySodiumLimitMg.toLocaleString()} มก./วัน`,
      `พฤติกรรมอาหาร: ${dietaryHabit}`,
    ],
    dailyTargetMetric: `จำกัดโซเดียมไม่เกิน ${dailySodiumLimitMg.toLocaleString()} มก./วัน (เทียบเท่าเกลือไม่เกิน ${
      dailySodiumLimitMg <= 1500 ? '3/4' : '1'
    } ช้อนชา หรือน้ำปลาไม่เกิน ${dailySodiumLimitMg <= 1500 ? '2.5' : '3'} ช้อนชา/วัน รวมทุกมื้อ)`,
    koratLocalMenuExamples: [
      'น้ำพริกมะเขือเทศย่าง/น้ำพริกข่าหอมแดงสูตรโคราชลดเค็ม (ไม่ใส่ปลาร้าต้มเค็มจัด ใช้ความเปรี้ยวจากมะนาวสดแทน)',
      'ต้มยำปลาทับทิมน้ำใสใส่ข่า ตะไคร้ ใบมะกรูด เห็ดฟาง (ชูรสด้วยสมุนไพรสดแทนผงปรุงรส)',
      'ยำทูน่าหรือยำเนื้อปลาลวกสมุนไพรตะไคร้ซอย ใบสะระแหน่ มะเขือเทศราชินี',
      'ผัดบวบใส่ไข่และกระเทียมทุบ (ปรุงรสด้วยซีอิ๊วขาวลดโซเดียมเพียง 1/2 ช้อนชา)',
    ],
    foodsToPrioritize: [
      'สมุนไพรพื้นบ้านชูรสกลิ่นหอม (ข่า ตะไคร้ ใบมะกรูด หอมแดง กระเทียม พริกไทย ใบแมงลัก) ช่วยลดการเติมน้ำปลา',
      'ผักสดและผักลวกที่มีโพแทสเซียมธรรมชาติ เช่น ตำลึง ฟักทอง มะเขือเทศ บวบ ผักบุ้ง ช่วยคลายตัวหลอดเลือด',
      'ชิมอาหารก่อนปรุงทุกครั้ง และแยกน้ำซุป/น้ำราดออกจากจานข้าวหลัก',
    ],
    foodsToAvoid: [
      'ปลาร้าบองเค็มจัด ปลาจ่อม ไข่เค็ม ผักกาดดอง กุนเชียง หมูยอ และบะหมี่กึ่งสำเร็จรูป',
      'ผงชูรส ผงปรุงรสซุปสำเร็จรูป และการซดน้ำแกง/น้ำก๋วยเตี๋ยวจนหมดถ้วย',
    ],
    mealTimingGuide: {
      breakfast: 'งดเหยาะน้ำปลาหรือซีอิ๊วเพิ่มในโจ๊ก/ข้าวต้ม ใช้ขิงซอยและต้นหอมโรยเพิ่มความหอม',
      lunch: 'เลือกกับข้าวประเภทต้ม นึ่ง ยำสมุนไพร หลีกเลี่ยงอาหารจานเดียวผัดน้ำมันเยิ้มหรือราดน้ำเค็มจัด',
      dinner: 'รับประทานอาหารรสอ่อนก่อนเวลา 18:30 น. เพื่อลดภาวะคั่งน้ำและลดความดันช่วงเช้ามืด',
      snackOrHydration: 'ผลไม้โพแทสเซียมเหมาะสม: ฝรั่งสดหั่นชิ้นบาง หรือชมพู่ 4–5 ชิ้นหลังมื้ออาหาร',
    },
    caregiverAndVhvInstruction: `ให้ผู้ดูแลแยกพวงเครื่องปรุงออกจากโต๊ะอาหาร และให้ ${assignedVhv} ตรวจวัดความดันโลหิตซ้ำหลังปรับลดเค็มครบ 7 วัน`,
  });

  // CARD 3: Glycemic, Waist & Metabolic Balance OR Underweight Energy Fortification Card
  if (isDiabeticOrMetabolic || isOverweightOrCentralObesity) {
    cards.push({
      id: `${id}-nut-card-3`,
      cardCode: `NUT-METAB-${matrixGroup}`,
      category: 'glycemic_metabolic',
      categoryLabel: 'ควบคุมน้ำตาล · ลดรอบเอว · สมดุลไขมันในเลือด',
      priority: diabetesRisk === 'High' ? 'Critical' : 'High',
      title: `การ์ดที่ 3: ควบคุมคาร์โบไฮเดรตเชิงซ้อนและลดน้ำตาลแฝง (รอบเอว ${waist} ซม.)`,
      subtitle: `ความเสี่ยงเบาหวาน/เมตาบอลิก: ${diabetesRisk} · BMI ${bmi} กก./ตร.ม. (เกณฑ์รอบเอว${
        gender === 'ชาย' ? 'ชาย < 90' : 'หญิง < 80'
      } ซม.)`,
      triggeredByProfile: `Diabetes Risk: ${diabetesRisk} · BMI ${bmi} · รอบเอว ${waist} ซม. · โรคประจำตัว: ${
        chronicConditions.join(', ') || 'เฝ้าระวังเมตาบอลิก'
      }`,
      riskDrivers: [
        `Diabetes Risk: ${diabetesRisk}`,
        `รอบเอว: ${waist} ซม.`,
        `BMI: ${bmi} กก./ตร.ม.`,
        `พฤติกรรม: ${dietaryHabit === 'high_sugar' ? 'ติดหวาน' : 'ต้องคุมแป้งขัดขาว'}`,
      ],
      dailyTargetMetric: `ข้าวกล้อง/ข้าวซ้อมมือมื้อละ 1–1.5 ทัพพี · งดน้ำตาลเติมเพิ่ม (0 ช้อนชา) · ใยอาหาร ≥ 20 กรัม/วัน`,
      koratLocalMenuExamples: [
        'ข้าวกล้องหอมมะลิโคราชหุงผสมข้าวขาว 1:1 (นุ่มเคี้ยวง่ายแต่ดัชนีน้ำตาลต่ำกว่าข้าวเหนียว)',
        'น้ำพริกปลานิลนึ่งคู่ชุดผักพื้นบ้านลวก (ดอกแค มะเขือเปราะ ถั่วฝักยาว ผักกวางตุ้ง)',
        'ต้มจืดมะระยัดไส้หมูสับวุ้นเส้นถั่วเขียว (ช่วยควบคุมระดับน้ำตาลหลังมื้ออาหาร)',
        'ของว่างทดแทนขนมหวาน: ถั่วต้มไม่ใส่เกลือ 1 กำมือเล็ก หรือฝรั่งสด/แก้วมังกรเนื้อขาว',
      ],
      foodsToPrioritize: [
        'รับประทานผักใบเขียว 3–4 คำแรกก่อนเริ่มทานข้าวและเนื้อสัตว์ เพื่อชะลอการพุ่งของน้ำตาลในเลือด',
        'สลับจากข้าวเหนียวมื้อเย็น มาเป็นข้าวกล้องหุงนิ่มหรือข้าวไรซ์เบอร์รี่ผสม',
        'ผลไม้ดัชนีน้ำตาลต่ำ (ฝรั่ง มะละกอสุกพอดี แก้วมังกร ชมพู่) มื้อละ 6–8 ชิ้นคำ',
      ],
      foodsToAvoid: [
        'กาแฟโบราณใส่นมข้นหวาน น้ำอัดลม น้ำหวานเฮลบลูบอย ขนมไทยเชื่อมกะทิ',
        'การรับประทานข้าวเหนียวเกินมื้อละ 1 ปั้นเล็ก โดยเฉพาะมื้อเย็นก่อนนอน',
      ],
      mealTimingGuide: {
        breakfast: 'ข้าวกล้องต้มปลา หรือข้าวซ้อมมือ 1 ทัพพี + กับข้าวเน้นผักและโปรตีน (งดปาท่องโก๋/กาแฟใส่นมข้น)',
        lunch: 'ก๋วยเตี๋ยวเส้นหมี่ข้าวกล้องน้ำใสเน้นผักและเนื้อปลา หรือข้าวราดแกงส้มผักรวม',
        dinner: 'ข้าวกล้องหุงนิ่ม 1 ทัพพี + แกงจืดผักกาดขาวเต้าหู้หมูสับ (งดผลไม้รสหวานจัดมื้อดึก)',
        snackOrHydration: 'ดื่มน้ำเปล่าหรือน้ำใบเตยต้มเองไม่ใส่น้ำตาล จิบระหว่างวัน',
      },
      caregiverAndVhvInstruction: `ให้ ${assignedVhv} ติดตามวัดรอบเอวและคัดกรองน้ำตาลปลายนิ้ว (DTX) ตามรอบ พร้อมตรวจสอบฉลากเครื่องดื่มในบ้านผู้สูงอายุ`,
    });
  } else {
    cards.push({
      id: `${id}-nut-card-3`,
      cardCode: `NUT-ENERGY-${matrixGroup}`,
      category: 'glycemic_metabolic',
      categoryLabel: 'เสริมพลังงานสะอาด · ป้องกันน้ำหนักลดผิดปกติ',
      priority: isUnderweightOrMalnourished ? 'Critical' : 'Moderate',
      title: `การ์ดที่ 3: เสริมพลังงานจากคาร์โบไฮเดรตเชิงซ้อนและไขมันดี (BMI ${bmi} กก./ตร.ม.)`,
      subtitle: `ป้องกันภาวะอ่อนเพลียเหนื่อยล้า และรักษาระดับน้ำตาลให้คงที่ตลอดวันสำหรับวัย ${age} ปี`,
      triggeredByProfile: `BMI ${bmi} กก./ตร.ม. · Frailty Score ${frailtyScore}/100 · Activity Domain ${frailtyDomains.activity}/10`,
      riskDrivers: [
        `BMI: ${bmi} กก./ตร.ม.`,
        `น้ำหนักตัว: ${weight} กก.`,
        `มิติความเหนื่อยล้า/กิจกรรม: ${frailtyDomains.activity}/10`,
        `กลุ่มความเสี่ยง: Group ${matrixGroup}`,
      ],
      dailyTargetMetric: `พลังงานรวม ${dailyCalorieTargetKcal.toLocaleString()} kcal/วัน · แบ่งเป็น 3 มื้อหลัก + 2 มื้อว่างพลังงานสะอาด`,
      koratLocalMenuExamples: [
        'ข้าวต้มกล้องหอมมะลิโคราชใส่ฟักทองหั่นเต๋าและหมูสับ (เพิ่มพลังงานและเบต้าแคโรทีน)',
        'ฟักทองนึ่ง/มันเทศนึ่งบดโรยงาดำคั่วบดละเอียด (เคี้ยวง่าย หอมมัน และให้แคลเซียมสูง)',
        'ผัดผักบุ้ง/ผักกวางตุ้งน้ำมันรำข้าวใส่เต้าหู้เหลืองและหมูสันในสับ',
        'ซุปข้าวโพดเต้าหู้อ่อนใส่ไข่ขาวตีฟู สำหรับมื้อว่างบ่ายหรือมื้อค่ำ',
      ],
      foodsToPrioritize: [
        'พืชหัวเนื้อนิ่มให้พลังงานสูงแต่ดัชนีน้ำตาลปานกลาง เช่น ฟักทองนึ่ง มันเทศ เผือกต้มเปื่อย',
        'ไขมันดีจากน้ำมันรำข้าว งาดำคั่วบด และเนื้อปลา เพื่อช่วยดูดซึมวิตามิน A, D, E, K',
        'แบ่งมื้ออาหารเป็นมื้อเล็กๆ แต่บ่อยขึ้น (4–5 มื้อ/วัน) หากผู้สูงอายุอิ่มเร็วหรือเบื่ออาหาร',
      ],
      foodsToAvoid: [
        'อาหารทอดน้ำมันซ้ำหรือกะทิข้นจัดที่ทำให้แน่นท้อง ท้องอืด และเบื่ออาหารในมื้อถัดไป',
        'การดื่มน้ำปริมาณมากทันทีก่อนมื้ออาหาร 30 นาที เพราะจะทำให้กระเพาะอาหารเต็มและรับประทานข้าวได้น้อย',
      ],
      mealTimingGuide: {
        breakfast: '07:30 น.: ข้าวต้มหมูสับใส่ไข่และฟักทองต้มเปื่อย 1 ชาม',
        lunch: '12:00 น.: ข้าวสวยหุงนิ่ม 1.5 ทัพพี + ปลานึ่งซีอิ๊วขิงอ่อน + ผักต้ม',
        dinner: '18:00 น.: ข้าวต้มปลา หรือแกงเลียงฟักทองตำลึง + ข้าวสวยนิ่ม',
        snackOrHydration: '10:00 น. & 15:30 น.: นมถั่วเหลืองงาดำอุ่น 1 แก้ว + ฟักทองนึ่ง 2–3 ชิ้น',
      },
      caregiverAndVhvInstruction: `ให้ผู้ดูแล (${caregiverName}) จัดอาหารใส่จานสีสว่างเสิร์ฟขณะอุ่นๆ เพื่อกระตุ้นความอยากอาหาร และบันทึกปริมาณที่รับประทานได้จริง`,
    });
  }

  // CARD 4: Swallowing Safety, Hydration, Bone/Joint & Medication-Food Synergy Card
  cards.push({
    id: `${id}-nut-card-4`,
    cardCode: `NUT-CARE-${matrixGroup}`,
    category: 'hydration_swallowing_bone',
    categoryLabel: hasSwallowingOrFunctionalDecline
      ? 'เนื้ออาหารปลอดภัย · การดื่มน้ำ · แคลเซียมและยา'
      : 'แคลเซียมข้อเข่า · สมดุลน้ำดื่ม · การรับประทานยาร่วมกับอาหาร',
    priority:
      hasSwallowingOrFunctionalDecline || medicationAdherence !== 'good'
        ? 'High'
        : 'Moderate',
    title: hasSwallowingOrFunctionalDecline
      ? `การ์ดที่ 4: การจัดเนื้อสัมผัสอาหารป้องกันสำลัก สมดุลน้ำดื่ม และเวลารับประทานยา`
      : hasJointOrBoneCondition
      ? `การ์ดที่ 4: โภชนาการบำรุงมวลกระดูก-ข้อเข่า สมดุลน้ำดื่ม และความปลอดภัยในการใช้ยา`
      : `การ์ดที่ 4: สมดุลน้ำดื่ม แร่ธาตุผู้สูงวัย และการจัดมื้ออาหารคู่กับยารักษาโรคประจำตัว`,
    subtitle: `การอยู่อาศัย: ${livingArrangement} · วินัยการใช้ยา: ${
      medicationAdherence === 'good'
        ? 'สม่ำเสมอดี'
        : medicationAdherence === 'irregular'
        ? 'ลืมรับประทานยาบางมื้อ (ต้องผูกมื้ออาหาร)'
        : 'ไม่ได้รับประทานยาต่อเนื่อง'
    }`,
    triggeredByProfile: `Functional ADL ${frailtyDomains.functional}/20 · Chronic Disease/Meds ${frailtyDomains.chronicDisease}/10 · โรคประจำตัว: ${
      chronicConditions.join(', ') || 'ผู้สูงอายุกลุ่มเฝ้าระวัง'
    }`,
    riskDrivers: [
      `ADL/กิจวัตร: ${frailtyDomains.functional}/20`,
      `การใช้ยา: ${medicationAdherence}`,
      `การอยู่อาศัย: ${livingArrangement}`,
      `น้ำดื่มเป้าหมาย: ${dailyFluidTargetMl.toLocaleString()} มล./วัน`,
    ],
    dailyTargetMetric: `น้ำสะอาด ${dailyFluidTargetMl.toLocaleString()} มล./วัน (ประมาณ 7–8 แก้ว) · แคลเซียมธรรมชาติทุกวัน · นั่งตัวตรงหลังอาหาร 30 นาที`,
    koratLocalMenuExamples: [
      'แกงจืดตำลึงเต้าหู้อ่อนหมูสับปั้นก้อนนุ่ม (หั่นใบตำลึงชิ้นเล็ก ไม่เหนียวติดคอ)',
      'ปลาเล็กปลาน้อยคั่วสมุนไพรบดละเอียด หรือเต้าหู้ขาวแข็งผัดผักกวางตุ้งต้มเปื่อย (เสริมแคลเซียม)',
      'กล้วยน้ำว้าสุกหั่นแว่นบาง หรือมะละกอสุกหั่นเต๋าพอดีคำ (ช่วยการขับถ่ายและกลืนง่าย)',
      'น้ำอุ่นผสมน้ำมะนาวเล็กน้อยหรือน้ำเปล่าอุณหภูมิห้องวางไว้ใกล้มือผู้สูงอายุ',
    ],
    foodsToPrioritize: [
      hasSwallowingOrFunctionalDecline
        ? 'หั่นเนื้อสัตว์และผักเป็นชิ้นเล็ก (ไม่เกิน 1x1 ซม.) ต้มหรือตุ๋นให้นิ่ม และมีน้ำซุปขลุกขลิกช่วยให้กลืนลื่น'
        : 'อาหารแคลเซียมและวิตามินดีธรรมชาติ (เต้าหู้ ปลาเล็กปลาน้อย งาดำคั่วบด ไข่แดง) ช่วยพยุงข้อเข่าและมวลกระดูก',
      'จิบน้ำสะอาดครั้งละ 1/2 แก้ว ทุก 1–2 ชั่วโมงในช่วงเช้าถึงบ่าย (ลดการดื่มน้ำมากหลัง 19:00 น. เพื่อลดการลุกเข้าห้องน้ำกลางดึก)',
      'จัดซองยาประจำมื้อวางคู่กับถาดอาหารเช้า-เย็น เพื่อป้องกันการลืมรับประทานยาลดความดัน/เบาหวาน',
    ],
    foodsToAvoid: [
      'อาหารเหนียวติดคอหรือแตกตัวเป็นเศษแข็ง เช่น ข้าวเหนียวแข็ง ขนมเข่ง ขนมเทียน ถั่วลิสงคั่วทั้งเม็ด หรือฝรั่งแข็ง',
      'การนอนราบทันทีหลังรับประทานอาหารอิ่ม (เสี่ยงกรดไหลย้อนและสำลักเข้าปอด)',
    ],
    mealTimingGuide: {
      breakfast: 'รับประทานอาหารเช้าให้ตรงเวลา พร้อมรับประทานยาหลังอาหารเช้าทันทีตามแพทย์สั่ง',
      lunch: 'จิบน้ำสะอาดระหว่างวัน 3–4 แก้วในช่วงสายถึงบ่าย และรับแสงแดดอ่อนช่วงเช้า 10–15 นาที',
      dinner: 'มื้อเย็นเนื้อสัมผัสนุ่มย่อยง่าย และนั่งพิงพนักเก้าอี้ตัวตรงอย่างน้อย 30 นาทีหลังมื้ออาหาร',
      snackOrHydration: 'งดชาเข้มข้นหรือกาแฟหลังเที่ยงวัน และวางแก้วน้ำมีฝาปิดไว้ข้างที่นั่งประจำ',
    },
    caregiverAndVhvInstruction:
      livingArrangement === 'อยู่ลำพัง'
        ? `เนื่องจาก ${name} อาศัยอยู่ลำพัง ให้ ${assignedVhv} และเพื่อนบ้านช่วยจัดกล่องอาหาร/ซองยารายวัน และตรวจสอบการดื่มน้ำทุกครั้งที่เยี่ยมบ้าน`
        : `ให้ ${caregiverName} ดูแลการจัดซองยาคู่กับมื้ออาหารเช้า-เย็น และสังเกตอาการไอหรือสำลักขณะดื่มน้ำ/รับประทานอาหาร`,
  });

  return {
    elderId: id,
    elderName: name,
    matrixGroup,
    isEligibleGroupBCD,
    groupNutritionalStrategyTitle,
    groupNutritionalStrategySummary,
    dailyCalorieTargetKcal,
    dailyProteinTargetGrams,
    proteinPerKgRatio,
    dailySodiumLimitMg,
    dailyFluidTargetMl,
    plateRatioModel,
    cards,
    generatedAt: lastScreenedAt || new Date().toISOString().slice(0, 10),
  };
}

/**
 * Generates a chronological daily Medication & Supplement Timeline for an elder,
 * evaluating and flagging potential missed doses directly from their Risk Engine profile.
 */
export function generateMedicationSupplementTimeline(
  elder: ElderProfile
): MedicationTimelineProfile {
  const {
    id,
    name,
    livingArrangement,
    caregiverName,
    assignedVhv,
    chronicConditions,
    frailtyDomains,
    chronicMetrics,
    riskProfile,
    ruleAudit,
    lastScreenedAt,
  } = elder;

  const {
    matrixGroup,
    frailtyScore,
    chronicScore,
    cvdRisk,
    diabetesRisk,
    nutritionRisk,
  } = riskProfile;

  const { sbp, dbp, bmi, medicationAdherence, dietaryHabit } = chronicMetrics;

  const condText = chronicConditions.join(' ');
  const hasHypertension =
    condText.includes('ความดัน') || sbp >= 140 || dbp >= 90 || cvdRisk !== 'Low';
  const hasDiabetes =
    condText.includes('เบาหวาน') ||
    diabetesRisk === 'High' ||
    (diabetesRisk === 'Moderate' && dietaryHabit === 'high_sugar');
  const hasDyslipidemiaOrHeart =
    condText.includes('ไขมัน') ||
    condText.includes('หัวใจ') ||
    condText.includes('หลอดเลือด') ||
    cvdRisk === 'High' ||
    sbp >= 150;
  const hasKidneyCondition = condText.includes('ไต');
  const hasBoneOrJoint =
    condText.includes('ข้อเข่า') ||
    condText.includes('กระดูก') ||
    condText.includes('เก๊าท์') ||
    frailtyDomains.physical >= 8;
  const hasSarcopeniaOrLowNutrition =
    nutritionRisk !== 'Low' ||
    bmi < 20.5 ||
    frailtyDomains.nutrition >= 6 ||
    frailtyDomains.physical >= 10;

  // Risk Engine Vulnerability Calculation for Missed Doses
  const isCogImpaired = frailtyDomains.cognitive >= 8;
  const isMildCogDecline = frailtyDomains.cognitive >= 5 && frailtyDomains.cognitive < 8;
  const isLivingAlone = livingArrangement === 'อยู่ลำพัง';
  const isElderlySpouseOnly = livingArrangement === 'อยู่กับคู่สมรสสูงอายุ';
  const hasAdlDifficulty = frailtyDomains.functional >= 9;
  const hasPolypharmacy = frailtyDomains.chronicDisease >= 6 || chronicConditions.length >= 2;

  const riskEngineTriggers: string[] = [];

  if (medicationAdherence === 'none') {
    riskEngineTriggers.push(
      'RULE-C06: ประวัติขาดยารักษาโรคประจำตัวต่อเนื่อง (Adherence = None) — เสี่ยงลืมโดสทุกช่วงเวลา'
    );
  } else if (medicationAdherence === 'irregular') {
    riskEngineTriggers.push(
      'RULE-C06: ประวัติรับประทานยาไม่สม่ำเสมอ (Adherence = Irregular) — เสี่ยงลืมมื้อกลางวัน/เย็น/ก่อนนอน'
    );
  }

  if (isCogImpaired) {
    riskEngineTriggers.push(
      `RULE-F05: คะแนนการรับรู้และความจำบกพร่อง (Cognitive ${frailtyDomains.cognitive}/15) — เสี่ยงลืมรับประทานยาหรือรับประทานซ้ำซ้อน`
    );
  } else if (isMildCogDecline) {
    riskEngineTriggers.push(
      `Cognitive Domain ${frailtyDomains.cognitive}/15 — เริ่มมีความเสี่ยงลืมยามื้อที่ไม่ได้ผูกกับมื้ออาหารหลัก`
    );
  }

  if (isLivingAlone) {
    riskEngineTriggers.push(
      `Social Domain ${frailtyDomains.social}/10 (อาศัยอยู่ลำพัง) — ไม่มีผู้ดูแลคอยเตือนยาในช่วงสาย กลางวัน และก่อนนอน`
    );
  } else if (isElderlySpouseOnly) {
    riskEngineTriggers.push(
      `Social Domain ${frailtyDomains.social}/10 (อยู่กับคู่สมรสสูงอายุ) — เสี่ยงลืมโดสช่วงบ่ายและก่อนนอนหากไม่มีซองยาระบุสี/เวลา`
    );
  }

  if (hasPolypharmacy) {
    riskEngineTriggers.push(
      `Polypharmacy Burden (Chronic Disease Domain ${frailtyDomains.chronicDisease}/10 · ${
        chronicConditions.length || 1
      } กลุ่มอาการ) — ตารางยาหลายมื้อเพิ่มโอกาสสับสนเวลาใช้ยา`
    );
  }

  if (hasAdlDifficulty) {
    riskEngineTriggers.push(
      `Functional ADL ${frailtyDomains.functional}/20 — ข้อจำกัดในการแกะแผงยา/เดินไปหยิบน้ำดื่มด้วยตนเอง`
    );
  }

  if (riskEngineTriggers.length === 0) {
    riskEngineTriggers.push(
      `Matrix Group ${matrixGroup} (Frailty ${frailtyScore}/100 · Chronic ${chronicScore}/100) — เฝ้าระวังความสม่ำเสมอของการใช้ยาและวิตามินเสริมตามเกณฑ์มาตรฐาน`
    );
  }

  // Helper to compute slot-specific missed dose probability & flag status
  const evaluateSlotMissedRisk = (
    slotTime: '06:30' | '08:00' | '12:30' | '18:00' | '21:00',
    itemType: 'prescription_med' | 'supplement',
    isCriticalControlMed: boolean
  ): {
    probability: number;
    flagged: boolean;
    level: MissedDoseRiskFlagLevel;
  } => {
    let baseProb =
      medicationAdherence === 'none'
        ? 58
        : medicationAdherence === 'irregular'
        ? 36
        : 10;

    // Cognitive impact
    if (isCogImpaired) baseProb += 18;
    else if (isMildCogDecline) baseProb += 9;

    // Living arrangement impact by time of day
    if (isLivingAlone) {
      baseProb += slotTime === '12:30' || slotTime === '21:00' ? 16 : 11;
    } else if (isElderlySpouseOnly) {
      baseProb += slotTime === '12:30' || slotTime === '21:00' ? 10 : 6;
    } else {
      // Living with family: midday (12:30) is often unattended when relatives work
      if (slotTime === '12:30') baseProb += 11;
    }

    // Time-slot specific behavioral patterns in elderly care
    if (slotTime === '06:30') baseProb += 8; // Pre-breakfast window is narrow
    if (slotTime === '12:30') baseProb += 9; // Midday supplement/dose often skipped
    if (slotTime === '18:00' && hasPolypharmacy) baseProb += 7;
    if (slotTime === '21:00') baseProb += 12; // Bedtime fatigue / sleeping early

    if (hasAdlDifficulty) baseProb += 6;
    if (itemType === 'supplement' && slotTime === '12:30') baseProb += 5;

    const probability = Math.min(92, Math.max(8, Math.round(baseProb)));

    let level: MissedDoseRiskFlagLevel = 'low_watch';
    let flagged = false;

    if (
      probability >= 52 ||
      (probability >= 42 && isCriticalControlMed && (matrixGroup === 'D' || matrixGroup === 'C'))
    ) {
      level = 'critical_flag';
      flagged = true;
    } else if (
      probability >= 32 ||
      (medicationAdherence !== 'good' && (slotTime === '12:30' || slotTime === '21:00' || slotTime === '06:30')) ||
      (matrixGroup === 'B' && slotTime === '12:30' && probability >= 26)
    ) {
      level = 'moderate_flag';
      flagged = true;
    }

    return { probability, flagged, level };
  };

  const items: MedicationScheduleItem[] = [];

  // 1. 06:30 น. — ก่อนอาหารเช้า (Pre-Breakfast Regimen / Fasting Absorption or Morning Warm-up)
  const slot0630Eval = evaluateSlotMissedRisk('06:30', 'prescription_med', hasDiabetes || hasHypertension);
  if (hasDiabetes || hasHypertension || matrixGroup === 'D' || matrixGroup === 'C') {
    items.push({
      id: `${id}-med-0630`,
      slotTime: '06:30',
      slotPeriodLabel: '06:30 น. · ก่อนอาหารเช้า 30 นาที',
      windowRange: '06:15 – 06:45 น.',
      itemType: 'prescription_med',
      itemTypeLabel: 'ยารักษาโรคประจำตัว',
      name: hasDiabetes
        ? 'Glipizide 5 mg (หรือยาควบคุมระดับน้ำตาลก่อนอาหารเช้า)'
        : 'ยาลดกรดไหลย้อน / เคลือบกระเพาะอาหารก่อนมื้อเช้า (Omeprazole 20 mg)',
      thaiClinicalName: hasDiabetes
        ? 'ยากระตุ้นการหลั่งอินซูลินก่อนมื้ออาหารเช้า'
        : 'ยาปกป้องเยื่อบุกระเพาะอาหารในผู้สูงอายุที่ใช้ยาหลายขนาน',
      dosageText: 'รับประทานครั้งละ 1 เม็ด ก่อนอาหารเช้า 30 นาที พร้อมน้ำสะอาด 1 แก้ว',
      indication: hasDiabetes
        ? `ควบคุมระดับน้ำตาลหลังอาหารเช้า (Diabetes Risk: ${diabetesRisk})`
        : `ป้องกันการระคายเคืองทางเดินอาหารจากการใช้ยาโรคเรื้อรัง (${chronicConditions.length || 1} ขนาน)`,
      mealRelation: 'before_meal',
      mealRelationLabel: 'ก่อนอาหารเช้า 30 นาที',
      defaultStatus: slot0630Eval.flagged ? 'missed_risk_flagged' : 'taken',
      missedDoseFlagged: slot0630Eval.flagged,
      missedDoseRiskLevel: slot0630Eval.level,
      missedDoseProbabilityPercent: slot0630Eval.probability,
      flagTriggerReason: slot0630Eval.flagged
        ? `ช่วงเวลาก่อนอาหารสั้น (30 นาที) + ${
            isCogImpaired
              ? `คะแนนความจำ Cognitive ${frailtyDomains.cognitive}/15`
              : medicationAdherence !== 'good'
              ? `ประวัติการรับประทานยาไม่สม่ำเสมอ (${medicationAdherence})`
              : `การอยู่อาศัย (${livingArrangement})`
          } ทำให้มักรับประทานอาหารเช้าก่อนโดยลืมกินยาก่อนอาหาร`
        : 'รับประทานต่อเนื่องได้ดีตามเวลาตื่นนอนตอนเช้า',
      clinicalConsequenceIfMissed: hasDiabetes
        ? 'หากลืมกินก่อนอาหารแล้วมากินหลังอาหาร อาจทำให้ระดับน้ำตาลแกว่งหรือเกิดภาวะน้ำตาลต่ำผิดเวลา'
        : 'เสี่ยงแสบท้องหรือจุกแน่นลิ้นปี่เมื่อรับประทานยาชุดหลังอาหารเช้า',
      caregiverMitigationAction: `วางซองยา 06:30 น. ไว้คู่กับแก้วน้ำอุ่นข้างเตียงของ ${name} และห้ามรับประทานยาลดน้ำตาลก่อนอาหารหากยังไม่ได้เตรียมมื้อเช้าพร้อมรับประทาน`,
      interactionOrPrecautionNote: hasDiabetes
        ? 'ต้องรับประทานอาหารเช้าภายใน 30 นาทีหลังกินยา เพื่อป้องกันอาการหน้ามืดใจสั่นจากน้ำตาลต่ำ (Hypoglycemia)'
        : 'กลืนทั้งเม็ดพร้อมน้ำสะอาด ห้ามเคี้ยวหรือบดเม็ดยา',
    });
  }

  // 2. 08:00 น. — หลังอาหารเช้า (Morning Core Antihypertensive & Metabolic Medications)
  const slot0800MedEval = evaluateSlotMissedRisk('08:00', 'prescription_med', true);
  items.push({
    id: `${id}-med-0800-bp`,
    slotTime: '08:00',
    slotPeriodLabel: '08:00 น. · หลังอาหารเช้าทันที',
    windowRange: '07:45 – 08:30 น.',
    itemType: 'prescription_med',
    itemTypeLabel: 'ยารักษาโรคประจำตัว',
    name: hasHypertension
      ? sbp >= 160
        ? 'Amlodipine 5 mg + Losartan 50 mg (ยาลดความดันโลหิตชุดเช้า)'
        : 'Amlodipine 5 mg (หรือ Enalapril 5 mg ตามใบสั่งแพทย์ รพ.สต.)'
      : 'รายการยาดูแลสุขภาพหลอดเลือดและโรคประจำตัวมื้อเช้า',
    thaiClinicalName: hasHypertension
      ? `ยาควบคุมความดันโลหิตสูง (ค่าความดันล่าสุด ${sbp}/${dbp} mmHg)`
      : 'ยาประจำตัวมื้อเช้าตามแผนการดูแลผู้สูงอายุ',
    dosageText:
      hasHypertension && sbp >= 160
        ? 'รับประทานอย่างละ 1 เม็ด หลังอาหารเช้าทันที'
        : 'รับประทานครั้งละ 1 เม็ด หลังอาหารเช้าทันที',
    indication: `ควบคุมความดันโลหิต (ปัจจุบัน ${sbp}/${dbp} mmHg · CVD Risk: ${cvdRisk}) ลดโอกาสเกิดโรคหลอดเลือดสมองและหัวใจ`,
    mealRelation: 'after_meal',
    mealRelationLabel: 'หลังอาหารเช้าทันที',
    defaultStatus: slot0800MedEval.flagged ? 'missed_risk_flagged' : 'taken',
    missedDoseFlagged: slot0800MedEval.flagged,
    missedDoseRiskLevel: slot0800MedEval.level,
    missedDoseProbabilityPercent: slot0800MedEval.probability,
    flagTriggerReason: slot0800MedEval.flagged
      ? `SBP ${sbp}/${dbp} mmHg สูงกว่าเกณฑ์ ร่วมกับวินัยการใช้ยา (${medicationAdherence}) และ Cognitive ${frailtyDomains.cognitive}/15 — เสี่ยงขาดยาควบคุมความดันช่วงเช้า`
      : 'ผูกกับมื้ออาหารเช้าหลัก ทำให้มีความสม่ำเสมอสูงสุดของวัน',
    clinicalConsequenceIfMissed:
      sbp >= 160
        ? `ความดันโลหิตตัวบน (${sbp} mmHg) เสี่ยงพุ่งเกิน 180 mmHg ทำให้ปวดศีรษะรุนแรง ตาพร่ามัว หรือหลอดเลือดสมองตีบ/แตกเฉียบพลัน`
        : 'ระดับความดันโลหิตแกว่งตัวสูงขึ้นในช่วงสายถึงบ่าย เพิ่มภาระการทำงานของหัวใจ',
    caregiverMitigationAction: `ให้ ${caregiverName} หรือ ${assignedVhv} จัดตลับยาช่องสีเช้า (สีเขียว/เหลือง) วางบนถาดอาหารเช้า และวัดความดันซ้ำหากมีอาการมึนศีรษะ`,
    interactionOrPrecautionNote:
      'หลังรับประทานยาลดความดัน ควรเปลี่ยนท่าทางจากนั่งเป็นยืนอย่างช้าๆ เพื่อป้องกันความดันตกขณะเปลี่ยนท่า (Orthostatic Hypotension) ซึ่งเสี่ยงหกล้ม',
  });

  // 2B. 08:00 น. — Morning B-Complex / Neuropathy or Metformin
  if (hasDiabetes || isCogImpaired || frailtyDomains.physical >= 9) {
    const slot0800SubEval = evaluateSlotMissedRisk('08:00', 'supplement', false);
    items.push({
      id: `${id}-sup-0800-neuro`,
      slotTime: '08:00',
      slotPeriodLabel: '08:00 น. · หลังอาหารเช้าทันที',
      windowRange: '07:45 – 08:30 น.',
      itemType: hasDiabetes ? 'prescription_med' : 'supplement',
      itemTypeLabel: hasDiabetes ? 'ยารักษาโรคประจำตัว' : 'วิตามินและผลิตภัณฑ์เสริมอาหาร',
      name: hasDiabetes
        ? 'Metformin 500 mg + Vitamin B1-6-12'
        : 'Vitamin B1-6-12 (วิตามินบีรวมบำรุงระบบประสาทและความจำ)',
      thaiClinicalName: hasDiabetes
        ? 'ยาควบคุมน้ำตาลในเลือดพร้อมวิตามินป้องกันชาปลายมือปลายเท้า'
        : 'วิตามินบำรุงปลายประสาทการทรงตัวและการรับรู้ของผู้สูงอายุ',
      dosageText: 'รับประทานครั้งละ 1 เม็ด หลังอาหารเช้าทันที',
      indication: hasDiabetes
        ? 'ควบคุมระดับน้ำตาลสะสม (HbA1c) และลดอาการชาปลายเท้าซึ่งเป็นสาเหตุของการเดินสะดุดล้ม'
        : `เสริมการทำงานของระบบประสาทและการทรงตัว (Physical ${frailtyDomains.physical}/20 · Cognitive ${frailtyDomains.cognitive}/15)`,
      mealRelation: 'after_meal',
      mealRelationLabel: 'พร้อมหรือหลังอาหารเช้าทันที',
      defaultStatus: slot0800SubEval.flagged ? 'missed_risk_flagged' : 'taken',
      missedDoseFlagged: slot0800SubEval.flagged,
      missedDoseRiskLevel: slot0800SubEval.level,
      missedDoseProbabilityPercent: Math.max(12, slot0800SubEval.probability - 4),
      flagTriggerReason: slot0800SubEval.flagged
        ? `การใช้ยาหลายรายการในมื้อเช้า (Polypharmacy Score ${frailtyDomains.chronicDisease}/10) ทำให้ผู้สูงอายุเลือกกินเฉพาะเม็ดหลักและข้ามเม็ดรอง`
        : 'รับประทานพร้อมชุดยาหลังอาหารเช้า',
      clinicalConsequenceIfMissed: hasDiabetes
        ? 'ระดับน้ำตาลหลังอาหารเช้าสูงขึ้น และอาจมีอาการชาปลายเท้ามากขึ้นหากขาดวิตามินบีต่อเนื่อง'
        : 'ลดประสิทธิภาพการบำรุงปลายประสาทและความจำในระยะยาว',
      caregiverMitigationAction:
        'บรรจุรวมในซองมื้อเช้าซองเดียวกันเพื่อลดขั้นตอนการแกะยาหลายแผงของผู้สูงอายุ',
      interactionOrPrecautionNote:
        'การรับประทาน Metformin หลังอาหารทันทีช่วยลดอาการคลื่นไส้หรือท้องอืดในผู้สูงอายุ',
    });
  }

  // 3. 12:30 น. — หลังอาหารกลางวัน (Midday Nutritional Supplement / Calcium + Vit D3 / Protein)
  const slot1230Eval = evaluateSlotMissedRisk('12:30', 'supplement', hasSarcopeniaOrLowNutrition || hasBoneOrJoint);
  items.push({
    id: `${id}-sup-1230-bone-protein`,
    slotTime: '12:30',
    slotPeriodLabel: '12:30 น. · หลังอาหารกลางวัน',
    windowRange: '12:00 – 13:15 น.',
    itemType: 'supplement',
    itemTypeLabel: 'วิตามินและผลิตภัณฑ์เสริมอาหาร',
    name: hasSarcopeniaOrLowNutrition
      ? 'Calcium Carbonate 600 mg + Vitamin D3 400 IU และเวย์โปรตีน/นมทางการแพทย์ 1 แก้ว (200 มล.)'
      : 'Calcium Carbonate 600 mg + Vitamin D3 400 IU (บำรุงมวลกระดูกและข้อเข่า)',
    thaiClinicalName: hasSarcopeniaOrLowNutrition
      ? 'แคลเซียม-วิตามินดี เสริมความแข็งแรงกระดูก ร่วมกับโปรตีนทางการแพทย์ต้านภาวะมวลกล้ามเนื้อสลาย'
      : 'แคลเซียมและวิตามินดี 3 ป้องกันกระดูกพรุนและลดความเสี่ยงกระดูกหักเมื่อพลัดตกหกล้ม',
    dosageText: hasSarcopeniaOrLowNutrition
      ? 'แคลเซียม 1 เม็ด หลังอาหารกลางวัน + ชงดื่มโปรตีนเสริม 1 แก้ว ช่วงบ่าย'
      : 'รับประทานครั้งละ 1 เม็ด หลังอาหารกลางวัน พร้อมน้ำสะอาด 1 แก้วเต็ม',
    indication: `ชะลอภาวะเปราะบางทางกาย (Frailty ${frailtyScore}/100 · BMI ${bmi} kg/m² · Nutrition ${frailtyDomains.nutrition}/15)`,
    mealRelation: 'after_meal',
    mealRelationLabel: 'หลังอาหารกลางวัน',
    defaultStatus: slot1230Eval.flagged ? 'missed_risk_flagged' : 'due_pending',
    missedDoseFlagged: slot1230Eval.flagged,
    missedDoseRiskLevel: slot1230Eval.level,
    missedDoseProbabilityPercent: slot1230Eval.probability,
    flagTriggerReason: slot1230Eval.flagged
      ? `มื้อกลางวันเป็นช่วงจุดบอดของการดูแล (${
          isLivingAlone
            ? 'ผู้สูงอายุอาศัยอยู่ลำพัง ไม่มีคนจัดเตรียมให้'
            : 'ผู้ดูแลมักออกไปทำงานนอกบ้านในช่วงกลางวัน'
        }) ร่วมกับคะแนน Nutrition ${frailtyDomains.nutrition}/15 และ Functional ${frailtyDomains.functional}/20`
      : 'ควรตรวจสอบการดื่มน้ำตามหลังการรับประทานแคลเซียมในช่วงบ่าย',
    clinicalConsequenceIfMissed:
      'มวลกล้ามเนื้อและมวลกระดูกฟื้นตัวช้าลง เพิ่มความเสี่ยงข้อเข่าทรุดและกระดูกหักหากเกิดอุบัติเหตุหกล้ม',
    caregiverMitigationAction: `เตรียมซองแคลเซียมและชงโปรตีนใส่กระบอกเก็บอุณหภูมิวางไว้ที่โต๊ะอาหารกลางวัน พร้อมตั้งนาฬิกาปลุกหรือให้ ${assignedVhv} แวะตรวจเยี่ยมช่วงบ่าย`,
    interactionOrPrecautionNote: hasKidneyCondition
      ? 'ผู้มีภาวะไตเสื่อมต้องใช้ขนาดแคลเซียมและโปรตีนตามแพทย์ รพ.สต. กำหนดอย่างเคร่งครัด และห้ามกินแคลเซียมพร้อมธาตุเหล็กหรือยาลดความดันบางชนิด (เว้นห่าง 2 ชม.)'
      : 'การรับประทานแคลเซียมในมื้อกลางวันช่วยให้ไม่ไปรบกวนการดูดซึมยารักษาโรคประจำตัวในมื้อเช้าและมื้อเย็น',
  });

  // 4. 18:00 น. — หลังอาหารเย็น (Evening Metabolic / Antihypertensive Second Dose)
  const slot1800Eval = evaluateSlotMissedRisk('18:00', 'prescription_med', hasDiabetes || sbp >= 150);
  items.push({
    id: `${id}-med-1800-evening`,
    slotTime: '18:00',
    slotPeriodLabel: '18:00 น. · หลังอาหารเย็น',
    windowRange: '17:30 – 18:45 น.',
    itemType: hasDiabetes || sbp >= 150 ? 'prescription_med' : 'supplement',
    itemTypeLabel:
      hasDiabetes || sbp >= 150 ? 'ยารักษาโรคประจำตัว' : 'วิตามินและผลิตภัณฑ์เสริมอาหาร',
    name: hasDiabetes
      ? 'Metformin 500 mg (ยาควบคุมระดับน้ำตาลมื้อเย็น)'
      : sbp >= 150
      ? 'Losartan 50 mg / Hydralazine (ยาควบคุมความดันโลหิตมื้อเย็น)'
      : 'สารอาหารบำรุงหลอดเลือดและใยอาหารละลายน้ำ (Evening Vascular & Fiber Support)',
    thaiClinicalName: hasDiabetes
      ? 'ยาควบคุมระดับน้ำตาลในเลือดช่วงค่ำและกลางคืน'
      : sbp >= 150
      ? 'ยาควบคุมความดันโลหิตต่อเนื่องช่วงค่ำป้องกันความดันพุ่งเวลากลางคืน'
      : 'ผลิตภัณฑ์เสริมใยอาหารและแร่ธาตุช่วยการขับถ่ายและสมดุลความดันช่วงเย็น',
    dosageText: 'รับประทานครั้งละ 1 เม็ด (หรือ 1 ซอง) หลังอาหารเย็นทันที',
    indication: hasDiabetes
      ? `ป้องกันน้ำตาลในเลือดสูงสะสมช่วงกลางคืน (Chronic Score ${chronicScore}/100)`
      : `รักษาระดับความดันโลหิตช่วงค่ำให้คงที่ (ปัจจุบัน ${sbp}/${dbp} mmHg)`,
    mealRelation: 'after_meal',
    mealRelationLabel: 'หลังอาหารเย็นทันที',
    defaultStatus: slot1800Eval.flagged ? 'missed_risk_flagged' : 'due_pending',
    missedDoseFlagged: slot1800Eval.flagged,
    missedDoseRiskLevel: slot1800Eval.level,
    missedDoseProbabilityPercent: slot1800Eval.probability,
    flagTriggerReason: slot1800Eval.flagged
      ? `ผู้สูงอายุมักรับประทานอาหารเย็นไม่เป็นเวลาหรือกินอาหารปริมาณน้อย จึงไม่กล้ากินยาหลังอาหารเย็น (Adherence: ${medicationAdherence} · Cognitive: ${frailtyDomains.cognitive}/15)`
      : 'รับประทานคู่กับมื้ออาหารเย็นของครอบครัว',
    clinicalConsequenceIfMissed:
      hasDiabetes || sbp >= 150
        ? 'ทำให้ระดับน้ำตาลหรือความดันโลหิตพุ่งสูงในช่วงกลางดึกถึงเช้ามืด (Nocturnal Hypertension / Hyperglycemia)'
        : 'อาจเกิดอาการท้องผูกหรือพักผ่อนไม่เต็มที่ในช่วงกลางคืน',
    caregiverMitigationAction: `ให้ ${caregiverName} จัดมื้อเย็นย่อยง่ายภายในเวลา 18:00 น. และตรวจสอบซองยามื้อเย็นทุกวันก่อนเก็บโต๊ะอาหาร`,
    interactionOrPrecautionNote:
      'หลีกเลี่ยงการดื่มน้ำปริมาณมากเกินไปหลัง 19:00 น. เพื่อลดการลุกเดินเข้าห้องน้ำในที่มืดซึ่งเสี่ยงพลัดตกหกล้ม',
  });

  // 5. 21:00 น. — ก่อนนอน (Bedtime Statin / Cardiovascular & Sleep-Safe Regimen)
  const slot2100Eval = evaluateSlotMissedRisk('21:00', 'prescription_med', hasDyslipidemiaOrHeart);
  items.push({
    id: `${id}-med-2100-bedtime`,
    slotTime: '21:00',
    slotPeriodLabel: '21:00 น. · ก่อนนอน',
    windowRange: '20:30 – 21:30 น.',
    itemType: hasDyslipidemiaOrHeart ? 'prescription_med' : 'supplement',
    itemTypeLabel: hasDyslipidemiaOrHeart
      ? 'ยารักษาโรคประจำตัว'
      : 'วิตามินและผลิตภัณฑ์เสริมอาหาร',
    name: hasDyslipidemiaOrHeart
      ? 'Atorvastatin 20 mg (หรือ Simvastatin 20 mg ยาลดไขมันในเลือดก่อนนอน)'
      : 'Magnesium & Vitamin D3 Low-Dose (ช่วยผ่อนคลายกล้ามเนื้อและลดตะคริวกลางดึก)',
    thaiClinicalName: hasDyslipidemiaOrHeart
      ? 'ยาลดไขมันคอเลสเตอรอลและสร้างความคงตัวของผนังหลอดเลือดหัวใจ-สมอง'
      : 'แร่ธาตุแมกนีเซียมป้องกันตะคริวน่องและช่วยให้การนอนหลับของผู้สูงอายุมีคุณภาพ',
    dosageText: 'รับประทานครั้งละ 1 เม็ด ก่อนนอน',
    indication: hasDyslipidemiaOrHeart
      ? `ลดความเสี่ยงหลอดเลือดหัวใจและสมองตีบตัน (CVD Risk: ${cvdRisk} · Matrix Group ${matrixGroup})`
      : `ลดอาการเกร็งกล้ามเนื้อและตะคริวตอนกลางคืน (Physical Domain ${frailtyDomains.physical}/20)`,
    mealRelation: 'bedtime',
    mealRelationLabel: 'ก่อนนอน',
    defaultStatus: slot2100Eval.flagged ? 'missed_risk_flagged' : 'due_pending',
    missedDoseFlagged: slot2100Eval.flagged,
    missedDoseRiskLevel: slot2100Eval.level,
    missedDoseProbabilityPercent: slot2100Eval.probability,
    flagTriggerReason: slot2100Eval.flagged
      ? `เป็นมื้อที่ถูกลืมบ่อยที่สุดในผู้สูงอายุ เนื่องจากหลับก่อนเวลา 21:00 น. หรือความเหนื่อยล้าช่วงค่ำ (Cognitive ${frailtyDomains.cognitive}/15 · การอยู่อาศัย: ${livingArrangement})`
      : 'เฝ้าระวังการหลับก่อนเวลารับประทานยาก่อนนอน',
    clinicalConsequenceIfMissed: hasDyslipidemiaOrHeart
      ? 'ตับสังเคราะห์คอเลสเตอรอลสูงสุดในช่วงเที่ยงคืนถึงเช้ามืด การขาดยาก่อนนอนทำให้คราบไขมันในหลอดเลือดไม่ลดลงตามเป้าหมาย'
      : 'อาจเกิดอาการตะคริวน่องกลางดึก ทำให้นอนไม่หลับและอ่อนเพลียในวันถัดไป',
    caregiverMitigationAction: `สามารถขยับเวลารับประทาน Atorvastatin มาเป็นช่วง 19:30–20:00 น. ก่อนผู้สูงอายุเข้านอนจริงได้ และวางซองยาสีน้ำเงินไว้ข้างหัวเตียงพร้อมไฟฉายอัตโนมัติ`,
    interactionOrPrecautionNote: hasDyslipidemiaOrHeart
      ? 'สังเกตอาการปวดเมื่อยกล้ามเนื้อน่องหรือต้นขาผิดปกติ และห้ามรับประทานคู่กับน้ำส้มโอ (Grapefruit/Pomelo)'
      : 'ตรวจสอบทางเดินไปห้องน้ำให้มีแสงสว่างเพียงพอก่อนเข้านอนทุกคืน',
  });

  const flaggedItems = items.filter((item) => item.missedDoseFlagged);
  const flaggedSlotCount = flaggedItems.length;
  const prescriptionCount = items.filter((i) => i.itemType === 'prescription_med').length;
  const supplementCount = items.filter((i) => i.itemType === 'supplement').length;

  const avgMissedProb =
    items.reduce((acc, item) => acc + item.missedDoseProbabilityPercent, 0) /
    Math.max(1, items.length);
  const overallAdherenceScorePercent = Math.max(
    18,
    Math.min(96, Math.round(100 - avgMissedProb))
  );

  let missedDoseVulnerabilityLevel: RiskLevel = 'Low';
  if (
    flaggedItems.some((i) => i.missedDoseRiskLevel === 'critical_flag') ||
    medicationAdherence === 'none' ||
    (matrixGroup === 'D' && flaggedSlotCount >= 2)
  ) {
    missedDoseVulnerabilityLevel = 'High';
  } else if (flaggedSlotCount >= 1 || medicationAdherence === 'irregular') {
    missedDoseVulnerabilityLevel = 'Moderate';
  }

  const hasRuleC06 = ruleAudit.some((r) => r.code === 'RULE-C06');
  const missedDoseRiskSummary =
    missedDoseVulnerabilityLevel === 'High'
      ? `เฝ้าระวังความเสี่ยงลืมรับประทานยาระดับสูง (พบ ${flaggedSlotCount} ช่วงเวลาเสี่ยงจากทั้งหมด ${
          items.length
        } รายการ)${
          hasRuleC06 ? ' · ระบบตรวจพบ RULE-C06 (ขาดยา/ไม่สม่ำเสมอ)' : ''
        } แนะนำให้ ${assignedVhv} และ ${caregiverName} ใช้ตลับยาแยกสี 5 ช่วงเวลาและผูกการเตือนเข้ากับมื้ออาหาร`
      : missedDoseVulnerabilityLevel === 'Moderate'
      ? `เฝ้าระวังความเสี่ยงลืมโดสระดับปานกลาง (พบ ${flaggedSlotCount} ช่วงเวลาเสี่ยง โดยเฉพาะมื้อกลางวันและก่อนนอน) แนะนำจัดซองยาวางคู่ถาดอาหารและตั้งเตือนเวลา 12:30 น. / 21:00 น.`
      : `ความสม่ำเสมอในการใช้ยาอยู่ในเกณฑ์ดี (คะแนนความสม่ำเสมอคาดการณ์ ${overallAdherenceScorePercent}%) คงมาตรฐานการตรวจสอบตลับยารายสัปดาห์`;

  return {
    elderId: id,
    elderName: name,
    matrixGroup,
    adherenceStatus: medicationAdherence,
    overallAdherenceScorePercent,
    missedDoseVulnerabilityLevel,
    missedDoseRiskSummary,
    flaggedSlotCount,
    totalDailyItems: items.length,
    prescriptionCount,
    supplementCount,
    riskEngineTriggers,
    items,
    generatedAt: lastScreenedAt || new Date().toISOString().slice(0, 10),
  };
}
