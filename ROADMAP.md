# Fretwork roadmap

Ordered. Don't start a phase until the previous one is genuinely done.

## Phase 0: Verify what exists (do this first)
- [ ] Serve locally, open in a browser, click through every tab and sub-tab; fix anything broken or ugly. Check at 390px and at tablet width.
- [ ] Tuner on a real acoustic: all six strings, in standard and one alternate tuning. Fix flicker, octave errors, slow response. Confirm the "in tune ✓" and per-string tick behave.
- [ ] Backing tracks by ear: every built-in song and every feel. Fix levels, timing, count-in, bar looping, capo and key change.
- [ ] Audio-file player with a real MP3: seek, A-B loop, speed chips, fine-tune slider.
- [ ] Test on the phone/tablet he actually plays with (install as PWA, check wake lock, mic, iOS ringer behaviour).
- [ ] Make sure offline works after first load and that updates ship (service worker cache bump).
- [ ] `git init`, first commit.

## Phase 1: Make it nicer to practise with
- Bigger "NOW" chord display option for use at arm's length; landscape layout for a tablet on a stand.
- Persist the last audio file (IndexedDB) so it's still there next session.
- Remember per-song tempo he last practised at, and show a "tempo ladder" (+5 bpm when he's played it clean).
- Export/import of custom songs, log and settings as JSON (backup).
- Tap-to-time chords on his own audio file: play the recording, tap when each chord changes, then the app shows the chord chart in sync as he plays along.

## Phase 2: Listening to him play
- Record yourself (MediaRecorder) against a backing track, with playback and a simple waveform.
- "Did I play the right chord?" check: chromagram from the mic compared with the target chord's notes. Polyphonic, so start with a lenient pass/fail and test against a real acoustic.
- Timing feedback for the chord-change trainer using onset detection instead of tapping.

## Phase 3: Content and teaching
- More progressions graded by difficulty, and short lessons for grade-5 topics (barre technique, 7th chords, fingerstyle patterns, pentatonic positions).
- Editable fingerstyle and strumming patterns.
- Simple tab/notation display for scale shapes.
- Chord library: more qualities (9ths, add9 shapes, dim/aug), alternate voicings, finger numbers on diagrams.

## Ideas to weigh later
- Optional sync between devices (only if local-first stays intact).
- Share the "my songs" format with a friend.
- Capture ideas for a "song of the week" practice routine.
