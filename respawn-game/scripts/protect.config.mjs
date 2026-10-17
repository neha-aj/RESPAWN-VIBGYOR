/* Settings for the release protection step (scripts/protect.mjs).
 *
 * HOSTS: the only websites the protected game is allowed to run on. A copy hosted anywhere else
 * (somebody re-uploading the files) shows a blocked page that sends the player to HOME_URL.
 * localhost / 127.0.0.1 are always allowed so PLAY.bat and `npm run preview` keep working.
 * If you move to your own domain, add it here (e.g. 'vibgyor.com') and run `npm run deploy` again.
 */
export const HOSTS = ['vibgyor-mobile.vercel.app'];
export const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
export const HOME_URL = 'https://vibgyor-mobile.vercel.app';

/* Writes dist/middleware.js (a Vercel edge check that refuses other websites hotlinking your files
 * and stops levels being opened outside the game). Set false for a plain static deploy. */
export const SERVER_GATE = true;
