import type { Rng, TileVisual, Topic } from '../content/types';
import type { Sprites } from '../engine/sprites';
import type { Screen } from '../engine/screen';
import { drawVisual } from '../engine/visuals';
import { isMunching, muncherFrameIndex } from './muncher-frames';
import { drawTile, type TileCanvas } from './tile-render';
import { planOverlay, wrapToWidth } from '../ui/text-layout';
import type { Action } from '../engine/input';
import {
  DIFFICULTY_SPEED,
  RULES,
  pickSpecies,
  tickMsFor,
  type DifficultyId,
  type RuleSet,
} from './rules';
import {
  SPECIES_COLORS,
  SPECIES_NAMES,
  type TroggleSpecies,
  collides,
  erasesTiles,
  rerollsTiles,
  spawnAtEdge,
  stepTroggle,
  type Cell,
  type Troggle,
} from './troggle';

export const BOARD = { cols: 6, rows: 5, x: 128, y: 56, cell: 64 } as const;

/** Tappable pause chip in the footer, mirrored by the app's hit test. */
export const PAUSE_BUTTON = { x: 570, y: 376, w: 62, h: 20 } as const;
const CENTER: Cell = { col: 2, row: 2 };
/** How long a direction must be held before auto-repeat kicks in. */
const HOLD_REPEAT_DELAY_MS = 260;

export type SessionStatus =
  | 'play'
  | 'wrong'
  | 'eaten'
  | 'clear'
  | 'interlude'
  | 'gameover'
  | 'dying';

export interface SessionEvent {
  type: 'munch' | 'wrong' | 'death' | 'levelClear' | 'gameOver' | 'spawn' | 'interlude';
  score: number;
  lives: number;
  level: number;
  species?: string;
}

interface Cell_ {
  text: string;
  correct: boolean;
  eaten: boolean;
  visual?: TileVisual;
}

export interface SessionDeps {
  sprites: Sprites;
  rng: Rng;
  difficulty: DifficultyId;
  /** Returns the topic + round for a level. */
  roundFor(level: number): { topic: Topic; round: ReturnType<Topic['round']> };
  rules?: RuleSet;
  score?: number;
  lives?: number;
  level?: number;
  onEvent?: (event: SessionEvent) => void;
}

export class GameSession {
  readonly rules: RuleSet;
  private readonly deps: SessionDeps;
  private rng: Rng;

  topic: Topic;
  round: ReturnType<Topic['round']>;
  cells: Cell_[];
  muncher = { ...CENTER, fromCol: CENTER.col, fromRow: CENTER.row, movedAt: 0 };
  troggles: Troggle[] = [];
  score: number;
  lives: number;
  level: number;
  status: SessionStatus = 'play';
  message = '';
  prompt = '';
  shake = 0;

  private troggleClock = 0;
  private stepClock = 0;
  /** Animation clock (ms, dt-accumulated so tests stay deterministic). */
  private animClock = 0;
  private munchAnimAt = -1;
  private holdMs = 0;
  private clickTarget: Cell | null = null;
  private nextTroggleId = 1;
  private nextTickMs = 0;
  private nextExtraLife = 0;
  private interludeStartedAt = 0;
  private deathAnim: { species: TroggleSpecies; progress: number } | null = null;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.rules = deps.rules ?? RULES;
    this.rng = deps.rng;
    this.score = deps.score ?? 0;
    this.lives = deps.lives ?? this.rules.startingLives;
    this.level = deps.level ?? 1;
    const { topic, round } = this.deps.roundFor(this.level);
    this.topic = topic;
    this.round = round;
    this.cells = this.buildCells(round);
    this.nextExtraLife = this.rules.extraLifeEvery;
    this.nextTickMs = this.rollTick();
    this.spawnInitialTroggles();
  }

  /** Tick length with the original's random jitter applied. */
  private rollTick(): number {
    const base = tickMsFor(this.rules, this.level, this.deps.difficulty);
    const jitter = this.rules.tickJitterMs > 0 ? this.rng.int(0, this.rules.tickJitterMs) : 0;
    return base + jitter;
  }

  private spawnInitialTroggles(): void {
    const count = this.rules.initialTroggles(this.level);
    const ctx = {
      cols: BOARD.cols,
      rows: BOARD.rows,
      muncher: this.muncherCell,
      rng: this.rng,
    };
    for (let i = 0; i < count; i++) {
      const species = pickSpecies(this.rules.speciesForLevel(this.level), this.rng);
      this.troggles.push(spawnAtEdge(ctx, species, this.nextTroggleId++, this.muncherCell));
    }
  }

  private buildCells(round: ReturnType<Topic['round']>): Cell_[] {
    const cells: Cell_[] = round.tiles.map((tile) => ({
      text: tile.text,
      correct: tile.correct,
      eaten: false,
      ...(tile.visual ? { visual: tile.visual } : {}),
    }));
    // The muncher always starts on an empty cell.
    const centerIndex = CENTER.row * BOARD.cols + CENTER.col;
    const center = cells[centerIndex]!;
    if (center.correct && cells.filter((c) => c.correct && !c.eaten).length <= 1) {
      // Avoid an unwinnable board: promote another tile to correct.
      const other = cells.find((c) => !c.correct && !c.eaten);
      if (other) other.correct = true;
    }
    center.text = '';
    center.eaten = true;
    return cells;
  }

  get correctRemaining(): number {
    return this.cells.filter((c) => c.correct && !c.eaten).length;
  }

  get progress(): number {
    return 1 - this.correctRemaining / Math.max(1, this.round.correctCount);
  }

  get muncherCell(): Cell {
    return { col: this.muncher.col, row: this.muncher.row };
  }

  /** Board cell index for a position. */
  private indexOf(col: number, row: number): number {
    return row * BOARD.cols + col;
  }

  update(dt: number, actions: Action[], heldDir: { dc: number; dr: number } | null): void {
    this.animClock += dt;
    if (this.status === 'gameover') return;

    // Getting eaten gets its own beat: chomp, shake, then the message.
    if (this.status === 'dying') {
      const anim = this.deathAnim;
      if (anim) anim.progress = Math.min(1, anim.progress + dt / 900);
      if (anim && anim.progress >= 1) this.finishDeath();
      this.decayEffects(dt);
      return;
    }

    if (this.status !== 'play') {
      for (const action of actions) {
        if (action === 'confirm' || action === 'munch') this.advanceStatus();
      }
      this.decayEffects(dt);
      return;
    }

    this.muncherTick(dt, actions, heldDir);
    if (this.status === 'play') this.troggleTick(dt);
    this.decayEffects(dt);
  }

  private decayEffects(dt: number): void {
    // ~0.8 s of visible shake from a full-strength hit.
    this.shake = this.shake > 0.15 ? Math.max(0, this.shake - dt * 0.02) : 0;
  }

  private muncherTick(
    dt: number,
    actions: Action[],
    heldDir: { dc: number; dr: number } | null,
  ): void {
    const stepMs = this.rules.muncherStepMs(this.level);

    let requested: { dc: number; dr: number } | null = null;
    for (const action of actions) {
      const dir = dirFor(action);
      if (dir) requested = dir;
      if (action === 'munch' || action === 'confirm') this.munch();
    }

    if (this.status !== 'play') return;

    // A fresh press always moves exactly one cell. That is the whole point of
    // the delay below: a 150 ms tap must not eat two cells.
    if (requested) {
      this.clickTarget = null;
      this.holdMs = 0;
      this.stepClock = 0;
      this.moveBy(requested.dc, requested.dr);
      return;
    }

    if (heldDir) {
      this.clickTarget = null;
      this.holdMs += dt;
      // Auto-repeat only after the key has been held a while (like a keyboard).
      if (this.holdMs >= HOLD_REPEAT_DELAY_MS) {
        this.stepClock += dt;
        if (this.stepClock >= stepMs) {
          this.stepClock -= stepMs;
          this.moveBy(heldDir.dc, heldDir.dr);
        }
      }
      return;
    }

    this.holdMs = 0;

    // Click/tap-to-walk keeps its own cadence.
    const targetDir = this.dirToTarget();
    if (!targetDir) {
      this.stepClock = 0;
      return;
    }
    this.stepClock += dt;
    if (this.stepClock >= stepMs) {
      this.stepClock -= stepMs;
      this.moveBy(targetDir.dc, targetDir.dr);
      if (
        this.clickTarget &&
        this.muncher.col === this.clickTarget.col &&
        this.muncher.row === this.clickTarget.row
      ) {
        this.clickTarget = null;
      }
    }
  }

  /** Path one step toward a clicked cell (horizontal first, then vertical). */
  private dirToTarget(): { dc: number; dr: number } | null {
    const target = this.clickTarget;
    if (!target) return null;
    if (target.col !== this.muncher.col) {
      return { dc: Math.sign(target.col - this.muncher.col), dr: 0 };
    }
    if (target.row !== this.muncher.row) {
      return { dc: 0, dr: Math.sign(target.row - this.muncher.row) };
    }
    return null;
  }

  /** Pointer control: munch the current cell, or walk toward the clicked cell. */
  pointTo(cell: Cell): void {
    if (this.status !== 'play') return;
    if (cell.col === this.muncher.col && cell.row === this.muncher.row) {
      this.munch();
      return;
    }
    this.clickTarget = { col: cell.col, row: cell.row };
    this.stepClock = this.rules.muncherStepMs(this.level);
    this.holdMs = 0;
  }

  private moveBy(dc: number, dr: number): void {
    const next = {
      col: Math.min(BOARD.cols - 1, Math.max(0, this.muncher.col + dc)),
      row: Math.min(BOARD.rows - 1, Math.max(0, this.muncher.row + dr)),
    };
    if (next.col === this.muncher.col && next.row === this.muncher.row) return;
    this.muncher.fromCol = this.muncher.col;
    this.muncher.fromRow = this.muncher.row;
    this.muncher.col = next.col;
    this.muncher.row = next.row;
    this.muncher.movedAt = performance.now();
    this.checkContact();
  }

  private munch(): void {
    // The mouth chomps even when the cell is empty: it tried.
    this.munchAnimAt = this.animClock;
    const index = this.indexOf(this.muncher.col, this.muncher.row);
    const cell = this.cells[index];
    if (!cell || cell.eaten || cell.text === '') return;

    cell.eaten = true;
    if (cell.correct) {
      this.awardPoints(this.rules.pointsForLevel(this.level));
      this.emit('munch');
      this.prompt = '';
      if (this.correctRemaining === 0) this.levelClear();
    } else {
      this.lives -= 1;
      this.shake = 6;
      this.message = this.round.explain(cell.text);
      this.prompt = 'SPACE CONTINUE  ·  L LEARN';
      this.emit('wrong');
      if (this.lives <= 0) this.gameOver();
      else this.status = 'wrong';
    }
  }

  private awardPoints(points: number): void {
    this.score += points;
    while (this.rules.extraLifeEvery > 0 && this.score >= this.nextExtraLife) {
      this.lives += 1;
      this.nextExtraLife += this.rules.extraLifeEvery;
    }
  }

  private levelClear(): void {
    this.status = 'clear';
    this.message = `Level ${this.level} cleared!`;
    this.prompt = 'Press SPACE for the next level';
    this.emit('levelClear');
  }

  private gameOver(): void {
    this.status = 'gameover';
    this.message = 'Game over';
    this.prompt = 'Press SPACE to return to the menu';
    this.emit('gameOver');
  }

  private advanceStatus(): void {
    switch (this.status) {
      case 'wrong':
        this.status = 'play';
        this.prompt = '';
        break;
      case 'eaten':
        this.status = 'play';
        this.prompt = '';
        this.troggleClock = 0;
        break;
      case 'clear': {
        const nextLevel = this.level + 1;
        const isInterlude = nextLevel % this.rules.levelsPerInterlude === 1 && nextLevel > 1;
        if (isInterlude) {
          this.status = 'interlude';
          this.interludeStartedAt = performance.now();
          this.message = interludeText(nextLevel);
          this.prompt = 'Press SPACE to keep munching';
          this.emit('interlude');
        } else {
          this.loadLevel(nextLevel);
        }
        break;
      }
      case 'interlude':
        this.loadLevel(this.level + 1);
        break;
      case 'gameover':
        break;
      default:
        break;
    }
  }

  private loadLevel(level: number): void {
    this.level = level;
    const { topic, round } = this.deps.roundFor(level);
    this.topic = topic;
    this.round = round;
    this.cells = this.buildCells(round);
    this.troggles = [];
    this.troggleClock = 0;
    this.stepClock = 0;
    this.nextTickMs = this.rollTick();
    this.muncher.col = CENTER.col;
    this.muncher.row = CENTER.row;
    this.muncher.fromCol = CENTER.col;
    this.muncher.fromRow = CENTER.row;
    this.clickTarget = null;
    this.status = 'play';
    this.message = '';
    this.prompt = '';
    this.spawnInitialTroggles();
  }

  private troggleTick(dt: number): void {
    this.troggleClock += dt;
    if (this.troggleClock < this.nextTickMs) return;
    this.troggleClock = 0;
    this.nextTickMs = this.rollTick();

    const ctx = {
      cols: BOARD.cols,
      rows: BOARD.rows,
      muncher: this.muncherCell,
      rng: this.rng,
    };
    const now = performance.now();
    const before = this.troggles.map((t) => ({ species: t.species, col: t.col, row: t.row }));
    this.troggles = this.troggles.map((t) => stepTroggle(t, ctx, now));
    if (this.rules.tileChurn) this.applyChurn(before);

    // Spawning.
    const max = this.rules.maxTroggles(this.level);
    if (this.troggles.length < max && this.rng.chance(this.rules.spawnChance(this.level))) {
      const species = pickSpecies(this.rules.speciesForLevel(this.level), this.rng);
      this.troggles.push(spawnAtEdge(ctx, species, this.nextTroggleId++, this.muncherCell));
      this.emit('spawn', species);
    }

    this.checkContact();
  }

  /**
   * Original behaviour: some species change the cell they step off. laborus
   * re-rolls it, assistus wipes it. Correct-tile counts are preserved so a
   * level can never become unwinnable.
   */
  private applyChurn(before: Array<{ species: Troggle['species']; col: number; row: number }>): void {
    for (const previous of before) {
      const index = this.indexOf(previous.col, previous.row);
      const cell = this.cells[index];
      if (!cell || cell.eaten) continue;

      if (erasesTiles(previous.species)) {
        cell.text = '';
        cell.eaten = true;
        continue;
      }

      if (rerollsTiles(previous.species)) {
        const pool = this.cells.filter(
          (other) => other !== cell && !other.eaten && other.correct === cell.correct && other.text !== cell.text,
        );
        if (pool.length === 0) continue;
        cell.text = this.rng.pick(pool).text;
      }
    }
  }

  private checkContact(): void {
    const hit = this.troggles.find((t) => collides(t, this.muncherCell));
    if (!hit) return;
    // Freeze the board on the contact frame; the death animation owns the next
    // 900 ms, then the message appears.
    this.troggles = [];
    this.status = 'dying';
    this.deathAnim = { species: hit.species, progress: 0 };
    this.shake = 16;
    this.emit('death', hit.species);
    if (typeof navigator !== 'undefined') navigator.vibrate?.(120);
  }

  private finishDeath(): void {
    const species = this.deathAnim?.species ?? 'normalus';
    this.deathAnim = null;
    this.lives -= 1;
    this.message = `Yikes! You were eaten by a ${SPECIES_NAMES[species]}.`;
    this.prompt = 'SPACE TRY AGAIN  ·  L LEARN';
    this.muncher.col = CENTER.col;
    this.muncher.row = CENTER.row;
    this.muncher.fromCol = CENTER.col;
    this.muncher.fromRow = CENTER.row;
    this.clickTarget = null;
    if (this.lives <= 0) this.gameOver();
    else this.status = 'eaten';
  }

  private emit(type: SessionEvent['type'], species?: string): void {
    this.deps.onEvent?.({
      type,
      score: this.score,
      lives: this.lives,
      level: this.level,
      species,
    });
  }

  /** Dev-only: jump straight to the interlude scene for visual QA. */
  debugInterlude(): void {
    this.status = 'interlude';
    this.message = 'The Troggle bonks into the wall while you slip away through the gap!';
    this.prompt = 'Press SPACE to keep munching';
    this.interludeStartedAt = performance.now();
  }

  /** Milliseconds remaining until the next troggle step, for the danger meter. */
  dangerFraction(): number {
    const interval = tickMsFor(this.rules, this.level, this.deps.difficulty);
    return Math.min(1, this.troggleClock / interval);
  }

  draw(screen: Screen, now: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(now / 240);
    screen.begin('#000574', this.shake);

    this.drawHud(screen, pulse);
    this.drawGrid(screen, pulse);
    this.drawActors(screen, now);
    this.drawFooter(screen, now);

    if (this.status !== 'play' && this.status !== 'dying') this.drawOverlay(screen, pulse);
    screen.end();
  }

  private drawHud(screen: Screen, pulse: number): void {
    screen.rect(0, 0, 640, 50, '#00002e');
    screen.rect(0, 49, 640, 1, '#2a3fd0');

    screen.text(`LEVEL ${this.level}`, 12, 7, { size: 14, color: '#8fd2ff' });
    const topicLabel = this.topic.name.toUpperCase();
    const labelSize = screen.measure(topicLabel, 9) > 168 ? 7 : 9;
    screen.text(topicLabel, 12, 26, { size: labelSize, color: '#5f7fd0' });

    screen.text(this.round.heading, 320, 4, { size: 15, color: '#ffffff', align: 'center' });
    screen.text(this.round.instruction, 320, 25, { size: 10, color: '#7dffb0', align: 'center' });

    // Progress pips, right aligned.
    const done = this.round.correctCount - this.correctRemaining;
    const total = this.round.correctCount;
    const perRow = 10;
    const pipW = 5;
    const gap = 2;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, total - row * perRow);
      // Ends left of the corner sound chip (see ui/sound-button.ts).
      const startX = 586 - (rowCount * (pipW + gap) - gap);
      screen.rect(startX + col * (pipW + gap), 7 + row * 7, pipW, pipW, i < done ? '#7dffb0' : '#1b2fb5');
    }

    // Lives.
    const lives = Math.max(0, this.lives);
    screen.text('x' + lives, 628, 33, { size: 11, color: '#ffffff', align: 'right' });
    for (let i = 0; i < Math.min(lives, 6); i++) {
      screen.sprite(this.deps.sprites.muncher, 596 - i * 18, 40, 17);
    }

    if (pulse > 0.9 && this.status === 'play') screen.rect(0, 49, 640, 1, '#5f7fd0');
  }

  private drawGrid(screen: Screen, pulse: number): void {
    const { x, y, cell, cols, rows } = BOARD;
    screen.panel(x - 8, y - 8, cols * cell + 16, rows * cell + 16, {
      fill: '#00003a',
      border: '#ff4cf7',
      inner: '#3450ff',
    });

    // Tile drawing gets only what a tile looks like - never whether it is
    // correct. Same content, same pixels, no board-reading by colour.
    const tileCanvas: TileCanvas = {
      text: (str, px, py, style) => screen.text(str, px, py, style),
      drawVisual: (visual, visualBox) => drawVisual(screen.ctx, visual, visualBox),
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = this.indexOf(col, row);
        const cellData = this.cells[idx];
        const cx = x + col * cell;
        const cy = y + row * cell;
        const tint = (col + row) % 2 === 0 ? '#04046b' : '#06067d';
        screen.rect(cx + 2, cy + 2, cell - 4, cell - 4, tint);
        screen.stroke(cx + 2, cy + 2, cell - 4, cell - 4, '#1b2fb5', 1);

        if (!cellData || cellData.eaten || cellData.text === '') continue;
        if (col === this.muncher.col && row === this.muncher.row) continue;

        drawTile(tileCanvas, cellData, { x: cx, y: cy, w: cell, h: cell });
      }
    }

    // Pulse the border as the board gets close to completion.
    if (this.correctRemaining <= 2 && this.status === 'play') {
      screen.stroke(x - 8, y - 8, cols * cell + 16, rows * cell + 16, '#7dffb0', 1 + Math.round(pulse));
    }
  }

  private drawActors(screen: Screen, now: number): void {
    const { x, y, cell } = BOARD;
    const lerp = (from: number, to: number, since: number, dur: number): number => {
      const t = Math.min(1, Math.max(0, (now - since) / dur));
      return from + (to - from) * t;
    };

    for (const troggle of this.troggles) {
      const col = lerp(troggle.fromCol, troggle.col, troggle.steppedAt, 110);
      const row = lerp(troggle.fromRow, troggle.row, troggle.steppedAt, 110);
      const cx = x + col * cell + cell / 2;
      const cy = y + row * cell + cell / 2;
      const color = SPECIES_COLORS[troggle.species];
      screen.rect(cx - 30, cy - 30, 60, 60, color, 0.08);
      screen.sprite(this.deps.sprites.troggles[troggle.species], cx, cy, 58);
    }

    const mCol = lerp(this.muncher.fromCol, this.muncher.col, this.muncher.movedAt, 90);
    const mRow = lerp(this.muncher.fromRow, this.muncher.row, this.muncher.movedAt, 90);
    const mx = x + mCol * cell + cell / 2;
    const my = y + mRow * cell + cell / 2;

    if (this.status === 'dying' && this.deathAnim) {
      const p = this.deathAnim.progress;
      // Chomp: the Troggle lunges over the Muncher and gulps.
      const lunge = Math.min(1, p * 2.2);
      const chomp = 1 + 0.45 * Math.sin(Math.min(1, p * 1.6) * Math.PI);
      const muncherScale = Math.max(0, 1 - p * 1.25);
      const spin = p * Math.PI * 1.6;

      // Red impact flash behind the pair.
      screen.rect(mx - 34, my - 34, 68, 68, '#ff2b2b', 0.35 * (1 - p));
      screen.spriteTransformed(
        this.deps.sprites.troggles[this.deathAnim.species],
        mx,
        my - 4 * lunge,
        58 * chomp + 6 * p,
        lunge,
        0,
        1,
      );
      if (muncherScale > 0.02) {
        screen.spriteTransformed(
          this.deps.sprites.muncherSad,
          mx,
          my,
          56,
          muncherScale,
          spin,
          1,
        );
      }
      // Burst ring at the moment of contact.
      if (p < 0.5) {
        const r = 16 + p * 90;
        screen.stroke(mx - r, my - r, r * 2, r * 2, '#ffd85a', 2);
      }
      return;
    }

    const muncherSprite =
      this.status === 'eaten' || this.status === 'gameover'
        ? this.deps.sprites.muncherSad
        : this.status === 'clear' || this.status === 'interlude'
          ? this.deps.sprites.muncherHappy
          : this.animateMuncherSprite();
    screen.sprite(muncherSprite, mx, my, 60);
  }

  /**
   * Original-art frames when the optional pack is present: the sheet cycles
   * only while munching. Walking and standing use the closed-mouth rest pose,
   * so the Muncher does not bite at every step.
   */
  private animateMuncherSprite(): HTMLImageElement {
    const frames = this.deps.sprites.muncherFrames;
    if (frames.length <= 1) return this.deps.sprites.muncher;
    const elapsed = this.munchAnimAt < 0 ? null : this.animClock - this.munchAnimAt;
    if (!isMunching(elapsed)) {
      return this.deps.sprites.muncherRest ?? this.deps.sprites.muncher;
    }
    const index = muncherFrameIndex(elapsed, frames.length);
    return frames[index] ?? this.deps.sprites.muncher;
  }

  private drawFooter(screen: Screen, now: number): void {
    screen.rect(0, 378, 640, 22, '#00002e');
    screen.text(`SCORE ${this.score}`, 12, 383, { size: 11, color: '#ffd85a' });
    screen.text(this.topic.grades, 320, 385, { size: 9, color: '#5f7fd0', align: 'center' });

    const danger = this.dangerFraction();
    const meterColor = danger > 0.8 ? '#ff5a5a' : danger > 0.5 ? '#ffb347' : '#7dffb0';
    screen.text('NEXT', 452, 386, { size: 8, color: '#4462b8' });
    screen.rect(484, 387, 92, 4, '#0d1740');
    screen.rect(484, 387, Math.round(92 * danger), 4, meterColor);

    void now;
    // Pointer users have no Esc key; this chip opens the pause menu.
    screen.rect(PAUSE_BUTTON.x, PAUSE_BUTTON.y, PAUSE_BUTTON.w, PAUSE_BUTTON.h, '#0d1740');
    screen.stroke(PAUSE_BUTTON.x, PAUSE_BUTTON.y, PAUSE_BUTTON.w, PAUSE_BUTTON.h, '#3450ff', 1);
    screen.text('MENU', PAUSE_BUTTON.x + PAUSE_BUTTON.w / 2, PAUSE_BUTTON.y + 6, {
      size: 8,
      align: 'center',
      color: '#5f7fd0',
    });
  }

  private drawOverlay(screen: Screen, pulse: number): void {
    if (this.status === 'interlude') {
      this.drawInterlude(screen, pulse);
      return;
    }
    // Messages can be long ("its angles are 100, 40 and 40 degrees, so ..."),
    // so the panel is laid out from measured, wrapped lines and grows to fit.
    const plan = planOverlay(this.message, (text, size) => screen.measure(text, size));
    const w = plan.width;
    const h = plan.height;
    const x = Math.round((640 - w) / 2);
    const minY = 58;
    const maxY = 400 - 44 - h;
    const y = Math.max(minY, Math.min(maxY, Math.round((400 - h) / 2)));

    screen.rect(0, 0, 640, 400, '#000010', 0.35);
    screen.panel(x, y, w, h, {
      fill: '#00004d',
      border: this.status === 'wrong' || this.status === 'eaten' ? '#ff5a5a' : '#7dffb0',
      inner: '#3450ff',
    });

    plan.lines.forEach((line, index) => {
      screen.text(line, 320, y + 24 + index * plan.lineHeight, {
        size: plan.size,
        color: '#ffffff',
        align: 'center',
        baseline: 'top',
      });
    });

    if (this.prompt) {
      screen.text(this.prompt, 320, y + h - 20, {
        size: 10,
        color: pulse > 0.5 ? '#ffd85a' : '#8a7a2a',
        align: 'center',
      });
    }
  }

  /**
   * Mini-scene shown between levels: the Muncher outruns a Troggle, the Troggle
   * bonks into the wall, stars. Skippable with any confirm key.
   */
  private drawInterlude(screen: Screen, pulse: number): void {
    const elapsed = performance.now() - this.interludeStartedAt;
    screen.rect(0, 0, 640, 400, '#000010', 0.55);
    screen.panel(70, 78, 500, 250, { fill: '#00004d', border: '#7dffb0', inner: '#3450ff' });

    screen.text('INTERLUDE', 320, 92, { size: 10, color: '#5f7fd0', align: 'center' });
    screen.text('You outsmarted the Troggle!', 320, 110, { size: 14, color: '#ffd85a', align: 'center' });

    const floorY = 236;
    screen.rect(96, floorY, 448, 2, '#3450ff');

    // The wall the Troggle fails to get through, with a gap the Muncher fits.
    const wallX = 430;
    screen.rect(wallX, 186, 4, 20, '#3450ff');
    screen.rect(wallX, 224, 4, 14, '#3450ff');

    const run = Math.min(1, elapsed / 1400);
    const muncherX = 140 + run * 350;
    const troggleX = 96 + run * 324;
    const hopWindow = elapsed > 1400 && elapsed < 1950;
    const hop = hopWindow ? Math.sin(((elapsed - 1400) / 550) * Math.PI) * 38 : 0;
    const bonked = elapsed >= 1950;
    const shake = bonked && elapsed < 2400 ? Math.sin(elapsed / 35) * 4 : 0;

    screen.sprite(this.deps.sprites.troggles.normalus, troggleX + shake, floorY - 30, 46);
    screen.sprite(
      bonked ? this.deps.sprites.muncherHappy : this.deps.sprites.muncher,
      muncherX,
      floorY - 34 - hop,
      50,
    );

    if (bonked) {
      const starAt = elapsed < 2600 ? Math.min(1, (elapsed - 1950) / 650) : 1;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 10 + starAt * 22;
        const sx = wallX - 6 + Math.cos(angle) * radius;
        const sy = floorY - 34 + Math.sin(angle) * radius * 0.6;
        screen.rect(sx, sy, 3, 3, '#ffd85a', 1 - starAt * 0.6);
      }
      // Dust puffs at the impact.
      for (let i = 0; i < 3; i++) {
        screen.rect(wallX - 10 - i * 6, floorY - 6 - i * 3, 4, 3, '#7d8fe0', 0.5 - i * 0.1);
      }
    }

    const messageLines = wrapToWidth(this.message, 10, 430, (text, size) => screen.measure(text, size));
    messageLines.slice(0, 3).forEach((line, index) => {
      screen.text(line, 320, 262 + index * 14, { size: 10, color: '#ffffff', align: 'center' });
    });

    const promptColor = pulse > 0.5 ? '#ffd85a' : '#8a7a2a';
    screen.text(this.prompt, 320, 306, { size: 10, color: promptColor, align: 'center' });
  }
}

function dirFor(action: Action): { dc: number; dr: number } | null {
  switch (action) {
    case 'up':
      return { dc: 0, dr: -1 };
    case 'down':
      return { dc: 0, dr: 1 };
    case 'left':
      return { dc: -1, dr: 0 };
    case 'right':
      return { dc: 1, dr: 0 };
    default:
      return null;
  }
}

function interludeText(level: number): string {
  const lines = [
    `Level ${level - 1} cleared. The Troggle chases you around the board and you slip through the gap!`,
    'The Troggle bonks into the wall while you munch another row. Classic.',
    'You outsmart the Troggle with a last-second turn. It is not amused.',
    'The Troggle gives chase, trips over its own feet, and you finish the board.',
  ];
  return lines[(level / 4 - 1) % lines.length] ?? lines[0]!;
}

export { DIFFICULTY_SPEED };
