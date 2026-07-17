export const SENTINEL_ROLES = Object.freeze({
  INTERCEPT: "intercept",
  GUARD: "guard",
  PRESSURE: "pressure",
});

export const SENTINEL_ATTACK_PHASES = Object.freeze({
  APPROACH: "approach",
  CHARGE: "charge",
  BURST: "burst",
  BREAKAWAY: "breakaway",
});

export const SENTINEL_APPROACH_SECONDS = 0.9;
export const SENTINEL_CHARGE_SECONDS = 0.42;
export const SENTINEL_BURST_SHOT_COUNT = 3;
export const SENTINEL_BURST_INTERVAL_SECONDS = 0.12;
export const SENTINEL_BREAKAWAY_SECONDS = 0.8;
export const SENTINEL_MAX_DELTA_SECONDS = 0.5;
export const SENTINEL_MAX_ROLE_COUNT = 32;
export const SENTINEL_CONSTRUCTION_GUARD_BOOST = 0.5;

const EMPTY_SHOT_EVENTS = Object.freeze([]);
const EPSILON = 1e-9;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function unitInterval(value) {
  return clamp(finiteNumber(value), 0, 1);
}

function boundedInteger(value, min, max, fallback = min) {
  return clamp(Math.trunc(finiteNumber(value, fallback)), min, max);
}

function phaseDuration(phase) {
  switch (phase) {
    case SENTINEL_ATTACK_PHASES.CHARGE:
      return SENTINEL_CHARGE_SECONDS;
    case SENTINEL_ATTACK_PHASES.BREAKAWAY:
      return SENTINEL_BREAKAWAY_SECONDS;
    default:
      return SENTINEL_APPROACH_SECONDS;
  }
}

function validPhase(value) {
  return Object.values(SENTINEL_ATTACK_PHASES).includes(value)
    ? value
    : SENTINEL_ATTACK_PHASES.APPROACH;
}

function frozenBehaviorState({
  phase,
  phaseSecondsRemaining,
  burstShotsFired,
  shotSecondsRemaining,
}) {
  return Object.freeze({
    phase,
    phaseSecondsRemaining,
    burstShotsFired,
    shotSecondsRemaining,
  });
}

/**
 * Resolve immutable role counts for a stable Sentinel population. Construction
 * pressure reallocates existing craft toward guarding; it never adds actors.
 * Nova interception is allocated first, so it always preempts other roles.
 */
export function resolveSentinelRoleCounts(options = {}) {
  const sentinelCount = boundedInteger(
    options.sentinelCount,
    0,
    SENTINEL_MAX_ROLE_COUNT,
    0,
  );
  const constructionProgress = unitInterval(options.constructionProgress);
  const guardBias = unitInterval(options.guardBias);
  const novaInterceptionBias = unitInterval(options.novaInterceptionBias);
  const novaAvailable = options.novaAvailable === true;

  const requestedInterceptors = novaAvailable && novaInterceptionBias > 0
    ? Math.max(1, Math.ceil(sentinelCount * novaInterceptionBias))
    : 0;
  const interceptors = Math.min(sentinelCount, requestedInterceptors);
  const remainingAfterInterception = sentinelCount - interceptors;

  const effectiveGuardBias = clamp(
    guardBias + constructionProgress * SENTINEL_CONSTRUCTION_GUARD_BOOST,
    0,
    1,
  );
  const requestedGuards = effectiveGuardBias > 0
    ? Math.max(1, Math.ceil(remainingAfterInterception * effectiveGuardBias))
    : 0;
  const guards = Math.min(remainingAfterInterception, requestedGuards);
  const pressure = remainingAfterInterception - guards;

  return Object.freeze({
    sentinelCount,
    interceptors,
    guards,
    pressure,
    constructionProgress,
    effectiveGuardBias,
  });
}

/**
 * Select a deterministic role by stable live-population index. Interceptors
 * occupy the first slots, followed by guards and ordinary player pressure.
 */
export function selectSentinelRole(options = {}) {
  const counts = resolveSentinelRoleCounts(options);
  if (counts.sentinelCount === 0) return SENTINEL_ROLES.PRESSURE;

  const roleIndex = boundedInteger(
    options.roleIndex,
    0,
    counts.sentinelCount - 1,
    0,
  );
  if (roleIndex < counts.interceptors) return SENTINEL_ROLES.INTERCEPT;
  if (roleIndex < counts.interceptors + counts.guards) return SENTINEL_ROLES.GUARD;
  return SENTINEL_ROLES.PRESSURE;
}

/**
 * Normalize external or persisted attack state into a safe immutable value.
 */
export function createSentinelBehaviorState(options = {}) {
  const phase = validPhase(options.phase);
  if (phase === SENTINEL_ATTACK_PHASES.BURST) {
    return frozenBehaviorState({
      phase,
      phaseSecondsRemaining: 0,
      burstShotsFired: boundedInteger(
        options.burstShotsFired,
        0,
        SENTINEL_BURST_SHOT_COUNT,
        0,
      ),
      shotSecondsRemaining: clamp(
        finiteNumber(options.shotSecondsRemaining),
        0,
        SENTINEL_BURST_INTERVAL_SECONDS,
      ),
    });
  }

  const duration = phaseDuration(phase);
  const suppliedRemaining = Number.isFinite(options.phaseSecondsRemaining)
    ? options.phaseSecondsRemaining
    : duration;
  return frozenBehaviorState({
    phase,
    phaseSecondsRemaining: clamp(suppliedRemaining, 0, duration),
    burstShotsFired: 0,
    shotSecondsRemaining: 0,
  });
}

function nextPhaseState(phase) {
  switch (phase) {
    case SENTINEL_ATTACK_PHASES.APPROACH:
      return createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.CHARGE });
    case SENTINEL_ATTACK_PHASES.CHARGE:
      return createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.BURST });
    case SENTINEL_ATTACK_PHASES.BURST:
      return createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.BREAKAWAY });
    default:
      return createSentinelBehaviorState({ phase: SENTINEL_ATTACK_PHASES.APPROACH });
  }
}

/**
 * Advance one bounded attack step. Shot events occur only during Burst and are
 * returned with offsets relative to the start of this update.
 */
export function advanceSentinelBehavior(inputState, deltaSeconds) {
  const initialState = createSentinelBehaviorState(inputState);
  const delta = clamp(
    finiteNumber(deltaSeconds),
    0,
    SENTINEL_MAX_DELTA_SECONDS,
  );
  if (delta === 0) {
    return Object.freeze({
      state: initialState,
      shotEvents: EMPTY_SHOT_EVENTS,
      phaseChanged: false,
    });
  }

  let state = initialState;
  let remainingDelta = delta;
  let elapsed = 0;
  const shotEvents = [];

  // A bounded delta can cross only a handful of phase boundaries. The guard
  // also makes malformed future cadence constants fail closed rather than loop.
  for (let iteration = 0; iteration < 16 && remainingDelta > EPSILON; iteration += 1) {
    if (state.phase === SENTINEL_ATTACK_PHASES.BURST) {
      if (state.burstShotsFired >= SENTINEL_BURST_SHOT_COUNT) {
        state = nextPhaseState(state.phase);
        continue;
      }

      if (state.shotSecondsRemaining > EPSILON) {
        const consumed = Math.min(remainingDelta, state.shotSecondsRemaining);
        state = frozenBehaviorState({
          ...state,
          shotSecondsRemaining: Math.max(0, state.shotSecondsRemaining - consumed),
        });
        remainingDelta -= consumed;
        elapsed += consumed;
        if (remainingDelta <= EPSILON) break;
      }

      const burstIndex = state.burstShotsFired + 1;
      shotEvents.push(Object.freeze({
        kind: "shot",
        burstIndex,
        offsetSeconds: elapsed,
      }));

      if (burstIndex >= SENTINEL_BURST_SHOT_COUNT) {
        state = nextPhaseState(state.phase);
      } else {
        state = frozenBehaviorState({
          ...state,
          burstShotsFired: burstIndex,
          shotSecondsRemaining: SENTINEL_BURST_INTERVAL_SECONDS,
        });
      }
      continue;
    }

    if (state.phaseSecondsRemaining <= EPSILON) {
      state = nextPhaseState(state.phase);
      continue;
    }

    const consumed = Math.min(remainingDelta, state.phaseSecondsRemaining);
    state = frozenBehaviorState({
      ...state,
      phaseSecondsRemaining: Math.max(0, state.phaseSecondsRemaining - consumed),
    });
    remainingDelta -= consumed;
    elapsed += consumed;
    if (state.phaseSecondsRemaining <= EPSILON) {
      state = nextPhaseState(state.phase);
    }
  }

  return Object.freeze({
    state,
    shotEvents: Object.freeze(shotEvents),
    phaseChanged: state.phase !== initialState.phase,
  });
}

/**
 * Normalized phase progress for animation and non-color charge feedback.
 */
export function sentinelPhaseProgress(inputState) {
  const state = createSentinelBehaviorState(inputState);
  if (state.phase === SENTINEL_ATTACK_PHASES.BURST) {
    return clamp(state.burstShotsFired / SENTINEL_BURST_SHOT_COUNT, 0, 1);
  }
  const duration = phaseDuration(state.phase);
  return duration === 0
    ? 1
    : clamp(1 - state.phaseSecondsRemaining / duration, 0, 1);
}
