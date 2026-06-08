// Shader module index
// Each texture type has its own file for maintainability

import { hashSeed, getCommonFunctions, vertexShader, type ShaderParams } from "./common"
import { perlinShader } from "./perlin"
import { simplexShader } from "./simplex"
import { worleyShader } from "./worley"
import { woodShader } from "./wood"
import type { TextureType } from "@/lib/texture-types"

// Map texture types to their shader generators
// Note: Not all texture types have shaders (e.g., example-based algorithms)
const shaderGenerators: Partial<Record<TextureType, { generate: (params: ShaderParams, seedValue: number, time: number) => string }>> = {
  perlin: perlinShader,
  simplex: simplexShader,
  worley: worleyShader,
  wood: woodShader,
}

/**
 * Check if a texture type has a GPU shader implementation
 */
export function hasShader(textureType: TextureType): boolean {
  return textureType in shaderGenerators
}

/**
 * Generate complete WGSL shader code for a texture type
 * 
 * @param textureType - The type of texture to generate
 * @param params - User-configurable parameters
 * @param time - Current time for animations
 * @returns Complete WGSL shader code string
 */
export function generateShader(
  textureType: TextureType,
  params: ShaderParams,
  time: number
): string | null {
  const generator = shaderGenerators[textureType]
  if (!generator) {
    // Return null for texture types without GPU shaders (e.g., example-based)
    return null
  }
  
  const seedValue = hashSeed(String(params.seed || "42"))
  const commonFunctions = getCommonFunctions(seedValue)
  const fragmentShader = generator.generate(params, seedValue, time)
  
  return `${vertexShader}\n${commonFunctions}\n${fragmentShader}`
}

// Re-export types and utilities
export { hashSeed, type ShaderParams }
export type { TextureType }
