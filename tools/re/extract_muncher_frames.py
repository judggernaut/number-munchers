#!/usr/bin/env python3
"""Extract the Muncher animation frames from the original game files.

Reproduces the pack in public/sprites/muncher from NCGA/NMCGA .RES data:

  1. tools/re/parse_res.py dumps the PCXF sheets and BTMP blit lists.
  2. This script decodes the 8bpp PCXF muncher sheet (NMCGA, id 1006), maps its
     seven colour indices to the game palette, slices the frames with
     connected components, and writes them plus a manifest.

The palette is applied by role (background, body, highlight, shade, eyes)
because the game installs its palette at runtime from code we have not
located; the role mapping matches the published rip of the same art exactly.

Usage:
  python3 tools/re/extract_muncher_frames.py [output_dir]

Output dir defaults to public/sprites/muncher. Documentation PNGs (never
committed) land in ref/sprites.
"""
import json
import os
import struct
import sys
from collections import Counter

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RES_OUT = os.path.join(HERE, 'out', 'res')
SHEET = os.path.join(RES_OUT, 'NMCGA', 'PCXF_00_id1006.bin')

# index -> (r, g, b); index 0 is the sheet background.
PALETTE = {
    0: (0, 0, 120),
    104: (0, 128, 0),
    108: (0, 228, 0),
    3: (8, 132, 0),
    109: (252, 252, 252),
    110: (4, 112, 0),
    111: (4, 88, 0),
}

# The neutral pose (mouth line visible) is the sheet's first frame. Picking by
# silhouette fullness was wrong: the fullest frame has no mouth line at all.
REST_FRAME = 0


def decode_pcx_indices(path):
    data = open(path, 'rb').read()
    if data[0] != 0x0A:
        raise ValueError('not a PCX file')
    xmin, ymin, xmax, ymax = struct.unpack_from('<HHHH', data, 4)
    bytes_per_line = struct.unpack_from('<H', data, 66)[0]
    width, height = xmax - xmin + 1, ymax - ymin + 1
    pos = 128
    flat = bytearray()
    need = bytes_per_line * height
    while len(flat) < need and pos < len(data):
        byte = data[pos]
        pos += 1
        if byte >= 0xC0:
            run = byte & 0x3F
            value = data[pos]
            pos += 1
            flat += bytes([value]) * run
        else:
            flat.append(byte)
    rows = [bytes(flat[y * bytes_per_line:(y + 1) * bytes_per_line]) for y in range(height)]
    return rows, width, height


def main(out_dir):
    rows, width, height = decode_pcx_indices(SHEET)
    used = Counter(row[x] for row in rows for x in range(width))
    unknown = [index for index in used if index not in PALETTE]
    if unknown:
        raise SystemExit(f'unmapped colour indices: {unknown}; update PALETTE')

    image = Image.new('RGBA', (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            pixels[x, y] = PALETTE[rows[y][x]]

    mask = [[rows[y][x] != 0 for x in range(width)] for y in range(height)]
    seen = [[False] * width for _ in range(height)]
    blocks = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or seen[y][x]:
                continue
            stack = [(x, y)]
            seen[y][x] = True
            points = []
            while stack:
                cx, cy = stack.pop()
                points.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            blocks.append((min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1, points))
    blocks.sort(key=lambda b: (b[1] // 14, b[0]))
    if len(blocks) < 8:
        raise SystemExit(f'only found {len(blocks)} frames; sheet layout changed?')

    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, name))

    frames = []
    for index, (bx, by, bw, bh, points) in enumerate(blocks):
        frame = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        fp = frame.load()
        for x, y in points:
            fp[x - bx, y - by] = pixels[x, y]
        name = f'nm-{index:02d}.png'
        frame.save(os.path.join(out_dir, name))
        frames.append(name)
        print(f'{name}: {bw}x{bh} at ({bx},{by})')

    rest = frames[REST_FRAME]
    manifest = {'frames': frames, 'rest': rest}
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as handle:
        json.dump(manifest, handle, indent=1)
    print(f'wrote {len(frames)} frames, rest={rest} -> {out_dir}')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'public', 'sprites', 'muncher')
    main(os.path.abspath(out))
