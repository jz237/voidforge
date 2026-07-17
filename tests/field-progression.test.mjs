import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_ARCHETYPE_COUNT,
  FIELD_PROFILE_STAGE_COUNT,
  MAX_FIELD_NUMBER,
  MAX_PRESSURE_TIER,
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
  assert.equal(sanitizeFieldNumber(10_000), 10_000);
  assert.equal(sanitizeFieldNumber(Number.MAX_SAFE_INTEGER + 1_000), MAX_FIELD_NUMBER);
});

test("Field 1 preserves the exact introductory gameplay baseline", () => {
  assert.deepEqual(getFieldProgressionProfile(1), {
    fieldNumber: 1,
    profileStage: 1,
    pressureTier: 1,
    arenaIndex: 0,
    arenaKey: "cinder-expanse",
    arenaName: "CINDER EXPANSE",
    arenaTagline: "Fractured ore drifts through the wake of a cooling star.",
    archetype: "scarcity",
    repairEnabled: false,
    pressureLabel: "NOMINAL",
    planetoidCount: 34,
    planetoidYieldScale: 1,
    fabricatorSpeedScale: 1,
    sentinelSpeedScale: 1,
    guardBias: 0,
    novaInterceptionBias: 0,
    initialCounts: { fabricators: 5, sentinels: 3 },
    capCounts: { fabricators: 6, sentinels: 6 },
    paletteKey: "cinder",
    accentColors: {
      ambient: 0x4d5a78,
      resource: 0x65e8ff,
      threat: 0xff8a48,
      energy: 0xb978ff,
    },
    landmarkVariant: "mixed",
    hudModifiers: ["FLUX 100%", "ESCORTS LOOSE"],
  });
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
  assert.match(first.arenaKey, /^[a-z]+(?:-[a-z]+)+$/);
  assert.match(first.arenaName, /^[A-Z ]+$/);
  assert.ok(first.arenaTagline.length > 20);
});

test("Fields 1 through 4 establish four named tactical archetypes", () => {
  const profiles = [1, 2, 3, 4].map(getFieldProgressionProfile);

  assert.equal(ARENA_ARCHETYPE_COUNT, 4);
  assert.deepEqual(
    profiles.map((profile) => profile.arenaKey),
    ["cinder-expanse", "forge-wake", "razor-veil", "shard-reef"],
  );
  assert.equal(new Set(profiles.map((profile) => profile.arenaName)).size, 4);
  assert.equal(new Set(profiles.map((profile) => profile.archetype)).size, 4);
  assert.ok(profiles.every((profile) => profile.pressureTier === 1));
  assert.ok(profiles.every((profile) => profile.hudModifiers.length === 2));
  assert.ok(profiles.flatMap((profile) => profile.hudModifiers).every((label) => label.length <= 18));
});

test("Field 2 changes economic pressure before adding enemies", () => {
  const field1 = getFieldProgressionProfile(1);
  const field2 = getFieldProgressionProfile(2);

  assert.deepEqual(field2.initialCounts, field1.initialCounts);
  assert.deepEqual(field2.capCounts, field1.capCounts);
  assert.ok(field2.planetoidCount < field1.planetoidCount);
  assert.ok(field2.planetoidYieldScale < field1.planetoidYieldScale);
  assert.ok(field2.fabricatorSpeedScale > field1.fabricatorSpeedScale);
  assert.ok(field2.fabricatorSpeedScale > field2.sentinelSpeedScale);
  assert.ok(field2.guardBias > field1.guardBias);
});

test("arena profiles emphasize economy, combat, planetoids, or scarcity", () => {
  const cinder = getFieldProgressionProfile(5);
  const forge = getFieldProgressionProfile(6);
  const razor = getFieldProgressionProfile(7);
  const reef = getFieldProgressionProfile(8);

  assert.ok(forge.initialCounts.fabricators > forge.initialCounts.sentinels);
  assert.ok(forge.fabricatorSpeedScale > razor.fabricatorSpeedScale);
  assert.ok(forge.fabricatorSpeedScale > reef.fabricatorSpeedScale);

  assert.ok(razor.initialCounts.sentinels > forge.initialCounts.sentinels);
  assert.ok(razor.sentinelSpeedScale > forge.sentinelSpeedScale);
  assert.ok(razor.novaInterceptionBias > forge.novaInterceptionBias);

  assert.ok(reef.planetoidCount > cinder.planetoidCount);
  assert.ok(reef.planetoidCount > forge.planetoidCount);
  assert.ok(reef.planetoidCount * reef.planetoidYieldScale > cinder.planetoidCount * cinder.planetoidYieldScale);
  assert.ok(cinder.planetoidYieldScale < forge.planetoidYieldScale);
});

test("Fields 5 through 8 repeat every identity at the capped pressure tier", () => {
  assert.equal(MAX_PRESSURE_TIER, 2);
  assert.equal(FIELD_PROFILE_STAGE_COUNT, ARENA_ARCHETYPE_COUNT * MAX_PRESSURE_TIER);

  for (let index = 0; index < ARENA_ARCHETYPE_COUNT; index += 1) {
    const firstTier = getFieldProgressionProfile(index + 1);
    const secondTier = getFieldProgressionProfile(index + 1 + ARENA_ARCHETYPE_COUNT);
    assert.equal(secondTier.arenaKey, firstTier.arenaKey);
    assert.equal(secondTier.arenaName, firstTier.arenaName);
    assert.equal(secondTier.archetype, firstTier.archetype);
    assert.equal(secondTier.pressureTier, 2);
    assert.ok(secondTier.fabricatorSpeedScale >= firstTier.fabricatorSpeedScale);
    assert.ok(secondTier.sentinelSpeedScale >= firstTier.sentinelSpeedScale);
    assert.ok(secondTier.guardBias >= firstTier.guardBias);
    assert.ok(secondTier.novaInterceptionBias >= firstTier.novaInterceptionBias);
  }
});

test("late fields keep cycling identities while pressure remains bounded", () => {
  const withoutFieldIdentity = (profile) => {
    const comparable = { ...profile };
    delete comparable.fieldNumber;
    return comparable;
  };

  for (let index = 0; index < ARENA_ARCHETYPE_COUNT; index += 1) {
    const capped = getFieldProgressionProfile(5 + index);
    const late = getFieldProgressionProfile(93 + index);
    assert.equal(late.fieldNumber, 93 + index);
    assert.equal(late.profileStage, capped.profileStage);
    assert.deepEqual(withoutFieldIdentity(late), withoutFieldIdentity(capped));
  }

  assert.deepEqual(
    withoutFieldIdentity(getFieldProgressionProfile(100)),
    withoutFieldIdentity(getFieldProgressionProfile(8)),
  );
  assert.deepEqual(
    withoutFieldIdentity(getFieldProgressionProfile(101)),
    withoutFieldIdentity(getFieldProgressionProfile(5)),
  );

  const all = [
    ...Array.from({ length: FIELD_PROFILE_STAGE_COUNT }, (_, index) => getFieldProgressionProfile(index + 1)),
    ...[9, 10, 93, 96, 99, 100, 101, 1_000, 10_001, MAX_FIELD_NUMBER].map(getFieldProgressionProfile),
  ];
  assert.ok(all.every((profile) => profile.pressureTier <= MAX_PRESSURE_TIER));
  assert.ok(all.every((profile) => profile.planetoidCount >= 24 && profile.planetoidCount <= 42));
  assert.ok(all.every((profile) => profile.planetoidYieldScale >= 0.6 && profile.planetoidYieldScale <= 1));
  assert.ok(all.every((profile) => profile.fabricatorSpeedScale <= 1.32));
  assert.ok(all.every((profile) => profile.sentinelSpeedScale <= 1.32));
  assert.ok(all.every((profile) => profile.guardBias <= 0.62));
  assert.ok(all.every((profile) => profile.novaInterceptionBias <= 0.72));
  assert.ok(all.every((profile) => profile.capCounts.fabricators <= 9));
  assert.ok(all.every((profile) => profile.capCounts.sentinels <= 10));
});

test("repair is denied only in the introductory field", () => {
  assert.equal(getFieldProgressionProfile(1).repairEnabled, false);
  for (const field of [2, 4, 8, 31, MAX_FIELD_NUMBER]) {
    assert.equal(getFieldProgressionProfile(field).repairEnabled, true);
  }
});
