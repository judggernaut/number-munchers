# .RES resource inventory (Number Munchers DOS)
Generated from `tools/re/out/res/*/index.json` by `tools/re/parse_res.py`.
Offsets/sizes are decimal and refer to the original `.RES` files.
`BTMP` records are blit lists, not bitmaps; `PCXF` resources are PCX images.
Purpose labels are guesses from resource id families and decoded sizes; they are not shipped assets.

## `NM.RES` (28181 bytes, data_start 0x124)

| type | idx | id | offset | size | guess |
|---|---|---|---|---|---|
| CONF | 0 | 1000 | 292 | 2188 | configuration (copy of NM.CFG) |
| DATA | 0 | 1 | 2480 | 7750 | help/tutorial text script (7,750 B) |
| DATA | 1 | 2 | 10230 | 92 | prime table: 46 u16, 2..199 |
| GSND | 0 | 12 | 10322 | 3396 | General MIDI / sound data |
| PSND | 0 | 11 | 13718 | 979 | PC speaker sound data |
| ADLI | 0 | 11 | 14697 | 1296 | AdLib instrument bank |
| ADLI | 1 | 12 | 15993 | 1591 | AdLib instrument bank |
| ADLI | 2 | 13 | 17584 | 1475 | AdLib instrument bank |
| ADLI | 3 | 14 | 19059 | 1533 | AdLib instrument bank |
| ADLI | 4 | 15 | 20592 | 1787 | AdLib instrument bank |
| SCPT | 0 | 2012 | 22379 | 1202 | script bytecode (cutscene/animation) |
| SCPT | 1 | 2014 | 23581 | 1182 | script bytecode (cutscene/animation) |
| SCPT | 2 | 2016 | 24763 | 970 | script bytecode (cutscene/animation) |
| SCPT | 3 | 2018 | 25733 | 1318 | script bytecode (cutscene/animation) |
| SCPT | 4 | 2020 | 27051 | 1130 | script bytecode (cutscene/animation) |

## `NMCGA.RES` (266147 bytes, data_start 0x264)

| type | idx | id | offset | size | guess |
|---|---|---|---|---|---|
| BTMP | 0 | 1006 | 612 | 228 | blit list (12-byte records, references a PCXF id) |
| BTMP | 1 | 1007 | 840 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 2 | 1008 | 1032 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 3 | 1009 | 1224 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 4 | 1010 | 1416 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 5 | 1011 | 1608 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 6 | 2013 | 1800 | 444 | blit list (12-byte records, references a PCXF id) |
| BTMP | 7 | 2015 | 2244 | 492 | blit list (12-byte records, references a PCXF id) |
| BTMP | 8 | 2017 | 2736 | 336 | blit list (12-byte records, references a PCXF id) |
| BTMP | 9 | 2019 | 3072 | 396 | blit list (12-byte records, references a PCXF id) |
| BTMP | 10 | 2021 | 3468 | 468 | blit list (12-byte records, references a PCXF id) |
| BTMP | 11 | 6003 | 3936 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 12 | 6005 | 3948 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 13 | 6009 | 3960 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 14 | 6051 | 3972 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 15 | 6053 | 3984 | 12 | blit list (12-byte records, references a PCXF id) |
| PCXF | 0 | 1006 | 3996 | 4262 | PCX image (palette supplied by EXE) |
| PCXF | 1 | 1007 | 8258 | 7103 | PCX image (palette supplied by EXE) |
| PCXF | 2 | 1008 | 15361 | 6137 | PCX image (palette supplied by EXE) |
| PCXF | 3 | 1009 | 21498 | 6964 | PCX image (palette supplied by EXE) |
| PCXF | 4 | 1010 | 28462 | 5161 | PCX image (palette supplied by EXE) |
| PCXF | 5 | 1011 | 33623 | 6269 | PCX image (palette supplied by EXE) |
| PCXF | 6 | 2013 | 39892 | 32386 | PCX image (palette supplied by EXE) |
| PCXF | 7 | 2015 | 72278 | 18276 | PCX image (palette supplied by EXE) |
| PCXF | 8 | 2017 | 90554 | 21278 | PCX image (palette supplied by EXE) |
| PCXF | 9 | 2019 | 111832 | 15260 | PCX image (palette supplied by EXE) |
| PCXF | 10 | 2021 | 127092 | 23590 | PCX image (palette supplied by EXE) |
| PCXF | 11 | 3013 | 150682 | 9222 | PCX image (palette supplied by EXE) |
| PCXF | 12 | 3015 | 159904 | 20595 | PCX image (palette supplied by EXE) |
| PCXF | 13 | 3017 | 180499 | 9805 | PCX image (palette supplied by EXE) |
| PCXF | 14 | 3019 | 190304 | 8716 | PCX image (palette supplied by EXE) |
| PCXF | 15 | 3021 | 199020 | 14012 | PCX image (palette supplied by EXE) |
| PCXF | 16 | 6003 | 213032 | 17579 | PCX image (palette supplied by EXE) |
| PCXF | 17 | 6005 | 230611 | 21047 | PCX image (palette supplied by EXE) |
| PCXF | 18 | 6009 | 251658 | 7895 | PCX image (palette supplied by EXE) |
| PCXF | 19 | 6051 | 259553 | 3297 | PCX image (palette supplied by EXE) |
| PCXF | 20 | 6053 | 262850 | 3297 | PCX image (palette supplied by EXE) |

## `NCGA.RES` (100120 bytes, data_start 0x284)

| type | idx | id | offset | size | guess |
|---|---|---|---|---|---|
| BTMP | 0 | 1000 | 644 | 228 | blit list (12-byte records, references a PCXF id) |
| BTMP | 1 | 1001 | 872 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 2 | 1002 | 1064 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 3 | 1003 | 1256 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 4 | 1004 | 1448 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 5 | 1005 | 1640 | 192 | blit list (12-byte records, references a PCXF id) |
| BTMP | 6 | 2012 | 1832 | 444 | blit list (12-byte records, references a PCXF id) |
| BTMP | 7 | 2014 | 2276 | 492 | blit list (12-byte records, references a PCXF id) |
| BTMP | 8 | 2016 | 2768 | 336 | blit list (12-byte records, references a PCXF id) |
| BTMP | 9 | 2018 | 3104 | 396 | blit list (12-byte records, references a PCXF id) |
| BTMP | 10 | 2020 | 3500 | 468 | blit list (12-byte records, references a PCXF id) |
| BTMP | 11 | 6000 | 3968 | 240 | blit list (12-byte records, references a PCXF id) |
| BTMP | 12 | 6002 | 4208 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 13 | 6004 | 4220 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 14 | 6008 | 4232 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 15 | 6050 | 4244 | 12 | blit list (12-byte records, references a PCXF id) |
| BTMP | 16 | 6052 | 4256 | 12 | blit list (12-byte records, references a PCXF id) |
| PCXF | 0 | 1000 | 4268 | 2097 | PCX image (palette supplied by EXE) |
| PCXF | 1 | 1001 | 6365 | 2640 | PCX image (palette supplied by EXE) |
| PCXF | 2 | 1002 | 9005 | 2685 | PCX image (palette supplied by EXE) |
| PCXF | 3 | 1003 | 11690 | 2689 | PCX image (palette supplied by EXE) |
| PCXF | 4 | 1004 | 14379 | 2399 | PCX image (palette supplied by EXE) |
| PCXF | 5 | 1005 | 16778 | 2367 | PCX image (palette supplied by EXE) |
| PCXF | 6 | 2012 | 19145 | 9995 | PCX image (palette supplied by EXE) |
| PCXF | 7 | 2014 | 29140 | 7341 | PCX image (palette supplied by EXE) |
| PCXF | 8 | 2016 | 36481 | 7008 | PCX image (palette supplied by EXE) |
| PCXF | 9 | 2018 | 43489 | 4501 | PCX image (palette supplied by EXE) |
| PCXF | 10 | 2020 | 47990 | 6820 | PCX image (palette supplied by EXE) |
| PCXF | 11 | 3012 | 54810 | 3838 | PCX image (palette supplied by EXE) |
| PCXF | 12 | 3014 | 58648 | 7630 | PCX image (palette supplied by EXE) |
| PCXF | 13 | 3016 | 66278 | 3893 | PCX image (palette supplied by EXE) |
| PCXF | 14 | 3018 | 70171 | 3124 | PCX image (palette supplied by EXE) |
| PCXF | 15 | 3020 | 73295 | 7386 | PCX image (palette supplied by EXE) |
| PCXF | 16 | 6000 | 80681 | 3506 | PCX image (palette supplied by EXE) |
| PCXF | 17 | 6002 | 84187 | 4714 | PCX image (palette supplied by EXE) |
| PCXF | 18 | 6004 | 88901 | 5459 | PCX image (palette supplied by EXE) |
| PCXF | 19 | 6008 | 94360 | 3904 | PCX image (palette supplied by EXE) |
| PCXF | 20 | 6050 | 98264 | 928 | PCX image (palette supplied by EXE) |
| PCXF | 21 | 6052 | 99192 | 928 | PCX image (palette supplied by EXE) |
