/**
 * BICA Sound Service
 * Programmatic audio synthesis using Web Audio API. 
 * Provides "Premium" chime sounds for notification and interactions.
 */

class SoundService {
  private audioCtx: AudioContext | null = null;

  private initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if suspended (required by browser auto-play policies)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private createOscillator(freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioCtx) return null;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    return osc;
  }

  /**
   * Elegant "Ding" for new requests/registrations
   */
  playNotification() {
    try {
      this.initContext();
      const now = this.audioCtx!.currentTime;
      const osc = this.createOscillator(880, now, 0.5); // A5
      if (osc) {
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  /**
   * Ascending arpeggio for successful actions (Accept/Payment)
   */
  playSuccess() {
    try {
      this.initContext();
      const now = this.audioCtx!.currentTime;
      // Arpeggio: C5 -> E5 -> G5
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const start = now + (i * 0.1);
        const osc = this.createOscillator(freq, start, 0.4);
        if (osc) {
          osc.start(start);
          osc.stop(start + 0.4);
        }
      });
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  /**
   * Attention-grabbing double tone for cancellations or arrivals
   */
  playAlert() {
    try {
      this.initContext();
      const now = this.audioCtx!.currentTime;
      // G5 -> E5
      [783.99, 659.25].forEach((freq, i) => {
        const start = now + (i * 0.15);
        const osc = this.createOscillator(freq, start, 0.4, 'triangle');
        if (osc) {
          osc.start(start);
          osc.stop(start + 0.4);
        }
      });
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }
}

export const sounds = new SoundService();
