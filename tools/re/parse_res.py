#!/usr/bin/env python3
"""Parse MECC .RES containers (Number Munchers 1990 DOS).

Layout derived by inspection (see docs/re/original-analysis.md):
  u16 data_start            offset of first resource payload
  u16 unknown              (0x0005 for NM.RES, 0x0001 for CGA/VGA res)
  repeat until data_start:
      char name[4]
      u16  last_index       number_of_entries - 1
      u16  dir_offset       absolute file offset of this type's entry table
  entry (16 bytes):
      u32 offset, u32 size, u32 zero, u32 id
"""
import struct, sys, os, json

def parse(path):
    d = open(path, 'rb').read()
    data_start, unk = struct.unpack_from('<HH', d, 0)
    types = []
    p = 4
    while p + 8 <= data_start:
        name = d[p:p+4].decode('latin1')
        if not all(32 <= ord(c) < 127 for c in name):
            break
        last, off = struct.unpack_from('<HH', d, p+4)
        types.append((name, last, off))
        p += 8
    out = []
    for name, last, off in types:
        n = last + 1
        for i in range(n):
            eo = off + i*16
            rid, o, sz, z = struct.unpack_from('<IIII', d, eo)
            out.append(dict(type=name, index=i, offset=o, size=sz, zero=z, id=rid))
    return dict(file=path, size=len(d), data_start=data_start, unknown=unk,
                types=[dict(name=n, count=l+1, dir_offset=o) for n, l, o in types],
                resources=out, data=d)

if __name__ == '__main__':
    for path in sys.argv[1:]:
        info = parse(path)
        d = info['data']
        base = os.path.basename(path).rsplit('.', 1)[0]
        outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'res', base)
        os.makedirs(outdir, exist_ok=True)
        print(f"== {path}: {info['size']} bytes, data_start=0x{info['data_start']:x}, unknown={info['unknown']}")
        for t in info['types']:
            print(f"   type {t['name']!r} count={t['count']} dir=0x{t['dir_offset']:x}")
        for r in info['resources']:
            fn = f"{r['type']}_{r['index']:02d}_id{r['id']:d}.bin"
            open(os.path.join(outdir, fn), 'wb').write(d[r['offset']:r['offset']+r['size']])
            print(f"   {r['type']:4s}[{r['index']}] off=0x{r['offset']:06x} size={r['size']:6d} id={r['id']:5d} -> {fn}")
        with open(os.path.join(outdir, 'index.json'), 'w') as f:
            json.dump({k: v for k, v in info.items() if k != 'data'}, f, indent=1)
