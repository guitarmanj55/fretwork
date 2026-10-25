/* Songs to play along with: traditional and public-domain tunes only, chords only (no lyrics).
   Each section's chart uses the same format as the song editor: bars split by | or new lines. */
(function (root) {
  'use strict';
  const SONGS = [
    { id: 's-grace', name: 'Amazing Grace', origin: 'Hymn, 1779 (tune "New Britain")', key: 'G', bpm: 90, ts: '3/4', feel: 'waltz', level: 'Beginner',
      tip: 'Three chords. Keep the waltz strum steady and change on beat 1 without stopping.',
      sections: [['Verse', 'G | G | C | G | G | G | D | D | G | G | C | G | G | D | G | G']] },
    { id: 's-saints', name: 'When the Saints Go Marching In', origin: 'Traditional (American)', key: 'G', bpm: 112, ts: '4/4', feel: 'folk', level: 'Beginner',
      tip: 'Listen to how G7 pulls towards C. Get your C fingers moving on the last up-strum of the G7 bar.',
      sections: [['Verse', 'G | G | G | G | G | G | D | D | G | G7 | C | C | G | D | G | G']] },
    { id: 's-susanna', name: 'Oh! Susanna', origin: 'Stephen Foster, 1848', key: 'G', bpm: 100, ts: '4/4', feel: 'folk', level: 'Beginner',
      tip: 'The chorus opens on C. Practise the G to C change on its own first.',
      sections: [['Verse', 'G | G | G | D | G | G | D | G'], ['Chorus', 'C | C | G | D | G | G | D | G']] },
    { id: 's-redriver', name: 'Red River Valley', origin: 'Traditional (North American)', key: 'D', bpm: 96, ts: '4/4', feel: 'folk', level: 'Beginner',
      tip: 'D, A7 and G only. Keep your third finger anchored on the B string between D and A7 where you can.',
      sections: [['Verse', 'D | D | D | A7 | A7 | A7 | A7 | D'], ['Chorus', 'D | D7 | G | G | D | A7 | A7 | D']] },
    { id: 's-swinglow', name: 'Swing Low, Sweet Chariot', origin: 'Spiritual, 19th century', key: 'D', bpm: 80, ts: '4/4', feel: 'folk', level: 'Beginner',
      tip: 'Two chords in some bars: change on beat 3 and keep strumming through the change.',
      sections: [['Chorus', 'D | G D | D | A | D | G D | D A | D']] },
    { id: 's-auld', name: 'Auld Lang Syne', origin: 'Traditional Scottish (Burns, 1788)', key: 'G', bpm: 88, ts: '4/4', feel: 'folk', level: 'Easy',
      tip: 'Em to C and D7 to G each happen inside one bar, so the changes come every two beats.',
      sections: [['Verse', 'G | D7 | G | C | G | D7 | Em C | D7 G'], ['Chorus', 'G | D7 | G | C | G | D7 | Em C | D7 G']] },
    { id: 's-sailor', name: 'Drunken Sailor', origin: 'Sea shanty, traditional', key: 'Dm', bpm: 116, ts: '4/4', feel: 'rock', level: 'Easy',
      tip: 'Driving down-strums. Am to Dm comes fast at the end of each line, so keep your wrist loose.',
      sections: [['Verse', 'Dm | Dm | C | C | Dm | Dm | Am | Dm'], ['Chorus', 'Dm | Dm | C | C | Dm | Dm | Am | Dm']] },
    { id: 's-rising', name: 'House of the Rising Sun', origin: 'Traditional (American folk)', key: 'Am', bpm: 105, ts: '3/4', feel: 'waltz', level: 'Easy',
      tip: 'F is the only barre. If it buzzes, play Fmaj7 (x x 3 2 1 0) until it is clean, then swap back.',
      sections: [['Verse', 'Am | C | D | F | Am | C | E | E | Am | C | D | F | Am | E | Am | E']] },
    { id: 's-silent', name: 'Silent Night', origin: 'Franz Gruber, 1818', key: 'C', bpm: 96, ts: '3/4', feel: 'waltz', level: 'Easy',
      tip: 'Long stretches on one chord: use them to relax your fretting hand and keep the waltz even.',
      sections: [['Verse', 'C | C | C | C | G7 | G7 | C | C | F | F | C | C | F | F | C | C | G7 | G7 | C | C | C | G7 | C | C']] },
    { id: 's-scarborough', name: 'Scarborough Fair', origin: 'Traditional English ballad', key: 'Am', bpm: 100, ts: '3/4', feel: 'waltz', level: 'Easy',
      tip: 'The D chord gives the tune its old, modal sound. Try it fingerpicked once the changes are easy.',
      sections: [['Verse', 'Am | Am | G | Am | C | Am | D | Am | Am | C | G | G | Am | G | Am | Am']] },
    { id: 's-greensleeves', name: 'Greensleeves', origin: 'Traditional English, 16th century', key: 'Am', bpm: 100, ts: '3/4', feel: 'waltz', level: 'Intermediate',
      tip: 'Am F E is the heart of it. Lead with your first finger from F to E: it stays on the first fret.',
      sections: [['Verse', 'Am | C | G | Em | Am | F | E | E | Am | C | G | Em | Am | E | Am | Am'],
        ['Chorus', 'C | C | G | Em | Am | F | E | E | C | C | G | Em | Am | E | Am | Am']] },
    { id: 's-wayfaring', name: 'Wayfaring Stranger', origin: 'Traditional (American folk hymn)', key: 'Am', bpm: 72, ts: '4/4', feel: 'ballad', level: 'Intermediate',
      tip: 'Slow and fingerpicked. Let each chord ring and keep the thumb on the bass string steady.',
      sections: [['Verse', 'Am | Am | Dm | Am | Am | Am | E | E | Am | Am | Dm | Am | Am | E | Am | Am'],
        ['Chorus', 'F | F | C | C | F | F | E | E | Am | Am | Dm | Am | Am | E | Am | Am']] }
  ];
  root.SONGS = SONGS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SONGS;
})(typeof window !== 'undefined' ? window : globalThis);
