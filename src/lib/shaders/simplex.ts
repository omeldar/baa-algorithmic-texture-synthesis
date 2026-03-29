import type { ShaderParams, ShaderGenerator } from "./common"

/**
 * Simplex Noise
 * 
 * Improved gradient noise by Ken Perlin (2001).
 * Uses a simplex grid (triangles in 2D) instead of a square grid.
 * Advantages: fewer directional artifacts, better scaling, faster.
 * 
 * Parameters:
 * - scale: Overall scale of the noise pattern
 * - contrast: Contrast adjustment (>1 increases, <1 decreases)
 * - brightness: Brightness offset
 * - warp: Domain warping strength for organic distortion
 */
export const simplexShader: ShaderGenerator = {
  generate: (params: ShaderParams, seedValue: number, _time: number): string => {
    const scale = Number(params.scale) || 5
    const contrast = Number(params.contrast) || 1
    const brightness = Number(params.brightness) || 0
    const warp = Number(params.warp) || 0
    
    // Use seed to offset the input coordinates, creating different noise patterns
    const seedOffsetX = (seedValue * 1000).toFixed(3)
    const seedOffsetY = (seedValue * 1337).toFixed(3)

    return `
        // ============================================
        // SIMPLEX NOISE
        // ============================================
        // Improved gradient noise by Ken Perlin (2001)
        // Uses a simplex grid (triangles in 2D) instead of a square grid
        // Advantages: fewer directional artifacts, better scaling, faster
        
        // User parameters
        const NOISE_SCALE: f32 = ${scale.toFixed(2)};
        const CONTRAST: f32 = ${contrast.toFixed(3)};
        const BRIGHTNESS: f32 = ${brightness.toFixed(3)};
        ${warp > 0 ? `const WARP_STRENGTH: f32 = ${warp.toFixed(3)};` : ""}
        
        // Seed-based offset for variation
        const SEED_OFFSET: vec2f = vec2f(${seedOffsetX}, ${seedOffsetY});
        
        // ============================================
        // SIMPLEX GRID TRANSFORMATION CONSTANTS
        // ============================================
        // In 2D, simplex noise uses an equilateral triangle grid instead of squares.
        // These constants transform between the skewed simplex grid and Cartesian space.
        //
        // For N dimensions: F = (sqrt(N+1) - 1) / N,  G = (1 - 1/sqrt(N+1)) / N
        // In 2D (N=2):
        //   F2 = (sqrt(3) - 1) / 2 = 0.366025403784439
        //   G2 = (3 - sqrt(3)) / 6 = 0.211324865405187
        
        const SKEW_FACTOR: f32 = 0.366025403784439;      // F2 = (sqrt(3) - 1) / 2
                                                          // Skews Cartesian to simplex grid
        const UNSKEW_FACTOR: f32 = 0.211324865405187;    // G2 = (3 - sqrt(3)) / 6
                                                          // Unskews simplex back to Cartesian
        const SIMPLEX_CORNER: f32 = -0.577350269189626;  // -1 + 2*G2 = -1/sqrt(3)
                                                          // Offset to third simplex corner
        
        // ============================================
        // PERMUTATION TABLE EMULATION CONSTANTS
        // ============================================
        // Instead of a lookup table, we use modular arithmetic to generate
        // pseudo-random permutation values. This is GPU-friendly (no memory access).
        //
        // MOD_BASE = 289 = 17^2, chosen because:
        //   - Prime squared gives good distribution
        //   - Works well with the permutation polynomial
        //
        // PERMUTE_MULT = 34 = 2 * 17, the permutation uses: (34x + 1) * x mod 289
        //   This polynomial has good mixing properties for hash-like behavior.
        //
        // PERMUTE_CONST = 1/41, used to extract gradient direction from permuted value
        //   41 is prime and gives 41 distinct gradients, good angular distribution.
        
        const MOD_BASE: f32 = 289.0;         // 17^2, modular arithmetic base
        const PERMUTE_MULT: f32 = 34.0;      // 2 * 17, permutation polynomial coefficient
        const PERMUTE_CONST: f32 = 0.024390243902439;  // 1/41, gradient extraction divisor
        
        // ============================================
        // GRADIENT NORMALIZATION CONSTANTS
        // ============================================
        // These constants ensure the final noise output is in [-1, 1] range.
        // Derived by Stefan Gustavson through numerical analysis of the algorithm.
        //
        // The formula: m *= GRAD_NORM - GRAD_ADJUST * (a0^2 + h^2)
        // corrects for the variable-length gradients produced by the algorithm.
        //
        // GRAD_NORM = 1.79284291400159 (approximately 1.8)
        //   Base normalization factor
        //
        // GRAD_ADJUST = 0.85373472095314 (approximately 0.85)
        //   Adjustment based on gradient direction (a0, h)
        //
        // OUTPUT_SCALE = 130.0
        //   Final scaling to bring sum of contributions to [-1, 1]
        //   Empirically determined for 2D simplex noise
        
        const GRAD_NORM: f32 = 1.79284291400159;
        const GRAD_ADJUST: f32 = 0.85373472095314;
        const OUTPUT_SCALE: f32 = 130.0;
        
        // Modular arithmetic helpers (emulate permutation table)
        fn mod289_3(x: vec3f) -> vec3f { return x - floor(x / MOD_BASE) * MOD_BASE; }
        fn mod289_2(x: vec2f) -> vec2f { return x - floor(x / MOD_BASE) * MOD_BASE; }
        fn permute(x: vec3f) -> vec3f { return mod289_3((x * PERMUTE_MULT + 1.0) * x); }
        
        fn simplex2D(v: vec2f) -> f32 {
          // Skew input space to simplex grid
          var i = floor(v + dot(v, vec2f(SKEW_FACTOR)));
          
          // Unskew to find first corner in Cartesian coords
          let x0 = v - i + dot(i, vec2f(UNSKEW_FACTOR));
          
          // Determine which simplex we're in (upper or lower triangle)
          var i1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), x0.x > x0.y);
          
          // Offsets for remaining corners
          var x1 = x0 - i1 + vec2f(UNSKEW_FACTOR);
          var x2 = x0 + vec2f(SIMPLEX_CORNER);
          
          // Permutation for gradient selection
          i = mod289_2(i);
          let p = permute(permute(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
          
          // Radial falloff from each corner (max at corner, zero at edge)
          const FALLOFF_RADIUS: f32 = 0.5;
          var m = max(FALLOFF_RADIUS - vec3f(dot(x0, x0), dot(x1, x1), dot(x2, x2)), vec3f(0.0));
          m = m * m * m * m;  // Fourth power for smooth falloff
          
          // Gradient calculation
          let x = 2.0 * fract(p * vec4f(UNSKEW_FACTOR, SKEW_FACTOR, SIMPLEX_CORNER, PERMUTE_CONST).w) - 1.0;
          let h = abs(x) - 0.5;
          let ox = floor(x + 0.5);
          let a0 = x - ox;
          
          // Normalize gradients
          m *= GRAD_NORM - GRAD_ADJUST * (a0 * a0 + h * h);
          
          // Compute gradient dot products
          var g: vec3f;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.y = a0.y * x1.x + h.y * x1.y;
          g.z = a0.z * x2.x + h.z * x2.y;
          
          return OUTPUT_SCALE * dot(m, g);
        }
        
        @fragment
        fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
          var samplePos = uv * NOISE_SCALE + SEED_OFFSET;
          
          ${warp > 0 ? `
          // Domain warping: offset position by noise for organic distortion
          const WARP_OFFSET: vec2f = vec2f(5.2, 1.3);  // Arbitrary offset to decorrelate
          samplePos += WARP_STRENGTH * vec2f(
            simplex2D(samplePos),
            simplex2D(samplePos + WARP_OFFSET)
          );
          ` : ""}
          
          // Sample noise and convert from [-1,1] to [0,1]
          var noiseValue = simplex2D(samplePos) * 0.5 + 0.5;
          
          // Apply contrast and brightness adjustments
          noiseValue = (noiseValue - 0.5) * CONTRAST + 0.5 + BRIGHTNESS;
          noiseValue = clamp(noiseValue, 0.0, 1.0);
          
          return vec4f(vec3f(noiseValue), 1.0);
        }
      `
  }
}
