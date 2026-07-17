export const RULES = Object.freeze({
  maxCharges: 20,
  enginePieces: 20,
  engineHits: 13,
  playerLives: 3,
  worldWidth: 9200,
  worldHeight: 6200,
});

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function normalizeControlVector(dx, dy, radius = 1, deadZone = 0.1) {
  const safeRadius = Math.max(0.0001, Math.abs(radius));
  const length = Math.hypot(dx, dy);
  const rawMagnitude = Math.min(1, length / safeRadius);
  const safeDeadZone = clamp(deadZone, 0, 0.95);
  if (length <= 0.0001 || rawMagnitude <= safeDeadZone) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  const magnitude = clamp((rawMagnitude - safeDeadZone) / (1 - safeDeadZone), 0, 1);
  return {
    x: (dx / length) * magnitude,
    y: (dy / length) * magnitude,
    magnitude,
  };
}

export function quantizeThrustMagnitude(magnitude, bands = 6) {
  const safeBands = Math.max(1, Math.round(bands));
  return Math.round(clamp(magnitude, 0, 1) * safeBands) / safeBands;
}

export function circlesOverlap(a, b) {
  const radius = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= radius * radius;
}

export function seededRandom(seed = 0x56f01d) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shortestWrappedDelta(from, to, span) {
  let delta = to - from;
  if (delta > span / 2) delta -= span;
  if (delta < -span / 2) delta += span;
  return delta;
}

export function wrap(value, span) {
  return ((value % span) + span) % span;
}

export function homingVelocity(projectile, target, speed, turnRate, deltaSeconds) {
  const currentAngle = Math.atan2(projectile.vy, projectile.vx);
  const desiredAngle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  let difference = desiredAngle - currentAngle;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  const nextAngle = currentAngle + clamp(difference, -turnRate * deltaSeconds, turnRate * deltaSeconds);
  return {
    vx: Math.cos(nextAngle) * speed,
    vy: Math.sin(nextAngle) * speed,
  };
}

export function minePlanetoid(planetoid, hitAtMs) {
  const next = { ...planetoid };
  const rapid = hitAtMs - (next.lastHitAt ?? -Infinity) < 145;
  next.lastHitAt = hitAtMs;
  next.integrity = Math.max(0, next.integrity - (rapid ? 2 : 1));
  // Held fire should still produce Flux on touch devices, while deliberate
  // pulses remain twice as efficient and preserve more of the planetoid.
  next.miningProgress = (next.miningProgress ?? 0) + (rapid ? 0.75 : 1);

  let emitted = false;
  if (next.shards > 0 && next.miningProgress >= 2) {
    next.miningProgress = Math.max(0, next.miningProgress - 2);
    next.shards -= 1;
    emitted = true;
  }

  return {
    planetoid: next,
    emitted,
    destroyed: next.integrity === 0,
  };
}

export function collectShard(run) {
  return {
    ...run,
    charges: Math.min(RULES.maxCharges, run.charges + 1),
    score: run.score + 100,
  };
}

export function depositFabricatorShard(run) {
  if (run.engineActive) {
    return {
      ...run,
      engineHealth: Math.min(RULES.engineHits, run.engineHealth + 1),
    };
  }

  const enginePieces = Math.min(RULES.enginePieces, run.enginePieces + 1);
  return {
    ...run,
    enginePieces,
    engineActive: enginePieces === RULES.enginePieces,
  };
}

export function strikeEngine(run) {
  if (!run.engineActive || run.charges <= 0 || run.engineHealth <= 0) return run;
  const engineHealth = run.engineHealth - 1;
  return {
    ...run,
    charges: run.charges - 1,
    engineHealth,
    score: run.score + 750 + (engineHealth === 0 ? 10000 : 0),
    zoneComplete: engineHealth === 0,
  };
}

export function nextZone(run) {
  return {
    ...run,
    zone: run.zone + 1,
    enginePieces: 0,
    engineHealth: RULES.engineHits,
    engineActive: false,
    zoneComplete: false,
  };
}
