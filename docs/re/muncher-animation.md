# Muncher sprite animation (from the original code)

How the 1990 game animates the Muncher, read out of `NM_UNPACKED.EXE` with
Ghidra/REA. Pseudocode dumps: `tools/re/out/functions/`.

## Sprite engine

`FUN_2652_0153(id)` looks up a sprite group in a 16-entry table at
`DS:0x2c16` (40 bytes per entry). Layout recovered so far:

| offset | meaning | evidence |
| --- | --- | --- |
| +0 | group id | `0153` compares entries by id |
| +4 | current frame | `FUN_2652_0514(group, n)` writes it, `FUN_2652_03bd(group)` reads it |
| +6 | visible/state | `FUN_2652_056a(group, n)` writes it |
| +8..+0xe | position | `FUN_2652_0537(group, n)` writes it |

`FUN_17e7_1c7f(group, frame, sign)` → `FUN_2652_04ea` draws a group's frame.
The Muncher is **group 4**.

## Frame roles (group 4)

| moment | frame | function |
| --- | --- | --- |
| munch | 0 → 6, one pass, 7 scheduler ticks (~240 ms) | `FUN_17e7_1539` |
| standing / placement | 4 | `FUN_17e7_1c31` |
| walking (cell slide) | 3 — the same bitmap as 4 | `FUN_17e7_11dd` |
| wrong munch | 2 | `FUN_17e7_13f2` |
| caught by a Troggle | 6 | `FUN_17e7_21d9` |

Two consequences worth calling out:

1. **The mouth does not animate while walking.** The slide routine pins a
   single static pose (frames 3 and 4 are the same art). All mouth animation
   happens inside the 7-frame munch.
2. **The munch is one pass, not a loop** — counter 0..6, then the tile
   resolves (score/lives update).

## Frame table (BTMP resource 1006)

The Muncher sheet is `PCXF` id 1006 in `NMCGA.RES` (8bpp, 211x179; the CGA
twin is `NCGA.RES` id 1000). Its frame table is the `BTMP` resource id 1006:
12-byte records

```
(u16 pcxf_id, u16 0, u16 y1, u16 x1, u16 y2, u16 x2)
```

— note the **swapped axes** — followed by three `(140, n)` marker records that
are not rectangles. Swapped, all 16 rectangles land on the sheet's frame cells
(columns at x = 17/65/113/161, step 48; rows at y = 21/61/101/141, step 40),
which is what validates the reading. The 24x20 frames in the last row
(components nm-10..12 in sheet order) are not referenced by this table — they
belong to some other group (likely the small Muncher used in the HUD/menus).

## Palette

The PCX has no palette trailer; the game installs one at runtime from code we
have not located (no DAC table found in the EXE). The extractor applies the
palette by role — background, body, highlight, shade, eyes — which reproduces
the published rip of the same art exactly.

## Reproducing the pack

```bash
python3 tools/re/parse_res.py <NMCGA.RES>          # dumps PCXF/BTMP payloads
python3 tools/re/extract_muncher_frames.py         # writes public/sprites/muncher
```

The extractor emits the 16-frame table in blit order plus the roles above; the
game loads the 7-frame munch cycle and the frame-4 rest pose from its manifest.
