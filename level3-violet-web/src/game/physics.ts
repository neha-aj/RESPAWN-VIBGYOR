/* ============================================================================
   Bullet physics — a direct port of the Python Projectile.step():
   gravity, sub-stepped motion, specular ricochets (invert vx on vertical
   surfaces, vy on horizontal ones), transformation fields, targets, door.
   ============================================================================ */
import { BULLET_SPEED, DOOR_RECT, FIELDS, GRAVITY, MAX_BOUNCES, SOLIDS, H, W, type Rect } from './config';

export interface V2 { x: number; y: number }
export const inside = (r: Rect, x: number, y: number) => r.x <= x && x < r.x + r.w && r.y <= y && y < r.y + r.h;
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Transformation zone applied to the velocity vector on entry. */
export class Field {
  flash = 0;
  constructor(readonly kind: 'scale' | 'reflect', readonly rect: Rect) {}
  apply(v: V2) {
    if (this.kind === 'scale') { v.x *= 1.6; v.y *= 1.6; }   // [[1.6,0],[0,1.6]]
    else v.y = -v.y;                                          // [[1,0],[0,-1]]
  }
}

export class Door { unlocked = false; hit = false; constructor(readonly rect: Rect) {} }
export interface Target { alive: boolean; pos: V2; radius: number }

export class World {
  solids: Rect[] = SOLIDS.map((r) => ({ ...r }));
  fields = FIELDS.map((f) => new Field(f.kind, { ...f.rect }));
  door = new Door({ ...DOOR_RECT });
  enemies: Target[] = [];
  solidAt(x: number, y: number) {
    if (this.solids.some((r) => inside(r, x, y))) return true;
    return !this.door.unlocked && inside(this.door.rect, x, y);   // a locked door is armour
  }
}

export type Ev =
  | { t: 'bounce'; p: V2 } | { t: 'spark'; p: V2 } | { t: 'field'; p: V2; kind: 'scale' | 'reflect' }
  | { t: 'kill'; e: Target } | { t: 'door'; p: V2 } | { t: 'fizzle'; p: V2 };

export class Projectile {
  pos: V2; vel: V2; alive = true; bounces = 0; age = 0;
  trail: V2[] = [];
  inside = new Set<Field>();
  used = new Set<'scale' | 'reflect'>();
  constructor(pos: V2, vel: V2, readonly enemy = false) { this.pos = { ...pos }; this.vel = { ...vel }; }

  /** Advance one frame scaled by ts (slow-motion uses ts < 1). */
  step(world: World, ts = 1): Ev[] {
    const ev: Ev[] = [];
    if (!this.enemy) this.vel.y += GRAVITY * ts;
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y)) * ts) / 3));
    for (let k = 0; k < n; k++) {
      const dx = (this.vel.x * ts) / n, dy = (this.vel.y * ts) / n;
      if (world.solidAt(this.pos.x + dx, this.pos.y)) {
        if (this.enemy) { this.alive = false; ev.push({ t: 'spark', p: { ...this.pos } }); return ev; }
        this.vel.x = -this.vel.x; this.bounces++; ev.push({ t: 'bounce', p: { ...this.pos } });
      } else this.pos.x += dx;
      if (world.solidAt(this.pos.x, this.pos.y + dy)) {
        if (this.enemy) { this.alive = false; ev.push({ t: 'spark', p: { ...this.pos } }); return ev; }
        this.vel.y = -this.vel.y; this.bounces++; ev.push({ t: 'bounce', p: { ...this.pos } });
      } else this.pos.y += dy;
      if (this.enemy) continue;
      for (const f of world.fields) {
        const now = inside(f.rect, this.pos.x, this.pos.y);
        if (now && !this.inside.has(f)) { f.apply(this.vel); this.used.add(f.kind); ev.push({ t: 'field', p: { ...this.pos }, kind: f.kind }); }
        if (now) this.inside.add(f); else this.inside.delete(f);
      }
      for (const e of world.enemies) {
        if (e.alive && dist(this.pos, e.pos) < e.radius + 3) { this.alive = false; ev.push({ t: 'kill', e }); return ev; }
      }
      if (world.door.unlocked && inside(world.door.rect, this.pos.x, this.pos.y)) { this.alive = false; ev.push({ t: 'door', p: { ...this.pos } }); return ev; }
      if (this.bounces > MAX_BOUNCES) { this.alive = false; ev.push({ t: 'fizzle', p: { ...this.pos } }); return ev; }
    }
    this.age += ts;
    if (!(this.pos.x > -50 && this.pos.x < W + 50 && this.pos.y > -50 && this.pos.y < H + 50)) this.alive = false;
    return ev;
  }
}

/**
 * The launch angle that makes the bullet's gravity arc pass THROUGH the crosshair.
 * A bullet sags under gravity, so firing straight at the crosshair drops below it and the dotted
 * guide would never touch the circle. This solves for the (slightly raised) angle whose arc, using
 * exactly Projectile.step()'s per-frame gravity, reaches the crosshair's x at the crosshair's y.
 * `reach` is how far the muzzle sits from the shoulder along the aim. When the crosshair is out of
 * range (or no arc reaches it) it falls back to aiming straight at it.
 */
export function ballisticAim(shoulder: V2, target: V2, reach = 36, speed = BULLET_SPEED): number {
  const straight = Math.atan2(target.y - shoulder.y, target.x - shoulder.x);
  const d = Math.hypot(target.x - shoulder.x, target.y - shoulder.y);
  if (d < reach + 24 || d > 700) return straight;
  /** How far the arc passes below (+) / above (-) the target when it reaches the target's x; NaN if it never gets there. */
  const miss = (a: number) => {
    const c = Math.cos(a), s = Math.sin(a);
    const mx = shoulder.x + c * reach, my = shoulder.y + s * reach;
    const n = (target.x - mx) / (speed * c);               // frames to cover the horizontal distance
    if (!(n > 0) || n > 140) return NaN;
    return my + n * speed * s + (GRAVITY * n * (n + 1)) / 2 - target.y;   // y after n frames of Projectile.step()
  };
  let best: [number, number] | null = null;                 // the bracket nearest the straight line
  const up = target.x >= shoulder.x ? -1 : 1;               // raising the aim: a smaller angle facing right, a larger one facing left
  let prevA = straight - up * 0.05, prev = miss(prevA);
  for (let u = -0.04; u <= 1.3; u += 0.01) {
    const a = straight + up * u, m = miss(a);
    if (Number.isFinite(prev) && Number.isFinite(m) && (prev > 0) !== (m > 0)) { best = [a, prevA]; break; }
    prevA = a; prev = m;
  }
  if (!best) return straight;
  let [lo, hi] = best;
  const sLo = miss(lo) > 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, m = miss(mid);
    if (!Number.isFinite(m)) return straight;
    if ((m > 0) === sLo) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Dotted aiming guide: the gravity arc up to the first surface or field contact. */
export function predict(world: World, pos: V2, vel: V2, frames = 90): V2[] {
  const p = new Projectile(pos, vel), pts: V2[] = [];
  for (let f = 0; f < frames; f++) {
    const ev = p.step(world);
    if (f % 2 === 0) pts.push({ ...p.pos });
    if (ev.length || !p.alive) break;
  }
  return pts;
}
