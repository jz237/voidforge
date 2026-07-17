import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTRACT_IDLE_DELAY_SECONDS,
  ATTRACT_LOOP_SECONDS,
  ATTRACT_PHASE_SECONDS,
  ATTRACT_PHASES,
  MAX_ATTRACT_DELTA_SECONDS,
  advanceAttractTimeline,
  resetAttractTimeline,
  resolveAttractTimeline,
  sanitizeAttractTime,
} from "../app/game/attract-mode.mjs";

const approximately = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test("attract timing constants define one four-phase thirty-second loop", () => {
  assert.equal(ATTRACT_IDLE_DELAY_SECONDS, 10);
  assert.equal(ATTRACT_PHASE_SECONDS, 7.5);
  assert.equal(ATTRACT_LOOP_SECONDS, 30);
  assert.equal(MAX_ATTRACT_DELTA_SECONDS, 0.25);
  assert.deepEqual(ATTRACT_PHASES, [
    "mining",
    "construction",
    "pursuit",
    "disruption",
  ]);
  assert.equal(Object.isFrozen(ATTRACT_PHASES), true);
  assert.equal(ATTRACT_PHASES.length * ATTRACT_PHASE_SECONDS, ATTRACT_LOOP_SECONDS);
});

test("invalid clocks sanitize to zero without coercion", () => {
  for (const value of [undefined, null, "12", {}, [], Number.NaN, Infinity, -Infinity, -1, -0]) {
    assert.equal(sanitizeAttractTime(value), 0);
  }
  assert.equal(sanitizeAttractTime(0), 0);
  assert.equal(sanitizeAttractTime(2.75), 2.75);
});

test("title remains idle for ten seconds and exposes the remaining delay", () => {
  assert.deepEqual(resetAttractTimeline(), {
    elapsed: 0,
    active: false,
    idleRemaining: 10,
    phase: null,
    index: -1,
    phaseElapsed: 0,
    loopElapsed: 0,
    loopCount: 0,
  });

  const almostActive = resolveAttractTimeline(9.999);
  assert.equal(almostActive.active, false);
  approximately(almostActive.idleRemaining, 0.001);
});

test("the exact idle boundary starts mining at loop zero", () => {
  assert.deepEqual(resolveAttractTimeline(10), {
    elapsed: 10,
    active: true,
    idleRemaining: 0,
    phase: "mining",
    index: 0,
    phaseElapsed: 0,
    loopElapsed: 0,
    loopCount: 0,
  });
});

test("all phase interiors and exact boundaries resolve consistently", () => {
  const cases = [
    [10.25, "mining", 0, 0.25, 0.25],
    [17.5, "construction", 1, 0, 7.5],
    [22, "construction", 1, 4.5, 12],
    [25, "pursuit", 2, 0, 15],
    [32.5, "disruption", 3, 0, 22.5],
    [39.999, "disruption", 3, 7.499, 29.999],
  ];

  for (const [elapsed, phase, index, phaseElapsed, loopElapsed] of cases) {
    const snapshot = resolveAttractTimeline(elapsed);
    assert.equal(snapshot.phase, phase);
    assert.equal(snapshot.index, index);
    approximately(snapshot.phaseElapsed, phaseElapsed);
    approximately(snapshot.loopElapsed, loopElapsed);
  }
});

test("the loop wraps to mining every thirty active seconds", () => {
  for (const elapsed of [10, 40, 70, 100]) {
    const snapshot = resolveAttractTimeline(elapsed);
    assert.equal(snapshot.phase, "mining");
    assert.equal(snapshot.index, 0);
    assert.equal(snapshot.phaseElapsed, 0);
    assert.equal(snapshot.loopElapsed, 0);
  }
  assert.equal(resolveAttractTimeline(40).loopCount, 1);
  assert.equal(resolveAttractTimeline(100).loopCount, 3);
});

test("frame advance is bounded and never skips ahead after a long pause", () => {
  const advanced = advanceAttractTimeline(12, 60);
  assert.equal(advanced.elapsed, 12.25);
  assert.equal(advanced.appliedDelta, 0.25);
  assert.equal(advanced.phase, "mining");
  assert.equal(advanced.phaseChanged, false);
  assert.equal(advanced.looped, false);
});

test("advance detects idle activation and ordinary phase changes", () => {
  const activated = advanceAttractTimeline(9.9, 0.25);
  assert.equal(activated.active, true);
  assert.equal(activated.phase, "mining");
  assert.equal(activated.phaseChanged, true);

  const constructed = advanceAttractTimeline(17.4, 0.2);
  assert.equal(constructed.phase, "construction");
  assert.equal(constructed.index, 1);
  assert.equal(constructed.phaseChanged, true);
  assert.equal(constructed.looped, false);
});

test("advance detects the loop boundary even though mining repeats", () => {
  const wrapped = advanceAttractTimeline(39.9, 0.2);
  assert.equal(wrapped.phase, "mining");
  assert.equal(wrapped.index, 0);
  assert.equal(wrapped.loopCount, 1);
  assert.equal(wrapped.phaseChanged, true);
  assert.equal(wrapped.looped, true);
  approximately(wrapped.phaseElapsed, 0.1);
  approximately(wrapped.loopElapsed, 0.1);
});

test("invalid and negative deltas leave the deterministic snapshot unchanged", () => {
  for (const delta of [undefined, null, "1", Number.NaN, Infinity, -1]) {
    const advanced = advanceAttractTimeline(25, delta);
    assert.equal(advanced.elapsed, 25);
    assert.equal(advanced.appliedDelta, 0);
    assert.equal(advanced.phase, "pursuit");
    assert.equal(advanced.phaseChanged, false);
    assert.equal(advanced.looped, false);
  }
});
