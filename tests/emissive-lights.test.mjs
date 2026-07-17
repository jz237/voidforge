import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EMISSIVE_LIGHT_KINDS,
  MAX_EMISSIVE_LIGHTS,
  projectEmissiveLight,
  resolveEmissiveLightLimit,
  selectEmissiveLights,
} from "../app/game/emissive-lights.mjs";

const approximately = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

const candidate = (id, kind, urgency, extra = {}) => ({
  id,
  kind,
  x: 0.5,
  y: 0.5,
  radius: 0.1,
  intensity: 0.5,
  urgency,
  color: 0x66ddff,
  ...extra,
});

test("emissive kinds and shader budget are stable", () => {
  assert.equal(MAX_EMISSIVE_LIGHTS, 4);
  assert.equal(Object.isFrozen(EMISSIVE_LIGHT_KINDS), true);
  assert.deepEqual(Object.values(EMISSIVE_LIGHT_KINDS), [
    "player",
    "boss",
    "impact",
    "nova",
    "hostileProjectile",
    "sentinel",
    "mining",
    "loadedFabricator",
    "crystal",
  ]);
});

test("preset limits disable lights for FX Off and High Contrast", () => {
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 0 }), 0);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 1, highContrast: true }), 0);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 0.35 }), 1);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 0.7 }), 3);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 1 }), 4);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: 1, compact: true }), 2);
  assert.equal(resolveEmissiveLightLimit({ effectIntensity: Number.NaN }), 4);
});

test("world projection uses screen-space coordinates and height-normalized radius", () => {
  const projected = projectEmissiveLight({
    id: "player",
    kind: EMISSIVE_LIGHT_KINDS.PLAYER,
    worldX: 400,
    worldY: 300,
    radiusWorld: 90,
    intensity: 0.75,
    urgency: 1,
    color: 0x3366ff,
  }, {
    width: 1920,
    height: 1080,
    worldScale: 1.5,
    offsetX: 360,
    offsetY: 90,
  });

  assert.notEqual(projected, null);
  approximately(projected.x, 0.5);
  approximately(projected.y, 0.5);
  approximately(projected.radius, 0.125);
  assert.deepEqual(projected.color, [0x33 / 255, 0x66 / 255, 1]);
  assert.equal(Object.isFrozen(projected), true);
  assert.equal(Object.isFrozen(projected.color), true);
});

test("projection rejects off-screen centers instead of clamping to an edge", () => {
  const base = {
    id: "boss",
    kind: EMISSIVE_LIGHT_KINDS.BOSS,
    worldY: 500,
    radiusWorld: 800,
    intensity: 1,
  };
  const projection = { width: 1000, height: 1000, worldScale: 1, offsetX: 0, offsetY: 0 };
  assert.equal(projectEmissiveLight({ ...base, worldX: -61 }, projection), null);
  assert.equal(projectEmissiveLight({ ...base, worldX: 1061 }, projection), null);
  assert.notEqual(projectEmissiveLight({ ...base, worldX: -60 }, projection), null);
  assert.equal(projectEmissiveLight(base, { ...projection, width: 0 }), null);
});

test("selection reserves the player, phase, tactical, and mission roles", () => {
  const selected = selectEmissiveLights([
    candidate("crystal", EMISSIVE_LIGHT_KINDS.CRYSTAL, 1),
    candidate("player", EMISSIVE_LIGHT_KINDS.PLAYER, 0.2),
    candidate("boss", EMISSIVE_LIGHT_KINDS.BOSS, 0.1),
    candidate("nova", EMISSIVE_LIGHT_KINDS.NOVA, 0.4),
    candidate("impact", EMISSIVE_LIGHT_KINDS.IMPACT, 0.9),
    candidate("mining", EMISSIVE_LIGHT_KINDS.MINING, 0.2),
  ], { limit: 4 });

  assert.deepEqual(selected.map(({ id }) => id), ["player", "boss", "impact", "crystal"]);
  assert.equal(Object.isFrozen(selected), true);
  assert.ok(selected.every(Object.isFrozen));
});

test("compact and low-FX caps preserve the Vesper anchor", () => {
  const candidates = [
    candidate("threat", EMISSIVE_LIGHT_KINDS.HOSTILE_PROJECTILE, 1),
    candidate("boss", EMISSIVE_LIGHT_KINDS.BOSS, 1),
    candidate("player", EMISSIVE_LIGHT_KINDS.PLAYER, 0),
  ];
  assert.deepEqual(
    selectEmissiveLights(candidates, { compact: true, effectIntensity: 1 }).map(({ id }) => id),
    ["player", "boss"],
  );
  assert.deepEqual(
    selectEmissiveLights(candidates, { effectIntensity: 0.35 }).map(({ id }) => id),
    ["player"],
  );
  assert.deepEqual(selectEmissiveLights(candidates, { effectIntensity: 0 }), []);
});

test("retention hysteresis prevents small urgency changes from churning a slot", () => {
  const selected = selectEmissiveLights([
    candidate("retained", EMISSIVE_LIGHT_KINDS.IMPACT, 0.5),
    candidate("new", EMISSIVE_LIGHT_KINDS.IMPACT, 0.55),
  ], { limit: 1, previousIds: ["retained"] });
  assert.deepEqual(selected.map(({ id }) => id), ["retained"]);

  const decisive = selectEmissiveLights([
    candidate("retained", EMISSIVE_LIGHT_KINDS.IMPACT, 0.5),
    candidate("new", EMISSIVE_LIGHT_KINDS.IMPACT, 0.7),
  ], { limit: 1, previousIds: ["retained"] });
  assert.deepEqual(decisive.map(({ id }) => id), ["new"]);
});

test("selection is deterministic, rejects malformed values, and leaves inputs untouched", () => {
  const valid = candidate("valid", EMISSIVE_LIGHT_KINDS.MINING, 0.7, {
    x: 0.3,
    color: [1.4, -1, Number.NaN],
  });
  const inputs = [
    null,
    [],
    candidate("offscreen", EMISSIVE_LIGHT_KINDS.BOSS, 1, { x: -0.2 }),
    candidate("zero", EMISSIVE_LIGHT_KINDS.IMPACT, 1, { intensity: 0 }),
    { ...valid, id: "" },
    { ...valid, kind: "unknown" },
    valid,
  ];
  const snapshot = structuredClone(inputs);
  const forward = selectEmissiveLights(inputs, { limit: 4 });
  const reversed = selectEmissiveLights([...inputs].reverse(), { limit: 4 });

  assert.deepEqual(forward.map(({ id }) => id), ["valid"]);
  assert.deepEqual(reversed, forward);
  assert.deepEqual(forward[0].color, [1, 0, 1]);
  assert.deepEqual(inputs, snapshot);
  assert.deepEqual(selectEmissiveLights(null), []);
  assert.equal(Object.isFrozen(selectEmissiveLights(null)), true);
});

test("post effect keeps four analytic lights in one positive, alpha-preserving pass", async () => {
  const [postFx, component] = await Promise.all([
    readFile(new URL("../app/game/postfx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/VoidforgeGame.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(postFx, /uniform vec4 uEmissiveGeometry\[4\]/);
  assert.match(postFx, /uniform vec4 uEmissiveColorIntensity\[4\]/);
  assert.match(postFx, /type: "vec4<f32>",[\s\S]{0,80}size: MAX_EMISSIVE_LIGHTS/);
  assert.match(postFx, /emissiveAccumulation \/ \(vec3\(1\.0\) \+ emissiveAccumulation \* 1\.7\)/);
  assert.match(postFx, /color \+= emissiveLift \* \(vec3\(1\.0\) - clamp\(color, 0\.0, 1\.0\)\)/);
  assert.match(postFx, /finalColor = vec4\(color, base\.a\)/);
  assert.match(component, /presentationLayer\.filters = \[postFx\]/);
  assert.match(component, /app\.stage\.addChild\(presentationLayer, flashLayer\)/);
  assert.doesNotMatch(component, /app\.stage\.filters = \[postFx\]/);
});
