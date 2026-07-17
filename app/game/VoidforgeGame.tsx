"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Application, Container, Graphics, Sprite } from "pixi.js";
import { VoidforgeAudio } from "./audio";
import {
  RULES,
  clamp,
  circlesOverlap,
  distance,
  homingVelocity,
  lerp,
  minePlanetoid,
  normalizeControlVector,
  quantizeThrustMagnitude,
  seededRandom,
} from "./core.mjs";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  advanceTutorial,
  createTutorialState,
  resolveTutorialMode,
} from "./tutorial.mjs";

type ScreenMode = "title" | "playing" | "paused" | "gameover";
type ContactKind = "worker" | "warrior" | "boss";
type ColorMode = "standard" | "deuteranopia" | "protanopia" | "tritanopia";
type TutorialStep = "move" | "mine" | "collect" | "threat";
type TutorialEvent = "player-thrusted" | "shard-extracted" | "shard-collected" | "acknowledge" | "skip";

interface RadarContact {
  id: number;
  kind: ContactKind;
  x: number;
  y: number;
  heading: number;
  trailLength: number;
  range: number;
}

interface HudState {
  score: number;
  lives: number;
  charges: number;
  zone: number;
  pieces: number;
  engineHealth: number;
  engineActive: boolean;
  contacts: RadarContact[];
  threatLevel: number;
  tacticalStatus: string;
}

interface GameApi {
  start: () => void;
  startTutorial: () => void;
  restart: () => void;
  tutorialEvent: (event: TutorialEvent) => void;
  togglePause: () => void;
  unlockAudio: () => void;
  setMuted: (muted: boolean) => void;
  setReducedFx: (reduced: boolean) => void;
  setReducedFlashing: (reduced: boolean) => void;
  setEffectIntensity: (intensity: number) => void;
  setHighContrast: (enabled: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
}

interface TutorialRuntime {
  step: TutorialStep | "complete";
  complete: boolean;
  pinned: boolean;
  facts: Record<string, boolean>;
}

interface TouchInputState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  firing: boolean;
  novaQueued: boolean;
}

interface TouchStickProps {
  label: string;
  hint: string;
  tone: "thrust" | "fire";
  onVector: (x: number, y: number, active: boolean) => void;
  onEngage: () => void;
}

interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  view: Container;
  dead?: boolean;
}

interface Player extends Entity {
  angle: number;
  invulnerable: number;
  engineFlare: Graphics;
  motionStreaks: Container;
  hull: Container;
  portJet: Graphics;
  starboardJet: Graphics;
  shield: Container;
  muzzleFlash: Graphics;
  armorSheen: Graphics;
  navLights: Graphics;
  wingConduits: Graphics;
  afterburnerRing: Graphics;
  recoil: number;
}

interface Planetoid extends Entity {
  integrity: number;
  shards: number;
  miningProgress: number;
  lastHitAt: number;
  cracks: Graphics;
  damageLayer: Graphics;
  oreGlow: Graphics;
  maxIntegrity: number;
  miningPulse: Graphics;
  miningHeat: number;
  spin: number;
  fracturePlates: Container[];
  damageStage: number;
}

interface Crystal extends Entity {
  age: number;
  claimedBy?: number;
  halo: Graphics;
  glint: Graphics;
  trail: Graphics;
  phase: number;
}

interface Fabricator extends Entity {
  carrying: boolean;
  miningTimer: number;
  targetId?: number;
  beam: Graphics;
  hull: Container;
  claws: Container;
  cargoGlow: Graphics;
  engineFlare: Graphics;
  phase: number;
  upperClaw: Graphics;
  lowerClaw: Graphics;
  scanner: Graphics;
}

interface Sentinel extends Entity {
  fireTimer: number;
  orbit: number;
  health: number;
  damageLayer: Graphics;
  hull: Container;
  shield: Graphics;
  weaponCore: Graphics;
  engineFlare: Graphics;
  phase: number;
  chargeMarks: Container;
  shotPulse: number;
}

interface Projectile extends Entity {
  owner: "player" | "enemy";
  kind: "laser" | "bolt" | "nova";
  age: number;
  lifetime: number;
  accent?: Container;
  trail: Graphics;
}

interface Particle extends Entity {
  age: number;
  lifetime: number;
  spin: number;
  startScale: number;
  endScale: number;
  drag: number;
  fadePower: number;
  kind: "spark" | "shard" | "smoke" | "plasma";
}

interface ImpactFx extends Entity {
  age: number;
  lifetime: number;
  startScale: number;
  endScale: number;
  spin: number;
}

interface Wreckage extends Entity {
  age: number;
  lifetime: number;
  spin: number;
  ember: Graphics;
  fadeStart: number;
}

interface DreadEngine extends Entity {
  parts: Container[];
  innerRing: Container;
  outerRing: Container;
  core: Graphics;
  active: boolean;
  health: number;
  destroyed: boolean;
  damageLayers: Graphics[];
  energyCage: Container;
  aperture: Container;
  coreHalo: Graphics;
  threatHalo: Graphics;
  targetingBeam: Graphics;
  forgeAura: Graphics;
  apertureBlades: Graphics[];
  weaponArms: Container[];
  driveVents: Graphics[];
  conduitPulse: Graphics;
  sensorArray: Container;
  scorchNodes: Graphics[];
  deathPose: number;
}

interface RuntimeProfile {
  viewport: string;
  frames: number;
  elapsedMs: number;
  averageFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
}

const TUTORIAL_COPY: Record<TutorialStep, {
  kicker: string;
  title: string;
  touch: string;
  desktop: string;
}> = {
  move: {
    kicker: "Flight training",
    title: "Move the Vesper",
    touch: "Drag THRUST toward a large cracked planetoid.",
    desktop: "Use WASD, the arrow keys, or the left gamepad stick to fly toward a cracked planetoid.",
  },
  mine: {
    kicker: "Flux extraction",
    title: "Cut loose a crystal",
    touch: "Drag AIM toward the glowing cracks and hold to fire. Short bursts extract more Flux.",
    desktop: "Face a cracked planetoid and fire with Space or the gamepad. Short bursts extract more Flux.",
  },
  collect: {
    kicker: "Nova foundry",
    title: "Claim the glowing Flux",
    touch: "Follow the bracketed crystal, then use THRUST to fly through it. Each one becomes a Nova Charge.",
    desktop: "Follow the bracketed crystal and fly through it. Every collected Flux crystal becomes one Nova Charge.",
  },
  threat: {
    kicker: "Mission loop",
    title: "Stop the Dread Engine",
    touch: "Mine Flux, shoot orange Fabricators before Assembly reaches 20, then launch 13 Novas when the Engine wakes.",
    desktop: "Mine Flux, stop orange Fabricators before Assembly reaches 20, then launch 13 Novas when the Engine wakes.",
  },
};

const INITIAL_HUD: HudState = {
  score: 0,
  lives: RULES.playerLives,
  charges: 0,
  zone: 1,
  pieces: 0,
  engineHealth: RULES.engineHits,
  engineActive: false,
  contacts: [],
  threatLevel: 0,
  tacticalStatus: "SECTOR QUIET",
};

const EMPTY_API: GameApi = {
  start() {},
  startTutorial() {},
  restart() {},
  tutorialEvent() {},
  togglePause() {},
  unlockAudio() {},
  setMuted() {},
  setReducedFx() {},
  setReducedFlashing() {},
  setEffectIntensity() {},
  setHighContrast() {},
  setColorMode() {},
};

function createTouchInput(): TouchInputState {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    firing: false,
    novaQueued: false,
  };
}

function resetTouchInput(input: TouchInputState) {
  input.moveX = 0;
  input.moveY = 0;
  input.aimX = 0;
  input.aimY = 0;
  input.firing = false;
  input.novaQueued = false;
}

function TouchStick({ label, hint, tone, onVector, onEngage }: TouchStickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const onVectorRef = useRef(onVector);
  const [visual, setVisual] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    onVectorRef.current = onVector;
  }, [onVector]);

  useEffect(() => () => {
    onVectorRef.current(0, 0, false);
  }, []);

  const updateVector = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const maxOffset = Math.max(24, Math.min(rect.width, rect.height) * 0.3);
    const vector = normalizeControlVector(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2),
      maxOffset,
      0.08,
    );
    setVisual({ x: vector.x * maxOffset, y: vector.y * maxOffset, active: true });
    onVectorRef.current(vector.x, vector.y, true);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Older embedded browsers may not expose capture for every synthetic pointer.
    }
    onEngage();
    updateVector(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    updateVector(event.clientX, event.clientY);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    pointerIdRef.current = null;
    setVisual({ x: 0, y: 0, active: false });
    onVectorRef.current(0, 0, false);
  };

  return (
    <div
      className={`touch-stick touch-stick-${tone} ${visual.active ? "active" : ""}`}
      ref={baseRef}
      role="group"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onLostPointerCapture={releasePointer}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="touch-stick-grid" aria-hidden="true" />
      <span
        className="touch-stick-knob"
        aria-hidden="true"
        style={{ transform: `translate3d(calc(-50% + ${visual.x}px), calc(-50% + ${visual.y}px), 0)` }}
      >
        <i />
      </span>
      <span className="touch-stick-label">{label}</span>
      <span className="touch-stick-hint">{hint}</span>
    </div>
  );
}

function formatScore(score: number) {
  return Math.max(0, score).toString().padStart(7, "0");
}

function MissionBriefing() {
  const items = [
    ["Mine", "Cut Flux Shards from volatile planetoids."],
    ["Deny", "Intercept Fabricators before they complete the Engine."],
    ["Destroy", "Launch 13 Nova Charges into the awakened machine."],
  ];
  return (
    <aside className="briefing-card" aria-label="Mission briefing">
      <div className="briefing-inner">
        <p className="briefing-label">Field directive 01 · Cinder Expanse</p>
        {items.map(([title, copy], index) => (
          <div className="mission-row" key={title}>
            <span className="mission-index">0{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
          </div>
        ))}
        <div className="control-strip" aria-label="Controls summary">
          <span><span className="keycap">WASD</span>Thrust</span>
          <span><span className="keycap">SPACE</span>Laser</span>
          <span><span className="keycap">C</span>Nova</span>
          <span><span className="keycap">TOUCH</span>Twin-stick</span>
        </div>
      </div>
    </aside>
  );
}

function TutorialCoachmark({
  step,
  touchCapable,
  onSkip,
  onComplete,
}: {
  step: TutorialStep;
  touchCapable: boolean;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const copy = TUTORIAL_COPY[step];
  const stepIndex = TUTORIAL_STEPS.indexOf(step);
  const instruction = touchCapable ? copy.touch : copy.desktop;
  return (
    <section
      className={`tutorial-panel tutorial-${step}`}
      aria-labelledby="tutorial-title"
      data-testid="tutorial-panel"
      data-tutorial-step={step}
    >
      <div className="tutorial-header">
        <span>{copy.kicker}</span>
        <strong>{stepIndex + 1} / {TUTORIAL_STEPS.length}</strong>
        <button
          type="button"
          className="tutorial-skip"
          aria-label="Skip first-run tutorial"
          data-testid="tutorial-skip"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
      <h2 id="tutorial-title">{copy.title}</h2>
      <p>{instruction}</p>
      <div className="tutorial-footer">
        <div className="tutorial-progress" aria-label={`Tutorial step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}`}>
          {TUTORIAL_STEPS.map((item, index) => (
            <i className={index <= stepIndex ? "active" : ""} key={item} aria-hidden="true" />
          ))}
        </div>
        {step === "threat" && (
          <button type="button" className="tutorial-continue" onClick={onComplete}>
            Begin mission
          </button>
        )}
      </div>
    </section>
  );
}

function Radar({ contacts, status, danger }: { contacts: RadarContact[]; status: string; danger: number }) {
  return (
    <div className={`radar-wrap ${danger > 0.62 ? "danger" : ""}`} aria-label={`Tactical scanner: ${status}`}>
      <div className="radar">
        <div className="radar-rings" />
        <div className="radar-sweep" />
        <span className="radar-player" aria-hidden="true"><i /><b /></span>
        {contacts.map((contact) => (
          <span
            className={`radar-contact ${contact.kind}`}
            key={`${contact.kind}-${contact.id}`}
            style={{
              left: `${contact.x}%`,
              top: `${contact.y}%`,
              opacity: 0.58 + (1 - contact.range) * 0.42,
              "--trail-angle": `${contact.heading}rad`,
              "--trail-length": `${contact.trailLength}px`,
            } as CSSProperties}
          >
            <i className="radar-trail" aria-hidden="true" />
            <b className="radar-dot" aria-hidden="true" />
          </span>
        ))}
      </div>
      <span className="radar-caption">Vector scanner · 2.4 AU</span>
      <span className="radar-status"><i aria-hidden="true" />{status}</span>
    </div>
  );
}

function HeadsUpDisplay({ hud }: { hud: HudState }) {
  const integritySegments = Math.ceil((hud.engineHealth / RULES.engineHits) * RULES.enginePieces);
  const engineDestroyed = hud.tacticalStatus === "FIELD SECURE";
  return (
    <div className={`hud ${hud.threatLevel > 0.62 ? "threat-high" : ""}`} aria-label="Game status">
      <div className="tactical-frame" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="hud-top">
        <div className="hud-cluster">
          <div className="hud-stat">
            <span className="hud-label">Score</span>
            <span className="hud-value">{formatScore(hud.score)}</span>
          </div>
          <div className="hud-stat optional">
            <span className="hud-label">Field</span>
            <span className="hud-value">0{hud.zone}</span>
          </div>
        </div>
        <Radar contacts={hud.contacts} status={hud.tacticalStatus} danger={hud.threatLevel} />
        <div className="hud-cluster right">
          <div className="hud-stat">
            <span className="hud-label">Nova charges</span>
            <span className="hud-value amber">{hud.charges.toString().padStart(2, "0")}</span>
          </div>
          <div className="hud-stat">
            <span className="hud-label">Vesper</span>
            <span className="hud-value">{Array.from({ length: hud.lives }, () => "◆").join(" ") || "—"}</span>
          </div>
        </div>
      </div>
      <div className="hud-bottom">
        <div className={`construction-panel ${hud.tacticalStatus === "FIELD SECURE" ? "destroyed" : hud.engineActive ? "active" : "building"}`}>
          <div className="construction-header">
            <span>{engineDestroyed ? "Dread Engine ruptured" : hud.engineActive ? "Dread Engine integrity" : "Dread Engine assembly"}</span>
            <strong>
              {engineDestroyed
                ? "FIELD SECURE"
                : hud.engineActive
                ? `${hud.engineHealth} / ${RULES.engineHits}`
                : `${hud.pieces} / ${RULES.enginePieces}`}
            </strong>
          </div>
          <div className="construction-track" aria-hidden="true">
            {Array.from({ length: RULES.enginePieces }, (_, index) => (
              <span
                className={`construction-segment ${
                  engineDestroyed
                    ? index % 3 === 1 ? "" : "ruptured"
                    : hud.engineActive
                    ? index < integritySegments ? "damaged" : ""
                    : index < hud.pieces ? "active" : ""
                }`}
                key={index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoidforgeGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const gameApiRef = useRef<GameApi>(EMPTY_API);
  const touchInputRef = useRef<TouchInputState>(createTouchInput());
  const tutorialRuntimeRef = useRef<TutorialRuntime>(createTutorialState() as TutorialRuntime);
  const tutorialActiveRef = useRef(false);
  const tutorialPersistRef = useRef(false);
  const helpOpenRef = useRef(false);
  const mutedRef = useRef(false);
  const reducedFxRef = useRef(false);
  const reducedFlashingRef = useRef(false);
  const effectIntensityRef = useRef(1);
  const highContrastRef = useRef(false);
  const colorModeRef = useRef<ColorMode>("standard");
  const [ready, setReady] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>("title");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [notice, setNotice] = useState<{ text: string; danger: boolean; key: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [reducedFx, setReducedFx] = useState(false);
  const [reducedFlashing, setReducedFlashing] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>("standard");
  const [highContrast, setHighContrast] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [touchCapable, setTouchCapable] = useState(false);
  const [touchSouthpaw, setTouchSouthpaw] = useState(false);
  const [touchResetKey, setTouchResetKey] = useState(0);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  const [tutorialRecommended, setTutorialRecommended] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const storedMuted = window.localStorage.getItem("voidforge-muted") === "true";
    const storedReduced = window.localStorage.getItem("voidforge-reduced-fx");
    const storedFlashing = window.localStorage.getItem("voidforge-reduced-flashing");
    const storedIntensity = Number(window.localStorage.getItem("voidforge-effect-intensity"));
    const storedColorMode = window.localStorage.getItem("voidforge-color-mode");
    const storedContrast = window.localStorage.getItem("voidforge-high-contrast") === "true";
    const params = new URLSearchParams(window.location.search);
    const tutorialMode = resolveTutorialMode({
      query: params.get("tutorial"),
      completed: window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true",
      showcase: params.has("showcase"),
      profile: params.get("profile") === "1",
    });
    // Client-only preferences cannot be known during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(storedMuted);
    setReducedFx(storedReduced === null ? prefersReduced : storedReduced === "true");
    setReducedFlashing(storedFlashing === null ? prefersReduced : storedFlashing === "true");
    setEffectIntensity([0, 0.35, 0.7, 1].includes(storedIntensity) ? storedIntensity : 1);
    if (["standard", "deuteranopia", "protanopia", "tritanopia"].includes(storedColorMode ?? "")) {
      setColorMode(storedColorMode as ColorMode);
    }
    setHighContrast(storedContrast);
    setTutorialRecommended(tutorialMode.enabled);
  }, []);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const forced = new URLSearchParams(window.location.search).get("touch") === "1";
    const updateCapability = () => {
      const compactTouchDevice = navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 900;
      // The query flag makes deterministic mobile QA possible without changing production defaults.
      setTouchCapable(forced || coarsePointer.matches || compactTouchDevice);
    };
    updateCapability();
    coarsePointer.addEventListener?.("change", updateCapability);
    window.addEventListener("resize", updateCapability);
    return () => {
      coarsePointer.removeEventListener?.("change", updateCapability);
      window.removeEventListener("resize", updateCapability);
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    gameApiRef.current.setMuted(muted);
    window.localStorage.setItem("voidforge-muted", String(muted));
  }, [muted]);

  useEffect(() => {
    reducedFxRef.current = reducedFx;
    gameApiRef.current.setReducedFx(reducedFx);
    window.localStorage.setItem("voidforge-reduced-fx", String(reducedFx));
  }, [reducedFx]);

  useEffect(() => {
    reducedFlashingRef.current = reducedFlashing;
    gameApiRef.current.setReducedFlashing(reducedFlashing);
    window.localStorage.setItem("voidforge-reduced-flashing", String(reducedFlashing));
  }, [reducedFlashing]);

  useEffect(() => {
    effectIntensityRef.current = effectIntensity;
    gameApiRef.current.setEffectIntensity(effectIntensity);
    window.localStorage.setItem("voidforge-effect-intensity", String(effectIntensity));
  }, [effectIntensity]);

  useEffect(() => {
    colorModeRef.current = colorMode;
    gameApiRef.current.setColorMode(colorMode);
    window.localStorage.setItem("voidforge-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    highContrastRef.current = highContrast;
    gameApiRef.current.setHighContrast(highContrast);
    window.localStorage.setItem("voidforge-high-contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  useEffect(() => {
    const host = mountRef.current;
    if (host === null) return;
    let cancelled = false;
    let app: Application | undefined;
    const audio = new VoidforgeAudio({ muted: mutedRef.current, volume: 0.72 });
    const keys = new Set<string>();
    const timers = new Set<number>();
    let localMode: ScreenMode = "title";
    let localReducedFx = reducedFxRef.current;
    let localReducedFlashing = reducedFlashingRef.current;
    let localEffectIntensity = effectIntensityRef.current;
    let idCounter = 0;

    const boot = async () => {
      const [PIXI, { createVoidforgePostFx }] = await Promise.all([
        import("pixi.js"),
        import("./postfx"),
      ]);
      if (cancelled) return;
      app = new PIXI.Application();
      await app.init({
        resizeTo: host,
        background: 0x02040b,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 1.5),
        preference: "webgl",
        powerPreference: "high-performance",
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }

      app.canvas.setAttribute("role", "application");
      app.canvas.setAttribute("aria-label", "VOIDFORGE game field");
      app.canvas.setAttribute("tabindex", "0");
      host.replaceChildren(app.canvas);

      const backgroundTexture = await PIXI.Assets.load("/assets/cosmic-arena.png");
      if (cancelled || app === undefined) return;

      const background = new PIXI.Sprite(backgroundTexture) as Sprite;
      background.alpha = 0.64;
      app.stage.addChild(background);

      const hazeLayer = new PIXI.Container();
      const starLayer = new PIXI.Container();
      const dustLayer = new PIXI.Container();
      const farDebrisLayer = new PIXI.Container();
      const nearDebrisLayer = new PIXI.Container();
      const world = new PIXI.Container();
      const flashLayer = new PIXI.Container();
      const storyLayer = new PIXI.Container();
      const terrainLayer = new PIXI.Container();
      const wreckageLayer = new PIXI.Container();
      const lowFxLayer = new PIXI.Container();
      const pickupLayer = new PIXI.Container();
      const enemyLayer = new PIXI.Container();
      const playerLayer = new PIXI.Container();
      const friendlyProjectileLayer = new PIXI.Container();
      const hostileProjectileLayer = new PIXI.Container();
      const highFxLayer = new PIXI.Container();
      const renderLayers = [
        storyLayer,
        terrainLayer,
        wreckageLayer,
        lowFxLayer,
        highFxLayer,
        pickupLayer,
        enemyLayer,
        playerLayer,
        friendlyProjectileLayer,
        hostileProjectileLayer,
      ];
      world.addChild(...renderLayers);
      app.stage.addChild(hazeLayer, starLayer, dustLayer, farDebrisLayer, nearDebrisLayer, world, flashLayer);

      const speedLayer = new PIXI.Container();
      const speedStreaks: Graphics[] = [];
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2 + (index % 3) * 0.047;
        const inner = 238 + (index % 4) * 32;
        const length = 86 + (index % 5) * 31;
        const streak = new PIXI.Graphics();
        streak.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(Math.cos(angle) * (inner + length), Math.sin(angle) * (inner + length))
          .stroke({ color: index % 4 === 0 ? 0xb9f6ff : 0x5ddfff, width: index % 4 === 0 ? 1.5 : 0.8, alpha: 0.42 });
        speedLayer.addChild(streak);
        speedStreaks.push(streak);
      }
      speedLayer.blendMode = "add";
      speedLayer.visible = false;

      const signalVeil = new PIXI.Graphics();
      for (let index = 0; index < 6; index += 1) {
        const radius = 72 + index * 48;
        signalVeil.arc(0, 0, radius, -0.18 + index * 0.11, 0.54 + index * 0.09)
          .stroke({ color: index % 2 ? 0xff805d : 0xa877ff, width: index % 3 === 0 ? 1.4 : 0.7, alpha: 0.22 });
      }
      signalVeil.blendMode = "add";
      signalVeil.alpha = 0;

      const threatFrame = new PIXI.Graphics();
      const bossIndicator = new PIXI.Graphics();
      bossIndicator.poly([18, 0, -7, -11, -2, 0, -7, 11])
        .fill({ color: 0xff765d, alpha: 0.88 })
        .stroke({ color: 0xffd0a5, width: 1.2, alpha: 0.78 });
      bossIndicator.circle(-3, 0, 16).stroke({ color: 0xc57bff, width: 1.5, alpha: 0.55 });
      bossIndicator.blendMode = "add";
      bossIndicator.visible = false;
      const threatPointers: Array<{ view: Graphics; bolt: Graphics; sentinel: Graphics }> = [];
      for (let index = 0; index < 4; index += 1) {
        const view = new PIXI.Graphics();
        view.poly([20, 0, -4, -13, 2, 0, -4, 13])
          .fill({ color: 0x050711, alpha: 0.78 })
          .stroke({ color: 0xff9a77, width: 1.6, alpha: 0.92 });
        view.moveTo(-9, -16).lineTo(8, -16).stroke({ color: 0xc48cff, width: 1.1, alpha: 0.7 });
        view.moveTo(-9, 16).lineTo(8, 16).stroke({ color: 0xc48cff, width: 1.1, alpha: 0.7 });
        const bolt = new PIXI.Graphics();
        bolt.poly([6, 0, -5, -5, -1, 0, -5, 5]).fill({ color: 0xff719a, alpha: 0.92 });
        const sentinel = new PIXI.Graphics();
        sentinel.circle(-2, 0, 4).stroke({ color: 0xb987ff, width: 1.3, alpha: 0.88 });
        view.addChild(bolt, sentinel);
        view.visible = false;
        threatPointers.push({ view, bolt, sentinel });
      }

      const targetReticle = new PIXI.Graphics();
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI * 0.5;
        const inner = 29;
        const outer = 43;
        const tangentX = -Math.sin(angle) * 10;
        const tangentY = Math.cos(angle) * 10;
        targetReticle.moveTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
          .lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(Math.cos(angle) * inner + tangentX, Math.sin(angle) * inner + tangentY)
          .stroke({ color: 0xc5f7ff, width: 1.2, alpha: 0.7 });
      }
      targetReticle.circle(0, 0, 22).stroke({ color: 0x8beaff, width: 0.8, alpha: 0.28 });
      targetReticle.blendMode = "add";
      targetReticle.visible = false;
      flashLayer.addChild(speedLayer, signalVeil, threatFrame, bossIndicator);
      for (const pointer of threatPointers) flashLayer.addChild(pointer.view);
      flashLayer.addChild(targetReticle);

      const postFx = createVoidforgePostFx({
        effectIntensity: effectIntensityRef.current,
        reducedMotion: reducedFxRef.current,
        reducedFlashing: reducedFlashingRef.current,
        colorProfile: colorModeRef.current,
        chromaticPixels: 2.2,
        heatPixels: 4.2,
      });
      app.stage.filters = [postFx];
      app.stage.filterArea = app.screen;

      const rng = seededRandom(0x0f0a6e);
      const haze: Array<{ view: Graphics; x: number; y: number; factor: number; phase: number; scale: number }> = [];
      for (let index = 0; index < 6; index += 1) {
        const wisp = new PIXI.Graphics();
        const wide = 260 + rng() * 360;
        const tall = 90 + rng() * 180;
        const color = index % 3 === 0 ? 0x325a88 : index % 3 === 1 ? 0x643e83 : 0x7a3d35;
        wisp.ellipse(0, 0, wide, tall).fill({ color, alpha: 0.028 + rng() * 0.025 });
        wisp.ellipse(-wide * 0.12, tall * 0.06, wide * 0.58, tall * 0.42)
          .fill({ color: index % 2 ? 0x8c59a8 : 0x397fa0, alpha: 0.018 });
        wisp.rotation = rng() * Math.PI;
        hazeLayer.addChild(wisp);
        haze.push({ view: wisp, x: rng(), y: rng(), factor: 0.012 + rng() * 0.045, phase: rng() * Math.PI * 2, scale: 0.72 + rng() * 0.58 });
      }

      const stars: Array<{ view: Graphics; x: number; y: number; factor: number; phase: number; twinkle: number }> = [];
      for (let index = 0; index < 170; index += 1) {
        const star = new PIXI.Graphics();
        const size = rng() < 0.08 ? 1.8 + rng() * 1.6 : 0.45 + rng() * 0.9;
        const color = rng() < 0.14 ? 0x77dfff : rng() < 0.22 ? 0xd29cff : 0xddecff;
        star.circle(0, 0, size).fill({ color, alpha: 0.42 + rng() * 0.55 });
        if (size > 1.7) {
          star.moveTo(-size * 3, 0).lineTo(size * 3, 0).stroke({ color, width: 0.55, alpha: 0.34 });
          star.moveTo(0, -size * 3).lineTo(0, size * 3).stroke({ color, width: 0.55, alpha: 0.34 });
        }
        starLayer.addChild(star);
        stars.push({
          view: star,
          x: rng(),
          y: rng(),
          factor: 0.025 + rng() * 0.14,
          phase: rng() * Math.PI * 2,
          twinkle: 0.35 + rng() * 0.85,
        });
      }
      const dust: Array<{ view: Graphics; x: number; y: number; factor: number }> = [];
      for (let index = 0; index < 42; index += 1) {
        const mote = new PIXI.Graphics();
        const length = 3 + rng() * 11;
        mote.ellipse(0, 0, length, 0.5 + rng() * 1.2).fill({
          color: rng() < 0.5 ? 0x5fdcff : 0xb279ff,
          alpha: 0.045 + rng() * 0.075,
        });
        dustLayer.addChild(mote);
        dust.push({ view: mote, x: rng(), y: rng(), factor: 0.18 + rng() * 0.18 });
      }
      const farDebris: Array<{ view: Graphics; x: number; y: number; factor: number; spin: number }> = [];
      for (let index = 0; index < 28; index += 1) {
        const fragment = new PIXI.Graphics();
        const size = 2.5 + rng() * 7;
        fragment.poly([-size, -size * 0.32, -size * 0.2, -size, size, -size * 0.15, size * 0.35, size * 0.82])
          .fill({ color: rng() < 0.45 ? 0x34405a : 0x493450, alpha: 0.11 + rng() * 0.13 })
          .stroke({ color: rng() < 0.5 ? 0x78b6d8 : 0xa06ca9, width: 0.6, alpha: 0.12 });
        farDebrisLayer.addChild(fragment);
        farDebris.push({
          view: fragment,
          x: rng(),
          y: rng(),
          factor: 0.28 + rng() * 0.2,
          spin: (rng() - 0.5) * 0.12,
        });
      }
      const nearDebris: Array<{ view: Graphics; x: number; y: number; factor: number; spin: number; scale: number }> = [];
      for (let index = 0; index < 8; index += 1) {
        const fragment = new PIXI.Graphics();
        const size = 10 + rng() * 18;
        fragment.poly([-size, -size * 0.2, -size * 0.28, -size, size * 0.82, -size * 0.4, size, size * 0.48, -size * 0.16, size])
          .fill({ color: 0x0a0d17, alpha: 0.32 })
          .stroke({ color: index % 2 ? 0x735886 : 0x486a7d, width: 1, alpha: 0.18 });
        nearDebrisLayer.addChild(fragment);
        nearDebris.push({
          view: fragment,
          x: index % 2 ? 0.04 + rng() * 0.12 : 0.84 + rng() * 0.12,
          y: rng(),
          factor: 0.56 + rng() * 0.18,
          spin: (rng() - 0.5) * 0.18,
          scale: 0.72 + rng() * 1.1,
        });
      }
      background.alpha = highContrastRef.current ? 0.46 : 0.64;
      hazeLayer.alpha = highContrastRef.current ? 0 : 1;
      starLayer.alpha = highContrastRef.current ? 1 : 0.82;
      dustLayer.alpha = highContrastRef.current ? 0.62 : 1;
      farDebrisLayer.alpha = highContrastRef.current ? 0.45 : 0.82;
      nearDebrisLayer.alpha = highContrastRef.current ? 0 : 0.54;

      let player: Player;
      let engine: DreadEngine;
      let planetoids: Planetoid[] = [];
      let crystals: Crystal[] = [];
      let tutorialTarget: Crystal | undefined;
      let fabricators: Fabricator[] = [];
      let sentinels: Sentinel[] = [];
      let projectiles: Projectile[] = [];
      let particles: Particle[] = [];
      let impactFx: ImpactFx[] = [];
      let wreckage: Wreckage[] = [];
      let landmarks: Array<{
        view: Container;
        beacon: Graphics;
        movingPart: Container;
        phase: number;
        spin: number;
      }> = [];
      let playerEchoes: Graphics[] = [];
      const playerHistory = new Float32Array(10);
      let playerHistoryTimer = 0;
      let microDetailViews: Container[] = [];
      let microDetailEnabled = false;
      let renderHeadroom = 1;
      const radarHistory = new Map<number, { x: number; y: number }>();
      let score = 0;
      let lives: number = RULES.playerLives;
      let charges = 0;
      let zone = 1;
      let pieces = 0;
      let fireCooldown = 0;
      let novaCooldown = 0;
      let respawnSentinelTimer = 5;
      let respawnFabricatorTimer = 8;
      let hudTimer = 0;
      let cameraX = RULES.worldWidth * 0.46;
      let cameraY = RULES.worldHeight * 0.5;
      let cameraZoom = 1;
      let shake = 0;
      let lastGamepadBomb = false;
      let lastGamepadPause = false;
      let lastGamepadConfirm = false;
      let victoryTimer = 0;
      let holdShowcase = false;
      let showcaseFrozen = false;
      let motionClock = 0;
      let activationPulse = 0;
      let shockwaveAge = 99;
      let shockwaveDuration = 0.5;
      let shockwaveX = 0;
      let shockwaveY = 0;
      let shockwaveForce = 0;

      const nextId = () => ++idCounter;

      const notify = (text: string, danger = false) => {
        const key = Date.now() + Math.floor(rng() * 10_000);
        setNotice({ text, danger, key });
        const timer = window.setTimeout(() => {
          setNotice((current) => current?.key === key ? null : current);
          timers.delete(timer);
        }, 2850);
        timers.add(timer);
      };

      const applyTutorialEvent = (event: TutorialEvent) => {
        if (!tutorialActiveRef.current) return;
        const current = tutorialRuntimeRef.current;
        const next = advanceTutorial(current, event) as TutorialRuntime;
        if (next === current) return;
        tutorialRuntimeRef.current = next;
        if (next.complete) {
          tutorialActiveRef.current = false;
          setTutorialStep(null);
          if (tutorialPersistRef.current) {
            window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
            setTutorialRecommended(false);
          }
          tutorialPersistRef.current = false;
          player.invulnerable = Math.max(player.invulnerable, 2.5);
          notify(event === "skip" ? "TRAINING SKIPPED · MISSION ACTIVE" : "TRAINING COMPLETE · MISSION ACTIVE");
          return;
        }
        setTutorialStep(next.step as TutorialStep);
      };

      const activateTutorial = ({ step, pinned, persist }: { step: string; pinned: boolean; persist: boolean }) => {
        tutorialRuntimeRef.current = createTutorialState(step, pinned) as TutorialRuntime;
        tutorialActiveRef.current = true;
        tutorialPersistRef.current = persist;
        setTutorialStep(tutorialRuntimeRef.current.step as TutorialStep);
      };

      const disableTutorial = () => {
        tutorialActiveRef.current = false;
        tutorialPersistRef.current = false;
        setTutorialStep(null);
      };

      const tutorialModeForRun = (override?: "force" | "disable") => {
        if (override === "force") return { enabled: true, step: "move", pinned: false, persist: false };
        if (override === "disable") return { enabled: false, step: "move", pinned: false, persist: false };
        const params = new URLSearchParams(window.location.search);
        return resolveTutorialMode({
          query: params.get("tutorial"),
          completed: window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true",
          showcase: params.has("showcase"),
          profile: params.get("profile") === "1",
        });
      };

      const panFor = (x: number) => clamp((x - cameraX) / 900, -1, 1);

      const voiceLine = (line: string) => {
        if (mutedRef.current || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.pitch = 0.35;
        utterance.rate = 0.72;
        utterance.volume = 0.7;
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find((voice) => /english|united states|david|mark/i.test(`${voice.name} ${voice.lang}`)) ?? null;
        window.speechSynthesis.speak(utterance);
      };

      const makePlayerView = () => {
        const container = new PIXI.Container();
        const motionStreaks = new PIXI.Container();
        for (let index = 0; index < 6; index += 1) {
          const streak = new PIXI.Graphics();
          const offset = (index - 2.5) * 8;
          const length = 48 + (index % 3) * 20;
          streak.moveTo(-34, offset).lineTo(-34 - length, offset * 1.08).stroke({
            color: index % 2 ? 0x7be8ff : 0xc7f8ff,
            width: index % 3 === 0 ? 1.8 : 1,
            alpha: 0.34 + (index % 2) * 0.18,
          });
          motionStreaks.addChild(streak);
        }
        motionStreaks.visible = false;
        motionStreaks.blendMode = "add";
        const glow = new PIXI.Graphics();
        glow.ellipse(-4, 0, 62, 36).fill({ color: 0x42dfff, alpha: 0.085 });
        glow.ellipse(-18, 0, 34, 20).fill({ color: 0x7d66ff, alpha: 0.06 });
        glow.blendMode = "add";
        const flare = new PIXI.Graphics();
        flare.poly([-26, -11, -63, 0, -26, 11]).fill({ color: 0x174d8a, alpha: 0.62 });
        flare.poly([-27, -7, -73, 0, -27, 7]).fill({ color: 0x47dfff, alpha: 0.82 });
        flare.poly([-29, -3, -84, 0, -29, 3]).fill({ color: 0xffffff, alpha: 0.72 });
        flare.blendMode = "add";
        const afterburnerRing = new PIXI.Graphics();
        afterburnerRing.ellipse(-48, 0, 19, 13).stroke({ color: 0xb8f8ff, width: 1.35, alpha: 0.52 });
        afterburnerRing.ellipse(-58, 0, 12, 8).stroke({ color: 0x926fff, width: 1, alpha: 0.42 });
        afterburnerRing.moveTo(-41, -10).lineTo(-68, -5).stroke({ color: 0x65e7ff, width: 0.8, alpha: 0.35 });
        afterburnerRing.moveTo(-41, 10).lineTo(-68, 5).stroke({ color: 0xffa057, width: 0.8, alpha: 0.28 });
        afterburnerRing.blendMode = "add";
        const hull = new PIXI.Container();
        const portJet = new PIXI.Graphics();
        portJet.poly([-10, -20, -23, -29, -17, -15]).fill({ color: 0x78eaff, alpha: 0.88 });
        portJet.poly([-12, -20, -27, -27, -18, -18]).fill({ color: 0xffffff, alpha: 0.5 });
        portJet.blendMode = "add";
        portJet.alpha = 0;
        const starboardJet = new PIXI.Graphics();
        starboardJet.poly([-10, 20, -23, 29, -17, 15]).fill({ color: 0xffa34e, alpha: 0.88 });
        starboardJet.poly([-12, 20, -27, 27, -18, 18]).fill({ color: 0xffffff, alpha: 0.5 });
        starboardJet.blendMode = "add";
        starboardJet.alpha = 0;
        const hullShadow = new PIXI.Graphics();
        const silhouette = [42, 0, 9, -10, -17, -27, -15, -11, -39, -16, -27, 0, -39, 16, -15, 11, -17, 27, 9, 10];
        hullShadow.poly(silhouette)
          .fill({ color: 0x030812, alpha: 0.96 })
          .stroke({ color: 0x02040a, width: 7, alpha: 0.9 });
        const ship = new PIXI.Graphics();
        ship.poly(silhouette)
          .fill({ color: 0x102f49 })
          .stroke({ color: 0x91efff, width: 2.7, alpha: 0.96 });
        ship.poly([35, 0, 4, -8, -15, -20, -9, -7, -25, -10, -18, 0])
          .fill({ color: 0x245b79, alpha: 0.92 });
        ship.poly([35, 0, 4, 8, -15, 20, -9, 7, -25, 10, -18, 0])
          .fill({ color: 0x153d62, alpha: 0.96 });
        ship.poly([20, -3, -7, -7, -18, -2, 8, 0]).fill({ color: 0xb8f8ff, alpha: 0.16 });
        ship.poly([0, -8, -16, -21, -27, -10, -12, -5]).fill({ color: 0x875cff, alpha: 0.78 });
        ship.poly([0, 8, -16, 21, -27, 10, -12, 5]).fill({ color: 0xffa04d, alpha: 0.84 });
        ship.moveTo(-21, 0).lineTo(27, 0).stroke({ color: 0xc9f7ff, width: 1.1, alpha: 0.42 });
        ship.moveTo(-12, -6).lineTo(4, -10).stroke({ color: 0x07121d, width: 1.4, alpha: 0.72 });
        ship.moveTo(-12, 6).lineTo(4, 10).stroke({ color: 0x07121d, width: 1.4, alpha: 0.72 });
        const wingConduits = new PIXI.Graphics();
        wingConduits.moveTo(-22, -12).lineTo(-8, -20).lineTo(2, -8)
          .stroke({ color: 0x72eaff, width: 1.25, alpha: 0.58 });
        wingConduits.moveTo(-22, 12).lineTo(-8, 20).lineTo(2, 8)
          .stroke({ color: 0xffa158, width: 1.25, alpha: 0.54 });
        wingConduits.circle(-8, -20, 2.1).fill({ color: 0xd9ffff, alpha: 0.74 });
        wingConduits.circle(-8, 20, 2.1).fill({ color: 0xffd2a5, alpha: 0.72 });
        wingConduits.blendMode = "add";
        const microDetail = new PIXI.Graphics();
        microDetail.moveTo(17, -5).lineTo(4, -4).lineTo(-4, -9)
          .stroke({ color: 0xd7f8ff, width: 0.52, alpha: 0.46 });
        microDetail.moveTo(17, 5).lineTo(4, 4).lineTo(-4, 9)
          .stroke({ color: 0x91b6c7, width: 0.52, alpha: 0.42 });
        for (const [x, y] of [[-14, -13], [-14, 13], [-26, -6], [-26, 6]] as const) {
          microDetail.circle(x, y, 0.8).fill({ color: 0xe5fbff, alpha: 0.52 });
        }
        microDetail.visible = microDetailEnabled;
        microDetailViews.push(microDetail);
        const canopy = new PIXI.Graphics();
        canopy.poly([21, 0, 4, -8, -5, 0, 4, 8])
          .fill({ color: 0x57dff4, alpha: 0.82 })
          .stroke({ color: 0xeaffff, width: 1.4, alpha: 0.88 });
        canopy.poly([16, -2, 6, -6, 1, -1]).fill({ color: 0xffffff, alpha: 0.62 });
        canopy.circle(5, 0, 2.8).fill({ color: 0xeaffff, alpha: 0.95 });
        const ports = new PIXI.Graphics();
        ports.circle(25, -6, 2.3).fill({ color: 0xffffff, alpha: 0.9 }).stroke({ color: 0x59e6ff, width: 1.2 });
        ports.circle(25, 6, 2.3).fill({ color: 0xffffff, alpha: 0.9 }).stroke({ color: 0x59e6ff, width: 1.2 });
        ports.circle(-25, 0, 4).fill({ color: 0x55e9ff, alpha: 0.76 });
        ports.blendMode = "add";
        const armorSheen = new PIXI.Graphics();
        armorSheen.moveTo(31, -2).lineTo(7, -8).lineTo(-14, -21)
          .stroke({ color: 0xe8ffff, width: 1.3, alpha: 0.46 });
        armorSheen.moveTo(25, 4).lineTo(5, 9)
          .stroke({ color: 0x83dcff, width: 0.9, alpha: 0.28 });
        armorSheen.blendMode = "add";
        const navLights = new PIXI.Graphics();
        navLights.circle(-16, -23, 2.2).fill({ color: 0x82f2ff, alpha: 0.92 });
        navLights.circle(-16, 23, 2.2).fill({ color: 0xffa458, alpha: 0.92 });
        navLights.circle(-31, 0, 1.6).fill({ color: 0xffffff, alpha: 0.88 });
        navLights.blendMode = "add";
        const muzzleFlash = new PIXI.Graphics();
        muzzleFlash.poly([51, 0, 33, -9, 37, 0, 33, 9])
          .fill({ color: 0x7cecff, alpha: 0.36 });
        muzzleFlash.poly([55, 0, 35, -3, 39, 0, 35, 3])
          .fill({ color: 0xffffff, alpha: 0.92 });
        muzzleFlash.blendMode = "add";
        muzzleFlash.alpha = 0;
        const shield = new PIXI.Container();
        const shieldField = new PIXI.Graphics();
        shieldField.poly([43, 0, 22, -37, -22, -37, -43, 0, -22, 37, 22, 37])
          .fill({ color: 0x42dcff, alpha: 0.035 })
          .stroke({ color: 0x86eeff, width: 1.4, alpha: 0.38 });
        shieldField.arc(0, 0, 47, -0.9, 0.62).stroke({ color: 0xd9ffff, width: 2.1, alpha: 0.62 });
        shieldField.arc(0, 0, 49, 1.72, 3.3).stroke({ color: 0x9c79ff, width: 1.6, alpha: 0.48 });
        const shieldNode = new PIXI.Graphics();
        shieldNode.circle(44, 0, 3.5).fill({ color: 0xffffff, alpha: 0.9 });
        shieldNode.circle(44, 0, 8).fill({ color: 0x68eaff, alpha: 0.12 });
        shieldNode.blendMode = "add";
        shield.addChild(shieldField, shieldNode);
        shield.visible = false;
        shield.blendMode = "add";
        hull.addChild(portJet, starboardJet, hullShadow, ship, wingConduits, microDetail, canopy, ports, armorSheen, navLights);
        container.addChild(motionStreaks, glow, afterburnerRing, flare, hull, muzzleFlash, shield);
        return {
          container, flare, motionStreaks, hull, portJet, starboardJet,
          shield, muzzleFlash, armorSheen, navLights, wingConduits, afterburnerRing,
        };
      };

      const makePlanetoidView = (radius: number, seed: number) => {
        const random = seededRandom(seed);
        const materialFamily = Math.abs(seed) % 3;
        const palette = materialFamily === 0
          ? { body: 0x252e3a, light: 0x66788b, dark: 0x111722, rim: 0xaebdca, ore: 0x65e8ff }
          : materialFamily === 1
            ? { body: 0x302a35, light: 0x7b667b, dark: 0x18141e, rim: 0xc1a9b5, ore: 0xd685ff }
            : { body: 0x352d29, light: 0x806b5a, dark: 0x1b1613, rim: 0xc3ad94, ore: 0xffaa62 };
        const container = new PIXI.Container();
        const halo = new PIXI.Graphics();
        halo.circle(0, 0, radius * 1.16).fill({ color: 0xff8a39, alpha: 0.032 });
        halo.blendMode = "add";
        const shadow = new PIXI.Graphics();
        const body = new PIXI.Graphics();
        const points: number[] = [];
        for (let index = 0; index < 21; index += 1) {
          const angle = (index / 21) * Math.PI * 2;
          const r = radius * (0.82 + random() * 0.2);
          points.push(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        const shadowPoints: number[] = [];
        for (let index = 0; index < points.length; index += 2) {
          shadowPoints.push(points[index] + radius * 0.075, points[index + 1] + radius * 0.1);
        }
        shadow.poly(shadowPoints).fill({ color: 0x03050a, alpha: 0.64 });
        body.poly(points)
          .fill({ color: palette.body })
          .stroke({ color: palette.dark, width: 5.2, alpha: 0.9 });
        const facets = new PIXI.Graphics();
        for (let index = 0; index < 21; index += 1) {
          const next = (index + 1) % 21;
          const angle = (index / 21) * Math.PI * 2;
          const light = clamp((-Math.cos(angle) - Math.sin(angle)) * 0.5, -0.55, 0.75);
          facets.poly([0, 0, points[index * 2], points[index * 2 + 1], points[next * 2], points[next * 2 + 1]])
            .fill({ color: light > 0 ? palette.light : palette.dark, alpha: 0.08 + Math.abs(light) * 0.14 });
        }
        const strata = new PIXI.Graphics();
        for (let index = 0; index < 6; index += 1) {
          const bandRadius = radius * (0.34 + index * 0.085);
          const start = -2.72 + index * 0.21 + random() * 0.12;
          strata.arc(0, 0, bandRadius, start, start + 0.78 + random() * 0.46)
            .stroke({ color: index % 2 ? palette.light : palette.dark, width: index % 3 === 0 ? 1.4 : 0.8, alpha: 0.16 + (index % 2) * 0.05 });
        }
        strata.moveTo(-radius * 0.62, radius * 0.22).lineTo(-radius * 0.18, radius * 0.08)
          .stroke({ color: palette.rim, width: 1.1, alpha: 0.18 });
        const craterLayer = new PIXI.Graphics();
        for (let index = 0; index < 10; index += 1) {
          const angle = random() * Math.PI * 2;
          const d = radius * (0.2 + random() * 0.55);
          const r = radius * (0.055 + random() * 0.1);
          const cx = Math.cos(angle) * d;
          const cy = Math.sin(angle) * d;
          craterLayer.circle(cx + r * 0.18, cy + r * 0.22, r * 1.05).fill({ color: 0x080c14, alpha: 0.7 });
          craterLayer.circle(cx, cy, r)
            .fill({ color: 0x111823, alpha: 0.84 })
            .stroke({ color: palette.light, width: 0.9, alpha: 0.28 });
          craterLayer.arc(cx - r * 0.08, cy - r * 0.08, r * 0.82, Math.PI * 1.08, Math.PI * 1.62)
            .stroke({ color: 0x9aa8b4, width: 1.1, alpha: 0.28 });
        }
        const rim = new PIXI.Graphics();
        rim.moveTo(points[10 * 2], points[10 * 2 + 1]);
        for (let index = 11; index <= 16; index += 1) rim.lineTo(points[index * 2], points[index * 2 + 1]);
        rim.stroke({ color: palette.rim, width: 2.2, alpha: 0.46 });
        const oreGlow = new PIXI.Graphics();
        for (let index = 0; index < 3; index += 1) {
          const angle = random() * Math.PI * 2;
          const d = radius * (0.24 + random() * 0.34);
          const size = radius * (0.038 + random() * 0.028);
          oreGlow.circle(Math.cos(angle) * d, Math.sin(angle) * d, size * 3.2)
            .fill({ color: index % 2 ? 0xa866ff : 0xff8747, alpha: 0.055 });
          oreGlow.circle(Math.cos(angle) * d, Math.sin(angle) * d, size)
            .fill({ color: index % 2 ? 0xd6b2ff : 0xffbc7b, alpha: 0.55 });
        }
        oreGlow.alpha = 0.16;
        oreGlow.blendMode = "add";
        const microDetail = new PIXI.Graphics();
        for (let index = 0; index < 18; index += 1) {
          const angle = random() * Math.PI * 2;
          const d = radius * (0.16 + random() * 0.63);
          const x = Math.cos(angle) * d;
          const y = Math.sin(angle) * d;
          if (index % 3 === 0) {
            microDetail.moveTo(x - 2, y).lineTo(x + 2.5, y + (random() - 0.5) * 2)
              .stroke({ color: palette.rim, width: 0.5, alpha: 0.34 });
          } else {
            microDetail.circle(x, y, 0.7 + random() * 0.5).fill({ color: index % 2 ? palette.ore : palette.rim, alpha: 0.28 });
          }
        }
        microDetail.visible = microDetailEnabled;
        microDetailViews.push(microDetail);
        const cracks = new PIXI.Graphics();
        const crackSegments: Array<[number, number, number, number]> = [];
        for (let index = 0; index < 6; index += 1) {
          const angle = random() * Math.PI * 2;
          const sx = Math.cos(angle) * radius * 0.15;
          const sy = Math.sin(angle) * radius * 0.15;
          const length = radius * (0.28 + random() * 0.28);
          crackSegments.push([sx, sy, sx + Math.cos(angle) * length, sy + Math.sin(angle) * length]);
        }
        for (const [sx, sy, ex, ey] of crackSegments) {
          cracks.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: 0x05070c, width: 4.4, alpha: 0.86 });
          cracks.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: 0xff8f3a, width: 1.35, alpha: 0.78 });
        }
        cracks.alpha = 0.12;
        cracks.blendMode = "add";
        const fracturePlates: Container[] = [];
        const fractureAngles = [-0.22, 0.68, -1.08];
        fractureAngles.forEach((angle, index) => {
          const plate = new PIXI.Container();
          const crust = new PIXI.Graphics();
          const plateSize = radius * (0.13 + index * 0.018);
          crust.poly([-plateSize, -plateSize * 0.5, plateSize * 0.7, -plateSize * 0.72, plateSize, plateSize * 0.42, -plateSize * 0.55, plateSize * 0.76])
            .fill({ color: palette.dark, alpha: 0.96 })
            .stroke({ color: palette.rim, width: 1, alpha: 0.38 });
          const seam = new PIXI.Graphics();
          seam.moveTo(-plateSize * 0.7, plateSize * 0.45).lineTo(plateSize * 0.72, plateSize * 0.23)
            .stroke({ color: index === 1 ? palette.ore : 0xff8f4f, width: 1.7, alpha: 0.72 });
          seam.blendMode = "add";
          plate.addChild(crust, seam);
          plate.position.set(Math.cos(angle) * radius * 0.72, Math.sin(angle) * radius * 0.72);
          plate.rotation = angle;
          plate.visible = false;
          fracturePlates.push(plate);
        });
        const damageLayer = new PIXI.Graphics();
        damageLayer.poly([
          radius * 0.72, -radius * 0.12,
          radius * 0.98, -radius * 0.34,
          radius * 0.86, radius * 0.08,
          radius * 0.58, radius * 0.22,
        ]).fill({ color: 0x03050a, alpha: 0.9 });
        damageLayer.circle(radius * 0.42, radius * 0.18, radius * 0.17)
          .fill({ color: 0x080a0f, alpha: 0.86 })
          .stroke({ color: 0xff7845, width: 2, alpha: 0.42 });
        damageLayer.moveTo(radius * 0.36, radius * 0.03).lineTo(radius * 0.13, -radius * 0.14)
          .stroke({ color: 0xffa05f, width: 2.2, alpha: 0.68 });
        damageLayer.alpha = 0;
        const miningPulse = new PIXI.Graphics();
        miningPulse.circle(0, 0, radius * 1.04)
          .stroke({ color: 0xffb064, width: 2.2, alpha: 0.5 });
        for (let index = 0; index < 4; index += 1) {
          const angle = index * Math.PI * 0.5 + 0.18;
          const inner = radius * 0.9;
          const outer = radius * 1.14;
          miningPulse.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
            .stroke({ color: 0xffe0b0, width: 1.2, alpha: 0.62 });
        }
        miningPulse.blendMode = "add";
        miningPulse.alpha = 0;
        container.addChild(halo, shadow, body, facets, strata, craterLayer, rim, oreGlow, microDetail, cracks, ...fracturePlates, damageLayer, miningPulse);
        return { container, cracks, damageLayer, oreGlow, miningPulse, fracturePlates };
      };

      const makeCrystalView = () => {
        const container = new PIXI.Container();
        const trail = new PIXI.Graphics();
        trail.poly([-8, -5, -34, 0, -8, 5]).fill({ color: 0x6beaff, alpha: 0.08 });
        trail.moveTo(-7, 0).lineTo(-28, 0).stroke({ color: 0xd9ffff, width: 1, alpha: 0.26 });
        trail.blendMode = "add";
        const halo = new PIXI.Graphics();
        halo.circle(0, 0, 29).fill({ color: 0x5df4ff, alpha: 0.1 });
        halo.circle(0, 0, 21).stroke({ color: 0x9b72ff, width: 1.2, alpha: 0.22 });
        halo.arc(0, 0, 26, -0.7, 0.62).stroke({ color: 0xe9ffff, width: 0.8, alpha: 0.34 });
        halo.circle(25, -7, 1.7).fill({ color: 0xffffff, alpha: 0.72 });
        halo.circle(-21, 12, 1.2).fill({ color: 0xc6a7ff, alpha: 0.65 });
        halo.blendMode = "add";
        const shard = new PIXI.Graphics();
        shard.poly([0, -18, 10, -4, 6, 15, -6, 15, -10, -4])
          .fill({ color: 0xbafaff, alpha: 0.96 })
          .stroke({ color: 0x57dfff, width: 1.7 });
        shard.poly([0, -15, 5, -3, 1, 12, -4, -2]).fill({ color: 0x8c6cff, alpha: 0.78 });
        shard.poly([-2, -12, 3, -6, 0, 4]).fill({ color: 0xffffff, alpha: 0.72 });
        shard.moveTo(0, -16).lineTo(0, 14).stroke({ color: 0xffffff, width: 0.65, alpha: 0.38 });
        shard.moveTo(-8, -4).lineTo(8, -4).stroke({ color: 0x5ce7ff, width: 0.65, alpha: 0.42 });
        const splinters = new PIXI.Graphics();
        splinters.poly([-12, -5, -6, -10, -4, 1]).fill({ color: 0x7fefff, alpha: 0.78 });
        splinters.poly([11, 2, 15, -4, 14, 7]).fill({ color: 0xb59cff, alpha: 0.8 });
        splinters.poly([-9, 9, -5, 5, -4, 13]).fill({ color: 0xd9ffff, alpha: 0.7 });
        const glint = new PIXI.Graphics();
        glint.moveTo(-22, 0).lineTo(22, 0).stroke({ color: 0xdfffff, width: 0.8, alpha: 0.32 });
        glint.moveTo(0, -22).lineTo(0, 22).stroke({ color: 0xdfffff, width: 0.8, alpha: 0.25 });
        glint.blendMode = "add";
        container.addChild(trail, halo, splinters, shard, glint);
        return { container, halo, glint, trail };
      };

      const makeFabricatorView = () => {
        const container = new PIXI.Container();
        const hull = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.ellipse(0, 0, 38, 30).fill({ color: 0xff873c, alpha: 0.075 });
        glow.blendMode = "add";
        const engineFlare = new PIXI.Graphics();
        engineFlare.poly([-18, -8, -38, -12, -20, -3]).fill({ color: 0xff7b3e, alpha: 0.74 });
        engineFlare.poly([-18, 8, -38, 12, -20, 3]).fill({ color: 0xffb15c, alpha: 0.74 });
        engineFlare.blendMode = "add";
        const hullShadow = new PIXI.Graphics();
        hullShadow.poly([24, 0, 12, -17, -12, -20, -25, -10, -19, 0, -25, 10, -12, 20, 12, 17])
          .fill({ color: 0x070605, alpha: 0.95 })
          .stroke({ color: 0x050403, width: 5, alpha: 0.92 });
        const ship = new PIXI.Graphics();
        ship.poly([24, 0, 12, -17, -12, -20, -25, -10, -19, 0, -25, 10, -12, 20, 12, 17])
          .fill({ color: 0x51221d })
          .stroke({ color: 0xffa45c, width: 2.2, alpha: 0.94 });
        ship.poly([16, 0, 6, -11, -12, -12, -5, 0]).fill({ color: 0x8f3d27, alpha: 0.9 });
        ship.poly([16, 0, 6, 11, -12, 12, -5, 0]).fill({ color: 0x5e271f, alpha: 0.96 });
        ship.poly([11, 0, -2, -6, -10, 0, -2, 6]).fill({ color: 0xffcf85, alpha: 0.9 });
        ship.circle(-17, -9, 3).fill({ color: 0xff6336 }).stroke({ color: 0xffc36e, width: 0.8 });
        ship.circle(-17, 9, 3).fill({ color: 0xff6336 }).stroke({ color: 0xffc36e, width: 0.8 });
        ship.moveTo(-8, -14).lineTo(7, -12).stroke({ color: 0xffcc8a, width: 1, alpha: 0.35 });
        const microDetail = new PIXI.Graphics();
        microDetail.moveTo(-13, -4).lineTo(8, -7).lineTo(17, -2)
          .stroke({ color: 0xffdfb5, width: 0.52, alpha: 0.42 });
        microDetail.moveTo(-13, 4).lineTo(8, 7).lineTo(17, 2)
          .stroke({ color: 0xffb879, width: 0.52, alpha: 0.36 });
        microDetail.circle(4, -12, 0.9).fill({ color: 0xfff0d2, alpha: 0.5 });
        microDetail.circle(4, 12, 0.9).fill({ color: 0xfff0d2, alpha: 0.5 });
        microDetail.visible = microDetailEnabled;
        microDetailViews.push(microDetail);
        const claws = new PIXI.Container();
        const upperClaw = new PIXI.Graphics();
        upperClaw.moveTo(1, -13).lineTo(15, -27).lineTo(27, -24).stroke({ color: 0xffa45c, width: 3, alpha: 0.86 });
        upperClaw.poly([27, -24, 34, -18, 23, -17]).fill({ color: 0xffc176, alpha: 0.9 });
        upperClaw.circle(14, -26, 3).fill({ color: 0x35140f }).stroke({ color: 0xffb867, width: 1 });
        const lowerClaw = new PIXI.Graphics();
        lowerClaw.moveTo(1, 13).lineTo(15, 27).lineTo(27, 24).stroke({ color: 0xffa45c, width: 3, alpha: 0.86 });
        lowerClaw.poly([27, 24, 34, 18, 23, 17]).fill({ color: 0xffc176, alpha: 0.9 });
        lowerClaw.circle(14, 26, 3).fill({ color: 0x35140f }).stroke({ color: 0xffb867, width: 1 });
        claws.addChild(upperClaw, lowerClaw);
        const cargoGlow = new PIXI.Graphics();
        cargoGlow.circle(-7, 0, 15).fill({ color: 0x66edff, alpha: 0.11 });
        cargoGlow.poly([-7, -10, 0, 0, -7, 10, -14, 0]).fill({ color: 0xccfbff, alpha: 0.8 });
        cargoGlow.circle(-7, 0, 17).stroke({ color: 0x9b70ff, width: 1.5, alpha: 0.58 });
        cargoGlow.blendMode = "add";
        cargoGlow.visible = false;
        const scanner = new PIXI.Graphics();
        scanner.arc(27, 0, 18, -0.72, 0.72).stroke({ color: 0xffc37b, width: 1.2, alpha: 0.42 });
        scanner.arc(27, 0, 25, -0.48, 0.48).stroke({ color: 0xff8550, width: 0.9, alpha: 0.25 });
        scanner.moveTo(28, 0).lineTo(48, 0).stroke({ color: 0xfff0cc, width: 0.8, alpha: 0.46 });
        scanner.blendMode = "add";
        const beam = new PIXI.Graphics();
        hull.addChild(hullShadow, ship, microDetail, cargoGlow, claws);
        container.addChild(glow, engineFlare, scanner, beam, hull);
        return {
          container, beam, hull, claws, cargoGlow, engineFlare,
          upperClaw, lowerClaw, scanner,
        };
      };

      const makeSentinelView = (variant = 0) => {
        const container = new PIXI.Container();
        const hull = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.ellipse(-2, 0, 39, 34).fill({ color: 0xa24fff, alpha: 0.085 });
        glow.blendMode = "add";
        const engineFlare = new PIXI.Graphics();
        engineFlare.poly([-20, -7, -42, 0, -20, 7]).fill({ color: 0x9258ff, alpha: 0.7 });
        engineFlare.poly([-22, -3, -50, 0, -22, 3]).fill({ color: 0xff7b98, alpha: 0.48 });
        engineFlare.blendMode = "add";
        const hullShadow = new PIXI.Graphics();
        const silhouettes = [
          [30, 0, 15, -10, 2, -28, -9, -33, -6, -15, -26, -10, -18, 0, -26, 10, -6, 15, -9, 33, 2, 28, 15, 10],
          [31, 0, 14, -9, 7, -25, -5, -34, -11, -18, -29, -14, -18, 0, -29, 14, -11, 18, -5, 34, 7, 25, 14, 9],
          [29, 0, 13, -12, -1, -24, -14, -29, -8, -13, -30, -7, -19, 0, -30, 7, -8, 13, -14, 29, -1, 24, 13, 12],
        ];
        const silhouette = silhouettes[Math.abs(variant) % silhouettes.length];
        hullShadow.poly(silhouette)
          .fill({ color: 0x05040d, alpha: 0.96 })
          .stroke({ color: 0x020207, width: 5.5, alpha: 0.92 });
        const ship = new PIXI.Graphics();
        ship.poly(silhouette)
          .fill({ color: 0x28204d })
          .stroke({ color: 0xc083ff, width: 2.4, alpha: 0.94 });
        ship.poly([18, -4, 3, -23, -7, -27, -2, -10]).fill({ color: 0x56358a, alpha: 0.92 });
        ship.poly([18, 4, 3, 23, -7, 27, -2, 10]).fill({ color: 0x3b286c, alpha: 0.96 });
        ship.poly([-3, -11, -19, -7, -12, 0, -19, 7, -3, 11, 6, 0])
          .fill({ color: 0x130f28, alpha: 0.92 });
        ship.moveTo(-1, -11).lineTo(12, -7).stroke({ color: 0xeeadff, width: 1.1, alpha: 0.42 });
        ship.moveTo(-1, 11).lineTo(12, 7).stroke({ color: 0x7f5ac0, width: 1.1, alpha: 0.42 });
        if (variant % 3 === 1) {
          ship.poly([-5, -22, -14, -31, -7, -11]).fill({ color: 0x7e4fb1, alpha: 0.62 });
          ship.poly([-5, 22, -14, 31, -7, 11]).fill({ color: 0x492b77, alpha: 0.72 });
        } else if (variant % 3 === 2) {
          ship.moveTo(-20, -7).lineTo(-2, -3).stroke({ color: 0xff88ad, width: 1.4, alpha: 0.46 });
          ship.moveTo(-20, 7).lineTo(-2, 3).stroke({ color: 0xa77dff, width: 1.4, alpha: 0.46 });
        }
        const microDetail = new PIXI.Graphics();
        microDetail.moveTo(12, -5).lineTo(2, -11).lineTo(-8, -10)
          .stroke({ color: 0xe7cdff, width: 0.52, alpha: 0.44 });
        microDetail.moveTo(12, 5).lineTo(2, 11).lineTo(-8, 10)
          .stroke({ color: 0x9d82c7, width: 0.52, alpha: 0.4 });
        microDetail.circle(-13, -6, 0.9).fill({ color: 0xffbdd0, alpha: 0.52 });
        microDetail.circle(-13, 6, 0.9).fill({ color: 0xbc9cff, alpha: 0.52 });
        microDetail.visible = microDetailEnabled;
        microDetailViews.push(microDetail);
        const weaponCore = new PIXI.Graphics();
        weaponCore.poly([20, 0, 3, -7, -3, 0, 3, 7])
          .fill({ color: 0xff7695, alpha: 0.92 })
          .stroke({ color: 0xffd5de, width: 1.4, alpha: 0.88 });
        weaponCore.circle(8, 0, 3).fill({ color: 0xffffff, alpha: 0.82 });
        weaponCore.blendMode = "add";
        const shield = new PIXI.Graphics();
        shield.arc(0, 0, 37, -1.15, 0.98).stroke({ color: 0xa979ff, width: 2, alpha: 0.48 });
        shield.arc(0, 0, 40, 2.05, 4.03).stroke({ color: 0xff6f9f, width: 1.1, alpha: 0.28 });
        shield.blendMode = "add";
        const damageLayer = new PIXI.Graphics();
        damageLayer.poly([-10, -31, 4, -23, -3, -10, -15, -14]).fill({ color: 0x05040a, alpha: 0.9 });
        damageLayer.moveTo(-18, -7).lineTo(-7, -2).lineTo(-15, 6).stroke({ color: 0xff965b, width: 2.4, alpha: 0.9 });
        damageLayer.moveTo(-4, -17).lineTo(3, -7).lineTo(13, -13).stroke({ color: 0x08070f, width: 4.2, alpha: 0.9 });
        damageLayer.circle(-12, 9, 5.5).fill({ color: 0x05040a, alpha: 0.82 });
        damageLayer.visible = false;
        const chargeMarks = new PIXI.Container();
        for (let index = 0; index < 3; index += 1) {
          const mark = new PIXI.Graphics();
          const x = 31 + index * 7;
          mark.poly([x, 0, x - 7, -5, x - 4, 0, x - 7, 5])
            .stroke({ color: index === 2 ? 0xffffff : 0xff8aae, width: 1.25, alpha: 0.72 });
          chargeMarks.addChild(mark);
        }
        chargeMarks.blendMode = "add";
        chargeMarks.alpha = 0;
        hull.addChild(hullShadow, ship, microDetail, weaponCore, shield, damageLayer, chargeMarks);
        container.addChild(glow, engineFlare, hull);
        return { container, hull, damageLayer, shield, weaponCore, engineFlare, chargeMarks };
      };

      const engineSlotTransform = (index: number) => {
        const sectorCount = Math.ceil(RULES.enginePieces / 3);
        const sector = Math.floor(index / 3);
        const slot = index % 3;
        const base = (sector / sectorCount) * Math.PI * 2 + 0.17;
        const angleOffsets = [-0.155, 0.018, 0.172];
        const radii = [145, 97, 121];
        const asymmetry = sector === 2 && slot === 0 ? 11 : sector === 5 && slot === 2 ? -7 : 0;
        return { angle: base + angleOffsets[slot], radius: radii[slot] + asymmetry };
      };

      const makeEngineView = () => {
        const root = new PIXI.Container();
        const forgeAura = new PIXI.Graphics();
        forgeAura.circle(0, 0, 286).fill({ color: 0x8b4cff, alpha: 0.014 });
        forgeAura.circle(0, 0, 248).stroke({ color: 0xff754d, width: 2.2, alpha: 0.08 });
        forgeAura.circle(0, 0, 224).stroke({ color: 0xa36dff, width: 1.2, alpha: 0.08 });
        forgeAura.blendMode = "add";
        const threatHalo = new PIXI.Graphics();
        for (let index = 0; index < 12; index += 1) {
          const start = (index / 12) * Math.PI * 2 + 0.07;
          threatHalo.arc(0, 0, index % 3 === 0 ? 214 : 204, start, start + (index % 2 ? 0.18 : 0.28))
            .stroke({ color: index % 3 === 0 ? 0xff7652 : 0xaa74ff, width: index % 3 === 0 ? 3 : 1.5, alpha: 0.24 });
          if (index % 3 === 0) {
            threatHalo.moveTo(Math.cos(start) * 198, Math.sin(start) * 198)
              .lineTo(Math.cos(start) * 228, Math.sin(start) * 228)
              .stroke({ color: 0xffb277, width: 1.3, alpha: 0.3 });
          }
        }
        threatHalo.blendMode = "add";
        const targetingBeam = new PIXI.Graphics();
        targetingBeam.blendMode = "add";
        const ambient = new PIXI.Graphics();
        ambient.circle(0, 0, 228).fill({ color: 0x8f35ff, alpha: 0.04 });
        ambient.circle(0, 0, 178).fill({ color: 0xff5b48, alpha: 0.025 });
        ambient.circle(0, 0, 206).stroke({ color: 0x9b62ff, width: 2, alpha: 0.09 });
        ambient.blendMode = "add";
        const chassis = new PIXI.Graphics();
        for (let index = 0; index < 6; index += 1) {
          const angle = (index / 6) * Math.PI * 2 + 0.17;
          const sx = Math.cos(angle) * 48;
          const sy = Math.sin(angle) * 48;
          const ex = Math.cos(angle) * (index % 2 ? 152 : 166);
          const ey = Math.sin(angle) * (index % 2 ? 152 : 166);
          chassis.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: 0x050611, width: 15, alpha: 0.94 });
          chassis.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: index % 2 ? 0x563064 : 0x3a2a62, width: 7, alpha: 0.9 });
          chassis.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: index % 2 ? 0xff7654 : 0xb088ff, width: 1.4, alpha: 0.42 });
        }
        chassis.poly([0, -65, 56, -33, 56, 33, 0, 65, -56, 33, -56, -33])
          .fill({ color: 0x070914, alpha: 0.96 })
          .stroke({ color: 0x5f477c, width: 3, alpha: 0.72 });
        const conduitPulse = new PIXI.Graphics();
        for (let index = 0; index < 6; index += 1) {
          const angle = (index / 6) * Math.PI * 2 + 0.17;
          conduitPulse.moveTo(Math.cos(angle) * 57, Math.sin(angle) * 57)
            .lineTo(Math.cos(angle) * (index % 2 ? 132 : 146), Math.sin(angle) * (index % 2 ? 132 : 146))
            .stroke({ color: index % 2 ? 0xff8258 : 0xb789ff, width: 2.2, alpha: 0.54 });
          conduitPulse.circle(Math.cos(angle) * 88, Math.sin(angle) * 88, 3.2)
            .fill({ color: index % 2 ? 0xffc096 : 0xe1caff, alpha: 0.7 });
        }
        conduitPulse.blendMode = "add";

        const weaponArms: Container[] = [];
        for (let index = 0; index < 3; index += 1) {
          const arm = new PIXI.Container();
          const spar = new PIXI.Graphics();
          spar.moveTo(46, 0).lineTo(93, 0).stroke({ color: 0x050611, width: 14, alpha: 0.94 });
          spar.moveTo(46, 0).lineTo(93, 0).stroke({ color: index === 1 ? 0x6b3343 : 0x3c3265, width: 6.5, alpha: 0.94 });
          spar.moveTo(49, 0).lineTo(91, 0).stroke({ color: index === 1 ? 0xff8159 : 0xad82ff, width: 1.4, alpha: 0.66 });
          spar.circle(49, 0, 7).fill({ color: 0x0b0a16, alpha: 0.96 }).stroke({ color: 0x8b6eb7, width: 1.4, alpha: 0.7 });
          const turret = new PIXI.Graphics();
          turret.poly([109, 0, 92, -12, 80, -7, 80, 7, 92, 12])
            .fill({ color: index === 1 ? 0x4f2833 : 0x292548, alpha: 0.96 })
            .stroke({ color: index === 1 ? 0xff966e : 0xc09aff, width: 1.8, alpha: 0.84 });
          turret.circle(98, 0, 4).fill({ color: 0xffe1cd, alpha: 0.88 });
          const sight = new PIXI.Graphics();
          sight.moveTo(108, 0).lineTo(128, 0).stroke({ color: 0xff8662, width: 1.2, alpha: 0.42 });
          sight.blendMode = "add";
          arm.addChild(spar, turret, sight);
          arm.rotation = (index / 3) * Math.PI * 2 + 0.42;
          weaponArms.push(arm);
        }

        const driveVents: Graphics[] = [];
        for (let index = 0; index < 6; index += 1) {
          const angle = (index / 6) * Math.PI * 2 + 0.17;
          const vent = new PIXI.Graphics();
          const inner = 68;
          const outer = 96;
          vent.poly([
            Math.cos(angle) * inner - Math.sin(angle) * 7, Math.sin(angle) * inner + Math.cos(angle) * 7,
            Math.cos(angle) * outer, Math.sin(angle) * outer,
            Math.cos(angle) * inner + Math.sin(angle) * 7, Math.sin(angle) * inner - Math.cos(angle) * 7,
          ]).fill({ color: index % 2 ? 0xff8556 : 0xa86eff, alpha: 0.52 });
          vent.blendMode = "add";
          driveVents.push(vent);
        }

        const sensorArray = new PIXI.Container();
        for (let index = 0; index < 5; index += 1) {
          const angle = (index / 5) * Math.PI * 2 - 0.28;
          const sensor = new PIXI.Graphics();
          sensor.circle(Math.cos(angle) * 75, Math.sin(angle) * 75, 6.5)
            .fill({ color: 0x0a0912, alpha: 0.96 })
            .stroke({ color: index % 2 ? 0xff865f : 0xb489ff, width: 1.3, alpha: 0.76 });
          sensor.circle(Math.cos(angle) * 75, Math.sin(angle) * 75, 2.1)
            .fill({ color: 0xffe4d3, alpha: 0.86 });
          sensorArray.addChild(sensor);
        }
        sensorArray.blendMode = "add";

        const microDetail = new PIXI.Graphics();
        for (let index = 0; index < 24; index += 1) {
          const angle = (index / 24) * Math.PI * 2 + 0.05;
          const inner = 104 + (index % 3) * 8;
          microDetail.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(angle) * (inner + 7), Math.sin(angle) * (inner + 7))
            .stroke({ color: index % 2 ? 0xe3d3ff : 0xffd4be, width: 0.52, alpha: 0.4 });
          if (index % 4 === 0) microDetail.circle(Math.cos(angle) * 118, Math.sin(angle) * 118, 1)
            .fill({ color: 0xffffff, alpha: 0.45 });
        }
        microDetail.visible = microDetailEnabled;
        microDetailViews.push(microDetail);
        const energyCage = new PIXI.Container();
        for (let layer = 0; layer < 3; layer += 1) {
          const cage = new PIXI.Graphics();
          const radius = 158 + layer * 13;
          for (let segment = 0; segment < 5; segment += 1) {
            const start = segment * 1.24 + layer * 0.31;
            cage.arc(0, 0, radius, start, start + 0.62 + (segment % 2) * 0.12)
              .stroke({ color: layer === 1 ? 0xff714c : 0x9f69ff, width: layer === 0 ? 2.4 : 1.35, alpha: 0.22 + layer * 0.05 });
          }
          cage.blendMode = "add";
          energyCage.addChild(cage);
        }
        const outerRing = new PIXI.Container();
        const innerRing = new PIXI.Container();
        const parts: Container[] = [];
        const ringBack = new PIXI.Graphics();
        for (let segment = 0; segment < 7; segment += 1) {
          const start = segment * 0.88 + 0.12;
          ringBack.arc(0, 0, 136, start, start + 0.54).stroke({ color: 0x8f5cff, width: 3.8, alpha: 0.26 });
          ringBack.arc(0, 0, 88, start + 0.24, start + 0.65).stroke({ color: 0xff7248, width: 2.2, alpha: 0.28 });
        }
        ringBack.circle(0, 0, 117).stroke({ color: 0x090b18, width: 10, alpha: 0.64 });
        root.addChild(forgeAura, threatHalo, ambient, targetingBeam, chassis, conduitPulse);
        for (const vent of driveVents) root.addChild(vent);
        for (const arm of weaponArms) root.addChild(arm);
        root.addChild(energyCage, ringBack, outerRing, innerRing, sensorArray, microDetail);

        for (let index = 0; index < RULES.enginePieces; index += 1) {
          const transform = engineSlotTransform(index);
          const angle = transform.angle;
          const moduleType = index % 3;
          const distanceFromCore = transform.radius;
          const piece = new PIXI.Container();
          const glow = new PIXI.Graphics();
          glow.ellipse(0, 0, moduleType === 0 ? 34 : 27, moduleType === 1 ? 30 : 22)
            .fill({ color: moduleType === 1 ? 0xff6f3f : 0x9755ff, alpha: 0.105 });
          glow.scale.set(1.55);
          glow.blendMode = "add";
          const extrusion = new PIXI.Graphics();
          const plate = new PIXI.Graphics();
          if (moduleType === 0) {
            const shape = [31, 0, 13, -22, -17, -20, -29, -7, -17, 0, -29, 7, -17, 20, 13, 22];
            extrusion.poly(shape).fill({ color: 0x05060d, alpha: 0.94 }).stroke({ color: 0x05060d, width: 6 });
            plate.poly(shape).fill({ color: 0x30264d }).stroke({ color: 0xb28dff, width: 2.2, alpha: 0.88 });
            plate.poly([21, 0, 7, -14, -14, -13, -7, 0]).fill({ color: 0x554074, alpha: 0.84 });
            plate.circle(-12, -9, 2.6).fill({ color: 0xff8658, alpha: 0.78 });
            plate.circle(-12, 9, 2.6).fill({ color: 0xff8658, alpha: 0.78 });
          } else if (moduleType === 1) {
            const shape = [22, 0, 7, -27, -9, -19, -20, 0, -9, 19, 7, 27];
            extrusion.poly(shape).fill({ color: 0x05060d, alpha: 0.94 }).stroke({ color: 0x05060d, width: 5 });
            plate.poly(shape).fill({ color: 0x51262c }).stroke({ color: 0xff8a55, width: 2.1, alpha: 0.9 });
            plate.poly([13, 0, 2, -18, -6, 0, 2, 18]).fill({ color: 0x8c4137, alpha: 0.78 });
            plate.moveTo(-9, 0).lineTo(14, 0).stroke({ color: 0xffd0aa, width: 1.5, alpha: 0.62 });
          } else {
            const shape = [27, 0, 11, -14, -15, -14, -25, 0, -15, 14, 11, 14];
            extrusion.poly(shape).fill({ color: 0x05060d, alpha: 0.94 }).stroke({ color: 0x05060d, width: 5 });
            plate.poly(shape).fill({ color: 0x25284b }).stroke({ color: 0x947dff, width: 2, alpha: 0.86 });
            plate.circle(-7, 0, 8).fill({ color: 0x120f27, alpha: 0.9 }).stroke({ color: 0xff7a52, width: 1.5, alpha: 0.7 });
            plate.circle(-7, 0, 3).fill({ color: 0xffd5b3, alpha: 0.82 });
          }
          piece.addChild(glow, extrusion, plate);
          piece.position.set(Math.cos(angle) * distanceFromCore, Math.sin(angle) * distanceFromCore);
          piece.rotation = angle;
          piece.alpha = 0.055;
          piece.scale.set(0.54);
          (moduleType === 0 ? outerRing : innerRing).addChild(piece);
          parts.push(piece);
        }

        const scorchNodes: Graphics[] = [];
        for (let index = 0; index < RULES.engineHits; index += 1) {
          const partIndex = (index * 3 + 2) % RULES.enginePieces;
          const transform = engineSlotTransform(partIndex);
          const scorch = new PIXI.Graphics();
          scorch.circle(0, 0, 12 + (index % 3) * 2.5).fill({ color: 0x03040a, alpha: 0.72 });
          scorch.arc(0, 0, 15 + (index % 2) * 3, -0.8, 1.12)
            .stroke({ color: index % 2 ? 0xff7d50 : 0xc36dff, width: 2.1, alpha: 0.7 });
          scorch.moveTo(-8, 4).lineTo(2, -3).lineTo(11, 5)
            .stroke({ color: 0xffbd8f, width: 1.2, alpha: 0.66 });
          scorch.position.set(Math.cos(transform.angle) * transform.radius, Math.sin(transform.angle) * transform.radius);
          scorch.rotation = transform.angle;
          scorch.visible = false;
          scorchNodes.push(scorch);
          root.addChild(scorch);
        }

        const damageLayers: Graphics[] = [];
        const fracturedRing = new PIXI.Graphics();
        fracturedRing.arc(0, 0, 142, -0.22, 0.68).stroke({ color: 0x05060d, width: 16, alpha: 0.94 });
        fracturedRing.arc(0, 0, 139, 2.46, 3.12).stroke({ color: 0xff754c, width: 3, alpha: 0.72 });
        fracturedRing.moveTo(126, -39).lineTo(101, -18).lineTo(112, 7).stroke({ color: 0xffa16c, width: 2.8, alpha: 0.8 });
        fracturedRing.visible = false;
        damageLayers.push(fracturedRing);

        const severedConduits = new PIXI.Graphics();
        severedConduits.arc(0, 0, 91, 0.62, 1.72).stroke({ color: 0x05060d, width: 12, alpha: 0.92 });
        severedConduits.moveTo(-26, 81).lineTo(-8, 53).lineTo(12, 73).stroke({ color: 0xc05dff, width: 3, alpha: 0.8 });
        severedConduits.circle(-22, 77, 8).fill({ color: 0xff7a4d, alpha: 0.38 });
        severedConduits.visible = false;
        damageLayers.push(severedConduits);

        const coreFractures = new PIXI.Graphics();
        coreFractures.moveTo(-4, -49).lineTo(7, -24).lineTo(-3, -7).lineTo(14, 8).stroke({ color: 0x080912, width: 7, alpha: 0.84 });
        coreFractures.moveTo(6, -25).lineTo(17, -35).stroke({ color: 0xffa068, width: 2, alpha: 0.82 });
        coreFractures.moveTo(-3, -8).lineTo(-19, 3).stroke({ color: 0xc278ff, width: 2, alpha: 0.8 });
        coreFractures.visible = false;
        damageLayers.push(coreFractures);
        root.addChild(...damageLayers);

        const coreHalo = new PIXI.Graphics();
        coreHalo.circle(0, 0, 88).fill({ color: 0x9c54ff, alpha: 0.07 });
        coreHalo.circle(0, 0, 66).fill({ color: 0xff6e49, alpha: 0.045 });
        coreHalo.circle(0, 0, 76).stroke({ color: 0xbd8cff, width: 2.4, alpha: 0.28 });
        coreHalo.blendMode = "add";
        const core = new PIXI.Graphics();
        core.circle(0, 0, 64).fill({ color: 0x060812, alpha: 0.98 }).stroke({ color: 0x8464b8, width: 4, alpha: 0.78 });
        core.poly([0, -56, 47, -28, 47, 28, 0, 56, -47, 28, -47, -28])
          .fill({ color: 0x18152b, alpha: 0.96 })
          .stroke({ color: 0xff8452, width: 2.5, alpha: 0.68 });
        core.poly([0, -45, 38, -23, 38, 23, 0, 45, -38, 23, -38, -23])
          .fill({ color: 0x251b3e, alpha: 0.84 })
          .stroke({ color: 0x9f73ff, width: 2, alpha: 0.6 });
        const aperture = new PIXI.Container();
        const apertureBlades: Graphics[] = [];
        for (let index = 0; index < 3; index += 1) {
          const blade = new PIXI.Graphics();
          blade.poly([4, -7, 34, -24, 29, -6, 13, 7])
            .fill({ color: index % 2 ? 0x5b2d39 : 0x302958, alpha: 0.94 })
            .stroke({ color: index % 2 ? 0xff8656 : 0xb68cff, width: 1.7, alpha: 0.84 });
          blade.rotation = (index / 3) * Math.PI * 2;
          aperture.addChild(blade);
          apertureBlades.push(blade);
        }
        const reactor = new PIXI.Graphics();
        reactor.circle(0, 0, 23).fill({ color: 0x170d2b, alpha: 0.96 }).stroke({ color: 0xff8556, width: 2.2, alpha: 0.8 });
        reactor.circle(0, 0, 14).fill({ color: 0xa56cff, alpha: 0.42 });
        reactor.circle(0, 0, 7).fill({ color: 0xfff2e8, alpha: 0.92 });
        reactor.blendMode = "add";
        aperture.addChild(reactor);
        root.addChild(coreHalo, core, aperture);
        return {
          root, parts, outerRing, innerRing, core, damageLayers, energyCage,
          aperture, coreHalo, threatHalo, targetingBeam, forgeAura, apertureBlades,
          weaponArms, driveVents, conduitPulse, sensorArray, scorchNodes,
        };
      };

      const createPlayer = (): Player => {
        const {
          container, flare, motionStreaks, hull, portJet, starboardJet,
          shield, muzzleFlash, armorSheen, navLights, wingConduits, afterburnerRing,
        } = makePlayerView();
        container.position.set(4200, 3050);
        playerLayer.addChild(container);
        return {
          id: nextId(), x: 4200, y: 3050, vx: 0, vy: 0, radius: 24,
          angle: 0, invulnerable: 3.5, view: container, engineFlare: flare, motionStreaks,
          hull, portJet, starboardJet, shield, muzzleFlash, armorSheen, navLights,
          wingConduits, afterburnerRing, recoil: 0,
        };
      };

      const createEngine = (): DreadEngine => {
        const graphics = makeEngineView();
        graphics.root.position.set(5650, 3100);
        enemyLayer.addChild(graphics.root);
        return {
          id: nextId(), x: 5650, y: 3100, vx: 0, vy: 0, radius: 166,
          view: graphics.root, parts: graphics.parts, innerRing: graphics.innerRing,
          outerRing: graphics.outerRing, core: graphics.core, active: false,
          health: RULES.engineHits, destroyed: false, damageLayers: graphics.damageLayers,
          energyCage: graphics.energyCage, aperture: graphics.aperture, coreHalo: graphics.coreHalo,
          threatHalo: graphics.threatHalo, targetingBeam: graphics.targetingBeam,
          forgeAura: graphics.forgeAura, apertureBlades: graphics.apertureBlades,
          weaponArms: graphics.weaponArms, driveVents: graphics.driveVents,
          conduitPulse: graphics.conduitPulse, sensorArray: graphics.sensorArray,
          scorchNodes: graphics.scorchNodes, deathPose: 0,
        };
      };

      const spawnPlanetoid = (x: number, y: number, radius = 62 + rng() * 54) => {
        const { container, cracks, damageLayer, oreGlow, miningPulse, fracturePlates } = makePlanetoidView(radius, Math.floor(rng() * 0x7fffffff));
        container.position.set(x, y);
        terrainLayer.addChild(container);
        const planetoid: Planetoid = {
          id: nextId(), x, y, vx: (rng() - 0.5) * 9, vy: (rng() - 0.5) * 9,
          radius, view: container, integrity: 8, maxIntegrity: 8,
          shards: 3 + Math.floor(rng() * 4), miningProgress: 0, lastHitAt: -1000,
          cracks, damageLayer, oreGlow, miningPulse, miningHeat: 0,
          spin: (rng() < 0.5 ? -1 : 1) * (0.012 + rng() * 0.036),
          fracturePlates, damageStage: 0,
        };
        planetoids.push(planetoid);
        return planetoid;
      };

      const spawnCrystal = (x: number, y: number, angle = rng() * Math.PI * 2) => {
        const { container: view, halo, glint, trail } = makeCrystalView();
        view.position.set(x, y);
        pickupLayer.addChild(view);
        const crystal: Crystal = {
          id: nextId(), x, y, vx: Math.cos(angle) * (45 + rng() * 65),
          vy: Math.sin(angle) * (45 + rng() * 65), radius: 13, view, age: 0,
          halo, glint, trail, phase: rng() * Math.PI * 2,
        };
        crystals.push(crystal);
        return crystal;
      };

      const spawnFabricator = (x: number, y: number) => {
        const {
          container, beam, hull, claws, cargoGlow, engineFlare,
          upperClaw, lowerClaw, scanner,
        } = makeFabricatorView();
        container.position.set(x, y);
        enemyLayer.addChild(container);
        fabricators.push({
          id: nextId(), x, y, vx: 0, vy: 0, radius: 25, view: container,
          carrying: false, miningTimer: 1.4 + rng() * 1.8, beam, hull, claws,
          cargoGlow, engineFlare, phase: rng() * Math.PI * 2,
          upperClaw, lowerClaw, scanner,
        });
      };

      const spawnSentinel = (x: number, y: number) => {
        const {
          container: view, hull, damageLayer, shield, weaponCore, engineFlare, chargeMarks,
        } = makeSentinelView(Math.floor(rng() * 3));
        view.position.set(x, y);
        enemyLayer.addChild(view);
        sentinels.push({
          id: nextId(), x, y, vx: 0, vy: 0, radius: 27, view,
          fireTimer: 0.5 + rng() * 1.5, orbit: rng() < 0.5 ? -1 : 1, health: 2,
          hull, damageLayer, shield, weaponCore, engineFlare, phase: rng() * Math.PI * 2,
          chargeMarks, shotPulse: 0,
        });
      };

      const spawnLandmark = (x: number, y: number, kind: "rig" | "relay" | "wreck", phase: number) => {
        const view = new PIXI.Container();
        const shadow = new PIXI.Graphics();
        const structure = new PIXI.Graphics();
        const movingPart = new PIXI.Container();
        const beacon = new PIXI.Graphics();
        if (kind === "rig") {
          shadow.poly([-96, -30, 58, -42, 105, 3, 44, 37, -82, 28])
            .fill({ color: 0x02040a, alpha: 0.72 });
          structure.moveTo(-82, 20).lineTo(-42, -18).lineTo(26, -27).lineTo(71, 12)
            .stroke({ color: 0x3b4654, width: 9, alpha: 0.62 });
          structure.moveTo(-80, 20).lineTo(-42, -18).lineTo(25, -27)
            .stroke({ color: 0x7f706d, width: 1.4, alpha: 0.34 });
          structure.circle(-44, -18, 12).fill({ color: 0x080b12, alpha: 0.9 }).stroke({ color: 0x6b7180, width: 2, alpha: 0.44 });
          const arm = new PIXI.Graphics();
          arm.moveTo(18, -22).lineTo(76, -48).stroke({ color: 0x38404c, width: 7, alpha: 0.66 });
          arm.moveTo(18, -22).lineTo(76, -48).stroke({ color: 0xb06d52, width: 1.2, alpha: 0.34 });
          arm.poly([80, -49, 63, -61, 67, -42]).fill({ color: 0x17151a, alpha: 0.92 });
          movingPart.addChild(arm);
          beacon.circle(-82, 20, 5).fill({ color: 0xff9b5f, alpha: 0.62 });
        } else if (kind === "relay") {
          shadow.ellipse(0, 7, 49, 28).fill({ color: 0x02040a, alpha: 0.66 });
          structure.moveTo(-34, 26).lineTo(0, -34).lineTo(30, 28)
            .stroke({ color: 0x424a5b, width: 8, alpha: 0.62 });
          structure.circle(0, -34, 10).fill({ color: 0x0a0d15, alpha: 0.92 }).stroke({ color: 0x766d8e, width: 2, alpha: 0.42 });
          const dish = new PIXI.Graphics();
          dish.arc(0, -34, 39, -0.84, 0.84).stroke({ color: 0x695d7d, width: 5, alpha: 0.52 });
          dish.moveTo(0, -34).lineTo(31, -34).stroke({ color: 0xa4787b, width: 1.4, alpha: 0.34 });
          movingPart.addChild(dish);
          beacon.circle(0, -34, 4.5).fill({ color: 0xd68cff, alpha: 0.58 });
        } else {
          const silhouette = [-118, -18, -71, -45, 13, -38, 61, -18, 112, -4, 64, 20, -4, 34, -76, 28];
          shadow.poly(silhouette).fill({ color: 0x02040a, alpha: 0.8 }).stroke({ color: 0x050812, width: 8, alpha: 0.8 });
          structure.poly(silhouette).fill({ color: 0x151b26, alpha: 0.58 }).stroke({ color: 0x536174, width: 2, alpha: 0.35 });
          structure.poly([-38, -30, 4, -30, 27, -13, -13, -7]).fill({ color: 0x30253c, alpha: 0.48 });
          structure.moveTo(-67, 10).lineTo(-11, -8).lineTo(44, 8)
            .stroke({ color: 0x9a5f55, width: 2.2, alpha: 0.4 });
          structure.moveTo(13, -38).lineTo(-3, -8).lineTo(31, 15)
            .stroke({ color: 0x080a10, width: 7, alpha: 0.78 });
          const spar = new PIXI.Graphics();
          spar.moveTo(45, 6).lineTo(98, 35).stroke({ color: 0x343e4d, width: 7, alpha: 0.58 });
          movingPart.addChild(spar);
          beacon.circle(-10, -7, 4).fill({ color: 0xff885b, alpha: 0.46 });
        }
        beacon.blendMode = "add";
        view.addChild(shadow, structure, movingPart, beacon);
        view.position.set(x, y);
        view.alpha = kind === "wreck" ? 0.46 : 0.52;
        storyLayer.addChild(view);
        landmarks.push({ view, beacon, movingPart, phase, spin: kind === "relay" ? 0.11 : kind === "rig" ? -0.035 : 0.018 });
      };

      const spawnStoryField = () => {
        const filaments = new PIXI.Graphics();
        for (let index = 0; index < 7; index += 1) {
          const angle = (index / 7) * Math.PI * 2 + 0.24;
          const inner = 190 + (index % 2) * 25;
          const outer = 510 + (index % 3) * 74;
          filaments.moveTo(engine.x + Math.cos(angle) * inner, engine.y + Math.sin(angle) * inner)
            .bezierCurveTo(
              engine.x + Math.cos(angle + 0.17) * outer * 0.55,
              engine.y + Math.sin(angle + 0.17) * outer * 0.55,
              engine.x + Math.cos(angle - 0.11) * outer * 0.82,
              engine.y + Math.sin(angle - 0.11) * outer * 0.82,
              engine.x + Math.cos(angle) * outer,
              engine.y + Math.sin(angle) * outer,
            ).stroke({ color: index % 2 ? 0x7a536e : 0x4d5a78, width: index % 3 === 0 ? 2.2 : 1.1, alpha: 0.15 });
        }
        const slag = new PIXI.Graphics();
        for (let index = 0; index < 36; index += 1) {
          const angle = rng() * Math.PI * 2;
          const d = 220 + rng() * 360;
          const size = 3 + rng() * 10;
          const x = engine.x + Math.cos(angle) * d;
          const y = engine.y + Math.sin(angle) * d;
          slag.poly([x - size, y - size * 0.25, x + size * 0.8, y - size * 0.45, x + size * 0.28, y + size])
            .fill({ color: index % 3 === 0 ? 0x30222b : 0x171d28, alpha: 0.34 })
            .stroke({ color: index % 4 === 0 ? 0x955844 : 0x4d5165, width: 0.7, alpha: 0.2 });
        }
        storyLayer.addChild(filaments, slag);
        spawnLandmark(3520, 2480, "wreck", 0.4);
        spawnLandmark(4910, 3760, "rig", 1.7);
        spawnLandmark(6200, 2840, "relay", 2.8);
        spawnLandmark(4040, 3920, "relay", 4.1);
        spawnLandmark(6870, 3580, "wreck", 5.2);
      };

      const createPlayerEchoes = () => {
        playerEchoes = [];
        for (let index = 0; index < 5; index += 1) {
          const echo = new PIXI.Graphics();
          echo.poly([28, 0, 3, -9, -21, -17, -13, 0, -21, 17, 3, 9])
            .stroke({ color: index % 2 ? 0x61ddff : 0x8d7cff, width: 1.2, alpha: 0.46 });
          echo.blendMode = "add";
          echo.visible = false;
          lowFxLayer.addChild(echo);
          playerEchoes.push(echo);
        }
        playerHistory.fill(0);
        playerHistoryTimer = 0;
      };

      const spawnWreckage = (
        x: number,
        y: number,
        color: number,
        size: number,
        count: number,
        lifetime = 6.5,
      ) => {
        const density = localReducedFx ? 0.48 : 0.72 + localEffectIntensity * 0.28;
        const actualCount = Math.max(2, Math.floor(count * density));
        for (let index = 0; index < actualCount && wreckage.length < 88; index += 1) {
          const angle = rng() * Math.PI * 2;
          const chunkSize = size * (0.14 + rng() * 0.27);
          const view = new PIXI.Container();
          const body = new PIXI.Graphics();
          body.poly([
            -chunkSize, -chunkSize * 0.32,
            -chunkSize * 0.18, -chunkSize * 0.84,
            chunkSize, -chunkSize * 0.18,
            chunkSize * 0.46, chunkSize * 0.72,
            -chunkSize * 0.5, chunkSize * 0.58,
          ]).fill({ color: 0x11131a, alpha: 0.96 }).stroke({ color, width: 1.2, alpha: 0.62 });
          body.moveTo(-chunkSize * 0.58, 0).lineTo(chunkSize * 0.45, -chunkSize * 0.18)
            .stroke({ color: 0x616a78, width: 0.8, alpha: 0.32 });
          const ember = new PIXI.Graphics();
          ember.moveTo(-chunkSize * 0.3, chunkSize * 0.18).lineTo(chunkSize * 0.4, 0)
            .stroke({ color, width: 1.7, alpha: 0.72 });
          ember.circle(chunkSize * 0.4, 0, 2.1).fill({ color: 0xffffff, alpha: 0.66 });
          ember.blendMode = "add";
          view.addChild(body, ember);
          const initialSpread = size * (0.32 + rng() * 1.72);
          view.position.set(x + Math.cos(angle) * initialSpread, y + Math.sin(angle) * initialSpread);
          view.rotation = angle;
          wreckageLayer.addChild(view);
          const speed = 42 + rng() * 135;
          wreckage.push({
            id: nextId(), x: view.x, y: view.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            radius: chunkSize, view, age: 0, lifetime: lifetime + rng() * 2.8,
            spin: (rng() - 0.5) * 3.4, ember, fadeStart: 0.58 + rng() * 0.16,
          });
        }
      };

      const makeProjectileView = (kind: Projectile["kind"]) => {
        const container = new PIXI.Container();
        const trail = new PIXI.Graphics();
        const glow = new PIXI.Graphics();
        const shape = new PIXI.Graphics();
        const accent = new PIXI.Container();
        if (kind === "laser") {
          trail.poly([-22, -3, -62, 0, -22, 3]).fill({ color: 0x5ce9ff, alpha: 0.13 });
          trail.moveTo(-19, 0).lineTo(-72, 0).stroke({ color: 0xc9fbff, width: 1.1, alpha: 0.3 });
          glow.moveTo(-31, 0).lineTo(25, 0).stroke({ color: 0x47eaff, width: 11, alpha: 0.11 });
          shape.moveTo(-25, 0).lineTo(21, 0).stroke({ color: 0x03131c, width: 6.5, alpha: 0.9 });
          shape.moveTo(-25, 0).lineTo(21, 0).stroke({ color: 0xc7fbff, width: 2.6, alpha: 0.98 });
          shape.poly([28, 0, 18, -4, 18, 4]).fill({ color: 0xffffff, alpha: 0.98 });
          shape.moveTo(-34, -2).lineTo(-18, -2).stroke({ color: 0x59dfff, width: 1.2, alpha: 0.58 });
          shape.moveTo(-29, 3).lineTo(-12, 3).stroke({ color: 0x8f72ff, width: 1, alpha: 0.42 });
        } else if (kind === "bolt") {
          for (let index = 0; index < 3; index += 1) {
            const x = -13 - index * 10;
            trail.poly([x, 0, x - 7, -4, x - 4, 0, x - 7, 4])
              .stroke({ color: index === 0 ? 0xff8ab0 : 0xa667ff, width: 1.25, alpha: 0.34 - index * 0.07 });
          }
          glow.ellipse(-2, 0, 19, 14).fill({ color: 0xff4e98, alpha: 0.16 });
          const ring = new PIXI.Graphics();
          ring.circle(0, 0, 10).stroke({ color: 0xc368ff, width: 1.6, alpha: 0.6 });
          accent.addChild(ring);
          shape.poly([12, 0, -5, -8, -1, 0, -5, 8]).fill({ color: 0xff769e, alpha: 0.94 });
          shape.poly([7, 0, -9, -3, -3, 0, -9, 3]).fill({ color: 0x6f3dff, alpha: 0.82 });
          shape.circle(3, 0, 2.6).fill({ color: 0xffffff, alpha: 0.92 });
        } else {
          trail.poly([-15, -6, -58, -12, -28, 0, -58, 12, -15, 6])
            .fill({ color: 0x9e64ff, alpha: 0.1 });
          trail.moveTo(-16, -4).lineTo(-52, -8).stroke({ color: 0xc89aff, width: 2, alpha: 0.38 });
          trail.moveTo(-16, 4).lineTo(-52, 8).stroke({ color: 0xffa05d, width: 2, alpha: 0.38 });
          trail.moveTo(-18, 0).lineTo(-67, 0).stroke({ color: 0xffffff, width: 0.85, alpha: 0.28 });
          glow.circle(0, 0, 34).fill({ color: 0xff7d3d, alpha: 0.14 });
          const ringA = new PIXI.Graphics();
          ringA.ellipse(0, 0, 23, 16).stroke({ color: 0xa45dff, width: 2.5, alpha: 0.72 });
          const ringB = new PIXI.Graphics();
          ringB.ellipse(0, 0, 17, 24).stroke({ color: 0xff874f, width: 1.7, alpha: 0.62 });
          accent.addChild(ringA, ringB);
          shape.poly([18, 0, 3, -9, -12, -8, -19, 0, -12, 8, 3, 9])
            .fill({ color: 0x5c2f42, alpha: 0.96 })
            .stroke({ color: 0xffae6b, width: 1.7, alpha: 0.9 });
          shape.poly([10, 0, -2, -5, -9, 0, -2, 5]).fill({ color: 0xffe3a8, alpha: 0.98 });
          shape.poly([-10, -6, -21, -13, -16, -2]).fill({ color: 0x9d68ff, alpha: 0.86 });
          shape.poly([-10, 6, -21, 13, -16, 2]).fill({ color: 0xff8550, alpha: 0.86 });
          shape.circle(3, 0, 3.2).fill({ color: 0xffffff, alpha: 0.92 });
        }
        trail.blendMode = "add";
        glow.blendMode = "add";
        container.addChild(trail, glow, accent, shape);
        return { container, accent, trail };
      };

      const spawnProjectile = (
        kind: Projectile["kind"], x: number, y: number, vx: number, vy: number,
      ) => {
        const { container: view, accent, trail } = makeProjectileView(kind);
        view.position.set(x, y);
        view.rotation = Math.atan2(vy, vx);
        (kind === "bolt" ? hostileProjectileLayer : friendlyProjectileLayer).addChild(view);
        projectiles.push({
          id: nextId(), x, y, vx, vy, radius: kind === "nova" ? 13 : kind === "bolt" ? 6 : 5,
          view, owner: kind === "bolt" ? "enemy" : "player", kind, age: 0,
          lifetime: kind === "nova" ? 8 : kind === "bolt" ? 4 : 1.35,
          accent, trail,
        });
      };

      const spawnBurst = (x: number, y: number, color: number, count: number, force = 1) => {
        if (localEffectIntensity <= 0.01) return;
        const actualCount = Math.max(1, Math.ceil(
          count * (localReducedFx ? 0.5 : 1) * localEffectIntensity * (localReducedFlashing ? 0.62 : 1),
        ));
        for (let index = 0; index < actualCount && particles.length < 420; index += 1) {
          const angle = rng() * Math.PI * 2;
          const roll = rng();
          const kind: Particle["kind"] = force > 0.48 && roll < 0.13
            ? "smoke"
            : roll < 0.34
              ? "shard"
              : roll < 0.56
                ? "plasma"
                : "spark";
          const speed = (kind === "smoke" ? 24 + rng() * 75 : 50 + rng() * 320) * force;
          const view = new PIXI.Graphics();
          const size = 1.7 + rng() * 4.8 * force;
          if (kind === "smoke") {
            view.circle(0, 0, size * 2.4).fill({ color: 0x292936, alpha: 0.2 });
            view.circle(-size * 0.7, size * 0.2, size * 1.35).fill({ color: 0x4a3b4b, alpha: 0.11 });
            view.blendMode = "normal";
          } else if (kind === "spark") {
            view.moveTo(-size * 2.8, 0).lineTo(size * 1.5, 0).stroke({ color, width: Math.max(1, size * 0.45), alpha: 0.92 });
            view.moveTo(-size * 0.8, 0).lineTo(size * 0.9, 0).stroke({ color: 0xffffff, width: Math.max(0.7, size * 0.16), alpha: 0.72 });
            view.blendMode = localReducedFlashing ? "normal" : "add";
          } else if (kind === "shard") {
            view.poly([-size * 1.5, -size * 0.55, size * 1.15, 0, -size * 0.7, size * 0.8])
              .fill({ color: 0x292532, alpha: 0.92 })
              .stroke({ color, width: 0.9, alpha: 0.68 });
            view.blendMode = "normal";
          } else {
            view.circle(0, 0, size * 1.7).fill({ color, alpha: 0.18 });
            view.circle(0, 0, size * 0.68).fill({ color, alpha: 0.92 });
            view.circle(0, 0, size * 0.22).fill({ color: 0xffffff, alpha: 0.82 });
            view.blendMode = localReducedFlashing ? "normal" : "add";
          }
          view.position.set(x, y);
          view.rotation = angle;
          highFxLayer.addChild(view);
          particles.push({
            id: nextId(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            radius: size, view, age: 0,
            lifetime: kind === "smoke" ? 1.1 + rng() * 1.2 : 0.48 + rng() * 1.05 * force,
            spin: (rng() - 0.5) * (kind === "smoke" ? 1.4 : 7.5),
            startScale: kind === "smoke" ? 0.42 + rng() * 0.35 : 0.72 + rng() * 0.9,
            endScale: kind === "smoke" ? 2.2 + rng() * 1.6 : kind === "shard" ? 0.72 : 0.18,
            drag: kind === "smoke" ? 1.9 : kind === "shard" ? 0.72 : 1.28,
            fadePower: kind === "smoke" ? 0.72 : kind === "plasma" ? 1.8 : 1.15,
            kind,
          });
        }
      };

      const spawnImpactFx = (x: number, y: number, color: number, size: number, force = 1) => {
        if (localEffectIntensity <= 0.05 || impactFx.length >= 18) return;
        const view = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, size * 0.3).fill({ color, alpha: localReducedFlashing ? 0.08 : 0.2 * force });
        glow.blendMode = localReducedFlashing ? "normal" : "add";
        const rings = new PIXI.Graphics();
        rings.circle(0, 0, size * 0.24).stroke({ color: 0xffffff, width: 2.2, alpha: 0.7 });
        rings.circle(0, 0, size * 0.4).stroke({ color, width: 4.4, alpha: 0.52 });
        rings.blendMode = localReducedFlashing ? "normal" : "add";
        const rays = new PIXI.Graphics();
        const rayCount = localReducedFx ? 5 : 10;
        for (let index = 0; index < rayCount; index += 1) {
          const angle = (index / rayCount) * Math.PI * 2 + rng() * 0.12;
          const inner = size * (0.12 + rng() * 0.08);
          const outer = size * (0.45 + rng() * 0.2);
          rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
            .stroke({ color, width: 1 + rng() * 1.4, alpha: 0.32 });
        }
        rays.blendMode = "add";
        view.addChild(glow, rays, rings);
        view.position.set(x, y);
        lowFxLayer.addChild(view);
        impactFx.push({
          id: nextId(), x, y, vx: 0, vy: 0, radius: size, view,
          age: 0, lifetime: 0.5 + force * 0.22, startScale: 0.35,
          endScale: 1.8 + force * 0.52, spin: (rng() - 0.5) * 0.8,
        });
      };

      const triggerShockwave = (x: number, y: number, force = 1, duration = 0.52) => {
        shockwaveAge = 0;
        shockwaveDuration = duration;
        shockwaveX = x;
        shockwaveY = y;
        shockwaveForce = force;
      };

      const syncPlanetoidDamage = (planetoid: Planetoid) => {
        const damage = clamp(1 - planetoid.integrity / planetoid.maxIntegrity, 0, 1);
        const stage = Math.min(3, Math.floor(damage * 4));
        planetoid.cracks.alpha = 0.12 + damage * 0.86;
        planetoid.damageLayer.alpha = clamp((damage - 0.24) / 0.76, 0, 0.94);
        planetoid.oreGlow.alpha = 0.16 + damage * 0.84;
        const fractureAngles = [-0.22, 0.68, -1.08];
        planetoid.fracturePlates.forEach((plate, index) => {
          const active = stage > index;
          const angle = fractureAngles[index];
          const separation = active ? 0.76 + damage * (0.14 + index * 0.025) : 0.72;
          plate.visible = active;
          plate.position.set(
            Math.cos(angle) * planetoid.radius * separation,
            Math.sin(angle) * planetoid.radius * separation,
          );
          plate.rotation = angle + (active ? (index % 2 ? 1 : -1) * damage * 0.18 : 0);
          plate.alpha = active ? 0.72 + damage * 0.28 : 0;
        });
        planetoid.damageStage = stage;
      };

      const syncEngineParts = () => {
        engine.parts.forEach((part, index) => {
          const transform = engineSlotTransform(index);
          const angle = transform.angle;
          const baseDistance = transform.radius;
          if (index < pieces) {
            part.alpha = 1;
            part.scale.set(1);
            part.position.set(Math.cos(angle) * baseDistance, Math.sin(angle) * baseDistance);
            part.rotation = angle;
          } else {
            part.alpha = 0.055;
            part.scale.set(0.54);
            part.position.set(Math.cos(angle) * (baseDistance + 24), Math.sin(angle) * (baseDistance + 24));
            part.rotation = angle + (index % 2 ? 0.22 : -0.22);
          }
        });
        if (engine.active) {
          const disabled = RULES.engineHits - engine.health;
          for (let index = 0; index < disabled; index += 1) {
            const partIndex = (index * 3 + 2) % engine.parts.length;
            const part = engine.parts[partIndex];
            const transform = engineSlotTransform(partIndex);
            const angle = transform.angle;
            const baseDistance = transform.radius;
            part.alpha = 0.12;
            part.scale.set(0.82);
            part.position.set(Math.cos(angle) * (baseDistance + 12), Math.sin(angle) * (baseDistance + 12));
            part.rotation = angle + (partIndex % 2 ? 0.32 : -0.32);
          }
          engine.scorchNodes.forEach((scorch, index) => {
            scorch.visible = index < disabled;
            scorch.alpha = index < disabled ? 0.72 + (index % 3) * 0.08 : 0;
          });
        } else {
          engine.scorchNodes.forEach((scorch) => { scorch.visible = false; });
        }
        const damage = 1 - engine.health / RULES.engineHits;
        engine.damageLayers.forEach((layer, index) => {
          layer.visible = engine.active && damage >= (index + 1) / (engine.damageLayers.length + 1);
        });
        const assembly = pieces / RULES.enginePieces;
        engine.energyCage.alpha = engine.destroyed ? 0.12 : engine.active ? 0.9 - damage * 0.32 : 0.12 + assembly * 0.54;
        engine.coreHalo.alpha = engine.destroyed ? 0.08 : engine.active ? 0.78 + (1 - damage) * 0.22 : 0.16 + assembly * 0.56;
        engine.threatHalo.alpha = engine.destroyed ? 0.04 : engine.active ? 0.72 : 0.08 + assembly * 0.48;
        engine.forgeAura.alpha = engine.destroyed ? 0.08 : 0.22 + assembly * 0.78;
        engine.targetingBeam.visible = engine.active && !engine.destroyed;
        engine.aperture.scale.set(engine.active ? 1 : 0.72 + assembly * 0.28);
        engine.weaponArms.forEach((arm, index) => {
          const armAssembly = clamp((pieces - (index * 4 + 7)) / 4, 0, 1);
          arm.alpha = engine.destroyed ? 0.18 : engine.active ? 1 : 0.08 + armAssembly * 0.72;
          arm.scale.set(engine.active ? 1 : 0.72 + armAssembly * 0.28);
        });
        engine.conduitPulse.alpha = engine.destroyed ? 0.08 : engine.active ? 0.68 : 0.1 + assembly * 0.46;
        engine.sensorArray.alpha = engine.destroyed ? 0.12 : engine.active ? 0.9 : 0.18 + assembly * 0.42;
      };

      const clearWorld = () => {
        for (const layer of renderLayers) {
          for (const child of layer.removeChildren()) child.destroy({ children: true });
        }
        planetoids = [];
        crystals = [];
        tutorialTarget = undefined;
        fabricators = [];
        sentinels = [];
        projectiles = [];
        particles = [];
        impactFx = [];
        wreckage = [];
        landmarks = [];
        playerEchoes = [];
        microDetailViews = [];
        radarHistory.clear();
      };

      const resetWorld = (resetScore = true) => {
        clearWorld();
        if (resetScore) {
          score = 0;
          lives = RULES.playerLives;
          charges = 0;
          zone = 1;
        }
        pieces = 0;
        victoryTimer = 0;
        holdShowcase = false;
        showcaseFrozen = false;
        motionClock = 0;
        activationPulse = 0;
        shockwaveAge = 99;
        shockwaveForce = 0;
        player = createPlayer();
        engine = createEngine();
        spawnStoryField();
        createPlayerEchoes();
        const nearPlayer = [
          [4650, 2850], [3900, 2500], [4300, 3650], [5050, 3450], [3600, 3200],
          [5050, 2450], [3300, 2700], [6100, 3550],
        ];
        nearPlayer.forEach(([x, y]) => spawnPlanetoid(x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 120));
        for (let index = nearPlayer.length; index < 34; index += 1) {
          spawnPlanetoid(500 + rng() * (RULES.worldWidth - 1000), 500 + rng() * (RULES.worldHeight - 1000));
        }
        for (let index = 0; index < 5; index += 1) {
          const angle = (index / 5) * Math.PI * 2;
          spawnFabricator(engine.x + Math.cos(angle) * (310 + rng() * 160), engine.y + Math.sin(angle) * (310 + rng() * 160));
        }
        for (let index = 0; index < 3; index += 1) {
          const angle = (index / 3) * Math.PI * 2 + 0.4;
          spawnSentinel(player.x + Math.cos(angle) * (720 + rng() * 340), player.y + Math.sin(angle) * (720 + rng() * 340));
        }
        cameraX = player.x;
        cameraY = player.y;
        cameraZoom = 1;
        audio.setMusicIntensity(0.08);
        syncEngineParts();
      };

      const activateEngine = () => {
        if (engine.active || engine.destroyed) return;
        pieces = RULES.enginePieces;
        engine.active = true;
        engine.health = RULES.engineHits;
        activationPulse = localReducedFx ? 0 : 2.2;
        audio.setMusicIntensity(1);
        syncEngineParts();
        shake = Math.max(shake, 32);
        spawnImpactFx(engine.x, engine.y, 0xc071ff, 250, 1.15);
        triggerShockwave(engine.x, engine.y, 1.05, 0.68);
        audio.warning(1);
        notify("THE DREAD ENGINE IS AWAKE", true);
        voiceLine("The forge is awake. Signal acquired.");
      };

      const depositPiece = (fabricator: Fabricator) => {
        fabricator.carrying = false;
        fabricator.targetId = undefined;
        if (tutorialActiveRef.current) {
          return;
        }
        if (engine.active) {
          if (engine.health < RULES.engineHits) {
            engine.health += 1;
            syncEngineParts();
            notify("FABRICATOR REPAIR SIGNAL", true);
          }
          return;
        }
        pieces = Math.min(RULES.enginePieces, pieces + 1);
        audio.setMusicIntensity(0.12 + (pieces / RULES.enginePieces) * 0.68);
        audio.construction(pieces / RULES.enginePieces, panFor(engine.x));
        spawnBurst(engine.x, engine.y, pieces % 2 ? 0xff8048 : 0x9e71ff, 12, 0.7);
        syncEngineParts();
        if (pieces === 14) {
          audio.warning(0.55);
          notify("ASSEMBLY CASCADE DETECTED", true);
        }
        if (pieces >= RULES.enginePieces) activateEngine();
      };

      const destroyEngine = () => {
        if (engine.destroyed) return;
        engine.destroyed = true;
        engine.active = false;
        activationPulse = localReducedFx ? 0 : 0.72;
        score += 15000;
        victoryTimer = holdShowcase ? 999 : 5.5;
        shake = localReducedFx ? 10 : 48;
        audio.setMusicIntensity(0);
        audio.explosion(1, panFor(engine.x));
        notify("DREAD ENGINE RUPTURED · FIELD SECURED");
        voiceLine("Containment lost. The forge is broken.");
        engine.deathPose = 1;
        engine.outerRing.rotation = 0;
        engine.innerRing.rotation = 0;
        engine.parts.forEach((part, index) => {
          const transform = engineSlotTransform(index);
          const rupture = 64 + (index % 5) * 24;
          part.position.set(
            Math.cos(transform.angle + (index % 2 ? 0.08 : -0.1)) * (transform.radius + rupture),
            Math.sin(transform.angle + (index % 2 ? 0.08 : -0.1)) * (transform.radius + rupture),
          );
          part.alpha = index % 4 === 0 ? 0.05 : 0.28 + (index % 3) * 0.18;
          part.scale.set(index % 4 === 0 ? 0.48 : 0.72 + (index % 2) * 0.12);
          part.rotation = transform.angle + (index % 2 ? 0.72 : -0.58);
        });
        engine.weaponArms.forEach((arm, index) => {
          const angle = arm.rotation + (index % 2 ? 0.35 : -0.42);
          arm.position.set(Math.cos(angle) * (42 + index * 18), Math.sin(angle) * (42 + index * 18));
          arm.rotation = angle;
          arm.alpha = index === 1 ? 0.08 : 0.46;
        });
        engine.aperture.scale.set(0.42);
        engine.aperture.rotation += 0.84;
        engine.sensorArray.alpha = 0.08;
        engine.conduitPulse.alpha = 0.06;
        engine.core.alpha = 0.28;
        engine.coreHalo.alpha = 0.08;
        engine.energyCage.alpha = 0.1;
        spawnImpactFx(engine.x, engine.y, 0xff8b48, 330, 1.45);
        triggerShockwave(engine.x, engine.y, 1.4, 0.82);
        spawnBurst(engine.x, engine.y, 0xff8b48, 110, 1.65);
        spawnBurst(engine.x, engine.y, 0xba6cff, 90, 1.35);
        spawnWreckage(engine.x, engine.y, 0xff8b58, 78, 28, 10.5);
        spawnWreckage(engine.x, engine.y, 0xb978ff, 58, 20, 9.5);
      };

      const killPlayer = () => {
        if (player.invulnerable > 0 || localMode !== "playing") return;
        resetTouchInput(touchInputRef.current);
        lives -= 1;
        player.invulnerable = 2.8;
        player.vx = 0;
        player.vy = 0;
        shake = Math.max(shake, localReducedFx ? 8 : 28);
        spawnImpactFx(player.x, player.y, 0x65eaff, 115, 0.9);
        triggerShockwave(player.x, player.y, 0.58, 0.44);
        spawnBurst(player.x, player.y, 0x65eaff, 52, 1.15);
        spawnBurst(player.x, player.y, 0xff7844, 38, 0.9);
        spawnWreckage(player.x, player.y, 0x65eaff, 32, 7, 3.8);
        audio.playerDeath();
        if (lives <= 0) {
          localMode = "gameover";
          setScreenMode("gameover");
          audio.setEngineThrust(0);
          audio.setMusicIntensity(0);
          notify("VESPER SIGNAL LOST", true);
        } else {
          player.x = 4200;
          player.y = 3050;
          player.view.position.set(player.x, player.y);
          notify("VESPER RECONSTITUTED");
        }
      };

      const refreshHud = () => {
        const range = 2400;
        const contacts: RadarContact[] = [];
        const activeContactIds = new Set<number>();
        const addContact = (entity: Entity, kind: ContactKind) => {
          if (entity.dead) return;
          const dx = entity.x - player.x;
          const dy = entity.y - player.y;
          if (Math.abs(dx) > range || Math.abs(dy) > range) return;
          const cos = Math.cos(-player.angle);
          const sin = Math.sin(-player.angle);
          const relativeX = dx * cos - dy * sin;
          const relativeY = dx * sin + dy * cos;
          const radarX = clamp(50 + (relativeX / range) * 48, 3, 97);
          const radarY = clamp(50 + (relativeY / range) * 48, 3, 97);
          const previous = radarHistory.get(entity.id) ?? { x: radarX, y: radarY };
          const trailDx = radarX - previous.x;
          const trailDy = radarY - previous.y;
          contacts.push({
            id: entity.id,
            kind,
            x: radarX,
            y: radarY,
            heading: Math.atan2(trailDy, trailDx),
            trailLength: clamp(Math.hypot(trailDx, trailDy) * 2.2, 2, 14),
            range: clamp(Math.hypot(dx, dy) / range, 0, 1),
          });
          radarHistory.set(entity.id, { x: radarX, y: radarY });
          activeContactIds.add(entity.id);
        };
        fabricators.slice(0, 9).forEach((entity) => addContact(entity, "worker"));
        sentinels.slice(0, 8).forEach((entity) => addContact(entity, "warrior"));
        if (!engine.destroyed) addContact(engine, "boss");
        for (const id of radarHistory.keys()) {
          if (!activeContactIds.has(id)) radarHistory.delete(id);
        }
        const nearbyThreats = sentinels.reduce((count, sentinel) => (
          !sentinel.dead && distance(player.x, player.y, sentinel.x, sentinel.y) < 1250 ? count + 1 : count
        ), 0);
        const assembly = pieces / RULES.enginePieces;
        const threatLevel = engine.active
          ? clamp(0.62 + nearbyThreats * 0.035 + (1 - engine.health / RULES.engineHits) * 0.18, 0, 1)
          : clamp(assembly * 0.68 + nearbyThreats * 0.045, 0, 0.82);
        const tacticalStatus = engine.destroyed
          ? "FIELD SECURE"
          : engine.active
            ? engine.health <= 4 ? "CORE BREACH" : "DREAD LOCK"
            : pieces >= 15
              ? "ASSEMBLY CRITICAL"
              : fabricators.some((fabricator) => !fabricator.dead && fabricator.carrying)
                ? "FABRICATOR TRANSIT"
                : nearbyThreats >= 3 ? "WARRIOR SWARM" : "MINE FLUX";
        setHud({
          score, lives, charges, zone, pieces, engineHealth: engine.health,
          engineActive: engine.active, contacts, threatLevel, tacticalStatus,
        });
      };

      const launchLaser = () => {
        if (fireCooldown > 0) return;
        fireCooldown = 0.115;
        const speed = 1250;
        const muzzleX = player.x + Math.cos(player.angle) * 40;
        const muzzleY = player.y + Math.sin(player.angle) * 40;
        spawnProjectile("laser", muzzleX, muzzleY, Math.cos(player.angle) * speed + player.vx * 0.3, Math.sin(player.angle) * speed + player.vy * 0.3);
        player.recoil = 1;
        player.muzzleFlash.alpha = localReducedFlashing ? 0.46 : 1;
        player.muzzleFlash.scale.set(0.76, 0.86);
        audio.laser(panFor(player.x));
        spawnBurst(muzzleX, muzzleY, 0x7ceaff, 3, 0.25);
      };

      const launchNova = () => {
        if (novaCooldown > 0 || charges <= 0) return;
        if (!engine.active || engine.destroyed) {
          notify("NO DREAD ENGINE LOCK");
          return;
        }
        novaCooldown = 0.42;
        charges -= 1;
        const speed = 520;
        spawnProjectile("nova", player.x, player.y, Math.cos(player.angle) * speed, Math.sin(player.angle) * speed);
        audio.bomb(panFor(player.x));
        notify("NOVA CHARGE LOCKED");
      };

      const startGame = (tutorialOverride?: "force" | "disable") => {
        resetTouchInput(touchInputRef.current);
        resetWorld(true);
        const tutorialMode = tutorialModeForRun(tutorialOverride);
        if (tutorialMode.enabled) activateTutorial(tutorialMode);
        else disableTutorial();
        localMode = "playing";
        setScreenMode("playing");
        setNotice(null);
        void audio.unlock();
        if (!tutorialMode.enabled) notify("FIELD 01 · CINDER EXPANSE");
        app?.canvas.focus();
        refreshHud();
      };

      const togglePause = () => {
        resetTouchInput(touchInputRef.current);
        if (localMode === "playing") {
          localMode = "paused";
          setScreenMode("paused");
          audio.setEngineThrust(0);
        } else if (localMode === "paused") {
          localMode = "playing";
          setScreenMode("playing");
          void audio.unlock();
          app?.canvas.focus();
        }
      };

      const configureShowcase = (scene: string) => {
        startGame("disable");
        player.invulnerable = 999;
        if (scene === "mining") {
          charges = 5;
          const showcaseRock = planetoids[0];
          if (showcaseRock) {
            showcaseRock.integrity = 3;
            showcaseRock.shards = Math.max(1, showcaseRock.shards - 2);
            showcaseRock.miningHeat = 0.88;
            syncPlanetoidDamage(showcaseRock);
            showcaseRock.miningPulse.alpha = 0.54 * localEffectIntensity;
            showcaseRock.miningPulse.scale.set(0.9);
            player.angle = Math.atan2(showcaseRock.y - player.y, showcaseRock.x - player.x);
            player.view.rotation = player.angle;
            const beamLength = distance(player.x, player.y, showcaseRock.x, showcaseRock.y);
            for (let index = 0; index < 4; index += 1) {
              const along = clamp(0.3 + index * 0.16, 0, 0.86);
              const x = player.x + Math.cos(player.angle) * beamLength * along;
              const y = player.y + Math.sin(player.angle) * beamLength * along;
              spawnProjectile("laser", x, y, Math.cos(player.angle) * 1250, Math.sin(player.angle) * 1250);
            }
            spawnBurst(showcaseRock.x, showcaseRock.y, 0xffa251, 18, 0.38);
          }
          for (let index = 0; index < 9; index += 1) {
            const angle = (index / 9) * Math.PI * 2;
            spawnCrystal(player.x + Math.cos(angle) * (120 + index * 11), player.y + Math.sin(angle) * (120 + index * 11), angle);
          }
        }
        if (scene === "construction") {
          pieces = 15;
          syncEngineParts();
          player.x = engine.x - 455;
          player.y = engine.y + 55;
          player.view.position.set(player.x, player.y);
          fabricators.forEach((fabricator, index) => {
            fabricator.carrying = true;
            fabricator.cargoGlow.visible = true;
            fabricator.cargoGlow.alpha = 0.9;
            const angle = (index / fabricators.length) * Math.PI * 2;
            fabricator.x = engine.x + Math.cos(angle) * (250 + (index % 2) * 90);
            fabricator.y = engine.y + Math.sin(angle) * (250 + (index % 2) * 90);
            fabricator.view.position.set(fabricator.x, fabricator.y);
          });
        }
        if (["combat", "pursuit", "bombardment", "destruction"].includes(scene)) {
          for (let index = sentinels.length; index < 11; index += 1) {
            spawnSentinel(player.x, player.y);
          }
          sentinels.forEach((sentinel, index) => {
            const angle = (index / sentinels.length) * Math.PI * 2 + 0.18;
            const ring = 305 + (index % 3) * 125;
            sentinel.x = player.x + Math.cos(angle) * ring;
            sentinel.y = player.y + Math.sin(angle) * ring;
            sentinel.view.position.set(sentinel.x, sentinel.y);
            if (scene === "combat" && index < 7) {
              const aim = Math.atan2(player.y - sentinel.y, player.x - sentinel.x);
              const boltOffset = 92 + (index % 3) * 24;
              spawnProjectile(
                "bolt",
                sentinel.x + Math.cos(aim) * boltOffset,
                sentinel.y + Math.sin(aim) * boltOffset,
                Math.cos(aim) * 245,
                Math.sin(aim) * 245,
              );
              if (index % 3 === 0) {
                sentinel.health = 1;
                sentinel.damageLayer.visible = true;
                sentinel.shield.visible = false;
              }
            }
          });
        }
        if (["pursuit", "bombardment", "destruction"].includes(scene)) {
          pieces = RULES.enginePieces;
          activateEngine();
          engine.x = player.x + 560;
          engine.y = player.y - 130;
          engine.view.position.set(engine.x, engine.y);
          impactFx.forEach((effect) => effect.view.destroy({ children: true }));
          impactFx = [];
          player.vx = scene === "pursuit" ? 445 : 305;
          player.vy = scene === "pursuit" ? 54 : -32;
          const showcaseSpeed = Math.hypot(player.vx, player.vy);
          player.motionStreaks.visible = !localReducedFx;
          player.motionStreaks.alpha = clamp((showcaseSpeed - 300) / 235, 0, 1) * 0.46 * localEffectIntensity;
          player.motionStreaks.rotation = Math.atan2(player.vy, player.vx) - player.angle;
          charges = 16;
        }
        if (scene === "bombardment") {
          engine.health = 6;
          syncEngineParts();
          for (let index = 0; index < 7; index += 1) {
            const angle = (index / 7) * Math.PI * 2;
            spawnProjectile("nova", engine.x + Math.cos(angle) * 310, engine.y + Math.sin(angle) * 310, -Math.cos(angle) * 430, -Math.sin(angle) * 430);
          }
        }
        if (scene === "destruction") {
          holdShowcase = true;
          engine.health = 0;
          destroyEngine();
          sentinels.forEach((sentinel) => { sentinel.dead = true; sentinel.view.visible = false; });
        }
        if (scene === "gameover") {
          lives = 0;
          localMode = "gameover";
          setScreenMode("gameover");
        }
        if (["exploration", "mining", "construction", "combat", "bombardment", "gameover"].includes(scene)) setNotice(null);
        cameraX = player.x;
        cameraY = player.y;
        cameraZoom = engine.active && !engine.destroyed ? 0.8 : 0.91;
        if (scene === "destruction") {
          shockwaveAge = shockwaveDuration * 0.32;
          impactFx.forEach((effect) => effect.view.scale.set(0.92));
        } else {
          shockwaveAge = shockwaveDuration;
        }
        showcaseFrozen = new URLSearchParams(window.location.search).get("live") !== "1";
        refreshHud();
      };

      const nearest = <T extends Entity>(source: Entity, list: T[]) => {
        let result: T | undefined;
        let best = Infinity;
        for (const candidate of list) {
          if (candidate.dead) continue;
          const d = distance(source.x, source.y, candidate.x, candidate.y);
          if (d < best) { best = d; result = candidate; }
        }
        return result;
      };

      const steer = (entity: Entity, tx: number, ty: number, speed: number, dt: number) => {
        const dx = tx - entity.x;
        const dy = ty - entity.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const targetVx = (dx / length) * speed;
        const targetVy = (dy / length) * speed;
        entity.vx = lerp(entity.vx, targetVx, clamp(dt * 2.1, 0, 1));
        entity.vy = lerp(entity.vy, targetVy, clamp(dt * 2.1, 0, 1));
      };

      const sweepDead = () => {
        const sweep = <T extends Entity>(items: T[]) => items.filter((item) => {
          if (!item.dead) return true;
          item.view.destroy({ children: true });
          return false;
        });
        planetoids = sweep(planetoids);
        crystals = sweep(crystals);
        fabricators = sweep(fabricators);
        sentinels = sweep(sentinels);
        projectiles = sweep(projectiles);
        particles = sweep(particles);
        impactFx = sweep(impactFx);
        wreckage = sweep(wreckage);
      };

      const pollGamepadMeta = () => {
        const pad = navigator.getGamepads?.()[0];
        const pausePressed = pad?.buttons[9]?.pressed ?? false;
        const confirmPressed = pad?.buttons[0]?.pressed ?? false;
        if (pausePressed && !lastGamepadPause) {
          if (localMode === "title" || localMode === "gameover") startGame();
          else togglePause();
        }
        if (confirmPressed && !lastGamepadConfirm && (localMode === "title" || localMode === "gameover")) {
          startGame();
        }
        lastGamepadPause = pausePressed;
        lastGamepadConfirm = confirmPressed;
      };

      const updateGameplay = (dt: number) => {
        motionClock += dt;
        fireCooldown = Math.max(0, fireCooldown - dt);
        novaCooldown = Math.max(0, novaCooldown - dt);
        player.invulnerable = Math.max(0, player.invulnerable - dt);
        const visualPulse = audio.getVisualPulse(motionClock);

        let inputX = 0;
        let inputY = 0;
        if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX -= 1;
        if (keys.has("ArrowRight") || keys.has("KeyD")) inputX += 1;
        if (keys.has("ArrowUp") || keys.has("KeyW")) inputY -= 1;
        if (keys.has("ArrowDown") || keys.has("KeyS")) inputY += 1;

        const touchInput = touchInputRef.current;
        const touchMoveMagnitude = Math.hypot(touchInput.moveX, touchInput.moveY);
        if (touchMoveMagnitude > Math.hypot(inputX, inputY)) {
          inputX = touchInput.moveX;
          inputY = touchInput.moveY;
        }

        const pad = navigator.getGamepads?.()[0];
        let padFire = false;
        let padBomb = false;
        let aimX = touchInput.aimX;
        let aimY = touchInput.aimY;
        if (pad) {
          const padMove = normalizeControlVector(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 1, 0.12);
          if (padMove.magnitude > Math.hypot(inputX, inputY)) {
            inputX = padMove.x;
            inputY = padMove.y;
          }
          const padAim = normalizeControlVector(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 1, 0.16);
          if (padAim.magnitude > Math.hypot(aimX, aimY)) {
            aimX = padAim.x;
            aimY = padAim.y;
          }
          padFire = pad.buttons[0]?.pressed ?? false;
          padBomb = (pad.buttons[1]?.pressed ?? false) || (pad.buttons[2]?.pressed ?? false);
        }
        if (localMode !== "playing") return;

        const rawMagnitude = Math.min(1, Math.hypot(inputX, inputY));
        const band = quantizeThrustMagnitude(rawMagnitude, 6);
        if (tutorialActiveRef.current) {
          player.invulnerable = Math.max(player.invulnerable, 0.45);
          if (band > 0) applyTutorialEvent("player-thrusted");
        }
        if (rawMagnitude > 0.01) {
          inputX /= rawMagnitude;
          inputY /= rawMagnitude;
          const acceleration = 780 * band;
          player.vx += inputX * acceleration * dt;
          player.vy += inputY * acceleration * dt;
        }
        const aimMagnitude = Math.hypot(aimX, aimY);
        if (aimMagnitude > 0.01 || rawMagnitude > 0.01) {
          const targetAngle = aimMagnitude > 0.01 ? Math.atan2(aimY, aimX) : Math.atan2(inputY, inputX);
          let diff = targetAngle - player.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          player.angle += diff * Math.min(1, dt * 9);
        }
        const drag = Math.exp(-1.08 * dt);
        player.vx *= drag;
        player.vy *= drag;
        const speed = Math.hypot(player.vx, player.vy);
        const maxSpeed = 535;
        if (speed > maxSpeed) {
          player.vx = (player.vx / speed) * maxSpeed;
          player.vy = (player.vy / speed) * maxSpeed;
        }
        const fast = clamp((Math.min(speed, maxSpeed) - 300) / (maxSpeed - 300), 0, 1);
        player.motionStreaks.visible = !localReducedFx && fast > 0.01;
        player.motionStreaks.alpha = fast * 0.46 * localEffectIntensity;
        player.motionStreaks.rotation = Math.atan2(player.vy, player.vx) - player.angle;
        player.motionStreaks.scale.set(0.7 + fast * 1.25, 0.9 + fast * 0.1);
        player.x = clamp(player.x + player.vx * dt, 180, RULES.worldWidth - 180);
        player.y = clamp(player.y + player.vy * dt, 180, RULES.worldHeight - 180);
        player.view.position.set(player.x, player.y);
        player.view.rotation = player.angle;
        const slip = clamp(
          (-Math.sin(player.angle) * player.vx + Math.cos(player.angle) * player.vy) / maxSpeed,
          -1,
          1,
        );
        player.hull.scale.y = 1 - Math.abs(slip) * 0.09;
        player.recoil = Math.max(0, player.recoil - dt * 8.5);
        player.hull.x = -player.recoil * 3.4;
        player.muzzleFlash.alpha = Math.max(0, player.muzzleFlash.alpha - dt * (localReducedFlashing ? 9 : 13));
        player.muzzleFlash.scale.set(0.76 + (1 - player.recoil) * 0.42, 0.86 + player.recoil * 0.24);
        player.portJet.alpha = Math.max(0, slip) * 0.9;
        player.starboardJet.alpha = Math.max(0, -slip) * 0.9;
        player.engineFlare.scale.x = 0.76 + band * 0.72 + Math.sin(motionClock * 19) * 0.055;
        player.engineFlare.alpha = 0.36 + band * 0.64;
        player.afterburnerRing.alpha = fast * (0.42 + visualPulse * 0.28) * localEffectIntensity;
        player.afterburnerRing.scale.set(0.78 + fast * 0.56, 0.86 + fast * 0.18);
        player.wingConduits.alpha = 0.42 + band * 0.32 + visualPulse * 0.18;
        player.shield.visible = player.invulnerable > 0;
        player.shield.rotation = localReducedFx ? 0.08 : motionClock * 0.72;
        player.shield.alpha = player.invulnerable > 0
          ? localReducedFlashing ? 0.58 : 0.56 + Math.sin(motionClock * 5.2) * 0.12
          : 0;
        player.shield.scale.set(0.96 + Math.min(player.invulnerable, 1) * 0.035);
        player.armorSheen.alpha = 0.32 + band * 0.34;
        player.navLights.alpha = localReducedFlashing ? 0.72 : 0.62 + Math.sin(motionClock * 4.4) * 0.26;
        player.view.alpha = 1;
        playerHistoryTimer -= dt;
        if (playerHistory[0] === 0) {
          for (let index = 0; index < 5; index += 1) {
            playerHistory[index * 2] = player.x;
            playerHistory[index * 2 + 1] = player.y;
          }
        }
        if (playerHistoryTimer <= 0) {
          playerHistoryTimer = 0.045;
          for (let index = 4; index > 0; index -= 1) {
            playerHistory[index * 2] = playerHistory[(index - 1) * 2];
            playerHistory[index * 2 + 1] = playerHistory[(index - 1) * 2 + 1];
          }
          playerHistory[0] = player.x;
          playerHistory[1] = player.y;
        }
        playerEchoes.forEach((echo, index) => {
          const echoActive = !localReducedFx && !highContrastRef.current && fast > 0.12;
          echo.visible = echoActive;
          if (!echoActive) return;
          echo.position.set(playerHistory[index * 2], playerHistory[index * 2 + 1]);
          const nextIndex = Math.max(0, index - 1);
          const hx = playerHistory[nextIndex * 2] - playerHistory[index * 2];
          const hy = playerHistory[nextIndex * 2 + 1] - playerHistory[index * 2 + 1];
          echo.rotation = Math.hypot(hx, hy) > 0.5 ? Math.atan2(hy, hx) : player.angle;
          echo.alpha = fast * (0.17 - index * 0.026) * localEffectIntensity;
          echo.scale.set(0.96 - index * 0.055);
        });
        audio.setEngineThrust(band);

        if (keys.has("Space") || padFire || touchInput.firing) launchLaser();
        if ((keys.has("KeyC") || keys.has("ShiftLeft") || keys.has("ShiftRight")) && novaCooldown <= 0) launchNova();
        if (padBomb && !lastGamepadBomb) launchNova();
        if (touchInput.novaQueued) {
          touchInput.novaQueued = false;
          launchNova();
        }
        lastGamepadBomb = padBomb;

        for (const planetoid of planetoids) {
          planetoid.x += planetoid.vx * dt;
          planetoid.y += planetoid.vy * dt;
          planetoid.view.position.set(planetoid.x, planetoid.y);
          planetoid.view.rotation += dt * planetoid.spin;
          planetoid.miningHeat = Math.max(0, planetoid.miningHeat - dt * 1.9);
          planetoid.miningPulse.alpha = planetoid.miningHeat
            * (localReducedFlashing ? 0.42 : 0.46 + Math.sin(motionClock * 11) * 0.18)
            * localEffectIntensity;
          planetoid.miningPulse.rotation = localReducedFx ? 0 : -planetoid.view.rotation + motionClock * 0.35;
          planetoid.miningPulse.scale.set(0.88 + (1 - planetoid.miningHeat) * 0.18);
          planetoid.oreGlow.scale.set(0.96 + planetoid.miningHeat * 0.12);
        }

        for (const crystal of crystals) {
          crystal.age += dt;
          crystal.vx *= Math.exp(-0.72 * dt);
          crystal.vy *= Math.exp(-0.72 * dt);
          crystal.x += crystal.vx * dt;
          crystal.y += crystal.vy * dt;
          crystal.view.position.set(crystal.x, crystal.y);
          crystal.view.rotation += dt * (1.05 + (crystal.phase % 0.8));
          crystal.view.scale.set(1 + Math.sin(crystal.age * 4.6 + crystal.phase) * 0.065);
          crystal.halo.rotation = -crystal.view.rotation * 0.78;
          crystal.halo.scale.set(0.94 + Math.sin(crystal.age * 3.5 + crystal.phase) * 0.08);
          crystal.glint.rotation = -crystal.view.rotation + (localReducedFx ? 0 : crystal.age * 0.42);
          crystal.glint.alpha = localReducedFlashing ? 0.46 : 0.38 + Math.sin(crystal.age * 4.2 + crystal.phase) * 0.22;
          const crystalSpeed = Math.hypot(crystal.vx, crystal.vy);
          crystal.trail.rotation = Math.atan2(crystal.vy, crystal.vx) - crystal.view.rotation;
          crystal.trail.alpha = clamp(crystalSpeed / 110, 0.08, 0.62) * localEffectIntensity;
          crystal.trail.scale.x = 0.68 + clamp(crystalSpeed / 120, 0, 1) * 0.72;
          if (circlesOverlap(player, crystal)) {
            crystal.dead = true;
            if (tutorialTarget?.id === crystal.id) tutorialTarget = undefined;
            charges = Math.min(RULES.maxCharges, charges + 1);
            score += 200;
            applyTutorialEvent("shard-collected");
            audio.crystal(panFor(crystal.x));
            spawnImpactFx(crystal.x, crystal.y, 0x69f3ff, 34, 0.32);
            spawnBurst(crystal.x, crystal.y, 0x69f3ff, 14, 0.55);
          }
        }

        for (const fabricator of fabricators) {
          let tx = engine.x;
          let ty = engine.y;
          let miningActive = false;
          if (!fabricator.carrying) {
            let target = crystals.find((crystal) => crystal.id === fabricator.targetId && !crystal.dead && crystal.claimedBy === fabricator.id);
            if (tutorialActiveRef.current && tutorialRuntimeRef.current.step === "collect") {
              if (target) target.claimedBy = undefined;
              target = undefined;
              fabricator.targetId = undefined;
            }
            if (!target) {
              const availableCrystals = tutorialActiveRef.current && tutorialRuntimeRef.current.step === "collect"
                ? []
                : crystals.filter((crystal) => !crystal.claimedBy);
              target = nearest(fabricator, availableCrystals);
              if (target) {
                target.claimedBy = fabricator.id;
                fabricator.targetId = target.id;
              }
            }
            if (target) {
              tx = target.x;
              ty = target.y;
              if (circlesOverlap(fabricator, target)) {
                target.dead = true;
                fabricator.carrying = true;
                fabricator.targetId = undefined;
              }
            } else {
              const rock = nearest(fabricator, planetoids.filter((candidate) => !candidate.dead && candidate.shards > 0));
              if (rock) {
                tx = rock.x;
                ty = rock.y;
                if (distance(fabricator.x, fabricator.y, rock.x, rock.y) < rock.radius + 70) {
                  miningActive = true;
                  fabricator.miningTimer -= dt;
                  const beamX = rock.x - fabricator.x;
                  const beamY = rock.y - fabricator.y;
                  fabricator.beam.rotation = -fabricator.view.rotation;
                  fabricator.beam.clear()
                    .moveTo(0, 0).lineTo(beamX, beamY)
                    .stroke({ color: 0xff6f35, width: 9, alpha: 0.07 })
                    .moveTo(0, 0).lineTo(beamX, beamY)
                    .stroke({ color: 0xffa258, width: 2.2, alpha: 0.64 })
                    .moveTo(0, 0).lineTo(beamX, beamY)
                    .stroke({ color: 0xfff0c5, width: 0.75, alpha: 0.8 });
                  for (let node = 1; node <= 3; node += 1) {
                    const t = (node / 4 + motionClock * 0.8) % 1;
                    fabricator.beam.circle(beamX * t, beamY * t, 2.4)
                      .fill({ color: 0xffd79e, alpha: 0.54 });
                  }
                  if (fabricator.miningTimer <= 0) {
                    fabricator.miningTimer = 2.5 + rng() * 1.6;
                    rock.shards = Math.max(0, rock.shards - 1);
                    rock.integrity = Math.max(0, rock.integrity - 7);
                    rock.miningHeat = 1;
                    syncPlanetoidDamage(rock);
                    fabricator.carrying = true;
                    spawnBurst(rock.x, rock.y, 0xff9a4b, 8, 0.36);
                    if (rock.integrity <= 0) {
                      rock.dead = true;
                      spawnWreckage(rock.x, rock.y, 0xc49b72, rock.radius * 0.42, 8, 7);
                    }
                  }
                } else fabricator.beam.clear();
              }
            }
          }
          if (fabricator.carrying) {
            tx = engine.x;
            ty = engine.y;
            fabricator.beam.clear();
            if (distance(fabricator.x, fabricator.y, engine.x, engine.y) < engine.radius + 55) depositPiece(fabricator);
          }
          steer(fabricator, tx, ty, engine.active ? 188 : 148, dt);
          fabricator.x += fabricator.vx * dt;
          fabricator.y += fabricator.vy * dt;
          fabricator.view.position.set(fabricator.x, fabricator.y);
          fabricator.view.rotation = Math.atan2(fabricator.vy, fabricator.vx);
          fabricator.beam.rotation = -fabricator.view.rotation;
          fabricator.view.scale.set(fabricator.carrying ? 1.18 : 1);
          fabricator.hull.rotation = Math.sin(motionClock * 3.1 + fabricator.phase) * 0.025;
          fabricator.hull.y = Math.sin(motionClock * 4.3 + fabricator.phase) * 0.65;
          const clawCycle = miningActive
            ? 0.11 + Math.sin(motionClock * 8.5 + fabricator.phase) * 0.1
            : fabricator.carrying ? -0.16 : 0;
          fabricator.upperClaw.rotation = clawCycle;
          fabricator.lowerClaw.rotation = -clawCycle;
          fabricator.claws.x = miningActive ? 3.5 : 0;
          fabricator.scanner.visible = !fabricator.carrying;
          fabricator.scanner.rotation = localReducedFx ? 0 : Math.sin(motionClock * 1.9 + fabricator.phase) * 0.22;
          fabricator.scanner.alpha = miningActive ? 0.92 : 0.32;
          fabricator.cargoGlow.visible = fabricator.carrying;
          fabricator.cargoGlow.alpha = fabricator.carrying ? 0.72 + Math.sin(motionClock * 5 + fabricator.phase) * 0.2 : 0;
          fabricator.engineFlare.scale.x = 0.78 + clamp(Math.hypot(fabricator.vx, fabricator.vy) / 190, 0, 1) * 0.46;
          fabricator.engineFlare.alpha = 0.45 + Math.sin(motionClock * 7 + fabricator.phase) * 0.1;
        }

        for (const sentinel of sentinels) {
          const dx = player.x - sentinel.x;
          const dy = player.y - sentinel.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const tangentX = (-dy / d) * sentinel.orbit;
          const tangentY = (dx / d) * sentinel.orbit;
          const desiredDistance = engine.active ? 560 : 720;
          const radial = clamp((d - desiredDistance) / desiredDistance, -0.6, 1);
          const targetX = sentinel.x + (dx / d) * 360 * radial + tangentX * 280;
          const targetY = sentinel.y + (dy / d) * 360 * radial + tangentY * 280;
          steer(sentinel, targetX, targetY, engine.active ? 290 : 235, dt);
          sentinel.x += sentinel.vx * dt;
          sentinel.y += sentinel.vy * dt;
          sentinel.view.position.set(sentinel.x, sentinel.y);
          sentinel.view.rotation = Math.atan2(dy, dx);
          sentinel.shotPulse = Math.max(0, sentinel.shotPulse - dt * 6.5);
          let bankAngle = Math.atan2(sentinel.vy, sentinel.vx) - sentinel.view.rotation;
          while (bankAngle > Math.PI) bankAngle -= Math.PI * 2;
          while (bankAngle < -Math.PI) bankAngle += Math.PI * 2;
          sentinel.hull.rotation = clamp(bankAngle, -0.75, 0.75) * 0.16
            + Math.sin(motionClock * 3.8 + sentinel.phase) * 0.012;
          sentinel.hull.x = -sentinel.shotPulse * 4.5;
          sentinel.hull.scale.y = 1 + Math.sin(motionClock * 5.1 + sentinel.phase) * 0.018;
          sentinel.shield.visible = sentinel.health > 1;
          sentinel.shield.rotation = motionClock * 0.72 * sentinel.orbit;
          const charge = d < 1450 ? clamp((0.42 - sentinel.fireTimer) / 0.42, 0, 1) : 0;
          sentinel.chargeMarks.alpha = charge * (localReducedFlashing ? 0.58 : 0.72 + Math.sin(motionClock * 12) * 0.2);
          sentinel.chargeMarks.scale.set(0.82 + charge * 0.22);
          sentinel.weaponCore.scale.set(0.92 + Math.sin(motionClock * 6.4 + sentinel.phase) * 0.08 + charge * 0.24);
          sentinel.weaponCore.alpha = 0.72 + Math.sin(motionClock * 5.7 + sentinel.phase) * 0.2;
          sentinel.shield.scale.set(1 - charge * 0.07);
          sentinel.engineFlare.scale.x = 0.74 + clamp(Math.hypot(sentinel.vx, sentinel.vy) / 300, 0, 1) * 0.44;
          sentinel.engineFlare.scale.y = sentinel.health > 1 ? 1 : 0.54;
          sentinel.engineFlare.y = sentinel.health > 1 ? 0 : 4.5;
          sentinel.engineFlare.rotation = sentinel.health > 1 ? 0 : -0.08;
          sentinel.engineFlare.alpha = 0.48 + Math.sin(motionClock * 8.2 + sentinel.phase) * 0.1;
          sentinel.fireTimer -= dt;
          if (sentinel.fireTimer <= 0 && d < 1450) {
            sentinel.fireTimer = (engine.active ? 0.82 : 1.25) + rng() * 0.7;
            const aim = Math.atan2(dy, dx) + (rng() - 0.5) * 0.11;
            spawnProjectile("bolt", sentinel.x, sentinel.y, Math.cos(aim) * 385, Math.sin(aim) * 385);
            sentinel.shotPulse = 1;
          }
        }

        if (engine.active && !engine.destroyed) {
          steer(engine, player.x, player.y, 310 + zone * 13, dt);
          engine.x += engine.vx * dt;
          engine.y += engine.vy * dt;
          if (circlesOverlap(player, engine)) killPlayer();
        }
        engine.view.position.set(engine.x, engine.y);
        const behaviorPhase = motionClock % 5.1;
        const lockPhase = engine.active && behaviorPhase >= 2.35 && behaviorPhase < 3.05;
        const surgePhase = engine.active && behaviorPhase >= 3.05 && behaviorPhase < 3.92;
        const ventPhase = engine.active && behaviorPhase >= 3.92;
        const pursuitCadence = lockPhase ? 1.42 : surgePhase ? 1.78 : ventPhase ? 0.62 : 1;
        engine.outerRing.rotation += dt * (engine.active ? 0.72 * pursuitCadence : 0.09);
        engine.innerRing.rotation -= dt * (engine.active ? 1.08 * pursuitCadence : 0.13);
        engine.energyCage.rotation += dt * (engine.active ? 0.23 * (ventPhase ? 1.7 : 1) : 0.035);
        engine.aperture.rotation -= dt * (engine.active ? 0.58 * pursuitCadence : 0.08);
        engine.threatHalo.rotation += dt * (engine.active ? -0.18 : -0.035);
        const apertureDeploy = engine.destroyed ? 0.18 : engine.active ? lockPhase ? 0.58 : ventPhase ? 1.14 : 1 : pieces / RULES.enginePieces;
        engine.apertureBlades.forEach((blade, index) => {
          const angle = (index / engine.apertureBlades.length) * Math.PI * 2;
          const offset = apertureDeploy * 9.5;
          blade.position.set(Math.cos(angle) * offset, Math.sin(angle) * offset);
        });
        const corePulse = engine.active ? 1 + Math.sin(motionClock * 7.6) * 0.065 : 0.88 + (pieces / RULES.enginePieces) * 0.12;
        engine.core.scale.set(corePulse);
        engine.coreHalo.scale.set(0.94 + Math.sin(motionClock * 4.2) * (engine.active ? 0.08 : 0.025));
        engine.forgeAura.scale.set(0.92 + (pieces / RULES.enginePieces) * 0.08 + (engine.active ? Math.sin(motionClock * 1.6) * 0.025 : 0));
        if (!engine.destroyed) {
          const targetAngle = Math.atan2(player.y - engine.y, player.x - engine.x);
          engine.weaponArms.forEach((arm, index) => {
            const desired = targetAngle + (index - 1) * (lockPhase ? 0.08 : 0.24);
            let diff = desired - arm.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            arm.rotation += diff * Math.min(1, dt * (lockPhase ? 6.5 : 2.4));
            arm.scale.set(1 + (surgePhase ? 0.08 : 0), 1 - (lockPhase ? 0.08 : 0));
          });
        }
        const engineSpeed = Math.max(1, Math.hypot(engine.vx, engine.vy));
        const engineNx = engine.vx / engineSpeed;
        const engineNy = engine.vy / engineSpeed;
        engine.driveVents.forEach((vent, index) => {
          const angle = (index / engine.driveVents.length) * Math.PI * 2 + 0.17;
          const opposing = Math.max(0, -(Math.cos(angle) * engineNx + Math.sin(angle) * engineNy));
          vent.alpha = engine.destroyed ? 0.04 : 0.08 + opposing * (surgePhase ? 0.92 : engine.active ? 0.58 : 0.12);
          vent.scale.set(0.9 + opposing * (surgePhase ? 0.42 : 0.18));
        });
        engine.sensorArray.rotation += dt * (engine.active ? lockPhase ? -1.1 : 0.34 : 0.08);
        engine.conduitPulse.alpha = engine.destroyed
          ? 0.05
          : (engine.active ? 0.48 + visualPulse * (localReducedFlashing ? 0.08 : 0.34) : 0.12 + (pieces / RULES.enginePieces) * 0.38);
        engine.targetingBeam.clear();
        if (engine.active && !engine.destroyed) {
          const beamX = player.x - engine.x;
          const beamY = player.y - engine.y;
          const beamLength = Math.max(1, Math.hypot(beamX, beamY));
          const ux = beamX / beamLength;
          const uy = beamY / beamLength;
          const beamAlpha = localReducedFx ? 0.08 : 0.095 + visualPulse * 0.045 + (lockPhase ? 0.05 : 0);
          for (let segment = 0; segment < 10; segment += 1) {
            if (engine.health <= 5 && segment % 4 === Math.floor(motionClock * 3) % 4) continue;
            const start = 88 + segment * Math.max(22, (beamLength - 140) / 10);
            const end = Math.min(beamLength - 36, start + Math.max(10, (beamLength - 140) / 20));
            if (end <= start) continue;
            engine.targetingBeam.moveTo(ux * start, uy * start)
              .lineTo(ux * end, uy * end)
              .stroke({ color: segment % 2 ? 0xc276ff : 0xff7a58, width: segment % 3 === 0 ? 1.4 : 0.8, alpha: beamAlpha });
          }
          engine.targetingBeam.circle(beamX, beamY, 22)
            .stroke({ color: 0xff9a73, width: 1.2, alpha: beamAlpha * 1.5 });
        }
        if (engine.active && !engine.destroyed && rng() < dt * 7 * localEffectIntensity) {
          const angle = rng() * Math.PI * 2;
          const radius = 72 + rng() * 92;
          spawnBurst(engine.x + Math.cos(angle) * radius, engine.y + Math.sin(angle) * radius, rng() < 0.5 ? 0xb76dff : 0xff8150, 2, 0.2);
        }

        for (const projectile of projectiles) {
          projectile.age += dt;
          if (projectile.age >= projectile.lifetime) { projectile.dead = true; continue; }
          if (projectile.kind === "nova" && engine.active && !engine.destroyed) {
            const velocity = homingVelocity(projectile, engine, 565, 3.35, dt);
            projectile.vx = velocity.vx;
            projectile.vy = velocity.vy;
          }
          projectile.x += projectile.vx * dt;
          projectile.y += projectile.vy * dt;
          projectile.view.position.set(projectile.x, projectile.y);
          projectile.view.rotation = Math.atan2(projectile.vy, projectile.vx);
          const projectileLife = 1 - projectile.age / projectile.lifetime;
          projectile.trail.alpha = clamp(projectileLife * (projectile.kind === "nova" ? 0.82 : 0.62), 0, 0.82)
            * localEffectIntensity;
          projectile.trail.scale.x = 0.82 + Math.sin(projectile.age * (projectile.kind === "bolt" ? 15 : 9)) * 0.08;
          if (projectile.accent) {
            projectile.accent.rotation = projectile.age * (projectile.kind === "nova" ? 2.4 : 3.8);
            projectile.accent.scale.set(0.94 + Math.sin(projectile.age * 11) * 0.06);
            if (projectile.kind === "nova" && projectile.accent.children[1]) {
              projectile.accent.children[1].rotation = -projectile.age * 5.2;
            }
          }
          if (projectile.kind === "nova" && rng() < dt * 14 * localEffectIntensity) {
            spawnBurst(
              projectile.x - Math.cos(projectile.view.rotation) * 22,
              projectile.y - Math.sin(projectile.view.rotation) * 22,
              projectile.age % 0.26 < 0.13 ? 0xa56dff : 0xff9458,
              1,
              0.14,
            );
          }

          if (projectile.kind === "bolt") {
            if (circlesOverlap(projectile, player)) {
              projectile.dead = true;
              killPlayer();
            }
            continue;
          }

          if (projectile.kind === "laser") {
            for (const planetoid of planetoids) {
              if (planetoid.dead || !circlesOverlap(projectile, planetoid)) continue;
              projectile.dead = true;
              const result = minePlanetoid(planetoid, performance.now());
              planetoid.integrity = result.planetoid.integrity;
              planetoid.shards = result.planetoid.shards;
              planetoid.miningProgress = result.planetoid.miningProgress;
              planetoid.lastHitAt = result.planetoid.lastHitAt;
              planetoid.miningHeat = 1;
              syncPlanetoidDamage(planetoid);
              spawnBurst(projectile.x, projectile.y, 0xffa251, 6, 0.3);
              if (result.emitted) {
                const tutorialCrystalAngle = Math.atan2(player.y - projectile.y, player.x - projectile.x);
                const crystal = tutorialActiveRef.current
                  ? spawnCrystal(projectile.x, projectile.y, tutorialCrystalAngle)
                  : spawnCrystal(projectile.x, projectile.y);
                if (tutorialActiveRef.current) tutorialTarget = crystal;
                applyTutorialEvent("shard-extracted");
              }
              if (result.destroyed) {
                planetoid.dead = true;
                score += 5;
                spawnImpactFx(planetoid.x, planetoid.y, 0xff9a58, planetoid.radius * 1.15, 0.7);
                spawnBurst(planetoid.x, planetoid.y, 0xc4a07b, 35, 0.9);
                spawnWreckage(planetoid.x, planetoid.y, 0xb79b7d, planetoid.radius * 0.48, 10, 7.5);
                audio.explosion(0.35, panFor(planetoid.x));
              }
              break;
            }
            if (projectile.dead) continue;
            for (const fabricator of fabricators) {
              if (!fabricator.dead && circlesOverlap(projectile, fabricator)) {
                projectile.dead = true;
                fabricator.dead = true;
                if (fabricator.carrying) spawnCrystal(fabricator.x, fabricator.y);
                score += 150;
                spawnImpactFx(fabricator.x, fabricator.y, 0xff8a48, 68, 0.58);
                spawnBurst(fabricator.x, fabricator.y, 0xff8a48, 26, 0.7);
                spawnWreckage(fabricator.x, fabricator.y, 0xff8a48, 24, 6, 4.8);
                audio.explosion(0.25, panFor(fabricator.x));
                break;
              }
            }
            if (projectile.dead) continue;
            for (const sentinel of sentinels) {
              if (!sentinel.dead && circlesOverlap(projectile, sentinel)) {
                projectile.dead = true;
                sentinel.health -= 1;
                sentinel.damageLayer.visible = sentinel.health < 2;
                spawnBurst(sentinel.x, sentinel.y, 0x9089ff, 12, 0.45);
                if (sentinel.health <= 0) {
                  sentinel.dead = true;
                  score += 500;
                  audio.explosion(0.45, panFor(sentinel.x));
                  spawnImpactFx(sentinel.x, sentinel.y, 0xa36cff, 84, 0.72);
                  spawnBurst(sentinel.x, sentinel.y, 0x7e8fff, 30, 0.8);
                  spawnWreckage(sentinel.x, sentinel.y, 0xa36cff, 29, 7, 5.2);
                }
                break;
              }
            }
          }

          if (projectile.kind === "nova") {
            if (engine.active && !engine.destroyed && circlesOverlap(projectile, engine)) {
              projectile.dead = true;
              engine.health = Math.max(0, engine.health - 1);
              score += 500;
              audio.bossHit(panFor(engine.x));
              shake = Math.max(shake, localReducedFx ? 4 : 16);
              spawnImpactFx(projectile.x, projectile.y, engine.health % 2 ? 0xff8846 : 0xb56bff, 96, 0.78);
              triggerShockwave(projectile.x, projectile.y, 0.48, 0.4);
              spawnBurst(projectile.x, projectile.y, engine.health % 2 ? 0xff8846 : 0xb56bff, 38, 0.8);
              syncEngineParts();
              if (engine.health <= 0) destroyEngine();
              continue;
            }
            if (projectile.age > 0.2) {
              const interceptedByRock = planetoids.some((rock) => !rock.dead && circlesOverlap(projectile, rock));
              const interceptor = sentinels.find((sentinel) => !sentinel.dead && circlesOverlap(projectile, sentinel));
              if (interceptedByRock || interceptor) {
                projectile.dead = true;
                if (interceptor) interceptor.dead = true;
                spawnImpactFx(projectile.x, projectile.y, 0xffb45b, 92, 0.72);
                spawnBurst(projectile.x, projectile.y, 0xffb45b, 42, 0.85);
                audio.explosion(0.5, panFor(projectile.x));
                notify("NOVA CHARGE INTERCEPTED", true);
              }
            }
          }
        }

        for (const fragment of wreckage) {
          fragment.age += dt;
          if (fragment.age >= fragment.lifetime) { fragment.dead = true; continue; }
          fragment.vx *= Math.exp(-0.34 * dt);
          fragment.vy *= Math.exp(-0.34 * dt);
          fragment.x += fragment.vx * dt;
          fragment.y += fragment.vy * dt;
          fragment.view.position.set(fragment.x, fragment.y);
          fragment.view.rotation += fragment.spin * dt;
          const progress = fragment.age / fragment.lifetime;
          const fade = progress < fragment.fadeStart
            ? 1
            : 1 - (progress - fragment.fadeStart) / Math.max(0.01, 1 - fragment.fadeStart);
          fragment.view.alpha = clamp(fade, 0, 1);
          fragment.ember.alpha = clamp((1 - progress * 1.3) * (localReducedFlashing ? 0.48 : 0.76), 0, 0.76);
        }

        for (const particle of particles) {
          particle.age += dt;
          if (particle.age >= particle.lifetime) { particle.dead = true; continue; }
          particle.vx *= Math.exp(-particle.drag * dt);
          particle.vy *= Math.exp(-particle.drag * dt);
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.view.position.set(particle.x, particle.y);
          particle.view.rotation += particle.spin * dt;
          const life = 1 - particle.age / particle.lifetime;
          const progress = 1 - life;
          particle.view.alpha = Math.pow(life, particle.fadePower);
          particle.view.scale.set(lerp(particle.startScale, particle.endScale, progress));
        }

        for (const effect of impactFx) {
          effect.age += dt;
          if (effect.age >= effect.lifetime) { effect.dead = true; continue; }
          const progress = effect.age / effect.lifetime;
          const eased = 1 - Math.pow(1 - progress, 3);
          effect.view.scale.set(lerp(effect.startScale, effect.endScale, eased));
          effect.view.rotation += effect.spin * dt;
          effect.view.alpha = Math.pow(1 - progress, 1.35);
        }

        respawnSentinelTimer -= dt;
        respawnFabricatorTimer -= dt;
        if (respawnSentinelTimer <= 0 && sentinels.filter((item) => !item.dead).length < 4 + zone * 2) {
          const angle = rng() * Math.PI * 2;
          spawnSentinel(player.x + Math.cos(angle) * 1300, player.y + Math.sin(angle) * 1300);
          respawnSentinelTimer = 4.5 + rng() * 4;
        }
        if (respawnFabricatorTimer <= 0 && fabricators.filter((item) => !item.dead).length < 5 + zone) {
          const angle = rng() * Math.PI * 2;
          spawnFabricator(engine.x + Math.cos(angle) * 650, engine.y + Math.sin(angle) * 650);
          respawnFabricatorTimer = 7 + rng() * 5;
        }

        if (engine.destroyed && victoryTimer > 0) {
          victoryTimer -= dt;
          if (rng() < dt * 5) {
            spawnBurst(engine.x + (rng() - 0.5) * 210, engine.y + (rng() - 0.5) * 210, rng() < 0.5 ? 0xff8c45 : 0xb765ff, 16, 0.75);
          }
          if (victoryTimer <= 0 && !holdShowcase) {
            zone += 1;
            const savedScore = score;
            const savedLives = lives;
            const savedCharges = charges;
            resetWorld(false);
            score = savedScore;
            lives = savedLives;
            charges = savedCharges;
            notify(`FIELD 0${zone} · PRESSURE FRONT`);
          }
        }

        sweepDead();
      };

      const updateView = (dt: number) => {
        const width = app?.screen.width ?? host.clientWidth;
        const height = app?.screen.height ?? host.clientHeight;
        const viewportRatio = Math.min(width / 1920, height / 1080);
        const compactViewport = width < 1050 || height < 620;
        const presentationFloor = compactViewport ? (height > width ? 0.48 : 0.52) : 0.85;
        const overlayScale = clamp(viewportRatio, compactViewport ? 0.58 : 0.82, 2);
        const visualRhythm = audio.getVisualPulse(motionClock);
        if (dt > 0) {
          const frameHeadroom = dt <= 0.0185 ? 1 : dt >= 0.024 ? 0 : 1 - (dt - 0.0185) / 0.0055;
          renderHeadroom = lerp(renderHeadroom, frameHeadroom, Math.min(1, dt * 1.6));
        }
        const rendererResolution = app?.renderer.resolution ?? 1;
        const actualRenderPixels = width * height * rendererResolution * rendererResolution;
        const microDetailThreshold = microDetailEnabled ? 0.38 : 0.62;
        const nextMicroDetail = actualRenderPixels >= 8_000_000
          && renderHeadroom >= microDetailThreshold
          && !highContrastRef.current;
        if (nextMicroDetail !== microDetailEnabled) {
          microDetailEnabled = nextMicroDetail;
          for (const detail of microDetailViews) detail.visible = microDetailEnabled;
        }
        const bgScale = Math.max(width / background.texture.width, height / background.texture.height) * 1.04;
        background.scale.set(bgScale);
        background.x = (width - background.texture.width * bgScale) / 2 - (cameraX - RULES.worldWidth / 2) * 0.006;
        background.y = (height - background.texture.height * bgScale) / 2 - (cameraY - RULES.worldHeight / 2) * 0.006;

        const playerSpeed = Math.hypot(player.vx, player.vy);
        const speedRatio = clamp(playerSpeed / 535, 0, 1);
        const bossPresent = engine.active && !engine.destroyed;
        const assemblyPressure = engine.destroyed ? 0 : pieces / RULES.enginePieces;
        if (localMode !== "title") {
          const leadAmount = 0.34 + speedRatio * 0.1;
          const leadX = localReducedFx ? 0 : player.vx * leadAmount;
          const leadY = localReducedFx ? 0 : player.vy * leadAmount;
          let focusX = player.x + leadX;
          let focusY = player.y + leadY;
          const bossDistance = distance(player.x, player.y, engine.x, engine.y);
          const activeInfluence = bossPresent ? clamp(1 - bossDistance / 2200, 0, 0.38) : 0;
          const buildInfluence = !bossPresent && assemblyPressure > 0.55
            ? clamp((assemblyPressure - 0.55) * 0.48, 0, 0.2)
            : 0;
          const bossInfluence = localReducedFx ? Math.min(activeInfluence + buildInfluence, 0.24) : activeInfluence + buildInfluence;
          focusX = lerp(focusX, engine.x, bossInfluence);
          focusY = lerp(focusY, engine.y, bossInfluence);
          const revealInfluence = localReducedFx ? 0 : clamp(activationPulse / 2.2, 0, 1) * 0.34;
          focusX = lerp(focusX, engine.x, revealInfluence);
          focusY = lerp(focusY, engine.y, revealInfluence);
          const follow = dt > 0 ? 1 - Math.exp(-dt * 3.8) : 1;
          cameraX = lerp(cameraX, focusX, follow);
          cameraY = lerp(cameraY, focusY, follow);
        } else {
          cameraX = lerp(cameraX, player.x + 260, dt * 0.12);
          cameraY = lerp(cameraY, player.y, dt * 0.12);
          player.view.rotation += dt * 0.08;
          engine.outerRing.rotation += dt * 0.06;
          engine.innerRing.rotation -= dt * 0.08;
          engine.energyCage.rotation += dt * 0.025;
          engine.aperture.rotation -= dt * 0.035;
        }

        const velocityAngle = playerSpeed > 1 ? Math.atan2(player.vy, player.vx) : player.angle;
        const starStretch = localReducedFx ? 0 : clamp((speedRatio - 0.5) / 0.5, 0, 1) * localEffectIntensity;
        const hazeWidth = width * 1.3;
        const hazeHeight = height * 1.25;
        for (const wisp of haze) {
          const drift = localReducedFx ? 0 : Math.sin(motionClock * 0.08 + wisp.phase) * 26;
          wisp.view.x = ((wisp.x * hazeWidth - cameraX * wisp.factor + drift) % hazeWidth + hazeWidth) % hazeWidth - width * 0.15;
          wisp.view.y = ((wisp.y * hazeHeight - cameraY * wisp.factor * 0.72) % hazeHeight + hazeHeight) % hazeHeight - height * 0.12;
          const hazeScale = wisp.scale * clamp(Math.min(width / 1920, height / 1080), 0.72, 1.7);
          wisp.view.scale.set(hazeScale * (1 + assemblyPressure * 0.05));
          wisp.view.alpha = (0.72 + assemblyPressure * 0.28) * localEffectIntensity;
        }
        for (const star of stars) {
          star.view.x = ((star.x * width - cameraX * star.factor) % width + width) % width;
          star.view.y = ((star.y * height - cameraY * star.factor) % height + height) % height;
          star.view.rotation = velocityAngle;
          star.view.scale.set(1 + starStretch * star.factor * 40, 1);
          star.view.alpha = localReducedFlashing
            ? 0.88
            : 0.72 + Math.sin(motionClock * star.twinkle + star.phase) * 0.2;
        }
        for (const mote of dust) {
          mote.view.x = ((mote.x * width - cameraX * mote.factor) % width + width) % width;
          mote.view.y = ((mote.y * height - cameraY * mote.factor) % height + height) % height;
          mote.view.rotation = velocityAngle;
          mote.view.scale.set(0.8 + speedRatio * mote.factor * 8, 1);
        }
        for (const fragment of farDebris) {
          fragment.view.x = ((fragment.x * width - cameraX * fragment.factor) % width + width) % width;
          fragment.view.y = ((fragment.y * height - cameraY * fragment.factor) % height + height) % height;
          fragment.view.rotation += dt * fragment.spin;
          fragment.view.scale.set(0.82 + speedRatio * fragment.factor * 1.4, 1);
        }
        for (const fragment of nearDebris) {
          fragment.view.x = ((fragment.x * width - cameraX * fragment.factor) % width + width) % width;
          fragment.view.y = ((fragment.y * height - cameraY * fragment.factor) % height + height) % height;
          fragment.view.rotation += dt * fragment.spin;
          const stretch = fragment.scale * (0.9 + speedRatio * 0.32);
          fragment.view.scale.set(stretch + starStretch * 0.16, stretch);
        }
        for (const landmark of landmarks) {
          landmark.movingPart.rotation += dt * landmark.spin;
          landmark.beacon.alpha = localReducedFlashing
            ? 0.42
            : 0.28 + Math.sin(motionClock * 1.8 + landmark.phase) * 0.16 + visualRhythm * 0.12;
          landmark.view.scale.set(0.98 + visualRhythm * 0.012);
        }
        storyLayer.alpha = highContrastRef.current ? 0.22 : 0.62 + assemblyPressure * 0.2;

        const speedFx = localReducedFx || highContrastRef.current
          ? 0
          : clamp((speedRatio - 0.58) / 0.42, 0, 1) * localEffectIntensity;
        speedLayer.visible = speedFx > 0.01;
        if (speedLayer.visible) {
          speedLayer.position.set(
            width * 0.5 - Math.cos(velocityAngle) * 92 * speedFx,
            height * 0.5 - Math.sin(velocityAngle) * 92 * speedFx,
          );
          speedLayer.rotation = velocityAngle * 0.08;
          speedLayer.scale.set(overlayScale * (0.88 + speedFx * 0.48));
          speedLayer.alpha = speedFx * 0.24;
          speedStreaks.forEach((streak, index) => {
            streak.scale.set(1 + speedFx * (2.4 + (index % 4) * 0.42), 1);
          });
        }

        const bossDistance = distance(player.x, player.y, engine.x, engine.y);
        const nearbyThreats = sentinels.reduce((count, sentinel) => (
          !sentinel.dead && distance(player.x, player.y, sentinel.x, sentinel.y) < 1350 ? count + 1 : count
        ), 0);
        let desiredZoom = 0.91 - Math.max(0, assemblyPressure - 0.55) * 0.07;
        if (bossPresent) {
          const bossPressure = clamp(1 - bossDistance / 2600, 0, 1);
          const crowdPressure = clamp(nearbyThreats / 14, 0, 1);
          desiredZoom = clamp(0.9 - bossPressure * 0.12 - crowdPressure * 0.045, 0.735, 0.86);
        }
        if (!localReducedFx) desiredZoom -= clamp(activationPulse / 2.2, 0, 1) * 0.045;
        if (!localReducedFx) desiredZoom -= clamp((speedRatio - 0.62) / 0.38, 0, 1) * 0.032;
        if (localReducedFx) desiredZoom = bossPresent ? 0.82 : 0.88;
        const zoomFollow = dt > 0 ? 1 - Math.exp(-dt * 1.8) : 1;
        cameraZoom = lerp(cameraZoom, desiredZoom, zoomFollow);
        activationPulse = Math.max(0, activationPulse - dt);
        shake = Math.max(0, shake - dt * 45);
        const trauma = clamp(shake / 48, 0, 1);
        const shakeX = localReducedFx || dt <= 0 ? 0 : Math.sin(motionClock * 37.4) * trauma * trauma * 19;
        const shakeY = localReducedFx || dt <= 0 ? 0 : Math.sin(motionClock * 29.1 + 1.7) * trauma * trauma * 15;
        const presentationScale = clamp(viewportRatio, presentationFloor, 2);
        const worldScale = cameraZoom * presentationScale;
        const cameraCenterY = compactViewport && height > width ? height * 0.43 : height * 0.5;
        world.scale.set(worldScale);
        world.position.set(width / 2 - cameraX * worldScale + shakeX, cameraCenterY - cameraY * worldScale + shakeY);

        if (app) app.stage.filterArea = app.screen;
        const cssPixels = width * height;
        postFx.resolution = cssPixels >= 7_000_000 ? 0.5 : cssPixels >= 3_500_000 ? 0.67 : 1;
        const projectedBossX = (world.position.x + engine.x * worldScale) / width;
        const projectedBossY = (world.position.y + engine.y * worldScale) / height;
        const bossOnScreen = bossPresent
          && projectedBossX > -0.08 && projectedBossX < 1.08
          && projectedBossY > -0.08 && projectedBossY < 1.08;
        const heatWorldX = bossOnScreen ? engine.x : player.x - Math.cos(player.angle) * 34;
        const heatWorldY = bossOnScreen ? engine.y : player.y - Math.sin(player.angle) * 34;
        const heatX = (world.position.x + heatWorldX * worldScale) / width;
        const heatY = (world.position.y + heatWorldY * worldScale) / height;
        shockwaveAge += dt;
        const shockProgress = clamp(shockwaveAge / Math.max(shockwaveDuration, 0.001), 0, 1);
        const shockX = (world.position.x + shockwaveX * worldScale) / width;
        const shockY = (world.position.y + shockwaveY * worldScale) / height;
        const damageDanger = bossPresent ? 0.16 + (1 - engine.health / RULES.engineHits) * 0.62 : 0;
        const danger = Math.max(
          clamp(activationPulse / 2.2, 0, 0.82),
          clamp(shake / 48, 0, 0.72),
          damageDanger,
        );
        background.tint = highContrastRef.current ? 0xffffff : bossPresent ? 0xeee7ff : assemblyPressure > 0.65 ? 0xfff4ed : 0xffffff;
        threatFrame.clear();
        const frameAlpha = danger * localEffectIntensity * (localReducedFlashing ? 0.26 : 0.34);
        if (frameAlpha > 0.025) {
          const inset = clamp(Math.min(width, height) * 0.035, 24, 58);
          const arm = clamp(Math.min(width, height) * 0.07, 36, 92);
          const frameColor = highContrastRef.current ? 0xffd7c2 : 0xff755f;
          threatFrame.moveTo(inset, inset + arm).lineTo(inset, inset).lineTo(inset + arm, inset)
            .stroke({ color: frameColor, width: 2.2, alpha: frameAlpha });
          threatFrame.moveTo(width - inset - arm, inset).lineTo(width - inset, inset).lineTo(width - inset, inset + arm)
            .stroke({ color: frameColor, width: 2.2, alpha: frameAlpha });
          threatFrame.moveTo(inset, height - inset - arm).lineTo(inset, height - inset).lineTo(inset + arm, height - inset)
            .stroke({ color: frameColor, width: 2.2, alpha: frameAlpha });
          threatFrame.moveTo(width - inset - arm, height - inset).lineTo(width - inset, height - inset).lineTo(width - inset, height - inset - arm)
            .stroke({ color: frameColor, width: 2.2, alpha: frameAlpha });
        }
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const edgePoint = (rawX: number, rawY: number, inset: number) => {
          const dx = rawX - centerX;
          const dy = rawY - centerY;
          const limitX = Math.max(1, width * 0.5 - inset);
          const limitY = Math.max(1, height * 0.5 - inset);
          const scale = Math.min(limitX / Math.max(0.001, Math.abs(dx)), limitY / Math.max(0.001, Math.abs(dy)));
          const edgeX = centerX + dx * Math.min(1, scale);
          let edgeY = centerY + dy * Math.min(1, scale);
          if (compactViewport && edgeY > height * 0.68) {
            edgeY = Math.min(edgeY, height - Math.min(144, height * 0.31));
          }
          return {
            x: edgeX,
            y: edgeY,
            angle: Math.atan2(dy, dx),
          };
        };
        const rawBossX = projectedBossX * width;
        const rawBossY = projectedBossY * height;
        const engineOnScreen = projectedBossX > 0.04 && projectedBossX < 0.96
          && projectedBossY > 0.06 && projectedBossY < 0.94;
        signalVeil.visible = engineOnScreen && !engine.destroyed && assemblyPressure > 0.28 && localEffectIntensity > 0.05;
        if (signalVeil.visible) {
          signalVeil.position.set(rawBossX, rawBossY);
          signalVeil.rotation = localReducedFx ? 0 : motionClock * (engine.active ? -0.08 : 0.025);
          signalVeil.scale.set(clamp(worldScale * (engine.active ? 0.84 : 0.62), 0.45, 1.8));
          signalVeil.alpha = localReducedFlashing
            ? 0.08 + assemblyPressure * 0.08
            : (0.045 + assemblyPressure * 0.07 + visualRhythm * 0.08) * localEffectIntensity;
        }

        bossIndicator.visible = bossPresent && !bossOnScreen;
        if (bossIndicator.visible) {
          const edge = edgePoint(rawBossX, rawBossY, clamp(Math.min(width, height) * 0.06, 48, 108));
          bossIndicator.position.set(edge.x, edge.y);
          bossIndicator.rotation = edge.angle;
          bossIndicator.scale.set(overlayScale);
          bossIndicator.alpha = highContrastRef.current ? 0.98 : localReducedFlashing ? 0.82 : 0.68 + danger * 0.24;
        }

        const directionalThreats: Array<{
          entity: Entity;
          kind: "bolt" | "sentinel";
          priority: number;
          rawX: number;
          rawY: number;
        }> = [];
        for (const projectile of projectiles) {
          if (projectile.dead || projectile.kind !== "bolt") continue;
          const rawX = world.position.x + projectile.x * worldScale;
          const rawY = world.position.y + projectile.y * worldScale;
          if (rawX > 54 && rawX < width - 54 && rawY > 72 && rawY < height - 72) continue;
          const d = distance(player.x, player.y, projectile.x, projectile.y);
          directionalThreats.push({ entity: projectile, kind: "bolt", priority: 4 + clamp(1 - d / 1500, 0, 1), rawX, rawY });
        }
        for (const sentinel of sentinels) {
          if (sentinel.dead || !sentinel.view.visible) continue;
          const rawX = world.position.x + sentinel.x * worldScale;
          const rawY = world.position.y + sentinel.y * worldScale;
          if (rawX > 54 && rawX < width - 54 && rawY > 72 && rawY < height - 72) continue;
          const d = distance(player.x, player.y, sentinel.x, sentinel.y);
          const charge = clamp((0.42 - sentinel.fireTimer) / 0.42, 0, 1);
          directionalThreats.push({ entity: sentinel, kind: "sentinel", priority: 2 + charge + clamp(1 - d / 1900, 0, 1), rawX, rawY });
        }
        directionalThreats.sort((a, b) => b.priority - a.priority);
        threatPointers.forEach((pointer, index) => {
          const threat = directionalThreats[index];
          pointer.view.visible = Boolean(threat) && localMode !== "title";
          if (!threat) return;
          const edge = edgePoint(threat.rawX, threat.rawY, clamp(Math.min(width, height) * 0.075, 58, 124));
          pointer.view.position.set(edge.x, edge.y);
          pointer.view.rotation = edge.angle;
          pointer.view.scale.set(overlayScale * (threat.kind === "bolt" ? 0.86 : 1));
          pointer.view.alpha = highContrastRef.current ? 1 : localReducedFlashing ? 0.82 : 0.66 + Math.min(0.28, threat.priority * 0.045);
          pointer.bolt.visible = threat.kind === "bolt";
          pointer.sentinel.visible = threat.kind === "sentinel";
        });

        let reticleTarget: Entity | undefined;
        let reticleIsBoss = false;
        let reticleIsTutorial = false;
        if (tutorialActiveRef.current && tutorialRuntimeRef.current.step === "collect" && tutorialTarget && !tutorialTarget.dead) {
          reticleTarget = tutorialTarget;
          reticleIsTutorial = true;
        } else if (bossPresent && bossOnScreen) {
          reticleTarget = engine;
          reticleIsBoss = true;
        } else {
          let bestTargetDistance = Infinity;
          for (const sentinel of sentinels) {
            if (sentinel.dead || !sentinel.view.visible) continue;
            const rawX = world.position.x + sentinel.x * worldScale;
            const rawY = world.position.y + sentinel.y * worldScale;
            if (rawX < 72 || rawX > width - 72 || rawY < 90 || rawY > height - 90) continue;
            const d = distance(player.x, player.y, sentinel.x, sentinel.y);
            if (d < bestTargetDistance) { bestTargetDistance = d; reticleTarget = sentinel; }
          }
        }
        targetReticle.visible = Boolean(reticleTarget) && localMode !== "title";
        if (reticleTarget) {
          const rawX = world.position.x + reticleTarget.x * worldScale;
          const rawY = world.position.y + reticleTarget.y * worldScale;
          const hudScale = overlayScale;
          const tutorialMinY = width > height ? 184 : 220;
          const tutorialMaxY = height - (width > height ? 82 : 190);
          targetReticle.position.set(
            reticleIsTutorial ? clamp(rawX, 54, width - 54) : rawX,
            reticleIsTutorial ? clamp(rawY, tutorialMinY, tutorialMaxY) : rawY,
          );
          targetReticle.rotation = localReducedFx ? 0 : motionClock * (reticleIsBoss ? -0.18 : reticleIsTutorial ? 0.42 : 0.26);
          targetReticle.scale.set(hudScale * (reticleIsBoss ? 1.48 : reticleIsTutorial ? 1.18 : 0.86 + visualRhythm * 0.08));
          targetReticle.alpha = highContrastRef.current ? 0.9 : localReducedFlashing ? 0.62 : 0.5 + visualRhythm * 0.22;
          targetReticle.tint = reticleIsBoss ? 0xffa07e : reticleIsTutorial ? 0x75efff : 0xc7f8ff;
        }
        const thrustHeat = speedRatio > 0.28 ? ((speedRatio - 0.28) / 0.72) * 0.42 : 0;
        const heat = clamp(
          thrustHeat + (bossOnScreen ? 0.24 : 0) + clamp(particles.length / 420, 0, 1) * 0.16,
          0,
          0.82,
        );
        const bloom = highContrastRef.current
          ? 0.075
          : clamp(0.13 + (bossOnScreen ? 0.075 : 0) + clamp((particles.length + impactFx.length * 8) / 420, 0, 1) * 0.07, 0.13, 0.27);
        postFx
          .update(dt)
          .setAccessibility({
            effectIntensity: localEffectIntensity,
            reducedMotion: localReducedFx,
            reducedFlashing: localReducedFlashing,
          })
          .setLevels({ danger, heat, bloom })
          .setHeatSource({
            x: clamp(heatX, 0, 1),
            y: clamp(heatY, 0, 1),
            radius: bossOnScreen
              ? clamp((engine.radius * worldScale * 2.3) / height, 0.13, 0.34)
              : 0.105,
          })
          .setShockwave({
            x: clamp(shockX, 0, 1),
            y: clamp(shockY, 0, 1),
            radius: 0.015 + shockProgress * 0.34,
            level: localReducedFx || shockProgress >= 1 ? 0 : (1 - shockProgress) * shockwaveForce,
            width: 0.009 + shockProgress * 0.009,
          });

        hudTimer -= dt;
        if (hudTimer <= 0) {
          hudTimer = 0.12;
          refreshHud();
        }
      };

      resetWorld(true);
      refreshHud();

      const profileEnabled = new URLSearchParams(window.location.search).get("profile") === "1";
      const profileSamples: number[] = [];
      let profileElapsed = 0;

      app.ticker.add((ticker) => {
        const dt = Math.min(0.033, ticker.deltaMS / 1000);
        pollGamepadMeta();
        if (localMode === "playing" && !showcaseFrozen) updateGameplay(dt);
        updateView(showcaseFrozen ? 0 : dt);
        if (profileEnabled && profileElapsed < 2000) {
          profileSamples.push(ticker.deltaMS);
          if (profileSamples.length > 4) profileElapsed += ticker.deltaMS;
          if (profileElapsed >= 2000) {
            const samples = profileSamples.slice(4).sort((a, b) => a - b);
            const profile: RuntimeProfile = {
              viewport: `${Math.round(app?.screen.width ?? 0)}x${Math.round(app?.screen.height ?? 0)}`,
              frames: samples.length,
              elapsedMs: Number(profileElapsed.toFixed(1)),
              averageFps: Number(((samples.length / profileElapsed) * 1000).toFixed(1)),
              medianFrameMs: Number(samples[Math.floor(samples.length * 0.5)].toFixed(2)),
              p95FrameMs: Number(samples[Math.floor(samples.length * 0.95)].toFixed(2)),
              maxFrameMs: Number(Math.max(...samples).toFixed(2)),
            };
            (window as Window & { __voidforgePerformance?: RuntimeProfile }).__voidforgePerformance = profile;
            document.documentElement.dataset.voidforgeProfile = JSON.stringify(profile);
          } else if (profileSamples.length === 5) {
            const pendingProfile: RuntimeProfile = {
              viewport: `${Math.round(app?.screen.width ?? 0)}x${Math.round(app?.screen.height ?? 0)}`,
              frames: 0,
              elapsedMs: 0,
              averageFps: 0,
              medianFrameMs: 0,
              p95FrameMs: 0,
              maxFrameMs: 0,
            };
            (window as Window & { __voidforgePerformance?: RuntimeProfile }).__voidforgePerformance = pendingProfile;
            document.documentElement.dataset.voidforgeProfile = JSON.stringify(pendingProfile);
          }
        }
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Escape" && helpOpenRef.current) {
          event.preventDefault();
          setHelpOpen(false);
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        const interactiveTarget = target?.closest("button, input, select, textarea, [role='dialog']");
        if (interactiveTarget && event.code !== "Escape") return;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code) && localMode !== "title") {
          event.preventDefault();
        }
        keys.add(event.code);
        if (event.repeat) return;
        if (event.code === "KeyP" || event.code === "Escape") togglePause();
        if (event.code === "KeyR" && localMode === "gameover") startGame();
        if (event.code === "Enter" && localMode === "title") startGame();
      };
      const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
      const clearInputs = () => {
        keys.clear();
        resetTouchInput(touchInputRef.current);
        lastGamepadBomb = false;
        setTouchResetKey((value) => value + 1);
      };
      const onBlur = () => clearInputs();
      const onVisibilityChange = () => {
        clearInputs();
        if (document.hidden && localMode === "playing") togglePause();
      };
      const onPageHide = () => clearInputs();
      const onOrientationChange = () => clearInputs();
      const onPointerDown = () => { void audio.unlock(); app?.canvas.focus(); };
      window.addEventListener("keydown", onKeyDown, { passive: false });
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("orientationchange", onOrientationChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
      app.canvas.addEventListener("pointerdown", onPointerDown);

      gameApiRef.current = {
        start: startGame,
        startTutorial() { startGame("force"); },
        restart: startGame,
        tutorialEvent: applyTutorialEvent,
        togglePause,
        unlockAudio() { void audio.unlock(); },
        setMuted(value) {
          audio.setMuted(value);
          if (value && "speechSynthesis" in window) window.speechSynthesis.cancel();
        },
        setReducedFx(value) {
          localReducedFx = value;
          postFx.setAccessibility({ reducedMotion: value });
        },
        setReducedFlashing(value) {
          localReducedFlashing = value;
          postFx.setAccessibility({ reducedFlashing: value });
        },
        setEffectIntensity(value) {
          localEffectIntensity = clamp(value, 0, 1);
          postFx.setAccessibility({ effectIntensity: localEffectIntensity });
        },
        setHighContrast(value) {
          background.alpha = value ? 0.46 : 0.64;
          hazeLayer.alpha = value ? 0 : 1;
          starLayer.alpha = value ? 1 : 0.82;
          dustLayer.alpha = value ? 0.62 : 1;
          farDebrisLayer.alpha = value ? 0.45 : 0.82;
          nearDebrisLayer.alpha = value ? 0 : 0.54;
        },
        setColorMode(value) { postFx.setColorProfile(value); },
      };

      setReady(true);
      const showcase = new URLSearchParams(window.location.search).get("showcase");
      if (showcase) configureShowcase(showcase);

      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("orientationchange", onOrientationChange);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        app?.canvas.removeEventListener("pointerdown", onPointerDown);
      };
    };

    let detach: (() => void) | undefined;
    void boot().then((cleanup) => { detach = cleanup; }).catch((error) => {
      console.error("VOIDFORGE boot failed", error);
      setReady(false);
      setNotice({ text: "RENDER CORE OFFLINE", danger: true, key: Date.now() });
    });

    return () => {
      cancelled = true;
      detach?.();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      audio.destroy();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      gameApiRef.current = EMPTY_API;
      app?.destroy(true, { children: true });
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (shellRef.current) void shellRef.current.requestFullscreen().catch(() => undefined);
  };

  const cycleEffectIntensity = () => {
    setEffectIntensity((value) => value === 1 ? 0.7 : value === 0.7 ? 0.35 : value === 0.35 ? 0 : 1);
  };

  const cycleColorMode = () => {
    const modes = ["standard", "deuteranopia", "protanopia", "tritanopia"] as const;
    setColorMode((value) => modes[(modes.indexOf(value) + 1) % modes.length]);
  };

  const intensityLabel = effectIntensity === 1 ? "Full" : effectIntensity === 0.7 ? "Balanced" : effectIntensity === 0.35 ? "Low" : "Off";
  const colorLabel = colorMode === "standard" ? "Standard" : colorMode.slice(0, 4).toUpperCase();

  const updateTouchMove = (x: number, y: number) => {
    touchInputRef.current.moveX = x;
    touchInputRef.current.moveY = y;
    if (Math.hypot(x, y) > 0.1) gameApiRef.current.tutorialEvent("player-thrusted");
  };

  const updateTouchAim = (x: number, y: number, active: boolean) => {
    touchInputRef.current.aimX = x;
    touchInputRef.current.aimY = y;
    touchInputRef.current.firing = active;
  };

  const queueTouchNova = () => {
    gameApiRef.current.unlockAudio();
    touchInputRef.current.novaQueued = true;
  };

  return (
    <main
      className={`voidforge-shell mode-${screenMode} ${touchCapable ? "touch-enabled" : ""} ${touchSouthpaw ? "touch-southpaw" : ""} ${tutorialStep ? `tutorial-step-${tutorialStep}` : ""} ${reducedFx ? "reduced-fx" : ""} ${reducedFlashing ? "reduced-flashing" : ""} effect-${intensityLabel.toLowerCase()} color-${colorMode} ${highContrast ? "high-contrast" : ""}`}
      ref={shellRef}
    >
      <div className="game-mount" ref={mountRef} />
      <div className="fx-vignette" />
      <div className="fx-grain" />
      <div className="ui-layer">
        {screenMode === "title" && (
          <section className="title-screen" aria-labelledby="game-title">
            <div className="title-content">
              <p className="eyebrow">A modern arcade odyssey</p>
              <h1 className="wordmark" id="game-title">VOID<span>FORGE</span></h1>
              <div className="title-rule" />
              <p className="title-copy">
                The Fabricators are harvesting a dead star. <strong>Mine the Flux. Build your arsenal.</strong>{" "}
                Break the Dread Engine before it learns your signal.
              </p>
              <div className="title-actions">
                <button
                  className="primary-action"
                  data-testid="start-game"
                  data-tutorial-recommended={tutorialRecommended ? "true" : "false"}
                  disabled={!ready}
                  onClick={() => gameApiRef.current.start()}
                >
                  {ready ? tutorialRecommended ? "Start guided flight" : "Enter the Expanse" : "Calibrating field…"}
                </button>
                <span className="version-mark">Vesper flight core<br />build 01.28</span>
              </div>
              {tutorialRecommended && (
                <p className="first-flight-note">New pilot · a short guided flight teaches movement, mining, Flux, and the Dread Engine.</p>
              )}
            </div>
            <MissionBriefing />
          </section>
        )}

        {screenMode !== "title" && <HeadsUpDisplay hud={hud} />}

        {touchCapable && screenMode === "playing" && !helpOpen && (
          <section className="touch-controls" aria-label="Touch flight controls" key={touchResetKey}>
            <TouchStick
              label="Thrust"
              hint="Move"
              tone="thrust"
              onEngage={() => gameApiRef.current.unlockAudio()}
              onVector={(x, y) => updateTouchMove(x, y)}
            />
            <TouchStick
              label="Aim"
              hint="Hold to fire"
              tone="fire"
              onEngage={() => gameApiRef.current.unlockAudio()}
              onVector={updateTouchAim}
            />
            <button
              className="touch-action-button touch-nova-button"
              type="button"
              aria-label={`Launch Nova Charge, ${hud.charges} remaining`}
              disabled={hud.charges <= 0}
              data-testid="touch-nova"
              onClick={queueTouchNova}
            >
              <span>Nova</span>
              <strong>{hud.charges.toString().padStart(2, "0")}</strong>
            </button>
            <button
              className="touch-action-button touch-pause-button"
              type="button"
              aria-label="Pause flight and open options"
              onClick={() => gameApiRef.current.togglePause()}
            >
              <span aria-hidden="true">Ⅱ</span>
              <small>Pause</small>
            </button>
          </section>
        )}

        {tutorialStep && screenMode === "playing" && !helpOpen && !notice && (
          <TutorialCoachmark
            step={tutorialStep}
            touchCapable={touchCapable}
            onSkip={() => gameApiRef.current.tutorialEvent("skip")}
            onComplete={() => gameApiRef.current.tutorialEvent("acknowledge")}
          />
        )}

        {notice && (
          <div className={`center-alert ${notice.danger ? "danger" : ""}`} key={notice.key} aria-hidden="true">
            {notice.text}
          </div>
        )}

        {screenMode === "paused" && (
          <div className="pause-screen">
            <section className="pause-panel" aria-label="Game paused">
              <p className="eyebrow">Flight systems suspended</p>
              <h2>Paused</h2>
              <p>The Cinder Expanse is holding its breath.</p>
              <button className="primary-action" onClick={() => gameApiRef.current.togglePause()}>Resume flight</button>
            </section>
          </div>
        )}

        {screenMode === "gameover" && (
          <div className="gameover-screen">
            <section className="gameover-panel" aria-label="Game over">
              <p className="eyebrow">Transmission terminated</p>
              <h2>Signal Lost</h2>
              <p>Final score {formatScore(hud.score)}. The Dread Engine continues its assembly.</p>
              <button className="primary-action" data-testid="restart-game" onClick={() => gameApiRef.current.restart()}>
                Reconstitute Vesper
              </button>
            </section>
          </div>
        )}

        {helpOpen && (
          <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <button className="utility-button dialog-close" aria-label="Close help" onClick={() => setHelpOpen(false)}>×</button>
            <h2 id="help-title">Flight manual</h2>
            <div className="help-actions">
              <button
                className="primary-action tutorial-replay"
                type="button"
                aria-label="Replay first-run tutorial"
                data-testid="tutorial-replay"
                onClick={() => {
                  setHelpOpen(false);
                  gameApiRef.current.startTutorial();
                }}
              >
                Replay guided flight
              </button>
            </div>
            <div className="help-grid">
              <div><h3>Variable thrust</h3><p>Use WASD, arrow keys, a gamepad stick, or the left touch stick. Six thrust bands recreate the original variable-speed arcade feel.</p></div>
              <div><h3>Touch targeting</h3><p>Drag the right stick to aim independently and hold it to fire. Tap Nova for a single homing charge; Pause opens every display option.</p></div>
              <div><h3>Mine carefully</h3><p>Hold fire to cut Flux from planetoids. Short controlled bursts preserve the rock and extract more crystals.</p></div>
              <div><h3>Deny assembly</h3><p>Orange Fabricators steal loose Flux and carry it to the Dread Engine. Violet Sentinels protect them.</p></div>
              <div><h3>Launch Nova Charges</h3><p>Press C or Shift, or tap the orange Nova control. Charges home toward an active Engine, but obstacles can intercept them.</p></div>
              <div><h3>Pause and restart</h3><p>Press P or Escape, or tap Pause. After signal loss, use R or the on-screen restart control.</p></div>
              <div><h3>Accessibility</h3><p>Reduce motion or flashing independently, tune effect density, select a color profile, increase contrast, or mute procedural audio.</p></div>
            </div>
          </section>
        )}

        {!helpOpen && <nav className="utility-bar" aria-label="Game options">
          <button className="utility-button" aria-label={muted ? "Unmute sound" : "Mute sound"} aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
            <span aria-hidden="true">{muted ? "◌" : "◉"}</span><span className="utility-label">Sound</span>
          </button>
          <button className="utility-button" aria-label="Toggle reduced motion" aria-pressed={reducedFx} onClick={() => setReducedFx((value) => !value)}>
            <span aria-hidden="true">↔</span><span className="utility-label">Motion</span>
          </button>
          <button className="utility-button" aria-label="Toggle high contrast" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)}>
            <span aria-hidden="true">◐</span><span className="utility-label">Contrast</span>
          </button>
          <button className="utility-button" aria-label="Toggle reduced flashing" aria-pressed={reducedFlashing} onClick={() => setReducedFlashing((value) => !value)}>
            <span aria-hidden="true">☼</span><span className="utility-label">Flashing</span>
          </button>
          <button className="utility-button" aria-label={`Effect intensity: ${intensityLabel}`} onClick={cycleEffectIntensity}>
            <span aria-hidden="true">FX</span><span className="utility-label">{intensityLabel}</span>
          </button>
          <button className="utility-button" aria-label={`Color profile: ${colorLabel}`} onClick={cycleColorMode}>
            <span aria-hidden="true">C</span><span className="utility-label">{colorLabel}</span>
          </button>
          {touchCapable && (
            <button className="utility-button" aria-label="Swap touch control sides" aria-pressed={touchSouthpaw} onClick={() => setTouchSouthpaw((value) => !value)}>
              <span aria-hidden="true">⇄</span><span className="utility-label">Swap</span>
            </button>
          )}
          <button
            className="utility-button"
            aria-label="Open flight manual"
            aria-expanded={helpOpen}
            onClick={() => {
              if (!helpOpen && screenMode === "playing") gameApiRef.current.togglePause();
              setHelpOpen((value) => !value);
            }}
          >
            <span aria-hidden="true">?</span><span className="utility-label">Help</span>
          </button>
          <button className="utility-button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
            <span aria-hidden="true">⛶</span><span className="utility-label">Fullscreen</span>
          </button>
        </nav>}
        {touchCapable && screenMode === "title" && <p className="portrait-notice">Portrait controls active · landscape expands the tactical view</p>}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {notice?.text ?? (tutorialStep
            ? `Tutorial step ${TUTORIAL_STEPS.indexOf(tutorialStep) + 1} of ${TUTORIAL_STEPS.length}. ${TUTORIAL_COPY[tutorialStep].title}. ${touchCapable ? TUTORIAL_COPY[tutorialStep].touch : TUTORIAL_COPY[tutorialStep].desktop}`
            : "")}
        </p>
      </div>
    </main>
  );
}
