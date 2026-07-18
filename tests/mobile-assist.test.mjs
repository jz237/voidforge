import assert from "node:assert/strict";
import test from "node:test";

import { quantizeThrustMagnitude } from "../app/game/core.mjs";
import {
  MOBILE_FLIGHT_PROFILE,
  STANDARD_FLIGHT_PROFILE,
  applyTouchThrustCurve,
  resolveFlightProfile,
  resolveMobileAssistCapability,
  resolvePlayerImpact,
} from "../app/game/mobile-assist.mjs";

test("mobile assist capability covers forced QA, coarse pointers, and compact touch screens", () => {
  assert.equal(resolveMobileAssistCapability({ forced: true }), true);
  assert.equal(resolveMobileAssistCapability({ coarsePointer: true }), true);
  assert.equal(resolveMobileAssistCapability({ maxTouchPoints: 5, viewportWidth: 844, viewportHeight: 390 }), true);
  assert.equal(resolveMobileAssistCapability({ maxTouchPoints: 5, viewportWidth: 1920, viewportHeight: 1080 }), false);
  assert.equal(resolveMobileAssistCapability({ viewportWidth: 390, viewportHeight: 844 }), false);
});

test("mobile flight tuning is bounded while desktop retains its legacy balance", () => {
  const desktop = resolveFlightProfile(false);
  const mobile = resolveFlightProfile(true);
  assert.strictEqual(desktop, STANDARD_FLIGHT_PROFILE);
  assert.strictEqual(mobile, MOBILE_FLIGHT_PROFILE);
  assert.deepEqual(
    { acceleration: desktop.acceleration, drag: desktop.drag, turnResponse: desktop.turnResponse, maxSpeed: desktop.maxSpeed },
    { acceleration: 780, drag: 1.08, turnResponse: 9, maxSpeed: 535 },
  );
  assert.equal(desktop.sentinelBoltSpeed, 385);
  assert.equal(desktop.sentinelEngageRange, 1450);
  assert.equal(desktop.integritySegments, 1);
  assert.ok(Object.isFrozen(desktop));
  assert.ok(Object.isFrozen(mobile));
});

test("touch thrust reaches useful arcade bands earlier without changing its endpoints", () => {
  assert.equal(applyTouchThrustCurve(-1), 0);
  assert.equal(applyTouchThrustCurve(0), 0);
  assert.equal(applyTouchThrustCurve(1), 1);
  assert.equal(applyTouchThrustCurve(Number.NaN), 0);
  assert.equal(quantizeThrustMagnitude(applyTouchThrustCurve(0.2), 6), 2 / 6);
  assert.equal(quantizeThrustMagnitude(applyTouchThrustCurve(0.5), 6), 4 / 6);
  assert.equal(quantizeThrustMagnitude(0.5, 6), 0.5);
});

test("mobile hostile fire is slower, closer, and more readable without becoming inert", () => {
  const mobile = resolveFlightProfile(true);
  assert.equal(mobile.sentinelBoltSpeed, 300);
  assert.equal(mobile.sentinelEngageRange, 1100);
  assert.ok(mobile.sentinelBoltSpeed <= STANDARD_FLIGHT_PROFILE.sentinelBoltSpeed * 0.8);
  assert.ok(mobile.sentinelBoltSpeed * 4 >= mobile.sentinelEngageRange);
  assert.ok(mobile.boltVisualScale >= 1.25);
});

test("three mobile integrity segments absorb two impacts before hull loss", () => {
  const first = resolvePlayerImpact(3, 3);
  const second = resolvePlayerImpact(first.remainingIntegrity, 3);
  const third = resolvePlayerImpact(second.remainingIntegrity, 3);
  assert.deepEqual(first, { hullLost: false, remainingIntegrity: 2, maximumIntegrity: 3 });
  assert.deepEqual(second, { hullLost: false, remainingIntegrity: 1, maximumIntegrity: 3 });
  assert.deepEqual(third, { hullLost: true, remainingIntegrity: 0, maximumIntegrity: 3 });
  assert.equal(resolvePlayerImpact(1, 1).hullLost, true);
  assert.deepEqual(
    resolvePlayerImpact(Number.NaN, Number.NaN),
    { hullLost: true, remainingIntegrity: 0, maximumIntegrity: 1 },
  );
});
