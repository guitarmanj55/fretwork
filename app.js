/* Fretwork: guitar tuner, backing tracks, play-along and practice tools. Vanilla JS, no dependencies. */
(() => {
'use strict';
const C = window.Core;
const $ = (id) => document.getElementById(id);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem('fw.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fw.' + k, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } }
};
const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const todayKey = () => new Date().toLocaleDateString('en-CA');

/* ------------------------------------------------------------------ settings */
const S = Object.assign({
  a4: 440, tuning: 'standard', capo: 0, countIn: true, loopSong: true, songId: 'b-pop4', tab: 'tune',
  vol: { gtr: 0.8, bass: 0.8, drums: 0.7, click: 0.6 },
  on: { gtr: true, bass: true, drums: true, click: false }
}, store.get('settings', {}));
S.vol = Object.assign({ gtr: 0.8, bass: 0.8, drums: 0.7, click: 0.6 }, S.vol);
S.on = Object.assign({ gtr: true, bass: true, drums: true, click: false }, S.on);
const saveS = () => store.set('settings', S);
C.setA4(S.a4);

/* ------------------------------------------------------------------ audio engine */
let ctx = null, master = null, noiseBuf = null;
const bus = {};
const pluckCache = new Map();
const PLUCK = {
  gtr: { dur: 2.0, decay: 1.5, harmonics: 12 },
  bass: { dur: 1.3, decay: 0.8, harmonics: 7, pos: 0.3, noise: 0.05, tilt: 1.4 },
  tone: { dur: 4.5, decay: 3.2, harmonics: 9 }
};
function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    ['gtr', 'bass', 'drums', 'click', 'tone'].forEach((k) => { bus[k] = ctx.createGain(); bus[k].connect(master); });
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function setVolumes() {
  if (!ctx) return;
  bus.gtr.gain.value = S.vol.gtr * 0.3;
  bus.bass.gain.value = S.vol.bass * 0.9;
  bus.drums.gain.value = S.vol.drums * 0.8;
  bus.click.gain.value = S.vol.click * 0.9;
  bus.tone.gain.value = 0.8;
}
function pluckBuf(freq, kind) {
  const key = kind + ':' + Math.round(freq * 20) + ':' + ctx.sampleRate;
  let b = pluckCache.get(key);
  if (b) return b;
  const data = C.pluckSamples(freq, ctx.sampleRate, PLUCK[kind]);
  b = ctx.createBuffer(1, data.length, ctx.sampleRate);
  b.getChannelData(0).set(data);
  pluckCache.set(key, b);
  return b;
}
function playBuf(buf, when, gain, dest) {
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g); g.connect(dest); src.start(when);
  return { src, g, t: when };
}
function playTone(freq) { ensureAudio(); return playBuf(pluckBuf(freq, 'tone'), ctx.currentTime + 0.02, 0.9, bus.tone); }

function drumKick(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
  g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g); g.connect(bus.drums); o.start(t); o.stop(t + 0.35);
}
function drumSnare(t, v, soft) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = soft ? 3200 : 1900; f.Q.value = 0.7;
  const g = ctx.createGain(), len = soft ? 0.07 : 0.16;
  g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(f); f.connect(g); g.connect(bus.drums); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.02);
  if (!soft) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    og.gain.setValueAtTime(0.35 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); og.connect(bus.drums); o.start(t); o.stop(t + 0.12);
  }
}
function drumHat(t, v) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(f); f.connect(g); g.connect(bus.drums); n.start(t, Math.random() * 0.5); n.stop(t + 0.07);
}
function clickSound(t, kind) { // 1 = accent, 0 = normal, 2 = soft sub-division
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = kind === 1 ? 1600 : kind === 2 ? 900 : 1100;
  const peak = kind === 1 ? 0.9 : kind === 2 ? 0.25 : 0.55;
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  o.connect(g); g.connect(bus.click); o.start(t); o.stop(t + 0.06);
}

/* wake lock (keeps the screen on while you play with the phone on a stand) */
let wake = null;
async function requestWake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* ignore */ } }
function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isActive()) requestWake(); });

/* ------------------------------------------------------------------ chord diagrams */
function chordSVG(frets) {
  const W = 100, H = 124, L = 16, R = 8, T = 26, B = 8, gw = W - L - R, gh = H - T - B, sx = gw / 5, rows = 5, ry = gh / rows;
  const pos = frets.filter((f) => f > 0);
  const maxF = pos.length ? Math.max.apply(null, pos) : 0, minF = pos.length ? Math.min.apply(null, pos) : 1;
  const base = maxF > 5 ? minF : 1;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cd" role="img" aria-label="chord diagram">';
  if (base === 1) s += '<rect class="nut" x="' + L + '" y="' + (T - 2) + '" width="' + gw + '" height="3.5"/>';
  else s += '<text class="fr" x="' + (L - 4) + '" y="' + (T + ry * 0.65) + '" text-anchor="end">' + base + '</text>';
  for (let r = 0; r <= rows; r++) s += '<line x1="' + L + '" x2="' + (L + gw) + '" y1="' + (T + r * ry) + '" y2="' + (T + r * ry) + '"/>';
  for (let i = 0; i < 6; i++) s += '<line x1="' + (L + i * sx) + '" x2="' + (L + i * sx) + '" y1="' + T + '" y2="' + (T + gh) + '"/>';
  frets.forEach((f, i) => {
    const x = L + i * sx;
    if (f === -1) s += '<text class="x" x="' + x + '" y="' + (T - 6.5) + '">×</text>';
    else if (f === 0) s += '<circle class="mk" cx="' + x + '" cy="' + (T - 11) + '" r="3.6"/>';
  });
  let i0 = -1, i1 = -1, barre = false;
  if (pos.length) {
    const idx = frets.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
    if (idx.length >= 2) {
      i0 = idx[0]; i1 = idx[idx.length - 1];
      barre = i1 - i0 >= 3 && frets.slice(i0, i1 + 1).every((f) => f >= minF);
    }
  }
  if (barre) {
    const y = T + (minF - base + 0.5) * ry;
    s += '<rect class="barre" x="' + (L + i0 * sx - 5) + '" y="' + (y - 4.4) + '" width="' + ((i1 - i0) * sx + 10) + '" height="8.8" rx="4.4"/>';
  }
  frets.forEach((f, i) => {
    if (f <= 0 || (barre && f === minF && i >= i0 && i <= i1)) return;
    s += '<circle class="dot" cx="' + (L + i * sx) + '" cy="' + (T + (f - base + 0.5) * ry) + '" r="4.6"/>';
  });
  return s + '</svg>';
}
function diagFor(name) { const sh = C.chordShape(name); return sh ? chordSVG(sh.frets) : ''; }
function chordCard(name) {
  const sh = C.chordShape(name);
  return '<button class="cc" data-chord="' + esc(name) + '"><b>' + esc(name) + '</b>' + (sh ? chordSVG(sh.frets) : '') + '</button>';
}

/* ------------------------------------------------------------------ sequencer (backing tracks, metronome, trainer) */
const SEQS = [];
const shapeOf = (name) => C.chordShape(name);
class Sequencer {
  constructor(cfg) { this.cfg = cfg; this.playing = false; this.timer = null; this.events = []; this.ringing = []; this.raf = 0; this.ended = false; SEQS.push(this); }
  get spb() { return this.cfg.ts === '3/4' ? 6 : 8; }
  start(opts) {
    opts = opts || {};
    ensureAudio();
    SEQS.forEach((s) => { if (s !== this && s.playing) s.stop(); });
    this.stop(true);
    const cfg = this.cfg;
    if (!cfg.noWarm) warm(neededBuffers(cfg));
    this.playing = true; this.ended = false;
    this.bar = cfg.countIn ? -1 : (opts.startBar != null ? opts.startBar : (cfg.loop && cfg.loop.on ? cfg.loop.start : (cfg.startBar || 0)));
    this.slot = 0; this.nextTime = ctx.currentTime + 0.12; this.lastChord = null; this.events = [];
    this.timer = setInterval(() => this.tick(), 25);
    this.raf = requestAnimationFrame(() => this.visual());
    requestWake();
    if (cfg.onState) cfg.onState(true);
  }
  stop(silent) {
    const was = this.playing;
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.playing = false; this.ended = true;
    cancelAnimationFrame(this.raf);
    if (ctx) {
      const now = ctx.currentTime;
      this.ringing.forEach((v) => { try { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.03); v.src.stop(now + 0.15); } catch (e) { /* already stopped */ } });
    }
    this.ringing = []; this.events = [];
    if (was && !silent) { if (!SEQS.some((s) => s.playing)) releaseWake(); if (this.cfg.onState) this.cfg.onState(false); }
  }
  tick() {
    while (!this.ended && this.nextTime < ctx.currentTime + 0.15) { this.scheduleSlot(this.nextTime); this.advance(); }
  }
  advance() {
    const cfg = this.cfg;
    this.nextTime += 60 / cfg.getBpm() / 2;
    this.slot++;
    if (this.slot < this.spb) return;
    this.slot = 0;
    if (this.bar < 0) { this.bar = cfg.loop && cfg.loop.on ? cfg.loop.start : (cfg.startBar || 0); return; }
    const lp = cfg.loop;
    if (lp && lp.on && this.bar >= lp.end) this.bar = lp.start; else this.bar++;
    if (this.bar >= cfg.bars.length) {
      if (cfg.loopSong !== false) this.bar = 0;
      else {
        this.ended = true; clearInterval(this.timer); this.timer = null;
        setTimeout(() => { if (this.playing) this.stop(); }, Math.max(0, (this.nextTime - ctx.currentTime) * 1000) + 500);
      }
    }
  }
  jumpTo(bar) { if (this.playing) { this.bar = clamp(bar, 0, this.cfg.bars.length - 1); this.slot = 0; } else this.cfg.startBar = bar; }
  visual() {
    if (!this.playing) return;
    const now = ctx.currentTime;
    while (this.events.length && this.events[0].time <= now) { const ev = this.events.shift(); if (this.cfg.onEvent) this.cfg.onEvent(ev); }
    this.raf = requestAnimationFrame(() => this.visual());
  }
  scheduleSlot(t0) {
    const cfg = this.cfg, spb = this.spb, sd = 60 / cfg.getBpm() / 2;
    const feel = C.FEELS[cfg.feel] || C.FEELS.folk, slot = this.slot;
    const t = t0 + (slot % 2 === 1 ? (feel.swing || 0) * sd : 0);
    const ev = { time: t0, bar: this.bar, slot: slot, beat: slot / 2, count: this.bar < 0, chord: null, chordIdx: 0 };
    if (this.bar < 0) {
      if (slot % 2 === 0) clickSound(t, slot === 0 ? 1 : 0);
      this.events.push(ev); return;
    }
    const chords = cfg.bars[this.bar], n = chords.length, ci = Math.min(n - 1, Math.floor(slot * n / spb));
    const name = C.transposeChord(chords[ci], cfg.transpose || 0);
    ev.chord = name; ev.chordIdx = ci;
    this.events.push(ev);
    const L = cfg.layers, shape = C.isRest(name) ? null : shapeOf(name);
    const changed = name !== this.lastChord; this.lastChord = name;
    if (changed) this.ringing.forEach((v) => { try { v.g.gain.setTargetAtTime(0, t, 0.04); } catch (e) { /* ignore */ } });
    this.ringing = this.ringing.filter((v) => v.t > ctx.currentTime - 3);
    if (L.click) { if (slot % 2 === 0) clickSound(t, slot === 0 ? 1 : 0); else if (cfg.subdiv) clickSound(t, 2); }
    if (shape && L.gtr) { const ch = feel.gtr[slot]; if (ch && ch !== '.') this.playGtr(shape, ch, t, slot % 2 === 0 ? 1 : 0.75); }
    if (shape && L.bass) {
      const b = feel.bass[slot];
      if (b === 'R' || b === '5') {
        const rootPc = shape.bass != null ? shape.bass : shape.root;
        let m = 36 + rootPc; if (b === '5') m = 36 + ((shape.root + 7) % 12);
        this.ringing.push(playBuf(pluckBuf(C.midiToFreq(m + (cfg.capo || 0)), 'bass'), t, slot % 4 === 0 ? 1 : 0.8, bus.bass));
      }
    }
    if (L.drums) {
      const k = feel.kick[slot], s = feel.snare[slot], h = feel.hat[slot];
      if (k && k !== '.') drumKick(t, k === 'r' ? 0.6 : 1);
      if (s && s !== '.') drumSnare(t, s === 'r' ? 0.6 : 1, s === 'r');
      if (h && h !== '.') drumHat(t, slot % 2 === 0 ? 0.9 : 0.55);
    }
  }
  playGtr(shape, ch, t, vel) {
    const notes = C.chordMidis(shape.frets), capo = this.cfg.capo || 0;
    if (!notes.length) return;
    let list;
    if (ch === 'D') list = notes;
    else if (ch === 'U') list = notes.slice().reverse().slice(0, 4);
    else if (ch === 'b') list = [notes[0]];
    else { const n = notes.find((x) => x.string === Number(ch)); list = n ? [n] : []; }
    const spread = ch === 'D' ? 0.016 : ch === 'U' ? 0.01 : 0;
    list.forEach((nt, i) => {
      const g = vel * (ch === 'U' ? 0.45 : 0.55) * (0.85 + 0.3 * Math.random()) * (/\d|b/.test(ch) ? 1.5 : 1);
      this.ringing.push(playBuf(pluckBuf(C.midiToFreq(nt.midi + capo), 'gtr'), t + i * spread + Math.random() * 0.004, g, bus.gtr));
    });
  }
}
function neededBuffers(cfg) {
  const out = new Map(), capo = cfg.capo || 0;
  const feel = C.FEELS[cfg.feel] || C.FEELS.folk;
  const useBass = cfg.layers.bass && /[R5]/.test(feel.bass);
  cfg.bars.forEach((bar) => bar.forEach((raw) => {
    const name = C.transposeChord(raw, cfg.transpose || 0);
    if (C.isRest(name)) return;
    const sh = shapeOf(name); if (!sh) return;
    if (cfg.layers.gtr) C.chordMidis(sh.frets).forEach((n) => { const f = C.midiToFreq(n.midi + capo); out.set('gtr' + f, [f, 'gtr']); });
    if (useBass) [36 + (sh.bass != null ? sh.bass : sh.root), 36 + ((sh.root + 7) % 12)].forEach((m) => { const f = C.midiToFreq(m + capo); out.set('bass' + f, [f, 'bass']); });
  }));
  return Array.from(out.values());
}
function warm(list) { list.forEach((p) => pluckBuf(p[0], p[1])); }
function warmLater(cfg) {
  if (!ctx) return;
  const list = neededBuffers(cfg); let i = 0;
  (function step() { const t0 = performance.now(); while (i < list.length && performance.now() - t0 < 12) { pluckBuf(list[i][0], list[i][1]); i++; } if (i < list.length) setTimeout(step, 8); })();
}
const isActive = () => SEQS.some((s) => s.playing) || (AF.el && !AF.el.paused);

/* ------------------------------------------------------------------ dots helper */
function setDots(el, n) {
  if (el.children.length !== n) { el.innerHTML = ''; for (let i = 0; i < n; i++) el.appendChild(document.createElement('span')); }
}
function lightDot(el, i) { Array.from(el.children).forEach((c, k) => { c.className = k === i ? 'on' + (k === 0 ? ' acc' : '') : ''; }); }

/* ------------------------------------------------------------------ TUNER */
const T = { running: false, stream: null, analyser: null, src: null, buf: null, raf: 0, last: 0, hist: [], lastSig: 0, lock: null, inSince: 0, done: {} };
const tuningMidi = () => C.TUNINGS[S.tuning].midi;
function buildTunerUI() {
  const ts = $('tuningSel');
  ts.innerHTML = Object.keys(C.TUNINGS).map((k) => '<option value="' + k + '">' + esc(C.TUNINGS[k].name) + '</option>').join('');
  ts.value = S.tuning;
  ts.onchange = () => { S.tuning = ts.value; saveS(); T.lock = null; T.done = {}; renderStrings(); };
  const a4 = $('a4Sel');
  a4.innerHTML = [432, 435, 438, 440, 442, 444].map((v) => '<option>' + v + '</option>').join('');
  a4.value = String(S.a4);
  a4.onchange = () => { S.a4 = Number(a4.value); C.setA4(S.a4); pluckCache.clear(); saveS(); renderStrings(); };
  $('tunerBtn').onclick = () => (T.running ? tunerStop() : tunerStart());
  $('autoBtn').onclick = () => { T.lock = null; renderStrings(); };
  renderStrings();
}
function renderStrings() {
  const tm = tuningMidi(), box = $('strings');
  box.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const b = document.createElement('button');
    b.className = 'str' + (T.lock === i ? ' lock' : '') + (T.done[i] ? ' done' : '');
    b.dataset.i = i;
    b.innerHTML = C.noteName(tm[i]) + '<small>' + (6 - i) + (i === 0 ? ' (low)' : i === 5 ? ' (high)' : '') + '</small>';
    b.onclick = () => { T.lock = i; renderStrings(); playTone(C.midiToFreq(tm[i])); };
    box.appendChild(b);
  }
  $('autoBtn').classList.toggle('on', T.lock == null);
}
// iOS 17+: 'playback' lets Web Audio sound with the ringer switch on silent; the mic needs 'play-and-record'.
function audioSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* not supported */ } }
audioSession('playback');
async function tunerStart() {
  ensureAudio();
  audioSession('play-and-record');
  try {
    T.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    audioSession('playback');
    $('tVerdict').className = 'verdict off';
    $('tVerdict').textContent = 'Microphone blocked';
    $('tHint').textContent = location.protocol === 'file:' || (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
      ? 'Browsers only allow the microphone on https:// or localhost. Serve the folder locally or host it over https.'
      : 'Allow microphone access for this site in your browser settings, then try again.';
    return;
  }
  try { await ctx.resume(); } catch (e) { /* ignore */ }
  T.src = ctx.createMediaStreamSource(T.stream);
  T.analyser = ctx.createAnalyser(); T.analyser.fftSize = 4096; T.analyser.smoothingTimeConstant = 0;
  T.src.connect(T.analyser);
  // some browsers only pull audio through a graph that reaches the destination, so end it in a silent sink
  T.sink = ctx.createGain(); T.sink.gain.value = 0;
  T.analyser.connect(T.sink); T.sink.connect(ctx.destination);
  T.buf = new Float32Array(T.analyser.fftSize);
  T.running = true; T.hist = []; T.last = 0;
  $('tunerBtn').textContent = 'Stop tuner';
  $('tVerdict').className = 'verdict idle'; $('tVerdict').textContent = 'Pluck a string';
  T.raf = requestAnimationFrame(tunerLoop);
}
function tunerStop() {
  T.running = false; cancelAnimationFrame(T.raf);
  if (T.stream) T.stream.getTracks().forEach((t) => t.stop());
  try { if (T.src) T.src.disconnect(); if (T.sink) T.sink.disconnect(); } catch (e) { /* ignore */ }
  T.sink = null; T.stream = null; T.src = null; T.analyser = null;
  audioSession('playback');
  const b = $('tunerBtn'); if (b) b.textContent = 'Start tuner';
  tunerIdle();
}
function tunerIdle() {
  $('tNote').textContent = '–'; $('tNote').classList.add('empty'); $('tOct').textContent = ''; $('tHz').innerHTML = '&nbsp;';
  $('needle').style.left = '50%'; $('needle').className = 'needle';
  const v = $('tVerdict'); v.className = 'verdict idle'; v.textContent = T.running ? 'Pluck a string' : 'Tuner is off';
  $$('.str').forEach((b) => b.classList.remove('target'));
}
function tunerLoop(ts) {
  if (!T.running) return;
  T.raf = requestAnimationFrame(tunerLoop);
  if (ts - T.last < 40) return;
  T.last = ts;
  T.analyser.getFloatTimeDomainData(T.buf);
  const r = C.detectPitch(T.buf, ctx.sampleRate, { minRms: 0.002 });
  const now = performance.now();
  if (r.freq > 0 && r.clarity > 0.7) {
    T.lastSig = now;
    T.hist.push(C.freqToMidi(r.freq)); if (T.hist.length > 5) T.hist.shift();
    const sorted = T.hist.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const tm = tuningMidi();
    const idx = T.lock != null ? T.lock : C.nearestString(med, tm).idx;
    const cents = (med - tm[idx]) * 100, ab = Math.abs(cents);
    const nm = Math.round(med);
    $('tNote').textContent = C.noteName(nm); $('tNote').classList.remove('empty'); $('tOct').textContent = C.noteOct(nm);
    $('tHz').textContent = (C.midiToFreq(med)).toFixed(1) + ' Hz · target ' + C.noteLabel(tm[idx]) + ' (string ' + (6 - idx) + ')';
    const cls = ab <= 5 ? 'ok' : ab <= 15 ? 'near' : 'off';
    const nd = $('needle'); nd.style.left = (50 + clamp(cents, -50, 50)) + '%'; nd.className = 'needle ' + cls;
    const v = $('tVerdict'); v.className = 'verdict ' + cls;
    v.textContent = ab <= 5 ? 'In tune ✓' : cents < 0 ? Math.round(ab) + '¢ flat · tune up ↑' : Math.round(ab) + '¢ sharp · tune down ↓';
    $$('.str').forEach((b) => b.classList.toggle('target', Number(b.dataset.i) === idx && T.lock == null));
    if (ab <= 5) {
      if (!T.inSince) T.inSince = now;
      if (now - T.inSince > 600 && !T.done[idx]) { T.done[idx] = true; renderStrings(); }
    } else T.inSince = 0;
  } else if (now - T.lastSig > 600) {
    T.hist = []; T.inSince = 0; tunerIdle();
    let rms = 0; for (let i = 0; i < T.buf.length; i++) rms += T.buf[i] * T.buf[i];
    rms = Math.sqrt(rms / T.buf.length);
    $('tHz').textContent = 'Mic level ' + '▮'.repeat(Math.min(12, Math.round(rms * 400))) + (ctx.state !== 'running' ? ' (audio ' + ctx.state + ')' : '');
  }
}

/* ------------------------------------------------------------------ SONGS */
const BUILTIN = [
  { id: 'b-pop4', name: 'Four-chord pop (C G Am F)', bpm: 100, ts: '4/4', feel: 'pop', level: 'Warm-up', bars: [['C'], ['G'], ['Am'], ['F']] },
  { id: 'b-folk', name: 'Folk strummer (G Em C D)', bpm: 96, ts: '4/4', feel: 'folk', level: 'Warm-up', bars: [['G'], ['Em'], ['C'], ['D']] },
  { id: 'b-sing', name: 'Singer-songwriter (Am F C G)', bpm: 84, ts: '4/4', feel: 'folk', level: 'Easy', bars: [['Am'], ['F'], ['C'], ['G']] },
  { id: 'b-canon', name: 'Canon progression in D', bpm: 72, ts: '4/4', feel: 'ballad', level: 'Barre (Bm, F#m)', bars: [['D'], ['A'], ['Bm'], ['F#m'], ['G'], ['D'], ['G'], ['A']] },
  { id: 'b-barre', name: 'Barre workout (F Bb Gm C7)', bpm: 80, ts: '4/4', feel: 'pop', level: 'Barre', bars: [['F'], ['Bb'], ['Gm'], ['C7']] },
  { id: 'b-bm', name: 'Barre rock in Bm (Bm G D A)', bpm: 108, ts: '4/4', feel: 'rock', level: 'Barre', bars: [['Bm'], ['G'], ['D'], ['A']] },
  { id: 'b-rock', name: 'Rock 8ths in E (E D A E)', bpm: 120, ts: '4/4', feel: 'rock', level: 'Medium', bars: [['E'], ['D'], ['A'], ['E']] },
  { id: 'b-blueA', name: '12-bar blues in A', bpm: 92, ts: '4/4', feel: 'shuffle', level: 'Medium', bars: [['A7'], ['A7'], ['A7'], ['A7'], ['D7'], ['D7'], ['A7'], ['A7'], ['E7'], ['D7'], ['A7'], ['E7']] },
  { id: 'b-blueE', name: '12-bar blues in E', bpm: 88, ts: '4/4', feel: 'shuffle', level: 'Medium', bars: [['E7'], ['E7'], ['E7'], ['E7'], ['A7'], ['A7'], ['E7'], ['E7'], ['B7'], ['A7'], ['E7'], ['B7']] },
  { id: 'b-mblues', name: 'Minor blues in Em', bpm: 80, ts: '4/4', feel: 'shuffle', level: 'Medium', bars: [['Em7'], ['Em7'], ['Em7'], ['Em7'], ['Am7'], ['Am7'], ['Em7'], ['Em7'], ['B7'], ['Am7'], ['Em7'], ['B7']] },
  { id: 'b-pick', name: 'Fingerpicking ballad (Cadd9 G Em7 Dsus4)', bpm: 76, ts: '4/4', feel: 'ballad', level: 'Fingerstyle', bars: [['Cadd9'], ['G'], ['Em7'], ['Dsus4', 'D']] },
  { id: 'b-bass', name: 'Descending bass line (slash chords)', bpm: 78, ts: '4/4', feel: 'ballad', level: 'Slash chords', bars: [['C'], ['G/B'], ['Am'], ['Am/G'], ['F'], ['C/G'], ['G'], ['G']] },
  { id: 'b-jazz', name: 'Jazzy ii–V–I in C', bpm: 96, ts: '4/4', feel: 'shuffle', level: '7th chords', bars: [['Dm7'], ['G7'], ['Cmaj7'], ['Am7']] },
  { id: 'b-waltz', name: 'Waltz in G (G Em C D)', bpm: 108, ts: '3/4', feel: 'waltz', level: 'Easy', bars: [['G'], ['Em'], ['C'], ['D']] },
  { id: 'b-waltzm', name: 'Minor waltz (Am Dm E Am)', bpm: 96, ts: '3/4', feel: 'waltz', level: 'Easy', bars: [['Am'], ['Dm'], ['E'], ['Am']] }
];
// traditional songs from songs.js: sections flattened into bars, with the bar each section starts on
const SONGS = (window.SONGS || []).map((s) => {
  const bars = [], sections = [];
  s.sections.forEach((sec) => { sections.push({ name: sec[0], start: bars.length }); C.parseChart(sec[1]).bars.forEach((b) => bars.push(b)); });
  return { id: s.id, name: s.name, origin: s.origin, key: s.key, tip: s.tip, bpm: s.bpm, ts: s.ts, feel: s.feel, level: s.level, bars: bars, sections: sections };
});
let custom = store.get('songs', []);
let tmpSong = null;
const allSongs = () => BUILTIN.concat(SONGS).concat(custom).concat(tmpSong ? [tmpSong] : []);
const findSong = (id) => allSongs().find((s) => s.id === id) || BUILTIN[0];
const P = { song: null, bpm: 100, lastChord: null };
const playCfg = {
  bars: [['C']], ts: '4/4', feel: 'pop', capo: S.capo, transpose: 0, layers: S.on, loop: { on: false, start: 0, end: 0 },
  loopSong: S.loopSong, countIn: S.countIn, subdiv: false, getBpm: () => P.bpm, onEvent: playEvent, onState: playState
};
const playSeq = new Sequencer(playCfg);

function feelOptions(sel, ts, cur) {
  sel.innerHTML = Object.keys(C.FEELS).filter((k) => C.FEELS[k].ts === ts).map((k) => '<option value="' + k + '">' + esc(C.FEELS[k].label) + '</option>').join('');
  sel.value = C.FEELS[cur] && C.FEELS[cur].ts === ts ? cur : sel.options[0].value;
}
function renderSongSelect() {
  const opt = (s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
  let h = '<optgroup label="Backing tracks">' + BUILTIN.map(opt).join('') + '</optgroup>';
  if (SONGS.length) h += '<optgroup label="Songs">' + SONGS.map(opt).join('') + '</optgroup>';
  if (custom.length) h += '<optgroup label="My songs">' + custom.map(opt).join('') + '</optgroup>';
  if (tmpSong) h += '<optgroup label="Practice pattern">' + opt(tmpSong) + '</optgroup>';
  $('songSel').innerHTML = h;
  $('songSel').value = P.song ? P.song.id : S.songId;
}
function loadSong(id) {
  const song = findSong(id);
  const wasPlaying = playSeq.playing;
  if (wasPlaying) playSeq.stop();
  P.song = song; S.songId = song.id; if (song.id !== 'tmp') saveS();
  P.bpm = song.bpm; P.lastChord = null;
  playCfg.bars = song.bars; playCfg.ts = song.ts; playCfg.feel = song.feel; playCfg.transpose = 0; playCfg.startBar = 0;
  playCfg.loop = { on: false, start: 0, end: song.bars.length - 1 };
  $('loopOn').checked = false; $('loopFrom').value = 1; $('loopTo').value = song.bars.length;
  $('loopFrom').max = $('loopTo').max = song.bars.length;
  $('transSel').value = '0';
  feelOptions($('feelSel'), song.ts, song.feel); playCfg.feel = $('feelSel').value;
  $('songSel').value = song.id;
  renderBpm(); renderChart(); resetNow(); renderMeta(); warmLater(playCfg);
}
function renderMeta() {
  const s = P.song;
  $('songMeta').textContent = (s.origin ? s.origin + ' · key of ' + s.key + ' · ' : '') + (s.level ? s.level + ' · ' : '') + s.ts + ' · ' + s.bars.length + ' bars' + (custom.some((c) => c.id === s.id) ? ' · your song' : '');
  $('songTip').textContent = s.tip || '';
}
function renderBpm() { $('bpmRange').value = P.bpm; $('bpmVal').textContent = P.bpm; }
function setBpm(v) { P.bpm = clamp(Math.round(v), 40, 200); renderBpm(); }
function renderChart() {
  const lp = playCfg.loop, secs = (P.song && P.song.sections) || [];
  $('chart').innerHTML = playCfg.bars.map((bar, i) =>
    secs.filter((s) => s.start === i).map((s) => '<div class="sec">' + esc(s.name) + '</div>').join('') +
    '<button class="bar' + (lp.on && i >= lp.start && i <= lp.end ? ' inloop' : '') + '" data-bar="' + i + '"><span class="n">' + (i + 1) + '</span>' +
    bar.map((c) => '<b>' + esc(C.transposeChord(c, playCfg.transpose)) + '</b>').join('') + '</button>').join('');
  $$('#chart .bar').forEach((b) => { b.onclick = () => playSeq.jumpTo(Number(b.dataset.bar)); });
}
function showChord(nameEl, diagEl, name) {
  nameEl.textContent = name || '–';
  nameEl.classList.toggle('empty', !name);
  const sh = name && !C.isRest(name) ? C.chordShape(name) : null;
  diagEl.innerHTML = sh ? chordSVG(sh.frets) : '';
}
function resetNow() {
  showChord($('nowName'), $('nowDiag'), null); showChord($('nextName'), $('nextDiag'), null);
  $('nowCapo').textContent = ''; $('countIn').textContent = '';
  setDots($('beatDots'), playCfg.ts === '3/4' ? 3 : 4); lightDot($('beatDots'), -1);
  $$('#chart .bar.on').forEach((b) => b.classList.remove('on'));
  // preview the first chord
  const first = playCfg.bars[playCfg.startBar || 0][0];
  const f = C.transposeChord(first, playCfg.transpose);
  showChord($('nowName'), $('nowDiag'), f);
  const nxt = nextChordAfter(playCfg, playCfg.startBar || 0, 0);
  showChord($('nextName'), $('nextDiag'), nxt);
  capoText(f);
}
function capoText(name) {
  $('nowCapo').textContent = playCfg.capo > 0 && name && !C.isRest(name) ? 'Capo ' + playCfg.capo + ' · sounds as ' + C.transposeChord(name, playCfg.capo) : '';
}
function nextChordAfter(cfg, bar, ci) {
  const chords = cfg.bars[bar];
  let raw;
  if (ci + 1 < chords.length) raw = chords[ci + 1];
  else {
    let nb = bar + 1;
    if (cfg.loop && cfg.loop.on && bar >= cfg.loop.end) nb = cfg.loop.start;
    else if (nb >= cfg.bars.length) { if (cfg.loopSong === false) return null; nb = 0; }
    raw = cfg.bars[nb][0];
  }
  return C.transposeChord(raw, cfg.transpose || 0);
}
function playEvent(ev) {
  setDots($('beatDots'), playCfg.ts === '3/4' ? 3 : 4);
  if (ev.count) { if (ev.slot % 2 === 0) { $('countIn').textContent = '· count-in ' + (ev.slot / 2 + 1); lightDot($('beatDots'), ev.slot / 2); } return; }
  $('countIn').textContent = '';
  if (ev.slot % 2 === 0) lightDot($('beatDots'), ev.slot / 2);
  if (ev.chord !== P.lastChord) {
    P.lastChord = ev.chord;
    showChord($('nowName'), $('nowDiag'), ev.chord); capoText(ev.chord);
  }
  showChord($('nextName'), $('nextDiag'), nextChordAfter(playCfg, ev.bar, ev.chordIdx));
  $$('#chart .bar').forEach((b) => b.classList.toggle('on', Number(b.dataset.bar) === ev.bar));
}
function playState(on) {
  $('playBtn').textContent = on ? '■ Stop' : '▶ Play';
  if (!on) { P.lastChord = null; playCfg.startBar = 0; resetNow(); }
}

function buildPlayUI() {
  renderSongSelect();
  $('songSel').onchange = () => loadSong($('songSel').value);
  $('playBtn').onclick = () => (playSeq.playing ? playSeq.stop() : playSeq.start());
  $('bpmMinus').onclick = () => setBpm(P.bpm - 1);
  $('bpmPlus').onclick = () => setBpm(P.bpm + 1);
  $('bpmRange').oninput = () => setBpm(Number($('bpmRange').value));
  $('bpmChips').innerHTML = [0.7, 0.85, 1].map((f) => '<button class="chip" data-f="' + f + '">' + Math.round(f * 100) + '%</button>').join('');
  $$('#bpmChips .chip').forEach((b) => { b.onclick = () => setBpm(P.song.bpm * Number(b.dataset.f)); });
  $('feelSel').onchange = () => { playCfg.feel = $('feelSel').value; warmLater(playCfg); };
  $('capoSel').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => '<option value="' + n + '">' + (n ? 'Capo ' + n : 'No capo') + '</option>').join('');
  $('capoSel').value = String(S.capo);
  $('capoSel').onchange = () => { S.capo = playCfg.capo = Number($('capoSel').value); saveS(); warmLater(playCfg); capoText($('nowName').textContent); };
  let to = ''; for (let i = -6; i <= 6; i++) to += '<option value="' + i + '">' + (i === 0 ? 'Original' : (i > 0 ? '+' : '') + i) + '</option>';
  $('transSel').innerHTML = to; $('transSel').value = '0';
  $('transSel').onchange = () => { playCfg.transpose = Number($('transSel').value); P.lastChord = null; renderChart(); resetNow(); warmLater(playCfg); };
  $('countInChk').checked = S.countIn; $('countInChk').onchange = () => { S.countIn = playCfg.countIn = $('countInChk').checked; saveS(); };
  $('loopSongChk').checked = S.loopSong; $('loopSongChk').onchange = () => { S.loopSong = playCfg.loopSong = $('loopSongChk').checked; saveS(); };
  const syncLoop = () => {
    const n = playCfg.bars.length;
    let a = clamp(parseInt($('loopFrom').value, 10) || 1, 1, n), b = clamp(parseInt($('loopTo').value, 10) || n, 1, n);
    if (b < a) b = a;
    $('loopFrom').value = a; $('loopTo').value = b;
    playCfg.loop = { on: $('loopOn').checked, start: a - 1, end: b - 1 };
    renderChart();
  };
  ['loopOn', 'loopFrom', 'loopTo'].forEach((id) => { $(id).onchange = syncLoop; });
  // mix
  const rows = [['gtr', 'Guitar'], ['bass', 'Bass'], ['drums', 'Drums'], ['click', 'Click']];
  $('mix').innerHTML = rows.map((r) => '<div class="mixrow"><label class="chk"><input type="checkbox" data-on="' + r[0] + '"' + (S.on[r[0]] ? ' checked' : '') + '> ' + r[1] + '</label><input type="range" min="0" max="100" data-vol="' + r[0] + '" value="' + Math.round(S.vol[r[0]] * 100) + '"></div>').join('');
  $$('#mix [data-on]').forEach((el) => { el.onchange = () => { S.on[el.dataset.on] = el.checked; saveS(); warmLater(playCfg); }; });
  $$('#mix [data-vol]').forEach((el) => { el.oninput = () => { S.vol[el.dataset.vol] = Number(el.value) / 100; setVolumes(); saveS(); }; });
  // song editor
  $('songEdit').onclick = () => openSongDialog(P.song);
  $('dTs').onchange = () => feelOptions($('dFeel'), $('dTs').value, $('dFeel').value);
  $('dCancel').onclick = () => $('songDlg').close();
  $('songForm').onsubmit = (e) => { e.preventDefault(); saveSongDialog(); };
  $('dDelete').onclick = () => {
    const id = $('songDlg').dataset.id;
    if (!custom.some((c) => c.id === id)) return;
    custom = custom.filter((c) => c.id !== id); store.set('songs', custom);
    $('songDlg').close(); P.song = null; renderSongSelect(); loadSong(BUILTIN[0].id);
  };
  loadSong(S.songId);
  renderSongSelect();
}
function openSongDialog(song) {
  const isCustom = custom.some((c) => c.id === song.id);
  $('dlgTitle').textContent = isCustom ? 'Edit song' : 'New song (starting from this one)';
  $('songDlg').dataset.id = isCustom ? song.id : '';
  $('dName').value = isCustom ? song.name : song.id === 'tmp' ? '' : song.name + ' (copy)';
  $('dBpm').value = song.bpm; $('dTs').value = song.ts; feelOptions($('dFeel'), song.ts, song.feel);
  $('dChart').value = song.bars.map((b) => b.join(' ')).join(' | ');
  $('dErr').textContent = ''; $('dDelete').style.visibility = isCustom ? 'visible' : 'hidden';
  $('songDlg').showModal();
}
function saveSongDialog() {
  const parsed = C.parseChart($('dChart').value);
  if (!parsed.bars.length) { $('dErr').textContent = 'Add at least one bar of chords.'; return; }
  if (parsed.bad.length) { $('dErr').textContent = 'Not supported yet: ' + parsed.bad.join(', ') + '. Try the chord lookup in Learn → Chords to see what is available.'; return; }
  const id = $('songDlg').dataset.id || 'c-' + Date.now();
  const song = { id: id, name: $('dName').value.trim() || 'Untitled', bpm: clamp(Number($('dBpm').value) || 90, 40, 200), ts: $('dTs').value, feel: $('dFeel').value, level: 'My song', bars: parsed.bars };
  const i = custom.findIndex((c) => c.id === id);
  if (i >= 0) custom[i] = song; else custom.push(song);
  store.set('songs', custom);
  $('songDlg').close(); P.song = null; renderSongSelect(); loadSong(id);
}

function buildSongsUI() {
  const levels = ['Beginner', 'Easy', 'Intermediate'];
  $('songList').innerHTML = levels.map((lv) => {
    const list = SONGS.filter((s) => s.level === lv);
    if (!list.length) return '';
    return '<div class="label mt">' + lv.toUpperCase() + '</div>' + list.map((s) => {
      const chords = Array.from(new Set(s.bars.reduce((a, b) => a.concat(b), []).filter((c) => !C.isRest(c))));
      return '<div class="song"><div class="grow"><b>' + esc(s.name) + '</b><div class="small muted">' + esc(s.origin) + ' · key of ' + esc(s.key) + ' · ' + s.ts + ' · ' + s.bpm + ' bpm</div>' +
        '<div class="chips mt">' + chords.map((c) => '<span class="chip sm">' + esc(c) + '</span>').join('') + '</div></div>' +
        '<button class="btn primary" data-song="' + esc(s.id) + '">Play along</button></div>';
    }).join('');
  }).join('');
  $$('#songList [data-song]').forEach((b) => {
    b.onclick = () => { loadSong(b.dataset.song); showSub('play', 'backing'); if (window.scrollTo) window.scrollTo(0, 0); };
  });
}

/* ------------------------------------------------------------------ AUDIO FILE PLAYER */
const AF = { el: new Audio(), a: null, b: null, raf: 0, url: null };
AF.el.preload = 'auto';
function afPitchMode(on) { ['preservesPitch', 'webkitPreservesPitch', 'mozPreservesPitch'].forEach((p) => { try { AF.el[p] = on; } catch (e) { /* ignore */ } }); }
afPitchMode(true);
function afRate() {
  const sp = Number($('afSpeed').value) / 100, cents = Number($('afPitch').value);
  if (cents !== 0) { afPitchMode(false); AF.el.playbackRate = Math.pow(2, cents / 1200); $('afSpeed').disabled = true; }
  else { afPitchMode(true); AF.el.playbackRate = sp; $('afSpeed').disabled = false; }
  $('afSpeedVal').textContent = cents !== 0 ? '100% (fine-tuning)' : Math.round(sp * 100) + '%';
  $('afPitchVal').textContent = (cents > 0 ? '+' : '') + cents + '¢';
  $$('#afSpeedChips .chip').forEach((b) => b.classList.toggle('on', cents === 0 && Number(b.dataset.v) === Math.round(sp * 100)));
}
function afLoopText() { $('afLoopTxt').textContent = AF.a == null && AF.b == null ? 'no loop' : (AF.a != null ? fmtTime(AF.a) : '–') + ' → ' + (AF.b != null ? fmtTime(AF.b) : '–'); }
function afFrame() {
  const el = AF.el;
  if (AF.a != null && AF.b != null && AF.b > AF.a && el.currentTime >= AF.b) el.currentTime = AF.a;
  if (!AF.seeking && el.duration) $('afSeek').value = Math.round(el.currentTime / el.duration * 1000);
  $('afCur').textContent = fmtTime(el.currentTime);
  if (!el.paused) AF.raf = requestAnimationFrame(afFrame);
}
function buildAudioUI() {
  $('afFile').onchange = () => {
    const f = $('afFile').files[0]; if (!f) return;
    if (AF.url) URL.revokeObjectURL(AF.url);
    AF.url = URL.createObjectURL(f); AF.el.src = AF.url; AF.a = AF.b = null; afLoopText();
    $('afName').textContent = f.name; ['afPlay', 'afSeek', 'afBack', 'afFwd'].forEach((id) => { $(id).disabled = false; });
    SEQS.forEach((s) => s.stop());
    afRate();
  };
  AF.el.onloadedmetadata = () => { $('afDur').textContent = fmtTime(AF.el.duration); };
  AF.el.onended = () => { $('afPlay').textContent = '▶ Play'; if (!isActive()) releaseWake(); };
  AF.el.onpause = () => { $('afPlay').textContent = '▶ Play'; };
  AF.el.onplay = () => { $('afPlay').textContent = '❚❚ Pause'; cancelAnimationFrame(AF.raf); AF.raf = requestAnimationFrame(afFrame); requestWake(); };
  $('afPlay').onclick = () => { if (AF.el.paused) { SEQS.forEach((s) => s.stop()); AF.el.play(); } else { AF.el.pause(); if (!isActive()) releaseWake(); } };
  $('afBack').onclick = () => { AF.el.currentTime = Math.max(0, AF.el.currentTime - 10); afFrame(); };
  $('afFwd').onclick = () => { AF.el.currentTime = Math.min(AF.el.duration || 0, AF.el.currentTime + 10); afFrame(); };
  $('afSeek').onpointerdown = () => { AF.seeking = true; };
  $('afSeek').oninput = () => { if (AF.el.duration) { AF.el.currentTime = Number($('afSeek').value) / 1000 * AF.el.duration; $('afCur').textContent = fmtTime(AF.el.currentTime); } };
  $('afSeek').onchange = () => { AF.seeking = false; };
  $('afA').onclick = () => { AF.a = AF.el.currentTime; if (AF.b != null && AF.b <= AF.a) AF.b = null; afLoopText(); };
  $('afB').onclick = () => { if (AF.a == null) AF.a = 0; AF.b = AF.el.currentTime; if (AF.b <= AF.a) { AF.b = null; } afLoopText(); };
  $('afClear').onclick = () => { AF.a = AF.b = null; afLoopText(); };
  $('afSpeed').oninput = afRate; $('afPitch').oninput = afRate;
  $('afSpeedChips').innerHTML = [50, 60, 70, 80, 90, 100].map((v) => '<button class="chip" data-v="' + v + '">' + v + '%</button>').join('');
  $$('#afSpeedChips .chip').forEach((b) => { b.onclick = () => { $('afPitch').value = 0; $('afSpeed').value = b.dataset.v; afRate(); }; });
  $('afVol').oninput = () => { AF.el.volume = Number($('afVol').value) / 100; };
  AF.el.volume = 0.9; afRate();
}

/* ------------------------------------------------------------------ LEARN */
const CHORD_GROUPS = {
  Open: ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em'],
  Barre: ['F', 'Fm', 'Bm', 'B', 'Bb', 'Gm', 'Cm', 'F#m', 'C#m', 'Ab', 'Eb', 'Abm'],
  '7ths': ['C7', 'D7', 'E7', 'G7', 'A7', 'B7', 'Am7', 'Dm7', 'Em7', 'Bm7', 'Cmaj7', 'Dmaj7', 'Fmaj7', 'Gmaj7', 'Amaj7'],
  'Sus & add': ['Dsus2', 'Dsus4', 'Asus2', 'Asus4', 'Esus4', 'Cadd9'],
  Slash: ['D/F#', 'G/B', 'C/G', 'Am/G', 'E/G#', 'A/C#']
};
function strumChordNow(name) {
  const sh = C.chordShape(name); if (!sh) return;
  ensureAudio();
  const t = ctx.currentTime + 0.03;
  C.chordMidis(sh.frets).forEach((n, i) => playBuf(pluckBuf(C.midiToFreq(n.midi), 'gtr'), t + i * 0.035, 0.6, bus.gtr));
}
function buildChordsUI() {
  const groups = Object.keys(CHORD_GROUPS);
  let cur = store.get('chordGroup', 'Open');
  $('chordGroups').innerHTML = groups.map((g) => '<button data-g="' + esc(g) + '"' + (g === cur ? ' class="on"' : '') + '>' + esc(g) + '</button>').join('');
  const draw = () => {
    $('chordGrid').innerHTML = CHORD_GROUPS[cur].map(chordCard).join('');
    $$('#chordGrid .cc').forEach((b) => { b.onclick = () => strumChordNow(b.dataset.chord); });
    $$('#chordGroups button').forEach((b) => b.classList.toggle('on', b.dataset.g === cur));
  };
  $$('#chordGroups button').forEach((b) => { b.onclick = () => { cur = b.dataset.g; store.set('chordGroup', cur); draw(); }; });
  draw();
  const look = () => {
    const q = $('chordQ').value.trim();
    if (!q) return;
    const sh = C.chordShape(q);
    $('chordQOut').innerHTML = sh ? '<div class="chordgrid">' + chordCard(q) + '</div><div class="small muted mt">Tap to hear it. Frets (low to high): ' + sh.frets.map((f) => (f < 0 ? 'x' : f)).join(' ') + '</div>'
      : '<div class="err">Not available. Supported: major, m, 7, m7, maj7, sus2, sus4, 5 (barre shapes anywhere on the neck) plus common open voicings and slash chords.</div>';
    $$('#chordQOut .cc').forEach((b) => { b.onclick = () => strumChordNow(b.dataset.chord); });
  };
  $('chordQBtn').onclick = look; $('chordQ').onkeydown = (e) => { if (e.key === 'Enter') look(); };
}

const SC = { root: 9, type: 'pentMinor', pos: -1, playing: [], timers: [] };
function fretboardSVG(notes, names, deg, win) {
  const W = 760, H = 218, L = 38, top = 26, sp = 28, frets = 15, fw = (W - L - 8) / frets;
  const ys = (s) => top + (5 - s) * sp, xf = (f) => (f === 0 ? L - 17 : L + (f - 0.5) * fw);
  let s = '<svg class="fb" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="fretboard">';
  [3, 5, 7, 9, 15].forEach((f) => { s += '<circle class="inlay" cx="' + xf(f) + '" cy="' + (top + 2.5 * sp) + '" r="5"/>'; });
  s += '<circle class="inlay" cx="' + xf(12) + '" cy="' + (top + 1.5 * sp) + '" r="5"/><circle class="inlay" cx="' + xf(12) + '" cy="' + (top + 3.5 * sp) + '" r="5"/>';
  for (let f = 0; f <= frets; f++) s += '<line class="' + (f === 0 ? 'nutl' : 'fret') + '" x1="' + (L + f * fw) + '" x2="' + (L + f * fw) + '" y1="' + top + '" y2="' + (top + 5 * sp) + '"/>';
  for (let i = 0; i < 6; i++) s += '<line class="string" x1="' + L + '" x2="' + (L + frets * fw) + '" y1="' + ys(i) + '" y2="' + ys(i) + '"/>';
  for (let f = 1; f <= frets; f++) s += '<text class="num" x="' + xf(f) + '" y="' + (H - 6) + '">' + f + '</text>';
  notes.forEach((n) => {
    const dim = win && (n.fret < win.lo || n.fret > win.hi);
    const label = deg ? n.degree : C.noteName(n.midi, names);
    s += '<g class="fn' + (n.isRoot ? ' root' : '') + (dim ? ' dim' : '') + '" data-s="' + n.string + '" data-f="' + n.fret + '" data-m="' + n.midi + '"><circle cx="' + xf(n.fret) + '" cy="' + ys(n.string) + '" r="10.5"/><text x="' + xf(n.fret) + '" y="' + (ys(n.string) + 3.6) + '">' + label + '</text></g>';
  });
  return s + '</svg>';
}
function scaleStop() { SC.timers.forEach(clearTimeout); SC.timers = []; SC.playing.forEach((v) => { try { v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); v.src.stop(ctx.currentTime + 0.2); } catch (e) { /* ignore */ } }); SC.playing = []; $$('#fretboard .fn.hl').forEach((g) => g.classList.remove('hl')); $('scPlay').textContent = '▶ Play shape'; }
function renderScale() {
  const sc = C.SCALES[SC.type], tm = C.STD, names = C.scaleNames(SC.root, SC.type);
  const notes = C.scaleNotes(SC.root, sc.iv, tm, 15), positions = C.scalePositions(SC.root, sc.iv, tm);
  const win = SC.pos >= 0 && positions[SC.pos] ? positions[SC.pos] : null;
  $('fretboard').innerHTML = fretboardSVG(notes, names, $('scDeg').checked, win);
  const wrap = $('fretboard').parentNode; // on a phone the board scrolls sideways, so bring the chosen box into view
  if (wrap && win) wrap.scrollLeft = Math.max(0, (38 + (win.lo - 1.5) * (714 / 15)) / 760 * wrap.scrollWidth);
  $('scPos').innerHTML = '<button class="chip' + (!win ? ' on' : '') + '" data-p="-1">Whole neck</button>' + positions.map((p, i) => '<button class="chip' + (SC.pos === i ? ' on' : '') + '" data-p="' + i + '">Pos ' + (i + 1) + ' · fr ' + p.lo + '–' + p.hi + '</button>').join('');
  $$('#scPos .chip').forEach((b) => { b.onclick = () => { scaleStop(); SC.pos = Number(b.dataset.p); renderScale(); }; });
  $$('#fretboard .fn').forEach((g) => { g.onclick = () => { ensureAudio(); playBuf(pluckBuf(C.midiToFreq(Number(g.dataset.m)), 'gtr'), ctx.currentTime + 0.02, 0.7, bus.gtr); }; });
  $('scNotes').textContent = sc.name + ' in ' + names[SC.root] + ': ' + sc.iv.map((i) => names[(SC.root + i) % 12]).join(' – ');
}
function scalePlay() {
  if (SC.playing.length || SC.timers.length) { scaleStop(); return; }
  ensureAudio();
  const sc = C.SCALES[SC.type], notes = C.scaleNotes(SC.root, sc.iv, C.STD, 15), positions = C.scalePositions(SC.root, sc.iv, C.STD);
  const win = SC.pos >= 0 && positions[SC.pos] ? positions[SC.pos] : positions[0];
  const up = C.windowSequence(notes, win.lo, win.hi), seq = up.concat(up.slice(0, -1).reverse());
  const step = 60 / (clamp(Number($('scBpm').value) || 90, 40, 200)) / 2, t0 = ctx.currentTime + 0.05;
  seq.forEach((n, i) => {
    SC.playing.push(playBuf(pluckBuf(C.midiToFreq(n.midi), 'gtr'), t0 + i * step, 0.75, bus.gtr));
    SC.timers.push(setTimeout(() => {
      $$('#fretboard .fn.hl').forEach((g) => g.classList.remove('hl'));
      const g = document.querySelector('#fretboard .fn[data-s="' + n.string + '"][data-f="' + n.fret + '"]'); if (g) g.classList.add('hl');
    }, (0.05 + i * step) * 1000));
  });
  SC.timers.push(setTimeout(scaleStop, (0.05 + seq.length * step) * 1000 + 600));
  $('scPlay').textContent = '■ Stop';
}
function buildScalesUI() {
  $('scRoot').innerHTML = C.NAMES_GUITAR.map((n, i) => '<option value="' + i + '">' + n + '</option>').join('');
  $('scRoot').value = SC.root;
  $('scType').innerHTML = Object.keys(C.SCALES).map((k) => '<option value="' + k + '">' + esc(C.SCALES[k].name) + '</option>').join('');
  $('scType').value = SC.type;
  $('scRoot').onchange = () => { scaleStop(); SC.root = Number($('scRoot').value); SC.pos = -1; renderScale(); };
  $('scType').onchange = () => { scaleStop(); SC.type = $('scType').value; SC.pos = -1; renderScale(); };
  $('scDeg').onchange = renderScale;
  $('scPlay').onclick = scalePlay;
  renderScale();
}

function buildStrumUI() {
  const arrow = (c) => (c === 'D' ? '↓' : c === 'U' ? '↑' : c === 'b' ? '●' : /\d/.test(c) ? '○' : '·');
  $('strumList').innerHTML = Object.keys(C.FEELS).map((k) => {
    const f = C.FEELS[k], labels = f.ts === '3/4' ? '1 & 2 & 3 &' : '1 & 2 & 3 & 4 &';
    return '<div class="strum-row"><div><b>' + esc(f.label) + '</b> <span class="small muted">' + f.ts + '</span>' +
      '<div class="arrows">' + f.gtr.split('').map((c) => '<span class="' + (c === 'D' || c === 'U' || c === 'b' ? c : '') + '">' + arrow(c) + '</span>').join('') + '</div>' +
      '<div class="arrows small muted">' + labels.split(' ').map((c) => '<span>' + c + '</span>').join('') + '</div></div>' +
      '<button class="btn primary" data-feel="' + k + '">Practise</button></div>';
  }).join('') + '<p class="hint">↓ down-strum, ↑ up-strum, ● bass note, ○ picked string, · rest. Each symbol is an 8th note. Practise loads the pattern over a chord loop in the Play tab.</p>';
  $$('#strumList [data-feel]').forEach((b) => {
    b.onclick = () => {
      const f = C.FEELS[b.dataset.feel];
      tmpSong = { id: 'tmp', name: 'Strum practice: ' + f.label, bpm: 80, ts: f.ts, feel: b.dataset.feel, level: 'Practice pattern', bars: f.ts === '3/4' ? [['Am'], ['Dm'], ['E'], ['Am']] : [['Am'], ['F'], ['C'], ['G']] };
      renderSongSelect(); loadSong('tmp'); showTab('play'); showSub('play', 'backing'); playSeq.start();
    };
  });
}
const SKILLS = [
  'Open chords change cleanly at 80 bpm (C, G, D, A, E, Am, Dm, Em)', 'Barre chords: E-shape and A-shape, major and minor, anywhere on the neck',
  'Dominant, minor and major 7th chords', 'Sus2 / sus4 / add9 chords', 'Slash chords and bass-note walk-downs',
  'Minor pentatonic in all five positions', 'Major scale in at least three positions', 'Blues scale with the added note',
  '12-bar blues: strum it, then pick the bass line', 'Fingerstyle patterns (p-i-m-a) over a chord loop', 'Strumming: 16th feel, muted strums, accents on 2 and 4',
  'Hammer-ons, pull-offs, slides and bends in tune', 'Play a piece along with a recording at full speed', 'Read simple notation and tab together'
];
function buildSkillsUI() {
  const done = store.get('skills', {});
  $('skillList').innerHTML = SKILLS.map((t, i) => '<label class="skill"><input type="checkbox" data-i="' + i + '"' + (done[i] ? ' checked' : '') + '><span>' + esc(t) + '</span></label>').join('');
  $$('#skillList input').forEach((c) => { c.onchange = () => { done[c.dataset.i] = c.checked; store.set('skills', done); }; });
}

/* ------------------------------------------------------------------ PRACTICE */
const M = { bpm: store.get('mbpm', 80), tapTimes: [] };
const metroCfg = {
  bars: [['N.C']], ts: '4/4', feel: 'folk', getBpm: () => M.bpm, layers: { gtr: false, bass: false, drums: false, click: true }, subdiv: false, noWarm: true, loopSong: true,
  onEvent: (ev) => { if (ev.slot % 2 === 0) lightDot($('mDots'), ev.beat); }, onState: (on) => { $('mPlay').textContent = on ? '■ Stop' : '▶ Start'; if (!on) lightDot($('mDots'), -1); }
};
const metroSeq = new Sequencer(metroCfg);
function renderMetro() { $('mRange').value = M.bpm; $('mVal').textContent = M.bpm; store.set('mbpm', M.bpm); }
function setMetro(v) { M.bpm = clamp(Math.round(v), 30, 240); renderMetro(); }
function buildMetroUI() {
  setDots($('mDots'), 4); renderMetro();
  $('mMinus').onclick = () => setMetro(M.bpm - 1); $('mPlus').onclick = () => setMetro(M.bpm + 1);
  $('mRange').oninput = () => setMetro(Number($('mRange').value));
  $('mTs').onchange = () => { metroCfg.ts = $('mTs').value; setDots($('mDots'), metroCfg.ts === '3/4' ? 3 : 4); };
  $('mSub').onchange = () => { metroCfg.subdiv = $('mSub').checked; };
  $('mPlay').onclick = () => (metroSeq.playing ? metroSeq.stop() : metroSeq.start());
  $('mTap').onclick = () => {
    const now = performance.now();
    if (M.tapTimes.length && now - M.tapTimes[M.tapTimes.length - 1] > 2000) M.tapTimes = [];
    M.tapTimes.push(now); M.tapTimes = M.tapTimes.slice(-6);
    if (M.tapTimes.length >= 2) { const iv = []; for (let i = 1; i < M.tapTimes.length; i++) iv.push(M.tapTimes[i] - M.tapTimes[i - 1]); setMetro(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)); }
  };
}

const TR = { chips: store.get('trChips', ['G', 'C', 'D', 'Em']), list: [] };
const TR_BASE = ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em', 'F', 'Bm', 'B7', 'Bb'];
const trCfg = {
  bars: [['C']], ts: '4/4', feel: 'folk', getBpm: () => Number($('trBpm').value) || 60, layers: { gtr: false, bass: false, drums: false, click: true }, noWarm: true, loopSong: true, countIn: true, transpose: 0,
  onEvent: (ev) => {
    if (ev.slot % 2 === 0) lightDot($('trDots'), ev.beat);
    if (ev.count) return;
    showChord($('trNowName'), $('trNowDiag'), ev.chord); showChord($('trNextName'), $('trNextDiag'), nextChordAfter(trCfg, ev.bar, ev.chordIdx));
  },
  onState: (on) => { $('trPlay').textContent = on ? '■ Stop' : '▶ Start'; if (!on) lightDot($('trDots'), -1); }
};
const trSeq = new Sequencer(trCfg);
function renderTrChips() {
  const all = Array.from(new Set(TR_BASE.concat(TR.chips)));
  $('trChips').innerHTML = all.map((c) => '<button class="chip' + (TR.chips.indexOf(c) >= 0 ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('');
  $$('#trChips .chip').forEach((b) => {
    b.onclick = () => { const c = b.dataset.c, i = TR.chips.indexOf(c); if (i >= 0) TR.chips.splice(i, 1); else TR.chips.push(c); store.set('trChips', TR.chips); renderTrChips(); if (trSeq.playing) trSeq.stop(); };
  });
  $('chPair').textContent = TR.chips.length >= 2 ? '(' + TR.chips[0] + ' ⇄ ' + TR.chips[1] + ', your first two picks)' : '(pick two chords above)';
}
function buildTrainerUI() {
  renderTrChips();
  $('trAddBtn').onclick = () => {
    const v = $('trAdd').value.trim();
    if (v && C.chordShape(v)) { if (TR.chips.indexOf(v) < 0) TR.chips.push(v); store.set('trChips', TR.chips); $('trAdd').value = ''; renderTrChips(); }
    else $('trAdd').value = '';
  };
  $('trPlay').onclick = () => {
    if (trSeq.playing) { trSeq.stop(); return; }
    if (TR.chips.length < 2) { $('trNowName').textContent = 'Pick 2+'; return; }
    const per = Number($('trBars').value) || 1;
    trCfg.bars = TR.chips.map((c) => { const arr = []; for (let i = 0; i < per; i++) arr.push([c]); return arr; }).reduce((a, b) => a.concat(b), []);
    setDots($('trDots'), 4); trSeq.start();
  };
  // 60-second challenge
  const CH = { running: false, count: 0, end: 0, timer: 0 };
  const finish = () => {
    CH.running = false; clearInterval(CH.timer); $('chTap').disabled = true; $('chStart').disabled = false;
    const key = TR.chips[0] + '→' + TR.chips[1], best = store.get('best', {});
    const prev = best[key] || 0; if (CH.count > prev) best[key] = CH.count; store.set('best', best);
    $('chInfo').textContent = 'Time! ' + CH.count + ' changes (' + key + '). Best: ' + best[key] + (CH.count > prev && prev ? ' · new personal best!' : '');
  };
  $('chStart').onclick = () => {
    if (TR.chips.length < 2) { $('chInfo').textContent = 'Select at least two chords first.'; return; }
    CH.running = true; CH.count = 0; CH.end = performance.now() + 60000; $('chCount').textContent = '0'; $('chTap').disabled = false; $('chStart').disabled = true;
    const best = store.get('best', {})[TR.chips[0] + '→' + TR.chips[1]];
    $('chInfo').textContent = 'Go: ' + TR.chips[0] + ' ⇄ ' + TR.chips[1] + (best ? ' · best ' + best : '') + ' · 60s left';
    CH.timer = setInterval(() => { const left = Math.ceil((CH.end - performance.now()) / 1000); if (left <= 0) finish(); else $('chInfo').textContent = 'Go: ' + TR.chips[0] + ' ⇄ ' + TR.chips[1] + ' · ' + left + 's left'; }, 250);
    showChord($('trNowName'), $('trNowDiag'), TR.chips[0]); showChord($('trNextName'), $('trNextDiag'), TR.chips[1]);
  };
  $('chTap').onclick = () => { if (CH.running) { CH.count++; $('chCount').textContent = CH.count; } };
}

/* practice log */
let logData = store.get('log', {});
let logDirty = 0;
function addPractice() {
  const k = todayKey(); logData[k] = (logData[k] || 0) + 1; logDirty++;
  if (logDirty >= 5) { store.set('log', logData); logDirty = 0; }
  if (document.getElementById('tab-practice').classList.contains('active') && logData[k] % 5 === 0) renderLog();
}
setInterval(() => { if (isActive()) addPractice(); }, 1000);
window.addEventListener('pagehide', () => store.set('log', logData));
function renderLog() {
  const goal = store.get('goal', 20) * 60, k = todayKey(), today = logData[k] || 0;
  $('logGoal').value = goal / 60;
  $('logToday').textContent = Math.floor(today / 60) + ' min';
  $('logBar').style.width = clamp(today / goal * 100, 0, 100) + '%';
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ key: d.toLocaleDateString('en-CA'), name: d.toLocaleDateString('en-GB', { weekday: 'short' }) }); }
  const maxV = Math.max(goal, ...days.map((d) => logData[d.key] || 0));
  $('logWeek').innerHTML = days.map((d) => { const v = logData[d.key] || 0; return '<div><i class="' + (v >= goal ? 'goal' : v < 60 ? 'none' : '') + '" style="height:' + Math.round(v / maxV * 60) + 'px"></i>' + d.name + '<br>' + Math.floor(v / 60) + 'm</div>'; }).join('');
  const streak = streakDays();
  $('logStreak').textContent = streak ? streak + '-day streak (a day counts after 1 minute of playing)' : 'Play for a minute to start a streak.';
}
function streakDays() {
  let streak = 0; const d = new Date();
  if (!(logData[todayKey()] >= 60)) d.setDate(d.getDate() - 1);
  while ((logData[d.toLocaleDateString('en-CA')] || 0) >= 60) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
function buildLogUI() { $('logGoal').onchange = () => { store.set('goal', clamp(Number($('logGoal').value) || 20, 5, 240)); renderLog(); }; renderLog(); }

/* ------------------------------------------------------------------ home */
function renderHome() {
  const goal = store.get('goal', 20), today = Math.floor((logData[todayKey()] || 0) / 60), streak = streakDays();
  $('homeToday').textContent = 'Today: ' + today + ' of ' + goal + ' min' + (streak ? ' · ' + streak + '-day streak' : '');
  $('homeBar').style.width = clamp(today / goal * 100, 0, 100) + '%';
  $('homeCarry').textContent = '▶ Carry on with ' + (P.song ? P.song.name : 'the player');
}
function buildHomeUI() {
  $$('[data-go]').forEach((b) => { b.onclick = () => { showTab(b.dataset.go); if (b.dataset.sub) showSub(b.dataset.go, b.dataset.sub); }; });
  $('homeCarry').onclick = () => { showTab('play'); showSub('play', 'backing'); };
  $$('.logo').forEach((el) => { el.onclick = () => showTab('home'); });
}

/* ------------------------------------------------------------------ navigation */
function showTab(name) {
  if (name !== 'tune' && T.running) tunerStop();
  $$('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  S.tab = name; saveS();
  if (name === 'practice') renderLog();
  if (name === 'home') renderHome();
  $('topSub').textContent = { home: '', tune: 'tuner', play: 'play along', learn: 'lessons', practice: 'practice' }[name];
  if (window.scrollTo) window.scrollTo(0, 0);
}
function showSub(group, sub) {
  const subs = group === 'play' ? ['backing', 'songs', 'audio'] : ['chords', 'scales', 'strum', 'skills'];
  subs.forEach((s) => { $(group + '-' + s).hidden = s !== sub; });
  $$('#' + group + 'Seg button').forEach((b) => b.classList.toggle('on', b.dataset.sub === sub));
}
function buildNav() {
  $$('.tabbar button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  $$('#playSeg button').forEach((b) => { b.onclick = () => showSub('play', b.dataset.sub); });
  $$('#learnSeg button').forEach((b) => { b.onclick = () => showSub('learn', b.dataset.sub); });
}

/* ------------------------------------------------------------------ boot */
try { ensureAudio(); } catch (e) { console.warn('Web Audio unavailable', e); }
buildNav(); buildTunerUI(); buildPlayUI(); buildSongsUI(); buildAudioUI(); buildChordsUI(); buildScalesUI(); buildStrumUI(); buildSkillsUI(); buildMetroUI(); buildTrainerUI(); buildLogUI(); buildHomeUI();
showTab('home'); // every launch opens on the home screen
tunerIdle();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  // a new version takes over in the background; reload once so it shows now instead of on the next launch
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !isActive() && !T.running) location.reload(); });
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch-zoom
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // ask iOS not to evict saved data
}
window.__fretwork = { C, playSeq, S }; // handy for debugging in the console
})();
