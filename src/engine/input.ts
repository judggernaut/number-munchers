/**
 * Input layer: normalises keyboard, pointer and touch into a small set of
 * semantic actions the app polls each frame.
 */
export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'munch'
  | 'pause'
  | 'mute'
  | 'learn';

const KEY_MAP: Record<string, Action> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'munch',
  Escape: 'cancel',
  KeyP: 'pause',
  KeyQ: 'cancel',
  KeyL: 'learn',
  KeyM: 'mute',
  Backspace: 'cancel',
};

export class Input {
  private readonly queued: Action[] = [];
  private readonly held = new Set<Action>();
  private pointer: { x: number; y: number; cell: { col: number; row: number } | null } | null = null;
  private readonly detachers: Array<() => void> = [];

  constructor(target: HTMLElement) {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      // Space/arrows would otherwise scroll the page.
      e.preventDefault();
      if (e.repeat) return;
      this.held.add(action);
      this.queued.push(action);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code];
      if (action) this.held.delete(action);
    };
    const onBlur = () => this.held.clear();

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.detachers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = this.logicalPoint(target, e);
      const cell = this.cellFromPoint(x, y);
      this.pointer = { x, y, cell };
      this.queued.push('confirm');
    };
    target.addEventListener('pointerdown', onPointerDown);
    this.detachers.push(() => target.removeEventListener('pointerdown', onPointerDown));
  }

  private logicalPoint(target: HTMLElement, e: PointerEvent): { x: number; y: number } {
    const rect = target.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 640,
      y: ((e.clientY - rect.top) / rect.height) * 400,
    };
  }

  /** Convert a pointer event to logical board coordinates, if inside the board. */
  cellFromEvent(target: HTMLElement, e: PointerEvent): { col: number; row: number } | null {
    const { x, y } = this.logicalPoint(target, e);
    return this.cellFromPoint(x, y);
  }

  cellFromPoint(x: number, y: number): { col: number; row: number } | null {
    const grid = { x: 128, y: 56, cell: 64, cols: 6, rows: 5 };
    const col = Math.floor((x - grid.x) / grid.cell);
    const row = Math.floor((y - grid.y) / grid.cell);
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return null;
    return { col, row };
  }

  /** Drain the actions accumulated since the last frame. */
  drain(): Action[] {
    const out = this.queued.slice();
    this.queued.length = 0;
    return out;
  }

  /** Last pointer press in logical (640x400) coordinates, consumed once. */
  takePointer(): { x: number; y: number; cell: { col: number; row: number } | null } | null {
    const pointer = this.pointer;
    this.pointer = null;
    return pointer;
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  destroy(): void {
    for (const detach of this.detachers) detach();
    this.detachers.length = 0;
  }
}
