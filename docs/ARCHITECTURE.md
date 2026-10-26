# Architecture

Number Munchers is a fixed-resolution canvas game wrapped in a thin screen
router. Three layers, no framework:

```
src/
  main.ts            boot: canvas sizing, sprite loading, error screen
  engine/            reusable, game-agnostic plumbing
    screen.ts        640x400 logical canvas, text/panel/sprite helpers
    input.ts         keyboard + pointer -> semantic actions
    audio.ts         WebAudio square-wave SFX recipes
    sprites.ts       image loading, typed sprite atlas
  game/              the munchers rules
    rules.ts         tunables: tick speed, lives, scoring, species schedule
    troggle.ts       five species of deterministic movement AI
    session.ts       one run: board, eating, collisions, level flow, drawing
  ui/
    app.ts           screens: menu, topic picker, options, help, scores, pause
  content/           the curriculum: pure data + generators
    types.ts         Topic / Round / Rng contract
    build.ts         makeRound(): sampling, validation, shuffling
    rng.ts           mulberry32 seeded PRNG
    registry.ts      the single list of topics
    curriculum.ts    run ordering (grade order, per-band)
    topics/*.ts      one module per subject family
```

## Why the content layer is pure

Every topic is a function of `(rng, level) -> Round`. No DOM, no globals, no
`Math.random`. That buys three things:

1. **Tests that mean something.** A seeded round can be rebuilt and inspected;
   `src/content/__tests__/content.test.ts` walks every topic across 20 levels
   and four seeds and asserts the board is legal.
2. **Fair boards.** `makeRound` samples without replacement and refuses to
   ship duplicate tiles: starved generators fail loudly in tests instead of
   degrading on the player's screen.
3. **Cheap scaling.** A topic widens its ranges from `level` alone, so adding
   an advanced variant rarely needs new engine code.

## Adding a topic (e.g. "Composite Functions")

1. Pick the module that matches the subject: `src/content/topics/algebra.ts`,
   `geometry.ts`, `trigonometry.ts`, `statistics.ts`, `precalculus.ts`,
   `arithmetic.ts`, `number-theory.ts`.
2. Append a `Topic` object:

```ts
const compositeFunctions: Topic = {
  id: 'composite-functions',
  name: 'Composite Functions',
  family: 'precalculus',
  band: 'high',
  grades: 'Grades 11-12',
  blurb: 'Evaluate f(g(x)) without losing your place.',
  round(rng, level) {
    const [a, b] = distinctInts(rng, 2, 1, 3 + level);
    const g = (x: number) => x + a;
    const target = g(b) * 2;                  // f(x) = 2x
    const correct = [`f(g(${b}))`, `${target}`]; // and more, at least 10
    const incorrect = [...];                  // plausible slips
    return makeRound({
      rng,
      heading: `f(x)=2x, g(x)=x+${a}`,
      instruction: `Munch every value equal to f(g(${b})).`,
      correct,
      incorrect,
      correctCount: 10,
      explain: (text) => `${text} does not equal f(g(${b})) = ${target}.`,
    });
  },
};
```

3. Add it to the exported array at the bottom of that module. `registry.ts`
   picks it up automatically — no other file changes.
4. If the topic draws, add a verifier case in
   `src/content/__tests__/support/truth.ts`. An unverified topic fails the
   truth suite by design, so a topic cannot ship without independent
   confirmation that its `correct` flags are mathematically right.
4. Run `npm run test:run`. The registry test will catch duplicate ids, illegal
   tiles, starved pools, and a missing band.

### Board rules the tests enforce

| Rule | Value |
| --- | --- |
| Tiles | exactly 30 (6x5) |
| Correct tiles | 8-12 |
| Tile text | ASCII, trimmed, at most 12 characters |
| Duplicates | none |
| `instruction` | must contain "munch" |
| `explain` | non-empty for any tile |

## Visual tiles

Tiles are not always text. `Tile.visual` carries either a `PlotSpec` (a
function plus its window) or a `ShapeSpec` (a figure, optionally with real
triangle angles), and `src/engine/visuals.ts` draws it inside the cell with a
uniform ink colour so the answer is never colour-coded.

```ts
interface Tile {
  text: string;              // hidden id for visuals, displayed otherwise
  correct: boolean;
  visual?: PlotSpec | ShapeSpec;
}
```

`makeRound` takes a `visuals` map keyed by tile id and attaches them, so
generators still deal in ids and the board builder stays visual-agnostic.
Topic tests treat visual tiles specially: width/ASCII rules apply only to text
the player reads, and determinism is compared by sampling the plotted function
rather than by function identity.

## Level flow

`GameSession` owns one run. A `roundFor(level)` callback decides which topic
each level uses, so practice mode pins one topic while a curriculum run walks
the band in grade order. Clearing a board advances the level; every fourth
level shows an interlude. Lives, score, and the troggle schedule live in
`rules.ts`.

Troggle movement is a pure step function (`stepTroggle`) fed a seeded RNG, which
keeps the AI testable: "Worker never turns", "Smarty closes the distance",
"Bashful opens it" are all assertions, not vibes.

## Rendering

Everything draws into a 640x400 backing store; CSS upscales it with
`image-rendering: pixelated`, so sprites and text stay hard-edged at any window
size. `Screen` provides `text`, `panel`, `sprite`, and `gradientText`; there is
no layout engine to learn.
