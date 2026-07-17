# VOIDFORGE

![VOIDFORGE launch screen](artifacts/screenshots/launch-1920x1080.png)

VOIDFORGE is an original, high-resolution multidirectional arcade shooter for desktop browsers. Mine Flux Shards, stop Fabricators from assembling the Dread Engine, survive its pursuit, and destroy it with homing Nova Charges.

All artwork, silhouettes, names, dialogue, procedural audio, music, and code are original. The clean-room design boundaries are documented in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md).

## Play locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run start
```

## Controls

| Action | Keyboard | Standard gamepad |
| --- | --- | --- |
| Thrust and steer | WASD or arrow keys | Left stick |
| Fire laser / mine | Space | South face button |
| Launch Nova Charge | C or Shift | East or west face button |
| Pause / resume | P or Escape | Menu button |
| Start | Enter or on-screen button | — |
| Restart after game over | R or on-screen button | — |

Laser fire mines planetoids as well as attacking enemies. Controlled bursts release more Flux; firing too rapidly can destroy a planetoid before all its shards are extracted.

## Accessibility and display

The utility bar provides independent reduced-motion and reduced-flashing controls, effect-density presets including FX Off, deuteranopia/protanopia/tritanopia color profiles, High Contrast, procedural-audio mute, in-game help, and fullscreen controls. Reduced motion and flashing follow the operating system preference on first launch. Preferences are saved locally. Critical states use text, distinct silhouettes, contextual HUD threat status, player-relative radar trails, targeting brackets, persistent off-screen warnings, and audio rather than color alone.

The renderer targets 60 FPS at 1920×1080 and scales responsively through 3840×2160. The particle-heavy bombardment profile measured 60 FPS at both target resolutions, with a 16.8 ms p95 frame time at 4K. See the [1080p](artifacts/performance-1920x1080.json) and [4K](artifacts/performance-3840x2160.json) performance captures.

Ordered WebGL layers keep the Vesper, pickups, critical projectiles, and readability cues above atmospheric haze, near/far debris, environmental landmarks, persistent wreckage, terrain, enemies, and decorative effects. Distinct composite, mineral, industrial, and containment material families unify the player, planetoids, enemies, and Dread Engine; prebuilt panel lines, fasteners, mineral inclusions, and conduit traces appear at 4K only when measured render headroom permits. Abandoned rigs, relays, slag fields, and wrecks give the Cinder Expanse readable story landmarks without competing with combat.

The Vesper adds shield response, weapon recoil, and a localized muzzle flash; directional speed streaks, delayed player echoes, camera lead, and bounded zoom communicate acceleration. Mining produces a readable extraction pulse and animated crystal motion. Fabricators and Sentinels pose and move according to mining, carrying, pursuit, and attack intent, while shape-coded projectile trails make fire ownership readable at speed.

Damage progresses through fractured planetoid plates, disabled enemy systems, persistent capped wreckage, exposed Dread Engine conduits, and per-node boss disassembly. During pursuit, the Engine cycles through lock, surge, and vent poses using independently aimed arms, drive vents, aperture movement, and a degraded targeting beam. A restrained envelope from the original adaptive score synchronizes conduits, beacons, reticles, and machinery without analyzing external audio.

Typed spark, shard, smoke, and plasma systems create distinct silhouettes, joined by expanding impact rings and shockwave distortion. The WebGL post-processing pipeline adds restrained heat refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, and scene-wide color-vision transforms. Reduced Motion, Reduced Flashing, High Contrast, effect intensity, dynamic microdetail gating, and FX Off reduce or disable decorative treatments while preserving targeting, warnings, contact shapes, and other essential feedback.

## Architecture

- `app/game/VoidforgeGame.tsx` — PixiJS WebGL renderer, simulation, adaptive presentation, entity damage/wreckage, camera, tactical HUD, and deterministic showcase scenes
- `app/game/postfx.ts` — custom WebGL post-processing, cinematic danger framing, and scene-wide accessibility color transforms
- `app/game/audio.ts` — original Web Audio synthesis, spatial effects, engine layers, warnings, and impacts
- `app/game/core.mjs` — testable rules for mining, construction, homing, collisions, boss damage, and progression
- `app/globals.css` — responsive widescreen interface, overlays, HUD, accessibility states, and 4K scaling
- `tests/` — deterministic mechanic tests and production-render smoke tests
- `artifacts/screenshots/` — the eight required gameplay states at both 1080p and native 4K
- `RESEARCH.md`, `GAME_SPEC.md`, and `IMPLEMENTATION_NOTES.md` — research boundaries, game specification, and clean-room decisions

PixiJS loads only in the browser. The surrounding React/vinext application server-renders the launch interface, while gameplay graphics use high-resolution WebGL primitives over an original generated cosmic background.

## Verification

```bash
npm test
npm run lint
```

Deterministic visual states are available at `/?showcase=exploration`, `mining`, `construction`, `combat`, `pursuit`, `bombardment`, `destruction`, and `gameover`.

| Scene | 1920×1080 | 3840×2160 |
| --- | --- | --- |
| Exploration | [View](artifacts/screenshots/01-exploration-1920x1080.png) | [View](artifacts/screenshots/01-exploration-3840x2160.jpg) |
| Mining and collection | [View](artifacts/screenshots/02-mining-1920x1080.png) | [View](artifacts/screenshots/02-mining-3840x2160.jpg) |
| Construction | [View](artifacts/screenshots/03-construction-1920x1080.png) | [View](artifacts/screenshots/03-construction-3840x2160.jpg) |
| Dense combat | [View](artifacts/screenshots/04-combat-1920x1080.png) | [View](artifacts/screenshots/04-combat-3840x2160.jpg) |
| Pursuit | [View](artifacts/screenshots/05-pursuit-1920x1080.png) | [View](artifacts/screenshots/05-pursuit-3840x2160.jpg) |
| Nova bombardment | [View](artifacts/screenshots/06-bombardment-1920x1080.png) | [View](artifacts/screenshots/06-bombardment-3840x2160.jpg) |
| Dread Engine destruction | [View](artifacts/screenshots/07-destruction-1920x1080.png) | [View](artifacts/screenshots/07-destruction-3840x2160.jpg) |
| Game over | [View](artifacts/screenshots/08-gameover-1920x1080.png) | [View](artifacts/screenshots/08-gameover-3840x2160.jpg) |
