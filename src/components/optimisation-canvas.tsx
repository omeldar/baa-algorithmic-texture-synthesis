"use client"

import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Play, Square, Download } from "lucide-react"
import { toast } from "sonner"
import { getTextureGenerator } from "@/lib/webgpu-texture-generator"
import { getTextureDefinition, getDefaultParams, type TextureType } from "@/lib/texture-types"

const MAX_INPUT_SIZE = 128

export interface OptimisationCanvasRef {
  exportTexture: () => Promise<Blob | null>
}

interface OptimisationCanvasProps {
  params: Record<string, number | boolean | string>
}

interface ImageStats {
  mean: number
  variance: number
  gradientX: number
  gradientY: number
  edgeDensity: number
  histogram: number[]
}

// Compute image statistics for comparison
function computeImageStats(imageData: ImageData): ImageStats {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  const pixels = width * height
  
  let sum = 0
  const grayscale: number[] = []
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    grayscale.push(gray)
    sum += gray
  }
  
  const mean = sum / pixels
  
  let variance = 0
  for (const g of grayscale) {
    variance += (g - mean) ** 2
  }
  variance /= pixels
  
  // Compute gradients
  let gradX = 0, gradY = 0, edgeCount = 0
  const edgeThreshold = 20
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const gx = grayscale[idx + 1] - grayscale[idx - 1]
      const gy = grayscale[idx + width] - grayscale[idx - width]
      gradX += Math.abs(gx)
      gradY += Math.abs(gy)
      if (Math.sqrt(gx * gx + gy * gy) > edgeThreshold) edgeCount++
    }
  }
  
  const gradTotal = gradX + gradY + 0.001
  
  // 8-bin histogram
  const histogram = new Array(8).fill(0)
  for (const g of grayscale) {
    const bin = Math.min(7, Math.floor(g / 32))
    histogram[bin]++
  }
  for (let i = 0; i < 8; i++) {
    histogram[i] /= pixels
  }
  
  return {
    mean: mean / 255,
    variance: variance / (255 * 255),
    gradientX: gradX / gradTotal,
    gradientY: gradY / gradTotal,
    edgeDensity: edgeCount / pixels,
    histogram,
  }
}

// Compare two image stats
function compareStats(a: ImageStats, b: ImageStats): number {
  const meanDiff = Math.abs(a.mean - b.mean)
  const varDiff = Math.abs(a.variance - b.variance)
  const dirDiff = Math.abs(a.gradientY - b.gradientY)
  const edgeDiff = Math.abs(a.edgeDensity - b.edgeDensity)
  
  let histDiff = 0
  for (let i = 0; i < 8; i++) {
    histDiff += Math.min(a.histogram[i], b.histogram[i])
  }
  
  const similarity =
    (1 - meanDiff) * 0.15 +
    (1 - varDiff) * 0.15 +
    (1 - dirDiff) * 0.35 +
    (1 - edgeDiff) * 0.2 +
    histDiff * 0.15
  
  return Math.max(0, Math.min(1, similarity))
}

// Per-metric similarity breakdown (each term already in [0,1], higher is better).
// Same weighting as compareStats() — the weighted sum equals the total similarity.
interface SimilarityComponents {
  mean: number
  variance: number
  gradientDir: number
  edgeDensity: number
  histogram: number
}
function compareStatsComponents(a: ImageStats, b: ImageStats): SimilarityComponents {
  let histDiff = 0
  for (let i = 0; i < 8; i++) {
    histDiff += Math.min(a.histogram[i], b.histogram[i])
  }
  return {
    mean: 1 - Math.abs(a.mean - b.mean),
    variance: 1 - Math.abs(a.variance - b.variance),
    gradientDir: 1 - Math.abs(a.gradientY - b.gradientY),
    edgeDensity: 1 - Math.abs(a.edgeDensity - b.edgeDensity),
    histogram: histDiff,
  }
}

// One row of the convergence log — recorded once per generation for thesis graphs.
interface GenerationStats {
  generation: number // 1-based generation index
  evaluations: number // cumulative candidate textures evaluated up to & incl. this generation
  elapsedMs: number // ms since the optimization loop started
  bestFitness: number // best similarity in this generation's population
  bestEverFitness: number // running best similarity up to this generation
  meanFitness: number // population mean similarity
  worstFitness: number // population min similarity
  stdFitness: number // population standard deviation of similarity
  mutationRate: number // adaptive mutation rate in effect this generation
  // Component breakdown of the best individual this generation (all higher-is-better)
  compMean: number
  compVariance: number
  compGradientDir: number
  compEdgeDensity: number
  compHistogram: number
}

// Extract dominant colors from image
function extractDominantColors(imageData: ImageData): { light: string; dark: string } {
  const data = imageData.data
  const pixels: Array<{ r: number; g: number; b: number; lum: number }> = []
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    pixels.push({ r, g, b, lum })
  }
  
  pixels.sort((a, b) => a.lum - b.lum)
  
  const n = Math.floor(pixels.length * 0.2)
  const darkAvg = { r: 0, g: 0, b: 0 }
  const lightAvg = { r: 0, g: 0, b: 0 }
  
  for (let i = 0; i < n; i++) {
    darkAvg.r += pixels[i].r
    darkAvg.g += pixels[i].g
    darkAvg.b += pixels[i].b
    lightAvg.r += pixels[pixels.length - 1 - i].r
    lightAvg.g += pixels[pixels.length - 1 - i].g
    lightAvg.b += pixels[pixels.length - 1 - i].b
  }
  
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0")
  
  return {
    dark: `#${toHex(darkAvg.r)}${toHex(darkAvg.g)}${toHex(darkAvg.b)}`,
    light: `#${toHex(lightAvg.r)}${toHex(lightAvg.g)}${toHex(lightAvg.b)}`,
  }
}

export const OptimisationCanvas = forwardRef<OptimisationCanvasRef, OptimisationCanvasProps>(
  function OptimisationCanvas({ params = {} }, ref) {
    const [sourceImage, setSourceImage] = useState<ImageData | null>(null)
    const [sourcePreview, setSourcePreview] = useState<string | null>(null)
    const [resultImage, setResultImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [currentIteration, setCurrentIteration] = useState(0)
    const [currentSimilarity, setCurrentSimilarity] = useState(0)
    const [bestParams, setBestParams] = useState<Record<string, number | boolean | string> | null>(null)
    const [elapsedTime, setElapsedTime] = useState<number | null>(null)
    // Per-generation convergence log for thesis evaluation export (CSV).
    const [genStats, setGenStats] = useState<GenerationStats[]>([])
    const [totalEvaluations, setTotalEvaluations] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const stopRef = useRef(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const referenceStatsRef = useRef<ImageStats | null>(null)
    const extractedColorsRef = useRef<{ light: string; dark: string } | null>(null)

    // Extract params
    const baseAlgorithm = (String(params.baseAlgorithm) || "wood") as TextureType
    const maxIterations = Number(params.maxIterations) || 200
    const populationSize = Number(params.populationSize) || 20
    const mutationRate = Number(params.mutationRate) || 0.15
    const outputSize = Number(params.outputSize) || 128

    useImperativeHandle(ref, () => ({
      exportTexture: async () => {
        if (!resultImage) return null
        const response = await fetch(resultImage)
        return response.blob()
      }
    }))

    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const size = Math.min(img.width, img.height, MAX_INPUT_SIZE)
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, size, size)
        
        const imageData = ctx.getImageData(0, 0, size, size)
        setSourceImage(imageData)
        setSourcePreview(canvas.toDataURL())
        
        // Compute stats and extract colors
        referenceStatsRef.current = computeImageStats(imageData)
        extractedColorsRef.current = extractDominantColors(imageData)
        
        // Reset result
        setResultImage(null)
        setBestParams(null)
        setElapsedTime(null)
        setCurrentSimilarity(0)
        setGenStats([])
        setTotalEvaluations(0)
        
        URL.revokeObjectURL(img.src)
        toast.success("Reference image loaded")
      }
      
      img.onerror = () => toast.error("Failed to load image")
      img.src = URL.createObjectURL(file)
    }, [])

    const handleOptimize = useCallback(async () => {
      if (!sourceImage || !referenceStatsRef.current) {
        toast.error("Please upload a reference image first")
        return
      }

      setIsProcessing(true)
      setProgress(0)
      setCurrentIteration(0)
      stopRef.current = false
      const startTime = Date.now()

      // Convergence log accumulated locally then flushed to state on completion.
      const genLog: GenerationStats[] = []
      let evaluationCount = 0
      setGenStats([])
      setTotalEvaluations(0)

      try {
        const generator = getTextureGenerator()
        const baseDef = getTextureDefinition(baseAlgorithm)
        const baseParams = getDefaultParams(baseDef)
        
        // Filter to numeric params only for optimization
        const numericParams = baseDef.parameters.filter(p => p.type === "slider")
        
        // Initialize population
        type Individual = { params: Record<string, number | boolean | string>; fitness: number }
        const population: Individual[] = []
        
        // Create initial population with extracted colors if applicable
        for (let i = 0; i < populationSize; i++) {
          const individual: Record<string, number | boolean | string> = { ...baseParams }
          
          // Randomize numeric parameters
          for (const param of numericParams) {
            const range = (param.max || 1) - (param.min || 0)
            individual[param.id] = (param.min || 0) + Math.random() * range
          }
          
          // Use extracted colors if available
          if (extractedColorsRef.current) {
            if ("colorLight" in individual) individual.colorLight = extractedColorsRef.current.light
            if ("colorDark" in individual) individual.colorDark = extractedColorsRef.current.dark
          }
          
          population.push({ params: individual, fitness: 0 })
        }

        let bestEver: Individual = { params: { ...baseParams }, fitness: 0 }
        let stagnantCount = 0
        let currentMutationRate = mutationRate

        for (let iter = 0; iter < maxIterations && !stopRef.current; iter++) {
          // Evaluate fitness for each individual. Track the best individual's component
          // breakdown so it can be logged for this generation.
          let genBestComponents: SimilarityComponents | null = null
          let genBestFitness = -1
          for (const individual of population) {
            const result = await generator.generate(baseAlgorithm, individual.params, outputSize)
            evaluationCount++
            if (result) {
              const stats = computeImageStats(result.imageData)
              individual.fitness = compareStats(referenceStatsRef.current!, stats)
              if (individual.fitness > genBestFitness) {
                genBestFitness = individual.fitness
                genBestComponents = compareStatsComponents(referenceStatsRef.current!, stats)
              }
            }
          }

          // Sort by fitness (descending)
          population.sort((a, b) => b.fitness - a.fitness)

          // Update best ever
          if (population[0].fitness > bestEver.fitness) {
            bestEver = { params: { ...population[0].params }, fitness: population[0].fitness }
            stagnantCount = 0
          } else {
            stagnantCount++
            // Increase mutation rate if stagnant
            if (stagnantCount > 10) {
              currentMutationRate = Math.min(0.5, currentMutationRate * 1.1)
            }
          }

          // Record per-generation statistics for the convergence log.
          const fitnessValues = population.map(p => p.fitness)
          const meanFitness = fitnessValues.reduce((s, v) => s + v, 0) / fitnessValues.length
          const stdFitness = Math.sqrt(
            fitnessValues.reduce((s, v) => s + (v - meanFitness) ** 2, 0) / fitnessValues.length
          )
          const comp = genBestComponents ?? { mean: 0, variance: 0, gradientDir: 0, edgeDensity: 0, histogram: 0 }
          genLog.push({
            generation: iter + 1,
            evaluations: evaluationCount,
            elapsedMs: Date.now() - startTime,
            bestFitness: population[0].fitness,
            bestEverFitness: bestEver.fitness,
            meanFitness,
            worstFitness: fitnessValues[fitnessValues.length - 1],
            stdFitness,
            mutationRate: currentMutationRate,
            compMean: comp.mean,
            compVariance: comp.variance,
            compGradientDir: comp.gradientDir,
            compEdgeDensity: comp.edgeDensity,
            compHistogram: comp.histogram,
          })

          // Update UI
          setCurrentIteration(iter + 1)
          setProgress((iter + 1) / maxIterations)
          setCurrentSimilarity(bestEver.fitness)

          // Render best result to canvas
          const bestResult = await generator.generate(baseAlgorithm, bestEver.params, outputSize)
          if (bestResult && canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) {
              canvasRef.current.width = outputSize
              canvasRef.current.height = outputSize
              ctx.putImageData(bestResult.imageData, 0, 0)
            }
          }

          // Selection and reproduction
          const newPopulation: Individual[] = []
          
          // Elitism: keep top 2
          newPopulation.push({ params: { ...population[0].params }, fitness: population[0].fitness })
          newPopulation.push({ params: { ...population[1].params }, fitness: population[1].fitness })

          // Generate rest through crossover and mutation
          while (newPopulation.length < populationSize) {
            // Tournament selection
            const select = () => {
              const a = population[Math.floor(Math.random() * Math.min(5, population.length))]
              const b = population[Math.floor(Math.random() * Math.min(5, population.length))]
              return a.fitness > b.fitness ? a : b
            }

            const parent1 = select()
            const parent2 = select()

            // Crossover
            const childParams: Record<string, number | boolean | string> = {}
            for (const key of Object.keys(parent1.params)) {
              const p1Val = parent1.params[key]
              const p2Val = parent2.params[key]
              
              if (typeof p1Val === "number" && typeof p2Val === "number") {
                // Blend crossover
                const alpha = Math.random()
                childParams[key] = p1Val * alpha + p2Val * (1 - alpha)
              } else {
                // For non-numeric, randomly pick one
                childParams[key] = Math.random() < 0.5 ? p1Val : p2Val
              }
            }

            // Mutation
            for (const param of numericParams) {
              if (Math.random() < currentMutationRate) {
                const range = (param.max || 1) - (param.min || 0)
                const current = Number(childParams[param.id])
                const mutation = (Math.random() - 0.5) * range * 0.3
                childParams[param.id] = Math.max(param.min || 0, Math.min(param.max || 1, current + mutation))
              }
            }

            newPopulation.push({ params: childParams, fitness: 0 })
          }

          population.length = 0
          population.push(...newPopulation)

          // Small delay to allow UI updates
          await new Promise(r => setTimeout(r, 10))
        }

        // Final result
        const finalResult = await generator.generate(baseAlgorithm, bestEver.params, outputSize)
        if (finalResult && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d")
          if (ctx) {
            canvasRef.current.width = outputSize
            canvasRef.current.height = outputSize
            ctx.putImageData(finalResult.imageData, 0, 0)
            setResultImage(canvasRef.current.toDataURL())
          }
        }

        setBestParams(bestEver.params)
        setElapsedTime(Date.now() - startTime)
        setGenStats(genLog)
        setTotalEvaluations(evaluationCount)
        toast.success(`Optimization complete! Similarity: ${(bestEver.fitness * 100).toFixed(1)}%`)

      } catch (error) {
        console.error("Optimization error:", error)
        toast.error("Optimization failed")
      } finally {
        setIsProcessing(false)
      }
    }, [sourceImage, baseAlgorithm, maxIterations, populationSize, mutationRate, outputSize])

    const handleStop = useCallback(() => {
      stopRef.current = true
      toast.info("Stopping optimization...")
    }, [])

    const handleExportParams = useCallback(() => {
      if (!bestParams) return
      const blob = new Blob([JSON.stringify(bestParams, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `optimized-${baseAlgorithm}-params.json`
      a.click()
      URL.revokeObjectURL(url)
    }, [bestParams, baseAlgorithm])

    // Export the per-generation convergence log as CSV for thesis graphs. One row per
    // generation; all fitness columns are in [0,1] and higher-is-better.
    const handleExportHistoryCsv = useCallback(() => {
      if (genStats.length === 0) return
      const csvCell = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const headers = [
        "generation",
        "cumulative_evaluations",
        "elapsed_ms",
        "elapsed_s",
        "best_fitness",
        "best_ever_fitness",
        "mean_fitness",
        "worst_fitness",
        "std_fitness",
        "mutation_rate",
        "best_comp_mean",
        "best_comp_variance",
        "best_comp_gradient_dir",
        "best_comp_edge_density",
        "best_comp_histogram",
      ]
      const rows = genStats.map(g => [
        g.generation,
        g.evaluations,
        g.elapsedMs.toFixed(2),
        (g.elapsedMs / 1000).toFixed(4),
        g.bestFitness.toFixed(6),
        g.bestEverFitness.toFixed(6),
        g.meanFitness.toFixed(6),
        g.worstFitness.toFixed(6),
        g.stdFitness.toFixed(6),
        g.mutationRate.toFixed(6),
        g.compMean.toFixed(6),
        g.compVariance.toFixed(6),
        g.compGradientDir.toFixed(6),
        g.compEdgeDensity.toFixed(6),
        g.compHistogram.toFixed(6),
      ])
      // Metadata header comment lines (parsed by most tools as comments / skippable).
      const meta = [
        `# base_algorithm,${baseAlgorithm}`,
        `# population_size,${populationSize}`,
        `# initial_mutation_rate,${mutationRate}`,
        `# max_iterations,${maxIterations}`,
        `# output_size,${outputSize}`,
        `# generations_completed,${genStats.length}`,
        `# total_evaluations,${totalEvaluations}`,
        `# runtime_s,${elapsedTime !== null ? (elapsedTime / 1000).toFixed(3) : ""}`,
        `# final_best_fitness,${genStats[genStats.length - 1]?.bestEverFitness.toFixed(6) ?? ""}`,
      ].join("\n")
      const csv =
        meta + "\n" + [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `optimisation-history-${baseAlgorithm}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }, [genStats, baseAlgorithm, populationSize, mutationRate, maxIterations, outputSize, totalEvaluations, elapsedTime])

    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 p-8 overflow-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="w-full max-w-4xl space-y-6">
          {/* Info banner */}
          <div className="rounded-md bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
            <p>
              <strong>Optimisation-Based Synthesis:</strong> Upload a reference image and this will use a genetic algorithm 
              to find procedural texture parameters that best approximate it. The optimization uses the exact same 
              WebGPU shaders as the procedural textures, just with automatically tuned parameters.
            </p>
          </div>

          {/* Source and Result side by side */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Reference Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Reference Image</h3>
              <div 
                className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-border bg-background cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                {sourcePreview ? (
                  <img
                    src={sourcePreview}
                    alt="Reference"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Upload className="h-10 w-10" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload reference</p>
                      <p className="text-xs">PNG, JPG up to 128x128</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Result */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Optimized Result</h3>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-background">
                <canvas
                  ref={canvasRef}
                  width={outputSize}
                  height={outputSize}
                  className="h-full w-full object-contain"
                />
                {!resultImage && !isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted/80">
                    <p className="text-sm">Result will appear here</p>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                    <Progress value={progress * 100} className="h-2 mb-2" />
                    <div className="text-xs text-center">
                      Iteration {currentIteration}/{maxIterations} | Similarity: {(currentSimilarity * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            {isProcessing ? (
              <Button size="lg" variant="destructive" className="gap-2 px-8" onClick={handleStop}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="gap-2 px-8"
                  onClick={handleOptimize}
                  disabled={!sourceImage}
                >
                  <Play className="h-4 w-4" />
                  Optimize
                </Button>
                {bestParams && (
                  <Button size="lg" variant="outline" className="gap-2" onClick={handleExportParams}>
                    <Download className="h-4 w-4" />
                    Export Parameters
                  </Button>
                )}
                {genStats.length > 0 && (
                  <Button size="lg" variant="outline" className="gap-2" onClick={handleExportHistoryCsv}>
                    <Download className="h-4 w-4" />
                    Convergence CSV
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Results info */}
          {elapsedTime && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium mb-2">Optimization Results</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Time: {(elapsedTime / 1000).toFixed(1)}s</div>
                <div>Final Similarity: {(currentSimilarity * 100).toFixed(1)}%</div>
                <div>Base Algorithm: {baseAlgorithm}</div>
                <div>Iterations: {currentIteration}</div>
                <div>Generations Logged: {genStats.length}</div>
                <div>Evaluations: {totalEvaluations}</div>
              </div>
            </div>
          )}

          {/* Algorithm explanation */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">How It Works</p>
            <p className="leading-relaxed">
              This uses a <strong>genetic algorithm</strong> to search the parameter space of the selected procedural 
              texture (e.g., Wood, Perlin). It maintains a population of candidate parameter sets, evaluates their 
              fitness by comparing generated textures to your reference using statistical features (brightness, 
              contrast, gradient direction, edge density), then evolves better solutions through selection, 
              crossover, and mutation.
            </p>
          </div>
        </div>
      </div>
    )
  }
)
