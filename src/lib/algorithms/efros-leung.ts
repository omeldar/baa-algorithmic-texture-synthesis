/**
 * Efros-Leung Non-Parametric Texture Synthesis
 * 
 * Reference: Efros & Leung, "Texture Synthesis by Non-parametric Sampling" (SIGGRAPH 1999)
 * 
 * This algorithm synthesizes new textures by sampling pixels from a source texture
 * based on neighborhood similarity. It grows the texture one pixel at a time by:
 * 1. Looking at the neighborhood of the pixel to be filled
 * 2. Finding similar neighborhoods in the source texture
 * 3. Copying the center pixel from a matching neighborhood
 * 
 * @author Eldar Omerovic
 * @thesis Algorithmic Texture Synthesis for Approximating Target Textures
 */

export interface SynthesisOptions {
  /** Size of the neighborhood window (must be odd, e.g., 5, 7, 9) */
  neighborhoodSize: number
  /** Output texture width */
  outputWidth: number
  /** Output texture height */
  outputHeight: number
  /** Error tolerance for matching (0-1, higher = more random) */
  errorTolerance: number
  /** Callback for progress updates (0-1) */
  onProgress?: (progress: number) => void
}

export interface SynthesisResult {
  /** The synthesized texture as ImageData */
  imageData: ImageData
  /** Time taken in milliseconds */
  elapsedTime: number
}

/**
 * Extracts pixel data from an image at (x, y)
 * Returns [r, g, b] values normalized to 0-1
 */
function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number] {
  const idx = (y * width + x) * 4
  return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255]
}

/**
 * Sets a pixel in the image data at (x, y)
 */
function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, r: number, g: number, b: number): void {
  const idx = (y * width + x) * 4
  data[idx] = Math.round(r * 255)
  data[idx + 1] = Math.round(g * 255)
  data[idx + 2] = Math.round(b * 255)
  data[idx + 3] = 255
}

/**
 * Checks if a pixel has been filled (alpha > 0)
 */
function isFilled(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  const idx = (y * width + x) * 4
  return data[idx + 3] > 0
}

/**
 * Computes the Gaussian weight for a given distance from center
 */
function gaussianWeight(dx: number, dy: number, sigma: number): number {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
}

/**
 * Computes the sum of squared differences between two neighborhoods
 * Only considers filled pixels in the output neighborhood
 */
function computeSSD(
  sourceData: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  outputData: Uint8ClampedArray,
  outputWidth: number,
  outputX: number,
  outputY: number,
  sourceX: number,
  sourceY: number,
  halfWindow: number,
  gaussianSigma: number
): { ssd: number; validCount: number } {
  let ssd = 0
  let validCount = 0
  let totalWeight = 0

  for (let dy = -halfWindow; dy <= halfWindow; dy++) {
    for (let dx = -halfWindow; dx <= halfWindow; dx++) {
      // Skip center pixel
      if (dx === 0 && dy === 0) continue

      const outX = outputX + dx
      const outY = outputY + dy
      const srcX = sourceX + dx
      const srcY = sourceY + dy

      // Check bounds
      if (outX < 0 || outX >= outputWidth || outY < 0) continue
      if (srcX < 0 || srcX >= sourceWidth || srcY < 0 || srcY >= sourceHeight) continue

      // Only compare filled pixels
      if (!isFilled(outputData, outputWidth, outX, outY)) continue

      const weight = gaussianWeight(dx, dy, gaussianSigma)
      const [outR, outG, outB] = getPixel(outputData, outputWidth, outX, outY)
      const [srcR, srcG, srcB] = getPixel(sourceData, sourceWidth, srcX, srcY)

      // Weighted sum of squared differences
      const diffR = outR - srcR
      const diffG = outG - srcG
      const diffB = outB - srcB
      ssd += weight * (diffR * diffR + diffG * diffG + diffB * diffB)
      totalWeight += weight
      validCount++
    }
  }

  // Normalize by total weight
  if (totalWeight > 0) {
    ssd /= totalWeight
  }

  return { ssd, validCount }
}

/**
 * Finds all pixels on the boundary of the filled region
 * These are unfilled pixels that have at least one filled neighbor
 */
function findBoundaryPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Array<{ x: number; y: number; filledNeighbors: number }> {
  const boundary: Array<{ x: number; y: number; filledNeighbors: number }> = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFilled(data, width, x, y)) continue

      // Count filled neighbors
      let filledNeighbors = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (isFilled(data, width, nx, ny)) {
              filledNeighbors++
            }
          }
        }
      }

      if (filledNeighbors > 0) {
        boundary.push({ x, y, filledNeighbors })
      }
    }
  }

  // Sort by number of filled neighbors (descending) for better quality
  boundary.sort((a, b) => b.filledNeighbors - a.filledNeighbors)

  return boundary
}

/**
 * Main Efros-Leung texture synthesis algorithm
 */
export async function synthesizeTexture(
  sourceImageData: ImageData,
  options: SynthesisOptions
): Promise<SynthesisResult> {
  const startTime = performance.now()

  const {
    neighborhoodSize,
    outputWidth,
    outputHeight,
    errorTolerance,
    onProgress,
  } = options

  const halfWindow = Math.floor(neighborhoodSize / 2)
  const gaussianSigma = neighborhoodSize / 6.4 // Standard Gaussian sigma

  const sourceData = sourceImageData.data
  const sourceWidth = sourceImageData.width
  const sourceHeight = sourceImageData.height

  // Create output image (initialized with transparent pixels)
  const outputCanvas = document.createElement("canvas")
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight
  const outputCtx = outputCanvas.getContext("2d")!
  const outputImageData = outputCtx.createImageData(outputWidth, outputHeight)
  const outputData = outputImageData.data

  // Seed the output with a small patch from the source (center)
  const seedSize = Math.min(3, Math.floor(neighborhoodSize / 2))
  const seedStartX = Math.floor(sourceWidth / 2) - seedSize
  const seedStartY = Math.floor(sourceHeight / 2) - seedSize
  const outSeedX = Math.floor(outputWidth / 2) - seedSize
  const outSeedY = Math.floor(outputHeight / 2) - seedSize

  for (let dy = 0; dy < seedSize * 2; dy++) {
    for (let dx = 0; dx < seedSize * 2; dx++) {
      const srcX = seedStartX + dx
      const srcY = seedStartY + dy
      const outX = outSeedX + dx
      const outY = outSeedY + dy

      if (srcX >= 0 && srcX < sourceWidth && srcY >= 0 && srcY < sourceHeight) {
        if (outX >= 0 && outX < outputWidth && outY >= 0 && outY < outputHeight) {
          const [r, g, b] = getPixel(sourceData, sourceWidth, srcX, srcY)
          setPixel(outputData, outputWidth, outX, outY, r, g, b)
        }
      }
    }
  }

  // Total pixels to fill
  const totalPixels = outputWidth * outputHeight
  let filledPixels = seedSize * seedSize * 4
  let lastProgressReport = 0

  // Main synthesis loop
  while (true) {
    // Find boundary pixels
    const boundary = findBoundaryPixels(outputData, outputWidth, outputHeight)
    if (boundary.length === 0) break

    // Process a batch of boundary pixels
    const batchSize = Math.min(boundary.length, 100)

    for (let i = 0; i < batchSize; i++) {
      const { x: pixelX, y: pixelY } = boundary[i]

      // Skip if already filled (might have been filled in this batch)
      if (isFilled(outputData, outputWidth, pixelX, pixelY)) continue

      // Find best matching pixel in source
      let bestMatches: Array<{ x: number; y: number; ssd: number }> = []
      let minSSD = Infinity

      // Scan all valid positions in source
      for (let srcY = halfWindow; srcY < sourceHeight - halfWindow; srcY++) {
        for (let srcX = halfWindow; srcX < sourceWidth - halfWindow; srcX++) {
          const { ssd, validCount } = computeSSD(
            sourceData, sourceWidth, sourceHeight,
            outputData, outputWidth,
            pixelX, pixelY,
            srcX, srcY,
            halfWindow, gaussianSigma
          )

          // Need at least some valid neighbors to compare
          if (validCount < 1) continue

          if (ssd < minSSD) {
            minSSD = ssd
            bestMatches = [{ x: srcX, y: srcY, ssd }]
          } else if (ssd <= minSSD * (1 + errorTolerance)) {
            bestMatches.push({ x: srcX, y: srcY, ssd })
          }
        }
      }

      // Randomly select from best matches
      if (bestMatches.length > 0) {
        const match = bestMatches[Math.floor(Math.random() * bestMatches.length)]
        const [r, g, b] = getPixel(sourceData, sourceWidth, match.x, match.y)
        setPixel(outputData, outputWidth, pixelX, pixelY, r, g, b)
        filledPixels++
      }
    }

    // Report progress
    const progress = filledPixels / totalPixels
    if (onProgress && progress - lastProgressReport >= 0.01) {
      onProgress(progress)
      lastProgressReport = progress
      // Yield to UI thread
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  // Fill any remaining unfilled pixels with random source pixels
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      if (!isFilled(outputData, outputWidth, x, y)) {
        const srcX = Math.floor(Math.random() * sourceWidth)
        const srcY = Math.floor(Math.random() * sourceHeight)
        const [r, g, b] = getPixel(sourceData, sourceWidth, srcX, srcY)
        setPixel(outputData, outputWidth, x, y, r, g, b)
      }
    }
  }

  if (onProgress) onProgress(1)

  return {
    imageData: outputImageData,
    elapsedTime: performance.now() - startTime,
  }
}

/**
 * Resizes an image to fit within max dimensions while preserving aspect ratio
 */
export function resizeImageIfNeeded(
  imageData: ImageData,
  maxWidth: number,
  maxHeight: number
): ImageData {
  const { width, height } = imageData

  if (width <= maxWidth && height <= maxHeight) {
    return imageData
  }

  const scale = Math.min(maxWidth / width, maxHeight / height)
  const newWidth = Math.floor(width * scale)
  const newHeight = Math.floor(height * scale)

  // Create temporary canvas for resizing
  const srcCanvas = document.createElement("canvas")
  srcCanvas.width = width
  srcCanvas.height = height
  const srcCtx = srcCanvas.getContext("2d")!
  srcCtx.putImageData(imageData, 0, 0)

  const dstCanvas = document.createElement("canvas")
  dstCanvas.width = newWidth
  dstCanvas.height = newHeight
  const dstCtx = dstCanvas.getContext("2d")!
  dstCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight)

  return dstCtx.getImageData(0, 0, newWidth, newHeight)
}
