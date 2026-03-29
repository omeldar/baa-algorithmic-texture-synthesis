import type { ShaderParams, ShaderGenerator } from "./common"

/**
 * Worley Cracks / Cellular Edges
 * 
 * Variation of Voronoi that emphasizes cell edges.
 * Creates crack-like patterns between cells.
 * 
 * Parameters:
 * - scale: Number of cells
 * - edgeWidth: Width of crack/edge lines
 * - edgeSharpness: How sharp the edges are (higher = sharper)
 * - cellVariation: Brightness variation between cells
 */
export const worleyShader: ShaderGenerator = {
  generate: (params: ShaderParams, _seedValue: number, _time: number): string => {
    const scale = Number(params.scale) || 8
    const edgeWidth = Number(params.edgeWidth) || 0.1
    const edgeSharpness = Number(params.edgeSharpness) || 5
    const cellVariation = Number(params.cellVariation) || 0.3

    return `
        // ============================================
        // WORLEY CRACKS / CELLULAR EDGES
        // ============================================
        // Variation of Voronoi that emphasizes cell edges
        // Creates crack-like patterns between cells
        
        // User parameters
        const CELL_SCALE: f32 = ${scale.toFixed(2)};           // Number of cells
        const EDGE_WIDTH: f32 = ${edgeWidth.toFixed(3)};       // Width of crack/edge lines
        const EDGE_SHARPNESS: f32 = ${edgeSharpness.toFixed(2)}; // How sharp the edges are (higher = sharper)
        const CELL_VARIATION: f32 = ${cellVariation.toFixed(3)}; // Brightness variation between cells
        
        // Search neighborhood radius
        const NEIGHBOR_RANGE: i32 = 1;
        
        @fragment
        fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
          let scaledPos = uv * CELL_SCALE;
          let cellCoord = floor(scaledPos);
          let cellFract = fract(scaledPos);
          
          var closestPoint = vec2f(0.0);
          var closestDist = 100.0;
          var cellBrightness = 0.0;
          
          // First pass: find closest cell center
          for (var dy = -NEIGHBOR_RANGE; dy <= NEIGHBOR_RANGE; dy++) {
            for (var dx = -NEIGHBOR_RANGE; dx <= NEIGHBOR_RANGE; dx++) {
              let neighborOffset = vec2f(f32(dx), f32(dy));
              let neighborCell = cellCoord + neighborOffset;
              
              // Random point in neighbor cell (full jitter)
              let pointOffset = hash2(neighborCell);
              let toPoint = neighborOffset + pointOffset - cellFract;
              let dist = length(toPoint);
              
              if (dist < closestDist) {
                closestDist = dist;
                closestPoint = toPoint;
                cellBrightness = hash2(neighborCell).x;
              }
            }
          }
          
          // Second pass: find minimum distance to edge
          // The edge is the perpendicular bisector between our point and each neighbor
          var minEdgeDist = 100.0;
          
          for (var dy = -NEIGHBOR_RANGE; dy <= NEIGHBOR_RANGE; dy++) {
            for (var dx = -NEIGHBOR_RANGE; dx <= NEIGHBOR_RANGE; dx++) {
              let neighborOffset = vec2f(f32(dx), f32(dy));
              let neighborCell = cellCoord + neighborOffset;
              
              let pointOffset = hash2(neighborCell);
              let toPoint = neighborOffset + pointOffset - cellFract;
              
              // Skip if this is the closest point
              if (length(toPoint - closestPoint) < 0.001) {
                continue;
              }
              
              // Calculate perpendicular distance to the edge (bisector between closest and this point)
              // The edge is at the midpoint, perpendicular to the line connecting the two points
              let midpoint = (closestPoint + toPoint) * 0.5;
              let edgeDir = normalize(toPoint - closestPoint);
              
              // Distance from origin (our position) to the edge line
              // Project midpoint onto edge direction to get perpendicular distance
              let edgeDist = dot(midpoint, edgeDir);
              
              minEdgeDist = min(minEdgeDist, edgeDist);
            }
          }
          
          // Create edge mask using smoothstep and power function
          let edgeGradient = smoothstep(0.0, EDGE_WIDTH, minEdgeDist);
          let edgeMask = 1.0 - pow(edgeGradient, 1.0 / EDGE_SHARPNESS);
          
          // Cell base value with variation
          const BASE_BRIGHTNESS: f32 = 1.0;
          let cellValue = cellBrightness * CELL_VARIATION + (BASE_BRIGHTNESS - CELL_VARIATION);
          
          // Blend cell color with black edges
          const EDGE_COLOR: f32 = 0.0;
          let finalValue = mix(cellValue, EDGE_COLOR, edgeMask);
          
          return vec4f(vec3f(finalValue), 1.0);
        }
      `
  }
}
