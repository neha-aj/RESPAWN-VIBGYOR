/* Builds the full game and puts it live on Vercel (project "vibgyor"). Run from respawn-game/:
 *   npm run deploy
 *
 *   --levels     rebuild every level first (npm run levels), when a level's code has changed
 *
 * The first time on a computer, sign in once with `npx vercel login`. The project IDs below
 * are not secrets: they only say which Vercel project to deploy to, and your login still
 * decides whether you may.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERCEL_PROJECT = { VERCEL_ORG_ID: 'team_9VkKRu8RLFp9eU5Evya5cZOS', VERCEL_PROJECT_ID: 'prj_uGkBfZqYbuquoreiKc2G5PvdgEwy' };
const LEVELS = ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red'];

const shell = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, env) => execSync(cmd, { cwd: shell, stdio: 'inherit', env: { ...process.env, ...env } });

if (process.argv.includes('--levels')) run('npm run levels');
run('npm run build');

const missing = LEVELS.filter((id) => !existsSync(join(shell, 'dist', 'levels', id, 'index.html')));
if (missing.length) {
  console.error(`\nNot deploying: dist/levels is missing ${missing.join(', ')}. Run \`npm run deploy -- --levels\`.`);
  process.exit(1);
}

// Upload the built dist/ as-is (no build on Vercel's side) and make it the live site.
run('npx --yes vercel@64 deploy dist --prod --yes', VERCEL_PROJECT);
console.log('\nLive at https://vibgyor-ochre.vercel.app');
