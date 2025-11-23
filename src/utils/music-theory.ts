
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

// Preferred Root Names for Circle of Fifths to avoid double sharps/flats
// C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B
export const PREFERRED_ROOT_NAMES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

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
  // Supports sharps (#, ##) and flats (b, bb)
  const match = note.match(/^([A-G](?:#{1,2}|b{1,2})?)(-?\d+)?$/);
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
  // Basic lookup in NOTES array (sharps)
  let index = NOTES.indexOf(noteName);
  if (index !== -1) return index;
  
  // Handle flats if passed (convert to sharps) - implicit via accidental parsing below
  // Also handle standard enharmonics if not found
  
  // Simple normalize function before lookup
  // But our input `noteName` might be "E#" from user or other logic.
  // Since `NOTES` only has C, C#, D... we need to be robust.
  
  // Try stripping accidental
  const letter = noteName.charAt(0);
  const accidental = noteName.slice(1);
  
  let baseIndex = NOTES.indexOf(letter);
  if (baseIndex === -1) return 0; // Should not happen for valid notes
  
  if (accidental === '#') baseIndex += 1;
  if (accidental === 'b') baseIndex -= 1;
  if (accidental === '##') baseIndex += 2;
  if (accidental === 'bb') baseIndex -= 2;
  
  return (baseIndex + 12) % 12;
};

// Helper to spell a note correctly based on target letter and absolute pitch
const spellNote = (targetIndex: number, targetLetter: string): string => {
  const letterIndex = NOTES.indexOf(targetLetter);
  
  // Calculate difference in semitones
  // e.g. Target C# (1), Letter C (0) -> Diff 1 -> C#
  // Target F (5), Letter E (4) -> Diff 1 -> E#
  
  // We need shortest distance direction? 
  // Usually sharp/flat count is small (-2 to +2).
  
  let diff = targetIndex - letterIndex;
  
  // Normalize diff to range [-6, 6] roughly
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  if (diff === 0) return targetLetter;
  if (diff === 1) return `${targetLetter}#`;
  if (diff === 2) return `${targetLetter}##`; // Double sharp (x)
  if (diff === -1) return `${targetLetter}b`;
  if (diff === -2) return `${targetLetter}bb`;
  
  // Fallback if something is weird (e.g. C to F# is tritone, not usually spelled as C#####)
  // Just return the raw note from NOTES array if spelling fails?
  return NOTES[targetIndex];
};

export const transpose = (note: string, semitones: number): string => {
  const { name, octave } = parseNote(note);
  const index = getNoteIndex(name);
  const absoluteIndex = index + octave * 12 + semitones;
  return getNoteFromIndex(absoluteIndex, 0); // octave is handled by absoluteIndex logic
};

// Circle of Fifths Logic
// C -> G -> D -> A -> E -> B -> F# -> C# -> G# -> D# -> A# -> F
// Steps: +7 semitones (or -5)
export const getNextRootCircleOfFifths = (currentRootIndex: number, direction: 1 | -1): number => {
  // Direction 1: Clockwise (Sharps) -> +7 semitones
  // Direction -1: Counter-Clockwise (Flats) -> -7 semitones (or +5)
  
  const step = direction === 1 ? 7 : 5; // +7 or +5 (equivalent to -7 mod 12)
  return (currentRootIndex + step) % 12;
};

export const getScaleNotes = (root: string, mode: ScaleMode = 'Ionian', octaves: number = 1): string[] => {
  const { name: rootName, octave: rootOctave } = parseNote(root);
  const rootIndex = getNoteIndex(rootName);
  const intervals = MODES[mode];
  
  // Determine Root Letter Sequence
  // Diatonic modes (7 notes) must use consecutive letters.
  // e.g. C# -> D -> E -> F -> G -> A -> B
  // Letters array:
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  
  // Find index of root letter
  const rootLetter = rootName.charAt(0); // "C" from "C#"
  const rootLetterIndex = LETTERS.indexOf(rootLetter);
  
  const notes: string[] = [];
  
  for (let i = 0; i < octaves; i++) {
    const currentOctave = rootOctave + i;
    
    // Correct logic:
    // We iterate through intervals.
    // For each interval, we determine:
    // 1. The absolute pitch index (0-11 relative to octave).
    // 2. The target letter (for diatonic modes).
    // 3. The actual octave (might bump up if we cross B->C).
    
    // Actually, let's just generate the pitch values first.
    // Then apply spelling.
    
    intervals.forEach((interval, degree) => {
       const absPitch = (rootIndex + interval) % 12;
       
       // Determine target letter
       // For Diatonic/Heptatonic modes:
       // Degree 0 -> Root Letter
       // Degree 1 -> Next Letter
       // ...
       let targetLetter = '';
       
       if (mode === 'Chromatic') {
         // Chromatic: just use standard sharp names
         notes.push(getNoteFromIndex(absPitch, currentOctave)); 
         // Note: Octave logic in getNoteFromIndex handles wrapping?
         // getNoteFromIndex adds octave shift based on index / 12. 
         // Here index is just 0-11.
         // We need to track if we crossed C.
         // Let's assume standard naming for chromatic.
       } else {
         // Diatonic
         const targetLetterIndex = (rootLetterIndex + degree) % 7;
         targetLetter = LETTERS[targetLetterIndex];
         
         // Spell it!
         const spelledNoteName = spellNote(absPitch, targetLetter);
         
         // Calculate Octave
         // If the pitch index is lower than the root pitch index (and it's not the root itself being 0 and root being 11?),
         // it usually means we crossed into next octave? 
         // Or strictly: when letter resets C?
         // Standard convention: Octave increments at C.
         
         // We need to determine the octave of this specific note.
         // Base octave is currentOctave.
         // If the note is "lower" than root in pitch class but higher in degree?
         // Example: Root B3 (11). Next C#4 (1).
         // Letter B -> C. Octave increments.
         
         // Simple heuristic: compare Letter index.
         // If targetLetterIndex < rootLetterIndex, we definitely crossed C (e.g. B(6) -> C(0)).
         // So add 1 to octave.
         // BUT wait, if we wrap multiple times (multi-octave request)?
         // `currentOctave` variable tracks the base for this iteration `i`.
         
         let noteOctave = currentOctave;
         if (targetLetterIndex < rootLetterIndex) {
            noteOctave += 1;
         }
         
         // Special case: If Root is C, targetLetterIndex < rootLetterIndex never happens for first octave?
         // C(0) -> D(1) ... B(6).
         // All good.
         // If Root is B(6).
         // Degree 0: B.
         // Degree 1: C (0). 0 < 6. Octave++.
         
         notes.push(`${spelledNoteName}${noteOctave}`);
       }
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

// Helper to get Roman Numeral for a scale degree and chord type
export const getRomanNumeral = (degree: number, type: ChordType): string => {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  if (degree < 0 || degree >= numerals.length) return '';
  
  const base = numerals[degree];
  
  switch (type) {
    case 'maj':
    case 'maj7':
      return base;
    case 'min':
    case 'min7':
      return base.toLowerCase();
    case 'dim':
      return base.toLowerCase() + '°';
    case 'aug':
      return base + '+';
    case 'sus2':
      return base + 'sus2';
    case 'sus4':
      return base + 'sus4';
    case '7': // Dominant 7 (e.g. V7)
      return base + '7';
    default:
      return base;
  }
};

  // Logic to get diatonic chord for a scale degree
export const getDiatonicChordType = (scaleNotes: string[], degreeIndex: number): ChordType => {
  // Handle wrapping index safely
  const root = parseNote(scaleNotes[degreeIndex % scaleNotes.length]);
  const third = parseNote(scaleNotes[(degreeIndex + 2) % scaleNotes.length]);
  const fifth = parseNote(scaleNotes[(degreeIndex + 4) % scaleNotes.length]);
  
  if (!root || !third || !fifth) return 'maj';

  // Calculate interval distance handling wrapping (modulo 12)
  let thirdInterval = (third.absValue - root.absValue) % 12;
  if (thirdInterval < 0) thirdInterval += 12;
  
  let fifthInterval = (fifth.absValue - root.absValue) % 12;
  if (fifthInterval < 0) fifthInterval += 12;

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
       const rootName = PREFERRED_ROOT_NAMES[rootIndex];
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

// Helper to get Roman Numeral for a scale degree and chord type - DEPRECATED duplicate logic, removed.
// Use the one below.

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
