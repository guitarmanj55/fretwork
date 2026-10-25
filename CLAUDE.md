# Fretwork: project context for Claude Code

## What this is
A personal guitar practice PWA for Oli (grade-5 acoustic player). He plays an **acoustic guitar out loud**, usually with a phone or tablet on a music stand, so the UI must be big-touch-target, readable at arm's length, and the screen should stay awake while playing.

Main jobs: (1) tune by microphone, (2) play along with backing tracks and his own audio files, (3) learn and drill chords, scales and strumming, (4) track practice time. It's a sibling of his other personal PWAs (news-pocket, gym-log, hangeul-lab, t212-pocket): self-contained, local-first, no accounts.

## Status
First version was written in a Claude chat session and **has never been run in a real browser or with a real guitar**. Logic is unit-tested; the UI, audio feel and tuner behaviour on real input are unverified. Treat the first job as verification, not new features. See `ROADMAP.md`.

## Stack and rules
- Vanilla JS, HTML, CSS. **No build step, no dependencies, no frameworks.** Keep it that way unless there is a strong reason.
- `core.js`: pure logic, no DOM or Web Audio (chord voicings, chart parser, YIN pitch detector, scales, plucked-string synth, rhythm `FEELS`). Works in the browser (`window.Core`) and Node. Anything testable belongs here.
- `app.js`: UI, Web Audio engine, `Sequencer` class (look-ahead scheduler used by backing tracks, metronome and chord trainer), tuner, audio-file player.
- `sw.js`: cache-first service worker. **Bump `CACHE` in `sw.js` every time any file changes**, or the installed app keeps serving stale files.
- All data lives in `localStorage` under the `fw.` prefix (settings, custom songs, practice log, skills, best scores). Nothing leaves the device.
- British English in UI copy.
- No copyrighted songs, lyrics or tabs in the repo. Built-in material is generic progressions and public-domain ideas only. Real songs come from the user's own audio files or charts he types in.

## Run and test
```bash
python -m http.server 8080        # then http://localhost:8080 (mic needs localhost or https)
node test/core.test.js            # chord shapes, transposition, YIN vs synth on all six strings
node test/smoke.js                # boots app.js against a stubbed DOM/audio, drives the sequencer
```
The smoke test uses a fake DOM, so it catches runtime errors and sequencing bugs but **not** layout, real audio or mic behaviour. Those need a real browser (use the browser tools to check rendering at ~390px wide).

## Architecture notes worth knowing
- **Sequencer:** `setInterval` every 25 ms schedules 150 ms ahead on the `AudioContext` clock. One slot = one 8th note (8 slots in 4/4, 6 in 3/4). `FEELS` patterns are strings, one char per slot (`D`/`U` strums, `b` bass string, `3`-`5` single strings; drums use `x` normal, `r` soft). Swing delays odd slots. UI is driven from a queue of timestamped events read in `requestAnimationFrame`, so display stays in sync with audio.
- **Sound:** guitar and bass are additive "pluck" buffers rendered in JS and cached (`pluckBuf`). They are computed before play starts (`warm`) and in the background after a song/capo/transpose change (`warmLater`). On slow phones the first start may stall; if so, consider moving synthesis to an `OfflineAudioContext` or a worker.
- **Chords:** `Core.chordShape(name)` uses hand-written open and slash voicings, otherwise builds E-shape or A-shape barres at the lowest fret. Supported qualities: major, m, 7, m7, maj7, sus2, sus4, 5, plus open `add9` for C. Anything else returns `null`.
- **Tuner:** YIN on a 4096-sample analyser buffer at ~25 Hz, median of the last 5 readings, gate on RMS > 0.006 and clarity > 0.7, "in tune" = within 5 cents held for 600 ms. Mic is requested with echo cancellation, noise suppression and AGC off. It stops when leaving the Tune tab.
- **Audio file player:** a plain `<audio>` element. Slow-down uses `preservesPitch`; the fine-tune slider switches it off and changes `playbackRate` instead (so speed is locked to 100% while detuned). The loaded file is not persisted between sessions.
- **Capo** shifts the sounding pitch only (chord shapes shown are unchanged). **Key** transposes the chord names and shapes.

## Known unknowns and likely problems
1. Tuner thresholds were tuned against synthetic notes only. Real acoustic input (decay, harmonics, room noise, phone mic) may need different clarity/RMS gates, smoothing, or octave-error handling on the low E and A strings.
2. Layout at phone width has never been seen. Check the chord NOW/NEXT panels, the chart grid, and the fretboard (it scrolls horizontally inside a card).
3. Backing track balance and feel are untested by ear: strum timing, guitar vs bass vs drum levels, shuffle swing amount, ballad arpeggio.
4. iOS Safari: Web Audio is silenced by the ringer switch; autoplay rules; wake-lock support; `<dialog>` for the song editor.
5. `playGtr` creates a fresh node chain per note; fine for now, watch CPU on old phones at fast tempos.
6. Practice log counts seconds only while a sequencer or the audio file is playing, in whole-second ticks, flushed every 5 s and on `pagehide`.

## Definition of done for any change
- `node test/core.test.js` and `node test/smoke.js` pass.
- Checked in a real browser at phone width and desktop.
- `sw.js` cache version bumped.
- README updated if behaviour changed.
