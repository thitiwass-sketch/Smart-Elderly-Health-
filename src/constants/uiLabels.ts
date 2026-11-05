/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Centralized UI Constants and Internationalization (i18n) Labels Dictionary
 * Standardized across Nakhon Ratchasima Smart Elderly Health Watch system.
 */

export const UI_LABELS = {
  appName: 'Smart Elderly Health Watch',
  appNameThai: 'ระบบอัจฉริยะเฝ้าระวังสุขภาพผู้สูงอายุ',
  appSubtitle: 'ศูนย์สนับสนุนการตัดสินใจระดับปฐมภูมิ เครือข่าย รพ.สต. อำเภอเมือง จังหวัดนครราชสีมา',

  // Core Actions
  actions: {
    createAdminAccount: 'สร้างบัญชี ADMIN',
    createNewAdmin: 'สร้างผู้ดูแลระบบใหม่',
    confirmTaken: 'ยืนยันการรับประทานยา',
    confirmTakenLogged: 'บันทึกการกินยาเรียบร้อย',
    close: 'ปิด',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    edit: 'แก้ไข',
    delete: 'ลบ',
    syncNow: 'ซิงก์ข้อมูลทันที',
    viewDetails: 'ดูรายละเอียด',
    screenHealth: 'คัดกรองสุขภาพ',
    addScreening: '+ คัดกรองสุขภาพ',
    printPdf: 'พิมพ์รายงาน / ส่งออก PDF',
    copySummary: 'คัดลอกบทสรุป',
    downloadReport: 'ดาวน์โหลดรายงาน',
  },

  // Emergency & SOS 1669
  emergency: {
    sosButton: 'SOS 1669',
    smartWatchSos: 'สัญญาณฉุกเฉิน Smart Watch SOS (1669)',
    fallDetected: 'ตรวจพบการล้ม (Smart Watch)',
    fallAlertTitle: 'แจ้งเตือนเหตุล้มฉุกเฉิน',
    emergencyDispatch: 'ประสานงานรถกู้ชีพ 1669 ทันที',
    liveMonitoring: 'เฝ้าระวังอัตโนมัติ Real-time',
  },

  // Targeted Push Notification Engine
  pushNotification: {
    targetedPushTitle: 'Targeted Push Notification',
    targetedPushDescription: 'ระบบแจ้งเตือนแบบระบุตัวบุคคล (Targeted Push Notification)',
    pipelineHeadline: '2-Tier Targeted Push Routing Engine',
    tier1VhvFirst: 'แจ้ง อสม. ประจำบ้านนั้นก่อน',
    tier1Description: 'ส่งสัญญาณด่วนไปยัง อสม. ที่รับผิดชอบบ้านผู้สูงอายุโดยตรง ถึงจุดเกิดเหตุภายใน 2 นาที',
    tier2RphImmediate: 'ส่งเรื่องหา รพ.สต. ทันที',
    tier2Description: 'ส่งข้อมูลคู่ขนานไปยังโต๊ะพยาบาลเวชปฏิบัติ รพ.สต. พร้อมเตรียมระบบส่งต่อ 1669',
    vhvFrontlineResponder: 'ผู้รับแจ้งด่านหน้า (อสม. ประจำบ้าน)',
    rphEscalationForward: 'ส่งเรื่องหา รพ.สต. ทันที',
    simulateFallPush: 'จำลองเหตุล้ม → แจ้ง อสม. ประจำบ้าน + รพ.สต.',
  },

  // Offline-First & Cloud Synchronization
  offlineSync: {
    offlineModeActive: 'โหมดทำงานออฟไลน์ (Offline-First)',
    offlineFieldMode: 'โหมดทำงานออฟไลน์ในจุดอับสัญญาณ',
    localQueuePending: 'ตัวข้อมูลในเครื่องรอ Sync',
    queueItemsWaiting: 'ตัวข้อมูลในเครื่องรอ Sync',
    syncSuccess: 'ซิงก์ข้อมูลสำเร็จ',
    syncingToServer: 'กำลังซิงก์ข้อมูลขึ้นเซิร์ฟเวอร์ รพ.สต. ...',
    offlineRecordSaved: 'บันทึกข้อมูลลงเครื่องแบบ Offline เรียบร้อย',
    hasConnectionSyncNow: 'มีสัญญาณเน็ต → Sync ข้อมูลทันที',
    allSynced: 'ข้อมูลทั้งหมดถูกซิงก์เรียบร้อยแล้ว',
  },

  // User Roles & Authentication
  roles: {
    admin: 'ผู้ดูแลระบบ',
    adminAccount: 'บัญชีผู้ดูแลระบบ (ADMIN)',
    rphOfficer: 'เจ้าหน้าที่ รพ.สต.',
    vhv: 'อสม. ประจำบ้าน',
    elderlyCaregiver: 'ผู้สูงอายุ / ญาติ',
    activeRole: 'Active Role',
    switchRole: 'สลับสิทธิ์ผู้ใช้งาน',
    quickSwitch: 'สลับบทบาทด่วน',
    allSubdistricts: 'เครือข่าย อ.เมืองนครราชสีมา (25 ตำบล)',
  },

  // Primary Navigation Tabs
  navigation: {
    rphDashboard: 'แดชบอร์ด รพ.สต.',
    monthlyReport: 'รายงานประจำเดือน',
    vhvPwa: 'อสม. ภาคสนาม (PWA)',
    elderlyPortal: 'สำหรับผู้สูงอายุ',
    followupReferral: 'ติดตามและส่งต่อ',
    researchSssrfe: 'กรอบวิจัย SSSRFE',
    devTools: 'เครื่องมือทดสอบระบบ',
  },

  // Clinical Risk Stratification (Matrix 4 Tiers)
  riskTiers: {
    groupD: 'Group D: ความเสี่ยงสูงมาก (ต้องประเมินเร่งด่วน 24 ชม.)',
    groupC: 'Group C: ความเสี่ยงสูง (ติดตามภายใน 7 วัน)',
    groupB: 'Group B: ความเสี่ยงปานกลาง (ติดตามตามรอบ 4 สัปดาห์)',
    groupA: 'Group A: สุขภาพดี/เสี่ยงต่ำ (ส่งเสริมสุขภาพเชิงรุก)',
  },
} as const;

export type UILabels = typeof UI_LABELS;
