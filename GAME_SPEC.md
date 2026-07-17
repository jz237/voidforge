# VOIDFORGE Game Specification

Version: 0.1  
Title: **VOIDFORGE**  
Genre: high-resolution multidirectional arcade shooter

## Product goal

Build a polished, immediately playable browser game about piloting the Vesper to mine Flux Shards while enemy Fabricators use the same resource to assemble the Dread Engine. The experience should move from controlled extraction to mounting interference to a short, violent pursuit across the Cinder Expanse. All names, art, dialogue, music, effects, and code are original.

## Platform and rendering

- TypeScript, Vite, and PixiJS/WebGL
- Web Audio API for generated effects and adaptive layers
- Desktop Chrome, Edge, Firefox, and Safari; keyboard and standard gamepads
- 1920×1080 logical design space, responsive 16:9 presentation, sharp scaling through 3840×2160
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

The ship fires in its current travel/aim direction. Movement has acceleration, momentum, drag, and a fast reversal response.

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Thrust / steer | WASD or arrows | Left stick |
| Primary laser | Space | South face button / right trigger |
| Nova Charge | Shift or C | West face button / left trigger |
| Pause | P or Escape | Menu |
| Restart after game over | R | South face button |
| Mute | M | Settings only |

- Analog stick dead zone: 0.16; full thrust at 0.92.
- Keyboard input ramps through six thrust bands over 350 ms and falls through them over 220 ms, approximating variable-speed intent without claiming hardware emulation.
- Opposite input applies stronger braking before accelerating in the new direction.
- Control glyphs update to the last-used device.

## Player systems

- **Primary laser:** rapid precision fire; mines rocks and destroys small enemies but cannot directly damage the Dread Engine.
- **Mining heat:** hits raise asteroid fracture energy. The extraction band emits shards; overloading destroys the rock and any unextracted yield.
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
- Critical alerts delivered by icon, text, and sound; no essential information depends on color or audio alone

## Game states and progression

Required states: title/attract, instructions, playing, paused, hull lost, arena clear, game over, and restart. The first release contains a complete **Cinder Expanse** arena. Repeated clears modestly increase coordination, speed, scarcity, and interception behavior before increasing raw enemy count. Additional named arenas are deferred until their fiction, palettes, and modifiers can be developed as original material.

## Performance and verification

- Maintain near 60 FPS at 1920×1080 during maximum encounter density on a representative mid-range desktop.
- Render the post-processing pass at half resolution at 4K; the verified live 4K bombardment profile is 60 FPS average with a 16.8 ms p95 frame time.
- Pool projectiles, fragments, and particles; avoid per-frame allocations in hot paths.
- Cap simultaneously visible particles by accessibility preset and device performance.
- Capture 1920×1080 and 3840×2160 frames for exploration, mining, construction, dense combat, pursuit, multi-hit damage, destruction, and game over.
- Verify that player, shards, enemies, charges, hostile shots, and scanner contacts remain identifiable in every capture.
- Automated simulation tests cover extraction, collection, delivery, activation, homing/interception, boss damage, death/respawn, scoring, and arena completion.

## Definition of done

A player can learn the controls, mine and contest resources, witness all 20 construction steps, survive activation, destroy the Dread Engine with Nova Charges, clear the Cinder Expanse, lose all hulls, and restart. The browser console is clean, controls work on keyboard and gamepad, accessibility settings take effect immediately, and the game remains readable at both target resolutions.
