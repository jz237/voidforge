# VOIDFORGE

![VOIDFORGE launch screen](artifacts/screenshots/launch-1920x1080.png)

VOIDFORGE is an original, high-resolution multidirectional arcade shooter for desktop and touch-capable browsers. Mine Flux Shards, stop Fabricators from assembling the Dread Engine, retain control through its Awakening, evade predicted pursuit and radial disruption waves, and destroy it with homing Nova Charges.

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

| Action | Keyboard | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Thrust and steer | WASD or arrow keys | Left stick | Left virtual stick |
| Aim | Travel direction | Right stick or travel direction | Right virtual stick |
| Fire laser / mine | Space | South face button | Hold the right virtual stick |
| Launch Nova Charge | C or Shift | East or west face button | Tap **Nova** |
| Pause / resume | P or Escape | Menu button | Tap **Pause** |
| Mute / unmute | M | — | Tap **Sound** |
| Start | Enter or on-screen button | On-screen button | On-screen button |
| Restart after game over | R or on-screen button | On-screen button | On-screen button |

On touch-capable phones, the responsive twin-stick layout defaults to left-side thrust and right-side independent aim with held fire. Thrust magnitude is quantized into six readable speed bands. **Nova** queues one launch per tap, while **Pause** opens the options overlay; its **Swap** control switches the touch layout to southpaw orientation.

Phone portrait and landscape layouts both respect display safe areas, keep the HUD above the controls, and enlarge tutorial text and its Skip/Begin mission actions. Pointer capture preserves a drag that leaves a stick, while pointer cancellation, lost capture, blur, page hide, and orientation changes clear held input. Blur or page hide during play also pauses the game automatically. Keyboard and gamepad input remain available.

Touch layout and pointer behavior have been verified with browser mobile viewports and pointer-event checks. The short dense-combat mobile profile reports 60 FPS at 844×390 with a 16.8 ms p95 frame time; see the [mobile performance capture](artifacts/performance-mobile-844x390.json). This is a point-in-time browser sample, and physical-device Safari and Chrome validation remains pending.

The first normal run offers a four-stage guided flight: move the Vesper, extract a Flux crystal, follow its targeting bracket to collect it, and review the Fabricator–construction–Nova mission loop. Progress comes from gameplay events rather than a particular control device, so keyboard, gamepad, and touch all advance the same tutorial and actions completed ahead of a prompt are remembered. Fabricator deliveries wait until training ends. **Skip** exits at any stage; normal completion or skipping is saved locally so the tutorial does not repeat. Open **Help** and choose **Replay guided flight** to run it again without changing that saved first-run state.

When browser speech synthesis is available, the optional Vesper flight-guide **Voice** defaults on and speaks each tutorial step once from an original, input-neutral script. A compact **Voice on/off** control appears on the first-flight title and in **Help**, and its preference is stored as `voidforge-guide-voice`. **Sound** remains the master: muting it cancels and suppresses game audio, guide speech, and the Dread Engine's low-pitch dialogue without changing the Voice preference. Muted, disabled, hidden, or unsupported cues are never queued for later playback.

Laser fire mines planetoids as well as attacking enemies. Held fire still builds extraction progress and can release Flux, making touch mining forgiving. Short controlled bursts damage the planetoid less and remain the more efficient way to recover its crystals before it breaks.

## Current boss climax

At 20 installed modules, the Dread Engine enters a 2.5-second in-world Awakening. The Vesper remains controllable while the Engine brakes; pursuit and boss contact damage do not begin until alignment completes. Once active, it leads the Vesper by `clamp(distance / 1050, 0.42, 1.05)` seconds while keeping its predicted target inside 180-pixel world margins. If it comes within 560 units while closing faster than 95 units per second, predictive contact danger emits text and warning audio, limited by a 2.4-second anti-spam cooldown.

Inside 1080 world units, an available disruption attack announces a 0.95-second charge with text, warning audio, and a segmented ring that does not depend on color. Its swept front expands from radius 190 to 760 over 0.82 seconds and costs one unshielded hull when crossed. The cooldown is `max(4.8, 6.4 - zone * 0.18)` seconds. Pause freezes the climax state; reset, Engine destruction, and game over clear it. Reduced Motion removes decorative rotation and shake but preserves the true gameplay ring, while Reduced Flashing replaces additive pulses with steady normal-blend warnings.

Construction warnings escalate at 5, 10, 15, and 19 modules. Nova Charges can be intercepted by planetoids, Sentinels, Fabricators, or hostile bolts. Current canonical awards are 100 for a shard, 250 for a loaded Fabricator, 400 for a Sentinel, 750 for an Engine node, and 10,000 for the core.

## Arcade run progression

Qualifying score actions use the multiplier visible beside the score, then increase the next action by 0.25× up to 5.00×. The chain lasts 4.5 active-play seconds; pausing freezes it, while expiration, Hull Lost, Arena Clear, game over, and a new run reset it to 1.00×. The first extra hull is awarded at 25,000 points, then every 50,000 points, with a five-hull cap.

A surviving hit now enters a short **Hull Lost** presentation, preserves score and Nova Charges, and returns Vesper with two seconds of protection. Destroying the Dread Engine enters a 5.5-second **Arena Clear** summary with core points, clear time, time bonus, remaining-hull bonus, field bonus, run total, and any extra-hull award. Score, hulls, charges, extra-hull progress, and the locally persisted high score continue into the next field. The best score is stored as `voidforge-high-score-v1`; showcase, profile, and explicit tutorial-QA URLs do not write it.

## Accessibility and display

The utility bar provides independent reduced-motion and reduced-flashing controls, effect-density presets including FX Off, deuteranopia/protanopia/tritanopia color profiles, High Contrast, the master Sound control, in-game help, fullscreen controls, and touch-side swapping. Reduced motion and flashing follow the operating system preference on first launch. Preferences are saved locally. Visible coachmarks and notices remain authoritative, and the polite live-region fallback stays active whenever Voice is off, master Sound is muted, or speech synthesis is unavailable. Critical states use text, distinct silhouettes, contextual HUD threat status, player-relative radar trails, targeting brackets, persistent off-screen warnings, and audio rather than color alone.

Guide and Engine lines use browser/system speech voices, whose availability and character vary by browser and operating system. VOIDFORGE ships no recorded or reference-derived voice assets.

The renderer targets 60 FPS at 1920×1080 and scales responsively through 3840×2160. The checked-in short bombardment profiles report 60 FPS at both target resolutions and a 16.8 ms p95 frame time at 4K. They are point-in-time ticker samples rather than representative-hardware certification; see the [1080p](artifacts/performance-1920x1080.json) and [4K](artifacts/performance-3840x2160.json) captures.

Ordered WebGL layers keep the Vesper, pickups, critical projectiles, and readability cues above atmospheric haze, near/far debris, environmental landmarks, persistent wreckage, terrain, enemies, and decorative effects. Distinct composite, mineral, industrial, and containment material families unify the player, planetoids, enemies, and Dread Engine; prebuilt panel lines, fasteners, mineral inclusions, and conduit traces appear at 4K only when measured render headroom permits. Abandoned rigs, relays, slag fields, and wrecks give the Cinder Expanse readable story landmarks without competing with combat.

The Vesper adds shield response, weapon recoil, and a localized muzzle flash; directional speed streaks, delayed player echoes, camera lead, and bounded zoom communicate acceleration. Mining produces a readable extraction pulse and animated crystal motion. Fabricators and Sentinels pose and move according to mining, carrying, pursuit, and attack intent, while shape-coded projectile trails make fire ownership readable at speed.

Damage progresses through fractured planetoid plates, disabled enemy systems, persistent capped wreckage, exposed Dread Engine conduits, and per-node boss disassembly. The Engine's aligning rings introduce Awakening, independently aimed arms and drive vents orient its velocity-led pursuit, and a protected segmented ring telegraphs the gameplay disruption front. A restrained envelope from the original adaptive score synchronizes conduits, beacons, reticles, and machinery without analyzing external audio.

Typed spark, shard, smoke, and plasma systems create distinct silhouettes, joined by expanding impact rings and shockwave distortion. The WebGL post-processing pipeline adds restrained heat refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, and scene-wide color-vision transforms. Reduced Motion, Reduced Flashing, High Contrast, effect intensity, dynamic microdetail gating, and FX Off reduce or disable decorative treatments while preserving targeting, warnings, contact shapes, and other essential feedback.

## Architecture

- `app/game/VoidforgeGame.tsx` — PixiJS WebGL renderer, simulation, adaptive presentation, entity damage/wreckage, camera, tactical HUD, and deterministic showcase scenes
- `app/game/postfx.ts` — custom WebGL post-processing, cinematic danger framing, and scene-wide accessibility color transforms
- `app/game/audio.ts` — original Web Audio synthesis, spatial effects, engine layers, warnings, and impacts
- `app/game/spoken-guidance.mjs` — original guide/Engine copy, persisted Voice policy, cue allowlists, and no-backlog gating
- `app/game/boss-behavior.mjs` — deterministic Awakening timing, bounded pursuit prediction, and swept radial-wave collision helpers
- `app/game/arcade-run.mjs` — deterministic multiplier, high-level score transactions, extra hulls, Hull Lost reset, and Arena Clear bonus rules
- `app/game/core.mjs` — testable rules for mining, construction, homing, collisions, boss damage, and progression
- `app/game/tutorial.mjs` — deterministic tutorial progression, first-run resolution, persistence policy, and QA overrides
- `app/globals.css` — responsive widescreen interface, overlays, HUD, accessibility states, and 4K scaling
- `tests/` — deterministic arcade-run, core, tutorial, spoken-guidance, and boss-behavior tests plus production-render smoke tests
- `artifacts/screenshots/` — the eight required gameplay states at both 1080p and native 4K
- `RESEARCH.md`, `GAME_SPEC.md`, and `IMPLEMENTATION_NOTES.md` — research boundaries, game specification, and clean-room decisions

PixiJS loads only in the browser. The surrounding React/vinext application server-renders the launch interface, while gameplay graphics use high-resolution WebGL primitives over an original generated cosmic background.

## Remaining parity work

The boss climax and surrounding arcade-run layer are shipped. Remaining work includes a true non-persistent attract demonstration; field modifiers that prioritize coordination, scarcity, and interception over raw counts; remaining input customization; physical-device mobile validation; and longer metadata-bearing maximum-density performance runs. [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) tracks the detailed backlog.

## Verification

```bash
npm test
npm run lint
```

Deterministic visual states are available at `/?showcase=exploration`, `mining`, `construction`, `combat`, `pursuit`, `bombardment`, `destruction`, `hull-lost`, `arena-clear`, and `gameover`.

Tutorial QA uses `/?tutorial=1` to force the normal four-stage flow, `/?tutorial=0` to suppress it, or `/?tutorial=move`, `mine`, `collect`, or `threat` to pin a deterministic coachmark; `threat` is the mission-loop stage. Valid tutorial overrides take precedence over saved completion and never update it. Without an explicit override, showcase and `?profile=1` runs suppress the tutorial so captures and performance measurements remain stable.

Automated spoken-guidance checks cover every tutorial line, the selected mission-cue allowlist, once-per-run delivery, the Voice storage-key contract, and no backlog after muted, disabled, hidden, or unsupported cues. Browser checks should confirm the default and persisted Voice choice, Sound-master precedence, immediate cancellation on pause, page hide, game over, Skip, master mute, Voice off, and teardown, and continued visible/live-region guidance.

`tests/boss-behavior.test.mjs` verifies the 2.5-second Awakening countdown, bounded velocity-lead prediction, and swept radial collision including tangency and non-expanding waves. Browser climax QA still needs to exercise retained control, warning synchronization, pause/reset/destruction/game-over cleanup, and accessibility variants as live integrated behavior.

Mobile layout captures: [844×390 landscape](artifacts/screenshots/mobile-landscape-844x390.jpg) and [390×844 portrait](artifacts/screenshots/mobile-portrait-390x844.jpg).

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
