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
| World | Native widescreen wrapping arena with directional camera lead and threat zoom |
| Graphics | Material-rich 2D WebGL art, atmospheric depth, intent-driven animation, projectile trails, damage states, and restrained cinematic post-processing |
| Interface | Widescreen holographic rail, player-relative scanner, threat status, vector icons, and explicit construction ticks |
| Audio | Original Web Audio synthesis, adaptive layers, spatial effects, and new transmissions |
| Controls | Analog stick plus six-band keyboard thrust ramp, rebinding, and adjustable dead zone |
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
- Use a fixed simulation step or accumulated bounded steps; clamp long browser frames to prevent tunneling and runaway AI.
- Pool shots, charges, enemy projectiles, debris, and high-frequency particles.
- Seed random generation for reproducible screenshots and automated scenarios.
- Treat 1920×1080 as the layout coordinate system; resolution and device pixel ratio affect render density, not mechanics.
- Keep haze, debris, terrain, pickups, enemies, the player, friendly shots, hostile shots, readability cues, and high effects in an explicit WebGL layer order so hazards never depend on display-list insertion timing.
- Run heat and shockwave refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, and color-vision transforms through the custom PixiJS v8 post-processing pipeline.
- Fall back gracefully when an optional filter is unavailable. Bloom, distortion, and grading must never gate play.

## Visual guardrails

- Gameplay silhouettes must read with bloom and color removed.
- Bright backgrounds remain behind a contrast mask or are repositioned away from active combat.
- Atmospheric haze and near/far debris add depth below the protected player, pickup, critical-projectile, and readability layers; decorative effects cannot hide hazards.
- Camera lead follows travel direction; nearby threats and the Dread Engine produce a smooth, bounded zoom-out.
- Rebuilt player, enemy, planetoid, and Dread Engine art uses readable material layers, emissive accents, and illuminated damage without weakening silhouettes.
- Vesper shield response, recoil, and muzzle flash remain localized around the ship and never replace collision or ammunition feedback.
- Mining pulses expose extraction timing, while crystal motion preserves a stable collectible silhouette and predictable pickup path.
- Directional speed streaks and debris/dust/star parallax respond to velocity; Fabricators and Sentinels use intent-driven poses for mining, carrying, pursuit, and attack instead of rigid sprite movement.
- Friendly, hostile, and Nova projectile trails retain distinct shapes and protected contrast at speed rather than relying only on hue.
- The Dread Engine's asymmetric clusters, targeting beam, and contained aura communicate orientation and attack intent without facial imagery.
- Sparks, shards, smoke, and plasma use typed visual behavior; expanding impact rings and shockwaves remain subordinate to projectiles, pickups, and collision cues.
- Sentinel and Dread Engine damage overlays persist as readable combat-state changes rather than momentary particles alone.
- Localized heat and shockwave distortion, selective two-tap bloom, split-tone grading, and cinematic trauma/danger framing share the post-processing pipeline with scene-wide color-vision transforms.
- HUD threat status and the player-relative scanner redundantly identify immediate danger, contact type, bearing, and Dread Engine state.
- Screen shake is capped, localized where possible, and fully disabled by Reduced Motion.
- Full-screen white flashes are not used. Reduced Flashing is the safe default if preference detection is unavailable.
- Reduced Motion, Reduced Flashing, Effect Intensity, and FX Off directly scale or disable the matching shader, particle, camera, and motion cues.
- At 4K, assets gain detail but not smaller apparent size; HUD maintains its 1080p-equivalent measurements.
- Live verification holds 60 FPS at both 1920×1080 and 3840×2160; the 4K bombardment profile records a 16.8 ms p95 frame time.

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
- Keyboard and gamepad controls
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
- [ ] Keyboard and gamepad can complete the full loop.
- [ ] The Cinder Expanse can be won, lost, paused, restarted, and advanced without console errors.
