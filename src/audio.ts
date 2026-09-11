// Chiptune Audio Engine - Deltarune Style
let audioCtx: AudioContext | null = null;
let currentMelody: number | null = null;
let gainNode: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.3;
  }
  return audioCtx;
}

function playNote(freq: number, duration: number, time: number, type: OscillatorType = 'square') {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  
  noteGain.gain.setValueAtTime(0.3, time);
  noteGain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.9);
  
  osc.connect(noteGain);
  noteGain.connect(gainNode!);
  
  osc.start(time);
  osc.stop(time + duration);
}

// Deltarune-style melodies
const melodies = {
  overworld: {
    notes: [
      262, 294, 330, 349, 392, 349, 330, 294,
      262, 330, 392, 523, 392, 330, 294, 262,
      349, 392, 440, 392, 349, 330, 294, 330,
      262, 294, 330, 392, 440, 392, 330, 262,
    ],
    tempo: 0.2,
    type: 'square' as OscillatorType,
  },
  battle: {
    notes: [
      392, 392, 440, 392, 523, 494, 392, 440,
      392, 392, 523, 494, 440, 392, 349, 392,
      523, 587, 523, 494, 440, 392, 440, 494,
      523, 494, 440, 392, 349, 330, 349, 392,
    ],
    tempo: 0.15,
    type: 'square' as OscillatorType,
  },
  boss: {
    notes: [
      196, 233, 262, 196, 233, 262, 330, 294,
      262, 233, 196, 233, 262, 330, 392, 349,
      330, 294, 262, 233, 196, 262, 330, 392,
      523, 494, 440, 392, 349, 330, 294, 262,
    ],
    tempo: 0.12,
    type: 'sawtooth' as OscillatorType,
  },
  victory: {
    notes: [
      523, 523, 523, 523, 415, 466, 523, 466,
      523, 659, 659, 659, 659, 523, 587, 659,
      784, 784, 784, 784, 659, 698, 784, 698,
      784, 1047, 1047, 1047, 784, 659, 523, 784,
    ],
    tempo: 0.15,
    type: 'square' as OscillatorType,
  },
  menu: {
    notes: [
      330, 392, 440, 523, 440, 392, 330, 294,
      330, 392, 440, 523, 659, 523, 440, 392,
    ],
    tempo: 0.25,
    type: 'triangle' as OscillatorType,
  },
};

export function playMelody(name: keyof typeof melodies) {
  stopMelody();
  
  const melody = melodies[name];
  const ctx = getAudioContext();
  
  function playLoop() {
    const startTime = ctx.currentTime;
    for (let i = 0; i < melody.notes.length; i++) {
      playNote(melody.notes[i], melody.tempo * 0.8, startTime + i * melody.tempo, melody.type);
      // Add harmony
      if (i % 2 === 0) {
        playNote(melody.notes[i] * 0.5, melody.tempo * 1.6, startTime + i * melody.tempo, 'triangle');
      }
    }
    currentMelody = window.setTimeout(playLoop, melody.notes.length * melody.tempo * 1000);
  }
  
  playLoop();
}

export function stopMelody() {
  if (currentMelody !== null) {
    clearTimeout(currentMelody);
    currentMelody = null;
  }
}

export function playSfx(type: 'select' | 'confirm' | 'hurt' | 'heal' | 'attack') {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  switch (type) {
    case 'select':
      playNote(440, 0.05, now, 'square');
      break;
    case 'confirm':
      playNote(523, 0.05, now, 'square');
      playNote(659, 0.05, now + 0.05, 'square');
      break;
    case 'hurt':
      playNote(200, 0.1, now, 'sawtooth');
      playNote(150, 0.1, now + 0.1, 'sawtooth');
      break;
    case 'heal':
      playNote(523, 0.1, now, 'sine');
      playNote(659, 0.1, now + 0.1, 'sine');
      playNote(784, 0.1, now + 0.2, 'sine');
      break;
    case 'attack':
      playNote(300, 0.05, now, 'sawtooth');
      playNote(600, 0.05, now + 0.05, 'sawtooth');
      playNote(900, 0.1, now + 0.1, 'sawtooth');
      break;
  }
}

export function setVolume(vol: number) {
  if (gainNode) {
    gainNode.gain.value = Math.max(0, Math.min(1, vol));
  }
}
