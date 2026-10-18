import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import '@fontsource/bangers/400.css';
import { PANELS, PIC_URL } from './art';
import { music } from './music';
import { SPECTRUM } from './sequence';
import { sfx } from './sfx';
import './finale.css';

/*
 * After the end-credits video: the closing pages, drawn like a comic book.
 *
 *   TITLE    the VIBGYOR picture slams back in on the theme's hit
 *   STUDIO   a SNaP studios game
 *   TEAM     GAME DEVELOPMENT TEAM: three portrait panels slam in, the music cuts, a SNAP,
 *            and the panels crumble to dust and blow away
 *   CREDITS  credits & acknowledgements (the theme comes back in)
 *   THE END  then RETURN TO HOME or QUIT
 *
 * Every page moves on by itself; ENTER, SPACE, → or a click moves on sooner.
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties;

type Page = 'title' | 'studio' | 'team' | 'credits' | 'end';
const PAGES: Page[] = ['title', 'studio', 'team', 'credits', 'end'];
/** How long each page stays up (ms); THE END waits for the player. */
const HOLD: Record<Page, number> = { title: 7000, studio: 4600, team: 12900, credits: 21000, end: Infinity };
const FADE = 520;

export const TEAM = [
  { name: 'Shreekanth Nadiga', src: 'img/team/sriki.webp', accent: SPECTRUM[0].color, tilt: -2.2 },
  { name: 'Neha Anna John', src: 'img/team/naj.webp', accent: SPECTRUM[6].color, tilt: 1.6 },
  { name: 'Poojith M Ramannavar', src: 'img/team/pooj.webp', accent: SPECTRUM[2].color, tilt: -1.2 },
];

export function Finale({ onHome, onQuit }: { onHome: () => void; onQuit: () => void }) {
  const [page, setPage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const since = useRef(performance.now());
  const busy = useRef(false);
  const cur = PAGES[page];

  const next = useCallback(() => {
    if (busy.current || page >= PAGES.length - 1) return;
    busy.current = true; setLeaving(true);
    window.setTimeout(() => { setPage((p) => p + 1); setLeaving(false); since.current = performance.now(); busy.current = false; }, FADE);
  }, [page]);

  // the theme comes back with a hit on the title, and again on the credits (after the snap silenced it)
  useEffect(() => {
    if (cur === 'title' || cur === 'credits') music.jumpToTheme();
  }, [cur]);

  // each page moves on by itself
  useEffect(() => {
    const ms = HOLD[cur]; if (!Number.isFinite(ms)) return;
    const t = window.setTimeout(next, ms);
    return () => clearTimeout(t);
  }, [cur, next]);

  // …or sooner, on ENTER / SPACE / → / a click (not in the first moment, so a held key does not skip a page)
  useEffect(() => {
    if (cur === 'end') return;
    const go = () => { if (performance.now() - since.current > 1200) { sfx.blip(); next(); } };
    const onKey = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') && !e.repeat) { e.preventDefault(); go(); } };
    window.addEventListener('keydown', onKey); window.addEventListener('mousedown', go);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', go); };
  }, [cur, next]);

  return (
    <div className="fin">
      <div className="fin-dots" aria-hidden />
      <div key={cur} className={`fin-page ${cur}${leaving ? ' leaving' : ''}`}>
        {cur === 'title' && <TitlePage />}
        {cur === 'studio' && <StudioPage />}
        {cur === 'team' && <TeamPage />}
        {cur === 'credits' && <CreditsPage />}
        {cur === 'end' && <EndPage onHome={onHome} onQuit={onQuit} />}
      </div>
      {cur !== 'end' && <div className="fin-next" aria-hidden>ENTER ▶</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- TITLE */
function TitlePage() {
  return (
    <div className="fin-title">
      <div className="fin-rays" aria-hidden />
      <div className="fin-pic" style={{ backgroundImage: `url(${PIC_URL})` }} role="img" aria-label="VIBGYOR" />
      <div className="fin-flash" aria-hidden />
    </div>
  );
}

/* ---------------------------------------------------------------- STUDIO: exactly the card from the start of the game (Studio.tsx) */
function StudioPage() {
  useEffect(() => { const t = setTimeout(() => sfx.studioHit(), 1500); return () => clearTimeout(t); }, []);
  return (
    <div className="fin-studio" aria-label="SNaP studios">
      <div className="studio-mark" aria-hidden>
        <span>S</span><span>N</span><span className="a">a</span><span>P</span>
      </div>
      <div className="studio-line" aria-hidden>{SPECTRUM.map((b) => <i key={b.letter} style={{ background: b.color }} />)}</div>
      <div className="studio-name">STUDIOS</div>
    </div>
  );
}

/* ---------------------------------------------------------------- TEAM (and the snap) */

const PANEL = { pad: 8, w: 600, b: 12, cap: 86, capDrop: 52, shadow: 18 };
const PHOTO_W = PANEL.w - PANEL.b * 2, PHOTO_H = Math.round(PHOTO_W * 4 / 3), PANEL_H = PHOTO_H + PANEL.b * 2;
const CANVAS_W = PANEL.pad * 2 + PANEL.w + PANEL.shadow, CANVAS_H = PANEL.pad * 2 + PANEL_H + PANEL.capDrop + PANEL.shadow;

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/** One portrait as a comic panel: coloured drop, ink border, the photo under one shared grade and a halftone screen, and a caption box. */
function drawPanel(cv: HTMLCanvasElement, img: HTMLImageElement, name: string, accent: string) {
  cv.width = CANVAS_W; cv.height = CANVAS_H;
  const g = cv.getContext('2d')!, x0 = PANEL.pad, y0 = PANEL.pad, px = x0 + PANEL.b, py = y0 + PANEL.b;
  g.fillStyle = accent; g.fillRect(x0 + PANEL.shadow, y0 + PANEL.shadow, PANEL.w, PANEL_H);
  g.fillStyle = '#000'; g.fillRect(x0, y0, PANEL.w, PANEL_H);
  // the photo, cover-fitted
  const k = Math.max(PHOTO_W / img.width, PHOTO_H / img.height), iw = img.width * k, ih = img.height * k;
  g.save(); g.beginPath(); g.rect(px, py, PHOTO_W, PHOTO_H); g.clip();
  g.filter = 'contrast(1.06) saturate(1.04)';
  g.drawImage(img, px + (PHOTO_W - iw) / 2, py + (PHOTO_H - ih) / 2, iw, ih);
  g.filter = 'none';
  // one shared grade for all three: warm light from above, cool shadow below
  g.globalCompositeOperation = 'soft-light';
  const gr = g.createLinearGradient(0, py, 0, py + PHOTO_H);
  gr.addColorStop(0, 'rgba(255,170,90,0.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,40,140,0.6)');
  g.fillStyle = gr; g.fillRect(px, py, PHOTO_W, PHOTO_H);
  // halftone print screen
  g.globalCompositeOperation = 'multiply';
  const dot = document.createElement('canvas'); dot.width = dot.height = 7;
  const dg = dot.getContext('2d')!; dg.fillStyle = 'rgba(0,0,0,0.5)'; dg.beginPath(); dg.arc(3.5, 3.5, 1.35, 0, Math.PI * 2); dg.fill();
  g.globalAlpha = 0.35; g.fillStyle = g.createPattern(dot, 'repeat')!; g.fillRect(px, py, PHOTO_W, PHOTO_H); g.globalAlpha = 1;
  // vignette
  const vg = g.createRadialGradient(px + PHOTO_W / 2, py + PHOTO_H * 0.42, PHOTO_H * 0.28, px + PHOTO_W / 2, py + PHOTO_H * 0.5, PHOTO_H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(px, py, PHOTO_W, PHOTO_H);
  g.restore();
  // a thin white keyline inside the ink border
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.strokeRect(px + 1.5, py + 1.5, PHOTO_W - 3, PHOTO_H - 3);
  // the caption box, overlapping the bottom edge
  g.font = `56px Bangers, Impact, sans-serif`;
  const label = name.toUpperCase(), maxW = PANEL.w - 70;
  const fits = (sz: number) => g.measureText(label).width + label.length * sz * 0.06 <= maxW - 56;
  let size = 56; while (!fits(size) && size > 30) { size -= 2; g.font = `${size}px Bangers, Impact, sans-serif`; }
  const tw = g.measureText(label).width + label.length * size * 0.06, bw = Math.min(maxW, tw + 56), bh = PANEL.cap;
  const bx = x0 + (PANEL.w - bw) / 2, by = y0 + PANEL_H - bh + PANEL.capDrop;
  g.fillStyle = '#000'; g.fillRect(bx + 8, by + 8, bw, bh);
  g.fillStyle = '#FFD400'; g.fillRect(bx, by, bw, bh);
  g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeRect(bx, by, bw, bh);
  g.fillStyle = '#000'; g.textBaseline = 'middle'; g.textAlign = 'center';
  // Bangers with a touch of tracking
  const sp = size * 0.06; let cx = bx + bw / 2 - tw / 2;
  g.textAlign = 'left';
  for (const ch of label) { g.fillText(ch, cx, by + bh / 2 + 3); cx += g.measureText(ch).width + sp; }
}

interface Dust {
  n: number; x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; at: Float32Array; life: Float32Array; seed: Float32Array;
  r: Uint8Array; g: Uint8Array; b: Uint8Array; gone: Uint8Array;
  /** where each grain sits on its panel's own canvas (to rub it out there as it leaves) */
  cx: Float32Array; cy: Float32Array; panel: Uint8Array; block: number[];
}

/** Turn the panels into grains: one per 2×2 screen pixels, each leaving at its own moment, swept left to right. */
function grind(canvases: HTMLCanvasElement[]): Dust {
  const parts: { x: number; y: number; at: number; r: number; g: number; b: number; cx: number; cy: number; p: number }[] = [];
  const block: number[] = [];
  const order = [0.0, 0.55, 0.25];   // the snap takes them one after another, out of order
  canvases.forEach((cv, p) => {
    const rect = cv.getBoundingClientRect(), s = cv.offsetWidth / cv.width;
    const ang = (TEAM[p].tilt * Math.PI) / 180, cos = Math.cos(ang), sin = Math.sin(ang);
    const mx = rect.left + rect.width / 2, my = rect.top + rect.height / 2;
    const step = Math.max(1, Math.round(2 / s)); block.push(step);
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
    for (let y = 0; y < cv.height; y += step) {
      for (let x = 0; x < cv.width; x += step) {
        const i = (y * cv.width + x) * 4; if (d[i + 3] < 40) continue;
        const lx = (x - cv.width / 2) * s, ly = (y - cv.height / 2) * s;
        const u = x / cv.width, v = y / cv.height;
        parts.push({
          x: mx + lx * cos - ly * sin, y: my + lx * sin + ly * cos,
          at: order[p] + u * 1.5 + (1 - v) * 0.35 + Math.random() * 0.7,
          r: d[i], g: d[i + 1], b: d[i + 2], cx: x, cy: y, p,
        });
      }
    }
  });
  const n = parts.length, f = () => new Float32Array(n), u8 = () => new Uint8Array(n);
  const D: Dust = { n, x: f(), y: f(), vx: f(), vy: f(), at: f(), life: f(), seed: f(), r: u8(), g: u8(), b: u8(), gone: u8(), cx: f(), cy: f(), panel: u8(), block };
  parts.forEach((q, i) => {
    D.x[i] = q.x; D.y[i] = q.y; D.at[i] = q.at; D.r[i] = q.r; D.g[i] = q.g; D.b[i] = q.b; D.cx[i] = q.cx; D.cy[i] = q.cy; D.panel[i] = q.p;
    D.vx[i] = 40 + Math.random() * 150; D.vy[i] = -(15 + Math.random() * 85); D.life[i] = 1.3 + Math.random() * 1.7; D.seed[i] = Math.random() * 100;
  });
  return D;
}

function TeamPage() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const dustRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [snapped, setSnapped] = useState(false);

  // draw the three panels once the fonts and photos are in
  useEffect(() => {
    let live = true;
    (async () => {
      await Promise.allSettled([document.fonts.load('56px Bangers'), document.fonts.ready]);
      const imgs = await Promise.all(TEAM.map((m) => loadImg(m.src).catch(() => null)));
      if (!live) return;
      TEAM.forEach((m, i) => { const cv = refs.current[i], im = imgs[i]; if (cv && im) drawPanel(cv, im, m.name, m.accent); });
      setReady(true);
    })();
    return () => { live = false; };
  }, []);

  // the panels slam in one by one
  useEffect(() => {
    if (!ready) return;
    const ts = TEAM.map((_, i) => window.setTimeout(() => sfx.slam(), 700 + i * 420));
    return () => ts.forEach(clearTimeout);
  }, [ready]);

  // …a beat of silence, the SNAP, and they crumble to dust
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const quiet = window.setTimeout(() => music.stop(0.6), 6800);
    const snap = window.setTimeout(() => { sfx.snap(); setSnapped(true); }, 7700);
    const go = window.setTimeout(() => {
      const cvs = refs.current.filter(Boolean) as HTMLCanvasElement[];
      const dc = dustRef.current; if (!dc || cvs.length !== TEAM.length) return;
      sfx.dust(3.6);
      const W = (dc.width = window.innerWidth), H = (dc.height = window.innerHeight);
      const g = dc.getContext('2d')!, img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
      const D = grind(cvs), pg = cvs.map((c) => c.getContext('2d')!);
      let lastAt = 0; for (let i = 0; i < D.n; i++) lastAt = Math.max(lastAt, D.at[i]);
      const t0 = performance.now(); let last = t0, emptied = false;
      const tick = (now: number) => {
        const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
        buf.fill(0);
        let alive = 0;
        for (let i = 0; i < D.n; i++) {
          const age = t - D.at[i];
          if (age < 0) { alive++; continue; }             // still part of the picture
          if (!D.gone[i]) { D.gone[i] = 1; const s = D.block[D.panel[i]]; pg[D.panel[i]].clearRect(D.cx[i], D.cy[i], s, s); }
          if (age > D.life[i]) continue;
          alive++;
          // drift off to the right and up, on a lazy, swirling wind
          D.vx[i] += (45 + Math.sin(t * 1.7 + D.seed[i]) * 60) * dt;
          D.vy[i] += (Math.cos(t * 2.3 + D.seed[i] * 1.3) * 50 - 12) * dt;
          D.x[i] += D.vx[i] * dt; D.y[i] += D.vy[i] * dt;
          const x = D.x[i] | 0, y = D.y[i] | 0; if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) continue;
          // the colour turns to ash as it goes
          const ash = Math.min(1, age / 0.5) * 0.8, a = (1 - age / D.life[i]) ** 1.3;
          const r = D.r[i] + (122 - D.r[i]) * ash, gg = D.g[i] + (98 - D.g[i]) * ash, b = D.b[i] + (78 - D.b[i]) * ash;
          const px = ((a * 255) << 24) | ((b & 255) << 16) | ((gg & 255) << 8) | (r & 255);
          const o = y * W + x; buf[o] = px >>> 0;
          if (age < D.life[i] * 0.5) { buf[o + 1] = px >>> 0; buf[o + W] = px >>> 0; buf[o + W + 1] = px >>> 0; }   // grains break up as they fly
        }
        g.putImageData(img, 0, 0);
        if (!emptied && t > lastAt) { emptied = true; cvs.forEach((c) => { c.style.visibility = 'hidden'; }); }   // nothing left behind
        if (alive > 0) raf = requestAnimationFrame(tick);
        else g.clearRect(0, 0, W, H);
      };
      raf = requestAnimationFrame(tick);
    }, 8350);
    return () => { clearTimeout(quiet); clearTimeout(snap); clearTimeout(go); cancelAnimationFrame(raf); };
  }, [ready]);

  return (
    <div className={`fin-team${ready ? ' ready' : ''}${snapped ? ' snapped' : ''}`}>
      <h2 className="fin-head"><span>GAME DEVELOPMENT TEAM</span></h2>
      <div className="fin-panels">
        {TEAM.map((m, i) => (
          <figure key={m.name} className="fin-panel" style={vars({ '--i': i, '--tilt': `${m.tilt}deg` })}>
            <canvas ref={(el) => { refs.current[i] = el; }} role="img" aria-label={m.name} />
          </figure>
        ))}
      </div>
      <canvas ref={dustRef} className="fin-dust" aria-hidden />
    </div>
  );
}

/* ---------------------------------------------------------------- CREDITS */
const CREDITS: { head: string; color: string; items: { t: string; d: string }[] }[] = [
  {
    head: 'CHARACTERS & ARTWORK', color: SPECTRUM[0].color, items: [
      { t: 'Thanos, the Infinity Gauntlet, the Infinity Stones and Avengers: Doomsday', d: 'are trademarks and © of Marvel Characters, Inc. and The Walt Disney Company.' },
      { t: 'Doraemon', d: '© Fujiko-Pro, Shogakukan, TV Asahi, Shin-Ei and ADK.' },
      { t: 'Thanos Thakur, Trump Tharif and Vision Verma', d: 'are parody characters. Any resemblance to real public figures is satirical and fictional.' },
      { t: 'Comic panel artwork', d: 'generated with ChatGPT (OpenAI).' },
    ],
  },
  {
    head: 'MUSIC, VOICE & TYPE', color: SPECTRUM[6].color, items: [
      { t: 'Score: “Sombra Reluciente”', d: 'made with Suno by nehajohn829.' },
      { t: 'Doraemon theme', d: 'sourced from Zedge (zedge.net). © its respective rights holders.' },
      { t: 'Keyboard typing sound effect', d: 'Mixkit, used under the Mixkit Free License.' },
      { t: 'Narration', d: 'AI voice, Microsoft Edge neural text-to-speech.' },
      { t: 'Thanos voice line', d: 'AI voice generated with Magic Hour (magichour.ai).' },
      { t: 'Caption lettering', d: 'Anime Ace 2 by Nate Piekos, Blambot.' },
    ],
  },
];

function CreditsPage() {
  return (
    <div className="fin-credits">
      <h2 className="fin-head small"><span>CREDITS &amp; ACKNOWLEDGEMENTS</span></h2>
      <div className="fin-cols">
        {CREDITS.map((col, c) => (
          <section key={col.head} className="fin-col" style={vars({ '--c': col.color, '--i': c })}>
            <h3>{col.head}</h3>
            {col.items.map((it) => <p key={it.t}><b>{it.t}</b><span>{it.d}</span></p>)}
          </section>
        ))}
      </div>
      <footer className="fin-foot">
        <p>RESPAWN is a non-commercial fan work by SNaP studios (Shreekanth, Neha and Poojith).</p>
        <p>It is not affiliated with, sponsored or endorsed by Marvel, Disney, Fujiko-Pro or any other rights holder.</p>
        <p>No copyright infringement is intended. All characters and trademarks belong to their respective owners.</p>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- THE END
 * Quiet and in the game's own pixel style: every world played stands side by side as a dim column
 * (BnW's chessboard, then the V…R panels of the VIBGYOR picture, each in its level's own art),
 * a black band across the middle, THE END typed in, and the pixel menu buttons. */
function EndPage({ onHome, onQuit }: { onHome: () => void; onQuit: () => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const st = useRef({ sel, onHome, onQuit }); st.current = { sel, onHome, onQuit };
  useEffect(() => {
    const a = setTimeout(() => sfx.studioHit(), 1700);
    const b = setTimeout(() => setOpen(true), 3400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const pick = (i: number) => { sfx.select(); (i === 0 ? st.current.onHome : st.current.onQuit)(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'a' || e.key === 'w') { setSel(0); sfx.move(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'd' || e.key === 's') { setSel(1); sfx.move(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(st.current.sel); }
      else if (e.key === 'Escape' || e.key === 'q') pick(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="te">
      <div className="te-cols" aria-hidden>
        <div className="te-col bnw" style={vars({ '--i': 0 })}>
          <span className="te-piece">♞</span>
          <span className="te-tag">BnW</span>
        </div>
        {PANELS.map((p, i) => (
          <div key={i} className="te-col" style={vars({ '--i': i + 1, '--cx': (p.x0 + p.x1) / 2, backgroundImage: `url(${PIC_URL})` })} />
        ))}
      </div>
      <div className="te-band">
        <h1 className="te-title" aria-label="THE END">
          {[...'THE END'].map((ch, i) => <span key={i} style={vars({ '--i': i })} aria-hidden>{ch === ' ' ? ' ' : ch}</span>)}
        </h1>
        <div className="te-line" aria-hidden><i style={{ background: '#fff' }} />{SPECTRUM.map((b) => <i key={b.letter} style={{ background: b.color }} />)}</div>
        <p className="te-thanks">THANK YOU FOR PLAYING</p>
        <div className={`te-choices${open ? ' open' : ''}`}>
          <button type="button" className={`pix-btn${sel === 0 ? ' on' : ''}`} disabled={!open} onMouseEnter={() => setSel(0)} onClick={() => { sfx.select(); onHome(); }}>▶ RETURN TO HOME</button>
          <button type="button" className={`pix-btn${sel === 1 ? ' on' : ''}`} disabled={!open} onMouseEnter={() => setSel(1)} onClick={() => { sfx.select(); onQuit(); }}>✕ QUIT</button>
        </div>
      </div>
    </div>
  );
}
