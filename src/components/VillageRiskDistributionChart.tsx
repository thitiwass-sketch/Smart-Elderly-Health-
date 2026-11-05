import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Filter,
  Layers,
  MapPin,
  Percent,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { VILLAGE_HIGH_RISK_MAP_NODES } from '../data/koratHealthData';
import { ElderProfile, MatrixGroup } from '../types/health';

export interface VillageRiskDistributionChartProps {
  elders: ElderProfile[];
  selectedMatrixGroup: MatrixGroup | 'ALL';
  selectedSubdistrict: string;
  selectedVillageId?: string;
  onSelectVillageFilter: (params: {
    village?: string;
    subdistrict?: string;
    matrixGroup?: MatrixGroup | 'ALL';
    villageId?: string;
  }) => void;
}

interface VillageBaselineDistribution {
  id: string;
  village: string;
  shortName: string;
  subdistrict: string;
  rphFacility: string;
  vhvLead: string;
  baseA: number;
  baseB: number;
  baseC: number;
  baseD: number;
}

// Epidemiological baseline distribution across the 10 sentinel villages in Mueang Nakhon Ratchasima
// Sum of baseA + baseB + baseC + baseD matches each node's screenedElders in VILLAGE_HIGH_RISK_MAP_NODES
const VILLAGE_BASELINE_DISTRIBUTIONS: VillageBaselineDistribution[] = [
  {
    id: 'VIL-KORAT-01',
    village: 'หมู่ที่ 4 บ้านดอนขวาง',
    shortName: 'ม.4 บ้านดอนขวาง',
    subdistrict: 'ต.หัวทะเล',
    rphFacility: 'รพ.สต.หัวทะเล',
    vhvLead: 'อสม.วันเพ็ญ ศรีโคราช',
    baseA: 64,
    baseB: 27,
    baseC: 16,
    baseD: 11, // Total = 118
  },
  {
    id: 'VIL-KORAT-02',
    village: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม',
    shortName: 'ม.2 หนองไผ่ล้อม',
    subdistrict: 'ต.โพธิ์กลาง',
    rphFacility: 'รพ.สต.โพธิ์กลาง',
    vhvLead: 'อสม.ประเสริฐ วงศ์นคร',
    baseA: 58,
    baseB: 23,
    baseC: 14,
    baseD: 9, // Total = 104
  },
  {
    id: 'VIL-KORAT-03',
    village: 'ชุมชนวัดบูรพ์',
    shortName: 'ชุมชนวัดบูรพ์',
    subdistrict: 'ต.ในเมือง',
    rphFacility: 'ศบส.เทศบาลนคร / รพ.มหาราชฯ',
    vhvLead: 'อสม.นิภาภรณ์ เมืองย่า',
    baseA: 82,
    baseB: 32,
    baseC: 18,
    baseD: 10, // Total = 142
  },
  {
    id: 'VIL-KORAT-04',
    village: 'หมู่ที่ 7 บ้านบึงทับช้าง',
    shortName: 'ม.7 บึงทับช้าง',
    subdistrict: 'ต.จอหอ',
    rphFacility: 'รพ.สต.จอหอ',
    vhvLead: 'อสม.กัลยา ทองหล่อ',
    baseA: 55,
    baseB: 21,
    baseC: 13,
    baseD: 7, // Total = 96
  },
  {
    id: 'VIL-KORAT-05',
    village: 'หมู่ที่ 1 บ้านหัวทะเล',
    shortName: 'ม.1 บ้านหัวทะเล',
    subdistrict: 'ต.หัวทะเล',
    rphFacility: 'รพ.สต.หัวทะเล',
    vhvLead: 'อสม.วันเพ็ญ ศรีโคราช',
    baseA: 54,
    baseB: 20,
    baseC: 12,
    baseD: 6, // Total = 92
  },
  {
    id: 'VIL-KORAT-06',
    village: 'หมู่ที่ 5 บ้านศีรษะละเลิง',
    shortName: 'ม.5 ศีรษะละเลิง',
    subdistrict: 'ต.บ้านใหม่',
    rphFacility: 'รพ.สต.บ้านใหม่',
    vhvLead: 'อสม.สุภาพร มิตรภาพ',
    baseA: 51,
    baseB: 21,
    baseC: 10,
    baseD: 6, // Total = 88
  },
  {
    id: 'VIL-KORAT-07',
    village: 'หมู่ที่ 4 บ้านโคกกรวด',
    shortName: 'ม.4 บ้านโคกกรวด',
    subdistrict: 'ต.โคกกรวด',
    rphFacility: 'รพ.สต.โคกกรวด',
    vhvLead: 'อสม.สมศักดิ์ มิตรภาพ',
    baseA: 63,
    baseB: 25,
    baseC: 14,
    baseD: 8, // Total = 110
  },
  {
    id: 'VIL-KORAT-08',
    village: 'หมู่ที่ 3 บ้านหนองบัวศาลา',
    shortName: 'ม.3 หนองบัวศาลา',
    subdistrict: 'ต.หนองบัวศาลา',
    rphFacility: 'รพ.สต.หนองบัวศาลา',
    vhvLead: 'อสม.มาลี โชคชัย',
    baseA: 56,
    baseB: 21,
    baseC: 11,
    baseD: 7, // Total = 95
  },
  {
    id: 'VIL-KORAT-09',
    village: 'หมู่ที่ 3 บ้านหนองปรือ',
    shortName: 'ม.3 บ้านหนองปรือ',
    subdistrict: 'ต.โพธิ์กลาง',
    rphFacility: 'รพ.สต.โพธิ์กลาง',
    vhvLead: 'อสม.ประเสริฐ วงศ์นคร',
    baseA: 59,
    baseB: 15,
    baseC: 7,
    baseD: 3, // Total = 84
  },
  {
    id: 'VIL-KORAT-10',
    village: 'หมู่ที่ 6 บ้านพะไล',
    shortName: 'ม.6 บ้านพะไล',
    subdistrict: 'ต.หัวทะเล',
    rphFacility: 'รพ.สต.หัวทะเล',
    vhvLead: 'อสม.วันเพ็ญ ศรีโคราช',
    baseA: 55,
    baseB: 14,
    baseC: 6,
    baseD: 3, // Total = 78
  },
];

// Initial seed elder IDs and their initial matrix group so live changes/escalations reflect accurately
const SEED_ELDER_INITIAL_GROUP: Record<string, { village: string; group: MatrixGroup }> = {
  'KORAT-ELD-001': { village: 'หมู่ที่ 4 บ้านดอนขวาง', group: 'D' },
  'KORAT-ELD-002': { village: 'หมู่ที่ 2 บ้านหนองไผ่ล้อม', group: 'D' },
  'KORAT-ELD-003': { village: 'หมู่ที่ 7 บ้านบึงทับช้าง', group: 'C' },
  'KORAT-ELD-004': { village: 'หมู่ที่ 1 บ้านหัวทะเล', group: 'C' },
  'KORAT-ELD-005': { village: 'หมู่ที่ 5 บ้านศีรษะละเลิง', group: 'B' },
  'KORAT-ELD-006': { village: 'ชุมชนวัดบูรพ์', group: 'B' },
  'KORAT-ELD-007': { village: 'หมู่ที่ 3 บ้านหนองปรือ', group: 'A' },
  'KORAT-ELD-008': { village: 'หมู่ที่ 6 บ้านพะไล', group: 'A' },
};

const RISK_GROUP_META: Record<
  MatrixGroup,
  {
    key: MatrixGroup;
    dataKey: 'groupA' | 'groupB' | 'groupC' | 'groupD';
    pctKey: 'pctA' | 'pctB' | 'pctC' | 'pctD';
    label: string;
    shortLabel: string;
    clinicalDesc: string;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    textColor: string;
  }
> = {
  A: {
    key: 'A',
    dataKey: 'groupA',
    pctKey: 'pctA',
    label: 'กลุ่ม A (Low Risk · ส่งเสริมสุขภาพ)',
    shortLabel: 'กลุ่ม A (Low Risk)',
    clinicalDesc: 'Frailty ต่ำ + โรคเรื้อรังต่ำ',
    color: '#10b981', // emerald-500
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-400/50',
    textColor: 'text-emerald-300',
  },
  B: {
    key: 'B',
    dataKey: 'groupB',
    pctKey: 'pctB',
    label: 'กลุ่ม B (Pre-Frailty · ติดตามตามรอบ)',
    shortLabel: 'กลุ่ม B (Pre-Frailty)',
    clinicalDesc: 'Frailty ปานกลาง + โรคเรื้อรังต่ำ',
    color: '#eab308', // yellow-500 / amber-400
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-400/50',
    textColor: 'text-amber-300',
  },
  C: {
    key: 'C',
    dataKey: 'groupC',
    pctKey: 'pctC',
    label: 'กลุ่ม C (Surveillance · เฝ้าระวังใน 7 วัน)',
    shortLabel: 'กลุ่ม C (Surveillance)',
    clinicalDesc: 'Frailty ต่ำ + โรคเรื้อรังสูง',
    color: '#f97316', // orange-500
    badgeBg: 'bg-orange-500/15',
    badgeBorder: 'border-orange-400/50',
    textColor: 'text-orange-300',
  },
  D: {
    key: 'D',
    dataKey: 'groupD',
    pctKey: 'pctD',
    label: 'กลุ่ม D (High Risk · ประเมินคลินิก/ส่งต่อ)',
    shortLabel: 'กลุ่ม D (High Risk)',
    clinicalDesc: 'Frailty สูง + โรคเรื้อรังสูง',
    color: '#f43f5e', // rose-500
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-400/50',
    textColor: 'text-rose-300',
  },
};

export interface VillageRiskChartRow {
  id: string;
  village: string;
  shortName: string;
  subdistrict: string;
  rphFacility: string;
  vhvLead: string;
  groupA: number;
  groupB: number;
  groupC: number;
  groupD: number;
  total: number;
  highRiskCD: number;
  pctA: number;
  pctB: number;
  pctC: number;
  pctD: number;
  highRiskRatioPct: number;
  activeRegistryCount: number;
}

export const VillageRiskDistributionChart: React.FC<VillageRiskDistributionChartProps> = ({
  elders,
  selectedMatrixGroup,
  selectedSubdistrict,
  selectedVillageId,
  onSelectVillageFilter,
}) => {
  const [chartMode, setChartMode] = useState<'GROUPED' | 'STACKED' | 'PERCENT'>('GROUPED');
  const [dataScope, setDataScope] = useState<'COMMUNITY_COHORT' | 'ACTIVE_REGISTRY'>(
    'COMMUNITY_COHORT'
  );
  const [sortBy, setSortBy] = useState<'HIGH_RISK_DESC' | 'GROUP_D_DESC' | 'TOTAL_DESC'>(
    'GROUP_D_DESC'
  );
  const [localSubdistrict, setLocalSubdistrict] = useState<string>('ALL');
  const [visibleGroups, setVisibleGroups] = useState<Record<MatrixGroup, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
  });

  // Synchronize effective subdistrict filter if parent subdistrictFilter is set
  const effectiveSubdistrict =
    selectedSubdistrict !== 'ALL' ? selectedSubdistrict : localSubdistrict;

  const toggleGroupVisibility = (grp: MatrixGroup) => {
    setVisibleGroups((prev) => {
      const next = { ...prev, [grp]: !prev[grp] };
      // Prevent hiding all 4 groups simultaneously
      if (!next.A && !next.B && !next.C && !next.D) {
        return prev;
      }
      return next;
    });
  };

  // Compute village-level A, B, C, D distribution combining baseline community cohort and live session changes
  const villageRows: VillageRiskChartRow[] = useMemo(() => {
    const mapByVillage = new Map<
      string,
      {
        id: string;
        village: string;
        shortName: string;
        subdistrict: string;
        rphFacility: string;
        vhvLead: string;
        communityCounts: Record<MatrixGroup, number>;
        registryCounts: Record<MatrixGroup, number>;
      }
    >();

    // Initialize with the 10 sentinel villages
    VILLAGE_BASELINE_DISTRIBUTIONS.forEach((item) => {
      mapByVillage.set(item.village, {
        id: item.id,
        village: item.village,
        shortName: item.shortName,
        subdistrict: item.subdistrict,
        rphFacility: item.rphFacility,
        vhvLead: item.vhvLead,
        communityCounts: {
          A: item.baseA,
          B: item.baseB,
          C: item.baseC,
          D: item.baseD,
        },
        registryCounts: { A: 0, B: 0, C: 0, D: 0 },
      });
    });

    // Apply live elders from session state
    elders.forEach((elder) => {
      const grp = elder.riskProfile.matrixGroup;
      let entry = mapByVillage.get(elder.village);

      if (!entry) {
        const matchedNode = VILLAGE_HIGH_RISK_MAP_NODES.find(
          (n) => n.village === elder.village
        );
        const shortName = elder.village.replace('หมู่ที่ ', 'ม.');
        entry = {
          id: matchedNode?.id || `VIL-CUSTOM-${elder.village}`,
          village: elder.village,
          shortName: shortName.length > 16 ? `${shortName.slice(0, 15)}…` : shortName,
          subdistrict: elder.subdistrict,
          rphFacility: matchedNode?.rphFacility || `รพ.สต.${elder.subdistrict.replace('ต.', '')}`,
          vhvLead: elder.assignedVhv,
          communityCounts: { A: 18, B: 8, C: 4, D: 1 },
          registryCounts: { A: 0, B: 0, C: 0, D: 0 },
        };
        mapByVillage.set(elder.village, entry);
      }

      // Count in active operational registry
      entry.registryCounts[grp] += 1;

      // Check if this elder was part of the initial seed and changed risk group, or is newly added
      const seedInfo = SEED_ELDER_INITIAL_GROUP[elder.id];
      if (!seedInfo) {
        // Newly screened elder in this session
        entry.communityCounts[grp] += 1;
      } else if (seedInfo.group !== grp && seedInfo.village === elder.village) {
        // Seed elder escalated or changed group in this session
        entry.communityCounts[seedInfo.group] = Math.max(
          0,
          entry.communityCounts[seedInfo.group] - 1
        );
        entry.communityCounts[grp] += 1;
      }
    });

    const rows: VillageRiskChartRow[] = Array.from(mapByVillage.values()).map((entry) => {
      const counts =
        dataScope === 'COMMUNITY_COHORT' ? entry.communityCounts : entry.registryCounts;
      const groupA = counts.A;
      const groupB = counts.B;
      const groupC = counts.C;
      const groupD = counts.D;
      const total = groupA + groupB + groupC + groupD;
      const safeTotal = Math.max(1, total);

      const pctA = Number(((groupA / safeTotal) * 100).toFixed(1));
      const pctB = Number(((groupB / safeTotal) * 100).toFixed(1));
      const pctC = Number(((groupC / safeTotal) * 100).toFixed(1));
      const pctD = Number(((groupD / safeTotal) * 100).toFixed(1));
      const highRiskCD = groupC + groupD;
      const highRiskRatioPct = Number(((highRiskCD / safeTotal) * 100).toFixed(1));

      const activeRegistryCount =
        entry.registryCounts.A +
        entry.registryCounts.B +
        entry.registryCounts.C +
        entry.registryCounts.D;

      return {
        id: entry.id,
        village: entry.village,
        shortName: entry.shortName,
        subdistrict: entry.subdistrict,
        rphFacility: entry.rphFacility,
        vhvLead: entry.vhvLead,
        groupA,
        groupB,
        groupC,
        groupD,
        total,
        highRiskCD,
        pctA,
        pctB,
        pctC,
        pctD,
        highRiskRatioPct,
        activeRegistryCount,
      };
    });

    const filteredByScope =
      dataScope === 'ACTIVE_REGISTRY' ? rows.filter((r) => r.total > 0) : rows;

    const filteredBySubdistrict =
      effectiveSubdistrict === 'ALL'
        ? filteredByScope
        : filteredByScope.filter((r) => r.subdistrict === effectiveSubdistrict);

    return [...filteredBySubdistrict].sort((a, b) => {
      if (sortBy === 'GROUP_D_DESC') {
        if (b.groupD !== a.groupD) return b.groupD - a.groupD;
        return b.highRiskCD - a.highRiskCD;
      }
      if (sortBy === 'HIGH_RISK_DESC') {
        if (b.highRiskCD !== a.highRiskCD) return b.highRiskCD - a.highRiskCD;
        return b.groupD - a.groupD;
      }
      return b.total - a.total;
    });
  }, [elders, dataScope, effectiveSubdistrict, sortBy]);

  // Available subdistricts in the chart dataset
  const availableSubdistricts = useMemo(() => {
    const set = new Set<string>();
    VILLAGE_BASELINE_DISTRIBUTIONS.forEach((v) => set.add(v.subdistrict));
    elders.forEach((e) => set.add(e.subdistrict));
    return Array.from(set);
  }, [elders]);

  // Aggregate totals across displayed villages
  const aggregateTotals = useMemo(() => {
    return villageRows.reduce(
      (acc, r) => {
        acc.A += r.groupA;
        acc.B += r.groupB;
        acc.C += r.groupC;
        acc.D += r.groupD;
        acc.total += r.total;
        return acc;
      },
      { A: 0, B: 0, C: 0, D: 0, total: 0 }
    );
  }, [villageRows]);

  const highestRiskVillage = useMemo(() => {
    if (villageRows.length === 0) return null;
    return [...villageRows].sort((a, b) => b.groupD - a.groupD)[0];
  }, [villageRows]);

  return (
    <section
      aria-label="กราฟแท่งเปรียบเทียบจำนวนผู้สูงอายุในแต่ละกลุ่มความเสี่ยงตามหมู่บ้าน"
      className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-lg space-y-5"
    >
      {/* Top Section Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-teal-300 font-semibold">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            <span>Village-Level Risk Stratification Analytics (Matrix A · B · C · D)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-slate-300">
              แสดง {villageRows.length} หมู่บ้าน ({aggregateTotals.total.toLocaleString()} ราย)
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">
            กราฟแท่งเปรียบเทียบจำนวนผู้สูงอายุในแต่ละกลุ่มความเสี่ยง (A, B, C, D) แยกตามหมู่บ้าน
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            วิเคราะห์การกระจายตัวของความเสี่ยงในชุมชนเพื่อวางแผนจัดสรรทีมสหวิชาชีพ รพ.สต. และ อสม. ลงพื้นที่ตามระดับความรุนแรง
          </p>
        </div>

        {/* Right Toolbar: Data Scope & Chart Mode Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Data Scope Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-700 rounded-lg">
            <button
              type="button"
              onClick={() => setDataScope('COMMUNITY_COHORT')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                dataScope === 'COMMUNITY_COHORT'
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ประชากรคัดกรองระดับหมู่บ้าน</span>
            </button>
            <button
              type="button"
              onClick={() => setDataScope('ACTIVE_REGISTRY')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                dataScope === 'ACTIVE_REGISTRY'
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>เฉพาะทะเบียนปฏิบัติการ ({elders.length} ราย)</span>
            </button>
          </div>

          {/* Chart Layout Switcher (Grouped / Stacked / 100% Proportion) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-700 rounded-lg">
            <button
              type="button"
              onClick={() => setChartMode('GROUPED')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                chartMode === 'GROUPED'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>แท่งเปรียบเทียบ (A/B/C/D)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('STACKED')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                chartMode === 'STACKED'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>แท่งเรียงซ้อน (รวม)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('PERCENT')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                chartMode === 'PERCENT'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>สัดส่วน (%)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for A, B, C, D Across Displayed Villages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {(['A', 'B', 'C', 'D'] as MatrixGroup[]).map((grp) => {
          const meta = RISK_GROUP_META[grp];
          const count = aggregateTotals[grp];
          const pct =
            aggregateTotals.total > 0
              ? ((count / aggregateTotals.total) * 100).toFixed(1)
              : '0.0';
          const isVisible = visibleGroups[grp];
          const isDashboardFiltered = selectedMatrixGroup === grp;

          return (
            <div
              key={grp}
              className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-2 ${
                isDashboardFiltered
                  ? 'bg-slate-950 border-white ring-1 ring-white'
                  : isVisible
                  ? 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                  : 'bg-slate-950/40 border-slate-800/50 opacity-55'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-xs font-bold text-white">{meta.shortLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleGroupVisibility(grp)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                      isVisible
                        ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {isVisible ? 'แสดงในกราฟ' : 'ซ่อนอยู่'}
                  </button>
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 font-mono-num">
                <div>
                  <span className={`text-2xl font-extrabold ${meta.textColor}`}>
                    {count.toLocaleString()}
                  </span>
                  <span className="ml-1 text-xs text-slate-300 font-sans">ราย</span>
                </div>
                <span className="text-xs font-bold text-slate-200">
                  {pct}% ของพื้นที่
                </span>
              </div>

              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">{meta.clinicalDesc}</span>
                <button
                  type="button"
                  onClick={() =>
                    onSelectVillageFilter({
                      matrixGroup: isDashboardFiltered ? 'ALL' : grp,
                    })
                  }
                  className="text-teal-300 hover:text-teal-200 font-bold underline cursor-pointer"
                >
                  {isDashboardFiltered ? 'ยกเลิกกรอง' : `กรองกลุ่ม ${grp}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Sort Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subdistrict Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-slate-300 font-semibold">ตำบล:</span>
            <select
              value={effectiveSubdistrict}
              onChange={(e) => {
                const val = e.target.value;
                setLocalSubdistrict(val);
                onSelectVillageFilter({ subdistrict: val, village: '' });
              }}
              className="py-1 px-2.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="ALL">ทุกตำบลในพื้นที่เป้าหมาย ({availableSubdistricts.length} ตำบล)</option>
              {availableSubdistricts.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-semibold">เรียงลำดับหมู่บ้าน:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'HIGH_RISK_DESC' | 'GROUP_D_DESC' | 'TOTAL_DESC'
                )
              }
              className="py-1 px-2.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="GROUP_D_DESC">เรียงตามกลุ่มเสี่ยงสูงวิกฤต (Group D) มากสุด</option>
              <option value="HIGH_RISK_DESC">เรียงตามกลุ่มเฝ้าระวัง+วิกฤต (Group C + D) มากสุด</option>
              <option value="TOTAL_DESC">เรียงตามจำนวนผู้สูงอายุที่คัดกรองรวมมากสุด</option>
            </select>
          </div>
        </div>

        {/* Hotspot Highlight & Reset Button */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {highestRiskVillage && (
            <div className="flex items-center gap-1.5 text-slate-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                หมู่บ้านกลุ่ม D สูงสุด:{' '}
                <strong className="text-rose-300">{highestRiskVillage.village}</strong> (
                {highestRiskVillage.groupD} ราย · {highestRiskVillage.pctD}%)
              </span>
            </div>
          )}

          {(effectiveSubdistrict !== 'ALL' ||
            selectedMatrixGroup !== 'ALL' ||
            !visibleGroups.A ||
            !visibleGroups.B ||
            !visibleGroups.C ||
            !visibleGroups.D) && (
            <button
              type="button"
              onClick={() => {
                setLocalSubdistrict('ALL');
                setVisibleGroups({ A: true, B: true, C: true, D: true });
                onSelectVillageFilter({
                  village: '',
                  subdistrict: 'ALL',
                  matrixGroup: 'ALL',
                });
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตมุมมองกราฟ</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Recharts Bar Chart Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="text-xs text-slate-300">
            <span className="font-bold text-white">
              {chartMode === 'GROUPED'
                ? 'กราฟแท่งเปรียบเทียบจำนวนผู้สูงอายุแยกตามกลุ่ม A, B, C, D รายหมู่บ้าน'
                : chartMode === 'STACKED'
                ? 'กราฟแท่งเรียงซ้อนแสดงจำนวนผู้สูงอายุรวมและองค์ประกอบความเสี่ยงรายหมู่บ้าน'
                : 'กราฟแท่งเปรียบเทียบสัดส่วนร้อยละ (%) ของแต่ละกลุ่มความเสี่ยงรายหมู่บ้าน'}
            </span>{' '}
            <span className="text-slate-400">
              — คลิกที่แท่งกราฟเพื่อกรองรายชื่อผู้สูงอายุของหมู่บ้านนั้นในตารางด้านล่าง
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-num">
            {(['A', 'B', 'C', 'D'] as MatrixGroup[]).map((grp) => (
              <span key={grp} className="inline-flex items-center gap-1.5 text-slate-200">
                <span
                  className="w-2.5 h-2.5 rounded-xs inline-block"
                  style={{ backgroundColor: RISK_GROUP_META[grp].color }}
                />
                <span>
                  กลุ่ม {grp}: {aggregateTotals[grp]} ราย
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="w-full h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={villageRows}
              margin={{ top: 10, right: 16, left: 0, bottom: 28 }}
              barGap={chartMode === 'GROUPED' ? 3 : 0}
              barCategoryGap={chartMode === 'GROUPED' ? '18%' : '26%'}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  const matched = villageRows.find(
                    (r) => r.shortName === state.activeLabel || r.village === state.activeLabel
                  );
                  if (matched) {
                    onSelectVillageFilter({
                      village: matched.village,
                      subdistrict: matched.subdistrict,
                      villageId: matched.id,
                    });
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="shortName"
                stroke="#94a3b8"
                tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 600 }}
                interval={0}
                angle={-14}
                textAnchor="end"
                height={54}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: '#cbd5e1', fontSize: 11 }}
                unit={chartMode === 'PERCENT' ? '%' : ' คน'}
                domain={chartMode === 'PERCENT' ? [0, 100] : [0, 'auto']}
              />
              <Tooltip
                cursor={{ fill: 'rgba(15, 23, 42, 0.75)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0].payload as VillageRiskChartRow;
                  return (
                    <div className="bg-slate-900/98 border border-slate-600 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[260px]">
                      <div className="pb-2 border-b border-slate-800">
                        <p className="font-bold text-white text-sm">{row.village}</p>
                        <p className="text-[11px] text-teal-300">
                          {row.subdistrict} · {row.rphFacility}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          หัวหน้าทีม อสม.: {row.vhvLead}
                        </p>
                      </div>

                      <div className="space-y-1.5 font-mono-num">
                        {(['D', 'C', 'B', 'A'] as MatrixGroup[]).map((grp) => {
                          const meta = RISK_GROUP_META[grp];
                          const count = row[meta.dataKey];
                          const pct = row[meta.pctKey];
                          return (
                            <div
                              key={grp}
                              className="flex items-center justify-between gap-4 text-xs"
                            >
                              <span className="inline-flex items-center gap-1.5 font-sans text-slate-200">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: meta.color }}
                                />
                                <span>{meta.shortLabel}</span>
                              </span>
                              <span className={`font-bold ${meta.textColor}`}>
                                {count} ราย ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono-num">
                        <span className="text-slate-300">ผู้สูงอายุคัดกรองรวม:</span>
                        <span className="font-bold text-white">{row.total} ราย</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono-num">
                        <span className="text-rose-300">สัดส่วนกลุ่มเฝ้าระวัง/วิกฤต (C+D):</span>
                        <span className="font-bold text-rose-400">
                          {row.highRiskCD} ราย ({row.highRiskRatioPct}%)
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                formatter={(value) => <span className="text-slate-200 font-semibold">{value}</span>}
              />

              {visibleGroups.A && (
                <Bar
                  dataKey={chartMode === 'PERCENT' ? 'pctA' : 'groupA'}
                  name="🟢 กลุ่ม A (Low Risk)"
                  stackId={chartMode === 'GROUPED' ? undefined : 'villageRiskStack'}
                  fill={RISK_GROUP_META.A.color}
                  radius={chartMode === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  className="cursor-pointer"
                />
              )}
              {visibleGroups.B && (
                <Bar
                  dataKey={chartMode === 'PERCENT' ? 'pctB' : 'groupB'}
                  name="🟡 กลุ่ม B (Pre-Frailty)"
                  stackId={chartMode === 'GROUPED' ? undefined : 'villageRiskStack'}
                  fill={RISK_GROUP_META.B.color}
                  radius={chartMode === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  className="cursor-pointer"
                />
              )}
              {visibleGroups.C && (
                <Bar
                  dataKey={chartMode === 'PERCENT' ? 'pctC' : 'groupC'}
                  name="🟠 กลุ่ม C (Surveillance)"
                  stackId={chartMode === 'GROUPED' ? undefined : 'villageRiskStack'}
                  fill={RISK_GROUP_META.C.color}
                  radius={chartMode === 'GROUPED' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  className="cursor-pointer"
                />
              )}
              {visibleGroups.D && (
                <Bar
                  dataKey={chartMode === 'PERCENT' ? 'pctD' : 'groupD'}
                  name="🔴 กลุ่ม D (High Risk)"
                  stackId={chartMode === 'GROUPED' ? undefined : 'villageRiskStack'}
                  fill={RISK_GROUP_META.D.color}
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Village-by-Village Risk Distribution Matrix Strip */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="font-bold text-white">
            ตารางสรุปสัดส่วนความเสี่ยงรายหมู่บ้าน (คลิกเลือกหมู่บ้านเพื่อเชื่อมโยงแผนที่พิกัดและกรองบัญชีรายชื่อ):
          </span>
          <span className="text-slate-400 font-mono-num">
            หน่วย: จำนวนผู้สูงอายุ (คน) และแถบสัดส่วน A · B · C · D
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
          {villageRows.map((row) => {
            const isSelectedVillage = selectedVillageId === row.id;
            return (
              <div
                key={row.id}
                onClick={() =>
                  onSelectVillageFilter({
                    village: row.village,
                    subdistrict: row.subdistrict,
                    villageId: row.id,
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectVillageFilter({
                      village: row.village,
                      subdistrict: row.subdistrict,
                      villageId: row.id,
                    });
                  }
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelectedVillage
                    ? 'bg-slate-950 border-teal-400 ring-1 ring-teal-400'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="text-xs font-bold text-white truncate" title={row.village}>
                      {row.village}
                    </p>
                    <span className="text-[11px] font-mono-num font-bold text-teal-300 shrink-0">
                      {row.total} คน
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                      {row.subdistrict}
                    </span>
                    <span className="font-mono-num text-rose-300 font-semibold">
                      C+D: {row.highRiskRatioPct}%
                    </span>
                  </div>
                </div>

                {/* 4-Color Proportional Horizontal Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden bg-slate-800 flex">
                  <div
                    style={{
                      width: `${row.pctA}%`,
                      backgroundColor: RISK_GROUP_META.A.color,
                    }}
                    title={`กลุ่ม A: ${row.groupA} คน (${row.pctA}%)`}
                  />
                  <div
                    style={{
                      width: `${row.pctB}%`,
                      backgroundColor: RISK_GROUP_META.B.color,
                    }}
                    title={`กลุ่ม B: ${row.pctB} คน (${row.pctB}%)`}
                  />
                  <div
                    style={{
                      width: `${row.pctC}%`,
                      backgroundColor: RISK_GROUP_META.C.color,
                    }}
                    title={`กลุ่ม C: ${row.groupC} คน (${row.pctC}%)`}
                  />
                  <div
                    style={{
                      width: `${row.pctD}%`,
                      backgroundColor: RISK_GROUP_META.D.color,
                    }}
                    title={`กลุ่ม D: ${row.groupD} คน (${row.pctD}%)`}
                  />
                </div>

                {/* A / B / C / D Mini Count Row */}
                <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-800/80 text-center font-mono-num text-[11px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVillageFilter({
                        village: row.village,
                        subdistrict: row.subdistrict,
                        matrixGroup: 'A',
                        villageId: row.id,
                      });
                    }}
                    className="py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 font-bold cursor-pointer"
                    title={`กรองเฉพาะกลุ่ม A ใน ${row.village}`}
                  >
                    A:{row.groupA}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVillageFilter({
                        village: row.village,
                        subdistrict: row.subdistrict,
                        matrixGroup: 'B',
                        villageId: row.id,
                      });
                    }}
                    className="py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 font-bold cursor-pointer"
                    title={`กรองเฉพาะกลุ่ม B ใน ${row.village}`}
                  >
                    B:{row.groupB}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVillageFilter({
                        village: row.village,
                        subdistrict: row.subdistrict,
                        matrixGroup: 'C',
                        villageId: row.id,
                      });
                    }}
                    className="py-0.5 rounded bg-orange-500/10 hover:bg-orange-500/25 text-orange-300 font-bold cursor-pointer"
                    title={`กรองเฉพาะกลุ่ม C ใน ${row.village}`}
                  >
                    C:{row.groupC}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVillageFilter({
                        village: row.village,
                        subdistrict: row.subdistrict,
                        matrixGroup: 'D',
                        villageId: row.id,
                      });
                    }}
                    className="py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-extrabold cursor-pointer"
                    title={`กรองเฉพาะกลุ่ม D ใน ${row.village}`}
                  >
                    D:{row.groupD}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
