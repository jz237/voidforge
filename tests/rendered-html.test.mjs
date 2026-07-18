import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the VOIDFORGE launch screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>VOIDFORGE — The Dread Engine Awaits(?: · VOIDFORGE)?<\/title>/i);
  assert.match(html, /A modern arcade odyssey/i);
  assert.match(html, /Start guided flight|Enter the Expanse|Calibrating field/i);
  assert.match(html, /data-testid="start-attract"/i);
  assert.match(html, /Watch mission loop/i);
  assert.match(html, /Mission briefing/i);
  assert.match(html, /og:image/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the game, closed Flux economy, tactical scanner, procedural audio, high-resolution art, and no starter preview", async () => {
  const [component, tutorial, guidance, arcadeRun, sentinelBehavior, inputSettings, resourceLiveness, fieldProgression, radarContacts, emissiveLights, mobileAssist, audio, styles, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/game/VoidforgeGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/tutorial.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/spoken-guidance.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/arcade-run.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/sentinel-behavior.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/input-settings.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/resource-liveness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/field-progression.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/radar-contacts.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/emissive-lights.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/mobile-assist.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/audio.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(component, /new PIXI\.Application/);
  assert.match(component, /navigator\.getGamepads/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /DREAD ENGINE/);
  assert.match(component, /Touch flight controls/);
  assert.match(component, /setPointerCapture/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /touchInput\.novaQueued = false/);
  assert.match(tutorial, /voidforge-tutorial-v1-complete/);
  assert.match(component, /\.get\("tutorial"\)/);
  assert.match(component, /data-testid="tutorial-panel"/);
  assert.match(component, /data-tutorial-step=/);
  assert.match(component, /data-testid="tutorial-skip"/);
  assert.match(component, /data-testid="tutorial-replay"/);
  assert.match(component, /Begin mission/);
  assert.match(component, /tutorial-gamepad-hint/);
  assert.match(component, /Gamepad A/);
  assert.match(tutorial, /tutorialGamepadAcknowledgeRequested/);
  assert.match(component, /aria-label="Skip first-run tutorial"/);
  assert.match(component, /Turn flight guide voice off/);
  assert.match(component, /data-testid="title-audio-controls"/);
  assert.match(component, /data-testid="title-help"/);
  assert.match(component, /Open flight manual before starting/);
  assert.match(component, /aria-label=\{muted \? "Unmute sound" : "Mute sound"\}/);
  assert.match(component, /role="img"/);
  assert.match(component, /Tactical scanner:/);
  assert.match(component, /speechSynthesis\.speak/);
  assert.match(component, /speechSynthesis\.cancel/);
  assert.match(guidance, /voidforge-guide-voice/);
  assert.match(guidance, /thirteen Nova charges/i);
  assert.match(component, /voidforge-high-score-v1/);
  assert.match(component, /Arena Clear/);
  assert.match(component, /showcase=arena-clear|scene === "arena-clear"/);
  assert.match(component, /data-testid="attract-mode"/);
  assert.match(component, /data-attract-phase=/);
  assert.match(component, /Take control/);
  assert.match(component, /Back to briefing/);
  assert.match(component, /className="field-modifier-strip"/);
  assert.match(component, /arena-identity-chip/);
  assert.match(component, /field-modifier-detail/);
  assert.match(component, /detail \? 4700 : 2850/);
  assert.match(component, /pressure tier/);
  assert.match(component, /build 01\.38/);
  assert.match(component, /resolveFlightProfile/);
  assert.match(component, /Shield · hulls/);
  assert.match(mobileAssist, /sentinelBoltSpeed: 300/);
  assert.match(mobileAssist, /integritySegments: 3/);
  assert.match(component, /selectEmissiveLights/);
  assert.match(component, /presentationLayer\.filters = \[postFx\]/);
  assert.match(component, /Control calibration/);
  assert.match(component, /Gamepad dead zone/);
  assert.match(component, /Press to toggle/);
  assert.match(component, /getTutorialInstruction/);
  assert.match(component, /suppressPressedInputEdges/);
  assert.match(component, /controlsLocked: controlsLocked \|\| localMode !== "playing" \|\| suppressPressedInputEdges/);
  assert.match(component, /inputSettingsRef\.current\.primaryFireMode === "toggle"/);
  assert.match(component, /sentinel\.view\.rotation = Math\.atan2\(attackDy, attackDx\)/);
  assert.match(component, /HELP_FOCUSABLE_SELECTOR/);
  assert.match(component, /inert=\{helpOpen \? true : undefined\}/);
  assert.match(component, /dismissHelp\(false\)/);
  assert.match(component, /helpReturnsToGameRef/);
  assert.match(component, /advanceSentinelBehavior/);
  assert.match(sentinelBehavior, /SENTINEL_BURST_SHOT_COUNT = 3/);
  assert.match(sentinelBehavior, /constructionProgress/);
  assert.match(inputSettings, /voidforge-input-settings-v1/);
  assert.match(inputSettings, /findFirstConnectedGamepad/);
  assert.match(inputSettings, /isRebindableKeyCode/);
  assert.match(inputSettings, /reduceInputState/);
  assert.match(component, /FLUX RESERVE COLLAPSE/);
  assert.match(component, /NOVA HOLD FULL/);
  assert.match(component, /qa"\) === "flux-deficit/);
  assert.match(component, /ENGINE REPAIR \+1/);
  assert.match(component, /radar-mobile-status/);
  assert.match(resourceLiveness, /assessFluxLiveness/);
  assert.match(resourceLiveness, /recommendedRecoveryShardCount/);
  assert.match(fieldProgression, /FORGE WAKE/);
  assert.match(fieldProgression, /RAZOR VEIL/);
  assert.match(fieldProgression, /SHARD REEF/);
  assert.match(fieldProgression, /ARENA_ARCHETYPE_COUNT = 4/);
  assert.match(fieldProgression, /repairEnabled: sanitizedFieldNumber > MIN_FIELD_NUMBER/);
  assert.match(radarContacts, /selectRadarCandidates/);
  assert.match(radarContacts, /projectRadarContact/);
  assert.match(emissiveLights, /MAX_EMISSIVE_LIGHTS = 4/);
  assert.match(emissiveLights, /resolveEmissiveLightLimit/);
  assert.match(emissiveLights, /projectEmissiveLight/);
  assert.match(arcadeRun, /SCORE_CHAIN_WINDOW_SECONDS = 4\.5/);
  assert.match(arcadeRun, /FIRST_EXTRA_HULL_SCORE = 25_000/);
  assert.match(arcadeRun, /awardArenaClearBonus/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /max-height:\s*600px/);
  assert.match(styles, /\.tutorial-panel\b/);
  assert.match(styles, /\.attract-overlay\b/);
  assert.match(styles, /\.field-modifier-chip\b/);
  assert.match(styles, /\.center-alert\.has-detail\b/);
  assert.match(styles, /\.touch-enabled \.field-modifier-detail:last-child/);
  assert.match(styles, /@media \(min-width: 2600px\)[\s\S]*\.title-screen/);
  assert.match(styles, /\.control-settings\b/);
  assert.match(styles, /\.help-dialog-header\b/);
  assert.match(styles, /canvas:focus-visible/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(audio, /class VoidforgeAudio/);
  assert.match(audio, /createOscillator/);
  assert.match(audio, /bossAwakening/);
  assert.match(packageJson, /"pixi\.js": "8\.13\.2"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/assets/cosmic-arena.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await access(root);
});
