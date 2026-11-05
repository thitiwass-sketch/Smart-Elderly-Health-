// Web Audio Synthesizer & Web Notification Utilities for Smart Medication Alarm
// Senior-friendly audio profiles: Soft rise-time, warm harmonics, no harsh square waves

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a gentle, melodic 3-tone chime (E5 -> G#5 -> B5)
 * Pleasant, highly audible for presbycusis (age-related hearing loss) without startling.
 */
export function playMedicationAlarmChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.18);

    // Warm envelope
    gain.gain.setValueAtTime(0.001, now + idx * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.28, now + idx * 0.18 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.18);
    osc.stop(now + idx * 0.18 + 0.6);
  });
}

/**
 * Plays a bright, positive confirmation tone when the user marks "Confirm Taken"
 */
export function playConfirmationSuccessTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 1046.5]; // C5 -> E5 -> C6

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);

    gain.gain.setValueAtTime(0.001, now + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.12 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.45);
  });
}

/**
 * Checks or requests Browser Notification permission
 */
export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

/**
 * Dispatches a native or simulated Push Notification
 */
export function triggerBrowserPushNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    try {
      const notificationConfig = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      } as NotificationOptions & { vibrate?: number[] };
      new Notification(title, notificationConfig);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
