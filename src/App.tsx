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
  transpose,
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
  const [melodyOctaveOffset, setMelodyOctaveOffset] = useState(0);

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
  // Fixed slots: C, D, E, F, G, A, B (7 slices)
  const fixedSlots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const getScaleLabels = (notes: string[], isChordWheel: boolean): ({ main: string; sub?: string } | string)[] => {
    if (currentMode === 'Chromatic') {
      return NOTES.map(n => {
        let sub = '';
        if (isChordWheel) {
           sub = activeChordType || 'Maj';
           if (sub !== 'Maj') {
             sub = sub.charAt(0).toUpperCase() + sub.slice(1);
           }
        }
        return { main: n, sub };
      });
    }

    const labels = new Array(7).fill({ main: '', sub: '' });
    
    notes.forEach((note, index) => {
      const noteName = note.replace(/\d+/, '');
      const letter = noteName.charAt(0);
      const slotIndex = fixedSlots.indexOf(letter);
      
      if (slotIndex !== -1) {
        if (isChordWheel) {
          // Chord Wheel: Roman Numeral (Main) + Note Name (Sub)
          let quality: ChordType = 'maj';
          if (activeChordType) {
            quality = activeChordType;
          } else {
            quality = getDiatonicChordType(notes, index);
          }
          
          const romanBases: Record<ScaleMode, string[]> = {
             Ionian: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
             Dorian: ['I', 'II', 'bIII', 'IV', 'V', 'VI', 'bVII'],
             Phrygian: ['I', 'bII', 'bIII', 'IV', 'V', 'bVI', 'bVII'],
             Lydian: ['I', 'II', 'III', '#IV', 'V', 'VI', 'VII'],
             Mixolydian: ['I', 'II', 'III', 'IV', 'V', 'VI', 'bVII'],
             Aeolian: ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII'],
             Locrian: ['I', 'bII', 'bIII', 'IV', 'bV', 'bVI', 'bVII'],
             Chromatic: []
          };
          
          let baseRoman = romanBases[currentMode][index];
          
          if (quality === 'min' || quality === 'dim' || quality === 'min7') {
             baseRoman = baseRoman.toLowerCase();
          }
          
          let suffix = '';
          if (quality === 'dim') suffix = '°';
          if (quality === 'aug') suffix = '+';
          if (quality === 'sus2') suffix = 'ˢᵘˢ²';
          if (quality === 'sus4') suffix = 'ˢᵘˢ⁴';
          
          labels[slotIndex] = { main: baseRoman + suffix, sub: noteName };
          
        } else {
          // Melody Wheel: Scale Degree (Main) + Note Name (Sub)
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

  // Calculate active chord indices for Melody Wheel
  const activeNoteIndices = useMemo(() => {
    if (!playingChord) return [];
    const chordNoteNames = playingChord.map(n => n.replace(/\d+/, ''));
    const indices: number[] = [];
    
    melodyLabels.forEach((item, index) => {
      // For Diatonic: item is { main: Degree, sub: NoteName } -> use sub
      // For Chromatic: item is { main: NoteName, sub: '' } -> use main
      // Or item can be string? (Typing says ({ main: string; sub?: string } | string)[])
      
      let label = '';
      if (typeof item === 'string') {
        label = item;
      } else {
        // Logic in getScaleLabels: 
        // Diatonic: sub is Note Name
        // Chromatic: main is Note Name
        if (currentMode === 'Chromatic') {
           label = item.main;
        } else {
           label = item.sub || '';
        }
      }
      
      if (chordNoteNames.includes(label)) {
        indices.push(index);
      }
    });
    return indices;
  }, [playingChord, melodyLabels, currentMode]);


  const handleStart = async () => {
    await audioEngine.initialize();
    setIsAudioReady(true);
  };

  // Button Debounce Logic & State Updates
  useEffect(() => {
    const prev = prevGamepadRef.current;
    const curr = gamepad;

    if (!curr.connected) return;

    // D-Pad Up/Down: Melody Octave Control
    if (curr.buttons.dpadUp && !prev.buttons.dpadUp) {
      setMelodyOctaveOffset(i => i + 1);
    }
    if (curr.buttons.dpadDown && !prev.buttons.dpadDown) {
      setMelodyOctaveOffset(i => i - 1);
    }

    // D-Pad Left/Right: Inversion Offset
    // Replaced Transpose with Inversion Offset
    if (curr.buttons.dpadLeft && !prev.buttons.dpadLeft) {
      setChordInversionOffset(i => i - 1);
    }
    if (curr.buttons.dpadRight && !prev.buttons.dpadRight) {
      setChordInversionOffset(i => i + 1);
    }

    // Bumpers: Root Note (Circle of Fifths)
    if (curr.buttons.rb && !prev.buttons.rb) {
      setRootNoteIndex(i => getNextRootCircleOfFifths(i, 1));
    }
    if (curr.buttons.lb && !prev.buttons.lb) {
      setRootNoteIndex(i => getNextRootCircleOfFifths(i, -1));
    }

    // Start Button: Mode Cycle
    if (curr.buttons.start && !prev.buttons.start) {
      setScaleModeIndex(i => (i + 1) % SCALE_MODES.length);
    }

    // Back Button: Mode Cycle Reverse
    if (curr.buttons.back && !prev.buttons.back) {
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
      // Clear selection if stick is released
      noteIdx = null;
      setSelectedNoteIndex(null);
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

    // 3. Handle Note Playback (Right Stick Magnitude)
    // Play note if magnitude is high enough (selected)
    // noteIdx is already determined in Step 1 based on rMag > 0.6
    // We reuse rMag from Step 1 scope if we remove the redeclaration, 
    // BUT rMag was declared with const inside the Step 1 block? 
    // No, it was declared at top level of useEffect in line 298.
    // Wait, in line 298: const rMag = gamepad.axes.right.magnitude;
    // It is in the useEffect scope.
    
    const shouldPlayMelody = rMag > 0.6 && noteIdx !== null;

    if (shouldPlayMelody && noteIdx !== null) {
      const selectedItem = melodyLabels[noteIdx];
      // Handle object label
      let selectedLabel = '';
      if (typeof selectedItem === 'string') {
        selectedLabel = selectedItem;
      } else {
        if (currentMode === 'Chromatic') {
           selectedLabel = selectedItem.main;
        } else {
           selectedLabel = selectedItem.sub || '';
        }
      }

      if (selectedLabel) {
        // Ideally we'd find the exact octave from scaleNotes, but labels are just names.
        // Let's find the full note string in scaleNotes that matches.
        const fullNote = scaleNotes.find(n => n.startsWith(selectedLabel));
        const noteToPlay = fullNote || selectedLabel + '4'; // Fallback

        // Apply Octave Offset
        let finalNote = noteToPlay;
        if (melodyOctaveOffset !== 0) {
           finalNote = transpose(noteToPlay, melodyOctaveOffset * 12);
        }

        // Map magnitude (0.6-1.0) to velocity (0.5-1.0)
        // Triggers are no longer required, but if right trigger is pulled, maybe boost?
        // Let's stick to magnitude for now.
        const velocity = 0.5 + ((rMag - 0.6) / 0.4) * 0.5;

        if (finalNote !== playingNote) {
          if (playingNote) audioEngine.stopNote(playingNote);
          audioEngine.playNote(finalNote, velocity);
          setPlayingNote(finalNote); 
        }
      }
    } else {
      if (playingNote) {
        audioEngine.stopNote(playingNote); 
        setPlayingNote(null);
      }
    }

    // 4. Handle Chord Playback (Left Stick Magnitude)
    // Play chord if magnitude is high enough (selected)
    const shouldPlayChord = lMag > 0.6 && chordIdx !== null;

    if (shouldPlayChord && chordIdx !== null) {
      const selectedItem = chordLabels[chordIdx];
      // Handle object label
      // For Diatonic: Main is Roman (I), Sub is Note (C). We want Note.
      // For Chromatic: Main is Note (C), Sub is Quality (Maj). We want Note.
      let selectedLabel = '';
      if (typeof selectedItem === 'string') {
        selectedLabel = selectedItem;
      } else {
        // Logic to pick the correct identifier based on mode
        if (currentMode === 'Chromatic') {
           selectedLabel = selectedItem.main;
        } else {
           selectedLabel = selectedItem.sub || '';
        }
      }

      if (selectedLabel) {
        let chordNotes: string[] = [];
        
        // Find full root note
        let rootForChord = '';
        if (currentMode === 'Chromatic') {
           rootForChord = selectedLabel + '4';
        } else {
           rootForChord = scaleNotes.find(n => n.startsWith(selectedLabel)) || selectedLabel + '4';
        }
        
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
            // Map magnitude to velocity
            const velocity = 0.5 + ((lMag - 0.6) / 0.4) * 0.5;
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

  }, [gamepad, melodyLabels, chordLabels, scaleNotes, chordInversionOffset, activeChordType, sliceCount, currentRootWithOctave, currentMode, melodyOctaveOffset]);

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
              style={{ opacity: playingChord ? 0.3 + Math.max(0, (gamepad.axes.left.magnitude - 0.6) * 1.75) : 0 }}
            />
            <RadialMenu
              items={chordLabels}
              selectedIndex={selectedChordIndex}
              previewIndex={previewChordIndex}
              isActive={playingChord !== null}
              color="purple"
              label={playingChord ? (
                <div className="flex flex-col items-center">
                   <span className="text-purple-300 font-bold text-xl animate-pulse whitespace-nowrap">
                     {detectChordName(playingChord)}
                   </span>
                   {/* Optional: Smaller subtext for notes if desired, or omit for cleaner look */}
                </div>
              ) : "CHORDS"}
              className="w-80 h-80"
            />
      </div>

          {/* Inversion UI */}
          <div className="flex flex-col items-center gap-1 mt-2">
             <div className="flex items-center gap-1 text-sm text-slate-400">
               <ArrowLeftRight size={14} />
               <span>Inversion <span className="text-xs text-slate-500">(1/3 octave)</span></span>
             </div>
             <strong className={`text-lg ${chordInversionOffset !== 0 ? "text-purple-400" : "text-white"}`}>
               {chordInversionOffset > 0 ? '+' : ''}{chordInversionOffset}
             </strong>
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
              style={{ opacity: playingNote ? 0.3 + Math.max(0, (gamepad.axes.right.magnitude - 0.6) * 1.75) : 0 }}
            />
            <RadialMenu
              items={melodyLabels}
              selectedIndex={selectedNoteIndex}
              previewIndex={previewNoteIndex}
              secondaryIndices={activeNoteIndices}
              isActive={playingNote !== null}
              color="blue"
              label={playingNote ? (
                <span className="text-blue-300 font-bold text-xl animate-pulse">
                  {playingNote.replace(/\d+/, '')}
                </span>
              ) : "MELODY"}
              className="w-80 h-80"
            />
          </div>

          {/* Melody Octave UI */}
          <div className="flex flex-col items-center gap-1 mt-2">
             <div className="flex items-center gap-1 text-sm text-slate-400">
               <ArrowLeftRight size={14} />
               <span>Octave</span>
             </div>
             <strong className={`text-lg ${melodyOctaveOffset !== 0 ? "text-blue-400" : "text-white"}`}>
               {melodyOctaveOffset > 0 ? '+' : ''}{melodyOctaveOffset}
             </strong>
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
          Y (Maj)
        </div>
        <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.b ? 'bg-red-500/50 border-red-400' : 'border-slate-700 bg-slate-800'}`}>
          B (Sus)
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
