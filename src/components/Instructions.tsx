
import { useState } from 'react';
import { 
  Gamepad2, 
  ArrowUpCircle, 
  ArrowLeftRight, 
  PlayCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { clsx } from 'clsx';

export const Instructions = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-6xl bg-slate-800/30 rounded-xl border border-slate-800 shadow-lg backdrop-blur-sm mb-8 transition-all duration-300 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors text-left"
      >
        <h2 className="text-lg font-semibold text-slate-400 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5" />
          Controls Guide
        </h2>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      
      <div className={clsx(
        "transition-all duration-300 ease-in-out",
        isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-slate-400 p-4 pt-0 border-t border-slate-800/50 mt-2">
          {/* Section 1: Basics */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-300 text-base flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-slate-500" />
              Playing Notes & Chords
            </h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong className="text-blue-300">Right Stick</strong>: Tilt to select and play a <strong>Note</strong>. Push fully to play louder.
              </li>
              <li>
                <strong className="text-purple-300">Left Stick</strong>: Tilt to select and play a <strong>Chord</strong>. Push fully to play louder.
              </li>
              <li>
                <strong className="text-slate-300">LS / RS Click</strong>: Toggle between Synth and Piano instruments.
              </li>
            </ul>
          </div>

          {/* Section 2: Shaping Sound */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-300 text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-500" />
              Changing the Sound
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="bg-slate-700 px-1.5 rounded text-xs font-bold mt-0.5 whitespace-nowrap">LB / RB</span>
                <span>
                   Change Chord Quality (<strong>Minor</strong> / <strong>Major</strong>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-slate-700 px-1.5 rounded text-xs font-bold mt-0.5 whitespace-nowrap">LT / RT</span>
                <span>
                   Change Chord Quality (<strong>Diminished</strong> / <strong>Suspended</strong>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-slate-700 px-1.5 rounded text-xs font-bold mt-0.5 whitespace-nowrap">Start / Back</span>
                <span>
                  Cycle through <strong>Modes</strong> (Scales).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-slate-700 px-1.5 rounded text-xs font-bold mt-0.5 whitespace-nowrap">X / Y</span>
                <span>
                   Change the <strong>Root Note</strong> (Key) via Circle of Fifths.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 3: Advanced Controls */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-300 text-base flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-slate-500" />
              Tuning & Inversions
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <ArrowUpCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>D-Pad Up/Down</strong>: Change <strong>Melody Octave</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowLeftRight className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>D-Pad Left/Right</strong>: Change <strong>Chord Inversions</strong>.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
