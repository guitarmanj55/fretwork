// Boots app.js against a stubbed DOM + Web Audio and drives the sequencer with a fake clock.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const timers = [];
let nowMs = 0;
const log = { sources: 0, oscs: 0, clicks: 0, errors: [] };

function makeEl(id) {
  const el = {
    id, _html: '', children: [], style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, textContent: '', className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; }, get innerHTML() { return this._html; },
    appendChild(c) { this.children.push(c); return c; }, querySelectorAll() { return []; }, querySelector() { return null; },
    addEventListener() {}, setAttribute() {}, showModal() {}, close() {}, focus() {}, options: [{ value: 'x' }], get length() { return 0; }
  };
  Object.defineProperty(el.children, 'push', { value: Array.prototype.push, enumerable: false });
  return el;
}
const els = {};
const document = {
  getElementById: (id) => els[id] || (els[id] = makeEl(id)),
  querySelectorAll: () => [], querySelector: () => null, createElement: () => makeEl('new'), addEventListener() {}, visibilityState: 'visible'
};
document.getElementById('tab-practice').classList = { contains: () => false, add() {}, remove() {}, toggle() {} };

class Param { constructor() { this.value = 0; } setValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} linearRampToValueAtTime() {} }
class Node { constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.threshold = new Param(); this.ratio = new Param(); this.attack = new Param(); this.release = new Param(); }
  connect() {} disconnect() {} start() { log.oscs++; } stop() {} }
class Ctx {
  constructor() { this.sampleRate = 44100; this.state = 'running'; this.destination = new Node(); }
  get currentTime() { return nowMs / 1000; }
  createGain() { return new Node(); } createDynamicsCompressor() { return new Node(); } createOscillator() { return new Node(); } createBiquadFilter() { return new Node(); }
  createBuffer(c, n) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
  createBufferSource() { log.sources++; return new Node(); } createAnalyser() { return new Node(); } createMediaStreamSource() { return new Node(); }
  resume() {}
}
const sandbox = {
  console, Math, Float32Array, Array, Object, JSON, Date, Set, Map, Number, String, Promise, URL, Error,
  document, navigator: {}, location: { protocol: 'http:', hostname: 'localhost' }, performance: { now: () => nowMs },
  localStorage: { _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; }, setItem(k, v) { this._d[k] = String(v); } },
  AudioContext: Ctx, Audio: class { constructor() { this.paused = true; this.volume = 1; } play() {} pause() {} },
  requestAnimationFrame: (fn) => { timers.push({ fn, at: nowMs + 16, raf: true, id: Math.random() }); return 1; }, cancelAnimationFrame() {},
  setInterval: (fn, ms) => { const t = { fn, every: ms, at: nowMs + ms, id: Math.random() }; timers.push(t); return t.id; },
  clearInterval: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
  setTimeout: (fn, ms) => { timers.push({ fn, at: nowMs + ms, once: true, id: Math.random() }); return 1; }, clearTimeout() {},
  addEventListener() {}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function advance(ms) {
  const end = nowMs + ms;
  while (true) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers[0];
    if (!t || t.at > end) break;
    nowMs = t.at;
    if (t.once || t.raf) timers.shift(); else t.at += t.every;
    try { t.fn(); } catch (e) { log.errors.push(e.stack.split('\n').slice(0, 3).join(' | ')); }
  }
  nowMs = end;
}
vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), sandbox, { filename: 'core.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), sandbox, { filename: 'app.js' });
const fw = sandbox.__fretwork;
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
ok(!!fw, 'app booted without throwing');

// play the first song with count-in; 100 bpm => one bar = 2.4s, count-in 2.4s
const events = [];
fw.playSeq.cfg.onEvent = (ev) => events.push(ev);
fw.playSeq.start();
advance(2500);
ok(events.filter((e) => e.count).length >= 6, 'count-in events fire (' + events.filter((e) => e.count).length + ')');
advance(10000);
const chords = events.filter((e) => !e.count && e.slot === 0).map((e) => e.chord);
ok(chords.slice(0, 5).join() === 'C,G,Am,F,C', 'chords advance and loop: ' + chords.slice(0, 6).join(' '));
ok(log.sources > 50, 'notes scheduled (' + log.sources + ' sources)');
ok(log.oscs > 20, 'drums/clicks scheduled (' + log.oscs + ')');
fw.playSeq.stop();
const n = events.length; advance(2000);
ok(events.length === n, 'stop halts events');

// every built-in song schedules without error, in every feel of matching time signature
const errsBefore = log.errors.length;
const sandboxSongs = vm.runInContext('(' + (() => 0).toString() + ')', sandbox);
['b-canon', 'b-barre', 'b-bass', 'b-blueA', 'b-pick', 'b-jazz', 'b-waltz', 'b-waltzm', 'b-bm', 'b-mblues'].forEach((id) => {
  // loadSong is internal, so drive via the select handler
  els.songSel.value = id; els.songSel.onchange();
  fw.playSeq.start(); advance(15000); fw.playSeq.stop();
});
ok(log.errors.length === errsBefore, 'all test songs play with no runtime errors ' + (log.errors[0] || ''));

// capo + transpose
fw.S.capo = 2; fw.playSeq.cfg.capo = 2; fw.playSeq.cfg.transpose = 3;
els.songSel.value = 'b-pop4'; els.songSel.onchange();
fw.playSeq.cfg.transpose = 3; fw.playSeq.cfg.capo = 2;
const ev2 = []; fw.playSeq.cfg.onEvent = (e) => ev2.push(e);
fw.playSeq.start(); advance(11000); fw.playSeq.stop();
const got = ev2.filter((e) => !e.count && e.slot === 0).map((e) => e.chord).slice(0, 4).join(); ok(got === 'Eb,Bb,Cm,Ab', 'transpose +3 gives Eb Bb Cm Ab, got ' + got + ' / ' + ev2.length + ' events');

console.log('runtime errors:', log.errors.length ? log.errors : 'none');
process.exit(fail || log.errors.length ? 1 : 0);
