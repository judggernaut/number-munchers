# In-game strings — Number Munchers (DOS 1990)

All strings below were read from the **unpacked** `NM_UNPACKED.EXE`
(`sha256 de42f666…b994c3`). Offsets are decimal file offsets; the blank-line
addresses are the start of each NUL-terminated ASCII string. The complete
unfiltered printable-string dump is `docs/re/strings-raw.txt` (928 lines,
generated with `strings -a -t d -n 4`).

`DS` offset = file offset − `0x2a140` (the data segment starts at `DS=0x3734`,
file offset `0x2a140`). Ghidra linear address = file offset − `0x2e00` +
`0x10000`.

## 1. Game / content categories

These are the names shown in the game-choice menu. `Challenge` is the
randomised mode, not a separate question generator.

| file off | DS | text |
|---|---|---|
| 173509 | `0x0486` | `Multiples ` |
| 173522 | `0x0493` | `Factors ` |
| 173533 | `0x049e` | `Primes ` |
| 173543 | `0x04a8` | `Equality ` |
| 173555 | `0x04b4` | `Inequality ` |
| 173569 | `0x04c2` | `Challenge ` |
| 178190 | `0x06fe` | `NUMBER MUNCHERS` |
| 178223 | `0x070b` | `Multiples` |
| 178233 | `0x0715` | `Factors` |
| 178241 | `0x071d` | `Primes` |
| 178248 | `0x0724` | `Equality` |
| 178257 | `0x072d` | `Inequality` |
| 178268 | `0x0738` | `Challenge` |

## 2. Current rule / sub-content labels

These are printed at the top of the playfield / used by Set Content.

| file off | DS | text |
|---|---|---|
| 177542 | `0x1446` | `Multiples of` |
| 177555 | `0x1453` | `Factors of` |
| 177566 | `0x145e` | `Prime Numbers` |
| 177580 | `0x146c` | `Equals` |
| 177587 | `0x1473` | `Less Than` |
| 177597 | `0x147d` | `Not Equal to` |
| 177610 | `0x148a` | `Greater Than` |
| 177036 | `0x12c4` | `pless than` (leading `p` is a compiler artefact in the raw dump; the real text is `less than`) |
| 177047 | `0x12cf` | `pnot equal` |
| 177058 | `0x12da` | `pgreater than` |

## 3. Difficulty / grade menu

Eleven entries. The table starts at DS `0x22fd`; each is a separate
NUL-terminated string with a leading and trailing space (except the last).

| file off | DS | text |
|---|---|---|
| 181309 | `0x22fd` | ` 3rd Grade Easy ` |
| 181326 | `0x230e` | ` 3rd Grade Advanced ` |
| 181347 | `0x2323` | ` 4th Grade Easy ` |
| 181364 | `0x2334` | ` 4th Grade Advanced ` |
| 181385 | `0x2349` | ` 5th Grade Easy ` |
| 181402 | `0x235a` | ` 5th Grade Advanced ` |
| 181423 | `0x236f` | ` 6th Grade Easy ` |
| 181440 | `0x2380` | ` 6th Grade Advanced ` |
| 181461 | `0x2395` | ` 7th Grade Easy ` |
| 181478 | `0x23a6` | ` 7th Grade Advanced ` |
| 181499 | `0x23bb` | ` 8th Grade and Above ` |

Related labels:

| file off | text |
|---|---|
| 181522 | `Modify Range:` |
| 181536 | `Allowable range: ` |
| 181558 | `Current lower limit:` |
| 181579 | `Enter new lower limit:` |
| 181602 | `Current upper limit: ` |
| 181624 | `Enter new upper limit:` |
| 181673 | `Modify Other:` |
| 181687 | `Operation` |
| 181701 | `Addition (` |
| 181716 | `Subtraction (` |
| 181734 | `Multiplication (` |
| 181755 | `Division (` |
| 181793 | `Current Difficulty:` |
| 181813 | `Game` |
| 181818 | `Use ` |
| 181823 | `Range ` |
| 181831 | `Sequence ` |
| 181847 | `Multiples` … `Challenge` (same names again) |
| 182800 | `The highest munch-able number is ` |
| 182851 | `Modify Other: Multiples` |
| 182955 | `(Allowable range: 3 - 50)` |
| 183101 | `Select Difficulty` |
| 183139 | `Choose a level:` |

## 4. Main / options menus

| file off | text |
|---|---|
| 175897 | ` Play Number Munchers ` |
| 175920 | ` Hall of Fame ` |
| 175935 | ` Information ` |
| 175949 | ` Options ` |
| 175959 | ` Quit ` |
| 176234 | `Use Arrows to move, then press Enter.` |
| 176272 | `Escape: ` |
| 176281 | `Choose an option:` |
| 176299 | `Options` |
| 176382 | `Type entry, then press Enter.` |
| 176412 | `Escape: Options Menu` |
| 176646 | ` Set Difficulty Level ` |
| 176669 | ` Set Content ` |
| 176683 | ` Erase Hall of Fame ` |
| 176704 | ` Set Password ` |
| 176719 | ` Turn Joystick ON  ` |
| 176739 | ` Calibrate Joystick ` |
| 176761 | `Main Menu` |
| 177890 | `  Which Number Munchers game would` |
| 177925 | `  you like to play?` |
| 177962 | `  Which Hall of Fame would` |
| 177989 | `  you like to see?` |
| 178046 | `Use Arrows to move, then press Enter.` |
| 178325 | `Perfect` |
| 178421 | `Do you want instructions?` |
| 178479 | ` Yes ` |
| 178485 | ` No ` |
| 181902 | `Erase Hall of Fame: ALL lists` |
| 181970 | `Escape: Cancel` |
| 183168 | `Select Hall of Fame` |
| 183188 | `Choose a Hall of Fame to erase:` |

### Password / options lock

This is a **teacher/options password**, not a level-select or level-skip
mechanic. There is no password that selects a starting level in the strings or
in the options state machine; the password only gates changing difficulty,
content, hall-of-fame and joystick options.

| file off | text |
|---|---|
| 176435 | `That password is not correct.` |
| 176466 | `Please try again.` |
| 176486 | `Enter the password:` |
| 176596 | `Set Password` |
| 176609 | `Enter a new password:` |
| 176631 | `Enter a hint:` |
| 176506 | `Type entry, then press Enter.` |
| 176536 | `Escape: Main Menu` |

## 5. Troggle names

The code stores a table of far pointers at DS `0x1270`:

```
Yikes, Oops, Aargh, Oh, Oh, Rats,
normalus, laborus, timidus, assistus, smarticus
```

Only the five mock-Latin names are used as species names. The first five are
interjections used by the death message.

| file off | DS | text |
|---|---|---|
| 177142 | `0x12b6` | `Yikes` |
| 177148 | `0x12bc` | `Oops` |
| 177153 | `0x12c1` | `Aargh` |
| 177159 | `0x12c7` | `Oh, Oh` |
| 177166 | `0x12ce` | `Rats` |
| 177171 | `0x12d3` | `normalus` |
| 177180 | `0x12dc` | `laborus` |
| 177188 | `0x12e4` | `timidus` |
| 177196 | `0x12ec` | `assistus` |
| 177205 | `0x12f5` | `smarticus` |
| 177338 | `0x137a` | `Trogglus ` |

English names are not stored in the executable; the mapping is the standard
one (Reggie/Worker/Bashful/Helper/Smarty) documented for the game and confirmed
by the AI/tile behaviour below.

## 6. In-game messages

| file off | text |
|---|---|
| 177110 | `4'Press SPACE BAR to continue` (the `4'` is a length/attribute byte prefix) |
| 177215 | ` is not a multiple of ` |
| 177238 | ` is not a factor of ` |
| 177262 | `The number "` |
| 177275 | `" is not prime.` |
| 177291 | `Example: ` |
| 177305 | `Oops!  "` |
| 177316 | `! You were eaten by a` |
| 177502 | `4'Improper diacritical type.` |
| 177627 | `Score: ` |
| 177651 | `Press a key for Muncher Menu` |
| 177709 | `Score: ` |
| 177733 | `Score: ` |
| 177741 | `Level: ` |
| 177749 | `Demo` |
| 177754 | `Time out` |
| 178325 | `Perfect` |
| 178363 | `Press a key for Muncher Menu` |
| 178392 | `Press a key for Muncher Menu` |
| 179059 | ` yes ` |
| 179065 | ` 000 - 000 ` |
| 179077 | ` in order ` |
| 179088 | ` up to 10 ` |

The wrong-answer feedback is assembled at runtime:

```
Oops!  "          <- DS 0x1359
<number>           <- printed number
 is not a multiple of / is not a factor of / " is not prime.
```

The death message is assembled from three pieces:

```
<Yikes|Oops|Aargh|Oh, Oh|Rats>   (random)
 + "! You were eaten by a"       (DS 0x1364)
 + "Trogglus "                    (DS 0x137a)
 + <normalus|laborus|timidus|assistus|smarticus>
```

## 7. Hall of Fame

| file off | text |
|---|---|
| 174253 | `There are currently no entries in the` |
| 174291 | `Hall of Fame.` |
| 174306 | `Use arrows to move, Space Bar to delete.` |
| 174347 | `Press Enter to accept changes.` |
| 174378 | `Escape: Cancel changes` |
| 174416 | `Erase Hall of Fame` |
| 174448 | `There are no more entries in the` |
| 174481 | `Hall of Fame.` |
| 174519 | `Press Space Bar to continue.` |
| 174806 | `The Unknown Muncher` |
| 174839 | `Congratulations!` |
| 175016 | `Type your name, and press Enter.` |
| 175135 | `You made it into the` |
| 175156 | `Number Munchers Hall of Fame!` |
| 175186 | `You have the Number Munchers` |
| 175215 | `Hall of Fame best score!` |
| 175240 | `A Number Munchers Hall of Fame` |
| 175271 | `perfect score!!!` |
| 175050 | `Do you want to play ` (followed by game name, then ` again?`) |

## 8. Program / file / hardware messages

| file off | text |
|---|---|
| 172356 | `Turbo-C - Copyright (c) 1988 Borland Intl.` |
| 172399 | `Divide error` |
| 172413 | `Abnormal program termination` |
| 172508 | `product.pf` |
| 172525 | `This disk appears to be damaged or some` |
| 172569 | `files are missing.` |
| 173082 | `PROGRAM IS NOT AVAILABLE` |
| 173251 | `Not enough free memory.` |
| 173275 | `Error: missing file` |
| 173375 | `Please insert the disk.` |
| 173420 | ` of paper.` |
| 173436 | `Disk error.` |
| 173453 | `   Critical error %d.` |
| 173684 | `MECC8x8.gft` |
| 173696 | `MECC5x8.gft` |
| 174580 | `.CFG` |
| 174586 | `    The specified file is not in MECC configuration format.` |
| 174647 | `    MECC configuration error. Could not open the specified file.` |
| 174712 | `ConfInit1` |
| 174730 | `nomouse` |
| 174740 | `nm.cfg` |
| 174754 | `MECC` |
| 174762 | `Do you really want to quit?` |
| 175288 | `logo.004` |
| 175297 | `logo.256` |
| 175318 | `CGA.BGI` |
| 175423 | `GrafOpen` |
| 175433 | `Error loading primes` |
| 175454 | `resource.` |
| 175465 | `Cannot run program.` |
| 175485 | `No graphics hardware detected.` |
| 175517 | `VGA256` |
| 175622 | `Version ` |
| 175698 | `nm.res` |
| 175705 | `nmcga.res` |
| 175715 | `ncga.res` |
| 179059+ | Set Content defaults (` yes `, ` 000 - 000 `, ` in order `, ` up to 10 `) |
| 183522 | `Program exit, not enough memory to continue.` |
| 183568 | `Error expanding image.` |

## 9. Resource tags (not user-visible)

These appear in the `.RES` containers and are documented in
`docs/re/original-analysis.md`:

```
CONF  DATA  GSND  PSND  ADLI  SCPT
BTMP  PCXF  EGAT
```

`NM.CFG` (and `NM.RES` resource `CONF`, id 1000) begins with `MECC` and the
product name `Number Munchers`.

## 10. Strings that are *not* present

* No “Trogglus” English names (Reggie/Worker/…) anywhere in the executable.
* No password table or level-select text; the only password strings are the
  options-menu teacher lock above.
* No question bank or answer text in the executable: question values are
  generated arithmetically at runtime. The only stored numeric question data is
  the 46-entry prime table in `NM.RES` (see findings).
* No cutscene dialogue text in plain ASCII; `SCPT` resources are bytecode.
