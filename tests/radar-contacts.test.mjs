import assert from "node:assert/strict";
import test from "node:test";

import {
  RADAR_CONTACT_KINDS,
  projectRadarContact,
  selectRadarCandidates,
} from "../app/game/radar-contacts.mjs";

const approximately = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

const candidate = (id, kind, range, inRange = true, extra = {}) => ({
  id,
  kind,
  range,
  inRange,
  ...extra,
});

test("radar contact kinds are complete and immutable", () => {
  assert.equal(Object.isFrozen(RADAR_CONTACT_KINDS), true);
  assert.deepEqual(Object.values(RADAR_CONTACT_KINDS), [
    "boss",
    "hostileProjectile",
    "sentinel",
    "loadedFabricator",
    "fabricator",
    "crystal",
    "planetoid",
  ]);
});

test("selection ranks explicit kind priority before distance", () => {
  const selected = selectRadarCandidates([
    candidate(7, RADAR_CONTACT_KINDS.FABRICATOR, 0.01),
    candidate(6, RADAR_CONTACT_KINDS.LOADED_FABRICATOR, 0.08),
    candidate(5, RADAR_CONTACT_KINDS.SENTINEL, 0.9),
    candidate(4, RADAR_CONTACT_KINDS.HOSTILE_PROJECTILE, 0.95),
    candidate(3, RADAR_CONTACT_KINDS.BOSS, 1, false),
  ], 4);

  assert.deepEqual(selected.map(({ id, kind }) => ({ id, kind })), [
    { id: 3, kind: RADAR_CONTACT_KINDS.BOSS },
    { id: 4, kind: RADAR_CONTACT_KINDS.HOSTILE_PROJECTILE },
    { id: 5, kind: RADAR_CONTACT_KINDS.SENTINEL },
    { id: 6, kind: RADAR_CONTACT_KINDS.LOADED_FABRICATOR },
  ]);
  assert.equal(Object.isFrozen(selected), true);
  assert.ok(selected.every(Object.isFrozen));
});

test("selection reserves the nearest crystal and planetoid under combat pressure", () => {
  const candidates = [
    candidate(1, RADAR_CONTACT_KINDS.BOSS, 1, false),
    candidate(2, RADAR_CONTACT_KINDS.HOSTILE_PROJECTILE, 0.2),
    candidate(3, RADAR_CONTACT_KINDS.SENTINEL, 0.1),
    candidate(4, RADAR_CONTACT_KINDS.LOADED_FABRICATOR, 0.05),
    candidate(30, RADAR_CONTACT_KINDS.CRYSTAL, 0.7),
    candidate(31, RADAR_CONTACT_KINDS.CRYSTAL, 0.2),
    candidate(40, RADAR_CONTACT_KINDS.PLANETOID, 0.5),
    candidate(41, RADAR_CONTACT_KINDS.PLANETOID, 0.1),
  ];

  const selected = selectRadarCandidates(candidates, 5);
  assert.deepEqual(selected.map(({ id }) => id), [1, 2, 3, 31, 41]);
  assert.equal(selected.length, 5);

  const resourcesOnly = selectRadarCandidates(candidates.filter(({ kind }) => (
    kind !== RADAR_CONTACT_KINDS.BOSS
  )), 2);
  assert.deepEqual(resourcesOnly.map(({ id }) => id), [31, 41]);

  const bossLimited = selectRadarCandidates(candidates, 2);
  assert.deepEqual(bossLimited.map(({ id }) => id), [1, 31]);
  assert.equal(bossLimited.length, 2);
});

test("selection retains one deterministic boss even beyond radar range", () => {
  const selected = selectRadarCandidates([
    candidate(10, RADAR_CONTACT_KINDS.BOSS, 1, false),
    candidate(4, RADAR_CONTACT_KINDS.BOSS, 1, false),
    candidate(2, RADAR_CONTACT_KINDS.SENTINEL, 0.3),
    candidate(3, RADAR_CONTACT_KINDS.HOSTILE_PROJECTILE, 1, false),
  ], 3);

  assert.deepEqual(selected.map(({ id }) => id), [4, 2]);
  assert.equal(selected.filter(({ kind }) => kind === RADAR_CONTACT_KINDS.BOSS).length, 1);
  assert.equal(selected.some(({ id }) => id === 3), false);
  assert.deepEqual(selectRadarCandidates([
    candidate(10, RADAR_CONTACT_KINDS.BOSS, 1, false),
    candidate(4, RADAR_CONTACT_KINDS.BOSS, 1, false),
  ], 1).map(({ id }) => id), [4]);
});

test("selection uses normalized distance then id for deterministic ties", () => {
  const contacts = [
    candidate(9, RADAR_CONTACT_KINDS.SENTINEL, 0.4),
    candidate(3, RADAR_CONTACT_KINDS.SENTINEL, 0.4),
    candidate(5, RADAR_CONTACT_KINDS.SENTINEL, 0.2),
  ];

  const forward = selectRadarCandidates(contacts);
  const reversed = selectRadarCandidates([...contacts].reverse());
  assert.deepEqual(forward.map(({ id }) => id), [5, 3, 9]);
  assert.deepEqual(reversed, forward);
});

test("projection rotates into player-relative radar coordinates", () => {
  const ahead = projectRadarContact({
    playerX: 100,
    playerY: 200,
    playerAngle: 0,
    targetX: 1300,
    targetY: 200,
  });
  approximately(ahead.x, 74);
  approximately(ahead.y, 50);
  approximately(ahead.range, 0.5);
  assert.equal(ahead.inRange, true);
  assert.equal(Object.isFrozen(ahead), true);

  const rotatedAhead = projectRadarContact({
    playerX: 100,
    playerY: 200,
    playerAngle: Math.PI / 2,
    targetX: 100,
    targetY: 1400,
  });
  approximately(rotatedAhead.x, 74);
  approximately(rotatedAhead.y, 50);
  approximately(rotatedAhead.range, 0.5);
});

test("projection clamps coordinates and normalized range while retaining inRange", () => {
  const farRight = projectRadarContact({ targetX: 4800, targetY: 0, range: 2400 });
  assert.deepEqual(farRight, { x: 97, y: 50, range: 1, inRange: false });

  const farLeft = projectRadarContact({ targetX: -4800, targetY: 0, range: 2400 });
  assert.deepEqual(farLeft, { x: 3, y: 50, range: 1, inRange: false });

  const boundary = projectRadarContact({ targetX: 0, targetY: 2400, range: 2400 });
  assert.deepEqual(boundary, { x: 50, y: 97, range: 1, inRange: true });
});

test("malformed candidates and projection inputs sanitize safely", () => {
  const empty = selectRadarCandidates(null);
  assert.deepEqual(empty, []);
  assert.equal(Object.isFrozen(empty), true);
  assert.deepEqual(selectRadarCandidates([], -4), []);

  const selected = selectRadarCandidates([
    null,
    [],
    { id: 1, kind: "unknown", range: 0.1 },
    { id: Number.NaN, kind: RADAR_CONTACT_KINDS.SENTINEL, range: 0.1 },
    { id: -1, kind: RADAR_CONTACT_KINDS.SENTINEL, range: 0.1 },
    { id: 7, kind: RADAR_CONTACT_KINDS.BOSS, range: Number.NaN },
    { id: 9.8, kind: RADAR_CONTACT_KINDS.FABRICATOR, range: 0.25, marker: "kept" },
    { id: 11, kind: RADAR_CONTACT_KINDS.SENTINEL, range: 4 },
  ]);

  assert.deepEqual(selected.map(({ id }) => id), [7, 9]);
  assert.deepEqual(
    { range: selected[0].range, inRange: selected[0].inRange },
    { range: 1, inRange: false },
  );
  assert.equal(selected[1].marker, "kept");

  const malformedProjection = projectRadarContact(null);
  assert.deepEqual(malformedProjection, { x: 50, y: 50, range: 0, inRange: true });
  assert.deepEqual(
    projectRadarContact({
      playerX: Number.POSITIVE_INFINITY,
      playerY: Number.NaN,
      playerAngle: Number.NaN,
      targetX: undefined,
      targetY: undefined,
      range: 0,
    }),
    malformedProjection,
  );
});
