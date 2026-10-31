# Number Munchers

A modernized fork of [msaperst/number-munchers](https://github.com/msaperst/number-munchers):
the MECC classroom classic, rebuilt on a canvas engine with an extensible
curriculum that now runs from grade 3 arithmetic through high-school algebra,
geometry, trigonometry, statistics, and pre-calculus.

**Play it:** <https://judggernaut.github.io/number-munchers/>

Eat the tiles that answer the prompt. Avoid the ones that don't. Avoid the
Troggles.

## Why a new version

The upstream fork nailed the *feel* of the original in React/DOM, but it left
the game loop on scaffolding: a fixed 4-second Troggle tick marked
`// TODO - make this go faster based on the level/troggle`, a single Troggle
species (`normalus`), and six fixed categories. This fork keeps the lineage and
rebuilds the parts that were placeholders:

| Area | Upstream | Here |
| --- | --- | --- |
| Rendering | DOM grid + CSS | 640x400 canvas, pixel-perfect upscaling |
| Stack | Create React App | Vite + TypeScript (strict), zero runtime deps |
| Troggles | one species, fixed ramp | five species with distinct AI, level-scaled tick and spawns |
| Content | 4 generators x 11 difficulty grades | 57 topics across 7 subject families, grade-banded |
| Tile types | text only | text, function graphs, and drawn geometric figures |
| Tests | Jest + Enzyme + Selenium | Vitest, pure generators, board invariants, AI behaviour |
| Input | keyboard + swipe | keyboard, hold-to-move, click/tap-to-walk, touch |
| Audio | none | WebAudio square-wave SFX, mutable |

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run   # unit + content invariants
npm run build      # typecheck + production bundle in dist/
```

Node 22+ recommended. Any topic can be opened directly for lesson prep or
sharing: `http://localhost:3000/?topic=function-families`.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrows or WASD (hold to keep moving) |
| Munch | Space or Enter |
| Learn | L (lesson for the current topic) |
| Scroll topics | Up/Down (chevrons and a scrollbar show there is more) |
| Walk to a cell | Click / tap it |
| Pause | Esc (Esc again quits to the menu), or the MENU chip |
| Volume | corner speaker button (100% / 60% / 30% / mute) or M |

## Curriculum

Topics are grouped into three bands; a curriculum run stays inside the band you
pick and walks it in grade order. `Choose Topic` pins a single skill.

| Family | Sample topics |
| --- | --- |
| Number sense | Primes, Factors, Multiples, Even & Odd, Squares, Divisibility |
| Arithmetic | Equality, Compare, Place Value, Rounding, Fractions, Decimals, Percents, Integers, Operations, Powers & Roots |
| Algebra | Plug It In, Solve for x, Inequalities, Slope, Systems, Polynomials, Factoring, Quadratics, Exponent Rules, Function Values, Sequences, Logs, **Graph Types**, **Reading Graphs** |
| Geometry | Angles, Triangle Types, Right Triangles, Area & Perimeter, Circles, Volume, Coordinates, Polygons, Similar Shapes, Circle Rules, **Solids & Flats**, **Solid Clues**, **Triangle Pictures** |
| Trigonometry | SOH CAH TOA, Special Angles, Identities, Radians |
| Statistics | Averages, Probability, Combinations, Percent Change, Data Spread, Rates |
| Pre-calculus | Shifts & Flips, Limits, Derivatives, Series |

Some topics draw instead of writing: `Function Families` shows plots to
identify (linear, quadratic, cubic, exponential, logarithmic, reciprocal,
square root, absolute value, sine), `Solids vs Flat Shapes` shows 2D figures and
3D solids, and `Triangle Pictures` draws triangles from their real angles with
equality tick marks and a right-angle square.

Adding a topic is one object in one file:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) walks through it, and
`src/content/__tests__/content.test.ts` will tell you immediately if the board
is unfair or the tile text won't fit.

## Rules

Two complete rulesets, switchable in Options:

| | Modern | Classic |
| --- | --- | --- |
| Lives | 3 | 4, plus an extra life every 10,000 points |
| Troggle tick | 1.2 s, tightening to 0.26 s | 10.3 s at level 1 down to 1.03 s at level 12, with jitter |
| Points per munch | 5 | 5,5,5,10,15...70 by level, then 75 |
| Troggles | spawn during play, up to 4 | 1-3 on screen from level start |
| Interlude | every 4 levels | every 3 levels |
| Tile churn | no | Worker re-rolls and Helper erases the tile they leave |

Classic values come from static analysis of the 1990 `NM.EXE`; see
[`docs/re/original-analysis.md`](re/original-analysis.md).

## How it plays

- Starting a run opens a briefing page with the goal, scoring and controls:
  `ENTER` starts, `L` opens the lesson, `ESC` backs out.
- 6x5 board, 30 tiles, 8-12 of them correct.
- 5 points per correct munch. A wrong munch costs a life and explains itself.
- Press **L** on any wrong answer (or in the pause menu / topic picker) to open
  a lesson page for that topic: what it is, how to do it, a worked example with
  a drawn picture for shape and graph topics, and a tip. Escape returns you to
  where you were.
- 3 lives. A Troggle costs one too.
- Clear every correct tile to advance. Every fourth level is an interlude.
- Troggles get faster and more numerous; species unlock as you go.

Troggle roster (original names, friendly nicknames in brackets):
**Trogglus normalus** (Reggie) walks straight, **laborus** (Worker) re-rolls the
tile it leaves, **smarticus** (Smarty) chases, **timidus** (Bashful) flees,
**assistus** (Helper) erases the tile it leaves.

Interludes are animated mini-scenes: the Muncher squeezes through a gap and the
Troggle bonks into the wall.

## Project layout

```
src/engine   canvas, input, audio, sprites   (game-agnostic)
src/game     rules, troggle AI, session      (the munchers rules)
src/content  topic generators + registry     (pure, seeded, tested)
src/ui       menus, topic picker, options    (screen router)
docs/re      reverse-engineering notes on the 1990 original
```

## Research

Mechanics were checked against the 1990 DOS release with static analysis
(REA + Ghidra). Numbers that are grounded in the binary are documented in
[`docs/re/original-analysis.md`](re/original-analysis.md); the rest are marked
as design choices in `src/game/rules.ts`.

## License and attribution

Code: Apache-2.0 (inherited from the upstream fork). See
[`LICENSE`](LICENSE) and [`CREDITS.md`](CREDITS.md).

*Number Munchers* is © MECC / SoftKey. This is an independent, non-commercial
homage; no original game binaries, disk images, or resource files are included.
