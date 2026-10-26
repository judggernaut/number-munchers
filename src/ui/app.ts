import { buildCurriculum, practiceCurriculum, shuffleWithinGrades, topicForLevel } from '../content/curriculum';
import { ALL_TOPICS, BANDS, FAMILY_COLORS, FAMILY_LABELS, findTopic, orderedTopics } from '../content/registry';
import { createRng, randomSeed } from '../content/rng';
import { lessonFor } from '../content/lessons';
import { BAND_LABELS, type Band, type Topic } from '../content/types';
import { Audio } from '../engine/audio';
import type { Action, Input } from '../engine/input';
import { Screen, VIEW_H, VIEW_W } from '../engine/screen';
import type { Sprites } from '../engine/sprites';
import {
  DIFFICULTY_LABELS,
  RULESETS,
  rulesetFor,
  type DifficultyId,
  type RulesetId,
} from '../game/rules';
import { planLesson } from './lesson-view';
import { wrapToWidth } from './text-layout';
import { drawVisual } from '../engine/visuals';
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

type ScreenId = 'menu' | 'topics' | 'options' | 'help' | 'scores' | 'play' | 'lesson' | 'briefing';

interface Settings {
  band: Band;
  difficulty: DifficultyId;
  ruleset: RulesetId;
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

const DEFAULT_SETTINGS: Settings = {
  band: 'elementary',
  difficulty: 'normal',
  ruleset: 'modern',
  muted: false,
};

const DIFFICULTIES: DifficultyId[] = ['chill', 'normal', 'fast'];
const RULESET_IDS: RulesetId[] = ['modern', 'original'];

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
  private lessonTopic: Topic | null = null;
  private lessonFrom: 'play' | 'topics' | 'menu' | 'briefing' = 'menu';

  private stars: Array<{ x: number; y: number; s: number; c: string }> = [];
  private startedAt = performance.now();
  private lastActions: Action[] = [];
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
      (window as unknown as { __nmInterlude?: () => void }).__nmInterlude = () => this.session?.debugInterlude();
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
      tiles: this.session?.cells.map((c) => ({ text: c.text, correct: c.correct, eaten: c.eaten })),
      muncher: this.session?.muncherCell,
      troggles: this.session?.troggles.map((t) => t.species),
      message: this.session?.message,
      lastActions: this.lastActions,
      prompt: this.session?.prompt,
      heading: this.session?.round.heading,
      topic: this.session?.topic.id,
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
    this.lastActions = actions;
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

  private openLesson(topic: Topic, from: 'play' | 'topics' | 'menu' | 'briefing'): void {
    this.lessonTopic = topic;
    this.lessonFrom = from;
    this.screenId = 'lesson';
    this.paused = false;
    this.audio.play('select');
    this.announce(`Lesson: ${topic.name}. ${lessonFor(topic).summary}`);
  }

  private closeLesson(): void {
    if (this.lessonFrom === 'play' && this.session) {
      this.screenId = 'play';
      return;
    }
    if (this.lessonFrom === 'briefing' && this.session) {
      this.screenId = 'briefing';
      return;
    }
    this.screenId = this.lessonFrom === 'topics' ? 'topics' : 'menu';
    this.lessonTopic = null;
  }

  private updateBriefing(actions: Action[]): void {
    for (const action of actions) {
      if (action === 'confirm' || action === 'munch') {
        this.screenId = 'play';
        return;
      }
      if (action === 'learn' && this.session) {
        this.openLesson(this.session.topic, 'briefing');
        return;
      }
      if (action === 'cancel') {
        this.session = null;
        this.screenId = 'topics';
        return;
      }
    }
  }

  private updateLesson(actions: Action[]): void {
    for (const action of actions) {
      if (action === 'cancel') {
        this.closeLesson();
        return;
      }
      if (action === 'confirm' || action === 'munch') {
        const topic = this.lessonTopic;
        this.lessonTopic = null;
        if (topic) this.startRun('practice', topic);
        return;
      }
    }
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
      rules: rulesetFor(this.settings.ruleset),
      onEvent: (event) => this.handleSessionEvent(event),
      roundFor: (level) => {
        const current = topicForLevel(pool, level);
        return { topic: current, round: current.round(rng, level) };
      },
    });
    this.screenId = 'briefing';
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
      if (actions.includes('learn')) {
        this.openLesson(this.session.topic, 'play');
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
      case 'lesson':
        this.updateLesson(actions);
        return;
      case 'briefing':
        this.updateBriefing(actions);
        return;
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
      } else if (action === 'learn') {
        const topic = orderedTopics(BANDS[this.bandIndex]!)[this.topicIndex];
        if (topic) this.openLesson(topic, 'topics');
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
    const rows = 6;
    if (pointer) {
      const row = Math.floor((pointer.y - 110) / 36);
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
      case 2: {
        const index = RULESET_IDS.indexOf(this.settings.ruleset);
        this.settings.ruleset = RULESET_IDS[(index + delta + RULESET_IDS.length) % RULESET_IDS.length]!;
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
      case 2:
        this.cycleOption(1);
        break;
      case 3:
        this.settings.muted = this.audio.toggle();
        this.saveSettings();
        this.audio.play('select');
        break;
      case 4:
        this.scores = [];
        this.saveScores();
        this.audio.play('wrong');
        break;
      case 5:
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
      case 'lesson':
        this.drawLesson(now);
        break;
      case 'briefing':
        this.drawBriefing(now);
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
    this.screen.sprite(this.sprites.troggles.smarticus, 570, y + 52 - bob, 52);
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
      `BAND ${BAND_LABELS[this.settings.band]}   ${RULESETS[this.settings.ruleset].label.toUpperCase()}   ${
        DIFFICULTY_LABELS[this.settings.difficulty].toUpperCase()
      }   SOUND ${this.audio.isMuted ? 'OFF' : 'ON'}${best ? `   BEST ${best.score}` : ''}`,
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

    // Scroll affordances: chevrons plus a proportional scrollbar so it is
    // obvious the list continues past the six visible rows.
    const visibleRows = 6;
    const hasAbove = this.topicScroll > 0;
    const hasBelow = this.topicScroll + visibleRows < list.length;
    const trackX = 576;
    const trackTop = 108;
    const trackHeight = 168;
    this.screen.rect(trackX, trackTop, 3, trackHeight, '#101a3f');
    if (list.length > visibleRows) {
      const thumbHeight = Math.max(24, Math.round((visibleRows / list.length) * trackHeight));
      const maxScroll = list.length - visibleRows;
      const thumbTop = trackTop + Math.round((this.topicScroll / maxScroll) * (trackHeight - thumbHeight));
      this.screen.rect(trackX, thumbTop, 3, thumbHeight, '#5f7fd0');
    }
    if (hasAbove) this.chevron(trackX + 1, trackTop - 8, -1, C.yellow);
    if (hasBelow) this.chevron(trackX + 1, trackTop + trackHeight + 8, 1, C.yellow);

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
    this.screen.text(`${this.topicIndex + 1} / ${list.length}`, 320, 366, {
      size: 10,
      color: C.dim,
      align: 'center',
    });
    this.screen.text('ENTER PLAY  ·  L LEARN  ·  ESC BACK', 320, 384, {
      size: 8,
      color: C.dimmer,
      align: 'center',
    });
  }

  private drawOptions(now: number): void {
    void now;
    this.screen.text('OPTIONS', 320, 30, { size: 22, align: 'center', color: C.ink });

    const rows = [
      { label: 'DIFFICULTY', value: DIFFICULTY_LABELS[this.settings.difficulty].toUpperCase() },
      { label: 'GRADE BAND', value: BAND_LABELS[this.settings.band].toUpperCase() },
      { label: 'RULES', value: RULESETS[this.settings.ruleset].label.toUpperCase() },
      { label: 'SOUND', value: this.audio.isMuted ? 'OFF' : 'ON' },
      { label: 'CLEAR HIGH SCORES', value: 'PRESS ENTER' },
      { label: 'BACK', value: '' },
    ];

    rows.forEach((row, index) => {
      const y = 110 + index * 36;
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
      ['TROGGLES', 'Reggie walks straight, Worker re-rolls tiles, Smarty chases, Bashful flees, Helper erases.'],
      ['SCORING', 'Points per munch rise with the level. Clear the board to advance; interludes show a mini-scene.'],
      ['RULES', 'MODERN is tuned for today. CLASSIC uses the 1990 values: slow Troggles, four lives, 10,000-point extra lives.'],
      ['LIVES', 'You start with 3. A wrong munch or a Troggle costs one.'],
      ['PAUSE', 'ESC pauses. ESC again, from the pause menu, returns to the main menu. M toggles sound.'],
      ['LEARN', 'Got one wrong? Press L for a lesson on that topic, then come back and try again.'],
    ];
    let y = 70;
    const measure = (value: string, size: number): number => this.screen.measure(value, size);
    for (const [key, text] of lines) {
      this.screen.text(key, 76, y, { size: 10, color: C.yellow });
      const wrapped = wrapToWidth(text, 11, 372, measure);
      wrapped.forEach((line, index) => {
        this.screen.text(line, 176, y + index * 12, { size: 11, color: C.ink });
      });
      y += Math.max(30, wrapped.length * 12 + 12);
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

  /**
   * Pre-game briefing: the goal, scoring and controls, with L for the lesson
   * and ENTER to drop straight in.
   */
  private drawBriefing(now: number): void {
    const session = this.session;
    if (!session) return;
    const topic = session.topic;
    const rules = rulesetFor(this.settings.ruleset);
    const wrap = (text: string, size: number, width: number): string[] =>
      wrapToWidth(text, size, width, (value, px) => this.screen.measure(value, px));

    this.screen.panel(52, 26, 536, 344, { fill: C.panel, border: C.accent, inner: '#3450ff' });

    this.screen.text(topic.name.toUpperCase(), 320, 40, { size: 20, align: 'center', color: C.ink });
    this.screen.text(
      `${FAMILY_LABELS[topic.family].toUpperCase()}  ·  ${topic.grades.toUpperCase()}  ·  LEVEL ${session.level}`,
      320,
      68,
      { size: 8, align: 'center', color: FAMILY_COLORS[topic.family] },
    );

    this.screen.text('YOUR GOAL', 76, 92, { size: 9, color: C.yellow });
    this.screen.rect(76, 104, 488, 1, '#1b2fb5');
    wrap(session.round.instruction, 13, 470).slice(0, 2).forEach((line, index) => {
      this.screen.text(line, 320, 112 + index * 18, { size: 13, align: 'center', color: C.green });
    });

    const points = rules.pointsForLevel(session.level);
    const bullets = [
      `Munch the ${session.round.correctCount} correct tiles. A wrong tile costs one of your ${rules.startingLives} lives.`,
      `${points} point${points === 1 ? '' : 's'} per correct munch. Clear the board to reach level ${session.level + 1}.`,
      'Troggles hunt you between munches. Press L any time to learn this topic.',
    ];
    let y = 156;
    for (const bullet of bullets) {
      this.screen.rect(78, y + 5, 4, 4, C.cyan);
      for (const line of wrap(bullet, 11, 452)) {
        this.screen.text(line, 92, y, { size: 11, color: C.ink });
        y += 15;
      }
      y += 6;
    }

    this.screen.text('CONTROLS', 76, 268, { size: 9, color: C.yellow });
    this.screen.rect(76, 280, 488, 1, '#1b2fb5');
    this.screen.text('ARROWS / WASD MOVE  ·  SPACE MUNCH  ·  L LEARN  ·  ESC BACK', 320, 288, {
      size: 9,
      align: 'center',
      color: C.dim,
    });

    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    this.screen.text('ENTER START', 320, 330, {
      size: 13,
      align: 'center',
      color: pulse > 0.5 ? C.yellow : '#8a7a2a',
    });
    this.screen.text('L LEARN  ·  ESC BACK', 320, 352, { size: 8, align: 'center', color: C.dimmer });
    this.screen.text(`RULES ${rules.label.toUpperCase()}`, 566, 34, { size: 8, align: 'right', color: C.dimmer });
  }

  private drawPause(now: number): void {
    void now;
    this.screen.rect(0, 0, VIEW_W, VIEW_H, '#000010', 0.55);
    this.screen.panel(180, 120, 280, 156, { fill: C.panel, border: C.accent, inner: '#3450ff' });
    this.screen.text('PAUSED', 320, 134, { size: 18, align: 'center', color: C.ink });
    const items = ['RESUME', 'LEARN THIS TOPIC', 'QUIT TO MENU'];
    items.forEach((item, index) => {
      const selected = index === this.pauseIndex;
      this.screen.text(`${selected ? '> ' : '  '}${item}`, 320, 176 + index * 24, {
        size: 13,
        align: 'center',
        color: selected ? C.yellow : C.dim,
      });
    });
    this.screen.text('ENTER SELECT  ·  L LEARN  ·  ESC QUIT', 320, 254, {
      size: 8,
      align: 'center',
      color: C.dimmer,
    });
  }

  private drawLesson(now: number): void {
    void now;
    const topic = this.lessonTopic;
    if (!topic) return;
    const lesson = lessonFor(topic);
    const plan = planLesson(lesson, (text, size) => this.screen.measure(text, size), {
      maxWidth: 488,
      maxHeight: 288,
    });

    this.screen.panel(40, 18, 560, 356, { fill: C.panel, border: C.accent, inner: '#3450ff' });
    this.screen.text(topic.name.toUpperCase(), 320, 30, { size: 19, align: 'center', color: C.ink });
    this.screen.text(
      `${FAMILY_LABELS[topic.family].toUpperCase()}  ·  ${topic.grades.toUpperCase()}`,
      320,
      55,
      { size: 8, align: 'center', color: FAMILY_COLORS[topic.family] },
    );

    // Text column (narrower when a figure is present).
    const hasFigure = Boolean(topic && lessonFor(topic).figure);
    const figureWidth = 132;
    const textWidth = hasFigure ? 488 - figureWidth - 16 : 488;
    void textWidth;

    let y = 74;
    for (const block of plan.blocks) {
      this.screen.text(block.header, 64, y, { size: 9, color: C.yellow });
      this.screen.rect(64, y + 11, 488 - (hasFigure ? figureWidth + 16 : 0), 1, '#1b2fb5');
      y += 16;
      for (const line of block.lines) {
        const isAnswer = line.startsWith('Answer:');
        this.screen.text(line, 64, y, {
          size: plan.size,
          color: isAnswer ? C.green : C.ink,
        });
        y += plan.lineHeight;
      }
      y += 9;
    }

    // Drawn example, pinned top-right so it costs width rather than height.
    const figure = lesson.figure;
    if (figure) {
      const box = { x: 64 + 488 - figureWidth, y: 74, w: figureWidth, h: figureWidth };
      this.screen.rect(box.x, box.y, box.w, box.h, '#00006b');
      drawVisual(this.screen.ctx, figure.visual, box);
      this.screen.stroke(box.x, box.y, box.w, box.h, '#1b2fb5', 1);
      const captionSize = Math.max(8, plan.size - 1);
      plan.captionLines.forEach((line, index) => {
        this.screen.text(line, box.x, box.y + box.h + 8 + index * (captionSize + 3), {
          size: captionSize,
          color: C.dim,
        });
      });
    }

    if (plan.overflow) {
      this.screen.text('MORE IN THE DOCS', 320, 352, { size: 8, align: 'center', color: C.orange });
    }

    this.screen.text('ENTER PLAY THIS TOPIC  ·  ESC BACK', 320, 362, {
      size: 8,
      align: 'center',
      color: C.dim,
    });
  }

  /** Small filled triangle used as a "there is more" indicator. */
  private chevron(cx: number, cy: number, direction: -1 | 1, color: string): void {
    const ctx = this.screen.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - direction * 5);
    ctx.lineTo(cx + 5, cy - direction * 5);
    ctx.lineTo(cx, cy + direction * 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
