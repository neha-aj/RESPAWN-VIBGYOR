/* Builds every web level and copies it into public/levels/<id>/. Run from respawn-game/:
 *   npm run levels
 *
 *   --skip-build     only copy existing dist/ folders (faster when nothing changed)
 *
 * Each copied index.html gets the sound bridge (public/respawn-audio.js) first in its <head>,
 * so the menu's SOUND / MASTER VOLUME settings reach the level.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shell = resolve(here, '..');
const repo = resolve(shell, '..');

const LEVELS = {
  violet: 'level3-violet-web',
  indigo: 'level4-indigo-web',
  blue: 'level2-blue',
  green: 'level5-green-web',
  yellow: 'level8-yellow-web',
  orange: 'level6-orange-web',
  red: 'level7-red-web',
};
const skipBuild = process.argv.includes('--skip-build');

for (const [id, folder] of Object.entries(LEVELS)) {
  const dir = join(repo, folder);
  if (!skipBuild) {
    if (!existsSync(join(dir, 'node_modules'))) {
      console.log(`[${id}] installing dependencies…`);
      execSync('npm install --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
    }
    console.log(`[${id}] building ${folder}…`);
    execSync('npm run build', { cwd: dir, stdio: 'inherit' });
  }
  const out = join(shell, 'public', 'levels', id);
  rmSync(out, { recursive: true, force: true });
  cpSync(join(dir, 'dist'), out, { recursive: true });
  const page = join(out, 'index.html');
  writeFileSync(page, readFileSync(page, 'utf8').replace('<head>', '<head>\n    <script src="../../respawn-audio.js"></script>'));
  console.log(`[${id}] → public/levels/${id}`);
}

console.log(`done: ${readdirSync(join(shell, 'public', 'levels')).length} levels ready`);
