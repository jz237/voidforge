import assert from "node:assert/strict";
import test from "node:test";

import {
  FIELD_PROFILE_STAGE_COUNT,
  MAX_FIELD_NUMBER,
  getFieldProgressionProfile,
  sanitizeFieldNumber,
} from "../app/game/field-progression.mjs";

test("field numbers sanitize to a finite bounded integer", () => {
  assert.equal(sanitizeFieldNumber(undefined), 1);
  assert.equal(sanitizeFieldNumber(Number.NaN), 1);
  assert.equal(sanitizeFieldNumber(-4), 1);
  assert.equal(sanitizeFieldNumber(2.9), 2);
  assert.equal(sanitizeFieldNumber("4"), 4);
  assert.equal(sanitizeFieldNumber(""), 1);
  assert.equal(sanitizeFieldNumber(10_000), MAX_FIELD_NUMBER);
});

test("profiles are deterministic and deeply immutable", () => {
  const first = getFieldProgressionProfile(3);
  const repeated = getFieldProgressionProfile(3);

  assert.deepEqual(first, repeated);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.initialCounts), true);
  assert.equal(Object.isFrozen(first.capCounts), true);
  assert.equal(Object.isFrozen(first.accentColors), true);
  assert.equal(Object.isFrozen(first.hudModifiers), true);
  assert.throws(() => first.hudModifiers.push("MUTATED"), TypeError);
});

test("Field 2 changes scarcity and coordination before adding enemies", () => {
  const field1 = getFieldProgressionProfile(1);
  const field2 = getFieldProgressionProfile(2);

  assert.deepEqual(field2.initialCounts, field1.initialCounts);
  assert.deepEqual(field2.capCounts, field1.capCounts);
  assert.ok(field2.planetoidCount < field1.planetoidCount);
  assert.ok(field2.planetoidYieldScale < field1.planetoidYieldScale);
  assert.ok(field2.fabricatorSpeedScale > field1.fabricatorSpeedScale);
  assert.ok(field2.sentinelSpeedScale > field1.sentinelSpeedScale);
  assert.ok(field2.guardBias > field1.guardBias);
  assert.ok(field2.novaInterceptionBias > field1.novaInterceptionBias);
});

test("enemy counts grow only after the early behavior modifier stage", () => {
  const field2 = getFieldProgressionProfile(2);
  const field3 = getFieldProgressionProfile(3);
  const field4 = getFieldProgressionProfile(4);

  assert.ok(field3.initialCounts.sentinels > field2.initialCounts.sentinels);
  assert.ok(field3.capCounts.fabricators > field2.capCounts.fabricators);
  assert.ok(field3.capCounts.sentinels > field2.capCounts.sentinels);
  assert.ok(field4.initialCounts.fabricators > field3.initialCounts.fabricators);
  assert.ok(field4.capCounts.fabricators > field3.capCounts.fabricators);
  assert.ok(field4.capCounts.sentinels > field3.capCounts.sentinels);
});

test("Fields 1 through 4 escalate pressure while changing visual identity", () => {
  const profiles = [1, 2, 3, 4].map(getFieldProgressionProfile);

  for (let index = 1; index < profiles.length; index += 1) {
    const previous = profiles[index - 1];
    const current = profiles[index];
    assert.ok(current.planetoidCount < previous.planetoidCount);
    assert.ok(current.planetoidYieldScale < previous.planetoidYieldScale);
    assert.ok(current.fabricatorSpeedScale > previous.fabricatorSpeedScale);
    assert.ok(current.sentinelSpeedScale > previous.sentinelSpeedScale);
    assert.ok(current.guardBias > previous.guardBias);
    assert.ok(current.novaInterceptionBias > previous.novaInterceptionBias);
  }

  assert.equal(new Set(profiles.map((profile) => profile.pressureLabel)).size, 4);
  assert.equal(new Set(profiles.map((profile) => profile.paletteKey)).size, 4);
  assert.equal(new Set(profiles.map((profile) => profile.landmarkVariant)).size, 4);
  assert.ok(profiles.every((profile) => profile.hudModifiers.length === 2));
  assert.ok(profiles.flatMap((profile) => profile.hudModifiers).every((label) => label.length <= 18));
});

test("late fields preserve their number while bounded tuning stops at the final stage", () => {
  const finalStage = getFieldProgressionProfile(FIELD_PROFILE_STAGE_COUNT);
  const late = getFieldProgressionProfile(91);

  assert.equal(late.fieldNumber, 91);
  assert.equal(late.profileStage, FIELD_PROFILE_STAGE_COUNT);
  assert.deepEqual(
    { ...late, fieldNumber: finalStage.fieldNumber },
    finalStage,
  );
  assert.ok(late.planetoidCount >= 24);
  assert.ok(late.planetoidYieldScale >= 0.62);
  assert.ok(late.fabricatorSpeedScale <= 1.28);
  assert.ok(late.sentinelSpeedScale <= 1.26);
  assert.ok(late.guardBias <= 0.68);
  assert.ok(late.novaInterceptionBias <= 0.64);
  assert.ok(late.capCounts.fabricators <= 9);
  assert.ok(late.capCounts.sentinels <= 10);
});
