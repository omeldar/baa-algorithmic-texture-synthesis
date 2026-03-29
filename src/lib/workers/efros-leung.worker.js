/**
 * Efros-Leung Texture Synthesis Web Worker
 * 
 * Runs the computationally expensive synthesis algorithm off the main thread
 * to prevent UI blocking and lag.
 */

// Get pixel value at (x, y) with boundary handling
function getPixel(data, width, height, x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return null
  }
  const idx = (y * width + x) * 4
  return [data[idx], data[idx + 1], data[idx + 2]]
}

// Set pixel value at (x, y)
function setPixel(data, width, x, y, r, g, b) {
  const idx = (y * width + x) * 4
  data[idx] = r
  data[idx + 1] = g
  data[idx + 2] = b
  data[idx + 3] = 255
}

// Check if pixel has been filled
function isFilled(filled, width, x, y) {
  return filled[y * width + x]
}

// Get neighborhood around a pixel
function getNeighborhood(data, filled, width, height, cx, cy, size) {
  const half = Math.floor(size / 2)
  const values = []
  let validCount = 0

  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      if (dx === 0 && dy === 0) {
        values.push(null) // Center pixel (the one we're synthesizing)
        continue
      }

      const nx = cx + dx
      const ny = cy + dy

      // For output image, check if pixel is filled
      if (filled !== null) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || !isFilled(filled, width, nx, ny)) {
          values.push(null)
          continue
        }
      }

      const pixel = getPixel(data, width, height, nx, ny)
      if (pixel) {
        values.push(pixel)
        validCount++
      } else {
        values.push(null)
      }
    }
  }

  return { values, validCount }
}

// Calculate SSD between two neighborhoods (only comparing valid pixels)
function neighborhoodSSD(n1, n2) {
  let ssd = 0
  let count = 0

  for (let i = 0; i < n1.length; i++) {
    if (n1[i] !== null && n2[i] !== null) {
      const p1 = n1[i]
      const p2 = n2[i]
      ssd += (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2
      count++
    }
  }

  return count > 0 ? ssd / count : Infinity
}

// Find best matching pixel from source
function findBestMatch(sourceData, sourceWidth, sourceHeight, targetNeighborhood, neighborhoodSize, errorTolerance) {
  const half = Math.floor(neighborhoodSize / 2)
  let bestMatches = []
  let minError = Infinity

  // Search all pixels in source image
  for (let sy = half; sy < sourceHeight - half; sy++) {
    for (let sx = half; sx < sourceWidth - half; sx++) {
      const sourceNeighborhood = getNeighborhood(
        sourceData, null, sourceWidth, sourceHeight, sx, sy, neighborhoodSize
      )

      const error = neighborhoodSSD(targetNeighborhood, sourceNeighborhood.values)

      if (error < minError) {
        minError = error
        bestMatches = [{ pixel: getPixel(sourceData, sourceWidth, sourceHeight, sx, sy), error }]
      } else if (error <= minError * (1 + errorTolerance)) {
        bestMatches.push({ pixel: getPixel(sourceData, sourceWidth, sourceHeight, sx, sy), error })
      }
    }
  }

  // Randomly select from best matches
  if (bestMatches.length > 0) {
    const idx = Math.floor(Math.random() * Math.min(bestMatches.length, 10))
    return bestMatches[idx].pixel
  }

  // Fallback: random pixel from source
  const rx = Math.floor(Math.random() * sourceWidth)
  const ry = Math.floor(Math.random() * sourceHeight)
  return getPixel(sourceData, sourceWidth, sourceHeight, rx, ry) || [128, 128, 128]
}

// Get pixels at boundary of filled region
function getBoundaryPixels(filled, width, height) {
  const boundary = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFilled(filled, width, x, y)) {
        // Check if any neighbor is filled
        const hasFilledNeighbor =
          (x > 0 && isFilled(filled, width, x - 1, y)) ||
          (x < width - 1 && isFilled(filled, width, x + 1, y)) ||
          (y > 0 && isFilled(filled, width, x, y - 1)) ||
          (y < height - 1 && isFilled(filled, width, x, y + 1))

        if (hasFilledNeighbor) {
          boundary.push([x, y])
        }
      }
    }
  }

  return boundary
}

// Main synthesis function
function synthesize(sourceData, outputWidth, outputHeight, neighborhoodSize, errorTolerance, onProgress) {
  const sourceWidth = sourceData.width
  const sourceHeight = sourceData.height

  // Create output image
  const outputData = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  const filled = new Array(outputWidth * outputHeight).fill(false)

  // Seed with a small patch from center of source
  const seedSize = Math.min(3, Math.floor(neighborhoodSize / 2))
  const startX = Math.floor(outputWidth / 2) - Math.floor(seedSize / 2)
  const startY = Math.floor(outputHeight / 2) - Math.floor(seedSize / 2)
  const srcStartX = Math.floor(sourceWidth / 2) - Math.floor(seedSize / 2)
  const srcStartY = Math.floor(sourceHeight / 2) - Math.floor(seedSize / 2)

  for (let dy = 0; dy < seedSize; dy++) {
    for (let dx = 0; dx < seedSize; dx++) {
      const pixel = getPixel(sourceData.data, sourceWidth, sourceHeight, srcStartX + dx, srcStartY + dy)
      if (pixel) {
        setPixel(outputData, outputWidth, startX + dx, startY + dy, pixel[0], pixel[1], pixel[2])
        filled[(startY + dy) * outputWidth + (startX + dx)] = true
      }
    }
  }

  const totalPixels = outputWidth * outputHeight
  let filledCount = seedSize * seedSize
  let lastProgressUpdate = 0

  // Grow texture pixel by pixel
  while (filledCount < totalPixels) {
    const boundary = getBoundaryPixels(filled, outputWidth, outputHeight)

    if (boundary.length === 0) break

    // Process boundary pixels (could randomize order for variety)
    for (const [x, y] of boundary) {
      if (isFilled(filled, outputWidth, x, y)) continue

      // Get neighborhood of current pixel
      const targetNeighborhood = getNeighborhood(
        outputData, filled, outputWidth, outputHeight, x, y, neighborhoodSize
      )

      // Find best match from source
      const bestPixel = findBestMatch(
        sourceData.data, sourceWidth, sourceHeight,
        targetNeighborhood.values, neighborhoodSize, errorTolerance
      )

      // Set pixel
      setPixel(outputData, outputWidth, x, y, bestPixel[0], bestPixel[1], bestPixel[2])
      filled[y * outputWidth + x] = true
      filledCount++

      // Report progress periodically
      const percent = Math.floor((filledCount / totalPixels) * 100)
      if (percent > lastProgressUpdate) {
        lastProgressUpdate = percent
        // Send intermediate result every 10%
        if (percent % 10 === 0) {
          const intermediateData = new ImageData(
            new Uint8ClampedArray(outputData),
            outputWidth,
            outputHeight
          )
          onProgress(percent, intermediateData)
        } else {
          onProgress(percent)
        }
      }
    }
  }

  return new ImageData(outputData, outputWidth, outputHeight)
}

// Worker message handler
self.onmessage = (e) => {
  if (e.data.type === 'start') {
    try {
      // Validate input
      if (!e.data.sourceData || !e.data.sourceData.data) {
        throw new Error('Invalid source data')
      }

      const result = synthesize(
        e.data.sourceData,
        e.data.outputWidth,
        e.data.outputHeight,
        e.data.neighborhoodSize,
        e.data.errorTolerance,
        (percent, imageData) => {
          self.postMessage({ type: 'progress', percent, imageData })
        }
      )

      self.postMessage({ type: 'complete', imageData: result })
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message || String(error) })
    }
  }
}
