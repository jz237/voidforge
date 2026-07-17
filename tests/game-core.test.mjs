import assert from "node:assert/strict";
import test from "node:test";

import {
  RULES,
  circlesOverlap,
  collectShard,
  depositFabricatorShard,
  homingVelocity,
  minePlanetoid,
  nextZone,
  normalizeControlVector,
  quantizeThrustMagnitude,
  seededRandom,
  strikeEngine,
} from "../app/game/core.mjs";

test("seeded simulation is deterministic", () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("careful mining releases a shard while rapid mining damages the planetoid", () => {
  const start = { integrity: 8, shards: 3, miningProgress: 1, lastHitAt: 0 };
  const careful = minePlanetoid(start, 500);
  const rapid = minePlanetoid(start, 100);
  assert.equal(careful.emitted, true);
  assert.equal(careful.planetoid.shards, 2);
  assert.equal(rapid.emitted, false);
  assert.equal(rapid.planetoid.integrity, 6);
});

test("held mobile fire still extracts Flux while short bursts remain more efficient", () => {
  let planetoid = { integrity: 8, shards: 4, miningProgress: 0, lastHitAt: -1000 };
  let emitted = 0;
  for (const hitAtMs of [0, 115, 230, 345, 460]) {
    const result = minePlanetoid(planetoid, hitAtMs);
    planetoid = result.planetoid;
    if (result.emitted) emitted += 1;
  }
  assert.equal(planetoid.integrity, 0);
  assert.equal(emitted, 2);
  assert.equal(planetoid.shards, 2);
});

test("charge inventory is capped", () => {
  const collected = collectShard({ charges: RULES.maxCharges, score: 0 });
  assert.equal(collected.charges, RULES.maxCharges);
  assert.equal(collected.score, 200);
});

test("fabricator deposits activate the Dread Engine at twenty pieces", () => {
  const run = depositFabricatorShard({
    enginePieces: RULES.enginePieces - 1,
    engineHealth: RULES.engineHits,
    engineActive: false,
  });
  assert.equal(run.enginePieces, RULES.enginePieces);
  assert.equal(run.engineActive, true);
});

test("thirteen Nova Charge strikes destroy the active Dread Engine", () => {
  let run = {
    charges: RULES.engineHits,
    score: 0,
    engineActive: true,
    engineHealth: RULES.engineHits,
    zoneComplete: false,
  };
  for (let index = 0; index < RULES.engineHits; index += 1) run = strikeEngine(run);
  assert.equal(run.engineHealth, 0);
  assert.equal(run.zoneComplete, true);
  assert.equal(run.charges, 0);
});

test("zone progression resets construction but preserves the run", () => {
  const run = nextZone({ zone: 1, score: 4200, enginePieces: 20, engineActive: true });
  assert.equal(run.zone, 2);
  assert.equal(run.score, 4200);
  assert.equal(run.enginePieces, 0);
  assert.equal(run.engineActive, false);
});

test("homing velocity turns toward its target at a bounded rate", () => {
  const velocity = homingVelocity(
    { x: 0, y: 0, vx: 100, vy: 0 },
    { x: 0, y: 100 },
    100,
    1,
    0.1,
  );
  assert.ok(velocity.vy > 0);
  assert.ok(velocity.vy < 20);
  assert.ok(Math.abs(Math.hypot(velocity.vx, velocity.vy) - 100) < 0.0001);
});

test("collision checks use combined radii", () => {
  assert.equal(circlesOverlap({ x: 0, y: 0, radius: 10 }, { x: 19, y: 0, radius: 10 }), true);
  assert.equal(circlesOverlap({ x: 0, y: 0, radius: 10 }, { x: 21, y: 0, radius: 10 }), false);
});

test("touch sticks normalize dead zones and diagonal travel", () => {
  assert.deepEqual(normalizeControlVector(0.04, 0, 1, 0.1), { x: 0, y: 0, magnitude: 0 });
  const diagonal = normalizeControlVector(1, 1, 1, 0.1);
  assert.equal(diagonal.magnitude, 1);
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 0.0001);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2) < 0.0001);
});

test("touch thrust retains the six arcade acceleration bands", () => {
  assert.equal(quantizeThrustMagnitude(0), 0);
  assert.equal(quantizeThrustMagnitude(0.12), 1 / 6);
  assert.equal(quantizeThrustMagnitude(0.51), 0.5);
  assert.equal(quantizeThrustMagnitude(1.4), 1);
});
