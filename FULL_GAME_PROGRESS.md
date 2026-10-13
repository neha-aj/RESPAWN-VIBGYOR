# Full-game merge: progress / handoff notes

STATUS: IN PROGRESS

Branch: `full-game` (branched from `yellow`, which contains every level).
Commit after every step so nothing is lost.

## Goal (from Neha)
Merge every level into one continuous game, in this order:

1. VIBGYOR photo + catchy intro tune: WILL BE GIVEN LATER, leave a slot, don't build
2. game mp4 video: WILL BE GIVEN LATER, leave a slot, don't build
3. BnW game (`BnWGame.jsx`)
4. V.mp4, 5. VIOLET, 6. I.mp4, 7. INDIGO, 8. B.mp4, 9. BLUE, 10. G.mp4, 11. GREEN,
12. Y.mp4, 13. YELLOW, 14. O.mp4, 15. ORANGE, 16. R.mp4, 17. RED
18. Ending sequence: WILL BE GIVEN LATER, leave a slot, don't build

Videos live in `C:\Users\Neha AJ\Desktop\pravrutti 2.0\respawn infodeets\{V,I,B,G,Y,O,R}.mp4`.
Transitions between pieces must not be sudden: minimal but interesting, like famous 2D games.

## Design
- New Vite + React + TS shell in `respawn-game/`. Each level runs in an iframe
  (keeps each level's Tailwind, fonts, key listeners and audio isolated; removing the
  iframe tears the level down).
- Each level's `main.tsx` passes `onComplete` that posts
  `{ type: 'respawn:complete', level }` to `window.parent` (only when embedded).
  BLUE needed a new `onComplete` prop (fires on the final VictoryScreen).
  BnW uses its existing `onGameComplete`.
- `respawn-game/scripts/build-levels.mjs` builds every level and copies each `dist/`
  into `respawn-game/public/levels/<id>/`; videos are copied to `public/videos/`.
- Transitions (shell): victory hold + "continue" hint → iris close → spectrum strip
  where the next colour ignites with a chime → video (hold SPACE to skip) →
  colour title card → iris open into the preloaded level.
- `?chapter=<id>` URL param jumps to a piece for testing.

## Checklist
- [ ] Shell project scaffolded
- [ ] Level bridges (postMessage on complete) in all 8 levels
- [ ] build-levels script + videos copied
- [ ] Transition sequence implemented
- [ ] Built and played through in the browser (every transition checked)
- [ ] README for the full game, notes for the 3 pending slots
