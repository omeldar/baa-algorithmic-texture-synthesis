import type { ShaderParams, ShaderGenerator } from "./common"

/**
 * Procedural Wood Texture Shader
 * 
 * Built from layered noise, domain warping, and anisotropic distortion.
 * Uses the following techniques:
 * - Anisotropic coordinates (vertical grain compression)
 * - Domain warping (organic distortion using noise to offset coordinates)
 * - fBm (fractal Brownian motion) for multi-scale detail
 * - Ridged noise for groove/valley lines
 * - Worley noise for cellular crack patterns
 * 
 * References:
 * - Peachey (1985), Perlin (1985)
 * - Ebert et al. "Texturing and Modeling: A Procedural Approach"
 * - The Book of Shaders: Fractal Brownian Motion
 */

// Helper to parse hex color to RGB floats
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    }
  }
  return { r: 0.83, g: 0.65, b: 0.45 } // Default light wood
}

export const woodShader: ShaderGenerator = {
  generate: (params: ShaderParams, _seedValue: number, time: number): string => {
    // Spatial params
    const grainScale = Number(params.grainScale) || 8
    const anisotropy = Number(params.anisotropy) || 0.3
    
    // Warping params
    const warpStrength = Number(params.warpStrength) || 0.8
    const warpScale = Number(params.warpScale) || 2
    
    // Noise params
    const octaves = Math.floor(Number(params.octaves) || 4)
    const persistence = Number(params.persistence) || 0.5
    const lacunarity = Number(params.lacunarity) || 2
    
    // Structure params
    const ridgeStrength = Number(params.ridgeStrength) || 0.4
    const detailStrength = Number(params.detailStrength) || 0.15
    const crackStrength = Number(params.crackStrength) || 0.1
    const crackScale = Number(params.crackScale) || 6
    
    // Appearance params
    const contrast = Number(params.contrast) || 1.2
    const brightness = Number(params.brightness) || 0
    
    // Parse colors
    const colorLight = hexToRgb(String(params.colorLight) || "#d4a574")
    const colorDark = hexToRgb(String(params.colorDark) || "#4a3728")
    
    const animate = params.animate ? 1 : 0
    const animSpeed = 0.05

    return `
      // ============================================
      // PROCEDURAL WOOD TEXTURE
      // ============================================
      // Combines domain-warped fBm with ridged noise and cellular cracks
      // to create realistic wood grain patterns.
      
      // --- User Parameters ---
      const GRAIN_SCALE: f32 = ${grainScale.toFixed(2)};
      const ANISOTROPY: f32 = ${anisotropy.toFixed(3)};
      
      const WARP_STRENGTH: f32 = ${warpStrength.toFixed(3)};
      const WARP_SCALE: f32 = ${warpScale.toFixed(3)};
      
      const NUM_OCTAVES: i32 = ${octaves};
      const PERSISTENCE: f32 = ${persistence.toFixed(3)};
      const LACUNARITY: f32 = ${lacunarity.toFixed(3)};
      
      const RIDGE_STRENGTH: f32 = ${ridgeStrength.toFixed(3)};
      const DETAIL_STRENGTH: f32 = ${detailStrength.toFixed(3)};
      const CRACK_STRENGTH: f32 = ${crackStrength.toFixed(3)};
      const CRACK_SCALE: f32 = ${crackScale.toFixed(2)};
      
      const CONTRAST: f32 = ${contrast.toFixed(3)};
      const BRIGHTNESS: f32 = ${brightness.toFixed(3)};
      
      const COLOR_LIGHT: vec3f = vec3f(${colorLight.r.toFixed(4)}, ${colorLight.g.toFixed(4)}, ${colorLight.b.toFixed(4)});
      const COLOR_DARK: vec3f = vec3f(${colorDark.r.toFixed(4)}, ${colorDark.g.toFixed(4)}, ${colorDark.b.toFixed(4)});
      
      ${animate ? `const ANIM_OFFSET: f32 = ${(time * animSpeed).toFixed(4)};` : "const ANIM_OFFSET: f32 = 0.0;"}
      
      // ============================================
      // fBm (Fractal Brownian Motion)
      // ============================================
      // Layers multiple octaves of Perlin noise with decreasing amplitude
      // and increasing frequency to create natural multi-scale detail.
      
      fn fbm(p: vec2f, numOctaves: i32) -> f32 {
        var sum: f32 = 0.0;
        var amplitude: f32 = 1.0;
        var frequency: f32 = 1.0;
        var maxValue: f32 = 0.0;
        
        var pos = p;
        for (var i: i32 = 0; i < numOctaves; i++) {
          sum += amplitude * perlinNoise(pos * frequency);
          maxValue += amplitude;
          amplitude *= PERSISTENCE;
          frequency *= LACUNARITY;
        }
        
        return sum / maxValue;
      }
      
      // ============================================
      // RIDGED NOISE
      // ============================================
      // Creates sharp valleys/ridges by taking abs() and inverting.
      // Useful for wood grooves and grain lines.
      
      fn ridge(n: f32) -> f32 {
        let r = 1.0 - abs(n);
        return r * r;
      }
      
      fn ridgedFbm(p: vec2f, numOctaves: i32) -> f32 {
        var sum: f32 = 0.0;
        var amplitude: f32 = 1.0;
        var frequency: f32 = 1.0;
        var maxValue: f32 = 0.0;
        
        var pos = p;
        for (var i: i32 = 0; i < numOctaves; i++) {
          sum += amplitude * ridge(perlinNoise(pos * frequency));
          maxValue += amplitude;
          amplitude *= PERSISTENCE;
          frequency *= LACUNARITY;
        }
        
        return sum / maxValue;
      }
      
      // ============================================
      // WORLEY NOISE (Cellular/Voronoi)
      // ============================================
      // Returns distance to nearest feature point.
      // Used for crack patterns in wood.
      
      fn worley(p: vec2f) -> f32 {
        let cellId = floor(p);
        let cellFract = fract(p);
        
        var minDist: f32 = 1.0;
        
        // Check 3x3 neighborhood of cells
        for (var dy: i32 = -1; dy <= 1; dy++) {
          for (var dx: i32 = -1; dx <= 1; dx++) {
            let neighbor = vec2f(f32(dx), f32(dy));
            let neighborCell = cellId + neighbor;
            
            // Random point within neighboring cell
            let featurePoint = neighbor + hash2(neighborCell);
            
            // Distance to feature point
            let dist = length(featurePoint - cellFract);
            minDist = min(minDist, dist);
          }
        }
        
        return minDist;
      }
      
      // ============================================
      // MAIN FRAGMENT SHADER
      // ============================================
      
      @fragment
      fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
        // --- Coordinate Setup ---
        // Scale and apply anisotropy (compress X for vertical grain)
        var p = uv * GRAIN_SCALE;
        p.x *= ANISOTROPY;
        
        // Animation offset
        p += vec2f(ANIM_OFFSET, 0.0);
        
        // --- Domain Warping (critical for organic look) ---
        // Primary warp: distort X based on Y position
        let warp1 = fbm(vec2f(p.y * WARP_SCALE, 0.0), 3);
        p.x += warp1 * WARP_STRENGTH;
        
        // Secondary warp: add small-scale organic distortion
        let smallWarpStrength = WARP_STRENGTH * 0.2;
        p += vec2f(
          fbm(p * 2.0, 2),
          fbm(p * 2.0 + vec2f(10.0, 10.0), 2)
        ) * smallWarpStrength;
        
        // --- Base Structure (fBm) ---
        var wood = fbm(p, NUM_OCTAVES);
        
        // --- Grooves (Ridged Noise) ---
        let grooves = ridgedFbm(p * 1.5, 3);
        wood += grooves * RIDGE_STRENGTH;
        
        // --- Fine Fibers (High-frequency detail) ---
        let fibers = fbm(p * 4.0, 2) * DETAIL_STRENGTH;
        wood += fibers;
        
        // --- Cracks (Cellular/Worley subtraction) ---
        if (CRACK_STRENGTH > 0.001) {
          let crackDist = worley(p * CRACK_SCALE);
          let crack = 1.0 - crackDist;
          let crackSharpness = 3.0;
          let crackValue = pow(max(crack, 0.0), crackSharpness);
          wood -= crackValue * CRACK_STRENGTH;
        }
        
        // --- Distribution Shaping ---
        // Normalize to [0, 1] range first
        wood = wood * 0.5 + 0.5;
        
        // Apply contrast (power function)
        wood = pow(clamp(wood, 0.0, 1.0), CONTRAST);
        
        // Apply brightness offset
        wood = clamp(wood + BRIGHTNESS, 0.0, 1.0);
        
        // --- Color Mapping ---
        var color = mix(COLOR_DARK, COLOR_LIGHT, wood);
        
        // Optional: subtle secondary modulation for more realism
        let colorMod = 0.9 + 0.1 * fbm(p * 0.5, 2);
        color *= colorMod;
        
        return vec4f(color, 1.0);
      }
    `
  }
}
