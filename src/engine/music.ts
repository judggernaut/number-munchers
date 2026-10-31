/**
 * Background music.
 *
 * Tracks are plain files listed in `music/manifest.json` next to the build, so
 * the game works with or without music present (the deployed build ships none:
 * the bundled tracks are licensed stock and stay out of the repo).
 */

export interface MusicManifest {
  tracks?: Array<{ file?: string }>;
}

/** Extract playable file names from a manifest, ignoring junk. */
export function parseManifest(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const tracks = (raw as MusicManifest).tracks;
  if (!Array.isArray(tracks)) return [];
  const files: string[] = [];
  for (const entry of tracks) {
    if (!entry || typeof entry.file !== 'string') continue;
    const file = entry.file.trim();
    // Only plain relative file names; never paths or URLs from the manifest.
    if (!file || file.includes('/') || file.includes('\\') || file.includes('..')) continue;
    files.push(file);
  }
  return files;
}

/** Shuffle indices 0..n-1 with an injectable RNG (tests pass a fixed one). */
export function shuffleOrder(n: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order;
}

export function nextCursor(cursor: number, length: number): number {
  if (length <= 0) return 0;
  return (cursor + 1) % length;
}

export class Music {
  private tracks: string[] = [];
  private order: number[] = [];
  private cursor = 0;
  private element: HTMLAudioElement | null = null;
  private enabled = true;
  private started = false;
  private failures = 0;
  private volumeScale = 1;
  readonly volume: number;

  constructor(volume = 0.08) {
    this.volume = volume;
  }

  /** Global 0..1 volume level; scales the low base music volume. */
  setVolumeScale(scale: number): void {
    this.volumeScale = Math.max(0, Math.min(1, scale));
    if (this.element) this.element.volume = this.volume * this.volumeScale;
  }

  get trackCount(): number {
    return this.tracks.length;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isPlaying(): boolean {
    return Boolean(this.element && !this.element.paused);
  }

  /** Load the playlist. Resolves with the number of tracks found. */
  async load(base = './music/'): Promise<number> {
    try {
      const response = await fetch(`${base}manifest.json`, { cache: 'no-store' });
      if (!response.ok) return 0;
      const files = parseManifest(await response.json());
      this.tracks = files.map((file) => `${base}${file}`);
      this.order = shuffleOrder(this.tracks.length);
      return this.tracks.length;
    } catch {
      // No music folder (or offline): the game just stays silent.
      return 0;
    }
  }

  /** Call from a user-gesture handler so autoplay policies allow playback. */
  start(): void {
    this.started = true;
    if (this.enabled) this.playCurrent();
  }

  /**
   * Nudge playback back to life. Called on every user gesture and on level
   * changes so a blocked/ended track never leaves the game silent.
   */
  resumeIfNeeded(): void {
    if (!this.enabled || !this.started) return;
    if (this.element && !this.element.paused) return;
    this.playCurrent();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.element?.pause();
    else if (this.started) this.playCurrent();
  }

  stop(): void {
    this.element?.pause();
  }

  private playCurrent(): void {
    if (this.tracks.length === 0) return;
    const track = this.tracks[this.order[this.cursor] ?? 0];
    if (!track) return;

    if (!this.element) {
      this.element = new Audio();
      this.element.volume = this.volume * this.volumeScale;
      this.element.addEventListener('ended', () => this.advance());
      this.element.addEventListener('error', () => {
        this.failures += 1;
        // Give up on a broken playlist instead of spinning forever.
        if (this.failures < this.tracks.length) this.advance();
      });
    }
    if (!this.element.src.endsWith(track)) this.element.src = track;
    void this.element.play().catch(() => {
      // Autoplay refused; the next user gesture retries.
    });
  }

  private advance(): void {
    this.cursor = nextCursor(this.cursor, this.order.length);
    this.playCurrent();
  }
}
