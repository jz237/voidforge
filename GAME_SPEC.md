# VOIDFORGE Game Specification

Version: 0.1  
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
6. **Survive:** at 20 modules the Dread Engine activates, the camera opens slightly, and pursuit begins without removing player control.
7. **Strike:** launch homing Nova Charges. Terrain, Sentinels, Fabricators, and hostile fire can intercept them.
8. **Advance:** 13 successful hits overload the Dread Engine, clear the Cinder Expanse, and begin a new, harder run.

The player starts with three hulls. Losing a hull drops no stored charges, grants 2 seconds of spawn protection, and resumes in a nearby safe pocket. The run ends at zero hulls.

## Cinder Expanse tuning baseline

All values are data-driven and subject to playtesting.

| System | Initial value |
| --- | --- |
| World | 6,400×3,600, wrapping edges |
| Default camera | 1.0×; up to 15% zoom-out under severe threat |
| Asteroids | 22 active; 3–6 shards each |
| Fabricators | 5 active; respawn after 6–10 s |
| Sentinels | 2 active; pressure rises with build progress |
| Dread Engine construction | 20 delivered shards |
| Dread Engine durability | 13 charge hits |
| Charge inventory | 20 maximum |
| Expected first activation | 120–180 s without active containment |
| Expected arena duration | 4–6 min |

## Flight and controls

Movement has acceleration, momentum, drag, and a fast reversal response. Keyboard aim follows travel direction, while gamepad and touch right sticks can aim independently of thrust.

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Thrust / steer | WASD or arrows | Left stick | Left virtual stick |
| Aim | Travel direction | Right stick or travel direction | Right virtual stick |
| Primary laser | Space | South face button | Hold the right virtual stick |
| Nova Charge | Shift or C | East or west face button | Tap **Nova** |
| Pause | P or Escape | Menu | Tap **Pause** |
| Restart after game over | R | South face button | On-screen restart |
| Mute | M | Settings | Pause/options overlay |

- Keyboard, gamepad, and touch thrust are normalized into six output bands. Digital keyboard input reaches full thrust; analog stick distance selects lower bands.
- Opposite input applies stronger braking before accelerating in the new direction.
- On touch-capable phones, the default responsive layout is left-side thrust plus right-side aim and held fire. The right stick's aim vector remains independent of thrust.
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
- `?tutorial=1` forces the normal advancing flow and `?tutorial=0` suppresses it. `?tutorial=move|mine|collect|threat` forces and pins one deterministic stage; `threat` represents Mission loop. All explicit tutorial overrides take precedence and are non-persistent.
- In the absence of an explicit tutorial override, `?showcase=...` and `?profile=1` suppress onboarding so deterministic captures and performance samples remain unchanged.

## Player systems

- **Primary laser:** rapid precision fire; mines rocks and destroys small enemies but cannot directly damage the Dread Engine.
- **Mining heat:** hits raise asteroid fracture energy. Hits less than 145 ms apart still add 0.75 extraction progress, allowing held fire to emit shards, but deal two integrity damage instead of one; deliberate pulses add 1.0 progress and preserve more yield. Overloading destroys the rock and any unextracted crystals.
- **Nova Charge:** consumes one stored charge, acquires the active Dread Engine, curves toward it, and can be intercepted. No target means no launch and no ammo loss.
- **Damage:** one unshielded hostile projectile or Dread Engine collision costs a hull. Clear audiovisual warnings precede unavoidable high-speed contact.
- **Scoring:** shard +100; loaded Fabricator +250; Sentinel +400; Dread Engine node +750; core +10,000; clear-time and hull bonuses.

## Enemy behavior

### Fabricator

Uses a readable state machine: seek loose shard → tether cargo → route to the Dread Engine → install module → seek again. It avoids direct combat. Loaded drones glow and appear as distinct scanner icons. Destroying one releases its carried shard with inherited velocity.

### Sentinel

Selects among player pressure, Dread Engine guard, and charge interception. It approaches on a curved flank, pauses briefly before a three-shot burst, and breaks away after firing. At high construction progress, more Sentinels guard charge lanes rather than simply increasing projectile count.

### The Dread Engine

- **Dormant:** visible scaffold at a fixed world location; each delivered shard adds an animated module and an audible construction strike.
- **Awakening:** a 2.5-second in-world sequence with ring alignment, dimmed ambience, warning text, and a sub-bass impact. Player control remains active.
- **Pursuit:** accelerates toward predicted player position while its pylons rotate independently. It periodically emits a short-range disruption wave instead of using a mouth or eating attack.
- **Damage:** each Nova Charge breaks one armor node, changes the silhouette, exposes conduits, and modifies the engine timbre.
- **Destruction:** core collapse, expanding shock ring, large debris with no collision, then a short warp window.

## Camera and world presentation

- The camera follows smoothly with directional lead capped at 12% of viewport width.
- The player remains inside a central 40% safe region during ordinary flight.
- Threat zoom considers nearby projectiles and Dread Engine distance; transitions take at least 500 ms to avoid pumping.
- Parallax comprises directional distant stars, nebula/dust, and near motes. Background contrast stays below gameplay contrast.
- Impact shake is amplitude-capped and disabled by Reduced Motion.
- The awakening reveal uses lighting, zoom, audio, and HUD warnings; it never becomes a non-interactive cutscene.

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

- Upper left: score, multiplier, high score
- Upper center: construction meter with 20 module ticks and explicit state label
- Upper right: hulls and Nova Charge count
- Lower right: circular scanner with shape-coded contacts, Vesper heading, Dread Engine bearing, and range rings
- Lower center: short status messages such as `SHARD SECURED`, `MODULE INSTALLED`, and `CHARGE INTERCEPTED`
- Pause overlay: controls, audio, accessibility, restart, and resume

The HUD uses a modern condensed sans-serif typeface, scalable vector icons, safe-area margins, and a minimum 18 px equivalent body size at 1080p.

## Audio direction

- Web Audio engine tone responds continuously to thrust magnitude.
- Weapons and impacts use original synthesized transients with stereo positioning and distance rolloff.
- Every installed module adds a mechanical strike and another element to the adaptive rhythm bed.
- At 5, 10, 15, and 19 modules, original warning motifs escalate without speech spam.
- Awakening uses an original processed transmission: **“Containment has failed.”** No line, cadence, roar, or performance from the reference game is imitated.
- Dread Engine proximity adds a low pulse; damage removes layers until the core collapses.
- Audio, music, voice, and low-frequency intensity have separate controls.

## Accessibility

- Reduced Motion: disables camera drift, zoom response, distortion, and most shake
- Reduced Flashing: replaces full-screen flashes with localized halos and limits luminance transitions
- Effect Intensity: Low / Standard / High particle and bloom presets
- Three scene-wide color-vision transforms plus shape-coded contacts and meters
- Independent master, effects, music, voice, and bass controls
- Rebindable keyboard actions and adjustable gamepad dead zone
- Toggle/hold options for primary fire; pause on focus loss
- Swappable touch handedness, safe-area-aware portrait/landscape layouts, and action targets sized for touch
- Device-appropriate tutorial copy, an always-available Skip action, and polite live announcements for stage changes
- Critical alerts delivered by icon, text, and sound; no essential information depends on color or audio alone

## Game states and progression

Required states: title/attract, instructions, playing, paused, hull lost, arena clear, game over, and restart. First-run guidance is an event-driven overlay within playing rather than a separate blocking state or cutscene. The first release contains a complete **Cinder Expanse** arena. Repeated clears modestly increase coordination, speed, scarcity, and interception behavior before increasing raw enemy count. Additional named arenas are deferred until their fiction, palettes, and modifiers can be developed as original material.

## Performance and verification

- Maintain near 60 FPS at 1920×1080 during maximum encounter density on a representative mid-range desktop.
- Render the post-processing pass at half resolution at 4K; the verified live 4K bombardment profile is 60 FPS average with a 16.8 ms p95 frame time.
- Pool projectiles, fragments, and particles; avoid per-frame allocations in hot paths.
- Cap simultaneously visible particles by accessibility preset and device performance.
- Capture 1920×1080 and 3840×2160 frames for exploration, mining, construction, dense combat, pursuit, multi-hit damage, destruction, and game over.
- Verify that player, shards, enemies, charges, hostile shots, and scanner contacts remain identifiable in every capture.
- Browser mobile-viewport and pointer-event checks cover portrait/landscape layout, pointer capture and cancellation, safe-area rules, and background auto-pause. Physical-device mobile Safari and Chrome validation remains pending.
- Automated simulation tests cover forgiving held-fire mining, extraction, collection, delivery, activation, homing/interception, boss damage, death/respawn, scoring, arena completion, tutorial event ordering, persistence resolution, and deterministic tutorial overrides.
- Pinned `tutorial=move|mine|collect|threat` modes provide stable coachmarks for desktop and `touch=1` portrait/landscape visual checks; showcase and profile runs remain tutorial-free unless explicitly overridden.

## Definition of done

A player can learn the controls through the four-stage guided flight, skip or replay it, mine and contest resources, witness all 20 construction steps, survive activation, destroy the Dread Engine with Nova Charges, clear the Cinder Expanse, lose all hulls, and restart. Normal tutorial completion persists without contaminating QA overrides, the browser console is clean, controls work on keyboard, gamepad, and browser-verified touch layouts, accessibility settings take effect immediately, and the game remains readable at both target resolutions.
