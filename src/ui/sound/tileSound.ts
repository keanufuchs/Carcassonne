// Procedural tile-placement sound, shared by the 2D and 3D board views.
// Uses the Web Audio API (no asset files) so the same soft wooden "click"
// plays whenever a tile lands on the board, regardless of render mode.

let sharedAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  try {
    sharedAudioContext = new AudioContextCtor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function playTilePlacementSound(): void {
  const context = getOrCreateAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  master.connect(context.destination);

  const tone = context.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(180, now);
  tone.frequency.exponentialRampToValueAtTime(128, now + 0.12);
  tone.connect(master);
  tone.start(now);
  tone.stop(now + 0.18);

  const click = context.createOscillator();
  click.type = 'triangle';
  click.frequency.setValueAtTime(460, now);
  const clickGain = context.createGain();
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.014, now + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  click.connect(clickGain);
  clickGain.connect(master);
  click.start(now + 0.002);
  click.stop(now + 0.06);
}
