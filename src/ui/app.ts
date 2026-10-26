import { buildCurriculum, practiceCurriculum, shuffleWithinGrades, topicForLevel } from '../content/curriculum';
import { ALL_TOPICS, BANDS, FAMILY_COLORS, FAMILY_LABELS, findTopic, orderedTopics } from '../content/registry';
import { createRng, randomSeed } from '../content/rng';
import { BAND_LABELS, type Band, type Topic } from '../content/types';
import { Audio } from '../engine/audio';
import type { Action, Input } from '../engine/input';
import { Screen, VIEW_H, VIEW_W } from '../engine/screen';
import type { Sprites } from '../engine/sprites';
import { DIFFICULTY_LABELS, type DifficultyId } from '../game/rules';
import { GameSession, type SessionEvent } from '../game/session';

const C = {
  bg: '#000574',
  bgDeep: '#00002e',
  panel: '#00004d',
  ink: '#ffffff',
  dim: '#5f7fd0',
  dimmer: '#2a3f8f',
  accent: '#ff4cf7',
  cyan: '#5ad2ff',
  green: '#7dffb0',
  yellow: '#ffd85a',
  red: '#ff5a5a',
  orange: '#ffb347',
};

const STORAGE = {
  settings: 'nm.v2.settings',
  scores: 'nm.v2.scores',
} as const;

type ScreenId = 'menu' | 'topics' | 'options' | 'help' | 'scores' | 'play';

interface Settings {
  band: Band;
  difficulty: DifficultyId;
  muted: boolean;
}

interface ScoreEntry {
  score: number;
  level: number;
  topic: string;
  band: Band;
  at: string;
}

interface MenuItem {
  label: string;
  hint: string;
  action: () => void;
}

const DEFAULT_SETTINGS: Settings = { band: 'elementary', difficulty: 'normal', muted: false };

const DIFFICULTIES: DifficultyId[] = ['chill', 'normal', 'fast'];

export class App {
  private readonly screen: Screen;
  private readonly input: Input;
  private readonly audio: Audio;
  private readonly sprites: Sprites;

  private screenId: ScreenId = 'menu';
  private settings: Settings = DEFAULT_SETTINGS;
  private scores: ScoreEntry[] = [];

  private menuIndex = 0;
  private menuItems: MenuItem[] = [];
  private optionsIndex = 0;

  private bandIndex = 0;
  private topicIndex = 0;
  private topicScroll = 0;

  private session: GameSession | null = null;
  private paused = false;
  private pauseIndex = 0;

  private stars: Array<{ x: number; y: number; s: number; c: string }> = [];
  private startedAt = performance.now();
  private lastFrame = performance.now();

  constructor(screen: Screen, input: Input, audio: Audio, sprites: Sprites) {
    this.screen = screen;
    this.input = input;
    this.audio = audio;
    this.sprites = sprites;
    this.loadSettings();
    this.buildStars();
    this.buildMenu();
    this.openDeepLink();
    if (import.meta.env.DEV) {
      // Dev-only inspection hook for automated play-testing.
      (window as unknown as { __nm?: unknown }).__nm = this;
    }
  }

  /** Exposed for the dev hook and tests; do not use from game code. */
  debugState(): unknown {
    return {
      screen: this.screenId,
      paused: this.paused,
      status: this.session?.status,
      score: this.session?.score,
      lives: this.session?.lives,
      level: this.session?.level,
      cells: this.session?.cells.map((c) => (c.eaten ? '' : c.text)),
      muncher: this.session?.muncherCell,
      troggles: this.session?.troggles.map((t) => t.species),
    };
  }

  /**
   * `?topic=<id>` opens that topic immediately; handy for sharing a board or
   * jumping straight into a lesson. Unknown ids fall back to the menu.
   */
  private openDeepLink(): void {
    if (typeof location === 'undefined') return;
    const topicId = new URLSearchParams(location.search).get('topic');
    if (!topicId) return;
    const topic = findTopic(topicId);
    if (!topic) return;
    this.settings.band = topic.band;
    this.startRun('practice', topic);
  }

  start(): void {
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const actions = this.input.drain();
    const pointer = this.input.takePointer();
    this.update(dt, actions, pointer);
    this.draw(now);
    requestAnimationFrame(this.frame);
  };

  // ---------------------------------------------------------------- state

  private buildStars(): void {
    const rng = createRng(1337);
    this.stars = Array.from({ length: 70 }, () => ({
      x: rng.int(0, VIEW_W - 2),
      y: rng.int(0, VIEW_H - 2),
      s: rng.chance(0.15) ? 2 : 1,
      c: rng.pick(['#1b2fb5', '#3450ff', '#5f7fd0', '#ffffff']),
    }));
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE.settings);
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
      const scores = localStorage.getItem(STORAGE.scores);
      if (scores) this.scores = JSON.parse(scores) as ScoreEntry[];
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
      this.scores = [];
    }
    this.audio.setMuted(this.settings.muted);
    this.bandIndex = Math.max(0, BANDS.indexOf(this.settings.band));
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE.settings, JSON.stringify(this.settings));
    } catch {
      /* storage might be unavailable in private mode */
    }
  }

  private saveScores(): void {
    try {
      localStorage.setItem(STORAGE.scores, JSON.stringify(this.scores.slice(0, 10)));
    } catch {
      /* ignore */
    }
  }

  private buildMenu(): void {
    this.menuItems = [
      { label: 'PLAY', hint: 'Start a curriculum run', action: () => this.startRun('run') },
      { label: 'CHOOSE TOPIC', hint: 'Practice one skill', action: () => this.openTopics() },
      { label: 'HIGH SCORES', hint: 'Best runs on this machine', action: () => this.goto('scores') },
      { label: 'HOW TO PLAY', hint: 'Controls and scoring', action: () => this.goto('help') },
      { label: 'OPTIONS', hint: 'Difficulty, band, sound', action: () => this.goto('options') },
    ];
  }

  private quitToMenu(): void {
    this.screenId = 'menu';
    this.session = null;
    this.paused = false;
    this.pauseIndex = 0;
    this.audio.play('menu');
    this.announce('Returned to the main menu.');
  }

  private openTopics(): void {
    this.goto('topics');
  }

  private goto(id: ScreenId): void {
    this.screenId = id;
    this.audio.play('select');
    if (id === 'topics') this.resetTopicCursor();
  }

  private resetTopicCursor(): void {
    this.bandIndex = Math.max(0, BANDS.indexOf(this.settings.band));
    this.topicIndex = 0;
    this.topicScroll = 0;
  }

  private startRun(mode: 'run' | 'practice', topic?: Topic): void {
    const rng = createRng(randomSeed());
    const base = buildCurriculum(this.settings.band);
    const curriculum =
      mode === 'practice' && topic
        ? practiceCurriculum(topic)
        : shuffleWithinGrades(base, rng);
    const pool = curriculum.length > 0 ? curriculum : [topic ?? ALL_TOPICS[0]!];

    this.session = new GameSession({
      sprites: this.sprites,
      rng,
      difficulty: this.settings.difficulty,
      onEvent: (event) => this.handleSessionEvent(event),
      roundFor: (level) => {
        const current = topicForLevel(pool, level);
        return { topic: current, round: current.round(rng, level) };
      },
    });
    this.screenId = 'play';
    this.paused = false;
    this.pauseIndex = 0;
    this.announce(`${this.session.topic.name}. ${this.session.round.instruction}`);
  }

  private handleSessionEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'munch':
        this.audio.play('munch');
        break;
      case 'wrong':
        this.audio.play('wrong');
        break;
      case 'death':
        this.audio.play('death');
        navigator.vibrate?.(120);
        break;
      case 'spawn':
        this.audio.play('spawn');
        break;
      case 'levelClear':
        this.audio.play('levelUp');
        break;
      case 'interlude':
        this.audio.play('cutscene');
        break;
      case 'gameOver':
        this.audio.play('gameOver');
        this.recordScore(event.score, event.level);
        break;
      default:
        break;
    }
    if (this.session) {
      this.announce(`${this.session.round.instruction} Score ${this.session.score}. Lives ${this.session.lives}.`);
    }
  }

  private recordScore(score: number, level: number): void {
    if (score <= 0) return;
    const topic = this.session?.topic.name ?? 'Run';
    this.scores.push({
      score,
      level,
      topic,
      band: this.settings.band,
      at: new Date().toISOString().slice(0, 10),
    });
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 10);
    this.saveScores();
  }

  private announce(text: string): void {
    const node = document.getElementById('a11y-status');
    if (node) node.textContent = text;
  }

  // ---------------------------------------------------------------- update

  private update(
    dt: number,
    actions: Action[],
    pointer: { x: number; y: number; cell: { col: number; row: number } | null } | null,
  ): void {
    for (const action of actions) {
      if (action === 'mute') {
        this.settings.muted = this.audio.toggle();
        this.saveSettings();
      }
    }

    if (this.screenId === 'play' && this.session) {
      if (this.paused) {
        this.updatePause(actions);
        return;
      }
      // Esc always leaves a game: it pauses while playing, and backs all the
      // way out from a result overlay.
      if (actions.includes('cancel')) {
        if (this.session.status === 'play') {
          this.paused = true;
          this.pauseIndex = 0;
        } else {
          this.quitToMenu();
        }
        return;
      }
      if (actions.includes('pause')) {
        this.paused = true;
        this.pauseIndex = 0;
        return;
      }
      const heldDir = this.heldDirection();
      if (pointer?.cell) this.session.pointTo(pointer.cell);
      this.session.update(dt, actions, heldDir);
      if (this.session.status === 'gameover') {
        const leave = actions.some((a) => a === 'confirm' || a === 'munch');
        if (leave) this.quitToMenu();
      }
      return;
    }

    switch (this.screenId) {
      case 'menu':
        this.updateMenu(actions, pointer);
        break;
      case 'topics':
        this.updateTopics(actions, pointer);
        break;
      case 'options':
        this.updateOptions(actions, pointer);
        break;
      case 'help':
      case 'scores':
        if (actions.some((a) => a === 'cancel' || a === 'confirm')) this.screenId = 'menu';
        break;
      default:
        break;
    }
  }

  private heldDirection(): { dc: number; dr: number } | null {
    if (this.input.isHeld('up')) return { dc: 0, dr: -1 };
    if (this.input.isHeld('down')) return { dc: 0, dr: 1 };
    if (this.input.isHeld('left')) return { dc: -1, dr: 0 };
    if (this.input.isHeld('right')) return { dc: 1, dr: 0 };
    return null;
  }

  private updatePause(actions: Action[]): void {
    for (const action of actions) {
      if (action === 'up' || action === 'down') {
        this.pauseIndex = this.pauseIndex === 0 ? 1 : 0;
        this.audio.play('menu');
      } else if (action === 'confirm' || action === 'munch') {
        if (this.pauseIndex === 0) {
          this.paused = false;
        } else {
          this.quitToMenu();
          return;
        }
      } else if (action === 'cancel') {
        // Esc backs all the way out to the menu; Enter resumes.
        this.quitToMenu();
        return;
      } else if (action === 'pause') {
        this.paused = false;
      }
    }
  }

  private updateMenu(
    actions: Action[],
    pointer: { x: number; y: number } | null,
  ): void {
    if (pointer) {
      const hit = this.menuRowAt(pointer.y);
      if (hit >= 0) this.menuIndex = hit;
      this.activate(this.menuItems[this.menuIndex]);
      return;
    }
    for (const action of actions) {
      if (action === 'up' || action === 'left') {
        this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.audio.play('menu');
      } else if (action === 'down' || action === 'right') {
        this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
        this.audio.play('menu');
      } else if (action === 'confirm' || action === 'munch') {
        this.activate(this.menuItems[this.menuIndex]);
      }
    }
  }

  private activate(item: MenuItem | undefined): void {
    if (!item) return;
    this.audio.play('select');
    item.action();
  }

  private menuRowAt(y: number): number {
    const start = 190;
    const rowH = 30;
    for (let i = 0; i < this.menuItems.length; i++) {
      const top = start + i * rowH;
      if (y >= top && y <= top + rowH) return i;
    }
    return -1;
  }

  private updateTopics(
    actions: Action[],
    pointer: { x: number; y: number } | null,
  ): void {
    const band = BANDS[this.bandIndex]!;
    const list = orderedTopics(band);
    if (pointer) {
      const row = Math.floor((pointer.y - 108) / 30);
      if (row >= 0 && row < list.length) {
        this.topicIndex = this.topicScroll + row;
        this.startSelectedTopic();
      }
      return;
    }
    for (const action of actions) {
      if (action === 'up') {
        this.topicIndex = Math.max(0, this.topicIndex - 1);
        this.audio.play('menu');
      } else if (action === 'down') {
        this.topicIndex = Math.min(list.length - 1, this.topicIndex + 1);
        this.audio.play('menu');
      } else if (action === 'left' || action === 'right') {
        const delta = action === 'left' ? -1 : 1;
        this.bandIndex = (this.bandIndex + delta + BANDS.length) % BANDS.length;
        this.settings.band = BANDS[this.bandIndex]!;
        this.saveSettings();
        this.topicIndex = 0;
        this.topicScroll = 0;
        this.audio.play('menu');
      } else if (action === 'confirm' || action === 'munch') {
        this.startSelectedTopic();
      } else if (action === 'cancel') {
        this.screenId = 'menu';
      }
    }
    const visible = 6;
    if (this.topicIndex < this.topicScroll) this.topicScroll = this.topicIndex;
    if (this.topicIndex >= this.topicScroll + visible) this.topicScroll = this.topicIndex - visible + 1;
  }

  private startSelectedTopic(): void {
    const list = orderedTopics(BANDS[this.bandIndex]!);
    const topic = list[this.topicIndex];
    if (topic) this.startRun('practice', topic);
  }

  private updateOptions(
    actions: Action[],
    pointer: { x: number; y: number } | null,
  ): void {
    const rows = 5;
    if (pointer) {
      const row = Math.floor((pointer.y - 120) / 40);
      if (row >= 0 && row < rows) {
        this.optionsIndex = row;
        this.activateOption();
      }
      return;
    }
    for (const action of actions) {
      if (action === 'up') {
        this.optionsIndex = (this.optionsIndex - 1 + rows) % rows;
        this.audio.play('menu');
      } else if (action === 'down') {
        this.optionsIndex = (this.optionsIndex + 1) % rows;
        this.audio.play('menu');
      } else if (action === 'left' || action === 'right') {
        this.cycleOption(action === 'left' ? -1 : 1);
      } else if (action === 'confirm' || action === 'munch') {
        this.activateOption();
      } else if (action === 'cancel') {
        this.screenId = 'menu';
      }
    }
  }

  private cycleOption(delta: number): void {
    switch (this.optionsIndex) {
      case 0: {
        const i = DIFFICULTIES.indexOf(this.settings.difficulty);
        this.settings.difficulty = DIFFICULTIES[(i + delta + DIFFICULTIES.length) % DIFFICULTIES.length]!;
        break;
      }
      case 1: {
        this.bandIndex = (this.bandIndex + delta + BANDS.length) % BANDS.length;
        this.settings.band = BANDS[this.bandIndex]!;
        break;
      }
      default:
        break;
    }
    this.saveSettings();
    this.audio.play('menu');
  }

  private activateOption(): void {
    switch (this.optionsIndex) {
      case 0:
      case 1:
        this.cycleOption(1);
        break;
      case 2:
        this.settings.muted = this.audio.toggle();
        this.saveSettings();
        this.audio.play('select');
        break;
      case 3:
        this.scores = [];
        this.saveScores();
        this.audio.play('wrong');
        break;
      case 4:
        this.screenId = 'menu';
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ draw

  private draw(now: number): void {
    if (this.screenId === 'play' && this.session) {
      // The session owns the frame; the pause panel draws over the finished board.
      this.session.draw(this.screen, now);
      if (this.paused) this.drawPause(now);
      return;
    }
    const t = now - this.startedAt;
    this.screen.begin(C.bg);
    this.screen.stars(this.stars, t);
    switch (this.screenId) {
      case 'menu':
        this.drawMenu(now);
        break;
      case 'topics':
        this.drawTopics(now);
        break;
      case 'options':
        this.drawOptions(now);
        break;
      case 'help':
        this.drawHelp(now);
        break;
      case 'scores':
        this.drawScores(now);
        break;
      default:
        break;
    }
    this.screen.end();
  }

  private drawLogo(y: number, now: number): void {
    const bob = Math.sin(now / 600) * 3;
    this.screen.gradientText('NUMBER', 320, y + bob, [
      [0, '#ffd85a'],
      [0.45, '#ff9de2'],
      [1, '#5ad2ff'],
    ], { size: 54, align: 'center' });
    this.screen.gradientText('MUNCHERS', 320, y + 58 + bob, [
      [0, '#7dffb0'],
      [0.5, '#5ad2ff'],
      [1, '#ff4cf7'],
    ], { size: 54, align: 'center' });
    this.screen.sprite(this.sprites.muncher, 74, y + 52 + bob, 56);
    this.screen.sprite(this.sprites.troggles.smarty, 570, y + 52 - bob, 52);
  }

  private drawMenu(now: number): void {
    this.drawLogo(28, now);
    this.screen.text('A MODERN REMAKE OF THE MECC CLASSIC', 320, 148, {
      size: 9,
      color: C.dim,
      align: 'center',
    });

    const start = 190;
    const rowH = 30;
    this.menuItems.forEach((item, index) => {
      const selected = index === this.menuIndex;
      const y = start + index * rowH;
      if (selected) {
        this.screen.rect(186, y - 3, 268, 28, '#0000a8', 0.85);
        this.screen.stroke(186, y - 3, 268, 28, C.accent, 1);
        this.screen.text('>', 196, y + 3, { size: 15, color: C.yellow });
        this.screen.text('<', 438, y + 3, { size: 15, color: C.yellow });
      }
      this.screen.text(item.label, 320, y + 2, {
        size: 18,
        align: 'center',
        color: selected ? C.ink : C.dim,
      });
    });

    const current = this.menuItems[this.menuIndex];
    this.screen.text(current?.hint ?? '', 320, 358, { size: 10, color: C.green, align: 'center' });

    const best = this.scores[0];
    this.screen.text(
      `BAND ${BAND_LABELS[this.settings.band]}   ${DIFFICULTY_LABELS[this.settings.difficulty].toUpperCase()}   SOUND ${
        this.audio.isMuted ? 'OFF' : 'ON'
      }${best ? `   BEST ${best.score}` : ''}`,
      320,
      378,
      { size: 9, color: C.dim, align: 'center' },
    );
    this.screen.text('ARROWS TO MOVE  ·  ENTER TO SELECT  ·  M TO MUTE', 320, 12, {
      size: 8,
      color: C.dimmer,
      align: 'center',
    });
  }

  private drawTopics(now: number): void {
    void now;
    this.screen.text('CHOOSE A TOPIC', 320, 22, { size: 20, align: 'center', color: C.ink });
    this.screen.text('LEFT / RIGHT SWITCHES BAND  ·  ESC GOES BACK', 320, 50, {
      size: 8,
      color: C.dim,
      align: 'center',
    });

    BANDS.forEach((band, index) => {
      const active = index === this.bandIndex;
      const x = 130 + index * 130;
      this.screen.panel(x, 66, 120, 26, {
        fill: active ? '#0000a8' : C.panel,
        border: active ? C.accent : C.dimmer,
      });
      this.screen.text(BAND_LABELS[band].toUpperCase(), x + 60, 74, {
        size: 10,
        align: 'center',
        color: active ? C.ink : C.dim,
      });
    });

    const list = orderedTopics(BANDS[this.bandIndex]!);
    const visible = 6;
    for (let i = 0; i < visible; i++) {
      const index = this.topicScroll + i;
      const topic = list[index];
      if (!topic) break;
      const selected = index === this.topicIndex;
      const y = 108 + i * 30;
      if (selected) {
        this.screen.rect(76, y, 488, 26, '#0000a8', 0.85);
        this.screen.stroke(76, y, 488, 26, C.accent, 1);
      }
      this.screen.rect(86, y + 8, 6, 10, FAMILY_COLORS[topic.family]);
      this.screen.text(topic.name, 102, y + 6, {
        size: 13,
        color: selected ? C.ink : '#b9c4f0',
      });
      this.screen.text(FAMILY_LABELS[topic.family].toUpperCase(), 320, y + 8, {
        size: 8,
        color: C.dim,
      });
      this.screen.text(topic.grades, 552, y + 7, { size: 9, color: C.dim, align: 'right' });
    }

    const selectedTopic = list[this.topicIndex];
    this.screen.panel(76, 296, 488, 62, { fill: C.panel, border: C.dimmer, inner: '#1b2fb5' });
    if (selectedTopic) {
      this.screen.text(selectedTopic.blurb, 320, 306, {
        size: 10,
        color: C.green,
        align: 'center',
      });
      this.screen.text(selectedTopic.name.toUpperCase(), 320, 330, {
        size: 12,
        color: C.yellow,
        align: 'center',
      });
    }
    this.screen.text(`${this.topicIndex + 1} / ${list.length}`, 320, 370, {
      size: 10,
      color: C.dim,
      align: 'center',
    });
  }

  private drawOptions(now: number): void {
    void now;
    this.screen.text('OPTIONS', 320, 30, { size: 22, align: 'center', color: C.ink });

    const rows = [
      { label: 'DIFFICULTY', value: DIFFICULTY_LABELS[this.settings.difficulty].toUpperCase() },
      { label: 'GRADE BAND', value: BAND_LABELS[this.settings.band].toUpperCase() },
      { label: 'SOUND', value: this.audio.isMuted ? 'OFF' : 'ON' },
      { label: 'CLEAR HIGH SCORES', value: 'PRESS ENTER' },
      { label: 'BACK', value: '' },
    ];

    rows.forEach((row, index) => {
      const y = 120 + index * 40;
      const selected = index === this.optionsIndex;
      if (selected) {
        this.screen.rect(120, y - 6, 400, 30, '#0000a8', 0.85);
        this.screen.stroke(120, y - 6, 400, 30, C.accent, 1);
        this.screen.text('>', 130, y, { size: 14, color: C.yellow });
      }
      this.screen.text(row.label, 150, y, { size: 13, color: selected ? C.ink : C.dim });
      if (row.value) {
        this.screen.text(row.value, 508, y, { size: 12, color: selected ? C.green : C.dim, align: 'right' });
      }
    });

    this.screen.text('LEFT / RIGHT CHANGES A VALUE  ·  ESC GOES BACK', 320, 340, {
      size: 9,
      color: C.dim,
      align: 'center',
    });
  }

  private drawHelp(now: number): void {
    void now;
    this.screen.text('HOW TO PLAY', 320, 26, { size: 22, align: 'center', color: C.ink });
    this.screen.panel(60, 60, 520, 296, { fill: C.panel, border: C.dimmer, inner: '#1b2fb5' });

    const lines: Array<[string, string]> = [
      ['GOAL', 'Eat every correct tile shown in the header. Eat a wrong one and you lose a life.'],
      ['MOVE', 'Arrow keys or WASD. Hold a direction to keep moving. Tap or click a cell to walk there.'],
      ['MUNCH', 'SPACE, ENTER, or click the cell you are standing on.'],
      ['TROGGLES', 'Reggie wanders, Worker never turns, Smarty chases, Bashful flees, Helper meanders.'],
      ['SCORING', 'Each correct munch is 5 points. Clear the board to advance; every 4th level is an interlude.'],
      ['LIVES', 'You start with 3. A wrong munch or a Troggle costs one.'],
      ['PAUSE', 'ESC opens the pause menu. M toggles sound at any time.'],
    ];
    let y = 74;
    for (const [key, text] of lines) {
      this.screen.text(key, 76, y, { size: 10, color: C.yellow });
      this.wrap(text, 176, y, 388, 11, C.ink, 13);
      y += 40;
    }
    this.screen.text('PRESS ENTER OR ESC TO GO BACK', 320, 372, {
      size: 9,
      color: C.dim,
      align: 'center',
    });
  }

  private drawScores(now: number): void {
    void now;
    this.screen.text('HIGH SCORES', 320, 26, { size: 22, align: 'center', color: C.ink });
    this.screen.panel(80, 62, 480, 288, { fill: C.panel, border: C.dimmer, inner: '#1b2fb5' });

    if (this.scores.length === 0) {
      this.screen.text('NO RUNS YET. GO MUNCH SOMETHING.', 320, 190, {
        size: 12,
        color: C.dim,
        align: 'center',
      });
    } else {
      this.screen.text('RANK', 100, 74, { size: 9, color: C.dim });
      this.screen.text('SCORE', 190, 74, { size: 9, color: C.dim });
      this.screen.text('LVL', 280, 74, { size: 9, color: C.dim });
      this.screen.text('TOPIC', 340, 74, { size: 9, color: C.dim });
      this.screen.rect(96, 88, 448, 1, C.dimmer);
      this.scores.slice(0, 8).forEach((entry, index) => {
        const y = 98 + index * 28;
        this.screen.text(`${index + 1}`, 100, y, { size: 12, color: index === 0 ? C.yellow : C.ink });
        this.screen.text(`${entry.score}`, 190, y, { size: 12, color: index === 0 ? C.yellow : C.ink });
        this.screen.text(`${entry.level}`, 280, y, { size: 12, color: C.dim });
        this.screen.text(entry.topic.slice(0, 22), 340, y, { size: 11, color: C.cyan });
      });
    }
    this.screen.text(`TOPICS AVAILABLE: ${ALL_TOPICS.length}`, 320, 358, {
      size: 9,
      color: C.dim,
      align: 'center',
    });
    this.screen.text('ENTER OR ESC TO GO BACK', 320, 374, { size: 9, color: C.dim, align: 'center' });
  }

  private drawPause(now: number): void {
    void now;
    this.screen.rect(0, 0, VIEW_W, VIEW_H, '#000010', 0.55);
    this.screen.panel(200, 140, 240, 120, { fill: C.panel, border: C.accent, inner: '#3450ff' });
    this.screen.text('PAUSED', 320, 154, { size: 18, align: 'center', color: C.ink });
    const items = ['RESUME', 'QUIT TO MENU'];
    items.forEach((item, index) => {
      const selected = index === this.pauseIndex;
      this.screen.text(`${selected ? '> ' : '  '}${item}`, 320, 190 + index * 28, {
        size: 13,
        align: 'center',
        color: selected ? C.yellow : C.dim,
      });
    });
  }

  private wrap(text: string, x: number, y: number, maxWidth: number, size: number, color: string, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let offset = 0;
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (this.screen.measure(probe, size) > maxWidth && line) {
        this.screen.text(line, x, y + offset, { size, color });
        offset += lineHeight;
        line = word;
      } else {
        line = probe;
      }
    }
    if (line) this.screen.text(line, x, y + offset, { size, color });
  }
}
