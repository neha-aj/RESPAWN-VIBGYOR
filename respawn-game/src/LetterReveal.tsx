import { useEffect, useRef, type CSSProperties } from 'react';
import { clamp, ease, easeOut, glow, lerp, LETTER_Y, loadPicture, PANELS, PIC_H, PIC_W, TAU } from './art';
import { SPECTRUM } from './sequence';
import { settings } from './settings';
import { sfx } from './sfx';
import { SkipPrompt, useHoldSkip } from './Transitions';

/*
 * The short clip before each colour, built from the VIBGYOR picture (it replaces the old mp4s).
 * The wall is dark. A torch is raised from the bottom of the screen; its beam sways across
 * the panels and settles on this chapter's block. The whole block lights up, its letter
 * flares in its colour, then the camera dives into the letter.
 * Hold SPACE to skip, like any cutscene.
 */

const D = 5.0;                                         // seconds, then the hand-off
const T = { torch: 0.15, sweep: 0.35, land: 1.35, open: 1.35, flare: 1.95, zoom: 2.15, zoomEnd: 4.35 };
const SRC = { x: 800, y: 1035 };                       // the torch, just below the bottom edge

export function LetterReveal({ band, fading, onEnd }: { band: number; fading: boolean; onEnd: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const end = useRef(onEnd); end.current = onEnd;
  const ended = useRef(false);
  const finish = () => { if (!ended.current) { ended.current = true; end.current(); } };
  const { prompt, held } = useHoldSkip(finish);

  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!;
    const lit = document.createElement('canvas'), lg = lit.getContext('2d')!;
    const mask = document.createElement('canvas'), mg = mask.getContext('2d')!;
    const P = PANELS[band], color = SPECTRUM[band].color;
    const from = PANELS[band === 0 ? 1 : band - 1];   // the beam comes in from a neighbouring panel
    let W = 0, H = 0, scale = 1, raf = 0, alive = true, t0 = 0, pic: HTMLImageElement | null = null;
    const fired = new Set<string>();
    const once = (k: string, s: number, at: number, f: () => void) => { if (s >= at && !fired.has(k)) { fired.add(k); f(); } };

    const fit = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = cv.width = Math.round(cv.clientWidth * dpr); H = cv.height = Math.round(cv.clientHeight * dpr);
      lit.width = mask.width = W; lit.height = mask.height = H;
      scale = Math.min(W / PIC_W, H / PIC_H);
    };
    fit(); window.addEventListener('resize', fit);

    void loadPicture().then((p) => { if (!alive) return; pic = p; t0 = performance.now(); raf = requestAnimationFrame(frame); });

    function frame() {
      if (!alive) return;
      const s = (performance.now() - t0) / 1000;
      once('torch', s, T.torch, () => sfx.torch());
      once('sweep', s, T.sweep, () => sfx.sweep(1.0));
      once('land', s, T.land, () => sfx.landOn(band));
      once('zoom', s, T.zoom, () => sfx.zoom(T.zoomEnd - T.zoom));
      once('end', s, D, finish);

      // camera: the whole picture, diving into the letter
      const zk = ease(clamp((s - T.zoom) / (T.zoomEnd - T.zoom), 0, 1));
      const zoom = lerp(1, 3.9, zk * zk * (3 - 2 * zk) * 0.35 + zk * 0.65);
      const cx = lerp(PIC_W / 2, P.lx, easeOut(zk)), cy = lerp(PIC_H / 2, LETTER_Y - 8, zk ** 1.4);
      const cam = (c: CanvasRenderingContext2D) => c.setTransform(scale * zoom, 0, 0, scale * zoom, W / 2 - cx * scale * zoom, H / 2 - cy * scale * zoom);

      // the beam spot: from the neighbour, swaying, onto the middle of the block
      const sk = ease(clamp((s - T.sweep) / (T.land - T.sweep), 0, 1));
      const sway = (1 - sk) * Math.sin(s * 9) * 22;
      const fromX = (from.x0 + from.x1) / 2, toX = (P.x0 + P.x1) / 2;
      const spot = { x: lerp(fromX, toX, sk) + sway, y: lerp(470, 400, sk) - Math.sin(sk * Math.PI) * 70 };
      const open = easeOut(clamp((s - T.open) / 0.55, 0, 1));          // spot → the whole block
      const on = clamp((s - T.sweep + 0.15) / 0.25, 0, 1);
      const flick = 0.88 + 0.08 * Math.sin(s * 21) + 0.04 * Math.sin(s * 47);
      const fade = clamp(s / 0.35, 0, 1);

      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.imageSmoothingEnabled = zoom < 1.6;                                      // closer in, the picture's own pixels show
      cam(g); g.globalAlpha = 0.05 * fade; if (pic) g.drawImage(pic, 0, 0, PIC_W, PIC_H); g.globalAlpha = 1;

      // light mask: the beam spot, widening into the block
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, H); cam(mg); mg.globalCompositeOperation = 'lighter';
      const rx = lerp(85, (P.x1 - P.x0) * 0.9, open), ry = lerp(85, 560, open), my = lerp(spot.y, 400, open);
      mg.save(); mg.translate(spot.x, my); mg.scale(rx / 100, ry / 100);
      const gr = mg.createRadialGradient(0, 0, 10, 0, 0, 100);
      gr.addColorStop(0, `rgba(255,255,255,${on * flick})`); gr.addColorStop(0.65, `rgba(255,255,255,${on * flick * 0.7})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      mg.fillStyle = gr; mg.fillRect(-100, -100, 200, 200); mg.restore();
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
      lg.imageSmoothingEnabled = g.imageSmoothingEnabled; cam(lg);
      if (open > 0) { lg.save(); lg.beginPath(); lg.rect(lerp(-200, P.x0 - 2, open), -10, lerp(2000, P.x1 - P.x0 + 4, open), 800); lg.clip(); }
      if (pic) lg.drawImage(pic, 0, 0, PIC_W, PIC_H);
      if (open > 0) lg.restore();
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lit, 0, 0);

      cam(g);
      // warm light, then the letter flares in its colour
      glow(g, spot.x, my, Math.max(rx, ry) * 1.1, 'rgba(255,176,90,1)', 0.13 * on * flick * (1 - zk));
      const fl = s >= T.flare ? Math.exp(-(s - T.flare) * 2.2) : 0, lit2 = s >= T.flare ? 1 : 0;
      glow(g, P.lx, LETTER_Y, 110 + 140 * fl, color, (0.4 + 0.6 * fl) * lit2);
      if (fl > 0.03) { g.save(); g.globalAlpha = fl; g.strokeStyle = color; g.lineWidth = 4 / zoom; g.beginPath(); g.arc(P.lx, LETTER_Y, 50 + (1 - fl) * 170, 0, TAU); g.stroke(); g.restore(); }
      if (zk > 0.85) {                                                           // the hold: light rays behind the letter
        const k = (zk - 0.85) / 0.15, pulse = 0.5 + 0.5 * Math.sin(s * 6);
        g.save(); g.globalCompositeOperation = 'lighter'; g.translate(P.lx, LETTER_Y);
        for (let i = 0; i < 12; i++) {
          g.rotate(TAU / 12 + s * 0.02); g.globalAlpha = 0.06 * k * (0.6 + 0.4 * pulse); g.fillStyle = color;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-10, -260); g.lineTo(10, -260); g.fill();
        }
        g.restore();
        glow(g, P.lx, LETTER_Y, 70, color, 0.25 * k * pulse);
      }

      // the beam's cone and the torch, until the dive takes us past them
      const beamA = on * (1 - zk);
      if (beamA > 0.01) {
        g.setTransform(scale, 0, 0, scale, W / 2 - (PIC_W / 2) * scale, H / 2 - (PIC_H / 2) * scale);   // torch stays in screen space
        const sx = SRC.x + Math.sin(s * 1.7) * 18, sy = SRC.y - 120 * easeOut(clamp((s - T.torch) / 0.35, 0, 1));
        const tgt = { x: (spot.x - cx) * zoom + PIC_W / 2, y: (my - cy) * zoom + PIC_H / 2 };
        const dx = tgt.x - sx, dy = tgt.y - sy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w1 = Math.max(rx, 80) * zoom * 0.8;
        const cg = g.createLinearGradient(sx, sy, tgt.x, tgt.y);
        cg.addColorStop(0, `rgba(255,214,150,${0.3 * beamA * flick})`); cg.addColorStop(1, `rgba(255,190,120,${0.05 * beamA})`);
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = cg; g.beginPath();
        g.moveTo(sx + nx * 8, sy + ny * 8); g.lineTo(tgt.x + nx * w1, tgt.y + ny * w1); g.lineTo(tgt.x - nx * w1, tgt.y - ny * w1); g.lineTo(sx - nx * 8, sy - ny * 8); g.fill(); g.restore();
        // a chunky pixel torch: stick, iron cup, flame
        const ang = Math.atan2(dx, -dy) * 0.6, P2 = 6;
        g.save(); g.translate(sx, sy); g.rotate(ang); g.globalAlpha = beamA;
        const blk = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x * P2, y * P2, w * P2, h * P2); };
        blk('#45291a', -2, 0, 4, 22); blk('#6b4423', -1, 0, 1, 22); blk('#3a3a3a', -3, -3, 6, 4); blk('#5a5a5a', -3, -3, 6, 1);
        const fh = 9 + Math.round(Math.sin(s * 19) * 1.5);
        for (let i = 0; i < fh; i++) { const w = Math.max(1, Math.round((fh - i) * 0.75)), wob = Math.round(Math.sin(s * 15 + i) * (i / fh) * 1.5); blk(i < fh * 0.35 ? '#ff6a1a' : i < fh * 0.7 ? '#ffb02e' : '#fff3b0', -w / 2 + wob, -4 - i, w, 1); }
        g.restore();
        glow(g, sx, sy - 40, 160, 'rgba(255,190,110,1)', 0.35 * beamA * flick);
      }

      // screen treatment
      g.setTransform(1, 0, 0, 1, 0, 0);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      if (settings.get().crt) { g.fillStyle = 'rgba(0,0,0,.2)'; const st = Math.max(3, Math.round(H / 300)); for (let y = 0; y < H; y += st) g.fillRect(0, y, W, Math.ceil(st / 2.5)); }
      raf = requestAnimationFrame(frame);
    }
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, [band]);

  return (
    <div className={`video-layer reveal-layer${fading ? ' fading' : ''}`} style={{ '--c': SPECTRUM[band].color } as CSSProperties}>
      <canvas ref={ref} className="logo-canvas" aria-label={`The torch finds the ${SPECTRUM[band].name} panel, then the camera dives into the letter ${SPECTRUM[band].letter}.`} />
      <SkipPrompt prompt={prompt} held={held} />
    </div>
  );
}
