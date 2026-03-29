/**
 * Image Quilting Texture Synthesis Web Worker
 * Efros-Freeman (SIGGRAPH 2001) patch-based texture synthesis.
 */

// Get pixel value at (x, y)
function getPixel(data, width, x, y) {
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

// Extract a patch from image at position (sx, sy)
function extractPatch(data, width, height, sx, sy, patchSize) {
  const patch = new Uint8ClampedArray(patchSize * patchSize * 4)
  
  for (let y = 0; y < patchSize; y++) {
    for (let x = 0; x < patchSize; x++) {
      const srcX = Math.min(sx + x, width - 1)
      const srcY = Math.min(sy + y, height - 1)
      const [r, g, b] = getPixel(data, width, srcX, srcY)
      
      const idx = (y * patchSize + x) * 4
      patch[idx] = r
      patch[idx + 1] = g
      patch[idx + 2] = b
      patch[idx + 3] = 255
    }
  }
  
  return patch
}

// Calculate SSD between two overlap regions
function overlapSSD(patch, patchSize, output, outputWidth, outX, outY, overlapX, overlapY) {
  let ssd = 0
  
  // Left overlap (vertical strip)
  if (overlapX > 0) {
    for (let y = 0; y < patchSize; y++) {
      for (let x = 0; x < overlapX; x++) {
        const patchIdx = (y * patchSize + x) * 4
        const outIdx = ((outY + y) * outputWidth + (outX + x)) * 4
        
        const dr = patch[patchIdx] - output[outIdx]
        const dg = patch[patchIdx + 1] - output[outIdx + 1]
        const db = patch[patchIdx + 2] - output[outIdx + 2]
        
        ssd += dr * dr + dg * dg + db * db
      }
    }
  }
  
  // Top overlap (horizontal strip, excluding already counted corner)
  if (overlapY > 0) {
    for (let y = 0; y < overlapY; y++) {
      for (let x = overlapX; x < patchSize; x++) {
        const patchIdx = (y * patchSize + x) * 4
        const outIdx = ((outY + y) * outputWidth + (outX + x)) * 4
        
        const dr = patch[patchIdx] - output[outIdx]
        const dg = patch[patchIdx + 1] - output[outIdx + 1]
        const db = patch[patchIdx + 2] - output[outIdx + 2]
        
        ssd += dr * dr + dg * dg + db * db
      }
    }
  }
  
  return ssd
}

// Find minimum error boundary cut using dynamic programming
function findMinCut(patch, patchSize, output, outputWidth, outX, outY, overlapX, overlapY) {
  const mask = Array(patchSize).fill(null).map(() => Array(patchSize).fill(true))
  
  // Compute vertical seam for left overlap
  if (overlapX > 0) {
    const errors = []
    for (let y = 0; y < patchSize; y++) {
      errors[y] = []
      for (let x = 0; x < overlapX; x++) {
        const patchIdx = (y * patchSize + x) * 4
        const outIdx = ((outY + y) * outputWidth + (outX + x)) * 4
        
        const dr = patch[patchIdx] - output[outIdx]
        const dg = patch[patchIdx + 1] - output[outIdx + 1]
        const db = patch[patchIdx + 2] - output[outIdx + 2]
        
        errors[y][x] = dr * dr + dg * dg + db * db
      }
    }
    
    const cumError = Array(patchSize).fill(null).map(() => Array(overlapX).fill(0))
    
    for (let x = 0; x < overlapX; x++) {
      cumError[0][x] = errors[0][x]
    }
    
    for (let y = 1; y < patchSize; y++) {
      for (let x = 0; x < overlapX; x++) {
        const left = x > 0 ? cumError[y - 1][x - 1] : Infinity
        const up = cumError[y - 1][x]
        const right = x < overlapX - 1 ? cumError[y - 1][x + 1] : Infinity
        
        cumError[y][x] = errors[y][x] + Math.min(left, up, right)
      }
    }
    
    const seam = Array(patchSize)
    
    let minX = 0
    let minVal = cumError[patchSize - 1][0]
    for (let x = 1; x < overlapX; x++) {
      if (cumError[patchSize - 1][x] < minVal) {
        minVal = cumError[patchSize - 1][x]
        minX = x
      }
    }
    seam[patchSize - 1] = minX
    
    for (let y = patchSize - 2; y >= 0; y--) {
      const x = seam[y + 1]
      const left = x > 0 ? cumError[y][x - 1] : Infinity
      const up = cumError[y][x]
      const right = x < overlapX - 1 ? cumError[y][x + 1] : Infinity
      
      const minErr = Math.min(left, up, right)
      if (minErr === left) seam[y] = x - 1
      else if (minErr === up) seam[y] = x
      else seam[y] = x + 1
    }
    
    for (let y = 0; y < patchSize; y++) {
      for (let x = 0; x < seam[y]; x++) {
        mask[y][x] = false
      }
    }
  }
  
  // Compute horizontal seam for top overlap
  if (overlapY > 0) {
    const errors = []
    for (let y = 0; y < overlapY; y++) {
      errors[y] = []
      for (let x = 0; x < patchSize; x++) {
        const patchIdx = (y * patchSize + x) * 4
        const outIdx = ((outY + y) * outputWidth + (outX + x)) * 4
        
        const dr = patch[patchIdx] - output[outIdx]
        const dg = patch[patchIdx + 1] - output[outIdx + 1]
        const db = patch[patchIdx + 2] - output[outIdx + 2]
        
        errors[y][x] = dr * dr + dg * dg + db * db
      }
    }
    
    const cumError = Array(overlapY).fill(null).map(() => Array(patchSize).fill(0))
    
    for (let y = 0; y < overlapY; y++) {
      cumError[y][0] = errors[y][0]
    }
    
    for (let x = 1; x < patchSize; x++) {
      for (let y = 0; y < overlapY; y++) {
        const top = y > 0 ? cumError[y - 1][x - 1] : Infinity
        const left = cumError[y][x - 1]
        const bottom = y < overlapY - 1 ? cumError[y + 1][x - 1] : Infinity
        
        cumError[y][x] = errors[y][x] + Math.min(top, left, bottom)
      }
    }
    
    const seam = Array(patchSize)
    let minY = 0
    let minVal = cumError[0][patchSize - 1]
    for (let y = 1; y < overlapY; y++) {
      if (cumError[y][patchSize - 1] < minVal) {
        minVal = cumError[y][patchSize - 1]
        minY = y
      }
    }
    seam[patchSize - 1] = minY
    
    for (let x = patchSize - 2; x >= 0; x--) {
      const y = seam[x + 1]
      const top = y > 0 ? cumError[y - 1][x] : Infinity
      const left = cumError[y][x]
      const bottom = y < overlapY - 1 ? cumError[y + 1][x] : Infinity
      
      const minErr = Math.min(top, left, bottom)
      if (minErr === top) seam[x] = y - 1
      else if (minErr === left) seam[x] = y
      else seam[x] = y + 1
    }
    
    for (let x = 0; x < patchSize; x++) {
      for (let y = 0; y < seam[x]; y++) {
        mask[y][x] = false
      }
    }
  }
  
  return mask
}

// Place patch on output using minimum boundary cut
function placePatch(patch, patchSize, output, outputWidth, outputHeight, outX, outY, overlapX, overlapY) {
  const mask = findMinCut(patch, patchSize, output, outputWidth, outX, outY, overlapX, overlapY)
  
  for (let y = 0; y < patchSize; y++) {
    for (let x = 0; x < patchSize; x++) {
      const destX = outX + x
      const destY = outY + y
      
      if (destX >= outputWidth || destY >= outputHeight) continue
      
      const inOverlap = (overlapX > 0 && x < overlapX) || (overlapY > 0 && y < overlapY)
      
      if (!inOverlap || mask[y][x]) {
        const patchIdx = (y * patchSize + x) * 4
        setPixel(output, outputWidth, destX, destY, patch[patchIdx], patch[patchIdx + 1], patch[patchIdx + 2])
      }
    }
  }
}

// Find best matching patch from source
function findBestPatch(sourceData, sourceWidth, sourceHeight, output, outputWidth, outX, outY, patchSize, overlapX, overlapY, errorTolerance) {
  const candidates = []
  let minError = Infinity
  
  const stepSize = Math.max(1, Math.floor(patchSize / 4))
  
  for (let sy = 0; sy <= sourceHeight - patchSize; sy += stepSize) {
    for (let sx = 0; sx <= sourceWidth - patchSize; sx += stepSize) {
      const patch = extractPatch(sourceData, sourceWidth, sourceHeight, sx, sy, patchSize)
      const error = overlapSSD(patch, patchSize, output, outputWidth, outX, outY, overlapX, overlapY)
      
      if (error < minError) {
        minError = error
        candidates.length = 0
        candidates.push({ patch, error })
      } else if (error <= minError * (1 + errorTolerance)) {
        candidates.push({ patch, error })
      }
    }
  }
  
  if (candidates.length > 0) {
    const idx = Math.floor(Math.random() * Math.min(candidates.length, 5))
    return candidates[idx].patch
  }
  
  const rx = Math.floor(Math.random() * (sourceWidth - patchSize))
  const ry = Math.floor(Math.random() * (sourceHeight - patchSize))
  return extractPatch(sourceData, sourceWidth, sourceHeight, rx, ry, patchSize)
}

// Main quilting function
function quilt(sourceData, outputWidth, outputHeight, patchSize, overlapSize, errorTolerance, onProgress) {
  const sourceWidth = sourceData.width
  const sourceHeight = sourceData.height
  
  const effectivePatchSize = Math.min(patchSize, sourceWidth, sourceHeight)
  const effectiveOverlap = Math.min(overlapSize, Math.floor(effectivePatchSize / 3))
  
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  for (let i = 0; i < output.length; i += 4) {
    output[i + 3] = 255
  }
  
  const step = effectivePatchSize - effectiveOverlap
  const numX = Math.ceil(outputWidth / step)
  const numY = Math.ceil(outputHeight / step)
  const totalPatches = numX * numY
  let patchCount = 0
  
  for (let gy = 0; gy < numY; gy++) {
    for (let gx = 0; gx < numX; gx++) {
      const outX = gx * step
      const outY = gy * step
      
      const overlapX = gx > 0 ? effectiveOverlap : 0
      const overlapY = gy > 0 ? effectiveOverlap : 0
      
      let patch
      
      if (gx === 0 && gy === 0) {
        const rx = Math.floor(Math.random() * Math.max(1, sourceWidth - effectivePatchSize))
        const ry = Math.floor(Math.random() * Math.max(1, sourceHeight - effectivePatchSize))
        patch = extractPatch(sourceData.data, sourceWidth, sourceHeight, rx, ry, effectivePatchSize)
        
        for (let y = 0; y < effectivePatchSize; y++) {
          for (let x = 0; x < effectivePatchSize; x++) {
            if (outX + x < outputWidth && outY + y < outputHeight) {
              const patchIdx = (y * effectivePatchSize + x) * 4
              setPixel(output, outputWidth, outX + x, outY + y, patch[patchIdx], patch[patchIdx + 1], patch[patchIdx + 2])
            }
          }
        }
      } else {
        patch = findBestPatch(
          sourceData.data, sourceWidth, sourceHeight,
          output, outputWidth, outX, outY,
          effectivePatchSize, overlapX, overlapY, errorTolerance
        )
        
        placePatch(patch, effectivePatchSize, output, outputWidth, outputHeight, outX, outY, overlapX, overlapY)
      }
      
      patchCount++
      const percent = Math.floor((patchCount / totalPatches) * 100)
      
      if (patchCount % 5 === 0 || patchCount === totalPatches) {
        const intermediateData = new ImageData(
          new Uint8ClampedArray(output),
          outputWidth,
          outputHeight
        )
        onProgress(percent, intermediateData)
      }
    }
  }
  
  return new ImageData(output, outputWidth, outputHeight)
}

// Worker message handler
self.onmessage = function(e) {
  if (e.data.type === 'start') {
    try {
      if (!e.data.sourceData || !e.data.sourceData.data || !e.data.sourceData.width || !e.data.sourceData.height) {
        throw new Error('Invalid source data: missing data, width, or height')
      }
      
      if (e.data.patchSize <= 0) {
        throw new Error('Invalid patchSize: ' + e.data.patchSize)
      }
      
      if (e.data.overlapSize < 0 || e.data.overlapSize >= e.data.patchSize) {
        throw new Error('Invalid overlapSize: ' + e.data.overlapSize + ' (must be 0 to ' + (e.data.patchSize - 1) + ')')
      }
      
      if (e.data.sourceData.width < e.data.patchSize || e.data.sourceData.height < e.data.patchSize) {
        throw new Error('Source image (' + e.data.sourceData.width + 'x' + e.data.sourceData.height + ') is smaller than patch size (' + e.data.patchSize + ')')
      }

      const result = quilt(
        e.data.sourceData,
        e.data.outputWidth,
        e.data.outputHeight,
        e.data.patchSize,
        e.data.overlapSize,
        e.data.errorTolerance,
        function(percent, imageData) {
          self.postMessage({ type: 'progress', percent: percent, imageData: imageData })
        }
      )

      self.postMessage({ type: 'complete', imageData: result })
    } catch (error) {
      self.postMessage({ type: 'error', message: 'Image Quilting failed: ' + (error.message || String(error)) })
    }
  }
}
