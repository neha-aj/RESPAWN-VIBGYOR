/* Transition sounds, synthesised with Web Audio so there are no files to load.
 * Kept quiet and short: they sit between levels, they don't compete with them.
 * Each spectrum band rings one note of an ascending scale, so by RED the player has
 * heard the whole run climb, V → R.
 */
import { audio } from './audio';

// C major from C5: V I B G Y O R
const BAND_NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77];

class Sfx {
  private out: GainNode | null = null;
  private echo: DelayNode | null = null;

  /** The shell's shared AudioContext; this class owns a sub-mix on the effects bus. */
  private ac(): AudioContext | null {
    const ctx = audio.get(); if (!ctx) return null;
    if (!this.out) {
      const out = ctx.createGain(); out.gain.value = 0.55; out.connect(audio.fx);
      // one soft feedback echo shared by the chimes
      const echo = ctx.createDelay(1); echo.delayTime.value = 0.27;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2600;
      echo.connect(damp); damp.connect(fb); fb.connect(echo); damp.connect(out);
      this.out = out; this.echo = echo;
    }
    return ctx;
  }

  private noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
  }

  private env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  /** A bell: fundamental plus two inharmonic partials, into the echo. */
  private bell(freq: number, at: number, peak = 0.22, decay = 1.8) {
    const ctx = this.ac(); if (!ctx || !this.out || !this.echo) return;
    const t = ctx.currentTime + at;
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.09]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mult;
      const g = this.env(ctx, t, peak * amp, 0.006, decay / mult ** 0.5);
      o.connect(g); g.connect(this.out); g.connect(this.echo);
      o.start(t); o.stop(t + decay + 0.1);
    }
  }

  /** Iris closing: a low, soft "whoomp" falling away. */
  irisClose() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.75);
    const g = this.env(ctx, t, 0.28, 0.03, 0.8);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.9);
    const n = this.noise(ctx, 0.8), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    const ng = this.env(ctx, t, 0.07, 0.05, 0.65);
    n.connect(f); f.connect(ng); ng.connect(this.out); n.start(t);
  }

  /** Iris opening: an airy rising sweep. */
  irisOpen() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const n = this.noise(ctx, 1.2), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(4200, t + 1.0);
    const g = this.env(ctx, t, 0.12, 0.45, 0.6);
    n.connect(f); f.connect(g); g.connect(this.out); n.start(t);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(540, t + 0.9);
    const og = this.env(ctx, t, 0.05, 0.4, 0.55);
    o.connect(og); og.connect(this.out); o.start(t); o.stop(t + 1.1);
  }

  /** A spectrum band lights up: its note, with a little shimmer on top. */
  ignite(band: number) {
    this.bell(BAND_NOTES[band] ?? BAND_NOTES[0], 0, 0.22, 2.2);
    this.bell((BAND_NOTES[band] ?? BAND_NOTES[0]) * 2, 0.09, 0.05, 1.2);
  }

  /** Every band lit: the whole scale rolls up, then rings out together. */
  spectrumComplete() {
    BAND_NOTES.forEach((f, i) => this.bell(f, i * 0.11, 0.13, 1.4));
    [BAND_NOTES[0], BAND_NOTES[2], BAND_NOTES[4], BAND_NOTES[0] * 2].forEach((f) => this.bell(f, 0.95, 0.12, 3.2));
  }

  /** Short confirm blip (continue / skip). */
  blip() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.05);
    const g = this.env(ctx, t, 0.04, 0.005, 0.12);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
  }
  /* ---------- torch, menu, checkpoints ---------- */

  /** The torch catches: a click and a soft flare of flame. */
  torch() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const c = this.noise(ctx, 0.05), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const cg = this.env(ctx, t, 0.35, 0.001, 0.04); c.connect(hp); hp.connect(cg); cg.connect(this.out); c.start(t);
    const f = this.noise(ctx, 1), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(400, t + 0.03); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    const fg = this.env(ctx, t + 0.03, 0.16, 0.12, 0.7); f.connect(bp); bp.connect(fg); fg.connect(this.out); f.start(t + 0.03); f.stop(t + 1);
  }

  /** The beam sweeping across the wall: a breathy whoosh. */
  sweep(dur = 0.8) {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime, n = this.noise(ctx, dur + 0.2), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.out); n.start(t); n.stop(t + dur + 0.1);
  }

  /** The beam lands on a panel: a low hit, then the band's note rings. */
  landOn(band: number) {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    const g = this.env(ctx, t, 0.45, 0.004, 0.45); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.6);
    this.bell(BAND_NOTES[band] ?? BAND_NOTES[0], 0.02, 0.2, 2.4);
    this.bell((BAND_NOTES[band] ?? BAND_NOTES[0]) * 1.5, 0.1, 0.06, 1.6);
  }

  /** Diving into the panel: a rising rush that ends in a soft thump. */
  zoom(dur = 1.6) {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime, n = this.noise(ctx, dur + 0.3), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    n.connect(f); f.connect(g); g.connect(this.out); n.start(t); n.stop(t + dur + 0.3);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(240, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + dur); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    o.connect(lp); lp.connect(og); og.connect(this.out); o.start(t); o.stop(t + dur + 0.3);
  }

  /** Menu cursor moves. */
  move() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
    const g = this.env(ctx, t, 0.03, 0.002, 0.05); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.08);
  }

  /** Menu confirm: a bright two-note arpeggio. */
  select() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = this.env(ctx, t + i * 0.055, 0.045, 0.003, 0.14); o.connect(g); g.connect(this.out!); o.start(t + i * 0.055); o.stop(t + i * 0.055 + 0.2);
    });
  }

  /** Thanos falls: a heavy descending toll. */
  fallen() {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    [[146.83, 0], [138.59, 0.5], [110, 1.0]].forEach(([f, at]) => this.bell(f, at, 0.3, 2.6));
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(36, t + 1.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = this.env(ctx, t, 0.16, 0.02, 1.9); o.connect(lp); lp.connect(g); g.connect(this.out); o.start(t); o.stop(t + 2.1);
  }

  /** Respawning at a checkpoint: a rising shimmer that resolves on the band's note. */
  respawn(band: number) {
    const ctx = this.ac(); if (!ctx || !this.out) return;
    const t = ctx.currentTime, n = this.noise(ctx, 1.4), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + 1.1);
    const g = this.env(ctx, t, 0.08, 0.9, 0.3); n.connect(f); f.connect(g); g.connect(this.out); n.start(t); n.stop(t + 1.4);
    this.bell(BAND_NOTES[band] ?? BAND_NOTES[0], 1.0, 0.22, 2.4);
    this.bell((BAND_NOTES[band] ?? BAND_NOTES[0]) * 2, 1.06, 0.07, 1.4);
  }
}

export const sfx = new Sfx();
