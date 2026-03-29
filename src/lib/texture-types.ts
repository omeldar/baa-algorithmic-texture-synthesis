/**
 * Texture Type Definitions
 * 
 * This module contains type definitions and metadata for all supported
 * texture generation algorithms. The actual shader code is located in
 * the lib/shaders/ directory.
 * 
 * @author Eldar Omerovic
 * @thesis Algorithmic Texture Synthesis for Approximating Target Textures
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Supported texture generation algorithms
 */
export type TextureType =
  | "perlin"
  | "simplex"
  | "worley"
  | "efros-leung"
  | "image-quilting"

/**
 * Categories of texture generation approaches
 * - procedural: Mathematical functions (noise, gradients)
 * - rule-based: Pattern-based generation with rules
 * - example-based: Synthesis from sample images
 * - optimisation: Iterative optimization approaches
 */
export type TextureCategory = "procedural" | "rule-based" | "example-based" | "optimisation"

/**
 * Parameter definition for texture controls
 */
export interface TextureParameter {
  /** Unique identifier for the parameter */
  id: string
  /** Display label in the UI */
  label: string
  /** Input control type */
  type: "slider" | "checkbox" | "text" | "select"
  /** Minimum value (for sliders) */
  min?: number
  /** Maximum value (for sliders) */
  max?: number
  /** Step increment (for sliders) */
  step?: number
  /** Default value */
  default: number | boolean | string
  /** Tooltip/description */
  description?: string
}

/**
 * Complete texture definition including metadata and parameters
 */
export interface TextureDefinition {
  /** Unique identifier matching TextureType */
  id: TextureType
  /** Display name */
  name: string
  /** Short description of the algorithm */
  description: string
  /** Classification category */
  category: TextureCategory
  /** Configurable parameters */
  parameters: TextureParameter[]
}

// ============================================
// TEXTURE DEFINITIONS
// ============================================

/**
 * Perlin Noise - Classic gradient noise
 * Reference: Ken Perlin, "An Image Synthesizer" (SIGGRAPH 1985)
 */
const PERLIN_DEFINITION: TextureDefinition = {
  id: "perlin",
  name: "Perlin Noise",
  description: "Classic gradient noise, foundational for procedural textures",
  category: "procedural",
  parameters: [
    { 
      id: "seed", 
      label: "Seed", 
      type: "text", 
      default: "42",
      description: "A starting value that determines the random pattern. Same seed = same pattern every time. Try typing different words or numbers to get different results."
    },
    { 
      id: "scale", 
      label: "Scale", 
      type: "slider", 
      min: 1, 
      max: 50, 
      step: 0.1, 
      default: 8,
      description: "How 'zoomed in' the pattern is. Lower values = larger, smoother blobs. Higher values = smaller, more detailed features."
    },
    { 
      id: "octaves", 
      label: "Octaves", 
      type: "slider", 
      min: 1, 
      max: 8, 
      step: 1, 
      default: 4,
      description: "How many layers of detail to add. Each octave adds finer detail on top of the previous. More octaves = richer, more complex texture but slower to compute."
    },
    { 
      id: "persistence", 
      label: "Persistence", 
      type: "slider", 
      min: 0.1, 
      max: 1, 
      step: 0.01, 
      default: 0.5,
      description: "How much each octave contributes. Low values (0.3) = smooth, gentle transitions. High values (0.7) = rough, jagged appearance with more visible fine detail."
    },
    { 
      id: "lacunarity", 
      label: "Lacunarity", 
      type: "slider", 
      min: 1, 
      max: 4, 
      step: 0.1, 
      default: 2,
      description: "How much to 'zoom in' for each octave. Value of 2 means each layer has twice the detail frequency. Higher values create more contrast between large and small features."
    },
    { 
      id: "animate", 
      label: "Animate", 
      type: "checkbox", 
      default: false,
      description: "When enabled, the pattern slowly shifts over time, creating a flowing, animated effect."
    },
  ],
}

/**
 * Simplex Noise - Improved gradient noise
 * Reference: Ken Perlin, "Simplex Noise" (2001)
 */
const SIMPLEX_DEFINITION: TextureDefinition = {
  id: "simplex",
  name: "Simplex Noise",
  description: "Improved gradient noise with fewer directional artifacts",
  category: "procedural",
  parameters: [
    { 
      id: "seed", 
      label: "Seed", 
      type: "text", 
      default: "42",
      description: "Controls which random pattern is generated. Same seed always produces the same result, making your work reproducible."
    },
    { 
      id: "scale", 
      label: "Scale", 
      type: "slider", 
      min: 1, 
      max: 30, 
      step: 0.5, 
      default: 5,
      description: "How 'zoomed in' the noise appears. Lower values show larger, smoother blobs. Higher values reveal finer, more detailed patterns."
    },
    { 
      id: "contrast", 
      label: "Contrast", 
      type: "slider", 
      min: 0.5, 
      max: 3, 
      step: 0.1, 
      default: 1,
      description: "Amplifies the difference between light and dark areas. Values above 1 make the pattern more dramatic. Values below 1 make it more subtle and washed out."
    },
    { 
      id: "brightness", 
      label: "Brightness", 
      type: "slider", 
      min: -1, 
      max: 1, 
      step: 0.05, 
      default: 0,
      description: "Shifts the overall lightness. Negative values darken the image, positive values brighten it. Useful for fine-tuning the final look."
    },
    { 
      id: "warp", 
      label: "Domain Warp", 
      type: "slider", 
      min: 0, 
      max: 2, 
      step: 0.1, 
      default: 0,
      description: "Distorts the pattern by feeding noise into itself. Creates organic, swirling effects. Higher values produce more extreme warping and fluid-like shapes."
    },
  ],
}

/**
 * Worley Cracks - Edge-based cellular patterns
 * Emphasizes edges between Voronoi cells for crack effects
 */
const WORLEY_DEFINITION: TextureDefinition = {
  id: "worley",
  name: "Worley Cracks",
  description: "Edge-based Worley noise for crack and cell patterns",
  category: "rule-based",
  parameters: [
    { 
      id: "seed", 
      label: "Seed", 
      type: "text", 
      default: "42",
      description: "Determines the random placement of cell centers. Try different values to find interesting crack patterns for your needs."
    },
    { 
      id: "scale", 
      label: "Scale", 
      type: "slider", 
      min: 2, 
      max: 20, 
      step: 0.5, 
      default: 8,
      description: "Controls how many cells (and therefore cracks) appear. More cells = more frequent, smaller cracks. Fewer cells = larger areas with fewer divisions."
    },
    { 
      id: "edgeWidth", 
      label: "Edge Width", 
      type: "slider", 
      min: 0.01, 
      max: 0.5, 
      step: 0.01, 
      default: 0.1,
      description: "How thick the crack lines appear. Low values create fine hairline cracks. High values create wide borders between cells."
    },
    { 
      id: "edgeSharpness", 
      label: "Edge Sharpness", 
      type: "slider", 
      min: 1, 
      max: 20, 
      step: 0.5, 
      default: 5,
      description: "How abruptly the cracks transition from dark to light. Low values = soft, blurry edges. High values = crisp, well-defined crack lines."
    },
    { 
      id: "cellVariation", 
      label: "Cell Variation", 
      type: "slider", 
      min: 0, 
      max: 1, 
      step: 0.01, 
      default: 0.3,
      description: "How different each cell's brightness is from its neighbors. At 0, all cells are the same brightness. At 1, cells vary significantly, creating a mosaic effect."
    },
  ],
}

/**
 * Efros-Leung Example-Based Synthesis
 * Reference: Efros & Leung, "Texture Synthesis by Non-parametric Sampling" (SIGGRAPH 1999)
 */
const EFROS_LEUNG_DEFINITION: TextureDefinition = {
  id: "efros-leung",
  name: "Efros-Leung",
  description: "Non-parametric synthesis from sample images using neighborhood matching",
  category: "example-based",
  parameters: [
    {
      id: "neighborhoodSize",
      label: "Neighborhood Size",
      type: "slider",
      min: 3,
      max: 11,
      step: 2,
      default: 5,
      description: "Size of the pixel neighborhood to match (e.g., 5 means 5x5 pixels). Larger neighborhoods capture more context and produce better quality, but are exponentially slower to compute."
    },
    {
      id: "outputWidth",
      label: "Output Width",
      type: "slider",
      min: 64,
      max: 256,
      step: 16,
      default: 128,
      description: "Width of the generated texture in pixels. Larger sizes take significantly longer to process since each pixel requires searching the entire source image."
    },
    {
      id: "outputHeight",
      label: "Output Height",
      type: "slider",
      min: 64,
      max: 256,
      step: 16,
      default: 128,
      description: "Height of the generated texture in pixels. Combined with width, this determines the total number of pixels that must be synthesized one by one."
    },
    {
      id: "errorTolerance",
      label: "Error Tolerance",
      type: "slider",
      min: 0,
      max: 0.3,
      step: 0.01,
      default: 0.1,
      description: "How much variation to allow in matches. At 0, only the single best match is used. Higher values randomly select from near-matches, adding variety but potentially reducing coherence."
    },
  ],
}

/**
 * Image Quilting (Efros-Freeman)
 * Reference: Efros & Freeman, "Image Quilting for Texture Synthesis and Transfer" (SIGGRAPH 2001)
 * 
 * Instead of pixel-by-pixel synthesis, this algorithm works with patches:
 * 1. Copy overlapping patches from the source image
 * 2. Find the minimum error cut through overlap regions
 * 3. Stitch patches together along the optimal seam
 */
const IMAGE_QUILTING_DEFINITION: TextureDefinition = {
  id: "image-quilting",
  name: "Image Quilting",
  description: "Patch-based synthesis that stitches together blocks from the source image (faster than pixel-by-pixel)",
  category: "example-based",
  parameters: [
    {
      id: "patchSize",
      label: "Patch Size",
      type: "slider",
      min: 16,
      max: 64,
      step: 4,
      default: 32,
      description: "Size of square patches to copy from the source image. Larger patches preserve more structure but may cause visible repetition. Smaller patches blend better but may lose larger patterns."
    },
    {
      id: "overlapSize",
      label: "Overlap Size",
      type: "slider",
      min: 4,
      max: 24,
      step: 2,
      default: 8,
      description: "How much adjacent patches overlap. Larger overlaps create smoother blending but reduce effective patch area. Should be roughly 1/4 to 1/3 of patch size."
    },
    {
      id: "outputWidth",
      label: "Output Width",
      type: "slider",
      min: 128,
      max: 512,
      step: 32,
      default: 256,
      description: "Width of the generated texture. Can be larger than Efros-Leung since patches are much faster to process than individual pixels."
    },
    {
      id: "outputHeight",
      label: "Output Height",
      type: "slider",
      min: 128,
      max: 512,
      step: 32,
      default: 256,
      description: "Height of the generated texture. Patch-based synthesis scales much better, allowing for larger output sizes."
    },
    {
      id: "errorTolerance",
      label: "Error Tolerance",
      type: "slider",
      min: 0,
      max: 0.3,
      step: 0.01,
      default: 0.1,
      description: "Variation in patch selection. At 0, always picks the best matching patch. Higher values randomly choose from near-matches, adding variety."
    },
  ],
}

// ============================================
// EXPORTS
// ============================================

/**
 * All texture definitions in display order
 */
export const TEXTURE_DEFINITIONS: TextureDefinition[] = [
  PERLIN_DEFINITION,
  SIMPLEX_DEFINITION,
  WORLEY_DEFINITION,
  EFROS_LEUNG_DEFINITION,
  IMAGE_QUILTING_DEFINITION,
]

/**
 * Map of texture type to definition for quick lookup
 */
export const TEXTURE_MAP: Record<TextureType, TextureDefinition> = {
  perlin: PERLIN_DEFINITION,
  simplex: SIMPLEX_DEFINITION,
  worley: WORLEY_DEFINITION,
  "efros-leung": EFROS_LEUNG_DEFINITION,
  "image-quilting": IMAGE_QUILTING_DEFINITION,
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get texture definition by type
 */
export function getTextureDefinition(id: TextureType): TextureDefinition {
  return TEXTURE_MAP[id]
}

/**
 * Get default parameter values for a texture definition
 */
export function getDefaultParams(definition: TextureDefinition): Record<string, number | boolean | string> {
  return definition.parameters.reduce((acc, param) => {
    acc[param.id] = param.default
    return acc
  }, {} as Record<string, number | boolean | string>)
}

/**
 * Validate that all required parameters are present
 */
export function validateParams(
  definition: TextureDefinition, 
  params: Record<string, unknown>
): boolean {
  return definition.parameters.every(param => param.id in params)
}

/**
 * Get all texture types as an array
 */
export function getAllTextureTypes(): TextureType[] {
  return TEXTURE_DEFINITIONS.map(def => def.id)
}

/**
 * Get textures by category
 */
export function getTexturesByCategory(category: TextureCategory): TextureDefinition[] {
  return TEXTURE_DEFINITIONS.filter(def => def.category === category)
}
