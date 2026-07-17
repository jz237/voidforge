"use client";

import { useEffect, useRef, useState } from "react";
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
  seededRandom,
} from "./core.mjs";

type ScreenMode = "title" | "playing" | "paused" | "gameover";
type ContactKind = "worker" | "warrior" | "boss";

interface RadarContact {
  id: number;
  kind: ContactKind;
  x: number;
  y: number;
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
}

interface GameApi {
  start: () => void;
  restart: () => void;
  togglePause: () => void;
  setMuted: (muted: boolean) => void;
  setReducedFx: (reduced: boolean) => void;
  setReducedFlashing: (reduced: boolean) => void;
  setEffectIntensity: (intensity: number) => void;
  setHighContrast: (enabled: boolean) => void;
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
}

interface Planetoid extends Entity {
  integrity: number;
  shards: number;
  miningProgress: number;
  lastHitAt: number;
  cracks: Graphics;
  maxIntegrity: number;
}

interface Crystal extends Entity {
  age: number;
  claimedBy?: number;
}

interface Fabricator extends Entity {
  carrying: boolean;
  miningTimer: number;
  targetId?: number;
  beam: Graphics;
}

interface Sentinel extends Entity {
  fireTimer: number;
  orbit: number;
  health: number;
}

interface Projectile extends Entity {
  owner: "player" | "enemy";
  kind: "laser" | "bolt" | "nova";
  age: number;
  lifetime: number;
}

interface Particle extends Entity {
  age: number;
  lifetime: number;
  spin: number;
  startScale: number;
}

interface DreadEngine extends Entity {
  parts: Container[];
  innerRing: Container;
  outerRing: Container;
  core: Graphics;
  active: boolean;
  health: number;
  destroyed: boolean;
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

const INITIAL_HUD: HudState = {
  score: 0,
  lives: RULES.playerLives,
  charges: 0,
  zone: 1,
  pieces: 0,
  engineHealth: RULES.engineHits,
  engineActive: false,
  contacts: [],
};

const EMPTY_API: GameApi = {
  start() {},
  restart() {},
  togglePause() {},
  setMuted() {},
  setReducedFx() {},
  setReducedFlashing() {},
  setEffectIntensity() {},
  setHighContrast() {},
};

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
        </div>
      </div>
    </aside>
  );
}

function Radar({ contacts }: { contacts: RadarContact[] }) {
  return (
    <div className="radar-wrap" aria-label="Tactical scanner">
      <div className="radar">
        <div className="radar-sweep" />
        {contacts.map((contact) => (
          <span
            className={`radar-dot ${contact.kind}`}
            key={`${contact.kind}-${contact.id}`}
            style={{ left: `${contact.x}%`, top: `${contact.y}%` }}
          />
        ))}
      </div>
      <span className="radar-caption">Vector scanner · 2.4 AU</span>
    </div>
  );
}

function HeadsUpDisplay({ hud }: { hud: HudState }) {
  const integritySegments = Math.ceil((hud.engineHealth / RULES.engineHits) * RULES.enginePieces);
  return (
    <div className="hud" aria-label="Game status">
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
        <Radar contacts={hud.contacts} />
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
        <div className="construction-panel">
          <div className="construction-header">
            <span>{hud.engineActive ? "Dread Engine integrity" : "Dread Engine assembly"}</span>
            <strong>
              {hud.engineActive
                ? `${hud.engineHealth} / ${RULES.engineHits}`
                : `${hud.pieces} / ${RULES.enginePieces}`}
            </strong>
          </div>
          <div className="construction-track" aria-hidden="true">
            {Array.from({ length: RULES.enginePieces }, (_, index) => (
              <span
                className={`construction-segment ${
                  hud.engineActive
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
  const mutedRef = useRef(false);
  const reducedFxRef = useRef(false);
  const reducedFlashingRef = useRef(false);
  const effectIntensityRef = useRef(1);
  const highContrastRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>("title");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [notice, setNotice] = useState<{ text: string; danger: boolean; key: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [reducedFx, setReducedFx] = useState(false);
  const [reducedFlashing, setReducedFlashing] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(1);
  const [colorMode, setColorMode] = useState<"standard" | "deuteranopia" | "protanopia" | "tritanopia">("standard");
  const [highContrast, setHighContrast] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [captureOffset, setCaptureOffset] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const storedMuted = window.localStorage.getItem("voidforge-muted") === "true";
    const storedReduced = window.localStorage.getItem("voidforge-reduced-fx");
    const storedFlashing = window.localStorage.getItem("voidforge-reduced-flashing");
    const storedIntensity = Number(window.localStorage.getItem("voidforge-effect-intensity"));
    const storedColorMode = window.localStorage.getItem("voidforge-color-mode");
    const storedContrast = window.localStorage.getItem("voidforge-high-contrast") === "true";
    // Client-only preferences cannot be known during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(storedMuted);
    setReducedFx(storedReduced === null ? prefersReduced : storedReduced === "true");
    setReducedFlashing(storedFlashing === null ? prefersReduced : storedFlashing === "true");
    setEffectIntensity([0.35, 0.7, 1].includes(storedIntensity) ? storedIntensity : 1);
    if (["standard", "deuteranopia", "protanopia", "tritanopia"].includes(storedColorMode ?? "")) {
      setColorMode(storedColorMode as "standard" | "deuteranopia" | "protanopia" | "tritanopia");
    }
    setHighContrast(storedContrast);
    setCaptureOffset(new URLSearchParams(window.location.search).get("capture") === "right" ? 3030 : 0);
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
    window.localStorage.setItem("voidforge-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    highContrastRef.current = highContrast;
    gameApiRef.current.setHighContrast(highContrast);
    window.localStorage.setItem("voidforge-high-contrast", String(highContrast));
  }, [highContrast]);

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
      const PIXI = await import("pixi.js");
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
      background.alpha = 0.72;
      app.stage.addChild(background);

      const starLayer = new PIXI.Container();
      const world = new PIXI.Container();
      const flashLayer = new PIXI.Container();
      app.stage.addChild(starLayer, world, flashLayer);

      const rng = seededRandom(0x0f0a6e);
      const stars: Array<{ view: Graphics; x: number; y: number; factor: number }> = [];
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
        stars.push({ view: star, x: rng(), y: rng(), factor: 0.025 + rng() * 0.14 });
      }

      let player: Player;
      let engine: DreadEngine;
      let planetoids: Planetoid[] = [];
      let crystals: Crystal[] = [];
      let fabricators: Fabricator[] = [];
      let sentinels: Sentinel[] = [];
      let projectiles: Projectile[] = [];
      let particles: Particle[] = [];
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
        const glow = new PIXI.Graphics();
        glow.ellipse(-5, 0, 51, 30).fill({ color: 0x42dfff, alpha: 0.1 });
        glow.blendMode = "add";
        const flare = new PIXI.Graphics();
        flare.poly([-27, -8, -58, 0, -27, 8]).fill({ color: 0x47dfff, alpha: 0.8 });
        flare.poly([-29, -4, -74, 0, -29, 4]).fill({ color: 0xffffff, alpha: 0.58 });
        flare.blendMode = "add";
        const ship = new PIXI.Graphics();
        ship.poly([35, 0, -16, -21, -7, -7, -30, -12, -21, 0, -30, 12, -7, 7, -16, 21])
          .fill({ color: 0x173b5f })
          .stroke({ color: 0x8feaff, width: 2, alpha: 0.88 });
        ship.poly([28, 0, -8, -8, -13, 0, -8, 8]).fill({ color: 0xeafcff, alpha: 0.92 });
        ship.poly([0, -6, -13, -13, -21, -4]).fill({ color: 0x8f5cff, alpha: 0.72 });
        ship.poly([0, 6, -13, 13, -21, 4]).fill({ color: 0xff9d42, alpha: 0.74 });
        ship.circle(6, 0, 4).fill({ color: 0x45e5ff, alpha: 0.95 });
        container.addChild(glow, flare, ship);
        return { container, flare };
      };

      const makePlanetoidView = (radius: number, seed: number) => {
        const random = seededRandom(seed);
        const container = new PIXI.Container();
        const halo = new PIXI.Graphics();
        halo.circle(0, 0, radius * 1.12).fill({ color: 0xff8a39, alpha: 0.045 });
        const body = new PIXI.Graphics();
        const points: number[] = [];
        for (let index = 0; index < 15; index += 1) {
          const angle = (index / 15) * Math.PI * 2;
          const r = radius * (0.82 + random() * 0.22);
          points.push(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        body.poly(points)
          .fill({ color: 0x252a38 })
          .stroke({ color: 0x596b78, width: 2.2, alpha: 0.78 });
        for (let index = 0; index < 9; index += 1) {
          const angle = random() * Math.PI * 2;
          const d = radius * (0.2 + random() * 0.55);
          const r = radius * (0.055 + random() * 0.1);
          body.circle(Math.cos(angle) * d, Math.sin(angle) * d, r)
            .fill({ color: 0x111723, alpha: 0.62 })
            .stroke({ color: 0x758492, width: 0.8, alpha: 0.28 });
        }
        const cracks = new PIXI.Graphics();
        for (let index = 0; index < 6; index += 1) {
          const angle = random() * Math.PI * 2;
          const sx = Math.cos(angle) * radius * 0.15;
          const sy = Math.sin(angle) * radius * 0.15;
          cracks.moveTo(sx, sy)
            .lineTo(sx + Math.cos(angle) * radius * (0.28 + random() * 0.28), sy + Math.sin(angle) * radius * (0.28 + random() * 0.28))
            .stroke({ color: 0xff8f3a, width: 1.1 + random() * 1.5, alpha: 0.68 });
        }
        cracks.alpha = 0.12;
        cracks.blendMode = "add";
        container.addChild(halo, body, cracks);
        return { container, cracks };
      };

      const makeCrystalView = () => {
        const container = new PIXI.Container();
        const halo = new PIXI.Graphics();
        halo.circle(0, 0, 25).fill({ color: 0x5df4ff, alpha: 0.12 });
        halo.blendMode = "add";
        const shard = new PIXI.Graphics();
        shard.poly([0, -15, 9, -3, 5, 13, -5, 13, -9, -3])
          .fill({ color: 0xbafaff, alpha: 0.94 })
          .stroke({ color: 0x57dfff, width: 1.5 });
        shard.poly([0, -12, 4, -2, 0, 10, -4, -2]).fill({ color: 0x8c6cff, alpha: 0.72 });
        container.addChild(halo, shard);
        return container;
      };

      const makeFabricatorView = () => {
        const container = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, 31).fill({ color: 0xff873c, alpha: 0.1 });
        glow.blendMode = "add";
        const ship = new PIXI.Graphics();
        ship.poly([24, 0, 4, -14, -19, -10, -10, 0, -19, 10, 4, 14])
          .fill({ color: 0x64291f })
          .stroke({ color: 0xffa45c, width: 1.7, alpha: 0.9 });
        ship.poly([9, 0, -5, -6, -11, 0, -5, 6]).fill({ color: 0xffd28a, alpha: 0.9 });
        ship.circle(-17, -8, 2.3).fill({ color: 0xff5e32 });
        ship.circle(-17, 8, 2.3).fill({ color: 0xff5e32 });
        const beam = new PIXI.Graphics();
        container.addChild(glow, beam, ship);
        return { container, beam };
      };

      const makeSentinelView = () => {
        const container = new PIXI.Container();
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, 34).fill({ color: 0x7f78ff, alpha: 0.12 });
        glow.blendMode = "add";
        const ship = new PIXI.Graphics();
        ship.poly([27, 0, 7, -11, -5, -22, -12, -8, -25, -5, -16, 0, -25, 5, -12, 8, -5, 22, 7, 11])
          .fill({ color: 0x252259 })
          .stroke({ color: 0x8d9dff, width: 1.8, alpha: 0.9 });
        ship.circle(2, 0, 7).fill({ color: 0x8feaff, alpha: 0.9 });
        ship.moveTo(10, 0).lineTo(29, 0).stroke({ color: 0xd4faff, width: 2.3 });
        container.addChild(glow, ship);
        return container;
      };

      const makeEngineView = () => {
        const root = new PIXI.Container();
        const ambient = new PIXI.Graphics();
        ambient.circle(0, 0, 190).fill({ color: 0xb548ff, alpha: 0.055 });
        ambient.blendMode = "add";
        const outerRing = new PIXI.Container();
        const innerRing = new PIXI.Container();
        const parts: Container[] = [];
        const ringBack = new PIXI.Graphics();
        ringBack.circle(0, 0, 122).stroke({ color: 0x8f5cff, width: 2.4, alpha: 0.24 });
        ringBack.circle(0, 0, 77).stroke({ color: 0xff7248, width: 1.4, alpha: 0.25 });
        root.addChild(ambient, ringBack, outerRing, innerRing);

        for (let index = 0; index < RULES.enginePieces; index += 1) {
          const angle = (index / RULES.enginePieces) * Math.PI * 2;
          const distanceFromCore = index % 2 === 0 ? 112 : 82;
          const piece = new PIXI.Container();
          const glow = new PIXI.Graphics();
          glow.poly([20, 0, -10, -15, -21, 0, -10, 15]).fill({ color: index % 2 ? 0xff6f3f : 0x9755ff, alpha: 0.12 });
          glow.scale.set(1.45);
          glow.blendMode = "add";
          const plate = new PIXI.Graphics();
          plate.poly([26, 0, 2, -16, -21, -10, -10, 0, -21, 10, 2, 16])
            .fill({ color: index % 2 ? 0x4c2429 : 0x292551 })
            .stroke({ color: index % 2 ? 0xff8a55 : 0xaa87ff, width: 1.8, alpha: 0.86 });
          plate.moveTo(-8, 0).lineTo(15, 0).stroke({ color: 0xe6d7ff, width: 1.1, alpha: 0.55 });
          piece.addChild(glow, plate);
          piece.position.set(Math.cos(angle) * distanceFromCore, Math.sin(angle) * distanceFromCore);
          piece.rotation = angle;
          piece.alpha = 0.055;
          piece.scale.set(0.54);
          (index % 2 === 0 ? outerRing : innerRing).addChild(piece);
          parts.push(piece);
        }

        const core = new PIXI.Graphics();
        core.circle(0, 0, 53).fill({ color: 0x090b17, alpha: 0.96 }).stroke({ color: 0x9f73ff, width: 3, alpha: 0.62 });
        core.poly([0, -42, 28, -16, 21, 27, 0, 42, -21, 27, -28, -16])
          .fill({ color: 0x231a3f, alpha: 0.9 })
          .stroke({ color: 0xff8452, width: 2, alpha: 0.68 });
        core.circle(0, 0, 18).fill({ color: 0xf3c5ff, alpha: 0.12 });
        core.circle(0, 0, 8).fill({ color: 0xf8e8ff, alpha: 0.45 });
        core.blendMode = "add";
        root.addChild(core);
        return { root, parts, outerRing, innerRing, core };
      };

      const createPlayer = (): Player => {
        const { container, flare } = makePlayerView();
        world.addChild(container);
        return {
          id: nextId(), x: 4200, y: 3050, vx: 0, vy: 0, radius: 24,
          angle: 0, invulnerable: 3.5, view: container, engineFlare: flare,
        };
      };

      const createEngine = (): DreadEngine => {
        const graphics = makeEngineView();
        graphics.root.position.set(5650, 3100);
        world.addChild(graphics.root);
        return {
          id: nextId(), x: 5650, y: 3100, vx: 0, vy: 0, radius: 150,
          view: graphics.root, parts: graphics.parts, innerRing: graphics.innerRing,
          outerRing: graphics.outerRing, core: graphics.core, active: false,
          health: RULES.engineHits, destroyed: false,
        };
      };

      const spawnPlanetoid = (x: number, y: number, radius = 62 + rng() * 54) => {
        const { container, cracks } = makePlanetoidView(radius, Math.floor(rng() * 0x7fffffff));
        container.position.set(x, y);
        world.addChild(container);
        const planetoid: Planetoid = {
          id: nextId(), x, y, vx: (rng() - 0.5) * 9, vy: (rng() - 0.5) * 9,
          radius, view: container, integrity: 8, maxIntegrity: 8,
          shards: 3 + Math.floor(rng() * 4), miningProgress: 0, lastHitAt: -1000, cracks,
        };
        planetoids.push(planetoid);
        return planetoid;
      };

      const spawnCrystal = (x: number, y: number, angle = rng() * Math.PI * 2) => {
        const view = makeCrystalView();
        view.position.set(x, y);
        world.addChild(view);
        crystals.push({
          id: nextId(), x, y, vx: Math.cos(angle) * (45 + rng() * 65),
          vy: Math.sin(angle) * (45 + rng() * 65), radius: 13, view, age: 0,
        });
      };

      const spawnFabricator = (x: number, y: number) => {
        const { container, beam } = makeFabricatorView();
        container.position.set(x, y);
        world.addChild(container);
        fabricators.push({
          id: nextId(), x, y, vx: 0, vy: 0, radius: 25, view: container,
          carrying: false, miningTimer: 1.4 + rng() * 1.8, beam,
        });
      };

      const spawnSentinel = (x: number, y: number) => {
        const view = makeSentinelView();
        view.position.set(x, y);
        world.addChild(view);
        sentinels.push({
          id: nextId(), x, y, vx: 0, vy: 0, radius: 27, view,
          fireTimer: 0.5 + rng() * 1.5, orbit: rng() < 0.5 ? -1 : 1, health: 2,
        });
      };

      const makeProjectileView = (kind: Projectile["kind"]) => {
        const container = new PIXI.Container();
        const glow = new PIXI.Graphics();
        const shape = new PIXI.Graphics();
        if (kind === "laser") {
          glow.moveTo(-25, 0).lineTo(22, 0).stroke({ color: 0x47eaff, width: 9, alpha: 0.12 });
          shape.moveTo(-20, 0).lineTo(20, 0).stroke({ color: 0xc7fbff, width: 2.5, alpha: 0.96 });
        } else if (kind === "bolt") {
          glow.circle(0, 0, 12).fill({ color: 0x8c64ff, alpha: 0.2 });
          shape.circle(0, 0, 4).fill({ color: 0xe2d5ff, alpha: 0.96 });
        } else {
          glow.circle(0, 0, 30).fill({ color: 0xff7d3d, alpha: 0.16 });
          glow.circle(0, 0, 19).stroke({ color: 0xa45dff, width: 3, alpha: 0.75 });
          shape.poly([13, 0, 0, -9, -13, 0, 0, 9]).fill({ color: 0xffe3a8, alpha: 0.96 });
        }
        glow.blendMode = "add";
        container.addChild(glow, shape);
        return container;
      };

      const spawnProjectile = (
        kind: Projectile["kind"], x: number, y: number, vx: number, vy: number,
      ) => {
        const view = makeProjectileView(kind);
        view.position.set(x, y);
        view.rotation = Math.atan2(vy, vx);
        world.addChild(view);
        projectiles.push({
          id: nextId(), x, y, vx, vy, radius: kind === "nova" ? 13 : kind === "bolt" ? 6 : 5,
          view, owner: kind === "bolt" ? "enemy" : "player", kind, age: 0,
          lifetime: kind === "nova" ? 8 : kind === "bolt" ? 4 : 1.35,
        });
      };

      const spawnBurst = (x: number, y: number, color: number, count: number, force = 1) => {
        const actualCount = Math.max(1, Math.ceil(
          count * (localReducedFx ? 0.5 : 1) * localEffectIntensity * (localReducedFlashing ? 0.62 : 1),
        ));
        for (let index = 0; index < actualCount && particles.length < 420; index += 1) {
          const angle = rng() * Math.PI * 2;
          const speed = (40 + rng() * 310) * force;
          const view = new PIXI.Graphics();
          const size = 1.5 + rng() * 4.5 * force;
          if (rng() < 0.58) view.circle(0, 0, size).fill({ color, alpha: 0.75 + rng() * 0.25 });
          else view.poly([-size, -size * 0.35, size, 0, -size, size * 0.35]).fill({ color, alpha: 0.86 });
          view.blendMode = localReducedFlashing ? "normal" : "add";
          view.position.set(x, y);
          world.addChild(view);
          particles.push({
            id: nextId(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            radius: size, view, age: 0, lifetime: 0.45 + rng() * 1.05 * force,
            spin: (rng() - 0.5) * 7, startScale: 0.7 + rng() * 1.1,
          });
        }
      };

      const syncEngineParts = () => {
        engine.parts.forEach((part, index) => {
          if (index < pieces) {
            part.alpha = 1;
            part.scale.set(1);
          } else {
            part.alpha = 0.055;
            part.scale.set(0.54);
          }
        });
        if (engine.active) {
          const disabled = RULES.engineHits - engine.health;
          for (let index = 0; index < disabled; index += 1) {
            const part = engine.parts[(index * 3 + 2) % engine.parts.length];
            part.alpha = 0.2;
            part.scale.set(0.84);
          }
        }
      };

      const clearWorld = () => {
        for (const child of world.removeChildren()) child.destroy({ children: true });
        planetoids = [];
        crystals = [];
        fabricators = [];
        sentinels = [];
        projectiles = [];
        particles = [];
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
        player = createPlayer();
        engine = createEngine();
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
        audio.setMusicIntensity(1);
        syncEngineParts();
        shake = Math.max(shake, 32);
        audio.warning(1);
        notify("THE DREAD ENGINE IS AWAKE", true);
        voiceLine("The forge is awake. Signal acquired.");
      };

      const depositPiece = (fabricator: Fabricator) => {
        fabricator.carrying = false;
        fabricator.targetId = undefined;
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
        score += 15000;
        victoryTimer = holdShowcase ? 999 : 5.5;
        shake = localReducedFx ? 10 : 48;
        audio.setMusicIntensity(0);
        audio.explosion(1, panFor(engine.x));
        notify("DREAD ENGINE RUPTURED · FIELD SECURED");
        voiceLine("Containment lost. The forge is broken.");
        engine.parts.forEach((part, index) => {
          part.alpha = index % 3 === 0 ? 0.05 : 0.34;
          part.rotation += (index % 2 ? 1 : -1) * 0.35;
        });
        engine.core.alpha = 0.28;
        spawnBurst(engine.x, engine.y, 0xff8b48, 110, 1.65);
        spawnBurst(engine.x, engine.y, 0xba6cff, 90, 1.35);
      };

      const killPlayer = () => {
        if (player.invulnerable > 0 || localMode !== "playing") return;
        lives -= 1;
        player.invulnerable = 2.8;
        player.vx = 0;
        player.vy = 0;
        shake = Math.max(shake, localReducedFx ? 8 : 28);
        spawnBurst(player.x, player.y, 0x65eaff, 52, 1.15);
        spawnBurst(player.x, player.y, 0xff7844, 38, 0.9);
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
        const addContact = (entity: Entity, kind: ContactKind) => {
          const dx = entity.x - player.x;
          const dy = entity.y - player.y;
          if (Math.abs(dx) > range || Math.abs(dy) > range) return;
          contacts.push({
            id: entity.id,
            kind,
            x: clamp(50 + (dx / range) * 48, 3, 97),
            y: clamp(50 + (dy / range) * 48, 3, 97),
          });
        };
        fabricators.slice(0, 9).forEach((entity) => addContact(entity, "worker"));
        sentinels.slice(0, 8).forEach((entity) => addContact(entity, "warrior"));
        if (!engine.destroyed) addContact(engine, "boss");
        setHud({
          score, lives, charges, zone, pieces, engineHealth: engine.health,
          engineActive: engine.active, contacts,
        });
      };

      const launchLaser = () => {
        if (fireCooldown > 0) return;
        fireCooldown = 0.115;
        const speed = 1250;
        const muzzleX = player.x + Math.cos(player.angle) * 40;
        const muzzleY = player.y + Math.sin(player.angle) * 40;
        spawnProjectile("laser", muzzleX, muzzleY, Math.cos(player.angle) * speed + player.vx * 0.3, Math.sin(player.angle) * speed + player.vy * 0.3);
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

      const startGame = () => {
        resetWorld(true);
        localMode = "playing";
        setScreenMode("playing");
        setNotice(null);
        void audio.unlock();
        notify("FIELD 01 · CINDER EXPANSE");
        app?.canvas.focus();
        refreshHud();
      };

      const togglePause = () => {
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
        startGame();
        player.invulnerable = 999;
        if (scene === "mining") {
          charges = 5;
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
              spawnProjectile("bolt", sentinel.x, sentinel.y, Math.cos(aim) * 245, Math.sin(aim) * 245);
            }
          });
        }
        if (["pursuit", "bombardment", "destruction"].includes(scene)) {
          pieces = RULES.enginePieces;
          activateEngine();
          engine.x = player.x + 560;
          engine.y = player.y - 130;
          engine.view.position.set(engine.x, engine.y);
          charges = 16;
        }
        if (scene === "bombardment") {
          for (let index = 0; index < 7; index += 1) {
            const angle = (index / 7) * Math.PI * 2;
            spawnProjectile("nova", engine.x + Math.cos(angle) * 310, engine.y + Math.sin(angle) * 310, -Math.cos(angle) * 430, -Math.sin(angle) * 430);
          }
        }
        if (scene === "destruction") {
          holdShowcase = true;
          engine.health = 0;
          destroyEngine();
        }
        if (scene === "gameover") {
          lives = 0;
          localMode = "gameover";
          setScreenMode("gameover");
        }
        if (["exploration", "mining", "construction", "combat", "gameover"].includes(scene)) setNotice(null);
        cameraX = player.x;
        cameraY = player.y;
        cameraZoom = engine.active && !engine.destroyed ? 0.8 : 0.91;
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
        fireCooldown = Math.max(0, fireCooldown - dt);
        novaCooldown = Math.max(0, novaCooldown - dt);
        player.invulnerable = Math.max(0, player.invulnerable - dt);

        let inputX = 0;
        let inputY = 0;
        if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX -= 1;
        if (keys.has("ArrowRight") || keys.has("KeyD")) inputX += 1;
        if (keys.has("ArrowUp") || keys.has("KeyW")) inputY -= 1;
        if (keys.has("ArrowDown") || keys.has("KeyS")) inputY += 1;

        const pad = navigator.getGamepads?.()[0];
        let padFire = false;
        let padBomb = false;
        if (pad) {
          const px = Math.abs(pad.axes[0] ?? 0) > 0.12 ? pad.axes[0] : 0;
          const py = Math.abs(pad.axes[1] ?? 0) > 0.12 ? pad.axes[1] : 0;
          if (Math.hypot(px, py) > Math.hypot(inputX, inputY)) { inputX = px; inputY = py; }
          padFire = pad.buttons[0]?.pressed ?? false;
          padBomb = (pad.buttons[1]?.pressed ?? false) || (pad.buttons[2]?.pressed ?? false);
        }
        if (localMode !== "playing") return;

        const rawMagnitude = Math.min(1, Math.hypot(inputX, inputY));
        const band = Math.round(rawMagnitude * 6) / 6;
        if (rawMagnitude > 0.01) {
          inputX /= rawMagnitude;
          inputY /= rawMagnitude;
          const acceleration = 780 * band;
          player.vx += inputX * acceleration * dt;
          player.vy += inputY * acceleration * dt;
          const targetAngle = Math.atan2(inputY, inputX);
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
        player.x = clamp(player.x + player.vx * dt, 180, RULES.worldWidth - 180);
        player.y = clamp(player.y + player.vy * dt, 180, RULES.worldHeight - 180);
        player.view.position.set(player.x, player.y);
        player.view.rotation = player.angle;
        player.engineFlare.scale.x = 0.72 + band * 0.72 + rng() * 0.12;
        player.engineFlare.alpha = 0.36 + band * 0.64;
        player.view.alpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 11) % 2 === 0 ? 0.3 : 1;
        audio.setEngineThrust(band);

        if (keys.has("Space") || padFire) launchLaser();
        if ((keys.has("KeyC") || keys.has("ShiftLeft") || keys.has("ShiftRight")) && novaCooldown <= 0) launchNova();
        if (padBomb && !lastGamepadBomb) launchNova();
        lastGamepadBomb = padBomb;

        for (const planetoid of planetoids) {
          planetoid.x += planetoid.vx * dt;
          planetoid.y += planetoid.vy * dt;
          planetoid.view.position.set(planetoid.x, planetoid.y);
          planetoid.view.rotation += dt * 0.025;
        }

        for (const crystal of crystals) {
          crystal.age += dt;
          crystal.vx *= Math.exp(-0.72 * dt);
          crystal.vy *= Math.exp(-0.72 * dt);
          crystal.x += crystal.vx * dt;
          crystal.y += crystal.vy * dt;
          crystal.view.position.set(crystal.x, crystal.y);
          crystal.view.rotation += dt * 2.2;
          crystal.view.scale.set(1 + Math.sin(crystal.age * 5) * 0.08);
          if (circlesOverlap(player, crystal)) {
            crystal.dead = true;
            charges = Math.min(RULES.maxCharges, charges + 1);
            score += 200;
            audio.crystal(panFor(crystal.x));
            spawnBurst(crystal.x, crystal.y, 0x69f3ff, 14, 0.55);
          }
        }

        for (const fabricator of fabricators) {
          let tx = engine.x;
          let ty = engine.y;
          if (!fabricator.carrying) {
            let target = crystals.find((crystal) => crystal.id === fabricator.targetId && !crystal.dead && crystal.claimedBy === fabricator.id);
            if (!target) {
              target = nearest(fabricator, crystals.filter((crystal) => !crystal.claimedBy));
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
                  fabricator.miningTimer -= dt;
                  fabricator.beam.clear().moveTo(0, 0).lineTo(rock.x - fabricator.x, rock.y - fabricator.y)
                    .stroke({ color: 0xff8d45, width: 1.5, alpha: 0.46 });
                  if (fabricator.miningTimer <= 0) {
                    fabricator.miningTimer = 2.5 + rng() * 1.6;
                    rock.shards = Math.max(0, rock.shards - 1);
                    rock.integrity = Math.max(0, rock.integrity - 7);
                    rock.cracks.alpha = 0.18 + (1 - rock.integrity / rock.maxIntegrity) * 0.78;
                    fabricator.carrying = true;
                    spawnBurst(rock.x, rock.y, 0xff9a4b, 8, 0.36);
                    if (rock.integrity <= 0) rock.dead = true;
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
          fabricator.view.scale.set(fabricator.carrying ? 1.18 : 1);
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
          sentinel.fireTimer -= dt;
          if (sentinel.fireTimer <= 0 && d < 1450) {
            sentinel.fireTimer = (engine.active ? 0.82 : 1.25) + rng() * 0.7;
            const aim = Math.atan2(dy, dx) + (rng() - 0.5) * 0.11;
            spawnProjectile("bolt", sentinel.x, sentinel.y, Math.cos(aim) * 385, Math.sin(aim) * 385);
          }
        }

        if (engine.active && !engine.destroyed) {
          steer(engine, player.x, player.y, 310 + zone * 13, dt);
          engine.x += engine.vx * dt;
          engine.y += engine.vy * dt;
          if (circlesOverlap(player, engine)) killPlayer();
        }
        engine.view.position.set(engine.x, engine.y);
        engine.outerRing.rotation += dt * (engine.active ? 0.72 : 0.09);
        engine.innerRing.rotation -= dt * (engine.active ? 1.08 : 0.13);
        engine.core.scale.set(engine.active ? 1 + Math.sin(performance.now() * 0.008) * 0.08 : 0.88 + (pieces / RULES.enginePieces) * 0.12);

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
          projectile.view.rotation = Math.atan2(projectile.vy, projectile.vx) + (projectile.kind === "nova" ? projectile.age * 2.2 : 0);

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
              planetoid.cracks.alpha = 0.18 + (1 - planetoid.integrity / planetoid.maxIntegrity) * 0.78;
              spawnBurst(projectile.x, projectile.y, 0xffa251, 6, 0.3);
              if (result.emitted) spawnCrystal(projectile.x, projectile.y);
              if (result.destroyed) {
                planetoid.dead = true;
                score += 5;
                spawnBurst(planetoid.x, planetoid.y, 0xc4a07b, 35, 0.9);
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
                spawnBurst(fabricator.x, fabricator.y, 0xff8a48, 26, 0.7);
                audio.explosion(0.25, panFor(fabricator.x));
                break;
              }
            }
            if (projectile.dead) continue;
            for (const sentinel of sentinels) {
              if (!sentinel.dead && circlesOverlap(projectile, sentinel)) {
                projectile.dead = true;
                sentinel.health -= 1;
                spawnBurst(sentinel.x, sentinel.y, 0x9089ff, 12, 0.45);
                if (sentinel.health <= 0) {
                  sentinel.dead = true;
                  score += 500;
                  audio.explosion(0.45, panFor(sentinel.x));
                  spawnBurst(sentinel.x, sentinel.y, 0x7e8fff, 30, 0.8);
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
                spawnBurst(projectile.x, projectile.y, 0xffb45b, 42, 0.85);
                audio.explosion(0.5, panFor(projectile.x));
                notify("NOVA CHARGE INTERCEPTED", true);
              }
            }
          }
        }

        for (const particle of particles) {
          particle.age += dt;
          if (particle.age >= particle.lifetime) { particle.dead = true; continue; }
          particle.vx *= Math.exp(-1.25 * dt);
          particle.vy *= Math.exp(-1.25 * dt);
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.view.position.set(particle.x, particle.y);
          particle.view.rotation += particle.spin * dt;
          const life = 1 - particle.age / particle.lifetime;
          particle.view.alpha = life;
          particle.view.scale.set(particle.startScale * (0.3 + life * 0.7));
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
        const bgScale = Math.max(width / background.texture.width, height / background.texture.height) * 1.04;
        background.scale.set(bgScale);
        background.x = (width - background.texture.width * bgScale) / 2 - (cameraX - RULES.worldWidth / 2) * 0.006;
        background.y = (height - background.texture.height * bgScale) / 2 - (cameraY - RULES.worldHeight / 2) * 0.006;

        for (const star of stars) {
          star.view.x = ((star.x * width - cameraX * star.factor) % width + width) % width;
          star.view.y = ((star.y * height - cameraY * star.factor) % height + height) % height;
        }

        if (localMode !== "title") {
          const leadX = localReducedFx ? 0 : player.vx * 0.34;
          const leadY = localReducedFx ? 0 : player.vy * 0.34;
          cameraX = lerp(cameraX, player.x + leadX, 1 - Math.exp(-dt * 3.8));
          cameraY = lerp(cameraY, player.y + leadY, 1 - Math.exp(-dt * 3.8));
        } else {
          cameraX = lerp(cameraX, player.x + 260, dt * 0.12);
          cameraY = lerp(cameraY, player.y, dt * 0.12);
          player.view.rotation += dt * 0.08;
          engine.outerRing.rotation += dt * 0.06;
          engine.innerRing.rotation -= dt * 0.08;
        }
        const desiredZoom = localReducedFx ? 0.86 : engine.active && !engine.destroyed ? 0.8 : 0.91;
        cameraZoom = lerp(cameraZoom, desiredZoom, 1 - Math.exp(-dt * 1.8));
        shake = Math.max(0, shake - dt * 45);
        const shakeX = localReducedFx ? 0 : (rng() - 0.5) * shake;
        const shakeY = localReducedFx ? 0 : (rng() - 0.5) * shake;
        const presentationScale = clamp(Math.min(width / 1920, height / 1080), 0.85, 2);
        const worldScale = cameraZoom * presentationScale;
        world.scale.set(worldScale);
        world.position.set(width / 2 - cameraX * worldScale + shakeX, height / 2 - cameraY * worldScale + shakeY);

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
      const onBlur = () => keys.clear();
      const onPointerDown = () => { void audio.unlock(); app?.canvas.focus(); };
      window.addEventListener("keydown", onKeyDown, { passive: false });
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      app.canvas.addEventListener("pointerdown", onPointerDown);

      gameApiRef.current = {
        start: startGame,
        restart: startGame,
        togglePause,
        setMuted(value) {
          audio.setMuted(value);
          if (value && "speechSynthesis" in window) window.speechSynthesis.cancel();
        },
        setReducedFx(value) { localReducedFx = value; },
        setReducedFlashing(value) { localReducedFlashing = value; },
        setEffectIntensity(value) { localEffectIntensity = clamp(value, 0.35, 1); },
        setHighContrast(value) {
          background.alpha = value ? 0.48 : 0.72;
          starLayer.alpha = value ? 1 : 0.82;
        },
      };

      setReady(true);
      const showcase = new URLSearchParams(window.location.search).get("showcase");
      if (showcase) configureShowcase(showcase);

      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
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
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (shellRef.current) void shellRef.current.requestFullscreen();
  };

  const cycleEffectIntensity = () => {
    setEffectIntensity((value) => value === 1 ? 0.7 : value === 0.7 ? 0.35 : 1);
  };

  const cycleColorMode = () => {
    const modes = ["standard", "deuteranopia", "protanopia", "tritanopia"] as const;
    setColorMode((value) => modes[(modes.indexOf(value) + 1) % modes.length]);
  };

  const intensityLabel = effectIntensity === 1 ? "Full" : effectIntensity === 0.7 ? "Balanced" : "Low";
  const colorLabel = colorMode === "standard" ? "Standard" : colorMode.slice(0, 4).toUpperCase();

  return (
    <main
      className={`voidforge-shell ${reducedFx ? "reduced-fx" : ""} ${reducedFlashing ? "reduced-flashing" : ""} effect-${intensityLabel.toLowerCase()} color-${colorMode} ${highContrast ? "high-contrast" : ""}`}
      ref={shellRef}
      style={captureOffset ? { transform: `translateX(-${captureOffset}px)` } : undefined}
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
                  disabled={!ready}
                  onClick={() => gameApiRef.current.start()}
                >
                  {ready ? "Enter the Expanse" : "Calibrating field…"}
                </button>
                <span className="version-mark">Vesper flight core<br />build 01.26</span>
              </div>
            </div>
            <MissionBriefing />
          </section>
        )}

        {screenMode !== "title" && <HeadsUpDisplay hud={hud} />}

        {notice && (
          <div className={`center-alert ${notice.danger ? "danger" : ""}`} key={notice.key} role="status">
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
            <div className="help-grid">
              <div><h3>Variable thrust</h3><p>Use WASD, arrow keys, or a gamepad stick. Six thrust bands recreate the original variable-speed arcade feel.</p></div>
              <div><h3>Mine carefully</h3><p>Tap Space to cut Flux Shards from planetoids. Firing too rapidly destroys the rock before it yields everything.</p></div>
              <div><h3>Deny assembly</h3><p>Orange Fabricators steal loose Flux and carry it to the Dread Engine. Violet Sentinels protect them.</p></div>
              <div><h3>Launch Nova Charges</h3><p>Press C or Shift. Charges home toward an active Engine, but asteroids and Sentinels can intercept them.</p></div>
              <div><h3>Pause and restart</h3><p>Press P or Escape to pause. Press R after signal loss to restart the run.</p></div>
              <div><h3>Accessibility</h3><p>Reduce motion or flashing independently, tune effect density, select a color profile, increase contrast, or mute procedural audio.</p></div>
            </div>
          </section>
        )}

        <nav className="utility-bar" aria-label="Game options">
          <button className="utility-button" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
            <span aria-hidden="true">{muted ? "◌" : "◉"}</span><span className="utility-label">Sound</span>
          </button>
          <button className="utility-button" aria-pressed={reducedFx} onClick={() => setReducedFx((value) => !value)}>
            <span aria-hidden="true">↔</span><span className="utility-label">Motion</span>
          </button>
          <button className="utility-button" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)}>
            <span aria-hidden="true">◐</span><span className="utility-label">Contrast</span>
          </button>
          <button className="utility-button" aria-pressed={reducedFlashing} onClick={() => setReducedFlashing((value) => !value)}>
            <span aria-hidden="true">☼</span><span className="utility-label">Flashing</span>
          </button>
          <button className="utility-button" aria-label={`Effect intensity: ${intensityLabel}`} onClick={cycleEffectIntensity}>
            <span aria-hidden="true">FX</span><span className="utility-label">{intensityLabel}</span>
          </button>
          <button className="utility-button" aria-label={`Color profile: ${colorLabel}`} onClick={cycleColorMode}>
            <span aria-hidden="true">C</span><span className="utility-label">{colorLabel}</span>
          </button>
          <button className="utility-button" aria-expanded={helpOpen} onClick={() => setHelpOpen((value) => !value)}>
            <span aria-hidden="true">?</span><span className="utility-label">Help</span>
          </button>
          <button className="utility-button" onClick={toggleFullscreen}>
            <span aria-hidden="true">⛶</span><span className="utility-label">Fullscreen</span>
          </button>
        </nav>
        <p className="portrait-notice">Rotate to landscape for full flight control</p>
        <p className="sr-only" aria-live="polite">{notice?.text ?? ""}</p>
      </div>
    </main>
  );
}
