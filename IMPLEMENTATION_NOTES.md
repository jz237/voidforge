# VOIDFORGE Implementation Notes

## Creative intent

`VOIDFORGE` preserves one abstract dramatic structure: mine a contested resource, watch enemies turn that resource into a threat, then spend the player's stockpile to survive the threat. Everything that expresses that structure—setting, title, entities, silhouettes, interface, writing, sound, effects, timing, and code—is newly created.

This document records deliberate differences from *Sinistar*. It is a production boundary, not legal advice.

## Deliberate differences

| Area | VOIDFORGE decision |
| --- | --- |
| Title and fiction | Original `VOIDFORGE` setting centered on failed containment and Flux mining across four named arenas |
| Boss | Dread Engine: abstract concentric rings, offset pylons, and a void core; never a demonic face |
| Boss attack | A control-preserving Awakening, bounded predictive pursuit, and a telegraphed radial disruption wave; no mouth, bite, consumption, skull, horns, or roar |
| Player | High-resolution ivory/cyan Vesper with articulated engine vanes |
| Enemies | Amber tripod Fabricators and magenta crescent Sentinels with construction-aware guard/interception roles and a telegraphed three-shot cadence |
| Resource/weapon | Flux Shards become spiral-guided Nova Charges; new forms, names, trails, and sounds |
| Construction | Radial machine modules align around a scaffold; no facial assembly |
| World | Native widescreen bounded arena with directional camera lead, threat zoom, story landmarks, and persistent wreckage |
| Graphics | Material-family 2D WebGL art, headroom-gated 4K microdetail, intent-driven animation, staged damage, and restrained cinematic post-processing |
| Interface | Contextual holographic HUD, player-relative radar trails, targeting brackets, off-screen warnings, and explicit construction ticks |
| Audio | Original Web Audio synthesis, adaptive layers, spatial effects, optional browser-spoken Vesper guidance, and original low-pitch Engine dialogue |
| Controls | Keyboard/gamepad plus responsive touch twin sticks, six-band thrust, independent aim, one-tap Nova, swappable handedness, and persisted rebinding/dead-zone/hold-toggle calibration |
| Accessibility | Reduced motion/flashing, color-vision presets, effect levels including FX Off, redundant alerts, and audio controls |
| Progression | Cinder Expanse, Forge Wake, Razor Veil, and Shard Reef cycle through original fiction, tactical emphasis, palette, and layout across two bounded tiers |

## Similar mechanics retained intentionally

- A shared mineable resource creates a race between player ammunition and enemy construction.
- Collector enemies visibly transport resources to the build site.
- Direct attackers interrupt mining and can defend the construction effort.
- A scanner connects local action to a world larger than the viewport.
- Special ammunition homes toward the large threat and can be intercepted by planetoids, Sentinels, Fabricators, or hostile bolts.
- Construction has approximately 20 readable steps and the active threat initially needs approximately 13 successful hits.

These are system-level starting points. Names, audiovisual expression, exact tuning, AI rules, spatial layout, and feedback are original and data-driven. Counts may change after playtesting.

## Asset and content policy

- Do not download or ship ROM data, reference-game source code, sprites, screenshots, fonts, cabinet art, sound samples, voice clips, music, logos, or trademarks.
- Do not trace screenshots or reproduce sprite geometry at higher resolution.
- Create all raster assets specifically for this project, or render original shapes procedurally.
- Record the source and license of any third-party font, texture, or library in the repository before use.
- Keep research references outside the runtime bundle.
- Use only original project copy with browser/system speech synthesis. Do not ship recorded, sampled, cloned, or reference-derived guide or antagonist voice assets.
- Avoid the reference game's famous dialogue, close paraphrases, vocal cadence, and roar design. The shipped Engine lines—`Signal acquired. Vesper identified.` and `Containment lost. The forge is broken.`—are original project copy rendered only through browser/system speech.
- Avoid using `Sinistar`, `Sinibomb`, `Sinisite`, its zone names, or Williams branding in shipped UI, metadata, filenames, and asset identifiers.

## Technical choices

- PixiJS is preferred over Phaser because the current project already includes it and the design benefits from explicit render-layer and shader control.
- Simulation state should remain independent of Pixi display objects so mechanics can be tested deterministically.
- Keep touch state outside the React render hot path. Pointer capture carries a stick drag beyond its pad, while pointer up, cancellation, lost capture, focus loss, page hide, and orientation changes clear held movement and fire state.
- Use safe-area insets and orientation-specific responsive layout rules for both phone portrait and landscape. Touch preflight actions wrap without shrinking their 44px targets; short landscape keeps the arena name at 9px or larger and may suppress one redundant modifier. Touch options expose a Swap control for southpaw placement without changing keyboard or gamepad bindings.
- Keep the four-stage tutorial state machine in `app/game/tutorial.mjs`, independent of Pixi and input hardware. It records movement, extraction, and collection facts so actions performed before their coachmark still satisfy the corresponding stage.
- Resolve gamepad Mission-loop acknowledgement in that pure tutorial module. Accept only a rising south-face-button edge while the final coachmark is visible, then consume the shared fire edge until release so Hold and Toggle modes cannot leak a shot or latch into the mission.
- Suppress Fabricator deposits only while the training overlay is active, protect the tutorial pickup from worker claims, and give that pickup priority in the existing targeting reticle. Normal simulation resumes immediately after Skip or Begin mission.
- Store ordinary completion or Skip under the versioned `voidforge-tutorial-v1-complete` key. Help replay and every explicit `tutorial` query override are non-persistent; valid overrides take precedence, while showcase/profile runs suppress onboarding by default.
- Keep spoken cue copy and gating in `app/game/spoken-guidance.mjs`. Persist the subordinate Voice choice as `voidforge-guide-voice`, default it on only when speech synthesis is supported, and consume suppressed cue IDs so enabling audio later cannot release stale guidance.
- Keep deterministic Dread Engine timing and geometry helpers in `app/game/boss-behavior.mjs`. `advanceAwakeningCountdown` owns the clamped 2.5-second phase transition, `predictPursuitTarget` applies a caller-supplied lead inside world bounds, and `expandingWaveCrossedCircle` performs swept radial collision without tunneling.
- Keep score, chain, extra-hull, Hull Lost reset, and Arena Clear bonus transactions in `app/game/arcade-run.mjs`. The Pixi runtime owns presentation/timers, but every score mutation passes through the pure module so multi-threshold awards and the five-hull cap remain deterministic.
- Persist only the sanitized high score under `voidforge-high-score-v1`. New runs reset score and chain; field transitions preserve the run, charges, next hull threshold, and best score. Showcase, profile, and explicit tutorial-QA URLs never write the saved best.
- Count active field time only after training ends. Pause and Hull Lost freeze both field and chain clocks; Arena Clear snapshots the clock, locks scoring/spawning/input for 5.5 seconds, then resets the field clock and chain for the next pressure front.
- Keep the title-idle clock and four-phase loop in `app/game/attract-mode.mjs`. Start the silent demonstration after exactly 10 idle seconds, bound frame advancement after suspension, and cycle mining, construction, pursuit, and disruption for 7.5 seconds each.
- Treat attract play as disposable presentation state: disable score and high-score mutation, suppress game audio and speech, and let player input immediately replace it with a clean normal run.
- Resolve bounded field tuning through `app/game/field-progression.mjs`. Fields 1–4 establish Cinder scarcity, Forge Fabricator pressure, Razor Sentinel/interception pressure, and Shard planetoid density; Fields 5–8 repeat those identities at capped Tier II, and later fields keep cycling identity without unbounded growth. Field 2 still changes economic behavior before adding actors.
- Keep field profiles independent of rendering and deeply immutable. The runtime consumes their arena name/tagline/key, pressure tier and label, repair policy, HUD modifiers, palette accents, landmark variant, resource yield, AI biases, speed scales, and initial/cap counts without embedding progression policy in Pixi display objects.
- Keep Sentinel role allocation and attack timing in `app/game/sentinel-behavior.mjs`. Nova interception is resolved before guarding and player pressure; construction progress reallocates the current live population toward guards without adding actors. Once in range, a Sentinel advances through approach, charge, exactly three 0.12-second-spaced shot events, and breakaway before approaching again.
- Keep persisted control policy in `app/game/input-settings.mjs`. Sanitize the `voidforge-input-settings-v1` payload into deeply immutable keyboard bindings, a 5%–40% radial gamepad dead zone, and hold/toggle primary-fire behavior. Rebinding an occupied key swaps its previous slot, restricted browser/system keys are rejected, and locked/reset phases clear latches and consume held edges.
- Keep mandatory-phase resource accounting in `app/game/resource-liveness.mjs`. Construction counts only unmined, loose, and Fabricator-carried Flux; assault additionally counts stored and launched Novas. Spawn one warned bounded recovery body only when that accounting proves a deficit, and suppress recovery in tutorial, showcase, profile, paused, destroyed, and scoring-locked states.
- Keep contact projection and priority in `app/game/radar-contacts.mjs`. Retain one Engine bearing outside nominal range, then reserve nearest-crystal and nearest-planetoid visibility before filling the hard cap by hostile-projectile, Sentinel, loaded-Fabricator, Fabricator, and resource priority. Contact identity must remain shape-coded.
- Do not consume a loose crystal when the Nova hold is already full. Separate it from the Vesper and leave it available to the shared economy.
- Treat active-Engine repair as an explicit field policy. Field 01 spends post-activation Fabricator cargo without repair; later fields restore exactly one node per eligible delivery, clamp at full health, and expose the repair through persistent Engine part state, impact, text, and sound.
- Use a fixed simulation step or accumulated bounded steps; clamp long browser frames to prevent tunneling and runaway AI.
- During the 2.5-second Awakening, retain player control while braking the Engine and suppressing pursuit and boss contact damage. Afterward, derive pursuit lead as `clamp(distance / 1050, 0.42, 1.05)` seconds and clamp the target to 180 px world margins.
- Emit predictive contact text and warning audio only when the Engine is within 560 units and closing faster than 95 units per second; gate repeats behind a 2.4-second anti-spam cooldown.
- Start a 0.95-second disruption charge only inside 1080 range after cooldown. Expand its swept wave from radius 190 to 760 over 0.82 seconds, allow at most one unshielded hull loss per wave, then reset cooldown to `max(4.8, 6.4 - zone * 0.18)` seconds.
- Pause freezes all boss-phase state. World reset, Engine destruction, and game over clear Awakening, charge, wave, cooldown visuals, and pending collision state.
- Let rapid held fire continue accumulating mining progress so touch players cannot become stuck, while retaining the higher integrity cost that makes short controlled bursts more efficient.
- Pool or cap shots, charges, enemy projectiles, persistent wreckage, debris, and high-frequency particles.
- Seed random generation for reproducible screenshots and automated scenarios.
- Treat 1920×1080 as the layout coordinate system; resolution and device pixel ratio affect render density, not mechanics.
- Keep haze, story landmarks, debris, terrain, wreckage, pickups, enemies, the player, friendly shots, hostile shots, targeting/warning cues, and high effects in an explicit WebGL layer order so hazards never depend on display-list insertion timing.
- Prebuild optional microdetail and enable it only at high render density with sustained frame-time headroom; detail changes must never alter collision geometry or silhouettes.
- Derive restrained visual cadence from the original adaptive score envelope, with a deterministic clock before browser audio unlocks.
- Run heat and shockwave refraction, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, color-vision transforms, and a fixed four-source analytic emissive spill through one custom PixiJS v8 post-processing pass.
- Reserve local-light roles for Vesper, the visible Engine/phase anchor, one immediate tactical source, and one mission source before filling spare slots. Compact layouts use at most two sources, Low uses one, and FX Off/High Contrast use none. Reject off-screen centers instead of clamping them to an edge, retain stable IDs with hysteresis, and never promote individual particles into lights.
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
- The Dread Engine's asymmetric clusters, targeting beam, and contained aura communicate orientation without facial imagery. Ring alignment marks Awakening; velocity-led movement communicates pursuit; predictive collision danger uses text and warning audio; text, audio, and a segmented non-color ring telegraph disruption charge.
- Sparks, shards, smoke, and plasma use typed visual behavior. Decorative impact shockwaves remain subordinate to projectiles, pickups, and collision cues, while the disruption ring preserves its gameplay radius and priority.
- Sentinel and Dread Engine damage overlays persist as readable combat-state changes rather than momentary particles alone. Sentinel charge marks, three-shot spacing, and breakaway motion make the attack phase legible without relying on color.
- Localized heat and shockwave distortion, selective two-tap bloom, split-tone grading, cinematic trauma/danger framing, and bounded semantic emissive spill share the post-processing pipeline with scene-wide color-vision transforms. Local spill is strictly positive, hard capped, alpha preserving, and excluded from the flash-layer warning geometry.
- The adaptive-score envelope synchronizes restrained conduit, beacon, reticle, and machinery cadence; Reduced Flashing replaces luminance pulses with stable states.
- Contextual HUD status, player-relative radar trails, protected targeting brackets, and persistent boss/Sentinel/projectile edge warnings redundantly identify danger, contact type, motion, bearing, and Dread Engine state.
- Screen shake is capped, localized where possible, and fully disabled by Reduced Motion. Reduced Motion also stops decorative Awakening/wave rotation without hiding the gameplay ring.
- Full-screen white flashes are not used. Reduced Flashing is the safe default if preference detection is unavailable.
- During Awakening and disruption, Reduced Flashing uses steady normal-blend warning geometry instead of additive pulses; text and audio redundancy are unchanged.
- Reduced Motion, Reduced Flashing, High Contrast, Effect Intensity, FX Off, and automatic microdetail gating directly scale or disable matching shader, particle, camera, motion, and decorative-detail cues without hiding essential warnings.
- At 4K, assets gain detail but not smaller apparent size; the title, briefing, HUD, and overlays maintain 1080p-equivalent measurements.
- The checked-in short bombardment profile captures report 60 FPS at both 1920×1080 and 3840×2160 and a 16.8 ms 4K p95. They are point-in-time ticker samples, not a substitute for a longer representative-hardware stress run.

## Audio guardrails

- Synthesize or record all effects anew; do not process reference samples.
- Threat state must be readable without speech. Construction rhythm, warning tones, scanner animation, and text provide redundancy.
- Construction warnings fire at 5, 10, 15, and 19 installed modules. Disruption charge combines dedicated text, audio, and segmented ring geometry, and its expanding front remains readable without color or speech.
- Sound is the master for the Web Audio graph, Vesper guide, and Engine dialogue. Voice on/off is a persisted subordinate choice available on the first-flight title and in Help, while touch titles expose 44px Sound, Voice, and How to play controls on every visit so opening cues and onboarding honor returning-player preferences.
- Speak each tutorial stage once on entry from input-neutral original copy. Outside tutorial completion, guide mission cues are restricted to mission start, assembly critical, and Engine awake; Engine activation and destruction may use their separate original low-pitch dialogue.
- Muted, Voice-off, hidden, and unsupported cues are consumed without playback or queuing. Unmuting or re-enabling Voice never drains a stale backlog.
- Pause, page hide, game over, Skip, master mute, Voice off, and teardown cancel any active browser utterance.
- Visible coachmarks and notices are authoritative. When guide speech is disabled or unavailable, the polite live region remains active so no instruction or warning depends on browser speech.
- Browser/system voice selection and rendering vary by platform; do not depend on a particular installed voice, timbre, language variant, or timing.
- Spatial rolloff must not hide critical warnings.
- Engine activation layers one original sub-bass impact with a phone-audible harmonic beneath the existing visual/text warning; it fires once per activation and remains beneath the Sound master.
- The current release routes sub-bass beneath the Sound master; a separate sub-bass/mix control remains future work.
- Browser audio begins only after user interaction and resumes safely after focus changes.

## Current release scope

Shipped in build 01.38:

- A mobile-only flight response profile that preserves six thrust bands and the 535-unit top speed while reaching useful partial-stick bands earlier, accelerating more promptly, braking more cleanly, and turning faster
- Mobile Sentinel bolts reduced from 385 to 300 world units per second, fired from a 1,100-unit rather than 1,450-unit player-engagement range, and drawn 30% larger without increasing collision radius
- Three visible shield-integrity segments per mobile hull; two absorbed impacts each provide 1.1 seconds of grace and separating knockback before the third impact enters the existing Hull Lost flow
- Deterministic capability, tuning, thrust-curve, projectile-range, and three-impact damage tests with desktop legacy values locked

Shipped in build 01.37:

- Ambient title screen and instructions plus a silent, non-scoring attract demonstration after 10 idle seconds, with deterministic mining, construction, pursuit, and disruption phases and immediate fresh-run takeover
- A four-arena cycle: Cinder Expanse scarcity, Forge Wake Fabricator pressure, Razor Veil Sentinel/interception pressure, and Shard Reef planetoid density, repeated across two bounded tiers with late-field identity cycling
- A closed Flux economy with phase-aware reserve accounting, non-wasteful full inventory, and a telegraphed bounded recovery planetoid that cannot contaminate deterministic/non-scoring modes
- A priority-ranked player-relative scanner with persistent Engine bearing, hostile bolts, loaded/unloaded Fabricators, Sentinels, loose crystals, mineable planetoids, resource reservations, and retained touch status
- Mining, shard collection, Fabricators, construction-aware Sentinel pressure/guard/interception roles with a telegraphed three-shot cadence, 20-step construction with 5/10/15/19 warnings, a 2.5-second control-preserving Awakening, bounded predictive pursuit, telegraphed swept disruption waves, four-class Nova interception, 13-node damage, destruction, and arena-clear transition
- Field-policy repair: disabled in Field 01 and limited to one visibly/audibly restored node per eligible later-field loaded-Fabricator delivery
- Centralized chained scoring with a 1.00×–5.00× HUD multiplier, a locally persisted high score, extra hulls at 25,000 then every 50,000 points, the five-hull cap, and exact clear-time/remaining-hull bonuses
- Explicit 1.25-second Hull Lost and 5.5-second Arena Clear presentations, protected respawn, preserved score/charge inventory across a loss, scored clear breakdown, field-to-field run preservation, game over, and restart
- Keyboard, gamepad, and responsive touch controls for phone portrait and landscape, with persisted keyboard rebinding, 5%–40% gamepad dead-zone calibration, hold/toggle primary fire, conflict-safe swaps, default restoration, and consumed-edge gamepad completion of the final tutorial coachmark
- Four-stage, input-neutral first-run guidance with Skip, locally persisted completion, Help replay, deterministic QA overrides, enlarged phone tutorial copy/actions, and a preflight touch-title How to play action
- Optional browser-synthesized Vesper guide and original Engine dialogue, governed by persisted Voice under the master Sound control
- Original synthesized effects, a dedicated Engine-activation sub-bass/harmonic impact, and a minimal adaptive score
- Four-source desktop/two-source compact screen-space emissive lighting for Vesper, the Dread Engine, impacts/Nova/hostile attacks, mining, loaded cargo, and Flux, with deterministic semantic reservation, off-screen rejection, slot hysteresis, eased envelopes, and no extra render pass or texture read
- Accessibility settings listed in `GAME_SPEC.md`
- Deterministic test mode, attract-mode/field-progression/Sentinel-behavior/input-settings/arcade-run/core/boss-behavior mechanic tests, browser smoke test, the eight required screenshot states at 1080p and 4K, plus frozen `hull-lost` and `arena-clear` presentation scenes

## Remaining parity backlog

- Extend the adaptive score and audio layers (including independent mix/sub-bass controls), destructible planetoid presentation, and automatic quality scaling beyond the current staged overlays and headroom-gated microdetail.
- Complete physical-device Safari/Chrome touch validation and longer metadata-bearing 1080p/4K maximum-density profiles with automated thresholds. The existing short profile JSON files remain useful snapshots, not hardware certification.
- Add browser-level climax checks for retained Awakening control, suppression of premature pursuit/contact damage, predictive contact-warning thresholds and anti-spam, disruption text/audio/ring synchronization, pause freezing, reset/destruction/game-over cleanup, and Reduced Motion/Reduced Flashing behavior.

## Review checklist

- [ ] No protected names or branding appear in shipped content.
- [ ] The Dread Engine has no facial, skull, horn, mouth, or eating imagery.
- [ ] No reference assets or audio are present in the repository.
- [ ] Every critical state has visual, textual, and/or audio redundancy.
- [x] Deterministic boss tests cover the 2.5-second Awakening countdown, bounded pursuit prediction, and swept-wave collision without tunneling.
- [x] Deterministic arcade-run tests cover score rounding, the 4.5-second multiplier window, Hull Lost reset, multi-threshold extra hulls, the five-hull cap, and Arena Clear bonuses.
- [x] Deterministic attract-mode tests cover the 10-second idle boundary, bounded advancement, four-phase timing, and 30-second loop wrap.
- [x] Deterministic field-progression tests cover immutable profiles, four named tactical archetypes, two bounded tiers, late-field identity cycling, explicit repair policy, and hard speed/population caps.
- [x] Deterministic tutorial tests cover visible final-coachmark gamepad rising-edge acknowledgement and reject holds, hidden coachmarks, and earlier steps.
- [x] Deterministic Sentinel-behavior tests cover interception priority, construction-driven guard reallocation without count growth, immutable state, and the approach/charge/three-shot/breakaway cadence.
- [x] Deterministic input-settings tests cover safe persistence sanitization, immutable defaults, conflict-swapping rebinding, radial dead-zone calibration, connected-pad selection, and hold/toggle edge behavior.
- [x] Deterministic Flux-liveness tests cover construction/assault accounting, secure suppression, sanitization, immutable results, and bounded recovery sizing.
- [x] Deterministic radar tests cover Engine persistence, threat priority, resource reservations, caps, player-relative projection, ties, and malformed inputs.
- [x] Core delivery tests cover Field 01 repair denial, one-node eligible later-field repair, full-health clamping, and interleaved strike/deposit behavior.
- [ ] Browser play verifies no pursuit/contact damage during Awakening, predictive contact-warning thresholds and 2.4-second anti-spam, one unshielded hull loss per wave, and complete pause/reset/destruction/game-over cleanup.
- [ ] Disruption text, warning audio, and non-color ring remain synchronized and readable with Reduced Motion, Reduced Flashing, High Contrast, and FX Off.
- [x] Maximum-combat and lighting screenshots remain readable at 1080p and 4K, with four desktop sources and no warning-overlay filtering.
- [x] Reduced Motion, Reduced Flashing, High Contrast, FX Off, and every color-vision preset are browser-verified in play.
- [ ] Keyboard, gamepad, and browser-simulated touch input can complete the full loop.
- [ ] Browser play verifies rebound keys, persisted dead-zone and fire-mode choices, default restoration, and latch cleanup across pause, Hull Lost, Arena Clear, game over, and restart.
- [ ] Move, Extract, Collect, and Mission loop tutorial stages advance from gameplay events regardless of input device or action ordering.
- [ ] Voice defaults on only when supported, persists as `voidforge-guide-voice`, and is controllable from the first-flight title and Help.
- [ ] Sound master mute overrides game audio, Vesper guidance, and Engine dialogue without rewriting the subordinate Voice preference.
- [ ] Every tutorial stage speaks at most once per run; guide mission speech is limited to start, assembly critical, and Engine awake, plus separate original low-pitch Engine dialogue.
- [ ] Muted, Voice-off, hidden, and unsupported cues create no backlog; pause, page hide, game over, Skip, mute, Voice off, and teardown cancel active speech.
- [ ] Coachmarks/notices remain authoritative and the polite live-region fallback works with Voice off, Sound muted, and speech synthesis unavailable.
- [ ] Browser/system voice variation is acceptable, and no recorded, sampled, cloned, or reference-derived voice asset ships.
- [ ] Normal completion and Skip persist once; Help replay and `tutorial=1|0|move|mine|collect|threat` do not alter the saved first-run result.
- [ ] Showcase/profile runs suppress the tutorial unless explicitly overridden, and pinned stage overrides remain stable for visual QA.
- [ ] Held fire can extract Flux, while short controlled bursts preserve more planetoid yield.
- [ ] Portrait and landscape touch layouts preserve safe areas; Swap supports southpaw play; cancellation and background paths release held input and pause safely.
- [ ] Validate touch on physical-device Safari and Chrome; current mobile coverage is limited to browser viewport and pointer-event verification.
- [ ] Every named arena can be won, lost, paused, restarted, and advanced without console errors.
