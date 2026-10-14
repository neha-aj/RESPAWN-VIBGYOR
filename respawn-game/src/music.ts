/* The RESPAWN theme, synthesised live (no audio files).
 *
 *   playLogo()  the score for the logo reveal, locked to LOGO_T (the animation reads the same
 *               timeline): footsteps in the dark → one rising stab per letter as the torch finds
 *               it (V…R) → a riser → a huge hit on the full reveal → the main theme.
 *   The main theme then loops under the main menu until stop() fades it out:
 *   D minor, 96 BPM, Dm | Bb | F | C, chiptune lead over brass, arps, bass and drums.
 */
import { audio } from './audio';

/** The logo animation's timeline (seconds from its start). */
export const LOGO_T = {
  steps: [1.0, 1.6, 2.2, 2.8, 3.4],                    // Thanos's footsteps
  torch: 3.95,                                          // he raises the torch
  letters: [4.6, 5.52, 6.44, 7.36, 8.28, 9.2, 10.12],   // the beam lands on V, I, B, G, Y, O, R
  riser: 10.6,
  reveal: 12.0,                                         // the whole picture
  end: 17.5,                                            // the menu can take over
};

const BEAT = 60 / 96, BAR = BEAT * 4;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

// chords as MIDI notes
const DM = [50, 53, 57, 62], BB = [46, 50, 53, 58], GM = [43, 46, 50, 55], F = [53, 57, 60, 65], C = [48, 52, 55, 60], A = [45, 49, 52, 57];
const LETTER_CHORDS = [DM, BB, GM, F, C, BB, A];
const LETTER_BELLS = [74, 76, 77, 79, 81, 82, 85];
const THEME = [
  { chord: DM, root: 38, lead: [[74, 1], [69, 0.5], [74, 0.5], [77, 1], [76, 0.5], [74, 0.5]] },
  { chord: BB, root: 34, lead: [[77, 1.5], [79, 0.5], [77, 1], [74, 1]] },
  { chord: F, root: 41, lead: [[72, 1], [77, 1], [81, 1], [79, 0.5], [77, 0.5]] },
  { chord: C, root: 36, lead: [[76, 1.5], [74, 0.5], [72, 1], [76, 1]] },
];

class Music {
  private out: GainNode | null = null; private wet: GainNode | null = null; private delay: DelayNode | null = null;
  private timer = 0; private nextBar = 0; private bar = 0; private looping = false;

  private ctx() {
    const ctx = audio.get(); if (!ctx) return null;
    if (!this.out) this.fresh(ctx);
    return ctx;
  }
  /** A new output stage (so a fade-out of the old one can finish on its own). */
  private fresh(ctx: AudioContext) {
    const out = ctx.createGain(); out.connect(audio.music);
    const rev = audio.reverb(), wet = ctx.createGain(); wet.gain.value = 0.32; wet.connect(rev); rev.connect(out);
    const d = ctx.createDelay(1); d.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.28; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(out);
    this.out = out; this.wet = wet; this.delay = d;
  }

  /* ---------------- instruments (all schedule at absolute time t) ---------------- */
  private env(g: GainNode, t: number, peak: number, a: number, hold: number, r: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }
  private send(n: AudioNode, wet = true) { n.connect(this.out!); if (wet) n.connect(this.wet!); }
  private osc(ctx: AudioContext, type: OscillatorType, f: number, t: number, end: number, detune = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); o.stop(end); return o;
  }

  pad(ctx: AudioContext, notes: number[], t: number, dur: number, vol = 0.05, att = 0.8) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.6); lp.Q.value = 0.6;
    const g = ctx.createGain(); this.env(g, t, vol, att, Math.max(0.01, dur - att), 1.4); lp.connect(g); this.send(g);
    for (const m of notes) for (const dt of [-8, 8]) this.osc(ctx, 'sawtooth', mtof(m), t, t + dur + 1.6, dt).connect(lp);
  }
  brass(ctx: AudioContext, notes: number[], t: number, dur: number, vol = 0.07) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(280, t); lp.frequency.exponentialRampToValueAtTime(2800, t + 0.05); lp.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    const g = ctx.createGain(); this.env(g, t, vol, 0.012, dur, 0.5); lp.connect(g); this.send(g);
    for (const m of notes) for (const dt of [-10, 0, 9]) this.osc(ctx, 'sawtooth', mtof(m), t, t + dur + 0.6, dt).connect(lp);
  }
  lead(ctx: AudioContext, m: number, t: number, dur: number, vol = 0.05) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const g = ctx.createGain(); this.env(g, t, vol, 0.01, Math.max(0.02, dur - 0.09), 0.08); lp.connect(g); this.send(g); g.connect(this.delay!);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.6; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + Math.min(0.25, dur)); vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.1);
    for (const dt of [0, 6]) { const o = this.osc(ctx, 'square', mtof(m), t, t + dur + 0.1, dt); vg.connect(o.detune); o.connect(lp); }
  }
  bass(ctx: AudioContext, m: number, t: number, dur: number, vol = 0.11) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = ctx.createGain(); this.env(g, t, vol, 0.005, dur * 0.6, dur * 0.4); lp.connect(g); this.send(g, false);
    this.osc(ctx, 'sawtooth', mtof(m), t, t + dur + 0.05).connect(lp);
    const sub = ctx.createGain(); this.env(sub, t, vol * 0.9, 0.005, dur * 0.6, dur * 0.4); this.send(sub, false);
    this.osc(ctx, 'sine', mtof(m - 12), t, t + dur + 0.05).connect(sub);
  }
  pluck(ctx: AudioContext, m: number, t: number, vol = 0.03) {
    const g = ctx.createGain(); this.env(g, t, vol, 0.003, 0.02, 0.16); this.send(g);
    this.osc(ctx, 'triangle', mtof(m), t, t + 0.25).connect(g);
    const g2 = ctx.createGain(); this.env(g2, t, vol * 0.25, 0.002, 0.01, 0.06); this.send(g2, false); this.osc(ctx, 'square', mtof(m), t, t + 0.1).connect(g2);
  }
  bell(ctx: AudioContext, m: number, t: number, vol = 0.09, decay = 2.6) {
    for (const [k, a] of [[1, 1], [2.76, 0.3], [5.4, 0.1]] as const) {
      const g = ctx.createGain(); this.env(g, t, vol * a, 0.004, 0.01, decay / Math.sqrt(k)); this.send(g);
      this.osc(ctx, 'sine', mtof(m) * k, t, t + decay + 0.1).connect(g);
    }
  }
  kick(ctx: AudioContext, t: number, vol = 0.5) {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = ctx.createGain(); this.env(g, t, vol, 0.002, 0.04, 0.3); o.connect(g); this.send(g, false); o.start(t); o.stop(t + 0.45);
  }
  snare(ctx: AudioContext, t: number, vol = 0.22) {
    const n = audio.noise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const g = ctx.createGain(); this.env(g, t, vol, 0.002, 0.01, 0.17); n.connect(bp); bp.connect(g); this.send(g); n.start(t, Math.random()); n.stop(t + 0.25);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const og = ctx.createGain(); this.env(og, t, vol * 0.7, 0.002, 0.01, 0.08); o.connect(og); this.send(og, false); o.start(t); o.stop(t + 0.15);
  }
  hat(ctx: AudioContext, t: number, open = false, vol = 0.05) {
    const n = audio.noise(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const g = ctx.createGain(); this.env(g, t, vol, 0.001, 0.005, open ? 0.28 : 0.04); n.connect(hp); hp.connect(g); this.send(g, false); n.start(t, Math.random()); n.stop(t + 0.4);
  }
  crash(ctx: AudioContext, t: number, vol = 0.16) {
    const n = audio.noise(3), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
    const g = ctx.createGain(); this.env(g, t, vol, 0.003, 0.05, 2.2); n.connect(hp); hp.connect(g); this.send(g); n.start(t); n.stop(t + 2.5);
  }
  timpani(ctx: AudioContext, m: number, t: number, vol = 0.32) {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(mtof(m) * 1.06, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.08);
    const g = ctx.createGain(); this.env(g, t, vol, 0.004, 0.02, 1.1); o.connect(g); this.send(g); o.start(t); o.stop(t + 1.3);
    const n = audio.noise(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const ng = ctx.createGain(); this.env(ng, t, vol * 0.5, 0.002, 0.01, 0.2); n.connect(lp); lp.connect(ng); this.send(ng, false); n.start(t, Math.random()); n.stop(t + 0.3);
  }
  step(ctx: AudioContext, t: number) {        // a heavy footfall in the dark
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const g = ctx.createGain(); this.env(g, t, 0.42, 0.003, 0.02, 0.28); o.connect(g); this.send(g); o.start(t); o.stop(t + 0.4);
    const n = audio.noise(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const ng = ctx.createGain(); this.env(ng, t, 0.12, 0.002, 0.01, 0.12); n.connect(lp); lp.connect(ng); this.send(ng); n.start(t, Math.random()); n.stop(t + 0.2);
  }
  riser(ctx: AudioContext, t: number, dur: number) {
    const n = audio.noise(3), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); this.send(g); n.start(t); n.stop(t + dur + 0.1);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + dur); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(lp); lp.connect(og); this.send(og); o.start(t); o.stop(t + dur + 0.1);
  }
  boom(ctx: AudioContext, t: number) {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.6);
    const g = ctx.createGain(); this.env(g, t, 0.9, 0.004, 0.2, 2.2); o.connect(g); this.send(g, false); o.start(t); o.stop(t + 2.6);
    const n = audio.noise(3), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(180, t + 1.5);
    const ng = ctx.createGain(); this.env(ng, t, 0.35, 0.003, 0.05, 1.6); n.connect(lp); lp.connect(ng); this.send(ng); n.start(t); n.stop(t + 2);
    this.crash(ctx, t, 0.22);
  }
  drone(ctx: AudioContext, t: number, dur: number) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(t + dur + 2);
    const g = ctx.createGain(); this.env(g, t, 0.09, 2.5, Math.max(0.01, dur - 2.5), 1.2); lp.connect(g); this.send(g);
    for (const [m, dt] of [[26, 0], [26, 9], [33, -6], [38, 4]] as const) this.osc(ctx, 'sawtooth', mtof(m), t, t + dur + 1.4, dt).connect(lp);
    const n = audio.noise(3), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const ng = ctx.createGain(); this.env(ng, t, 0.025, 2, Math.max(0.01, dur - 2), 1); n.connect(bp); bp.connect(ng); this.send(ng); n.start(t); n.stop(t + dur + 1.2);
  }

  /* ---------------- the logo score ---------------- */
  /** Schedules the whole logo score; returns its start time on the audio clock (null without audio). */
  playLogo(): number | null {
    const ctx = this.ctx(); if (!ctx) return null;
    this.stopLoop(); this.fresh(ctx); this.out!.gain.value = 1;
    const t0 = ctx.currentTime + 0.05, T = LOGO_T;
    this.drone(ctx, t0, T.reveal);
    T.steps.forEach((s) => this.step(ctx, t0 + s));
    this.timpani(ctx, 38, t0 + T.torch, 0.24);
    this.pad(ctx, [38, 45, 50], t0 + T.torch, T.reveal - T.torch, 0.035, 1.5);
    T.letters.forEach((s, i) => {
      const t = t0 + s, k = i / 6;
      this.brass(ctx, LETTER_CHORDS[i], t, 0.32 + 0.1 * k, 0.045 + 0.04 * k);
      this.bell(ctx, LETTER_BELLS[i], t + 0.01, 0.07 + 0.03 * k);
      this.timpani(ctx, LETTER_CHORDS[i][0] - 12, t, 0.22 + 0.14 * k);
      this.bass(ctx, LETTER_CHORDS[i][0] - 12, t, 0.85, 0.08);
      // the build: eighth-note bass from I, hats + arps from G, kicks from Y
      const next = i < 6 ? T.letters[i + 1] : T.riser;
      for (let e = t + BEAT / 2; e < t0 + next - 0.05; e += BEAT / 2) {
        if (i >= 1) this.bass(ctx, LETTER_CHORDS[i][0] - 12, e, BEAT / 2.2, 0.06);
        if (i >= 3) this.hat(ctx, e, false, 0.03 + 0.02 * k);
      }
      if (i >= 3) for (let e = t, j = 0; e < t0 + next - 0.05; e += BEAT / 4, j++) this.pluck(ctx, LETTER_CHORDS[i][j % 4] + 24, e, 0.02 + 0.015 * k);
      if (i >= 4) for (let e = t; e < t0 + next - 0.05; e += BEAT) this.kick(ctx, e, 0.35);
    });
    // riser + accelerating snare roll into the reveal
    const r0 = t0 + T.riser, rd = T.reveal - T.riser;
    this.riser(ctx, r0, rd);
    for (let e = r0, gap = BEAT / 2; e < t0 + T.reveal - 0.04; e += gap, gap = Math.max(BEAT / 8, gap * 0.86)) this.snare(ctx, e, 0.06 + 0.16 * ((e - r0) / rd));
    // the reveal
    const R = t0 + T.reveal;
    this.boom(ctx, R); this.kick(ctx, R, 0.7);
    this.brass(ctx, [38, 50, 57, 62, 65, 69], R, BAR - 0.3, 0.1);
    this.bell(ctx, 86, R + 0.02, 0.12, 3.5); this.bell(ctx, 74, R + 0.02, 0.08, 3.5);
    this.startLoop(R);
    return t0;
  }

  /* ---------------- the main theme loop ---------------- */
  private playBar(ctx: AudioContext, t: number, n: number) {
    const sec = THEME[n % 4], full = Math.floor(n / 4) % 2 === 0, first = n === 0;
    this.pad(ctx, sec.chord, t, BAR, full ? 0.03 : 0.04, 0.3);
    if (!first) this.brass(ctx, sec.chord, t, 0.18, full ? 0.04 : 0.025);
    for (let e = 0; e < 8; e++) {
      const tt = t + (e * BEAT) / 2;
      this.bass(ctx, sec.root + (e % 4 === 3 ? 12 : 0), tt, BEAT / 2.2, full ? 0.09 : 0.07);
      this.hat(ctx, tt, e === 7, full ? 0.04 : 0.025);
      if (e === 0 || e === 3 || e === 4) this.kick(ctx, tt, full ? 0.45 : 0.3);
      if (e === 2 || e === 6) this.snare(ctx, tt, full ? 0.2 : 0.1);
    }
    for (let j = 0; j < 16; j++) {
      const up = [0, 1, 2, 3, 2, 1][j % 6];
      this.pluck(ctx, sec.chord[up] + 12 + (j >= 8 && !full ? 12 : 0), t + (j * BEAT) / 4, full ? 0.022 : 0.03);
    }
    if (full) { let b = 0; for (const [m, d] of sec.lead) { this.lead(ctx, m, t + b * BEAT, d * BEAT * 0.94); b += d; } }
    else if (n % 4 === 3) this.bell(ctx, 74, t + BEAT * 2, 0.05);
  }

  /** Start the theme at absolute time `at` (default: now) and keep it going. */
  startLoop(at?: number) {
    const ctx = this.ctx(); if (!ctx) return;
    if (this.looping) return;
    this.looping = true; this.bar = 0; this.nextBar = Math.max(at ?? 0, ctx.currentTime + 0.08);
    const tick = () => {
      if (!this.looping) return;
      while (this.nextBar < ctx.currentTime + 0.6) { this.playBar(ctx, this.nextBar, this.bar++); this.nextBar += BAR; }
      this.timer = window.setTimeout(tick, 200);
    };
    tick();
  }
  private stopLoop() { this.looping = false; clearTimeout(this.timer); }

  /** The menu after a skipped logo: hit, then straight into the theme. */
  jumpToTheme() {
    const ctx = this.ctx(); if (!ctx) return;
    this.stop(0.25);
    this.fresh(ctx);
    const t = ctx.currentTime + 0.06;
    this.boom(ctx, t); this.brass(ctx, [38, 50, 57, 62, 65, 69], t, BAR - 0.3, 0.09);
    this.startLoop(t);
  }
  /** Start the theme if nothing is playing (e.g. back on the menu after a run). */
  ensureTheme() { if (!this.looping) { const ctx = this.ctx(); if (!ctx) return; this.fresh(ctx); this.startLoop(); } }

  /** Fade everything out (the current output stage keeps its tail, then goes quiet). */
  stop(fade = 1.4) {
    this.stopLoop();
    const ctx = audio.ctx, out = this.out;
    if (ctx && out) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 4); setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, fade * 1000 + 3000); }
    this.out = null;
  }
}

export const music = new Music();
