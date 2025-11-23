
import * as Tone from 'tone';

class AudioEngine {
  private synth: Tone.PolySynth;
  private chordSynth: Tone.PolySynth;
  private reverb: Tone.Reverb;
  private isInitialized: boolean = false;

  constructor() {
    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.3,
    }).toDestination();

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
    }).connect(this.reverb);

    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine', // Softer for chords
      },
      envelope: {
        attack: 0.2,
        decay: 0.3,
        sustain: 0.5,
        release: 1.5,
      },
      volume: -5, // Slightly quieter
    }).connect(this.reverb);
  }

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
    console.log('Audio Engine Initialized');
  }

  public playNote(note: string, velocity: number = 1) {
    if (!this.isInitialized) return;
    this.synth.triggerAttack(note, Tone.now(), velocity);
  }

  public stopNote(note: string) {
    if (!this.isInitialized) return;
    this.synth.triggerRelease(note);
  }
  
  public stopAllNotes() {
    if (!this.isInitialized) return;
    this.synth.releaseAll();
  }

  public playChord(notes: string[], velocity: number = 0.8) {
    if (!this.isInitialized) return;
    this.chordSynth.triggerAttack(notes, Tone.now(), velocity);
  }

  public stopChord(notes: string[]) {
    if (!this.isInitialized) return;
    this.chordSynth.triggerRelease(notes);
  }

  public stopAllChords() {
    if (!this.isInitialized) return;
    this.chordSynth.releaseAll();
  }
  
  public setVolume(volume: number) {
    Tone.Destination.volume.value = volume;
  }
}

export const audioEngine = new AudioEngine();

