import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Crosshair,
  ExternalLink,
  Filter,
  Home,
  Layers,
  LightbulbOff,
  MapPin,
  Navigation,
  PlusCircle,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  CommunityHazardReport,
  ElderProfile,
  EnvironmentalHazardCategory,
} from '../types/health';

interface VhvHazardMapReportingToolProps {
  elders: ElderProfile[];
  isOfflineMode: boolean;
  onSelectElder: (elder: ElderProfile) => void;
  onCreateReferral?: (elder: ElderProfile) => void;
  initialFocusElderId?: string | null;
  onReportSubmitted?: (report: CommunityHazardReport) => void;
}

interface ElderHomeCoordinate {
  elder: ElderProfile;
  mapX: number;
  mapY: number;
  lat: number;
  lng: number;
  zoneName: string;
}

const HAZARD_STORAGE_KEY = 'korat_ehw_community_hazards_v1';

export const HAZARD_CATEGORIES: Array<{
  id: EnvironmentalHazardCategory;
  label: string;
  shortTag: string;
  defaultAgency: CommunityHazardReport['targetAgency'];
  presetTitle: string;
  presetImpact: string;
  presetSupport: string;
}> = [
  {
    id: 'unpaved_flooded_alley',
    label: 'ซอยทางเข้าบ้านชำรุด / น้ำท่วมขัง / ดินโคลนลื่น',
    shortTag: 'ทางสัญจร/น้ำท่วมขัง',
    defaultAgency: 'เทศบาล/อบต. (กองช่าง)',
    presetTitle: 'ซอยทางเข้าบ้านน้ำท่วมขังและผิวจราจรเป็นหลุมบ่อ เสี่ยงลื่นล้ม',
    presetImpact:
      'ผู้สูงอายุที่มีภาวะเข่าเสื่อมและทรงตัวไม่ดีเดินออกมารับบริการที่ รพ.สต. ไม่ได้ และรถเข็น/รถกู้ชีพเข้าถึงหน้าบ้านลำบากช่วงฝนตก',
    presetSupport:
      'ขอความอนุเคราะห์กองช่าง เทศบาล/อบต. ลงหินคลุกปรับระดับผิวจราจรและขุดลอกรางระบายน้ำหน้าซอยบ้านผู้สูงอายุกลุ่มเสี่ยง',
  },
  {
    id: 'broken_walkway_steps',
    label: 'บันไดบ้านชันไม่มีราวจับ / ทางเท้าต่างระดับชำรุด',
    shortTag: 'บันไดชัน/ทางเท้าชำรุด',
    defaultAgency: 'กองทุน LTC สปสช. ตำบล',
    presetTitle: 'บันไดขึ้นลงบ้านชันและไม่มีราวจับพยุงตัว เสี่ยงพลัดตกหกล้ม',
    presetImpact:
      'ผู้สูงอายุมีคะแนน Physical/Functional ADL บกพร่องและมีอาการหน้ามืดจากความดันโลหิตสูง เสี่ยงก้าวพลาดตกบันไดขณะลงมาเข้าห้องน้ำ',
    presetSupport:
      'ประสานกองทุน LTC ตำบล และช่างจิตอาสาชุมชน ติดตั้งราวจับเหล็กคู่ขนานบันไดและแถบกันลื่นบริเวณขั้นบันได',
  },
  {
    id: 'no_wheelchair_ramp',
    label: 'ขาดทางลาดรถเข็น (Wheelchair Ramp) / ธรณีประตูสูง',
    shortTag: 'ขาดทางลาดรถเข็น',
    defaultAgency: 'กองทุน LTC สปสช. ตำบล',
    presetTitle: 'หน้าบ้านและห้องน้ำมีธรณีประตูสูง ไม่มีทางลาดสำหรับรถเข็น/ไม้เท้า',
    presetImpact:
      'ผู้สูงอายุกลุ่มเสี่ยงสูง (Group D) เดินสะดุดธรณีประตูบ่อยครั้ง และผู้ดูแลไม่สามารถเข็นรถเข็นพาออกมารับแสงแดดหรือไปคลินิกได้',
    presetSupport:
      'เสนอโครงการปรับสภาพแวดล้อมบ้านผู้สูงอายุ (Home Modification) ทำทางลาดคอนกรีต/ไม้เนื้อแข็งความชันมาตรฐาน 1:12',
  },
  {
    id: 'dark_alley_lighting',
    label: 'ไฟส่องสว่างซอยชำรุด / ทางเดินมืดเสี่ยงหกล้มเวลากลางคืน',
    shortTag: 'ไฟส่องสว่างชำรุด',
    defaultAgency: 'เทศบาล/อบต. (กองช่าง)',
    presetTitle: 'ไฟกิ่งส่องสว่างในซอยและทางเดินไปห้องน้ำมืดสนิทช่วงเช้ามืด-ค่ำ',
    presetImpact:
      'ผู้สูงอายุที่มีค่าสายตาพร่ามัวจากเบาหวาน/ความดัน มองไม่เห็นทางต่างระดับเมื่อตื่นเช้ามืดหรือเดินเข้าห้องน้ำกลางดึก',
    presetSupport:
      'แจ้งกองช่างเทศบาล/อบต. ซ่อมแซมไฟส่องสว่างสาธารณะ และสนับสนุนโคมไฟโซลาร์เซลล์ตรวจจับความเคลื่อนไหวบริเวณทางเดินบ้านผู้สูงอายุ',
  },
  {
    id: 'sanitation_bathroom_hazard',
    label: 'ห้องน้ำพื้นลื่น / ส้วมนั่งยองไม่เหมาะกับผู้สูงอายุข้อเข่าเสื่อม',
    shortTag: 'ห้องน้ำลื่น/ส้วมนั่งยอง',
    defaultAgency: 'อสม. จิตอาสาปรับสภาพบ้าน',
    presetTitle: 'พื้นห้องน้ำลื่นและยังใช้ส้วมนั่งยอง เสี่ยงหน้ามืดล้มในห้องน้ำ',
    presetImpact:
      'การลุกนั่งจากส้วมนั่งยองทำให้เกิดภาวะความดันตกขณะเปลี่ยนท่า (Orthostatic Hypotension) และปวดข้อเข่ารุนแรง เสี่ยงล้มศีรษะฟาดพื้น',
    presetSupport:
      'สนับสนุนเก้าอี้สุขานั่งถ่าย (Commode Chair) หรือเปลี่ยนโถสุขภัณฑ์แบบนั่งราบ พร้อมติดตั้งราวจับพยุงตัวในห้องน้ำ',
  },
  {
    id: 'assistive_mobility_need',
    label: 'ต้องการกายอุปกรณ์ช่วยเดิน (ไม้เท้า 4 ขา / Walker / รถเข็น)',
    shortTag: 'ขาดกายอุปกรณ์ช่วยเดิน',
    defaultAgency: 'รพ.สต. และศูนย์ฟื้นฟูชุมชน',
    presetTitle: 'ผู้สูงอายุเดินเซทรงตัวไม่มั่นคง ขาดไม้เท้า 4 ขา (Quad Cane) หรือ Walker',
    presetImpact:
      'ผู้สูงอายุจำกัดตัวเองอยู่แต่บนเตียงเพราะกลัวหกล้ม ทำให้มวลกล้ามเนื้อขาลดลง (Sarcopenia) และภาวะเปราะบางทรุดลงเร็ว',
    presetSupport:
      'เบิกยืมกายอุปกรณ์จากธนาคารกายอุปกรณ์ รพ.สต. / ศูนย์ฟื้นฟูสมรรถภาพชุมชน พร้อมให้ อสม. ฝึกการเดินพยุงตัวที่บ้าน',
  },
];

// Deterministic local map coordinates for elders in Mueang Nakhon Ratchasima subdistricts
function computeElderMapCoordinates(elder: ElderProfile, index: number): ElderHomeCoordinate {
  const sub = elder.subdistrict || '';
  let baseX = 52;
  let baseY = 50;
  let baseLat = 14.972;
  let baseLng = 102.098;
  let zoneName = 'โซนกลาง (ต.ในเมือง)';

  if (sub.includes('หัวทะเล')) {
    baseX = 72;
    baseY = 64;
    baseLat = 14.953;
    baseLng = 102.132;
    zoneName = 'โซนตะวันออกเฉียงใต้ (ต.หัวทะเล)';
  } else if (sub.includes('โพธิ์กลาง')) {
    baseX = 44;
    baseY = 72;
    baseLat = 14.944;
    baseLng = 102.088;
    zoneName = 'โซนใต้ (ต.โพธิ์กลาง)';
  } else if (sub.includes('จอหอ')) {
    baseX = 70;
    baseY = 24;
    baseLat = 15.018;
    baseLng = 102.131;
    zoneName = 'โซนตะวันออกเฉียงเหนือ (ต.จอหอ)';
  } else if (sub.includes('หนองบัวศาลา')) {
    baseX = 68;
    baseY = 84;
    baseLat = 14.923;
    baseLng = 102.134;
    zoneName = 'โซนใต้ตอนล่าง (ต.หนองบัวศาลา)';
  } else if (sub.includes('หมื่นไวย')) {
    baseX = 36;
    baseY = 26;
    baseLat = 15.016;
    baseLng = 102.078;
    zoneName = 'โซนเหนือลุ่มน้ำลำตะคอง (ต.หมื่นไวย)';
  } else {
    baseX = 48;
    baseY = 48;
    baseLat = 14.976;
    baseLng = 102.098;
    zoneName = 'เขตเทศบาลนคร (ต.ในเมือง)';
  }

  // Offset slightly per elder index so multiple elders in the same subdistrict don't overlap
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = (index % 3) * 4.2 + 2.5;
  const mapX = Math.max(10, Math.min(90, Math.round((baseX + Math.cos(angle) * radius) * 10) / 10));
  const mapY = Math.max(12, Math.min(88, Math.round((baseY + Math.sin(angle) * radius) * 10) / 10));
  const lat = Number((baseLat + (50 - mapY) * 0.0012).toFixed(5));
  const lng = Number((baseLng + (mapX - 50) * 0.0012).toFixed(5));

  return {
    elder,
    mapX,
    mapY,
    lat,
    lng,
    zoneName,
  };
}

function buildInitialHazardReports(elders: ElderProfile[]): CommunityHazardReport[] {
  const elderCoords = elders.map((e, i) => computeElderMapCoordinates(e, i));
  const e1 = elderCoords[0];
  const e2 = elderCoords[1] || elderCoords[0];
  const e3 = elderCoords[2] || elderCoords[0];
  const e4 = elderCoords[3] || elderCoords[0];

  const seeds: CommunityHazardReport[] = [];

  if (e1) {
    seeds.push({
      id: 'HAZ-KORAT-101',
      title: 'บันไดหน้าบ้าน 4 ขั้นไม่มีราวจับ และพื้นห้องน้ำลื่น (เสี่ยงหกล้มซ้ำ)',
      category: 'broken_walkway_steps',
      categoryLabel: 'บันไดบ้านชันไม่มีราวจับ / ทางเท้าต่างระดับชำรุด',
      severity: 'critical',
      elderId: e1.elder.id,
      elderName: e1.elder.name,
      elderAge: e1.elder.age,
      matrixGroup: e1.elder.riskProfile.matrixGroup,
      frailtyScore: e1.elder.riskProfile.frailtyScore,
      village: e1.elder.village,
      subdistrict: e1.elder.subdistrict,
      lat: e1.lat,
      lng: e1.lng,
      mapX: Math.min(92, e1.mapX + 2.2),
      mapY: Math.max(10, e1.mapY - 1.8),
      mobilityImpactDescription:
        'ผู้สูงอายุมีภาวะข้อเข่าเสื่อมและความดันโลหิตสูง 166/98 mmHg มีอาการเวียนศีรษะขณะก้าวลงบันไดไม้หน้าบ้านที่ไม่มีราวจับ ทำให้ไม่กล้าเดินออกมารับการตรวจที่ศาลาหมู่บ้าน',
      requestedCommunitySupport:
        'ประสานกองทุน LTC สปสช. ตำบลหัวทะเล และช่างจิตอาสาติดตั้งราวจับเหล็กพร้อมแผ่นยางกันลื่นในห้องน้ำเร่งด่วน',
      targetAgency: 'กองทุน LTC สปสช. ตำบล',
      reportedByVhv: e1.elder.assignedVhv,
      reportedAt: '2026-10-07 09:40',
      status: 'escalated_agency',
      syncStatus: 'synced',
    });
  }

  if (e2) {
    seeds.push({
      id: 'HAZ-KORAT-102',
      title: 'ซอยทางเข้าบ้านเป็นดินโคลนน้ำท่วมขังและขาดทางลาดสำหรับรถเข็น',
      category: 'unpaved_flooded_alley',
      categoryLabel: 'ซอยทางเข้าบ้านชำรุด / น้ำท่วมขัง / ดินโคลนลื่น',
      severity: 'critical',
      elderId: e2.elder.id,
      elderName: e2.elder.name,
      elderAge: e2.elder.age,
      matrixGroup: e2.elder.riskProfile.matrixGroup,
      frailtyScore: e2.elder.riskProfile.frailtyScore,
      village: e2.elder.village,
      subdistrict: e2.elder.subdistrict,
      lat: e2.lat,
      lng: e2.lng,
      mapX: Math.max(10, e2.mapX - 2.5),
      mapY: Math.min(90, e2.mapY + 2.0),
      mobilityImpactDescription:
        'ผู้สูงอายุอาศัยอยู่ลำพัง มีประวัติโรคหลอดเลือดสมองตีบเดิม ต้องใช้ไม้เท้าพยุงเดิน ถนนซอยเข้าบ้านมีน้ำขังและลื่นมาก ทำให้ไปรับยาที่ รพ.สต.โพธิ์กลาง ไม่สะดวก',
      requestedCommunitySupport:
        'แจ้งกองช่างเทศบาลตำบลโพธิ์กลางลงหินคลุกซ่อมพื้นผิวซอย และขอสนับสนุนไม้เท้า 4 ขา (Quad Cane) จาก รพ.สต.',
      targetAgency: 'เทศบาล/อบต. (กองช่าง)',
      reportedByVhv: e2.elder.assignedVhv,
      reportedAt: '2026-10-07 14:15',
      status: 'pinned_pending',
      syncStatus: 'synced',
    });
  }

  if (e3) {
    seeds.push({
      id: 'HAZ-KORAT-103',
      title: 'ไฟส่องสว่างปากซอยหมู่ 7 ชำรุด 3 ดวง ทางเดินมืดเสี่ยงสะดุดล้มช่วงเช้ามืด',
      category: 'dark_alley_lighting',
      categoryLabel: 'ไฟส่องสว่างซอยชำรุด / ทางเดินมืดเสี่ยงหกล้มเวลากลางคืน',
      severity: 'high',
      elderId: e3.elder.id,
      elderName: e3.elder.name,
      elderAge: e3.elder.age,
      matrixGroup: e3.elder.riskProfile.matrixGroup,
      frailtyScore: e3.elder.riskProfile.frailtyScore,
      village: e3.elder.village,
      subdistrict: e3.elder.subdistrict,
      lat: e3.lat,
      lng: e3.lng,
      mapX: Math.min(90, e3.mapX + 1.8),
      mapY: Math.min(88, e3.mapY + 2.2),
      mobilityImpactDescription:
        'ผู้สูงอายุและคู่สมรสสูงอายุต้องเดินผ่านซอยช่วงเช้ามืดเพื่อไปทำบุญและออกกำลังกายเบาๆ แต่ไฟส่องสว่างดับและมีไหล่ทางทรุดตัว',
      requestedCommunitySupport:
        'ประสานกองช่าง อบต./เทศบาลตำบลจอหอ เปลี่ยนหลอดไฟ LED ส่องสว่างและทำเส้นสะท้อนแสงขอบทางเดิน',
      targetAgency: 'เทศบาล/อบต. (กองช่าง)',
      reportedByVhv: e3.elder.assignedVhv,
      reportedAt: '2026-10-08 08:20',
      status: 'in_progress',
      syncStatus: 'synced',
    });
  }

  if (e4 && e4.elder.id !== e1?.elder.id) {
    seeds.push({
      id: 'HAZ-KORAT-104',
      title: 'ต้องการเก้าอี้สุขานั่งถ่ายและราวจับพยุงลุกจากเตียงสำหรับผู้สูงอายุกลุ่มเสี่ยง',
      category: 'sanitation_bathroom_hazard',
      categoryLabel: 'ห้องน้ำพื้นลื่น / ส้วมนั่งยองไม่เหมาะกับผู้สูงอายุข้อเข่าเสื่อม',
      severity: 'moderate',
      elderId: e4.elder.id,
      elderName: e4.elder.name,
      elderAge: e4.elder.age,
      matrixGroup: e4.elder.riskProfile.matrixGroup,
      frailtyScore: e4.elder.riskProfile.frailtyScore,
      village: e4.elder.village,
      subdistrict: e4.elder.subdistrict,
      lat: e4.lat,
      lng: e4.lng,
      mapX: Math.max(12, e4.mapX - 1.6),
      mapY: Math.max(14, e4.mapY - 2.0),
      mobilityImpactDescription:
        'ผู้สูงอายุลุกจากที่นอนและนั่งยองในห้องน้ำลำบาก มีอาการปวดตึงข้อเข่าและเสี่ยงหกล้มขณะเข้าห้องน้ำตอนกลางคืน',
      requestedCommunitySupport:
        'เบิกเก้าอี้สุขาเคลื่อนที่จากศูนย์ฟื้นฟูชุมชน รพ.สต. และให้ทีม อสม. จิตอาสาช่วยติดตั้งราวจับข้างเตียง',
      targetAgency: 'รพ.สต. และศูนย์ฟื้นฟูชุมชน',
      reportedByVhv: e4.elder.assignedVhv,
      reportedAt: '2026-10-08 11:05',
      status: 'resolved',
      syncStatus: 'synced',
    });
  }

  return seeds;
}

export const VhvHazardMapReportingTool: React.FC<VhvHazardMapReportingToolProps> = ({
  elders,
  isOfflineMode,
  onSelectElder,
  onCreateReferral,
  initialFocusElderId,
  onReportSubmitted,
}) => {
  const elderCoordinates = useMemo(
    () => elders.map((elder, idx) => computeElderMapCoordinates(elder, idx)),
    [elders]
  );

  const highRiskElderCoordinates = useMemo(
    () =>
      elderCoordinates.filter(
        (item) =>
          item.elder.riskProfile.matrixGroup === 'D' ||
          item.elder.riskProfile.matrixGroup === 'C' ||
          item.elder.riskProfile.matrixGroup === 'B'
      ),
    [elderCoordinates]
  );

  const [reports, setReports] = useState<CommunityHazardReport[]>(() => {
    try {
      const saved = localStorage.getItem(HAZARD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial seeds
    }
    return buildInitialHazardReports(elders);
  });

  useEffect(() => {
    try {
      localStorage.setItem(HAZARD_STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Ignore storage error
    }
  }, [reports]);

  // Default selected elder for pinning
  const defaultElderCoord =
    elderCoordinates.find((c) => c.elder.id === initialFocusElderId) ||
    highRiskElderCoordinates[0] ||
    elderCoordinates[0];

  const [selectedElderId, setSelectedElderId] = useState<string>(
    defaultElderCoord?.elder.id || ''
  );
  const [pinPos, setPinPos] = useState<{
    mapX: number;
    mapY: number;
    lat: number;
    lng: number;
  }>(() => ({
    mapX: defaultElderCoord ? defaultElderCoord.mapX : 70,
    mapY: defaultElderCoord ? defaultElderCoord.mapY : 62,
    lat: defaultElderCoord ? defaultElderCoord.lat : 14.9532,
    lng: defaultElderCoord ? defaultElderCoord.lng : 102.1318,
  }));

  const [isPinPlacementActive, setIsPinPlacementActive] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] =
    useState<EnvironmentalHazardCategory>('unpaved_flooded_alley');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'moderate'>('critical');
  const [targetAgency, setTargetAgency] = useState<
    CommunityHazardReport['targetAgency']
  >('เทศบาล/อบต. (กองช่าง)');
  const [reportTitle, setReportTitle] = useState<string>(
    HAZARD_CATEGORIES[0].presetTitle
  );
  const [mobilityImpact, setMobilityImpact] = useState<string>(
    HAZARD_CATEGORIES[0].presetImpact
  );
  const [requestedSupport, setRequestedSupport] = useState<string>(
    HAZARD_CATEGORIES[0].presetSupport
  );

  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    () => reports[0]?.id || null
  );
  const [filterSeverity, setFilterSeverity] = useState<
    'all' | 'critical' | 'high' | 'moderate'
  >('all');
  const [filterCategory, setFilterCategory] = useState<
    'all' | EnvironmentalHazardCategory
  >('all');
  const [showElderHomesLayer, setShowElderHomesLayer] = useState<boolean>(true);
  const [showHazardPinsLayer, setShowHazardPinsLayer] = useState<boolean>(true);
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);

  const svgMapRef = useRef<SVGSVGElement | null>(null);

  // If parent passes a new initialFocusElderId, snap to that elder
  useEffect(() => {
    if (!initialFocusElderId) return;
    const found = elderCoordinates.find((c) => c.elder.id === initialFocusElderId);
    if (found) {
      setSelectedElderId(found.elder.id);
      setPinPos({
        mapX: found.mapX,
        mapY: found.mapY,
        lat: found.lat,
        lng: found.lng,
      });
    }
  }, [initialFocusElderId, elderCoordinates]);

  const activeElderCoord = useMemo(
    () =>
      elderCoordinates.find((c) => c.elder.id === selectedElderId) ||
      elderCoordinates[0],
    [elderCoordinates, selectedElderId]
  );

  const handleSelectElderForPin = (elderId: string) => {
    setSelectedElderId(elderId);
    const coord = elderCoordinates.find((c) => c.elder.id === elderId);
    if (coord) {
      setPinPos({
        mapX: coord.mapX,
        mapY: coord.mapY,
        lat: coord.lat,
        lng: coord.lng,
      });
      if (coord.elder.riskProfile.matrixGroup === 'D') {
        setSeverity('critical');
      } else if (coord.elder.riskProfile.matrixGroup === 'C') {
        setSeverity('high');
      }
    }
  };

  const handleSelectCategory = (catId: EnvironmentalHazardCategory) => {
    setSelectedCategory(catId);
    const spec = HAZARD_CATEGORIES.find((c) => c.id === catId);
    if (spec) {
      setTargetAgency(spec.defaultAgency);
      setReportTitle(spec.presetTitle);
      setMobilityImpact(spec.presetImpact);
      setRequestedSupport(spec.presetSupport);
    }
  };

  const handleMapSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgMapRef.current) return;
    const rect = svgMapRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(6, Math.min(94, Number(relX.toFixed(1))));
    const clampedY = Math.max(8, Math.min(92, Number(relY.toFixed(1))));

    const lat = Number((14.972 + (50 - clampedY) * 0.0012).toFixed(5));
    const lng = Number((102.098 + (clampedX - 50) * 0.0012).toFixed(5));

    setPinPos({
      mapX: clampedX,
      mapY: clampedY,
      lat,
      lng,
    });

    // Automatically snap/associate with nearest high-risk elder if within 11% radius
    let nearestElder: ElderHomeCoordinate | null = null;
    let minDist = 999;
    elderCoordinates.forEach((ec) => {
      const dist = Math.hypot(ec.mapX - clampedX, ec.mapY - clampedY);
      if (dist < minDist) {
        minDist = dist;
        nearestElder = ec;
      }
    });
    if (nearestElder && minDist <= 11) {
      setSelectedElderId((nearestElder as ElderHomeCoordinate).elder.id);
    }
  };

  const handleSnapToElderHome = () => {
    if (!activeElderCoord) return;
    setPinPos({
      mapX: activeElderCoord.mapX,
      mapY: activeElderCoord.mapY,
      lat: activeElderCoord.lat,
      lng: activeElderCoord.lng,
    });
  };

  const handleSubmitHazardReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeElderCoord) return;

    const categorySpec =
      HAZARD_CATEGORIES.find((c) => c.id === selectedCategory) ||
      HAZARD_CATEGORIES[0];

    const nowStr = new Date().toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newReport: CommunityHazardReport = {
      id: `HAZ-KORAT-${Date.now().toString().slice(-4)}`,
      title:
        reportTitle.trim() ||
        `${categorySpec.presetTitle} (${activeElderCoord.elder.village})`,
      category: selectedCategory,
      categoryLabel: categorySpec.label,
      severity,
      elderId: activeElderCoord.elder.id,
      elderName: activeElderCoord.elder.name,
      elderAge: activeElderCoord.elder.age,
      matrixGroup: activeElderCoord.elder.riskProfile.matrixGroup,
      frailtyScore: activeElderCoord.elder.riskProfile.frailtyScore,
      village: activeElderCoord.elder.village,
      subdistrict: activeElderCoord.elder.subdistrict,
      lat: pinPos.lat,
      lng: pinPos.lng,
      mapX: pinPos.mapX,
      mapY: pinPos.mapY,
      mobilityImpactDescription:
        mobilityImpact.trim() || categorySpec.presetImpact,
      requestedCommunitySupport:
        requestedSupport.trim() || categorySpec.presetSupport,
      targetAgency,
      reportedByVhv: activeElderCoord.elder.assignedVhv || 'อสม.วันเพ็ญ ศรีโคราช',
      reportedAt: nowStr,
      status: 'pinned_pending',
      syncStatus: isOfflineMode ? 'pending_offline' : 'synced',
    };

    setReports((prev) => [newReport, ...prev]);
    setSelectedReportId(newReport.id);
    setSubmitBanner(
      `ปักหมุดรายงานจุดเสี่ยง “${newReport.title}” บริเวณบ้านของ ${newReport.elderName} สำเร็จ (${
        isOfflineMode ? 'บันทึกในคิว Offline พร้อมซิงก์' : 'ส่งพิกัดเข้าศูนย์ รพ.สต. และหน่วยงานท้องถิ่นแล้ว'
      })`
    );
    if (onReportSubmitted) {
      onReportSubmitted(newReport);
    }
    window.setTimeout(() => setSubmitBanner(null), 5000);
  };

  const handleUpdateReportStatus = (
    reportId: string,
    nextStatus: CommunityHazardReport['status']
  ) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r))
    );
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    if (selectedReportId === reportId) {
      setSelectedReportId(null);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      return true;
    });
  }, [reports, filterSeverity, filterCategory]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || filteredReports[0] || null,
    [reports, selectedReportId, filteredReports]
  );

  const criticalCount = reports.filter(
    (r) => r.severity === 'critical' && r.status !== 'resolved'
  ).length;
  const unresolvedCount = reports.filter((r) => r.status !== 'resolved').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;

  return (
    <div className="space-y-4">
      {/* Header & Summary Strip */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-300 font-semibold">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>COMMUNITY NEEDS &amp; ENVIRONMENTAL HAZARD MAPPER</span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span>ระบบปักหมุดจุดเสี่ยงสภาพแวดล้อมและอุปสรรคการเดินทางของผู้สูงอายุ</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              แผนที่ปักหมุดจุดเสี่ยงชุมชนและโครงสร้างพื้นฐานที่กระทบการเคลื่อนไหว (อ.เมืองนครราชสีมา)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              ช่วยให้ อสม. ปักหมุดตำแหน่งบ้านผู้สูงอายุกลุ่มเสี่ยงสูง (กลุ่ม D/C) และแจ้งปัญหาทางเท้า ซอยน้ำท่วมขัง บันไดไม่มีราวจับ ไฟส่องสว่างชำรุด หรือความต้องการกายอุปกรณ์ เพื่อประสานงาน รพ.สต. เทศบาล/อบต. และกองทุน LTC
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 text-center font-mono-num">
            <div className="bg-slate-900 border border-rose-500/40 rounded-xl px-3 py-2">
              <p className="text-base font-extrabold text-rose-400">{criticalCount}</p>
              <p className="text-[10px] font-sans text-slate-300">จุดเสี่ยงวิกฤต</p>
            </div>
            <div className="bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2">
              <p className="text-base font-extrabold text-amber-300">{unresolvedCount}</p>
              <p className="text-[10px] font-sans text-slate-300">กำลังประสานงาน</p>
            </div>
            <div className="bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2">
              <p className="text-base font-extrabold text-emerald-400">{resolvedCount}</p>
              <p className="text-[10px] font-sans text-slate-300">แก้ไขแล้ว</p>
            </div>
          </div>
        </div>

        {submitBanner && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-400/70 text-xs text-emerald-100 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{submitBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitBanner(null)}
              className="text-emerald-300 hover:text-white font-bold cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}
      </div>

      {/* Main Split Workspace: Left Interactive Local Map + Right Field Pinning Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* LEFT COLUMN (7 cols): Interactive Local Map of Korat Subdistricts, High-Risk Elder Homes & Pinned Hazards */}
        <div className="xl:col-span-7 bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-300" />
                <span>
                  แผนที่ชุมชนท้องถิ่น อ.เมืองนครราชสีมา (แตะบนแผนที่หรือบ้านผู้สูงอายุเพื่อปักหมุด)
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 font-mono-num mt-0.5">
                พิกัดหมุดที่เลือก: Lat {pinPos.lat}°N, Lng {pinPos.lng}°E · บ้านเป้าหมาย:{' '}
                <strong className="text-teal-300">
                  {activeElderCoord?.elder.name} (กลุ่ม {activeElderCoord?.elder.riskProfile.matrixGroup})
                </strong>
              </p>
            </div>

            {/* Map Layer Toggles */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowElderHomesLayer((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  showElderHomesLayer
                    ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                🏠 บ้านผู้สูงอายุ ({elderCoordinates.length})
              </button>
              <button
                type="button"
                onClick={() => setShowHazardPinsLayer((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  showHazardPinsLayer
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                ⚠️ หมุดจุดเสี่ยง ({reports.length})
              </button>
              <button
                type="button"
                onClick={handleSnapToElderHome}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-teal-400/60 text-teal-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="ดึงหมุดกลับไปยังพิกัดบ้านของผู้สูงอายุที่เลือก"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>ดึงพิกัดบ้านผู้สูงอายุ</span>
              </button>
            </div>
          </div>

          {/* Interactive SVG Map Canvas */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 select-none">
            <svg
              ref={svgMapRef}
              viewBox="0 0 800 520"
              onClick={handleMapSvgClick}
              className="w-full h-[360px] sm:h-[430px] block cursor-crosshair"
              role="img"
              aria-label="แผนที่ปักหมุดจุดเสี่ยงสภาพแวดล้อมและบ้านผู้สูงอายุกลุ่มเสี่ยง จังหวัดนครราชสีมา"
            >
              <defs>
                <pattern
                  id="vhv-grid-pattern"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                </pattern>
                <radialGradient id="group-d-aura" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.42" />
                  <stop offset="65%" stopColor="#f43f5e" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Map Background Grid */}
              <rect width="800" height="520" fill="#090f1d" />
              <rect width="800" height="520" fill="url(#vhv-grid-pattern)" />

              {/* Stylized Subdistrict Zones of Mueang Nakhon Ratchasima */}
              {/* 1. ต.หมื่นไวย (North-West) */}
              <polygon
                points="90,45 410,45 405,195 110,205"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="2"
              />
              <text x="150" y="90" fill="#64748b" fontSize="13" fontWeight="700">
                ต.หมื่นไวย (โซนเหนือลำตะคอง)
              </text>

              {/* 2. ต.จอหอ (North-East) */}
              <polygon
                points="410,45 735,45 745,215 405,195"
                fill="#111c2d"
                stroke="#334155"
                strokeWidth="2"
              />
              <text x="515" y="88" fill="#64748b" fontSize="13" fontWeight="700">
                ต.จอหอ / บ้านบึงทับช้าง
              </text>

              {/* 3. ต.ในเมือง (Central Municipal Moat) */}
              <polygon
                points="230,195 510,195 520,315 225,315"
                fill="#132338"
                stroke="#0d9488"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <text x="295" y="230" fill="#5eead4" fontSize="13" fontWeight="700">
                ต.ในเมือง (เขตเทศบาลนคร)
              </text>

              {/* 4. ต.หัวทะเล (South-East Industrial & Community Zone) */}
              <polygon
                points="510,195 745,215 755,395 495,380 520,315"
                fill="#1b1828"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeOpacity="0.65"
              />
              <text x="550" y="275" fill="#fda4af" fontSize="13" fontWeight="700">
                ต.หัวทะเล / บ้านดอนขวาง (จุดเสี่ยงหนาแน่น)
              </text>

              {/* 5. ต.โพธิ์กลาง (South-West / Central South) */}
              <polygon
                points="110,205 230,195 225,315 495,380 450,480 120,465"
                fill="#121e31"
                stroke="#334155"
                strokeWidth="2"
              />
              <text x="175" y="425" fill="#94a3b8" fontSize="13" fontWeight="700">
                ต.โพธิ์กลาง / บ้านหนองไผ่ล้อม
              </text>

              {/* 6. ต.หนองบัวศาลา (Far South-East) */}
              <polygon
                points="495,380 755,395 735,485 450,480"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="2"
              />
              <text x="530" y="455" fill="#64748b" fontSize="13" fontWeight="700">
                ต.หนองบัวศาลา / หนองระเวียง
              </text>

              {/* Local Waterways & Korat Road Network */}
              {/* Lam Takhong Canal */}
              <path
                d="M 60,150 Q 250,165 420,145 T 760,130"
                fill="none"
                stroke="#0284c7"
                strokeWidth="5"
                strokeOpacity="0.45"
              />
              <text x="65" y="140" fill="#38bdf8" fontSize="11" fontWeight="600">
                ลำตะคอง
              </text>

              {/* Mittraphap Road (Hwy 2) */}
              <path
                d="M 105,350 L 380,255 L 675,60"
                fill="none"
                stroke="#475569"
                strokeWidth="4"
                strokeDasharray="8 4"
              />
              <text
                x="535"
                y="148"
                fill="#94a3b8"
                fontSize="11"
                fontWeight="700"
              >
                ถ.มิตรภาพ (ทล.2)
              </text>

              {/* Hwy 224 (Hua Thale Route) */}
              <path
                d="M 380,255 L 620,345 L 740,445"
                fill="none"
                stroke="#475569"
                strokeWidth="3.5"
              />
              <text x="535" y="348" fill="#cbd5e1" fontSize="11" fontWeight="600">
                ถ.เพชรมาตุคลา (สายหัวทะเล)
              </text>

              {/* Sueb Siri / Pho Klang Road */}
              <path
                d="M 380,255 L 340,445"
                fill="none"
                stroke="#475569"
                strokeWidth="3"
              />

              {/* Layer 1: High-Risk Elder Home Markers */}
              {showElderHomesLayer &&
                elderCoordinates.map((ec) => {
                  const cx = (ec.mapX / 100) * 800;
                  const cy = (ec.mapY / 100) * 520;
                  const group = ec.elder.riskProfile.matrixGroup;
                  const isSelectedElder = ec.elder.id === selectedElderId;
                  const isHighRisk = group === 'D' || group === 'C';

                  const nodeColor =
                    group === 'D'
                      ? '#f43f5e'
                      : group === 'C'
                      ? '#fb923c'
                      : group === 'B'
                      ? '#facc15'
                      : '#2dd4bf';

                  return (
                    <g
                      key={ec.elder.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleSelectElderForPin(ec.elder.id);
                      }}
                      className="cursor-pointer"
                    >
                      {group === 'D' && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={34}
                          fill="url(#group-d-aura)"
                        />
                      )}
                      {isSelectedElder && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill="none"
                          stroke="#2dd4bf"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHighRisk ? 9 : 7}
                        fill={nodeColor}
                        stroke="#090f1d"
                        strokeWidth="2"
                      />
                      <text
                        x={cx}
                        y={cy - 13}
                        textAnchor="middle"
                        fill={isSelectedElder ? '#5eead4' : '#f8fafc'}
                        fontSize="11"
                        fontWeight="700"
                      >
                        🏠 {ec.elder.name.split(' ')[0]} ({group})
                      </text>
                    </g>
                  );
                })}

              {/* Layer 2: Existing Pinned Environmental Hazard Markers */}
              {showHazardPinsLayer &&
                reports.map((rep) => {
                  const hx = (rep.mapX / 100) * 800;
                  const hy = (rep.mapY / 100) * 520;
                  const isSelectedRep = selectedReport?.id === rep.id;

                  const pinFill =
                    rep.status === 'resolved'
                      ? '#10b981'
                      : rep.severity === 'critical'
                      ? '#dc2626'
                      : rep.severity === 'high'
                      ? '#ea580c'
                      : '#d97706';

                  return (
                    <g
                      key={rep.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedReportId(rep.id);
                      }}
                      className="cursor-pointer"
                    >
                      {isSelectedRep && (
                        <circle
                          cx={hx}
                          cy={hy}
                          r={22}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="2.5"
                        />
                      )}
                      <rect
                        x={hx - 12}
                        y={hy - 12}
                        width={24}
                        height={24}
                        rx={7}
                        fill={pinFill}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text
                        x={hx}
                        y={hy + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="12"
                        fontWeight="800"
                      >
                        !
                      </text>
                    </g>
                  );
                })}

              {/* Layer 3: Active New Hazard Pin (Draggable/Tappable Target Reticle) */}
              {isPinPlacementActive && (
                <g
                  transform={`translate(${(pinPos.mapX / 100) * 800}, ${
                    (pinPos.mapY / 100) * 520
                  })`}
                  className="pointer-events-none"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={24}
                    fill="#14b8a6"
                    fillOpacity="0.2"
                    stroke="#2dd4bf"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <path
                    d="M 0,0 L -11,-22 A 13,13 0 1,1 11,-22 Z"
                    fill="#14b8a6"
                    stroke="#090f1d"
                    strokeWidth="2"
                  />
                  <circle cx={0} cy={-24} r={4.5} fill="#090f1d" />
                  <rect
                    x={-72}
                    y={8}
                    width={144}
                    height={20}
                    rx={5}
                    fill="#0f172a"
                    stroke="#2dd4bf"
                    strokeWidth="1.2"
                  />
                  <text
                    x={0}
                    y={21}
                    textAnchor="middle"
                    fill="#5eead4"
                    fontSize="10"
                    fontWeight="700"
                  >
                    หมุดแจ้งจุดเสี่ยงใหม่ ({pinPos.lat.toFixed(3)}, {pinPos.lng.toFixed(3)})
                  </text>
                </g>
              )}
            </svg>

            {/* Bottom Map Legend Bar */}
            <div className="px-3.5 py-2.5 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <span>บ้านผู้สูงอายุกลุ่ม D (เสี่ยงสูงมาก)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                  <span>บ้านกลุ่ม C</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-red-600 text-white font-bold inline-flex items-center justify-center text-[9px]">
                    !
                  </span>
                  <span>จุดเสี่ยงทางสัญจร/โครงสร้างพื้นฐาน</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                  <span>หมุดกำลังปักใหม่</span>
                </span>
              </div>
              <span className="text-teal-300 font-semibold">
                แตะตำแหน่งใดก็ได้บนแผนที่เพื่อย้ายหมุดแจ้งเหตุ
              </span>
            </div>
          </div>

          {/* Quick-Select High-Risk Elder Home Pins Bar */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-200">
              เลือกปักหมุดด่วนที่บ้านผู้สูงอายุกลุ่มเสี่ยงสูง (แตะชื่อเพื่อดึงพิกัดบ้านและข้อมูลความเสี่ยง):
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {elderCoordinates.map((ec) => {
                const isSelected = ec.elder.id === selectedElderId;
                const grp = ec.elder.riskProfile.matrixGroup;
                return (
                  <button
                    key={ec.elder.id}
                    type="button"
                    onClick={() => handleSelectElderForPin(ec.elder.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-xs'
                        : grp === 'D'
                        ? 'bg-slate-900 text-rose-300 border-rose-500/50 hover:border-rose-400'
                        : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-teal-400'
                    }`}
                  >
                    <span>
                      {grp === 'D' ? '🔴' : grp === 'C' ? '🟠' : '🟡'} {ec.elder.name}
                    </span>
                    <span className="font-mono-num text-[11px] opacity-85">
                      (กลุ่ม {grp} · ADL {ec.elder.frailtyDomains.functional}/20)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): VHV Field Hazard & Mobility Barrier Reporting Form */}
        <form
          onSubmit={handleSubmitHazardReport}
          className="xl:col-span-5 bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
            <div>
              <span className="text-[11px] font-bold text-teal-300">
                FIELD REPORT FORM · แบบแจ้งจุดเสี่ยงและขอความช่วยเหลือชุมชน
              </span>
              <h3 className="text-sm font-bold text-white">
                บันทึกปัญหาสภาพแวดล้อมที่กระทบการเคลื่อนไหวของผู้สูงอายุ
              </h3>
            </div>
            <span className="text-[11px] font-mono-num text-slate-300">
              {isOfflineMode ? 'โหมด Offline' : 'ออนไลน์'}
            </span>
          </div>

          {/* 1. Selected Elder & Mobility Vulnerability Context */}
          {activeElderCoord && (
            <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">
                  1. ผู้สูงอายุที่ได้รับผลกระทบ: {activeElderCoord.elder.name} (
                  {activeElderCoord.elder.age} ปี)
                </span>
                <button
                  type="button"
                  onClick={() => onSelectElder(activeElderCoord.elder)}
                  className="text-[11px] font-bold text-teal-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>เปิดแฟ้มสุขภาพ</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                {activeElderCoord.elder.village} {activeElderCoord.elder.subdistrict} ·{' '}
                {activeElderCoord.elder.livingArrangement} · โรคประจำตัว:{' '}
                {activeElderCoord.elder.chronicConditions.join(', ') || 'ไม่มี'}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono-num text-amber-300">
                <span>กลุ่มเสี่ยง {activeElderCoord.elder.riskProfile.matrixGroup}</span>
                <span aria-hidden="true">·</span>
                <span>Frailty {activeElderCoord.elder.riskProfile.frailtyScore}/100</span>
                <span aria-hidden="true">·</span>
                <span>กายภาพ {activeElderCoord.elder.frailtyDomains.physical}/20</span>
                <span aria-hidden="true">·</span>
                <span>ADL กิจวัตร {activeElderCoord.elder.frailtyDomains.functional}/20</span>
              </div>
            </div>
          )}

          {/* 2. Hazard / Infrastructure Issue Category Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              2. เลือกประเภทปัญหาสภาพแวดล้อม / ความต้องการของชุมชน:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {HAZARD_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/20 border-teal-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="block text-teal-300 text-[11px] font-bold">
                      {cat.shortTag}
                    </span>
                    <span className="block text-[11px] leading-snug mt-0.5 line-clamp-1">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Severity & Coordinating Agency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-200">
                3. ระดับผลกระทบต่อการเดินทาง/หกล้ม:
              </label>
              <select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as 'critical' | 'high' | 'moderate')
                }
                className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-xs font-bold text-white"
              >
                <option value="critical">
                  🔴 วิกฤต — เสี่ยงหกล้มรุนแรง / ออกนอกบ้านไม่ได้
                </option>
                <option value="high">
                  🟠 สูง — กระทบการเดินทางไป รพ.สต. / ทำกิจวัตร
                </option>
                <option value="moderate">
                  🟡 ปานกลาง — ควรปรับปรุงสภาพแวดล้อมเชิงป้องกัน
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-200">
                4. หน่วยงานท้องถิ่นที่รับเรื่องประสานงาน:
              </label>
              <select
                value={targetAgency}
                onChange={(e) =>
                  setTargetAgency(
                    e.target.value as CommunityHazardReport['targetAgency']
                  )
                }
                className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-xs font-bold text-white"
              >
                <option value="เทศบาล/อบต. (กองช่าง)">เทศบาล/อบต. (กองช่าง)</option>
                <option value="กองทุน LTC สปสช. ตำบล">กองทุน LTC สปสช. ตำบล</option>
                <option value="รพ.สต. และศูนย์ฟื้นฟูชุมชน">
                  รพ.สต. และศูนย์ฟื้นฟูชุมชน
                </option>
                <option value="อสม. จิตอาสาปรับสภาพบ้าน">
                  อสม. จิตอาสาปรับสภาพบ้าน
                </option>
              </select>
            </div>
          </div>

          {/* 4. Report Title & Mobility Impact Description */}
          <div className="space-y-2 text-xs">
            <div>
              <label className="block font-bold text-slate-200 mb-1">
                5. หัวข้อจุดเสี่ยงที่พบในพื้นที่:
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="เช่น ซอยเข้าบ้านน้ำท่วมขัง / บันไดไม่มีราวจับ..."
                className="w-full rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">
                6. ผลกระทบต่อการเคลื่อนไหวและการใช้ชีวิตประจำวันของผู้สูงอายุ:
              </label>
              <textarea
                rows={2}
                value={mobilityImpact}
                onChange={(e) => setMobilityImpact(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-200 mb-1">
                7. แนวทางแก้ไข / ความช่วยเหลือจากชุมชนที่ต้องการ:
              </label>
              <textarea
                rows={2}
                value={requestedSupport}
                onChange={(e) => setRequestedSupport(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-600 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              ปักหมุดและส่งรายงานจุดเสี่ยงชุมชน ({pinPos.lat.toFixed(3)}, {pinPos.lng.toFixed(3)})
            </span>
          </button>
        </form>
      </div>

      {/* Bottom Section: Reported Hazards & Community Needs Action Registry */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-amber-300" />
              <span>
                ทะเบียนจุดเสี่ยงสภาพแวดล้อมและคำขอปรับปรุงโครงสร้างพื้นฐานชุมชน ({filteredReports.length}{' '}
                รายการ)
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              แตะที่รายการเพื่อดูตำแหน่งบนแผนที่ อัปเดตสถานะการประสานงานกับ อบต./กองทุน LTC หรือเปิดแฟ้มสุขภาพผู้สูงอายุ
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={filterSeverity}
              onChange={(e) =>
                setFilterSeverity(
                  e.target.value as 'all' | 'critical' | 'high' | 'moderate'
                )
              }
              className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-semibold"
            >
              <option value="all">ความรุนแรงทั้งหมด ({reports.length})</option>
              <option value="critical">เฉพาะจุดเสี่ยงวิกฤต (Critical)</option>
              <option value="high">ระดับสูง (High)</option>
              <option value="moderate">ระดับปานกลาง (Moderate)</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(
                  e.target.value as 'all' | EnvironmentalHazardCategory
                )
              }
              className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-semibold"
            >
              <option value="all">ทุกประเภทปัญหาโครงสร้างพื้นฐาน</option>
              {HAZARD_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortTag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredReports.map((rep) => {
            const isSelected = selectedReport?.id === rep.id;
            const matchedElder = elders.find((e) => e.id === rep.elderId);

            return (
              <div
                key={rep.id}
                onClick={() => {
                  setSelectedReportId(rep.id);
                  setPinPos({
                    mapX: rep.mapX,
                    mapY: rep.mapY,
                    lat: rep.lat,
                    lng: rep.lng,
                  });
                }}
                className={`rounded-xl border p-3.5 space-y-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-teal-400 ring-1 ring-teal-400/50'
                    : 'bg-slate-900/75 border-slate-700 hover:border-slate-500'
                }`}
              >
                {/* Unboxed Metadata Kicker Line */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
                    <span
                      className={`font-bold ${
                        rep.severity === 'critical'
                          ? 'text-rose-400'
                          : rep.severity === 'high'
                          ? 'text-orange-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {rep.severity === 'critical'
                        ? '🔴 วิกฤต'
                        : rep.severity === 'high'
                        ? '🟠 เร่งด่วนสูง'
                        : '🟡 ปานกลาง'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num text-teal-300">{rep.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{rep.subdistrict}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      GPS {rep.lat.toFixed(4)}, {rep.lng.toFixed(4)}
                    </span>
                  </div>

                  <span
                    className={`font-bold ${
                      rep.status === 'resolved'
                        ? 'text-emerald-400'
                        : rep.status === 'in_progress'
                        ? 'text-sky-300'
                        : rep.status === 'escalated_agency'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {rep.status === 'resolved'
                      ? '✓ แก้ไขเสร็จสิ้น'
                      : rep.status === 'in_progress'
                      ? 'กำลังซ่อมแซม/ติดตั้ง'
                      : rep.status === 'escalated_agency'
                      ? 'ส่งเรื่องประสานหน่วยงานแล้ว'
                      : 'รอส่งเรื่องประสานงาน'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{rep.title}</h4>
                  <p className="text-xs text-teal-300 font-semibold mt-0.5">
                    ผู้สูงอายุที่ได้รับผลกระทบ: {rep.elderName} ({rep.elderAge} ปี · กลุ่ม{' '}
                    {rep.matrixGroup} · Frailty {rep.frailtyScore}/100) · {rep.village}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs bg-slate-950/80 rounded-lg p-2.5 border border-slate-800">
                  <p className="text-slate-200 leading-relaxed">
                    <strong className="text-rose-300">อุปสรรคต่อการเคลื่อนไหว: </strong>
                    {rep.mobilityImpactDescription}
                  </p>
                  <p className="text-slate-200 leading-relaxed">
                    <strong className="text-teal-300">
                      การประสานงาน ({rep.targetAgency}):{' '}
                    </strong>
                    {rep.requestedCommunitySupport}
                  </p>
                </div>

                {/* Action Footer on Hazard Card */}
                <div
                  className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateReportStatus(rep.id, 'escalated_agency')
                      }
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        rep.status === 'escalated_agency'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      แจ้ง อบต./LTC
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateReportStatus(rep.id, 'in_progress')}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        rep.status === 'in_progress'
                          ? 'bg-sky-400 text-slate-950 border-sky-300'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      กำลังแก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateReportStatus(rep.id, 'resolved')}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        rep.status === 'resolved'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      แก้ไขเสร็จแล้ว
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedElder && (
                      <button
                        type="button"
                        onClick={() => onSelectElder(matchedElder)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-teal-400/60 text-teal-300 text-[11px] font-bold cursor-pointer"
                      >
                        เปิดแฟ้มผู้สูงอายุ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteReport(rep.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                      title="ลบหมุดรายการนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
