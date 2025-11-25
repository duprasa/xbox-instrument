
import * as Tone from 'tone';

export type InstrumentType = 'synth' | 'piano';

class AudioEngine {
  private melodyInstrument: Tone.PolySynth | Tone.Sampler;
  private chordInstrument: Tone.PolySynth | Tone.Sampler;
  private reverb: Tone.Reverb;
  private chorus: Tone.Chorus;
  private isInitialized: boolean = false;

  constructor() {
    this.reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.4,
    }).toDestination();

    this.chorus = new Tone.Chorus({
      frequency: 4,
      delayTime: 2.5,
      depth: 0.5,
      wet: 0.3
    }).start();

    // Chain effects: Chorus -> Reverb -> Out
    this.chorus.connect(this.reverb);

    // Initialize default instruments
    this.melodyInstrument = this.createSynth('melody');
    this.chordInstrument = this.createSynth('chord');
    
    this.melodyInstrument.connect(this.chorus);
    this.chordInstrument.connect(this.chorus);
  }

  private createSynth(role: 'melody' | 'chord'): Tone.PolySynth {
    if (role === 'melody') {
      // "Nice" Lead: Filtered Sawtooth using MonoSynth options in PolySynth
      // We use FMSynth or MonoSynth for richer tone. Let's try MonoSynth for the filter.
      return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: {
          type: "sawtooth"
        },
        envelope: {
          attack: 0.05,
          decay: 0.3,
          sustain: 0.4,
          release: 2,
        },
        filter: {
          Q: 1,
          type: "lowpass",
          rolloff: -24
        },
        filterEnvelope: {
          attack: 0.05,
          decay: 0.5,
          sustain: 0.2,
          release: 2,
          baseFrequency: 200,
          octaves: 4,
          exponent: 2
        },
        volume: -6
      });
    } else {
      // "Nice" Pad: Warm Triangle/Sine
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'fatsine', // Lush, detuned sine waves
          count: 3,
          spread: 30
        },
        envelope: {
          attack: 0.5, // Slow attack for pad
          decay: 1,
          sustain: 0.8,
          release: 3,
        },
        volume: -8,
      });
    }
  }

  private createPiano(role: 'melody' | 'chord'): Tone.Sampler {
    // The piano samples are decent but can be "thin".
    // Adding a little release and attack smoothing helps.
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
      baseUrl: "samples/piano/",
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

    // Connect to reverb (via effect chain)
    if (type === 'piano') {
        // Don't apply chorus to piano, keep it pure
        newInstrument.connect(this.reverb);
    } else {
        newInstrument.connect(this.chorus);
    }

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
