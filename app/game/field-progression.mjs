export const MIN_FIELD_NUMBER = 1;
export const MAX_FIELD_NUMBER = 99;

const FIELD_STAGES = Object.freeze([
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
    pressureLabel: "ESCORT BIAS",
    planetoidCount: 32,
    planetoidYieldScale: 0.9,
    fabricatorSpeedScale: 1.08,
    sentinelSpeedScale: 1.04,
    guardBias: 0.14,
    novaInterceptionBias: 0.1,
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
    hudModifiers: Object.freeze(["FLUX -10%", "GUARD +14%"]),
  }),
  Object.freeze({
    pressureLabel: "NOVA SCREEN",
    planetoidCount: 30,
    planetoidYieldScale: 0.82,
    fabricatorSpeedScale: 1.13,
    sentinelSpeedScale: 1.09,
    guardBias: 0.28,
    novaInterceptionBias: 0.24,
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
    hudModifiers: Object.freeze(["NOVA SCREEN +24%", "SENTINELS +1"]),
  }),
  Object.freeze({
    pressureLabel: "SUPPLY DENIAL",
    planetoidCount: 28,
    planetoidYieldScale: 0.74,
    fabricatorSpeedScale: 1.18,
    sentinelSpeedScale: 1.14,
    guardBias: 0.42,
    novaInterceptionBias: 0.38,
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
    hudModifiers: Object.freeze(["FLUX -26%", "GUARD +42%"]),
  }),
  Object.freeze({
    pressureLabel: "TIGHT FORMATION",
    planetoidCount: 27,
    planetoidYieldScale: 0.7,
    fabricatorSpeedScale: 1.21,
    sentinelSpeedScale: 1.18,
    guardBias: 0.5,
    novaInterceptionBias: 0.46,
    initialCounts: Object.freeze({ fabricators: 6, sentinels: 5 }),
    capCounts: Object.freeze({ fabricators: 8, sentinels: 9 }),
    paletteKey: "verdigris",
    accentColors: Object.freeze({
      ambient: 0x3f6a62,
      resource: 0x8fffd6,
      threat: 0xff8661,
      energy: 0xb18cff,
    }),
    landmarkVariant: "broken-relays",
    hudModifiers: Object.freeze(["ESCORTS TIGHT", "NOVA SCREEN +46%"]),
  }),
  Object.freeze({
    pressureLabel: "SATURATION",
    planetoidCount: 26,
    planetoidYieldScale: 0.67,
    fabricatorSpeedScale: 1.24,
    sentinelSpeedScale: 1.21,
    guardBias: 0.57,
    novaInterceptionBias: 0.53,
    initialCounts: Object.freeze({ fabricators: 7, sentinels: 5 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 9 }),
    paletteKey: "ultraviolet",
    accentColors: Object.freeze({
      ambient: 0x59457a,
      resource: 0x73e7ff,
      threat: 0xff775d,
      energy: 0xe38cff,
    }),
    landmarkVariant: "forge-ring",
    hudModifiers: Object.freeze(["FLUX -33%", "SCREEN +53%"]),
  }),
  Object.freeze({
    pressureLabel: "HEAVY SCREEN",
    planetoidCount: 25,
    planetoidYieldScale: 0.64,
    fabricatorSpeedScale: 1.26,
    sentinelSpeedScale: 1.24,
    guardBias: 0.63,
    novaInterceptionBias: 0.59,
    initialCounts: Object.freeze({ fabricators: 7, sentinels: 6 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 10 }),
    paletteKey: "cold-iron",
    accentColors: Object.freeze({
      ambient: 0x455d73,
      resource: 0x8beaff,
      threat: 0xff9b65,
      energy: 0x9e8dff,
    }),
    landmarkVariant: "debris-lanes",
    hudModifiers: Object.freeze(["GUARD +63%", "SENTINELS +3"]),
  }),
  Object.freeze({
    pressureLabel: "MAX PRESSURE",
    planetoidCount: 24,
    planetoidYieldScale: 0.62,
    fabricatorSpeedScale: 1.28,
    sentinelSpeedScale: 1.26,
    guardBias: 0.68,
    novaInterceptionBias: 0.64,
    initialCounts: Object.freeze({ fabricators: 8, sentinels: 6 }),
    capCounts: Object.freeze({ fabricators: 9, sentinels: 10 }),
    paletteKey: "redline",
    accentColors: Object.freeze({
      ambient: 0x704354,
      resource: 0x7cecff,
      threat: 0xff654f,
      energy: 0xd27cff,
    }),
    landmarkVariant: "dense-mixed",
    hudModifiers: Object.freeze(["FLUX -38%", "SCREEN +64%"]),
  }),
]);

export const FIELD_PROFILE_STAGE_COUNT = FIELD_STAGES.length;

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
 * Population growth deliberately starts after Field 2, so early progression
 * changes enemy behavior and resource decisions before adding more actors.
 * @param {unknown} fieldNumber
 */
export function getFieldProgressionProfile(fieldNumber = MIN_FIELD_NUMBER) {
  const sanitizedFieldNumber = sanitizeFieldNumber(fieldNumber);
  const profileStage = Math.min(sanitizedFieldNumber, FIELD_PROFILE_STAGE_COUNT);
  const stage = FIELD_STAGES[profileStage - 1];

  return Object.freeze({
    fieldNumber: sanitizedFieldNumber,
    profileStage,
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
