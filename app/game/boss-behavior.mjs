export const DREAD_ENGINE_AWAKENING_SECONDS = 2.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function clampAwakeningRemaining(
  remainingSeconds,
  durationSeconds = DREAD_ENGINE_AWAKENING_SECONDS,
) {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : DREAD_ENGINE_AWAKENING_SECONDS;
  const remaining = Number.isFinite(remainingSeconds) ? remainingSeconds : duration;
  return clamp(remaining, 0, duration);
}

export function advanceAwakeningCountdown(
  remainingSeconds,
  deltaSeconds,
  durationSeconds = DREAD_ENGINE_AWAKENING_SECONDS,
) {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : DREAD_ENGINE_AWAKENING_SECONDS;
  const previousRemaining = clampAwakeningRemaining(remainingSeconds, duration);
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const remaining = clamp(previousRemaining - delta, 0, duration);
  const elapsed = duration - remaining;

  return {
    remaining,
    elapsed,
    progress: duration === 0 ? 1 : elapsed / duration,
    complete: remaining === 0,
    justCompleted: previousRemaining > 0 && remaining === 0,
  };
}

export function predictPursuitTarget(player, leadSeconds, bounds) {
  const lead = Number.isFinite(leadSeconds) ? Math.max(0, leadSeconds) : 0;
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);

  return {
    x: clamp(player.x + player.vx * lead, minX, maxX),
    y: clamp(player.y + player.vy * lead, minY, maxY),
  };
}

export function expandingWaveCrossedCircle(wave, target) {
  const previousRadius = Math.max(0, wave.previousRadius);
  const nextRadius = Math.max(0, wave.nextRadius);
  if (nextRadius <= previousRadius) return false;

  const targetRadius = Math.max(0, target.radius);
  const centerDistance = Math.hypot(target.x - wave.x, target.y - wave.y);
  const nearestTargetRadius = Math.max(0, centerDistance - targetRadius);
  const farthestTargetRadius = centerDistance + targetRadius;

  return previousRadius <= farthestTargetRadius && nextRadius >= nearestTargetRadius;
}
