
import { useEffect, useState, useRef, useMemo } from 'react';
import { useGamepad } from './hooks/useGamepad';
import type { GamepadState } from './hooks/useGamepad';
import { RadialMenu } from './components/RadialMenu';
import { 
  NOTES, 
  MODES, 
  getScaleNotes, 
  getChordNotes, 
  getDiatonicChord,
  transpose
} from './utils/music-theory';
import type { ScaleMode, ChordType } from './utils/music-theory';
import { audioEngine } from './audio/AudioEngine';
import { Music, Settings } from 'lucide-react';

const SCALE_MODES = Object.keys(MODES) as ScaleMode[];

function App() {
  const gamepad = useGamepad();
  const prevGamepadRef = useRef<GamepadState>(gamepad);
  
  // App State
  const [rootNoteIndex, setRootNoteIndex] = useState(0); // C
  const [scaleModeIndex, setScaleModeIndex] = useState(0); // Ionian
  const [globalTranspose, setGlobalTranspose] = useState(0); // Semitones
  const [volume] = useState(-10); // dB
  
  // Current Selection State (Visual)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [selectedChordIndex, setSelectedChordIndex] = useState<number | null>(null);
  
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
  
  // Generate Scale Notes
  const scaleNotes = useMemo(() => {
    if (currentMode === 'Chromatic') {
      return getScaleNotes(currentRootWithOctave, 'Chromatic', 1);
    }
    return getScaleNotes(currentRootWithOctave, currentMode, 1); // 7 notes
  }, [currentRootWithOctave, currentMode]);

  // Display Labels
  const scaleLabels = useMemo(() => {
     return scaleNotes.map(n => {
       const t = transpose(n, globalTranspose);
       return t.replace(/\d+/, ''); // Remove octave for label
     });
  }, [scaleNotes, globalTranspose]);
  
  const sliceCount = scaleLabels.length;

  const handleStart = async () => {
    await audioEngine.initialize();
    setIsAudioReady(true);
  };

  // Button Debounce Logic & State Updates
  useEffect(() => {
    const prev = prevGamepadRef.current;
    const curr = gamepad;

    if (!curr.connected) return;
    
    // D-Pad Up/Down: Root Note
    if (curr.buttons.dpadUp && !prev.buttons.dpadUp) {
      setRootNoteIndex(i => (i + 1) % 12);
    }
    if (curr.buttons.dpadDown && !prev.buttons.dpadDown) {
      setRootNoteIndex(i => (i - 1 + 12) % 12);
    }

    // D-Pad Left/Right: Transpose
    if (curr.buttons.dpadLeft && !prev.buttons.dpadLeft) {
      setGlobalTranspose(t => t - 1);
    }
    if (curr.buttons.dpadRight && !prev.buttons.dpadRight) {
      setGlobalTranspose(t => t + 1);
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
    else if (curr.buttons.b) modifier = 'maj';
    else if (curr.buttons.x) modifier = 'dim';
    else if (curr.buttons.y) modifier = 'sus4';
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
    if (gamepad.axes.right.magnitude > 0.2) {
      const angle = gamepad.axes.right.angle; // 0 is North
      const sectorAngle = 360 / sliceCount;
      noteIdx = Math.round(angle / sectorAngle) % sliceCount;
      setSelectedNoteIndex(noteIdx);
    }

    // 2. Determine Selected Index (Left Stick -> Chord)
    let chordIdx = selectedChordIndex;
    if (gamepad.axes.left.magnitude > 0.2) {
      const angle = gamepad.axes.left.angle;
      const sectorAngle = 360 / sliceCount;
      chordIdx = Math.round(angle / sectorAngle) % sliceCount;
      setSelectedChordIndex(chordIdx);
    }

    // 3. Handle Note Playback (Right Trigger)
    const noteTrigger = gamepad.triggers.right;
    if (noteTrigger > 0.1 && noteIdx !== null) {
       const baseNote = scaleNotes[noteIdx];
       const targetNote = transpose(baseNote, globalTranspose);
       
       if (targetNote !== playingNote) {
         if (playingNote) audioEngine.stopNote(playingNote);
         audioEngine.playNote(targetNote, noteTrigger); // Velocity mapped to trigger
         setPlayingNote(targetNote);
       }
    } else {
       if (playingNote) {
         audioEngine.stopNote(playingNote);
         setPlayingNote(null);
       }
    }

    // 4. Handle Chord Playback (Left Trigger)
    const chordTrigger = gamepad.triggers.left;
    if (chordTrigger > 0.1 && chordIdx !== null) {
       let chordNotes: string[] = [];
       const rootForChord = scaleNotes[chordIdx];
       const transposedRoot = transpose(rootForChord, globalTranspose);

       if (activeChordType) {
         chordNotes = getChordNotes(transposedRoot, activeChordType, 0);
       } else {
         if (currentMode === 'Chromatic') {
            chordNotes = getChordNotes(transposedRoot, 'maj', 0);
         } else {
            const extendedScale = getScaleNotes(currentRootWithOctave, currentMode, 2)
              .map(n => transpose(n, globalTranspose));
            chordNotes = getDiatonicChord(extendedScale, chordIdx, true); 
         }
       }
       
       const chordFingerprint = chordNotes.join('-');
       const playingFingerprint = playingChord?.join('-');
       
       if (chordFingerprint !== playingFingerprint) {
          if (playingChord) audioEngine.stopChord(playingChord);
          audioEngine.playChord(chordNotes, chordTrigger * 0.8);
          setPlayingChord(chordNotes);
       }
    } else {
       if (playingChord) {
          audioEngine.stopChord(playingChord);
          setPlayingChord(null);
       }
    }

  }, [gamepad, scaleNotes, globalTranspose, activeChordType, sliceCount, currentRootWithOctave, currentMode]); 

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
      
      {/* Header / Status */}
      <div className="absolute top-8 w-full max-w-4xl flex justify-between items-start px-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Xbox Instrument
          </h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
             <div className="flex items-center gap-1">
               <Music size={16} />
               <span>Root: <strong className="text-white">{currentRoot}</strong></span>
             </div>
             <div className="flex items-center gap-1">
               <Settings size={16} />
               <span>Mode: <strong className="text-white">{currentMode}</strong></span>
             </div>
             <div className="flex items-center gap-1">
               <span>Transpose: <strong className={globalTranspose !== 0 ? "text-yellow-400" : "text-white"}>
                 {globalTranspose > 0 ? '+' : ''}{globalTranspose}
               </strong></span>
             </div>
          </div>
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
           <div className="text-xs text-slate-500 mt-2">
             Start to Init Audio
           </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="flex flex-col md:flex-row gap-16 items-center justify-center w-full max-w-6xl">
        
        {/* Left Stick: Chords */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-purple-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <RadialMenu 
            items={scaleLabels} 
            selectedIndex={selectedChordIndex}
            isActive={gamepad.triggers.left > 0.1}
            label="CHORDS"
            className="w-80 h-80"
          />
          
          {/* Chord Info */}
          <div className="absolute -bottom-12 left-0 right-0 text-center h-8">
            {playingChord && (
               <span className="text-purple-300 font-mono text-sm animate-pulse">
                 {playingChord.map(n => n.replace(/\d+/, '')).join(' ')}
               </span>
            )}
          </div>
          
          <div className="absolute top-0 left-0 text-xs text-slate-500">LB/RB: Mode</div>
          <div className="absolute bottom-0 left-0 text-xs text-slate-500">LT: Play</div>
        </div>

        {/* Right Stick: Notes */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <RadialMenu 
            items={scaleLabels} 
            selectedIndex={selectedNoteIndex}
            isActive={gamepad.triggers.right > 0.1}
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
          
          <div className="absolute top-0 right-0 text-xs text-slate-500 text-right">D-Pad: Root/Trans</div>
          <div className="absolute bottom-0 right-0 text-xs text-slate-500 text-right">RT: Play</div>
        </div>
        
      </div>
      
      {/* Chord Modifiers Overlay */}
      <div className="fixed bottom-8 flex gap-4">
         <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.a ? 'bg-green-500/50 border-green-400' : 'border-slate-700 bg-slate-800'}`}>
           A (Min)
         </div>
         <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.b ? 'bg-red-500/50 border-red-400' : 'border-slate-700 bg-slate-800'}`}>
           B (Maj)
         </div>
         <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.x ? 'bg-blue-500/50 border-blue-400' : 'border-slate-700 bg-slate-800'}`}>
           X (Dim)
         </div>
         <div className={`px-4 py-2 rounded-lg border ${gamepad.buttons.y ? 'bg-yellow-500/50 border-yellow-400' : 'border-slate-700 bg-slate-800'}`}>
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
