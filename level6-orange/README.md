# VIBGYOR · ORANGE (Python)

A typing-dance rhythm game in chibi pixel art, drawn only in shades of orange. Every correct keystroke is a dance move for **Thanos**. Hold at least **60 WPM with at least 95% accuracy for 60 seconds**: the speakers slide apart and Thanos dances through the Phase Door to RED.

## Run

```bash
python -m pip install pygame
python orange.py
```

There are no asset files. Every pixel, every letter of the 5×7 pixel font, every sound effect and the music are generated in code.

## Controls

| Key | Action |
|---|---|
| Letters | Type the word on screen |
| BACKSPACE | Fix the current word (it never erases errors) |
| ENTER | Start (title → ready → start the 60 s timer) |
| ESC | Pause / resume |
| R | Restart after a result |
| M | Mute (outside the challenge; the SOUND button works any time) |

## Scoring

- **WPM** = correct letters × 12 / seconds (five letters = one word). Letters removed with backspace stop counting.
- **Accuracy** = correct keystrokes / all letter keystrokes. A wrong key stays an error even after you fix the word.
- **Result:** judged once, when the full 60 seconds end. You win only if WPM ≥ 60 *and* accuracy ≥ 95%.

## The stage

- **The dancer:** Thanos is a chibi dancer built from joints that blend smoothly between 13 poses: idle groove, arm swings, arms up, side-steps, twist, dip, disco point, jump, stumble, victory and collapse.
  - Every letter is the next move in the routine.
  - A finished word triggers a spin or a jump.
  - A mistake makes him stumble.
  - His face changes with how you're doing, and he puts sunglasses on during a hot streak.
- **The Avengers:** sad chibi Avengers stand at the back (Iron Man, Captain America, Thor, Hulk, Spider-Man, Black Widow, Black Panther and Doctor Strange).
  - If you fail, they cheer.
  - If you win, Thanos snaps and they turn to dust.
- **The crowd:** Marvel fans seen from behind (Loki horns, Cap's helmet, Panther ears, Groot) wave glowsticks to the beat.
- **The club:** a neon Infinity Gauntlet sign, sweeping spotlights, a disco floor that lights up as you type, and two speaker stacks that pulse to the beat. The Phase Door hides behind the speakers.

## Sound

- **Music:** an original 120 BPM superhero-disco loop with a heroic brass-style lead, a disco octave bass and four-on-the-floor drums. It is not the Avengers theme, which is copyrighted.
- **Sound effects:**
  - Every correct key plays the next note of a pentatonic scale.
  - Wrong keys buzz.
  - Finished words chime, and the crowd cheers every five words.
  - A fanfare plays when you reach 60 WPM pace.
  - The last five seconds count down.
  - The ending has a fail sound, a victory fanfare, the Thanos snap, a speaker rumble and a portal whoosh.

The Rules screen is a placeholder until the final rules are supplied.

## Tests

```bash
python test_orange.py
```

The tests cover the spec's mandatory checklist, the scoring maths, the orange-only palette and the pixel font. Typing bots check four outcomes:
- 72 WPM wins.
- 48 WPM loses on speed.
- Fast but 90% accurate loses on accuracy.
- About 97% accurate wins.
