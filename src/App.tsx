
import { useEffect, useState, useRef, useMemo } from 'react';
import { useGamepad } from './hooks/useGamepad';
import type { GamepadState } from './hooks/useGamepad';
import { RadialMenu } from './components/RadialMenu';
import { Instructions } from './components/Instructions';
import { 
  NOTES, 
  MODES, 
  getScaleNotes, 
  getChordNotes, 
  getDiatonicChord,
  applyGenericInversion,
  detectChordName,
  getNextRootCircleOfFifths
} from './utils/music-theory';
import type { ScaleMode, ChordType } from './utils/music-theory';
import { audioEngine } from './audio/AudioEngine';
import { Music, Settings, ArrowLeftRight } from 'lucide-react';

const SCALE_MODES = Object.keys(MODES) as ScaleMode[];

function App() {
  const gamepad = useGamepad();
  const prevGamepadRef = useRef<GamepadState>(gamepad);
  
  // App State
  const [rootNoteIndex, setRootNoteIndex] = useState(0); // C
  const [scaleModeIndex, setScaleModeIndex] = useState(0); // Ionian
  
  // Replaced globalTranspose with chordInversionOffset
  const [chordInversionOffset, setChordInversionOffset] = useState(0);
  
  const [volume] = useState(-10); // dB
  
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
  const currentRoot = NOTES[rootNoteIndex];
  const currentMode = SCALE_MODES[scaleModeIndex];
  const currentRootWithOctave = `${currentRoot}4`; // Base octave 4
  
  // Generate Fixed 12 Chromatic Notes for Wheel (C4 base)
  const chromaticWheelNotes = useMemo(() => {
    return getScaleNotes('C4', 'Chromatic', 1);
  }, []);

  // Generate Scale Notes (for theory logic)
  const scaleNotes = useMemo(() => {
    if (currentMode === 'Chromatic') {
      return getScaleNotes(currentRootWithOctave, 'Chromatic', 1);
    }
    return getScaleNotes(currentRootWithOctave, currentMode, 1); 
  }, [currentRootWithOctave, currentMode]);

  // Determine Active Notes in Scale
  const activeNotesSet = useMemo(() => {
    return new Set(scaleNotes.map(n => n.replace(/\d+/, '')));
  }, [scaleNotes]);

  // Display Labels (Fixed 12 Chromatic)
  const scaleLabels = useMemo(() => {
     return chromaticWheelNotes.map(n => n.replace(/\d+/, ''));
  }, [chromaticWheelNotes]);
  
  const sliceCount = 12;

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

    prevGamepadRef.current = curr;
  }, [gamepad]);

  // Volume Control
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);


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
       const selectedLabel = scaleLabels[noteIdx];
       // Check if note is in active scale
       // Note: We need to handle Enharmonics if strictly comparing strings?
       // Our getScaleNotes returns sharps. 'C#' etc.
       // activeNotesSet has sharps.
       // So direct check is fine.
       
       const isActiveNote = activeNotesSet.has(selectedLabel);
       
       if (isActiveNote) {
         // We need the actual pitch for playback.
         // We can reconstruct it or find it in the scale notes.
         // Actually, `chromaticWheelNotes[noteIdx]` gives us the Note + Octave (e.g. C4, C#4).
         // But we need to respect the Root Octave shift?
         // The chromatic wheel is fixed C4-B4.
         // The current scale might be based on D4, so it goes D4-D5?
         // If we play C# from the wheel, and root is D, C# is the major 7th.
         // Should it be C#5 or C#4?
         // "transpose the chord by 1 note... shift the chords... to the new range"
         // The global transpose (now inversion offset) was removed.
         // But we have `currentRoot`.
         // If I select "D" on the wheel, and I am in Key of D, it plays D.
         // If I am in Key of C, and select D, it plays D.
         // The octave usually follows the circle.
         // Let's just use the fixed chromatic note for now, maybe adjusted by global octave if we had one.
         // Or better: find the corresponding note in the generated `scaleNotes` array?
         // But `scaleNotes` is no longer used for indexing.
         
         // Let's just use the note from the fixed wheel (C4 base).
         // And maybe shift octave if the current root is high? 
         // Default C4 base is fine.
         
         const targetNote = chromaticWheelNotes[noteIdx];
         
         // Remap trigger value (0.05-1.0) to velocity (0.3-1.0) for better response
         const velocity = 0.5 + (noteTrigger * 0.7);

         if (targetNote !== playingNote) {
           if (playingNote) audioEngine.stopNote(playingNote);
           audioEngine.playNote(targetNote, velocity); 
           setPlayingNote(targetNote);
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
       const selectedLabel = scaleLabels[chordIdx];
       
       // Only play if in scale (or if we allow chromatic chords?)
       // Usually strictly diatonic means only scale degrees.
       // But user might want to play non-diatonic chords?
       // The prompt said "notes wheel... unaffected by inversions".
       // It implies chords wheel behaves similarly.
       // If I pick a note not in scale, do I get a chord?
       // Probably not for "Diatonic" mode.
       
       if (activeNotesSet.has(selectedLabel)) {
         let chordNotes: string[] = [];
         const rootForChord = chromaticWheelNotes[chordIdx];
         
         // We need to know the Scale Degree to generate Diatonic Chord.
         // We can find the index of this note in the current Scale.
         const currentScale = getScaleNotes(currentRootWithOctave, currentMode, 2); // 2 octaves to be safe
         // Find match (ignoring octave for matching)
         const rootName = selectedLabel;
         const degreeIndex = currentScale.findIndex(n => n.startsWith(rootName));
         
         if (degreeIndex !== -1) {
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
                  const baseChord = getDiatonicChord(currentScale, degreeIndex, true);
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

  }, [gamepad, chromaticWheelNotes, activeNotesSet, chordInversionOffset, activeChordType, sliceCount, currentRootWithOctave, currentMode]); 

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
             <div className="bg-red-500/20 text-red-200 px-3 py-1 rounded-full text-xs animate-pulse">
               Connect Controller
             </div>
           )}
           {gamepad.connected && (
             <div className="bg-green-500/20 text-green-200 px-3 py-1 rounded-full text-xs">
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
               <span>Mode: <strong className="text-white">{currentMode}</strong></span>
             </div>
             <div className="flex items-center gap-1">
               <ArrowLeftRight size={16} />
               <span>Inversion: <strong className={chordInversionOffset !== 0 ? "text-yellow-400" : "text-white"}>
                 {chordInversionOffset > 0 ? '+' : ''}{chordInversionOffset}
               </strong></span>
             </div>
          </div>

      <div className="flex flex-col md:flex-row gap-16 items-center justify-center w-full max-w-6xl">
        
        {/* Left Stick: Chords */}
        <div className="relative group">
          <div 
            className="absolute -inset-4 bg-purple-500/40 rounded-full blur-2xl transition-opacity duration-75 will-change-[opacity]" 
            style={{ opacity: gamepad.triggers.left }}
          />
          <RadialMenu 
            items={scaleLabels} 
            activeItems={activeNotesSet}
            selectedIndex={selectedChordIndex}
            previewIndex={previewChordIndex}
            isActive={gamepad.triggers.left > 0.05}
            color="purple"
            label="CHORDS"
            className="w-80 h-80"
          />
          
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
        <div className="relative group">
          <div 
            className="absolute -inset-4 bg-blue-500/40 rounded-full blur-2xl transition-opacity duration-75 will-change-[opacity]" 
            style={{ opacity: gamepad.triggers.right }}
          />
          <RadialMenu 
            items={scaleLabels} 
            activeItems={activeNotesSet}
            selectedIndex={selectedNoteIndex}
            previewIndex={previewNoteIndex}
            isActive={gamepad.triggers.right > 0.05}
            color="blue"
            label="NOTES"
            className="w-80 h-80"
          />
           
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
