export const INPUT_SETTINGS_STORAGE_KEY = "voidforge-input-settings-v1";

export const MIN_GAMEPAD_DEAD_ZONE = 0.05;
export const MAX_GAMEPAD_DEAD_ZONE = 0.4;
export const DEFAULT_GAMEPAD_DEAD_ZONE = 0.14;
export const MAX_BINDINGS_PER_ACTION = 3;

/** @typedef {"hold" | "toggle"} PrimaryFireMode */
/**
 * @typedef {
 *   "moveUp" | "moveDown" | "moveLeft" | "moveRight" |
 *   "primaryFire" | "nova" | "pause" | "mute" | "restart" | "confirm"
 * } KeyboardAction
 */

export const PRIMARY_FIRE_MODES = Object.freeze(["hold", "toggle"]);

export const KEYBOARD_ACTIONS = Object.freeze([
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "primaryFire",
  "nova",
  "pause",
  "mute",
  "restart",
  "confirm",
]);

export const KEYBOARD_ACTION_LABELS = Object.freeze({
  moveUp: "Thrust up",
  moveDown: "Thrust down",
  moveLeft: "Thrust left",
  moveRight: "Thrust right",
  primaryFire: "Primary laser",
  nova: "Nova Charge",
  pause: "Pause",
  mute: "Mute",
  restart: "Restart",
  confirm: "Confirm",
});

const actionSet = new Set(KEYBOARD_ACTIONS);

const letterCodes = Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`);
const digitCodes = Array.from({ length: 10 }, (_, index) => `Digit${index}`);
const numpadDigitCodes = Array.from({ length: 10 }, (_, index) => `Numpad${index}`);
const functionCodes = Array.from({ length: 24 }, (_, index) => `F${index + 1}`);

export const VALID_KEY_CODES = Object.freeze([
  ...letterCodes,
  ...digitCodes,
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Enter",
  "Escape",
  "ShiftLeft",
  "ShiftRight",
  "Backquote",
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash",
  ...numpadDigitCodes,
  "NumpadAdd",
  "NumpadSubtract",
  "NumpadMultiply",
  "NumpadDivide",
  "NumpadDecimal",
  "NumpadEnter",
  "NumpadEqual",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Tab",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "PrintScreen",
  "Pause",
  "ContextMenu",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  ...functionCodes,
]);

export const RESTRICTED_KEY_CODES = Object.freeze([
  "Tab",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "PrintScreen",
  "Pause",
  "ContextMenu",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  ...functionCodes,
]);

const validKeyCodeSet = new Set(VALID_KEY_CODES);
const restrictedKeyCodeSet = new Set(RESTRICTED_KEY_CODES);

const generatedKeyLabels = {
  ...Object.fromEntries(letterCodes.map((code) => [code, code.slice(3)])),
  ...Object.fromEntries(digitCodes.map((code) => [code, code.slice(5)])),
  ...Object.fromEntries(numpadDigitCodes.map((code) => [code, `Num ${code.slice(6)}`])),
  ...Object.fromEntries(functionCodes.map((code) => [code, code])),
};

export const KEY_DISPLAY_LABELS = Object.freeze({
  ...generatedKeyLabels,
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  ShiftLeft: "Left Shift",
  ShiftRight: "Right Shift",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  NumpadAdd: "Num +",
  NumpadSubtract: "Num -",
  NumpadMultiply: "Num ×",
  NumpadDivide: "Num ÷",
  NumpadDecimal: "Num .",
  NumpadEnter: "Num Enter",
  NumpadEqual: "Num =",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "Page Up",
  PageDown: "Page Down",
  Tab: "Tab",
  CapsLock: "Caps Lock",
  NumLock: "Num Lock",
  ScrollLock: "Scroll Lock",
  PrintScreen: "Print Screen",
  Pause: "Pause/Break",
  ContextMenu: "Menu",
  ControlLeft: "Left Ctrl",
  ControlRight: "Right Ctrl",
  AltLeft: "Left Alt",
  AltRight: "Right Alt",
  MetaLeft: "Left Meta",
  MetaRight: "Right Meta",
});

const freezeBindings = (bindings) => Object.freeze(Object.fromEntries(
  KEYBOARD_ACTIONS.map((action) => [action, Object.freeze([...bindings[action]])]),
));

export const DEFAULT_KEY_BINDINGS = freezeBindings({
  moveUp: ["KeyW", "ArrowUp"],
  moveDown: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  primaryFire: ["Space"],
  nova: ["KeyC", "ShiftLeft", "ShiftRight"],
  pause: ["KeyP", "Escape"],
  mute: ["KeyM"],
  restart: ["KeyR"],
  confirm: ["Enter"],
});

export const DEFAULT_INPUT_SETTINGS = Object.freeze({
  keyboardBindings: DEFAULT_KEY_BINDINGS,
  gamepadDeadZone: DEFAULT_GAMEPAD_DEAD_ZONE,
  primaryFireMode: "hold",
});

/** @param {unknown} value */
export function isValidKeyCode(value) {
  return typeof value === "string" && validKeyCodeSet.has(value);
}

/** @param {unknown} value */
export function isRestrictedKeyCode(value) {
  return typeof value === "string" && restrictedKeyCodeSet.has(value);
}

/** @param {unknown} value */
export function isBindableKeyCode(value) {
  return isValidKeyCode(value) && !isRestrictedKeyCode(value);
}

/**
 * Escape remains a shipped Pause binding, but is reserved as the explicit
 * cancellation key while the in-game capture dialog is listening.
 * @param {unknown} value
 */
export function isRebindableKeyCode(value) {
  return isBindableKeyCode(value) && value !== "Escape";
}

/**
 * Return a short, stable label suitable for a keycap. Invalid codes are never
 * echoed back into the interface.
 * @param {unknown} value
 */
export function getKeyDisplayLabel(value) {
  return isValidKeyCode(value) ? KEY_DISPLAY_LABELS[value] : "Unassigned";
}

/** @param {unknown} value */
export function clampGamepadDeadZone(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_GAMEPAD_DEAD_ZONE;
  return Math.max(MIN_GAMEPAD_DEAD_ZONE, Math.min(MAX_GAMEPAD_DEAD_ZONE, value));
}

/**
 * Apply a radial dead zone and rescale the remaining stick travel back to the
 * full zero-to-one range.
 * @param {unknown} x
 * @param {unknown} y
 * @param {unknown} deadZone
 */
export function applyGamepadDeadZone(x, y, deadZone = DEFAULT_GAMEPAD_DEAD_ZONE) {
  const safeX = typeof x === "number" && Number.isFinite(x) ? x : 0;
  const safeY = typeof y === "number" && Number.isFinite(y) ? y : 0;
  const length = Math.hypot(safeX, safeY);
  const rawMagnitude = Math.min(1, length);
  const threshold = clampGamepadDeadZone(deadZone);
  if (length <= 0.0001 || rawMagnitude <= threshold) {
    return Object.freeze({ x: 0, y: 0, magnitude: 0 });
  }

  const magnitude = Math.max(0, Math.min(1, (rawMagnitude - threshold) / (1 - threshold)));
  return Object.freeze({
    x: (safeX / length) * magnitude,
    y: (safeY / length) * magnitude,
    magnitude,
  });
}

/**
 * Select the lowest-index connected pad without assuming slot zero remains
 * occupied for the lifetime of the page.
 * @template T
 * @param {ArrayLike<(T & { connected: boolean }) | null> | null | undefined} gamepads
 * @returns {(T & { connected: boolean }) | null}
 */
export function findFirstConnectedGamepad(gamepads) {
  if (gamepads === null || gamepads === undefined) return null;
  const { length } = gamepads;
  if (typeof length !== "number" || !Number.isFinite(length) || length < 0) return null;
  for (let index = 0; index < Math.trunc(length); index += 1) {
    const gamepad = gamepads[index];
    if (gamepad?.connected === true) return gamepad;
  }
  return null;
}

/** @param {unknown} value */
export function sanitizePrimaryFireMode(value) {
  return value === "toggle" ? "toggle" : "hold";
}

/**
 * Sanitize a persisted binding record. Duplicates are resolved in canonical
 * action order, and every action retains at least one safe binding.
 * @param {unknown} value
 */
export function sanitizeKeyboardBindings(value) {
  const source = value !== null && typeof value === "object" ? value : {};
  const used = new Set();
  const sanitized = {};
  const bindableFallbacks = VALID_KEY_CODES.filter((code) => !restrictedKeyCodeSet.has(code));

  for (const action of KEYBOARD_ACTIONS) {
    const supplied = source[action];
    const rawCandidates = typeof supplied === "string"
      ? [supplied]
      : Array.isArray(supplied)
        ? supplied
        : DEFAULT_KEY_BINDINGS[action];
    const validCandidates = [...new Set(rawCandidates.filter(isBindableKeyCode))]
      .slice(0, MAX_BINDINGS_PER_ACTION);
    const candidates = validCandidates.length > 0
      ? validCandidates
      : DEFAULT_KEY_BINDINGS[action];
    const selected = [];

    for (const code of candidates) {
      if (used.has(code) || selected.includes(code)) continue;
      selected.push(code);
      used.add(code);
    }

    if (selected.length === 0) {
      for (const fallback of DEFAULT_KEY_BINDINGS[action]) {
        if (used.has(fallback)) continue;
        selected.push(fallback);
        used.add(fallback);
      }
      if (selected.length === 0) {
        const fallback = bindableFallbacks.find((code) => !used.has(code));
        if (fallback) {
          selected.push(fallback);
          used.add(fallback);
        }
      }
    }

    sanitized[action] = selected;
  }

  return freezeBindings(sanitized);
}

/**
 * Normalize untrusted persisted input settings into a deeply immutable value.
 * @param {unknown} value
 */
export function sanitizeInputSettings(value) {
  const source = value !== null && typeof value === "object" ? value : {};
  return Object.freeze({
    keyboardBindings: sanitizeKeyboardBindings(source.keyboardBindings),
    gamepadDeadZone: clampGamepadDeadZone(source.gamepadDeadZone),
    primaryFireMode: sanitizePrimaryFireMode(source.primaryFireMode),
  });
}

/**
 * Replace one binding. If the new key is already assigned, the two slots are
 * swapped so a successful rebind never leaves an ambiguous duplicate.
 * @param {unknown} value
 * @param {KeyboardAction} action
 * @param {number} slotIndex
 * @param {unknown} keyCode
 */
export function rebindKeyboardKey(value, action, slotIndex, keyCode) {
  const settings = sanitizeInputSettings(value);
  if (!actionSet.has(action)) throw new TypeError(`Unknown keyboard action: ${String(action)}`);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= settings.keyboardBindings[action].length) {
    throw new RangeError(`Invalid binding slot for ${action}: ${String(slotIndex)}`);
  }
  if (!isValidKeyCode(keyCode)) throw new TypeError(`Invalid key code: ${String(keyCode)}`);
  if (!isRebindableKeyCode(keyCode)) throw new TypeError(`Restricted key code: ${keyCode}`);

  const bindings = Object.fromEntries(
    KEYBOARD_ACTIONS.map((name) => [name, [...settings.keyboardBindings[name]]]),
  );
  const previousCode = bindings[action][slotIndex];
  if (previousCode === keyCode) return settings;

  let conflictingAction = null;
  let conflictingSlot = -1;
  for (const candidateAction of KEYBOARD_ACTIONS) {
    const index = bindings[candidateAction].indexOf(keyCode);
    if (index >= 0) {
      conflictingAction = candidateAction;
      conflictingSlot = index;
      break;
    }
  }

  bindings[action][slotIndex] = keyCode;
  if (conflictingAction !== null) {
    bindings[conflictingAction][conflictingSlot] = previousCode;
  }

  return Object.freeze({
    ...settings,
    keyboardBindings: freezeBindings(bindings),
  });
}

const EMPTY_INPUT_STATE = Object.freeze({
  firePressed: false,
  novaPressed: false,
  fireLatched: false,
  fireActive: false,
  fireTriggered: false,
  novaTriggered: false,
  controlsLocked: false,
  primaryFireMode: "hold",
});

/** @param {unknown} primaryFireMode */
export function createInputState(primaryFireMode = "hold") {
  const mode = sanitizePrimaryFireMode(primaryFireMode);
  return mode === "hold"
    ? EMPTY_INPUT_STATE
    : Object.freeze({ ...EMPTY_INPUT_STATE, primaryFireMode: mode });
}

/**
 * Reduce a merged keyboard/gamepad/touch input sample. Event fields are
 * one-frame pulses; toggle latches and edge history live in the returned state.
 * Locking clears the fire latch and consumes held edges so a held Nova button
 * cannot launch immediately when control returns.
 * @param {unknown} state
 * @param {unknown} sample
 */
export function reduceInputState(state, sample = {}) {
  const previous = state !== null && typeof state === "object" ? state : EMPTY_INPUT_STATE;
  const input = sample !== null && typeof sample === "object" ? sample : {};
  const primaryFireMode = sanitizePrimaryFireMode(
    input.primaryFireMode ?? previous.primaryFireMode,
  );
  if (input.reset === true) return createInputState(primaryFireMode);

  const firePressed = input.firePressed === true;
  const novaPressed = input.novaPressed === true;
  const controlsLocked = input.controlsLocked === true;
  if (controlsLocked) {
    return Object.freeze({
      firePressed,
      novaPressed,
      fireLatched: false,
      fireActive: false,
      fireTriggered: false,
      novaTriggered: false,
      controlsLocked: true,
      primaryFireMode,
    });
  }

  const fireTriggered = firePressed && previous.firePressed !== true;
  const novaTriggered = novaPressed && previous.novaPressed !== true;
  const fireLatched = primaryFireMode === "toggle"
    ? fireTriggered ? previous.fireLatched !== true : previous.fireLatched === true
    : false;

  return Object.freeze({
    firePressed,
    novaPressed,
    fireLatched,
    fireActive: primaryFireMode === "toggle" ? fireLatched : firePressed,
    fireTriggered,
    novaTriggered,
    controlsLocked: false,
    primaryFireMode,
  });
}
