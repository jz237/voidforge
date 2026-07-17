/**
 * Runtime-synthesized audio for the game.
 *
 * The module has no top-level browser side effects: create an instance during
 * render if convenient, then call `unlock()` from a click/key/pointer handler.
 * All effect methods are safe no-ops until the browser grants audio access.
 */

export interface GameAudioOptions {
  /** Initial master volume, normalized to 0..1. Defaults to 0.7. */
  volume?: number;
  /** Start muted while still allowing the audio graph to be unlocked. */
  muted?: boolean;
}

type OscillatorWave = OscillatorType;

interface ToneOptions {
  wave: OscillatorWave;
  startFrequency: number;
  endFrequency: number;
  duration: number;
  level: number;
  pan: number;
  delay?: number;
  attack?: number;
  detune?: number;
  filterType?: BiquadFilterType;
  filterFrequency?: number;
  endFilterFrequency?: number;
  filterQ?: number;
}

interface NoiseOptions {
  duration: number;
  level: number;
  pan: number;
  filterType: BiquadFilterType;
  filterFrequency: number;
  endFilterFrequency: number;
  filterQ?: number;
  delay?: number;
  attack?: number;
  playbackRate?: number;
  endPlaybackRate?: number;
}

interface EngineGraph {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  tonalGain: GainNode;
  noiseGain: GainNode;
  filter: BiquadFilterNode;
  primary: OscillatorNode;
  secondary: OscillatorNode;
}

interface MusicGraph {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  droneGain: GainNode;
  pulseLevel: GainNode;
  percussionLevel: GainNode;
  filter: BiquadFilterNode;
  bass: OscillatorNode;
  tension: OscillatorNode;
  pulse: OscillatorNode;
  rhythm: OscillatorNode;
  startedAt: number;
  noteIndex: number;
}

type AudioContextConstructor = new () => AudioContext;

const MIN_GAIN = 0.0001;
const MUSIC_BEAT_SECONDS = 60 / 108;
const MUSIC_ROOTS = [55, 58.27, 65.41, 73.42] as const;

function clamp(value: number, minimum = 0, maximum = 1): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * A small Web Audio facade for original, procedural game sounds.
 *
 * Suggested lifecycle:
 * `const audio = new VoidforgeAudio()` -> `await audio.unlock()` on interaction ->
 * trigger effects / call `setEngineThrust()` each frame -> `cleanup()` on unmount.
 */
export class VoidforgeAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private engine: EngineGraph | null = null;
  private music: MusicGraph | null = null;
  private readonly activeSources = new Set<AudioScheduledSourceNode>();

  private volume: number;
  private mutedState: boolean;
  private thrust = 0;
  private musicIntensity = 0;
  private disposed = false;

  public constructor(options: GameAudioOptions = {}) {
    this.volume = clamp(options.volume ?? 0.7);
    this.mutedState = options.muted ?? false;
  }

  /** Whether an audio graph has been created and has not been closed. */
  public get isUnlocked(): boolean {
    return this.context !== null && this.context.state !== "closed";
  }

  /** Current logical mute state (also available before unlock). */
  public get isMuted(): boolean {
    return this.mutedState;
  }

  /**
   * Create/resume the AudioContext. Call from a trusted user interaction.
   * Returns false on the server, after cleanup, or when Web Audio is unavailable.
   */
  public async unlock(): Promise<boolean> {
    if (this.disposed || typeof window === "undefined") return false;

    if (this.context !== null) {
      if (this.context.state === "suspended") {
        try {
          await this.context.resume();
        } catch {
          return false;
        }
      }
      return this.context.state !== "closed";
    }

    const browserWindow = window as Window & {
      webkitAudioContext?: AudioContextConstructor;
    };
    const nativeContext =
      typeof AudioContext === "undefined" ? undefined : AudioContext;
    const Context: AudioContextConstructor | undefined =
      nativeContext ?? browserWindow.webkitAudioContext;
    if (Context === undefined) return false;

    let createdContext: AudioContext | null = null;
    try {
      const context = new Context();
      createdContext = context;
      this.context = context;
      this.buildGraph(context);
      if (context.state === "suspended") await context.resume();
      return context.state !== "closed";
    } catch {
      this.stopAndDisconnect();
      if (createdContext !== null && createdContext.state !== "closed") {
        void createdContext.close().catch(() => undefined);
      }
      this.context = null;
      return false;
    }
  }

  /** Alias for `unlock()`, useful for game bootstrap code. */
  public start(): Promise<boolean> {
    return this.unlock();
  }

  /** Mute or unmute with a short de-clicking ramp. */
  public setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.applyMasterLevel(0.025);
  }

  /** Toggle mute and return the new state. */
  public toggleMuted(): boolean {
    this.setMuted(!this.mutedState);
    return this.mutedState;
  }

  /** Set normalized master volume without changing the mute state. */
  public setVolume(volume: number): void {
    this.volume = clamp(volume);
    this.applyMasterLevel(0.025);
  }

  /**
   * Drive the continuous engine layer with a normalized thrust value.
   * Values are stored before unlock, so the engine starts in the right state.
   */
  public setEngineThrust(intensity: number): void {
    this.thrust = clamp(intensity);
    const context = this.context;
    const engine = this.engine;
    if (context === null || engine === null || context.state === "closed") return;

    const now = context.currentTime;
    const audibleThrust = this.thrust <= 0.002 ? 0 : this.thrust;
    this.glide(engine.tonalGain.gain, MIN_GAIN + audibleThrust * 0.052, now, 0.07);
    this.glide(engine.noiseGain.gain, MIN_GAIN + audibleThrust * 0.032, now, 0.09);
    this.glide(engine.filter.frequency, 150 + audibleThrust * 920, now, 0.1);
    this.glide(engine.primary.frequency, 42 + audibleThrust * 50, now, 0.08);
    this.glide(engine.secondary.frequency, 64 + audibleThrust * 72, now, 0.08);
  }

  /**
   * Set the adaptive music bed from silence (0) to full pursuit (1).
   *
   * A rising value layers construction drone, rhythmic pulses, and synthetic
   * percussion. Note changes are quantized to beats; layer changes crossfade
   * over beat-length intervals. Set to 0 after destruction for a two-beat release.
   * Values are remembered safely when called before `unlock()`.
   */
  public setMusicIntensity(intensity: number): void {
    this.musicIntensity = clamp(intensity);
    this.applyMusicIntensity();
  }

  /** Tight descending energy bolt. `pan` is normalized from -1 to 1. */
  public laser(pan = 0): void {
    this.tone({
      wave: "sawtooth",
      startFrequency: 1_360,
      endFrequency: 210,
      duration: 0.115,
      level: 0.12,
      pan,
      attack: 0.002,
      filterType: "bandpass",
      filterFrequency: 2_300,
      endFilterFrequency: 760,
      filterQ: 2.4,
    });
    this.tone({
      wave: "triangle",
      startFrequency: 2_040,
      endFrequency: 610,
      duration: 0.07,
      level: 0.052,
      pan,
      delay: 0.006,
      attack: 0.001,
    });
    this.noise({
      duration: 0.055,
      level: 0.028,
      pan,
      filterType: "highpass",
      filterFrequency: 2_500,
      endFilterFrequency: 1_200,
      filterQ: 1.2,
      attack: 0.001,
    });
  }

  /** Bright three-part harmonic shimmer for collecting a crystal. */
  public crystalPickup(pan = 0): void {
    const notes = [622, 933, 1_397];
    notes.forEach((frequency, index) => {
      this.tone({
        wave: index === 2 ? "sine" : "triangle",
        startFrequency: frequency,
        endFrequency: frequency * 1.035,
        duration: 0.22 - index * 0.025,
        level: 0.072 - index * 0.012,
        pan,
        delay: index * 0.045,
        attack: 0.006,
        detune: index === 1 ? 7 : 0,
        filterType: "highpass",
        filterFrequency: 420,
        endFilterFrequency: 620,
        filterQ: 0.7,
      });
    });
  }

  /** Short API alias used by the gameplay layer. */
  public crystal(pan = 0): void {
    this.crystalPickup(pan);
  }

  /** Metallic assembly strike; `progress` is normalized construction progress. */
  public constructionTick(progress = 0, pan = 0): void {
    const stage = clamp(progress);
    const root = 168 + stage * 92;
    this.tone({
      wave: "square",
      startFrequency: root * 3.17,
      endFrequency: root * 1.8,
      duration: 0.095,
      level: 0.066,
      pan,
      attack: 0.001,
      filterType: "bandpass",
      filterFrequency: 1_160 + stage * 540,
      endFilterFrequency: 610,
      filterQ: 5.5,
    });
    this.tone({
      wave: "triangle",
      startFrequency: root,
      endFrequency: root * 0.72,
      duration: 0.2,
      level: 0.07,
      pan,
      attack: 0.002,
    });
    this.noise({
      duration: 0.075,
      level: 0.052,
      pan,
      filterType: "bandpass",
      filterFrequency: 2_200 + stage * 1_000,
      endFilterFrequency: 920,
      filterQ: 3.2,
      attack: 0.001,
    });
  }

  /** Short API alias used by the gameplay layer. */
  public construction(progress = 0, pan = 0): void {
    this.constructionTick(progress, pan);
  }

  /** Two-pulse synthetic warning klaxon; `urgency` raises pitch and bite. */
  public warning(urgency = 0): void {
    const amount = clamp(urgency);
    const root = 174 + amount * 74;
    for (let pulse = 0; pulse < 2; pulse += 1) {
      this.tone({
        wave: "sawtooth",
        startFrequency: root * 1.23,
        endFrequency: root,
        duration: 0.17,
        level: 0.085 + amount * 0.025,
        pan: pulse === 0 ? -0.08 : 0.08,
        delay: pulse * (0.2 - amount * 0.035),
        attack: 0.012,
        filterType: "lowpass",
        filterFrequency: 1_050 + amount * 900,
        endFilterFrequency: 680,
        filterQ: 1.8,
      });
      this.tone({
        wave: "triangle",
        startFrequency: root * 0.505,
        endFrequency: root * 0.47,
        duration: 0.2,
        level: 0.058,
        pan: 0,
        delay: pulse * (0.2 - amount * 0.035),
        attack: 0.01,
      });
    }
  }

  /** Rising, weighty launch sound for a homing bomb. */
  public bombLaunch(pan = 0): void {
    this.tone({
      wave: "sawtooth",
      startFrequency: 82,
      endFrequency: 510,
      duration: 0.48,
      level: 0.12,
      pan,
      attack: 0.018,
      filterType: "lowpass",
      filterFrequency: 280,
      endFilterFrequency: 2_100,
      filterQ: 1.4,
    });
    this.tone({
      wave: "sine",
      startFrequency: 48,
      endFrequency: 96,
      duration: 0.34,
      level: 0.105,
      pan,
      attack: 0.006,
    });
    this.noise({
      duration: 0.4,
      level: 0.055,
      pan,
      filterType: "bandpass",
      filterFrequency: 240,
      endFilterFrequency: 1_900,
      filterQ: 1.1,
      attack: 0.018,
      playbackRate: 0.72,
      endPlaybackRate: 1.35,
    });
  }

  /** Short API alias used by the gameplay layer. */
  public bomb(pan = 0): void {
    this.bombLaunch(pan);
  }

  /** Dense metallic impact for a successful hit on the antagonist. */
  public bossHit(pan = 0): void {
    this.tone({
      wave: "square",
      startFrequency: 116,
      endFrequency: 43,
      duration: 0.38,
      level: 0.13,
      pan,
      attack: 0.002,
      filterType: "lowpass",
      filterFrequency: 730,
      endFilterFrequency: 190,
      filterQ: 1.5,
    });
    this.tone({
      wave: "sawtooth",
      startFrequency: 1_240,
      endFrequency: 156,
      duration: 0.17,
      level: 0.06,
      pan,
      attack: 0.001,
      filterType: "bandpass",
      filterFrequency: 1_600,
      endFilterFrequency: 360,
      filterQ: 4.2,
    });
    this.noise({
      duration: 0.31,
      level: 0.12,
      pan,
      filterType: "bandpass",
      filterFrequency: 2_300,
      endFilterFrequency: 260,
      filterQ: 1.2,
      attack: 0.001,
      playbackRate: 1.2,
      endPlaybackRate: 0.58,
    });
  }

  /** Layered procedural blast. `size` and `pan` are normalized. */
  public explosion(size = 0.7, pan = 0): void {
    const amount = clamp(size);
    const duration = 0.3 + amount * 0.55;
    this.noise({
      duration,
      level: 0.08 + amount * 0.13,
      pan,
      filterType: "lowpass",
      filterFrequency: 1_300 + amount * 1_350,
      endFilterFrequency: 105 + amount * 80,
      filterQ: 0.85,
      attack: 0.002,
      playbackRate: 1 + amount * 0.35,
      endPlaybackRate: 0.42,
    });
    this.tone({
      wave: "sawtooth",
      startFrequency: 82 + amount * 38,
      endFrequency: 27,
      duration: duration * 0.82,
      level: 0.075 + amount * 0.105,
      pan,
      attack: 0.002,
      filterType: "lowpass",
      filterFrequency: 410 + amount * 260,
      endFilterFrequency: 90,
      filterQ: 1.1,
    });
    this.noise({
      duration: 0.07 + amount * 0.07,
      level: 0.05 + amount * 0.075,
      pan,
      filterType: "highpass",
      filterFrequency: 2_900,
      endFilterFrequency: 1_250,
      filterQ: 0.9,
      attack: 0.001,
      playbackRate: 1.5,
      endPlaybackRate: 0.9,
    });
  }

  /** Distinct descending system-collapse sequence for player destruction. */
  public playerDeath(): void {
    this.noise({
      duration: 1.05,
      level: 0.155,
      pan: 0,
      filterType: "lowpass",
      filterFrequency: 2_800,
      endFilterFrequency: 95,
      filterQ: 0.8,
      attack: 0.002,
      playbackRate: 1.15,
      endPlaybackRate: 0.35,
    });
    const frequencies = [880, 622, 416, 247];
    frequencies.forEach((frequency, index) => {
      this.tone({
        wave: index % 2 === 0 ? "square" : "sawtooth",
        startFrequency: frequency,
        endFrequency: frequency * 0.42,
        duration: 0.26 + index * 0.065,
        level: 0.082 + index * 0.012,
        pan: index % 2 === 0 ? -0.18 : 0.18,
        delay: index * 0.105,
        attack: 0.003,
        filterType: "lowpass",
        filterFrequency: 2_200 - index * 310,
        endFilterFrequency: 210,
        filterQ: 1.5,
      });
    });
    this.tone({
      wave: "sine",
      startFrequency: 76,
      endFrequency: 24,
      duration: 1.08,
      level: 0.17,
      pan: 0,
      attack: 0.006,
    });
  }

  /** Permanently stop this instance and release its AudioContext. */
  public cleanup(): void {
    if (this.disposed) return;
    this.disposed = true;
    const context = this.context;
    this.stopAndDisconnect();
    this.context = null;
    if (context !== null && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  /** Gameplay-lifecycle alias for `cleanup()`. */
  public destroy(): void {
    this.cleanup();
  }

  private buildGraph(context: AudioContext): void {
    const masterGain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const effectsBus = context.createGain();
    const engineBus = context.createGain();
    const musicBus = context.createGain();

    masterGain.gain.value = this.mutedState ? 0 : this.volume;
    effectsBus.gain.value = 0.78;
    engineBus.gain.value = 0.72;
    musicBus.gain.value = 0;
    compressor.threshold.value = -17;
    compressor.knee.value = 14;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;

    effectsBus.connect(compressor);
    engineBus.connect(compressor);
    musicBus.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(context.destination);

    this.masterGain = masterGain;
    this.compressor = compressor;
    this.effectsBus = effectsBus;
    this.engineBus = engineBus;
    this.musicBus = musicBus;
    this.noiseBuffer = this.createNoiseBuffer(context);
    this.engine = this.createEngine(context, engineBus);
    this.music = this.createMusic(context, musicBus);
    this.setEngineThrust(this.thrust);
    this.applyMusicIntensity();
  }

  private createEngine(context: AudioContext, destination: AudioNode): EngineGraph {
    const primary = context.createOscillator();
    const secondary = context.createOscillator();
    const tonalGain = context.createGain();
    const noiseSource = context.createBufferSource();
    const noiseGain = context.createGain();
    const filter = context.createBiquadFilter();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    primary.type = "sawtooth";
    primary.frequency.value = 42;
    secondary.type = "triangle";
    secondary.frequency.value = 64;
    secondary.detune.value = -9;
    tonalGain.gain.value = MIN_GAIN;

    noiseSource.buffer = this.noiseBuffer;
    noiseSource.loop = true;
    noiseSource.playbackRate.value = 0.72;
    noiseGain.gain.value = MIN_GAIN;

    filter.type = "lowpass";
    filter.frequency.value = 150;
    filter.Q.value = 1.15;

    lfo.type = "sine";
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 4.5;

    primary.connect(tonalGain);
    secondary.connect(tonalGain);
    tonalGain.connect(filter);
    noiseSource.connect(noiseGain);
    noiseGain.connect(filter);
    lfo.connect(lfoGain);
    lfoGain.connect(primary.frequency);
    filter.connect(destination);

    const sources: AudioScheduledSourceNode[] = [primary, secondary, noiseSource, lfo];
    sources.forEach((source) => {
      this.activeSources.add(source);
      source.start();
    });

    return {
      sources,
      nodes: [primary, secondary, tonalGain, noiseSource, noiseGain, filter, lfo, lfoGain],
      tonalGain,
      noiseGain,
      filter,
      primary,
      secondary,
    };
  }

  private createMusic(context: AudioContext, destination: AudioNode): MusicGraph {
    const bass = context.createOscillator();
    const tension = context.createOscillator();
    const pulse = context.createOscillator();
    const rhythm = context.createOscillator();
    const noiseSource = context.createBufferSource();

    const droneGain = context.createGain();
    const pulseFilter = context.createBiquadFilter();
    const pulseGate = context.createGain();
    const pulseLevel = context.createGain();
    const percussionFilter = context.createBiquadFilter();
    const percussionGate = context.createGain();
    const percussionLevel = context.createGain();
    const pulseDepth = context.createGain();
    const percussionDepth = context.createGain();
    const filter = context.createBiquadFilter();

    const root = MUSIC_ROOTS[0];
    bass.type = "triangle";
    bass.frequency.value = root;
    tension.type = "sawtooth";
    tension.frequency.value = root * 1.498;
    tension.detune.value = -7;
    pulse.type = "square";
    pulse.frequency.value = root * 2.25;
    rhythm.type = "square";
    rhythm.frequency.value = 1.7;

    noiseSource.buffer = this.noiseBuffer;
    noiseSource.loop = true;
    noiseSource.playbackRate.value = 0.58;

    droneGain.gain.value = MIN_GAIN;
    pulseFilter.type = "bandpass";
    pulseFilter.frequency.value = 520;
    pulseFilter.Q.value = 2.2;
    pulseGate.gain.value = 0.52;
    pulseLevel.gain.value = MIN_GAIN;

    percussionFilter.type = "bandpass";
    percussionFilter.frequency.value = 180;
    percussionFilter.Q.value = 1.6;
    percussionGate.gain.value = 0.48;
    percussionLevel.gain.value = MIN_GAIN;
    pulseDepth.gain.value = 0.47;
    percussionDepth.gain.value = 0.44;

    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.Q.value = 0.9;

    bass.connect(droneGain);
    tension.connect(droneGain);
    droneGain.connect(filter);

    pulse.connect(pulseFilter);
    pulseFilter.connect(pulseGate);
    pulseGate.connect(pulseLevel);
    pulseLevel.connect(filter);

    noiseSource.connect(percussionFilter);
    percussionFilter.connect(percussionGate);
    percussionGate.connect(percussionLevel);
    percussionLevel.connect(filter);

    rhythm.connect(pulseDepth);
    rhythm.connect(percussionDepth);
    pulseDepth.connect(pulseGate.gain);
    percussionDepth.connect(percussionGate.gain);
    filter.connect(destination);

    const sources: AudioScheduledSourceNode[] = [
      bass,
      tension,
      pulse,
      rhythm,
      noiseSource,
    ];
    const startedAt = context.currentTime + 0.02;
    sources.forEach((source) => {
      this.activeSources.add(source);
      source.start(startedAt);
    });

    return {
      sources,
      nodes: [
        bass,
        tension,
        pulse,
        rhythm,
        noiseSource,
        droneGain,
        pulseFilter,
        pulseGate,
        pulseLevel,
        percussionFilter,
        percussionGate,
        percussionLevel,
        pulseDepth,
        percussionDepth,
        filter,
      ],
      droneGain,
      pulseLevel,
      percussionLevel,
      filter,
      bass,
      tension,
      pulse,
      rhythm,
      startedAt,
      noteIndex: 0,
    };
  }

  private tone(options: ToneOptions): void {
    const graph = this.effectGraph();
    if (graph === null) return;
    const { context, destination } = graph;
    const start = context.currentTime + Math.max(0, options.delay ?? 0);
    const duration = Math.max(0.025, options.duration);
    const end = start + duration;
    const attackEnd = Math.min(end - 0.004, start + Math.max(0.001, options.attack ?? 0.004));

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    const filter = options.filterType === undefined ? null : context.createBiquadFilter();

    oscillator.type = options.wave;
    oscillator.detune.value = options.detune ?? 0;
    oscillator.frequency.setValueAtTime(Math.max(1, options.startFrequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency),
      end,
    );
    envelope.gain.setValueAtTime(MIN_GAIN, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, options.level), attackEnd);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
    panner.pan.value = clamp(options.pan, -1, 1);

    oscillator.connect(envelope);
    if (filter !== null) {
      filter.type = options.filterType ?? "lowpass";
      filter.Q.value = Math.max(0.0001, options.filterQ ?? 1);
      filter.frequency.setValueAtTime(Math.max(10, options.filterFrequency ?? 1_000), start);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(10, options.endFilterFrequency ?? options.filterFrequency ?? 1_000),
        end,
      );
      envelope.connect(filter);
      filter.connect(panner);
    } else {
      envelope.connect(panner);
    }
    panner.connect(destination);

    const nodes: AudioNode[] = [oscillator, envelope, panner];
    if (filter !== null) nodes.push(filter);
    this.trackOneShot(oscillator, nodes);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  private noise(options: NoiseOptions): void {
    const graph = this.effectGraph();
    if (graph === null || this.noiseBuffer === null) return;
    const { context, destination } = graph;
    const start = context.currentTime + Math.max(0, options.delay ?? 0);
    const duration = Math.max(0.025, options.duration);
    const end = start + duration;
    const attackEnd = Math.min(end - 0.004, start + Math.max(0.001, options.attack ?? 0.003));

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();

    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.playbackRate.setValueAtTime(Math.max(0.05, options.playbackRate ?? 1), start);
    source.playbackRate.exponentialRampToValueAtTime(
      Math.max(0.05, options.endPlaybackRate ?? options.playbackRate ?? 1),
      end,
    );
    filter.type = options.filterType;
    filter.Q.value = Math.max(0.0001, options.filterQ ?? 1);
    filter.frequency.setValueAtTime(Math.max(10, options.filterFrequency), start);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(10, options.endFilterFrequency),
      end,
    );
    envelope.gain.setValueAtTime(MIN_GAIN, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, options.level), attackEnd);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
    panner.pan.value = clamp(options.pan, -1, 1);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(panner);
    panner.connect(destination);

    this.trackOneShot(source, [source, filter, envelope, panner]);
    const offset = (this.activeSources.size * 0.173) % this.noiseBuffer.duration;
    source.start(start, offset);
    source.stop(end + 0.015);
  }

  private effectGraph(): { context: AudioContext; destination: AudioNode } | null {
    const context = this.context;
    const destination = this.effectsBus;
    if (
      this.disposed ||
      context === null ||
      context.state === "closed" ||
      destination === null
    ) {
      return null;
    }
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    return { context, destination };
  }

  private trackOneShot(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      for (const node of nodes) node.disconnect();
    };
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.max(1, Math.floor(context.sampleRate * 2));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    // Deterministic xorshift noise, lightly integrated for a fuller synthetic texture.
    let seed = 0x6d2b79f5;
    let low = 0;
    for (let index = 0; index < length; index += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = ((seed >>> 0) / 0xffff_ffff) * 2 - 1;
      low = low * 0.965 + white * 0.035;
      samples[index] = white * 0.72 + low * 0.28;
    }
    return buffer;
  }

  private applyMasterLevel(rampSeconds: number): void {
    const context = this.context;
    const masterGain = this.masterGain;
    if (context === null || masterGain === null || context.state === "closed") return;
    const now = context.currentTime;
    this.glide(masterGain.gain, this.mutedState ? 0 : this.volume, now, rampSeconds);
  }

  private applyMusicIntensity(): void {
    const context = this.context;
    const music = this.music;
    const musicBus = this.musicBus;
    if (
      context === null ||
      music === null ||
      musicBus === null ||
      context.state === "closed"
    ) {
      return;
    }

    const amount = this.musicIntensity;
    const now = context.currentTime;
    const release = amount <= 0.001;
    const rampDuration = MUSIC_BEAT_SECONDS * (release ? 2 : 1);
    const construction = Math.sqrt(amount);
    const pulseMix = clamp((amount - 0.12) / 0.88);
    const pursuitMix = clamp((amount - 0.5) / 0.5);

    this.glide(
      musicBus.gain,
      release ? 0 : 0.11 + construction * 0.15,
      now,
      rampDuration,
    );
    this.glide(
      music.droneGain.gain,
      MIN_GAIN + construction * 0.064,
      now,
      rampDuration,
    );
    this.glide(
      music.pulseLevel.gain,
      MIN_GAIN + pulseMix * 0.058,
      now,
      rampDuration,
    );
    this.glide(
      music.percussionLevel.gain,
      MIN_GAIN + pursuitMix * 0.052,
      now,
      rampDuration,
    );
    this.glide(
      music.filter.frequency,
      250 + Math.pow(amount, 1.35) * 2_250,
      now,
      rampDuration,
    );
    this.glide(music.rhythm.frequency, 1.7 + amount * 2.75, now, rampDuration);

    const nextNoteIndex = Math.min(
      MUSIC_ROOTS.length - 1,
      Math.floor(amount * MUSIC_ROOTS.length),
    );
    if (nextNoteIndex !== music.noteIndex) {
      music.noteIndex = nextNoteIndex;
      const root = MUSIC_ROOTS[nextNoteIndex];
      const elapsed = Math.max(0, now - music.startedAt);
      const nextBeat =
        music.startedAt +
        (Math.floor(elapsed / MUSIC_BEAT_SECONDS) + 1) * MUSIC_BEAT_SECONDS;
      const bendDuration = MUSIC_BEAT_SECONDS * 0.12;
      this.schedulePitch(music.bass.frequency, root, now, nextBeat, bendDuration);
      this.schedulePitch(
        music.tension.frequency,
        root * 1.498,
        now,
        nextBeat,
        bendDuration,
      );
      this.schedulePitch(
        music.pulse.frequency,
        root * 2.25,
        now,
        nextBeat,
        bendDuration,
      );
    }
  }

  private schedulePitch(
    param: AudioParam,
    target: number,
    now: number,
    changeAt: number,
    duration: number,
  ): void {
    const current = Math.max(1, param.value);
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
    param.setValueAtTime(current, Math.max(now, changeAt));
    param.exponentialRampToValueAtTime(
      Math.max(1, target),
      Math.max(now, changeAt) + Math.max(0.01, duration),
    );
  }

  private glide(param: AudioParam, target: number, now: number, duration: number): void {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(0.001, duration));
  }

  private stopAndDisconnect(): void {
    const sources = [...this.activeSources];
    this.activeSources.clear();
    sources.forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A one-shot may already have ended between snapshot and stop.
      }
      source.disconnect();
    });

    this.engine?.nodes.forEach((node) => node.disconnect());
    this.music?.nodes.forEach((node) => node.disconnect());
    this.effectsBus?.disconnect();
    this.engineBus?.disconnect();
    this.musicBus?.disconnect();
    this.compressor?.disconnect();
    this.masterGain?.disconnect();

    this.engine = null;
    this.music = null;
    this.effectsBus = null;
    this.engineBus = null;
    this.musicBus = null;
    this.compressor = null;
    this.masterGain = null;
    this.noiseBuffer = null;
  }
}

/** Convenience factory for code that prefers a functional construction API. */
export function createGameAudio(options: GameAudioOptions = {}): VoidforgeAudio {
  return new VoidforgeAudio(options);
}

/** Backward-compatible descriptive class alias. */
export { VoidforgeAudio as GameAudio };
