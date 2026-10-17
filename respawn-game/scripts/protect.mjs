/* Release protection. Run from respawn-game/ AFTER a build:
 *   npm run build:release        (= build, then this)
 *   npm run deploy               (does it for you)
 *
 * What it does to dist/ (the folder that gets published):
 *   1. scrambles every JavaScript file (names, strings and structure become unreadable) and locks
 *      each one to your website, so a copy hosted anywhere else does not run
 *   2. adds the page guard (protect.js) to every page: only runs on your site, refuses to be
 *      embedded in someone else's, blocks right-click / View Source / dev-tools shortcuts
 *   3. deletes source maps
 *   4. writes vercel.json (security headers: no framing, no sniffing, no search indexing, HTTPS only)
 *      and middleware.js (a server-side check that refuses hotlinking and direct level access)
 * It refuses to run twice on the same dist/ (scrambling scrambled code would break it).
 */
import JavaScriptObfuscator from 'javascript-obfuscator';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_URL, HOSTS, LOCAL_HOSTS, SERVER_GATE } from './protect.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('protect: dist/index.html not found. Run `npm run build` first.'); process.exit(1); }
if (existsSync(join(dist, 'protect.js'))) { console.error('protect: dist/ is already protected. Run `npm run build` again for a fresh copy.'); process.exit(1); }

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// the page guard, filled in with your hosts
const guard = readFileSync(join(here, 'protect-client.js'), 'utf8')
  .replace('__HOSTS__', JSON.stringify([...HOSTS, ...LOCAL_HOSTS]))
  .replace('__HOME__', JSON.stringify(HOME_URL));
writeFileSync(join(dist, 'protect.js'), guard);

const OPTIONS = {
  compact: true,
  target: 'browser',
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,            // the pages and the sound bridge talk through globals
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  splitStrings: false,
  transformObjectKeys: false,      // keeps React props and the postMessage protocol intact
  controlFlowFlattening: false,    // would slow the game loops
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
  domainLock: [...HOSTS, ...LOCAL_HOSTS],
  domainLockRedirectUrl: HOME_URL,
};

const jsFiles = walk(dist).filter((f) => f.endsWith('.js'));
let before = 0, after = 0;
const t0 = Date.now();
for (const f of jsFiles) {
  const src = readFileSync(f, 'utf8');
  const opts = f.endsWith('protect.js') ? { ...OPTIONS, domainLock: [] } : OPTIONS;   // protect.js checks the host itself
  const out = JavaScriptObfuscator.obfuscate(src, opts).getObfuscatedCode();
  writeFileSync(f, out);
  before += src.length; after += out.length;
  console.log(`  scrambled ${relative(dist, f).split(sep).join('/')}  ${(src.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`);
}
console.log(`protect: ${jsFiles.length} scripts scrambled in ${((Date.now() - t0) / 1000).toFixed(1)}s (${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB)`);

// the guard goes first in every page
for (const f of walk(dist).filter((p) => p.endsWith('.html'))) {
  const depth = relative(dist, f).split(sep).length - 1;
  const tag = `<script src="${'../'.repeat(depth)}protect.js"></script>`;
  const html = readFileSync(f, 'utf8');
  if (!/<head[^>]*>/i.test(html)) throw new Error(`protect: no <head> in ${f}`);
  writeFileSync(f, html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${tag}`));
}

// no source maps
for (const f of walk(dist).filter((p) => p.endsWith('.map'))) rmSync(f);

// server side: security headers + the hotlink / direct-access gate
writeFileSync(join(dist, 'vercel.json'), JSON.stringify({
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ],
    },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
}, null, 2));

if (SERVER_GATE) {
  writeFileSync(join(dist, 'middleware.js'), `// Runs on Vercel's edge before a file is served. Fails open: if anything here throws, the file is served.
export const config = { matcher: ['/assets/:path*', '/levels/:path*', '/videos/:path*', '/img/:path*', '/bnw.html', '/protect.js', '/respawn-audio.js', '/respawn-touch.js'] };

const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export default function middleware(request) {
  try {
    const site = request.headers.get('sec-fetch-site');   // same-origin | same-site | cross-site | none
    const dest = request.headers.get('sec-fetch-dest');   // document | iframe | script | video | ...
    const { pathname } = new URL(request.url);
    // another website pulling our scripts, levels, pictures or videos
    if (site === 'cross-site') return new Response('Forbidden', { status: 403 });
    // a level or BnW opened on its own, outside the game (they only run inside the game's frame)
    if (dest === 'document' && (pathname.startsWith('/levels/') || pathname === '/bnw.html') && /(\\.html|\\/)$/.test(pathname)) {
      return Response.redirect(new URL('/', request.url), 302);
    }
  } catch (e) { /* fail open */ }
  return pass();
}
`);
}
console.log('protect: done. headers' + (SERVER_GATE ? ' + server gate' : '') + ' written.');
