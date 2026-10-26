# Number Munchers (DOS 1990) — reverse-engineering findings

Primary artifact: `NM.EXE` from the `NumbMunc` directory, unpacked from
LZEXE 0.91 to `tools/re/NM_UNPACKED.EXE` (198,128 bytes,
sha256 `de42f666542c0ef84b6dd5f0fe49cfaa06ebb79cc05daa5b9f0e74ebd9b994c3`).
See `docs/re/unpacking.md` for the reproducible unpack and the address
mapping. All function names below are Ghidra `segment:offset` names from the
REA/Ghidra 12.1.2 analysis; `DS:xxxx` means a data-segment offset (file
offset = `0x2a140 + xxxx`).

Scope note: this is a clean-room study. No original code or artwork is copied
into `src/`. The PNGs in `docs/re/extracted/` are documentation only.

---

## 1. Confirmed facts

Confidence meanings: **high** = read directly from data or unambiguous
instructions; **medium** = inferred from a small amount of disassembly or one
uncertain link; **low** = external/community claim not confirmed in this
binary.

| # | Claim | Evidence | Confidence |
|---|---|---|---|
| 1 | `NM.EXE` is LZEXE 0.91-packed; it unpacks to a valid 198,128-byte MZ | `LZ91` at header `0x1c`; `unlzexe.c` output passes `file`/MZ checks | high |
| 2 | There are **five** Troggle species, internally `normalus`, `laborus`, `timidus`, `assistus`, `smarticus` | far-pointer name table at DS `0x1270` (file `0x2b3b0`); species field is `1..5` and the death routine indexes `0x1284 + (species-1)*4` | high |
| 3 | Species 1 `normalus` never changes direction on its own; it walks in a straight line until blocked | AI dispatch `FUN_17e7_0229`, table at `CS:0x026f`, species 1 → `0x0337`, which is a bare `jmp` to the common clamp | high |
| 4 | Species 2 `laborus` keeps its direction 80 % of the time and turns ±1 (mod 4) 20 % of the time | `FUN_17e7_0229`, species 2/4 → `0x030f`: `rand(0,10)`; 0→dir−1, 1→dir+1, else unchanged | high |
| 5 | Species 3 `timidus` flees when close: if Manhattan distance to the Muncher is ≤ 96 px it sets direction = (toward Muncher) − 2, i.e. the opposite direction | `FUN_17e7_0229`, species 3 → `0x02b6`; uses `FUN_17e7_1849` and compares distance with `0x60` | high |
| 6 | When farther than 96 px, `timidus` wanders: `rand(0,10)` gives 20 % turn +1, 20 % turn −1, 20 % reverse (dir+2), 40 % straight | same `0x02b6` block, after the distance test | high |
| 7 | Species 4 `assistus` uses the same direction chooser as `laborus` (20 % turn), but **erases the board tile it leaves** | `FUN_17e7_0229` species 4 → `0x030f`; leave-cell dispatch table `CS:0x03b1` species 4 → `0x1822b`, which does `board[old_cell]=0` | high |
| 8 | Species 5 `smarticus` chases: ≤96 px → always set direction toward Muncher; 96–192 px → 50 % chance to set it toward; >192 px → keep direction | `FUN_17e7_0229`, species 5 → `0x0279`; `FUN_17e7_1849` returns direction + Manhattan distance; compares `0x60`/`0xc0` and `rand(0,2)` | high |
| 9 | On leaving a cell: `normalus`/`timidus` re-roll the tile **if it had a number** (and clear it if it was empty); `laborus` always re-rolls (so it can add a number to an empty cell); `assistus` clears the tile; `smarticus` restores the saved value | leave-cell dispatch `FUN_17e7_036e` at `0x1821c`, table `CS:0x03b1`; the re-roll call is `0xf71:0x0077`, which relocates to `FUN_1f71_0077`, the per-cell value generator; `assistus` writes 0; `smarticus` restores `0x64e[i]` | high |
| 10 | Troggles cannot normally overlap: the movement routine rejects a destination cell whose occupancy flag `0x5a8a[cell]` is 0, then turns ±1 randomly and retries | `FUN_17e7_11dd` at `0x1912f`–`0x19164`; flags are set/cleared when entities enter/leave | high |
| 11 | Troggle direction encoding is **0=up, 1=right, 2=down, 3=left** | `FUN_17e7_11dd` dispatch at `0x190c4`: dir0→row−1, dir1→col+1, dir2→row+1, default→col−1 | high |
| 12 | Muncher direction encoding is different: **0=right, 1=down, 2=left, 3=up** | `FUN_17e7_0d4a` dispatch at `0x18bea`/`0x18c01` etc. | high |
| 13 | Board is **6 columns × 5 rows = 30 cells**, cell pitch 48×30 px, origin (20,26) | `FUN_17e7_0d4a` clamps `col<6`, `row<5`, computes x=`col*0x30+0x14`, y=`row*0x1e+0x1a`; `FUN_17e7_1919`/`107f` use 30-cell loops | high |
| 14 | Initial Troggle count per level 1–12 is **1,1,1,2,2,2,2,3,3,3,3,3** | table DS `0x058e` (file `0x2a6ce`), read by `FUN_17e7_107f` at `0x18f10` | high |
| 15 | Species mix is a per-level weighted table, not a hard gate; zero weight = species absent | table DS `0x05be` (file `0x2a6fe`), 12 levels × 5 u16 weights, read by `FUN_17e7_107f` at `0x18f37` | high |
| 16 | Species weights by level (normalus, laborus, timidus, assistus, smarticus): L1 100/0/0/0/0; L2 90/0/10/0/0; L3 80/0/10/10/0; L4 70/10/10/10/0; L5 60/10/10/10/10; L6 50/15/10/15/10; L7 45/15/15/15/10; L8 40/15/15/15/15; L9 35/15/20/15/15; L10 30/15/20/20/15; L11 25/20/20/20/15; L12 20/20/20/20/20 | decoded from DS `0x05be` | high |
| 17 | Troggle first-move delay = table[level] + `rand(0..89)` timer units | `FUN_17e7_107f` at `0x18fcd`: `rand(0,0x5a) + table[0x5a6][level]` | high |
| 18 | Troggle inter-move delay = table[level] + `rand(0..89)` timer units | after the move, `0x19395`: `rand(0,0x5a) + table[0x5a6][level]` | high |
| 19 | Troggle delay table (levels 1–12): **300,300,270,270,240,210,180,150,120,90,60,30** timer units; level 13+ reuses 30 | DS `0x05a6` (file `0x2a6e6`); `FUN_17e7_1919` caps the parameter index `5ab2` at 11 | high |
| 20 | Per-cell slide animation duration is **3,3,3,3,2,2,2,2,1,1,1,1** timer units | DS `0x0636` (file `0x2a776`), used by `FUN_17e7_11dd` at `0x19204` | high |
| 21 | The internal timer unit is **30 PIT interrupts**; the PIT is programmed with divisor 1365 (≈874.1 Hz), so the unit is ≈**34.32 ms** (≈29.14 Hz) | timer ISR at `0x107d4`/`0x10802`: `mov al,0x36; out 0x43; out 0x40,0x55; out 0x40,0x05`; decrements `0x3e2` from 30 and increments the 32-bit counter at `0x3e3/0x3e5` | high |
| 22 | Therefore the nominal Troggle interval is ≈**10.30 s** at level 1 down to ≈**1.03 s** at level 12, plus 0–3.05 s random jitter | 300×34.32 ms … 30×34.32 ms; jitter 89×34.32 ms | medium (arithmetic is high; see §3 for the play-feel caveat) |
| 23 | Muncher movement is keyboard-driven, not a fixed timer; its move animation is 7 scheduler frames ≈ 0.24 s | `FUN_17e7_1539`: advances a frame counter until `iVar1 >= 7`, then resolves the tile | medium |
| 24 | Correct munch points are a per-level table, not a constant 5 | DS `0x0654` (file `0x2a794`), read by `FUN_17e7_000a` at `0x17e9e` | high |
| 25 | Points per munch: L1–L3 **5**, L4 10, L5 15, L6 20, L7 25, L8 30, L9 35, L10 40, L11 45, L12 50, L13 55, L14 60, L15 65, L16 70, **L17+ 75** | table DS `0x0654`; code uses the displayed level `5868`, and if `5868 > 16` adds 75 | high |
| 26 | Eating a **wrong** number costs a life; it does not subtract points | `FUN_17e7_036e` stores the tile value into `59b4` and clears the cell; `FUN_17e7_1539` sees `<0` and calls the death routine `FUN_17e7_13f2`, then the “is not a multiple/factor/prime” explanation routine | high |
| 27 | Lives counter starts at **3**; because death decrements and game-over tests `<0`, this is **current life + 3 reserve = 4 total lives** | game/level start sets `DAT_3734_5998=3`; `FUN_17e7_13f2` decrements; `FUN_17e7_1ed1`/`1539` test `5998 < 0` | high |
| 28 | Extra life every **10,000 points**: award when `floor(new_score/10000) > floor(old_score/10000)` | `FUN_17e7_000a` at `0x17f07`–`0x17f3b` | high |
| 29 | Score is held in a 32-bit value and compared with **1,000,000** (`0xF4240`); at/above that threshold the routine calls the end/quit path | cap in `FUN_1c5b_007e` at `0x38478` (`0xF4240`); threshold in `FUN_17e7_000a` at `0x17ece` | medium |
| 30 | A level ends when **no positive-valued tile remains**; negative/distractor tiles may remain | `FUN_17e7_2313` scans cells 0..29 and returns true if any `board[cell] > 0`; if none it fires job 100 state 6 (level complete) | high |
| 31 | No level time limit was found; the “Time out” string is used by the attract/demo toggle | `FUN_17e7_1df8` / `FUN_217a_0656`; `DAT_3734_599a` toggles, no countdown feeding a level-over check | medium |
| 32 | Board generation fills all 30 cells with a **50/50** choice between two generator families; it rerolls the whole board until at least **2** positive (correct) tiles exist | `FUN_1f71_0313` loops 30 cells and repeats while `correct < 2`; `FUN_1f71_0077` at `0x1f79a` does `rand(0,2)` and branches to two generator sets | high |
| 33 | Correct vs distractor is encoded by the **sign** of the board value: `>0` = correct/edible, `<0` = wrong, `0` = empty | `FUN_17e7_1539` (`59b4 < 1` / `>0`), `FUN_17e7_2313` (`board > 0`) | high |
| 34 | The Muncher's starting cell is explicitly zeroed after placement, so it is always empty at level start | `FUN_17e7_0ca4`: computes `cell = (row+1)*6 + col+1`, then `board[cell] = 0`; also resets the occupancy/target fields | high |
| 35 | Tile values may repeat; no de-duplication pass was found | per-cell generator `FUN_1f71_0077` draws independently for each cell and stores directly; no set/table of used values | medium |
| 36 | Question values are generated arithmetically at runtime; the only stored question data is a 46-entry prime table | `FUN_1f71_0077` and its five generator calls; `NM.RES` DATA id 2 (92 bytes) = u16 primes 2,3,5,…,199 | high |
| 37 | Game modes are Multiples, Factors, Primes, Equality, Inequality plus Challenge (random mode) | strings at DS `0x0485`–`0x04c1` and `0x1446`–`0x148a` | high |
| 38 | Difficulty menu has 11 entries: 3rd Grade Easy/Advanced, 4th Easy/Advanced, 5th, 6th, 7th, 8th and Above | 11 NUL-terminated strings starting DS `0x22fd` (file `0x2c43d`); menu code prints them | high |
| 39 | The password is an **options/teacher lock**, not a level-select/skip | strings “Set Password”, “Enter the password:”, “That password is not correct.”; the options state machine gates option changes only | high |
| 40 | Displayed level is unbounded but the parameter index `5ab2` is capped at 11 (level 12), so levels 13+ reuse the level-12 Troggle counts/weights/delays | `FUN_17e7_1919`: `if (5ab2 < 0xb) 5ab2++`; `5868` (displayed level) increments unconditionally | high |
| 41 | The board is regenerated per level; the Muncher is re-placed; the Troggle count/weights are re-read | `FUN_17e7_1919` calls `FUN_17e7_0e58` (delayed jobs), `FUN_17e7_0ca4` (Muncher placement), `FUN_17e7_107f` (Troggles); the question/board builder is invoked by the surrounding level flow | high |
| 42 | `NM.RES` resources: `CONF` (1), `DATA` (2), `GSND` (1), `PSND` (1), `ADLI` (5), `SCPT` (5) | parsed with `tools/re/parse_res.py`; see §7 | high |
| 43 | Graphics `.RES` files use `BTMP` blit lists + `PCXF` PCX images | `BTMP` records are 12 bytes `{u32 id, u16 f1,f2,f3,f4}` (interpreted as a rectangle, exact semantics guessed); `PCXF` starts with PCX `0x0A` magic (8bpp VGA / 2bpp CGA) | high for container, medium for rectangle semantics |
| 44 | `MECC8X8.GFT` and `MECC5X8.GFT` decode as bit-packed scanline fonts; JSON + PNG produced | `docs/re/font.md`, `src/assets/font-mecc*.json`, `docs/re/font-preview.png`; verified `A`–`Z`, digits, punctuation | high |

---

## 2. Troggle roster and AI (detail)

The five internal names are the only species names in the binary. The
English names are the standard ones; the behaviours below match the official
descriptions, including the two “board-disruption” species.

| id | internal | common name | movement rule | board-tile effect on leaving |
|---|---|---|---|---|
| 1 | `normalus` | Reggie | straight line; only turns when the next cell is blocked (wall or occupied), then random ±1 | if the cell had a number, re-roll it; if empty, leave it empty |
| 2 | `laborus` | Worker | 80 % straight, 20 % random ±1 turn | always re-roll the tile (`FUN_1f71_0077`); can add to an empty cell |
| 3 | `timidus` | Bashful | ≤96 px from Muncher: reverse (dir−2) to flee; farther: random walk (20 % +1, 20 % −1, 20 % reverse, 40 % straight) | same as Reggie: re-roll a numbered cell, leave empty empty |
| 4 | `assistus` | Helper | same chooser as Worker (20 % random turn) | **erase** the tile (`board[cell]=0`) |
| 5 | `smarticus` | Smarty | ≤96 px: turn toward Muncher; 96–192 px: 50 % turn toward; >192 px: straight | restore the saved value (no change) |

Important corrections to the popular one-line summary:

* **Reggie is not a random walk.** In this DOS build `normalus` has a literal
  no-op direction chooser; it only turns when its chosen cell is blocked.
* **Worker is not “never changes direction”.** `laborus` has a 20 % random turn
  and, more importantly, rewrites the tile it leaves. “Worker adds/changes
  answers” is implemented as a call to the same per-cell value generator.
* **Helper eats answers.** `assistus` clears the board value of the cell it
  leaves, exactly the “ant” behaviour.
* **Smarty chases**, but only within a 192 px radius; beyond that it walks
  straight.
* **Bashful flees** when within 96 px, otherwise wanders (including 20 %
  reversals).

All five share the generic blocked-cell rule in `FUN_17e7_11dd`: if the chosen
next cell is outside the 6×5 grid or its occupancy flag is 0, it picks a random
±1 turn and retries (up to four directions). Therefore they normally **cannot
overlap** or pass through each other. This DOS build does not implement the
“Troggles eat each other on collision” behaviour described for some other
ports; the occupancy test rejects the move instead.

**Do they eat numbers?** Only Helper does so directly (clears the tile). Worker,
Reggie and Bashful **re-roll** the tile (Worker can also add a number to an
empty cell); Smarty leaves the board unchanged. None of them eat a number
simply by stepping on it: the effect happens when they leave the cell. This
matches the documented “Worker adds/changes answers” and “Helper eats all
answers”, with the extra detail that Reggie/Bashful also re-roll existing
numbers in the DOS build.

---

## 3. Timing

### Timer hardware

The game installs its own INT 08 handler and reprograms PIT channel 0:

```
out 0x43, 0x36        ; channel 0, lobyte/hibyte, mode 3
out 0x40, 0x55        ; divisor low
out 0x40, 0x05        ; divisor high  -> divisor 0x0555 = 1365
```

Input clock 1,193,182 Hz → **874.1 Hz** interrupt rate. The handler at
`0x107d4` decrements a byte from 30 and, when it reaches zero, increments the
32-bit counter at `CS:0x03e3/0x03e5` (the value returned by the timer thunk at
`0x1087c`). So:

```
1 timer unit = 30 / 874.1 s = 34.32 ms  (29.14 Hz)
```

### Troggle delay tables

| level | initial/inter-move base (units) | ms | animation (units) | ms |
|---|---|---|---|---|
| 1 | 300 | 10297 | 3 | 103 |
| 2 | 300 | 10297 | 3 | 103 |
| 3 | 270 | 9267 | 3 | 103 |
| 4 | 270 | 9267 | 3 | 103 |
| 5 | 240 | 8238 | 2 | 69 |
| 6 | 210 | 7208 | 2 | 69 |
| 7 | 180 | 6178 | 2 | 69 |
| 8 | 150 | 5148 | 2 | 69 |
| 9 | 120 | 4119 | 1 | 34 |
| 10 | 90 | 3089 | 1 | 34 |
| 11 | 60 | 2059 | 1 | 34 |
| 12+ | 30 | 1030 | 1 | 34 |

Each interval also gets `rand(0..89)` units (0–3.05 s) added. The first move
uses the same base + jitter, so a level-1 Troggle first moves after 10.3–13.35 s
and then every 10.3–13.35 s.

Caveat: 10 s at level 1 is slower than a 4 s remake assumption, but it is what
the tables and the measured timer unit give. The uncertain link is only the
timer unit; the PIT/ISR evidence is strong. If a DOSBox observation contradicts
this, the first thing to re-check is the intended PIT divisor / counter
prescaler, not the tables.

### Muncher

The Muncher is not on a movement timer: it responds to arrow keys immediately.
Its move/eat animation is driven by the same scheduler and resolves after
**7 frames** (`FUN_17e7_1539`), ≈0.24 s. The game loop is:

```
FUN_2218_025e:
  FUN_2652_0599()   ; timer/scheduler tick
  FUN_1d05_000b()   ; game logic
  FUN_20d2_00e8()   ; render/input
```

### Level speed-up

The visible speed-up comes from three tables, all capped at level 12:

* count: 1 → 3 Troggles;
* initial/inter-move delay: 300 → 30 units;
* slide animation: 3 → 1 unit;
* species mix shifts toward the disruptive/chasing species.

The score table continues to rise to level 16 (70), then 75 for level 17+.

---

## 4. Spawn rules

At level start (`FUN_17e7_1919` → `FUN_17e7_107f`):

1. `n = table_0x58e[level]` (1,1,1,2,2,2,2,3,3,3,3,3).
2. For `i = 1..n`, draw `r = rand(0..100)` and select the species by walking
   the cumulative weights `table_0x5be[level][species]`. Species weights are
   in §1 #16. This is the only species gating: a species with weight 0 does
   not spawn at that level.
3. Set the Troggle's cell to −1 (not on board yet) and schedule its first move
   at `table_0x5a6[level] + rand(0..89)` units.
4. Jobs are created in the 16-slot scheduler; each Troggle has a job id equal
   to its 1-based index.

There is **no per-tick random spawn probability** in the code path examined.
Population is established at level start; the cap is the level table value
(max 3). `FUN_17e7_0e58` also schedules a small number of delayed jobs
(counts from `table_0x6b4` and `table_0x69c`), but the exact object they create
is not fully resolved (see §8). They look like additional spawn/replacement
events, not a random per-tick roll.

---

## 5. Scoring and lives

| event | effect |
|---|---|
| correct munch (`tile > 0`) | `score += points[level]`; sound; combo/level checks |
| wrong munch (`tile < 0`) | life−1; “Oops! … is not a multiple/factor/prime” explanation; score unchanged |
| Troggle contact | life−1; death animation/message; respawn if lives ≥ 0 |
| start of game | lives counter = 3 (current + 3 reserve = **4 total**) |
| every 10,000 score | life+1 (counter increments; sound only while ≤3) |
| score 1,000,000 | end/quit path (`0xF4240` threshold) |
| level complete | no positive tiles remain |

Points table (displayed level, 1-based):

```
1:5  2:5  3:5  4:10 5:15 6:20 7:25 8:30
9:35 10:40 11:45 12:50 13:55 14:60 15:65 16:70 17+:75
```

---

## 6. Board generation

`FUN_1f71_0313` builds a level board:

```
do {
  correct = 0
  for cell = 0..29:
      value = FUN_1f71_0077(cell)
      board[cell] = value
      if (value > 0) correct++
} while (correct < 2)
```

`FUN_1f71_0077` is called once per cell. It does `rand(0,2)`; one branch calls
one of five per-mode “correct” generators, the other calls one of five
“distractor” generators. Thus each cell is independently correct with
probability 0.5, and the whole board is rejected/rerolled only if it has fewer
than two correct cells.

* board size: 30 cells, 6 columns × 5 rows;
* expected correct tiles: 15; minimum after reroll: 2;
* distractor tiles: the remaining cells, encoded as negative values;
* the Muncher's start cell is set to 0 after board generation, so it is always
  empty (and the number that was there is discarded);
* the start cell is chosen as `row = rand(0..2)+1`, `col = rand(0..3)+1`,
  `cell = row*6+col`, i.e. the Muncher starts in the interior block rows 1–3,
  columns 1–4 (never the top row or left column) (`FUN_17e7_0ca4`);
* no duplicate-value rejection was found: the same numeric value can appear on
  multiple cells.

The five modes use different generators:

* Multiples — multiples of a key value; max multiplier configurable 3–50;
* Factors — factors of a key value;
* Primes — values tested against the prime table;
* Equality — arithmetic expressions equal to the key;
* Inequality — expressions not equal to the key.

The per-mode ranges/operations come from the difficulty/content settings, not
from a stored question bank. The only stored numeric data is the prime table.

---

## 7. `NM.RES` / graphics `.RES` container format

All three `.RES` files use the same container. It is a simple type/resource
directory, not IFF and not compressed at the container level.

```
u16 data_start          ; offset of first payload (0x124 NM.RES, 0x264 NMCGA, 0x284 NCGA)
u16 unknown             ; 5 for NM.RES, 1 for graphics
type entries (8 bytes each, until data_start):
    char name[4]
    u16  last_index     ; number of entries - 1
    u16  dir_offset     ; absolute offset of this type's entry table
resource entries (16 bytes each):
    u32 id
    u32 offset
    u32 size
    u32 reserved (0)
```

`tools/re/parse_res.py` parses and extracts every resource. Verified layout:
`data_start` equals the end of the last type's entry table, every payload is
contiguous, and the last payload ends exactly at EOF. A full per-resource table
is in **`docs/re/res-inventory.md`**.

### `NM.RES` (28,181 bytes)

| type | id | offset | size | contents |
|---|---|---|---|---|
| `CONF` | 1000 | `0x124` | 2188 | copy of `NM.CFG` (starts `MECC`, product name) |
| `DATA` | 1 | `0x9b0` | 7750 | help/tutorial text script (header `02 00 06 00 86 10`, then text records) |
| `DATA` | 2 | `0x27f6` | 92 | **prime table**: 46 little-endian u16, 2,3,5,7,…,199 |
| `GSND` | 12 | `0x2852` | 3396 | General MIDI/sound data |
| `PSND` | 11 | `0x3596` | 979 | PC speaker sound data |
| `ADLI` | 11–15 | `0x3969`… | 1296–1787 | AdLib instrument banks (5) |
| `SCPT` | 2012,2014,2016,2018,2020 | `0x576b`… | 970–1318 | script bytecode (cutscene/animation), 5 resources |

`SCPT` has a small offset table at the start (`0c 00`, then 12 offsets) and
bytecode records such as `02 09 04 01 01 00 02 0e …`; no plaintext strings.
It is not yet fully decoded.

### `NMCGA.RES` (266,147) / `NCGA.RES` (100,120)

| type | meaning |
|---|---|
| `BTMP` | blit list: records of 12 bytes `{u32 id, u16 f1..f4}`, interpreted as a rectangle. The id matches a `PCXF` resource. |
| `PCXF` | ZSoft PCX image. `NMCGA` uses 8bpp 320×200 (or smaller UI pieces); `NCGA` uses 2bpp CGA (213×182 etc.). The PCX palette trailer is absent; the game installs its palette. |

Examples decoded for documentation (`tools/re/decode_res_pcx.py`):

* `docs/re/extracted/nmcga-pcxf06-320x200-gray.png` — title/credits scene with
  Troggles and “Exploding Muncher”;
* `docs/re/extracted/nmcga-pcxf16-320x200-gray.png` — decorative MECC frame;
* `docs/re/extracted/nmcga-pcxf11-320x93-gray.png` — Muncher/Troggle sprite
  strip and “BOOM!” graphic;
* `docs/re/extracted/ncga-pcxf06-320x200-cga.png` — the CGA version of the
  title scene;
* `docs/re/extracted/ncga-pcxf00-213x182-cga.png` — a CGA UI piece.

These PNGs use a synthetic grayscale/CGA palette because the original palette
is installed by the executable, not stored in the PCX payload.

`NM.RES` contains no question bank; the prime table is the only numeric
question data. All other question values are computed by the generators.

---

## 8. Unresolved / less certain

1. **`FUN_17e7_0e58` delayed jobs.** It creates 1–2 jobs per level with a
   random 210–419 unit delay, a random cell from `FUN_17e7_0aee`, and a type
   1/2. This is likely an extra Troggle spawn / replacement schedule, but the
   exact object type was not proven. The initial count and species tables are
   proven; do not treat 0e58 as another per-tick spawn probability.
2. **Cutscene cadence.** The binary has five `SCPT` resources and no plaintext
   cutscene dialogue. Documented behaviour is a cutscene after **every third
   level** (six scenes total), not every fourth. No `level % 4` logic was found;
   the trigger is in code that Ghidra merged into a large routine. Treat
   “every 3 levels” as the documented external fact, not a binary-confirmed
   one.
3. **Timer feel.** The 34.32 ms timer unit is solid, but the resulting 10.3 s
   level-1 interval is slow. Verify in DOSBox before final tuning.
4. **Safety squares.** The tile flag byte `0x5a3c` has a `0x10` bit that
   `FUN_17e7_036e` treats as “do not eat / protected”. This is consistent with
   the documented safety squares, but the spawn/expiry logic for them was not
   traced.
5. **Score 1,000,000 behaviour.** The routine calls the quit/game-over path at
   the threshold; whether this is a “perfect score” ending or a hard cap was not
   distinguished.
6. **Worker tile rewrite details.** `laborus` calls the per-cell generator on
   the tile it leaves, but the exact re-roll distribution (does it preserve
   correctness class?) was not traced. `assistus` clearing the tile is proven.

---

## 9. Corrections for the remake (actionable)

These are the concrete changes implied by the findings, in priority order.

1. **Troggle tick is not 4000 ms and is not constant.**
   - Base interval table (level 1–12):
     `300,300,270,270,240,210,180,150,120,90,60,30` timer units.
   - Timer unit = 34.32 ms → `10.30, 10.30, 9.27, 9.27, 8.24, 7.21, 6.18,
     5.15, 4.12, 3.09, 2.06, 1.03` s.
   - Add `rand(0..89)` units (0–3.05 s) to every interval, including the first.
   - Level 13+ uses the level-12 values.
   - Remove the fixed 4000 ms constant; drive it from this table + jitter.
   - If playtesting says this is too slow, re-check the timer unit first (it is
     the only inferred multiplier), not the tables.

2. **Implement five species, not one “normalus”.**
   - `normalus` (Reggie): straight, turn ±1 only when blocked; on leaving a
     numbered cell, re-roll it (empty cells stay empty).
   - `laborus` (Worker): 80 % straight, 20 % ±1; on leaving a cell, always
     re-roll its value (it can add a number to an empty cell).
   - `timidus` (Bashful): flee (reverse) when Manhattan distance ≤96 px;
     otherwise random walk with 20 % +1, 20 % −1, 20 % reverse, 40 % straight;
     re-roll a numbered cell it leaves.
   - `assistus` (Helper): same chooser as Worker; on leaving a cell, set its
     value to 0 (it eats the answer).
   - `smarticus` (Smarty): ≤96 px always turn toward Muncher, 96–192 px 50 %
     turn toward, >192 px straight; it restores the tile unchanged.
   - Blocked move: turn ±1 and retry; do not allow overlap. (This DOS build
     does not implement Troggle-vs-Troggle cannibalism.)

3. **Scoring is level-dependent.**
   - `5,5,5,10,15,20,25,30,35,40,45,50,55,60,65,70` for levels 1–16, then 75.
   - A wrong munch costs **one life**, not points.
   - Start with **4 total lives** (show 3 reserve/current+3; the code's counter
     starts at 3 and game-over is `<0`).
   - Award an extra life every **10,000** points.
   - Keep the 1,000,000 (`0xF4240`) score threshold; at/above it the game takes its end/quit path.

4. **Board generation.**
   - 6×5 = 30 cells.
   - Each cell is correct with p=0.5; reroll the whole board if fewer than 2
     correct cells.
   - Correct = positive value; distractor = negative value; empty = 0.
   - Clear the Muncher's starting cell after placement.
   - Allow repeated values (no de-dup).
   - Do not store a question bank; generate arithmetic values and keep the
     46-prime table (2..199) as data if you implement Primes.

5. **Levels.**
   - Displayed level is unbounded; parameter index caps at 12. Levels 13+ reuse
     the level-12 Troggle count/weights/delay but keep increasing points up to
     level 16, then 75.
   - Initial Troggle count: `1,1,1,2,2,2,2,3,3,3,3,3` for levels 1–12, cap 3.
   - Species mix is the 12×5 weight table in §1 #16 (laborus from L4, smarticus
     from L5, timidus from L2, assistus from L3).
   - End a level when no positive tile remains; there is no time limit.
   - Cutscene cadence: documented as every **3** levels, not every 4. If you
     implement 4, that is a deliberate divergence.

6. **Content / menus.**
   - Five modes: Multiples, Factors, Primes, Equality, Inequality; Challenge is
     a randomiser over the five.
   - Equality/Inequality relations: Equals, Less Than, Not Equal to, Greater
     Than; operations: Addition, Subtraction, Multiplication, Division.
   - Difficulty menu: 11 entries (`3rd Grade Easy` … `8th Grade and Above`).
   - Password is an options lock, **not** a level select. Do not build a
     password-to-level-skip feature from this.
   - “Set Content” exposes range, sequence (`in order` / `random`), and
     operation toggles; max multiplier range is 3–50; highest munchable number
     is shown.

7. **Assets.**
   - Use the decoded fonts from `src/assets/font-mecc8x8.json` /
     `font-mecc5x8.json`; do not ship the original `.GFT` files.
   - The 8×8 font is fixed 8 wide; the 5×8 is proportional (5 px + spacing,
     narrower punctuation). The JSON preserves widths.
   - Original PCX/PCX-derived PNGs in `docs/re/extracted/` are documentation
     only; do not copy them into `src/assets/`.

---

## 10. Data table quick reference

All tables are in `NM_UNPACKED.EXE`; DS offset → file offset `+0x2a140`.

| table | DS | file | entries |
|---|---|---|---|
| initial Troggle count | `0x058e` | `0x2a6ce` | 12 u16: 1,1,1,2,2,2,2,3,3,3,3,3 |
| first/inter-move delay | `0x05a6` | `0x2a6e6` | 12 u16: 300,300,270,270,240,210,180,150,120,90,60,30 |
| species weights | `0x05be` | `0x2a6fe` | 12×5 u16 (sum 100 each) |
| slide animation | `0x0636` | `0x2a776` | 12 u16: 3,3,3,3,2,2,2,2,1,1,1,1 |
| points per munch | `0x0654` | `0x2a794` | 16 u16: 5,5,5,10,15,20,25,30,35,40,45,50,55,60,65,70 |
| delayed-job counts (role unresolved) | `0x069c` | `0x2a7dc` | 12 u16: 2,2,2,2,2,2,2,1,1,1,1,1 |
| delayed-job counts (role unresolved) | `0x06b4` | `0x2a7f4` | 12 u16: 1,1,1,0,0,0,0,0,0,0,0,0 |
| prime table | `NM.RES` DATA id 2 | `0x27f6` in NM.RES | 46 u16: 2..199 |

---

## 11. Deliverables / reproduction

* `docs/re/unpacking.md` — LZEXE unpack and address mapping.
* `docs/re/font.md` — `.GFT` format, decode, mapping table.
* `docs/re/font-preview.png` — visual proof of both fonts.
* `docs/re/strings.md` + `docs/re/strings-raw.txt` — in-game text.
* `src/assets/font-mecc8x8.json`, `src/assets/font-mecc5x8.json`.
* `docs/re/extracted/*.png` — documentation-only PCX decodes.
* `tools/re/parse_res.py` — `.RES` parser/extractor.
* `tools/re/decode_fonts.py` — font decoder.
* `tools/re/decode_res_pcx.py` — PCX decoder for the `.RES` images.
* `tools/re/unlzexe.c`, `tools/re/unlzexe` — LZEXE unpacker source/binary.
* `tools/re/ghidra_scripts/DumpAllDecomp.java` — whole-program decompile.
* `tools/re/out/decomp_all.txt`, `tools/re/out/seg_17e7.asm`,
  `tools/re/out/seg_2652.asm` — scratch analysis output (regenerable).
