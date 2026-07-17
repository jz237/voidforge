export const TUTORIAL_STORAGE_KEY = "voidforge-tutorial-v1-complete";

/** @typedef {"move" | "mine" | "collect" | "threat"} TutorialStep */
/** @typedef {{ step: TutorialStep | "complete", complete: boolean, pinned: boolean, facts: Record<string, boolean> }} TutorialState */
/** @typedef {{ enabled: boolean, step: TutorialStep, pinned: boolean, persist: boolean }} TutorialMode */

export const TUTORIAL_STEPS = Object.freeze(["move", "mine", "collect", "threat"]);

/**
 * The south gamepad button doubles as primary fire, so tutorial completion is
 * accepted only on its rising edge while the final coachmark is actually
 * visible. The runtime consumes that edge before routing fire.
 * @param {{ step?: string | null, coachmarkVisible?: boolean, confirmPressed?: boolean, previousConfirmPressed?: boolean }} [options]
 */
export function tutorialGamepadAcknowledgeRequested({
  step = null,
  coachmarkVisible = false,
  confirmPressed = false,
  previousConfirmPressed = false,
} = {}) {
  return step === "threat"
    && coachmarkVisible === true
    && confirmPressed === true
    && previousConfirmPressed !== true;
}

const EVENT_FACT = Object.freeze({
  "player-thrusted": "moved",
  "shard-extracted": "mined",
  "shard-collected": "collected",
});

const STEP_FACT = Object.freeze({
  move: "moved",
  mine: "mined",
  collect: "collected",
});

/**
 * @param {string} [step]
 * @param {boolean} [pinned]
 * @returns {TutorialState}
 */
export function createTutorialState(step = "move", pinned = false) {
  const safeStep = TUTORIAL_STEPS.includes(step) ? step : "move";
  return {
    step: /** @type {TutorialStep} */ (safeStep),
    complete: false,
    pinned: Boolean(pinned),
    facts: {},
  };
}

/**
 * @param {TutorialState} state
 * @param {string} event
 * @returns {TutorialState}
 */
export function advanceTutorial(state, event) {
  if (!state || state.complete) return state;
  if (event === "skip") {
    return { ...state, step: "complete", complete: true };
  }

  const fact = EVENT_FACT[event];
  const facts = fact && !state.facts[fact] ? { ...state.facts, [fact]: true } : state.facts;
  if (state.step === "threat" && event === "acknowledge") {
    return { ...state, step: "complete", complete: true, facts };
  }
  if (state.pinned) return facts === state.facts ? state : { ...state, facts };

  let index = TUTORIAL_STEPS.indexOf(state.step);
  while (index >= 0 && index < TUTORIAL_STEPS.length - 1) {
    const requiredFact = STEP_FACT[TUTORIAL_STEPS[index]];
    if (!requiredFact || !facts[requiredFact]) break;
    index += 1;
  }

  const step = TUTORIAL_STEPS[Math.max(0, index)];
  return step === state.step && facts === state.facts ? state : { ...state, step, facts };
}

/**
 * @param {{ query?: string | null, completed?: boolean, showcase?: boolean, profile?: boolean }} [options]
 * @returns {TutorialMode}
 */
export function resolveTutorialMode({
  query = null,
  completed = false,
  showcase = false,
  profile = false,
} = {}) {
  if (query === "0") {
    return { enabled: false, step: "move", pinned: false, persist: false };
  }
  if (query === "1") {
    return { enabled: true, step: "move", pinned: false, persist: false };
  }
  if (query !== null && TUTORIAL_STEPS.includes(query)) {
    return { enabled: true, step: /** @type {TutorialStep} */ (query), pinned: true, persist: false };
  }

  const enabled = !completed && !showcase && !profile;
  return { enabled, step: "move", pinned: false, persist: enabled };
}
