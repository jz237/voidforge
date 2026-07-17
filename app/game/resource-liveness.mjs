const DEFAULT_ENGINE_PIECES_MAX = 20;
const MAX_COUNT = Number.MAX_SAFE_INTEGER;

function nonnegativeInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_COUNT, Math.max(0, Math.floor(value)));
}

function addCounts(...values) {
  return Math.min(
    MAX_COUNT,
    values.reduce((total, value) => total + value, 0),
  );
}

/**
 * Determine whether the remaining field resources can still reach the next
 * mandatory phase of the mining -> construction -> assault loop.
 *
 * Player-held and already-launched Novas cannot help finish construction, so
 * they enter the accounting only after the Dread Engine is active.
 *
 * @param {{
 *   engineActive?: boolean,
 *   enginePieces?: number,
 *   engineHealth?: number,
 *   charges?: number,
 *   planetoidShards?: number,
 *   looseCrystals?: number,
 *   loadedFabricators?: number,
 *   inFlightNovas?: number,
 *   enginePiecesMax?: number,
 * }} [input]
 */
export function assessFluxLiveness(input = {}) {
  const engineActive = Boolean(input.engineActive);
  const enginePieces = nonnegativeInteger(input.enginePieces);
  const engineHealth = nonnegativeInteger(input.engineHealth);
  const charges = nonnegativeInteger(input.charges);
  const planetoidShards = nonnegativeInteger(input.planetoidShards);
  const looseCrystals = nonnegativeInteger(input.looseCrystals);
  const loadedFabricators = nonnegativeInteger(input.loadedFabricators);
  const inFlightNovas = nonnegativeInteger(input.inFlightNovas);
  const enginePiecesMax = input.enginePiecesMax === undefined
    ? DEFAULT_ENGINE_PIECES_MAX
    : nonnegativeInteger(input.enginePiecesMax);

  const fieldFlux = addCounts(
    planetoidShards,
    looseCrystals,
    loadedFabricators,
  );

  let phase;
  let required;
  let recoverable;

  if (!engineActive) {
    phase = "construction";
    required = Math.max(0, enginePiecesMax - enginePieces);
    recoverable = fieldFlux;
  } else {
    phase = engineHealth === 0 ? "secure" : "assault";
    required = engineHealth;
    recoverable = addCounts(fieldFlux, charges, inFlightNovas);
  }

  const deficit = Math.max(0, required - recoverable);

  return Object.freeze({
    phase,
    required,
    recoverable,
    deficit,
    recoveryNeeded: deficit > 0,
  });
}

/**
 * Convert a liveness deficit into a bounded recovery drop size.
 *
 * @param {number} deficit
 * @param {number} [min]
 * @param {number} [max]
 */
export function recommendedRecoveryShardCount(deficit, min = 3, max = 6) {
  const minimum = nonnegativeInteger(min);
  const maximum = Math.max(minimum, nonnegativeInteger(max));
  return Math.min(maximum, Math.max(minimum, nonnegativeInteger(deficit)));
}
