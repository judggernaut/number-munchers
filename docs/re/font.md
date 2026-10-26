# MECC bitmap fonts (`.GFT`) — format and decode

Fonts in the DOS release:

| file | size | tag in header | nominal cell |
|---|---|---|---|
| `MECC8X8.GFT` | 2646 | `MECC8X8` | 8×8, fixed width |
| `MECC5X8.GFT` | 1198 | `NEW5X8` | 5×8 + 1 px spacing, proportional |

Both decode successfully. The decoded data is written to:

* `src/assets/font-mecc8x8.json`
* `src/assets/font-mecc5x8.json`

and the visual proof is `docs/re/font-preview.png` (rendered from the JSON,
not from the original bitmaps).

## Format

The header is 84 (`0x54`) bytes. All multi-byte values are little-endian.

| offset | type | meaning |
|---|---|---|
| `0x04` | char[8] | ASCII tag (`MECC8X8`, `NEW5X8`) |
| `0x24` | u16 | first glyph index (0) |
| `0x26` | u16 | last glyph index (255) |
| `0x2a` | u16 | row/glyph unit (6 in both files) |
| `0x32` | u16 | nominal width (8) |
| `0x34` | u16 | height (8) |
| `0x48` | u16 | header size = `0x54` |
| `0x4c` | u16 | start of glyph bitstream = `0x256` |
| `0x50` | u16 | implementation field (not needed) |
| `0x52` | u16 | height again (8) |
| `0x54` | u16[257] | cumulative **bit** offsets of glyphs **within one scanline row** |

The crucial point is that the glyphs are **bit-packed by scanline row**, not
stored as byte-aligned 8-byte tiles:

```
for row in 0..height-1:
    for glyph in 0..255:
        width[glyph] bits, MSB first, at bit offset (row_stride + off[glyph])
```

where `width[g] = off[g+1] - off[g]` and each row is padded to a byte
boundary (`row_stride = ceil(off[256]/8)*8`). For `MECC8X8.GFT`:
`off[256]=2041`, row stride 2048 bits, 8 rows = 2048 bytes. For
`MECC5X8.GFT`: `off[256]=598`, row stride 600 bits, 8 rows = 600 bytes.
Those exactly match the file sizes after the 598-byte header+table region.

This layout is confirmed by the game's own loader, which converts the
cumulative table into per-glyph widths and then re-expands the bit stream into
byte-aligned scanlines (Ghidra function around `FUN_2d57` / the font-load
routine; see `tools/re/out/decomp_all.txt`). It is also confirmed by the
contact sheet: re-assembling with any other interpretation produces noise,
whereas this one gives clean `A`–`Z`, digits, and punctuation.

### `MECC8X8.GFT`

* fixed 8 pixels wide, 8 rows, row strings always length 8;
* ASCII `0x20..0x7E` is complete and correct;
* the high half (`0x80..0xFF`) is **not** CP437 box-drawing/accented text — it
  decodes to unrelated patterns, so it is deliberately not included in the
  JSON. Only ASCII printable is trusted.

### `MECC5X8.GFT`

* proportional: most glyphs are 5 pixels + 1 blank spacing column (width 6),
  punctuation is narrower (`!`=2, `'`=3, `(`=3, etc.);
* the JSON preserves each glyph's natural width and also exports a `widths`
  map;
* ASCII `0x20..0x7E` is complete and correct;
* only `0xFF` is non-blank in the high half.

### JSON shape

```json
{
  "cellWidth": 8,
  "cellHeight": 8,
  "proportional": false,
  "glyphs": {
    "A": ["00111100", "01100110", "..."]
  }
}
```

`cellWidth` is the nominal cell (6 for the 5×8 font, because of the spacing
column). For the proportional font each glyph can be narrower; row strings
have one `"0"`/`"1"` per pixel and therefore give the true bitmap.

## ASCII mapping table

Width columns are the decoded bitmap widths. The 8×8 font is fixed at 8.

| code | char | 8×8 width | 5×8 width |
|---|---|---|---|
| `20` | ` ` | 8 | 6 |
| `21` | `!` | 8 | 2 |
| `22` | `"` | 8 | 4 |
| `23` | `#` | 8 | 6 |
| `24` | `$` | 8 | 6 |
| `25` | `%` | 8 | 6 |
| `26` | `&` | 8 | 6 |
| `27` | `\'` | 8 | 3 |
| `28` | `(` | 8 | 3 |
| `29` | `)` | 8 | 3 |
| `2A` | `*` | 8 | 6 |
| `2B` | `+` | 8 | 6 |
| `2C` | `,` | 8 | 3 |
| `2D` | `-` | 8 | 6 |
| `2E` | `.` | 8 | 3 |
| `2F` | `/` | 8 | 6 |
| `30` | `0` | 8 | 6 |
| `31` | `1` | 8 | 6 |
| `32` | `2` | 8 | 6 |
| `33` | `3` | 8 | 6 |
| `34` | `4` | 8 | 6 |
| `35` | `5` | 8 | 6 |
| `36` | `6` | 8 | 6 |
| `37` | `7` | 8 | 6 |
| `38` | `8` | 8 | 6 |
| `39` | `9` | 8 | 6 |
| `3A` | `:` | 8 | 3 |
| `3B` | `;` | 8 | 3 |
| `3C` | `<` | 8 | 5 |
| `3D` | `=` | 8 | 6 |
| `3E` | `>` | 8 | 5 |
| `3F` | `?` | 8 | 6 |
| `40` | `@` | 8 | 6 |
| `41` | `A` | 8 | 6 |
| `42` | `B` | 8 | 6 |
| `43` | `C` | 8 | 6 |
| `44` | `D` | 8 | 6 |
| `45` | `E` | 8 | 6 |
| `46` | `F` | 8 | 6 |
| `47` | `G` | 8 | 6 |
| `48` | `H` | 8 | 6 |
| `49` | `I` | 8 | 4 |
| `4A` | `J` | 8 | 6 |
| `4B` | `K` | 8 | 6 |
| `4C` | `L` | 8 | 6 |
| `4D` | `M` | 8 | 6 |
| `4E` | `N` | 8 | 6 |
| `4F` | `O` | 8 | 6 |
| `50` | `P` | 8 | 6 |
| `51` | `Q` | 8 | 6 |
| `52` | `R` | 8 | 6 |
| `53` | `S` | 8 | 6 |
| `54` | `T` | 8 | 6 |
| `55` | `U` | 8 | 6 |
| `56` | `V` | 8 | 6 |
| `57` | `W` | 8 | 6 |
| `58` | `X` | 8 | 6 |
| `59` | `Y` | 8 | 6 |
| `5A` | `Z` | 8 | 6 |
| `5B` | `[` | 8 | 4 |
| `5C` | `\\` | 8 | 6 |
| `5D` | `]` | 8 | 4 |
| `5E` | `^` | 8 | 6 |
| `5F` | `_` | 8 | 6 |
| `60` | `\`` | 8 | 3 |
| `61` | `a` | 8 | 6 |
| `62` | `b` | 8 | 6 |
| `63` | `c` | 8 | 6 |
| `64` | `d` | 8 | 6 |
| `65` | `e` | 8 | 6 |
| `66` | `f` | 8 | 5 |
| `67` | `g` | 8 | 6 |
| `68` | `h` | 8 | 6 |
| `69` | `i` | 8 | 4 |
| `6A` | `j` | 8 | 5 |
| `6B` | `k` | 8 | 6 |
| `6C` | `l` | 8 | 4 |
| `6D` | `m` | 8 | 6 |
| `6E` | `n` | 8 | 6 |
| `6F` | `o` | 8 | 6 |
| `70` | `p` | 8 | 6 |
| `71` | `q` | 8 | 6 |
| `72` | `r` | 8 | 6 |
| `73` | `s` | 8 | 6 |
| `74` | `t` | 8 | 5 |
| `75` | `u` | 8 | 6 |
| `76` | `v` | 8 | 6 |
| `77` | `w` | 8 | 6 |
| `78` | `x` | 8 | 6 |
| `79` | `y` | 8 | 6 |
| `7A` | `z` | 8 | 6 |
| `7B` | `{` | 8 | 5 |
| `7C` | `\|` | 8 | 2 |
| `7D` | `}` | 8 | 5 |
| `7E` | `~` | 8 | 6 |

## Reproduce

```sh
cd tools/re
python3 decode_fonts.py
```

This rewrites both JSON files and `docs/re/font-preview.png`. The decoder is
`tools/re/decode_fonts.py`.

## What was ruled out

* **Byte-aligned 8-byte glyphs** (the naive reading of `off[]/8`): produces
  garbage, because the offsets are bit offsets and each row interleaves all
  256 glyphs.
* **Column-major bytes** (6 bytes per 5×8 glyph): produces plausible-looking
  but wrong shapes and fails for `A`.
* **CP437 high-half mapping** for the 8×8 font: `0xDB` (CP437 full block) is
  not a full block in this file. The high half is not a standard CP437 font.
* **A separate code-page table** in the file: none is present; ASCII order is
  used directly, as proven by the clean `0x20..0x7E` decode.
