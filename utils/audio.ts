
let audioCtx: AudioContext | null = null;

const getAudioCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const createGain = (ctx: AudioContext, startVolume: number, duration: number) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(startVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  return gain;
};

export const playWhackSound = () => {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = createGain(ctx, 0.3, 0.1);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

export const playClangSound = () => {
  const ctx = getAudioCtx();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = createGain(ctx, 0.2, 0.3);

  osc1.type = 'square';
  osc1.frequency.setValueAtTime(200, ctx.currentTime);
  
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(245, ctx.currentTime);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.3);
  osc2.stop(ctx.currentTime + 0.3);
};

export const playErrorSound = () => {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = createGain(ctx, 0.4, 0.4);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

export const playExplosionSound = () => {
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

  const gain = createGain(ctx, 0.5, 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
  noise.stop(ctx.currentTime + 0.5);
};

export const playLevelStartSound = () => {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = createGain(ctx, 0.2, 0.2);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.2);
};
