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
  assert.match(html, /Enter the Expanse|Calibrating field/i);
  assert.match(html, /Mission briefing/i);
  assert.match(html, /og:image/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the game, procedural audio, high-resolution art, and no starter preview", async () => {
  const [component, audio, packageJson] = await Promise.all([
    readFile(new URL("../app/game/VoidforgeGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/audio.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(component, /new PIXI\.Application/);
  assert.match(component, /navigator\.getGamepads/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /DREAD ENGINE/);
  assert.match(audio, /class VoidforgeAudio/);
  assert.match(audio, /createOscillator/);
  assert.match(packageJson, /"pixi\.js": "8\.13\.2"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/assets/cosmic-arena.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await access(root);
});
