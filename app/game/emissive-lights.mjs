export const MAX_EMISSIVE_LIGHTS = 4;

export const EMISSIVE_LIGHT_KINDS = Object.freeze({
  PLAYER: "player",
  BOSS: "boss",
  IMPACT: "impact",
  NOVA: "nova",
  HOSTILE_PROJECTILE: "hostileProjectile",
  SENTINEL: "sentinel",
  MINING: "mining",
  LOADED_FABRICATOR: "loadedFabricator",
  CRYSTAL: "crystal",
});

const LIGHT_ROLES = Object.freeze({
  PLAYER: "player",
  PHASE: "phase",
  TACTICAL: "tactical",
  MISSION: "mission",
});

const KIND_ROLE = new Map([
  [EMISSIVE_LIGHT_KINDS.PLAYER, LIGHT_ROLES.PLAYER],
  [EMISSIVE_LIGHT_KINDS.BOSS, LIGHT_ROLES.PHASE],
  [EMISSIVE_LIGHT_KINDS.IMPACT, LIGHT_ROLES.TACTICAL],
  [EMISSIVE_LIGHT_KINDS.NOVA, LIGHT_ROLES.TACTICAL],
  [EMISSIVE_LIGHT_KINDS.HOSTILE_PROJECTILE, LIGHT_ROLES.TACTICAL],
  [EMISSIVE_LIGHT_KINDS.SENTINEL, LIGHT_ROLES.TACTICAL],
  [EMISSIVE_LIGHT_KINDS.MINING, LIGHT_ROLES.MISSION],
  [EMISSIVE_LIGHT_KINDS.LOADED_FABRICATOR, LIGHT_ROLES.MISSION],
  [EMISSIVE_LIGHT_KINDS.CRYSTAL, LIGHT_ROLES.MISSION],
]);

const ROLE_PRIORITY = new Map([
  [LIGHT_ROLES.PLAYER, 0],
  [LIGHT_ROLES.PHASE, 1],
  [LIGHT_ROLES.TACTICAL, 2],
  [LIGHT_ROLES.MISSION, 3],
]);

const KIND_PRIORITY = new Map([
  [EMISSIVE_LIGHT_KINDS.PLAYER, 0],
  [EMISSIVE_LIGHT_KINDS.BOSS, 1],
  [EMISSIVE_LIGHT_KINDS.IMPACT, 2],
  [EMISSIVE_LIGHT_KINDS.NOVA, 3],
  [EMISSIVE_LIGHT_KINDS.HOSTILE_PROJECTILE, 4],
  [EMISSIVE_LIGHT_KINDS.SENTINEL, 5],
  [EMISSIVE_LIGHT_KINDS.MINING, 6],
  [EMISSIVE_LIGHT_KINDS.LOADED_FABRICATOR, 7],
  [EMISSIVE_LIGHT_KINDS.CRYSTAL, 8],
]);

const VALID_KINDS = new Set(KIND_ROLE.keys());
const DEFAULT_VISIBILITY_MARGIN = 0.06;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeId(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 96 ? trimmed : null;
}

function sanitizeColor(value) {
  if (Number.isFinite(value)) {
    const packed = clamp(Math.trunc(value), 0, 0xffffff);
    return Object.freeze([
      ((packed >> 16) & 0xff) / 255,
      ((packed >> 8) & 0xff) / 255,
      (packed & 0xff) / 255,
    ]);
  }
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    return Object.freeze([1, 1, 1]);
  }
  return Object.freeze([
    clamp(finiteNumber(value[0], 1), 0, 1),
    clamp(finiteNumber(value[1], 1), 0, 1),
    clamp(finiteNumber(value[2], 1), 0, 1),
  ]);
}

/**
 * Resolve the number of analytic lights for the current presentation profile.
 * FX Off and High Contrast retain the exact unlit scene. Compact viewports use
 * at most two sources, while the Low preset keeps only the Vesper anchor.
 */
export function resolveEmissiveLightLimit(options = {}) {
  const source = options !== null && typeof options === "object" && !Array.isArray(options)
    ? options
    : {};
  const intensity = clamp(finiteNumber(source.effectIntensity, 1), 0, 1);
  if (source.highContrast === true || intensity <= 0.05) return 0;
  if (intensity <= 0.4) return 1;
  const viewportLimit = source.compact === true ? 2 : MAX_EMISSIVE_LIGHTS;
  return intensity <= 0.75 ? Math.min(viewportLimit, 3) : viewportLimit;
}

/**
 * Project a world-space semantic source into normalized filter coordinates.
 * Off-screen centers are rejected instead of clamped, preventing phantom edge
 * glows from competing with the dedicated direction indicators.
 */
export function projectEmissiveLight(source = {}, projection = {}) {
  if (
    source === null || typeof source !== "object" || Array.isArray(source)
    || projection === null || typeof projection !== "object" || Array.isArray(projection)
  ) return null;

  const width = finiteNumber(projection.width, 0);
  const height = finiteNumber(projection.height, 0);
  const scale = finiteNumber(projection.worldScale, 0);
  if (width <= 0 || height <= 0 || scale === 0) return null;

  const id = sanitizeId(source.id);
  if (id === null || !VALID_KINDS.has(source.kind)) return null;
  const worldX = finiteNumber(source.worldX, Number.NaN);
  const worldY = finiteNumber(source.worldY, Number.NaN);
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;

  const screenX = finiteNumber(projection.offsetX, 0) + worldX * scale;
  const screenY = finiteNumber(projection.offsetY, 0) + worldY * scale;
  const margin = clamp(
    finiteNumber(projection.visibilityMargin, DEFAULT_VISIBILITY_MARGIN),
    0,
    0.25,
  );
  if (
    screenX < -width * margin || screenX > width * (1 + margin)
    || screenY < -height * margin || screenY > height * (1 + margin)
  ) return null;

  const radiusWorld = Math.abs(finiteNumber(source.radiusWorld, 0));
  const radius = clamp((radiusWorld * Math.abs(scale)) / height, 0.015, 0.65);
  const x = screenX / width;
  const y = screenY / height;
  const distance = Math.hypot(x - 0.5, y - 0.5);

  return Object.freeze({
    ...source,
    id,
    kind: source.kind,
    x,
    y,
    radius,
    intensity: clamp(finiteNumber(source.intensity, 0), 0, 1),
    urgency: clamp(finiteNumber(source.urgency, 0), 0, 1),
    distance,
    color: sanitizeColor(source.color),
  });
}

function sanitizeCandidate(candidate, visibilityMargin) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const id = sanitizeId(candidate.id);
  if (id === null || !VALID_KINDS.has(candidate.kind)) return null;
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null;
  if (
    candidate.x < -visibilityMargin || candidate.x > 1 + visibilityMargin
    || candidate.y < -visibilityMargin || candidate.y > 1 + visibilityMargin
  ) return null;

  return Object.freeze({
    ...candidate,
    id,
    kind: candidate.kind,
    role: KIND_ROLE.get(candidate.kind),
    x: candidate.x,
    y: candidate.y,
    radius: clamp(finiteNumber(candidate.radius, 0.08), 0.015, 0.65),
    intensity: clamp(finiteNumber(candidate.intensity, 0), 0, 1),
    urgency: clamp(finiteNumber(candidate.urgency, 0), 0, 1),
    distance: clamp(
      finiteNumber(candidate.distance, Math.hypot(candidate.x - 0.5, candidate.y - 0.5)),
      0,
      4,
    ),
    color: sanitizeColor(candidate.color),
  });
}

function compareCandidates(left, right, retainedIds) {
  const leftScore = left.urgency + (retainedIds.has(left.id) ? 0.08 : 0);
  const rightScore = right.urgency + (retainedIds.has(right.id) ? 0.08 : 0);
  return ROLE_PRIORITY.get(left.role) - ROLE_PRIORITY.get(right.role)
    || rightScore - leftScore
    || KIND_PRIORITY.get(left.kind) - KIND_PRIORITY.get(right.kind)
    || right.intensity - left.intensity
    || left.distance - right.distance
    || left.id.localeCompare(right.id);
}

function preferDuplicate(candidate, existing, retainedIds) {
  return compareCandidates(candidate, existing, retainedIds) < 0;
}

/**
 * Sanitize, reserve semantic roles, apply stable hysteresis, and cap local
 * lights. The input array and its objects are never mutated.
 */
export function selectEmissiveLights(candidates, options = {}) {
  const source = options !== null && typeof options === "object" && !Array.isArray(options)
    ? options
    : {};
  const limit = Math.min(
    MAX_EMISSIVE_LIGHTS,
    source.limit === undefined
      ? resolveEmissiveLightLimit(source)
      : Math.max(0, Math.trunc(finiteNumber(source.limit, MAX_EMISSIVE_LIGHTS))),
  );
  if (limit === 0 || !Array.isArray(candidates)) return Object.freeze([]);

  const visibilityMargin = clamp(
    finiteNumber(source.visibilityMargin, DEFAULT_VISIBILITY_MARGIN),
    0,
    0.25,
  );
  const retainedIds = new Set(
    Array.isArray(source.previousIds)
      ? source.previousIds.map(sanitizeId).filter((id) => id !== null)
      : [],
  );
  const candidatesById = new Map();
  for (const candidate of candidates) {
    const sanitized = sanitizeCandidate(candidate, visibilityMargin);
    if (sanitized === null || sanitized.intensity <= 0.001) continue;
    const existing = candidatesById.get(sanitized.id);
    if (existing === undefined || preferDuplicate(sanitized, existing, retainedIds)) {
      candidatesById.set(sanitized.id, sanitized);
    }
  }

  const ordered = [...candidatesById.values()]
    .sort((left, right) => compareCandidates(left, right, retainedIds));
  const selected = new Map();
  const add = (candidate) => {
    if (candidate !== undefined && selected.size < limit) selected.set(candidate.id, candidate);
  };

  // One source per role preserves the player, phase, tactical, and mission
  // hierarchy before spare capacity is filled by the global ordering.
  for (const role of [LIGHT_ROLES.PLAYER, LIGHT_ROLES.PHASE, LIGHT_ROLES.TACTICAL, LIGHT_ROLES.MISSION]) {
    add(ordered.find((candidate) => candidate.role === role));
  }
  for (const candidate of ordered) add(candidate);

  return Object.freeze([...selected.values()].sort((left, right) => (
    ROLE_PRIORITY.get(left.role) - ROLE_PRIORITY.get(right.role)
    || compareCandidates(left, right, retainedIds)
  )));
}
