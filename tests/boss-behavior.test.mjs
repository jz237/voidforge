import assert from "node:assert/strict";
import test from "node:test";

import {
  DREAD_ENGINE_AWAKENING_SECONDS,
  advanceAwakeningCountdown,
  clampAwakeningRemaining,
  expandingWaveCrossedCircle,
  predictPursuitTarget,
} from "../app/game/boss-behavior.mjs";

test("awakening countdown uses the 2.5 second baseline and clamps invalid range", () => {
  assert.equal(DREAD_ENGINE_AWAKENING_SECONDS, 2.5);
  assert.equal(clampAwakeningRemaining(8), 2.5);
  assert.equal(clampAwakeningRemaining(-1), 0);
  assert.equal(clampAwakeningRemaining(Number.NaN), 2.5);
});

test("awakening countdown advances deterministically and reports completion once", () => {
  const active = advanceAwakeningCountdown(2.5, 1);
  assert.deepEqual(active, {
    remaining: 1.5,
    elapsed: 1,
    progress: 0.4,
    complete: false,
    justCompleted: false,
  });

  const completed = advanceAwakeningCountdown(0.25, 0.5);
  assert.equal(completed.remaining, 0);
  assert.equal(completed.progress, 1);
  assert.equal(completed.complete, true);
  assert.equal(completed.justCompleted, true);

  const alreadyComplete = advanceAwakeningCountdown(0, 1);
  assert.equal(alreadyComplete.complete, true);
  assert.equal(alreadyComplete.justCompleted, false);
  assert.equal(advanceAwakeningCountdown(1, -0.5).remaining, 1);
});

test("pursuit prediction leads player velocity and clamps to current world bounds", () => {
  const bounds = { minX: 180, maxX: 9020, minY: 180, maxY: 6020 };
  assert.deepEqual(
    predictPursuitTarget({ x: 4000, y: 3000, vx: 120, vy: -80 }, 1.5, bounds),
    { x: 4180, y: 2880 },
  );
  assert.deepEqual(
    predictPursuitTarget({ x: 8990, y: 200, vx: 300, vy: -100 }, 1, bounds),
    { x: 9020, y: 180 },
  );
});

test("negative pursuit lead never predicts behind the current player position", () => {
  const bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  assert.deepEqual(
    predictPursuitTarget({ x: 300, y: 400, vx: 100, vy: -100 }, -2, bounds),
    { x: 300, y: 400 },
  );
});

test("expanding wave sweep catches a circular target without tunneling", () => {
  const wave = { x: 0, y: 0, previousRadius: 40, nextRadius: 90 };
  assert.equal(expandingWaveCrossedCircle(wave, { x: 70, y: 0, radius: 5 }), true);
  assert.equal(expandingWaveCrossedCircle(wave, { x: 100, y: 0, radius: 5 }), false);
  assert.equal(expandingWaveCrossedCircle(wave, { x: 20, y: 0, radius: 5 }), false);
});

test("expanding wave sweep includes tangency and rejects static or contracting waves", () => {
  const target = { x: 75, y: 0, radius: 5 };
  assert.equal(
    expandingWaveCrossedCircle({ x: 0, y: 0, previousRadius: 60, nextRadius: 70 }, target),
    true,
  );
  assert.equal(
    expandingWaveCrossedCircle({ x: 0, y: 0, previousRadius: 70, nextRadius: 70 }, target),
    false,
  );
  assert.equal(
    expandingWaveCrossedCircle({ x: 0, y: 0, previousRadius: 80, nextRadius: 70 }, target),
    false,
  );
});
