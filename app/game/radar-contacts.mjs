export const RADAR_CONTACT_KINDS = Object.freeze({
  BOSS: "boss",
  HOSTILE_PROJECTILE: "hostileProjectile",
  SENTINEL: "sentinel",
  LOADED_FABRICATOR: "loadedFabricator",
  FABRICATOR: "fabricator",
  CRYSTAL: "crystal",
  PLANETOID: "planetoid",
});

const DEFAULT_MAX_CONTACTS = 20;
const DEFAULT_RADAR_RANGE = 2400;
const RADAR_MIN = 3;
const RADAR_MAX = 97;
const RADAR_CENTER = 50;
const RADAR_RADIUS = 48;

const CONTACT_KIND_PRIORITY = new Map([
  [RADAR_CONTACT_KINDS.BOSS, 0],
  [RADAR_CONTACT_KINDS.HOSTILE_PROJECTILE, 1],
  [RADAR_CONTACT_KINDS.SENTINEL, 2],
  [RADAR_CONTACT_KINDS.LOADED_FABRICATOR, 3],
  [RADAR_CONTACT_KINDS.FABRICATOR, 4],
  [RADAR_CONTACT_KINDS.CRYSTAL, 5],
  [RADAR_CONTACT_KINDS.PLANETOID, 6],
]);

const VALID_CONTACT_KINDS = new Set(CONTACT_KIND_PRIORITY.keys());

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function compareCandidates(left, right) {
  return CONTACT_KIND_PRIORITY.get(left.kind) - CONTACT_KIND_PRIORITY.get(right.kind)
    || left.range - right.range
    || left.id - right.id;
}

function compareNearest(left, right) {
  return left.range - right.range || left.id - right.id;
}

function sanitizeMaxContacts(value) {
  if (value === undefined) return DEFAULT_MAX_CONTACTS;
  if (!Number.isFinite(value)) return DEFAULT_MAX_CONTACTS;
  return Math.max(0, Math.trunc(value));
}

function sanitizeCandidate(candidate) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  if (!VALID_CONTACT_KINDS.has(candidate.kind)) return null;
  if (!Number.isFinite(candidate.id) || candidate.id < 0) return null;

  const id = Math.trunc(candidate.id);
  const hasValidRange = Number.isFinite(candidate.range) && candidate.range >= 0;
  const rawRange = hasValidRange ? candidate.range : 1;
  const range = clamp(rawRange, 0, 1);
  const inRange = typeof candidate.inRange === "boolean"
    ? candidate.inRange
    : hasValidRange && rawRange <= 1;

  return Object.freeze({
    ...candidate,
    id,
    kind: candidate.kind,
    range,
    inRange,
  });
}

function preferDuplicate(candidate, existing) {
  const candidateEligible = candidate.kind === RADAR_CONTACT_KINDS.BOSS || candidate.inRange;
  const existingEligible = existing.kind === RADAR_CONTACT_KINDS.BOSS || existing.inRange;
  if (candidateEligible !== existingEligible) return candidateEligible;
  return compareCandidates(candidate, existing) < 0;
}

/**
 * Sanitize, prioritize, and cap radar candidates. Non-boss contacts outside the
 * radar range are discarded. The nearest crystal and planetoid reserve a slot
 * when capacity allows, keeping the mining loop visible under combat pressure.
 *
 * Candidates use the normalized `range` and `inRange` fields returned by
 * `projectRadarContact`. Additional candidate metadata is preserved.
 */
export function selectRadarCandidates(candidates, maxContacts = DEFAULT_MAX_CONTACTS) {
  const cap = sanitizeMaxContacts(maxContacts);
  if (cap === 0 || !Array.isArray(candidates)) return Object.freeze([]);

  const candidatesById = new Map();
  for (const candidate of candidates) {
    const sanitized = sanitizeCandidate(candidate);
    if (sanitized === null) continue;
    const existing = candidatesById.get(sanitized.id);
    if (existing === undefined || preferDuplicate(sanitized, existing)) {
      candidatesById.set(sanitized.id, sanitized);
    }
  }

  const sanitizedCandidates = [...candidatesById.values()];
  const bosses = sanitizedCandidates
    .filter((candidate) => candidate.kind === RADAR_CONTACT_KINDS.BOSS)
    .sort(compareNearest);
  const inRangeCandidates = sanitizedCandidates
    .filter((candidate) => candidate.kind !== RADAR_CONTACT_KINDS.BOSS && candidate.inRange)
    .sort(compareCandidates);

  const selected = new Map();
  const addCandidate = (candidate) => {
    if (candidate === undefined || selected.size >= cap) return;
    selected.set(candidate.id, candidate);
  };

  // Boss persistence takes precedence, including when it is beyond radar range.
  addCandidate(bosses[0]);

  for (const reservedKind of [RADAR_CONTACT_KINDS.CRYSTAL, RADAR_CONTACT_KINDS.PLANETOID]) {
    const nearestResource = inRangeCandidates
      .filter((candidate) => candidate.kind === reservedKind)
      .sort(compareNearest)[0];
    addCandidate(nearestResource);
  }

  for (const candidate of inRangeCandidates) addCandidate(candidate);

  return Object.freeze([...selected.values()].sort(compareCandidates));
}

/**
 * Project a world-space target into the player-relative 3..97 radar square.
 * The returned `range` is normalized and clamped to 0..1; `inRange` retains
 * whether the unclamped radial distance was inside the configured range.
 */
export function projectRadarContact(options = {}) {
  const source = options !== null && typeof options === "object" && !Array.isArray(options)
    ? options
    : {};
  const playerX = finiteNumber(source.playerX, 0);
  const playerY = finiteNumber(source.playerY, 0);
  const playerAngle = finiteNumber(source.playerAngle, 0);
  const targetX = finiteNumber(source.targetX, playerX);
  const targetY = finiteNumber(source.targetY, playerY);
  const range = Number.isFinite(source.range) && source.range > 0
    ? source.range
    : DEFAULT_RADAR_RANGE;

  const dx = targetX - playerX;
  const dy = targetY - playerY;
  const cos = Math.cos(-playerAngle);
  const sin = Math.sin(-playerAngle);
  const relativeX = dx * cos - dy * sin;
  const relativeY = dx * sin + dy * cos;
  const distance = Math.hypot(dx, dy);

  return Object.freeze({
    x: clamp(RADAR_CENTER + (relativeX / range) * RADAR_RADIUS, RADAR_MIN, RADAR_MAX),
    y: clamp(RADAR_CENTER + (relativeY / range) * RADAR_RADIUS, RADAR_MIN, RADAR_MAX),
    range: clamp(distance / range, 0, 1),
    inRange: distance <= range,
  });
}
