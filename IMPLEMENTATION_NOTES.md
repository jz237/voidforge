# VOIDFORGE Implementation Notes

## Creative intent

`VOIDFORGE` preserves one abstract dramatic structure: mine a contested resource, watch enemies turn that resource into a threat, then spend the player's stockpile to survive the threat. Everything that expresses that structure—setting, title, entities, silhouettes, interface, writing, sound, effects, timing, and code—is newly created.

This document records deliberate differences from *Sinistar*. It is a production boundary, not legal advice.

## Deliberate differences

| Area | VOIDFORGE decision |
| --- | --- |
| Title and fiction | Original `VOIDFORGE` setting centered on failed containment and Flux mining in the Cinder Expanse |
| Boss | Dread Engine: abstract concentric rings, offset pylons, and a void core; never a demonic face |
| Boss attack | Predictive pursuit and a radial disruption wave; no mouth, bite, consumption, skull, horns, or roar |
| Player | High-resolution ivory/cyan Vesper with articulated engine vanes |
| Enemies | Amber tripod Fabricators and magenta crescent Sentinels with new behaviors |
| Resource/weapon | Flux Shards become spiral-guided Nova Charges; new forms, names, trails, and sounds |
| Construction | Radial machine modules align around a scaffold; no facial assembly |
| World | Native widescreen wrapping arena with directional camera lead, threat zoom, story landmarks, and persistent wreckage |
| Graphics | Material-family 2D WebGL art, headroom-gated 4K microdetail, intent-driven animation, staged damage, and restrained cinematic post-processing |
| Interface | Contextual holographic HUD, player-relative radar trails, targeting brackets, off-screen warnings, and explicit construction ticks |
| Audio | Original Web Audio synthesis, adaptive layers, a restrained visual-cadence envelope, spatial effects, and new transmissions |
| Controls | Keyboard/gamepad plus responsive touch twin sticks, six-band thrust, independent aim/held fire, one-tap Nova, and swappable handedness |
| Accessibility | Reduced motion/flashing, color-vision presets, effect levels including FX Off, redundant alerts, and audio controls |
| Progression | The Cinder Expanse uses original fiction, palette, layout, and escalating modifiers |

## Similar mechanics retained intentionally

- A shared mineable resource creates a race between player ammunition and enemy construction.
- Collector enemies visibly transport resources to the build site.
- Direct attackers interrupt mining and can defend the construction effort.
- A scanner connects local action to a world larger than the viewport.
- Special ammunition homes toward the large threat and can be intercepted.
- Construction has approximately 20 readable steps and the active threat initially needs approximately 13 successful hits.

These are system-level starting points. Names, audiovisual expression, exact tuning, AI rules, spatial layout, and feedback are original and data-driven. Counts may change after playtesting.

## Asset and content policy

- Do not download or ship ROM data, reference-game source code, sprites, screenshots, fonts, cabinet art, sound samples, voice clips, music, logos, or trademarks.
- Do not trace screenshots or reproduce sprite geometry at higher resolution.
- Create all raster assets specifically for this project, or render original shapes procedurally.
- Record the source and license of any third-party font, texture, or library in the repository before use.
- Keep research references outside the runtime bundle.
- Avoid the reference game's famous dialogue, close paraphrases, vocal cadence, and roar design. Approved activation copy is `Containment has failed.`
- Avoid using `Sinistar`, `Sinibomb`, `Sinisite`, its zone names, or Williams branding in shipped UI, metadata, filenames, and asset identifiers.

## Technical choices

- PixiJS is preferred over Phaser because the current project already includes it and the design benefits from explicit render-layer and shader control.
- Simulation state should remain independent of Pixi display objects so mechanics can be tested deterministically.
- Keep touch state outside the React render hot path. Pointer capture carries a stick drag beyond its pad, while pointer up, cancellation, lost capture, focus loss, page hide, and orientation changes clear held movement and fire state.
- Use safe-area insets and orientation-specific responsive layout rules for both phone portrait and landscape. Touch options expose a Swap control for southpaw placement without changing keyboard or gamepad bindings.
- Keep the four-stage tutorial state machine in `app/game/tutorial.mjs`, independent of Pixi and input hardware. It records movement, extraction, and collection facts so actions performed before their coachmark still satisfy the corresponding stage.
- Suppress Fabricator deposits only while the training overlay is active, protect the tutorial pickup from worker claims, and give that pickup priority in the existing targeting reticle. Normal simulation resumes immediately after Skip or Begin mission.
- Store ordinary completion or Skip under the versioned `voidforge-tutorial-v1-complete` key. Help replay and every explicit `tutorial` query override are non-persistent; valid overrides take precedence, while showcase/profile runs suppress onboarding by default.
- Use a fixed simulation step or accumulated bounded steps; clamp long browser frames to prevent tunneling and runaway AI.
- Let rapid held fire continue accumulating mining progress so touch players cannot become stuck, while retaining the higher integrity cost that makes short controlled bursts more efficient.
- Pool or cap shots, charges, enemy projectiles, persistent wreckage, debris, and high-frequency particles.
- Seed random generation for reproducible screenshots and automated scenarios.
- Treat 1920×1080 as the layout coordinate system; resolution and device pixel ratio affect render density, not mechanics.
- Keep haze, story landmarks, debris, terrain, wreckage, pickups, enemies, the player, friendly shots, hostile shots, targeting/warning cues, and high effects in an explicit WebGL layer order so hazards never depend on display-list insertion timing.
- Prebuild optional microdetail and enable it only at high render density with sustained frame-time headroom; detail changes must never alter collision geometry or silhouettes.
- Derive restrained visual cadence from the original adaptive score envelope, with a deterministic clock before browser audio unlocks.
- Run heat and shockwave refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, and color-vision transforms through the custom PixiJS v8 post-processing pipeline.
- Fall back gracefully when an optional filter is unavailable. Bloom, distortion, and grading must never gate play.

## Visual guardrails

- Gameplay silhouettes must read with bloom and color removed.
- Bright backgrounds remain behind a contrast mask or are repositioned away from active combat.
- Atmospheric haze, near/far debris, abandoned rigs, relays, slag fields, and wreck landmarks add narrative depth below the protected player, pickup, critical-projectile, and readability layers.
- Camera lead follows travel direction; speed streaks and delayed Vesper echoes communicate acceleration, while nearby threats and the Dread Engine produce a smooth, bounded zoom-out.
- Player, enemy, planetoid, and Dread Engine art uses distinct composite, mineral, industrial, and containment material families. Fine panel, fastener, inclusion, and conduit detail appears only at 4K with sufficient measured headroom.
- Vesper shield response, recoil, and muzzle flash remain localized around the ship and never replace collision or ammunition feedback.
- Mining pulses expose extraction timing, while crystal motion preserves a stable collectible silhouette and predictable pickup path.
- Directional speed streaks and debris/dust/star parallax respond to velocity; Fabricators and Sentinels use intent-driven poses for mining, carrying, pursuit, and attack instead of rigid sprite movement.
- Friendly, hostile, and Nova projectile trails retain distinct shapes and protected contrast at speed rather than relying only on hue.
- Fracture stages, disabled systems, persistent capped wreckage, exposed conduits, scorch nodes, and per-hit module disassembly make damage readable after transient effects fade.
- The Dread Engine's asymmetric clusters, targeting beam, and contained aura communicate orientation without facial imagery; lock, surge, and vent phases telegraph changes in pursuit intent.
- Sparks, shards, smoke, and plasma use typed visual behavior; expanding impact rings and shockwaves remain subordinate to projectiles, pickups, and collision cues.
- Sentinel and Dread Engine damage overlays persist as readable combat-state changes rather than momentary particles alone.
- Localized heat and shockwave distortion, selective two-tap bloom, split-tone grading, and cinematic trauma/danger framing share the post-processing pipeline with scene-wide color-vision transforms.
- The adaptive-score envelope synchronizes restrained conduit, beacon, reticle, and machinery cadence; Reduced Flashing replaces luminance pulses with stable states.
- Contextual HUD status, player-relative radar trails, protected targeting brackets, and persistent boss/Sentinel/projectile edge warnings redundantly identify danger, contact type, motion, bearing, and Dread Engine state.
- Screen shake is capped, localized where possible, and fully disabled by Reduced Motion.
- Full-screen white flashes are not used. Reduced Flashing is the safe default if preference detection is unavailable.
- Reduced Motion, Reduced Flashing, High Contrast, Effect Intensity, FX Off, and automatic microdetail gating directly scale or disable matching shader, particle, camera, motion, and decorative-detail cues without hiding essential warnings.
- At 4K, assets gain detail but not smaller apparent size; HUD maintains its 1080p-equivalent measurements.
- The particle-heavy bombardment profile measures 60 FPS at both 1920×1080 and 3840×2160; the 4K run records a 16.8 ms p95 frame time.

## Audio guardrails

- Synthesize or record all effects anew; do not process reference samples.
- Threat state must be readable without speech. Construction rhythm, warning tones, scanner animation, and text provide redundancy.
- Spatial rolloff must not hide critical warnings.
- Sub-bass is optional and separately adjustable.
- Browser audio begins only after user interaction and resumes safely after focus changes.

## First-release scope

Required for the first complete release:

- Title/attract screen and instructions
- One balanced Cinder Expanse arena with wrapping world and scanner
- Mining, shard collection, Fabricators, Sentinels, 20-step construction, activation, pursuit, interception, 13-node damage, destruction, and arena-clear transition
- Score, high score, three hulls, charge inventory, pause, game over, and restart
- Keyboard, gamepad, and responsive touch controls for phone portrait and landscape
- Four-stage, input-neutral first-run guidance with Skip, locally persisted completion, Help replay, and deterministic QA overrides
- Original synthesized effects and a minimal adaptive score
- Accessibility settings listed in `GAME_SPEC.md`
- Deterministic test mode, mechanic tests, browser smoke test, and the eight required screenshot states at 1080p and 4K

Deferred unless time permits: additional arena modifiers, persistent settings, elaborate attract-mode AI, extensive music layers, destructible asteroid meshes beyond staged overlays, and dynamic quality auto-scaling.

## Review checklist

- [ ] No protected names or branding appear in shipped content.
- [ ] The Dread Engine has no facial, skull, horn, mouth, or eating imagery.
- [ ] No reference assets or audio are present in the repository.
- [ ] Every critical state has visual, textual, and/or audio redundancy.
- [ ] Maximum-combat screenshots remain readable at 1080p and 4K.
- [ ] Reduced Motion, Reduced Flashing, and color-vision presets are verified in play.
- [ ] Keyboard, gamepad, and browser-simulated touch input can complete the full loop.
- [ ] Move, Extract, Collect, and Mission loop tutorial stages advance from gameplay events regardless of input device or action ordering.
- [ ] Normal completion and Skip persist once; Help replay and `tutorial=1|0|move|mine|collect|threat` do not alter the saved first-run result.
- [ ] Showcase/profile runs suppress the tutorial unless explicitly overridden, and pinned stage overrides remain stable for visual QA.
- [ ] Held fire can extract Flux, while short controlled bursts preserve more planetoid yield.
- [ ] Portrait and landscape touch layouts preserve safe areas; Swap supports southpaw play; cancellation and background paths release held input and pause safely.
- [ ] Validate touch on physical-device Safari and Chrome; current mobile coverage is limited to browser viewport and pointer-event verification.
- [ ] The Cinder Expanse can be won, lost, paused, restarted, and advanced without console errors.
