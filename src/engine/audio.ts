/**
 * Tiny square-wave synth. No assets, no libraries: a few oscillators scheduled
 * per event give the game its arcade voice.
 *
 * Two independent controls:
 *   - enabled  : whether sound effects play at all (Options screen)
 *   - volume   : the global 0..1 level shared with the music (corner button / M)
 */
export type SfxName =
  | 'munch'
  | 'wrong'
  | 'levelUp'
  | 'death'
  | 'menu'
  | 'select'
  | 'spawn'
  | 'cutscene'
  | 'gameOver';

interface Note {
  freq: number;
  dur: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

const RECIPES: Record<SfxName, Note[]> = {
  munch: [{ freq: 660, dur: 0.06, type: 'square', gain: 0.12 }],
  wrong: [
    { freq: 200, dur: 0.12, type: 'sawtooth', gain: 0.14 },
    { freq: 120, dur: 0.18, delay: 0.1, type: 'sawtooth', gain: 0.14 },
  ],
  levelUp: [
    { freq: 523, dur: 0.09, type: 'square' },
    { freq: 659, dur: 0.09, delay: 0.09, type: 'square' },
    { freq: 784, dur: 0.14, delay: 0.18, type: 'square' },
  ],
  death: [{ freq: 320, dur: 0.3, type: 'triangle', gain: 0.2, slideTo: 70 }],
  gameOver: [
    { freq: 440, dur: 0.16, type: 'square' },
    { freq: 330, dur: 0.16, delay: 0.16, type: 'square' },
    { freq: 220, dur: 0.3, delay: 0.32, type: 'square' },
  ],
  menu: [{ freq: 880, dur: 0.03, type: 'square', gain: 0.06 }],
  select: [
    { freq: 587, dur: 0.05, type: 'square', gain: 0.1 },
    { freq: 880, dur: 0.07, delay: 0.05, type: 'square', gain: 0.1 },
  ],
  spawn: [{ freq: 140, dur: 0.16, type: 'sawtooth', gain: 0.12, slideTo: 90 }],
  cutscene: [
    { freq: 392, dur: 0.1, type: 'triangle' },
    { freq: 523, dur: 0.1, delay: 0.1, type: 'triangle' },
    { freq: 659, dur: 0.1, delay: 0.2, type: 'triangle' },
    { freq: 784, dur: 0.22, delay: 0.3, type: 'triangle' },
  ],
};

/** SFX sit a bit under the music so neither fights the other. */
const SFX_GAIN = 0.5;

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 1;

  /** Sound effects on/off (Options). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Global volume 0..1, shared with the music. */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = SFX_GAIN * this.volume;
  }

  get currentVolume(): number {
    return this.volume;
  }

  /** Lazily create the context: browsers require a user gesture first. */
  private ensure(): AudioContext | null {
    if (!this.enabled || this.volume <= 0) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = SFX_GAIN * this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    for (const note of RECIPES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + (note.delay ?? 0);
      const end = start + note.dur;
      osc.type = note.type ?? 'square';
      osc.frequency.setValueAtTime(note.freq, start);
      if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, end);
      const peak = note.gain ?? 0.1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}
