
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type Note = string; // e.g., "C4", "F#4"
export type ChordType = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | '7' | 'maj7' | 'min7';
export type ScaleMode = 'Ionian' | 'Dorian' | 'Phrygian' | 'Lydian' | 'Mixolydian' | 'Aeolian' | 'Locrian' | 'Chromatic';

export const MODES: Record<ScaleMode, number[]> = {
  Ionian: [0, 2, 4, 5, 7, 9, 11], // Major
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10], // Minor
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const CHORD_INTERVALS: Record<ChordType, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

// Helper to parse note into { name, octave }
const parseNote = (note: string) => {
  const match = note.match(/^([A-G]#?)(-?\d+)?$/);
  if (!match) return { name: 'C', octave: 4 };
  return { name: match[1], octave: match[2] ? parseInt(match[2]) : 4 };
};

// Helper to get note from index
const getNoteFromIndex = (index: number, octave: number) => {
  const normalizedIndex = ((index % 12) + 12) % 12;
  const octaveShift = Math.floor(index / 12);
  return `${NOTES[normalizedIndex]}${octave + octaveShift}`;
};

// Helper to get semitone index of a note
const getNoteIndex = (noteName: string) => {
  return NOTES.indexOf(noteName);
};

export const transpose = (note: string, semitones: number): string => {
  const { name, octave } = parseNote(note);
  const index = getNoteIndex(name);
  const absoluteIndex = index + octave * 12 + semitones;
  return getNoteFromIndex(absoluteIndex, 0); // octave is handled by absoluteIndex logic
};

export const getScaleNotes = (root: string, mode: ScaleMode = 'Ionian', octaves: number = 1): string[] => {
  const { name: rootName, octave: rootOctave } = parseNote(root);
  const rootIndex = getNoteIndex(rootName);
  const intervals = MODES[mode];
  
  const notes: string[] = [];
  for (let i = 0; i < octaves; i++) {
    const currentOctaveStart = rootIndex + (rootOctave + i) * 12;
    intervals.forEach(interval => {
       notes.push(getNoteFromIndex(currentOctaveStart + interval, 0));
    });
  }
  return notes;
};

export const getChordNotes = (root: string, type: ChordType = 'maj', inversion: number = 0): string[] => {
  const { name, octave } = parseNote(root);
  const rootIndex = getNoteIndex(name);
  const intervals = CHORD_INTERVALS[type];
  
  let notes = intervals.map(interval => {
    return getNoteFromIndex(rootIndex + interval + octave * 12, 0);
  });

  // Apply inversion
  // 1st inversion: move first note up an octave
  // 2nd inversion: move first two notes up an octave
  for (let i = 0; i < inversion; i++) {
    const noteToMove = notes.shift();
    if (noteToMove) {
      notes.push(transpose(noteToMove, 12));
    }
  }

  return notes;
};

// Logic to get diatonic chord for a scale degree
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getDiatonicChordType = (_degree: number, _mode: ScaleMode): ChordType => {
  // Simplified logic for now, assumes standard diatonic triads for major/minor
  // This is complex for arbitrary modes, but we can map basic triads.
  // Major Scale (Ionian): I-maj, ii-min, iii-min, IV-maj, V-maj, vi-min, vii-dim
  
  // Intervals relative to scale root:
  // Ionian:  M m m M M m dim
  // Aeolian: m dim M m m M M
  
  // We can determine the chord quality by checking the third and fifth intervals within the scale notes.
  // But for simplicity, we'll implement a lookup for common modes or calculate it.
  
  // Calculating is better:
  // 1. Get scale notes (2 octaves)
  // 2. Take degree (0-based), degree+2, degree+4 (tertiary stacking)
  // 3. Measure intervals to determine chord quality.
  
  return 'maj'; // Placeholder, will be calculated in `getDiatonicChord`
};

export const getDiatonicChord = (scaleNotes: string[], degreeIndex: number, inversionStrategy: boolean = true): string[] => {
  // scaleNotes should be long enough (e.g. 2 octaves) to find thirds and fifths
  const root = scaleNotes[degreeIndex];
  const third = scaleNotes[degreeIndex + 2]; // Diatonic third
  const fifth = scaleNotes[degreeIndex + 4]; // Diatonic fifth
  
  let notes = [root, third, fifth];
  
  // Handle undefined if scaleNotes is too short (shouldn't happen if we generate enough)
  if (!third || !fifth) {
     // Fallback or extend scale on fly?
     // Better to assume caller provides enough scale notes.
     return [root];
  }

  // Inversion strategy: "first 3 chords won't be inverted... starting from 4th they get inverted to fit within the octave"
  // This likely means keeping the notes within a specific pitch range to avoid jumping too high.
  // 4th degree is F in C major. 
  // If we strictly follow the rule: degrees 0, 1, 2 -> root position. degrees 3+ -> invert?
  
  if (inversionStrategy && degreeIndex >= 3) {
    // Invert to keep lower? 
    // Simple 2nd inversion usually brings the high notes down.
    // Or just move the top notes down an octave?
    // "Inverted to fit within the octave" -> typically means keeping the bass close to the root of the key?
    // Let's try 1st inversion for 3, 4, and 2nd for 5, 6?
    // The prompt says: "starting from the 4th they get inverted"
    // Let's apply 1st inversion to degree 3 and up (4th chord is index 3).
    // Actually, let's just drop the octave of the top notes if they go too high?
    
    // Interpretation: Invert the chord so the lowest note is not the root, but a chord tone that keeps it lower.
    // E.g. F Major (F A C) -> C F A (2nd inversion) or A C F (1st inversion)
    
    // Let's try a simple rule: if degree >= 3, apply 2nd inversion (move top 2 notes down octave? No, standard inversion moves bottom up).
    // To "fit within the octave" usually means "keep the pitch range compact".
    // Let's try: drop the top notes by an octave to make them the bass?
    // That is effectively an inversion.
    
    // Let's just apply `transpose(note, -12)` to the top notes to bring them down?
    // F A C -> C4 F4 A4 (if F is F4).
    // If we have F4 A4 C5, and we want it "in the octave", maybe we want C4 F4 A4.
    
    // Let's implement a simple inversion for now:
    // degree 3 (IV): 2nd inversion (Fifth in bass)
    // degree 4 (V): 2nd inversion
    // degree 5 (vi): 1st inversion?
    // Let's stick to the user prompt: "starting from the 4th they get inverted"
    
    // We will return [fifth-12, root, third] (2nd inversion downwards) or similar.
    
    // For now, let's just take the generated notes [R, 3, 5] and if degree >= 3:
    // Shift the whole chord down? No, that's not inversion.
    // Inversion is changing the bass note.
    
    // Let's try this:
    // If degree >= 3:
    //   Take the 5th, drop it 1 octave.
    //   Take the 3rd, drop it 1 octave?
    //   Result: 5th(low), 3rd(low), Root. 
    
    // We want to minimize movement from the key root.
    
    // Let's just hardcode a "Compact Mode" strategy:
    // Shift notes down by 12 if they are > some threshold relative to key root?
    // Or just use standard inversions:
    // Degree 3 (IV): F A C -> C F A (2nd Inv) -> C down octave?
    
    // Let's simply implement:
    // If degree >= 3, move the top note (5th) down an octave.
    // If degree >= 5, move the 3rd down an octave too?
    
    // Let's stick to a standard voice leading pattern often used in pad controllers.
    // Degrees 0-2: Root pos (1 3 5)
    // Degrees 3-6: Inversions.
    
    if (degreeIndex >= 3) {
       // 2nd Inversion: 5 1 3
       // We take the 5th and drop it an octave.
       notes = [transpose(fifth, -12), root, third];
       
       // If it's really high, maybe drop the root too?
       // Let's keep it simple.
    }
  }
  
  return notes;
};

