const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const MIN_MIDI = 48; // C3
export const MAX_MIDI = 84; // C6

export function midiToFreq(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / 440);
}

export const MIN_FREQ = midiToFreq(MIN_MIDI);
export const MAX_FREQ = midiToFreq(MAX_MIDI);

export function freqFromT(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** clamped;
}

export type PitchGuide = {
  midi: number;
  name: string;
  label: string;
  t: number;
  natural: boolean;
  anchor: boolean;
};

const SHARPS = new Set([1, 3, 6, 8, 10]);

function guideLabel(letter: string, octave: number) {
  if (letter === "C") return `C${octave}`;
  if (letter === "A" && octave === 4) return "A4";
  return letter;
}

export const GUIDES: PitchGuide[] = Array.from(
  { length: MAX_MIDI - MIN_MIDI + 1 },
  (_, index) => {
    const midi = MIN_MIDI + index;
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const letter = NOTE_NAMES[pc];
    const natural = !SHARPS.has(pc);
    const span = MAX_MIDI - MIN_MIDI;
    return {
      midi,
      name: `${letter}${octave}`,
      label: guideLabel(letter, octave),
      t: index / span,
      natural,
      anchor: letter === "C" || (letter === "A" && octave === 4),
    };
  },
);

export type PitchReadout = {
  midi: number;
  name: string;
  centsLabel: string;
  hzLabel: string;
};

export function describePitch(freq: number): PitchReadout {
  const exact = freqToMidi(freq);
  const midi = Math.round(exact);
  const cents = Math.max(-50, Math.min(50, Math.round((exact - midi) * 100)));
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const letter = NOTE_NAMES[pc].replace("#", "♯");
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return {
    midi,
    name: `${letter}${octave}`,
    centsLabel: `${sign}${Math.abs(cents)}¢`,
    hzLabel: `${Math.round(freq)} Hz`,
  };
}

export function reverbName(amount: number) {
  if (amount < 0.08) return "Dry";
  if (amount < 0.34) return "Room";
  if (amount < 0.62) return "Hall";
  return "Vast";
}

export const WAVEFORMS = [
  { id: "sine", label: "Sine" },
  { id: "triangle", label: "Triangle" },
  { id: "square", label: "Square" },
  { id: "sawtooth", label: "Saw" },
] as const;

export type Waveform = (typeof WAVEFORMS)[number]["id"];

export const DEFAULT_REVERB = 0.42;
