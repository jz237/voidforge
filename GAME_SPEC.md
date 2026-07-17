# VOIDFORGE Game Specification

Version: 0.1 · build 01.34
Title: **VOIDFORGE**  
Genre: high-resolution multidirectional arcade shooter

## Product goal

Build a polished, immediately playable browser game about piloting the Vesper to mine Flux Shards while enemy Fabricators use the same resource to assemble the Dread Engine. The experience should move from controlled extraction to mounting interference to a short, violent pursuit across the Cinder Expanse. All names, art, dialogue, music, effects, and code are original.

## Platform and rendering

- TypeScript, Vite, and PixiJS/WebGL
- Web Audio API for generated effects and adaptive layers
- Desktop browsers first, with keyboard and standard gamepads preserved alongside touch input
- 1920×1080 logical design space, sharp scaling through 3840×2160, and responsive phone portrait and landscape presentations
- 60 FPS target; simulation isolated from rendering with clamped delta time
- Hardware-accelerated particles, selective bloom, lighting, distortion, and post-processing

## Core loop

1. **Locate:** read the scanner and choose a fracture asteroid away from concentrated threats.
2. **Mine:** pulse the primary weapon to raise fracture energy and release Flux Shards without destroying the remaining yield.
3. **Compete:** collect shards before Fabricators; destroy a loaded Fabricator to recover its cargo.
4. **Bank:** each collected shard creates one Nova Charge, up to 20.
5. **Contain:** attack Fabricators and Sentinels while the Dread Engine gains one visible module per delivered enemy shard.
6. **Survive:** at 20 modules the Dread Engine enters a 2.5-second in-world Awakening while the camera opens slightly. The Vesper remains controllable, but the Engine brakes and cannot pursue or deal contact damage until alignment completes.
7. **Strike:** evade its predicted pursuit and radial disruption wave, then launch homing Nova Charges. Planetoids, Sentinels, Fabricators, and hostile bolts can intercept them.
8. **Advance:** 13 successful hits overload the Dread Engine, clear the Cinder Expanse, and begin a new, harder run.

The player starts with three hulls. A surviving loss enters a 1.25-second **Hull Lost** presentation, drops no stored charges, resets the score chain, then grants 2 seconds of spawn protection in a nearby safe pocket. The run ends at zero hulls.

## Cinder Expanse tuning baseline

All values are data-driven and subject to playtesting.

| System | Initial value |
| --- | --- |
| World | 9,200×6,200, bounded edges |
| Default camera | 1.0×; up to 15% zoom-out under severe threat |
| Asteroids | 22 active; 3–6 shards each |
| Fabricators | 5 active; respawn after 6–10 s |
| Sentinels | 2 active; pressure rises with build progress |
| Dread Engine construction | 20 delivered shards |
| Dread Engine durability | 13 charge hits |
| Charge inventory | 20 maximum |
| Score chain | 1.00× start; +0.25× per action; 5.00× cap; 4.5 s window |
| Extra hulls | 25,000, then every 50,000 points; 5-hull cap |
| Arena Clear presentation | 5.5 s with core, time, hull, and total breakdown |
| Expected first activation | 120–180 s without active containment |
| Expected arena duration | 4–6 min |

## Flight and controls

Movement has acceleration, momentum, drag, and a fast reversal response. Keyboard aim follows travel direction, while gamepad and touch right sticks can aim independently of thrust.

The table lists default bindings. **Help → Control calibration** exposes persisted keyboard rebinding, radial gamepad dead-zone adjustment, primary-fire hold/toggle behavior, and one-button default restoration.

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Thrust / steer | WASD or arrows | Left stick | Left virtual stick |
| Aim | Travel direction | Right stick or travel direction | Right virtual stick |
| Primary laser | Space | South face button | Hold or engage the right virtual stick |
| Nova Charge | Shift or C | East or west face button | Tap **Nova** |
| Pause | P or Escape | Menu | Tap **Pause** |
| Restart after game over | R | South face button | On-screen restart |
| Mute | M | Settings | Pause/options overlay |

- Keyboard, gamepad, and touch thrust are normalized into six output bands. Digital keyboard input reaches full thrust; analog stick distance selects lower bands.
- Opposite input applies stronger braking before accelerating in the new direction.
- Keyboard bindings, gamepad dead zone, and primary-fire mode persist together under `voidforge-input-settings-v1`. Persisted input is sanitized before use; an occupied key swaps with the rebound slot, restricted browser/system keys are rejected, Escape cancels capture while remaining the restored secondary Pause default, and **Restore defaults** resets the complete calibration.
- The radial gamepad dead zone ranges from 5% to 40% with a 14% default, and rescales travel outside the threshold back to the full zero-to-one range. The first connected browser gamepad is used even when it is not in slot zero.
- Primary fire supports **Hold to fire** and edge-triggered **Press to toggle** across keyboard, gamepad, and touch. Pause, Hull Lost, Arena Clear, game over, restart, and other control locks clear the latch and consume held edges so fire or Nova cannot leak into resumed play.
- On touch-capable phones, the default responsive layout is left-side thrust plus right-side aim. The right stick's aim vector remains independent of thrust and holds or toggles fire according to the saved mode.
- Each **Nova** tap queues one launch attempt. It does not become a held-fire control, and a launch without a valid target still consumes no charge.
- **Pause** opens the options overlay. Its **Swap** button reverses the touch-control sides and Nova placement for southpaw play.
- Each stick captures its active pointer so a drag can leave the pad. Pointer up, cancellation, or lost capture releases that stick and prevents stuck movement or fire.
- Blur, page hide, and orientation changes clear held touch input. Moving the page to the background during play also pauses automatically.
- Phone portrait and landscape layouts use safe-area insets, responsive stick placement, and HUD spacing that keeps controls and critical information distinct.
- Keyboard and gamepad controls remain active when touch controls are available.

## First-run tutorial

The normal first run is a short, non-modal guided flight layered over active play. Its four stages are:

1. **Move:** apply meaningful thrust beyond the active input dead zone.
2. **Extract:** fire into a cracked planetoid until it emits a Flux crystal.
3. **Collect:** fly through the crystal to convert it into a Nova Charge.
4. **Mission loop:** explain that Fabricators build the Dread Engine at 20 deliveries and that 13 Nova hits destroy it, then let the player choose **Begin mission**.

- Tutorial progression listens for input-neutral gameplay events—thrust, shard extraction, and shard collection—so keyboard, gamepad, and touch have identical completion rules while presenting device-appropriate instructions.
- Completed facts are retained even when the player acts ahead of the visible prompt. The state machine advances past any already-satisfied stage instead of requiring the action again.
- Fabricator deliveries are held while training is active, and the emitted tutorial crystal receives a persistent shape-based targeting bracket so the learning flow cannot be overtaken by construction or an ambiguous pickup.
- **Skip** is available at every stage. In the ordinary first-run path, either Skip or completion writes `voidforge-tutorial-v1-complete=true`, preventing the tutorial from appearing on later launches.
- **Help → Replay guided flight** starts again at Move without clearing or rewriting the saved first-run result.
- When speech synthesis is supported, the Vesper flight-guide Voice defaults on and speaks each stage once on entry using original input-neutral copy. The first-flight title and Help expose compact Voice on/off controls, persisted as `voidforge-guide-voice`.
- `?tutorial=1` forces the normal advancing flow and `?tutorial=0` suppresses it. `?tutorial=move|mine|collect|threat` forces and pins one deterministic stage; `threat` represents Mission loop. All explicit tutorial overrides take precedence and are non-persistent.
- In the absence of an explicit tutorial override, `?showcase=...` and `?profile=1` suppress onboarding so deterministic captures and performance samples remain unchanged.
- Phone portrait and landscape layouts enlarge tutorial copy and its Skip/Begin mission controls so onboarding remains readable and operable above the touch controls.

## Player systems

- **Primary laser:** rapid precision fire; mines rocks and destroys small enemies but cannot directly damage the Dread Engine.
- **Mining heat:** hits raise asteroid fracture energy. Hits less than 145 ms apart still add 0.75 extraction progress, allowing held fire to emit shards, but deal two integrity damage instead of one; deliberate pulses add 1.0 progress and preserve more yield. Overloading destroys the rock and any unextracted crystals.
- **Nova Charge:** consumes one stored charge, acquires the active Dread Engine, and curves toward it. Planetoids, Sentinels, Fabricators, and hostile bolts can intercept it. No target means no launch and no ammo loss.
- **Damage:** one unshielded hostile projectile or Dread Engine collision costs a hull. Clear audiovisual warnings precede unavoidable high-speed contact.
- **Canonical scoring:** shard +100; unloaded Fabricator +150; loaded Fabricator +250; Sentinel +400; Dread Engine node +750; core +10,000. Destroying an exhausted planetoid retains its small flat +5 award without extending the chain.
- **Score chain:** a qualifying action awards `round(base points × current multiplier)`, then raises the next-action multiplier by 0.25× up to 5.00× and refreshes a 4.5-second active-play window. Pause and Hull Lost freeze the clock; expiration, Hull Lost, Arena Clear, game over, and a new run reset it to 1.00×. Clear bonuses are never multiplied and never extend the chain.
- **Extra hulls:** the first arrives at 25,000, then at 75,000 and every additional 50,000 points. Every crossed threshold is consumed atomically, even when Vesper is already at the five-hull cap; score and threshold progress carry between fields.
- **Arena Clear bonus:** after the core transaction, award `max(0, 30000 - floor(active field seconds) × 250) + current hulls × 2000`. Tutorial, pause, Hull Lost, and Arena Clear time do not count. The lives term is captured before bonus-triggered extra hulls, preventing a feedback loop.
- **High score:** sanitize and persist the best run locally under `voidforge-high-score-v1`, updating it as soon as a normal run passes the saved value. Showcase, profile, and explicit tutorial-QA URLs may display an in-memory best but never write persistent progression.

## Enemy behavior

### Fabricator

Uses a readable state machine: seek loose shard → tether cargo → route to the Dread Engine → install module → seek again. It avoids direct combat. Loaded drones glow and appear as distinct scanner icons. Destroying one releases its carried shard with inherited velocity.

### Sentinel

Selects deterministically among player pressure, Dread Engine/Fabricator guarding, and Nova interception. A live Nova interception is allocated before guard or pressure duty. Construction progress reallocates more of the current Sentinel population toward guards without increasing actor count. Once inside engagement range, each craft follows a 0.9-second approach, 0.42-second visible charge, exactly three shots spaced by 0.12 seconds, and a 0.8-second breakaway before approaching again. Charge marks, shot spacing, and retreat motion provide non-color phase cues.

### The Dread Engine

- **Dormant:** visible scaffold at a fixed world location; each delivered shard adds an animated module and an audible construction strike.
- **Construction warnings:** original warning motifs escalate at 5, 10, 15, and 19 installed modules without speech spam.
- **Awakening:** a 2.5-second in-world sequence with ring alignment, dimmed ambience, warning text, and a sub-bass impact. Player control remains active; the Engine brakes and neither pursues nor deals contact damage until the countdown completes.
- **Pursuit:** accelerates toward a velocity-led player position while its pylons rotate independently. Lead time is `clamp(distance / 1050, 0.42, 1.05)` seconds, and the predicted target is clamped within 180 px of the world bounds.
- **Contact warning:** when the Engine is within 560 world units and closing faster than 95 units per second, text and warning audio announce the predictive collision risk. A 2.4-second anti-spam cooldown prevents repeated cues from masking other alerts.
- **Disruption charge:** when its cooldown has elapsed and the Vesper is within 1080 world units, the Engine charges for 0.95 seconds. Text, an audio warning, and a non-color-dependent segmented ring announce the attack.
- **Disruption wave:** a swept radial front expands from radius 190 to 760 over 0.82 seconds. Crossing an unshielded Vesper costs one hull; swept-circle collision prevents the wave from tunneling through the player between simulation steps. The next cooldown is `max(4.8, 6.4 - zone * 0.18)` seconds.
- **Lifecycle:** pausing freezes Awakening, charge, wave, and cooldown state. World reset, Engine destruction, and game over clear every pending disruption state and visual.
- **Damage:** each Nova Charge breaks one armor node, changes the silhouette, exposes conduits, and modifies the engine timbre.
- **Destruction:** core collapse, expanding shock ring, large debris with no collision, then a short warp window.

## Camera and world presentation

- The camera follows smoothly with directional lead capped at 12% of viewport width.
- The player remains inside a central 40% safe region during ordinary flight.
- Threat zoom considers nearby projectiles and Dread Engine distance; transitions take at least 500 ms to avoid pumping.
- Parallax comprises directional distant stars, nebula/dust, and near motes. Background contrast stays below gameplay contrast.
- Impact shake is amplitude-capped and disabled by Reduced Motion.
- The Awakening reveal uses lighting, zoom, audio, and HUD warnings while retaining player control. Reduced Motion removes decorative ring rotation and shake, but never the alignment or gameplay-radius rings.

## Art direction

- Detailed 2D sprites with clean high-resolution edges and strong silhouettes
- Deep black-blue space, restrained nebulae, and layered parallax
- Fracture asteroids with persistent mining cracks and chipped overlays
- Emissive engines, maneuvering jets, weapon ports, tethered cargo, articulated enemy secondary motion, and persistent enemy/boss damage overlays
- GPU particles for sparks, fragments, plasma, debris, and shockwaves
- Selective soft bloom; a one-pass WebGL filter limits heat distortion/refraction to engines and major blasts and keeps chromatic danger cues restrained
- Directional motion streaks only at high speed
- No pixel-art treatment, CRT filter, nearest-neighbor scaling, block font, photorealism, or effect density that hides hazards

### Gameplay color roles

| Role | Primary cue | Redundant cue |
| --- | --- | --- |
| Vesper | ivory/cyan spearhead | engine-vaned silhouette |
| Collectible | white/cyan glint | four-point pulse |
| Fabricator | amber tripod | tether/cargo motion |
| Sentinel | magenta crescent | forward weapon notch |
| Hostile shot | red-orange | dotted tail |
| Nova Charge | teal-white | spiral segmented trail |
| Dread Engine | violet/amber radial mass | rotating rings and pylons |

## HUD and scanner

- Upper left: score, live multiplier/chain countdown, high score, and field number
- Upper center: construction meter with 20 module ticks and explicit state label
- Upper right: hulls and Nova Charge count
- Lower right: circular scanner with shape-coded contacts, Vesper heading, Dread Engine bearing, and range rings
- Lower center: short status messages such as `SHARD SECURED`, `MODULE INSTALLED`, and `CHARGE INTERCEPTED`
- Pause overlay: controls, audio, accessibility, restart, and resume
- Hull Lost overlay: remaining hulls, preserved Nova inventory, and chain-reset status
- Arena Clear overlay: core award, active clear time, time bonus, hull bonus, field bonus, run total, and any extra-hull award

The HUD uses a modern condensed sans-serif typeface, scalable vector icons, safe-area margins, and a minimum 18 px equivalent body size at 1080p.

## Audio direction

- Web Audio engine tone responds continuously to thrust magnitude.
- Weapons and impacts use original synthesized transients with stereo positioning and distance rolloff.
- Every installed module adds a mechanical strike and another element to the adaptive rhythm bed.
- At 5, 10, 15, and 19 modules, original warning motifs escalate without speech spam.
- Predictive contact danger uses synchronized text and warning audio when the nearby Engine's closing speed crosses its threat threshold, with a 2.4-second cue cooldown.
- The disruption charge has a dedicated warning tone synchronized with its visible text and segmented ring; the expanding wave does not depend on speech.
- The optional Vesper flight guide uses browser speech synthesis for tutorial-step entry and training completion. Outside training, its mission-cue allowlist is limited to mission start, assembly critical, and Engine awake.
- The Dread Engine uses separate original low-pitch browser-synthesized dialogue at activation and destruction. No line, cadence, roar, performance, sample, or recording from the reference game is imitated.
- **Sound** is the master for Web Audio and all speech. The subordinate **Voice** preference defaults on when speech is supported, persists as `voidforge-guide-voice`, and never bypasses a muted Sound master.
- A new guide or Engine line may cancel or follow the current line according to the cue, but suppressed cues are consumed: muted, Voice-off, hidden, or unsupported events never form a backlog that plays after conditions change.
- Pause, page hide, game over, Skip, Sound mute, Voice off, and teardown cancel active speech.
- Dread Engine proximity adds a low pulse; damage removes layers until the core collapses.
- Browser and operating-system voice inventories vary. All guide and Engine text is original, and no recorded voice assets ship.

## Accessibility

- Reduced Motion: disables camera drift, zoom response, distortion, decorative Awakening/wave rotation, and most shake while preserving the static gameplay rings and their true radii
- Reduced Flashing: replaces full-screen flashes and additive warning pulses with steady, normal-blend warnings while retaining text, ring geometry, and timing
- Effect Intensity: Low / Standard / High particle and bloom presets
- Three scene-wide color-vision transforms plus shape-coded contacts and meters
- Master Sound plus a subordinate persisted Voice control on the first-flight title and in Help
- Rebindable keyboard actions and adjustable gamepad dead zone
- Toggle/hold options for primary fire; pause on focus loss
- Swappable touch handedness, safe-area-aware portrait/landscape layouts, and action targets sized for touch
- Device-appropriate visible tutorial copy, an always-available Skip action, and polite live announcements whenever spoken guidance is off or unavailable
- Every spoken tutorial or mission cue duplicates an authoritative visible coachmark or notice; speech is never required to play
- Critical alerts delivered by icon, text, and sound; no essential information depends on color or audio alone

## Game states and progression

Required states: title/attract, instructions, playing, paused, hull lost, arena clear, game over, and restart. Hull Lost and Arena Clear are explicit, short presentation phases layered over the field; they hide touch flight controls, reject gameplay input, and freeze the field/chain clock without a long cinematic. Arena Clear additionally rejects further scoring and enemy spawning, clears pending boss hazards, and preserves score, hulls, Nova Charges, extra-hull progress, and high score into the next field. First-run guidance and the timed Dread Engine Awakening remain event-driven phases within playing. Pause freezes lifecycle and boss timers; reset, destruction, and game over cannot leave a pending disruption attack alive. The title enters a silent, non-scoring gameplay attract demonstration after 10 idle seconds; its deterministic 30-second loop gives mining, construction, pursuit, and disruption 7.5 seconds each, and takeover starts a fresh normal run. The first release contains a complete **Cinder Expanse** arena. Repeated clears modestly increase coordination, speed, scarcity, and interception behavior before increasing raw enemy count. Additional named arenas are deferred until their fiction, palettes, and modifiers can be developed as original material.

## Performance and verification

- Maintain near 60 FPS at 1920×1080 during maximum encounter density on a representative mid-range desktop.
- Render the post-processing pass at half resolution at 4K. The checked-in short profile captures report 60 FPS average and a 16.8 ms p95 at 4K, but remain point-in-time samples rather than representative-hardware certification.
- Pool projectiles, fragments, and particles; avoid per-frame allocations in hot paths.
- Cap simultaneously visible particles by accessibility preset and device performance.
- Capture 1920×1080 and 3840×2160 frames for exploration, mining, construction, dense combat, pursuit, multi-hit damage, destruction, and game over.
- Verify that player, shards, enemies, charges, hostile shots, and scanner contacts remain identifiable in every capture.
- Browser QA for the climax additionally verifies retained control during Awakening, no premature pursuit/contact damage, contact warnings only inside 560 units while closing faster than 95 units per second with a 2.4-second anti-spam interval, synchronized disruption text/audio/ring warnings, the swept wave hit, and safe Reduced Motion/Reduced Flashing variants. These dynamic checks are not inferred from the frozen screenshot matrix.
- Browser mobile-viewport and pointer-event checks cover portrait/landscape layout, pointer capture and cancellation, safe-area rules, and background auto-pause. Physical-device mobile Safari and Chrome validation remains pending.
- Automated simulation tests cover forgiving held-fire mining, extraction, collection, delivery, activation, homing/interception, boss damage, death/respawn, canonical scoring, arena completion, tutorial event ordering, persistence resolution, and deterministic tutorial overrides. `tests/arcade-run.test.mjs` covers multiplier timing, rounding, multi-threshold extra hulls, the five-hull cap, Hull Lost reset, and the exact Arena Clear formula. `tests/boss-behavior.test.mjs` separately covers the 2.5-second Awakening countdown, bounded pursuit prediction, and swept radial collision helpers exported by `app/game/boss-behavior.mjs`.
- `app/game/sentinel-behavior.mjs` isolates immutable role allocation and attack cadence from Pixi. `tests/sentinel-behavior.test.mjs` verifies interception priority, construction-driven guard growth without population growth, sanitized state, phase freezing, exactly three spaced shots, and no charge/breakaway fire.
- `app/game/input-settings.mjs` isolates sanitized persisted calibration and merged input routing. `tests/input-settings.test.mjs` verifies immutable defaults, conflict-swapping rebinds, reserved-key rejection, 5%–40% radial dead-zone behavior, nonzero connected-pad slots, hold/toggle edges, and lock/reset cleanup.
- Pinned `tutorial=move|mine|collect|threat` modes provide stable coachmarks for desktop and `touch=1` portrait/landscape visual checks; showcase and profile runs remain tutorial-free unless explicitly overridden.
- Spoken-guidance tests cover all four tutorial steps, the mission-cue allowlist, original Engine dialogue, the `voidforge-guide-voice` storage contract, once-per-run delivery, and no backlog for muted, disabled, hidden, or unsupported cues.
- Browser QA must verify the compact Voice controls on first flight and in Help, Sound-master precedence, active-speech cancellation on pause/page hide/game over/Skip/mute/Voice off/teardown, and visible/live-region fallback with speech unavailable.

## Definition of done

A player can learn the controls through the four-stage guided flight, optionally hear its original Vesper guide, skip or replay it, mine and contest resources, survive construction-aware Sentinel guarding and telegraphed three-shot attacks, build and lose a visible score chain, earn capped extra hulls, witness all 20 construction steps and warning milestones, retain control through Awakening, evade bounded predicted pursuit and the telegraphed disruption wave, destroy the Dread Engine with interceptable Nova Charges, read the scored Arena Clear summary, carry the run into another field, lose all hulls, compare the persisted high score, and restart. Keyboard bindings, gamepad calibration, and hold/toggle fire behavior persist beneath safe defaults. Voice state persists beneath the Sound master, suppressed speech never creates a backlog, and all guidance remains available visually and through the live-region fallback. Normal tutorial completion persists without contaminating QA overrides, the browser console is clean, controls work on keyboard, gamepad, and browser-verified touch layouts, M toggles the Sound master, blur safely pauses active play, accessibility settings take effect immediately, and the game remains readable at both target resolutions.
