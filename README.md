# VOIDFORGE

![VOIDFORGE launch screen](artifacts/screenshots/launch-1920x1080.png)

VOIDFORGE is an original, high-resolution multidirectional arcade shooter for desktop and touch-capable browsers. Mine Flux Shards, stop Fabricators from assembling the Dread Engine, retain control through its Awakening, evade predicted pursuit and radial disruption waves, and destroy it with homing Nova Charges.

Current release: **build 01.38**.

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

These are the defaults. Every keyboard action can be rebound from **Help → Control calibration**.

| Action | Keyboard | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Thrust and steer | WASD or arrow keys | Left stick | Left virtual stick |
| Aim | Travel direction | Right stick or travel direction | Right virtual stick |
| Fire laser / mine | Space | South face button | Hold or engage the right virtual stick |
| Launch Nova Charge | C or Shift | East or west face button | Tap **Nova** |
| Pause / resume | P or Escape | Menu button | Tap **Pause** |
| Mute / unmute | M | — | Tap **Sound** |
| Start | Enter or on-screen button | South face or Menu button | On-screen button |
| Restart after game over | R or on-screen button | South face or Menu button | On-screen button |

Control calibration is saved locally under `voidforge-input-settings-v1`. Rebinding a key already assigned elsewhere swaps the conflicting slots so controls remain unambiguous. Escape cancels key capture and remains available as the default secondary Pause key through **Restore defaults**. The radial gamepad dead zone is adjustable from 5% to 40% with a 14% default, and primary fire can use either **Hold to fire** or **Press to toggle** across keyboard, gamepad, and touch. **Restore defaults** resets bindings, stick response, and fire behavior together.

On touch-capable phones, the responsive twin-stick layout defaults to left-side thrust and right-side independent aim. The right stick holds or toggles fire according to the saved calibration. Thrust still uses six readable speed bands, but a touch-only response curve reaches useful bands earlier; mobile acceleration, braking, and steering response are stronger without changing the 535-unit top speed. **Nova** queues one launch per tap, while **Pause** opens the options overlay; its **Swap** control switches the touch layout to southpaw orientation.

The mobile combat profile slows Sentinel bolts from 385 to 300 world units per second, shortens their player-engagement range from 1,450 to 1,100 units, and renders bolts 30% larger without enlarging their collision radius. Each mobile hull carries three visible shield-integrity segments: the first two impacts trigger 1.1 seconds of protection and push the Vesper clear, while the third costs the hull. Desktop retains its original one-hit hull balance.

Phone portrait and landscape layouts both respect display safe areas, keep the HUD above the controls, and enlarge tutorial text and its Skip/Begin mission actions. Pointer capture preserves a drag that leaves a stick, while pointer cancellation, lost capture, blur, page hide, and orientation changes clear held input. Blur or page hide during play also pauses the game automatically. Keyboard and gamepad input remain available.

Touch layout and pointer behavior have been verified with browser mobile viewports and pointer-event checks. The short dense-combat mobile profile reports 60 FPS at 844×390 with a 16.8 ms p95 frame time; see the [mobile performance capture](artifacts/performance-mobile-844x390.json). This is a point-in-time browser sample, and physical-device Safari and Chrome validation remains pending.

The first normal run offers a four-stage guided flight: move the Vesper, extract a Flux crystal, follow its targeting bracket to collect it, and review the Fabricator–construction–Nova mission loop. Progress comes from gameplay events rather than a particular control device, so keyboard, gamepad, and touch all advance the same tutorial and actions completed ahead of a prompt are remembered. A gamepad-only pilot can press the south face button on the visible final coachmark to begin the mission; that acknowledgement edge is consumed until release so it cannot also fire or latch the laser. Fabricator deliveries wait until training ends. **Skip** exits at any stage; normal completion or skipping is saved locally so the tutorial does not repeat. Open **Help** and choose **Replay guided flight** to run it again without changing that saved first-run state.

When browser speech synthesis is available, the optional Vesper flight-guide **Voice** defaults on and speaks each tutorial step once from an original, input-neutral script. A compact **Voice on/off** control appears on the first-flight title and in **Help**, and its preference is stored as `voidforge-guide-voice`. Touch titles always expose 44px **Sound**, **Voice**, and **How to play** controls, including for returning pilots, so Android players can set audio and open the complete flight manual before the opening cue. **Sound** remains the master: muting it cancels and suppresses game audio, guide speech, and the Dread Engine's low-pitch dialogue without changing the Voice preference. Muted, disabled, hidden, or unsupported cues are never queued for later playback.

Laser fire mines planetoids as well as attacking enemies. Held fire still builds extraction progress and can release Flux, making touch mining forgiving. Short controlled bursts damage the planetoid less and remain the more efficient way to recover its crystals before it breaks.

## Current boss climax

At 20 installed modules, the Dread Engine enters a 2.5-second in-world Awakening with an original sub-bass impact and phone-audible harmonic under the Sound master. The Vesper remains controllable while the Engine brakes; pursuit and boss contact damage do not begin until alignment completes. Once active, it leads the Vesper by `clamp(distance / 1050, 0.42, 1.05)` seconds while keeping its predicted target inside 180-pixel world margins. If it comes within 560 units while closing faster than 95 units per second, predictive contact danger emits text and warning audio, limited by a 2.4-second anti-spam cooldown.

Inside 1080 world units, an available disruption attack announces a 0.95-second charge with text, warning audio, and a segmented ring that does not depend on color. Its swept front expands from radius 190 to 760 over 0.82 seconds and costs one unshielded hull when crossed. The cooldown is `max(4.8, 6.4 - zone * 0.18)` seconds. Pause freezes the climax state; reset, Engine destruction, and game over clear it. Reduced Motion removes decorative rotation and shake but preserves the true gameplay ring, while Reduced Flashing replaces additive pulses with steady normal-blend warnings.

Construction warnings escalate at 5, 10, 15, and 19 modules. Nova Charges can be intercepted by planetoids, Sentinels, Fabricators, or hostile bolts. Field 01 keeps Engine repair offline so 13 successful hits remain sufficient; from Field 02 onward, a loaded Fabricator that reaches a damaged active Engine restores exactly one node with a visible and audible repair signal. Current canonical awards are 100 for a shard, 250 for a loaded Fabricator, 400 for a Sentinel, 750 for an Engine node, and 10,000 for the core.

## Arcade run progression

Qualifying score actions use the multiplier visible beside the score, then increase the next action by 0.25× up to 5.00×. The chain lasts 4.5 active-play seconds; pausing freezes it, while expiration, Hull Lost, Arena Clear, game over, and a new run reset it to 1.00×. The first extra hull is awarded at 25,000 points, then every 50,000 points, with a five-hull cap.

When a hull is lost, a short **Hull Lost** presentation preserves score and Nova Charges, then returns Vesper with two seconds of protection and a fully restored mobile impact shield. Destroying the Dread Engine enters a 5.5-second **Arena Clear** summary with core points, clear time, time bonus, remaining-hull bonus, field bonus, run total, and any extra-hull award. Score, hulls, charges, extra-hull progress, and the locally persisted high score continue into the next field. The best score is stored as `voidforge-high-score-v1`; showcase, profile, and explicit tutorial-QA URLs do not write it.

## Attract demo and field pressure

After 10 idle seconds, the title can enter a silent, non-scoring attract demonstration. Its deterministic 30-second loop gives mining, construction, pursuit, and disruption 7.5 seconds each. Demo actions never affect the run score or locally persisted high score, and player input immediately hands off to a fresh controllable run; the title also offers a direct demo action.

Successive fields now rotate through four original named arenas rather than making every pressure axis rise together. **Cinder Expanse** becomes the scarcity test, **Forge Wake** emphasizes Fabricator harvesting, **Razor Veil** concentrates Sentinel pressure and Nova interception, and **Shard Reef** supplies a dense planetoid belt with fragile Flux veins. Fields 1–4 establish those identities; Fields 5–8 repeat them at a capped Tier II; later fields keep cycling the identities while speeds, biases, and actor counts remain bounded. Every arena has its own name, fiction line, pressure label, HUD modifiers, palette, and landmark composition, and Field 2 still changes economic behavior before adding actors.

Sentinel tactics now reassign the existing live population among player pressure, Fabricator/Engine guarding, and Nova interception. A valid Nova interception always takes priority, while construction progress shifts more of the same population into guard duty without silently adding enemies. When in range, each attacker follows a readable approach, charge, three-shot burst, and breakaway cadence; charge marks and movement state communicate the cycle before the bolts arrive.

The Flux economy is now closed against unrecoverable runs. A full 20-charge Nova hold leaves collided crystals in the field instead of deleting them. A deterministic reserve check counts unmined shards, loose crystals, loaded Fabricators, stored charges, and launched Novas according to the current phase. If that shared supply cannot finish construction or defeat the active Engine, the scanner and warning audio announce a short Flux-anomaly telegraph before a bounded 3–6-shard planetoid stabilizes near the Vesper. Showcase, profile, tutorial, paused, and scoring-locked states never trigger recovery.

The tactical scanner now reserves contacts for the nearest loose crystal and mineable planetoid while prioritizing the Engine, hostile bolts, Sentinels, and loaded Fabricators. The Engine bearing remains pinned to the scanner edge outside its nominal 2.4-AU range. Every class has a distinct shape, and touch layouts retain the critical scanner status inside the radar instead of hiding it.

## Accessibility and display

The utility bar provides independent reduced-motion and reduced-flashing controls, effect-density presets including FX Off, deuteranopia/protanopia/tritanopia color profiles, High Contrast, the master Sound control, in-game help, fullscreen controls, and touch-side swapping. Reduced motion and flashing follow the operating system preference on first launch. Preferences are saved locally. Visible coachmarks and notices remain authoritative, and the polite live-region fallback stays active whenever Voice is off, master Sound is muted, or speech synthesis is unavailable. Critical states use text, distinct silhouettes, contextual HUD threat status, player-relative radar trails, targeting brackets, persistent off-screen warnings, and audio rather than color alone.

Guide and Engine lines use browser/system speech voices, whose availability and character vary by browser and operating system. VOIDFORGE ships no recorded or reference-derived voice assets.

The renderer targets 60 FPS at 1920×1080 and scales responsively through 3840×2160. Title, briefing, HUD, and overlay typography use explicit 4K scaling so interface detail retains its 1080p-equivalent apparent size. Compact touch titles wrap their preflight actions without shrinking the 44px targets, while short landscape preserves the arena name and primary pressure modifier before hiding a redundant fourth chip. The checked-in short bombardment profiles report 60 FPS at both target resolutions and a 16.8 ms p95 frame time at 4K; dense touch combat reports the same p95 at 844×390. Build 01.38 browser QA covers the mobile response, projectile, and three-segment integrity profile; build 01.37 confirmed the four-light desktop cap, two-light compact cap, clean shader runtime, and unlit FX Off/High Contrast baselines. These remain point-in-time ticker samples rather than representative-hardware certification; see the [1080p](artifacts/performance-1920x1080.json), [4K](artifacts/performance-3840x2160.json), and [mobile](artifacts/performance-mobile-844x390.json) captures.

Ordered WebGL layers keep the Vesper, pickups, critical projectiles, and readability cues above atmospheric haze, near/far debris, environmental landmarks, persistent wreckage, terrain, enemies, and decorative effects. Distinct composite, mineral, industrial, and containment material families unify the player, planetoids, enemies, and Dread Engine; prebuilt panel lines, fasteners, mineral inclusions, and conduit traces appear at 4K only when measured render headroom permits. Abandoned rigs, relay screens, wreck lanes, forge rings, and dense fracture belts give every named arena a readable story composition without competing with combat.

The Vesper adds shield response, weapon recoil, and a localized muzzle flash; directional speed streaks, delayed player echoes, camera lead, and bounded zoom communicate acceleration. Mining produces a readable extraction pulse and animated crystal motion. Fabricators and Sentinels pose and move according to mining, carrying, pursuit, and attack intent, while shape-coded projectile trails make fire ownership readable at speed.

Damage progresses through fractured planetoid plates, disabled enemy systems, persistent capped wreckage, exposed Dread Engine conduits, and per-node boss disassembly. The Engine's aligning rings introduce Awakening, independently aimed arms and drive vents orient its velocity-led pursuit, and a protected segmented ring telegraphs the gameplay disruption front. A restrained envelope from the original adaptive score synchronizes conduits, beacons, reticles, and machinery without analyzing external audio.

Typed spark, shard, smoke, and plasma systems create distinct silhouettes, joined by expanding impact rings and shockwave distortion. The single-pass WebGL post-processing pipeline adds restrained heat refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, scene-wide color-vision transforms, and bounded screen-space emissive spill from Vesper, the Engine, immediate weapons/impacts, mining, cargo, and Flux. Four deterministic semantic roles cap the desktop light budget; compact layouts use at most two and Low uses one. FX Off and High Contrast submit no local lights, while warning pointers and targeting brackets live above the filtered presentation layer. Reduced Motion, Reduced Flashing, High Contrast, effect intensity, dynamic microdetail gating, and FX Off reduce or disable decorative treatments without hiding essential feedback.

## Architecture

- `app/game/VoidforgeGame.tsx` — PixiJS WebGL renderer, simulation, adaptive presentation, entity damage/wreckage, camera, tactical HUD, and deterministic showcase scenes
- `app/game/postfx.ts` — custom single-pass WebGL post-processing, bounded analytic emissive spill, cinematic danger framing, and scene-wide accessibility color transforms
- `app/game/emissive-lights.mjs` — deterministic projection, off-screen rejection, semantic-role reservation, accessibility budgets, and stable light selection
- `app/game/audio.ts` — original Web Audio synthesis, spatial effects, engine layers, warnings, and impacts
- `app/game/spoken-guidance.mjs` — original guide/Engine copy, persisted Voice policy, cue allowlists, and no-backlog gating
- `app/game/boss-behavior.mjs` — deterministic Awakening timing, bounded pursuit prediction, and swept radial-wave collision helpers
- `app/game/arcade-run.mjs` — deterministic multiplier, high-level score transactions, extra hulls, Hull Lost reset, and Arena Clear bonus rules
- `app/game/attract-mode.mjs` — deterministic title-idle delay and four-phase attract-loop timing
- `app/game/field-progression.mjs` — deterministic named-arena cycling with bounded economic, combat, resource, palette, landmark, repair, and HUD profiles
- `app/game/sentinel-behavior.mjs` — deterministic Sentinel role allocation, construction-driven guarding, and bounded three-shot attack cadence
- `app/game/input-settings.mjs` — sanitized persisted keyboard bindings, radial gamepad calibration, and merged hold/toggle input routing
- `app/game/mobile-assist.mjs` — shared touch-capability detection, responsive flight tuning, mobile projectile profile, and deterministic three-segment impact resolution
- `app/game/resource-liveness.mjs` — deterministic construction/assault Flux-budget accounting and bounded recovery sizing
- `app/game/radar-contacts.mjs` — deterministic resource-reserving contact priority and player-relative radar projection
- `app/game/core.mjs` — testable rules for mining, construction, later-field repair policy, homing, collisions, boss damage, and progression
- `app/game/tutorial.mjs` — deterministic tutorial progression, first-run resolution, persistence policy, and QA overrides
- `app/globals.css` — responsive widescreen interface, overlays, HUD, accessibility states, and 4K scaling
- `tests/` — deterministic attract-mode, field-progression, Sentinel-behavior, input-settings, Flux-liveness, radar-priority, arcade-run, core, tutorial, spoken-guidance, and boss-behavior tests plus production-render smoke tests
- `artifacts/screenshots/` — the eight required gameplay states at both 1080p and native 4K
- `RESEARCH.md`, `GAME_SPEC.md`, and `IMPLEMENTATION_NOTES.md` — research boundaries, game specification, and clean-room decisions

PixiJS loads only in the browser. The surrounding React/vinext application server-renders the launch interface, while gameplay graphics use high-resolution WebGL primitives over an original generated cosmic background.

## Remaining parity work

The boss climax, arcade-run layer, attract demo, four-arena pressure cycle, Sentinel tactics, persisted input calibration, controller-complete onboarding, closed Flux economy, objective-aware scanner, later-field repair policy, and bounded multi-source lighting are shipped. Remaining work includes adaptive audio/mix controls, deeper destruction and automatic-quality systems, physical-device mobile validation, browser-level climax checks, and longer metadata-bearing maximum-density performance runs. [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) tracks the detailed backlog.

## Verification

```bash
npm test
npm run lint
```

Deterministic visual states are available at `/?showcase=exploration`, `mining`, `construction`, `combat`, `pursuit`, `bombardment`, `destruction`, `hull-lost`, `arena-clear`, and `gameover`.

Append `&field=1` through `&field=8` to any showcase URL to render a specific arena/tier without changing persistent score. Fields 9 and later can be inspected the same way to verify the capped identity cycle.

Tutorial QA uses `/?tutorial=1` to force the normal four-stage flow, `/?tutorial=0` to suppress it, or `/?tutorial=move`, `mine`, `collect`, or `threat` to pin a deterministic coachmark; `threat` is the mission-loop stage. Valid tutorial overrides take precedence over saved completion and never update it. Without an explicit override, showcase and `?profile=1` runs suppress the tutorial so captures and performance measurements remain stable.

Integrated Flux-recovery QA uses `/?qa=flux-deficit&tutorial=0`. Starting that run leaves construction one module short with no field reserve, begins the normal scanner/audio telegraph, and then stabilizes the bounded recovery planetoid. QA URLs never write the saved high score.

Automated spoken-guidance checks cover every tutorial line, the selected mission-cue allowlist, once-per-run delivery, the Voice storage-key contract, and no backlog after muted, disabled, hidden, or unsupported cues. Browser checks should confirm the default and persisted Voice choice, Sound-master precedence, immediate cancellation on pause, page hide, game over, Skip, master mute, Voice off, and teardown, and continued visible/live-region guidance.

`tests/attract-mode.test.mjs` verifies the 10-second idle boundary, bounded frame advancement, all four 7.5-second phase transitions, and 30-second loop wrap. `tests/field-progression.test.mjs` verifies deterministic immutable arena identities, four distinct tactical emphases, the two capped pressure tiers, late-field cycling, explicit repair policy, and hard population/speed bounds. Tutorial tests additionally verify that only a visible final-step gamepad rising edge acknowledges the mission briefing.

`tests/sentinel-behavior.test.mjs` verifies interception priority, construction-driven guard reallocation without population growth, immutable sanitized state, and the approach/charge/exactly-three-shots/breakaway cadence. `tests/input-settings.test.mjs` verifies immutable defaults, safe persistence sanitization, conflict-swapping keyboard rebinding, 5%–40% radial dead-zone calibration, connected-pad selection, and hold/toggle edge behavior across locked and reset states.

`tests/resource-liveness.test.mjs` verifies phase-correct reserve accounting, deficit detection, sanitization, immutability, and bounded recovery sizing. `tests/radar-contacts.test.mjs` verifies persistent boss bearing, threat priority, reserved crystal/planetoid slots, deterministic ties, malformed-input handling, and player-relative projection. Core tests additionally verify that Field 01 cannot repair the Engine while eligible later-field deliveries restore exactly one node and clamp at full integrity.

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
