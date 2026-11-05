import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>ติดตั้งแอป PWA</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 rounded-lg border border-teal-500/50 bg-slate-800/95 px-3 py-2 text-xs font-bold text-teal-200 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-teal-300" />
        <span>{isIOS ? 'ติดตั้งบน iOS' : 'ติดตั้ง PWA'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  ติดตั้ง Smart Elderly Health Watch (PWA)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  เปิดใช้งานแบบเต็มหน้าจอบนสมาร์ทโฟนของ อสม. และผู้สูงอายุ โดยไม่ต้องดาวน์โหลดผ่าน App Store
                </p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">สำหรับ Android (Chrome / Edge):</p>
                <p className="mt-0.5 text-slate-600">
                  แตะเมนูมุมขวาบนของเบราว์เซอร์ แล้วเลือก <strong>&ldquo;เพิ่มลงในหน้าจอหลัก (Add to Home screen)&rdquo;</strong> หรือ <strong>&ldquo;ติดตั้งแอป (Install app)&rdquo;</strong>
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">สำหรับ iPhone / iPad (Safari):</p>
                <p className="mt-0.5 text-slate-600">
                  1. แตะปุ่ม <strong>แชร์ (Share)</strong> บนแถบด้านล่างของ Safari<br />
                  2. เลื่อนลงแล้วแตะ <strong>&ldquo;เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)&rdquo;</strong>
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 text-slate-500">
                รองรับการทำงานแบบ <strong>Offline-first</strong> บันทึกข้อมูลคัดกรองภาคสนามลงในเครื่องชั่วคราว และซิงก์อัตโนมัติเมื่อเชื่อมต่ออินเทอร์เน็ต
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-slate-900 py-2.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </>
  );
};
