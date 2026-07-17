export const MIN_FIELD_NUMBER = 1;
export const MAX_FIELD_NUMBER = Number.MAX_SAFE_INTEGER;
export const ARENA_ARCHETYPE_COUNT = 4;
export const MAX_PRESSURE_TIER = 2;
export const FIELD_PROFILE_STAGE_COUNT = ARENA_ARCHETYPE_COUNT * MAX_PRESSURE_TIER;

const ARENA_IDENTITIES = Object.freeze([
  Object.freeze({
    arenaKey: "cinder-expanse",
    arenaName: "CINDER EXPANSE",
    archetype: "scarcity",
    arenaTagline: "Fractured ore drifts through the wake of a cooling star.",
  }),
  Object.freeze({
    arenaKey: "forge-wake",
    arenaName: "FORGE WAKE",
    archetype: "fabricator",
    arenaTagline: "Abandoned relays feed accelerated Fabricator harvest lanes.",
  }),
  Object.freeze({
    arenaKey: "razor-veil",
    arenaName: "RAZOR VEIL",
    archetype: "sentinel",
    arenaTagline: "Sentinel screens tighten around every viable Nova vector.",
  }),
  Object.freeze({
    arenaKey: "shard-reef",
    arenaName: "SHARD REEF",
    archetype: "planetoid",
    arenaTagline: "Dense fracture bodies turn mining lanes into cover and hazard.",
  }),
]);

// Four original arena archetypes repeat at two bounded pressure tiers. The
// identity continues cycling after Field 8, while the simulation values stay
// capped at Tier II so an endless run keeps changing tactics without allowing
// actor counts or speeds to grow without limit.
const FIELD_STAGES = Object.freeze([
  // Tier I · introductory archetype cycle.
  Object.freeze({
    pressureLabel: "NOMINAL",
    planetoidCount: 34,
    planetoidYieldScale: 1,
    fabricatorSpeedScale: 1,
    sentinelSpeedScale: 1,
    guardBias: 0,
    novaInterceptionBias: 0,
    initialCounts: Object.freeze({ fabricators: 5, sentinels: 3 }),
    capCounts: Object.freeze({ fabricators: 6, sentinels: 6 }),
    paletteKey: "cinder",
    accentColors: Object.freeze({
      ambient: 0x4d5a78,
      resource: 0x65e8ff,
      threat: 0xff8a48,
      energy: 0xb978ff,
    }),
    landmarkVariant: "mixed",
    hudModifiers: Object.freeze(["FLUX 100%", "ESCORTS LOOSE"]),
  }),
  Object.freeze({
    pressureLabel: "HARVEST BIAS",
    planetoidCount: 32,
    planetoidYieldScale: 0.9,
    fabricatorSpeedScale: 1.13,
    sentinelSpeedScale: 1.02,
    guardBias: 0.18,
    novaInterceptionBias: 0.08,
    initialCounts: Object.freeze({ fabricators: 5, sentinels: 3 }),
    capCounts: Object.freeze({ fabricators: 6, sentinels: 6 }),
    paletteKey: "violet",
    accentColors: Object.freeze({
      ambient: 0x69527d,
      resource: 0x72ddff,
      threat: 0xffa357,
      energy: 0xd685ff,
    }),
    landmarkVariant: "relay-screen",
    hudModifiers: Object.freeze(["HARVEST +13%", "GUARD +18%"]),
  }),
  Object.freeze({
    pressureLabel: "SENTINEL BIAS",
    planetoidCount: 32,
    planetoidYieldScale: 0.9,
    fabricatorSpeedScale: 1.05,
    sentinelSpeedScale: 1.16,
    guardBias: 0.26,
    novaInterceptionBias: 0.34,
    initialCounts: Object.freeze({ fabricators: 5, sentinels: 4 }),
    capCounts: Object.freeze({ fabricators: 7, sentinels: 7 }),
    paletteKey: "ion",
    accentColors: Object.freeze({
      ambient: 0x3c6873,
      resource: 0x73f1d2,
      threat: 0xff7666,
      energy: 0x8d9cff,
    }),
    landmarkVariant: "wreck-belt",
    hudModifiers: Object.freeze(["SENTINELS +1", "NOVA SCREEN +34%"]),
  }),
  Object.freeze({
    pressureLabel: "FRACTURE BELT",
    planetoidCount: 40,
    planetoidYieldScale: 0.86,
    fabricatorSpeedScale: 1.12,
    sentinelSpeedScale: 1.1,
    guardBias: 0.24,
    novaInterceptionBias: 0.2,
    initialCounts: Object.freeze({ fabricators: 6, sentinels: 4 }),
    capCounts: Object.freeze({ fabricators: 8, sentinels: 8 }),
    paletteKey: "ember",
    accentColors: Object.freeze({
      ambient: 0x75543d,
      resource: 0xffcb72,
      threat: 0xff6f54,
      energy: 0x63d8ff,
    }),
    landmarkVariant: "mining-rigs",
    hudModifiers: Object.freeze(["BODIES +25%", "FLUX VEINS -14%"]),
  }),
  // Tier II · the same identities with capped high-pressure tuning.
  Object.freeze({
    pressureLabel: "ASH SCARCITY",
    planetoidCount: 24,
    planetoidYieldScale: 0.6,
    fabricatorSpeedScale: 1.22,
    sentinelSpeedScale: 1.2,
    guardBias: 0.52,
    novaInterceptionBias: 0.5,
    initialCounts: Object.freeze({ fabricators: 7, sentinels: 5 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 9 }),
    paletteKey: "verdigris",
    accentColors: Object.freeze({
      ambient: 0x3f6a62,
      resource: 0x8fffd6,
      threat: 0xff8661,
      energy: 0xb18cff,
    }),
    landmarkVariant: "broken-relays",
    hudModifiers: Object.freeze(["FLUX -40%", "GUARD +52%"]),
  }),
  Object.freeze({
    pressureLabel: "HARVEST SURGE",
    planetoidCount: 27,
    planetoidYieldScale: 0.67,
    fabricatorSpeedScale: 1.32,
    sentinelSpeedScale: 1.18,
    guardBias: 0.62,
    novaInterceptionBias: 0.48,
    initialCounts: Object.freeze({ fabricators: 8, sentinels: 5 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 9 }),
    paletteKey: "ultraviolet",
    accentColors: Object.freeze({
      ambient: 0x59457a,
      resource: 0x73e7ff,
      threat: 0xff775d,
      energy: 0xe38cff,
    }),
    landmarkVariant: "forge-ring",
    hudModifiers: Object.freeze(["FABRICATORS +3", "HARVEST +32%"]),
  }),
  Object.freeze({
    pressureLabel: "NOVA GAUNTLET",
    planetoidCount: 29,
    planetoidYieldScale: 0.72,
    fabricatorSpeedScale: 1.18,
    sentinelSpeedScale: 1.32,
    guardBias: 0.58,
    novaInterceptionBias: 0.72,
    initialCounts: Object.freeze({ fabricators: 6, sentinels: 7 }),
    capCounts: Object.freeze({ fabricators: 8, sentinels: 10 }),
    paletteKey: "cold-iron",
    accentColors: Object.freeze({
      ambient: 0x455d73,
      resource: 0x8beaff,
      threat: 0xff9b65,
      energy: 0x9e8dff,
    }),
    landmarkVariant: "debris-lanes",
    hudModifiers: Object.freeze(["SENTINELS +4", "SCREEN +72%"]),
  }),
  Object.freeze({
    pressureLabel: "FRACTURE STORM",
    planetoidCount: 42,
    planetoidYieldScale: 0.78,
    fabricatorSpeedScale: 1.24,
    sentinelSpeedScale: 1.26,
    guardBias: 0.6,
    novaInterceptionBias: 0.58,
    initialCounts: Object.freeze({ fabricators: 7, sentinels: 6 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 10 }),
    paletteKey: "redline",
    accentColors: Object.freeze({
      ambient: 0x704354,
      resource: 0x7cecff,
      threat: 0xff654f,
      energy: 0xd27cff,
    }),
    landmarkVariant: "dense-mixed",
    hudModifiers: Object.freeze(["BODIES +31%", "FLUX VEINS -22%"]),
  }),
]);

/**
 * Normalize untrusted field input for display and deterministic profile lookup.
 * @param {unknown} fieldNumber
 * @returns {number}
 */
export function sanitizeFieldNumber(fieldNumber) {
  const numeric = typeof fieldNumber === "string" && fieldNumber.trim() !== ""
    ? Number(fieldNumber)
    : fieldNumber;
  if (!Number.isFinite(numeric)) return MIN_FIELD_NUMBER;
  return Math.max(
    MIN_FIELD_NUMBER,
    Math.min(MAX_FIELD_NUMBER, Math.trunc(numeric)),
  );
}

/**
 * Resolve bounded resource, coordination, presentation, and population tuning.
 * Field 2 still changes behavior before adding actors. Fields 1–4 establish the
 * four tactical identities; Fields 5–8 repeat them at Tier II; later fields
 * keep cycling the identities while all pressure values remain capped.
 * @param {unknown} fieldNumber
 */
export function getFieldProgressionProfile(fieldNumber = MIN_FIELD_NUMBER) {
  const sanitizedFieldNumber = sanitizeFieldNumber(fieldNumber);
  const arenaIndex = (sanitizedFieldNumber - 1) % ARENA_ARCHETYPE_COUNT;
  const pressureTier = Math.min(
    MAX_PRESSURE_TIER,
    Math.floor((sanitizedFieldNumber - 1) / ARENA_ARCHETYPE_COUNT) + 1,
  );
  const stageIndex = (pressureTier - 1) * ARENA_ARCHETYPE_COUNT + arenaIndex;
  const stage = FIELD_STAGES[stageIndex];
  const arena = ARENA_IDENTITIES[arenaIndex];

  return Object.freeze({
    fieldNumber: sanitizedFieldNumber,
    profileStage: stageIndex + 1,
    pressureTier,
    arenaIndex,
    arenaKey: arena.arenaKey,
    arenaName: arena.arenaName,
    arenaTagline: arena.arenaTagline,
    archetype: arena.archetype,
    repairEnabled: sanitizedFieldNumber > MIN_FIELD_NUMBER,
    pressureLabel: stage.pressureLabel,
    planetoidCount: stage.planetoidCount,
    planetoidYieldScale: stage.planetoidYieldScale,
    fabricatorSpeedScale: stage.fabricatorSpeedScale,
    sentinelSpeedScale: stage.sentinelSpeedScale,
    guardBias: stage.guardBias,
    novaInterceptionBias: stage.novaInterceptionBias,
    initialCounts: stage.initialCounts,
    capCounts: stage.capCounts,
    paletteKey: stage.paletteKey,
    accentColors: stage.accentColors,
    landmarkVariant: stage.landmarkVariant,
    hudModifiers: stage.hudModifiers,
  });
}
