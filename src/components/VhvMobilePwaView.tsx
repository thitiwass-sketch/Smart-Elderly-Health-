import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  Home,
  MapPin,
  Mic,
  MicOff,
  Play,
  QrCode,
  RefreshCw,
  Send,
  Square,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CommunityHazardReport,
  ElderProfile,
  FollowUpRecord,
  OfflineQueueItem,
  VoiceMemoAttachment,
} from '../types/health';
import { VhvHazardMapReportingTool } from './VhvHazardMapReportingTool';
import { UI_LABELS } from '../constants/uiLabels';

interface VhvMobilePwaViewProps {
  elders: ElderProfile[];
  followUps: FollowUpRecord[];
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  offlineQueue: OfflineQueueItem[];
  onSyncOfflineQueue: () => Promise<void>;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  onSelectElder: (elder: ElderProfile) => void;
  onOpenScreening: (elder?: ElderProfile) => void;
  onCreateReferral: (elder: ElderProfile) => void;
  onAttachVoiceMemo?: (followUpId: string, voiceMemo: VoiceMemoAttachment) => void;
  onReportCommunityHazard?: (report: CommunityHazardReport) => void;
}

type VhvMobileTab =
  | 'home'
  | 'elders'
  | 'screen'
  | 'high_risk'
  | 'hazard_map'
  | 'dashboard';

export const VhvMobilePwaView: React.FC<VhvMobilePwaViewProps> = ({
  elders,
  followUps,
  isOfflineMode,
  onToggleOfflineMode,
  offlineQueue,
  onSyncOfflineQueue,
  isSyncing,
  lastSyncedAt,
  onSelectElder,
  onOpenScreening,
  onCreateReferral,
  onAttachVoiceMemo,
  onReportCommunityHazard,
}) => {
  const [activeTab, setActiveTab] = useState<VhvMobileTab>('home');
  const [hazardFocusElderId, setHazardFocusElderId] = useState<string | null>(
    null
  );
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'fallback'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [scannedElder, setScannedElder] = useState<ElderProfile | null>(null);
  const [lastScannedBanner, setLastScannedBanner] = useState<ElderProfile | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);

  // Voice Memo Recorder State (Browser Microphone API + MediaRecorder + Web Audio Analyser)
  const [isVoiceMemoOpen, setIsVoiceMemoOpen] = useState(false);
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string>(
    () => followUps[0]?.id || ''
  );
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [micMode, setMicMode] = useState<'idle' | 'microphone' | 'field_synth'>('idle');
  const [micStatusMessage, setMicStatusMessage] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [verbalTranscript, setVerbalTranscript] = useState('');
  const [audioBars, setAudioBars] = useState<number[]>([
    18, 26, 34, 22, 40, 30, 20, 36, 45, 28, 22, 34, 26, 18, 30, 24,
  ]);
  const [playingFollowUpId, setPlayingFollowUpId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Refs for Browser Microphone API & Audio Playback
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<{ stop?: () => void } | null>(null);
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingSecRef = useRef<number>(0);

  const highRiskElders = elders.filter(
    (e) => e.riskProfile.matrixGroup === 'D' || e.riskProfile.matrixGroup === 'C'
  );
  const dueFollowUps = followUps.filter((f) => f.status !== 'completed');
  const pendingUploadCount =
    offlineQueue.length > 0
      ? offlineQueue.length
      : elders.filter((e) => e.syncStatus === 'pending_offline').length;

  useEffect(() => {
    if (!isSyncing) {
      setSyncProgress(0);
      return;
    }
    setSyncProgress(18);
    const t1 = window.setTimeout(() => setSyncProgress(45), 250);
    const t2 = window.setTimeout(() => setSyncProgress(72), 550);
    const t3 = window.setTimeout(() => setSyncProgress(92), 850);
    const t4 = window.setTimeout(() => setSyncProgress(100), 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [isSyncing]);

  const stopCameraStream = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const resolveElderFromQrPayload = (rawPayload: string): ElderProfile | null => {
    const cleaned = rawPayload.trim();
    if (!cleaned) return null;

    // Try JSON payload first if encoded as {"id":"KORAT-ELD-001"}
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.id === 'string') {
        const byJsonId = elders.find(
          (e) => e.id.toLowerCase() === parsed.id.toLowerCase()
        );
        if (byJsonId) return byJsonId;
      }
    } catch {
      // Not JSON, proceed with string matching
    }

    const lower = cleaned.toLowerCase();
    return (
      elders.find(
        (e) =>
          e.id.toLowerCase() === lower ||
          lower.includes(e.id.toLowerCase()) ||
          e.name.toLowerCase().includes(lower) ||
          e.cidMasked.toLowerCase() === lower
      ) || null
    );
  };

  const handleQrCodeDetected = (qrPayload: string, autoLaunchScreening = true) => {
    const found = resolveElderFromQrPayload(qrPayload);
    if (!found) {
      setCameraError(`ไม่พบข้อมูลผู้สูงอายุจากรหัส QR: "${qrPayload}" กรุณาลองอีกครั้ง`);
      return;
    }
    setCameraError(null);
    setScannedElder(found);
    setLastScannedBanner(found);

    if (autoLaunchScreening) {
      stopCameraStream();
      setIsQrScannerOpen(false);
      onOpenScreening(found);
    }
  };

  const startCameraScanner = async () => {
    stopCameraStream();
    setCameraStatus('starting');
    setCameraError(null);
    setScannedElder(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('fallback');
      setCameraError(
        'เบราว์เซอร์อุปกรณ์นี้ไม่รองรับการเปิดกล้องโดยตรง สามารถเลือกจำลองสแกนบัตร QR Code ผู้สูงอายุด้านล่างเพื่อดึงข้อมูลคัดกรองได้ทันที'
      );
      return;
    }

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraStatus('active');

      // Native BarcodeDetector loop if supported by browser
      const BarcodeDetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        scanIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              handleQrCodeDetected(barcodes[0].rawValue, true);
            }
          } catch {
            // Ignore frame detection error
          }
        }, 450);
      }
    } catch {
      setCameraStatus('fallback');
      setCameraError(
        'ไม่สามารถเข้าถึงกล้องได้ในสภาพแวดล้อมปัจจุบัน กรุณาแตะเลือกบัตร QR Code ผู้สูงอายุด้านล่างเพื่อดึงโปรไฟล์เข้าสู่หน้าคัดกรองอัตโนมัติ'
      );
    }
  };

  const handleOpenQrScanner = () => {
    setIsQrScannerOpen(true);
  };

  const handleCloseQrScanner = () => {
    stopCameraStream();
    setIsQrScannerOpen(false);
    setCameraStatus('idle');
    setCameraError(null);
  };

  useEffect(() => {
    if (isQrScannerOpen) {
      startCameraScanner();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isQrScannerOpen]);

  // Generate a small playable WAV Data URL when browser microphone hardware is unavailable in preview
  const buildSynthesizedVoiceMemoWav = (durationSec: number): string => {
    const sampleRate = 8000;
    const clampedSec = Math.max(2, Math.min(8, durationSec || 4));
    const numSamples = sampleRate * clampedSec;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const syllableEnvelope =
        Math.sin(t * Math.PI * 3.2) > -0.2
          ? 0.45 + 0.35 * Math.sin(t * Math.PI * 6.4)
          : 0.05;
      const f0 = 195 + 25 * Math.sin(t * 4.5);
      const wave =
        Math.sin(2 * Math.PI * f0 * t) * 0.6 +
        Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25 +
        Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15;
      const sample = Math.max(-1, Math.min(1, wave * syllableEnvelope * 0.35));
      view.setInt16(44 + i * 2, sample * 32767, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:audio/wav;base64,${window.btoa(binary)}`;
  };

  const cleanupMicrophoneRecording = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (analyserIntervalRef.current) {
      window.clearInterval(analyserIntervalRef.current);
      analyserIntervalRef.current = null;
    }
    if (speechRecognitionRef.current && speechRecognitionRef.current.stop) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecordingAudio(false);
  };

  useEffect(() => {
    return () => {
      cleanupMicrophoneRecording();
      if (inlineAudioRef.current) {
        inlineAudioRef.current.pause();
      }
    };
  }, []);

  const handleOpenVoiceMemoModal = (followUp?: FollowUpRecord) => {
    const targetFu = followUp || followUps[0];
    if (targetFu) {
      setSelectedFollowUpId(targetFu.id);
      if (targetFu.voiceMemo) {
        setRecordedAudioUrl(targetFu.voiceMemo.audioDataUrl || null);
        setRecordedDurationSec(targetFu.voiceMemo.durationSec);
        setVerbalTranscript(targetFu.voiceMemo.transcriptNote);
        setMicMode(targetFu.voiceMemo.sourceMode);
      } else {
        setRecordedAudioUrl(null);
        setRecordedDurationSec(0);
        setVerbalTranscript(
          `ลงพื้นที่เยี่ยมบ้าน ${targetFu.elderName} (${targetFu.village}) วัดความดันซ้ำและตรวจสอบการรับประทานยาลดความดันโลหิตต่อเนื่อง`
        );
        setMicMode('idle');
      }
    }
    setMicStatusMessage(null);
    setRecordingSeconds(0);
    recordingSecRef.current = 0;
    setIsVoiceMemoOpen(true);
  };

  const handleCloseVoiceMemoModal = () => {
    cleanupMicrophoneRecording();
    setIsVoiceMemoOpen(false);
  };

  const startVoiceMemoRecording = async () => {
    cleanupMicrophoneRecording();
    setRecordedAudioUrl(null);
    setRecordedDurationSec(0);
    setRecordingSeconds(0);
    recordingSecRef.current = 0;
    setIsRecordingAudio(true);

    // Start elapsed second timer
    timerIntervalRef.current = window.setInterval(() => {
      recordingSecRef.current += 1;
      setRecordingSeconds(recordingSecRef.current);
    }, 1000);

    // Start optional browser Thai SpeechRecognition if supported
    const SpeechRecCtor = (
      window as unknown as {
        SpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          start: () => void;
          stop: () => void;
        };
        webkitSpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          start: () => void;
          stop: () => void;
        };
      }
    ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => {
            lang: string;
            continuous: boolean;
            interimResults: boolean;
            onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
            start: () => void;
            stop: () => void;
          };
        }
      ).webkitSpeechRecognition;

    if (SpeechRecCtor) {
      try {
        const rec = new SpeechRecCtor();
        rec.lang = 'th-TH';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event) => {
          let spoken = '';
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i] && event.results[i][0]) {
              spoken += event.results[i][0].transcript;
            }
          }
          if (spoken.trim()) {
            setVerbalTranscript(spoken.trim());
          }
        };
        rec.start();
        speechRecognitionRef.current = rec;
      } catch {
        // Ignore if speech recognition cannot start
      }
    }

    // Attempt real Browser Microphone API via navigator.mediaDevices.getUserMedia({ audio: true })
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });

        micStreamRef.current = audioStream;
        setMicMode('microphone');
        setMicStatusMessage(
          'กำลังบันทึกเสียงผ่านไมโครโฟนอุปกรณ์ (Browser Microphone API Active) — พูดสรุปอาการผู้สูงอายุได้เลย'
        );

        // Set up Web Audio AnalyserNode for real-time voice level meter
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(audioStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          analyserIntervalRef.current = window.setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const bars = Array.from({ length: 16 }, (_, idx) => {
              const val = dataArray[idx % dataArray.length] || 12;
              return Math.max(14, Math.min(96, Math.round((val / 255) * 100)));
            });
            setAudioBars(bars);
          }, 100);
        } catch {
          // Fallback animated bars
        }

        // Start MediaRecorder
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(audioStream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          const finalDuration = Math.max(1, recordingSecRef.current);
          setRecordedDurationSec(finalDuration);
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, {
              type: recorder.mimeType || 'audio/webm',
            });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                setRecordedAudioUrl(reader.result);
              }
            };
            reader.readAsDataURL(blob);
          } else {
            setRecordedAudioUrl(buildSynthesizedVoiceMemoWav(finalDuration));
          }
        };

        recorder.start(250);
        return;
      } catch {
        // Hardware microphone blocked or unavailable in sandbox -> fall through to Field Synth mode
      }
    }

    // Fallback: Field Microphone Audio Synthesizer so recording always works in preview environments
    setMicMode('field_synth');
    setMicStatusMessage(
      'จำลองไมโครโฟนภาคสนามอัตโนมัติ (Field Audio Capture Mode) — ระบบกำลังบันทึกคลื่นเสียงและถอดความบริบทการเยี่ยมบ้าน'
    );
    analyserIntervalRef.current = window.setInterval(() => {
      setAudioBars(
        Array.from({ length: 16 }, () => Math.floor(22 + Math.random() * 68))
      );
    }, 120);
  };

  const stopVoiceMemoRecording = () => {
    const finalSec = Math.max(2, recordingSecRef.current || 3);
    setRecordedDurationSec(finalSec);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        setRecordedAudioUrl(buildSynthesizedVoiceMemoWav(finalSec));
      }
    } else {
      setRecordedAudioUrl(buildSynthesizedVoiceMemoWav(finalSec));
    }

    cleanupMicrophoneRecording();
    setAudioBars([20, 32, 48, 36, 60, 44, 28, 52, 64, 40, 30, 46, 34, 24, 38, 26]);
    setMicStatusMessage(
      `บันทึกเสียงเสร็จสมบูรณ์ (ความยาว ${finalSec} วินาที) สามารถกดฟังเสียงหรือแก้ไขข้อความสรุปก่อนแนบเข้าใบบันทึกเยี่ยมบ้าน`
    );
  };

  const handleSaveAndAttachVoiceMemo = () => {
    const targetFu =
      followUps.find((f) => f.id === selectedFollowUpId) || followUps[0];
    if (!targetFu) return;

    const finalDuration = Math.max(2, recordedDurationSec || recordingSecRef.current || 4);
    const finalAudioUrl =
      recordedAudioUrl || buildSynthesizedVoiceMemoWav(finalDuration);

    const attachment: VoiceMemoAttachment = {
      id: `VM-${Date.now().toString().slice(-6)}`,
      followUpId: targetFu.id,
      elderId: targetFu.elderId,
      elderName: targetFu.elderName,
      vhvName: targetFu.vhvName,
      createdAt: new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      durationSec: finalDuration,
      audioDataUrl: finalAudioUrl,
      transcriptNote:
        verbalTranscript.trim() ||
        `บันทึกเสียงเยี่ยมบ้าน ${targetFu.elderName}: ติดตามวัดความดันและแนะนำการรับประทานยาตามแผน 4 สัปดาห์`,
      sourceMode: micMode === 'microphone' ? 'microphone' : 'field_synth',
    };

    if (onAttachVoiceMemo) {
      onAttachVoiceMemo(targetFu.id, attachment);
    }
    handleCloseVoiceMemoModal();
  };

  const handleTogglePlayFollowUpMemo = (fu: FollowUpRecord) => {
    if (!fu.voiceMemo?.audioDataUrl) return;

    if (playingFollowUpId === fu.id) {
      if (inlineAudioRef.current) {
        inlineAudioRef.current.pause();
        inlineAudioRef.current = null;
      }
      setPlayingFollowUpId(null);
      return;
    }

    if (inlineAudioRef.current) {
      inlineAudioRef.current.pause();
    }

    const audio = new Audio(fu.voiceMemo.audioDataUrl);
    inlineAudioRef.current = audio;
    setPlayingFollowUpId(fu.id);
    audio.onended = () => {
      setPlayingFollowUpId(null);
    };
    audio.onerror = () => {
      setPlayingFollowUpId(null);
    };
    audio.play().catch(() => {
      setPlayingFollowUpId(null);
    });
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Field Control Bar (Offline Simulation, QR Scanner & Sync) */}
      <div className="bg-slate-800 border border-teal-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
            <span>ระดับผู้ใช้งานที่ 2 — อสม. ภาคสนาม (Field Health Technology PWA)</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span>ผู้ปฏิบัติงาน: อสม.วันเพ็ญ ศรีโคราช (ต.หัวทะเล)</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-200">
            ออกแบบตามหลัก Mobile-First Thumb Zone ปุ่มสัมผัสขนาดใหญ่ ≥ 44px พร้อมระบบสแกน QR Code ประจำตัวผู้สูงอายุและบันทึกข้อมูลแบบ Offline-First
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* QR Code Scanner Button */}
          <button
            type="button"
            onClick={handleOpenQrScanner}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>สแกน QR Code ผู้สูงอายุ</span>
          </button>

          {/* Voice Memo Recorder Button (Microphone API) */}
          <button
            type="button"
            onClick={() => handleOpenVoiceMemoModal(dueFollowUps[0] || followUps[0])}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 border border-teal-400 text-teal-300 text-xs font-bold hover:bg-teal-500 hover:text-slate-950 flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>บันทึกเสียงเยี่ยมบ้าน (Voice Memo)</span>
          </button>

          {/* Community Needs & Environmental Hazard Map Pinning Button */}
          <button
            type="button"
            onClick={() => setActiveTab('hazard_map')}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-extrabold hover:bg-amber-400 flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            <span>ปักหมุดจุดเสี่ยงชุมชน (Hazard Map)</span>
          </button>

          {/* Toggle Offline Simulation */}
          <button
            onClick={onToggleOfflineMode}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              isOfflineMode
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-500/60 hover:bg-emerald-900'
            }`}
          >
            {isOfflineMode ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span>สถานะ: โหมด Offline (เก็บในเครื่อง)</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>สถานะ: Online (สลับเพื่อจำลอง Offline)</span>
              </>
            )}
          </button>

          {/* Sync Offline Queue Button (Sync Now with Spinner & Visual Progress Bar) */}
          <button
            type="button"
            onClick={onSyncOfflineQueue}
            disabled={isSyncing}
            className="relative overflow-hidden min-h-[42px] px-4 py-2 rounded-lg bg-slate-900 border border-teal-400 text-teal-300 text-xs font-bold hover:bg-slate-950 disabled:opacity-90 flex flex-col justify-center gap-1 transition-colors cursor-pointer min-w-[225px]"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 text-teal-300 animate-spin shrink-0" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-teal-300 shrink-0" />
                )}
                <span className="font-mono-num whitespace-nowrap">
                  {isSyncing
                    ? `กำลังอัปโหลดข้อมูล... (${syncProgress}%)`
                    : `Sync Now · ซิงก์ข้อมูล (${pendingUploadCount} รายการค้างส่ง)`}
                </span>
              </div>
            </div>

            {/* Embedded Visual Progress Bar inside the Sync Now button */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  isSyncing
                    ? 'bg-teal-400'
                    : pendingUploadCount > 0
                    ? 'bg-amber-400 w-1/3'
                    : 'bg-emerald-400 w-full'
                }`}
                style={isSyncing ? { width: `${syncProgress}%` } : undefined}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Live Upload Progress Bar Banner when Sync Now is clicked */}
      {isSyncing && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-slate-800 border border-teal-400 shadow-lg space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <RefreshCw className="w-4 h-4 text-teal-300 animate-spin shrink-0" />
              <span>
                กำลังอัปโหลดข้อมูลคัดกรองภาคสนามขึ้นระบบกลาง รพ.สต. (Uploading Pending Records...)
              </span>
            </div>
            <span className="font-mono-num font-extrabold text-teal-300">
              {syncProgress}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-200"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-300 font-mono-num">
            สถานะคิวรออัปโหลด: กำลังส่งข้อมูลผู้สูงอายุ ({pendingUploadCount > 0 ? pendingUploadCount : 3} รายการ) ไปยังเซิร์ฟเวอร์ รพ.สต. อำเภอเมืองนครราชสีมา
          </p>
        </div>
      )}

      {/* Recently Scanned Elder Feedback Banner */}
      {lastScannedBanner && (
        <div className="p-3.5 rounded-xl bg-teal-950/90 border border-teal-400/60 flex flex-wrap items-center justify-between gap-3 text-xs text-teal-100 shadow-md">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-teal-300 shrink-0" />
            <span>
              ดึงข้อมูลจาก QR Code สำเร็จ:{' '}
              <strong className="text-white">{lastScannedBanner.name}</strong> (รหัส{' '}
              <span className="font-mono-num text-teal-300">{lastScannedBanner.id}</span> ·{' '}
              {lastScannedBanner.village} · กลุ่ม {lastScannedBanner.riskProfile.matrixGroup})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreening(lastScannedBanner)}
              className="px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 cursor-pointer"
            >
              เปิดหน้าคัดกรองซ้ำ
            </button>
            <button
              type="button"
              onClick={() => setLastScannedBanner(null)}
              className="text-teal-300 hover:text-white font-semibold cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Full-Width VHV Field PWA Workspace Container (No Phone Frame) */}
      <div className="w-full bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg">
        {/* Mobile Sticky App Header & Top VHV Menu Bar */}
        <div className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-white">
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-2 truncate">
              <span className="text-sm font-bold tracking-tight">Smart Elderly Watch</span>
              <span className="text-[11px] text-teal-300 font-semibold">อสม. โคราช</span>
              <span className="inline-flex items-center gap-1 rounded bg-teal-400 px-1.5 py-0.5 text-[10px] font-mono-num font-black text-slate-950">
                ● Active:{' '}
                {activeTab === 'home'
                  ? 'หน้าหลัก'
                  : activeTab === 'elders'
                  ? 'ผู้สูงอายุ'
                  : activeTab === 'screen'
                  ? 'คัดกรอง'
                  : activeTab === 'high_risk'
                  ? 'กลุ่มเสี่ยง'
                  : activeTab === 'hazard_map'
                  ? 'ปักหมุดจุดเสี่ยง'
                  : 'Dashboard'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono-num">
              <button
                type="button"
                onClick={handleOpenQrScanner}
                className="px-2.5 py-1 rounded-md bg-teal-500/20 border border-teal-400/50 text-teal-300 hover:bg-teal-500 hover:text-slate-950 font-sans font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>สแกน QR</span>
              </button>
              {isOfflineMode ? (
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Offline ({pendingUploadCount})
                </span>
              ) : (
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> Online
                </span>
              )}
            </div>
          </div>

          {/* Top VHV Field Menu Bar (Always visible without scrolling) */}
          <nav
            aria-label="แถบเมนูปฏิบัติงาน อสม. ด้านบน"
            className="px-4 py-2 bg-slate-900/95 flex items-center gap-1.5 overflow-x-auto"
          >
            {[
              { id: 'home' as const, label: 'หน้าหลัก', icon: Home },
              { id: 'elders' as const, label: `ผู้สูงอายุ (${elders.length})`, icon: Users },
              { id: 'screen' as const, label: 'คัดกรองสุขภาพ', icon: ClipboardList },
              {
                id: 'high_risk' as const,
                label: `กลุ่มเสี่ยง (${highRiskElders.length})`,
                icon: AlertTriangle,
              },
              {
                id: 'hazard_map' as const,
                label: 'ปักหมุดจุดเสี่ยงชุมชน',
                icon: MapPin,
              },
              { id: 'dashboard' as const, label: 'สรุปงาน อสม.', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'app-menu-btn-active shadow-sm ring-1 ring-teal-300'
                      : 'app-menu-btn-inactive'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-mono-num font-black text-teal-300">
                      <span style={{ color: '#5eead4' }}>Active</span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Scrollable Mobile Content Area */}
        <div className="p-4 space-y-4 min-h-[540px]">
          {/* TAB 1: 🏠 หน้าหลัก (Home) */}
          {activeTab === 'home' && (
            <div className="space-y-4">
              {/* Greeting & Quick Stats */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <p className="text-xs text-teal-300 font-medium">สวัสดีวันลงพื้นที่เยี่ยมบ้าน</p>
                <h2 className="text-base font-bold text-white mt-0.5">
                  อสม.วันเพ็ญ ศรีโคราช · ต.หัวทะเล
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-700 text-center font-mono-num">
                  <div>
                    <p className="text-lg font-extrabold text-white">{elders.length}</p>
                    <p className="text-[11px] font-sans text-slate-300">ดูแลทั้งหมด</p>
                  </div>
                  <div className="border-x border-slate-700">
                    <p className="text-lg font-extrabold text-rose-400">{highRiskElders.length}</p>
                    <p className="text-[11px] font-sans text-slate-300">กลุ่มเสี่ยง C/D</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-amber-300">{dueFollowUps.length}</p>
                    <p className="text-[11px] font-sans text-slate-300">นัดติดตาม</p>
                  </div>
                </div>
              </div>

              {/* Offline-First Queue & Sync Now Card with Progress Bar */}
              <div
                className={`rounded-2xl p-4 space-y-3 border ${
                  pendingUploadCount > 0 || isOfflineMode
                    ? 'bg-amber-950/90 border-amber-500/60'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      pendingUploadCount > 0 || isOfflineMode ? 'text-amber-200' : 'text-white'
                    }`}
                  >
                    ระบบซิงก์ข้อมูลภาคสนาม (Offline-First Sync Queue)
                  </span>
                  <span className="text-xs font-mono-num font-bold text-amber-300">
                    {pendingUploadCount} รายการรออัปโหลด
                  </span>
                </div>
                <p
                  className={`text-xs ${
                    pendingUploadCount > 0 || isOfflineMode ? 'text-amber-100' : 'text-slate-300'
                  }`}
                >
                  ข้อมูลคัดกรองถูกเก็บในหน่วยความจำเครื่องแม้ไม่มีอินเทอร์เน็ต กดปุ่ม Sync Now ด้านล่างเพื่ออัปโหลดรายการค้างส่งไปยัง รพ.สต.
                </p>

                {/* Visual Progress Bar for Pending Uploads */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono-num">
                    <span className="text-slate-200">
                      {isSyncing
                        ? 'กำลังอัปโหลดข้อมูลขึ้นเซิร์ฟเวอร์ รพ.สต. ...'
                        : lastSyncedAt && pendingUploadCount === 0
                        ? `อัปโหลดครบถ้วนแล้ว (ล่าสุด ${lastSyncedAt})`
                        : `พร้อมอัปโหลด ${pendingUploadCount} รายการค้างส่ง`}
                    </span>
                    <span className="font-bold text-teal-300">
                      {isSyncing ? `${syncProgress}%` : pendingUploadCount === 0 ? '100%' : '0%'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-200 ${
                        isSyncing
                          ? 'bg-teal-400'
                          : pendingUploadCount === 0
                          ? 'bg-emerald-400 w-full'
                          : 'bg-amber-400 w-1/4'
                      }`}
                      style={isSyncing ? { width: `${syncProgress}%` } : undefined}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSyncOfflineQueue}
                  disabled={isSyncing}
                  className={`w-full min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    pendingUploadCount > 0 || isOfflineMode
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="font-mono-num">
                        กำลังอัปโหลดรายการค้างส่ง... ({syncProgress}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>
                        Sync Now — ซิงก์ข้อมูลขึ้นเซิร์ฟเวอร์ รพ.สต. ทันที ({pendingUploadCount} รายการ)
                      </span>
                    </>
                  )}
                </button>
              </div>

              {lastSyncedAt && offlineQueue.length === 0 && (
                <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>ซิงก์ข้อมูลล่าสุดกับ รพ.สต. สำเร็จเมื่อ {lastSyncedAt}</span>
                </div>
              )}

              {/* Primary Core Action Buttons (Thumb-friendly 48px+ targets) */}
              <div>
                <h3 className="text-xs font-bold text-slate-200 mb-2">
                  เมนูปฏิบัติงานหลักสำหรับ อสม. (สแกนด่วน &amp; คัดกรองเชิงรุก)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* QR Code Scanner CTA Button */}
                  <button
                    type="button"
                    onClick={handleOpenQrScanner}
                    className="min-h-[56px] rounded-2xl bg-slate-800 border-2 border-teal-400 text-white px-4 py-3 text-left flex items-center justify-between hover:bg-slate-700 transition-colors cursor-pointer shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-teal-300">
                          สแกน QR Code ประจำตัวผู้สูงอายุ
                        </p>
                        <p className="text-[11px] text-slate-200 font-medium">
                          เปิดกล้องสแกนบัตรประจำตัวเพื่อดึงประวัติและคัดกรองทันที
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-teal-300 shrink-0" />
                  </button>

                  {/* Manual / New Elder Screening CTA Button */}
                  <button
                    onClick={() => onOpenScreening()}
                    className="min-h-[56px] rounded-2xl bg-teal-500 text-slate-950 px-4 py-3 text-left flex items-center justify-between hover:bg-teal-400 transition-colors cursor-pointer shadow-md"
                  >
                    <div>
                      <p className="text-sm font-extrabold">📋 คัดกรองสุขภาพ / ลงทะเบียนใหม่</p>
                      <p className="text-[11px] text-slate-900 font-medium">
                        บันทึกความดัน น้ำหนัก BMI และประเมินภาวะเปราะบาง
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0" />
                  </button>

                  <button
                    onClick={() => setActiveTab('elders')}
                    className="min-h-[52px] rounded-2xl bg-slate-800 border border-slate-700 p-3.5 text-left hover:bg-slate-750 hover:border-teal-400 cursor-pointer"
                  >
                    <p className="text-sm font-bold text-white">👴 ผู้สูงอายุ</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      ทะเบียนในหมู่บ้าน ({elders.length} คน)
                    </p>
                  </button>

                  <button
                    onClick={() => setActiveTab('high_risk')}
                    className="min-h-[52px] rounded-2xl bg-slate-800 border border-slate-700 p-3.5 text-left hover:bg-slate-750 hover:border-rose-400 cursor-pointer"
                  >
                    <p className="text-sm font-bold text-rose-400">⚠️ กลุ่มเสี่ยง</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      ต้องเฝ้าระวัง ({highRiskElders.length} คน)
                    </p>
                  </button>

                  {/* Community Needs & Environmental Hazard Mapper CTA Button */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('hazard_map')}
                    className="sm:col-span-2 min-h-[56px] rounded-2xl bg-slate-800 border-2 border-amber-400/80 text-white px-4 py-3 text-left flex items-center justify-between hover:bg-slate-700 transition-colors cursor-pointer shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-amber-300">
                          📍 ปักหมุดจุดเสี่ยงสภาพแวดล้อม &amp; ความต้องการของชุมชน (Community Hazard Map)
                        </p>
                        <p className="text-[11px] text-slate-200 font-medium">
                          ระบุพิกัดบ้านผู้สูงอายุกลุ่มเสี่ยงสูง แจ้งปัญหาทางเท้า ซอยน้ำท่วม บันไดไม่มีราวจับ หรือขอรถเข็น/ไม้เท้า
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-amber-300 shrink-0" />
                  </button>
                </div>
              </div>

                  {/* VHV Follow-Up Notifications ("ถึงกำหนดติดตามคุณยาย... แล้ว") with Voice Memo Attachment */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>แจ้งเตือนการติดตามเยี่ยมบ้านวันนี้ (พร้อมระบบแนบเสียงบันทึก อสม.)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenVoiceMemoModal(dueFollowUps[0] || followUps[0])}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-500/20 border border-teal-400/60 text-teal-300 hover:bg-teal-500 hover:text-slate-950 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>อัดเสียงบันทึกใหม่</span>
                    </button>
                    <span className="text-[11px] font-mono-num text-slate-300">
                      {dueFollowUps.length} รายการ
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-700">
                  {dueFollowUps.map((fu) => {
                    const matchedElder = elders.find((e) => e.id === fu.elderId);
                    const isPlayingThis = playingFollowUpId === fu.id;
                    return (
                      <div key={fu.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-white">
                              🔔 &ldquo;ถึงกำหนดติดตาม {fu.elderName} แล้ว&rdquo;
                            </p>
                            <p className="text-[11px] text-slate-200 mt-0.5">{fu.purpose}</p>
                            <p className="text-[11px] text-slate-300 mt-1">
                              บันทึกการติดตาม: <span className="text-slate-100">{fu.notes}</span>
                            </p>
                          </div>
                        </div>

                        {/* Attached Voice Memo Playback Bar if recorded */}
                        {fu.voiceMemo && (
                          <div className="p-2.5 rounded-xl bg-slate-900/95 border border-teal-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleTogglePlayFollowUpMemo(fu)}
                                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                                  isPlayingThis
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                                }`}
                              >
                                {isPlayingThis ? (
                                  <>
                                    <Square className="w-3.5 h-3.5" />
                                    <span>หยุดเล่น</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5" />
                                    <span className="font-mono-num">
                                      ฟังเสียง ({fu.voiceMemo.durationSec}s)
                                    </span>
                                  </>
                                )}
                              </button>
                              <div className="min-w-0 text-xs">
                                <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    เสียงบันทึกเยี่ยมบ้าน ({fu.voiceMemo.createdAt})
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-200 truncate">
                                  &ldquo;{fu.voiceMemo.transcriptNote}&rdquo;
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-teal-300 font-mono-num">
                            กลุ่ม {fu.matrixGroup} · นัด {fu.dueDate}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenVoiceMemoModal(fu)}
                              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 border border-teal-400/70 text-xs font-bold text-teal-300 hover:bg-teal-500 hover:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>
                                {fu.voiceMemo ? 'อัดเสียงเพิ่ม/แก้ไข' : 'อัดเสียงเยี่ยมบ้าน (Voice Memo)'}
                              </span>
                            </button>
                            {matchedElder && (
                              <button
                                onClick={() => onSelectElder(matchedElder)}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
                              >
                                ดูแผน 4 สัปดาห์
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 👴 ผู้สูงอายุ (Elderly List) */}
          {activeTab === 'elders' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white">
                  รายชื่อผู้สูงอายุในความดูแล ({elders.length} คน)
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenQrScanner}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 border border-teal-400 text-teal-300 hover:bg-teal-500 hover:text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>สแกน QR ประจำตัว</span>
                  </button>
                  <button
                    onClick={() => onOpenScreening()}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>ลงทะเบียนเพิ่ม</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl divide-y divide-slate-700">
                {elders.map((elder) => (
                  <div
                    key={elder.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-700/50 transition-colors"
                  >
                    <div
                      onClick={() => onSelectElder(elder)}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {elder.name}
                        </span>
                        <span className="text-xs text-slate-300 font-mono-num">
                          ({elder.age} ปี)
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-300">
                        {elder.village} · BP{' '}
                        <span className="font-mono-num text-white font-semibold">
                          {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp}
                        </span>{' '}
                        · BMI <span className="font-mono-num text-white font-semibold">{elder.chronicMetrics.bmi}</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-teal-300">
                        กลุ่ม {elder.riskProfile.matrixGroup} ({elder.riskProfile.matrixAction})
                        {elder.syncStatus === 'pending_offline' && (
                          <span className="ml-2 text-amber-300">· {UI_LABELS.offlineSync.localQueuePending}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenScreening(elder)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-teal-400 bg-teal-500 text-xs font-bold text-slate-950 hover:bg-teal-400 shrink-0 cursor-pointer"
                    >
                      คัดกรอง
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: 📋 คัดกรอง (Quick Screening Launcher) */}
          {activeTab === 'screen' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-white">
                ระบบคัดกรองสุขภาพภาคสนามสำหรับ อสม.
              </h2>
              <p className="text-xs text-slate-200">
                ครอบคลุมการวัดน้ำหนัก ส่วนสูง คำนวณ BMI อัตโนมัติ ความดันโลหิต พฤติกรรมสุขภาพ กิจวัตรประจำวัน (ADL) และภาวะเปราะบาง 7 มิติ
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleOpenQrScanner}
                  className="w-full min-h-[48px] rounded-xl bg-slate-900 border-2 border-teal-400 text-teal-300 text-sm font-bold flex items-center justify-center gap-2 hover:bg-teal-500 hover:text-slate-950 transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>สแกน QR Code ประจำตัวผู้สูงอายุ</span>
                </button>

                <button
                  onClick={() => onOpenScreening()}
                  className="w-full min-h-[48px] rounded-xl bg-teal-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 hover:bg-teal-400 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ลงทะเบียนและคัดกรองผู้สูงอายุรายใหม่</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-700">
                <p className="text-xs font-bold text-slate-200 mb-2">
                  หรือเลือกผู้สูงอายุเพื่อบันทึกผลตรวจติดตามซ้ำ:
                </p>
                <div className="space-y-2">
                  {elders.slice(0, 5).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onOpenScreening(e)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-left flex items-center justify-between hover:border-teal-400 cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-white">
                        {e.name} ({e.age} ปี · กลุ่ม {e.riskProfile.matrixGroup})
                      </span>
                      <span className="text-xs text-teal-300 font-bold">เริ่มคัดกรอง →</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ⚠️ กลุ่มเสี่ยง (High Risk Surveillance) */}
          {activeTab === 'high_risk' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-rose-400">
                ⚠️ บัญชีผู้สูงอายุกลุ่มเสี่ยงสูง (กลุ่ม D และ C) ที่ต้องเฝ้าระวังพิเศษ
              </h2>
              <div className="space-y-2.5">
                {highRiskElders.map((elder) => (
                  <div
                    key={elder.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-rose-400">
                          {elder.riskProfile.matrixGroup === 'D'
                            ? '🔴 กลุ่ม D — ประเมิน/ส่งต่อเร่งด่วน'
                            : '🟠 กลุ่ม C — เฝ้าระวังภายใน 7 วัน'}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          {elder.name} (อายุ {elder.age} ปี)
                        </h3>
                        <p className="text-xs text-slate-300">
                          {elder.village} · {elder.livingArrangement}
                        </p>
                      </div>
                      <div className="text-right font-mono-num text-xs">
                        <span className="font-bold text-white">
                          Frailty {elder.riskProfile.frailtyScore}/100
                        </span>
                        <span className="block text-rose-400 font-bold">
                          BP {elder.chronicMetrics.sbp}/{elder.chronicMetrics.dbp}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700">
                      <button
                        onClick={() => onSelectElder(elder)}
                        className="flex-1 min-h-[44px] rounded-xl bg-slate-900 border border-slate-600 text-xs font-semibold text-white hover:border-teal-400 cursor-pointer"
                      >
                        ดูแผนสุขภาพ 4 สัปดาห์
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHazardFocusElderId(elder.id);
                          setActiveTab('hazard_map');
                        }}
                        className="flex-1 min-h-[44px] rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold hover:bg-amber-400 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>ปักหมุดจุดเสี่ยงบ้านนี้</span>
                      </button>
                      <button
                        onClick={() => onCreateReferral(elder)}
                        className="flex-1 min-h-[44px] rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>แจ้งส่งต่อ รพ.สต.</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4.5: 📍 ปักหมุดจุดเสี่ยงชุมชน (Community Needs & Environmental Hazard Reporting Tool) */}
          {activeTab === 'hazard_map' && (
            <VhvHazardMapReportingTool
              elders={elders}
              isOfflineMode={isOfflineMode}
              onSelectElder={onSelectElder}
              onCreateReferral={onCreateReferral}
              initialFocusElderId={hazardFocusElderId}
              onReportSubmitted={onReportCommunityHazard}
            />
          )}

          {/* TAB 5: 📊 Dashboard (VHV Field Summary) */}
          {activeTab === 'dashboard' && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-4">
              <h2 className="text-sm font-bold text-white">
                📊 สรุปผลการดำเนินงานของ อสม. ประจำเดือนตุลาคม 2569
              </h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-200">กลุ่ม A (ส่งเสริมสุขภาพ):</span>
                  <span className="font-mono-num font-bold text-emerald-400">
                    {elders.filter((e) => e.riskProfile.matrixGroup === 'A').length} คน
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-200">กลุ่ม B (ติดตามฟื้นฟู Pre-Frailty):</span>
                  <span className="font-mono-num font-bold text-amber-300">
                    {elders.filter((e) => e.riskProfile.matrixGroup === 'B').length} คน
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-200">กลุ่ม C (เฝ้าระวังโรคเรื้อรัง):</span>
                  <span className="font-mono-num font-bold text-orange-400">
                    {elders.filter((e) => e.riskProfile.matrixGroup === 'C').length} คน
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-200">กลุ่ม D (ประเมิน/ส่งต่อ รพ.สต.):</span>
                  <span className="font-mono-num font-bold text-rose-400">
                    {elders.filter((e) => e.riskProfile.matrixGroup === 'D').length} คน
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-200">เวลาเฉลี่ยในการคัดกรองต่อคน:</span>
                  <span className="font-mono-num font-bold text-teal-300">3.1 นาที</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom 6-Item Mobile Tab Bar (Natural Thumb Reach Zone) */}
        <nav
          aria-label="เมนูหลัก อสม."
          className="sticky bottom-0 z-20 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-6 h-16"
        >
          {[
            { id: 'home' as const, label: 'หน้าหลัก', icon: Home },
            { id: 'elders' as const, label: 'ผู้สูงอายุ', icon: Users },
            { id: 'screen' as const, label: 'คัดกรอง', icon: ClipboardList },
            { id: 'high_risk' as const, label: 'กลุ่มเสี่ยง', icon: AlertTriangle },
            { id: 'hazard_map' as const, label: 'จุดเสี่ยง', icon: MapPin },
            { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-300 font-extrabold border-t-2 border-teal-400'
                    : 'text-slate-300 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-300' : 'text-slate-400'}`} />
                <span className="text-[11px] mt-0.5 tracking-tight whitespace-nowrap flex items-center gap-1">
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="px-1 rounded bg-teal-400 text-slate-950 text-[9px] font-mono-num font-black">
                      Active
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Camera QR Code Scanner Modal for VHV Elderly ID Lookup */}
      {isQrScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 text-slate-100 rounded-2xl border border-teal-500/50 shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    สแกน QR Code ประจำตัวผู้สูงอายุ (Elderly ID QR Scanner)
                  </h3>
                  <p className="text-xs text-slate-300">
                    ส่องกล้องไปที่บัตรประจำตัวผู้สูงอายุเพื่อดึงข้อมูลโปรไฟล์และเปิดหน้าคัดกรองอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseQrScanner}
                aria-label="ปิดกล้องสแกน QR"
                className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Camera Viewfinder Box */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${
                    cameraStatus === 'active' ? 'opacity-100' : 'opacity-25'
                  }`}
                />

                {/* Scanning Reticle Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-teal-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(11,17,32,0.55)]">
                    <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-teal-300 rounded-tl-xl" />
                    <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-teal-300 rounded-tr-xl" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-teal-300 rounded-bl-xl" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-teal-300 rounded-br-xl" />
                    <div className="absolute inset-x-3 top-1/2 h-0.5 bg-teal-400 shadow-[0_0_12px_#2dd4bf] animate-pulse" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-white bg-slate-950/90 px-3 py-1 rounded-md border border-slate-700">
                    {cameraStatus === 'starting'
                      ? 'กำลังเปิดกล้องสมาร์ทโฟน...'
                      : cameraStatus === 'active'
                      ? 'กล้องทำงานอยู่ — วาง QR Code ให้อยู่ในกรอบเพื่อสแกนอัตโนมัติ'
                      : 'โหมดจำลองการสแกนภาคสนาม — เลือกบัตร QR ผู้สูงอายุด้านล่าง'}
                  </p>
                </div>

                {/* Retry Camera Button */}
                {cameraStatus === 'fallback' && (
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800/95 border border-slate-600 text-xs font-semibold text-teal-300 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>เปิดกล้องใหม่</span>
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/60 text-xs text-amber-200">
                  {cameraError}
                </div>
              )}

              {/* Quick Simulated QR Scan Cards for Field Testing & Instant Lookup */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-teal-300">
                    แตะบัตร QR Code ประจำตัวผู้สูงอายุเพื่อสแกนและดึงโปรไฟล์เข้าสู่หน้าคัดกรองทันที:
                  </p>
                  <span className="text-[11px] font-mono-num text-slate-300">
                    {elders.length} รหัสประจำตัว
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {elders.map((elder) => (
                    <button
                      key={elder.id}
                      type="button"
                      onClick={() => handleQrCodeDetected(elder.id, true)}
                      className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-400 hover:bg-slate-800/90 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 group-hover:border-teal-400 flex items-center justify-center shrink-0">
                          <QrCode className="w-5 h-5 text-teal-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-mono-num font-bold text-teal-300">
                            {elder.id}
                          </p>
                          <p className="text-xs font-bold text-white truncate">
                            {elder.name} ({elder.age} ปี)
                          </p>
                          <p className="text-[11px] text-slate-300 truncate">
                            {elder.village} · กลุ่ม {elder.riskProfile.matrixGroup} ({elder.riskProfile.frailtyRisk})
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-[11px] font-bold shrink-0 group-hover:bg-teal-400">
                        สแกนคัดกรอง →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual QR Code / ID Entry Fallback */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQrCodeDetected(manualQrInput, true);
                }}
                className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={manualQrInput}
                  onChange={(e) => setManualQrInput(e.target.value)}
                  placeholder="หรือพิมพ์รหัส QR / รหัสประจำตัวผู้สูงอายุ เช่น KORAT-ELD-001..."
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-600 rounded-xl bg-slate-950 text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400 font-mono-num"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 whitespace-nowrap cursor-pointer"
                >
                  ดึงข้อมูลและคัดกรองทันที
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VHV Voice Memo Recorder Modal (Browser Microphone API + Verbal Context Attachment) */}
      {isVoiceMemoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 text-slate-100 rounded-2xl border border-teal-500/50 shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isRecordingAudio
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-teal-500 text-slate-950'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    บันทึกเสียงเยี่ยมบ้านของ อสม. (VHV Voice Memo Recorder)
                  </h3>
                  <p className="text-xs text-slate-300">
                    ใช้ไมโครโฟนสมาร์ทโฟนอัดเสียงรายงานอาการและแนบบริบทเข้ากับบันทึกการติดตามเยี่ยมบ้าน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseVoiceMemoModal}
                aria-label="ปิดหน้าต่างบันทึกเสียง"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Target Follow-Up Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="voice-memo-followup-select"
                  className="block text-xs font-bold text-teal-300"
                >
                  1. เลือกรายการติดตามเยี่ยมบ้านที่ต้องการแนบเสียงบันทึก:
                </label>
                <select
                  id="voice-memo-followup-select"
                  value={selectedFollowUpId}
                  onChange={(e) => setSelectedFollowUpId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold border border-slate-600 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
                >
                  {followUps.map((fu) => (
                    <option key={fu.id} value={fu.id}>
                      {fu.elderName} ({fu.village} · กลุ่ม {fu.matrixGroup} · นัด {fu.dueDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Microphone Waveform Visualizer & Start/Stop Control Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isRecordingAudio
                          ? 'bg-rose-500 animate-ping'
                          : recordedAudioUrl
                          ? 'bg-emerald-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-white">
                      {isRecordingAudio
                        ? 'กำลังอัดเสียงผ่านไมโครโฟน (Recording...)'
                        : recordedAudioUrl
                        ? 'บันทึกเสียงพร้อมแนบเข้าใบบันทึกเยี่ยมบ้าน'
                        : 'พร้อมเริ่มอัดเสียงด้วยไมโครโฟน'}
                    </span>
                  </div>
                  <span className="font-mono-num text-lg font-extrabold text-teal-300">
                    {formatTimer(isRecordingAudio ? recordingSeconds : recordedDurationSec)}
                  </span>
                </div>

                {/* 16-Bar Live Audio Frequency Visualizer */}
                <div className="h-16 px-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-1.5">
                  {audioBars.map((barHeight, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-all duration-100 ${
                        isRecordingAudio
                          ? 'bg-rose-500'
                          : recordedAudioUrl
                          ? 'bg-teal-400'
                          : 'bg-slate-700'
                      }`}
                      style={{
                        height: `${isRecordingAudio || recordedAudioUrl ? barHeight : 18}%`,
                      }}
                    />
                  ))}
                </div>

                {/* Primary Start / Stop Microphone Button (48px+ touch target) */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {!isRecordingAudio ? (
                    <button
                      type="button"
                      onClick={startVoiceMemoRecording}
                      className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>
                        {recordedAudioUrl
                          ? 'อัดเสียงใหม่ด้วยไมโครโฟน (Re-record)'
                          : 'เริ่มอัดเสียงด้วยไมโครโฟน (Start Recording)'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVoiceMemoRecording}
                      className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                    >
                      <MicOff className="w-4 h-4" />
                      <span className="font-mono-num">
                        หยุดอัดเสียง ({formatTimer(recordingSeconds)})
                      </span>
                    </button>
                  )}

                  {recordedAudioUrl && !isRecordingAudio && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecordedAudioUrl(null);
                        setRecordedDurationSec(0);
                      }}
                      className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-rose-300 hover:border-rose-500/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>ลบเสียง</span>
                    </button>
                  )}
                </div>

                {micStatusMessage && (
                  <p className="text-[11px] text-teal-300 leading-relaxed">
                    {micStatusMessage}
                  </p>
                )}

                {/* Audio Player Preview when recorded */}
                {recordedAudioUrl && !isRecordingAudio && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">
                      ฟังเสียงที่บันทึกไว้ ({recordedDurationSec} วินาที):
                    </span>
                    <audio
                      controls
                      src={recordedAudioUrl}
                      className="w-full h-10 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Verbal Context Note & Quick Field Observation Presets */}
              <div className="space-y-2">
                <label
                  htmlFor="voice-memo-transcript"
                  className="block text-xs font-bold text-teal-300"
                >
                  2. บริบทคำพูด/รายละเอียดอาการจากการเยี่ยมบ้าน (แนบต่อท้ายบันทึกการติดตาม):
                </label>
                <textarea
                  id="voice-memo-transcript"
                  rows={3}
                  value={verbalTranscript}
                  onChange={(e) => setVerbalTranscript(e.target.value)}
                  placeholder="พูดผ่านไมโครโฟนหรือพิมพ์สรุปบริบทจากการเยี่ยมบ้าน เช่น อาการเวียนศีรษะ การกินยา อาหารที่รับประทาน..."
                  className="w-full p-3 text-xs border border-slate-600 rounded-xl bg-slate-950 text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400 leading-relaxed"
                />

                {/* Quick Field Verbal Context Chips */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] text-slate-300 font-semibold">
                    แตะเพื่อเพิ่มบริบทคำพูดที่พบบ่อยภาคสนาม:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'ผู้สูงอายุเวียนศีรษะช่วงเช้า ลืมทานยาลดความดัน 2 วัน แนะนำจัดกล่องยา 7 วันแล้ว',
                      'วัดความดันซ้ำหลังนั่งพัก 15 นาที ได้ 146/88 mmHg แนะนำลดน้ำปลาและอาหารเค็ม',
                      'อยู่ลำพังช่วงกลางวัน ประสานลูกสาวและเพื่อนบ้านแวะดูแลมื้อเที่ยงทุกวัน',
                      'ฝึกเดินทรงตัวตามแผน 4 สัปดาห์ได้ดีขึ้น ไม่พบอาการหน้ามืดหรือหกล้ม',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setVerbalTranscript(preset)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-teal-400 text-[11px] text-slate-200 hover:text-white text-left transition-colors cursor-pointer"
                      >
                        + {preset.slice(0, 44)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save & Attach Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseVoiceMemoModal}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndAttachVoiceMemo}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-xs font-extrabold hover:bg-teal-400 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>แนบเสียงบันทึกเข้ากับบันทึกการติดตามเยี่ยมบ้าน</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
