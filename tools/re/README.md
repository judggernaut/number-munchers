# RE scratch tools (Number Munchers DOS)

Everything here is analysis-only. Nothing in this directory is shipped to the
game.

## Prerequisites

* `cc` (clang), Python 3 with `Pillow` + `numpy`
* REA 6.7.0 + Ghidra 12.1.2 + a JDK 21:
  ```sh
  export GHIDRA_INSTALL_DIR=/Users/judge/.local/share/ghidra/ghidra_12.1.2_PUBLIC
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
  export PATH="$JAVA_HOME/bin:$PATH"
  ```

## Scripts

| script | purpose |
|---|---|
| `unlzexe.c` / `unlzexe` | LZEXE 0.91 unpacker (public-domain C implementation) |
| `parse_res.py` | parse MECC `.RES` containers and extract every resource to `out/res/` |
| `decode_fonts.py` | decode `MECC8X8.GFT` / `MECC5X8.GFT` → `src/assets/font-*.json` + `docs/re/font-preview.png` |
| `decode_res_pcx.py` | decode selected `PCXF` PCX resources to documentation PNGs in `docs/re/extracted/` |
| `ghidra_scripts/DumpAllDecomp.java` | dump all 865 functions' decompiled C to `out/decomp_all.txt` |
| `dump_funcs.sh` | older helper: dump selected REA functions (slow; `DumpAllDecomp` is preferred) |

## Reproduce

```sh
# 1. unpack
cp '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc/NM.EXE' NM_PACKED.EXE
./unlzexe NM_PACKED.EXE NM_UNPACKED.EXE && mv 'NM_UNPACKED.' NM_UNPACKED.EXE

# 2. whole-program decompile
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$PWD/ghidra_proj" nmproj \
  -import "$PWD/NM_UNPACKED.EXE" -scriptPath "$PWD/ghidra_scripts" \
  -postScript DumpAllDecomp.java "$PWD/out/decomp_all.txt" -deleteProject

# 3. resources, fonts, PCX
python3 parse_res.py \
  '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc/NM.RES' \
  '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc/NMCGA.RES' \
  '/Users/judge/Documents/Default Project/ref/number-munchers/dos/NumbMunc/NCGA.RES'
python3 decode_fonts.py
python3 decode_res_pcx.py
```

Raw disassembly of the two key code segments:

```sh
ndisasm -b 16 -o 0x17e70 -e 0xac70 NM_UNPACKED.EXE > out/seg_17e7.asm
ndisasm -b 16 -o 0x26520 -e 0x19320 NM_UNPACKED.EXE > out/seg_2652.asm
```
