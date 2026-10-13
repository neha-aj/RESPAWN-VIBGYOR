# VIBGYOR · YELLOW (Python)

A 2D side-view fighting game in yellow pixel art. **Thanos** fights **Wolverine** in a golden throne room styled after a pixel beat-'em-up: a cosmic window, a throne, curved consoles and a perspective floor. Defeat Wolverine, watch the barrier shatter, then walk through the Phase Door.

## Run

```bash
python -m pip install pygame
python yellow.py
```

There are no asset files. Every pixel, sound effect and the music are generated in code.

## Controls

| Key | Action |
|---|---|
| A / D, ← / → | Move |
| W / ↑ | Jump |
| J | Light attack: Gauntlet jab |
| K | Heavy attack: double-bladed sword |
| SHIFT | Dodge (brief invulnerability, cooldown) |
| hold L | Solar charge (you can't move, and any hit interrupts it) |
| I | Solar Flash, when the meter is full |
| ESC | Pause |
| R | Restart (after a result, or from the pause menu) |
| M | Mute |

## What's in it

- **Combat:** light and heavy attacks have distinct startup, active and recovery frames and their own directional hitboxes. Each attack can land only once. Hits cause hit-stop, knockback and hit-stun, followed by a short invulnerability window.
- **Solar Flash:** an expanding shockwave that stuns Wolverine for exactly 90 frames. It is never lethal, and it uses up the meter even if it misses.
- **Wolverine's AI** is a state machine: IDLE, APPROACH, RETREAT, JUMP, ATTACK_WINDUP, ATTACK_ACTIVE, ATTACK_RECOVERY, HURT, STUNNED and DEFEATED.
  - **Telegraphs:** his claws glow before his heavy lunge.
  - **Reactions:** he punishes charging and backs away from a bracing Flash.
  - **Spacing:** he waits at least 40 frames between attacks.
- **The ending:** the KO is followed by these phases:
  1. Wolverine dissolves.
  2. The barrier cracks and shatters.
  3. The two pillars slide apart to reveal the Phase Door.
  4. Thanos walks in.
  5. The screen shows *PHASE DOOR UNLOCKED. TRANSITIONING TO LEVEL: BLUE*.
- **Timer:** a 99-second round timer. Running out counts as a loss.
- **HUD:** portraits, chunky health bars that ease down, the Solar meter, a dodge cooldown ring, score and combo.
- **Sound:** an original 140 BPM battle loop plus synthesized hits, swings, charge hum, shockwave, barrier and portal sounds.

The Rules screen is a placeholder until the final rules are supplied.

## Tests

```bash
python test_yellow.py
```

The tests cover the spec's 25-point checklist, plus a bot that beats Wolverine in 5 of 5 seeded fights and walks into the portal.
