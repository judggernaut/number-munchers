# Credits and provenance

## Code lineage

This project is a modernized fork of
[msaperst/number-munchers](https://github.com/msaperst/number-munchers), the
React/DOM reimplementation of the MECC DOS game. That project is licensed under
the Apache License 2.0, which this fork keeps. The rendering, input, audio,
session, and content layers here are new; the rules lineage (scoring, board
shape, category list) and the sprite art came from that fork.

## Original game

*Number Munchers* (MECC, 1986/1990) is © MECC / SoftKey. This project is an
independent, non-commercial homage. It ships no original game executables,
disk images, or resource files.

Static analysis of the original `NM.EXE` and its `.RES` files was performed
for interoperability and preservation research; findings live in
[`docs/re/original-analysis.md`](re/original-analysis.md). Original binaries
are **not** part of this repository or its build.

## Art

The Muncher and Troggle sprites were carried over from the upstream fork
(`src/components/muncher`, `src/components/troggle`) and are used under that
project's Apache-2.0 license. They are recreations, not extracted EGA tiles.

Fonts are rendered with the platform's monospace stack; no webfont is
downloaded at runtime.

## Audio and cutscenes

Sound effects are synthesised at runtime with WebAudio oscillators; no audio
samples were taken from the original game.

Background music is licensed stock, used under licence by the project owner and
kept out of the open-source licence: see `public/music/NOTICE.txt`. The tracks
are not part of the Apache-2.0 grant and may not be reused. The between-level interludes are original,
sprite-based animations written for this project. The original `SCPT` scene
resources were inventoried during the research pass but are neither extracted
nor redistributed.

## Reference material used during development

Reference copies of the DOS release and Apple II disk images were consulted
locally and are excluded from version control (see `.gitignore`). If you
reproduce the research, obtain them yourself and keep them out of the build.
