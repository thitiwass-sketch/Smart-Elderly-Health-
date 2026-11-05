import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COMMUNITY_BASELINE_STATS,
  VILLAGE_HIGH_RISK_MAP_NODES,
} from '../data/koratHealthData';
import {
  ElderProfile,
  FollowUpRecord,
  ReferralRecord,
} from '../types/health';
import {
  formatSafeNumber,
  formatSafePercent,
  safeNumber,
  safePercent,
  safeRatio,
} from '../utils/mathSafetyUtils';

export interface KoratReportSubdistrictItem {
  code: string;
  name: string;
  rphName: string;
  total: number;
  screened: number;
  highRisk: number;
  followUp: number;
}

export const KORAT_REPORT_SUBDISTRICTS: KoratReportSubdistrictItem[] = [
  { code: 'SD-01', name: 'ต.ในเมือง', rphName: 'ศบส.เทศบาลนครฯ / รพ.มหาราชฯ', total: 3420, screened: 3120, highRisk: 340, followUp: 280 },
  { code: 'SD-02', name: 'ต.หัวทะเล', rphName: 'รพ.สต.หัวทะเล', total: 1840, screened: 1680, highRisk: 195, followUp: 160 },
  { code: 'SD-03', name: 'ต.โพธิ์กลาง', rphName: 'รพ.สต.โพธิ์กลาง', total: 1650, screened: 1510, highRisk: 172, followUp: 145 },
  { code: 'SD-04', name: 'ต.จอหอ', rphName: 'รพ.สต.จอหอ', total: 1580, screened: 1440, highRisk: 158, followUp: 130 },
  { code: 'SD-05', name: 'ต.หนองบัวศาลา', rphName: 'รพ.สต.หนองบัวศาลา', total: 1420, screened: 1290, highRisk: 136, followUp: 115 },
  { code: 'SD-06', name: 'ต.บ้านใหม่', rphName: 'รพ.สต.บ้านใหม่', total: 1350, screened: 1230, highRisk: 128, followUp: 105 },
  { code: 'SD-07', name: 'ต.หนองจะบก', rphName: 'รพ.สต.หนองจะบก', total: 1280, screened: 1160, highRisk: 118, followUp: 98 },
  { code: 'SD-08', name: 'ต.ปรุใหญ่', rphName: 'รพ.สต.ปรุใหญ่', total: 1190, screened: 1080, highRisk: 105, followUp: 88 },
  { code: 'SD-09', name: 'ต.บ้านเกาะ', rphName: 'รพ.สต.บ้านเกาะ', total: 1120, screened: 1020, highRisk: 96, followUp: 82 },
  { code: 'SD-10', name: 'ต.สุรนารี', rphName: 'รพ.สต.สุรนารี', total: 1060, screened: 965, highRisk: 88, followUp: 74 },
];

export interface MonthlyHealthReportProps {
  elders: ElderProfile[];
  followUps?: FollowUpRecord[];
  referrals?: ReferralRecord[];
  onSelectElder?: (elder: ElderProfile) => void;
  onCreateReferral?: (elder: ElderProfile) => void;
}

type ReportPeriodId = '2026-10' | '2026-09' | '2026-08' | '2026-Q3';

interface ReportPeriodConfig {
  id: ReportPeriodId;
  thaiLabel: string;
  docCode: string;
  meetingDateThai: string;
  coverageFactor: number;
  bpDeltaNote: string;
}

const REPORT_PERIODS: ReportPeriodConfig[] = [
  {
    id: '2026-10',
    thaiLabel: 'ตุลาคม 2569 (รอบปัจจุบัน · ต.ค. 69)',
    docCode: 'KORAT-EHW-RPT-2569-10',
    meetingDateThai: '8 ตุลาคม 2569',
    coverageFactor: 1.0,
    bpDeltaNote: 'คัดกรองสะสมครบ 5 รอบเดือน · ติดตามเคส Group D เร่งด่วน 100%',
  },
  {
    id: '2026-09',
    thaiLabel: 'กันยายน 2569 (รอบเดือนก่อน · ก.ย. 69)',
    docCode: 'KORAT-EHW-RPT-2569-09',
    meetingDateThai: '10 กันยายน 2569',
    coverageFactor: 0.96,
    bpDeltaNote: 'อัตราความครอบคลุมเพิ่มขึ้น +3.4% จากเดือนสิงหาคม 2569',
  },
  {
    id: '2026-08',
    thaiLabel: 'สิงหาคม 2569 (ส.ค. 69)',
    docCode: 'KORAT-EHW-RPT-2569-08',
    meetingDateThai: '11 สิงหาคม 2569',
    coverageFactor: 0.92,
    bpDeltaNote: 'เริ่มขยายผลใช้ระบบคัดกรอง Frailty 7 มิติ ร่วมกับ อสม. 10 ตำบล',
  },
  {
    id: '2026-Q3',
    thaiLabel: 'สรุปไตรมาส 3/2569 (ก.ค. – ก.ย. 2569)',
    docCode: 'KORAT-EHW-RPT-2569-Q3',
    meetingDateThai: '30 กันยายน 2569',
    coverageFactor: 0.98,
    bpDeltaNote: 'รายงานสรุปผลระดับไตรมาสเสนอคณะกรรมการประสานงานสาธารณสุขระดับอำเภอ (คปสอ.)',
  },
];

const INITIAL_MEETING_RESOLUTIONS = [
  {
    id: 'RES-01',
    title: 'จัดสรรทีมสหวิชาชีพและรถเยี่ยมบ้านเคลื่อนที่ลงพื้นที่หมู่บ้านความหนาแน่น Group D สูงสุด 3 อันดับแรก',
    owner: 'พยาบาลเวชปฏิบัติ รพ.สต. + ทีมงานผู้สูงอายุ รพ.มหาราชนครราชสีมา',
    target: 'ดำเนินการภายใน 7 วันหลังการประชุม',
    checked: true,
  },
  {
    id: 'RES-02',
    title: 'เร่งรัดการคัดกรองเชิงรุกในกลุ่มผู้สูงอายุที่ยังตกค้าง (Unscreened 10.4%) ผ่านแอป PWA แบบ Offline-First',
    owner: 'ประธานเครือข่าย อสม. ประจำหมู่บ้านทั้ง 10 ตำบล',
    target: 'เป้าหมายความครอบคลุม ≥ 95.0% ภายในเดือนหน้า',
    checked: true,
  },
  {
    id: 'RES-03',
    title: 'ทบทวนการใช้ยาหลายขนาน (Polypharmacy) และควบคุมโซเดียมในกลุ่มผู้สูงอายุที่มีค่าความดัน SBP ≥ 150 mmHg',
    owner: 'เภสัชกรปฐมภูมิ และนักวิชาการสาธารณสุข รพ.สต.',
    target: 'ลดค่าเฉลี่ย SBP ของกลุ่มเสี่ยงลงอย่างน้อย 5–8 mmHg ในรอบประเมินถัดไป',
    checked: true,
  },
  {
    id: 'RES-04',
    title: 'เปิดระบบแจ้งเตือนเคสเร่งด่วน (Group D) ผ่านกลุ่ม LINE เครือข่าย อสม. ทันทีที่พบคะแนน Frailty ≥ 60',
    owner: 'ผู้ดูแลระบบสารสนเทศ รพ.สต. และหัวหน้าหมวด อสม.',
    target: 'ตอบสนองเบื้องต้นภายใน 24 ชั่วโมงทุกราย',
    checked: true,
  },
];

export const MonthlyHealthReport: React.FC<MonthlyHealthReportProps> = ({
  elders,
  followUps = [],
  referrals = [],
  onSelectElder,
  onCreateReferral,
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState<ReportPeriodId>('2026-10');
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<string>('ALL');
  const [paperLightMode, setPaperLightMode] = useState<boolean>(true);
  const [resolutions, setResolutions] = useState(INITIAL_MEETING_RESOLUTIONS);
  const [newResolutionText, setNewResolutionText] = useState('');
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const activePeriod =
    REPORT_PERIODS.find((p) => p.id === selectedPeriodId) || REPORT_PERIODS[0];

  // Filter elders by selected subdistrict
  const scopedElders = useMemo(() => {
    if (selectedSubdistrict === 'ALL') return elders;
    return elders.filter((e) => e.subdistrict === selectedSubdistrict);
  }, [elders, selectedSubdistrict]);

  // Filter subdistricts table
  const scopedSubdistricts = useMemo(() => {
    if (selectedSubdistrict === 'ALL') return KORAT_REPORT_SUBDISTRICTS;
    return KORAT_REPORT_SUBDISTRICTS.filter((s) => s.name === selectedSubdistrict);
  }, [selectedSubdistrict]);

  // Filter villages for outreach table
  const scopedVillages = useMemo(() => {
    if (selectedSubdistrict === 'ALL') return VILLAGE_HIGH_RISK_MAP_NODES;
    return VILLAGE_HIGH_RISK_MAP_NODES.filter((v) => v.subdistrict === selectedSubdistrict);
  }, [selectedSubdistrict]);

  // Aggregate Macro Population & Screening Metrics
  const aggregatedMetrics = useMemo(() => {
    const validElders = Array.isArray(elders) ? elders : [];
    const validScopedElders = Array.isArray(scopedElders) ? scopedElders : [];
    const extraElders = Math.max(0, validElders.length - 8);

    const baseTotal = scopedSubdistricts.reduce((acc, s) => acc + safeNumber(s?.total, 0), 0);
    const baseScreened = scopedSubdistricts.reduce((acc, s) => acc + safeNumber(s?.screened, 0), 0);
    const baseHighRisk = scopedSubdistricts.reduce((acc, s) => acc + safeNumber(s?.highRisk, 0), 0);
    const baseFollowUp = scopedSubdistricts.reduce((acc, s) => acc + safeNumber(s?.followUp, 0), 0);

    const totalTarget = safeNumber(
      selectedSubdistrict === 'ALL' ? baseTotal + extraElders : baseTotal,
      0
    );
    const coverageFactor = safeNumber(activePeriod?.coverageFactor, 1.0);
    const calculatedScreened = Math.round(
      (selectedSubdistrict === 'ALL' ? baseScreened + extraElders : baseScreened) * coverageFactor
    );
    const totalScreened = totalTarget > 0 ? Math.min(totalTarget, Math.max(0, calculatedScreened)) : 0;
    const totalUnscreened = Math.max(0, totalTarget - totalScreened);
    const coveragePct = safePercent(totalScreened, totalTarget, 1);

    // Matrix Group Breakdown
    const liveGroupD = validScopedElders.filter((e) => e?.riskProfile?.matrixGroup === 'D').length;
    const liveGroupC = validScopedElders.filter((e) => e?.riskProfile?.matrixGroup === 'C').length;
    const liveGroupB = validScopedElders.filter((e) => e?.riskProfile?.matrixGroup === 'B').length;
    const liveGroupA = validScopedElders.filter((e) => e?.riskProfile?.matrixGroup === 'A').length;

    const baseScreenedSafe = COMMUNITY_BASELINE_STATS.screenedBase || 1;
    const scaleRatio =
      selectedSubdistrict === 'ALL'
        ? coverageFactor
        : safeNumber((baseScreened / baseScreenedSafe) * coverageFactor, 1.0);

    const urgentBase = safeNumber(COMMUNITY_BASELINE_STATS?.priorityTiersBase?.urgent, 68);
    const groupDTotal =
      selectedSubdistrict === 'ALL'
        ? Math.round((urgentBase + Math.max(0, liveGroupD - 2)) * coverageFactor)
        : Math.max(liveGroupD, Math.round(baseHighRisk * coverageFactor));

    const within7dBase = safeNumber(COMMUNITY_BASELINE_STATS?.priorityTiersBase?.within7d, 145);
    const groupCTotal = Math.max(liveGroupC, Math.round(within7dBase * scaleRatio));

    const routineBase = safeNumber(COMMUNITY_BASELINE_STATS?.priorityTiersBase?.routine, 405);
    const groupBTotal = Math.max(liveGroupB, Math.round(routineBase * scaleRatio));

    const groupATotal = Math.max(
      liveGroupA,
      Math.max(0, totalScreened - (groupDTotal + groupCTotal + groupBTotal))
    );

    // Vital Signs & Frailty Averages from Cohort
    const cohortSource =
      validScopedElders.length > 0 ? validScopedElders : (validElders.length > 0 ? validElders : []);
    const cLen = Math.max(1, cohortSource.length);

    const avgSbp = cohortSource.length > 0
      ? Math.round(cohortSource.reduce((acc, e) => acc + safeNumber(e?.chronicMetrics?.sbp, 120), 0) / cLen)
      : 120;
    const avgDbp = cohortSource.length > 0
      ? Math.round(cohortSource.reduce((acc, e) => acc + safeNumber(e?.chronicMetrics?.dbp, 80), 0) / cLen)
      : 80;
    const avgFrailty = cohortSource.length > 0
      ? Number((cohortSource.reduce((acc, e) => acc + safeNumber(e?.riskProfile?.frailtyScore, 0), 0) / cLen).toFixed(1))
      : 0;
    const avgBmi = cohortSource.length > 0
      ? Number((cohortSource.reduce((acc, e) => acc + safeNumber(e?.chronicMetrics?.bmi, 0), 0) / cLen).toFixed(1))
      : 0;
    const avgScreeningSec = cohortSource.length > 0
      ? Math.round(cohortSource.reduce((acc, e) => acc + safeNumber(e?.screeningDurationSec, 180), 0) / cLen)
      : 180;

    // Follow-up & Referral execution metrics
    const safeFollowUps = Array.isArray(followUps) ? followUps : [];
    const scopedFollowUps =
      selectedSubdistrict === 'ALL'
        ? safeFollowUps
        : safeFollowUps.filter((f) => f?.subdistrict === selectedSubdistrict);
    const completedFollowUps = scopedFollowUps.filter((f) => f?.status === 'completed').length;
    const overdueFollowUps = scopedFollowUps.filter((f) => f?.status === 'overdue').length;

    const scopedReferrals =
      selectedSubdistrict === 'ALL'
        ? referrals
        : referrals.filter((r) => r.subdistrict === selectedSubdistrict);

    return {
      totalTarget,
      totalScreened,
      totalUnscreened,
      coveragePct,
      groupDTotal,
      groupCTotal,
      groupBTotal,
      groupATotal,
      baseFollowUp,
      avgSbp,
      avgDbp,
      avgFrailty,
      avgBmi,
      avgScreeningSec,
      totalFollowUpsCount: scopedFollowUps.length,
      completedFollowUps,
      overdueFollowUps,
      totalReferralsCount: scopedReferrals.length,
      verifiedCount: cohortSource.filter((e) => e.verifiedByRph).length,
      cohortTotal: cohortSource.length,
    };
  }, [elders, scopedElders, scopedSubdistricts, selectedSubdistrict, activePeriod, followUps, referrals]);

  // 5-Month Longitudinal Trend Aggregation from Elder History
  const longitudinalTrendData = useMemo(() => {
    const cohortSource = scopedElders.length > 0 ? scopedElders : elders;
    const monthLabels = [
      { idx: 0, monthThai: 'พ.ค. 69', fullDate: 'พฤษภาคม 2569', screenedRate: 78.4 },
      { idx: 1, monthThai: 'มิ.ย. 69', fullDate: 'มิถุนายน 2569', screenedRate: 81.9 },
      { idx: 2, monthThai: 'ก.ค. 69', fullDate: 'กรกฎาคม 2569', screenedRate: 84.5 },
      { idx: 3, monthThai: 'ส.ค. 69', fullDate: 'สิงหาคม 2569', screenedRate: 87.2 },
      { idx: 4, monthThai: 'ต.ค. 69', fullDate: 'ตุลาคม 2569', screenedRate: aggregatedMetrics.coveragePct },
    ];

    return monthLabels.map((m) => {
      let sbpSum = 0;
      let dbpSum = 0;
      let frailtySum = 0;
      let bmiSum = 0;
      let highBpCount = 0;

      cohortSource.forEach((elder) => {
        const hist = elder.history || [];
        const record =
          hist[Math.min(m.idx, Math.max(0, hist.length - 1))] || {
            sbp: elder.chronicMetrics.sbp,
            dbp: elder.chronicMetrics.dbp,
            frailtyScore: elder.riskProfile.frailtyScore,
            bmi: elder.chronicMetrics.bmi,
          };
        sbpSum += record.sbp;
        dbpSum += record.dbp;
        frailtySum += record.frailtyScore;
        bmiSum += record.bmi;
        if (record.sbp >= 140 || record.dbp >= 90) {
          highBpCount += 1;
        }
      });

      const n = Math.max(1, cohortSource.length);
      return {
        month: m.monthThai,
        fullDate: m.fullDate,
        avgSbp: Math.round(sbpSum / n),
        avgDbp: Math.round(dbpSum / n),
        avgFrailty: Number((frailtySum / n).toFixed(1)),
        avgBmi: Number((bmiSum / n).toFixed(1)),
        uncontrolledBpPct: Math.round((highBpCount / n) * 100),
        screenedRate: m.screenedRate,
      };
    });
  }, [scopedElders, elders, aggregatedMetrics.coveragePct]);

  // 7-Domain Frailty Burden Breakdown for BarChart
  const frailtyDomainChartData = useMemo(() => {
    const cohortSource = scopedElders.length > 0 ? scopedElders : elders;
    const n = Math.max(1, cohortSource.length);

    const domains = [
      {
        key: 'physical',
        domain: '1. กายภาพ/การเดิน',
        maxScore: 20,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.physical, 0) / n,
        intervention: 'ตารางฝึกเดินทรงตัวและแรงบีบมือที่บ้าน',
      },
      {
        key: 'functional',
        domain: '2. กิจวัตร ADL/IADL',
        maxScore: 20,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.functional, 0) / n,
        intervention: 'ประเมินสภาพแวดล้อมในบ้านป้องกันพลัดตกหกล้ม',
      },
      {
        key: 'nutrition',
        domain: '3. โภชนาการ/BMI',
        maxScore: 15,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.nutrition, 0) / n,
        intervention: 'เสริมโปรตีนไข่-ปลา-ถั่ว และลดอาหารเค็มจัด',
      },
      {
        key: 'cognitive',
        domain: '4. ความจำ/การรับรู้',
        maxScore: 15,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.cognitive, 0) / n,
        intervention: 'จัดตารางกินยาสีชัดเจนและฝึกกระตุ้นความจำ',
      },
      {
        key: 'social',
        domain: '5. สังคม/อยู่ลำพัง',
        maxScore: 10,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.social, 0) / n,
        intervention: 'จับคู่ อสม. เยี่ยมบ้านรายสัปดาห์สำหรับผู้สูงอายุอยู่ลำพัง',
      },
      {
        key: 'activity',
        domain: '6. กิจกรรมทางกาย',
        maxScore: 10,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.activity, 0) / n,
        intervention: 'ส่งเสริมชมรมผู้สูงอายุขยับกายวันละ 20 นาที',
      },
      {
        key: 'chronicDisease',
        domain: '7. โรคเรื้อรัง/ใช้ยา',
        maxScore: 10,
        avgRaw:
          cohortSource.reduce((acc, e) => acc + e.frailtyDomains.chronicDisease, 0) / n,
        intervention: 'ทบทวนยาหลายขนาน (Polypharmacy) ร่วมกับคลินิก รพ.สต.',
      },
    ];

    return domains.map((d) => {
      const burdenPct = Math.round((d.avgRaw / d.maxScore) * 100);
      return {
        ...d,
        avgScore: Number(d.avgRaw.toFixed(1)),
        burdenPct,
      };
    });
  }, [scopedElders, elders]);

  const handlePrintPdf = () => {
    setExportStatusBanner(
      `เตรียมเอกสาร PDF รหัส ${activePeriod.docCode} (${activePeriod.thaiLabel}) ขนาดมาตรฐาน A4 เรียบร้อยแล้ว — กำลังเรียกหน้าต่างพิมพ์/บันทึกเป็น PDF`
    );
    try {
      window.print();
    } catch {
      // Fallback if print dialog is blocked in iframe preview
    }
  };

  const handleCopyExecutiveSummary = async () => {
    const scopeText =
      selectedSubdistrict === 'ALL'
        ? 'เครือข่าย รพ.สต. อำเภอเมืองนครราชสีมา (10 ตำบล)'
        : `พื้นที่ ${selectedSubdistrict} อ.เมืองนครราชสีมา`;

    const summaryText = [
      `📊 รายงานสรุปผลการคัดกรองและแนวโน้มสุขภาพผู้สูงอายุประจำเดือน (${activePeriod.thaiLabel})`,
      `รหัสเอกสาร: ${activePeriod.docCode} | พื้นที่: ${scopeText}`,
      `• ความครอบคลุมการคัดกรอง: ${formatSafeNumber(aggregatedMetrics.totalScreened)}/${formatSafeNumber(aggregatedMetrics.totalTarget)} คน (${formatSafePercent(aggregatedMetrics.coveragePct)}%)`,
      `• การจำแนกตาม Risk Matrix 4 กลุ่ม: Group D (เสี่ยงสูงเร่งด่วน) ${formatSafeNumber(aggregatedMetrics.groupDTotal)} คน | Group C ${formatSafeNumber(aggregatedMetrics.groupCTotal)} คน | Group B ${formatSafeNumber(aggregatedMetrics.groupBTotal)} คน | Group A ${formatSafeNumber(aggregatedMetrics.groupATotal)} คน`,
      `• ค่าเฉลี่ยสัญญาณชีพและภาวะเปราะบาง: ความดันโลหิตเฉลี่ย ${formatSafeNumber(aggregatedMetrics.avgSbp)}/${formatSafeNumber(aggregatedMetrics.avgDbp)} mmHg | คะแนน Frailty เฉลี่ย ${formatSafeNumber(aggregatedMetrics.avgFrailty)}/100 | เวลาคัดกรองเฉลี่ย ${formatSafeNumber(aggregatedMetrics.avgScreeningSec)} วินาที/คน`,
      `• มติที่ประชุมสำคัญ: เร่งส่งทีมสหวิชาชีพลงพื้นที่หมู่บ้านความหนาแน่น Group D สูงสุด และติดตามเยี่ยมบ้านภายใน 24–72 ชม.`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summaryText);
    } catch {
      // Fallback
    }
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  const handleToggleResolution = (id: string) => {
    setResolutions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const handleAddResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResolutionText.trim()) return;
    setResolutions((prev) => [
      ...prev,
      {
        id: `RES-0${prev.length + 1}`,
        title: newResolutionText.trim(),
        owner: 'ทีมสหวิชาชีพ รพ.สต. และเครือข่าย อสม. ประจำตำบล',
        target: 'ติดตามผลในการประชุมประจำเดือนรอบถัดไป',
        checked: true,
      },
    ]);
    setNewResolutionText('');
  };

  // Surface styling classes based on PDF Paper Light Mode vs Executive Dark Slate Mode
  const sheetBg = paperLightMode
    ? 'bg-white text-slate-900 border-slate-300 shadow-2xl'
    : 'bg-slate-900 text-slate-100 border-teal-500/40 shadow-2xl';
  const sectionCard = paperLightMode
    ? 'bg-slate-50 border border-slate-200 text-slate-900'
    : 'bg-slate-950/90 border border-slate-800 text-slate-100';
  const mutedText = paperLightMode ? 'text-slate-600' : 'text-slate-300';
  const headingText = paperLightMode ? 'text-slate-950' : 'text-white';
  const tableHeaderBg = paperLightMode
    ? 'bg-slate-100 text-slate-700 border-b border-slate-300'
    : 'bg-slate-800 text-slate-200 border-b border-slate-700';
  const tableRowBorder = paperLightMode ? 'divide-slate-200' : 'divide-slate-800';

  return (
    <div className="space-y-6">
      {/* Top Interactive Report Toolbar (Hidden when printing to PDF) */}
      <section className="print-hidden bg-slate-800 border border-teal-500/40 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
              <FileText className="w-4 h-4 text-teal-400" />
              <span>ระบบจัดทำรายงานสรุปผลสุขภาพผู้สูงอายุประจำเดือน (Monthly Health Officer Report)</span>
              <span aria-hidden="true">·</span>
              <span>PDF-Ready Executive Briefing</span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-white tracking-tight">
              รายงานสรุปการคัดกรองและแนวโน้มสุขภาพผู้สูงอายุระดับชุมชน สำหรับนำเสนอในที่ประชุม รพ.สต.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPaperLightMode((prev) => !prev)}
              className={`px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                paperLightMode
                  ? 'bg-white text-slate-950 border-white shadow-sm'
                  : 'bg-slate-900 text-teal-300 border-teal-500/50 hover:bg-slate-700'
              }`}
            >
              {paperLightMode
                ? 'โหมดเอกสาร: กระดาษรายงาน A4 (PDF Print-Ready)'
                : 'โหมดเอกสาร: จอนำเสนอห้องประชุม (Dark Slate)'}
            </button>

            <button
              type="button"
              onClick={handleCopyExecutiveSummary}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {copiedSummary ? 'คัดลอกบทสรุปผู้บริหารแล้ว' : 'คัดลอกสรุปเข้าวาระการประชุม'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน / ส่งออก PDF (Print PDF)</span>
            </button>
          </div>
        </div>

        {/* Report Filter Controls */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
              <label htmlFor="report-period-select" className="text-xs font-semibold text-slate-200">
                รอบการประชุม:
              </label>
              <select
                id="report-period-select"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value as ReportPeriodId)}
                className="py-1.5 px-3 text-xs font-semibold border border-slate-600 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                {REPORT_PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.thaiLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-400 shrink-0" />
              <label htmlFor="report-subdistrict-select" className="text-xs font-semibold text-slate-200">
                ขอบเขตพื้นที่รายงาน:
              </label>
              <select
                id="report-subdistrict-select"
                value={selectedSubdistrict}
                onChange={(e) => setSelectedSubdistrict(e.target.value)}
                className="py-1.5 px-3 text-xs font-semibold border border-slate-600 rounded-lg bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="ALL">ทุกตำบลในเครือข่าย อ.เมืองนครราชสีมา (10 รพ.สต.)</option>
                {KORAT_REPORT_SUBDISTRICTS.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.rphName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="font-mono-num text-teal-300 font-semibold">
              รหัสอ้างอิง: {activePeriod.docCode}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activePeriod.bpDeltaNote}</span>
          </div>
        </div>

        {exportStatusBanner && (
          <div className="mt-4 p-3 rounded-lg bg-teal-950 border border-teal-500/60 text-teal-100 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{exportStatusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportStatusBanner(null)}
              className="text-teal-300 hover:text-white font-semibold cursor-pointer shrink-0"
            >
              รับทราบ
            </button>
          </div>
        )}
      </section>

      {/* PDF-READY REPORT SHEET CONTAINER */}
      <article
        id="monthly-health-report-sheet"
        className={`pdf-report-sheet rounded-2xl border p-6 sm:p-10 space-y-8 transition-colors duration-150 ${sheetBg}`}
      >
        {/* OFFICIAL REPORT HEADER */}
        <div
          className={`pb-6 border-b-2 ${
            paperLightMode ? 'border-slate-900' : 'border-teal-500/50'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-teal-600 dark:text-teal-400">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>เอกสารราชการเพื่อการวางแผนสาธารณสุขระดับปฐมภูมิ (Primary Care Decision Report)</span>
                <span aria-hidden="true">·</span>
                <span>เครือข่ายสุขภาพอำเภอเมืองนครราชสีมา</span>
              </div>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${headingText}`}>
                รายงานสรุปผลการคัดกรองความเสี่ยงและแนวโน้มสุขภาพผู้สูงอายุประจำเดือน
              </h2>
              <p className={`text-sm font-medium ${mutedText}`}>
                พื้นที่รายงาน:{' '}
                <strong className={headingText}>
                  {selectedSubdistrict === 'ALL'
                    ? 'เครือข่าย รพ.สต. อำเภอเมือง จังหวัดนครราชสีมา (รวม 10 ตำบล)'
                    : `${selectedSubdistrict} (${
                        scopedSubdistricts[0]?.rphName || 'รพ.สต.ในเครือข่าย'
                      }) อ.เมือง จ.นครราชสีมา`}
                </strong>{' '}
                · ประจำงวด:{' '}
                <strong className={headingText}>{activePeriod.thaiLabel}</strong>
              </p>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 shrink-0 ${
                paperLightMode
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-slate-950 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">เลขที่เอกสาร:</span>
                <span className="font-mono-num font-bold text-teal-700 dark:text-teal-300">
                  {activePeriod.docCode}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">วันที่นำเสนอที่ประชุม:</span>
                <span className="font-mono-num">{activePeriod.meetingDateThai}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">กรอบมาตรฐาน:</span>
                <span>MOPH 7-Domain Frailty + 4-Tier Matrix</span>
              </div>
            </div>
          </div>

          {/* Executive Key Takeaway Banner */}
          <div
            className={`mt-5 p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              paperLightMode
                ? 'bg-teal-50/90 border-teal-300 text-slate-900'
                : 'bg-teal-950/50 border-teal-500/40 text-slate-100'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>บทสรุปผู้บริหารสำหรับวาระการประชุมประจำเดือน (Executive Summary)</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">
                ดำเนินการคัดกรองผู้สูงอายุสะสมแล้ว{' '}
                <strong className="font-mono-num font-bold">
                  {formatSafeNumber(aggregatedMetrics.totalScreened)}
                </strong>{' '}
                ราย จากกลุ่มเป้าหมาย{' '}
                <strong className="font-mono-num font-bold">
                  {formatSafeNumber(aggregatedMetrics.totalTarget)}
                </strong>{' '}
                ราย (คิดเป็น{' '}
                <strong className="font-mono-num font-bold">{formatSafePercent(aggregatedMetrics.coveragePct)}%</strong>)
                พบผู้สูงอายุกลุ่มเสี่ยงสูงมาก{' '}
                <strong className="font-mono-num font-bold text-rose-600 dark:text-rose-400">
                  Group D จำนวน {formatSafeNumber(aggregatedMetrics.groupDTotal)} ราย
                </strong>{' '}
                ที่ต้องได้รับการประเมินคลินิกและเยี่ยมบ้านภายใน 24–72 ชั่วโมง โดยมีค่าเฉลี่ยความดันโลหิตของกลุ่มเฝ้าระวังอยู่ที่{' '}
                <strong className="font-mono-num font-bold">
                  {formatSafeNumber(aggregatedMetrics.avgSbp)}/{formatSafeNumber(aggregatedMetrics.avgDbp)} mmHg
                </strong>{' '}
                และคะแนนภาวะเปราะบางเฉลี่ย{' '}
                <strong className="font-mono-num font-bold">{formatSafeNumber(aggregatedMetrics.avgFrailty)}/100</strong>
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3 font-mono-num text-xs">
              <div
                className={`px-3 py-2 rounded-lg border text-center ${
                  paperLightMode
                    ? 'bg-white border-teal-300 text-slate-900'
                    : 'bg-slate-900 border-teal-500/40 text-white'
                }`}
              >
                <div className="text-[11px] opacity-75">เวลาคัดกรองเฉลี่ย</div>
                <div className="text-base font-extrabold text-teal-600 dark:text-teal-300">
                  {aggregatedMetrics.avgScreeningSec} วินาที/คน
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: 4 KEY METRIC CARDS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-base sm:text-lg font-bold ${headingText}`}>
              01. ตัวชี้วัดหลักและการจัดกลุ่มความเสี่ยง 4 ระดับ (Executive KPI &amp; Risk Stratification)
            </h3>
            <span className={`text-xs ${mutedText}`}>
              หน่วยประมวลผล: Hybrid Rule-Based + Clinical Risk Matrix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Screening Coverage */}
            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                <span>อัตราความครอบคลุมการคัดกรอง</span>
                <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono-num">
                  {formatSafePercent(aggregatedMetrics.coveragePct)}%
                </span>
                <span className="text-xs font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">
                  +2.4% MoM
                </span>
              </div>
              <p className={`mt-1 text-xs font-mono-num ${mutedText}`}>
                คัดกรองแล้ว {formatSafeNumber(aggregatedMetrics.totalScreened)} /{' '}
                {formatSafeNumber(aggregatedMetrics.totalTarget)} คน (คงเหลือ{' '}
                {formatSafeNumber(aggregatedMetrics.totalUnscreened)} คน)
              </p>
              <div className="mt-3 w-full h-2 rounded-full bg-slate-300 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-600 dark:bg-teal-400 rounded-full"
                  style={{ width: `${Math.min(100, safeNumber(aggregatedMetrics.coveragePct, 0))}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Urgent Group D & C */}
            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                <span>เคสเร่งด่วน (Group D) และเฝ้าระวังเข้ม (Group C)</span>
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono-num text-rose-600 dark:text-rose-400">
                  {formatSafeNumber(aggregatedMetrics.groupDTotal)}
                </span>
                <span className="text-xs font-semibold">ราย (Group D)</span>
                <span aria-hidden="true" className="opacity-40">·</span>
                <span className="text-sm font-bold font-mono-num text-amber-600 dark:text-amber-400">
                  {formatSafeNumber(aggregatedMetrics.groupCTotal)} ราย (Group C)
                </span>
              </div>
              <p className={`mt-1 text-xs ${mutedText}`}>
                ต้องเยี่ยมบ้าน/ส่งต่อคลินิก {formatSafeNumber(aggregatedMetrics.baseFollowUp)} รายการในรอบเดือนนี้
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono-num">
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  D: {formatSafeNumber(aggregatedMetrics.groupDTotal)}
                </span>
                <span>·</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  C: {formatSafeNumber(aggregatedMetrics.groupCTotal)}
                </span>
                <span>·</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold">
                  B: {formatSafeNumber(aggregatedMetrics.groupBTotal)}
                </span>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  A: {formatSafeNumber(aggregatedMetrics.groupATotal)}
                </span>
              </div>
            </div>

            {/* KPI 3: Mean BP & Frailty Trajectory */}
            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                <span>ความดันโลหิตและคะแนนเปราะบางเฉลี่ย</span>
                <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono-num">
                  {aggregatedMetrics.avgSbp}/{aggregatedMetrics.avgDbp}
                </span>
                <span className="text-xs font-mono-num opacity-80">mmHg</span>
              </div>
              <p className={`mt-1 text-xs font-mono-num ${mutedText}`}>
                Frailty Score เฉลี่ย {aggregatedMetrics.avgFrailty}/100 · BMI เฉลี่ย{' '}
                {aggregatedMetrics.avgBmi} kg/m²
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span>เกณฑ์ควบคุมความดันผู้สูงอายุ: &lt; 140/90 mmHg</span>
              </div>
            </div>

            {/* KPI 4: Follow-Up & RPH Verification */}
            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                <span>การยืนยันผลคลินิกและส่งต่อ รพ.สต.</span>
                <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono-num">
                  {aggregatedMetrics.verifiedCount}/{aggregatedMetrics.cohortTotal}
                </span>
                <span className="text-xs font-semibold">แฟ้มตัวอย่างยืนยันแล้ว</span>
              </div>
              <p className={`mt-1 text-xs font-mono-num ${mutedText}`}>
                ใบส่งต่อดิจิทัลสะสม {aggregatedMetrics.totalReferralsCount} รายการ · ติดตามเยี่ยมบ้าน{' '}
                {aggregatedMetrics.totalFollowUpsCount} นัดหมาย
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>เชื่อมต่อข้อมูล อสม. ภาคสนามครบ 100%</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: VISUAL HEALTH TRENDS & FRAILTY DOMAIN CHARTS */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${headingText}`}>
                02. แนวโน้มสุขภาพย้อนหลัง 5 เดือน และโครงสร้างความเปราะบาง 7 มิติ (Longitudinal Health Trends)
              </h3>
              <p className={`text-xs ${mutedText}`}>
                ประมวลผลจากประวัติการตรวจวัดสัญญาณชีพ 5 ครั้งล่าสุด (พ.ค. – ต.ค. 2569) และคะแนนประเมินภาวะเปราะบางรายมิติ
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono-num">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>SBP เฉลี่ย (mmHg)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <span>DBP เฉลี่ย (mmHg)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Frailty Index (/100)</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart A: 5-Month SBP/DBP & Frailty Trajectory */}
            <div className={`lg:col-span-7 p-5 rounded-xl flex flex-col justify-between ${sectionCard}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`text-sm font-bold ${headingText}`}>
                    กราฟที่ 1: แนวโน้มค่าความดันโลหิต (SBP/DBP) และดัชนีภาวะเปราะบางย้อนหลัง 5 รอบเดือน
                  </h4>
                  <span className="text-xs font-mono-num text-rose-600 dark:text-rose-400 font-semibold">
                    เกณฑ์เฝ้าระวัง 140/90 mmHg
                  </span>
                </div>
                <p className={`text-xs mb-4 ${mutedText}`}>
                  แสดงค่าเฉลี่ยของกลุ่มตัวอย่างผู้สูงอายุในพื้นที่ เพื่อประเมินประสิทธิผลของการปรับพฤติกรรมและการเยี่ยมบ้านของ อสม.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={longitudinalTrendData}
                    margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="reportSbpFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={paperLightMode ? '#e2e8f0' : '#1e293b'}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{
                        fill: paperLightMode ? '#334155' : '#cbd5e1',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                    <YAxis
                      domain={[40, 175]}
                      tick={{
                        fill: paperLightMode ? '#475569' : '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: paperLightMode ? '#ffffff' : '#0f172a',
                        borderColor: paperLightMode ? '#cbd5e1' : '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: paperLightMode ? '#0f172a' : '#f8fafc',
                      }}
                    />
                    <ReferenceLine
                      y={140}
                      stroke="#e11d48"
                      strokeDasharray="4 4"
                      label={{
                        value: 'SBP 140',
                        position: 'insideTopRight',
                        fill: '#e11d48',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={90}
                      stroke="#0284c7"
                      strokeDasharray="3 3"
                      label={{
                        value: 'DBP 90',
                        position: 'insideTopRight',
                        fill: '#0284c7',
                        fontSize: 10,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgSbp"
                      name="SBP เฉลี่ย (mmHg)"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                      fill="url(#reportSbpFill)"
                      dot={{ r: 4, fill: '#e11d48' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgDbp"
                      name="DBP เฉลี่ย (mmHg)"
                      stroke="#0284c7"
                      strokeWidth={2.2}
                      dot={{ r: 3.5, fill: '#0284c7' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgFrailty"
                      name="คะแนนเปราะบางเฉลี่ย (/100)"
                      stroke="#d97706"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ r: 3.5, fill: '#d97706' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 5-Month Tabular Summary Strip */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 gap-2 text-center font-mono-num text-xs">
                {longitudinalTrendData.map((pt) => (
                  <div
                    key={pt.month}
                    className={`p-2 rounded-lg border ${
                      paperLightMode
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="font-bold text-[11px] opacity-75">{pt.month}</div>
                    <div className="font-extrabold text-rose-600 dark:text-rose-400">
                      {pt.avgSbp}/{pt.avgDbp}
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      Frailty {pt.avgFrailty}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart B: 7-Domain Frailty Burden Breakdown */}
            <div className={`lg:col-span-5 p-5 rounded-xl flex flex-col justify-between ${sectionCard}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`text-sm font-bold ${headingText}`}>
                    กราฟที่ 2: สัดส่วนความเสี่ยงรายมิติตามเกณฑ์ Frailty 7 ด้าน (% ของคะแนนเต็มรายด้าน)
                  </h4>
                  <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                </div>
                <p className={`text-xs mb-4 ${mutedText}`}>
                  ช่วยให้นักวิชาการสาธารณสุขระบุมิติที่เป็นปัญหาหลักของชุมชนเพื่อจัดสรรงบประมาณและโปรแกรมฟื้นฟูตรงจุด
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={frailtyDomainChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={paperLightMode ? '#e2e8f0' : '#1e293b'}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{
                        fill: paperLightMode ? '#475569' : '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="domain"
                      width={118}
                      tick={{
                        fill: paperLightMode ? '#1e293b' : '#e2e8f0',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: paperLightMode ? '#ffffff' : '#0f172a',
                        borderColor: paperLightMode ? '#cbd5e1' : '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: paperLightMode ? '#0f172a' : '#f8fafc',
                      }}
                      formatter={(value: any, _name: any, props: any) => [
                        `${safeNumber(value, 0)}% (เฉลี่ย ${props?.payload?.avgScore ?? 0}/${props?.payload?.maxScore ?? 10} คะแนน)`,
                        'ระดับความเปราะบางเฉลี่ย',
                      ]}
                    />
                    <Bar dataKey="burdenPct" radius={[0, 6, 6, 0]} barSize={16}>
                      {frailtyDomainChartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={
                            entry.burdenPct >= 55
                              ? '#e11d48'
                              : entry.burdenPct >= 40
                              ? '#d97706'
                              : '#0d9488'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="font-bold">ข้อค้นพบสำคัญเพื่อการวางแผนฟื้นฟูระดับชุมชน:</div>
                {frailtyDomainChartData
                  .slice()
                  .sort((a, b) => b.burdenPct - a.burdenPct)
                  .slice(0, 2)
                  .map((topD, idx) => (
                    <div key={topD.key} className="flex items-start justify-between gap-2">
                      <span>
                        {idx + 1}. <strong>{topD.domain}</strong> (ภาระความเสี่ยงเฉลี่ย{' '}
                        <span className="font-mono-num font-bold text-rose-600 dark:text-rose-400">
                          {topD.burdenPct}%
                        </span>
                        )
                      </span>
                      <span className={`text-right ${mutedText}`}>{topD.intervention}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SUBDISTRICT & VILLAGE OUTREACH TABLE */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${headingText}`}>
                03. ตารางสรุปผลการคัดกรองและการจัดสรรทรัพยากรเชิงรุกรายตำบลและหมู่บ้านเป้าหมาย
              </h3>
              <p className={`text-xs ${mutedText}`}>
                ข้อมูลสำหรับจัดสรรทีมเยี่ยมบ้านสหวิชาชีพ เครื่องวัดความดันโลหิตดิจิทัล และคิวรถรับ-ส่งผู้สูงอายุไปคลินิก รพ.สต.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>แสดงข้อมูล {scopedVillages.length} หมู่บ้านเป้าหมายเฝ้าระวังพิเศษ</span>
            </div>
          </div>

          <div className={`rounded-xl overflow-hidden border ${ paperLightMode ? 'border-slate-300' : 'border-slate-800' }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={tableHeaderBg}>
                    <th className="py-3 px-4 font-bold">หมู่บ้าน / ตำบล (รพ.สต.)</th>
                    <th className="py-3 px-3 font-bold text-right">ผู้สูงอายุคัดกรอง</th>
                    <th className="py-3 px-3 font-bold text-right">เคสเสี่ยงสูง (Group D)</th>
                    <th className="py-3 px-3 font-bold text-right">ความหนาแน่น Group D</th>
                    <th className="py-3 px-3 font-bold text-center">ทีมเชิงรุก / ชุดตรวจ</th>
                    <th className="py-3 px-4 font-bold">แผนปฏิบัติการชุมชนและกำหนดลงพื้นที่</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableRowBorder}`}>
                  {scopedVillages.map((vil) => {
                    const screenedCount = safeNumber(vil.screenedElders, 0);
                    const groupDCount = safeNumber(vil.baselineGroupDCount, 0);
                    const totalEst = Math.round(screenedCount * 1.15) || screenedCount;
                    const densityPct = safePercent(groupDCount, screenedCount, 1);
                    return (
                      <tr
                        key={vil.id}
                        className={
                          paperLightMode
                            ? 'hover:bg-slate-100/80 transition-colors'
                            : 'hover:bg-slate-800/50 transition-colors'
                        }
                      >
                        <td className="py-3 px-4">
                          <div className={`font-bold ${headingText}`}>
                            {vil.village} · {vil.subdistrict}
                          </div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {vil.rphFacility} · พิกัด {safeNumber(vil.lat, 14.9).toFixed(4)}°N, {safeNumber(vil.lng, 102.1).toFixed(4)}°E
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num">
                          <span className="font-bold">{formatSafeNumber(screenedCount)}</span> / {formatSafeNumber(totalEst)}{' '}
                          คน
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num">
                          <span className="font-extrabold text-rose-600 dark:text-rose-400">
                            {formatSafeNumber(groupDCount)} ราย
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num">
                          <span
                            className={`font-bold ${
                              densityPct >= 8.0
                                ? 'text-rose-600 dark:text-rose-400'
                                : densityPct >= 6.0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-teal-600 dark:text-teal-400'
                            }`}
                          >
                            {formatSafePercent(densityPct)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono-num">
                          <span>
                            {safeNumber(vil.outreachTeamRequired, 1)} ทีม · {safeNumber(vil.bpKitsAllocated, 1)} ชุดตรวจ
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{vil.priorityLevel === 'critical' ? 'เร่งด่วนภายใน 3 วัน' : 'ติดตามภายในสัปดาห์นี้'}</div>
                          <div className={`text-[11px] ${mutedText}`}>{vil.vhvLead}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 4: PRIORITY CASE CONFERENCE ROSTER (GROUP D & C) */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${headingText}`}>
                04. บัญชีรายชื่อผู้สูงอายุกลุ่มเสี่ยงสูง (Group D และ Group C) สำหรับวาระทบทวนเคสรายบุคคล (Case Conference)
              </h3>
              <p className={`text-xs ${mutedText}`}>
                รายชื่อผู้สูงอายุที่มีคะแนนภาวะเปราะบางหรือความเสี่ยงโรคเรื้อรังอยู่ในเกณฑ์ต้องติดตามเร่งด่วน พร้อมกฎคลินิกที่ตรวจพบ
              </p>
            </div>
            <span className="text-xs font-mono-num font-semibold text-rose-600 dark:text-rose-400">
              คัดกรองพบเคสสำคัญ {scopedElders.filter((e) => e.riskProfile.matrixGroup === 'D' || e.riskProfile.matrixGroup === 'C').length} รายในชุดข้อมูลปัจจุบัน
            </span>
          </div>

          <div className={`rounded-xl overflow-hidden border ${paperLightMode ? 'border-slate-300' : 'border-slate-800'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={tableHeaderBg}>
                    <th className="py-3 px-4 font-bold">รหัส / ชื่อ-สกุลผู้สูงอายุ</th>
                    <th className="py-3 px-3 font-bold">หมู่บ้าน / ตำบล</th>
                    <th className="py-3 px-3 font-bold text-center">กลุ่ม Matrix</th>
                    <th className="py-3 px-3 font-bold text-right">ความดัน (BP) / BMI</th>
                    <th className="py-3 px-3 font-bold text-right">คะแนนเปราะบาง</th>
                    <th className="py-3 px-4 font-bold">อสม. ผู้รับผิดชอบ / การดำเนินการ</th>
                    <th className="py-3 px-3 font-bold text-right print-hidden">แฟ้มประวัติ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableRowBorder}`}>
                  {scopedElders
                    .slice()
                    .sort((a, b) => b.riskProfile.frailtyScore - a.riskProfile.frailtyScore)
                    .map((elder) => {
                      const isGroupD = elder.riskProfile.matrixGroup === 'D';
                      const isGroupC = elder.riskProfile.matrixGroup === 'C';
                      return (
                        <tr
                          key={elder.id}
                          className={
                            paperLightMode
                              ? 'hover:bg-slate-100/80 transition-colors'
                              : 'hover:bg-slate-800/50 transition-colors'
                          }
                        >
                          <td className="py-3 px-4">
                            <div className={`font-bold ${headingText}`}>
                              {elder.name} ({elder.age} ปี)
                            </div>
                            <div className={`text-[11px] font-mono-num ${mutedText}`}>
                              {elder.id} · {elder.livingArrangement}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold">{elder.village}</div>
                            <div className={`text-[11px] ${mutedText}`}>{elder.subdistrict}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`font-extrabold font-mono-num ${
                                isGroupD
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isGroupC
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-teal-600 dark:text-teal-400'
                              }`}
                            >
                              กลุ่ม {elder.riskProfile.matrixGroup}
                            </span>
                            <div className={`text-[11px] ${mutedText}`}>
                              {elder.riskProfile.matrixAction}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num">
                            <div
                              className={`font-bold ${
                                elder.chronicMetrics.sbp >= 140
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : ''
                              }`}
                            >
                              {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp} mmHg
                            </div>
                            <div className={`text-[11px] ${mutedText}`}>
                              BMI {elder.chronicMetrics.bmi} kg/m²
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num">
                            <span className="text-sm font-extrabold">
                              {elder.riskProfile.frailtyScore}
                            </span>
                            <span className="opacity-70">/100</span>
                            <div className={`text-[11px] ${mutedText}`}>
                              Frailty: {elder.riskProfile.frailtyRisk}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{elder.assignedVhv}</div>
                            <div className={`text-[11px] ${mutedText}`}>
                              นัดติดตาม: <span className="font-mono-num">{elder.nextFollowUpDate}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right print-hidden">
                            <div className="flex items-center justify-end gap-1.5">
                              {onSelectElder && (
                                <button
                                  type="button"
                                  onClick={() => onSelectElder(elder)}
                                  className="px-2.5 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-500 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                                >
                                  ดูแฟ้มประวัติ
                                </button>
                              )}
                              {onCreateReferral && isGroupD && (
                                <button
                                  type="button"
                                  onClick={() => onCreateReferral(elder)}
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-500/60 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                                >
                                  ส่งต่อ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 5: MEETING RESOLUTIONS & OFFICIAL SIGN-OFF */}
        <section className="space-y-6 pt-2">
          <div className="space-y-3">
            <h3 className={`text-base sm:text-lg font-bold ${headingText}`}>
              05. มติที่ประชุมและข้อเสนอแนะเชิงปฏิบัติการประจำเดือน (Actionable Meeting Resolutions)
            </h3>

            <div className="space-y-2.5">
              {resolutions.map((res, index) => (
                <div
                  key={res.id}
                  onClick={() => handleToggleResolution(res.id)}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${sectionCard}`}
                >
                  <input
                    type="checkbox"
                    checked={res.checked}
                    onChange={() => handleToggleResolution(res.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 accent-teal-600 rounded cursor-pointer"
                  />
                  <div className="flex-1 text-xs space-y-1">
                    <div className={`font-bold ${headingText}`}>
                      วาระปฏิบัติการที่ {index + 1}: {res.title}
                    </div>
                    <div className={`flex flex-wrap items-center gap-2 ${mutedText}`}>
                      <span>ผู้รับผิดชอบ: {res.owner}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        กรอบเวลา: {res.target}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add custom meeting resolution input (hidden on print) */}
            <form onSubmit={handleAddResolution} className="print-hidden flex gap-2 pt-1">
              <input
                type="text"
                value={newResolutionText}
                onChange={(e) => setNewResolutionText(e.target.value)}
                placeholder="เพิ่มมติที่ประชุมหรือข้อสั่งการเพิ่มเติมสำหรับการประชุมครั้งนี้..."
                className={`flex-1 px-3.5 py-2 text-xs rounded-lg border focus:outline-none focus:border-teal-500 ${
                  paperLightMode
                    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    : 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-400'
                }`}
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-500 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>บันทึกมติที่ประชุม</span>
              </button>
            </form>
          </div>

          {/* Official Signature Blocks for Printed PDF Presentation */}
          <div
            className={`pt-8 border-t grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-xs ${
              paperLightMode ? 'border-slate-300' : 'border-slate-800'
            }`}
          >
            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <p className="font-bold">ผู้จัดทำและนำเสนอรายงาน</p>
              <div className="my-6 border-b border-dashed border-slate-400 w-48 mx-auto" />
              <p className="font-semibold">(นางสาวศิริพร วัฒนากูล)</p>
              <p className={mutedText}>นักวิชาการสาธารณสุขชำนาญการ</p>
              <p className={`text-[11px] font-mono-num mt-1 ${mutedText}`}>
                วันที่ {activePeriod.meetingDateThai}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <p className="font-bold">ผู้แทนเครือข่าย อสม. ระดับตำบล</p>
              <div className="my-6 border-b border-dashed border-slate-400 w-48 mx-auto" />
              <p className="font-semibold">(นางสมจิตร โคราชพัฒนา)</p>
              <p className={mutedText}>ประธานเครือข่าย อสม. อำเภอเมืองนครราชสีมา</p>
              <p className={`text-[11px] font-mono-num mt-1 ${mutedText}`}>
                วันที่ {activePeriod.meetingDateThai}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${sectionCard}`}>
              <p className="font-bold">ผู้ตรวจรับรองและอนุมัติแผนเชิงรุก</p>
              <div className="my-6 border-b border-dashed border-slate-400 w-48 mx-auto" />
              <p className="font-semibold">(นายแพทย์กิตติพงศ์ สุขสำราญ)</p>
              <p className={mutedText}>ประธานคณะกรรมการประสานงานสาธารณสุขอำเภอ</p>
              <p className={`text-[11px] font-mono-num mt-1 ${mutedText}`}>
                วันที่ {activePeriod.meetingDateThai}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
};
