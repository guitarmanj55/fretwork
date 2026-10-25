# Fretwork

Guitar tuner, backing tracks and practice tools for acoustic players. Vanilla JS, no build step, no dependencies. Installable as a PWA and works offline once loaded.

## Run it

The tuner needs the microphone, and browsers only allow that on `https://` or `localhost`.

```bash
cd fretwork
python3 -m http.server 8080      # then open http://localhost:8080
```

For your phone or tablet on a music stand, host the folder anywhere with https (GitHub Pages, Netlify, Cloudflare Pages) and use "Add to Home Screen".

## What's in it

- **Home**: the app opens here. Big buttons for the Tuner, Play along and Lessons, today's practice minutes and streak, and a shortcut back to the last song you played.
- **Tune**: microphone tuner (YIN pitch detection, ±5¢ = in tune). Seven tunings, adjustable A4, tap a string for a reference tone. Auto-detects which string you're on, or locks to one.
- **Play → Backing tracks**: 15 progressions (barre workouts, 12-bar blues, slash-chord descent, fingerpicking, waltzes…) with synthesised guitar, bass and drums. Tempo 40–200 with 70% / 85% slow-down chips, count-in, bar looping, capo, transpose, six rhythm feels. Mute the guitar part so you play it. Write your own with a chord chart like `| Am | C G | F |`.
- **Play → Songs**: 12 traditional and public-domain songs (Amazing Grace, House of the Rising Sun, Greensleeves, Scarborough Fair, Drunken Sailor…) graded Beginner to Intermediate, with verse/chorus charts and a practice tip for each. Tap Play along to load one into the player. Chords only, no lyrics. For songs still in copyright, type the chords in with Edit / new, or use My audio.
- **Play → My audio**: load your own MP3/M4A/WAV, slow down 40–125% without changing pitch, A–B loop, ±10 s skip, and a ±100¢ fine-tune so a recording can be matched to your guitar.
- **Lessons**: chord library with diagrams (open, barre, 7ths, sus/add, slash) and a look-up for any chord; scale explorer with a 15-fret fretboard, position boxes (all five for pentatonics) and playback; strumming patterns you can load straight into Play; grade-5 skills checklist.
- **Practice**: metronome with tap tempo, chord-change trainer with a 60-second challenge and personal bests, automatic practice log with daily goal and streak.

Everything is stored locally in the browser (`localStorage`). Nothing is uploaded.

## Notes

- Because you're playing an acoustic out loud, the tuner turns off echo cancellation and noise suppression, and it stops listening when you leave the Tune tab. Don't run backing tracks while the tuner is on.
- iPhone: on iOS 17 and later the app asks to play even with the ringer switch on silent. On older iOS, flip the switch to ring if you hear nothing.
- After an update the app reloads itself once when the new version has downloaded (not while something is playing or the tuner is on).
- Streaming-service songs can't be played inside a web app; use the audio-file player with your own files.

## Tests

```bash
node test/core.test.js    # chord shapes, transposition, pitch detection against the synth
node test/smoke.js        # boots the app against a stubbed DOM/audio and runs the sequencer
```

## Layout

| File | Role |
| --- | --- |
| `songs.js` | The song library (chord charts by section) |
| `core.js` | Pure logic: chord voicings, chart parser, YIN detector, scales, plucked-string synth, rhythm feels |
| `app.js` | UI, Web Audio engine, sequencer, tuner, audio-file player |
| `style.css`, `index.html` | Interface |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | PWA |
