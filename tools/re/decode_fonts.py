#!/usr/bin/env python3
"""Decode MECC5X8.GFT / MECC8X8.GFT (Number Munchers 1990, DOS).

Format (derived from the loader at FUN_2d57_00.. and verified against the data):
  header 84 bytes:
    0x04  char[8]  tag ("MECC8X8"/"NEW5X8")
    0x24  u16      first glyph index (0)
    0x26  u16      last glyph index (255)
    0x2a  u16      bytes per glyph row? (6)
    0x32  u16      nominal width  (8; font is proportional in the 5x8)
    0x34  u16      height (8)
    0x48  u16      header size (0x54)
    0x4c  u16      start of glyph bitstream (0x256)
    0x50  u16      ... (unused here)
    0x52  u16      height again? (8)
    0x54  u16[256+1] cumulative BIT offset of each glyph WITHIN one scanline row
  glyph bitstream at 0x256:
    for row 0..height-1:
      for glyph 0..255:
        width[g] bits, MSB first, where width[g] = off[g+1]-off[g]
    each row is padded to a byte boundary.
The 8x8 font is fixed 8 bits wide; the 5x8 is proportional (5 pixels + 1 px
spacing for most glyphs, narrower for punctuation).
"""
import json, struct, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REF = '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc'
REPO = '/Users/judge/Documents/Default Project/number-munchers'

def load(fn):
    d = open(os.path.join(REF, fn), 'rb').read()
    tag = d[4:12].split(b'\0')[0].decode('latin1')
    first, last = struct.unpack_from('<HH', d, 0x24)
    width, height = struct.unpack_from('<HH', d, 0x32)
    data_off = struct.unpack_from('<H', d, 0x4c)[0]
    off = [struct.unpack_from('<H', d, 0x54 + i*2)[0] for i in range(257)]
    data = d[data_off:]
    row_bits = ((off[256] + 7)//8)*8
    def bit(pos):
        return (data[pos >> 3] >> (7 - (pos & 7))) & 1
    glyphs = {}
    widths = {}
    for g in range(first, last+1):
        w = off[g+1] - off[g]
        widths[g] = w
        rows = []
        for r in range(height):
            rows.append(''.join(str(bit(r*row_bits + off[g] + c)) for c in range(w)))
        glyphs[g] = rows
    return dict(tag=tag, width=width, height=height, glyphs=glyphs, widths=widths,
                data_off=data_off, row_bits=row_bits)

def make_json(font, path, proportional=False, cell_width=None):
    out = {
        'cellWidth': cell_width if cell_width is not None else font['width'],
        'cellHeight': font['height'],
        'proportional': proportional,
        'source': font['tag'] + '.GFT',
        'glyphs': {}
    }
    for g in range(0x20, 0x7f):
        ch = chrys(g)
        out['glyphs'][ch] = font['glyphs'][g]
    # natural widths are useful for the proportional 5x8
    if proportional:
        out['widths'] = {chrys(g): font['widths'][g] for g in range(0x20, 0x7f)}
    with open(path, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

def chrys(g):
    return chr(g)

def sheet(font8, font5, path):
    S = 4
    W, H = 1400, 900
    im = Image.new('RGB', (W, H), (18, 18, 22))
    dr = ImageDraw.Draw(im)
    try:
        fnt = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 18)
        fnt_s = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
    except Exception:
        fnt = fnt_s = ImageFont.load_default()

    def draw_glyph(font, ch, x, y, scale=1):
        rows = font['glyphs'][ord(ch)]
        for r, row in enumerate(rows):
            for c, b in enumerate(row):
                if b == '1':
                    dr.rectangle([x+c*scale, y+r*scale, x+c*scale+scale-1, y+r*scale+scale-1], fill=(240,240,240))

    # sample text using the 8x8 font
    text = 'Number Munchers 0123456789 +-x/()=.,:;!?%$<>#*'
    x, y = 30, 40
    dr.text((x, y-24), 'MECC8X8.GFT  (8x8 fixed)', font=fnt, fill=(255,220,80))
    for ch in text:
        rows = font8['glyphs'][ord(ch)]
        for r, row in enumerate(rows):
            for c, b in enumerate(row):
                if b == '1':
                    dr.rectangle([x+c*2, y+r*2, x+c*2+1, y+r*2+1], fill=(255,255,255))
        x += len(rows[0])*2 + 2
        if x > W-40:
            x, y = 30, y+40
    # second sample, 5x8
    y += 60
    dr.text((30, y-24), 'MECC5X8.GFT  (5x8 proportional)', font=fnt, fill=(255,220,80))
    x = 30
    for ch in text:
        rows = font5['glyphs'][ord(ch)]
        for r, row in enumerate(rows):
            for c, b in enumerate(row):
                if b == '1':
                    dr.rectangle([x+c*3, y+r*3, x+c*3+2, y+r*3+2], fill=(255,255,255))
        x += len(rows[0])*3 + 3
        if x > W-40:
            x, y = 30, y+40
    # character grid: ASCII 0x20-0x7e, 8x8
    y += 70
    dr.text((30, y-24), 'ASCII 0x20-0x7E, MECC8X8', font=fnt, fill=(255,220,80))
    x0, y0 = 30, y
    cw, chh = 44, 44
    for i, g in enumerate(range(0x20, 0x7f)):
        cx = x0 + (i % 16)*cw
        cy = y0 + (i // 16)*chh
        dr.text((cx, cy-14), f'{g:02X}', font=fnt_s, fill=(120,200,255))
        rows = font8['glyphs'][g]
        for r, row in enumerate(rows):
            for c, b in enumerate(row):
                if b == '1':
                    dr.rectangle([cx+c*3, cy+r*3, cx+c*3+2, cy+r*3+2], fill=(255,255,255))
    im.save(path)

if __name__ == '__main__':
    f8 = load('MECC8X8.GFT')
    f5 = load('MECC5X8.GFT')
    print(f8['tag'], f8['width'], f8['height'], f8['data_off'], f8['row_bits'])
    print(f5['tag'], f5['width'], f5['height'], f5['data_off'], f5['row_bits'])
    make_json(f8, os.path.join(REPO, 'src/assets/font-mecc8x8.json'))
    make_json(f5, os.path.join(REPO, 'src/assets/font-mecc5x8.json'), proportional=True, cell_width=6)
    os.makedirs(os.path.join(REPO, 'docs/re'), exist_ok=True)
    sheet(f8, f5, os.path.join(REPO, 'docs/re/font-preview.png'))
    print('written')
