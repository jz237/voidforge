const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const STANDARD_FLIGHT_PROFILE = Object.freeze({
  thrustExponent: 1,
  acceleration: 780,
  drag: 1.08,
  turnResponse: 9,
  maxSpeed: 535,
  sentinelBoltSpeed: 385,
  sentinelEngageRange: 1450,
  boltVisualScale: 1,
  integritySegments: 1,
  impactGraceSeconds: 0,
  impactKnockbackSpeed: 0,
  impactSeparation: 0,
});

export const MOBILE_FLIGHT_PROFILE = Object.freeze({
  thrustExponent: 0.72,
  acceleration: 980,
  drag: 1.35,
  turnResponse: 12,
  maxSpeed: 535,
  sentinelBoltSpeed: 300,
  sentinelEngageRange: 1100,
  boltVisualScale: 1.3,
  integritySegments: 3,
  impactGraceSeconds: 1.1,
  impactKnockbackSpeed: 420,
  impactSeparation: 60,
});

export function resolveMobileAssistCapability(input = {}) {
  const forced = input?.forced === true;
  const coarsePointer = input?.coarsePointer === true;
  const maxTouchPoints = Number.isFinite(input?.maxTouchPoints)
    ? Math.max(0, input.maxTouchPoints)
    : 0;
  const viewportWidth = Number.isFinite(input?.viewportWidth)
    ? Math.max(0, input.viewportWidth)
    : Number.POSITIVE_INFINITY;
  const viewportHeight = Number.isFinite(input?.viewportHeight)
    ? Math.max(0, input.viewportHeight)
    : Number.POSITIVE_INFINITY;
  const compactTouchDevice = maxTouchPoints > 0
    && Math.min(viewportWidth, viewportHeight) < 900;
  return forced || coarsePointer || compactTouchDevice;
}

export function resolveFlightProfile(mobileAssistEnabled) {
  return mobileAssistEnabled === true ? MOBILE_FLIGHT_PROFILE : STANDARD_FLIGHT_PROFILE;
}

export function applyTouchThrustCurve(magnitude, exponent = MOBILE_FLIGHT_PROFILE.thrustExponent) {
  const safeMagnitude = Number.isFinite(magnitude) ? clamp(magnitude, 0, 1) : 0;
  const safeExponent = Number.isFinite(exponent) ? clamp(exponent, 0.25, 2) : 1;
  return safeMagnitude ** safeExponent;
}

export function resolvePlayerImpact(integrity, maximumIntegrity) {
  const safeMaximum = Number.isFinite(maximumIntegrity)
    ? clamp(Math.round(maximumIntegrity), 1, 9)
    : 1;
  const safeIntegrity = Number.isFinite(integrity)
    ? clamp(Math.round(integrity), 1, safeMaximum)
    : safeMaximum;
  const remainingIntegrity = safeIntegrity - 1;
  return Object.freeze({
    hullLost: remainingIntegrity === 0,
    remainingIntegrity,
    maximumIntegrity: safeMaximum,
  });
}
