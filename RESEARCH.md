# VOIDFORGE Research Notes

Research date: 2026-07-16  
Status: pre-production reference, not a reproduction specification

## Purpose and boundary

`VOIDFORGE` is an original browser arcade game. It studies the resource race and phase change that make *Sinistar* tense: the player and enemies compete for mined material while a large threat is visibly assembled. It does **not** reproduce Williams artwork, characters, names, dialogue, sound recordings, cabinet graphics, source code, or exact screen layouts.

Historical facts below are separated from project assumptions. The Williams manual is the primary source; secondary references are used for details the manual does not quantify.

## Verified historical mechanics

- The player flies a ship through a scrolling space field, mines drifting planetoids by firing at them, and collects released crystals. Enemy Workers compete for those crystals and use them to construct the boss. ([Williams *Sinistar* instruction manual](https://www.gamesdatabase.org/Media/SYSTEM/Arcade/Manual/formated/Sinistar_-_1982_-_Williams%2C_Inc..pdf), pp. 6, 9)
- The cabinet's optical joystick reads direction and speed. Three optical sensors per axis produce 49 direction/speed combinations; moving farther from center increases acceleration. The game also provides separate fire and special-bomb actions. (Williams manual, pp. 6, 9)
- The nearby playfield scrolls around a centrally presented ship, while a scanner represents a larger area and distinguishes major object classes. ([StrategyWiki walkthrough](https://strategywiki.org/wiki/Sinistar/Walkthrough#Controls_and_the_screen))
- Workers are primarily an economic threat: they collect loose crystals and return them to the construction site. Warriors are the direct combat pressure and can attack the player while mining is underway. ([StrategyWiki walkthrough](https://strategywiki.org/wiki/Sinistar/Walkthrough#The_nature_of_the_enemy))
- Construction completes after 20 pieces. Once active, the boss pursues the player; it takes 13 successful special-bomb hits to destroy because seven visual face pieces count as one damage section. ([StrategyWiki walkthrough](https://strategywiki.org/wiki/Sinistar/Walkthrough#The_Sinistar); [gameplay summary](https://en.wikipedia.org/wiki/Sinistar#Gameplay))
- A launched special bomb homes toward the boss but may be intercepted by planetoids or enemy craft. This makes launch position and distance tactically important. ([StrategyWiki walkthrough](https://strategywiki.org/wiki/Sinistar/Walkthrough#The_Sinistar))
- Destroying the boss advances to another zone. Later zones emphasize Workers, Warriors, planetoids, or scarcity; Workers can repair a damaged boss after the first zone. ([gameplay summary](https://en.wikipedia.org/wiki/Sinistar#Gameplay))
- Construction sounds, warnings, digitized speech, and a distinctive activation cue communicate the boss state without requiring the player to watch the build site. The cockpit cabinet used two sound boards and speakers for stereo presentation. (Williams manual, p. 6)

## Transferable design principles

These are observations derived from the verified mechanics, not claims about the original designers' intent.

1. **One resource creates both progress and danger.** Every loose shard is a potential player weapon or enemy construction unit.
2. **Mining creates exposure.** Extracting resources requires attention and a stable position while combat pressure continues.
3. **The world state changes in public.** Visible construction, scanner changes, and sound cues make the threat legible before activation.
4. **The climax is prepared, not granted.** Success during the chase depends on resources banked during the mining phase.
5. **Special ammunition is powerful but unreliable at range.** Interception turns positioning into part of the boss fight.
6. **Audio carries urgency.** Repeated construction sounds and escalating warnings let the player feel the countdown while looking elsewhere.

## Project design assumptions

The following are original choices to validate through playtesting:

- A 16:9 camera at a 1920×1080 design resolution will preserve situational awareness without making threats feel distant. Rendering scales responsively to 4K.
- The Cinder Expanse will use a 6,400×3,600 wrapping world, approximately six visible screens at default zoom.
- Twenty construction steps and 13 boss damage nodes are initial tuning values, retained as useful pacing baselines rather than presentation references.
- Keyboard movement maps digital input to six acceleration bands over a short ramp; an analog stick uses continuous magnitude with a small dead zone.
- Directional camera lead and a small threat-based zoom-out will replace the historically fixed framing.
- Mining rocks will have a heat/instability meter. Controlled bursts extract more shards; sustained fire destroys the rock and its remaining yield.
- The first playable Cinder Expanse run targets 4–6 minutes. Construction should normally activate around minute 2.5 if the player does not contest Fabricators.
- Readability takes priority over physical realism: objects use clear silhouettes, restrained effects, and non-color cues.

## Original visual language

- **Player — Vesper craft:** narrow ivory spearhead with cyan engine vanes; always points along its firing vector.
- **Resource — Flux Shards:** asymmetric crystalline splinters with a white core, cyan halo, and distinct four-point glint.
- **Minable bodies — fracture asteroids:** charcoal rock, amber stress veins, and persistent chipped regions.
- **Collectors — Fabricators:** compact amber tripod drones carrying a visibly tethered shard.
- **Attackers — Sentinels:** magenta crescent craft with a forward white weapon notch.
- **Boss — the Dread Engine:** a radial machine of offset rings, three long articulated pylons, and a central void. It has no face, skull, horns, mouth, or humanoid expression.
- **Special weapon — Nova Charge:** a player-built teal device that spirals toward the Dread Engine and leaves a segmented guidance trail.

Silhouette, motion, shape, icon, and audio all reinforce identity so color is never the sole signal.

## IP-safe replacement map

| Reference function | VOIDFORGE replacement | Deliberate separation |
| --- | --- | --- |
| Demonic face boss | Dread Engine | Abstract radial architecture; no face, horns, teeth, or eating animation |
| Named crystals and bombs | Flux Shards and Nova Charges | New names, geometry, effects, and audio |
| Worker ships | Fabricators | Tripod silhouette and tethered cargo behavior |
| Warrior ships | Sentinels | Crescent silhouette, burst fire, and flanking behavior |
| Player ship | Vesper | Original spearhead profile and animated maneuvering vanes |
| Famous speech and roar | Synthetic system transmissions | New wording, performance, processing, and sound design |
| Original HUD and scanner | Holographic tactical rail | Widescreen layout, vector symbology, and accessible status text |
| Original zone names | Cinder Expanse | New fiction, palette, layout, and progression framing |

## Research constraints

- No ROMs, extracted sprites, audio samples, fonts, traces, or source-code ports are used.
- Historical screenshots and recordings may inform broad pacing and visual hierarchy only; they are not production assets.
- Exact speeds, spawn tables, sprite sizes, and animation timings have not been treated as verified facts. They will be original tuning values.
- The 20-step/13-hit relationship is a mechanical reference point. It may change if testing shows a clearer or more enjoyable cadence.

## Acceptance questions for playtesting

- Can a new player explain the resource race after one attempt?
- Is each construction step noticeable through at least two channels: sight, scanner, text, or sound?
- Does boss activation feel caused by the preceding play rather than like a timer?
- Is a long-range Nova Charge visibly risky without feeling random?
- Can the player identify craft, shards, shots, and objectives during the busiest encounter at 1080p and 4K?
