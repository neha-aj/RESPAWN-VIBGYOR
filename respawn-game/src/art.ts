/* Shared art for the shell's cutscenes: the VIBGYOR picture (public/img/vibgyor.webp),
 * where each of its seven panels sits, a pixel-art Thanos with a torch, and the torchlight. */

export const PIC_W = 1600, PIC_H = 900;
export const PIC_URL = 'img/vibgyor.webp';

/** The seven panels of the picture, in picture pixels: art column x0..x1, and the letter's centre. */
export const PANELS = [
  { x0: 0, x1: 244, lx: 124 },      // V
  { x0: 258, x1: 479, lx: 362 },    // I
  { x0: 494, x1: 690, lx: 595 },    // B
  { x0: 704, x1: 900, lx: 800 },    // G
  { x0: 917, x1: 1112, lx: 1012 },  // Y
  { x0: 1128, x1: 1346, lx: 1237 }, // O
  { x0: 1363, x1: 1600, lx: 1471 }, // R
] as const;
export const LETTER_Y = 706;        // centre of the letter + its little emblem
export const ART_BOTTOM = 620;      // the panels' artwork ends here; the letters sit below

let pic: HTMLImageElement | null = null;
const waiting: (() => void)[] = [];
/** The picture, loaded once; resolves immediately once it is cached. */
export function loadPicture(): Promise<HTMLImageElement> {
  if (pic?.complete && pic.naturalWidth) return Promise.resolve(pic);
  return new Promise((res) => {
    waiting.push(() => res(pic!));
    if (pic) return;
    pic = new Image(); pic.decoding = 'async';
    const done = () => waiting.splice(0).forEach((f) => f());
    pic.onload = done; pic.onerror = done;
    pic.src = PIC_URL;
  });
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A soft light: an additive radial glow. */
export function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  if (alpha <= 0.002 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha; g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}

/* ---------------------------------------------------------------------------------------
 * Pixel Thanos (side view, facing right), drawn into a small sprite canvas at 1 px per
 * sprite pixel; the caller blows it up with smoothing off so the pixels stay hard.
 *   walk   0..1 phase of the walk cycle (NaN = standing)
 *   arm    angle of the torch arm from straight down (0) to forward (π/2) and up (> π/2)
 * Returns where the flame is, in sprite pixels.
 * ------------------------------------------------------------------------------------- */
export const SPRITE_W = 76, SPRITE_H = 104, SPRITE_FOOT = { x: 24, y: 100 };
const COL = {
  ink: '#120a1c', skin: '#8a63b8', skinD: '#5d3f86', skinL: '#a985d6',
  gold: '#e3a92c', goldD: '#9c6b16', goldL: '#ffe07a', suit: '#2f4ca6', suitD: '#1d2f6e', suitL: '#4a6fd0',
  eye: '#dff3ff', wood: '#6b4423', woodD: '#45291a', stone: '#ff3b6b',
};

function px(g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
/** A thick pixel line (limbs). */
function limb(g: CanvasRenderingContext2D, c: string, x0: number, y0: number, x1: number, y1: number, w: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; px(g, c, x - w / 2, y - w / 2, w, w); }
}

export function drawThanos(g: CanvasRenderingContext2D, walk: number, arm: number, t: number, flame = 1): { x: number; y: number } {
  g.clearRect(0, 0, SPRITE_W, SPRITE_H);
  const F = SPRITE_FOOT, moving = !Number.isNaN(walk);
  const ph = moving ? walk * TAU : 0, bob = moving ? Math.round(Math.abs(Math.sin(ph)) * 2) : Math.round(Math.sin(t * 2) * 0.6);
  const x = F.x, y = F.y - bob;
  // legs (back one darker), knees bend with the stride
  const sw = moving ? Math.sin(ph) * 7 : 0;
  for (const [s, c, b] of [[-1, COL.suitD, COL.goldD], [1, COL.suit, COL.gold]] as const) {
    const fx = x + s * sw * 0.9, hipX = x + s * 1.5;
    limb(g, c, hipX, y - 30, (hipX + fx) / 2 + 1, y - 16, 6);
    limb(g, c, (hipX + fx) / 2 + 1, y - 16, fx, y - 5, 6);
    px(g, b, fx - 3, y - 6, 9, 4); px(g, COL.ink, fx - 3, y - 2, 9, 2);              // gold boot
  }
  // back arm (with the gauntlet), swinging against the stride
  const ba = moving ? -Math.sin(ph) * 0.6 : 0.1;
  const bsx = x - 6, bsy = y - 50, bex = bsx + Math.sin(ba) * 10, bey = bsy + Math.cos(ba) * 10, bhx = bex + Math.sin(ba) * 9, bhy = bey + Math.cos(ba) * 9;
  limb(g, COL.skinD, bsx, bsy, bex, bey, 5); limb(g, COL.goldD, bex, bey, bhx, bhy, 6);
  px(g, COL.stone, bhx - 1, bhy - 1, 2, 2);
  // torso: armour over the suit
  px(g, COL.ink, x - 11, y - 55, 22, 27);
  px(g, COL.suit, x - 10, y - 54, 20, 25);
  px(g, COL.suitL, x + 6, y - 54, 4, 25);
  px(g, COL.gold, x - 10, y - 54, 20, 6); px(g, COL.goldL, x - 9, y - 54, 18, 1);   // chest plate
  for (let i = 0; i < 3; i++) px(g, COL.goldD, x - 7, y - 46 + i * 5, 14, 2);        // ribbed belly armour
  px(g, COL.gold, x - 11, y - 31, 22, 4); px(g, COL.goldD, x - 11, y - 28, 22, 1);   // belt
  // shoulder pads
  px(g, COL.ink, x - 15, y - 58, 30, 8); px(g, COL.gold, x - 14, y - 57, 28, 6); px(g, COL.goldL, x - 13, y - 57, 26, 1); px(g, COL.goldD, x - 14, y - 52, 28, 1);
  // neck + head
  px(g, COL.skinD, x - 3, y - 62, 9, 5);
  const hx = x - 2, hy = y - 78;                                                       // head box 16×16
  px(g, COL.ink, hx - 1, hy - 1, 18, 18);
  px(g, COL.skin, hx, hy + 2, 16, 14);
  px(g, COL.skinL, hx + 10, hy + 4, 5, 3);
  // the famous chin: jutting forward, with its grooves
  px(g, COL.ink, hx + 8, hy + 11, 10, 7); px(g, COL.skin, hx + 9, hy + 11, 8, 6);
  for (let i = 0; i < 3; i++) px(g, COL.skinD, hx + 10 + i * 2, hy + 12, 1, 4);
  px(g, COL.skinD, hx + 9, hy + 10, 6, 1);                                             // mouth line
  // helmet: gold cap with a crest, back plate and a cheek guard
  px(g, COL.ink, hx - 2, hy - 3, 19, 8); px(g, COL.gold, hx - 1, hy - 2, 17, 6); px(g, COL.goldL, hx, hy - 2, 14, 1);
  px(g, COL.goldD, hx - 1, hy + 3, 6, 11); px(g, COL.gold, hx, hy + 3, 4, 10);
  px(g, COL.ink, hx + 6, hy - 6, 4, 4); px(g, COL.gold, hx + 7, hy - 5, 2, 3);          // crest
  // brow + glowing eye
  px(g, COL.ink, hx + 9, hy + 5, 7, 1);
  px(g, COL.eye, hx + 12, hy + 6, 3, 2);
  // front arm holding the torch
  const sx = x + 7, sy = y - 51, L1 = 11, L2 = 10;
  const ex = sx + Math.sin(arm) * L1, ey = sy + Math.cos(arm) * L1;
  const a2 = arm + 0.35, hx2 = ex + Math.sin(a2) * L2, hy2 = ey + Math.cos(a2) * L2;
  limb(g, COL.skin, sx, sy, ex, ey, 5); limb(g, COL.skin, ex, ey, hx2, hy2, 5);
  px(g, COL.skinL, hx2 - 2, hy2 - 2, 4, 4);
  // torch: a stick held upright-ish, tilted with the arm
  const ta = a2 + 0.8, tx = hx2 + Math.sin(ta) * 13, ty = hy2 + Math.cos(ta) * 13;
  limb(g, COL.woodD, hx2, hy2, tx, ty, 3); limb(g, COL.wood, hx2, hy2 - 1, tx, ty - 1, 1);
  px(g, '#3a3a3a', tx - 2, ty - 2, 4, 3);
  if (flame > 0) {
    const fl = (k: number) => Math.round(Math.sin(t * 17 + k * 2.1) * 1.2 + Math.sin(t * 9.3 + k) * 0.8);
    const fh = Math.round(10 * flame);
    for (let i = 0; i < fh; i++) {
      const w = Math.max(1, Math.round((fh - i) * 0.6)), cx = tx + fl(i) * (i / fh);
      px(g, i < fh * 0.35 ? '#ff6a1a' : i < fh * 0.7 ? '#ffb02e' : '#fff3b0', cx - w / 2, ty - 3 - i, w, 1);
    }
    px(g, '#fffbe6', tx - 1, ty - 4, 2, 2);
  }
  return { x: tx, y: ty - 5 };
}
