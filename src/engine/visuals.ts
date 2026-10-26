import type { PlotSpec, ShapeName, ShapeSpec, TriangleSpec } from '../content/types';

/**
 * Cell-sized drawings for visual tiles: function plots and geometric figures.
 *
 * Everything is drawn in a uniform ink colour on purpose. If plots were tinted
 * per family the answer would be readable at a glance, which would defeat the
 * topic.
 */

const INK = '#ffffff';
const GHOST = '#4a63c8';
const AXIS = '#7d8fe0';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawVisual(
  ctx: CanvasRenderingContext2D,
  visual: PlotSpec | ShapeSpec,
  box: Box,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  if (visual.kind === 'plot') drawPlot(ctx, visual, box);
  else drawShape(ctx, visual, box);
  ctx.restore();
}

// -------------------------------------------------------------------- plots

function drawPlot(ctx: CanvasRenderingContext2D, spec: PlotSpec, box: Box): void {
  const pad = 6;
  const x0 = box.x + pad;
  const y0 = box.y + pad;
  const w = box.w - pad * 2;
  const h = box.h - pad * 2;

  const [xMin, xMax] = spec.xRange;
  const [yMin, yMax] = spec.yRange;
  const toX = (x: number): number => x0 + ((x - xMin) / (xMax - xMin)) * w;
  const toY = (y: number): number => y0 + h - ((y - yMin) / (yMax - yMin)) * h;

  // Frame, so every tile reads as "a graph".
  ctx.strokeStyle = GHOST;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);

  // Axes when they fall inside the window.
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1;
  if (yMin <= 0 && yMax >= 0) {
    ctx.beginPath();
    ctx.moveTo(x0, toY(0));
    ctx.lineTo(x0 + w, toY(0));
    ctx.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    ctx.beginPath();
    ctx.moveTo(toX(0), y0);
    ctx.lineTo(toX(0), y0 + h);
    ctx.stroke();
  }

  if (spec.asymptoteY !== undefined && spec.asymptoteY >= yMin && spec.asymptoteY <= yMax) {
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = GHOST;
    ctx.beginPath();
    ctx.moveTo(x0, toY(spec.asymptoteY));
    ctx.lineTo(x0 + w, toY(spec.asymptoteY));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Curve: sample densely and break the path at domain gaps.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  const steps = Math.max(40, Math.round(w));
  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    const y = spec.f(x);
    if (y === null || !Number.isFinite(y) || y < yMin - 1e6 || y > yMax + 1e6) {
      drawing = false;
      continue;
    }
    const px = toX(x);
    const py = Math.max(y0 - 2, Math.min(y0 + h + 2, toY(y)));
    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

// ------------------------------------------------------------------- shapes

type Pt = [number, number];

const polygon = (ctx: CanvasRenderingContext2D, points: Pt[], close = true): void => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
  ctx.stroke();
};

const regularPolygon = (cx: number, cy: number, r: number, sides: number, rotation = -Math.PI / 2): Pt[] =>
  Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as Pt;
  });

function drawShape(ctx: CanvasRenderingContext2D, spec: ShapeSpec, box: Box): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) / 2 - 7;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';

  const dashed = (): void => {
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = GHOST;
  };
  const solid = (): void => {
    ctx.setLineDash([]);
    ctx.strokeStyle = INK;
  };

  switch (spec.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'square':
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      break;

    case 'rectangle':
      ctx.strokeRect(cx - r, cy - r * 0.62, r * 2, r * 1.24);
      break;

    case 'triangle':
      if (spec.triangle) drawAngledTriangle(ctx, spec.triangle, box);
      else polygon(ctx, regularPolygon(cx, cy + r * 0.18, r, 3));
      break;

    case 'right-triangle':
      polygon(ctx, [
        [cx - r, cy + r * 0.8],
        [cx - r, cy - r * 0.6],
        [cx + r * 0.85, cy + r * 0.8],
      ]);
      break;

    case 'pentagon':
      polygon(ctx, regularPolygon(cx, cy, r, 5));
      break;

    case 'hexagon':
      polygon(ctx, regularPolygon(cx, cy, r, 6));
      break;

    case 'trapezoid':
      polygon(ctx, [
        [cx - r * 0.55, cy - r * 0.65],
        [cx + r * 0.55, cy - r * 0.65],
        [cx + r, cy + r * 0.7],
        [cx - r, cy + r * 0.7],
      ]);
      break;

    case 'parallelogram':
      polygon(ctx, [
        [cx - r * 0.55, cy - r * 0.65],
        [cx + r, cy - r * 0.65],
        [cx + r * 0.55, cy + r * 0.7],
        [cx - r, cy + r * 0.7],
      ]);
      break;

    case 'cube': {
      const s = r * 0.78;
      const off = r * 0.42;
      solid();
      ctx.strokeRect(cx - s - off / 2, cy - s - off / 2, s * 2, s * 2);
      dashed();
      ctx.strokeRect(cx - s + off / 2, cy - s + off / 2, s * 2, s * 2);
      solid();
      polygon(ctx, [
        [cx - s - off / 2, cy - s - off / 2],
        [cx - s + off / 2, cy - s + off / 2],
      ]);
      polygon(ctx, [
        [cx + s - off / 2, cy - s - off / 2],
        [cx + s + off / 2, cy - s + off / 2],
      ]);
      polygon(ctx, [
        [cx - s - off / 2, cy + s - off / 2],
        [cx - s + off / 2, cy + s + off / 2],
      ]);
      break;
    }

    case 'prism': {
      const w2 = r * 0.95;
      const h2 = r * 0.55;
      const off = r * 0.45;
      solid();
      ctx.strokeRect(cx - w2 - off / 2, cy - h2 - off / 2, w2 * 2, h2 * 2);
      dashed();
      ctx.strokeRect(cx - w2 + off / 2, cy - h2 + off / 2, w2 * 2, h2 * 2);
      solid();
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
      ] as const) {
        polygon(ctx, [
          [cx + sx * w2 - off / 2, cy + sy * h2 - off / 2],
          [cx + sx * w2 + off / 2, cy + sy * h2 + off / 2],
        ]);
      }
      break;
    }

    case 'triangular-prism': {
      const off = r * 0.6;
      const tri = regularPolygon(cx - off / 2, cy + off / 3, r * 0.8, 3);
      solid();
      polygon(ctx, tri);
      dashed();
      const back = tri.map(([x, y]) => [x + off, y - off] as Pt);
      polygon(ctx, back);
      solid();
      for (const [x, y] of tri) polygon(ctx, [[x, y], [x + off, y - off]]);
      break;
    }

    case 'pyramid': {
      const s = r * 0.85;
      const apex: Pt = [cx + r * 0.25, cy - r];
      const base: Pt[] = [
        [cx - s, cy + r * 0.45],
        [cx + s * 0.15, cy + r * 0.75],
        [cx + s, cy + r * 0.05],
        [cx - s * 0.15, cy - r * 0.25],
      ];
      dashed();
      polygon(ctx, [base[0]!, base[3]!, apex]);
      solid();
      polygon(ctx, base);
      for (const point of base) polygon(ctx, [point, apex]);
      break;
    }

    case 'cylinder': {
      const rx = r * 0.85;
      const ry = r * 0.32;
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.65, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      dashed();
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.65, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      solid();
      polygon(ctx, [
        [cx - rx, cy - r * 0.65],
        [cx - rx, cy + r * 0.65],
      ]);
      polygon(ctx, [
        [cx + rx, cy - r * 0.65],
        [cx + rx, cy + r * 0.65],
      ]);
      break;
    }

    case 'cone': {
      const rx = r * 0.85;
      const ry = r * 0.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.6, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      polygon(ctx, [
        [cx - rx, cy + r * 0.6],
        [cx, cy - r * 0.85],
      ]);
      polygon(ctx, [
        [cx + rx, cy + r * 0.6],
        [cx, cy - r * 0.85],
      ]);
      break;
    }

    case 'sphere': {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      dashed();
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      solid();
      break;
    }

    default:
      break;
  }
}

export const SHAPE_LABELS: Record<ShapeName, string> = {
  circle: 'circle',
  square: 'square',
  rectangle: 'rectangle',
  triangle: 'triangle',
  'right-triangle': 'right triangle',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  trapezoid: 'trapezoid',
  parallelogram: 'parallelogram',
  cube: 'cube',
  prism: 'rectangular prism',
  'triangular-prism': 'triangular prism',
  pyramid: 'pyramid',
  cylinder: 'cylinder',
  cone: 'cone',
  sphere: 'sphere',
};


/**
 * Draw a triangle from its real interior angles so acute/right/obtuse are
 * visually honest, adding tick marks for equal sides and a square for a right
 * angle.
 */
function drawAngledTriangle(ctx: CanvasRenderingContext2D, spec: TriangleSpec, box: Box): void {
  const [A, B, C] = spec.angles.map((deg) => (deg * Math.PI) / 180) as [number, number, number];
  // Side lengths by the law of sines (side i is opposite vertex i).
  const b = Math.sin(B);
  const c = Math.sin(C);

  // Vertices: P0 at the origin, P1 along +x, P2 by the angle at P0.
  const P0: Pt = [0, 0];
  const P1: Pt = [c, 0];
  const P2: Pt = [b * Math.cos(A), b * Math.sin(A)];

  const xs = [P0[0], P1[0], P2[0]];
  const ys = [P0[1], P1[1], P2[1]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 8;
  const scale = Math.min((box.w - pad * 2) / Math.max(1e-6, maxX - minX), (box.h - pad * 2) / Math.max(1e-6, maxY - minY));

  const toCanvas = ([x, y]: Pt): Pt => [
    box.x + pad + (x - minX) * scale,
    box.y + box.h - pad - (y - minY) * scale,
  ];

  const v = [toCanvas(P0), toCanvas(P1), toCanvas(P2)] as [Pt, Pt, Pt];
  polygon(ctx, v);

  // Equality tick marks at the midpoint of each marked side.
  for (const side of spec.marks ?? []) {
    const from = v[side]!;
    const to = v[(side + 1) % 3]!;
    const mx = (from[0] + to[0]) / 2;
    const my = (from[1] + to[1]) / 2;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(mx - nx * 4, my - ny * 4);
    ctx.lineTo(mx + nx * 4, my + ny * 4);
    ctx.stroke();
  }

  // Right-angle square at a 90 degree vertex.
  const rightIndex = spec.angles.findIndex((angle) => Math.abs(angle - 90) < 0.5);
  if (rightIndex >= 0) {
    const vertex = v[rightIndex]!;
    const other1 = v[(rightIndex + 1) % 3]!;
    const other2 = v[(rightIndex + 2) % 3]!;
    const unit = ([from, to]: [Pt, Pt]): Pt => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };
    const u1 = unit([vertex, other1]);
    const u2 = unit([vertex, other2]);
    const size = 7;
    const p1: Pt = [vertex[0] + u1[0] * size, vertex[1] + u1[1] * size];
    const p2: Pt = [vertex[0] + u2[0] * size, vertex[1] + u2[1] * size];
    const p3: Pt = [p1[0] + u2[0] * size, p1[1] + u2[1] * size];
    polygon(ctx, [p1, p3, p2], false);
  }
}
