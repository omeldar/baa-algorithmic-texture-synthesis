"use client"

import { useState, useCallback, useMemo, useRef, useEffect, startTransition, memo } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { Environment, OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Shuffle, Download, Upload, Play, Square, X, Settings, FileText, FileSpreadsheet, RotateCcw, Layers, ListPlus, Trash2 } from "lucide-react"
import jsPDF from "jspdf"
import JSZip from "jszip"
import { toast } from "sonner"
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts"

// ===========================================
// SEEDED RANDOM NUMBER GENERATOR
// ===========================================

function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

function createRNG(seed: number) {
  let current = seed
  return () => {
    current++
    return seededRandom(current)
  }
}

// ===========================================
// NOISE FUNCTIONS FOR TERRAIN
// ===========================================

function hash2D(ix: number, iy: number, seed: number): number {
  let x = ((Math.floor(ix) % 65536) + 65536) % 65536
  let y = ((Math.floor(iy) % 65536) + 65536) % 65536
  const s = Math.floor(seed) & 0xffff
  let h = (x * 374761 + y * 668265 + s * 101390) & 0x7fffffff
  h = ((h >> 13) ^ h) & 0x7fffffff
  h = (h * 127412) & 0x7fffffff
  h = ((h >> 16) ^ h) & 0x7fffffff
  return h / 2147483647.0
}

function gradientNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a00 = hash2D(ix, iy, seed) * 6.283185
  const a10 = hash2D(ix + 1, iy, seed) * 6.283185
  const a01 = hash2D(ix, iy + 1, seed) * 6.283185
  const a11 = hash2D(ix + 1, iy + 1, seed) * 6.283185
  const n00 = Math.cos(a00) * fx + Math.sin(a00) * fy
  const n10 = Math.cos(a10) * (fx - 1) + Math.sin(a10) * fy
  const n01 = Math.cos(a01) * fx + Math.sin(a01) * (fy - 1)
  const n11 = Math.cos(a11) * (fx - 1) + Math.sin(a11) * (fy - 1)
  return (n00 + ux * (n10 - n00)) + uy * ((n01 + ux * (n11 - n01)) - (n00 + ux * (n10 - n00)))
}

function noise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2D(ix, iy, seed), b = hash2D(ix + 1, iy, seed)
  const c = hash2D(ix, iy + 1, seed), d = hash2D(ix + 1, iy + 1, seed)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0
  for (let i = 0; i < octaves; i++) {
    value += amplitude * gradientNoise2D(x * frequency, y * frequency, seed + i * 1337)
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2.0
  }
  return value / maxValue
}

function ridgeNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (1 - Math.abs(gradientNoise2D(x * frequency, y * frequency, seed + i * 1337)))
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2.0
  }
  return value / maxValue
}

function turbulence(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0
  for (let i = 0; i < octaves; i++) {
    value += amplitude * Math.abs(gradientNoise2D(x * frequency, y * frequency, seed + i * 1337))
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2.0
  }
  return value / maxValue
}

function getTerrainHeight(worldX: number, worldZ: number, seed: number): number {
  const continental = fbm(worldX * 0.003, worldZ * 0.003, seed, 5) * 30
  const mountainNoise = ridgeNoise(worldX * 0.02, worldZ * 0.02, seed + 1000, 5)
  const mountainMask = Math.max(0, fbm(worldX * 0.008, worldZ * 0.008, seed + 5000, 3) + 0.2)
  const mountains = mountainNoise * mountainMask * 35
  const hills = fbm(worldX * 0.04, worldZ * 0.04, seed + 2000, 4) * 10
  const details = fbm(worldX * 0.12, worldZ * 0.12, seed + 3000, 3) * 3
  const erosion = -turbulence(worldX * 0.015, worldZ * 0.015, seed + 4000, 4) * 8
  const plainsMask = Math.max(0, -fbm(worldX * 0.01, worldZ * 0.01, seed + 6000, 3))
  return continental + mountains + hills + details + erosion - plainsMask * 15 + 10
}

// ===========================================
// MATERIAL TYPES
// ===========================================

 type TextureAlgorithm = "perlin" | "simplex" | "worley" | "wood" | "none"

// Extended texture parameters for full control
interface TextureParams {
  // Common
  scale: number
  octaves: number
  persistence: number
  lacunarity: number
  // Wood specific
  anisotropy: number
  warpStrength: number
  warpScale: number
  ridgeStrength: number
  detailStrength: number
  crackStrength: number
  crackScale: number
  contrast: number
  brightness: number
  colorLight: string
  colorDark: string
}

const DEFAULT_TEXTURE_PARAMS: TextureParams = {
  scale: 8,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  anisotropy: 0.3,
  warpStrength: 0.8,
  warpScale: 2,
  ridgeStrength: 0.4,
  detailStrength: 0.15,
  crackStrength: 0.1,
  crackScale: 6,
  contrast: 1.2,
  brightness: 0,
  colorLight: "#d4a574",
  colorDark: "#4a3728",
}

// Color slot for a specific part of an object (e.g. trunk, leaves)
interface ColorSlot {
  id: string
  name: string
  color: string            // base hex color (tint applied to texture)
  variance: number         // 0-1, how much hue/lightness varies per instance
  algorithm: TextureAlgorithm  // procedural texture algorithm for this slot
  textureScale: number     // noise frequency scale for this slot's texture (legacy, use textureParams.scale)
  textureParams: TextureParams // full texture parameters
}

interface MaterialConfig {
  id: string
  name: string
  color: string
  algorithm: TextureAlgorithm
  scale: number
  textureParams: TextureParams
  // Per-object-type color slots
  colorSlots?: ColorSlot[]
}

// Object types available for placement
type ObjectType = "tree" | "pine" | "rock" | "cactus" | "bush"

interface SceneObject {
  id: string
  type: ObjectType
  position: [number, number, number]
  scale: number
  rotation: number
  seed: number
}

interface Chunk {
  x: number
  z: number
  objects: SceneObject[]
  terrainSeed: number
}

// ===========================================
// COLOR UTILITIES
// ===========================================

// Parse hex to HSL, apply variance offset, return hex
function variantColor(baseHex: string, variance: number, seed: number): string {
  // Parse hex
  const r = parseInt(baseHex.slice(1, 3), 16) / 255
  const g = parseInt(baseHex.slice(3, 5), 16) / 255
  const b = parseInt(baseHex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  // Apply variance shifts deterministically from seed
  const rng = createRNG(seed * 999983 + 1)
  const hShift = (rng() - 0.5) * variance * 0.08   // hue shift ±4% of circle
  const lShift = (rng() - 0.5) * variance * 0.15   // lightness shift ±7.5%

  const nh = (h + hShift + 1) % 1
  const nl = Math.max(0.05, Math.min(0.95, l + lShift))

  // HSL back to RGB
  function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let nr: number, ng: number, nb: number
  if (s === 0) {
    nr = ng = nb = nl
  } else {
    const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s
    const p = 2 * nl - q
    nr = hue2rgb(p, q, nh + 1/3)
    ng = hue2rgb(p, q, nh)
    nb = hue2rgb(p, q, nh - 1/3)
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0")
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

// ===========================================
// TEXTURE GENERATION (for terrain)
// ===========================================

// Global texture timing tracker — components can subscribe to this
type TextureTimingCallback = (ms: number) => void
let textureTimingCallback: TextureTimingCallback | null = null
export function setTextureTimingCallback(cb: TextureTimingCallback | null) {
  textureTimingCallback = cb
}

function generateTextureCanvas(
  algorithm: TextureAlgorithm,
  seed: number,
  baseColor: string,
  params: TextureParams,
  size: number = 128
): HTMLCanvasElement | undefined {
  if (algorithm === "none") return undefined
  
  const t0 = performance.now()
  const scale = params.scale

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const imageData = ctx.createImageData(size, size)

  // Parse base color
  const br = parseInt(baseColor.slice(1, 3), 16)
  const bg = parseInt(baseColor.slice(3, 5), 16)
  const bb = parseInt(baseColor.slice(5, 7), 16)

  const values: number[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size * scale
      const ny = y / size * scale
      let value = 0
      if (algorithm === "perlin") {
        value = fbm(nx, ny, seed, params.octaves)
      } else if (algorithm === "simplex") {
        const warp = fbm(nx, ny, seed, Math.max(1, params.octaves - 1)) * params.persistence
        value = fbm(nx + warp, ny + warp, seed + 100, params.octaves)
      } else if (algorithm === "worley") {
        const ix = Math.floor(nx), iy = Math.floor(ny)
        let minDist = 100
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx2 = -2; dx2 <= 2; dx2++) {
            const cx = ix + dx2, cy = iy + dy
            const px2 = cx + seededRandom(cx * 374761393 + cy * 668265263 + seed)
            const py2 = cy + seededRandom(cx * 668265263 + cy * 374761393 + seed)
            minDist = Math.min(minDist, Math.sqrt((nx - px2) ** 2 + (ny - py2) ** 2))
          }
        }
        value = Math.min(minDist / 0.5, 1) * 2 - 1
      } else if (algorithm === "wood") {
        // Wood grain: anisotropic coordinates + domain warping + ridged noise
        const wx = nx
        const wy = ny * params.anisotropy
        // Domain warp
        const warpX = fbm(wx * params.warpScale, wy * params.warpScale, seed + 500, 3) * params.warpStrength
        const warpY = fbm(wx * params.warpScale + 100, wy * params.warpScale + 100, seed + 600, 3) * params.warpStrength
        const wwx = wx + warpX
        const wwy = wy + warpY
        // Main grain
        const grain = fbm(wwx, wwy, seed, params.octaves)
        // Ridge for wood rings
        const ridge = (1 - Math.abs(gradientNoise2D(wwx * 0.5, wwy * 0.5, seed + 200))) * params.ridgeStrength
        // Detail fiber
        const detail = fbm(wwx * 4, wwy * 4, seed + 300, 2) * params.detailStrength
        // Worley cracks
        let crack = 0
        if (params.crackStrength > 0) {
          const cix = Math.floor(nx * params.crackScale / scale), ciy = Math.floor(ny * params.crackScale / scale)
          let cMinDist = 100
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx2 = -1; dx2 <= 1; dx2++) {
              const cx = cix + dx2, cy = ciy + dy
              const cpx = cx + seededRandom(cx * 374761 + cy * 668265 + seed + 777)
              const cpy = cy + seededRandom(cx * 668265 + cy * 374761 + seed + 888)
              cMinDist = Math.min(cMinDist, Math.sqrt((nx * params.crackScale / scale - cpx) ** 2 + (ny * params.crackScale / scale - cpy) ** 2))
            }
          }
          crack = (1 - Math.min(cMinDist * 2, 1)) * params.crackStrength
        }
        // Combine
        value = grain * 0.5 + ridge + detail - crack
        // Apply contrast and brightness
        value = Math.pow(Math.max(0, (value + 1) / 2), params.contrast) * 2 - 1
        value = value + params.brightness
      }
      values.push(value)
    }
  }

  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal < 0.001 ? 1 : maxVal - minVal

  // For wood textures, use colorLight/colorDark gradient like the shader does
  const isWood = algorithm === "wood"
  let lightR = br, lightG = bg, lightB = bb
  let darkR = br * 0.5, darkG = bg * 0.5, darkB = bb * 0.5
  
  if (isWood && params.colorLight && params.colorDark) {
    // Parse wood-specific colors
    lightR = parseInt(params.colorLight.slice(1, 3), 16)
    lightG = parseInt(params.colorLight.slice(3, 5), 16)
    lightB = parseInt(params.colorLight.slice(5, 7), 16)
    darkR = parseInt(params.colorDark.slice(1, 3), 16)
    darkG = parseInt(params.colorDark.slice(3, 5), 16)
    darkB = parseInt(params.colorDark.slice(5, 7), 16)
  }

  for (let i = 0; i < values.length; i++) {
    const t = (values[i] - minVal) / range           // 0..1
    const idx = i * 4
    
    if (isWood) {
      // Wood: interpolate between dark and light colors (matching shader behavior)
      imageData.data[idx]     = Math.round(darkR + (lightR - darkR) * t)
      imageData.data[idx + 1] = Math.round(darkG + (lightG - darkG) * t)
      imageData.data[idx + 2] = Math.round(darkB + (lightB - darkB) * t)
    } else {
      // Other textures: tint the base color
      const factor = 0.75 + t * 0.5                  // 0.75..1.25
      imageData.data[idx]     = Math.min(255, Math.round(br * factor))
      imageData.data[idx + 1] = Math.min(255, Math.round(bg * factor))
      imageData.data[idx + 2] = Math.min(255, Math.round(bb * factor))
    }
    imageData.data[idx + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)
  
  // Report timing
  const elapsed = performance.now() - t0
  if (textureTimingCallback) textureTimingCallback(elapsed)
  
  return canvas
}

// ===========================================
  // LOW-POLY 3D OBJECTS (built in code, no files)
  // ===========================================

  // Global material cache — reuse materials with same parameters
  const materialCache = new Map<string, THREE.MeshStandardMaterial>()

  // Clear the material/texture cache. Called at the start of each recording run so
  // texture generation is measured fresh every time. Without this, the module-level
  // cache persists across runs/configs: with a high reuse rate only 1–2 distinct
  // textures exist, they get generated once (possibly in a prior config), cached
  // forever, and never regenerate — leaving the Texture Generation graph empty.
  function clearMaterialCache() {
    materialCache.forEach((mat) => {
      mat.map?.dispose()
      mat.dispose()
    })
    materialCache.clear()
  }
  
  // Hook: builds a MeshStandardMaterial with optional procedural texture map.
// variance + textureSeed shift the base color per instance before texturing.
function useSlotMaterial(
  slotColor: string,
  algorithm: TextureAlgorithm,
  textureParams: TextureParams,
  textureSeed: number,
  roughness = 0.85,
  variance = 0
): THREE.MeshStandardMaterial {
  return useMemo(() => {
    // Cache key based on all material parameters - use specific fields instead of JSON.stringify for performance
    const p = textureParams
    const cacheKey = `${slotColor}-${algorithm}-${p.scale}-${p.octaves}-${p.persistence}-${p.lacunarity}-${p.anisotropy}-${p.warpStrength}-${p.contrast}-${p.colorLight}-${p.colorDark}-${textureSeed}-${variance}-${roughness}`
    const cached = materialCache.get(cacheKey)
    if (cached) return cached

    // Apply per-instance color variance (hue/lightness shift from seed)
    const instanceColor = variance > 0 ? variantColor(slotColor, variance, textureSeed) : slotColor
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(instanceColor),
      roughness,
      flatShading: true,
    })
  if (algorithm !== "none") {
  // Texture is generated using the instance-varied color as tint
  // Use higher resolution for wood textures to preserve grain detail
  const texSize = algorithm === "wood" ? 128 : 64
  const canvas = generateTextureCanvas(algorithm, textureSeed, instanceColor, textureParams, texSize)
      if (canvas) {
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        mat.map = tex
        mat.color.set(0xffffff) // texture carries the color
      }
    }
    
    // Cache material (limit to 500 entries)
    if (materialCache.size > 500) {
      const firstKey = materialCache.keys().next().value
      if (firstKey) materialCache.delete(firstKey)
    }
    materialCache.set(cacheKey, mat)
    return mat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotColor, algorithm, textureParams, textureSeed, variance])
}

// Helper: find a slot config by id, falling back to a default color
function slotCfg(slots: ColorSlot[], id: string, fallbackColor: string): ColorSlot {
  return slots.find(s => s.id === id) ?? { id, name: id, color: fallbackColor, variance: 0, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } }
}

// Tree: round canopy + trunk
function TreeObject({ slots, seed }: { slots: ColorSlot[]; seed: number }) {
  const trunk  = slotCfg(slots, "trunk",  "#7c4b2a")
  const leaves = slotCfg(slots, "leaves", "#2d6a2d")
  const trunkMat  = useSlotMaterial(trunk.color,  trunk.algorithm,  trunk.textureParams,  seed,        0.85, trunk.variance)
  const leavesMat = useSlotMaterial(leaves.color, leaves.algorithm, leaves.textureParams, seed + 1000, 0.8,  leaves.variance)
  return (
    <group>
      <mesh position={[0, 0.6, 0]} material={trunkMat} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 1.2, 6]} />
      </mesh>
      <mesh position={[0, 2.1, 0]} material={leavesMat} castShadow>
        <sphereGeometry args={[1.05, 6, 5]} />
      </mesh>
      <mesh position={[0, 3.1, 0]} material={leavesMat} castShadow>
        <sphereGeometry args={[0.65, 5, 4]} />
      </mesh>
    </group>
  )
}

// Pine tree: stacked cones + trunk
function PineObject({ slots, seed }: { slots: ColorSlot[]; seed: number }) {
  const trunk  = slotCfg(slots, "trunk",  "#6b3d1e")
  const leaves = slotCfg(slots, "leaves", "#1a4d1a")
  const trunkMat  = useSlotMaterial(trunk.color,  trunk.algorithm,  trunk.textureParams,  seed,        0.85, trunk.variance)
  const leavesMat = useSlotMaterial(leaves.color, leaves.algorithm, leaves.textureParams, seed + 1000, 0.8,  leaves.variance)
  return (
    <group>
      <mesh position={[0, 0.5, 0]} material={trunkMat} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.0, 5]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={leavesMat} castShadow>
        <coneGeometry args={[1.1, 1.6, 7]} />
      </mesh>
      <mesh position={[0, 2.7, 0]} material={leavesMat} castShadow>
        <coneGeometry args={[0.85, 1.4, 7]} />
      </mesh>
      <mesh position={[0, 3.7, 0]} material={leavesMat} castShadow>
        <coneGeometry args={[0.55, 1.1, 6]} />
      </mesh>
    </group>
  )
}

// Rock: irregular dodecahedron
function RockObject({ slots, seed }: { slots: ColorSlot[]; seed: number }) {
  const rock = slotCfg(slots, "rock", "#7a7a7a")
  const dark = slotCfg(slots, "dark", "#555562")
  const rockMat = useSlotMaterial(rock.color, rock.algorithm, rock.textureParams, seed,        0.95, rock.variance)
  const darkMat = useSlotMaterial(dark.color, dark.algorithm, dark.textureParams, seed + 1000, 0.9,  dark.variance)
  return (
    <group>
      <mesh position={[0, 0.55, 0]} scale={[1.1, 0.7, 0.95]} material={rockMat} castShadow>
        <dodecahedronGeometry args={[0.7, 0]} />
      </mesh>
      <mesh position={[0.3, 0.25, 0.2]} scale={[0.55, 0.45, 0.5]} material={darkMat} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
      </mesh>
    </group>
  )
}

// Cactus: main body + two arms
function CactusObject({ slots, seed }: { slots: ColorSlot[]; seed: number }) {
  const body  = slotCfg(slots, "body",  "#3a7d44")
  const spine = slotCfg(slots, "spine", "#c8b560")
  const bodyMat  = useSlotMaterial(body.color,  body.algorithm,  body.textureParams,  seed,        0.7, body.variance)
  const spineMat = useSlotMaterial(spine.color, spine.algorithm, spine.textureParams, seed + 1000, 0.6, spine.variance)
  return (
    <group>
      <mesh position={[0, 1.0, 0]} material={bodyMat} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 2.0, 7]} />
      </mesh>
      <mesh position={[0, 2.1, 0]} material={bodyMat} castShadow>
        <sphereGeometry args={[0.22, 6, 5]} />
      </mesh>
      <mesh position={[-0.45, 1.1, 0]} rotation={[0, 0, Math.PI / 2.2]} material={bodyMat} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.9, 6]} />
      </mesh>
      <mesh position={[-0.75, 1.45, 0]} material={bodyMat} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.6, 6]} />
      </mesh>
      <mesh position={[0.45, 1.35, 0]} rotation={[0, 0, -Math.PI / 2.3]} material={bodyMat} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.9, 6]} />
      </mesh>
      <mesh position={[0.75, 1.7, 0]} material={bodyMat} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.6, 6]} />
      </mesh>
      {[-0.6, 0, 0.6].map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.23, 0.8 + i * 0.5, Math.sin(angle) * 0.23]} material={spineMat}>
          <sphereGeometry args={[0.04, 4, 3]} />
        </mesh>
      ))}
    </group>
  )
}

// Bush: cluster of spheres
function BushObject({ slots, seed }: { slots: ColorSlot[]; seed: number }) {
  const main   = slotCfg(slots, "main",   "#3d6b2a")
  const accent = slotCfg(slots, "accent", "#2a5020")
  const mainMat   = useSlotMaterial(main.color,   main.algorithm,   main.textureParams,   seed,        0.85, main.variance)
  const accentMat = useSlotMaterial(accent.color, accent.algorithm, accent.textureParams, seed + 1000, 0.85, accent.variance)
  return (
    <group>
      <mesh position={[0, 0.45, 0]} material={mainMat} castShadow>
        <sphereGeometry args={[0.65, 6, 5]} />
      </mesh>
      <mesh position={[-0.5, 0.3, 0.1]} material={accentMat} castShadow>
        <sphereGeometry args={[0.45, 5, 4]} />
      </mesh>
      <mesh position={[0.45, 0.35, -0.1]} material={mainMat} castShadow>
        <sphereGeometry args={[0.42, 5, 4]} />
      </mesh>
      <mesh position={[0.1, 0.35, 0.45]} material={accentMat} castShadow>
        <sphereGeometry args={[0.38, 5, 4]} />
      </mesh>
    </group>
  )
}

// Texture reuse model — "share one texture across `rate` objects, then move on".
//
// Each distinct object is assigned a stable, monotonically increasing encounter
// index the first time it is seen (keyed by its unique id). The texture it uses is
// `floor(encounterIndex / rate)`, so:
//   rate = 1  -> every object gets its own texture (index 0,1,2,... all unique)
//   rate = 25 -> objects 0..24 share texture 0, objects 25..49 share texture 1, ...
//   rate = 50 -> the same, but each texture is held twice as long before switching
//
// Crucially, the number of distinct textures GROWS with the object count
// (≈ objectCount / rate): as new objects appear they keep spilling past the current
// texture's quota and trigger fresh generation, instead of forever recycling a fixed
// pool. A higher rate just means each texture is reused longer before a new one is made.
const objectEncounterOrder = new Map<string, number>()
let objectEncounterCounter = 0

// Reset encounter ordering so reuse grouping is recomputed deterministically from
// scratch. Called alongside clearing the material cache at the start of each run.
function resetTextureReuseOrder() {
  objectEncounterOrder.clear()
  objectEncounterCounter = 0
}

function getReuseTextureSeed(objectId: string, reuseRate: number): number {
  let index = objectEncounterOrder.get(objectId)
  if (index === undefined) {
    index = objectEncounterCounter++
    objectEncounterOrder.set(objectId, index)
  }
  const rate = Math.max(1, Math.floor(reuseRate))
  // Group every `rate` consecutive objects onto one texture seed; +1 keeps seeds non-zero.
  return Math.floor(index / rate) + 1
}

// Dispatcher — renders the right model based on type, passes slot configs + seed
// textureReuseRate controls how many objects share the same texture (1 = unique per object)
const LowPolyObject = memo(function LowPolyObject({
  object, slotOverrides, onInspect, textureReuseRate,
  }: {
  object: SceneObject
  slotOverrides: ObjectSlotOverrides
  onInspect: (pos: [number, number, number] | null) => void
  textureReuseRate: number
  }) {
  const slots = slotOverrides[object.type] ?? OBJECT_SLOT_DEFAULTS[object.type]
  // Texture reuse: assign this object to a texture group based on encounter order.
  // Every `textureReuseRate` objects share one texture seed; the next object spills
  // into a new group and generates a fresh texture. The count of distinct textures
  // therefore grows with the scene (~objectCount / rate) rather than being capped.
  const textureSeed = getReuseTextureSeed(object.id, textureReuseRate)
  const handleClick = useCallback((e: any) => {
    e.stopPropagation()
    onInspect(object.position)
  }, [onInspect, object.position])

  return (
    <group
      position={object.position}
      rotation={[0, object.rotation, 0]}
      scale={object.scale}
      onClick={handleClick}
    >
      {object.type === "tree"   && <TreeObject   slots={slots} seed={textureSeed} />}
      {object.type === "pine"   && <PineObject   slots={slots} seed={textureSeed} />}
      {object.type === "rock"   && <RockObject   slots={slots} seed={textureSeed} />}
      {object.type === "cactus" && <CactusObject slots={slots} seed={textureSeed} />}
{object.type === "bush"   && <BushObject   slots={slots} seed={textureSeed} />}
  </group>
  )
  })
  
  // ===========================================
// TERRAIN CHUNK
// ===========================================

// Global cache for terrain geometries — avoids recreating when revisiting chunks
const terrainGeometryCache = new Map<string, THREE.BufferGeometry>()

const TerrainChunk = memo(function TerrainChunk({
  chunkX, chunkZ, globalSeed, materialConfig, texturesEnabled, textureSeed, segments = 24
  }: {
  chunkX: number
  chunkZ: number
  globalSeed: number
  materialConfig: MaterialConfig
  texturesEnabled: boolean
  textureSeed: number
  segments?: number
  }) {
  const texture = useMemo(() => {
    if (!texturesEnabled || materialConfig.algorithm === "none") return null
    const canvas = generateTextureCanvas(
      materialConfig.algorithm, textureSeed, materialConfig.color, materialConfig.textureParams, 128
    )
    if (!canvas) return null
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 4)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [texturesEnabled, materialConfig.algorithm, materialConfig.textureParams, materialConfig.color, textureSeed])

  const geometry = useMemo(() => {
    const cacheKey = `${chunkX},${chunkZ},${globalSeed},${segments}`
    const cached = terrainGeometryCache.get(cacheKey)
    if (cached) return cached

    const size = 20
    const geo = new THREE.BufferGeometry()
    const vertices: number[] = [], indices: number[] = [], uvs: number[] = []
    const step = size / segments
    const halfSize = size / 2
    const offsetX = chunkX * size, offsetZ = chunkZ * size
    for (let iz = 0; iz <= segments; iz++) {
      for (let ix = 0; ix <= segments; ix++) {
        const localX = ix * step - halfSize
        const localZ = iz * step - halfSize
        const height = getTerrainHeight(localX + offsetX, localZ + offsetZ, globalSeed)
        vertices.push(localX, height, localZ)
        uvs.push(ix / segments, iz / segments)
      }
    }
    for (let iz = 0; iz < segments; iz++) {
      for (let ix = 0; ix < segments; ix++) {
        const a = iz * (segments + 1) + ix
        const b = a + 1, c = a + (segments + 1), d = c + 1
        indices.push(a, c, b)
        indices.push(b, c, d)
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    
    // Cache for reuse (limit cache size to 200 entries)
    if (terrainGeometryCache.size > 200) {
      const firstKey = terrainGeometryCache.keys().next().value
      if (firstKey) terrainGeometryCache.delete(firstKey)
    }
    terrainGeometryCache.set(cacheKey, geo)
    return geo
  }, [chunkX, chunkZ, globalSeed, segments])

  return (
    <mesh position={[chunkX * 20, 0, chunkZ * 20]}>
      {/* dispose={null}: this geometry is shared/reused via terrainGeometryCache, so
          R3F must not dispose it on unmount (e.g. when chunks scroll out of view) —
          otherwise revisiting a chunk would reuse a disposed buffer and render blank. */}
      <primitive object={geometry} dispose={null} />
      {texture ? (
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial color={materialConfig.color} side={THREE.DoubleSide} />
      )}
    </mesh>
  )
})

// ===========================================
// FLYING CAMERA CONTROLLER
// ===========================================

function FlyingCameraController({
  position,
  onMove,
  controlsRef,
  disabled,
  autoMove = false,
}: {
  position: [number, number, number]
  onMove: (newPos: [number, number, number]) => void
  controlsRef: React.RefObject<any>
  disabled: boolean
  autoMove?: boolean
}) {
  const { camera } = useThree()
  const keys = useRef({ w: false, a: false, s: false, d: false })
  const speed = 15
  // Track actual world position in a ref — no React lag
  const posRef = useRef<[number, number, number]>([...position])
  // Track the last chunk coords where we triggered an update
  const lastChunkRef = useRef<{ x: number; z: number }>({
    x: Math.floor(position[0] / CHUNK_SIZE),
    z: Math.floor(position[2] / CHUNK_SIZE),
  })

  useEffect(() => { posRef.current = [...position] }, [position])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea") return
      
      const k = e.key.toLowerCase()
      if (k in keys.current) { (keys.current as any)[k] = true; e.preventDefault() }
    }
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k in keys.current) (keys.current as any)[k] = false
    }
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp) }
  }, [])

  useFrame((_, delta) => {
    if (!controlsRef.current || disabled) return
    const target = controlsRef.current.target as THREE.Vector3

    const forward = new THREE.Vector3(target.x - camera.position.x, 0, target.z - camera.position.z).normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    let mx = 0, mz = 0
    const dist = speed * delta
    // Auto-move simulates W key press during recording
    if (keys.current.w || autoMove) { mx += forward.x * dist; mz += forward.z * dist }
    if (keys.current.s) { mx -= forward.x * dist; mz -= forward.z * dist }
    if (keys.current.a) { mx -= right.x * dist; mz -= right.z * dist }
    if (keys.current.d) { mx += right.x * dist; mz += right.z * dist }

    if (mx !== 0 || mz !== 0) {
      posRef.current = [posRef.current[0] + mx, posRef.current[1], posRef.current[2] + mz]

      // Move camera and target together horizontally — preserve the user's chosen angle
      camera.position.x += mx
      camera.position.z += mz
      target.x += mx
      target.z += mz
      // Do NOT touch target.y — let the user keep their orbit angle

      // Only fire onMove when crossing into a new chunk — avoids per-frame React setState
      const cx = Math.floor(posRef.current[0] / CHUNK_SIZE)
      const cz = Math.floor(posRef.current[2] / CHUNK_SIZE)
      if (cx !== lastChunkRef.current.x || cz !== lastChunkRef.current.z) {
        lastChunkRef.current = { x: cx, z: cz }
        onMove(posRef.current)
      }
    }
  })
  return null
}

// ===========================================
// FPS GRAPH OVERLAY
// ===========================================

interface FpsSample { t: number; fps: number }

// Null R3F component — lives inside Canvas, calls back with raw fps
function FpsTracker({ onSample }: { onSample: (fps: number) => void }) {
  useFrame((_, delta) => {
    if (delta > 0) onSample(Math.min(Math.round(1 / delta), 120))
  })
  return null
}

// Pure HTML overlay — must live OUTSIDE Canvas
function FpsOverlay({ samples }: { samples: FpsSample[] }) {
  const currentFps = samples.length > 0 ? samples[samples.length - 1].fps : 0
  const fpsColor = currentFps >= 50 ? "#4ade80" : currentFps >= 30 ? "#facc15" : "#f87171"

  return (
    <div
      className="bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden w-40 sm:w-48 lg:w-[200px] flex-shrink-0"
      style={{ pointerEvents: "none" }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs text-muted-foreground font-medium">Performance</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: fpsColor }}>
          {currentFps} FPS
        </span>
      </div>
      <div style={{ height: 52, paddingBottom: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <YAxis domain={[0, 65]} tick={{ fontSize: 8 }} tickCount={4} />
            <Line
              type="monotone"
              dataKey="fps"
              stroke={fpsColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Texture generation timing overlay — tracks actual generateTextureCanvas() calls
function TextureTimingOverlay({ timings }: { timings: number[] }) {
  // Average of last 10 textures
  const last10 = timings.slice(-10)
  const avg = last10.length > 0 ? last10.reduce((a, b) => a + b, 0) / last10.length : 0
  // Color thresholds: <2ms green, <5ms yellow, >5ms red
  const avgColor = timings.length === 0 ? "#888" : avg < 2 ? "#4ade80" : avg < 5 ? "#facc15" : "#f87171"

  // Convert to chart data
  const data = timings.map((ms, i) => ({ i, ms }))

  return (
    <div
      className="bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden w-40 sm:w-48 lg:w-[200px] flex-shrink-0"
      style={{ pointerEvents: "none" }}
    >
      <div className="flex items-center justify-between px-2 lg:px-3 pt-2 pb-1">
        <span className="text-xs text-muted-foreground font-medium truncate">Tex Gen (avg 10)</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: avgColor }}>
          {timings.length === 0 ? "—" : `${avg.toFixed(2)} ms`}
        </span>
      </div>
      <div style={{ height: 52, paddingBottom: 4 }}>
        {timings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground px-2 text-center">
            Set object textures to Perlin/Simplex/Worley
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 8 }} tickCount={4} />
              <Line
                type="monotone"
                dataKey="ms"
                stroke={avgColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// Chunk generation timing overlay — tracks generateChunkObjects() calls
function ChunkTimingOverlay({ timings }: { timings: number[] }) {
  const last10 = timings.slice(-10)
  const avg = last10.length > 0 ? last10.reduce((a, b) => a + b, 0) / last10.length : 0
  const avgColor = timings.length === 0 ? "#888" : avg < 1 ? "#4ade80" : avg < 3 ? "#facc15" : "#f87171"
  const data = timings.map((ms, i) => ({ i, ms }))

  return (
    <div
      className="bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden w-40 sm:w-48 lg:w-[200px] flex-shrink-0"
      style={{ pointerEvents: "none" }}
    >
      <div className="flex items-center justify-between px-2 lg:px-3 pt-2 pb-1">
        <span className="text-xs text-muted-foreground font-medium truncate">Chunk Gen (avg 10)</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: avgColor }}>
          {timings.length === 0 ? "—" : `${avg.toFixed(2)} ms`}
        </span>
      </div>
      <div style={{ height: 52, paddingBottom: 4 }}>
        {timings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Move to generate chunks
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 8 }} tickCount={4} />
              <Line
                type="monotone"
                dataKey="ms"
                stroke={avgColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// Render timing overlay — tracks actual frame render time after chunk updates
function RenderTimingOverlay({ timings }: { timings: number[] }) {
  const last10 = timings.slice(-10)
  const avg = last10.length > 0 ? last10.reduce((a, b) => a + b, 0) / last10.length : 0
  // Color: <50ms green, <100ms yellow, >100ms red (this is the actual lag users feel)
  const avgColor = timings.length === 0 ? "#888" : avg < 50 ? "#4ade80" : avg < 100 ? "#facc15" : "#f87171"
  const data = timings.map((ms, i) => ({ i, ms }))

  return (
    <div
      className="bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden w-40 sm:w-48 lg:w-[200px] flex-shrink-0"
      style={{ pointerEvents: "none" }}
    >
      <div className="flex items-center justify-between px-2 lg:px-3 pt-2 pb-1">
        <span className="text-xs text-muted-foreground font-medium truncate">Render (avg 10)</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: avgColor }}>
          {timings.length === 0 ? "—" : `${avg.toFixed(1)} ms`}
        </span>
      </div>
      <div style={{ height: 52, paddingBottom: 4 }}>
        {timings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Move to trigger renders
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 8 }} tickCount={4} />
              <Line
                type="monotone"
                dataKey="ms"
                stroke={avgColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ===========================================
// CONTROLS HINT
// ===========================================

function ControlsHint() {
  return (
    <div className="absolute bottom-6 left-6 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-lg">
      <p className="text-sm font-medium text-foreground">Controls</p>
      <p className="text-xs text-muted-foreground mt-1">WASD: Move</p>
      <p className="text-xs text-muted-foreground">Mouse drag: Look around</p>
      <p className="text-xs text-muted-foreground">Scroll: Zoom in/out</p>
      <p className="text-xs text-muted-foreground">Click object: Inspect</p>
    </div>
  )
}

// ===========================================
// SCENE CONTENT
// ===========================================

function SceneContent({
  playerPosition, onPlayerMove, chunks, materials, texturesEnabled, globalSeed, slotOverrides,
  inspectTarget, onInspect, showSky, textureReuseRate, terrainQuality, autoMove, cameraHeight, cameraDistance, cameraAzimuth, cameraPolar, cameraResetTrigger, regenEpoch,
}: {
  playerPosition: [number, number, number]
  onPlayerMove: (pos: [number, number, number]) => void
  chunks: Chunk[]
  materials: Record<string, MaterialConfig>
  texturesEnabled: boolean
  globalSeed: number
  slotOverrides: ObjectSlotOverrides
  inspectTarget: [number, number, number] | null
  onInspect: (pos: [number, number, number] | null) => void
  showSky: boolean
  textureReuseRate: number
  terrainQuality: number
  autoMove: boolean
  cameraHeight: number
  cameraDistance: number
  cameraAzimuth: number
  cameraPolar: number
  cameraResetTrigger: number
  regenEpoch: number
}) {
  const controlsRef = useRef<any>(null)
  const initialized = useRef(false)
  const { camera } = useThree()

  // Sync camera Y position and Z offset when settings change
  useEffect(() => {
    if (controlsRef.current && !inspectTarget) {
      const target = controlsRef.current.target as THREE.Vector3
      // Update camera height (Y) while preserving horizontal offset
      camera.position.y = cameraHeight
      // Update camera distance - adjust Z relative to target
      const dx = camera.position.x - target.x
      const dz = camera.position.z - target.z
      const currentDist = Math.sqrt(dx * dx + dz * dz)
      if (currentDist > 0.1) {
        const scale = cameraDistance / currentDist
        camera.position.x = target.x + dx * scale
        camera.position.z = target.z + dz * scale
      } else {
        camera.position.z = target.z + cameraDistance
      }
      controlsRef.current.update()
    }
  }, [cameraHeight, cameraDistance, camera, inspectTarget])

  // Reset camera to exact configured position and angle when recording starts
  useEffect(() => {
    if (cameraResetTrigger > 0 && controlsRef.current) {
      // Compute camera position from spherical coordinates
      // Azimuth: 0 = looking from +Z toward origin (north)
      // Polar: angle from vertical (0 = top-down, PI/2 = horizon)
      const x = cameraDistance * Math.sin(cameraPolar) * Math.sin(cameraAzimuth)
      const y = cameraHeight
      const z = cameraDistance * Math.sin(cameraPolar) * Math.cos(cameraAzimuth)
      
      camera.position.set(x, y, z)
      controlsRef.current.target.set(0, 2, 0)
      controlsRef.current.update()
    }
  }, [cameraResetTrigger, cameraHeight, cameraDistance, cameraAzimuth, cameraPolar, camera])

  // Initial camera setup - position camera at max zoom facing north on first load
  useEffect(() => {
    if (controlsRef.current && !initialized.current) {
      // Compute camera position from spherical coordinates (same as reset)
      const x = cameraDistance * Math.sin(cameraPolar) * Math.sin(cameraAzimuth)
      const y = cameraHeight
      const z = cameraDistance * Math.sin(cameraPolar) * Math.cos(cameraAzimuth)
      
      camera.position.set(x, y, z)
      controlsRef.current.target.set(0, 2, 0)
      controlsRef.current.update()
      initialized.current = true
    }
  }, [camera, cameraHeight, cameraDistance, cameraAzimuth, cameraPolar])

  // When inspect target changes, smoothly repoint camera at the object
  useEffect(() => {
    if (!controlsRef.current) return
    if (inspectTarget) {
      // Position camera 8 units back and 5 units up from the object
      const [ix, iy, iz] = inspectTarget
      camera.position.set(ix + 5, iy + 5, iz + 8)
      controlsRef.current.target.set(ix, iy + 1.5, iz)
      controlsRef.current.update()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectTarget])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[50, 50, 25]} intensity={1.2} castShadow />
      <hemisphereLight args={["#87CEEB", "#3d5c3d", 0.4]} />

      <FlyingCameraController
        position={playerPosition}
        onMove={onPlayerMove}
        controlsRef={controlsRef}
        disabled={inspectTarget !== null}
        autoMove={autoMove}
      />

      {chunks.map((chunk) => (
        <group key={`chunk-${chunk.x}-${chunk.z}`}>
          <TerrainChunk
            chunkX={chunk.x}
            chunkZ={chunk.z}
            globalSeed={globalSeed}
            materialConfig={materials.ground}
            texturesEnabled={texturesEnabled}
            textureSeed={chunk.terrainSeed + 1000}
            segments={terrainQuality}
          />
          {chunk.objects.map((obj) => (
            <LowPolyObject
              key={`${obj.id}-e${regenEpoch}`}
              object={obj}
              slotOverrides={slotOverrides}
              onInspect={onInspect}
              textureReuseRate={textureReuseRate}
            />
          ))}
        </group>
      ))}

      {/* Skybox sphere that follows the camera - prevents black edges when moving far */}
      <mesh position={[camera.position.x, camera.position.y, camera.position.z]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
      </mesh>
      <Environment preset="sunset" />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={inspectTarget ? 1.5 : 8}
        maxDistance={inspectTarget ? 20 : 150}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 1.9}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

// ===========================================
// OBJECT TYPE CONFIG (colors slots per type)
// ===========================================

const OBJECT_SLOT_DEFAULTS: Record<ObjectType, ColorSlot[]> = {
  tree: [
    { id: "trunk",  name: "Trunk",  color: "#7c4b2a", variance: 0.3, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
    { id: "leaves", name: "Leaves", color: "#2d6a2d", variance: 0.4, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
  ],
  pine: [
    { id: "trunk",  name: "Trunk",  color: "#6b3d1e", variance: 0.3, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
    { id: "leaves", name: "Leaves", color: "#1a4d1a", variance: 0.4, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
  ],
  rock: [
    { id: "rock",   name: "Rock",   color: "#7a7a7a", variance: 0.35, algorithm: "none", textureScale: 8, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
    { id: "dark",   name: "Shadow", color: "#555562", variance: 0.3,  algorithm: "none", textureScale: 8, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
  ],
  cactus: [
    { id: "body",   name: "Body",   color: "#3a7d44", variance: 0.25, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
    { id: "spine",  name: "Spines", color: "#c8b560", variance: 0.2,  algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
  ],
  bush: [
    { id: "main",   name: "Main",   color: "#3d6b2a", variance: 0.4, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
    { id: "accent", name: "Accent", color: "#2a5020", variance: 0.4, algorithm: "none", textureScale: 6, textureParams: { ...DEFAULT_TEXTURE_PARAMS } },
  ],
}

const OBJECT_TYPES: ObjectType[] = ["tree", "pine", "rock", "cactus", "bush"]

// Distribution weights per type
const OBJECT_WEIGHTS = [0.28, 0.25, 0.22, 0.13, 0.12]

function pickObjectType(rng: () => number): ObjectType {
  const r = rng()
  let acc = 0
  for (let i = 0; i < OBJECT_WEIGHTS.length; i++) {
    acc += OBJECT_WEIGHTS[i]
    if (r < acc) return OBJECT_TYPES[i]
  }
  return "tree"
}

// ===========================================
// MATERIAL / SLOT CONFIG STATE
// ===========================================

type ObjectSlotOverrides = Record<ObjectType, ColorSlot[]>

const defaultSlotOverrides = (): ObjectSlotOverrides =>
  Object.fromEntries(
    OBJECT_TYPES.map(t => [t, OBJECT_SLOT_DEFAULTS[t].map(s => ({ 
      ...s, 
      textureParams: { ...s.textureParams } 
    }))])
  ) as ObjectSlotOverrides

// ===========================================
// MATERIAL EDITOR
// ===========================================

interface TerrainMaterialConfig {
  color: string
  algorithm: TextureAlgorithm
  scale: number
}

const DEFAULT_TERRAIN: TerrainMaterialConfig = {
  color: "#4a7c59",
  algorithm: "none",
  scale: 8,
}

// ===========================================
// CONFIG SAVE/LOAD + RECORDING
// ===========================================

interface EnvironmentConfig {
  version: 1
  name: string
  timestamp: string
  worldSeed: number
  viewDistance: number
  terrainQuality: number
  textureReuseRate: number
  showSky: boolean
  cameraHeight: number
  cameraDistance: number
  cameraAzimuth: number   // horizontal angle in radians (0 = north/+Z)
  cameraPolar: number     // vertical angle in radians (PI/2 = horizon, 0 = straight down)
  terrain: TerrainMaterialConfig
  objects: ObjectSlotOverrides
}

interface TimestampedSample {
  time: number  // ms since recording start
  value: number
}

interface RecordingStats {
  fps: TimestampedSample[]
  textureGen: TimestampedSample[]
  chunkGen: TimestampedSample[]
  render: TimestampedSample[]
  startTime: number
  endTime: number
}

interface RecordingReport {
  config: EnvironmentConfig
  stats: RecordingStats
  summary: {
    durationSeconds: number
    fpsAvg: number
    fpsMin: number
    fpsMax: number
    textureGenAvg: number
    textureGenMin: number
    textureGenMax: number
    chunkGenAvg: number
    chunkGenMin: number
    chunkGenMax: number
    renderAvg: number
    renderMin: number
    renderMax: number
    totalChunksGenerated: number
    totalTexturesGenerated: number
  }
}

// Lightweight per-config summary kept in memory after a config's heavy sample
// data has been checkpointed (downloaded) and discarded.
interface QueueSummaryEntry {
  configName: string
  runs: number
  fpsAvg: number
  renderAvg: number
  textureGenAvg: number
  chunkGenAvg: number
  totalTexturesGenerated: number
  totalChunksGenerated: number
}

// Compute the aggregate summary block from a set of timestamped samples.
function computeRecordingSummary(stats: RecordingStats): RecordingReport["summary"] {
  const values = (arr: TimestampedSample[]) => arr.map(s => s.value)
  const avg = (arr: TimestampedSample[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b.value, 0) / arr.length : 0)
  const max = (arr: TimestampedSample[]) => (arr.length > 0 ? Math.max(...values(arr)) : 0)
  const min = (arr: TimestampedSample[]) => (arr.length > 0 ? Math.min(...values(arr)) : 0)
  return {
    durationSeconds: (stats.endTime - stats.startTime) / 1000,
    fpsAvg: avg(stats.fps), fpsMin: min(stats.fps), fpsMax: max(stats.fps),
    textureGenAvg: avg(stats.textureGen), textureGenMin: min(stats.textureGen), textureGenMax: max(stats.textureGen),
    chunkGenAvg: avg(stats.chunkGen), chunkGenMin: min(stats.chunkGen), chunkGenMax: max(stats.chunkGen),
    renderAvg: avg(stats.render), renderMin: min(stats.render), renderMax: max(stats.render),
    totalChunksGenerated: stats.chunkGen.length,
    totalTexturesGenerated: stats.textureGen.length,
  }
}

// Build a self-documenting timing CSV string for a single recording run.
function buildTimingCSV(report: RecordingReport): string {
  const { stats, config, summary } = report
  const terrainAlgo = config.terrain?.algorithm ?? "unknown"
  const terrainSeed = config.terrain?.params?.seed ?? "N/A"
  const lines = [
    `# Recording: ${config.name}`,
    `# Exported: ${new Date().toISOString()}`,
    `# Duration: ${summary.durationSeconds.toFixed(1)} s`,
    `# World Seed: ${config.worldSeed}`,
    `# View Distance: ${config.viewDistance}`,
    `# Terrain Quality: ${config.terrainQuality} segments`,
    `# Texture Reuse Rate: ${config.textureReuseRate}`,
    `# Terrain Algorithm: ${terrainAlgo}`,
    `# Terrain Shader Seed: ${terrainSeed}`,
    `# Camera Height: ${config.cameraHeight ?? 50}`,
    `# Camera Distance: ${config.cameraDistance ?? 60}`,
    `# Camera Azimuth: ${(config.cameraAzimuth ?? 0).toFixed(4)} rad`,
    `# Camera Polar: ${(config.cameraPolar ?? Math.PI / 3).toFixed(4)} rad`,
    `#`,
    `# --- Summary (avg / min / max) ---`,
    `# FPS: ${summary.fpsAvg.toFixed(1)} / ${summary.fpsMin.toFixed(0)} / ${summary.fpsMax.toFixed(0)}`,
    `# Render ms: ${summary.renderAvg.toFixed(3)} / ${summary.renderMin.toFixed(3)} / ${summary.renderMax.toFixed(3)}`,
    `# TextureGen ms: ${summary.textureGenAvg.toFixed(3)} / ${summary.textureGenMin.toFixed(3)} / ${summary.textureGenMax.toFixed(3)}`,
    `# ChunkGen ms: ${summary.chunkGenAvg.toFixed(3)} / ${summary.chunkGenMin.toFixed(3)} / ${summary.chunkGenMax.toFixed(3)}`,
    `# Total Textures Generated: ${summary.totalTexturesGenerated}`,
    `# Total Chunks Generated: ${summary.totalChunksGenerated}`,
    `#`,
    `# Object Slots:`,
  ]
  for (const [objType, slots] of Object.entries(config.objects ?? {})) {
    for (const [slotId, slot] of Object.entries(slots as Record<string, { algorithm: string; params?: Record<string, unknown> }>)) {
      const slotSeed = slot.params?.seed ?? "N/A"
      lines.push(`#   ${objType}/${slotId}: algorithm=${slot.algorithm} seed=${slotSeed}`)
    }
  }
  lines.push("#")
  const maxLen = Math.max(stats.fps.length, stats.textureGen.length, stats.chunkGen.length, stats.render.length)
  lines.push("Sample,FPS,FPS_Timestamp_ms,TextureGen_ms,TextureGen_Timestamp_ms,ChunkGen_ms,ChunkGen_Timestamp_ms,Render_ms,Render_Timestamp_ms")
  for (let i = 0; i < maxLen; i++) {
    const fps = stats.fps[i], tex = stats.textureGen[i], chunk = stats.chunkGen[i], render = stats.render[i]
    lines.push([
      i,
      fps ? fps.value.toFixed(1) : "", fps ? fps.time : "",
      tex ? tex.value.toFixed(3) : "", tex ? tex.time : "",
      chunk ? chunk.value.toFixed(3) : "", chunk ? chunk.time : "",
      render ? render.value.toFixed(3) : "", render ? render.time : "",
    ].join(","))
  }
  return lines.join("\n")
}

// Build an aggregate CSV across all runs of one config (one row per run + mean row).
function buildAggregateRunsCSV(configName: string, runs: RecordingReport[]): string {
  const lines = [
    `# Aggregate across ${runs.length} run(s) for config: ${configName}`,
    `# Exported: ${new Date().toISOString()}`,
    `#`,
    "Run,FPS_avg,FPS_min,FPS_max,Render_avg_ms,TextureGen_avg_ms,ChunkGen_avg_ms,TexturesGenerated,ChunksGenerated",
  ]
  runs.forEach((r, i) => {
    const s = r.summary
    lines.push([
      i + 1, s.fpsAvg.toFixed(1), s.fpsMin.toFixed(0), s.fpsMax.toFixed(0),
      s.renderAvg.toFixed(3), s.textureGenAvg.toFixed(3), s.chunkGenAvg.toFixed(3),
      s.totalTexturesGenerated, s.totalChunksGenerated,
    ].join(","))
  })
  const mean = (sel: (s: RecordingReport["summary"]) => number) =>
    runs.length > 0 ? runs.reduce((a, r) => a + sel(r.summary), 0) / runs.length : 0
  lines.push([
    "MEAN", mean(s => s.fpsAvg).toFixed(1), "", "",
    mean(s => s.renderAvg).toFixed(3), mean(s => s.textureGenAvg).toFixed(3), mean(s => s.chunkGenAvg).toFixed(3),
    Math.round(mean(s => s.totalTexturesGenerated)), Math.round(mean(s => s.totalChunksGenerated)),
  ].join(","))
  return lines.join("\n")
}

// Build the final combined index across all configs in a completed queue.
function buildQueueIndexCSV(summaries: QueueSummaryEntry[]): string {
  const lines = [
    `# Queue comparison index`,
    `# Exported: ${new Date().toISOString()}`,
    `# Configs: ${summaries.length}`,
    `#`,
    "Config,Runs,FPS_avg,Render_avg_ms,TextureGen_avg_ms,ChunkGen_avg_ms,TexturesGenerated_avg,ChunksGenerated_avg",
  ]
  summaries.forEach(s => {
    lines.push([
      s.configName, s.runs, s.fpsAvg.toFixed(1), s.renderAvg.toFixed(3),
      s.textureGenAvg.toFixed(3), s.chunkGenAvg.toFixed(3),
      Math.round(s.totalTexturesGenerated), Math.round(s.totalChunksGenerated),
    ].join(","))
  })
  return lines.join("\n")
}

// ===========================================
// MAIN COMPONENT
// ===========================================

interface TextureShowcaseProps {
  onBack: () => void
}

const CHUNK_SIZE = 20
const DEFAULT_VIEW_DISTANCE = 3

export function TextureShowcase({ onBack }: TextureShowcaseProps) {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 0])
  const [terrainMat, setTerrainMat] = useState<TerrainMaterialConfig>(DEFAULT_TERRAIN)
  const [texturesEnabled, setTexturesEnabled] = useState(false)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [worldSeed, setWorldSeed] = useState(42)
  const [isGenerating, setIsGenerating] = useState(false)
  const [viewDistance, setViewDistance] = useState(DEFAULT_VIEW_DISTANCE)
  const [inspectTarget, setInspectTarget] = useState<[number, number, number] | null>(null)
  const [cleanViewMode, setCleanViewMode] = useState(false)
  const [showSky, setShowSky] = useState(true)
  const [textureReuseRate, setTextureReuseRate] = useState(1) // 1 = unique per object, higher = more reuse
  const [terrainQuality, setTerrainQuality] = useState(24) // terrain segments: 8-64
  const [cameraHeight, setCameraHeight] = useState(50) // Y position of camera (max zoom out)
  const [cameraDistance, setCameraDistance] = useState(60) // Z offset from player (max zoom out)
  const [cameraAzimuth, setCameraAzimuth] = useState(0) // Horizontal angle (0 = north)
  const [cameraPolar, setCameraPolar] = useState(Math.PI / 3) // Vertical angle (PI/3 ~ 60deg from vertical)
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0) // Increment to trigger camera reset
  // Incremented at the start of every recording run. Woven into chunk/object React
  // keys so all objects fully REMOUNT (not just reconcile). Combined with clearing
  // the material cache, this forces generateTextureCanvas() to run again so texture
  // generation timing is actually captured each run — even at high reuse rates.
  const [regenEpoch, setRegenEpoch] = useState(0)
  const [slotOverrides, setSlotOverrides] = useState<ObjectSlotOverrides>(defaultSlotOverrides)
  const [expandedType, setExpandedType] = useState<ObjectType | null>(null)
  const [fpsSamples, setFpsSamples] = useState<FpsSample[]>([])
  const fpsBufferRef = useRef<number[]>([])
  const fpsLastFlushRef = useRef(0)
  const fpsStartRef = useRef(Date.now())

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const [recordingReport, setRecordingReport] = useState<RecordingReport | null>(null)
  const recordingRef = useRef<{
    stats: RecordingStats
    intervalId: number | null
  } | null>(null)

  // Batch run state — repeat the current config N times (1 / 5 / 10).
  const [batchRunCount, setBatchRunCount] = useState(1)
  const [batchActive, setBatchActive] = useState(false)
  const [batchCurrentRun, setBatchCurrentRun] = useState(0) // 1-based index of the run in progress
  const batchReportsRef = useRef<RecordingReport[]>([]) // completed runs of the active batch
  const batchTargetRef = useRef(1) // how many runs this batch should do
  // When a batch is being driven by the queue, this holds the queue callback to run on completion.
  const batchOnCompleteRef = useRef<((reports: RecordingReport[]) => void) | null>(null)

  // Multi-config queue state — upload several configs, run each batchRunCount times,
  // checkpoint (auto-download) each config's full results, then build a final index.
  const [queueConfigs, setQueueConfigs] = useState<EnvironmentConfig[]>([])
  const [queueActive, setQueueActive] = useState(false)
  const [queueCurrentIndex, setQueueCurrentIndex] = useState(0) // index of the config in progress
  const [queueSummaries, setQueueSummaries] = useState<QueueSummaryEntry[]>([]) // lightweight, kept after checkpoint
  const queueConfigsRef = useRef<EnvironmentConfig[]>([])
  const queueSummariesRef = useRef<QueueSummaryEntry[]>([])
  const queueActiveRef = useRef(false)

  // Config name for save/load
  const [configName, setConfigName] = useState("my-config")

  // Texture params popup state
  const [editingSlot, setEditingSlot] = useState<{ type: ObjectType; slotId: string } | null>(null)

  // Texture generation timing (actual texture canvas generation, not chunk metadata)
  const [textureTimings, setTextureTimings] = useState<number[]>([])
  // Chunk generation timing (object placement + terrain seed calculation per chunk)
  const [chunkTimings, setChunkTimings] = useState<number[]>([])
  // Render timing (time from chunk state change to actual frame render)
  const [renderTimings, setRenderTimings] = useState<number[]>([])
  const renderStartRef = useRef<number | null>(null)
  
  // Wire up the global texture timing callback
  useEffect(() => {
    setTextureTimingCallback((ms: number) => {
      setTextureTimings(prev => [...prev, ms].slice(-120))
    })
    return () => setTextureTimingCallback(null)
  }, [])

  const handleFpsSample = useCallback((fps: number) => {
    fpsBufferRef.current.push(fps)
    const now = Date.now()
    if (now - fpsLastFlushRef.current >= 500) {
      fpsLastFlushRef.current = now
      const avg = Math.round(fpsBufferRef.current.reduce((a, b) => a + b, 0) / fpsBufferRef.current.length)
      fpsBufferRef.current = []
      const t = Math.round((now - fpsStartRef.current) / 1000)
      setFpsSamples(prev => [...prev, { t, fps: avg }].slice(-120))
    }
  }, [])

  // Build materials record expected by TerrainChunk
  const materials = useMemo((): Record<string, MaterialConfig> => ({
  ground: { 
    id: "ground", 
    name: "Ground", 
    color: terrainMat.color, 
    algorithm: terrainMat.algorithm, 
    scale: terrainMat.scale,
    textureParams: { ...DEFAULT_TEXTURE_PARAMS, scale: terrainMat.scale }
  },
  }), [terrainMat])

  // Generate chunk objects — slot colors are resolved at render time from slotOverrides
  const generateChunkObjects = useCallback((
    chunkX: number, chunkZ: number, seed: number
  ): SceneObject[] => {
    const chunkSeed = seed + chunkX * 1000 + chunkZ
    const rng = createRNG(chunkSeed)
    const objects: SceneObject[] = []
    const count = Math.floor(rng() * 5) + 4

    for (let i = 0; i < count; i++) {
      const localX = (rng() - 0.5) * (CHUNK_SIZE - 4)
      const localZ = (rng() - 0.5) * (CHUNK_SIZE - 4)
      const worldX = chunkX * CHUNK_SIZE + localX
      const worldZ = chunkZ * CHUNK_SIZE + localZ
      const terrainH = getTerrainHeight(worldX, worldZ, seed)
      const type = pickObjectType(rng)
      const objSeed = Math.floor(rng() * 999983) + 1
      const scale = 0.7 + rng() * 0.7

      objects.push({
        id: `obj-${chunkX}-${chunkZ}-${i}`,
        type,
        position: [worldX, terrainH, worldZ],
        scale,
        rotation: rng() * Math.PI * 2,
        seed: objSeed,
      })
    }
    return objects
  }, [])

  // Update visible chunks — pre-load 1 extra ring for smoother movement
  const updateChunks = useCallback((
    pos: [number, number, number], seed: number, distance: number, forceRegenerate = false
  ) => {
    const cx0 = Math.floor(pos[0] / CHUNK_SIZE)
    const cz0 = Math.floor(pos[2] / CHUNK_SIZE)
    const preloadDistance = distance + 1 // Pre-load one extra ring of chunks

    setChunks(prevChunks => {
      const needed = new Set<string>()
      for (let dx = -preloadDistance; dx <= preloadDistance; dx++)
        for (let dz = -preloadDistance; dz <= preloadDistance; dz++)
          needed.add(`${cx0 + dx},${cz0 + dz}`)

      const next: Chunk[] = []
      if (!forceRegenerate) {
        prevChunks.forEach(c => {
          const key = `${c.x},${c.z}`
          if (needed.has(key)) { next.push(c); needed.delete(key) }
        })
      }
      const newTimings: number[] = []
      needed.forEach(key => {
        const [cx, cz] = key.split(",").map(Number)
        const t0 = performance.now()
        const objects = generateChunkObjects(cx, cz, seed)
        const elapsed = performance.now() - t0
        newTimings.push(elapsed)
        next.push({
          x: cx, z: cz,
          objects,
          terrainSeed: seed + cx * 1000 + cz,
        })
      })
      // Report chunk timings and start render timer
      if (newTimings.length > 0) {
        setTimeout(() => setChunkTimings(prev => [...prev, ...newTimings].slice(-120)), 0)
      }
      return next
    })
  }, [generateChunkObjects])

  // Track render time — measure how long from chunk update to next frame
  useEffect(() => {
    if (chunks.length > 0 && renderStartRef.current !== null) {
      // Use requestAnimationFrame to measure when React actually finishes rendering
      requestAnimationFrame(() => {
        const elapsed = performance.now() - renderStartRef.current!
        setRenderTimings(prev => [...prev, elapsed].slice(-120))
        renderStartRef.current = null
      })
    }
  }, [chunks])

  // Init
  useEffect(() => {
    updateChunks(playerPosition, worldSeed, viewDistance)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // View distance change
  useEffect(() => {
    updateChunks(playerPosition, worldSeed, viewDistance, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDistance])

  const handlePlayerMove = useCallback((newPos: [number, number, number]) => {
    setPlayerPosition(newPos)
    // Start render timer before chunk update
    renderStartRef.current = performance.now()
    // Use startTransition to make chunk loading non-blocking — camera stays responsive
    startTransition(() => {
      updateChunks(newPos, worldSeed, viewDistance)
    })
  }, [worldSeed, viewDistance, updateChunks])

  const handleApplyTextures = useCallback(() => {
    setIsGenerating(true)
    setTexturesEnabled(true)
    setTimeout(() => {
      updateChunks(playerPosition, worldSeed, viewDistance, true)
      setIsGenerating(false)
      toast.success("Textures applied!")
    }, 100)
  }, [playerPosition, worldSeed, viewDistance, updateChunks])

  const handleNewSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 100000)
    setWorldSeed(s)
    setPlayerPosition([0, 0, 0])
    setIsGenerating(true)
    setTimeout(() => {
      updateChunks([0, 0, 0], s, viewDistance, true)
      setIsGenerating(false)
      toast.success(`New world — seed ${s}`)
    }, 100)
  }, [viewDistance, updateChunks])

  const updateSlot = useCallback((type: ObjectType, slotId: string, field: "color" | "variance" | "algorithm" | "textureScale", value: string | number) => {
    setSlotOverrides(prev => ({
      ...prev,
      [type]: prev[type].map(s => s.id === slotId ? { ...s, [field]: value } : s),
    }))
  }, [])

  const updateSlotParams = useCallback((type: ObjectType, slotId: string, params: Partial<TextureParams>) => {
    setSlotOverrides(prev => ({
      ...prev,
      [type]: prev[type].map(s => s.id === slotId ? { 
        ...s, 
        textureParams: { ...s.textureParams, ...params } 
      } : s),
    }))
  }, [])

  // Build current config object
  const buildConfig = useCallback((): EnvironmentConfig => ({
    version: 1,
    name: configName,
    timestamp: new Date().toISOString(),
    worldSeed,
    viewDistance,
    terrainQuality,
    textureReuseRate,
    showSky,
    cameraHeight,
    cameraDistance,
    cameraAzimuth,
    cameraPolar,
    terrain: terrainMat,
    objects: slotOverrides,
  }), [configName, worldSeed, viewDistance, terrainQuality, textureReuseRate, showSky, cameraHeight, cameraDistance, cameraAzimuth, cameraPolar, terrainMat, slotOverrides])

  // Save config to JSON file
  const handleSaveConfig = useCallback(() => {
    const config = buildConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${configName || "config"}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Config saved!")
  }, [buildConfig, configName])

  // Load config from JSON file
  const handleLoadConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const config = JSON.parse(evt.target?.result as string) as EnvironmentConfig
        if (config.version !== 1) {
          toast.error("Unsupported config version")
          return
        }
        setConfigName(config.name || "imported")
        setWorldSeed(config.worldSeed)
        setViewDistance(config.viewDistance)
        setTerrainQuality(config.terrainQuality)
        setTextureReuseRate(config.textureReuseRate)
        setShowSky(config.showSky)
        setCameraHeight(config.cameraHeight ?? 50)
        setCameraDistance(config.cameraDistance ?? 60)
        setCameraAzimuth(config.cameraAzimuth ?? 0)
        setCameraPolar(config.cameraPolar ?? Math.PI / 3)
        setTerrainMat(config.terrain)
        // Add backward compatibility for configs without textureParams
        const migratedObjects = Object.fromEntries(
          Object.entries(config.objects).map(([type, slots]) => [
            type,
            slots.map(s => ({
              ...s,
              textureParams: s.textureParams || { ...DEFAULT_TEXTURE_PARAMS, scale: s.textureScale || 8 }
            }))
          ])
        ) as ObjectSlotOverrides
        setSlotOverrides(migratedObjects)
        setPlayerPosition([0, 0, 0])
        setTimeout(() => {
          updateChunks([0, 0, 0], config.worldSeed, config.viewDistance, true)
          toast.success(`Loaded config: ${config.name}`)
        }, 100)
      } catch {
        toast.error("Failed to parse config file")
      }
    }
    reader.readAsText(file)
    e.target.value = "" // reset so same file can be loaded again
  }, [updateChunks])

  // Core recording primitive: reset the environment, record 60s, then invoke
  // onComplete with the finished report. Shared by single, batch, and queue runs.
  const startRecordingRun = useCallback((onComplete: (report: RecordingReport) => void) => {
    // Reset player position + camera for a consistent, comparable run
    setPlayerPosition([0, 0, 0])
    setCameraResetTrigger(prev => prev + 1)

    // Clear the persistent material/texture cache and bump the regen epoch so every
    // object fully remounts and regenerates its texture. This guarantees texture
    // generation timing is captured each run — without it, high reuse rates would
    // serve cached textures and leave the Texture Generation graph empty.
    clearMaterialCache()
    resetTextureReuseOrder()
    setRegenEpoch(prev => prev + 1)

    // Reset all timing arrays
    setFpsSamples([])
    setTextureTimings([])
    setChunkTimings([])
    setRenderTimings([])
    setRecordingProgress(0)

    const stats: RecordingStats = {
      fps: [], textureGen: [], chunkGen: [], render: [],
      startTime: Date.now(), endTime: 0,
    }

    recordingRef.current = { stats, intervalId: null }
    setIsRecording(true)

    const duration = 60000
    const startTime = Date.now()

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      setRecordingProgress(Math.min(elapsed / duration, 1))

      if (elapsed >= duration) {
        if (recordingRef.current) {
          recordingRef.current.stats.endTime = Date.now()
          clearInterval(recordingRef.current.intervalId!)
          const finalStats = recordingRef.current.stats
          const report: RecordingReport = {
            config: buildConfig(),
            stats: finalStats,
            summary: computeRecordingSummary(finalStats),
          }
          setIsRecording(false)
          recordingRef.current = null
          onComplete(report)
        }
      }
    }, 100)

    recordingRef.current.intervalId = intervalId
  }, [buildConfig])

  // Start a single recording (manual button): show the report when done.
  const handleStartRecording = useCallback(() => {
    startRecordingRun((report) => {
      setRecordingReport(report)
      setShowReport(true)
    })
    toast.success("Recording started — 60 seconds")
  }, [startRecordingRun])

  // Stop recording early. Also aborts any active batch or queue.
  const handleStopRecording = useCallback(() => {
    // Cancel batch / queue orchestration so no further runs are scheduled.
    batchOnCompleteRef.current = null
    setBatchActive(false)
    setBatchCurrentRun(0)
    queueActiveRef.current = false
    setQueueActive(false)

    if (recordingRef.current) {
      recordingRef.current.stats.endTime = Date.now()
      if (recordingRef.current.intervalId) {
        clearInterval(recordingRef.current.intervalId)
      }
      const finalStats = recordingRef.current.stats
      const report: RecordingReport = {
        config: buildConfig(),
        stats: finalStats,
        summary: computeRecordingSummary(finalStats),
      }
      // Only surface the report for a standalone manual recording.
      if (!queueActive && batchTargetRef.current <= 1) {
        setRecordingReport(report)
        setShowReport(true)
      }
    }
    setIsRecording(false)
    recordingRef.current = null
  }, [buildConfig, queueActive])

  // ── Batch runner ───────────────────────────────────────────────────────────
  // Run the CURRENT config `target` times in sequence. Between runs the world is
  // regenerated and the camera/player reset (handled inside startRecordingRun) so
  // every run starts from the same state. onComplete fires with all run reports.
  const runBatch = useCallback((target: number, onComplete: (reports: RecordingReport[]) => void) => {
    batchReportsRef.current = []
    batchTargetRef.current = target
    batchOnCompleteRef.current = onComplete
    setBatchActive(true)

    const runNext = (runIndex: number) => {
      // Aborted via Stop?
      if (batchOnCompleteRef.current === null && target > 1) return
      setBatchCurrentRun(runIndex + 1)
      startRecordingRun((report) => {
        batchReportsRef.current.push(report)
        if (runIndex + 1 < batchTargetRef.current && batchOnCompleteRef.current !== null) {
          // Brief settle so the world fully regenerates before the next run.
          setTimeout(() => runNext(runIndex + 1), 800)
        } else {
          const reports = batchReportsRef.current
          setBatchActive(false)
          setBatchCurrentRun(0)
          batchOnCompleteRef.current = null
          onComplete(reports)
        }
      })
    }
    runNext(0)
  }, [startRecordingRun])

  // Build + auto-download one config's complete results ZIP (the checkpoint).
  // Contains: the config JSON, one timing CSV per run, and an aggregate CSV.
  const checkpointConfigZip = useCallback(async (configName: string, reports: RecordingReport[]) => {
    const zip = new JSZip()
    const folder = zip.folder(configName) ?? zip
    folder.file(`${configName}.config.json`, JSON.stringify(reports[0]?.config ?? {}, null, 2))
    reports.forEach((r, i) => {
      folder.file(`run-${i + 1}.csv`, buildTimingCSV(r))
    })
    folder.file(`aggregate.csv`, buildAggregateRunsCSV(configName, reports))
    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${configName}_${reports.length}runs_${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Reduce a config's runs to a lightweight summary so heavy sample arrays can be freed.
  const summarizeConfigRuns = useCallback((configName: string, reports: RecordingReport[]): QueueSummaryEntry => {
    const mean = (sel: (s: RecordingReport["summary"]) => number) =>
      reports.length > 0 ? reports.reduce((a, r) => a + sel(r.summary), 0) / reports.length : 0
    return {
      configName,
      runs: reports.length,
      fpsAvg: mean(s => s.fpsAvg),
      renderAvg: mean(s => s.renderAvg),
      textureGenAvg: mean(s => s.textureGenAvg),
      chunkGenAvg: mean(s => s.chunkGenAvg),
      totalTexturesGenerated: mean(s => s.totalTexturesGenerated),
      totalChunksGenerated: mean(s => s.totalChunksGenerated),
    }
  }, [])

  // Manual batch button (no queue): run current config N times then show last report.
  const handleStartBatch = useCallback(() => {
    if (batchRunCount <= 1) {
      handleStartRecording()
      return
    }
    toast.success(`Batch started — ${batchRunCount} runs × 60s`)
    runBatch(batchRunCount, async (reports) => {
      await checkpointConfigZip(configName || "config", reports)
      setRecordingReport(reports[reports.length - 1])
      setShowReport(true)
      toast.success(`Batch complete — ${reports.length} runs downloaded`)
    })
  }, [batchRunCount, runBatch, checkpointConfigZip, configName, handleStartRecording])

  // Apply an EnvironmentConfig to the live scene state (used by the queue).
  const applyConfig = useCallback((config: EnvironmentConfig) => {
    setConfigName(config.name || "imported")
    setWorldSeed(config.worldSeed)
    setViewDistance(config.viewDistance)
    setTerrainQuality(config.terrainQuality)
    setTextureReuseRate(config.textureReuseRate)
    setShowSky(config.showSky)
    setCameraHeight(config.cameraHeight ?? 50)
    setCameraDistance(config.cameraDistance ?? 60)
    setCameraAzimuth(config.cameraAzimuth ?? 0)
    setCameraPolar(config.cameraPolar ?? Math.PI / 3)
    setTerrainMat(config.terrain)
    const migratedObjects = Object.fromEntries(
      Object.entries(config.objects).map(([type, slots]) => [
        type,
        slots.map(s => ({
          ...s,
          textureParams: s.textureParams || { ...DEFAULT_TEXTURE_PARAMS, scale: s.textureScale || 8 },
        })),
      ])
    ) as ObjectSlotOverrides
    setSlotOverrides(migratedObjects)
    setPlayerPosition([0, 0, 0])
    updateChunks([0, 0, 0], config.worldSeed, config.viewDistance, true)
  }, [updateChunks])

  // ── Queue orchestration ──────────────────────────────────────────────────
  // Add uploaded config files to the queue.
  const handleAddQueueConfigs = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    let loaded = 0
    const collected: EnvironmentConfig[] = []
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const cfg = JSON.parse(evt.target?.result as string) as EnvironmentConfig
          if (cfg.version === 1) {
            cfg.name = cfg.name || file.name.replace(/\.json$/i, "")
            collected.push(cfg)
          }
        } catch {
          toast.error(`Failed to parse ${file.name}`)
        }
        loaded++
        if (loaded === files.length) {
          setQueueConfigs(prev => [...prev, ...collected])
          toast.success(`Added ${collected.length} config(s) to queue`)
        }
      }
      reader.readAsText(file)
    })
    e.target.value = ""
  }, [])

  const handleRemoveQueueConfig = useCallback((index: number) => {
    setQueueConfigs(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleClearQueue = useCallback(() => {
    setQueueConfigs([])
    setQueueSummaries([])
  }, [])

  // Process one config in the queue: apply it, let it settle, run the batch,
  // checkpoint (auto-download) its full ZIP, discard heavy data, then advance.
  const processQueueConfig = useCallback((index: number) => {
    const configs = queueConfigsRef.current
    if (index >= configs.length) {
      // Whole queue finished — download the combined comparison index.
      queueActiveRef.current = false
      setQueueActive(false)
      setQueueCurrentIndex(0)
      const summaries = queueSummariesRef.current
      if (summaries.length > 0) {
        const csv = buildQueueIndexCSV(summaries)
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `queue-index_${summaries.length}configs_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast.success(`Queue complete — ${summaries.length} configs, all downloaded`)
      return
    }

    const config = configs[index]
    setQueueCurrentIndex(index)
    applyConfig(config)

    // Let the new config settle (world regen + camera reset) before recording.
    setTimeout(() => {
      runBatch(batchRunCount, async (reports) => {
        // Checkpoint: download this config's full results immediately.
        await checkpointConfigZip(config.name || `config-${index + 1}`, reports)
        // Keep only a tiny summary; let the heavy sample arrays be GC'd.
        const summary = summarizeConfigRuns(config.name || `config-${index + 1}`, reports)
        queueSummariesRef.current = [...queueSummariesRef.current, summary]
        setQueueSummaries(queueSummariesRef.current)
        batchReportsRef.current = []
        // Advance to the next config (if not aborted).
        if (queueActiveRef.current) {
          setTimeout(() => processQueueConfig(index + 1), 500)
        }
      })
    }, 1200)
  }, [applyConfig, runBatch, batchRunCount, checkpointConfigZip, summarizeConfigRuns])

  const handleStartQueue = useCallback(() => {
    if (queueConfigs.length === 0) {
      toast.error("Add at least one config to the queue")
      return
    }
    queueConfigsRef.current = queueConfigs
    queueSummariesRef.current = []
    setQueueSummaries([])
    queueActiveRef.current = true
    setQueueActive(true)
    toast.success(`Queue started — ${queueConfigs.length} configs × ${batchRunCount} runs`)
    processQueueConfig(0)
  }, [queueConfigs, batchRunCount, processQueueConfig])



  // Export report as JSON
  const handleExportReport = useCallback(() => {
    if (!recordingReport) return
    const blob = new Blob([JSON.stringify(recordingReport, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-${recordingReport.config.name}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [recordingReport])

  // Export raw timing data as CSV
  const handleExportCSV = useCallback(() => {
    if (!recordingReport) return
    const { stats, config } = recordingReport

    // Build metadata header so each CSV is self-identifying
    const terrainAlgo = config.terrain?.algorithm ?? "unknown"
    const terrainSeed = config.terrain?.params?.seed ?? "N/A"
    const metaLines = [
      `# Recording: ${config.name}`,
      `# Exported: ${new Date().toISOString()}`,
      `# Duration: ${recordingReport.summary.durationSeconds.toFixed(1)} s`,
      `# World Seed: ${config.worldSeed}`,
      `# View Distance: ${config.viewDistance}`,
      `# Terrain Quality: ${config.terrainQuality} segments`,
      `# Texture Reuse Rate: ${config.textureReuseRate}`,
      `# Terrain Algorithm: ${terrainAlgo}`,
      `# Terrain Shader Seed: ${terrainSeed}`,
      `# Camera Height: ${config.cameraHeight ?? 50}`,
      `# Camera Distance: ${config.cameraDistance ?? 60}`,
      `# Camera Azimuth: ${(config.cameraAzimuth ?? 0).toFixed(4)} rad`,
      `# Camera Polar: ${(config.cameraPolar ?? Math.PI / 3).toFixed(4)} rad`,
      `#`,
      `# --- Summary (avg / min / max) ---`,
      `# FPS: ${recordingReport.summary.fpsAvg.toFixed(1)} / ${recordingReport.summary.fpsMin.toFixed(0)} / ${recordingReport.summary.fpsMax.toFixed(0)}`,
      `# Render ms: ${recordingReport.summary.renderAvg.toFixed(3)} / ${recordingReport.summary.renderMin.toFixed(3)} / ${recordingReport.summary.renderMax.toFixed(3)}`,
      `# TextureGen ms: ${recordingReport.summary.textureGenAvg.toFixed(3)} / ${recordingReport.summary.textureGenMin.toFixed(3)} / ${recordingReport.summary.textureGenMax.toFixed(3)}`,
      `# ChunkGen ms: ${recordingReport.summary.chunkGenAvg.toFixed(3)} / ${recordingReport.summary.chunkGenMin.toFixed(3)} / ${recordingReport.summary.chunkGenMax.toFixed(3)}`,
      `# Total Textures Generated: ${recordingReport.summary.totalTexturesGenerated}`,
      `# Total Chunks Generated: ${recordingReport.summary.totalChunksGenerated}`,
      `#`,
      `# Object Slots:`,
    ]

    // Add per-slot texture info
    for (const [objType, slots] of Object.entries(config.objects ?? {})) {
      for (const [slotId, slot] of Object.entries(slots as Record<string, { algorithm: string; params?: Record<string, unknown> }>)) {
        const slotSeed = slot.params?.seed ?? "N/A"
        metaLines.push(`#   ${objType}/${slotId}: algorithm=${slot.algorithm} seed=${slotSeed}`)
      }
    }

    metaLines.push("#")
    
    // Find max length for padding
    const maxLen = Math.max(stats.fps.length, stats.textureGen.length, stats.chunkGen.length, stats.render.length)

    // Column header
    metaLines.push("Sample,FPS,FPS_Timestamp_ms,TextureGen_ms,TextureGen_Timestamp_ms,ChunkGen_ms,ChunkGen_Timestamp_ms,Render_ms,Render_Timestamp_ms")

    // Data rows
    for (let i = 0; i < maxLen; i++) {
      const fps = stats.fps[i]
      const tex = stats.textureGen[i]
      const chunk = stats.chunkGen[i]
      const render = stats.render[i]

      metaLines.push([
        i,
        fps ? fps.value.toFixed(1) : "",
        fps ? fps.time : "",
        tex ? tex.value.toFixed(3) : "",
        tex ? tex.time : "",
        chunk ? chunk.value.toFixed(3) : "",
        chunk ? chunk.time : "",
        render ? render.value.toFixed(3) : "",
        render ? render.time : "",
      ].join(","))
    }

    const csv = metaLines.join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `timing-data-${config.name}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [recordingReport])

  // Export PDF report with charts
  const handleExportPDF = useCallback(async () => {
    if (!recordingReport) return
    
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = margin
    
    // Title
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text("Performance Recording Report", margin, y)
    y += 10
    
    // Subtitle
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100)
    pdf.text(`${recordingReport.config.name} - ${recordingReport.summary.durationSeconds.toFixed(1)}s recorded`, margin, y)
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y + 5)
    pdf.setTextColor(0)
    y += 15
    
    // Performance Summary Section
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("Performance Summary", margin, y)
    y += 8
    
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const summaryData = [
      [`FPS: ${recordingReport.summary.fpsAvg.toFixed(1)} avg`, `Min: ${recordingReport.summary.fpsMin.toFixed(0)} / Max: ${recordingReport.summary.fpsMax.toFixed(0)}`],
      [`Render Time: ${recordingReport.summary.renderAvg.toFixed(2)} ms avg`, `Min: ${recordingReport.summary.renderMin.toFixed(2)} / Max: ${recordingReport.summary.renderMax.toFixed(2)} ms`],
      [`Texture Gen: ${recordingReport.summary.textureGenAvg.toFixed(3)} ms avg`, `Min: ${recordingReport.summary.textureGenMin.toFixed(3)} / Max: ${recordingReport.summary.textureGenMax.toFixed(3)} ms`],
      [`Chunk Gen: ${recordingReport.summary.chunkGenAvg.toFixed(3)} ms avg`, `Min: ${recordingReport.summary.chunkGenMin.toFixed(3)} / Max: ${recordingReport.summary.chunkGenMax.toFixed(3)} ms`],
      [`Textures Generated: ${recordingReport.summary.totalTexturesGenerated}`, `Chunks Generated: ${recordingReport.summary.totalChunksGenerated}`],
    ]
    
    summaryData.forEach(([left, right]) => {
      pdf.text(left, margin, y)
      pdf.text(right, margin + contentWidth / 2, y)
      y += 6
    })
    y += 5
    
    // Draw mini charts
    const drawChart = (title: string, data: TimestampedSample[], unit: string, yPos: number) => {
      if (data.length === 0) return yPos
      
      const chartHeight = 30
      const chartWidth = contentWidth
      const values = data.map(d => d.value)
      const maxVal = Math.max(...values, 1)
      const minVal = Math.min(...values, 0)
      const range = maxVal - minVal || 1
      
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text(title, margin, yPos)
      yPos += 5
      
      // Chart border
      pdf.setDrawColor(200)
      pdf.setLineWidth(0.3)
      pdf.rect(margin, yPos, chartWidth, chartHeight)
      
      // Y-axis labels
      pdf.setFontSize(7)
      pdf.setFont("helvetica", "normal")
      pdf.text(`${maxVal.toFixed(1)}${unit}`, margin + 1, yPos + 4)
      pdf.text(`${minVal.toFixed(1)}${unit}`, margin + 1, yPos + chartHeight - 1)
      
      // Draw line chart
      pdf.setDrawColor(59, 130, 246) // Blue
      pdf.setLineWidth(0.5)
      
      if (data.length > 1) {
        const xStep = chartWidth / (data.length - 1)
        for (let i = 1; i < data.length; i++) {
          const x1 = margin + (i - 1) * xStep
          const x2 = margin + i * xStep
          const y1 = yPos + chartHeight - ((values[i - 1] - minVal) / range) * chartHeight
          const y2 = yPos + chartHeight - ((values[i] - minVal) / range) * chartHeight
          pdf.line(x1, y1, x2, y2)
        }
      }
      
      return yPos + chartHeight + 8
    }
    
    y = drawChart("FPS Over Time", recordingReport.stats.fps, "", y)
    y = drawChart("Render Time (ms)", recordingReport.stats.render, "ms", y)
    y = drawChart("Texture Generation (ms)", recordingReport.stats.textureGen, "ms", y)
    y = drawChart("Chunk Generation (ms)", recordingReport.stats.chunkGen, "ms", y)
    
    // Configuration Section - always start on second page for clean layout
    pdf.addPage()
    y = margin
    
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("Configuration", margin, y)
    y += 8
    
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const configData = [
      ["World Seed:", recordingReport.config.worldSeed.toString()],
      ["View Distance:", recordingReport.config.viewDistance.toString()],
      ["Terrain Quality:", `${recordingReport.config.terrainQuality} segments`],
      ["Texture Reuse:", recordingReport.config.textureReuseRate === 1 ? "Unique per object" : `1:${recordingReport.config.textureReuseRate}`],
          ["Camera Height:", `${recordingReport.config.cameraHeight ?? 50}`],
          ["Camera Distance:", `${recordingReport.config.cameraDistance ?? 60}`],
          ["Camera Azimuth:", `${(recordingReport.config.cameraAzimuth ?? 0).toFixed(4)} rad`],
          ["Camera Polar:", `${(recordingReport.config.cameraPolar ?? Math.PI / 3).toFixed(4)} rad`],
      ["Terrain Texture:", recordingReport.config.terrain.algorithm],
    ]
    
    configData.forEach(([label, value]) => {
      pdf.setFont("helvetica", "normal")
      pdf.text(label, margin, y)
      pdf.setFont("helvetica", "bold")
      pdf.text(value, margin + 35, y)
      y += 5
    })
    y += 5
    
    // Object Textures Section
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("Object Texture Configuration", margin, y)
    y += 6
    
    pdf.setFontSize(9)
    Object.entries(recordingReport.config.objects).forEach(([type, slots]) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(type.charAt(0).toUpperCase() + type.slice(1), margin, y)
      y += 4
      
      pdf.setFont("helvetica", "normal")
      slots.forEach(slot => {
        const texInfo = slot.algorithm === "none" ? "Solid color" : `${slot.algorithm} (scale: ${slot.textureParams.scale})`
        pdf.text(`  ${slot.name}: ${slot.color} - ${texInfo}`, margin, y)
        y += 4
      })
      y += 2
    })
    
    // Raw Data Summary Section
    if (y > 250) {
      pdf.addPage()
      y = margin
    }
    
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("Raw Data Summary", margin, y)
    y += 6
    
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Total FPS samples: ${recordingReport.stats.fps.length}`, margin, y)
    y += 4
    pdf.text(`Total render timing samples: ${recordingReport.stats.render.length}`, margin, y)
    y += 4
    pdf.text(`Total texture gen samples: ${recordingReport.stats.textureGen.length}`, margin, y)
    y += 4
    pdf.text(`Total chunk gen samples: ${recordingReport.stats.chunkGen.length}`, margin, y)
    y += 8
    
    pdf.setFontSize(8)
    pdf.setTextColor(100)
    pdf.text("For full raw data, export as CSV or JSON.", margin, y)
    
    // Save PDF
    pdf.save(`report-${recordingReport.config.name}-${Date.now()}.pdf`)
  }, [recordingReport])

  // Capture stats during recording with timestamps
  useEffect(() => {
    if (isRecording && recordingRef.current) {
      const elapsed = Date.now() - recordingRef.current.stats.startTime
      if (fpsSamples.length > 0) {
        const latestFps = fpsSamples[fpsSamples.length - 1].fps
        const lastRecorded = recordingRef.current.stats.fps[recordingRef.current.stats.fps.length - 1]
        if (!lastRecorded || lastRecorded.value !== latestFps) {
          recordingRef.current.stats.fps.push({ time: elapsed, value: latestFps })
        }
      }
    }
  }, [fpsSamples, isRecording])

  useEffect(() => {
    if (isRecording && recordingRef.current && textureTimings.length > 0) {
      const elapsed = Date.now() - recordingRef.current.stats.startTime
      const latest = textureTimings[textureTimings.length - 1]
      const lastRecorded = recordingRef.current.stats.textureGen[recordingRef.current.stats.textureGen.length - 1]
      if (!lastRecorded || lastRecorded.value !== latest) {
        recordingRef.current.stats.textureGen.push({ time: elapsed, value: latest })
      }
    }
  }, [textureTimings, isRecording])

  useEffect(() => {
    if (isRecording && recordingRef.current && chunkTimings.length > 0) {
      const elapsed = Date.now() - recordingRef.current.stats.startTime
      const latest = chunkTimings[chunkTimings.length - 1]
      const lastRecorded = recordingRef.current.stats.chunkGen[recordingRef.current.stats.chunkGen.length - 1]
      if (!lastRecorded || lastRecorded.value !== latest) {
        recordingRef.current.stats.chunkGen.push({ time: elapsed, value: latest })
      }
    }
  }, [chunkTimings, isRecording])

  useEffect(() => {
    if (isRecording && recordingRef.current && renderTimings.length > 0) {
      const elapsed = Date.now() - recordingRef.current.stats.startTime
      const latest = renderTimings[renderTimings.length - 1]
      const lastRecorded = recordingRef.current.stats.render[recordingRef.current.stats.render.length - 1]
      if (!lastRecorded || lastRecorded.value !== latest) {
        recordingRef.current.stats.render.push({ time: elapsed, value: latest })
      }
    }
  }, [renderTimings, isRecording])

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Control Panel */}
      {!cleanViewMode && (
      <aside className="flex h-full w-64 min-w-[256px] max-w-[320px] flex-shrink-0 flex-col border-r border-border bg-card lg:w-72 xl:w-80">
        <div className="flex items-center gap-2 border-b border-border p-3 lg:p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate">Terrain Explorer</h2>
            <p className="text-xs text-muted-foreground truncate">Procedural world</p>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 p-3 lg:p-4">

            {/* Config Save/Load */}
            <div className="space-y-2 pb-3 border-b border-border">
              <Label className="text-xs font-medium">Configuration</Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="Config name"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleSaveConfig}>
                  <Download className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <label className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                    <span>
                      <Upload className="h-3 w-3 mr-1" />
                      Load
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLoadConfig}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="space-y-2 pb-3 border-b border-border">
              <Label className="text-xs font-medium">Performance Recording</Label>
              {isRecording || batchActive ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {batchTargetRef.current > 1
                        ? `Run ${batchCurrentRun} / ${batchTargetRef.current}`
                        : "Recording..."}
                    </span>
                    <span className="text-xs font-mono">{Math.round(recordingProgress * 60)}s / 60s</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all duration-100" 
                      style={{ width: `${recordingProgress * 100}%` }}
                    />
                  </div>
                  <Button variant="destructive" size="sm" className="w-full h-8 text-xs" onClick={handleStopRecording}>
                    <Square className="h-3 w-3 mr-1" />
                    {batchTargetRef.current > 1 ? "Stop Batch" : "Stop Recording"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Records 60s of autonomous movement per run with all performance metrics.
                  </p>
                  {/* Runs per config: 1 / 5 / 10 */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Runs per config</span>
                    <div className="flex gap-1">
                      {[1, 5, 10].map(n => (
                        <Button
                          key={n}
                          variant={batchRunCount === n ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setBatchRunCount(n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button variant="default" size="sm" className="w-full h-8 text-xs" onClick={handleStartBatch}>
                    <Play className="h-3 w-3 mr-1" />
                    {batchRunCount > 1 ? `Run ${batchRunCount}× (current config)` : "Start Recording"}
                  </Button>
                </div>
              )}
            </div>

            {/* Multi-Config Queue */}
            <div className="space-y-2 pb-3 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-medium">Config Queue</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload multiple configs and run each {batchRunCount}× back-to-back. Each config&apos;s
                results auto-download as a ZIP the moment it finishes (checkpoint), then a combined
                comparison index downloads at the end.
              </p>

              {queueConfigs.length > 0 && (
                <div className="rounded-md border border-border divide-y divide-border max-h-40 overflow-y-auto">
                  {queueConfigs.map((cfg, i) => {
                    const done = i < queueSummaries.length
                    const running = queueActive && i === queueCurrentIndex
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={
                              "h-1.5 w-1.5 rounded-full shrink-0 " +
                              (done ? "bg-green-500" : running ? "bg-red-500 animate-pulse" : "bg-muted-foreground/40")
                            }
                          />
                          <span className="text-xs truncate">{cfg.name || `config-${i + 1}`}</span>
                        </div>
                        {queueActive ? (
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {done ? "done" : running ? "running" : "queued"}
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleRemoveQueueConfig(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {queueActive ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Config {queueCurrentIndex + 1} / {queueConfigs.length}</span>
                    <span className="font-mono">{queueSummaries.length} done</span>
                  </div>
                  <Button variant="destructive" size="sm" className="w-full h-8 text-xs" onClick={handleStopRecording}>
                    <Square className="h-3 w-3 mr-1" />
                    Stop Queue
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                        <span>
                          <ListPlus className="h-3 w-3 mr-1" />
                          Add Configs
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        multiple
                        onChange={handleAddQueueConfigs}
                        className="hidden"
                      />
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={handleClearQueue}
                      disabled={queueConfigs.length === 0}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleStartQueue}
                    disabled={queueConfigs.length === 0}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run Queue ({queueConfigs.length} × {batchRunCount})
                  </Button>
                </div>
              )}
            </div>


            {/* World Seed */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">World Seed</Label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={worldSeed}
                  onChange={(e) => setWorldSeed(parseInt(e.target.value) || 0)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                />
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleNewSeed}>
                  <Shuffle className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Render Distance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Render Distance</Label>
                <span className="text-xs text-muted-foreground">{viewDistance} ({(viewDistance * 2 + 1) * CHUNK_SIZE}m)</span>
              </div>
              <Slider value={[viewDistance]} onValueChange={([v]) => setViewDistance(v)} min={1} max={5} step={1} />
            </div>

            {/* Terrain Quality */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Terrain Quality</Label>
                <span className="text-xs text-muted-foreground">
                  {terrainQuality} segments
                </span>
              </div>
              <Slider 
                value={[terrainQuality]} 
                onValueChange={([v]) => setTerrainQuality(v)} 
                min={8} max={64} step={4} 
              />
              <p className="text-xs text-muted-foreground">
                Lower = faster, higher = smoother
              </p>
            </div>

            {/* Camera Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Camera Height</Label>
                <span className="text-xs text-muted-foreground">{cameraHeight}</span>
              </div>
              <Slider 
                value={[cameraHeight]} 
                onValueChange={([v]) => setCameraHeight(v)} 
                min={5} max={50} step={1} 
              />
            </div>

            {/* Camera Distance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Camera Distance</Label>
                <span className="text-xs text-muted-foreground">{cameraDistance}</span>
              </div>
              <Slider 
                value={[cameraDistance]} 
                onValueChange={([v]) => setCameraDistance(v)} 
                min={10} max={60} step={1} 
              />
            </div>

            {/* Reset Camera Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setCameraHeight(50)
                setCameraDistance(60)
                setCameraAzimuth(0)
                setCameraPolar(Math.PI / 3)
                setCameraResetTrigger(t => t + 1)
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Reset Camera
            </Button>

            {/* Texture Reuse Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Texture Reuse</Label>
                <span className="text-xs text-muted-foreground">
                  {textureReuseRate === 1 ? "Unique" : `1:${textureReuseRate}`}
                </span>
              </div>
              <Slider 
                value={[textureReuseRate]} 
                onValueChange={([v]) => setTextureReuseRate(v)} 
                min={1} max={50} step={1} 
              />
              <p className="text-xs text-muted-foreground">
                {textureReuseRate === 1
                  ? "Each object gets a unique texture"
                  : `Each texture is shared by ${textureReuseRate} objects, then a new one is generated`}
              </p>
            </div>

            {/* Terrain Material */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Terrain</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: terrainMat.color }} />
                  <input
                    type="color"
                    value={terrainMat.color}
                    onChange={e => setTerrainMat(p => ({ ...p, color: e.target.value }))}
                    className="w-6 h-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    title="Terrain color"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Texture</Label>
                <Select value={terrainMat.algorithm} onValueChange={(v: TextureAlgorithm) => setTerrainMat(p => ({ ...p, algorithm: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Solid Color</SelectItem>
                    <SelectItem value="perlin">Perlin Noise</SelectItem>
                    <SelectItem value="simplex">Simplex Noise</SelectItem>
                    <SelectItem value="worley">Worley Cracks</SelectItem>
                    <SelectItem value="wood">Wood Grain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {terrainMat.algorithm !== "none" && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-xs">Scale</Label>
                    <span className="text-xs text-muted-foreground">{terrainMat.scale}</span>
                  </div>
                  <Slider value={[terrainMat.scale]} onValueChange={([v]) => setTerrainMat(p => ({ ...p, scale: v }))} min={2} max={20} step={1} />
                </div>
              )}
            </div>

            {terrainMat.algorithm !== "none" && (
              <Button className="w-full" onClick={handleApplyTextures} disabled={isGenerating}>
                {isGenerating ? "Applying..." : "Apply Terrain Texture"}
              </Button>
            )}

            {/* Object Color Slots */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Object Colors</Label>
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-1">
                  {OBJECT_TYPES.map(type => {
                    const slots = slotOverrides[type]
                    const isOpen = expandedType === type
                    return (
                      <div key={type} className="rounded-lg border border-border overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedType(isOpen ? null : type)}
                        >
                          <span className="capitalize">{type}</span>
                          <div className="flex items-center gap-1">
                            {slots.map(s => (
                              <div key={s.id} className="w-3.5 h-3.5 rounded-sm border border-border/50" style={{ backgroundColor: s.color }} />
                            ))}
                            <span className="text-muted-foreground ml-1">{isOpen ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 pt-1 space-y-4 bg-muted/20">
                            {slots.map(slot => (
                              <div key={slot.id} className="space-y-2 border-t border-border/40 pt-2 first:border-0 first:pt-0">
                                {/* Slot name + color picker + settings */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">{slot.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: slot.color }} />
                                    <input
                                      type="color"
                                      value={slot.color}
                                      onChange={e => updateSlot(type, slot.id, "color", e.target.value)}
                                      className="w-6 h-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                    />
                                    {slot.algorithm !== "none" && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => setEditingSlot({ type, slotId: slot.id })}
                                        title="Texture parameters"
                                      >
                                        <Settings className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {/* Variance */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Variance</span>
                                    <span className="text-xs tabular-nums text-muted-foreground">{Math.round(slot.variance * 100)}%</span>
                                  </div>
                                  <Slider
                                    value={[slot.variance]}
                                    onValueChange={([v]) => updateSlot(type, slot.id, "variance", v)}
                                    min={0} max={1} step={0.05}
                                  />
                                </div>
                                {/* Texture algorithm */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Texture</span>
                                    {slot.algorithm !== "none" && (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-4 px-0 text-xs text-muted-foreground"
                                        onClick={() => setEditingSlot({ type, slotId: slot.id })}
                                      >
                                        Edit params
                                      </Button>
                                    )}
                                  </div>
                                  <Select
                                    value={slot.algorithm}
                                    onValueChange={(v: TextureAlgorithm) => updateSlot(type, slot.id, "algorithm", v)}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Solid color</SelectItem>
                                      <SelectItem value="perlin">Perlin noise</SelectItem>
                                      <SelectItem value="simplex">Simplex / warped</SelectItem>
                                      <SelectItem value="worley">Worley cracks</SelectItem>
                                      <SelectItem value="wood">Wood grain</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {/* Quick texture scale — only shown when algorithm is active */}
                                {slot.algorithm !== "none" && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground">Scale</span>
                                      <span className="text-xs tabular-nums text-muted-foreground">{slot.textureParams.scale}</span>
                                    </div>
                                    <Slider
                                      value={[slot.textureParams.scale]}
                                      onValueChange={([v]) => updateSlotParams(type, slot.id, { scale: v })}
                                      min={1} max={20} step={0.5}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                </div>
              </ScrollArea>
            </div>

          </div>
        </ScrollArea>
      </aside>
      )}

      {/* 3D View */}
      <div className="relative flex-1 min-w-0">
        <Canvas camera={{ position: [0, cameraHeight, cameraDistance], fov: 60 }}>
    <SceneContent
      playerPosition={playerPosition}
      onPlayerMove={handlePlayerMove}
      chunks={chunks}
      materials={materials}
      texturesEnabled={texturesEnabled}
      globalSeed={worldSeed}
      slotOverrides={slotOverrides}
      inspectTarget={inspectTarget}
      onInspect={setInspectTarget}
      showSky={showSky}
      textureReuseRate={textureReuseRate}
      terrainQuality={terrainQuality}
      autoMove={isRecording}
            cameraHeight={cameraHeight}
            cameraDistance={cameraDistance}
            cameraAzimuth={cameraAzimuth}
            cameraPolar={cameraPolar}
            cameraResetTrigger={cameraResetTrigger}
            regenEpoch={regenEpoch}
    />
          <FpsTracker onSample={handleFpsSample} />
        </Canvas>

        {/* Clean view toggle button - always visible */}
        <button
          onClick={() => setCleanViewMode(prev => !prev)}
          className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg text-xs font-medium hover:bg-card transition-colors"
        >
          {cleanViewMode ? "Show UI" : "Clean View"}
        </button>

        {/* Performance charts stacked in top-right */}
        {!cleanViewMode && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 max-h-[calc(100%-6rem)] overflow-y-auto">
            <FpsOverlay samples={fpsSamples} />
            <TextureTimingOverlay timings={textureTimings} />
            <ChunkTimingOverlay timings={chunkTimings} />
            <RenderTimingOverlay timings={renderTimings} />
          </div>
        )}

        {/* Inspect mode banner */}
        {inspectTarget && !cleanViewMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/95 backdrop-blur-sm border border-border rounded-full px-5 py-2.5 shadow-lg">
            <span className="text-xs text-muted-foreground">Inspect mode — drag to orbit, scroll to zoom</span>
            <button
              onClick={() => setInspectTarget(null)}
              className="text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-full px-3 py-1 transition-colors"
            >
              Exit
            </button>
          </div>
        )}

{!inspectTarget && !cleanViewMode && <ControlsHint />}

        {/* Recording indicator overlay */}
        {isRecording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-medium text-white">Recording {Math.round(recordingProgress * 60)}s / 60s</span>
          </div>
        )}
      </div>

      {/* Report Popup */}
      {showReport && recordingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Recording Report</h2>
                <p className="text-xs text-muted-foreground">
                  {recordingReport.config.name} - {recordingReport.summary.durationSeconds.toFixed(1)}s recorded
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowReport(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* Summary Stats */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Performance Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">FPS</p>
                      <p className="text-lg font-semibold">{recordingReport.summary.fpsAvg.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">
                        min {recordingReport.summary.fpsMin.toFixed(0)} / max {recordingReport.summary.fpsMax.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Render Time</p>
                      <p className="text-lg font-semibold">{recordingReport.summary.renderAvg.toFixed(1)} ms</p>
                      <p className="text-xs text-muted-foreground">
                        min {recordingReport.summary.renderMin.toFixed(1)} / max {recordingReport.summary.renderMax.toFixed(1)} ms
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Texture Gen</p>
                      <p className="text-lg font-semibold">{recordingReport.summary.textureGenAvg.toFixed(2)} ms</p>
                      <p className="text-xs text-muted-foreground">
                        min {recordingReport.summary.textureGenMin.toFixed(2)} / max {recordingReport.summary.textureGenMax.toFixed(2)} ms · {recordingReport.summary.totalTexturesGenerated} textures
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Chunk Gen</p>
                      <p className="text-lg font-semibold">{recordingReport.summary.chunkGenAvg.toFixed(2)} ms</p>
                      <p className="text-xs text-muted-foreground">
                        min {recordingReport.summary.chunkGenMin.toFixed(2)} / max {recordingReport.summary.chunkGenMax.toFixed(2)} ms · {recordingReport.summary.totalChunksGenerated} chunks
                      </p>
                    </div>
                  </div>
                </div>

                {/* Config Summary */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Configuration</h3>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">World Seed</span>
                      <span className="font-mono">{recordingReport.config.worldSeed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">View Distance</span>
                      <span>{recordingReport.config.viewDistance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Terrain Quality</span>
                      <span>{recordingReport.config.terrainQuality} segments</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Texture Reuse</span>
                      <span>{recordingReport.config.textureReuseRate === 1 ? "Unique" : `1:${recordingReport.config.textureReuseRate}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Terrain Texture</span>
                      <span>{recordingReport.config.terrain.algorithm}</span>
                    </div>
                  </div>
                </div>

                {/* Object Textures */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Object Textures</h3>
                  <div className="space-y-2">
                    {Object.entries(recordingReport.config.objects).map(([type, slots]) => (
                      <div key={type} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-medium capitalize mb-2">{type}</p>
                        <div className="space-y-1 text-xs">
                          {slots.map(slot => (
                            <div key={slot.id} className="flex items-center justify-between">
                              <span className="text-muted-foreground flex items-center gap-2">
                                <div className="w-3 h-3 rounded border border-border" style={{ backgroundColor: slot.color }} />
                                {slot.name}
                              </span>
                              <span>{slot.algorithm === "none" ? "Solid" : slot.algorithm}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-border space-y-2 bg-card">
              <div className="flex gap-2">
                <Button variant="default" className="flex-1" onClick={handleExportPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Report
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleExportCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV Data
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleExportReport}>
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowReport(false)}>
                Close
              </Button>
            </div>
  </div>
  </div>
  )}

      {/* Texture Parameters Popup */}
      {editingSlot && (() => {
        const slot = slotOverrides[editingSlot.type].find(s => s.id === editingSlot.slotId)
        if (!slot) return null
        const params = slot.textureParams
        const isWood = slot.algorithm === "wood"
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-start pl-6 bg-black/15 pointer-events-none">
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold">Texture Parameters</h2>
                  <p className="text-xs text-muted-foreground">
                    {editingSlot.type} / {slot.name} — {slot.algorithm}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditingSlot(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-4">
                  {/* Common Parameters */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Noise Settings</h3>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Scale</span>
                        <span className="text-muted-foreground">{params.scale}</span>
                      </div>
                      <Slider value={[params.scale]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { scale: v })} min={1} max={20} step={0.5} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Octaves</span>
                        <span className="text-muted-foreground">{params.octaves}</span>
                      </div>
                      <Slider value={[params.octaves]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { octaves: v })} min={1} max={6} step={1} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Persistence</span>
                        <span className="text-muted-foreground">{params.persistence.toFixed(2)}</span>
                      </div>
                      <Slider value={[params.persistence]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { persistence: v })} min={0.1} max={0.9} step={0.05} />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Lacunarity</span>
                        <span className="text-muted-foreground">{params.lacunarity.toFixed(1)}</span>
                      </div>
                      <Slider value={[params.lacunarity]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { lacunarity: v })} min={1.5} max={3} step={0.1} />
                    </div>
                  </div>

                  {/* Wood-specific Parameters */}
                  {isWood && (
                    <>
                      <div className="space-y-3 pt-2 border-t border-border">
                        <h3 className="text-sm font-medium">Wood Grain</h3>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Anisotropy</span>
                            <span className="text-muted-foreground">{params.anisotropy.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.anisotropy]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { anisotropy: v })} min={0.1} max={1} step={0.05} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Warp Strength</span>
                            <span className="text-muted-foreground">{params.warpStrength.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.warpStrength]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { warpStrength: v })} min={0} max={2} step={0.05} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Warp Scale</span>
                            <span className="text-muted-foreground">{params.warpScale.toFixed(1)}</span>
                          </div>
                          <Slider value={[params.warpScale]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { warpScale: v })} min={0.5} max={5} step={0.1} />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-border">
                        <h3 className="text-sm font-medium">Structure</h3>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Ridge Strength</span>
                            <span className="text-muted-foreground">{params.ridgeStrength.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.ridgeStrength]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { ridgeStrength: v })} min={0} max={1} step={0.05} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Detail Strength</span>
                            <span className="text-muted-foreground">{params.detailStrength.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.detailStrength]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { detailStrength: v })} min={0} max={0.5} step={0.02} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Crack Strength</span>
                            <span className="text-muted-foreground">{params.crackStrength.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.crackStrength]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { crackStrength: v })} min={0} max={0.5} step={0.02} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Crack Scale</span>
                            <span className="text-muted-foreground">{params.crackScale.toFixed(1)}</span>
                          </div>
                          <Slider value={[params.crackScale]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { crackScale: v })} min={2} max={15} step={0.5} />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-border">
                        <h3 className="text-sm font-medium">Appearance</h3>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Contrast</span>
                            <span className="text-muted-foreground">{params.contrast.toFixed(1)}</span>
                          </div>
                          <Slider value={[params.contrast]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { contrast: v })} min={0.5} max={3} step={0.1} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Brightness</span>
                            <span className="text-muted-foreground">{params.brightness.toFixed(2)}</span>
                          </div>
                          <Slider value={[params.brightness]} onValueChange={([v]) => updateSlotParams(editingSlot.type, editingSlot.slotId, { brightness: v })} min={-0.5} max={0.5} step={0.02} />
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-1">
                            <span className="text-xs">Light Color</span>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: params.colorLight }} />
                              <input
                                type="color"
                                value={params.colorLight}
                                onChange={e => updateSlotParams(editingSlot.type, editingSlot.slotId, { colorLight: e.target.value })}
                                className="w-8 h-6 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <span className="text-xs">Dark Color</span>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: params.colorDark }} />
                              <input
                                type="color"
                                value={params.colorDark}
                                onChange={e => updateSlotParams(editingSlot.type, editingSlot.slotId, { colorDark: e.target.value })}
                                className="w-8 h-6 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Reset button */}
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => updateSlotParams(editingSlot.type, editingSlot.slotId, { ...DEFAULT_TEXTURE_PARAMS })}
                    >
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t border-border">
                <Button className="w-full" onClick={() => setEditingSlot(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
  </div>
  )
  }
