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
  assert.match(html, /Mission briefing/i);
  assert.match(html, /og:image/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the game, arcade-run layer, procedural audio, high-resolution art, and no starter preview", async () => {
  const [component, tutorial, guidance, arcadeRun, audio, styles, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/game/VoidforgeGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/tutorial.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/spoken-guidance.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/game/arcade-run.mjs", import.meta.url), "utf8"),
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
  assert.match(component, /aria-label="Skip first-run tutorial"/);
  assert.match(component, /Turn flight guide voice off/);
  assert.match(component, /speechSynthesis\.speak/);
  assert.match(component, /speechSynthesis\.cancel/);
  assert.match(guidance, /voidforge-guide-voice/);
  assert.match(guidance, /thirteen Nova charges/i);
  assert.match(component, /voidforge-high-score-v1/);
  assert.match(component, /Arena Clear/);
  assert.match(component, /showcase=arena-clear|scene === "arena-clear"/);
  assert.match(arcadeRun, /SCORE_CHAIN_WINDOW_SECONDS = 4\.5/);
  assert.match(arcadeRun, /FIRST_EXTRA_HULL_SCORE = 25_000/);
  assert.match(arcadeRun, /awardArenaClearBonus/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /max-height:\s*600px/);
  assert.match(styles, /\.tutorial-panel\b/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(audio, /class VoidforgeAudio/);
  assert.match(audio, /createOscillator/);
  assert.match(packageJson, /"pixi\.js": "8\.13\.2"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/assets/cosmic-arena.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await access(root);
});
