// Common shader utilities and constants

// Simple hash function for seed
export function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash) / 2147483647
}

// Generate common WGSL functions used by all shaders
export function getCommonFunctions(seedValue: number): string {
  return `
    // ============================================
    // CONSTANTS
    // ============================================
    
    // Mathematical constants
    const PI: f32 = 3.14159265359;
    const TAU: f32 = 6.28318530718;  // 2 * PI
    
    // Hash function constants (carefully chosen primes for good distribution)
    const HASH_PRIME_1: f32 = 127.1;      // First prime for dot product
    const HASH_PRIME_2: f32 = 311.7;      // Second prime for dot product
    const HASH_MULTIPLIER: f32 = 43758.5453123;  // Large prime multiplier for fract()
    
    // Integer hash constants (1/PI and 1/e for irrational mixing)
    const INV_PI: f32 = 0.3183099;   // 1/PI - irrational number for good distribution
    const INV_E: f32 = 0.3678794;    // 1/e - another irrational for mixing
    
    // Seed value (derived from user input)
    const SEED: f32 = ${seedValue.toFixed(6)};
    
    // ============================================
    // HASH FUNCTIONS
    // ============================================
    
    // 2D to 1D hash function using sine-based pseudo-random
    // Returns a value in [0, 1) that appears random for different inputs
    fn hash(p: vec2f) -> f32 {
      let h = dot(p + SEED, vec2f(HASH_PRIME_1, HASH_PRIME_2));
      return fract(sin(h) * HASH_MULTIPLIER);
    }
    
    // 2D to 2D hash function for generating random 2D offsets
    // Uses irrational numbers to avoid grid artifacts
    fn hash2(p: vec2f) -> vec2f {
      let k = vec2f(INV_PI + SEED * 0.1, INV_E);
      var n = p * k + k.yx;
      return fract(16.0 * k * fract(n.x * n.y * (n.x + n.y)));
    }
    
    // ============================================
    // NOISE FUNCTIONS
    // ============================================
    
    // --------------------------------------------
    // VALUE NOISE (simpler, but not true Perlin)
    // --------------------------------------------
    // Each grid corner stores a random scalar value.
    // Values are interpolated with smoothstep for C1 continuity.
    fn valueNoise(p: vec2f) -> f32 {
      let cellCorner = floor(p);           // Integer cell coordinates
      let cellFract = fract(p);            // Position within cell [0,1]
      
      // Smooth interpolation curve: 3t^2 - 2t^3 (Hermite curve)
      // This provides C1 continuity (smooth first derivative)
      let smoothT = cellFract * cellFract * (3.0 - 2.0 * cellFract);
      
      // Sample hash at four corners of the cell
      let corner00 = hash(cellCorner);
      let corner10 = hash(cellCorner + vec2f(1.0, 0.0));
      let corner01 = hash(cellCorner + vec2f(0.0, 1.0));
      let corner11 = hash(cellCorner + vec2f(1.0, 1.0));
      
      // Bilinear interpolation with smooth weights
      return mix(
        mix(corner00, corner10, smoothT.x),
        mix(corner01, corner11, smoothT.x),
        smoothT.y
      );
    }
    
    // Alias for backward compatibility (some shaders use 'noise')
    fn noise(p: vec2f) -> f32 {
      return valueNoise(p);
    }
    
    // --------------------------------------------
    // TRUE PERLIN GRADIENT NOISE (Ken Perlin, 1985)
    // --------------------------------------------
    // Each grid corner stores a pseudo-random GRADIENT VECTOR.
    // The noise value is computed from DOT PRODUCTS between:
    //   - The gradient vector at each corner
    //   - The offset vector from that corner to the sample point
    // This creates smooth, directional variation characteristic of Perlin noise.
    //
    // Key difference from value noise:
    //   - Value noise: interpolates random SCALARS
    //   - Perlin noise: interpolates DOT PRODUCTS with random GRADIENTS
    
    // Generate a pseudo-random unit gradient vector for a grid point
    // Uses the hash to select one of many possible directions
    fn perlinGradient(gridPoint: vec2f) -> vec2f {
      // Hash the grid point to get a pseudo-random angle
      // Multiply by TAU to get full 360-degree coverage
      let angle = hash(gridPoint) * TAU;
      
      // Convert angle to unit vector (gradient direction)
      return vec2f(cos(angle), sin(angle));
    }
    
    // Compute Perlin noise at a 2D position
    // Returns a value approximately in [-1, 1] range
    fn perlinNoise(p: vec2f) -> f32 {
      // Determine which grid cell we're in
      let cellCorner = floor(p);  // Integer coordinates of cell's origin
      let cellFract = fract(p);   // Position within cell [0,1] x [0,1]
      
      // Define the four corners of the cell
      let corner00 = cellCorner;                      // Bottom-left
      let corner10 = cellCorner + vec2f(1.0, 0.0);    // Bottom-right
      let corner01 = cellCorner + vec2f(0.0, 1.0);    // Top-left
      let corner11 = cellCorner + vec2f(1.0, 1.0);    // Top-right
      
      // Get gradient vectors at each corner
      let grad00 = perlinGradient(corner00);
      let grad10 = perlinGradient(corner10);
      let grad01 = perlinGradient(corner01);
      let grad11 = perlinGradient(corner11);
      
      // Compute offset vectors from each corner to sample point
      let offset00 = cellFract;                       // From bottom-left
      let offset10 = cellFract - vec2f(1.0, 0.0);     // From bottom-right
      let offset01 = cellFract - vec2f(0.0, 1.0);     // From top-left
      let offset11 = cellFract - vec2f(1.0, 1.0);     // From top-right
      
      // Compute dot products: gradient · offset
      // This is the core of Perlin noise - the value at each corner
      // depends on how aligned the offset is with the gradient
      let dot00 = dot(grad00, offset00);
      let dot10 = dot(grad10, offset10);
      let dot01 = dot(grad01, offset01);
      let dot11 = dot(grad11, offset11);
      
      // Smoothstep interpolation weights (quintic curve for C2 continuity)
      // Using improved Perlin curve: 6t^5 - 15t^4 + 10t^3
      // This provides smoother results than the original 3t^2 - 2t^3
      let t = cellFract;
      let smoothT = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      
      // Bilinear interpolation of the four dot products
      let interpX0 = mix(dot00, dot10, smoothT.x);  // Bottom edge
      let interpX1 = mix(dot01, dot11, smoothT.x);  // Top edge
      let result = mix(interpX0, interpX1, smoothT.y);
      
      return result;
    }
  `
}

// Vertex shader for full-screen quad
export const vertexShader = `
    // ============================================
    // VERTEX SHADER - Full-screen quad
    // ============================================
    // Renders a triangle strip covering the entire screen
    // Outputs UV coordinates in [0,1] range
    
    struct VertexOutput {
      @builtin(position) position: vec4f,  // Clip-space position
      @location(0) uv: vec2f,              // Texture coordinates [0,1]
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
      // Full-screen quad as two triangles (6 vertices)
      // Clip space: (-1,-1) bottom-left to (1,1) top-right
      var clipSpacePositions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),  // Triangle 1: bottom-left
        vec2f( 1.0, -1.0),  //            bottom-right
        vec2f(-1.0,  1.0),  //            top-left
        vec2f(-1.0,  1.0),  // Triangle 2: top-left
        vec2f( 1.0, -1.0),  //            bottom-right
        vec2f( 1.0,  1.0),  //            top-right
      );
      
      var output: VertexOutput;
      let clipPos = clipSpacePositions[vertexIndex];
      
      // Set clip-space position (z=0 for 2D, w=1 for no perspective)
      output.position = vec4f(clipPos, 0.0, 1.0);
      
      // Convert clip space [-1,1] to UV space [0,1]
      // Formula: uv = (clipPos + 1) * 0.5
      output.uv = (clipPos + 1.0) * 0.5;
      
      // Flip Y axis (UV origin is top-left, clip origin is bottom-left)
      output.uv.y = 1.0 - output.uv.y;
      
      return output;
    }
`

// Type for shader parameters
export type ShaderParams = Record<string, number | boolean | string>

// Interface for shader generators
export interface ShaderGenerator {
  generate: (params: ShaderParams, seedValue: number, time: number) => string
}
