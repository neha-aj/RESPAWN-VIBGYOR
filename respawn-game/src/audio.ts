/* One AudioContext for the shell: master → (music bus, effects bus), set from the settings.
 * Created lazily; browsers only let it make sound after the player has pressed something,
 * which is what the boot screen ("PRESS ANY KEY") is for. */
import { settings, type Settings } from './settings';

class AudioCore {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; fx!: GainNode;

  get(): AudioContext | null {
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      const ctx = new C();
      // a gentle limiter keeps the big hits from clipping
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
      comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.connect(comp);
      this.music = ctx.createGain(); this.music.connect(this.master);
      this.fx = ctx.createGain(); this.fx.connect(this.master);
      this.ctx = ctx;
      this.apply(settings.get(), true);
      settings.subscribe((s) => this.apply(s));
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private apply(s: Settings, now = false) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, k = now ? 0.001 : 0.08;
    this.master.gain.setTargetAtTime(s.sound ? s.master : 0, t, k);
    this.music.gain.setTargetAtTime(s.music * 0.9, t, k);
    this.fx.gain.setTargetAtTime(s.effects, t, k);
  }

  /** White noise, cached. */
  private nb: AudioBuffer | null = null;
  noise(seconds = 2): AudioBufferSourceNode {
    const ctx = this.ctx!;
    if (!this.nb) {
      this.nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = this.nb; s.loop = seconds > 2; return s;
  }

  /** A short reverb impulse, shared. */
  private ir: AudioBuffer | null = null;
  reverb(): ConvolverNode {
    const ctx = this.ctx!;
    if (!this.ir) {
      const len = ctx.sampleRate * 2.6; this.ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = this.ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    }
    const cv = ctx.createConvolver(); cv.buffer = this.ir; return cv;
  }
}

export const audio = new AudioCore();
