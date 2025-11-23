
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

// Helper to parse note into { name, octave, absValue }
const parseNote = (note: string) => {
  const match = note.match(/^([A-G]#?)(-?\d+)?$/);
  if (!match) return { name: 'C', octave: 4, absValue: 48 }; // Default C4
  
  const name = match[1];
  const octave = match[2] ? parseInt(match[2]) : 4;
  const noteIndex = getNoteIndex(name);
  const absValue = octave * 12 + noteIndex;
  
  return { name, octave, absValue };
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

export const applyGenericInversion = (notes: string[], steps: number): string[] => {
  if (steps === 0) return notes;

  // Parse all notes to get absolute values
  let parsedNotes = notes.map(n => parseNote(n));
  
  // Sort by pitch (absolute value)
  parsedNotes.sort((a, b) => a.absValue - b.absValue);

  if (steps > 0) {
    for (let i = 0; i < steps; i++) {
      // Take the lowest note
      const lowest = parsedNotes.shift();
      if (lowest) {
        // Move up 1 octave (+12 semitones)
        const newAbs = lowest.absValue + 12;
        const newName = getNoteFromIndex(newAbs, 0);
        parsedNotes.push(parseNote(newName));
        // Re-sort
        parsedNotes.sort((a, b) => a.absValue - b.absValue);
      }
    }
  } else {
    const absSteps = Math.abs(steps);
    for (let i = 0; i < absSteps; i++) {
      // Take the highest note
      const highest = parsedNotes.pop();
      if (highest) {
        // Move down 1 octave (-12 semitones)
        const newAbs = highest.absValue - 12;
        const newName = getNoteFromIndex(newAbs, 0);
        parsedNotes.unshift(parseNote(newName));
        // Re-sort
        parsedNotes.sort((a, b) => a.absValue - b.absValue);
      }
    }
  }

  return parsedNotes.map(n => getNoteFromIndex(n.absValue, 0));
};

export const getChordNotes = (root: string, type: ChordType = 'maj', inversion: number = 0): string[] => {
  const { name, octave } = parseNote(root);
  const rootIndex = getNoteIndex(name);
  const intervals = CHORD_INTERVALS[type];
  
  let notes = intervals.map(interval => {
    return getNoteFromIndex(rootIndex + interval + octave * 12, 0);
  });

  // Apply generic inversion
  // Original `inversion` param was 0, 1, 2... always up.
  // Now we can use our generic helper if needed, or keep this simple loop for compatibility.
  // But `applyGenericInversion` is more robust.
  // Let's assume `inversion` here is strictly positive (standard theory).
  return applyGenericInversion(notes, inversion);
};

// Logic to get diatonic chord for a scale degree
export const getDiatonicChordType = (scaleNotes: string[], degreeIndex: number): ChordType => {
  // We need to determine if interval is Major (4 semitones) or Minor (3 semitones)
  // Scale notes should be enough.
  const root = parseNote(scaleNotes[degreeIndex]);
  const third = parseNote(scaleNotes[degreeIndex + 2]);
  const fifth = parseNote(scaleNotes[degreeIndex + 4]);
  
  if (!root || !third || !fifth) return 'maj';

  const thirdInterval = third.absValue - root.absValue;
  const fifthInterval = fifth.absValue - root.absValue;

  if (fifthInterval === 7) {
    if (thirdInterval === 4) return 'maj';
    if (thirdInterval === 3) return 'min';
  }
  if (fifthInterval === 6 && thirdInterval === 3) return 'dim';
  if (fifthInterval === 8 && thirdInterval === 4) return 'aug';
  
  return 'maj'; // Default fallback
};

// Detect chord name from notes
export const detectChordName = (notes: string[]): string => {
  if (!notes || notes.length === 0) return '';

  const parsed = notes.map(n => parseNote(n)).sort((a, b) => a.absValue - b.absValue);
  
  // Get the lowest note (bass note for inversion detection)
  const bassNote = parsed[0].name;

  // We need to find the "Root" of the chord, which might not be the bass note.
  // Algorithm:
  // 1. Create pitch class set (0-11) relative to C.
  // 2. Try every note in the set as a potential root.
  // 3. Calculate intervals from that potential root.
  // 4. Match against known chord shapes.

  const pitchClasses = parsed.map(n => getNoteIndex(n.name));
  const uniquePitchClasses = [...new Set(pitchClasses)].sort((a, b) => a - b);

  // Known chord signatures (intervals from root)
  const signatures: Record<string, string> = {
    '0,4,7': '',     // Maj
    '0,3,7': 'm',    // Min
    '0,3,6': 'dim',  // Dim
    '0,4,8': 'aug',  // Aug
    '0,2,7': 'sus2', // Sus2
    '0,5,7': 'sus4', // Sus4
    '0,4,7,11': 'maj7',
    '0,4,7,10': '7',
    '0,3,7,10': 'm7',
    '0,3,6,9': 'dim7',
    '0,3,6,10': 'm7b5', // Half-dim
  };

  for (const rootIndex of uniquePitchClasses) {
    // Calculate intervals relative to this potential root
    // (p - root + 12) % 12
    const currentIntervals = uniquePitchClasses
      .map(p => (p - rootIndex + 12) % 12)
      .sort((a, b) => a - b)
      .join(',');

    if (signatures[currentIntervals] !== undefined) {
       // Found a match!
       const rootName = NOTES[rootIndex];
       const quality = signatures[currentIntervals];
       
       // Check for inversion
       if (rootName !== bassNote) {
         return `${rootName}${quality}/${bassNote}`;
       } else {
         return `${rootName}${quality}`;
       }
    }
  }

  return '?'; 
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
