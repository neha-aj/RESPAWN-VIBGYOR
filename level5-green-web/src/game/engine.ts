/* GreenEngine — fixed 60 Hz simulation, keyboard + mouse input, rendering, snapshot for the React screens. */
import type { GreenAudio } from './audio';
import { H, TIME_LIMIT, W } from './config';
import { FONT, Renderer } from './render';
import { Scares } from './scares';
import { GreenGame, type State } from './sim';

export interface Snapshot { state: State; cause: string; lives: number; runes: number; timeLeft: number; won: boolean }
const STEP = 1 / 60;

export class GreenEngine {
  readonly game: GreenGame;
  private r: Renderer; private raf = 0; private last = 0; private acc = 0; private sig = '';
  private mouse: { x: number; y: number } | null = null;
  private scares: Scares;
  constructor(private canvas: HTMLCanvasElement, private audio: GreenAudio, private onChange: (s: Snapshot) => void, private onMute: () => void) {
    canvas.width = W; canvas.height = H;
    this.game = new GreenGame((s, v) => audio.play(s, v));
    this.r = new Renderer(canvas.getContext('2d')!);
    this.scares = new Scares((s, v) => audio.play(s, v));
    void document.fonts?.load(`16px ${FONT}`).then(() => this.r.clearTextCache());
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true); window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouse);
    canvas.addEventListener('pointerdown', this.onTouch); canvas.addEventListener('pointermove', this.onTouch);
    canvas.addEventListener('pointerup', this.onTouchEnd); canvas.addEventListener('pointercancel', this.onTouchEnd);
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true); window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousemove', this.onMouse);
    this.canvas.removeEventListener('pointerdown', this.onTouch); this.canvas.removeEventListener('pointermove', this.onTouch);
    this.canvas.removeEventListener('pointerup', this.onTouchEnd); this.canvas.removeEventListener('pointercancel', this.onTouchEnd);
  }

  start() { this.audio.init(); this.audio.musicOn(); this.game.begin(); this.emit(true); }
  restart() { this.game.restart(); this.emit(true); }
  pause() { if (this.game.state === 'PLAYING') { this.game.state = 'PAUSED'; this.emit(true); } }
  resume() { if (this.game.state === 'PAUSED') { this.game.state = 'PLAYING'; this.last = performance.now(); this.emit(true); } }
  showRules(on: boolean) { if (this.game.state === 'TITLE' || this.game.state === 'RULES') { this.game.state = on ? 'RULES' : 'TITLE'; this.emit(true); } }

  private onBlur = () => Object.assign(this.game.ctrl, { up: false, down: false, left: false, right: false, sprint: false });
  private onMouse = (e: MouseEvent) => {
    if (this.touchAim || performance.now() - this.lastTouch < 800) return;   // a tap's emulated mousemove is not a mouse
    const b = this.canvas.getBoundingClientRect();
    this.mouse = { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H };
  };
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown', k = e.key.toLowerCase(), c = this.game.ctrl, st = this.game.state;
    const map: Record<string, keyof typeof c> = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'sprint' };
    if (k in map) { c[map[k]] = down; if (k.startsWith('arrow')) e.preventDefault(); return; }
    if (!down || e.repeat) return;
    if (k === 'enter') { if (st === 'TITLE') this.start(); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'r') this.restart();
    else if (k === 'h') { if (st === 'TITLE') this.showRules(true); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'p' || k === 'escape') { if (st === 'PLAYING') this.pause(); else if (st === 'PAUSED') this.resume(); else if (st === 'RULES') this.showRules(false); }
    else if (k === 'm') this.onMute();
  };

  /** Touch (phones, inside the full game): a finger on the forest aims like the cursor; lifted, the light follows the way Thanos walks. */
  private touchAim = false; private lastTouch = 0;
  private readonly coarse = !!window.matchMedia?.('(pointer: coarse)').matches;   // a phone: no cursor to aim with
  private onTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || (e.type === 'pointermove' && !this.touchAim)) return;
    this.touchAim = true; this.lastTouch = performance.now();
    const b = this.canvas.getBoundingClientRect();
    this.mouse = { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H };
  };
  private onTouchEnd = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.touchAim = false; this.lastTouch = performance.now(); this.mouse = null;
  };

  /** Mouse aim: the flashlight points from Thanos (on screen) toward the cursor. */
  private aim() {
    const g = this.game, cam = this.r.cam;
    if (this.coarse && !this.mouse && g.state === 'PLAYING' && g.player.moving) { g.player.aim = Math.atan2(g.player.vel.y, g.player.vel.x); return; }
    if (!this.mouse || g.state !== 'PLAYING') return;
    const dx = this.mouse.x + cam.x - g.player.pos.x, dy = this.mouse.y + cam.y - g.player.pos.y;
    if (dx * dx + dy * dy > 4) g.player.aim = Math.atan2(dy, dx);
  }

  frame = (now: number) => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0; this.last = now;
    this.aim();
    const scaring = this.scares.update(dt, this.game);   // the world holds still while a scare is on screen
    if (this.game.state !== 'PAUSED' && !scaring) {
      this.acc += dt; let n = 0;
      while (this.acc >= STEP && n < 8) { this.game.step(STEP); this.acc -= STEP; n++; }
      if (n === 8) this.acc = 0;
    }
    this.r.draw(this.game);
    this.scares.draw(this.canvas.getContext('2d')!);
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };
  private emit(force: boolean) {
    const g = this.game;
    const s: Snapshot = { state: g.state, cause: g.cause, lives: g.lives, runes: g.collected.size, timeLeft: Math.ceil(g.state === 'TITLE' ? TIME_LIMIT : g.timeLeft), won: g.state === 'VICTORY' && g.victoryT > 1.2 };
    const sig = JSON.stringify(s); if (force || sig !== this.sig) { this.sig = sig; this.onChange(s); }
  }
}
