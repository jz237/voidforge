import assert from "node:assert/strict";
import test from "node:test";

import {
  SENTINEL_APPROACH_SECONDS,
  SENTINEL_ATTACK_PHASES,
  SENTINEL_BREAKAWAY_SECONDS,
  SENTINEL_BURST_INTERVAL_SECONDS,
  SENTINEL_BURST_SHOT_COUNT,
  SENTINEL_CHARGE_SECONDS,
  SENTINEL_MAX_DELTA_SECONDS,
  SENTINEL_MAX_ROLE_COUNT,
  SENTINEL_ROLES,
  advanceSentinelBehavior,
  createSentinelBehaviorState,
  resolveSentinelRoleCounts,
  selectSentinelRole,
  sentinelPhaseProgress,
} from "../app/game/sentinel-behavior.mjs";

const approximately = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test("Sentinel cadence constants expose a bounded three-shot attack", () => {
  assert.equal(SENTINEL_BURST_SHOT_COUNT, 3);
  assert.ok(SENTINEL_APPROACH_SECONDS > 0);
  assert.ok(SENTINEL_CHARGE_SECONDS > 0);
  assert.ok(SENTINEL_BURST_INTERVAL_SECONDS > 0);
  assert.ok(SENTINEL_BREAKAWAY_SECONDS > 0);
  assert.ok(SENTINEL_MAX_DELTA_SECONDS > 0);
  assert.ok(SENTINEL_MAX_ROLE_COUNT >= 1);
  assert.equal(Object.isFrozen(SENTINEL_ROLES), true);
  assert.equal(Object.isFrozen(SENTINEL_ATTACK_PHASES), true);
});

test("Nova interception preempts guarding and ordinary pressure", () => {
  const shared = {
    roleIndex: 0,
    sentinelCount: 4,
    constructionProgress: 1,
    guardBias: 0.5,
  };

  assert.equal(selectSentinelRole(shared), SENTINEL_ROLES.GUARD);
  assert.equal(
    selectSentinelRole({
      ...shared,
      novaAvailable: true,
      novaInterceptionBias: 0.25,
    }),
    SENTINEL_ROLES.INTERCEPT,
  );

  const counts = resolveSentinelRoleCounts({
    ...shared,
    novaAvailable: true,
    novaInterceptionBias: 0.25,
  });
  assert.deepEqual(
    {
      interceptors: counts.interceptors,
      guards: counts.guards,
      pressure: counts.pressure,
    },
    { interceptors: 1, guards: 3, pressure: 0 },
  );
});

test("construction progress increases guard assignments without changing population", () => {
  const baseline = {
    sentinelCount: 6,
    guardBias: 0.08,
    novaAvailable: false,
  };
  const early = resolveSentinelRoleCounts({ ...baseline, constructionProgress: 0 });
  const critical = resolveSentinelRoleCounts({ ...baseline, constructionProgress: 0.9 });

  assert.equal(early.sentinelCount, critical.sentinelCount);
  assert.ok(critical.guards > early.guards);
  assert.ok(critical.pressure < early.pressure);
  assert.equal(early.interceptors + early.guards + early.pressure, 6);
  assert.equal(critical.interceptors + critical.guards + critical.pressure, 6);
  assert.equal(Object.isFrozen(early), true);
  assert.equal(Object.isFrozen(critical), true);
});

test("role inputs sanitize to deterministic bounded assignments", () => {
  const invalid = resolveSentinelRoleCounts({
    sentinelCount: Number.POSITIVE_INFINITY,
    constructionProgress: Number.NaN,
    guardBias: -8,
    novaAvailable: "true",
    novaInterceptionBias: 99,
  });
  assert.deepEqual(invalid, {
    sentinelCount: 0,
    interceptors: 0,
    guards: 0,
    pressure: 0,
    constructionProgress: 0,
    effectiveGuardBias: 0,
  });
  assert.equal(selectSentinelRole({ sentinelCount: 0 }), SENTINEL_ROLES.PRESSURE);

  const capped = resolveSentinelRoleCounts({
    sentinelCount: 999,
    constructionProgress: 99,
    guardBias: 99,
  });
  assert.equal(capped.sentinelCount, SENTINEL_MAX_ROLE_COUNT);
  assert.equal(capped.constructionProgress, 1);
  assert.equal(capped.effectiveGuardBias, 1);
  assert.equal(capped.guards, SENTINEL_MAX_ROLE_COUNT);
  assert.equal(
    selectSentinelRole({
      sentinelCount: 999,
      constructionProgress: 99,
      guardBias: 99,
      roleIndex: 999,
    }),
    SENTINEL_ROLES.GUARD,
  );
});

test("attack cadence advances approach then charge before firing", () => {
  const initial = createSentinelBehaviorState();
  assert.deepEqual(initial, {
    phase: SENTINEL_ATTACK_PHASES.APPROACH,
    phaseSecondsRemaining: SENTINEL_APPROACH_SECONDS,
    burstShotsFired: 0,
    shotSecondsRemaining: 0,
  });
  assert.equal(Object.isFrozen(initial), true);

  const approach = advanceSentinelBehavior(initial, SENTINEL_MAX_DELTA_SECONDS);
  assert.equal(approach.state.phase, SENTINEL_ATTACK_PHASES.APPROACH);
  assert.deepEqual(approach.shotEvents, []);

  const charge = advanceSentinelBehavior(approach.state, SENTINEL_MAX_DELTA_SECONDS);
  assert.equal(charge.state.phase, SENTINEL_ATTACK_PHASES.CHARGE);
  assert.deepEqual(charge.shotEvents, []);

  const toBurst = advanceSentinelBehavior(
    charge.state,
    charge.state.phaseSecondsRemaining,
  );
  assert.equal(toBurst.state.phase, SENTINEL_ATTACK_PHASES.BURST);
  assert.deepEqual(toBurst.shotEvents, []);
});

test("Burst emits exactly three spaced shots then enters Breakaway", () => {
  const burst = createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.BURST });
  const result = advanceSentinelBehavior(burst, SENTINEL_MAX_DELTA_SECONDS);

  assert.equal(result.shotEvents.length, SENTINEL_BURST_SHOT_COUNT);
  assert.deepEqual(result.shotEvents.map((event) => event.kind), ["shot", "shot", "shot"]);
  assert.deepEqual(result.shotEvents.map((event) => event.burstIndex), [1, 2, 3]);
  approximately(result.shotEvents[0].offsetSeconds, 0);
  approximately(result.shotEvents[1].offsetSeconds, SENTINEL_BURST_INTERVAL_SECONDS);
  approximately(result.shotEvents[2].offsetSeconds, SENTINEL_BURST_INTERVAL_SECONDS * 2);
  assert.equal(result.state.phase, SENTINEL_ATTACK_PHASES.BREAKAWAY);
  approximately(
    result.state.phaseSecondsRemaining,
    SENTINEL_BREAKAWAY_SECONDS
      - (SENTINEL_MAX_DELTA_SECONDS - SENTINEL_BURST_INTERVAL_SECONDS * 2),
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.state), true);
  assert.equal(Object.isFrozen(result.shotEvents), true);
  assert.ok(result.shotEvents.every((event) => Object.isFrozen(event)));
});

test("Charge and Breakaway never emit shots and return to Approach", () => {
  const charge = createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.CHARGE });
  const partialCharge = advanceSentinelBehavior(charge, SENTINEL_CHARGE_SECONDS / 2);
  assert.equal(partialCharge.state.phase, SENTINEL_ATTACK_PHASES.CHARGE);
  assert.deepEqual(partialCharge.shotEvents, []);

  const breakaway = createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.BREAKAWAY });
  const partialBreakaway = advanceSentinelBehavior(breakaway, SENTINEL_MAX_DELTA_SECONDS);
  assert.equal(partialBreakaway.state.phase, SENTINEL_ATTACK_PHASES.BREAKAWAY);
  assert.deepEqual(partialBreakaway.shotEvents, []);

  const returned = advanceSentinelBehavior(
    partialBreakaway.state,
    SENTINEL_BREAKAWAY_SECONDS,
  );
  assert.equal(returned.state.phase, SENTINEL_ATTACK_PHASES.APPROACH);
  assert.deepEqual(returned.shotEvents, []);
});

test("zero or invalid delta freezes immutable state", () => {
  const state = createSentinelBehaviorState({
    phase: SENTINEL_ATTACK_PHASES.BURST,
    burstShotsFired: 1,
    shotSecondsRemaining: 0.08,
  });
  for (const delta of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
    const frozen = advanceSentinelBehavior(state, delta);
    assert.deepEqual(frozen.state, state);
    assert.deepEqual(frozen.shotEvents, []);
    assert.equal(frozen.phaseChanged, false);
    assert.equal(Object.isFrozen(frozen.state), true);
  }
});

test("invalid state and oversized delta clamp safely", () => {
  const sanitized = createSentinelBehaviorState({
    phase: "unknown",
    phaseSecondsRemaining: Number.NaN,
    burstShotsFired: 999,
    shotSecondsRemaining: -4,
  });
  assert.deepEqual(sanitized, createSentinelBehaviorState());

  const oversized = advanceSentinelBehavior(sanitized, 999);
  const bounded = advanceSentinelBehavior(sanitized, SENTINEL_MAX_DELTA_SECONDS);
  assert.deepEqual(oversized, bounded);
  assert.equal(sentinelPhaseProgress({
    phase: SENTINEL_ATTACK_PHASES.CHARGE,
    phaseSecondsRemaining: SENTINEL_CHARGE_SECONDS / 2,
  }), 0.5);
  assert.equal(sentinelPhaseProgress({
    phase: SENTINEL_ATTACK_PHASES.BURST,
    burstShotsFired: SENTINEL_BURST_SHOT_COUNT,
  }), 1);
});
