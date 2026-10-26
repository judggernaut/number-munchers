# Unpacking `NM.EXE` (Number Munchers, DOS 1990)

The shipped `NM.EXE` is compressed with **LZEXE 0.91**. It is not directly
loadable/analysable as an MZ image because its entry point is the LZEXE
decompressor stub, not the game.

## Evidence that it is LZEXE 0.91

```
$ xxd -l 0x20 NM.EXE
00000000: 4d5a bf00 c000 0000 0200 6017 ffff 692e  MZ........`...i.
00000010: 8000 0000 0e00 1217 1c00 0000 4c5a 3931  ............LZ91
```

* bytes `0x1c..0x1f` are the ASCII tag **`LZ91`** (LZEXE 0.91), which is also
  where `e_lfarlc` points.
* `e_cparhdr = 2` paragraphs: the MZ header is a minimal 32-byte stub header.
* the first code at `CS:IP = 0x1712:0x000e` is the LZEXE decompression stub
  (`MOV DX,0x2734` style segment setup, `INT 21h`, relocation loop, etc.).

## Unpacker used

LZEXE is a well-known format. I used the small public-domain C implementation
`unlzexe.c` (Kou/Sasada lineage, mirrored at
<https://github.com/mywave82/unlzexe>), compiled locally. No DOS emulator and
no Windows executable was run.

```sh
cd tools/re
curl -fsSL https://raw.githubusercontent.com/mywave82/unlzexe/master/unlzexe.c -o unlzexe.c
cc -O2 -w -o unlzexe unlzexe.c

cp '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc/NM.EXE' NM_PACKED.EXE
./unlzexe NM_PACKED.EXE NM_UNPACKED.EXE
```

`unlzexe` writes an 8.3-truncated output name (`NM_UNPACKED.`), so rename it:

```sh
mv 'NM_UNPACKED.' NM_UNPACKED.EXE
```

The unpacker is kept at `tools/re/unlzexe.c` / `tools/re/unlzexe`, and the
input/output copies at `tools/re/NM_PACKED.EXE` and
`tools/re/NM_UNPACKED.EXE`, so this is reproducible.

## Verification

```
$ ls -l NM_PACKED.EXE NM_UNPACKED.EXE
97983  NM_PACKED.EXE
198128 NM_UNPACKED.EXE

$ shasum -a 256 NM_PACKED.EXE NM_UNPACKED.EXE
2045daee393b5520c9709fa18b70800b4578abac3f12d5c8c246dbb46534d670  NM_PACKED.EXE
de42f666542c0ef84b6dd5f0fe49cfaa06ebb79cc05daa5b9f0e74ebd9b994c3  NM_UNPACKED.EXE

$ file NM_UNPACKED.EXE
NM_UNPACKED.EXE: MS-DOS executable
```

Additional checks:

* starts with `4d 5a` (`MZ`); `e_magic`/`e_cparhdr` sane;
* header size = `0x02e0` paragraphs = **11776 bytes (`0x2e00`)**;
* readable game strings are present, e.g. at file offsets `0x2b413`
  (`normalus`), `0x2b586` (`Multiples of`), `0x2b5db` (`Score: `);
* Ghidra 12.1.2 (`rea`, provider `ghidra`) imports it as `dos-mz`, `x86`,
  `x86:LE:16:Real Mode` and finds **865 functions / 259 defined strings**
  (plus many more undefined strings).

## Address / file-offset mapping used throughout `docs/re`

The unpacked MZ loads its image at linear address `0x10000` in Ghidra's
coordinates, and the load image begins at file offset `0x2e00`. Therefore:

```
linear_address = file_offset - 0x2e00 + 0x10000
file_offset    = linear_address - 0x10000 + 0x2e00
```

The Turbo-C data segment (`DGROUP`) is at `DS = 0x3734`, which is linear
`0x37340` and file offset **`0x2a140`**. A DS-relative offset `x` therefore
maps to:

```
file_offset = 0x2a140 + x
linear      = 0x37340 + x
```

Examples used in the findings:

| item | DS offset | file offset |
|---|---|---|
| `normalus` | `0x12d3` | `0x2b413` |
| points-per-munch table | `0x0654` | `0x2a794` |
| troggle count table | `0x058e` | `0x2a6ce` |
| species weight table | `0x05be` | `0x2a6fe` |
| troggle initial-delay table | `0x05a6` | `0x2a6e6` |
| troggle animation-delay table | `0x0636` | `0x2a776` |

## REA / Ghidra invocation

```sh
export GHIDRA_INSTALL_DIR=/Users/judge/.local/share/ghidra/ghidra_12.1.2_PUBLIC
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

rea capabilities                 # provider id: ghidra
rea analyze NM_UNPACKED.EXE --provider ghidra --snapshot ./nm-snap --format json
rea search  NM_UNPACKED.EXE normalus --snapshot ./nm-snap --format json
rea function NM_UNPACKED.EXE 0x17e7a --snapshot ./nm-snap --format json
```

The whole-program decompilation used in this work was produced once with
`tools/re/ghidra_scripts/DumpAllDecomp.java`:

```sh
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$PWD/ghidra_proj" nmproj \
  -import "$PWD/NM_UNPACKED.EXE" \
  -scriptPath "$PWD/ghidra_scripts" \
  -postScript DumpAllDecomp.java "$PWD/out/decomp_all.txt" \
  -deleteProject
```

`out/decomp_all.txt` is a 3.35 MB text dump of all 865 functions; it is
scratch output and can be regenerated. `tools/re/out/seg_17e7.asm` and
`tools/re/out/seg_2652.asm` are raw `ndisasm` disassemblies of the two most
important code segments.

## Notes / limits

* The unpacked image is larger than the packed one and contains readable
  strings, so this is a real original-program image.
* Ghidra's decompiler occasionally merges adjacent routines or loses the
  stack base in this 16-bit Turbo-C code. Findings below were cross-checked
  against raw `ndisasm` disassembly where the decompiler was ambiguous.
* No original game code or assets are copied into the remake's `src/`.
  `tools/re/` and `docs/re/` are analysis scratch/documentation only.
