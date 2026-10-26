# Documentation-only extracted bitmaps

These PNGs were decoded from `NMCGA.RES` / `NCGA.RES` `PCXF` resources.
They are **documentation only** and must not be copied into `src/assets/`.

The original PCX payloads have **no palette trailer**; the game installs its
palette at runtime. Therefore:

* `*-gray.png` uses an index→grayscale mapping (NMCGA 8bpp);
* `*-cga.png` uses the standard high-intensity CGA palette 1
  (black/cyan/magenta/white) for the NCGA 2bpp images.

The shapes/layout are correct; the colours are synthetic.

| file | source resource | decoded size |
|---|---|---|
| `nmcga-pcxf06-320x200-gray.png` | NMCGA PCXF id 2013 | 320×200 |
| `nmcga-pcxf16-320x200-gray.png` | NMCGA PCXF id 6003 | 320×200 |
| `nmcga-pcxf11-320x93-gray.png` | NMCGA PCXF id 3013 | 320×93 |
| `nmcga-pcxf00-211x179-gray.png` | NMCGA PCXF id 1006 | 211×179 |
| `ncga-pcxf06-320x200-cga.png` | NCGA PCXF id 2012 | 320×200 |
| `ncga-pcxf00-213x182-cga.png` | NCGA PCXF id 1000 | 213×182 |

Reproduce with `tools/re/decode_res_pcx.py`.
