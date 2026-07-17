import assert from "node:assert/strict";
import test from "node:test";

import {
  TUTORIAL_STORAGE_KEY,
  advanceTutorial,
  createTutorialState,
  resolveTutorialMode,
} from "../app/game/tutorial.mjs";

test("the first-run tutorial advances through real gameplay milestones", () => {
  let state = createTutorialState();
  assert.equal(state.step, "move");

  state = advanceTutorial(state, "player-thrusted");
  assert.equal(state.step, "mine");
  state = advanceTutorial(state, "shard-extracted");
  assert.equal(state.step, "collect");
  state = advanceTutorial(state, "shard-collected");
  assert.equal(state.step, "threat");
  state = advanceTutorial(state, "acknowledge");
  assert.equal(state.complete, true);
});

test("tutorial facts are retained when players act ahead of the prompt", () => {
  let state = createTutorialState();
  state = advanceTutorial(state, "shard-extracted");
  assert.equal(state.step, "move");
  state = advanceTutorial(state, "player-thrusted");
  assert.equal(state.step, "collect");
});

test("pinned visual-QA steps stay fixed and every step remains skippable", () => {
  const pinned = createTutorialState("mine", true);
  assert.equal(advanceTutorial(pinned, "shard-extracted").step, "mine");
  assert.equal(advanceTutorial(pinned, "skip").complete, true);

  const pinnedMission = createTutorialState("threat", true);
  assert.equal(advanceTutorial(pinnedMission, "acknowledge").complete, true);
});

test("tutorial overrides take precedence without mutating first-run persistence", () => {
  assert.equal(TUTORIAL_STORAGE_KEY, "voidforge-tutorial-v1-complete");
  assert.deepEqual(resolveTutorialMode({ query: "1", completed: true }), {
    enabled: true, step: "move", pinned: false, persist: false,
  });
  assert.deepEqual(resolveTutorialMode({ query: "mine", completed: true }), {
    enabled: true, step: "mine", pinned: true, persist: false,
  });
  assert.equal(resolveTutorialMode({ query: "0", completed: false }).enabled, false);
  assert.equal(resolveTutorialMode({ completed: false }).persist, true);
  assert.equal(resolveTutorialMode({ completed: true }).enabled, false);
  assert.equal(resolveTutorialMode({ completed: false, showcase: true }).enabled, false);
  assert.equal(resolveTutorialMode({ completed: false, profile: true }).enabled, false);
  assert.equal(resolveTutorialMode({ query: "invalid", completed: false }).enabled, true);
});
