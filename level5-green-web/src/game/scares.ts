/* GREEN — ambient jumpscares. Between the phantom's catches, the forest itself lashes out every so often:
 * a ghost face (after the two reference pictures) bursts onto the screen for about a second, with a shriek,
 * static and VHS tearing. They cost no life and the world is frozen while one plays.
 *
 * The pictures are pixelated and gradient-mapped onto GREEN's palette once, at load. */
import grinUrl from '../assets/ghost-grin.webp';
import wailUrl from '../assets/ghost-wail.png';
import { H, SCARE_FIRST, SCARE_GAP, W } from './config';
import type { GreenGame, Sound } from './sim';

type Variant = 'slam' | 'lurk' | 'strobe';
const DUR: Record<Variant, number> = { slam: 1.15, lurk: 1.5, strobe: 1.05 };
const ORDER: Variant[] = ['slam', 'lurk', 'strobe'];
const PIX = 150;                                   // the faces are drawn this many pixels wide, then blown up: hard pixels
// luminance → GREEN palette (void, sockets, ghost skin, pale, glare)
const RAMP: [number, [number, number, number]][] = [[0, [1, 6, 2]], [0.22, [8, 34, 20]], [0.48, [40, 128, 74]], [0.74, [128, 232, 156]], [1, [228, 255, 232]]];

interface Face { img: HTMLCanvasElement; focusY: number }

function rampAt(l: number) {
  for (let i = 1; i < RAMP.length; i++) if (l <= RAMP[i][0]) {
    const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], k = (l - a) / (b - a);
    return ca.map((v, j) => v + (cb[j] - v) * k);
  }
  return RAMP[RAMP.length - 1][1];
}

function bake(url: string, focusY: number, out: Face[], slot: number) {
  const im = new Image();
  im.onload = () => {
    const w = PIX, h = Math.round((im.height / im.width) * PIX), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const l = (0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]) / 255;
      const [r, gg, b] = rampAt(Math.min(1, Math.max(0, (l - 0.04) * 1.25)));   // a touch more contrast
      d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b;
    }
    g.putImageData(d, 0, 0);
    out[slot] = { img: c, focusY };
  };
  im.src = url;
}

export class Scares {
  private faces: Face[] = [];
  private wait = 0; private active: { v: Variant; t: number; face: number; x: number; fired: Set<string> } | null = null;
  private count = 0; private seenReset = -1;
  constructor(private sfx: (s: Sound, vol?: number) => void) {
    bake(grinUrl, 0.42, this.faces, 0); bake(wailUrl, 0.36, this.faces, 1);   // 0 = the grin, 1 = the wail
    this.rearm(true);
  }
  private rearm(first: boolean) {
    const [a, b] = first ? SCARE_FIRST : SCARE_GAP;
    this.wait = a + Math.random() * (b - a);
  }
  get on() { return !!this.active; }

  /** Advance the timers; returns true while a scare is on screen (the world should not step). */
  update(dt: number, game: GreenGame): boolean {
    if (this.seenReset !== game.resetCount) { this.seenReset = game.resetCount; this.active = null; this.count = 0; this.rearm(true); }
    const a = this.active;
    if (a) {
      if (game.state === 'PAUSED') return true;
      a.t += dt;
      const once = (key: string, at: number, s: Sound, vol = 1) => { if (a.t >= at && !a.fired.has(key)) { a.fired.add(key); this.sfx(s, vol); } };
      if (a.v === 'slam') { once('st', 0, 'static', 0.7); once('sh', 0.07, 'shriek', 1); }
      else if (a.v === 'lurk') { once('sg', 0, 'sting', 0.8); once('sh', 0.52, 'shriek', 1); once('st', 0.5, 'static', 0.6); }
      else { once('st', 0, 'static', 0.9); once('sh', 0.62, 'shriek', 1); }
      if (a.t >= DUR[a.v]) { this.active = null; this.rearm(false); return false; }
      return true;
    }
    // only while Thanos is actually exploring: not in the opening grace, not once the tree ritual has begun
    if (game.state === 'JUMPSCARE') this.wait = Math.max(this.wait, 12);   // never right on top of a catch
    if (game.state !== 'PLAYING' || game.protect > 0 || game.ritualT !== null || !this.faces[0] || !this.faces[1]) return false;
    this.wait -= dt;
    if (this.wait > 0) return false;
    const v = ORDER[this.count % ORDER.length];
    this.count++;
    // the slam is the grinning VHS face, the lurker the wailing skull; the strobe ends on whichever is due
    this.active = { v, t: 0, face: v === 'slam' ? 0 : v === 'lurk' ? 1 : Math.floor(this.count / 3) % 2, x: 0.25 + Math.random() * 0.5, fired: new Set() };
    return true;
  }

  /** Drawn over the finished frame. */
  draw(g: CanvasRenderingContext2D) {
    const a = this.active; if (!a || !this.faces.length) return;
    const t = a.t, D = DUR[a.v], face = this.faces[a.face % this.faces.length];
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const black = (al: number) => { g.globalAlpha = al; g.fillStyle = '#010602'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; };
    const shake = (k: number) => g.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);

    if (a.v === 'slam') {
      black(1);
      if (t > 0.07 && t < D - 0.1) {
        const k = Math.min(1, (t - 0.07) / 0.22), zoom = 1.55 - 0.5 * (1 - (1 - k) ** 3);
        shake(26 * (1 - k) + 5);
        this.face(g, face, zoom, 0.5);
        if (Math.floor(t * 30) % 7 === 0) this.invert(g);
      }
      this.statik(g, t < 0.07 || t > D - 0.1 ? 0.9 : 0.18);
    } else if (a.v === 'lurk') {
      // the light dies… two eyes in the dark… then it lunges
      black(Math.min(1, t / 0.25) * 0.97);
      if (t > 0.3 && t < 0.52) {
        const k = (t - 0.3) / 0.22;
        g.globalAlpha = 0.35 + 0.65 * k; this.face(g, face, 0.32 + 0.08 * k, a.x, true); g.globalAlpha = 1;
        black(0.55 * (1 - k));
      } else if (t >= 0.52 && t < D - 0.08) {
        const k = Math.min(1, (t - 0.52) / 0.12);
        shake(22 * (1 - k) + 6);
        this.face(g, face, 0.4 + 0.95 * k * k, 0.5 + (a.x - 0.5) * (1 - k));
        if (Math.floor(t * 24) % 5 === 0) this.invert(g);
        this.statik(g, 0.15);
      }
    } else {
      // strobe: black / face / static, faster and faster, then both faces at once
      black(1);
      const rate = 9 + t * 22, on = Math.floor(t * rate) % 2 === 0;
      if (t < 0.62) { if (on) { shake(8); this.face(g, this.faces[Math.floor(t * rate) % this.faces.length], 1.05, 0.5); } this.statik(g, on ? 0.2 : 0.75); }
      else if (t < D - 0.06) { shake(18); this.face(g, face, 1.25 + (t - 0.62) * 0.6, 0.5); this.invert(g, 0.5); this.statik(g, 0.12); }
      else this.statik(g, 1);
    }

    // VHS treatment over everything: torn bands, scanlines, vignette
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 3; i++) if (Math.random() < 0.55) {
      const y0 = Math.floor(Math.random() * (H - 40)), hh = 6 + Math.floor(Math.random() * 34);
      g.drawImage(g.canvas, 0, y0, W, hh, Math.floor((Math.random() * 2 - 1) * 46), y0, W, hh);
    }
    g.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
  }

  /** A face, scaled so `zoom` = 1 fills the screen height, centred on its eyes; `ghost` adds glowing eye bloom. */
  private face(g: CanvasRenderingContext2D, f: Face, zoom: number, cx: number, ghost = false) {
    const h = H * 1.25 * zoom, w = (f.img.width / f.img.height) * h;
    const x = W * cx - w / 2, y = H * 0.45 - f.focusY * h;
    g.imageSmoothingEnabled = false;
    g.drawImage(f.img, x, y, w, h);
    // ghosted double (chromatic smear in green): a second copy, offset, added on top
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = ghost ? 0.5 : 0.22;
    g.drawImage(f.img, x + 7, y - 2, w, h);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
  }
  /** A hard flash frame (kept inside GREEN's palette: a burst of pale green light, not a colour inversion). */
  private invert(g: CanvasRenderingContext2D, al = 1) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.6 * al; g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgb(90,200,120)'; g.fillRect(0, 0, W, H); g.restore();
  }
  private statik(g: CanvasRenderingContext2D, density: number) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const n = Math.floor(2600 * density);
    for (let i = 0; i < n; i++) {
      const v = Math.random(); g.fillStyle = v < 0.5 ? '#020a03' : v < 0.85 ? '#3c9a55' : '#d8ffe0';
      g.fillRect(Math.floor(Math.random() * W / 3) * 3, Math.floor(Math.random() * H / 3) * 3, 3, 3);
    }
    g.restore();
  }
}
