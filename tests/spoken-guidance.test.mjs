import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSION_GUIDANCE,
  SPOKEN_GUIDANCE_STORAGE_KEY,
  TUTORIAL_GUIDANCE,
  resolveGuidance,
} from "../app/game/spoken-guidance.mjs";

test("spoken guidance covers every first-flight step and core mission warning", () => {
  assert.equal(SPOKEN_GUIDANCE_STORAGE_KEY, "voidforge-guide-voice");
  assert.deepEqual(Object.keys(TUTORIAL_GUIDANCE), ["move", "mine", "collect", "threat"]);
  assert.match(TUTORIAL_GUIDANCE.collect, /Flux exposed/i);
  assert.match(MISSION_GUIDANCE["assembly-critical"], /Fabricators/i);
  assert.match(MISSION_GUIDANCE["engine-awake"], /thirteen Nova/i);
});

test("each cue resolves once per run", () => {
  const spoken = new Set();
  const first = resolveGuidance({ key: "tutorial:move", spoken });
  const duplicate = resolveGuidance({ key: "tutorial:move", spoken });
  const next = resolveGuidance({ key: "tutorial:mine", spoken });

  assert.match(first ?? "", /Vesper flight core/i);
  assert.equal(duplicate, null);
  assert.match(next ?? "", /short bursts/i);
});

test("disabled, muted, hidden, and unsupported cues never create a backlog", () => {
  for (const options of [
    { muted: true },
    { enabled: false },
    { hidden: true },
    { supported: false },
  ]) {
    const spoken = new Set();
    assert.equal(resolveGuidance({ key: "tutorial:move", spoken, ...options }), null);
    assert.equal(resolveGuidance({ key: "tutorial:move", spoken }), null);
  }
});
