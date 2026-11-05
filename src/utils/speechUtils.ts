// Multimodal Zero-UI / Voice Read-Aloud Utility (Thai Language TTS for Elderly & VHV Accessibility)

export function speakThaiText(
  text: string,
  onEnd?: () => void,
  onError?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 0.92; // Slightly slower, clearer cadence for elderly listeners
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(
      (v) => v.lang.toLowerCase().includes('th') || v.name.toLowerCase().includes('thai')
    );
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onError) onError();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    if (onError) onError();
    return false;
  }
}

export function stopSpeakingThai(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
