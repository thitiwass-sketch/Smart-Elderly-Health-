import React, { useState } from 'react';
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Plus,
  Send,
} from 'lucide-react';
import { ElderProfile, FollowUpRecord, ReferralRecord } from '../types/health';

interface FollowUpAndReferralViewProps {
  elders: ElderProfile[];
  followUps: FollowUpRecord[];
  referrals: ReferralRecord[];
  onCompleteFollowUp: (
    followUpId: string,
    sbp: number,
    dbp: number,
    weight: number,
    adherence: 'ดีมาก' | 'ปานกลาง' | 'ต้องกระตุ้น',
    note: string
  ) => void;
  onUpdateReferralStatus: (
    referralId: string,
    status: ReferralRecord['status'],
    clinicalNote: string
  ) => void;
  onSelectElderById: (elderId: string) => void;
}

export const FollowUpAndReferralView: React.FC<FollowUpAndReferralViewProps> = ({
  elders,
  followUps,
  referrals,
  onCompleteFollowUp,
  onUpdateReferralStatus,
  onSelectElderById,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'followup' | 'referral'>('followup');
  const [activeFollowUpId, setActiveFollowUpId] = useState<string | null>(null);
  const [visitSbp, setVisitSbp] = useState(138);
  const [visitDbp, setVisitDbp] = useState(84);
  const [visitWeight, setVisitWeight] = useState(50.0);
  const [visitAdherence, setVisitAdherence] = useState<'ดีมาก' | 'ปานกลาง' | 'ต้องกระตุ้น'>('ดีมาก');
  const [visitNote, setVisitNote] = useState(
    'เยี่ยมบ้านตามแผน 4 สัปดาห์ ผู้สูงอายุปฏิบัติตามคำแนะนำการเดินและลดเค็มได้ดี'
  );

  const pendingFollowUps = followUps.filter((f) => f.status !== 'completed');
  const completedFollowUps = followUps.filter((f) => f.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <section className="bg-slate-800 border border-teal-500/40 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
              <span>โมดูลติดตามและส่งต่อ (M07 Follow-up · M08 Referral)</span>
              <span aria-hidden="true">·</span>
              <span>เชื่อมต่อ อสม. ภาคสนาม ↔ รพ.สต.</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-white">
              ระบบแจ้งเตือนการติดตามเยี่ยมบ้านและจัดการใบส่งต่อผู้สูงอายุกลุ่มเสี่ยงสูง
            </h1>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-700 rounded-lg self-start sm:self-center">
            <button
              onClick={() => setActiveSubTab('followup')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'followup'
                  ? 'bg-teal-500 text-slate-950 shadow-xs'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              รายการติดตามของ อสม. ({pendingFollowUps.length} นัดหมาย)
            </button>
            <button
              onClick={() => setActiveSubTab('referral')}
              className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'referral'
                  ? 'bg-teal-500 text-slate-950 shadow-xs'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              ระบบส่งต่อ รพ.สต. ({referrals.length} เคส)
            </button>
          </div>
        </div>
      </section>

      {activeSubTab === 'followup' ? (
        <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 space-y-6 shadow-lg">
          <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                คิวแจ้งเตือนการติดตามเยี่ยมบ้านตามแผน Personal Health Plan 4 สัปดาห์
              </h2>
              <p className="text-xs text-slate-300">
                ระบบแจ้งเตือนอัตโนมัติเมื่อถึงกำหนดติดตามผู้สูงอายุกลุ่มเสี่ยงในหมู่บ้าน
              </p>
            </div>
            <div className="text-xs text-slate-300 font-mono-num">
              รอดำเนินการ <strong className="text-amber-300">{pendingFollowUps.length}</strong> รายการ · เสร็จสิ้นแล้ว{' '}
              <strong className="text-emerald-400">{completedFollowUps.length}</strong> รายการ
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {followUps.map((fu) => (
              <div key={fu.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={
                          fu.status === 'overdue'
                            ? 'font-bold text-rose-400'
                            : fu.status === 'due_soon'
                            ? 'font-bold text-orange-400'
                            : fu.status === 'completed'
                            ? 'font-semibold text-emerald-400'
                            : 'font-semibold text-teal-300'
                        }
                      >
                        {fu.status === 'overdue'
                          ? '🔔 ถึงกำหนดติดตามเร่งด่วน'
                          : fu.status === 'due_soon'
                          ? '🟠 กำหนดติดตามภายใน 7 วัน'
                          : fu.status === 'completed'
                          ? '✓ บันทึกเยี่ยมบ้านเรียบร้อย'
                          : '📅 ตามรอบแผน 4 สัปดาห์'}
                      </span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <button
                        onClick={() => onSelectElderById(fu.elderId)}
                        className="font-bold text-white hover:text-teal-300 text-sm cursor-pointer"
                      >
                        {fu.elderName} (อายุ {fu.age} ปี)
                      </button>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-teal-300 font-medium">
                        กลุ่มความเสี่ยง {fu.matrixGroup}
                      </span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        {fu.village} {fu.subdistrict}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-100">{fu.purpose}</p>
                    <p className="text-xs text-slate-300">
                      หมายเหตุ: {fu.notes} · ผู้รับผิดชอบ: {fu.vhvName} · กำหนดนัด:{' '}
                      <span className="font-mono-num text-white font-semibold">{fu.dueDate}</span>
                    </p>
                  </div>

                  <div className="shrink-0">
                    {fu.status !== 'completed' ? (
                      <button
                        onClick={() =>
                          setActiveFollowUpId(activeFollowUpId === fu.id ? null : fu.id)
                        }
                        className="px-3.5 py-2 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 transition-colors cursor-pointer"
                      >
                        บันทึกผลเยี่ยมบ้าน
                      </button>
                    ) : (
                      <div className="text-right text-xs text-emerald-400 font-mono-num">
                        <span>ติดตามแล้วเมื่อ {fu.completedDate}</span>
                        {fu.sbpRecorded && (
                          <span className="block text-slate-300">
                            BP {fu.sbpRecorded}/{fu.dbpRecorded} mmHg · ความร่วมมือ: {fu.adherenceLevel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Visit Recording Form */}
                {activeFollowUpId === fu.id && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-800 border border-slate-700 space-y-3 text-xs">
                    <h4 className="font-bold text-white">
                      บันทึกผลการลงพื้นที่ติดตามเยี่ยมบ้าน: {fu.elderName}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-200 font-medium mb-1">SBP (mmHg)</label>
                        <input
                          type="number"
                          value={visitSbp}
                          onChange={(e) => setVisitSbp(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-600 rounded-md bg-slate-950 text-white font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-200 font-medium mb-1">DBP (mmHg)</label>
                        <input
                          type="number"
                          value={visitDbp}
                          onChange={(e) => setVisitDbp(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-600 rounded-md bg-slate-950 text-white font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-200 font-medium mb-1">น้ำหนักล่าสุด (กก.)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={visitWeight}
                          onChange={(e) => setVisitWeight(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-600 rounded-md bg-slate-950 text-white font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-200 font-medium mb-1">
                          การปฏิบัติตามแผน 4 สัปดาห์
                        </label>
                        <select
                          value={visitAdherence}
                          onChange={(e) =>
                            setVisitAdherence(
                              e.target.value as 'ดีมาก' | 'ปานกลาง' | 'ต้องกระตุ้น'
                            )
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-600 rounded-md bg-slate-950 text-white"
                        >
                          <option value="ดีมาก">ดีมาก (ทำต่อเนื่อง)</option>
                          <option value="ปานกลาง">ปานกลาง (ทำบางวัน)</option>
                          <option value="ต้องกระตุ้น">ต้องกระตุ้นและให้ญาติช่วย</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-200 font-medium mb-1">
                        บันทึกอาการและคำแนะนำเพิ่มเติมของ อสม.
                      </label>
                      <input
                        type="text"
                        value={visitNote}
                        onChange={(e) => setVisitNote(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-600 rounded-md bg-slate-950 text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveFollowUpId(null)}
                        className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onCompleteFollowUp(
                            fu.id,
                            visitSbp,
                            visitDbp,
                            visitWeight,
                            visitAdherence,
                            visitNote
                          );
                          setActiveFollowUpId(null);
                        }}
                        className="px-4 py-1.5 rounded-md bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 cursor-pointer"
                      >
                        ยืนยันบันทึกการติดตาม
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 space-y-6 shadow-lg">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-white">
              ทะเบียนส่งต่อผู้มีความเสี่ยงสูง (M08 Clinical Referral Management)
            </h2>
            <p className="text-xs text-slate-300">
              จัดการการส่งต่อจาก อสม. สู่ รพ.สต. และโรงพยาบาลแม่ข่าย เมื่อตรวจพบกลุ่มความเสี่ยงสูง (กลุ่ม D)
            </p>
          </div>

          <div className="divide-y divide-slate-800">
            {referrals.map((ref) => (
              <div key={ref.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-num font-bold text-rose-400">{ref.id}</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <button
                        onClick={() => onSelectElderById(ref.elderId)}
                        className="font-bold text-sm text-white hover:text-teal-300 cursor-pointer"
                      >
                        {ref.elderName} (อายุ {ref.age} ปี)
                      </button>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-rose-400 font-semibold">{ref.urgency}</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        {ref.village} {ref.subdistrict}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-100">
                      สาเหตุการส่งต่อ: {ref.reason}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono-num">
                      <span>Frailty Score: {ref.frailtyScore}/100</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span>BP: {ref.bpReading}</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="text-teal-300">กฎที่ทำงาน: {ref.triggeredRules.join(', ')}</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="font-sans">หน่วยรับส่งต่อ: {ref.targetFacility}</span>
                    </div>
                  </div>

                  {/* Status Stepper Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={ref.status}
                      onChange={(e) =>
                        onUpdateReferralStatus(
                          ref.id,
                          e.target.value as ReferralRecord['status'],
                          ref.clinicalNote
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-600 rounded-lg bg-slate-950 text-white"
                    >
                      <option value="รอ รพ.สต. ตรวจสอบ">รอ รพ.สต. ตรวจสอบ</option>
                      <option value="รพ.สต. รับเรื่องแล้ว">รพ.สต. รับเรื่องแล้ว</option>
                      <option value="ประเมินคลินิกเสร็จสิ้น">ประเมินคลินิกเสร็จสิ้น</option>
                      <option value="ส่งกลับ อสม. ติดตามต่อเนื่อง">
                        ส่งกลับ อสม. ติดตามต่อเนื่อง
                      </option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-slate-200 bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                  <span className="font-semibold text-teal-300">บันทึกคลินิก รพ.สต.: </span>
                  {ref.clinicalNote}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
