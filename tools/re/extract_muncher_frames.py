#!/usr/bin/env python3
"""Extract the Muncher animation from the original game files, authentically.

What this reproduces (see docs/re/original-analysis.md):

  * The Muncher sheet is the PCXF resource id 1006 inside NMCGA.RES
    (8bpp, palette installed by the EXE at runtime).
  * The frame table is the BTMP resource id 1006: 12-byte records
    (pcxf_id, 0, y1, x1, y2, x2) - note the swapped axes - followed by
    three (140, n) marker records that are not frame rectangles.
  * Frame roles come from the disassembly:
      munch  = frames 0..6, one pass, 7 scheduler ticks (~240 ms)
      stand  = frame 4, walk = frame 3 (the same bitmap: no mouth animation
               while moving)
      ouch   = frame 2 (wrong munch), caught = frame 6 (Troggle contact)

Palette note: the game installs its palette from code we have not located, so
colours are applied by role (background, body, highlight, shade, eyes), which
matches the published rip of the same artwork exactly.

Usage:
  python3 tools/re/parse_res.py <your copies of NMCGA.RES>   # dumps PCXF/BTMP
  python3 tools/re/extract_muncher_frames.py [output_dir]

Output dir defaults to public/sprites/muncher (git-ignored: MECC artwork).
"""
import json
import os
import struct
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, 'out', 'res', 'NMCGA', 'PCXF_00_id1006.bin')
BTMP = os.path.join(HERE, 'out', 'res', 'NMCGA', 'BTMP_00_id1006.bin')

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

# Frame roles, from the disassembly of NM_UNPACKED.EXE.
MUNCH = [0, 1, 2, 3, 4, 5, 6]   # FUN_17e7_1539
REST = 4                        # FUN_17e7_1c31 (walk uses 3, same bitmap)
OUCH = 2                        # FUN_17e7_13f2
CAUGHT = 6                      # FUN_17e7_21d9


def decode_pcx_indices(path):
    data = open(path, 'rb').read()
    if data[0] != 0x0A:
        raise ValueError('not a PCX file')
    xmin, ymin, xmax, ymax = struct.unpack_from('<HHHH', data, 4)
    bpl = struct.unpack_from('<H', data, 66)[0]
    width, height = xmax - xmin + 1, ymax - ymin + 1
    pos = 128
    flat = bytearray()
    need = bpl * height
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
    rows = [bytes(flat[y * bpl:(y + 1) * bpl]) for y in range(height)]
    return rows, width, height


def connected_components(rows, width, height):
    mask = [[rows[y][x] != 0 for x in range(width)] for y in range(height)]
    seen = [[False] * width for _ in range(height)]
    comps = []
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
            comps.append((min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1, points))
    return comps


def frame_table(btmp_path, comps):
    """BTMP records -> the frame components, in blit-list order."""
    data = open(btmp_path, 'rb').read()
    table = []
    for i in range(len(data) // 12):
        rid, flag, y1, x1, y2, x2 = struct.unpack_from('<6H', data, i * 12)
        if not (x2 or y2):
            continue  # (140, n) marker records are not rectangles
        hits = [
            comp for comp in comps
            if x1 - 6 <= comp[0] + comp[2] / 2 <= x2 + 6
            and y1 - 6 <= comp[1] + comp[3] / 2 <= y2 + 6
        ]
        if len(hits) != 1:
            raise SystemExit(f'BTMP rect {(y1, x1, y2, x2)} matched {len(hits)} frames')
        table.append(hits[0])
    if len(table) < 8:
        raise SystemExit(f'only {len(table)} frame rects; BTMP format changed?')
    return table


def main(out_dir):
    rows, width, height = decode_pcx_indices(SHEET)
    image = Image.new('RGBA', (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            pixels[x, y] = PALETTE.get(rows[y][x], (255, 0, 255))

    comps = connected_components(rows, width, height)
    table = frame_table(BTMP, comps)

    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, name))

    names = []
    for index, (bx, by, bw, bh, points) in enumerate(table):
        frame = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        fp = frame.load()
        for x, y in points:
            fp[x - bx, y - by] = pixels[x, y]
        name = f'nm-{index:02d}.png'
        frame.save(os.path.join(out_dir, name))
        names.append(name)
        print(f'{name}: {bw}x{bh}')

    manifest = {
        'frames': names,
        'munch': MUNCH,
        'rest': REST,
        'ouch': OUCH,
        'caught': CAUGHT,
        'source': 'NMCGA.RES PCXF/BTMP 1006; roles from NM.EXE FUN_17e7_1539/1c31/11dd/13f2/21d9',
    }
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as handle:
        json.dump(manifest, handle, indent=1)
    print(f'wrote {len(names)} frames; munch={MUNCH} rest={REST} ouch={OUCH} caught={CAUGHT}')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'public', 'sprites', 'muncher')
    main(os.path.abspath(out))
