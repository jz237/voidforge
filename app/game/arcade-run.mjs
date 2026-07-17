export const INITIAL_MULTIPLIER = 1;
export const MULTIPLIER_STEP = 0.25;
export const MAX_MULTIPLIER = 5;
export const SCORE_CHAIN_WINDOW_SECONDS = 4.5;

export const FIRST_EXTRA_HULL_SCORE = 25_000;
export const EXTRA_HULL_SCORE_INTERVAL = 50_000;
export const MAX_PLAYER_LIVES = 5;

export const ARENA_CLEAR_TIME_BONUS = 30_000;
export const ARENA_CLEAR_DECAY_PER_SECOND = 250;
export const ARENA_CLEAR_BONUS_PER_LIFE = 2_000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedScore(score) {
  return Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
}

function normalizedLives(lives) {
  return clamp(Number.isFinite(lives) ? Math.floor(lives) : 0, 0, MAX_PLAYER_LIVES);
}

function normalizedMultiplier(multiplier) {
  if (!Number.isFinite(multiplier)) return INITIAL_MULTIPLIER;
  return clamp(multiplier, INITIAL_MULTIPLIER, MAX_MULTIPLIER);
}

export function nextExtraHullThreshold(score) {
  const currentScore = normalizedScore(score);
  if (currentScore < FIRST_EXTRA_HULL_SCORE) return FIRST_EXTRA_HULL_SCORE;
  const completedIntervals = Math.floor(
    (currentScore - FIRST_EXTRA_HULL_SCORE) / EXTRA_HULL_SCORE_INTERVAL,
  );
  return FIRST_EXTRA_HULL_SCORE + (completedIntervals + 1) * EXTRA_HULL_SCORE_INTERVAL;
}

export function createArcadeRunState({ score = 0, lives = 3 } = {}) {
  const normalized = normalizedScore(score);
  return {
    score: normalized,
    lives: normalizedLives(lives),
    multiplier: INITIAL_MULTIPLIER,
    chainSecondsRemaining: 0,
    nextExtraHullScore: nextExtraHullThreshold(normalized),
  };
}

export function addPersistentScore(run, points) {
  const previousScore = normalizedScore(run.score);
  const pointsAwarded = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
  const score = previousScore + pointsAwarded;
  const livesBefore = normalizedLives(run.lives);
  const thresholdsCrossed = [];
  let threshold = nextExtraHullThreshold(previousScore);

  while (threshold <= score) {
    thresholdsCrossed.push(threshold);
    threshold += EXTRA_HULL_SCORE_INTERVAL;
  }

  const extraHullsAwarded = Math.min(
    thresholdsCrossed.length,
    MAX_PLAYER_LIVES - livesBefore,
  );
  const lives = livesBefore + extraHullsAwarded;
  const state = {
    ...run,
    score,
    lives,
    nextExtraHullScore: threshold,
  };

  return {
    state,
    breakdown: {
      previousScore,
      pointsAwarded,
      score,
      livesBefore,
      livesAfter: lives,
      thresholdsCrossed,
      extraHullsAwarded,
      nextExtraHullScore: threshold,
    },
  };
}

export function advanceScoreChain(run, deltaSeconds) {
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const previousRemaining = Number.isFinite(run.chainSecondsRemaining)
    ? Math.max(0, run.chainSecondsRemaining)
    : 0;
  const chainSecondsRemaining = Math.max(0, previousRemaining - delta);
  const expired = chainSecondsRemaining === 0;

  return {
    ...run,
    multiplier: expired ? INITIAL_MULTIPLIER : normalizedMultiplier(run.multiplier),
    chainSecondsRemaining,
  };
}

export function awardScoreAction(run, basePoints) {
  const normalizedBasePoints = Number.isFinite(basePoints) ? Math.max(0, basePoints) : 0;
  const appliedMultiplier = normalizedMultiplier(run.multiplier);
  const pointsAwarded = Math.round(normalizedBasePoints * appliedMultiplier);
  const persistent = addPersistentScore(run, pointsAwarded);
  const scoreBearing = normalizedBasePoints > 0;
  const multiplier = scoreBearing
    ? Math.min(MAX_MULTIPLIER, appliedMultiplier + MULTIPLIER_STEP)
    : appliedMultiplier;
  const chainSecondsRemaining = scoreBearing
    ? SCORE_CHAIN_WINDOW_SECONDS
    : Math.max(0, run.chainSecondsRemaining ?? 0);
  const state = {
    ...persistent.state,
    multiplier,
    chainSecondsRemaining,
  };

  return {
    state,
    breakdown: {
      ...persistent.breakdown,
      basePoints: normalizedBasePoints,
      appliedMultiplier,
      multiplierAfter: multiplier,
      chainSecondsRemaining,
    },
  };
}

export function loseHull(run) {
  return {
    ...run,
    lives: Math.max(0, normalizedLives(run.lives) - 1),
    multiplier: INITIAL_MULTIPLIER,
    chainSecondsRemaining: 0,
  };
}

export function calculateArenaClearBonus(seconds, lives) {
  const wholeSeconds = Math.floor(Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  const countedLives = normalizedLives(lives);
  const timeBonus = Math.max(
    0,
    ARENA_CLEAR_TIME_BONUS - wholeSeconds * ARENA_CLEAR_DECAY_PER_SECOND,
  );
  const hullBonus = countedLives * ARENA_CLEAR_BONUS_PER_LIFE;

  return {
    wholeSeconds,
    countedLives,
    timeBonus,
    hullBonus,
    totalBonus: timeBonus + hullBonus,
  };
}

export function awardArenaClearBonus(run, seconds) {
  const arena = calculateArenaClearBonus(seconds, run.lives);
  const persistent = addPersistentScore(run, arena.totalBonus);

  return {
    state: persistent.state,
    breakdown: {
      ...arena,
      ...persistent.breakdown,
    },
  };
}
