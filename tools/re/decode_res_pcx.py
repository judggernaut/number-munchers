#!/usr/bin/env python3
"""Decode the PCX payloads inside NMCGA.RES / NCGA.RES (MECC .RES containers).

The .RES resources named PCXF are ordinary ZSoft PCX files (0x0A magic,
RLE encoding) but with no 256-colour palette trailer; the game installs its
own palette. We therefore write documentation PNGs with a synthetic
grayscale / CGA palette. These PNGs are for documentation only.
"""
import os, struct, sys
from PIL import Image

REF = '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc'
OUT = '/Users/judge/Documents/Default Project/number-munchers/docs/re/extracted'

def pcx_decode(path):
    d = open(path, 'rb').read()
    if d[0] != 0x0A:
        raise ValueError('not PCX')
    version, enc, bpp = d[1], d[2], d[3]
    xmin, ymin, xmax, ymax = struct.unpack_from('<HHHH', d, 4)
    nplanes = d[65]
    bpl = struct.unpack_from('<H', d, 66)[0]
    w, h = xmax - xmin + 1, ymax - ymin + 1
    p = 128
    rows = []
    total = bpl * nplanes
    flat = bytearray()
    while len(flat) < total * h and p < len(d):
        b = d[p]; p += 1
        if b >= 0xC0:
            n = b & 0x3F
            v = d[p]; p += 1
            flat += bytes([v]) * n
        else:
            flat.append(b)
    for y in range(h):
        rows.append(bytes(flat[y*total:(y+1)*total]))
    if len(rows[-1]) < total:
        rows[-1] += bytes(total - len(rows[-1]))
    pix = Image.new('RGB', (w, h))
    px = pix.load()
    if bpp == 8 and nplanes == 1:
        for y, row in enumerate(rows):
            for x in range(w):
                v = row[x]
                px[x, y] = (v, v, v)
    elif bpp == 2 and nplanes == 1:
        # CGA 4-colour palette 1 high intensity: black, cyan, magenta, white
        pal = [(0, 0, 0), (0, 255, 255), (255, 0, 255), (255, 255, 255)]
        for y, row in enumerate(rows):
            for x in range(w):
                bit = 6 - (x % 4) * 2
                v = (row[x >> 2] >> bit) & 3
                px[x, y] = pal[v]
    elif bpp == 4 and nplanes == 1:
        pal = [(0,0,0),(0,0,170),(0,170,0),(0,170,170),(170,0,0),(170,0,170),(170,85,0),(170,170,170),
               (85,85,85),(85,85,255),(85,255,85),(85,255,255),(255,85,85),(255,85,255),(255,255,85),(255,255,255)]
        for y, row in enumerate(rows):
            for x in range(w):
                byte = row[x >> 1]
                v = (byte >> 4) if x % 2 == 0 else (byte & 0xF)
                px[x, y] = pal[v]
    else:
        # generic planar decode, map via bit pattern to grayscale
        for y, row in enumerate(rows):
            for x in range(w):
                v = 0
                for pl in range(nplanes):
                    bit = (row[pl*bpl + (x >> 3)] >> (7 - (x & 7))) & 1
                    v = (v << 1) | bit
                g = int(v * 255 / ((1 << nplanes) - 1))
                px[x, y] = (g, g, g)
    return pix, dict(version=version, enc=enc, bpp=bpp, nplanes=nplanes, bpl=bpl, w=w, h=h)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    picks = [
        ('NMCGA', 'PCXF_00_id1006', 'nmcga-pcxf00-211x179-gray.png'),
        ('NMCGA', 'PCXF_06_id2013', 'nmcga-pcxf06-320x200-gray.png'),
        ('NMCGA', 'PCXF_11_id3013', 'nmcga-pcxf11-320x93-gray.png'),
        ('NMCGA', 'PCXF_16_id6003', 'nmcga-pcxf16-320x200-gray.png'),
        ('NCGA', 'PCXF_00_id1000', 'ncga-pcxf00-213x182-cga.png'),
        ('NCGA', 'PCXF_06_id2012', 'ncga-pcxf06-320x200-cga.png'),
    ]
    for base, stem, out in picks:
        src = f'/Users/judge/Documents/Default Project/number-munchers/tools/re/out/res/{base}/{stem}.bin'
        im, meta = pcx_decode(src)
        im.save(os.path.join(OUT, out))
        print(out, meta)
