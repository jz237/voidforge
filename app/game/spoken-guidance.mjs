export const SPOKEN_GUIDANCE_STORAGE_KEY = "voidforge-guide-voice";

export const TUTORIAL_GUIDANCE = Object.freeze({
  move: "Vesper flight core online. Apply thrust toward a large cracked planetoid.",
  mine: "Cut the glowing cracks in short bursts. That preserves more Flux.",
  collect: "Flux exposed. Follow the bracket and fly through the shard.",
  threat: "Flux becomes Nova charges. Stop orange Fabricators before assembly reaches twenty, then rupture the awakened Engine with thirteen Novas.",
});

export const MISSION_GUIDANCE = Object.freeze({
  start: "Flight guide online. Mine Flux, deny construction, and destroy the Dread Engine.",
  "training-complete": "Guidance complete. The Expanse is yours.",
  "assembly-critical": "Warning. Assembly is accelerating. Intercept the orange Fabricators.",
  "engine-awake": "Dread Engine active. Launch thirteen Nova charges.",
});

export const ENGINE_DIALOGUE = Object.freeze({
  awake: "Signal acquired. Vesper identified.",
  destroyed: "Containment lost. The forge is broken.",
});

/**
 * Resolve a cue exactly once for the current run. Suppressed cues are consumed
 * so enabling voice later never releases a backlog of stale instructions.
 * @param {{ key: string, muted?: boolean, enabled?: boolean, supported?: boolean, hidden?: boolean, spoken: Set<string> }} options
 * @returns {string | null}
 */
export function resolveGuidance({
  key,
  muted = false,
  enabled = true,
  supported = true,
  hidden = false,
  spoken,
}) {
  const separator = key.indexOf(":");
  const scope = separator >= 0 ? key.slice(0, separator) : "";
  const id = separator >= 0 ? key.slice(separator + 1) : "";
  const line = scope === "tutorial"
    ? TUTORIAL_GUIDANCE[id]
    : scope === "mission"
      ? MISSION_GUIDANCE[id]
      : undefined;

  if (!line || spoken.has(key)) return null;
  spoken.add(key);
  if (muted || !enabled || !supported || hidden) return null;
  return line;
}
