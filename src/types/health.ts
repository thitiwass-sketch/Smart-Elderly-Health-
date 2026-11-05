export type UserRole = 'admin' | 'rph' | 'vhv' | 'elderly';

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type MatrixGroup = 'A' | 'B' | 'C' | 'D';

export type FrailtyProtocolId = 'moph_7d' | 'fried_5d' | 'tfi_15';

export interface FrailtyDomainScores {
  physical: number; // 0 - 20 (น้ำหนักลด แรงกล้ามเนื้อ การเดิน)
  functional: number; // 0 - 20 (กิจวัตรประจำวัน ADL/IADL)
  nutrition: number; // 0 - 15 (ภาวะโภชนาการ เบื่ออาหาร BMI)
  cognitive: number; // 0 - 15 (การรับรู้ ความจำ)
  social: number; // 0 - 10 (การอยู่ลำพัง การมีผู้ดูแล)
  activity: number; // 0 - 10 (ระดับกิจกรรมทางกาย)
  chronicDisease: number; // 0 - 10 (โรคประจำตัวและการใช้ยาหลายขนาน)
}

export interface ChronicRiskMetrics {
  weight: number; // kg
  height: number; // cm
  bmi: number; // kg/m2
  waist: number; // cm
  sbp: number; // mmHg systolic
  dbp: number; // mmHg diastolic
  dietaryHabit: 'normal' | 'high_salt' | 'high_sugar' | 'high_fat';
  exerciseFrequency: 'regular' | 'occasional' | 'sedentary';
  smoking: 'never' | 'former' | 'current';
  alcohol: 'none' | 'occasional' | 'regular';
  familyHistory: boolean;
  medicationAdherence: 'good' | 'irregular' | 'none';
}

export interface RiskProfile {
  frailtyScore: number; // 0 - 100
  frailtyRisk: RiskLevel;
  chronicScore: number; // 0 - 100
  chronicRisk: RiskLevel;
  cvdRisk: RiskLevel;
  diabetesRisk: RiskLevel;
  nutritionRisk: RiskLevel;
  matrixGroup: MatrixGroup;
  matrixAction: string;
  priorityTier: 'urgent' | 'within_7d' | 'routine' | 'promotion';
}

export interface RuleTrigger {
  code: string;
  layer: 'Frailty Engine' | 'Chronic Risk Engine' | 'Matrix Stratification';
  condition: string;
  action: string;
  severity: RiskLevel;
}

export interface WeeklyHealthGoal {
  week: number;
  focus: string;
  activities: string;
  nutritionTarget: string;
  vhvCheckpoint: string;
}

export type NutritionalCardCategory =
  | 'protein_sarcopenia'
  | 'sodium_bp_control'
  | 'glycemic_metabolic'
  | 'hydration_swallowing_bone';

export interface NutritionalGuidanceCard {
  id: string;
  cardCode: string;
  category: NutritionalCardCategory;
  categoryLabel: string;
  priority: 'Critical' | 'High' | 'Moderate';
  title: string;
  subtitle: string;
  triggeredByProfile: string;
  riskDrivers: string[];
  dailyTargetMetric: string;
  koratLocalMenuExamples: string[];
  foodsToPrioritize: string[];
  foodsToAvoid: string[];
  mealTimingGuide: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snackOrHydration: string;
  };
  caregiverAndVhvInstruction: string;
}

export interface PersonalizedNutritionalGuidanceProfile {
  elderId: string;
  elderName: string;
  matrixGroup: MatrixGroup;
  isEligibleGroupBCD: boolean;
  groupNutritionalStrategyTitle: string;
  groupNutritionalStrategySummary: string;
  dailyCalorieTargetKcal: number;
  dailyProteinTargetGrams: number;
  proteinPerKgRatio: number;
  dailySodiumLimitMg: number;
  dailyFluidTargetMl: number;
  plateRatioModel: {
    label: string;
    vegPercent: number;
    proteinPercent: number;
    carbPercent: number;
    description: string;
  };
  cards: NutritionalGuidanceCard[];
  generatedAt: string;
}

export type MedicationSlotTime = '06:30' | '08:00' | '12:30' | '18:00' | '21:00';

export type MedicationItemType = 'prescription_med' | 'supplement';

export type MissedDoseRiskFlagLevel = 'critical_flag' | 'moderate_flag' | 'low_watch';

export interface MedicationScheduleItem {
  id: string;
  slotTime: MedicationSlotTime;
  slotPeriodLabel: string;
  windowRange: string;
  itemType: MedicationItemType;
  itemTypeLabel: string;
  name: string;
  thaiClinicalName: string;
  dosageText: string;
  indication: string;
  mealRelation: 'before_meal' | 'after_meal' | 'with_meal' | 'bedtime';
  mealRelationLabel: string;
  defaultStatus: 'taken' | 'missed_risk_flagged' | 'due_pending';
  missedDoseFlagged: boolean;
  missedDoseRiskLevel: MissedDoseRiskFlagLevel;
  missedDoseProbabilityPercent: number;
  flagTriggerReason: string;
  clinicalConsequenceIfMissed: string;
  caregiverMitigationAction: string;
  interactionOrPrecautionNote: string;
}

export interface MedicationAlarmConfig {
  id: string;
  elderId: string;
  medicationId: string;
  slotTime: MedicationSlotTime;
  slotPeriodLabel: string;
  pushEnabled: boolean;
  soundEnabled: boolean;
  speechReminderEnabled: boolean;
  leadTimeMinutes: number; // 0 = at time, 15 = 15 min before, 30 = 30 min before
  customReminderNote?: string;
  updatedAt: string;
}

export interface MedicationAdherenceLogEvent {
  id: string;
  elderId: string;
  elderName: string;
  medicationId: string;
  medicationName: string;
  dosageText: string;
  scheduledTime: MedicationSlotTime | string;
  scheduledPeriodLabel: string;
  takenAtTime: string; // e.g. "08:15 น."
  takenDate: string; // YYYY-MM-DD
  status: 'taken_on_time' | 'taken_delayed' | 'taken_early';
  loggedBy: 'elder_self' | 'caregiver' | 'vhv';
  loggedByLabel: string;
  notes?: string;
  verified: boolean;
}

export interface MedicationTimelineProfile {
  elderId: string;
  elderName: string;
  matrixGroup: MatrixGroup;
  adherenceStatus: 'good' | 'irregular' | 'none';
  overallAdherenceScorePercent: number;
  missedDoseVulnerabilityLevel: RiskLevel;
  missedDoseRiskSummary: string;
  flaggedSlotCount: number;
  totalDailyItems: number;
  prescriptionCount: number;
  supplementCount: number;
  riskEngineTriggers: string[];
  items: MedicationScheduleItem[];
  generatedAt: string;
}

export interface PersonalHealthPlan {
  executiveSummary: string;
  riskExplanation: string;
  fourWeekGoals: WeeklyHealthGoal[];
  physicalActivities: string[];
  nutritionAdvice: string[];
  vhvFollowUpPlan: string;
  safetyDisclaimer: string;
  generatedBy: 'rule-hybrid' | 'gemini-ai';
  updatedAt: string;
}

export interface VitalTrendPoint {
  date: string;
  sbp: number;
  dbp: number;
  weight: number;
  bmi: number;
  frailtyScore: number;
}

export interface ElderProfile {
  id: string;
  cidMasked: string;
  name: string;
  age: number;
  gender: 'หญิง' | 'ชาย';
  village: string;
  subdistrict: string;
  district: string;
  phone: string;
  caregiverName: string;
  livingArrangement: 'อยู่กับครอบครัว' | 'อยู่กับคู่สมรสสูงอายุ' | 'อยู่ลำพัง';
  chronicConditions: string[];
  assignedVhv: string;
  lastScreenedAt: string;
  screeningDurationSec: number;
  protocolUsed: FrailtyProtocolId;
  frailtyDomains: FrailtyDomainScores;
  chronicMetrics: ChronicRiskMetrics;
  riskProfile: RiskProfile;
  ruleAudit: RuleTrigger[];
  personalPlan: PersonalHealthPlan;
  history: VitalTrendPoint[];
  nextFollowUpDate: string;
  followUpStatus: 'overdue' | 'due_soon' | 'scheduled' | 'completed';
  syncStatus: 'synced' | 'pending_offline';
  verifiedByRph: boolean;
  medicationAdherenceLogs?: MedicationAdherenceLogEvent[];
}

export interface VoiceMemoAttachment {
  id: string;
  followUpId: string;
  elderId: string;
  elderName: string;
  vhvName: string;
  createdAt: string;
  durationSec: number;
  audioDataUrl?: string;
  transcriptNote: string;
  sourceMode: 'microphone' | 'field_synth';
}

export interface FollowUpRecord {
  id: string;
  elderId: string;
  elderName: string;
  age: number;
  village: string;
  subdistrict: string;
  matrixGroup: MatrixGroup;
  dueDate: string;
  completedDate?: string;
  status: 'overdue' | 'due_soon' | 'scheduled' | 'completed';
  vhvName: string;
  purpose: string;
  notes: string;
  sbpRecorded?: number;
  dbpRecorded?: number;
  weightRecorded?: number;
  adherenceLevel?: 'ดีมาก' | 'ปานกลาง' | 'ต้องกระตุ้น';
  syncStatus: 'synced' | 'pending_offline';
  voiceMemo?: VoiceMemoAttachment;
}

export interface ReferralRecord {
  id: string;
  elderId: string;
  elderName: string;
  age: number;
  village: string;
  subdistrict: string;
  matrixGroup: MatrixGroup;
  frailtyScore: number;
  bpReading: string;
  reason: string;
  triggeredRules: string[];
  referredByVhv: string;
  targetFacility: string;
  urgency: 'เร่งด่วนภายใน 24 ชม.' | 'ภายใน 7 วัน' | 'ตามรอบคลินิก';
  status: 'รอ รพ.สต. ตรวจสอบ' | 'รพ.สต. รับเรื่องแล้ว' | 'ประเมินคลินิกเสร็จสิ้น' | 'ส่งกลับ อสม. ติดตามต่อเนื่อง';
  createdAt: string;
  clinicalNote: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'SCREENING' | 'NEW_ELDER' | 'FOLLOW_UP' | 'REFERRAL' | 'HAZARD_REPORT';
  elderName: string;
  summary: string;
  createdAt: string;
  vhvName: string;
}

export type EnvironmentalHazardCategory =
  | 'unpaved_flooded_alley'
  | 'broken_walkway_steps'
  | 'no_wheelchair_ramp'
  | 'dark_alley_lighting'
  | 'sanitation_bathroom_hazard'
  | 'assistive_mobility_need';

export interface CommunityHazardReport {
  id: string;
  title: string;
  category: EnvironmentalHazardCategory;
  categoryLabel: string;
  severity: 'critical' | 'high' | 'moderate';
  elderId: string;
  elderName: string;
  elderAge: number;
  matrixGroup: MatrixGroup;
  frailtyScore: number;
  village: string;
  subdistrict: string;
  lat: number;
  lng: number;
  mapX: number; // 0 - 100 percentage across local community map
  mapY: number; // 0 - 100 percentage down local community map
  mobilityImpactDescription: string;
  requestedCommunitySupport: string;
  targetAgency:
    | 'เทศบาล/อบต. (กองช่าง)'
    | 'กองทุน LTC สปสช. ตำบล'
    | 'รพ.สต. และศูนย์ฟื้นฟูชุมชน'
    | 'อสม. จิตอาสาปรับสภาพบ้าน';
  reportedByVhv: string;
  reportedAt: string;
  status: 'pinned_pending' | 'escalated_agency' | 'in_progress' | 'resolved';
  syncStatus: 'synced' | 'pending_offline';
}

export interface SusEvaluationEntry {
  id: string;
  evaluatorName: string;
  role: 'อสม.' | 'เจ้าหน้าที่ รพ.สต.' | 'ผู้สูงอายุ/ผู้ดูแล';
  subdistrict: string;
  scores: number[]; // 10 items, each 1-5
  susTotal: number; // 0 - 100
  screeningTimeMin: number;
  comment: string;
  submittedAt: string;
}
