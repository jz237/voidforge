import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GAMEPAD_DEAD_ZONE,
  DEFAULT_INPUT_SETTINGS,
  DEFAULT_KEY_BINDINGS,
  INPUT_SETTINGS_STORAGE_KEY,
  KEYBOARD_ACTIONS,
  MAX_GAMEPAD_DEAD_ZONE,
  MIN_GAMEPAD_DEAD_ZONE,
  applyGamepadDeadZone,
  clampGamepadDeadZone,
  createInputState,
  findFirstConnectedGamepad,
  getKeyDisplayLabel,
  isBindableKeyCode,
  isRebindableKeyCode,
  isRestrictedKeyCode,
  isValidKeyCode,
  rebindKeyboardKey,
  reduceInputState,
  sanitizeInputSettings,
  sanitizeKeyboardBindings,
} from "../app/game/input-settings.mjs";

const approximately = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test("input defaults preserve the shipped controls and are deeply immutable", () => {
  assert.equal(INPUT_SETTINGS_STORAGE_KEY, "voidforge-input-settings-v1");
  assert.deepEqual(DEFAULT_KEY_BINDINGS.moveUp, ["KeyW", "ArrowUp"]);
  assert.deepEqual(DEFAULT_KEY_BINDINGS.primaryFire, ["Space"]);
  assert.deepEqual(DEFAULT_KEY_BINDINGS.nova, ["KeyC", "ShiftLeft", "ShiftRight"]);
  assert.deepEqual(DEFAULT_KEY_BINDINGS.pause, ["KeyP", "Escape"]);
  assert.equal(DEFAULT_INPUT_SETTINGS.gamepadDeadZone, DEFAULT_GAMEPAD_DEAD_ZONE);
  assert.equal(DEFAULT_INPUT_SETTINGS.primaryFireMode, "hold");
  assert.equal(Object.isFrozen(KEYBOARD_ACTIONS), true);
  assert.equal(Object.isFrozen(DEFAULT_INPUT_SETTINGS), true);
  assert.equal(Object.isFrozen(DEFAULT_KEY_BINDINGS), true);
  assert.equal(Object.isFrozen(DEFAULT_KEY_BINDINGS.nova), true);
  assert.throws(() => DEFAULT_KEY_BINDINGS.nova.push("KeyN"), TypeError);
});

test("key validation distinguishes bindable controls from browser-reserved keys", () => {
  assert.equal(isValidKeyCode("KeyQ"), true);
  assert.equal(isValidKeyCode("ArrowUp"), true);
  assert.equal(isValidKeyCode("KeyQQ"), false);
  assert.equal(isValidKeyCode(42), false);
  assert.equal(isRestrictedKeyCode("Tab"), true);
  assert.equal(isRestrictedKeyCode("F11"), true);
  assert.equal(isBindableKeyCode("Tab"), false);
  assert.equal(isBindableKeyCode("Escape"), true);
  assert.equal(isRebindableKeyCode("Escape"), false);
  assert.equal(isRebindableKeyCode("KeyQ"), true);
  assert.equal(isBindableKeyCode("Numpad7"), true);
});

test("display labels are concise and never echo invalid input", () => {
  assert.equal(getKeyDisplayLabel("KeyW"), "W");
  assert.equal(getKeyDisplayLabel("ArrowUp"), "↑");
  assert.equal(getKeyDisplayLabel("ShiftLeft"), "Left Shift");
  assert.equal(getKeyDisplayLabel("NumpadAdd"), "Num +");
  assert.equal(getKeyDisplayLabel("made-up-key"), "Unassigned");
});

test("persisted settings sanitize malformed values, conflicts, and unsafe keys", () => {
  const settings = sanitizeInputSettings({
    keyboardBindings: {
      moveUp: ["KeyZ", "KeyZ", "Tab", "KeyY", "KeyX"],
      moveDown: ["KeyZ"],
      primaryFire: ["not-a-code"],
    },
    gamepadDeadZone: 99,
    primaryFireMode: "rapid",
  });

  assert.deepEqual(settings.keyboardBindings.moveUp, ["KeyZ", "KeyY", "KeyX"]);
  assert.deepEqual(settings.keyboardBindings.moveDown, ["KeyS", "ArrowDown"]);
  assert.deepEqual(settings.keyboardBindings.primaryFire, ["Space"]);
  assert.equal(settings.gamepadDeadZone, MAX_GAMEPAD_DEAD_ZONE);
  assert.equal(settings.primaryFireMode, "hold");
  assert.equal(Object.isFrozen(settings), true);
  assert.equal(Object.isFrozen(settings.keyboardBindings), true);
  assert.equal(Object.isFrozen(settings.keyboardBindings.moveUp), true);

  assert.deepEqual(sanitizeInputSettings(null), DEFAULT_INPUT_SETTINGS);
  assert.deepEqual(sanitizeKeyboardBindings({ pause: ["F5"] }).pause, DEFAULT_KEY_BINDINGS.pause);
});

test("rebinds swap conflicting slots without mutating their source", () => {
  const source = sanitizeInputSettings({ primaryFireMode: "toggle", gamepadDeadZone: 0.2 });
  const rebound = rebindKeyboardKey(source, "primaryFire", 0, "KeyW");

  assert.deepEqual(source.keyboardBindings.primaryFire, ["Space"]);
  assert.deepEqual(source.keyboardBindings.moveUp, ["KeyW", "ArrowUp"]);
  assert.deepEqual(rebound.keyboardBindings.primaryFire, ["KeyW"]);
  assert.deepEqual(rebound.keyboardBindings.moveUp, ["Space", "ArrowUp"]);
  assert.equal(rebound.primaryFireMode, "toggle");
  assert.equal(rebound.gamepadDeadZone, 0.2);
  assert.equal(Object.isFrozen(rebound.keyboardBindings.primaryFire), true);

  const reordered = rebindKeyboardKey(source, "moveUp", 0, "ArrowUp");
  assert.deepEqual(reordered.keyboardBindings.moveUp, ["ArrowUp", "KeyW"]);
  assert.throws(() => rebindKeyboardKey(source, "primaryFire", 0, "Tab"), /Restricted key/);
  assert.throws(() => rebindKeyboardKey(source, "primaryFire", 0, "Escape"), /Restricted key/);
  assert.throws(() => rebindKeyboardKey(source, "unknown", 0, "KeyQ"), /Unknown keyboard action/);
  assert.throws(() => rebindKeyboardKey(source, "nova", 9, "KeyQ"), /Invalid binding slot/);
});

test("gamepad dead zones clamp and radially rescale remaining travel", () => {
  assert.equal(clampGamepadDeadZone(-1), MIN_GAMEPAD_DEAD_ZONE);
  assert.equal(clampGamepadDeadZone(1), MAX_GAMEPAD_DEAD_ZONE);
  assert.equal(clampGamepadDeadZone("0.2"), DEFAULT_GAMEPAD_DEAD_ZONE);
  assert.deepEqual(applyGamepadDeadZone(0.1, 0, 0.2), { x: 0, y: 0, magnitude: 0 });

  const halfwayInput = (1 + 0.2) / 2;
  const halfway = applyGamepadDeadZone(halfwayInput, 0, 0.2);
  approximately(halfway.x, 0.5);
  approximately(halfway.y, 0);
  approximately(halfway.magnitude, 0.5);

  const diagonal = applyGamepadDeadZone(1, 1, 0.2);
  approximately(diagonal.magnitude, 1);
  approximately(diagonal.x, Math.SQRT1_2);
  approximately(diagonal.y, Math.SQRT1_2);
  assert.equal(Object.isFrozen(diagonal), true);
});

test("the first connected gamepad may occupy any browser slot", () => {
  const laterPad = { id: "later", connected: true };
  const finalPad = { id: "final", connected: true };
  assert.equal(findFirstConnectedGamepad([null, { id: "old", connected: false }, laterPad, finalPad]), laterPad);
  assert.equal(findFirstConnectedGamepad([null, { connected: false }]), null);
  assert.equal(findFirstConnectedGamepad(null), null);
});

test("hold fire mirrors the merged press while exposing rising edges", () => {
  let state = createInputState("hold");
  state = reduceInputState(state, { firePressed: true });
  assert.equal(state.fireActive, true);
  assert.equal(state.fireTriggered, true);
  assert.equal(state.fireLatched, false);

  state = reduceInputState(state, { firePressed: true });
  assert.equal(state.fireActive, true);
  assert.equal(state.fireTriggered, false);

  state = reduceInputState(state, { firePressed: false });
  assert.equal(state.fireActive, false);
  assert.equal(state.fireTriggered, false);
});

test("toggle fire changes only on rising edges", () => {
  let state = createInputState("toggle");
  state = reduceInputState(state, { firePressed: true });
  assert.equal(state.fireActive, true);
  assert.equal(state.fireLatched, true);

  state = reduceInputState(state, { firePressed: true });
  assert.equal(state.fireActive, true);
  assert.equal(state.fireTriggered, false);
  state = reduceInputState(state, { firePressed: false });
  assert.equal(state.fireActive, true);

  state = reduceInputState(state, { firePressed: true });
  assert.equal(state.fireActive, false);
  assert.equal(state.fireLatched, false);
});

test("Nova emits once per rising edge and controls lock clears every latch", () => {
  let state = createInputState("toggle");
  state = reduceInputState(state, { firePressed: true, novaPressed: true });
  assert.equal(state.fireLatched, true);
  assert.equal(state.novaTriggered, true);

  state = reduceInputState(state, { firePressed: true, novaPressed: true });
  assert.equal(state.novaTriggered, false);

  state = reduceInputState(state, {
    firePressed: true,
    novaPressed: true,
    controlsLocked: true,
  });
  assert.equal(state.fireActive, false);
  assert.equal(state.fireLatched, false);
  assert.equal(state.novaTriggered, false);
  assert.equal(state.controlsLocked, true);

  state = reduceInputState(state, { firePressed: true, novaPressed: true });
  assert.equal(state.fireLatched, false);
  assert.equal(state.novaTriggered, false);
  state = reduceInputState(state, { firePressed: false, novaPressed: false });
  state = reduceInputState(state, { firePressed: true, novaPressed: true });
  assert.equal(state.fireLatched, true);
  assert.equal(state.novaTriggered, true);

  state = reduceInputState(state, { reset: true, primaryFireMode: "toggle" });
  assert.deepEqual(state, createInputState("toggle"));
  assert.equal(Object.isFrozen(state), true);
});
