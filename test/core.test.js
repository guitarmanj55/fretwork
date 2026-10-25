const C = require('../core.js');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' -> ' + JSON.stringify(a));

// chord shapes
eq(C.chordShape('F').frets, [1, 3, 3, 2, 1, 1], 'F barre');
eq(C.chordShape('Bm').frets, [-1, 2, 4, 4, 3, 2], 'Bm barre');
eq(C.chordShape('Bb').frets, [-1, 1, 3, 3, 3, 1], 'Bb barre');
eq(C.chordShape('F#m').frets, [2, 4, 4, 2, 2, 2], 'F#m barre');
eq(C.chordShape('Gm').frets, [3, 5, 5, 3, 3, 3], 'Gm barre');
eq(C.chordShape('Cm').frets, [-1, 3, 5, 5, 4, 3], 'Cm barre');
eq(C.chordShape('Bm7').frets, [-1, 2, 4, 2, 3, 2], 'Bm7');
eq(C.chordShape('D/F#').frets, [2, -1, 0, 2, 3, 2], 'D/F#');
eq(C.chordShape('Am/G').frets, [3, 0, 2, 2, 1, 0], 'Am/G');
ok(C.chordShape('Xyz') === null, 'bad chord is null');
ok(C.chordShape('Cmaj9') === null, 'unsupported quality is null');

// every chord shape sounds the right pitch classes at the root/bass
const tests = { C: [0, 4, 7], Am: [9, 0, 4], G: [7, 11, 2], F: [5, 9, 0], Bm: [11, 2, 6], Bb: [10, 2, 5], Gm: [7, 10, 2], Dm7: [2, 5, 9, 0], E7: [4, 8, 11, 2], Fmaj7: [5, 9, 0, 4] };
Object.keys(tests).forEach(n => {
  const pcs = new Set(C.chordMidis(C.chordShape(n).frets).map(x => x.midi % 12));
  const want = new Set(tests[n]);
  ok([...pcs].every(p => want.has(p)) && [...want].every(p => pcs.has(p)), n + ' contains exactly its chord tones');
});
// lowest sounding note is the root for non-slash chords
['C', 'Am', 'F', 'Bm', 'Bb', 'Gm', 'D', 'E7', 'G7'].forEach(n => {
  const notes = C.chordMidis(C.chordShape(n).frets);
  ok(notes[0].midi % 12 === C.chordShape(n).root, n + ' lowest note is root');
});

// transpose
ok(C.transposeChord('Am', 2) === 'Bm', 'Am +2 = Bm');
ok(C.transposeChord('G/B', 2) === 'A/Db', 'G/B +2 = A/Db');
ok(C.transposeChord('N.C', 3) === 'N.C', 'rest untouched');

// chart parser
const ch = C.parseChart('| Am | C G | F |\n%\n[Chorus] Dm7 G7 | Zz');
eq(ch.bars.length, 6, 'chart bars');
eq(ch.bad, ['Zz'], 'chart flags bad chord');

// pitch detection on synthesised plucks
[['E2', 82.407], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94], ['E4', 329.63]].forEach(([n, f]) => {
  [44100, 48000].forEach(sr => {
    const s = C.pluckSamples(f, sr, { dur: 1.2 });
    const buf = s.slice(Math.floor(sr * 0.15), Math.floor(sr * 0.15) + 4096);
    const r = C.detectPitch(buf, sr);
    const cents = r.freq > 0 ? C.centsBetween(r.freq, f) : 999;
    ok(Math.abs(cents) < 3, n + ' @' + sr + ' detected ' + r.freq.toFixed(2) + ' Hz (' + cents.toFixed(2) + ' cents)');
  });
});
// detunes by 20 cents are seen
{
  const f = 110 * Math.pow(2, 20 / 1200), sr = 48000;
  const s = C.pluckSamples(f, sr, { dur: 1 }).slice(7000, 7000 + 4096);
  const r = C.detectPitch(s, sr);
  ok(Math.abs(C.centsBetween(r.freq, 110) - 20) < 3, 'A2 +20 cents measured ' + C.centsBetween(r.freq, 110).toFixed(1));
}
// silence and noise are rejected
ok(C.detectPitch(new Float32Array(4096), 48000).freq === -1, 'silence rejected');

// scales
const am = C.scaleNotes(9, C.SCALES.pentMinor.iv, C.STD, 12);
ok(am.filter(n => n.string === 0).map(n => n.fret).join() === '0,3,5,8,10,12', 'A minor pent on low E frets');
const pos = C.scalePositions(9, C.SCALES.pentMinor.iv, C.STD);
ok(pos[0].lo === 5 && pos[0].hi === 8, 'A minor pent position 1 = frets 5-8');
const seq = C.windowSequence(am, 5, 8);
ok(seq.length === 12 && seq[0].midi === 45, 'position 1 box = 12 notes (2 per string) starting on A2 (' + seq.length + ')');

// feels are internally consistent
Object.entries(C.FEELS).forEach(([k, f]) => {
  const n = f.ts === '3/4' ? 6 : 8;
  ok([f.gtr, f.bass, f.kick, f.snare, f.hat].every(p => p.length === n), 'feel ' + k + ' pattern lengths = ' + n);
});

// song library: every chart parses, every chord has a shape, feel matches the time signature
const SONGS = require('../songs.js');
const ids = new Set();
SONGS.forEach(s => {
  ok(!ids.has(s.id), s.id + ' id is unique'); ids.add(s.id);
  ok(C.FEELS[s.feel] && C.FEELS[s.feel].ts === s.ts, s.id + ' feel ' + s.feel + ' fits ' + s.ts);
  s.sections.forEach(sec => {
    const p = C.parseChart(sec[1]);
    ok(p.bars.length >= 4 && !p.bad.length, s.id + ' ' + sec[0] + ': ' + p.bars.length + ' bars' + (p.bad.length ? ', bad ' + p.bad.join(' ') : ''));
  });
});

console.log(fail ? fail + ' FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
