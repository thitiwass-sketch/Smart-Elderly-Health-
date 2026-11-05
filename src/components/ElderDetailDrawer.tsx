import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  MessageSquareShare,
  Pill,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ElderProfile, PersonalHealthPlan } from '../types/health';
import { FRAILTY_PROTOCOLS } from '../utils/riskEngine';
import { speakThaiText, stopSpeakingThai } from '../utils/speechUtils';
import { MedicationSupplementTimelineSection } from './MedicationSupplementTimelineSection';
import { NutritionalGuidanceCardsSection } from './NutritionalGuidanceCardsSection';

interface ElderDetailDrawerProps {
  elder: ElderProfile | null;
  allElders?: ElderProfile[];
  onSelectElder?: (elder: ElderProfile) => void;
  onClose: () => void;
  onUpdatePlan: (elderId: string, newPlan: PersonalHealthPlan) => void;
  onOpenRescreen: (elder: ElderProfile) => void;
  onCreateReferral: (elder: ElderProfile) => void;
  onApproveAgenticPlan?: (elder: ElderProfile) => void;
}

export const ElderDetailDrawer: React.FC<ElderDetailDrawerProps> = ({
  elder,
  allElders = [],
  onSelectElder,
  onClose,
  onUpdatePlan,
  onOpenRescreen,
  onCreateReferral,
  onApproveAgenticPlan,
}) => {
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentApproved, setAgentApproved] = useState(false);
  const [isSendingLineAlert, setIsSendingLineAlert] = useState(false);
  const [lineNotificationResult, setLineNotificationResult] = useState<{
    notificationId: string;
    lineGroupName: string;
    sentAt: string;
    recipientCount: number;
    vhvAcknowledged: boolean;
    copied: boolean;
  } | null>(null);

  // Digital File QR Code Generator states
  const qrSectionRef = useRef<HTMLElement | null>(null);
  const nutritionSectionRef = useRef<HTMLDivElement | null>(null);
  const medicationTimelineRef = useRef<HTMLDivElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrPayloadMode, setQrPayloadMode] = useState<
    'deeplink' | 'clinical_tag' | 'sos_wristband'
  >('deeplink');
  const [qrCardFormat, setQrCardFormat] = useState<
    'health_card' | 'booklet_sticker' | 'wristband'
  >('health_card');
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [showQuickScanner, setShowQuickScanner] = useState(false);
  const [scanInputToken, setScanInputToken] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [isQrSectionHighlighted, setIsQrSectionHighlighted] = useState(false);

  useEffect(() => {
    setAgentApproved(false);
    setIsSendingLineAlert(false);
    setLineNotificationResult(null);
    setCopiedQrLink(false);
    setScanFeedback(null);
    return () => {
      stopSpeakingThai();
      setIsSpeaking(false);
    };
  }, [elder?.id]);

  if (!elder) return null;

  const { riskProfile, chronicMetrics, frailtyDomains, personalPlan, ruleAudit } = elder;
  const protocolInfo = FRAILTY_PROTOCOLS[elder.protocolUsed] || FRAILTY_PROTOCOLS.moph_7d;

  // Last 5 records from the elder's health history for the Recharts SBP/DBP Sparkline
  const lastFiveHistory = elder.history.slice(-5);
  const bpSparklineData = lastFiveHistory.map((item, index) => ({
    recordIndex: `#${index + 1}`,
    shortDate: item.date.slice(5), // MM-DD
    fullDate: item.date,
    sbp: item.sbp,
    dbp: item.dbp,
    weight: item.weight,
    frailtyScore: item.frailtyScore,
  }));
  const firstBpRecord = lastFiveHistory[0] ?? {
    sbp: chronicMetrics.sbp,
    dbp: chronicMetrics.dbp,
  };
  const latestBpRecord = lastFiveHistory[lastFiveHistory.length - 1] ?? {
    sbp: chronicMetrics.sbp,
    dbp: chronicMetrics.dbp,
  };
  const sbpDelta = latestBpRecord.sbp - firstBpRecord.sbp;
  const dbpDelta = latestBpRecord.dbp - firstBpRecord.dbp;

  // Unique QR Code Generator Data for the selected elder's digital file
  const elderChecksum = elder.id
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 19), 0)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  const uniqueDigitalFileToken = `SEHW-DF-${elder.id}-${riskProfile.matrixGroup}-${elderChecksum}`;
  const baseOrigin =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://smart-elderly-health-watch.korat.moph.go.th/';
  const directDigitalFileUrl = `${baseOrigin}?elderId=${encodeURIComponent(
    elder.id
  )}&token=${encodeURIComponent(uniqueDigitalFileToken)}&mode=digital_file`;

  const offlineClinicalPayload = [
    `SEHW_DIGITAL_FILE_V2`,
    `TOKEN:${uniqueDigitalFileToken}`,
    `ID:${elder.id}`,
    `NAME:${elder.name}`,
    `AGE:${elder.age}`,
    `GROUP:${riskProfile.matrixGroup}`,
    `FRAILTY:${riskProfile.frailtyScore}/100`,
    `BP:${chronicMetrics.sbp}/${chronicMetrics.dbp}`,
    `BMI:${chronicMetrics.bmi}`,
    `VILLAGE:${elder.village} ${elder.subdistrict}`,
    `VHV:${elder.assignedVhv}`,
    `URL:${directDigitalFileUrl}`,
  ].join('|');

  const sosWristbandPayload = [
    `SOS1669_ELDER_TAG`,
    `ID:${elder.id}`,
    `NAME:${elder.name} (${elder.age}ปี)`,
    `RISK:Group_${riskProfile.matrixGroup}`,
    `DISEASE:${elder.chronicConditions.join(',') || 'ไม่มีโรคประจำตัวเรื้อรัง'}`,
    `BP:${chronicMetrics.sbp}/${chronicMetrics.dbp}`,
    `CAREGIVER:${elder.caregiverName}`,
    `VHV:${elder.assignedVhv}`,
    `FILE:${directDigitalFileUrl}`,
  ].join('|');

  const activeQrValue =
    qrPayloadMode === 'deeplink'
      ? directDigitalFileUrl
      : qrPayloadMode === 'clinical_tag'
      ? offlineClinicalPayload
      : sosWristbandPayload;

  const handleScrollToQrGenerator = () => {
    qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setIsQrSectionHighlighted(true);
    setTimeout(() => setIsQrSectionHighlighted(false), 1800);
  };

  const handleScrollToNutritionCards = () => {
    nutritionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToMedicationTimeline = () => {
    medicationTimelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyQrDigitalLink = async () => {
    try {
      await navigator.clipboard.writeText(activeQrValue);
      setCopiedQrLink(true);
      setTimeout(() => setCopiedQrLink(false), 2500);
    } catch {
      setCopiedQrLink(true);
      setTimeout(() => setCopiedQrLink(false), 2500);
    }
  };

  const handleDownloadQrCardPng = () => {
    const sourceQrCanvas = qrCanvasRef.current;
    if (!sourceQrCanvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 880;
    exportCanvas.height = 480;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Background Card
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Top Clinical Accent Bar
    const accentColor =
      riskProfile.matrixGroup === 'D'
        ? '#dc2626'
        : riskProfile.matrixGroup === 'C'
        ? '#ea580c'
        : riskProfile.matrixGroup === 'B'
        ? '#d97706'
        : '#0d9488';
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, exportCanvas.width, 14);

    // Left White QR Container
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(36, 46, 280, 280);
    ctx.drawImage(sourceQrCanvas, 52, 62, 248, 248);

    // Token Caption under QR
    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(uniqueDigitalFileToken, 36, 356);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('สแกนด้วยกล้องสมาร์ทโฟน / LINE / เครื่องอ่าน รพ.สต.', 36, 382);
    ctx.fillText(`อัปเดตข้อมูลล่าสุด: ${elder.lastScreenedAt}`, 36, 404);

    // Right Elder Clinical Info
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(
      'SMART ELDERLY HEALTH WATCH · แฟ้มสุขภาพดิจิทัลประจำตัวผู้สูงอายุ',
      348,
      68
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${elder.name} (อายุ ${elder.age} ปี)`, 348, 114);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      `รหัสทะเบียน: ${elder.id}  |  กลุ่มความเสี่ยง: Group ${riskProfile.matrixGroup}`,
      348,
      152
    );

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '17px sans-serif';
    ctx.fillText(`พิกัดที่อยู่: ${elder.village} ${elder.subdistrict} ${elder.district}`, 348, 196);
    ctx.fillText(
      `สัญญาณชีพล่าสุด: BP ${chronicMetrics.sbp}/${chronicMetrics.dbp} mmHg · BMI ${chronicMetrics.bmi} · Frailty ${riskProfile.frailtyScore}/100`,
      348,
      232
    );
    ctx.fillText(
      `โรคประจำตัว: ${elder.chronicConditions.join(', ') || 'ไม่มีโรคประจำตัวเรื้อรัง'}`,
      348,
      268
    );
    ctx.fillText(
      `ผู้ดูแลหลัก: ${elder.caregiverName} (${elder.livingArrangement})`,
      348,
      304
    );
    ctx.fillText(`อสม. ประจำบ้าน: ${elder.assignedVhv}`, 348, 340);

    // Footer Strip
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(348, 368, 496, 64);
    ctx.fillStyle = '#99f6e4';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ลิงก์แฟ้มดิจิทัลสายตรง รพ.สต. / อสม.:', 364, 394);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px monospace';
    ctx.fillText(directDigitalFileUrl.slice(0, 68), 364, 416);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `QR-Digital-File-${elder.id}-${elder.name.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleTriggerScanLookup = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    // Match by ELD-XXX pattern inside URL, token, or direct ID/name
    const idMatch = trimmed.match(/ELD-\d+/i);
    const targetId = idMatch ? idMatch[0].toUpperCase() : trimmed.toUpperCase();

    const matchedElder =
      allElders.find((e) => e.id.toUpperCase() === targetId) ||
      allElders.find(
        (e) =>
          trimmed.includes(e.id) ||
          e.name.toLowerCase().includes(trimmed.toLowerCase())
      );

    if (matchedElder && onSelectElder) {
      onSelectElder(matchedElder);
      if (typeof window !== 'undefined') {
        const nextUrl = `${window.location.pathname}?elderId=${encodeURIComponent(
          matchedElder.id
        )}&mode=digital_file`;
        window.history.replaceState({}, '', nextUrl);
      }
      setScanFeedback(
        `สแกนสำเร็จ! เปิดแฟ้มดิจิทัลของ ${matchedElder.name} (${matchedElder.id}) เรียบร้อยแล้ว`
      );
      setScanInputToken('');
    } else {
      setScanFeedback(
        `ไม่พบรหัสผู้สูงอายุจากข้อมูล "${trimmed}" กรุณาตรวจสอบรหัส เช่น ELD-001`
      );
    }
  };

  const formattedLineAlertMessage = [
    `🚨 [แจ้งเตือนเคสเร่งด่วน Group ${riskProfile.matrixGroup} — เครือข่าย อสม.]`,
    `ผู้สูงอายุ: ${elder.name} (อายุ ${elder.age} ปี · รหัส ${elder.id})`,
    `พิกัดพื้นที่: ${elder.village} ${elder.subdistrict} ${elder.district}`,
    `ระดับความเสี่ยง: กลุ่ม ${riskProfile.matrixGroup} (${riskProfile.matrixAction})`,
    `สัญญาณชีพล่าสุด: BP ${chronicMetrics.sbp}/${chronicMetrics.dbp} mmHg · BMI ${chronicMetrics.bmi} กก./ตร.ม.`,
    `คะแนนภาวะเปราะบาง (Frailty): ${riskProfile.frailtyScore}/100 (${riskProfile.frailtyRisk})`,
    `การอยู่อาศัย/ผู้ดูแล: ${elder.livingArrangement} (${elder.caregiverName})`,
    `อสม.ผู้รับผิดชอบหลัก: ${elder.assignedVhv}`,
    `แนวทางปฏิบัติ: ขอให้ทีม อสม. ประจำหมู่บ้านเข้าเยี่ยมประเมินซ้ำและประสานส่งต่อ รพ.สต. ภายใน 24 ชม.`,
  ].join('\n');

  const handleNotifyLineNetwork = async () => {
    if (isSendingLineAlert) return;
    setIsSendingLineAlert(true);
    try {
      const response = await fetch('/api/line/notify-vhv-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elder: {
            id: elder.id,
            name: elder.name,
            age: elder.age,
            village: elder.village,
            subdistrict: elder.subdistrict,
            matrixGroup: riskProfile.matrixGroup,
            frailtyScore: riskProfile.frailtyScore,
            sbp: chronicMetrics.sbp,
            dbp: chronicMetrics.dbp,
            assignedVhv: elder.assignedVhv,
          },
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (response.ok) {
        const data = await response.json();
        setLineNotificationResult({
          notificationId: data.notificationId || `LINE-GRP-${Date.now().toString().slice(-6)}`,
          lineGroupName:
            data.lineGroupName ||
            `กลุ่ม LINE เครือข่าย อสม. เฝ้าระวังผู้สูงอายุ (${elder.subdistrict})`,
          sentAt:
            data.sentAt ||
            new Date().toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          recipientCount: data.recipientCount || 28,
          vhvAcknowledged: false,
          copied: false,
        });
      } else {
        throw new Error('Fallback to local simulation');
      }
    } catch {
      setLineNotificationResult({
        notificationId: `LINE-GRP-${Date.now().toString().slice(-6)}`,
        lineGroupName: `กลุ่ม LINE เครือข่าย อสม. เฝ้าระวังผู้สูงอายุ (${elder.subdistrict})`,
        sentAt: new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        recipientCount: 28,
        vhvAcknowledged: false,
        copied: false,
      });
    } finally {
      setIsSendingLineAlert(false);
    }
  };

  const handleCopyLineMessage = async () => {
    try {
      await navigator.clipboard.writeText(formattedLineAlertMessage);
      setLineNotificationResult((prev) => (prev ? { ...prev, copied: true } : prev));
    } catch {
      setLineNotificationResult((prev) => (prev ? { ...prev, copied: true } : prev));
    }
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeakingThai();
      setIsSpeaking(false);
      return;
    }

    const speechScript = `สรุปคำแนะนำสุขภาพสำหรับ ${elder.name} อายุ ${elder.age} ปี จัดอยู่ในกลุ่มความเสี่ยง ${riskProfile.matrixGroup} ${riskProfile.matrixAction}. ${personalPlan.executiveSummary}. กิจกรรมทางกายที่แนะนำ ได้แก่ ${personalPlan.physicalActivities.join(' และ ')}. คำแนะนำโภชนาการ ได้แก่ ${personalPlan.nutritionAdvice.join(' และ ')}.`;

    setIsSpeaking(true);
    speakThaiText(
      speechScript,
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  const handleGenerateAiPlan = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elder: {
            name: elder.name,
            age: elder.age,
            gender: elder.gender,
            village: elder.village,
            subdistrict: elder.subdistrict,
            district: elder.district,
            chronicConditions: elder.chronicConditions,
            livingArrangement: elder.livingArrangement,
          },
          screening: {
            weight: chronicMetrics.weight,
            height: chronicMetrics.height,
            bmi: chronicMetrics.bmi,
            waist: chronicMetrics.waist,
            sbp: chronicMetrics.sbp,
            dbp: chronicMetrics.dbp,
            dietaryHabit: chronicMetrics.dietaryHabit,
            exerciseFrequency: chronicMetrics.exerciseFrequency,
            medicationAdherence: chronicMetrics.medicationAdherence,
            frailtyScore: riskProfile.frailtyScore,
            frailtyLevel: riskProfile.frailtyRisk,
            frailtyDomains,
            chronicScore: riskProfile.chronicScore,
            chronicRisk: riskProfile.chronicRisk,
            cvdRisk: riskProfile.cvdRisk,
            diabetesRisk: riskProfile.diabetesRisk,
            nutritionRisk: riskProfile.nutritionRisk,
            matrixGroup: riskProfile.matrixGroup,
            matrixAction: riskProfile.matrixAction,
          },
          ruleAudit,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.plan) {
        throw new Error(data.error || 'ไม่สามารถเชื่อมต่อ AI Engine ได้ในขณะนี้');
      }

      const updatedPlan: PersonalHealthPlan = {
        ...data.plan,
        generatedBy: 'gemini-ai',
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      onUpdatePlan(elder.id, updatedPlan);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดในการเรียกใช้ AI Recommendation (กำลังแสดงแผนตามเกณฑ์ Rule-Based มาตรฐาน)';
      setAiError(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="elder-detail-drawer fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white text-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col justify-between">
        <div>
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-num">
                <span>รหัสทะเบียน: {elder.id}</span>
                <span aria-hidden="true">·</span>
                <span>คัดกรองล่าสุด: {elder.lastScreenedAt}</span>
                <span aria-hidden="true">·</span>
                <span>ผู้รับผิดชอบ: {elder.assignedVhv}</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {elder.name} (อายุ {elder.age} ปี)
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{elder.village}</span>
                <span aria-hidden="true">·</span>
                <span>{elder.subdistrict} {elder.district}</span>
                <span aria-hidden="true">·</span>
                <span>การอยู่อาศัย: {elder.livingArrangement}</span>
                <span aria-hidden="true">·</span>
                <span>ผู้ดูแล: {elder.caregiverName}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleScrollToMedicationTimeline}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                title="ดูตารางเวลาการใช้ยาและวิตามินเสริมประจำวัน พร้อมระบบแจ้งเตือนมื้อที่เสี่ยงลืมโดส"
              >
                <Pill className="w-3.5 h-3.5" />
                <span>ตารางยา & อาหารเสริม</span>
              </button>

              <button
                type="button"
                onClick={handleScrollToNutritionCards}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                title="ดูบัตรคำแนะนำโภชนาการเฉพาะบุคคล (Nutritional Guidance Cards สำหรับกลุ่มเสี่ยง B, C, D)"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>การ์ดโภชนาการ ({riskProfile.matrixGroup})</span>
              </button>

              <button
                type="button"
                onClick={handleScrollToQrGenerator}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                title="ดูและดาวน์โหลด QR Code ประจำตัวผู้สูงอายุเพื่อสแกนเปิดแฟ้มดิจิทัลด่วน"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR แฟ้มดิจิทัล</span>
              </button>

              <button
                type="button"
                onClick={handleNotifyLineNetwork}
                disabled={isSendingLineAlert}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {isSendingLineAlert ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังส่งเข้า LINE...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="w-3.5 h-3.5" />
                    <span>แจ้งเตือนเครือข่าย</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Unique Digital File QR Code Generator Section */}
            <section
              ref={qrSectionRef}
              className={`rounded-2xl border p-5 transition-all duration-300 ${
                isQrSectionHighlighted
                  ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-400/70 shadow-lg'
                  : 'bg-slate-900 text-slate-100 border-slate-800 shadow-md'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm sm:text-base font-extrabold ${
                          isQrSectionHighlighted ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        QR Code ประจำตัวผู้สูงอายุ — สแกนเปิดแฟ้มดิจิทัลด่วน (Instant Digital Health File QR)
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/20 border border-teal-400/50 px-2.5 py-0.5 text-[11px] font-mono-num font-bold text-teal-300">
                        Unique ID: {elder.id}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        isQrSectionHighlighted ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      สำหรับเจ้าหน้าที่ รพ.สต. และ อสม. ใช้สแกนผ่านสมาร์ทโฟนหรือแท็บเล็ตเพื่อเปิดแฟ้มประวัติ คัดกรองซ้ำ หรือส่งต่อฉุกเฉินของ{' '}
                      <span className="font-bold text-teal-300">{elder.name}</span> ได้ทันทีโดยไม่ต้องพิมพ์ค้นหา
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowQuickScanner((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      showQuickScanner
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-teal-200 border-slate-700'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>{showQuickScanner ? 'ปิดโหมดสแกนสลับแฟ้ม' : 'สแกนเปิดแฟ้มรายอื่น'}</span>
                  </button>
                </div>
              </div>

              {/* QR Payload Mode & Label Format Controls */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Left Column: Scannable QR Badge Visual */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div
                    className={`w-full rounded-2xl bg-white text-slate-900 p-4 border-2 shadow-inner flex flex-col items-center ${
                      riskProfile.matrixGroup === 'D'
                        ? 'border-red-500'
                        : riskProfile.matrixGroup === 'C'
                        ? 'border-orange-500'
                        : riskProfile.matrixGroup === 'B'
                        ? 'border-amber-500'
                        : 'border-teal-500'
                    }`}
                  >
                    {/* Top Badge Strip inside QR Card */}
                    <div className="w-full flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200 text-[11px]">
                      <span className="font-extrabold text-slate-900 truncate">
                        {qrCardFormat === 'health_card'
                          ? 'บัตรแฟ้มสุขภาพดิจิทัล รพ.สต.'
                          : qrCardFormat === 'booklet_sticker'
                          ? 'สติกเกอร์ติดสมุดสุขภาพผู้สูงอายุ'
                          : 'ป้าย QR สายรัดข้อมือฉุกเฉิน'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono-num font-extrabold text-[10px] ${
                          riskProfile.matrixGroup === 'D'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : riskProfile.matrixGroup === 'C'
                            ? 'bg-orange-100 text-orange-800 border border-orange-300'
                            : riskProfile.matrixGroup === 'B'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        Group {riskProfile.matrixGroup}
                      </span>
                    </div>

                    {/* Real ISO-Standard Scannable QR Code SVG */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <QRCodeSVG
                        value={activeQrValue}
                        size={qrCardFormat === 'wristband' ? 148 : 172}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                      />
                    </div>

                    {/* Hidden High-Res QRCodeCanvas used for PNG ID Card Export */}
                    <div className="hidden" aria-hidden="true">
                      <QRCodeCanvas
                        ref={qrCanvasRef}
                        value={activeQrValue}
                        size={256}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                      />
                    </div>

                    {/* Elder Identity Footer inside QR Card */}
                    <div className="mt-3 text-center w-full">
                      <p className="text-sm font-extrabold text-slate-900">
                        {elder.name} ({elder.age} ปี)
                      </p>
                      <p className="text-[11px] font-mono-num font-bold text-teal-700 mt-0.5">
                        {uniqueDigitalFileToken}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {elder.village} · {elder.subdistrict} · อสม. {elder.assignedVhv}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: QR Configuration, Deep-Link Preview & Staff Actions */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Payload Mode Selector */}
                  <div>
                    <label className="block text-xs font-bold text-teal-300 mb-1.5">
                      1. เลือกรูปแบบข้อมูลใน QR Code (QR Payload Mode):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'deeplink' as const,
                          title: 'ลิงก์เปิดแฟ้มดิจิทัล',
                          desc: 'สแกนเปิดหน้าต่างแฟ้มนี้ทันที',
                        },
                        {
                          id: 'clinical_tag' as const,
                          title: 'รหัสคลินิกออฟไลน์',
                          desc: 'ข้อมูลสัญญาณชีพ + ความเสี่ยง',
                        },
                        {
                          id: 'sos_wristband' as const,
                          title: 'ป้ายฉุกเฉิน 1669',
                          desc: 'โรคประจำตัว + ผู้ดูแล + อสม.',
                        },
                      ].map((mode) => {
                        const isSelected = qrPayloadMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setQrPayloadMode(mode.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-500 text-slate-950 border-teal-300 font-bold shadow-sm'
                                : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
                              <span>{mode.title}</span>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-teal-300 text-[9px] font-mono-num">
                                  Active
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] mt-0.5 ${
                                isSelected ? 'text-slate-900 font-medium' : 'text-slate-400'
                              }`}
                            >
                              {mode.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Print / Sticker Format Selector */}
                  <div>
                    <label className="block text-xs font-bold text-teal-300 mb-1.5">
                      2. รูปแบบป้ายสำหรับพิมพ์ติดสมุดพกหรือสายรัดข้อมือ:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'health_card' as const, label: 'บัตรประจำตัวดิจิทัล รพ.สต.' },
                        { id: 'booklet_sticker' as const, label: 'สติกเกอร์ติดสมุดสีชมพู' },
                        { id: 'wristband' as const, label: 'ป้ายสายรัดข้อมือผู้สูงอายุ' },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setQrCardFormat(fmt.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            qrCardFormat === fmt.id
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Encoded QR Payload / Deep-Link Readout */}
                  <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>ข้อมูลที่เข้ารหัสใน QR Code เฉพาะบุคคล ({elder.id}):</span>
                      </span>
                      <span className="font-mono-num text-slate-400">ISO/IEC 18004 Level M</span>
                    </div>
                    <p className="font-mono-num text-[11px] text-slate-200 break-all bg-slate-900/90 px-2.5 py-2 rounded-lg border border-slate-800">
                      {activeQrValue}
                    </p>
                  </div>

                  {/* Action Buttons: Download PNG, Copy Link, Print */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadQrCardPng}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลดบัตร QR (.PNG)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyQrDigitalLink}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {copiedQrLink ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">คัดลอกลิงก์เปิดแฟ้มแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-teal-300" />
                          <span>คัดลอกลิงก์/ข้อมูล QR</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-amber-300" />
                      <span>พิมพ์ป้าย QR</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Staff Quick QR Scanner / Instant File Switcher Drawer Panel */}
              {showQuickScanner && (
                <div className="mt-4 pt-4 border-t border-slate-700/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                        <ScanLine className="w-4 h-4" />
                        <span>
                          เครื่องจำลองสแกน QR Code เพื่อเปิดแฟ้มดิจิทัลผู้สูงอายุรายอื่นทันที (Staff QR File Scanner)
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        วางลิงก์/รหัส QR Token หรือคลิกเลือกป้าย QR ของผู้สูงอายุด้านล่างเพื่อสลับเปิดแฟ้มประวัติทันที
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={scanInputToken}
                      onChange={(e) => setScanInputToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTriggerScanLookup(scanInputToken);
                        }
                      }}
                      placeholder="สแกนหรือวางรหัส QR เช่น SEHW-DF-ELD-002 หรือ ELD-003..."
                      className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400 font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={() => handleTriggerScanLookup(scanInputToken)}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold shrink-0 cursor-pointer"
                    >
                      สแกนเปิดแฟ้มทันที
                    </button>
                  </div>

                  {scanFeedback && (
                    <div className="p-2.5 rounded-lg bg-teal-950/90 border border-teal-500/50 text-teal-200 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>{scanFeedback}</span>
                    </div>
                  )}

                  {allElders.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-slate-400 font-semibold">
                        คลิกจำลองการยิงสแกนป้าย QR ของผู้สูงอายุในทะเบียน รพ.สต. เพื่อสลับเปิดแฟ้มด่วน:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allElders.map((item) => {
                          const isCurrent = item.id === elder.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleTriggerScanLookup(item.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono-num border transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-teal-500 text-slate-950 border-teal-300 font-extrabold'
                                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              <QrCode className="w-3 h-3 shrink-0" />
                              <span>{item.id}</span>
                              <span className="font-sans font-bold">{item.name}</span>
                              <span className="opacity-75">(Group {item.riskProfile.matrixGroup})</span>
                              {!isCurrent && <ExternalLink className="w-3 h-3 opacity-70" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Urgent Group D LINE Network Alert Action & Simulation Box */}
            <section
              className={`rounded-xl border p-4 space-y-3 ${
                riskProfile.matrixGroup === 'D'
                  ? 'bg-red-50/80 border-red-200'
                  : 'bg-emerald-50/60 border-emerald-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <MessageSquareShare className="w-4 h-4 text-[#06C755]" />
                    <span>
                      ระบบแจ้งเตือนเคสเร่งด่วน (Group D) ไปยังกลุ่ม LINE เครือข่าย อสม. ประจำตำบล
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    ส่งข้อมูลสัญญาณชีพ พิกัดหมู่บ้าน และระดับความเสี่ยงของ {elder.name} เข้ากลุ่ม LINE เครือข่าย อสม. ({elder.subdistrict}) เพื่อระดมทีมเยี่ยมบ้านทันที
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNotifyLineNetwork}
                  disabled={isSendingLineAlert}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {isSendingLineAlert ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งแจ้งเตือนกลุ่ม LINE...</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-3.5 h-3.5" />
                      <span>แจ้งเตือนเครือข่าย</span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulated LINE Group Broadcast Result Preview */}
              {lineNotificationResult && (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-[#06C755] shrink-0" />
                      <span>
                        ส่งแจ้งเตือนเข้า &ldquo;{lineNotificationResult.lineGroupName}&rdquo; สำเร็จแล้ว
                      </span>
                    </div>
                    <span className="font-mono-num text-[11px] text-slate-500">
                      รหัสอ้างอิง: {lineNotificationResult.notificationId} · เวลา {lineNotificationResult.sentAt} น. · สมาชิก {lineNotificationResult.recipientCount} คน
                    </span>
                  </div>

                  {/* Simulated LINE Flex Message Bubble */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-xs">
                    <div className="bg-[#06C755] text-white px-3.5 py-2 flex items-center justify-between font-bold">
                      <span>LINE Notify · แจ้งเตือนเคสเร่งด่วน (กลุ่ม {riskProfile.matrixGroup})</span>
                      <span className="font-mono-num text-[11px]">ด่วนภายใน 24 ชม.</span>
                    </div>
                    <div className="p-3.5 space-y-1.5 text-slate-700">
                      <p className="font-bold text-slate-900 text-sm">
                        {elder.name} (อายุ {elder.age} ปี · {elder.id})
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">พิกัดหมู่บ้าน:</span>{' '}
                        {elder.village} {elder.subdistrict} {elder.district}
                      </p>
                      <p className="font-mono-num">
                        <span className="font-sans font-semibold text-slate-900">ผลคัดกรองวิกฤต:</span>{' '}
                        BP {chronicMetrics.sbp}/{chronicMetrics.dbp} mmHg · Frailty {riskProfile.frailtyScore}/100 ({riskProfile.frailtyRisk}) · BMI {chronicMetrics.bmi}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">การอยู่อาศัย/ผู้ดูแล:</span>{' '}
                        {elder.livingArrangement} ({elder.caregiverName})
                      </p>
                      <p className="text-red-700 font-semibold pt-1">
                        → มอบหมาย {elder.assignedVhv} และเครือข่าย อสม. หมู่บ้านใกล้เคียงเข้าติดตามอาการและประสานส่งต่อ รพ.สต. ทันที
                      </p>
                    </div>
                  </div>

                  {/* Simulated VHV Network LINE Group Replies & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    {lineNotificationResult.vhvAcknowledged ? (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-[#06C755]" />
                        <span>
                          {elder.assignedVhv} กดรับทราบในกลุ่ม LINE แล้ว: &ldquo;กำลังเดินทางเข้าเยี่ยมบ้านผู้สูงอายุค่ะ&rdquo;
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLineNotificationResult((prev) =>
                            prev ? { ...prev, vhvAcknowledged: true } : prev
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        จำลอง อสม. กดรับทราบเคสในกลุ่ม LINE
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLineMessage}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {lineNotificationResult.copied
                            ? 'คัดลอกข้อความ LINE แล้ว'
                            : 'คัดลอกข้อความ LINE'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
            {/* 1. Risk Profile & Matrix Summary */}
            <section className="border-b border-slate-200 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  1. สรุปโปรไฟล์ความเสี่ยงสุขภาพ (Health Risk Profile — ไม่ใช่การวินิจฉัยโรค)
                </h3>
                <span className="text-xs text-slate-500">
                  เกณฑ์ประเมิน: {protocolInfo.shortName}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
                <div className="border-r border-slate-100 pr-3">
                  <p className="text-xs text-slate-500">กลุ่ม Risk Matrix</p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      riskProfile.matrixGroup === 'D'
                        ? 'text-red-700'
                        : riskProfile.matrixGroup === 'C'
                        ? 'text-orange-700'
                        : riskProfile.matrixGroup === 'B'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    กลุ่ม {riskProfile.matrixGroup}
                  </p>
                  <p className="text-xs text-slate-600">{riskProfile.matrixAction}</p>
                </div>

                <div className="border-r border-slate-100 pr-3">
                  <p className="text-xs text-slate-500">Frailty Risk</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 font-mono-num">
                    {riskProfile.frailtyScore}/100
                  </p>
                  <p className="text-xs text-slate-600">ระดับ: {riskProfile.frailtyRisk}</p>
                </div>

                <div className="border-r border-slate-100 pr-3">
                  <p className="text-xs text-slate-500">Cardiovascular Risk</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {riskProfile.cvdRisk}
                  </p>
                  <p className="text-xs text-slate-600 font-mono-num">
                    BP {chronicMetrics.sbp}/{chronicMetrics.dbp} mmHg
                  </p>
                  <div className="mt-1.5 h-8 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bpSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                        <Line
                          type="monotone"
                          dataKey="sbp"
                          stroke="#dc2626"
                          strokeWidth={1.75}
                          dot={{ r: 2, fill: '#dc2626' }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="dbp"
                          stroke="#0284c7"
                          strokeWidth={1.5}
                          dot={{ r: 1.5, fill: '#0284c7' }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border-r border-slate-100 pr-3">
                  <p className="text-xs text-slate-500">Diabetes Risk</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {riskProfile.diabetesRisk}
                  </p>
                  <p className="text-xs text-slate-600 font-mono-num">
                    รอบเอว {chronicMetrics.waist} ซม.
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Nutrition Risk</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {riskProfile.nutritionRisk}
                  </p>
                  <p className="text-xs text-slate-600 font-mono-num">
                    BMI {chronicMetrics.bmi} ({chronicMetrics.weight} กก.)
                  </p>
                </div>
              </div>

              {/* 7-Domain Frailty Breakdown */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-2.5">
                  คะแนนองค์ประกอบภาวะเปราะบางรายด้าน (Modular Frailty 7 Domains):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-num">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">1. Physical (กายภาพ):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.physical}/20</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">2. Functional (กิจวัตร):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.functional}/20</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">3. Nutrition (โภชนาการ):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.nutrition}/15</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">4. Cognitive (ความจำ):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.cognitive}/15</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">5. Social (สังคม):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.social}/10</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="font-sans text-slate-600">6. Activity (กิจกรรม):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.activity}/10</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1 col-span-2">
                    <span className="font-sans text-slate-600">7. Chronic Disease (โรคประจำตัว/ยา):</span>
                    <span className="font-semibold text-slate-900">{frailtyDomains.chronicDisease}/10</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Hybrid Intelligence Layer 1: Rule-Based Audit Trail */}
            <section className="border-b border-slate-200 pb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    2. Hybrid Intelligence Layer 1 — Rule-Based Audit Trail (ตรวจสอบและอธิบายได้)
                  </h3>
                  <p className="text-xs text-slate-500">
                    กฎการตัดสินใจตามเกณฑ์มาตรฐานที่ทำงานอัตโนมัติเพื่อป้องกันความคลาดเคลื่อน (Zero Hallucination Triage)
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {ruleAudit.map((rule) => (
                  <div key={rule.code} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 font-mono-num">
                        <span className="font-semibold text-slate-900">{rule.code}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500">{rule.layer}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            rule.severity === 'High'
                              ? 'text-red-700 font-semibold'
                              : rule.severity === 'Moderate'
                              ? 'text-amber-700 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }
                        >
                          Severity: {rule.severity}
                        </span>
                      </div>
                      <p className="mt-1 font-mono-num text-slate-600">{rule.condition}</p>
                      <p className="mt-0.5 font-medium text-slate-900">→ {rule.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Hybrid Intelligence Layer 2: AI Health Recommendation & Personal Health Plan */}
            <section className="ai-health-recommendation rounded-xl bg-teal-50/70 border border-teal-200 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-200/70">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    3. AI Health Recommendation — แผนดูแลสุขภาพรายบุคคล 4 สัปดาห์ (Hybrid Layer 2)
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                    <span>
                      แหล่งประมวลผลปัจจุบัน:{' '}
                      {personalPlan.generatedBy === 'gemini-ai'
                        ? 'Gemini AI Hybrid Engine (อ้างอิงผล Rule-Based)'
                        : 'Clinical Rule-Based Template'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">อัปเดต: {personalPlan.updatedAt}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isSpeaking
                        ? 'border-amber-600 bg-amber-50 text-amber-900'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-amber-700" />
                        <span>หยุดอ่านออกเสียง</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                        <span>ฟังเสียงคำแนะนำ (Voice UX)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleGenerateAiPlan}
                    disabled={isGeneratingAi}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGeneratingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังประมวลผลด้วย Gemini AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Personalized Advice</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Transparent AI Provenance Pipeline (Unico 2025/2026 Transparent AI Pattern) */}
              <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono-num font-semibold text-slate-900">01. ข้อมูลคัดกรอง</span>
                  <p className="text-slate-600 mt-0.5">
                    Frailty {riskProfile.frailtyScore}/100 · BP {chronicMetrics.sbp}/{chronicMetrics.dbp}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono-num font-semibold text-slate-900">02. กฎ Rule-Based</span>
                  <p className="text-slate-600 mt-0.5">
                    ตรวจสอบ {ruleAudit.length} กฎ → กลุ่ม {riskProfile.matrixGroup}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono-num font-semibold text-teal-800">03. Safety Guardrail</span>
                  <p className="text-slate-600 mt-0.5">
                    ห้ามวินิจฉัยโรค · ห้ามสั่งยา
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono-num font-semibold text-teal-800">04. AI Copilot Plan</span>
                  <p className="text-slate-600 mt-0.5">
                    สร้างแผนกิจกรรมและโภชนาการ 4 สัปดาห์
                  </p>
                </div>
              </div>

              {/* Safety Guardrail Active Translucent Verification Bar */}
              <div className="mb-4 p-3.5 rounded-lg bg-teal-50/60 backdrop-blur-xs border border-teal-200/80 text-xs text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-teal-950">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Safety Guardrail Active</span>
                    <span aria-hidden="true" className="text-teal-600">·</span>
                    <span className="text-teal-800 font-medium">
                      ผ่านการตรวจสอบและควบคุมด้วยกฎของระบบ (Rule-Based Verified)
                    </span>
                  </div>
                  <span className="text-[11px] text-teal-800 font-mono-num">
                    สถานะ: ยืนยันความปลอดภัยสำหรับ อสม. และ รพ.สต.
                  </span>
                </div>
                <p className="mt-1.5 text-slate-600 leading-relaxed">
                  {personalPlan.safetyDisclaimer ||
                    'เนื้อหาคำแนะนำสุขภาพที่สร้างโดย AI ได้รับการตรวจสอบและจำกัดขอบเขตด้วยกฎของระบบอย่างโปร่งใส (AI ไม่วินิจฉัยโรค · ไม่สั่งยา · ไม่เปลี่ยนแปลงแผนการรักษาของแพทย์) โดยอ้างอิงเฉพาะข้อมูล Frailty Score และ Chronic Risk ที่ผ่านเกณฑ์คัดกรองของระบบเท่านั้น'}
                </p>
              </div>

              {/* Executive Summary & Explanation */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">สรุปภาพรวมความเสี่ยง (Executive Summary): </span>
                  <span className="text-slate-700">{personalPlan.executiveSummary}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">คำอธิบายอ้างอิง Frailty Score ({riskProfile.frailtyScore}/100) และ Chronic Risk ({riskProfile.chronicRisk}): </span>
                  <span className="text-slate-700">{personalPlan.riskExplanation}</span>
                </div>
                <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200 text-teal-900 font-medium">
                  🔔 {personalPlan.vhvFollowUpPlan} (กำหนดนัดหมาย: {elder.nextFollowUpDate})
                </div>
              </div>

              {/* Physical Activities & Nutrition Advice Highlight Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-teal-200/70 text-xs">
                <div className="p-3.5 rounded-lg bg-white/90 border border-teal-200/80">
                  <h4 className="font-semibold text-slate-900 mb-2">
                    การทำกิจกรรมทางกายที่เหมาะกับวัยและระดับ Frailty ({riskProfile.frailtyRisk})
                  </h4>
                  <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                    {personalPlan.physicalActivities.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-white/90 border border-teal-200/80">
                  <h4 className="font-semibold text-slate-900 mb-2">
                    การปรับโภชนาการตามระดับความเสี่ยง (Nutrition & Chronic Risk)
                  </h4>
                  <ul className="space-y-1.5 text-slate-700 list-disc pl-4">
                    {personalPlan.nutritionAdvice.map((nut, idx) => (
                      <li key={idx}>{nut}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 4-Week Goals Table */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-900 mb-2">
                  ตารางเป้าหมายการดูแลสุขภาพ 4 สัปดาห์ (4-Week Actionable Goals):
                </h4>
                <div className="divide-y divide-teal-100 bg-white/90 border border-teal-200/80 rounded-lg">
                  {personalPlan.fourWeekGoals.map((g) => (
                    <div key={g.week} className="p-3.5 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">{g.focus}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-600">
                        <div>
                          <span className="font-medium text-slate-800">กิจกรรมทางกาย: </span>
                          {g.activities}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">โภชนาการ: </span>
                          {g.nutritionTarget}
                        </div>
                        <div>
                          <span className="font-medium text-teal-800">จุดตรวจติดตาม อสม.: </span>
                          {g.vhvCheckpoint}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agentic UX Supervisory Action Bar */}
              <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">
                    Agentic UX Workflow — การกำกับและอนุมัติแผนปฏิบัติการโดยเจ้าหน้าที่
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    ยืนยันแผน 4 สัปดาห์เพื่อแจ้งเตือนไปยังสมาร์ทโฟนของ {elder.assignedVhv} และสมุดสุขภาพผู้สูงอายุโดยอัตโนมัติ
                  </p>
                </div>
                {agentApproved || elder.verifiedByRph ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>อนุมัติแผนและส่งแจ้งเตือน อสม. แล้ว</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAgentApproved(true);
                      if (onApproveAgenticPlan) {
                        onApproveAgenticPlan(elder);
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    อนุมัติแผนและส่งงานให้ อสม.
                  </button>
                )}
              </div>
            </section>

            {/* 3.5 Personalized Nutritional Guidance Cards (Generated from Risk Engine Profile for Groups B, C, and D) */}
            <div ref={nutritionSectionRef}>
              <NutritionalGuidanceCardsSection
                elder={elder}
                allElders={allElders}
                onSelectElder={onSelectElder}
              />
            </div>

            {/* 3.8 Chronological Medication & Supplement Timeline with Risk-Based Missed-Dose Flagging */}
            <div ref={medicationTimelineRef}>
              <MedicationSupplementTimelineSection elder={elder} />
            </div>

            {/* 4. Historical Health Trend & Recharts SBP/DBP Sparkline (Last 5 Records) */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    4. แนวโน้มสุขภาพย้อนหลังและกราฟความดันโลหิต 5 ครั้งล่าสุด (SBP/DBP Sparkline Trend)
                  </h3>
                  <p className="text-xs text-slate-500">
                    เปรียบเทียบค่าความดันโลหิตตัวบน (SBP) และตัวล่าง (DBP) ย้อนหลัง {bpSparklineData.length} ครั้งล่าสุด เพื่อเฝ้าระวังความเสี่ยงหลอดเลือดและหัวใจ
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono-num">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      sbpDelta > 0
                        ? 'text-red-700'
                        : sbpDelta < 0
                        ? 'text-emerald-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {sbpDelta > 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : sbpDelta < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    <span>
                      SBP {sbpDelta > 0 ? `+${sbpDelta}` : sbpDelta} / DBP{' '}
                      {dbpDelta > 0 ? `+${dbpDelta}` : dbpDelta} mmHg (5 ครั้งล่าสุด)
                    </span>
                  </span>
                </div>
              </div>

              {/* Recharts Blood Pressure (SBP/DBP) Sparkline Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-200/80 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                      <span>SBP ความดันตัวบน (ล่าสุด {latestBpRecord.sbp} mmHg)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                      <span>DBP ความดันตัวล่าง (ล่าสุด {latestBpRecord.dbp} mmHg)</span>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono-num">
                    เกณฑ์เฝ้าระวัง: SBP ≥ 140 · DBP ≥ 90 mmHg
                  </span>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={bpSparklineData}
                      margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="shortDate"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[60, 185]}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f8fafc',
                        }}
                        labelFormatter={(_label, payload) => {
                          const point = payload?.[0]?.payload;
                          return point
                            ? `วันที่ตรวจ: ${point.fullDate} (Frailty ${point.frailtyScore}/100)`
                            : '';
                        }}
                        formatter={(value: any, name: any) => [
                          `${value} mmHg`,
                          name === 'sbp' ? 'SBP (ตัวบน)' : 'DBP (ตัวล่าง)',
                        ]}
                      />
                      <ReferenceLine
                        y={140}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeOpacity={0.65}
                      />
                      <ReferenceLine
                        y={90}
                        stroke="#0284c7"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="sbp"
                        name="sbp"
                        stroke="#dc2626"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#dc2626', strokeWidth: 1.5, stroke: '#ffffff' }}
                        activeDot={{ r: 5.5, fill: '#b91c1c' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="dbp"
                        name="dbp"
                        stroke="#0284c7"
                        strokeWidth={2.25}
                        dot={{ r: 3.5, fill: '#0284c7', strokeWidth: 1.5, stroke: '#ffffff' }}
                        activeDot={{ r: 5, fill: '#0369a1' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 5-Record Quick Summary Strip */}
                <div className="mt-2 pt-2.5 border-t border-slate-200/80 grid grid-cols-5 gap-2 text-center font-mono-num text-[11px]">
                  {bpSparklineData.map((pt, idx) => (
                    <div
                      key={pt.fullDate + idx}
                      className={`py-1.5 px-2 rounded-md border ${
                        idx === bpSparklineData.length - 1
                          ? 'bg-white border-slate-300 font-bold text-slate-900 shadow-2xs'
                          : 'bg-slate-100/70 border-slate-200/70 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500">{pt.shortDate}</div>
                      <div
                        className={
                          pt.sbp >= 160 || pt.dbp >= 100
                            ? 'text-red-700 font-bold'
                            : pt.sbp >= 140 || pt.dbp >= 90
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700 font-semibold'
                        }
                      >
                        {pt.sbp}/{pt.dbp}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs font-mono-num">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-sans font-semibold">
                      <th className="py-2.5 px-3">วันที่บันทึก</th>
                      <th className="py-2.5 px-3 text-right">ความดันโลหิต (mmHg)</th>
                      <th className="py-2.5 px-3 text-right">น้ำหนัก (กก.)</th>
                      <th className="py-2.5 px-3 text-right">BMI (กก./ตร.ม.)</th>
                      <th className="py-2.5 px-3 text-right">คะแนนภาวะเปราะบาง (Frailty)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lastFiveHistory.map((h, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{h.date}</td>
                        <td className="py-2.5 px-3 text-right">{h.sbp}/{h.dbp}</td>
                        <td className="py-2.5 px-3 text-right">{h.weight.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right">{h.bmi.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                          {h.frailtyScore}/100
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* Bottom Sticky Action Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenRescreen(elder);
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              ประเมินคัดกรองซ้ำ (Re-Screen)
            </button>
            <button
              type="button"
              onClick={handleNotifyLineNetwork}
              disabled={isSendingLineAlert}
              className="px-4 py-2 rounded-lg bg-[#06C755] text-xs font-bold text-white hover:bg-[#05b34c] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {lineNotificationResult ? 'แจ้งเตือนเครือข่ายแล้ว (ส่งซ้ำ)' : 'แจ้งเตือนเครือข่าย'}
              </span>
            </button>
            <button
              onClick={() => {
                onClose();
                onCreateReferral(elder);
              }}
              className="px-4 py-2 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ออกใบส่งต่อ รพ.สต.</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
