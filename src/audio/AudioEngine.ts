
import * as Tone from 'tone';

export type InstrumentType = 'synth' | 'piano';

class AudioEngine {
  private melodyInstrument: Tone.PolySynth | Tone.Sampler;
  private chordInstrument: Tone.PolySynth | Tone.Sampler;
  private reverb: Tone.Reverb;
  private isInitialized: boolean = false;

  constructor() {
    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.3,
    }).toDestination();

    // Initialize default instruments
    this.melodyInstrument = this.createSynth('melody');
    this.chordInstrument = this.createSynth('chord');
    
    this.melodyInstrument.connect(this.reverb);
    this.chordInstrument.connect(this.reverb);
  }

  private createSynth(role: 'melody' | 'chord'): Tone.PolySynth {
    if (role === 'melody') {
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'triangle',
        },
        envelope: {
          attack: 0.05,
          decay: 0.1,
          sustain: 0.3,
          release: 1,
        },
      });
    } else {
      return new Tone.PolySynth(Tone.Synth, {
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
      });
    }
  }

  private createPiano(role: 'melody' | 'chord'): Tone.Sampler {
    const volume = role === 'chord' ? -5 : 0;
    return new Tone.Sampler({
      urls: {
        "A0": "A0.mp3",
        "C1": "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        "A1": "A1.mp3",
        "C2": "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        "A2": "A2.mp3",
        "C3": "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        "A3": "A3.mp3",
        "C4": "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        "A4": "A4.mp3",
        "C5": "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        "A5": "A5.mp3",
        "C6": "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        "A6": "A6.mp3",
        "C7": "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        "A7": "A7.mp3",
        "C8": "C8.mp3"
      },
      release: 1,
      baseUrl: "/samples/piano/",
      volume: volume
    });
  }

  public async setInstrument(role: 'melody' | 'chord', type: InstrumentType) {
    const oldInstrument = role === 'melody' ? this.melodyInstrument : this.chordInstrument;
    
    // Create new instrument
    let newInstrument: Tone.PolySynth | Tone.Sampler;
    if (type === 'piano') {
      newInstrument = this.createPiano(role);
      await Tone.loaded(); // Wait for samples to load
    } else {
      newInstrument = this.createSynth(role);
    }

    // Connect to reverb
    newInstrument.connect(this.reverb);

    // Swap
    if (role === 'melody') {
      this.melodyInstrument = newInstrument;
    } else {
      this.chordInstrument = newInstrument;
    }

    // Dispose old one to free resources
    // Note: disposing immediately might cut off sound. 
    // For now, we dispose. A better approach might be to fade out or wait, but simple is best for now.
    oldInstrument.dispose();
  }

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
    console.log('Audio Engine Initialized');
  }

  public playNote(note: string, velocity: number = 1) {
    if (!this.isInitialized) return;
    this.melodyInstrument.triggerAttack(note, Tone.now(), velocity);
  }

  public stopNote(note: string) {
    if (!this.isInitialized) return;
    this.melodyInstrument.triggerRelease(note);
  }
  
  public stopAllNotes() {
    if (!this.isInitialized) return;
    this.melodyInstrument.releaseAll();
  }

  public playChord(notes: string[], velocity: number = 0.8) {
    if (!this.isInitialized) return;
    this.chordInstrument.triggerAttack(notes, Tone.now(), velocity);
  }

  public stopChord(notes: string[]) {
    if (!this.isInitialized) return;
    this.chordInstrument.triggerRelease(notes);
  }

  public stopAllChords() {
    if (!this.isInitialized) return;
    this.chordInstrument.releaseAll();
  }
  
  public setVolume(volume: number) {
    Tone.Destination.volume.value = volume;
  }
}

export const audioEngine = new AudioEngine();
