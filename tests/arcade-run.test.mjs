import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_CLEAR_BONUS_PER_LIFE,
  ARENA_CLEAR_DECAY_PER_SECOND,
  ARENA_CLEAR_TIME_BONUS,
  EXTRA_HULL_SCORE_INTERVAL,
  FIRST_EXTRA_HULL_SCORE,
  INITIAL_MULTIPLIER,
  MAX_MULTIPLIER,
  MAX_PLAYER_LIVES,
  MULTIPLIER_STEP,
  SCORE_CHAIN_WINDOW_SECONDS,
  advanceScoreChain,
  awardArenaClearBonus,
  awardScoreAction,
  calculateArenaClearBonus,
  createArcadeRunState,
  loseHull,
  nextExtraHullThreshold,
} from "../app/game/arcade-run.mjs";

test("arcade constants expose the scoring baseline", () => {
  assert.equal(INITIAL_MULTIPLIER, 1);
  assert.equal(MULTIPLIER_STEP, 0.25);
  assert.equal(MAX_MULTIPLIER, 5);
  assert.equal(SCORE_CHAIN_WINDOW_SECONDS, 4.5);
  assert.equal(FIRST_EXTRA_HULL_SCORE, 25_000);
  assert.equal(EXTRA_HULL_SCORE_INTERVAL, 50_000);
  assert.equal(MAX_PLAYER_LIVES, 5);
  assert.equal(ARENA_CLEAR_TIME_BONUS, 30_000);
  assert.equal(ARENA_CLEAR_DECAY_PER_SECOND, 250);
  assert.equal(ARENA_CLEAR_BONUS_PER_LIFE, 2_000);
});

test("new run and threshold boundaries are deterministic", () => {
  assert.deepEqual(createArcadeRunState(), {
    score: 0,
    lives: 3,
    multiplier: 1,
    chainSecondsRemaining: 0,
    nextExtraHullScore: 25_000,
  });
  assert.equal(nextExtraHullThreshold(24_999), 25_000);
  assert.equal(nextExtraHullThreshold(25_000), 75_000);
  assert.equal(nextExtraHullThreshold(74_999), 75_000);
  assert.equal(nextExtraHullThreshold(75_000), 125_000);
});

test("score actions apply the current multiplier then grow and cap the chain", () => {
  const first = awardScoreAction(createArcadeRunState(), 100);
  assert.equal(first.breakdown.pointsAwarded, 100);
  assert.equal(first.breakdown.appliedMultiplier, 1);
  assert.equal(first.state.multiplier, 1.25);
  assert.equal(first.state.chainSecondsRemaining, 4.5);

  const second = awardScoreAction(first.state, 101);
  assert.equal(second.breakdown.pointsAwarded, 126);
  assert.equal(second.state.score, 226);
  assert.equal(second.state.multiplier, 1.5);

  let capped = second.state;
  for (let index = 0; index < 20; index += 1) capped = awardScoreAction(capped, 1).state;
  assert.equal(capped.multiplier, 5);
});

test("multiplier survives inside its window and resets exactly at expiry", () => {
  const scored = awardScoreAction(createArcadeRunState(), 100).state;
  const active = advanceScoreChain(scored, 4.499);
  assert.equal(active.multiplier, 1.25);
  assert.ok(active.chainSecondsRemaining > 0);

  const expired = advanceScoreChain(scored, 4.5);
  assert.equal(expired.multiplier, 1);
  assert.equal(expired.chainSecondsRemaining, 0);
});

test("hull loss preserves score while resetting multiplier and chain", () => {
  const scored = awardScoreAction(createArcadeRunState({ score: 8_000, lives: 3 }), 400).state;
  const lost = loseHull(scored);
  assert.equal(lost.score, scored.score);
  assert.equal(lost.lives, 2);
  assert.equal(lost.multiplier, 1);
  assert.equal(lost.chainSecondsRemaining, 0);
  assert.equal(lost.nextExtraHullScore, 25_000);
});

test("one score award can cross multiple extra-hull thresholds", () => {
  const result = awardScoreAction(createArcadeRunState({ score: 24_000, lives: 2 }), 102_000);
  assert.deepEqual(result.breakdown.thresholdsCrossed, [25_000, 75_000, 125_000]);
  assert.equal(result.breakdown.extraHullsAwarded, 3);
  assert.equal(result.state.lives, 5);
  assert.equal(result.state.nextExtraHullScore, 175_000);
});

test("landing exactly on an extra-hull boundary awards it once", () => {
  const result = awardScoreAction(createArcadeRunState({ score: 24_999, lives: 3 }), 1);
  assert.deepEqual(result.breakdown.thresholdsCrossed, [25_000]);
  assert.equal(result.state.lives, 4);
  assert.equal(result.state.nextExtraHullScore, 75_000);
});

test("extra-hull cap consumes every crossed threshold without exceeding five lives", () => {
  const result = awardScoreAction(createArcadeRunState({ score: 24_000, lives: 4 }), 102_000);
  assert.deepEqual(result.breakdown.thresholdsCrossed, [25_000, 75_000, 125_000]);
  assert.equal(result.breakdown.extraHullsAwarded, 1);
  assert.equal(result.state.lives, 5);
  assert.equal(result.state.nextExtraHullScore, 175_000);
});

test("arena clear bonus floors elapsed time and clamps time value at zero", () => {
  assert.deepEqual(calculateArenaClearBonus(0, 3), {
    wholeSeconds: 0,
    countedLives: 3,
    timeBonus: 30_000,
    hullBonus: 6_000,
    totalBonus: 36_000,
  });
  assert.equal(calculateArenaClearBonus(119.9, 3).timeBonus, 250);
  assert.equal(calculateArenaClearBonus(120, 3).timeBonus, 0);
  assert.equal(calculateArenaClearBonus(999, 3).totalBonus, 6_000);
});

test("arena bonus uses persistent thresholds without changing the action chain", () => {
  const run = {
    ...createArcadeRunState({ score: 20_000, lives: 3 }),
    multiplier: 2,
    chainSecondsRemaining: 2,
  };
  const result = awardArenaClearBonus(run, 120);
  assert.equal(result.breakdown.totalBonus, 6_000);
  assert.equal(result.state.score, 26_000);
  assert.equal(result.state.lives, 4);
  assert.equal(result.state.nextExtraHullScore, 75_000);
  assert.equal(result.state.multiplier, 2);
  assert.equal(result.state.chainSecondsRemaining, 2);
});
