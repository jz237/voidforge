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
uniform float uBloomLevel;
uniform float uBloomPixels;
uniform float uGradeLevel;
uniform float uChromaticPixels;
uniform float uHeatPixels;
uniform float uShockLevel;
uniform float uShockRadius;
uniform float uShockWidth;
uniform float uShockPixels;
uniform float uMotionScale;
uniform float uFlashScale;
uniform float uColorProfile;
uniform int uEmissiveCount;
uniform float uEmissiveLevel;
uniform float uHighContrast;
uniform vec2 uHeatCenter;
uniform float uHeatRadius;
uniform vec2 uShockCenter;
uniform vec4 uEmissiveGeometry[4];
uniform vec4 uEmissiveColorIntensity[4];

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
    float bloomStrength = clamp(uBloomLevel, 0.0, 0.45) * master;
    float shock = clamp(uShockLevel, 0.0, 1.5) * master;
    float grade = clamp(uGradeLevel, 0.0, 1.0) * master;
    float emissive = clamp(uEmissiveLevel, 0.0, 1.0)
        * master
        * (1.0 - step(0.5, uHighContrast));

    if (
        danger <= 0.0001 && heat <= 0.0001 && bloomStrength <= 0.0001
        && shock <= 0.0001 && grade <= 0.0001 && emissive <= 0.0001
        && uColorProfile < 0.5
    ) {
        finalColor = texture(uTexture, clampToInput(uv));
        return;
    }

    float motion = clamp(uMotionScale, 0.0, 1.0);
    float phase = uTime * motion;

    float aspect = max(uInputSize.x / max(uInputSize.y, 1.0), 0.001);
    vec2 fromHeat = (uv - uHeatCenter) * vec2(aspect, 1.0);
    float heatRadius = max(uHeatRadius, 0.001);
    float heatMask = 1.0 - smoothstep(heatRadius * 0.18, heatRadius, length(fromHeat));

    float turbulence = sin(dot(uv * vec2(13.0, 19.0), vec2(1.0, 1.37)) + phase * 1.8) * 0.58
        + sin(dot(uv * vec2(31.0, 11.0), vec2(-0.83, 1.0)) - phase * 2.3) * 0.42;
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
    float chromaticAccessibility = 1.0 - step(0.5, uColorProfile);
    vec2 chromaticOffset = chromaticAxis
        * uInputPixel.zw
        * uChromaticPixels
        * danger
        * temporalDanger
        * chromaticAccessibility
        * mix(0.52, 1.0, edgeWeight);

    vec2 shockDelta = (uv - uShockCenter) * vec2(aspect, 1.0);
    float shockDistance = length(shockDelta);
    float shockRing = 1.0 - smoothstep(
        max(uShockWidth, 0.001),
        max(uShockWidth, 0.001) * 2.0,
        abs(shockDistance - uShockRadius)
    );
    vec2 shockDirection = normalize(shockDelta + vec2(0.0001, 0.0));
    vec2 shockOffset = shockDirection
        / vec2(aspect, 1.0)
        * uInputPixel.zw
        * uShockPixels
        * shock
        * shockRing
        * motion;

    vec2 baseUv = clampToInput(uv + heatOffset + shockOffset);
    vec4 base = texture(uTexture, baseUv);
    vec4 redSample = texture(uTexture, clampToInput(baseUv + chromaticOffset));
    vec4 blueSample = texture(uTexture, clampToInput(baseUv - chromaticOffset));

    vec3 color = vec3(redSample.r, base.g, blueSample.b);
    vec2 bloomStep = uInputPixel.zw * uBloomPixels * vec2(0.7071, -0.7071);
    vec3 bloomA = texture(uTexture, clampToInput(baseUv + bloomStep)).rgb;
    vec3 bloomB = texture(uTexture, clampToInput(baseUv - bloomStep)).rgb;
    float peakA = max(bloomA.r, max(bloomA.g, bloomA.b));
    float peakB = max(bloomB.r, max(bloomB.g, bloomB.b));
    vec3 bloom = bloomA * smoothstep(0.66, 0.98, peakA)
        + bloomB * smoothstep(0.66, 0.98, peakB);
    float bloomNormalizer = 0.5;
    if (bloomStrength > 0.13) {
        vec2 crossStep = uInputPixel.zw * uBloomPixels * vec2(0.7071, 0.7071);
        vec3 bloomC = texture(uTexture, clampToInput(baseUv + crossStep)).rgb;
        vec3 bloomD = texture(uTexture, clampToInput(baseUv - crossStep)).rgb;
        float peakC = max(bloomC.r, max(bloomC.g, bloomC.b));
        float peakD = max(bloomD.r, max(bloomD.g, bloomD.b));
        bloom += bloomC * smoothstep(0.66, 0.98, peakC)
            + bloomD * smoothstep(0.66, 0.98, peakD);
        bloomNormalizer = 0.27;
    }
    color += bloom * bloomNormalizer * bloomStrength;

    // Four semantic screen-space sources add restrained local color spill
    // without another pass or texture lookup. The lift is strictly positive,
    // capped, aspect-correct, and leaves alpha/collision silhouettes untouched.
    vec3 emissiveAccumulation = vec3(0.0);
    for (int index = 0; index < 4; index++) {
        if (index >= uEmissiveCount) break;
        vec4 geometry = uEmissiveGeometry[index];
        vec4 source = uEmissiveColorIntensity[index];
        float sourceRadius = max(geometry.z, 0.001);
        vec2 sourceDelta = (uv - geometry.xy) * vec2(aspect, 1.0);
        float falloff = 1.0 - smoothstep(
            sourceRadius * clamp(geometry.w, 0.04, 0.82),
            sourceRadius,
            length(sourceDelta)
        );
        emissiveAccumulation += clamp(source.rgb, 0.0, 1.0)
            * clamp(source.a, 0.0, 1.0)
            * falloff
            * falloff;
    }
    vec3 emissiveLift = min(
        emissiveAccumulation / (vec3(1.0) + emissiveAccumulation * 1.7)
            * emissive
            * 0.24,
        vec3(0.16)
    );
    color += emissiveLift * (vec3(1.0) - clamp(color, 0.0, 1.0));

    vec3 thermalLight = mix(vec3(0.08, 0.025, 0.13), vec3(0.14, 0.055, 0.018), 0.5 + turbulence * 0.18);
    color += thermalLight * heatMask * heat * 0.34;
    color += vec3(0.12, 0.065, 0.16) * shockRing * shock * 0.22;

    float vignette = smoothstep(0.38, 0.92, length(radial * vec2(0.72, 1.0)));
    color *= 1.0 - vignette * danger * 0.065;

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 gradeTint = mix(
        vec3(0.965, 0.995, 1.045),
        vec3(1.045, 1.005, 0.965),
        smoothstep(0.22, 0.82, luminance)
    );
    float accessibleGrade = uColorProfile < 0.5 ? grade : grade * 0.6;
    color *= mix(vec3(1.0), gradeTint, accessibleGrade);
    color = (color - vec3(0.5)) * (1.0 + grade * 0.055) + vec3(0.5);
    vec3 highlightExcess = max(color - vec3(0.94), vec3(0.0));
    color = max(vec3(0.0), color - highlightExcess * 0.14);

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
  uBloomLevel: { value: number; type: "f32" };
  uBloomPixels: { value: number; type: "f32" };
  uGradeLevel: { value: number; type: "f32" };
  uChromaticPixels: { value: number; type: "f32" };
  uHeatPixels: { value: number; type: "f32" };
  uShockLevel: { value: number; type: "f32" };
  uShockRadius: { value: number; type: "f32" };
  uShockWidth: { value: number; type: "f32" };
  uShockPixels: { value: number; type: "f32" };
  uMotionScale: { value: number; type: "f32" };
  uFlashScale: { value: number; type: "f32" };
  uColorProfile: { value: number; type: "f32" };
  uEmissiveCount: { value: number; type: "i32" };
  uEmissiveLevel: { value: number; type: "f32" };
  uHighContrast: { value: number; type: "f32" };
  uHeatCenter: { value: Float32Array; type: "vec2<f32>" };
  uHeatRadius: { value: number; type: "f32" };
  uShockCenter: { value: Float32Array; type: "vec2<f32>" };
  uEmissiveGeometry: { value: Float32Array; type: "vec4<f32>"; size: 4 };
  uEmissiveColorIntensity: { value: Float32Array; type: "vec4<f32>"; size: 4 };
};

export interface VoidforgePostFxAccessibility {
  /** Global strength for every post effect, from 0 (off) to 1 (full). */
  effectIntensity?: number;
  /** Freezes animated distortion while retaining static spatial cues. */
  reducedMotion?: boolean;
  /** Removes temporal modulation from the chromatic danger cue. */
  reducedFlashing?: boolean;
  /** Preserves the unlit high-contrast presentation. */
  highContrast?: boolean;
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
  /** Selective emissive bloom strength. */
  bloomLevel?: number;
  /** Bloom sample separation in physical pixels. */
  bloomPixels?: number;
  /** Luminance-preserving cinematic grade strength. */
  gradeLevel?: number;
  /** Maximum event shockwave displacement in physical pixels. */
  shockPixels?: number;
  /** Initial heat source; defaults to the lower-center engine region. */
  heatSource?: VoidforgeHeatSource;
  /** Optional scene-wide color-vision accessibility transform. */
  colorProfile?: VoidforgeColorProfile;
  /** Overall analytic local-light strength. */
  emissiveLevel?: number;
}

export interface VoidforgePostFxLevels {
  danger?: number;
  heat?: number;
  bloom?: number;
}

export interface VoidforgeShockwave {
  x: number;
  y: number;
  radius: number;
  level: number;
  width?: number;
}

export interface VoidforgeEmissiveLight {
  /** Stable semantic identifier used to ease a source across frames. */
  id: string | number;
  /** Horizontal position in normalized filter coordinates. */
  x: number;
  /** Vertical position in normalized filter coordinates. */
  y: number;
  /** Aspect-corrected radius normalized against viewport height. */
  radius: number;
  /** Normalized RGB source color. */
  color: readonly number[];
  /** Local source strength from 0 to 1. */
  intensity: number;
  /** Optional central plateau ratio before the eased falloff. */
  innerRatio?: number;
}

type EmissiveLightSlot = {
  id: string | null;
  x: number;
  y: number;
  radius: number;
  red: number;
  green: number;
  blue: number;
  intensity: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  targetRed: number;
  targetGreen: number;
  targetBlue: number;
  targetIntensity: number;
  innerRatio: number;
  targetInnerRatio: number;
};

const MAX_EMISSIVE_LIGHTS = 4;

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
  private readonly emissiveSlots: EmissiveLightSlot[];
  private reducedMotion = false;
  private reducedFlashing = false;
  private highContrast = false;

  constructor(options: VoidforgePostFxOptions = {}) {
    const {
      effectIntensity = 1,
      reducedMotion = false,
      reducedFlashing = false,
      highContrast = false,
      dangerLevel = 0,
      heatLevel = 0,
      bloomLevel = 0.13,
      bloomPixels = 3.2,
      gradeLevel = 0.46,
      chromaticPixels = 2.4,
      heatPixels = 4.5,
      shockPixels = 8.5,
      heatSource = { x: 0.5, y: 0.72, radius: 0.28 },
      colorProfile = "standard",
      emissiveLevel = 1,
      ...filterOptions
    } = options;

    const uniforms = new UniformGroup<PostFxUniformStructure>({
      uTime: { value: 0, type: "f32" },
      uMasterIntensity: { value: clamp(effectIntensity, 0, 1, 1), type: "f32" },
      uDangerLevel: { value: clamp(dangerLevel, 0, 1, 0), type: "f32" },
      uHeatLevel: { value: clamp(heatLevel, 0, 1, 0), type: "f32" },
      uBloomLevel: { value: clamp(bloomLevel, 0, 0.45, 0.13), type: "f32" },
      uBloomPixels: { value: clamp(bloomPixels, 0, 10, 3.2), type: "f32" },
      uGradeLevel: { value: clamp(gradeLevel, 0, 1, 0.46), type: "f32" },
      uChromaticPixels: { value: clamp(chromaticPixels, 0, 6, 2.4), type: "f32" },
      uHeatPixels: { value: clamp(heatPixels, 0, 12, 4.5), type: "f32" },
      uShockLevel: { value: 0, type: "f32" },
      uShockRadius: { value: 0.02, type: "f32" },
      uShockWidth: { value: 0.012, type: "f32" },
      uShockPixels: { value: clamp(shockPixels, 0, 18, 8.5), type: "f32" },
      uMotionScale: { value: reducedMotion ? 0 : 1, type: "f32" },
      uFlashScale: { value: reducedFlashing ? 0 : 1, type: "f32" },
      uColorProfile: { value: ["standard", "deuteranopia", "protanopia", "tritanopia"].indexOf(colorProfile), type: "f32" },
      uEmissiveCount: { value: 0, type: "i32" },
      uEmissiveLevel: { value: clamp(emissiveLevel, 0, 1, 1), type: "f32" },
      uHighContrast: { value: highContrast ? 1 : 0, type: "f32" },
      uHeatCenter: {
        value: new Float32Array([
          clamp(heatSource.x, 0, 1, 0.5),
          clamp(heatSource.y, 0, 1, 0.72),
        ]),
        type: "vec2<f32>",
      },
      uHeatRadius: { value: clamp(heatSource.radius ?? 0.28, 0.02, 2, 0.28), type: "f32" },
      uShockCenter: { value: new Float32Array([0.5, 0.5]), type: "vec2<f32>" },
      uEmissiveGeometry: {
        value: new Float32Array(MAX_EMISSIVE_LIGHTS * 4),
        type: "vec4<f32>",
        size: MAX_EMISSIVE_LIGHTS,
      },
      uEmissiveColorIntensity: {
        value: new Float32Array(MAX_EMISSIVE_LIGHTS * 4),
        type: "vec4<f32>",
        size: MAX_EMISSIVE_LIGHTS,
      },
    });

    super({
      resolution: "inherit",
      padding: 0,
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
    this.emissiveSlots = Array.from({ length: MAX_EMISSIVE_LIGHTS }, () => ({
      id: null,
      x: 0.5,
      y: 0.5,
      radius: 0.08,
      red: 1,
      green: 1,
      blue: 1,
      intensity: 0,
      targetX: 0.5,
      targetY: 0.5,
      targetRadius: 0.08,
      targetRed: 1,
      targetGreen: 1,
      targetBlue: 1,
      targetIntensity: 0,
      innerRatio: 0.12,
      targetInnerRatio: 0.12,
    }));
    this.reducedMotion = reducedMotion;
    this.reducedFlashing = reducedFlashing;
    this.highContrast = highContrast;
  }

  /** Advance procedural motion. Pass `ticker.deltaMS / 1000`. */
  update(deltaSeconds: number): this {
    const delta = clamp(deltaSeconds, 0, 0.1, 0);
    const uniforms = this.postFxUniforms.uniforms;
    uniforms.uTime = (uniforms.uTime + delta) % 4096;
    const positionBlend = 1 - Math.exp(-delta * (this.reducedMotion ? 12 : 18));
    let highestActiveSlot = -1;
    for (let index = 0; index < this.emissiveSlots.length; index += 1) {
      const slot = this.emissiveSlots[index];
      const intensityRate = this.reducedFlashing
        ? 5.5
        : slot.targetIntensity > slot.intensity ? 13 : 8;
      const intensityBlend = 1 - Math.exp(-delta * intensityRate);
      slot.x += (slot.targetX - slot.x) * positionBlend;
      slot.y += (slot.targetY - slot.y) * positionBlend;
      slot.radius += (slot.targetRadius - slot.radius) * positionBlend;
      slot.red += (slot.targetRed - slot.red) * positionBlend;
      slot.green += (slot.targetGreen - slot.green) * positionBlend;
      slot.blue += (slot.targetBlue - slot.blue) * positionBlend;
      slot.innerRatio += (slot.targetInnerRatio - slot.innerRatio) * positionBlend;
      slot.intensity += (slot.targetIntensity - slot.intensity) * intensityBlend;
      if (slot.targetIntensity <= 0 && slot.intensity < 0.001) {
        slot.intensity = 0;
        slot.id = null;
      }

      const offset = index * 4;
      uniforms.uEmissiveGeometry[offset] = slot.x;
      uniforms.uEmissiveGeometry[offset + 1] = slot.y;
      uniforms.uEmissiveGeometry[offset + 2] = slot.radius;
      uniforms.uEmissiveGeometry[offset + 3] = slot.innerRatio;
      uniforms.uEmissiveColorIntensity[offset] = slot.red;
      uniforms.uEmissiveColorIntensity[offset + 1] = slot.green;
      uniforms.uEmissiveColorIntensity[offset + 2] = slot.blue;
      uniforms.uEmissiveColorIntensity[offset + 3] = slot.intensity;
      if (slot.intensity > 0.001) highestActiveSlot = index;
    }
    uniforms.uEmissiveCount = highestActiveSlot + 1;
    return this;
  }

  /**
   * Set the semantic local-light targets. Stable identifiers keep sources in
   * the same uniform slots, while bounded easing prevents flashes or slot pop.
   */
  setEmissiveLights(
    lights: readonly VoidforgeEmissiveLight[],
    options: { immediate?: boolean } = {},
  ): this {
    const normalized = new Map<string, Required<VoidforgeEmissiveLight>>();
    if (Array.isArray(lights)) {
      for (const light of lights) {
        if (normalized.size >= MAX_EMISSIVE_LIGHTS || light === null || typeof light !== "object") continue;
        const rawId = light.id;
        const id = typeof rawId === "number" && Number.isFinite(rawId) && rawId >= 0
          ? String(Math.trunc(rawId))
          : typeof rawId === "string" ? rawId.trim().slice(0, 96) : "";
        if (id.length === 0 || normalized.has(id)) continue;
        const color = Array.isArray(light.color) || ArrayBuffer.isView(light.color)
          ? light.color
          : [1, 1, 1];
        normalized.set(id, {
          id,
          x: clamp(light.x, -0.25, 1.25, 0.5),
          y: clamp(light.y, -0.25, 1.25, 0.5),
          radius: clamp(light.radius, 0.015, 0.65, 0.08),
          color: [
            clamp(color[0], 0, 1, 1),
            clamp(color[1], 0, 1, 1),
            clamp(color[2], 0, 1, 1),
          ],
          intensity: clamp(light.intensity, 0, 1, 0),
          innerRatio: clamp(light.innerRatio ?? 0.12, 0.04, 0.82, 0.12),
        });
      }
    }

    const unmatched = new Map(normalized);
    for (const slot of this.emissiveSlots) {
      const source = slot.id === null ? undefined : unmatched.get(slot.id);
      if (source === undefined) {
        slot.targetIntensity = 0;
        continue;
      }
      this.setEmissiveSlotTarget(slot, source);
      if (options.immediate === true) this.snapEmissiveSlot(slot);
      unmatched.delete(source.id as string);
    }

    for (const source of unmatched.values()) {
      let slot = this.emissiveSlots.find((candidate) => candidate.id === null);
      if (slot === undefined) {
        const replaceable = this.emissiveSlots
          .filter((candidate) => candidate.id === null || !normalized.has(candidate.id))
          .sort((left, right) => left.intensity - right.intensity)[0];
        slot = replaceable;
      }
      if (slot === undefined) break;
      slot.id = source.id as string;
      slot.x = source.x;
      slot.y = source.y;
      slot.radius = source.radius;
      slot.red = source.color[0];
      slot.green = source.color[1];
      slot.blue = source.color[2];
      slot.innerRatio = source.innerRatio;
      slot.intensity = Math.min(slot.intensity, 0.035);
      this.setEmissiveSlotTarget(slot, source);
      if (options.immediate === true) this.snapEmissiveSlot(slot);
    }
    return this;
  }

  private setEmissiveSlotTarget(
    slot: EmissiveLightSlot,
    source: Required<VoidforgeEmissiveLight>,
  ): void {
    slot.id = String(source.id);
    slot.targetX = source.x;
    slot.targetY = source.y;
    slot.targetRadius = source.radius;
    slot.targetRed = source.color[0];
    slot.targetGreen = source.color[1];
    slot.targetBlue = source.color[2];
    slot.targetIntensity = source.intensity;
    slot.targetInnerRatio = source.innerRatio;
  }

  private snapEmissiveSlot(slot: EmissiveLightSlot): void {
    slot.x = slot.targetX;
    slot.y = slot.targetY;
    slot.radius = slot.targetRadius;
    slot.red = slot.targetRed;
    slot.green = slot.targetGreen;
    slot.blue = slot.targetBlue;
    slot.intensity = slot.targetIntensity;
    slot.innerRatio = slot.targetInnerRatio;
  }

  setLevels(levels: VoidforgePostFxLevels): this {
    const uniforms = this.postFxUniforms.uniforms;
    if (levels.danger !== undefined) {
      uniforms.uDangerLevel = clamp(levels.danger, 0, 1, uniforms.uDangerLevel);
    }
    if (levels.heat !== undefined) {
      uniforms.uHeatLevel = clamp(levels.heat, 0, 1, uniforms.uHeatLevel);
    }
    if (levels.bloom !== undefined) {
      uniforms.uBloomLevel = clamp(levels.bloom, 0, 0.45, uniforms.uBloomLevel);
    }
    return this;
  }

  setShockwave(shockwave: VoidforgeShockwave): this {
    const uniforms = this.postFxUniforms.uniforms;
    uniforms.uShockCenter[0] = clamp(shockwave.x, 0, 1, uniforms.uShockCenter[0]);
    uniforms.uShockCenter[1] = clamp(shockwave.y, 0, 1, uniforms.uShockCenter[1]);
    uniforms.uShockRadius = clamp(shockwave.radius, 0, 2, uniforms.uShockRadius);
    uniforms.uShockLevel = clamp(shockwave.level, 0, 1.5, uniforms.uShockLevel);
    if (shockwave.width !== undefined) {
      uniforms.uShockWidth = clamp(shockwave.width, 0.002, 0.08, uniforms.uShockWidth);
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
    if (settings.highContrast !== undefined) {
      this.highContrast = settings.highContrast;
      uniforms.uHighContrast = this.highContrast ? 1 : 0;
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
      highContrast: this.highContrast,
    };
  }
}

export const createVoidforgePostFx = (options?: VoidforgePostFxOptions): VoidforgePostFx =>
  new VoidforgePostFx(options);
