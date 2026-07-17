import { Filter, GlProgram, UniformGroup } from "pixi.js";
import type { FilterOptions } from "pixi.js";

const FILTER_VERTEX = /* glsl */ `
precision highp float;

in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const FILTER_FRAGMENT = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;

uniform float uTime;
uniform float uMasterIntensity;
uniform float uDangerLevel;
uniform float uHeatLevel;
uniform float uChromaticPixels;
uniform float uHeatPixels;
uniform float uMotionScale;
uniform float uFlashScale;
uniform float uColorProfile;
uniform vec2 uHeatCenter;
uniform float uHeatRadius;

float hash21(vec2 point)
{
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 point)
{
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 blend = local * local * (3.0 - 2.0 * local);

    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

vec2 clampToInput(vec2 coordinate)
{
    return clamp(coordinate, uInputClamp.xy, uInputClamp.zw);
}

void main(void)
{
    vec2 uv = vTextureCoord;
    float master = clamp(uMasterIntensity, 0.0, 1.0);
    float danger = clamp(uDangerLevel, 0.0, 1.0) * master;
    float heat = clamp(uHeatLevel, 0.0, 1.0) * master;

    if (danger <= 0.0001 && heat <= 0.0001 && uColorProfile < 0.5) {
        finalColor = texture(uTexture, clampToInput(uv));
        return;
    }

    float motion = clamp(uMotionScale, 0.0, 1.0);
    float phase = uTime * motion;

    float aspect = max(uInputSize.x / max(uInputSize.y, 1.0), 0.001);
    vec2 fromHeat = (uv - uHeatCenter) * vec2(aspect, 1.0);
    float heatRadius = max(uHeatRadius, 0.001);
    float heatMask = 1.0 - smoothstep(heatRadius * 0.18, heatRadius, length(fromHeat));

    vec2 noisePoint = vec2(uv.x * 8.0, uv.y * 12.0) + vec2(phase * 0.37, -phase * 0.21);
    float turbulence = valueNoise(noisePoint) * 2.0 - 1.0;
    float horizontalWave = sin(uv.y * 92.0 + phase * 5.3 + turbulence * 2.0);
    float verticalWave = sin((uv.x + uv.y) * 47.0 - phase * 3.1);
    vec2 heatVector = vec2(
        horizontalWave * 0.72 + turbulence * 0.28,
        turbulence * 0.38 + verticalWave * 0.16
    );
    vec2 heatOffset = heatVector * uInputPixel.zw * uHeatPixels * heat * heatMask;

    vec2 radial = uv - vec2(0.5);
    float edgeWeight = smoothstep(0.08, 0.72, length(radial * vec2(aspect * 0.62, 1.0)));
    vec2 chromaticAxis = normalize(radial + vec2(0.0001, 0.0));
    chromaticAxis = normalize(chromaticAxis + vec2(horizontalWave * 0.08, turbulence * 0.05));

    // Reduced-flashing mode removes the small temporal modulation while preserving
    // the static danger cue. Brightness itself is never pulsed.
    float temporalDanger = mix(
        1.0,
        0.93 + sin(uTime * 6.0) * 0.07,
        motion * clamp(uFlashScale, 0.0, 1.0)
    );
    vec2 chromaticOffset = chromaticAxis
        * uInputPixel.zw
        * uChromaticPixels
        * danger
        * temporalDanger
        * mix(0.52, 1.0, edgeWeight);

    vec2 baseUv = clampToInput(uv + heatOffset);
    vec4 base = texture(uTexture, baseUv);
    vec4 redSample = texture(uTexture, clampToInput(baseUv + chromaticOffset));
    vec4 blueSample = texture(uTexture, clampToInput(baseUv - chromaticOffset));

    vec3 color = vec3(redSample.r, base.g, blueSample.b);
    float vignette = smoothstep(0.38, 0.92, length(radial * vec2(0.72, 1.0)));
    color *= 1.0 - vignette * danger * 0.065;

    if (uColorProfile > 0.5 && uColorProfile < 1.5) {
        color = vec3(
            dot(color, vec3(0.72, 0.18, 0.10)),
            dot(color, vec3(0.12, 0.58, 0.30)),
            dot(color, vec3(0.04, 0.22, 0.84))
        );
    } else if (uColorProfile >= 1.5 && uColorProfile < 2.5) {
        color = vec3(
            dot(color, vec3(0.58, 0.32, 0.10)),
            dot(color, vec3(0.18, 0.64, 0.18)),
            dot(color, vec3(0.04, 0.18, 0.86))
        );
    } else if (uColorProfile >= 2.5) {
        color = vec3(
            dot(color, vec3(0.68, 0.16, 0.16)),
            dot(color, vec3(0.10, 0.72, 0.18)),
            dot(color, vec3(0.16, 0.26, 0.58))
        );
    }

    finalColor = vec4(color, base.a);
}
`;

type PostFxUniformStructure = {
  uTime: { value: number; type: "f32" };
  uMasterIntensity: { value: number; type: "f32" };
  uDangerLevel: { value: number; type: "f32" };
  uHeatLevel: { value: number; type: "f32" };
  uChromaticPixels: { value: number; type: "f32" };
  uHeatPixels: { value: number; type: "f32" };
  uMotionScale: { value: number; type: "f32" };
  uFlashScale: { value: number; type: "f32" };
  uColorProfile: { value: number; type: "f32" };
  uHeatCenter: { value: Float32Array; type: "vec2<f32>" };
  uHeatRadius: { value: number; type: "f32" };
};

export interface VoidforgePostFxAccessibility {
  /** Global strength for every post effect, from 0 (off) to 1 (full). */
  effectIntensity?: number;
  /** Freezes animated distortion while retaining static spatial cues. */
  reducedMotion?: boolean;
  /** Removes temporal modulation from the chromatic danger cue. */
  reducedFlashing?: boolean;
}

export type VoidforgeColorProfile = "standard" | "deuteranopia" | "protanopia" | "tritanopia";

export interface VoidforgeHeatSource {
  /** Horizontal position in normalized filter coordinates. */
  x: number;
  /** Vertical position in normalized filter coordinates. */
  y: number;
  /** Aspect-corrected normalized radius. Values around 0.2 are localized. */
  radius?: number;
}

export interface VoidforgePostFxOptions extends FilterOptions, VoidforgePostFxAccessibility {
  /** Initial chromatic danger level, from 0 to 1. */
  dangerLevel?: number;
  /** Initial heat-haze level, from 0 to 1. */
  heatLevel?: number;
  /** Maximum chromatic separation in physical pixels. */
  chromaticPixels?: number;
  /** Maximum heat displacement in physical pixels. */
  heatPixels?: number;
  /** Initial heat source; defaults to the lower-center engine region. */
  heatSource?: VoidforgeHeatSource;
  /** Optional scene-wide color-vision accessibility transform. */
  colorProfile?: VoidforgeColorProfile;
}

export interface VoidforgePostFxLevels {
  danger?: number;
  heat?: number;
}

const clamp = (value: number, minimum: number, maximum: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
};

/**
 * A single-pass WebGL filter for restrained full-scene danger and heat effects.
 *
 * Apply the instance to a scene container's `filters` array. Call `update` once
 * per tick with elapsed seconds, and drive danger/heat levels from gameplay.
 */
export class VoidforgePostFx extends Filter {
  private readonly postFxUniforms: UniformGroup<PostFxUniformStructure>;
  private reducedMotion = false;
  private reducedFlashing = false;

  constructor(options: VoidforgePostFxOptions = {}) {
    const {
      effectIntensity = 1,
      reducedMotion = false,
      reducedFlashing = false,
      dangerLevel = 0,
      heatLevel = 0,
      chromaticPixels = 2.4,
      heatPixels = 4.5,
      heatSource = { x: 0.5, y: 0.72, radius: 0.28 },
      colorProfile = "standard",
      ...filterOptions
    } = options;

    const uniforms = new UniformGroup<PostFxUniformStructure>({
      uTime: { value: 0, type: "f32" },
      uMasterIntensity: { value: clamp(effectIntensity, 0, 1, 1), type: "f32" },
      uDangerLevel: { value: clamp(dangerLevel, 0, 1, 0), type: "f32" },
      uHeatLevel: { value: clamp(heatLevel, 0, 1, 0), type: "f32" },
      uChromaticPixels: { value: clamp(chromaticPixels, 0, 6, 2.4), type: "f32" },
      uHeatPixels: { value: clamp(heatPixels, 0, 12, 4.5), type: "f32" },
      uMotionScale: { value: reducedMotion ? 0 : 1, type: "f32" },
      uFlashScale: { value: reducedFlashing ? 0 : 1, type: "f32" },
      uColorProfile: { value: ["standard", "deuteranopia", "protanopia", "tritanopia"].indexOf(colorProfile), type: "f32" },
      uHeatCenter: {
        value: new Float32Array([
          clamp(heatSource.x, 0, 1, 0.5),
          clamp(heatSource.y, 0, 1, 0.72),
        ]),
        type: "vec2<f32>",
      },
      uHeatRadius: { value: clamp(heatSource.radius ?? 0.28, 0.02, 2, 0.28), type: "f32" },
    });

    super({
      resolution: "inherit",
      padding: 8,
      antialias: "off",
      ...filterOptions,
      glProgram: GlProgram.from({
        name: "voidforge-post-fx",
        vertex: FILTER_VERTEX,
        fragment: FILTER_FRAGMENT,
      }),
      resources: {
        postFxUniforms: uniforms,
      },
    });

    this.postFxUniforms = uniforms;
    this.reducedMotion = reducedMotion;
    this.reducedFlashing = reducedFlashing;
  }

  /** Advance procedural motion. Pass `ticker.deltaMS / 1000`. */
  update(deltaSeconds: number): this {
    const delta = clamp(deltaSeconds, 0, 0.1, 0);
    const uniforms = this.postFxUniforms.uniforms;
    uniforms.uTime = (uniforms.uTime + delta) % 4096;
    return this;
  }

  setLevels(levels: VoidforgePostFxLevels): this {
    const uniforms = this.postFxUniforms.uniforms;
    if (levels.danger !== undefined) {
      uniforms.uDangerLevel = clamp(levels.danger, 0, 1, uniforms.uDangerLevel);
    }
    if (levels.heat !== undefined) {
      uniforms.uHeatLevel = clamp(levels.heat, 0, 1, uniforms.uHeatLevel);
    }
    return this;
  }

  setHeatSource(source: VoidforgeHeatSource): this {
    const uniforms = this.postFxUniforms.uniforms;
    uniforms.uHeatCenter[0] = clamp(source.x, 0, 1, uniforms.uHeatCenter[0]);
    uniforms.uHeatCenter[1] = clamp(source.y, 0, 1, uniforms.uHeatCenter[1]);
    if (source.radius !== undefined) {
      uniforms.uHeatRadius = clamp(source.radius, 0.02, 2, uniforms.uHeatRadius);
    }
    return this;
  }

  setAccessibility(settings: VoidforgePostFxAccessibility): this {
    const uniforms = this.postFxUniforms.uniforms;
    if (settings.effectIntensity !== undefined) {
      uniforms.uMasterIntensity = clamp(
        settings.effectIntensity,
        0,
        1,
        uniforms.uMasterIntensity,
      );
    }
    if (settings.reducedMotion !== undefined) {
      this.reducedMotion = settings.reducedMotion;
      uniforms.uMotionScale = this.reducedMotion ? 0 : 1;
    }
    if (settings.reducedFlashing !== undefined) {
      this.reducedFlashing = settings.reducedFlashing;
      uniforms.uFlashScale = this.reducedFlashing ? 0 : 1;
    }
    return this;
  }

  setColorProfile(profile: VoidforgeColorProfile): this {
    this.postFxUniforms.uniforms.uColorProfile = [
      "standard",
      "deuteranopia",
      "protanopia",
      "tritanopia",
    ].indexOf(profile);
    return this;
  }

  get dangerLevel(): number {
    return this.postFxUniforms.uniforms.uDangerLevel;
  }

  get heatLevel(): number {
    return this.postFxUniforms.uniforms.uHeatLevel;
  }

  get effectIntensity(): number {
    return this.postFxUniforms.uniforms.uMasterIntensity;
  }

  get accessibility(): Required<VoidforgePostFxAccessibility> {
    return {
      effectIntensity: this.effectIntensity,
      reducedMotion: this.reducedMotion,
      reducedFlashing: this.reducedFlashing,
    };
  }
}

export const createVoidforgePostFx = (options?: VoidforgePostFxOptions): VoidforgePostFx =>
  new VoidforgePostFx(options);
