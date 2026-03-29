import type { ShaderParams, ShaderGenerator } from "./common"

/**
 * True Perlin Gradient Noise with Fractional Brownian Motion (fBm)
 * 
 * This implements Ken Perlin's original gradient noise algorithm (1985),
 * NOT value noise. The key difference:
 * 
 * - Value noise: Each grid corner stores a random SCALAR, interpolated smoothly
 * - Perlin noise: Each grid corner stores a random GRADIENT VECTOR, and the
 *                 noise value comes from DOT PRODUCTS between gradients and
 *                 offset vectors. This creates smoother, more directional results.
 * 
 * The fBm technique layers multiple octaves of Perlin noise at increasing
 * frequencies and decreasing amplitudes to create natural-looking detail.
 * 
 * Parameters:
 * - scale: Overall scale of the noise pattern
 * - octaves: Number of noise layers to combine (more = finer detail)
 * - persistence: Amplitude multiplier per octave (0-1, controls roughness)
 * - lacunarity: Frequency multiplier per octave (typically 2)
 * - animate: Enable time-based animation
 */
export const perlinShader: ShaderGenerator = {
  generate: (params: ShaderParams, _seedValue: number, time: number): string => {
    const scale = Number(params.scale) || 8
    const octaves = Math.floor(Number(params.octaves) || 4)
    const persistence = Number(params.persistence) || 0.5
    const lacunarity = Number(params.lacunarity) || 2
    const animate = params.animate ? 1 : 0
    const animSpeed = 0.1  // Animation speed multiplier

    return `
        // ============================================
        // TRUE PERLIN GRADIENT NOISE + fBm
        // ============================================
        // Ken Perlin's gradient noise (1985) with octave layering.
        // 
        // Algorithm overview:
        // 1. For each grid cell corner, generate a pseudo-random gradient vector
        // 2. Compute the dot product between each gradient and the offset from
        //    that corner to the sample point
        // 3. Smoothly interpolate these dot products using a quintic curve
        // 4. Layer multiple octaves with decreasing amplitude (fBm)
        //
        // The gradient-based approach produces smoother, more organic patterns
        // compared to simple value noise interpolation.
        
        // User parameters
        const NOISE_SCALE: f32 = ${scale.toFixed(2)};           // Overall scale of the noise pattern
        const NUM_OCTAVES: i32 = ${octaves};                    // Number of noise layers to combine
        const PERSISTENCE: f32 = ${persistence.toFixed(3)};     // Amplitude decay per octave (roughness)
        const LACUNARITY: f32 = ${lacunarity.toFixed(3)};       // Frequency growth per octave
        ${animate ? `const ANIM_OFFSET: f32 = ${(time * animSpeed).toFixed(4)}; // Animation time offset` : ""}
        
        @fragment
        fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
          var samplePos = uv * NOISE_SCALE;
          ${animate ? `samplePos += vec2f(ANIM_OFFSET, 0.0);` : ""}
          
          var totalValue = 0.0;       // Accumulated noise value
          var amplitude = 1.0;        // Current octave amplitude
          var frequency = 1.0;        // Current octave frequency
          var maxPossibleValue = 0.0; // For normalization (Perlin returns ~[-1,1])
          
          // Sum multiple octaves of TRUE Perlin gradient noise
          for (var octave = 0; octave < NUM_OCTAVES; octave++) {
            // perlinNoise() returns values in approximately [-1, 1]
            totalValue += amplitude * perlinNoise(samplePos * frequency);
            maxPossibleValue += amplitude;
            
            // Prepare next octave: higher frequency, lower amplitude
            amplitude *= PERSISTENCE;
            frequency *= LACUNARITY;
          }
          
          // Normalize from [-1, 1] to [0, 1] range for display
          // Division by maxPossibleValue handles the amplitude accumulation
          let normalizedValue = (totalValue / maxPossibleValue) * 0.5 + 0.5;
          
          return vec4f(vec3f(normalizedValue), 1.0);
        }
      `
  }
}
