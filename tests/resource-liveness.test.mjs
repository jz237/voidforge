import assert from "node:assert/strict";
import test from "node:test";

import {
  assessFluxLiveness,
  recommendedRecoveryShardCount,
} from "../app/game/resource-liveness.mjs";

test("construction counts only field Flux toward remaining modules", () => {
  const assessment = assessFluxLiveness({
    engineActive: false,
    enginePieces: 12,
    engineHealth: 13,
    charges: 20,
    planetoidShards: 4,
    looseCrystals: 2,
    loadedFabricators: 1,
    inFlightNovas: 8,
  });

  assert.deepEqual(assessment, {
    phase: "construction",
    required: 8,
    recoverable: 7,
    deficit: 1,
    recoveryNeeded: true,
  });

  assert.deepEqual(
    assessFluxLiveness({
      engineActive: false,
      enginePieces: 18,
      planetoidShards: 1,
      looseCrystals: 1,
      loadedFabricators: 1,
    }),
    {
      phase: "construction",
      required: 2,
      recoverable: 3,
      deficit: 0,
      recoveryNeeded: false,
    },
  );
});

test("assault counts stored, launched, loose, carried, and unmined Flux", () => {
  assert.deepEqual(
    assessFluxLiveness({
      engineActive: true,
      enginePieces: 20,
      engineHealth: 13,
      charges: 3,
      planetoidShards: 4,
      looseCrystals: 2,
      loadedFabricators: 1,
      inFlightNovas: 2,
    }),
    {
      phase: "assault",
      required: 13,
      recoverable: 12,
      deficit: 1,
      recoveryNeeded: true,
    },
  );

  assert.deepEqual(
    assessFluxLiveness({
      engineActive: true,
      engineHealth: 5,
      charges: 2,
      looseCrystals: 2,
      inFlightNovas: 1,
    }),
    {
      phase: "assault",
      required: 5,
      recoverable: 5,
      deficit: 0,
      recoveryNeeded: false,
    },
  );
});

test("a zero-health active Engine reports a secure field", () => {
  assert.deepEqual(
    assessFluxLiveness({
      engineActive: true,
      engineHealth: 0,
      charges: 4,
      planetoidShards: 3,
      looseCrystals: 2,
      loadedFabricators: 1,
      inFlightNovas: 1,
    }),
    {
      phase: "secure",
      required: 0,
      recoverable: 11,
      deficit: 0,
      recoveryNeeded: false,
    },
  );

  const emptySecure = assessFluxLiveness({
    engineActive: true,
    engineHealth: 0,
  });
  assert.equal(emptySecure.phase, "secure");
  assert.equal(emptySecure.recoveryNeeded, false);
});

test("counts sanitize to finite nonnegative integers", () => {
  assert.deepEqual(
    assessFluxLiveness({
      engineActive: false,
      enginePieces: -4,
      engineHealth: Number.NaN,
      charges: 9.9,
      planetoidShards: 2.9,
      looseCrystals: -3,
      loadedFabricators: Number.POSITIVE_INFINITY,
      inFlightNovas: 7.8,
      enginePiecesMax: 19.8,
    }),
    {
      phase: "construction",
      required: 19,
      recoverable: 2,
      deficit: 17,
      recoveryNeeded: true,
    },
  );

  assert.deepEqual(assessFluxLiveness(), {
    phase: "construction",
    required: 20,
    recoverable: 0,
    deficit: 20,
    recoveryNeeded: true,
  });
});

test("assessments are immutable snapshots", () => {
  const assessment = assessFluxLiveness({
    engineActive: true,
    engineHealth: 4,
    charges: 1,
  });

  assert.equal(Object.isFrozen(assessment), true);
  assert.throws(() => {
    assessment.deficit = 0;
  }, TypeError);
  assert.equal(assessment.deficit, 3);
});

test("recommended recovery shard counts honor default and custom bounds", () => {
  assert.equal(recommendedRecoveryShardCount(0), 3);
  assert.equal(recommendedRecoveryShardCount(4), 4);
  assert.equal(recommendedRecoveryShardCount(99), 6);
  assert.equal(recommendedRecoveryShardCount(3.9, 2, 5), 3);
  assert.equal(recommendedRecoveryShardCount(Number.NaN, 2, 5), 2);
  assert.equal(recommendedRecoveryShardCount(7, 8, 2), 8);
  assert.equal(recommendedRecoveryShardCount(-4, -2, Number.POSITIVE_INFINITY), 0);
});
