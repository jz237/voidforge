export const ATTRACT_IDLE_DELAY_SECONDS = 10;
export const ATTRACT_PHASE_SECONDS = 7.5;
export const ATTRACT_LOOP_SECONDS = 30;
export const MAX_ATTRACT_DELTA_SECONDS = 0.25;

/** @typedef {"mining" | "construction" | "pursuit" | "disruption"} AttractPhase */

export const ATTRACT_PHASES = Object.freeze([
  "mining",
  "construction",
  "pursuit",
  "disruption",
]);

/**
 * Invalid or negative clock values restart at zero. Numeric strings are not
 * accepted so the timeline cannot inherit browser coercion differences.
 * @param {unknown} seconds
 */
export function sanitizeAttractTime(seconds) {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : 0;
}

/**
 * Resolve a title clock into a deterministic attract-loop position.
 * @param {unknown} elapsedSeconds Seconds since the title became idle.
 * @returns {{
 *   elapsed: number,
 *   active: boolean,
 *   idleRemaining: number,
 *   phase: AttractPhase | null,
 *   index: number,
 *   phaseElapsed: number,
 *   loopElapsed: number,
 *   loopCount: number,
 * }}
 */
export function resolveAttractTimeline(elapsedSeconds = 0) {
  const elapsed = sanitizeAttractTime(elapsedSeconds);
  if (elapsed < ATTRACT_IDLE_DELAY_SECONDS) {
    return {
      elapsed,
      active: false,
      idleRemaining: ATTRACT_IDLE_DELAY_SECONDS - elapsed,
      phase: null,
      index: -1,
      phaseElapsed: 0,
      loopElapsed: 0,
      loopCount: 0,
    };
  }

  const activeElapsed = elapsed - ATTRACT_IDLE_DELAY_SECONDS;
  const loopCount = Math.floor(activeElapsed / ATTRACT_LOOP_SECONDS);
  const loopElapsed = activeElapsed % ATTRACT_LOOP_SECONDS;
  const index = Math.min(
    ATTRACT_PHASES.length - 1,
    Math.floor(loopElapsed / ATTRACT_PHASE_SECONDS),
  );

  return {
    elapsed,
    active: true,
    idleRemaining: 0,
    phase: /** @type {AttractPhase} */ (ATTRACT_PHASES[index]),
    index,
    phaseElapsed: loopElapsed - index * ATTRACT_PHASE_SECONDS,
    loopElapsed,
    loopCount,
  };
}

/**
 * Advance by one bounded frame and report timeline boundaries. Bounding each
 * step prevents a suspended tab from skipping the entire demonstration.
 * @param {unknown} elapsedSeconds
 * @param {unknown} deltaSeconds
 */
export function advanceAttractTimeline(elapsedSeconds, deltaSeconds) {
  const elapsed = sanitizeAttractTime(elapsedSeconds);
  const appliedDelta = Math.min(
    sanitizeAttractTime(deltaSeconds),
    MAX_ATTRACT_DELTA_SECONDS,
  );
  const previous = resolveAttractTimeline(elapsed);
  const next = resolveAttractTimeline(elapsed + appliedDelta);
  const phaseChanged = previous.active !== next.active
    || (next.active && (
      previous.index !== next.index
      || previous.loopCount !== next.loopCount
    ));

  return {
    ...next,
    appliedDelta,
    phaseChanged,
    looped: previous.active
      && next.active
      && previous.loopCount !== next.loopCount,
  };
}

/** Return the canonical title-idle starting point. */
export function resetAttractTimeline() {
  return resolveAttractTimeline(0);
}
