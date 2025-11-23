import { useEffect, useState, useRef, useMemo } from 'react';
import { useGamepad } from './hooks/useGamepad';
import type { GamepadState } from './hooks/useGamepad';
import { RadialMenu } from './components/RadialMenu';
import { Instructions } from './components/Instructions';
import {
  getScaleNotes,
  getChordNotes,
  getDiatonicChord,
  applyGenericInversion,
  detectChordName,
  getNextRootCircleOfFifths,
  PREFERRED_ROOT_NAMES,
  NOTES,
  getDiatonicChordType
} from './utils/music-theory';
import type { ScaleMode, ChordType } from './utils/music-theory';
import { audioEngine } from './audio/AudioEngine';
import type { InstrumentType } from './audio/AudioEngine';
import { Music, Settings, ArrowLeftRight } from 'lucide-react';

const SCALE_MODES: ScaleMode[] = [
  'Chromatic',
  'Lydian',
  'Ionian',
  'Mixolydian',
  'Dorian',
  'Aeolian',
  'Phrygian',
  'Locrian'
];

const getModeLabel = (mode: ScaleMode) => {
  if (mode === 'Ionian') return 'Ionian (Major)';
  if (mode === 'Aeolian') return 'Aeolian (Minor)';
  return mode;
};

function App() {
  const gamepad = useGamepad();
  const prevGamepadRef = useRef<GamepadState>(gamepad);

  // App State
  const [rootNoteIndex, setRootNoteIndex] = useState(0); // C
  const [scaleModeIndex, setScaleModeIndex] = useState(2); // Ionian (Default)

  // Replaced globalTranspose with chordInversionOffset
  const [chordInversionOffset, setChordInversionOffset] = useState(0);

  const [volume] = useState(-10); // dB
  
  // Instrument Settings
  const [melodyInstrument, setMelodyInstrument] = useState<InstrumentType>('synth');
  const [chordInstrument, setChordInstrument] = useState<InstrumentType>('synth');

  // Current Selection State (Visual)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [selectedChordIndex, setSelectedChordIndex] = useState<number | null>(null);

  // Preview State (Subtle indication before selection)
  const [previewNoteIndex, setPreviewNoteIndex] = useState<number | null>(null);
  const [previewChordIndex, setPreviewChordIndex] = useState<number | null>(null);

  // Playing State (Audio)
  const [playingNote, setPlayingNote] = useState<string | null>(null);
  const [playingChord, setPlayingChord] = useState<string[] | null>(null);

  const [activeChordType, setActiveChordType] = useState<ChordType | null>(null);

  // Audio Ready State
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Computed Theory Data
  // Use preferred root names (e.g. Eb instead of D#) to avoid double sharps in Major keys
  const currentRoot = PREFERRED_ROOT_NAMES[rootNoteIndex];
  const currentMode = SCALE_MODES[scaleModeIndex];
  const currentRootWithOctave = `${currentRoot}4`; // Base octave 4

  // Generate Scale Notes
  const scaleNotes = useMemo(() => {
    if (currentMode === 'Chromatic') {
      return NOTES.map(n => `${n}4`);
    }
    return getScaleNotes(currentRootWithOctave, currentMode, 1);
  }, [currentRootWithOctave, currentMode]);

  // Display Labels - Map Fixed Positions to Scale Notes
  // Requirements:
  // 1. Show only the 7 notes in the scale (or 12 if Chromatic).
  // 2. Preserve positions relative to "Root at Top" or "C at Top"?
  //    User said: "don't change the position of C,D,E,F,G,A,B just sharpen and flatten"
  //    This implies a FIXED Layout where the top slice is ALWAYS some form of C (C, C#, Cb).
  //    The next slice is D (D, D#, Db), etc.
  //    So we need 7 slices fixed: C-ish, D-ish, E-ish, F-ish, G-ish, A-ish, B-ish.
  //    But wait, a scale might have C# and D# and E?
  //    Example D Major: D, E, F#, G, A, B, C#
  //    If we map to fixed C-D-E-F-G-A-B slots:
  //    Slot C: C#
  //    Slot D: D
  //    Slot E: E
  //    Slot F: F#
  //    Slot G: G
  //    Slot A: A
  //    Slot B: B
  //    This covers all 7 notes.
  //    What if we have a scale with 8 notes? (Bebop?) - We only support 7-note modes + Chromatic.
  //    What if a scale has no C-ish note? (e.g. B# and C# but no C natural).
  //    Standard Diatonic scales always have one of each letter name (heptatonic).
  //    So we can map each scale note to its letter name slot!

  const fixedSlots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Helper to map scale notes to fixed slots AND generate labels
  const getScaleLabels = (notes: string[], isChordWheel: boolean): ({ main: string; sub?: string } | string)[] => {
    if (currentMode === 'Chromatic') {
      // Chromatic: 12 fixed notes
      // For Chords: Just Note Name? Or Roman I, bII?
      // Let's keep it simple for Chromatic for now: Note Name
      return NOTES.map(n => ({ main: n, sub: isChordWheel ? 'Maj' : '' }));
    }

    const labels = new Array(7).fill({ main: '', sub: '' });
    
    notes.forEach((note, index) => {
      const noteName = note.replace(/\d+/, '');
      const letter = noteName.charAt(0);
      const slotIndex = fixedSlots.indexOf(letter);
      
      if (slotIndex !== -1) {
        if (isChordWheel) {
          // Chord Wheel: Roman Numeral (Main) + Note Name (Sub)
          // Determine quality
          let quality: ChordType = 'maj';
          if (activeChordType) {
            quality = activeChordType;
          } else {
            quality = getDiatonicChordType(notes, index);
          }
          
          // Determine interval for Roman Numeral (need to check against root)
          // Parse root and current note to find interval
          // Or just use index if we trust scaleNotes order?
          // scaleNotes is ordered by degree 0-6.
          // So 'index' passed here is the degree index.
          
          // Need interval from root.
          // notes[0] is root.
          // We need pitch difference.
          // Let's assume getScaleNotes returns correct degree order.
          // But wait, getDiatonicChordType uses absolute pitch diff.
          // getRomanNumeral needs "intervalFromRoot" in semitones.
          // Let's calculate it.
          
          // We need to parse notes to get semitones.
          // Since we don't have parseNote exported, let's rely on index roughly?
          // No, accidentals matter (bIII vs III).
          // Let's fetch the interval from the scale generation logic?
          // Or just re-calculate:
          
          // Simple lookup since we are in App.tsx and don't have easy access to helpers without importing more.
          // But we can assume for Diatonic modes, the interval sequence is fixed by mode?
          // Yes, but we need to know it.
          // Actually, `getRomanNumeral` needs `intervalFromRoot`.
          
          // Let's try to approximate or use logic from music-theory.ts if possible.
          // Or... pass simply the note name?
          
          // Better approach: Calculate labels in useMemo using scaleNotes.
          
          // Re-implement basic interval calc or export helper?
          // Let's stick to the label generation here.
          
          // We need the semitone interval.
          // notes[index] vs notes[0].
          // Since we don't have `parseNote` here, we can't easily calc semitones.
          // Maybe just export `getNoteIndex`?
          
          // Let's assume standard mode intervals for now or just use the Roman Numeral directly if I import `getNoteIndex`?
          // I will import `getRomanNumeral` which expects `intervalFromRoot`.
          // I need `getNoteIndex` to calculate that.
          
          // Actually, `scaleNotes` are strings like "C4", "D4".
          // We can use `Tone.Frequency(note).toMidi()` if available? No, Tone is in AudioEngine.
          // Let's export `getNoteIndex` from music-theory.ts?
          // Or just add it to imports.
          
          // Wait, I can't easily change imports in the same `search_replace` block if I didn't plan it.
          // I did import `getRomanNumeral` and `getDiatonicChordType`.
          // I should also import `getNoteIndex` or `parseNote`.
          // But `parseNote` is not exported.
          
          // Alternative: Update `getRomanNumeral` to accept note strings and calculate itself?
          // No, it takes `intervalFromRoot`.
          
          // Let's assume I can't calc interval easily here.
          // But wait, `getDiatonicChordType` calculates quality based on scale notes!
          // Maybe `getRomanNumeral` can just take `scaleNotes` and `degreeIndex` and do the work?
          // That would be cleaner.
          // But I already implemented it taking `intervalFromRoot`.
          
          // Let's temporarily add a helper here or rely on the `MODES` object if I exported it?
          // `MODES` is not exported in the `search_replace`.
          
          // Okay, I will export `parseNote` or `getNoteIndex` in a separate step?
          // No, I can just use `activeChordType` overrides.
          // If I don't have exact interval, I might guess.
          // But accuracy is key.
          
          // Let's use a simplified Roman Numeral logic here or fix the imports.
          // I will use a placeholder for now and fix it, or...
          // Actually, I can just use the `activeChordType` to force the string.
          
          // If I can't calc precise interval (b3 vs 3), I might miss bIII vs III.
          // In Minor mode, index 2 is b3.
          // Roman numeral should be bIII (Major) or biii (Minor).
          // The prefix depends on the interval.
          
          // Let's assume standard Roman numerals for the *Mode*.
          // I.e. in Dorian: i, ii, bIII, IV, v, vi°, bVII.
          // This is constant for the mode!
          // I don't need to calc intervals from notes. I just need the Mode's interval structure.
          // But `activeChordType` overrides the *quality* (case), not the root interval (bIII).
          
          // So I can define a map of Roman Bases for each Mode?
          // Ionian: I, II, III, IV, V, VI, VII
          // Aeolian: I, II, bIII, IV, V, bVI, bVII
          // etc.
          
          // This is hardcoding but safe.
          // "chromatic" mode is handled separately.
          
          // Let's define `MODE_ROMANS`.
          
          const romanBases: Record<ScaleMode, string[]> = {
             Ionian: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
             Dorian: ['I', 'II', 'bIII', 'IV', 'V', 'VI', 'bVII'],
             Phrygian: ['I', 'bII', 'bIII', 'IV', 'V', 'bVI', 'bVII'],
             Lydian: ['I', 'II', 'III', '#IV', 'V', 'VI', 'VII'],
             Mixolydian: ['I', 'II', 'III', 'IV', 'V', 'VI', 'bVII'],
             Aeolian: ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII'],
             Locrian: ['I', 'bII', 'bIII', 'IV', 'bV', 'bVI', 'bVII'],
             Chromatic: [] // Handled above
          };
          
          let baseRoman = romanBases[currentMode][index];
          
          // Apply Quality Case
          if (quality === 'min' || quality === 'dim' || quality === 'min7') {
             baseRoman = baseRoman.toLowerCase();
          }
          
          // Suffix
          let suffix = '';
          if (quality === 'dim') suffix = '°';
          if (quality === 'aug') suffix = '+';
          if (quality === 'sus2') suffix = 'sus2';
          if (quality === 'sus4') suffix = 'sus';
          
          labels[slotIndex] = { main: baseRoman + suffix, sub: noteName };
          
        } else {
          // Melody Wheel: Scale Degree (Main) + Note Name (Sub)
          // Degrees: 1, 2, 3, 4, 5, 6, 7
          // But maybe add b3, #4 etc?
          // Again, depends on Mode intervals.
          // Let's use standard numbers 1-7 for now, maybe with b/# if mode implies it?
          // "iii for minor 3rd" implies user knows intervals.
          // Let's use the same prefixes as chords?
          // e.g. b3, #4.
          
          const degrees: Record<ScaleMode, string[]> = {
             Ionian: ['1', '2', '3', '4', '5', '6', '7'],
             Dorian: ['1', '2', 'b3', '4', '5', '6', 'b7'],
             Phrygian: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
             Lydian: ['1', '2', '3', '#4', '5', '6', '7'],
             Mixolydian: ['1', '2', '3', '4', '5', '6', 'b7'],
             Aeolian: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
             Locrian: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
             Chromatic: []
          };
          
          const degreeLabel = degrees[currentMode][index];
          labels[slotIndex] = { main: degreeLabel, sub: noteName };
        }
      }
    });
    
    return labels;
  };

  const chordLabels = useMemo(() => getScaleLabels(scaleNotes, true), [scaleNotes, currentMode, activeChordType]);
  const melodyLabels = useMemo(() => getScaleLabels(scaleNotes, false), [scaleNotes, currentMode]);

  const sliceCount = chordLabels.length; // Lengths should match


  const handleStart = async () => {
    await audioEngine.initialize();
    setIsAudioReady(true);
  };

  // Button Debounce Logic & State Updates
  useEffect(() => {
    const prev = prevGamepadRef.current;
    const curr = gamepad;

    if (!curr.connected) return;

    // D-Pad Up/Down: Root Note (Circle of Fifths)
    if (curr.buttons.dpadUp && !prev.buttons.dpadUp) {
      setRootNoteIndex(i => getNextRootCircleOfFifths(i, 1));
    }
    if (curr.buttons.dpadDown && !prev.buttons.dpadDown) {
      setRootNoteIndex(i => getNextRootCircleOfFifths(i, -1));
    }

    // D-Pad Left/Right: Inversion Offset
    // Replaced Transpose with Inversion Offset
    if (curr.buttons.dpadLeft && !prev.buttons.dpadLeft) {
      setChordInversionOffset(i => i - 1);
    }
    if (curr.buttons.dpadRight && !prev.buttons.dpadRight) {
      setChordInversionOffset(i => i + 1);
    }

    // Bumpers: Mode
    if (curr.buttons.rb && !prev.buttons.rb) {
      setScaleModeIndex(i => (i + 1) % SCALE_MODES.length);
    }
    if (curr.buttons.lb && !prev.buttons.lb) {
      setScaleModeIndex(i => (i - 1 + SCALE_MODES.length) % SCALE_MODES.length);
    }

    // Face Buttons: Chord Modifiers
    let modifier: ChordType | null = null;
    if (curr.buttons.a) modifier = 'min';
    else if (curr.buttons.y) modifier = 'maj';
    else if (curr.buttons.x) modifier = 'dim';
    else if (curr.buttons.b) modifier = 'sus4';
    setActiveChordType(modifier);

    // Stick Clicks: Toggle Instruments
    if (curr.buttons.ls && !prev.buttons.ls) {
      setChordInstrument(prevInst => prevInst === 'synth' ? 'piano' : 'synth');
    }
    if (curr.buttons.rs && !prev.buttons.rs) {
      setMelodyInstrument(prevInst => prevInst === 'synth' ? 'piano' : 'synth');
    }

    prevGamepadRef.current = curr;
  }, [gamepad]);

  // Volume Control
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);
  
  // Instrument Update
  useEffect(() => {
    audioEngine.setInstrument('melody', melodyInstrument);
  }, [melodyInstrument]);

  useEffect(() => {
    audioEngine.setInstrument('chord', chordInstrument);
  }, [chordInstrument]);


  // Input Processing Loop (Selection & Playback)
  useEffect(() => {
    if (!gamepad.connected) return;

    // 1. Determine Selected Index (Right Stick -> Note)
    let noteIdx = selectedNoteIndex;
    let notePreviewIdx = null;

    const rMag = gamepad.axes.right.magnitude;
    if (rMag > 0.2) {
      const angle = gamepad.axes.right.angle; // 0 is North
      const sectorAngle = 360 / sliceCount;
      const targetIdx = Math.round(angle / sectorAngle) % sliceCount;

      if (rMag > 0.6) {
        noteIdx = targetIdx;
        setSelectedNoteIndex(noteIdx);
      } else {
        notePreviewIdx = targetIdx;
      }
    } else {
      if (gamepad.triggers.right < 0.05) {
        noteIdx = null;
        setSelectedNoteIndex(null);
      }
    }
    setPreviewNoteIndex(notePreviewIdx);

    // 2. Determine Selected Index (Left Stick -> Chord)
    let chordIdx = selectedChordIndex;
    let chordPreviewIdx = null;

    const lMag = gamepad.axes.left.magnitude;
    if (lMag > 0.2) {
      const angle = gamepad.axes.left.angle;
      const sectorAngle = 360 / sliceCount;
      const targetIdx = Math.round(angle / sectorAngle) % sliceCount;

      if (lMag > 0.6) {
        chordIdx = targetIdx;
        setSelectedChordIndex(chordIdx);
      } else {
        chordPreviewIdx = targetIdx;
      }
    } else {
      if (gamepad.triggers.left < 0.05) {
        chordIdx = null;
        setSelectedChordIndex(null);
      }
    }
    setPreviewChordIndex(chordPreviewIdx);

    // 3. Handle Note Playback (Right Trigger)
    const noteTrigger = gamepad.triggers.right;
    if (noteTrigger > 0.05 && noteIdx !== null) {
      const selectedItem = melodyLabels[noteIdx];
      // Handle object label
      const selectedLabel = typeof selectedItem === 'string' ? selectedItem : selectedItem?.sub;

      if (selectedLabel) {
        // Ideally we'd find the exact octave from scaleNotes, but labels are just names.
        // Let's find the full note string in scaleNotes that matches.
        const fullNote = scaleNotes.find(n => n.startsWith(selectedLabel));
        const noteToPlay = fullNote || selectedLabel + '4'; // Fallback

        // Remap trigger value (0.05-1.0) to velocity (0.3-1.0) for better response
        const velocity = 0.5 + (noteTrigger * 0.7);

        if (noteToPlay !== playingNote) {
          if (playingNote) audioEngine.stopNote(playingNote);
          audioEngine.playNote(noteToPlay, velocity);
          setPlayingNote(noteToPlay);
        }
      }
    } else {
      if (playingNote) {
        audioEngine.stopNote(playingNote);
        setPlayingNote(null);
      }
    }

    // 4. Handle Chord Playback (Left Trigger)
    const chordTrigger = gamepad.triggers.left;
    if (chordTrigger > 0.05 && chordIdx !== null) {
      const selectedItem = chordLabels[chordIdx];
      // Handle object label (use sub which is the note name)
      const selectedLabel = typeof selectedItem === 'string' ? selectedItem : selectedItem?.sub;

      if (selectedLabel) {
        let chordNotes: string[] = [];
        
        // Find full root note
        const rootForChord = scaleNotes.find(n => n.startsWith(selectedLabel)) || selectedLabel + '4';
        
        // Find Scale Degree Index for Diatonic Logic
        // We need to know where this note sits in the current *Scale* (not the UI wheel).
        // e.g. in D Major, D is index 0. F# is index 2.
        const degreeIndex = scaleNotes.findIndex(n => n.startsWith(selectedLabel));
        
        if (degreeIndex !== -1 || currentMode === 'Chromatic') {
          if (activeChordType) {
            // User override
            const baseChord = getChordNotes(rootForChord, activeChordType, 0);
            chordNotes = applyGenericInversion(baseChord, chordInversionOffset);
          } else {
            if (currentMode === 'Chromatic') {
              const baseChord = getChordNotes(rootForChord, 'maj', 0);
              chordNotes = applyGenericInversion(baseChord, chordInversionOffset);
            } else {
              // Diatonic
              // We might need extended scale for chord generation if it wraps around
              const extendedScale = getScaleNotes(currentRootWithOctave, currentMode, 2);
              const baseChord = getDiatonicChord(extendedScale, degreeIndex, true);
              chordNotes = applyGenericInversion(baseChord, chordInversionOffset);
            }
          }

          const chordFingerprint = chordNotes.join('-');
          const playingFingerprint = playingChord?.join('-');

          if (chordFingerprint !== playingFingerprint) {
            if (playingChord) audioEngine.stopChord(playingChord);
            // Remap trigger to velocity
            const velocity = 0.5 + (chordTrigger * 0.7);
            audioEngine.playChord(chordNotes, velocity);
            setPlayingChord(chordNotes);
          }
        }
      }
    } else {
      if (playingChord) {
        audioEngine.stopChord(playingChord);
        setPlayingChord(null);
      }
    }

  }, [gamepad, melodyLabels, chordLabels, scaleNotes, chordInversionOffset, activeChordType, sliceCount, currentRootWithOctave, currentMode]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-start p-8 font-sans pt-32">

      {/* Header / Status */}
      <div className="absolute top-8 w-full max-w-6xl flex justify-between items-start px-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Gamepad Instrument
          </h1>
        </div>

        <div className="text-right space-y-1">
          {!gamepad.connected && (
            <>
            <div className="bg-orange-500/20 text-orange-200 py-2 px-4 rounded-full text-xs animate-pulse">
              Searching for Gamepad...
            </div>
            <div className="text-slate-400 text-xs text-center">
              Press A to connect

            </div>
            </>
          )}
          {gamepad.connected && (
            <div className="bg-green-500/20 text-green-200 py-2 px-4 rounded-full text-xs">
              Controller Active
            </div>
          )}
        </div>
      </div>

      {/* Main Interface */}
      <Instructions />

      <div className="flex items-center gap-4 text-sm text-slate-400 mb-8 justify-center w-full">
        <div className="flex items-center gap-1">
          <Music size={16} />
          <span>Root: <strong className="text-white">{currentRoot}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <Settings size={16} />
          <span>Mode: <strong className="text-white">{getModeLabel(currentMode)}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowLeftRight size={16} />
          <span>Inversion: <strong className={chordInversionOffset !== 0 ? "text-yellow-400" : "text-white"}>
            {chordInversionOffset > 0 ? '+' : ''}{chordInversionOffset}
          </strong></span>
        </div>
      </div>
      
      {/* Instrument Controls - REMOVED CENTRAL BOX */}

      <div className="flex flex-col md:flex-row gap-16 items-center justify-center w-full max-w-6xl">

        {/* Left Stick: Chords */}
        <div className="relative group flex flex-col items-center gap-6">
          
          {/* Chord Sound Toggle */}
          <div className="flex flex-col items-center gap-2 z-10">
             <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button 
                onClick={() => setChordInstrument('synth')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${chordInstrument === 'synth' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Synth
              </button>
              <button 
                onClick={() => setChordInstrument('piano')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${chordInstrument === 'piano' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Piano
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-4 bg-purple-500/40 rounded-full blur-2xl transition-opacity duration-75 will-change-[opacity]"
              style={{ opacity: gamepad.triggers.left }}
            />
            <RadialMenu
              items={chordLabels}
              selectedIndex={selectedChordIndex}
              previewIndex={previewChordIndex}
              isActive={gamepad.triggers.left > 0.05}
              color="purple"
              label="CHORDS"
              className="w-80 h-80"
            />
          </div>

          {/* Chord Info */}
          <div className="absolute -bottom-16 left-0 right-0 text-center h-16 flex flex-col items-center justify-end">
            {playingChord && (
              <>
                <span className="text-purple-300 font-bold text-xl animate-pulse block">
                  {detectChordName(playingChord)}
                </span>
                <span className="text-purple-400/70 font-mono text-xs">
                  {playingChord.map(n => n.replace(/\d+/, '')).join(' ')}
                </span>
              </>
            )}
          </div>

        </div>

        {/* Right Stick: Notes */}
        <div className="relative group flex flex-col items-center gap-2">

          {/* Melody Sound Toggle */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button 
                onClick={() => setMelodyInstrument('synth')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${melodyInstrument === 'synth' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Synth
              </button>
              <button 
                onClick={() => setMelodyInstrument('piano')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${melodyInstrument === 'piano' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Piano
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-4 bg-blue-500/40 rounded-full blur-2xl transition-opacity duration-75 will-change-[opacity]"
              style={{ opacity: gamepad.triggers.right }}
            />
            <RadialMenu
              items={melodyLabels}
              selectedIndex={selectedNoteIndex}
              previewIndex={previewNoteIndex}
              isActive={gamepad.triggers.right > 0.05}
              color="blue"
              label="MELODY"
              className="w-80 h-80"
            />
          </div>

          {/* Note Info */}
          <div className="absolute -bottom-12 left-0 right-0 text-center h-8">
            {playingNote && (
              <span className="text-blue-300 font-mono text-xl font-bold animate-bounce">
                {playingNote.replace(/\d+/, '')}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Chord Modifiers Overlay */}
      <div className="fixed bottom-8 flex gap-4">
        <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.x ? 'bg-blue-500/50 border-blue-400' : 'border-slate-700 bg-slate-800'}`}>
          X (Dim)
        </div>
        <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.a ? 'bg-green-500/50 border-green-400' : 'border-slate-700 bg-slate-800'}`}>
          A (Min)
        </div>
        <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.y ? 'bg-yellow-500/50 border-yellow-400' : 'border-slate-700 bg-slate-800'}`}>
          B (Maj)
        </div>
        <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.b ? 'bg-red-500/50 border-red-400' : 'border-slate-700 bg-slate-800'}`}>
          Y (Sus)
        </div>
      </div>

      {/* Start Overlay */}
      {!isAudioReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <button
            onClick={handleStart}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-500/20 transform transition hover:scale-105"
          >
            Click to Start Instrument
          </button>
        </div>
      )}

    </div>
  );
}

export default App;
