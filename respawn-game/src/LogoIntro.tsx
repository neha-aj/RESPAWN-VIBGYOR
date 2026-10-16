import { useEffect, useRef, useState } from 'react';
import { audio } from './audio';
import { clamp, drawThanos, ease, easeOut, glow, lerp, LETTER_Y, loadPicture, PANELS, PIC_H, PIC_W, SPRITE_FOOT, SPRITE_H, SPRITE_W, TAU } from './art';
import { LOGO_T, music } from './music';
import { SPECTRUM } from './sequence';
import { settings } from './settings';
import { IS_TOUCH } from './touch';
import { SkipPrompt, useHoldSkip } from './Transitions';

/*
 * The first time the player sees the game: a black screen. A pixel Thanos walks in with a
 * torch. Its beam sways across the dark wall and finds the letters one by one (V I B G Y O R),
 * each flaring in its own colour with its own note. Then the beam swells, the screen whites out
 * and the whole VIBGYOR picture slams in.
 * Everything runs on the music's clock (LOGO_T), so picture and score stay locked together.
 *
 * World space is the picture's own 1600 × 900, letterboxed onto the screen.
 */

const PRE = { x: 160, y: 22, k: 0.8 };            // the picture, hung on the "wall" before the reveal
const FOOT_Y = 888, SPR = 2.6;                     // Thanos stands on the floor below it, sprite × 2.6
const WARM = 'rgba(255,176,90,1)';

const letterPos = (i: number, k = PRE.k, ox = PRE.x, oy = PRE.y) => ({ x: ox + PANELS[i].lx * k, y: oy + LETTER_Y * k });

/** Where the torch is pointing at time s, and how wide its spot is (world px). */
function beam(s: number): { x: number; y: number; r: number; on: number } {
  const T = LOGO_T, L = T.letters;
  const sway = (k: number) => ({ x: Math.sin(s * 2.3 + k) * 14 + Math.sin(s * 5.1) * 5, y: Math.cos(s * 1.9 + k) * 8 });
  if (s < T.torch) return { x: 300, y: 860, r: 60, on: 0 };
  const start = { x: 330, y: 820 }, first = letterPos(0);
  if (s < L[0]) {                                   // torch up: the beam wanders up the wall toward V
    const k = ease(clamp((s - T.torch) / (L[0] - T.torch), 0, 1));
    const w = sway(0);
    return { x: lerp(start.x, first.x, k) + w.x * (1 - k) * 3, y: lerp(start.y, first.y - 120 * Math.sin(k * Math.PI), k), r: 70, on: clamp((s - T.torch) / 0.25, 0, 1) };
  }
  for (let i = 0; i < 7; i++) {
    const t0 = L[i], t1 = i < 6 ? L[i + 1] : T.riser, travel = 0.5;
    if (s < t1 || i === 6) {
      const here = letterPos(i), w = sway(i);
      if (i < 6 && s > t1 - travel) {               // sweep on to the next letter, overshooting a touch
        const k = ease((s - (t1 - travel)) / travel), nx = letterPos(i + 1);
        return { x: lerp(here.x, nx.x, k) + Math.sin(k * Math.PI) * 10, y: lerp(here.y, nx.y, k) - Math.sin(k * Math.PI) * 40, r: 70, on: 1 };
      }
      if (i === 6 && s >= T.riser) {                // after R: rise to the centre and swell over everything
        const k = ease(clamp((s - T.riser) / (T.reveal - T.riser - 0.15), 0, 1));
        return { x: lerp(here.x, PRE.x + 640, k), y: lerp(here.y, PRE.y + 330, k), r: lerp(70, 760, k * k), on: 1 };
      }
      const settle = Math.exp(-(s - t0) * 5);
      return { x: here.x + w.x * (1 - settle) * 0.6, y: here.y + w.y * (1 - settle) * 0.6, r: 70 + 10 * settle, on: 1 };
    }
  }
  return { x: 800, y: 450, r: 800, on: 1 };
}

interface Bit { x: number; y: number; vx: number; vy: number; c: string; life: number; s: number }

export function LogoIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [clock] = useState(() => ({ t0: 0, ctx0: null as number | null, offset: 0, skipped: false }));
  const [canLeave, setCanLeave] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  const left = useRef(false);
  const leave = () => { if (!left.current) { left.current = true; done.current(); } };

  // skipping before the reveal jumps straight to it (the theme starts with the hit)
  const { prompt, held } = useHoldSkip(() => {
    const now = time();
    if (now < LOGO_T.reveal - 0.2) { clock.offset += LOGO_T.reveal - now; clock.skipped = true; music.jumpToTheme(); }
    else leave();
  }, !canLeave);

  function time() {
    const ac = audio.ctx;
    const base = clock.ctx0 !== null && ac && ac.state === 'running' ? ac.currentTime - clock.ctx0 : (performance.now() - clock.t0) / 1000;
    return base + clock.offset;
  }

  // after the reveal, any key or click opens the menu (or it opens by itself after a while)
  useEffect(() => {
    if (!canLeave) return;
    const go = (e: Event) => { if (e instanceof KeyboardEvent && (e.repeat || e.key === ' ')) return; leave(); };
    const t = setTimeout(leave, 9000);
    window.addEventListener('keydown', go); window.addEventListener('mousedown', go);
    return () => { clearTimeout(t); window.removeEventListener('keydown', go); window.removeEventListener('mousedown', go); };
  }, [canLeave]);

  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!;
    const lit = document.createElement('canvas'), lg = lit.getContext('2d')!;
    const mask = document.createElement('canvas'), mg = mask.getContext('2d')!;
    const spr = document.createElement('canvas'); spr.width = SPRITE_W; spr.height = SPRITE_H;
    const sg = spr.getContext('2d')!;
    let pic: HTMLImageElement | null = null, raf = 0, alive = true;
    let W = 0, H = 0, scale = 1, ox = 0, oy = 0;
    const bits: Bit[] = [], embers: Bit[] = [];
    let burst = false, lastT = 0;
    const canLeaveRef = { current: false };

    const fit = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = cv.width = Math.round(cv.clientWidth * dpr); H = cv.height = Math.round(cv.clientHeight * dpr);
      lit.width = mask.width = W; lit.height = mask.height = H;
      scale = Math.min(W / PIC_W, H / PIC_H); ox = (W - PIC_W * scale) / 2; oy = (H - PIC_H * scale) / 2;
    };
    fit(); window.addEventListener('resize', fit);

    void loadPicture().then((p) => {
      if (!alive) return;
      pic = p;
      clock.t0 = performance.now();
      clock.ctx0 = music.playLogo();
      raf = requestAnimationFrame(frame);
    });

    const world = (c: CanvasRenderingContext2D) => c.setTransform(scale, 0, 0, scale, ox, oy);

    function frame() {
      if (!alive) return;
      const s = time(), dt = clamp(s - lastT, 0, 0.1); lastT = s;
      const T = LOGO_T, revealed = s >= T.reveal, rk = revealed ? clamp((s - T.reveal) / 0.75, 0, 1) : 0;
      if (s > T.reveal + 1.6 && !canLeaveRef.current) { canLeaveRef.current = true; setCanLeave(true); }

      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const shake = revealed ? 22 * Math.exp(-(s - T.reveal) * 5) : 0;
      world(g); g.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);

      // ---- Thanos: walk in, then hold the torch at the beam ----
      const walkK = clamp((s - 0.7) / (T.steps[4] + 0.35 - 0.7), 0, 1);
      const footX = lerp(-160, 62, walkK);
      const walking = s > 0.7 && s < T.steps[4] + 0.35;
      const b = beam(s);
      const shoulder = { x: footX + 7 * SPR, y: FOOT_Y - 51 * SPR };   // the torch arm's shoulder (see drawThanos)
      const aimArm = Math.atan2(b.x - shoulder.x, b.y - shoulder.y) - 0.75;
      const raise = ease(clamp((s - T.torch) / 0.45, 0, 1));
      const arm = lerp(1.15, clamp(aimArm, 0.9, 2.7), raise);
      const flameS = drawThanos(sg, walking ? (s - 1.0) / 1.2 : NaN, arm, s, 1);
      const fx = footX + (flameS.x - SPRITE_FOOT.x) * SPR, fy = FOOT_Y + (flameS.y - SPRITE_FOOT.y) * SPR;
      const flick = 0.85 + 0.1 * Math.sin(s * 23) + 0.05 * Math.sin(s * 41);

      if (!revealed) {
        // the wall, almost invisible
        g.globalAlpha = 0.018; if (pic) g.drawImage(pic, PRE.x, PRE.y, PIC_W * PRE.k, PIC_H * PRE.k); g.globalAlpha = 1;
        // what the light touches: the picture, masked by every light at once
        mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, H); world(mg);
        const light = (x: number, y: number, r: number, a: number) => {
          if (a <= 0) return;
          const gr = mg.createRadialGradient(x, y, r * 0.15, x, y, r);
          gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.55})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          mg.globalCompositeOperation = 'lighter'; mg.fillStyle = gr; mg.fillRect(x - r, y - r, r * 2, r * 2);
        };
        light(b.x, b.y, b.r * 1.25, b.on * flick);
        T.letters.forEach((t0, i) => { if (s >= t0) { const p = letterPos(i); light(p.x, p.y, 62, 0.55 + 0.4 * Math.exp(-(s - t0) * 2.5)); } });
        light(fx, fy, 220, 0.22 * flick);
        lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
        world(lg); if (pic) lg.drawImage(pic, PRE.x, PRE.y, PIC_W * PRE.k, PIC_H * PRE.k);
        lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lit, (Math.random() * 2 - 1) * shake * scale, 0); g.restore();
        // warm torchlight on the spot, each found letter glowing in its colour
        glow(g, b.x, b.y, b.r * 1.4, WARM, 0.16 * b.on * flick);
        T.letters.forEach((t0, i) => {
          if (s < t0) return;
          const p = letterPos(i), hit = Math.exp(-(s - t0) * 3);
          glow(g, p.x, p.y, 70 + 90 * hit, SPECTRUM[i].color, 0.35 + 0.65 * hit);
          if (hit > 0.05) { g.save(); g.globalAlpha = hit * 0.8; g.strokeStyle = SPECTRUM[i].color; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, 40 + (1 - hit) * 120, 0, TAU); g.stroke(); g.restore(); }
        });
        // the beam itself: a cone of light from the flame to the spot, with dust in it
        if (b.on > 0) {
          const dx = b.x - fx, dy = b.y - fy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = 6, w1 = b.r * 0.95;
          const gr = g.createLinearGradient(fx, fy, b.x, b.y);
          gr.addColorStop(0, `rgba(255,214,150,${0.32 * b.on * flick})`); gr.addColorStop(1, `rgba(255,190,120,${0.07 * b.on})`);
          g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath();
          g.moveTo(fx + nx * w0, fy + ny * w0); g.lineTo(b.x + nx * w1, b.y + ny * w1); g.lineTo(b.x - nx * w1, b.y - ny * w1); g.lineTo(fx - nx * w0, fy - ny * w0); g.fill();
          g.fillStyle = 'rgba(255,230,190,.55)';
          for (let i = 0; i < 26; i++) {
            const u = ((i * 0.618 + s * 0.07 * (1 + (i % 3))) % 1), side = Math.sin(i * 12.9 + s * 0.6) * (w0 + (w1 - w0) * u) * 0.8;
            g.fillRect(Math.round(fx + dx * u + nx * side), Math.round(fy + dy * u + ny * side), 3, 3);
          }
          g.restore();
        }
        // a final swell to white just before the hit
        const pre = clamp((s - (T.reveal - 0.35)) / 0.35, 0, 1);
        if (pre > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,246,230,${pre ** 2})`; g.fillRect(0, 0, W, H); g.restore(); }
      } else {
        // ---- the reveal ----
        const k = PRE.k + (1 - PRE.k) * (1 + 2.2 * (rk - 1) ** 3 + 1.2 * (rk - 1) ** 2);   // easeOutBack 0.8 → 1
        const zoom = k * (1 + 0.025 * clamp((s - T.reveal - 0.8) / 6, 0, 1));
        const pw = PIC_W * zoom, ph = PIC_H * zoom, px0 = (PIC_W - pw) / 2, py0 = lerp(PRE.y + (PIC_H * PRE.k) / 2, PIC_H / 2, easeOut(rk)) - ph / 2;
        if (pic) g.drawImage(pic, px0, py0, pw, ph);
        if (!burst) {
          burst = true;
          for (let i = 0; i < 260; i++) {
            const a = Math.random() * TAU, v = 200 + Math.random() * 900, c = SPECTRUM[i % 7].color;
            bits.push({ x: 800, y: 420, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, c, life: 1.2 + Math.random() * 1.4, s: 3 + Math.floor(Math.random() * 3) * 2 });
          }
        }
        // letters ripple with light, left to right, again and again
        PANELS.forEach((pnl, i) => {
          const w = Math.max(0, Math.sin((s - T.reveal) * 2.2 - i * 0.55));
          glow(g, px0 + pnl.lx * zoom, py0 + LETTER_Y * zoom, 90 * zoom, SPECTRUM[i].color, 0.18 + 0.32 * w ** 4);
        });
        // shockwave
        const sw = (s - T.reveal) / 0.9;
        if (sw < 1) { g.save(); g.globalAlpha = 1 - sw; g.strokeStyle = '#fff'; g.lineWidth = 14 * (1 - sw) + 2; g.beginPath(); g.arc(800, 430, 60 + sw * 1100, 0, TAU); g.stroke(); g.restore(); }
        // white flash fading
        const fl = Math.exp(-(s - T.reveal) * 3.2);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,248,236,${fl})`; g.fillRect(0, 0, W, H); g.restore();
      }

      // ---- Thanos in front (gone in the flash) ----
      const tAlpha = revealed ? clamp(1 - (s - T.reveal) / 0.25, 0, 1) : clamp((s - 0.6) / 0.5, 0, 1);
      if (tAlpha > 0) {
        glow(g, fx, fy, 170, WARM, 0.45 * flick * tAlpha);
        // shade him: dark at the back, lit by his own flame at the front
        sg.globalCompositeOperation = 'source-atop';
        const sh = sg.createLinearGradient(0, 0, SPRITE_W, 0); sh.addColorStop(0, 'rgba(6,2,12,.72)'); sh.addColorStop(0.55, 'rgba(6,2,12,.3)'); sh.addColorStop(1, 'rgba(255,150,60,.18)');
        sg.fillStyle = sh; sg.fillRect(0, 0, SPRITE_W, SPRITE_H); sg.globalCompositeOperation = 'source-over';
        g.save(); g.globalAlpha = tAlpha; g.imageSmoothingEnabled = false;
        g.drawImage(spr, footX - SPRITE_FOOT.x * SPR, FOOT_Y - SPRITE_FOOT.y * SPR, SPRITE_W * SPR, SPRITE_H * SPR);
        g.restore();
        // the flame on top, unshaded
        glow(g, fx, fy, 26, 'rgba(255,240,200,1)', 0.8 * flick * tAlpha);
        if (Math.random() < 0.5) embers.push({ x: fx + (Math.random() - 0.5) * 8, y: fy, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 60, c: Math.random() < 0.5 ? '#ffb02e' : '#ff6a1a', life: 0.8 + Math.random() * 0.8, s: 3 });
        // dust kicked up by each footfall
        T.steps.forEach((st) => { const k = s - st; if (k > 0 && k < 0.5) { g.save(); g.globalAlpha = (1 - k / 0.5) * 0.35 * tAlpha; g.fillStyle = '#7a6a90'; for (let j = -3; j <= 3; j++) g.fillRect(Math.round(footX + j * 9 + j * k * 40), Math.round(FOOT_Y - 4 - k * 20 * (1 - Math.abs(j) / 4)), 4, 4); g.restore(); } });
      }

      // ---- pixel particles ----
      for (const arr of [embers, bits]) {
        for (const p of arr) { p.vy += (arr === bits ? 520 : -20) * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1);
        for (const p of arr) { g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
        g.globalAlpha = 1;
      }

      // ---- screen treatment: vignette, scanlines, grain ----
      g.setTransform(1, 0, 0, 1, 0, 0);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      if (settings.get().crt) { g.fillStyle = 'rgba(0,0,0,.22)'; const step = Math.max(3, Math.round(H / 300)); for (let y = 0; y < H; y += step) g.fillRect(0, y, W, Math.ceil(step / 2.5)); }
      g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 90; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);

      raf = requestAnimationFrame(frame);
    }
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, [clock]);

  return (
    <div className="logo-layer">
      <canvas ref={ref} className="logo-canvas" aria-label="Thanos walks into the dark with a torch. Its light finds the letters V I B G Y O R one by one, then the whole VIBGYOR picture appears." />
      {canLeave && <div className="press-any">{IS_TOUCH ? 'TAP TO GO ON' : 'PRESS ANY KEY'}</div>}
      {!canLeave && <SkipPrompt prompt={prompt} held={held} />}
    </div>
  );
}
