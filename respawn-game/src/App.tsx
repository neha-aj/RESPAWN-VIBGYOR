import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './audio';
import { LetterReveal } from './LetterReveal';
import { LogoIntro } from './LogoIntro';
import { StudioSplash } from './Studio';
import { BootScreen, DisplayCheck, EndScreen, FallenOverlay, MainMenu, RespawnCard, RulesCard, StoppedScreen } from './Menu';
import { checkDisplay, type IrisStage } from './display';
import { music } from './music';
import {
  chapterIndex, CHAPTERS, CHECKPOINTS, INTRO_SKIP_AFTER, INTRO_VIDEO, OUTRO_VIDEO, reachedBy, respawnAt, startChapter, type LevelId,
} from './sequence';
import { settings } from './settings';
import { sfx } from './sfx';
import { Bloom, ContinueHint, Iris, SpectrumCard, VideoPlayer } from './Transitions';

/*
 * RESPAWN: the whole game, start to finish.
 *
 *   PRESS ANY KEY ─► SNaP studios ─► intro video (skip after 5 s) ─► logo: Thanos's torch finds V I B G Y O R
 *   ─► main menu (START · SETTINGS · HOW IT WORKS · STOP, with the roadmap) ─► the rules card
 *   ─► BnW ─► for each colour: spectrum card ─► torch clip into its letter ─► the level
 *   ─► after RED: the strip lights up ─► outro + credits video (yours, when added) ─► menu
 *
 * Each level runs in its own iframe and posts { type: 'respawn:complete' } when won and
 * { type: 'respawn:death' } when lost (its Game Over). On HARD a death sends Thanos back to the last
 * checkpoint reached (see sequence.ts). On EASY there are no checkpoints: a death restarts that very
 * level, and the player may instead skip on to the next one. `?chapter=<id>` jumps straight into a level.
 */

/**
 * A level that loaded hidden (behind a cutscene) could not take focus, so its React
 * `autoFocus` (e.g. the START button) silently did nothing. Once the level is revealed,
 * focus that element so ENTER works as it does when the level runs on its own.
 */
function restoreAutofocus(doc: Document | null | undefined) {
  if (!doc || (doc.activeElement && doc.activeElement !== doc.body)) return;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('button, input, [tabindex]'))) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactProps'));
    const props = key ? (el as unknown as Record<string, { autoFocus?: boolean }>)[key] : null;
    if (props?.autoFocus) { el.focus(); return; }
  }
}

/** A video you have added (served as a video, not the page's fallback HTML). */
async function videoExists(url: string) {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok && (r.headers.get('content-type') ?? '').startsWith('video'); }
  catch { return false; }
}

type Signal = 'complete' | 'death' | 'retry' | 'skip' | 'checkGo' | 'checkRetry' | 'continue' | 'videoEnd' | 'boot' | 'studioDone' | 'logoDone' | 'start' | 'stop' | 'rulesGo' | 'back' | 'endMenu';
type Scene = 'boot' | 'studio' | 'logo' | 'menu' | 'rules' | 'check' | 'stopped' | 'end' | null;
const CANCEL = Symbol('cancel');

interface IrisState { d: IrisStage; ms: number; color: string; ring: boolean }
const IRIS_OPEN: IrisStage = 'open', IRIS_PEEK: IrisStage = 'peek', IRIS_SHUT: IrisStage = 'shut';

export default function App() {
  const [scene, setScene] = useState<Scene>(null);
  const [level, setLevel] = useState<{ idx: number; visible: boolean; run: number } | null>(null);
  const [iris, setIris] = useState<IrisState | null>({ d: IRIS_SHUT, ms: 0, color: '#fff', ring: false });
  const [won, setWon] = useState<{ hold: number; color: string } | null>(null);
  const [fallen, setFallen] = useState<{ back: LevelId; show: boolean; easy: boolean; next: string | null } | null>(null);
  const [check, setCheck] = useState<string[]>([]);
  const [card, setCard] = useState<{ band: number; leaving: boolean; finale?: boolean } | null>(null);
  const [reveal, setReveal] = useState<{ band: number; key: number; fading: boolean } | null>(null);
  const [respawn, setRespawn] = useState<{ band: number; leaving: boolean } | null>(null);
  const [video, setVideo] = useState<{ src: string; color: string; key: number; fading: boolean; skipAfter?: number } | null>(null);
  const [bloom, setBloom] = useState<{ color: string; key: number } | null>(null);
  const [crt, setCrt] = useState(settings.get().crt);
  useEffect(() => settings.subscribe((s) => setCrt(s.crt)), []);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);

  /* ---------- signals: latched, so one that fires early is not lost ---------- */
  const latched = useRef(new Set<Signal>());
  const waiter = useRef<{ kinds: Signal[]; resolve: (k: Signal) => void } | null>(null);
  const signal = useCallback((kind: Signal) => {
    const w = waiter.current;
    if (w && w.kinds.includes(kind)) { waiter.current = null; w.resolve(kind); }
    else latched.current.add(kind);
  }, []);
  const continueFrom = useRef(0);   // input on the victory hold only counts after this time

  // a level reports a win or a loss
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.source || e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === 'respawn:complete') signal('complete');
      else if (e.data?.type === 'respawn:death') signal('death');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [signal]);

  // ENTER / SPACE / click moves on from a victory hold
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!won || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (performance.now() >= continueFrom.current) signal('continue');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [won, signal]);

  /* ---------- the director ---------- */
  useEffect(() => {
    let alive = true, runs = 0;
    const sleep = (ms: number) => new Promise<void>((res, rej) => setTimeout(() => (alive ? res() : rej(CANCEL)), ms));
    const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const waitAny = (kinds: Signal[], timeoutMs?: number) => new Promise<Signal>((res, rej) => {
      const done = (k: Signal) => (alive ? res(k) : rej(CANCEL));
      const early = kinds.find((k) => latched.current.delete(k));
      if (early) return done(early);
      waiter.current = { kinds, resolve: done };
      if (timeoutMs) setTimeout(() => { if (waiter.current?.kinds === kinds) { waiter.current = null; done(kinds[0]); } }, timeoutMs);
    });
    const waitFor = (kind: Signal, timeoutMs?: number) => waitAny([kind], timeoutMs);
    const clear = (...kinds: Signal[]) => kinds.forEach((k) => latched.current.delete(k));

    const focusLevel = () => {
      const f = frameRef.current; f?.focus(); f?.contentWindow?.focus();
      try { restoreAutofocus(f?.contentDocument); } catch { /* not ready: the player can still click */ }
    };

    async function openOnto(color: string, ms: number) {
      setIris({ d: IRIS_SHUT, ms: 0, color, ring: true });
      await nextFrame();
      sfx.irisOpen();
      setIris({ d: IRIS_OPEN, ms, color, ring: true });
      await sleep(ms + 60);
      setIris(null);
    }

    async function closeOn(color: string) {
      setIris({ d: IRIS_OPEN, ms: 0, color, ring: true });
      await nextFrame();
      sfx.irisClose();
      setIris({ d: IRIS_PEEK, ms: 720, color, ring: true });   // close to a pinhole…
      await sleep(720 + 380);                                    // …hold a beat…
      setIris({ d: IRIS_SHUT, ms: 260, color, ring: true });     // …and shut
      await sleep(300);
      setIris({ d: IRIS_SHUT, ms: 0, color, ring: false });
    }

    async function playVideo(src: string, color: string, skipAfter?: number) {
      clear('videoEnd');
      setVideo({ src, color, key: Date.now(), fading: false, skipAfter });
      await waitFor('videoEnd');
      setVideo((v) => v && { ...v, fading: true });
      await sleep(480);
      setVideo(null);
    }

    /** One chapter. Returns how it ended. `back` is where a death would send Thanos. */
    async function playChapter(i: number, first: boolean, respawning: boolean, back: LevelId, easy: boolean): Promise<'complete' | 'death' | 'skip'> {
      const ch = CHAPTERS[i], run = ++runs;
      clear('complete', 'death');

      if (respawning && ch.band !== null) {
        // back at a checkpoint: a short RESPAWN card while the level loads behind it
        setRespawn({ band: ch.band, leaving: false });
        setLevel({ idx: i, visible: false, run });
        await sleep(300); sfx.respawn(ch.band);
        await sleep(2300);
        setRespawn({ band: ch.band, leaving: true });
        await sleep(500); setRespawn(null);
        setLevel({ idx: i, visible: true, run });
        setBloom({ color: ch.color, key: run });
        await openOnto(ch.color, 1150);
      } else if (ch.band !== null) {
        // spectrum card: the new colour ignites
        setCard({ band: ch.band, leaving: false });
        await sleep(500); sfx.ignite(ch.band);
        await sleep(1950);
        // the torch clip into its letter, with the level loading (hidden) behind it
        clear('videoEnd');
        setLevel({ idx: i, visible: false, run });
        setReveal({ band: ch.band, key: run, fading: false });
        setCard({ band: ch.band, leaving: true });
        await sleep(650); setCard(null);
        await waitFor('videoEnd');
        setReveal((v) => v && { ...v, fading: true });
        await sleep(480);
        setReveal(null);
        setLevel({ idx: i, visible: true, run });
        setBloom({ color: ch.color, key: run });
        await openOnto(ch.color, 1150);
      } else {
        setLevel({ idx: i, visible: false, run });
        await sleep(first ? 700 : 350);   // give the page a moment to paint before the reveal
        setLevel({ idx: i, visible: true, run });
        await openOnto(ch.color, first ? 1400 : 1150);
      }
      focusLevel();

      const how = await waitAny(['complete', 'death']);
      if (how === 'death') {
        // the level's own Game Over shows for a moment; the shield keeps its retry buttons and keys away
        const next = CHAPTERS[i + 1]?.name ?? null;
        setFallen({ back, show: false, easy, next });
        await nextFrame();
        shieldRef.current?.focus();
        await sleep(1300);
        clear('retry', 'skip');
        setFallen({ back, show: true, easy, next }); sfx.fallen();
        let pick: 'death' | 'skip' = 'death';
        if (easy) pick = (await waitAny(['retry', 'skip'])) === 'skip' ? 'skip' : 'death';   // EASY: the player chooses
        else await sleep(2900);
        await closeOn('#FF1E2D');
        setFallen(null);
        setLevel(null);
        await sleep(260);
        return pick;
      }
      // hold on the level's own victory screen; the shield stops clicks reaching its buttons
      continueFrom.current = performance.now() + 1200;
      clear('continue');
      setWon({ hold: ch.hold, color: ch.color });
      await nextFrame();
      shieldRef.current?.focus();
      await waitFor('continue', ch.hold);
      setWon(null);
      await closeOn(ch.color);
      setLevel(null);
      await sleep(260);
      return 'complete';
    }

    /** BnW and the seven colours (HARD: with checkpoints; EASY: retry or skip), then the finale. */
    async function run(start: number) {
      const easy = settings.get().difficulty === 'easy';   // fixed for the whole run
      let reached = reachedBy(start - 1), respawning = false, first = true;
      for (let i = start; i < CHAPTERS.length;) {
        // HARD: a checkpoint is yours the moment you arrive at it
        if (CHECKPOINTS.includes(CHAPTERS[i].id)) reached = CHAPTERS[i].id;
        const how = await playChapter(i, first, respawning, easy ? CHAPTERS[i].id : respawnAt(reached), easy);
        first = false;
        if (how === 'death') { if (!easy) i = chapterIndex(respawnAt(reached)); respawning = true; continue; }   // EASY: same level again
        respawning = false; i++;   // won it, or (EASY) chose to skip it
      }
      // Every colour is back: the full strip lights up and rings out…
      setCard({ band: 6, leaving: false, finale: true });
      await sleep(400); sfx.spectrumComplete();
      await sleep(3800);
      // …then your outro + credits, if it is there
      if (await videoExists(OUTRO_VIDEO)) {
        setCard((c) => c && { ...c, leaving: true }); await sleep(600); setCard(null);
        await playVideo(OUTRO_VIDEO, '#ffffff');
      }
      clear('endMenu');
      setScene('end');
      setCard(null);
      await waitFor('endMenu');
    }

    (async () => {
      const jump = startChapter();
      if (jump !== null) { await run(jump); }
      else {
        setScene('boot');
        await waitFor('boot');
        clear('studioDone'); setScene('studio');
        await waitFor('studioDone');
        setScene(null);
        if (await videoExists(INTRO_VIDEO)) await playVideo(INTRO_VIDEO, '#ffffff', INTRO_SKIP_AFTER);
        setScene('logo');
        await waitFor('logoDone');
      }
      for (;;) {
        music.ensureTheme();
        clear('start', 'stop');
        setScene('menu');
        const pick = await waitAny(['start', 'stop']);
        if (pick === 'stop') {
          music.stop(0.8);
          clear('back'); setScene('stopped');
          await waitFor('back');
          continue;
        }
        clear('rulesGo'); setScene('rules');
        await waitFor('rulesGo');
        // the display check, before every game: the circle wipe and the window must be sound
        for (;;) {
          const issues = await checkDisplay();
          if (!issues.length) break;
          setCheck(issues); clear('checkGo', 'checkRetry'); setScene('check');
          if ((await waitAny(['checkGo', 'checkRetry'])) === 'checkGo') break;
        }
        music.stop(1.8);
        setIris({ d: IRIS_SHUT, ms: 0, color: '#fff', ring: false });
        setScene(null);
        await sleep(500);
        await run(0);
      }
    })().catch((e) => { if (e !== CANCEL) console.error(e); });

    return () => { alive = false; waiter.current = null; };
  }, []);

  const ch = level ? CHAPTERS[level.idx] : null;
  const shellScene = scene === 'studio' || scene === 'menu' || scene === 'rules' || scene === 'check' || scene === 'boot' || scene === 'stopped' || scene === 'end' || !!card || !!respawn;

  return (
    <div className="stage">
      {ch && (
        <iframe key={`${ch.id}-${level!.run}`} ref={frameRef} src={ch.src} title={ch.name} className="level" allow="autoplay; fullscreen"
          style={{ visibility: level!.visible ? 'visible' : 'hidden' }} />
      )}

      {won && (
        <div ref={shieldRef} tabIndex={-1} className="shield" onClick={() => { if (performance.now() >= continueFrom.current) signal('continue'); }}>
          <ContinueHint hold={won.hold} color={won.color} />
        </div>
      )}
      {fallen && (
        <div ref={shieldRef} tabIndex={-1} className={`shield death${fallen.show ? ' show' : ''}`}>
          {fallen.show && <FallenOverlay back={fallen.back} easy={fallen.easy} next={fallen.next} onRetry={() => signal('retry')} onSkip={() => signal('skip')} />}
        </div>
      )}

      {iris && <Iris stage={iris.d} ms={iris.ms} color={iris.color} ring={iris.ring} />}

      {video && (
        <VideoPlayer key={video.key} src={video.src} color={video.color} fading={video.fading} skipAfter={video.skipAfter} onEnd={() => signal('videoEnd')} />
      )}
      {reveal && <LetterReveal key={reveal.key} band={reveal.band} fading={reveal.fading} onEnd={() => signal('videoEnd')} />}

      {card && <SpectrumCard band={card.band} leaving={card.leaving} finale={card.finale} />}
      {respawn && <div className={`respawn-wrap${respawn.leaving ? ' leaving' : ''}`}><RespawnCard band={respawn.band} /></div>}

      {bloom && <Bloom key={bloom.key} color={bloom.color} onDone={() => setBloom(null)} />}

      {scene === 'boot' && <BootScreen onGo={() => { audio.get(); signal('boot'); }} />}
      {scene === 'studio' && <StudioSplash onDone={() => signal('studioDone')} />}
      {scene === 'logo' && <LogoIntro onDone={() => signal('logoDone')} />}
      {scene === 'menu' && <MainMenu onStart={() => signal('start')} onStop={() => signal('stop')} />}
      {scene === 'rules' && <RulesCard onGo={() => signal('rulesGo')} />}
      {scene === 'check' && <DisplayCheck issues={check} onGo={() => signal('checkGo')} onRetry={() => signal('checkRetry')} />}
      {scene === 'stopped' && <StoppedScreen onBack={() => signal('back')} />}
      {scene === 'end' && <EndScreen onMenu={() => signal('endMenu')} />}

      {crt && shellScene && <div className="crt" aria-hidden />}
    </div>
  );
}
