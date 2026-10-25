/* Fretwork core: pure logic (no DOM, no WebAudio). Runs in the browser (window.Core) and in Node for tests. */
(function (root) {
  'use strict';

  let A4 = 440;
  const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const NAMES_GUITAR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const ROOT_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function setA4(v) { A4 = v; }
  function getA4() { return A4; }
  function midiToFreq(m) { return A4 * Math.pow(2, (m - 69) / 12); }
  function freqToMidi(f) { return 69 + 12 * Math.log2(f / A4); }
  function pc(m) { return ((Math.round(m) % 12) + 12) % 12; }
  function noteName(m, names) { return (names || NAMES_SHARP)[pc(m)]; }
  function noteOct(m) { return Math.floor(Math.round(m) / 12) - 1; }
  function noteLabel(m, names) { return noteName(m, names) + noteOct(m); }

  /* ---------- Tunings (low string first, MIDI numbers) ---------- */
  const TUNINGS = {
    standard: { name: 'Standard (EADGBE)', midi: [40, 45, 50, 55, 59, 64] },
    dropD: { name: 'Drop D (DADGBE)', midi: [38, 45, 50, 55, 59, 64] },
    halfDown: { name: 'Half step down (Eb)', midi: [39, 44, 49, 54, 58, 63] },
    fullDown: { name: 'Full step down (D)', midi: [38, 43, 48, 53, 57, 62] },
    dadgad: { name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
    openG: { name: 'Open G (DGDGBD)', midi: [38, 43, 50, 55, 59, 62] },
    openD: { name: 'Open D (DADF#AD)', midi: [38, 45, 50, 54, 57, 62] }
  };
  const STD = TUNINGS.standard.midi;

  /* ---------- Chords ---------- */
  // frets listed low E -> high e; -1 = muted, 0 = open
  const OPEN = {
    C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0], G: [3, 2, 0, 0, 0, 3], A: [-1, 0, 2, 2, 2, 0],
    Am: [-1, 0, 2, 2, 1, 0], Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0],
    C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], E7: [0, 2, 0, 1, 0, 0], G7: [3, 2, 0, 0, 0, 1], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
    Am7: [-1, 0, 2, 0, 1, 0], Dm7: [-1, -1, 0, 2, 1, 1], Em7: [0, 2, 0, 0, 0, 0],
    Cmaj7: [-1, 3, 2, 0, 0, 0], Dmaj7: [-1, -1, 0, 2, 2, 2], Fmaj7: [-1, -1, 3, 2, 1, 0], Gmaj7: [3, 2, 0, 0, 0, 2], Amaj7: [-1, 0, 2, 1, 2, 0],
    Cadd9: [-1, 3, 2, 0, 3, 3],
    Dsus2: [-1, -1, 0, 2, 3, 0], Dsus4: [-1, -1, 0, 2, 3, 3], Asus2: [-1, 0, 2, 2, 0, 0], Asus4: [-1, 0, 2, 2, 3, 0], Esus4: [0, 2, 2, 2, 0, 0]
  };
  const SLASH = {
    'D/F#': [2, -1, 0, 2, 3, 2], 'G/B': [-1, 2, 0, 0, 0, 3], 'C/G': [3, 3, 2, 0, 1, 0],
    'Am/G': [3, 0, 2, 2, 1, 0], 'E/G#': [4, 2, 2, 1, 0, 0], 'A/C#': [-1, 4, 2, 2, 2, 0]
  };
  // movable shapes: offsets from the barre fret (null = muted)
  const E_SHAPES = {
    '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
    maj7: [0, 2, 1, 1, 0, 0], sus4: [0, 2, 2, 2, 0, 0], '5': [0, 2, 2, null, null, null]
  };
  const A_SHAPES = {
    '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0],
    maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0], '5': [null, 0, 2, 2, null, null]
  };
  const QMAP = {
    '': '', maj: '', M: '', m: 'm', min: 'm', '-': 'm', '7': '7', dom7: '7', m7: 'm7', min7: 'm7', '-7': 'm7',
    maj7: 'maj7', M7: 'maj7', Maj7: 'maj7', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '5': '5', add9: 'add9'
  };
  const REST = ['N.C', 'N.C.', 'NC', '%'];
  function isRest(t) { return REST.indexOf(t) >= 0; }

  const CHORD_RE = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/;
  function parseChord(name) {
    const m = CHORD_RE.exec(String(name).trim());
    if (!m) return null;
    if (!(m[3] in QMAP)) return null;
    const root = (ROOT_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    let bass = null;
    if (m[4]) bass = (ROOT_SEMI[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + 12) % 12;
    return { letter: m[1], acc: m[2], q: QMAP[m[3]], rawQ: m[3], root: root, bass: bass };
  }

  const shapeMemo = new Map();
  function chordShape(name) {
    if (shapeMemo.has(name)) return shapeMemo.get(name);
    const r = computeShape(name);
    shapeMemo.set(name, r);
    return r;
  }
  function computeShape(name) {
    const p = parseChord(name);
    if (!p) return null;
    const full = String(name).trim();
    if (SLASH[full]) return { name: full, frets: SLASH[full].slice(), root: p.root, bass: p.bass };
    // slash chord without a hand-written voicing: fall back to the plain chord
    if (p.bass !== null) {
      const plain = computeShape(full.split('/')[0]);
      return plain ? { name: full, frets: plain.frets, root: p.root, bass: p.bass } : null;
    }
    if (!p.acc && OPEN[p.letter + p.q]) return { name: full, frets: OPEN[p.letter + p.q].slice(), root: p.root, bass: null };
    const fE = (p.root - 4 + 12) % 12, fA = (p.root - 9 + 12) % 12;
    const cands = [];
    if (E_SHAPES[p.q]) cands.push({ f: fE || 12, s: E_SHAPES[p.q] });
    if (A_SHAPES[p.q]) cands.push({ f: fA || 12, s: A_SHAPES[p.q] });
    if (!cands.length) return null;
    cands.sort((a, b) => a.f - b.f);
    const c = cands[0];
    return { name: full, frets: c.s.map(o => (o === null ? -1 : c.f + o)), root: p.root, bass: null, barre: true };
  }
  function chordMidis(frets, tuning) {
    const t = tuning || STD, out = [];
    frets.forEach((f, i) => { if (f >= 0) out.push({ string: i, fret: f, midi: t[i] + f }); });
    return out;
  }
  function transposeChord(name, semis) {
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(String(name).trim());
    if (!m || !semis) return name;
    const r = (ROOT_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + semis + 120) % 12;
    let out = NAMES_GUITAR[r] + m[3];
    if (m[4]) {
      const b = (ROOT_SEMI[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + semis + 120) % 12;
      out += '/' + NAMES_GUITAR[b];
    }
    return out;
  }
  // "| Am | C G | F |" or one bar per line -> { bars:[[...]], bad:[...] }
  function parseChart(text) {
    const bars = [], bad = [];
    String(text).replace(/\[[^\]]*\]/g, ' ').split(/\n|\|/).forEach(seg => {
      const toks = seg.trim().split(/\s+/).filter(Boolean);
      if (!toks.length) return;
      if (toks.length === 1 && toks[0] === '%' && bars.length) { bars.push(bars[bars.length - 1].slice()); return; }
      const bar = toks.map(t => { if (isRest(t)) return 'N.C'; if (!chordShape(t)) bad.push(t); return t; });
      bars.push(bar);
    });
    return { bars: bars, bad: bad };
  }

  /* ---------- Pitch detection (YIN) ---------- */
  function detectPitch(buf, sr, o) {
    o = o || {};
    const minF = o.minF || 60, maxF = o.maxF || 1200, thr = o.threshold || 0.15;
    const N = buf.length, W = Math.floor(N / 2);
    let rms = 0;
    for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / N);
    if (rms < (o.minRms || 0.006)) return { freq: -1, rms: rms, clarity: 0 };
    const tauMax = Math.min(Math.floor(sr / minF), W - 2), tauMin = Math.max(2, Math.floor(sr / maxF));
    const c = new Float32Array(tauMax + 2);
    c[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax + 1 && tau < W; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const d = buf[j] - buf[j + tau]; s += d * d; }
      run += s;
      c[tau] = run === 0 ? 1 : (s * tau) / run;
    }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (c[t] < thr) {
        while (t + 1 <= tauMax && c[t + 1] < c[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      let mi = tauMin, mv = c[tauMin];
      for (let t = tauMin; t <= tauMax; t++) if (c[t] < mv) { mv = c[t]; mi = t; }
      if (mv > 0.35) return { freq: -1, rms: rms, clarity: 0 };
      tau = mi;
    }
    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const s0 = c[tau - 1], s1 = c[tau], s2 = c[tau + 1], den = s0 + s2 - 2 * s1;
      if (den !== 0) better = tau + (s0 - s2) / (2 * den);
    }
    return { freq: sr / better, rms: rms, clarity: 1 - c[tau] };
  }
  function centsBetween(f, target) { return 1200 * Math.log2(f / target); }
  function nearestString(midiFloat, tuning) {
    let best = 0, bd = Infinity;
    tuning.forEach((m, i) => { const d = Math.abs(midiFloat - m); if (d < bd) { bd = d; best = i; } });
    return { idx: best, cents: (midiFloat - tuning[best]) * 100 };
  }

  /* ---------- Scales ---------- */
  const SCALES = {
    major: { name: 'Major', iv: [0, 2, 4, 5, 7, 9, 11], minorish: false },
    minor: { name: 'Natural minor', iv: [0, 2, 3, 5, 7, 8, 10], minorish: true },
    pentMinor: { name: 'Minor pentatonic', iv: [0, 3, 5, 7, 10], minorish: true },
    pentMajor: { name: 'Major pentatonic', iv: [0, 2, 4, 7, 9], minorish: false },
    blues: { name: 'Blues', iv: [0, 3, 5, 6, 7, 10], minorish: true },
    dorian: { name: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10], minorish: true },
    mixolydian: { name: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10], minorish: false },
    harmMinor: { name: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11], minorish: true }
  };
  function scaleNames(root, scaleKey) {
    const minor = SCALES[scaleKey].minorish;
    const flats = minor ? [0, 2, 5, 7, 10, 3].indexOf(root) >= 0 : [5, 10, 3, 8, 1].indexOf(root) >= 0;
    return flats ? NAMES_FLAT : NAMES_SHARP;
  }
  function scaleNotes(root, iv, tuning, maxFret) {
    const t = tuning || STD, out = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= (maxFret == null ? 15 : maxFret); f++) {
        const m = t[s] + f, rel = (((m - root) % 12) + 12) % 12, d = iv.indexOf(rel);
        if (d >= 0) out.push({ string: s, fret: f, midi: m, degree: d + 1, isRoot: d === 0 });
      }
    }
    return out;
  }
  function scalePositions(root, iv, tuning) {
    const t = tuning || STD, base = (((root - t[0]) % 12) + 12) % 12, five = iv.length <= 6, out = [];
    iv.forEach(i => {
      const f = base + i;
      if (f > 13) return;
      const lo = five ? f : Math.max(0, f - 1);
      out.push({ lo: lo, hi: lo + (five ? 3 : 4) });
    });
    return out;
  }
  function windowSequence(notes, lo, hi) {
    const inWin = notes.filter(n => n.fret >= lo && n.fret <= hi).sort((a, b) => a.midi - b.midi || a.string - b.string);
    const seq = [];
    inWin.forEach(n => { if (!seq.length || seq[seq.length - 1].midi !== n.midi) seq.push(n); });
    return seq;
  }

  /* ---------- Plucked-string synth (additive, pitch-accurate) ---------- */
  function pluckSamples(freq, sr, o) {
    o = o || {};
    const dur = o.dur || 2.0, n = Math.floor(sr * dur), out = new Float32Array(n);
    const nh = Math.max(1, Math.min(o.harmonics || 12, Math.floor((sr * 0.45) / freq)));
    const decay = o.decay || 1.5, pos = o.pos || 0.16, B = o.inharm == null ? 0.00004 : o.inharm, tilt = o.tilt || 1.0;
    for (let k = 1; k <= nh; k++) {
      const amp = Math.abs(Math.sin(Math.PI * k * pos)) / Math.pow(k, tilt);
      if (amp < 1e-4) continue;
      const fk = k * freq * Math.sqrt(1 + B * k * k);
      const tau = decay / (1 + 0.45 * (k - 1));
      const w = (2 * Math.PI * fk) / sr, cw = Math.cos(w), sw = Math.sin(w), r = Math.exp(-1 / (tau * sr));
      let s = 0, c = 1, env = amp;
      for (let i = 0; i < n; i++) {
        out[i] += env * s;
        const ns = s * cw + c * sw; c = c * cw - s * sw; s = ns;
        env *= r;
      }
    }
    let peak = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    const g = peak > 0 ? 0.8 / peak : 1;
    // pluck transient: a few ms of low-passed noise
    const nl = Math.floor(sr * 0.012), nz = o.noise == null ? 0.22 : o.noise;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      let v = out[i] * g;
      if (i < nl) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); v += nz * lp * Math.exp(-i / (sr * 0.003)); }
      const atk = Math.min(1, i / (sr * 0.002)), rel = Math.min(1, (n - i) / (sr * 0.03));
      out[i] = v * atk * rel;
    }
    return out;
  }

  /* ---------- Rhythm feels ---------- */
  // each char = one 8th-note slot. gtr: D/U strum, b = bass string, 3-5 = single string. kick/snare/hat: x normal, r soft
  const FEELS = {
    folk: { label: 'Folk strum', ts: '4/4', gtr: 'D.DU.UDU', bass: 'R...5...', kick: 'x...x...', snare: '..r...r.', hat: '........', swing: 0 },
    pop: { label: 'Pop 8ths', ts: '4/4', gtr: 'DUDUDUDU', bass: 'R.R.R.R.', kick: 'x...x...', snare: '..x...x.', hat: 'x.x.x.x.', swing: 0 },
    rock: { label: 'Rock drive', ts: '4/4', gtr: 'DDDDDDDD', bass: 'RRRRRRRR', kick: 'x..xx...', snare: '..x...x.', hat: 'x.x.x.x.', swing: 0 },
    ballad: { label: 'Fingerpicked ballad', ts: '4/4', gtr: 'b3454345', bass: '........', kick: '........', snare: '........', hat: '........', swing: 0 },
    shuffle: { label: 'Blues shuffle', ts: '4/4', gtr: 'DUDUDUDU', bass: 'R.R.R.R.', kick: 'x...x...', snare: '..x...x.', hat: 'x.x.x.x.', swing: 0.33 },
    waltz: { label: 'Waltz', ts: '3/4', gtr: 'D.DUDU', bass: 'R.....', kick: 'x.....', snare: '..r.r.', hat: '......', swing: 0 }
  };

  root.Core = {
    setA4, getA4, midiToFreq, freqToMidi, pc, noteName, noteOct, noteLabel,
    NAMES_SHARP, NAMES_FLAT, NAMES_GUITAR, TUNINGS, STD,
    parseChord, chordShape, chordMidis, transposeChord, parseChart, isRest, OPEN, SLASH,
    detectPitch, centsBetween, nearestString,
    SCALES, scaleNames, scaleNotes, scalePositions, windowSequence,
    pluckSamples, FEELS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Core;
})(typeof window !== 'undefined' ? window : globalThis);
