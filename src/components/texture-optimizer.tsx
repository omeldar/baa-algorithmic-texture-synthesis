"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Upload, Play, Square, RotateCcw, Download, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import { getTextureGenerator } from "@/lib/webgpu-texture-generator"

type CrossoverMethod = "blend" | "uniform" | "single-point"
type SelectionMethod = "tournament" | "roulette" | "rank"

// Wood parameter ranges for optimization (including colors)
const PARAM_RANGES = {
  grainScale: { min: 1, max: 20, default: 8, type: "number" as const },
  anisotropy: { min: 0.1, max: 1, default: 0.3, type: "number" as const },
  warpStrength: { min: 0, max: 2, default: 0.8, type: "number" as const },
  warpScale: { min: 0.5, max: 5, default: 2, type: "number" as const },
  octaves: { min: 1, max: 6, default: 4, step: 1, type: "number" as const },
  persistence: { min: 0.1, max: 0.9, default: 0.5, type: "number" as const },
  lacunarity: { min: 1.5, max: 3, default: 2, type: "number" as const },
  ridgeStrength: { min: 0, max: 1, default: 0.4, type: "number" as const },
  detailStrength: { min: 0, max: 0.5, default: 0.15, type: "number" as const },
  crackStrength: { min: 0, max: 0.5, default: 0.1, type: "number" as const },
  crackScale: { min: 2, max: 15, default: 6, type: "number" as const },
  contrast: { min: 0.5, max: 3, default: 1.2, type: "number" as const },
  brightness: { min: -0.5, max: 0.5, default: 0, type: "number" as const },
  // Colors are optimized as RGB components (0-255)
  colorLightR: { min: 100, max: 255, default: 212, type: "number" as const },
  colorLightG: { min: 80, max: 220, default: 165, type: "number" as const },
  colorLightB: { min: 50, max: 180, default: 116, type: "number" as const },
  colorDarkR: { min: 20, max: 150, default: 74, type: "number" as const },
  colorDarkG: { min: 15, max: 120, default: 55, type: "number" as const },
  colorDarkB: { min: 10, max: 100, default: 40, type: "number" as const },
}

type ParamKey = keyof typeof PARAM_RANGES

interface OptimizationResult {
  params: Record<string, number | string>
  similarity: number
  fitnessComponents: FitnessResult["components"]
  iteration: number
}

// Per-generation statistics logged for thesis convergence analysis. One row per
// generation of the genetic algorithm — the basis for the convergence CSV/graph.
interface GenerationStats {
  generation: number // 0-based generation index
  evaluations: number // cumulative candidate textures evaluated up to & incl. this generation
  elapsedMs: number // ms since the optimization loop started
  bestFitness: number // best (max) combined similarity in this generation
  meanFitness: number // mean combined similarity across the population
  worstFitness: number // worst (min) combined similarity in this generation
  stdFitness: number // population standard deviation of combined similarity
  bestEverFitness: number // running best combined similarity up to this generation
  // Component breakdown of THIS generation's best individual (all higher-is-better)
  compMean: number
  compVariance: number
  compGradRatio: number
  compEdgeDensity: number
  compHistogram: number
}

// Summary of a completed (or stopped) optimization run — the before/after record.
interface RunSummary {
  startedAt: string // ISO timestamp when the GA loop began
  runtimeMs: number // total wall-clock time of the GA loop
  generationsCompleted: number
  totalEvaluations: number // total candidate textures evaluated across the run
  stopped: boolean // true if the user stopped early
}

interface TextureOptimizerProps {
  onBack: () => void
  onApplyParams: (params: Record<string, number | boolean | string>) => void
  currentParams: Record<string, number | boolean | string>
}

// Reference image identifier for reproducibility tracking
let referenceImageId: string | null = null

// Simple seeded RNG for reproducible randomness
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

// Compute image statistics for comparison
function computeImageStats(imageData: ImageData) {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  
  // Convert to grayscale values
  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3 / 255)
  }
  
  // Mean and variance
  const mean = gray.reduce((a, b) => a + b) / gray.length
  const variance = gray.reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length
  
  // Horizontal and vertical gradients (texture directionality)
  let hGrad = 0, vGrad = 0
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x
      hGrad += Math.abs(gray[idx + 1] - gray[idx])
      vGrad += Math.abs(gray[idx + width] - gray[idx])
    }
  }
  hGrad /= (width - 1) * (height - 1)
  vGrad /= (width - 1) * (height - 1)
  
  // Edge density (Sobel-like approximation)
  let edgeDensity = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const gx = gray[idx + 1] - gray[idx - 1]
      const gy = gray[idx + width] - gray[idx - width]
      edgeDensity += Math.sqrt(gx * gx + gy * gy)
    }
  }
  edgeDensity /= (width - 2) * (height - 2)
  
  // Histogram (8 bins)
  const histogram = new Array(8).fill(0)
  for (const g of gray) {
    const bin = Math.min(7, Math.floor(g * 8))
    histogram[bin]++
  }
  const histNorm = histogram.map(h => h / gray.length)
  
  return { mean, variance, hGrad, vGrad, edgeDensity, histogram: histNorm }
}

// Detailed fitness result with individual components
interface FitnessResult {
  total: number
  components: {
    mean: number
    variance: number
    gradRatio: number
    edgeDensity: number
    histogram: number
  }
}

// Compare two image stats - returns detailed similarity breakdown
function compareStats(
  statsA: ReturnType<typeof computeImageStats>,
  statsB: ReturnType<typeof computeImageStats>
): FitnessResult {
  // Weight factors for different metrics
  const weights = {
    mean: 0.15,
    variance: 0.15,
    gradRatio: 0.2,
    edgeDensity: 0.2,
    histogram: 0.3,
  }
  
  const components = {
    mean: 0,
    variance: 0,
    gradRatio: 0,
    edgeDensity: 0,
    histogram: 0,
  }
  
  // Mean similarity
  components.mean = 1 - Math.abs(statsA.mean - statsB.mean)
  
  // Variance similarity
  const varDiff = Math.abs(statsA.variance - statsB.variance) / Math.max(statsA.variance, statsB.variance, 0.01)
  components.variance = 1 - Math.min(varDiff, 1)
  
  // Gradient ratio (directionality) - important for wood grain direction
  const ratioA = statsA.vGrad / (statsA.hGrad + 0.001)
  const ratioB = statsB.vGrad / (statsB.hGrad + 0.001)
  const ratioDiff = Math.abs(ratioA - ratioB) / Math.max(ratioA, ratioB, 0.01)
  components.gradRatio = 1 - Math.min(ratioDiff, 1)
  
  // Edge density
  const edgeDiff = Math.abs(statsA.edgeDensity - statsB.edgeDensity) / Math.max(statsA.edgeDensity, statsB.edgeDensity, 0.01)
  components.edgeDensity = 1 - Math.min(edgeDiff, 1)
  
  // Histogram intersection
  let histSum = 0
  for (let i = 0; i < statsA.histogram.length; i++) {
    histSum += Math.min(statsA.histogram[i], statsB.histogram[i])
  }
  components.histogram = histSum
  
  // Weighted total
  const total = 
    weights.mean * components.mean +
    weights.variance * components.variance +
    weights.gradRatio * components.gradRatio +
    weights.edgeDensity * components.edgeDensity +
    weights.histogram * components.histogram
  
  return { total, components }
}

export function TextureOptimizer({ onBack, onApplyParams, currentParams }: TextureOptimizerProps) {
  const [referenceImage, setReferenceImage] = useState<HTMLImageElement | null>(null)
  const [referenceStats, setReferenceStats] = useState<ReturnType<typeof computeImageStats> | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentSimilarity, setCurrentSimilarity] = useState(0)
  const [currentFitnessComponents, setCurrentFitnessComponents] = useState<FitnessResult["components"] | null>(null)
  const [bestResult, setBestResult] = useState<OptimizationResult | null>(null)
  const [history, setHistory] = useState<OptimizationResult[]>([])
  // Per-generation convergence log + completed-run summary, used for thesis CSV exports.
  const [genStats, setGenStats] = useState<GenerationStats[]>([])
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)
  const [maxIterations, setMaxIterations] = useState(100)
  const [populationSize, setPopulationSize] = useState(20)
  const [mutationStrength, setMutationStrength] = useState(0.2)
  const [mutationRate, setMutationRate] = useState(0.2)
  const [crossoverMethod, setCrossoverMethod] = useState<CrossoverMethod>("blend")
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>("tournament")
  const [elitismCount, setElitismCount] = useState(2)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Baseline state: score for default params before any optimization
  const [baselineResult, setBaselineResult] = useState<{ similarity: number; fitnessComponents: FitnessResult["components"] } | null>(null)
  const [isCapturingBaseline, setIsCapturingBaseline] = useState(false)
  const baselineCanvasRef = useRef<HTMLCanvasElement>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const generatedCanvasRef = useRef<HTMLCanvasElement>(null)
  const stopRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const gpuDeviceRef = useRef<GPUDevice | null>(null)
  const referenceImageDataRef = useRef<ImageData | null>(null)
  
  // Draw reference image to canvas when it changes
  useEffect(() => {
    if (referenceImage && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(referenceImage, 0, 0, 256, 256)
      }
    }
  }, [referenceImage])
  
  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const img = new Image()
    img.onload = () => {
      // Use offscreen canvas to process image before setting state
      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = 128
      offscreenCanvas.height = 128
      const ctx = offscreenCanvas.getContext("2d")
      if (!ctx) return
      
      ctx.drawImage(img, 0, 0, 128, 128)
      const imageData = ctx.getImageData(0, 0, 128, 128)
      
      // Store for comparison
      referenceImageDataRef.current = imageData
      
      // Compute stats
      const stats = computeImageStats(imageData)
      setReferenceStats(stats)
      
      // Store reference image ID for reproducibility (filename + hash of stats)
      referenceImageId = `${file.name}_${Math.round(stats.mean * 1000)}_${Math.round(stats.variance * 10000)}`
      
      // Reset optimization state
      setBestResult(null)
      setHistory([])
      setProgress(0)
      setCurrentSimilarity(0)
      setCurrentFitnessComponents(null)
      
      // Set reference image last (triggers canvas render)
      setReferenceImage(img)
    }
    img.src = URL.createObjectURL(file)
  }, [])
  
  // Shared helper: generate texture via WebGPU and draw to a target canvas, returning fitness
  const generateToCanvas = useCallback(async (
    params: Record<string, number | string>,
    targetCanvas: HTMLCanvasElement
  ): Promise<FitnessResult> => {
    if (!referenceStats) return { total: 0, components: { mean: 0, variance: 0, gradRatio: 0, edgeDensity: 0, histogram: 0 } }
    const ctx = targetCanvas.getContext("2d")
    if (!ctx) return { total: 0, components: { mean: 0, variance: 0, gradRatio: 0, edgeDensity: 0, histogram: 0 } }
    const generator = getTextureGenerator()
    const result = await generator.generate("wood", params, 128)
    if (!result) return { total: 0, components: { mean: 0, variance: 0, gradRatio: 0, edgeDensity: 0, histogram: 0 } }
    targetCanvas.width = 128
    targetCanvas.height = 128
    ctx.putImageData(result.imageData, 0, 0)
    return compareStats(referenceStats, computeImageStats(result.imageData))
  }, [referenceStats])

  // Generate texture using WebGPU (same shader as front page) and return fitness result
  const generateAndCompare = useCallback(async (params: Record<string, number | string>): Promise<FitnessResult> => {
    const canvas = generatedCanvasRef.current
    if (!canvas) return { total: 0, components: { mean: 0, variance: 0, gradRatio: 0, edgeDensity: 0, histogram: 0 } }
    return generateToCanvas(params, canvas)
  }, [generateToCanvas])

  // Capture baseline: evaluate default params before optimization begins
  const captureBaseline = useCallback(async () => {
    const canvas = baselineCanvasRef.current
    if (!canvas || !referenceStats) return
    setIsCapturingBaseline(true)
    const defaultParams: Record<string, number> = {}
    for (const [key, range] of Object.entries(PARAM_RANGES)) {
      defaultParams[key] = range.default
    }
    const rgbToHex = (r: number, g: number, b: number) =>
      "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")
    const fullParams = {
      ...defaultParams,
      colorLight: rgbToHex(defaultParams.colorLightR, defaultParams.colorLightG, defaultParams.colorLightB),
      colorDark: rgbToHex(defaultParams.colorDarkR, defaultParams.colorDarkG, defaultParams.colorDarkB),
    }
    const fitness = await generateToCanvas(fullParams, canvas)
    setBaselineResult({ similarity: fitness.total, fitnessComponents: fitness.components })
    setIsCapturingBaseline(false)
  }, [referenceStats, generateToCanvas])
  
  // Genetic algorithm optimization
  const runOptimization = useCallback(async () => {
    if (!referenceStats) return

    setIsOptimizing(true)
    stopRef.current = false
    setHistory([])
    setBestResult(null)
    setCurrentFitnessComponents(null)
    setGenStats([])
    setRunSummary(null)

    // Convergence log accumulated locally, then flushed to state for export.
    const genLog: GenerationStats[] = []
    let totalEvaluations = 0
    const runStartedAt = new Date().toISOString()
    const t0 = performance.now()

    // Capture baseline before optimization begins
    await captureBaseline()

    const paramKeys = Object.keys(PARAM_RANGES) as ParamKey[]

    const rgbToHex = (r: number, g: number, b: number) =>
      "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")

    const buildFullParams = (raw: Record<string, number>) => ({
      ...raw,
      colorLight: rgbToHex(raw.colorLightR, raw.colorLightG, raw.colorLightB),
      colorDark: rgbToHex(raw.colorDarkR, raw.colorDarkG, raw.colorDarkB),
    })

    const defaultFitness: FitnessResult = { total: 0, components: { mean: 0, variance: 0, gradRatio: 0, edgeDensity: 0, histogram: 0 } }

    // Initialize population
    let population: Array<{ params: Record<string, number>, fitness: FitnessResult }> = []
    for (let i = 0; i < populationSize; i++) {
      const params: Record<string, number> = {}
      for (const key of paramKeys) {
        const range = PARAM_RANGES[key]
        if (i === 0) {
          params[key] = range.default
        } else {
          const val = range.min + seededRandom(i * 1000 + paramKeys.indexOf(key)) * (range.max - range.min)
          params[key] = range.step ? Math.round(val / range.step) * range.step : val
        }
      }
      population.push({ params, fitness: defaultFitness })
    }

    // Selection helpers
    const selectParent = (pop: typeof population, iter: number, seed: number) => {
      if (selectionMethod === "tournament") {
        // Tournament selection (k=3)
        let best = pop[Math.floor(seededRandom(seed) * pop.length)]
        for (let k = 1; k < 3; k++) {
          const challenger = pop[Math.floor(seededRandom(seed + k * 7919) * pop.length)]
          if (challenger.fitness.total > best.fitness.total) best = challenger
        }
        return best
      } else if (selectionMethod === "roulette") {
        // Roulette wheel (fitness-proportionate)
        const totalFit = pop.reduce((s, ind) => s + Math.max(ind.fitness.total, 0.001), 0)
        let pick = seededRandom(seed) * totalFit
        for (const ind of pop) {
          pick -= Math.max(ind.fitness.total, 0.001)
          if (pick <= 0) return ind
        }
        return pop[pop.length - 1]
      } else {
        // Rank selection
        const ranked = [...pop].sort((a, b) => a.fitness.total - b.fitness.total)
        const totalRank = (ranked.length * (ranked.length + 1)) / 2
        let pick = seededRandom(seed) * totalRank
        for (let r = 0; r < ranked.length; r++) {
          pick -= (r + 1)
          if (pick <= 0) return ranked[r]
        }
        return ranked[ranked.length - 1]
      }
    }

    // Crossover helpers
    const crossover = (p1: Record<string, number>, p2: Record<string, number>, iter: number, childIdx: number) => {
      const child: Record<string, number> = {}
      if (crossoverMethod === "blend") {
        for (const key of paramKeys) {
          const t = seededRandom(iter * 10000 + childIdx * 37 + paramKeys.indexOf(key))
          child[key] = p1[key] * t + p2[key] * (1 - t)
        }
      } else if (crossoverMethod === "uniform") {
        for (const key of paramKeys) {
          child[key] = seededRandom(iter * 10000 + childIdx * 37 + paramKeys.indexOf(key)) > 0.5 ? p1[key] : p2[key]
        }
      } else {
        // single-point
        const cutPoint = Math.floor(seededRandom(iter * 10000 + childIdx) * paramKeys.length)
        for (let ki = 0; ki < paramKeys.length; ki++) {
          child[paramKeys[ki]] = ki < cutPoint ? p1[paramKeys[ki]] : p2[paramKeys[ki]]
        }
      }
      return child
    }

    let bestEver: OptimizationResult | null = null

    for (let iter = 0; iter < maxIterations && !stopRef.current; iter++) {
      // Evaluate fitness
      for (const individual of population) {
        individual.fitness = await generateAndCompare(buildFullParams(individual.params))
        totalEvaluations++
      }

      // Sort by fitness descending
      population.sort((a, b) => b.fitness.total - a.fitness.total)

      // Track best ever
      if (!bestEver || population[0].fitness.total > bestEver.similarity) {
        bestEver = {
          params: buildFullParams(population[0].params),
          similarity: population[0].fitness.total,
          fitnessComponents: population[0].fitness.components,
          iteration: iter,
        }
        setBestResult(bestEver)
        setHistory(prev => [...prev, bestEver!])
      }

      // Record per-generation statistics for the convergence log (one row / generation).
      // Population is already sorted descending, so [0] is best and last is worst.
      const fitnessValues = population.map(p => p.fitness.total)
      const meanFitness = fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length
      const stdFitness = Math.sqrt(
        fitnessValues.reduce((a, b) => a + (b - meanFitness) ** 2, 0) / fitnessValues.length
      )
      const bestComp = population[0].fitness.components
      genLog.push({
        generation: iter,
        evaluations: totalEvaluations,
        elapsedMs: performance.now() - t0,
        bestFitness: population[0].fitness.total,
        meanFitness,
        worstFitness: fitnessValues[fitnessValues.length - 1],
        stdFitness,
        bestEverFitness: bestEver.similarity,
        compMean: bestComp.mean,
        compVariance: bestComp.variance,
        compGradRatio: bestComp.gradRatio,
        compEdgeDensity: bestComp.edgeDensity,
        compHistogram: bestComp.histogram,
      })

      setCurrentSimilarity(population[0].fitness.total)
      setCurrentFitnessComponents(population[0].fitness.components)
      setProgress(((iter + 1) / maxIterations) * 100)

      await new Promise(r => setTimeout(r, 10))
      if (stopRef.current) break

      // Build next generation
      const newPopulation: typeof population = []

      // Elitism: keep top N individuals unchanged
      for (let e = 0; e < Math.min(elitismCount, population.length); e++) {
        newPopulation.push({ params: { ...population[e].params }, fitness: defaultFitness })
      }

      // Fill rest with offspring
      while (newPopulation.length < populationSize) {
        const childIdx = newPopulation.length
        const p1 = selectParent(population, iter, iter * 10000 + childIdx * 13)
        const p2 = selectParent(population, iter, iter * 10000 + childIdx * 17 + 1000)

        const childParams = crossover(p1.params, p2.params, iter, childIdx)

        // Mutation: per-gene with decaying strength
        const decayedStrength = mutationStrength * (1 - (iter / maxIterations) * 0.5)
        for (const key of paramKeys) {
          const range = PARAM_RANGES[key]
          if (seededRandom(iter * 20000 + childIdx * 41 + paramKeys.indexOf(key)) < mutationRate) {
            childParams[key] += (seededRandom(iter * 30000 + childIdx * 53 + paramKeys.indexOf(key)) - 0.5) * 2 * (range.max - range.min) * decayedStrength
          }
          childParams[key] = Math.max(range.min, Math.min(range.max, childParams[key]))
          if (range.step) childParams[key] = Math.round(childParams[key] / range.step) * range.step
        }

        newPopulation.push({ params: childParams, fitness: defaultFitness })
      }

      population = newPopulation
    }

    // Flush convergence log and write the run summary for export.
    setGenStats(genLog)
    setRunSummary({
      startedAt: runStartedAt,
      runtimeMs: performance.now() - t0,
      generationsCompleted: genLog.length,
      totalEvaluations,
      stopped: stopRef.current,
    })

    setIsOptimizing(false)
  }, [referenceStats, maxIterations, populationSize, mutationStrength, mutationRate, crossoverMethod, selectionMethod, elitismCount, generateAndCompare, captureBaseline])
  
  const handleStop = useCallback(() => {
    stopRef.current = true
  }, [])
  
  const handleApply = useCallback(() => {
    if (bestResult) {
      onApplyParams({
        ...bestResult.params,
        seed: currentParams.seed || "42",
        animate: false,
      })
    }
  }, [bestResult, onApplyParams, currentParams])
  
  const handleReset = useCallback(() => {
    setReferenceImage(null)
    setReferenceStats(null)
    setBestResult(null)
    setBaselineResult(null)
    setHistory([])
    setGenStats([])
    setRunSummary(null)
    setProgress(0)
    setCurrentSimilarity(0)
    setCurrentFitnessComponents(null)
    referenceImageId = null
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])
  
  // Export full optimization results as JSON
  const handleExportResults = useCallback(() => {
    if (!bestResult) return
    
    const exportData = {
      timestamp: new Date().toISOString(),
      referenceImageId: referenceImageId || "unknown",
      textureMethod: "wood",
      runSummary: runSummary
        ? {
            startedAt: runSummary.startedAt,
            runtimeMs: runSummary.runtimeMs,
            runtimeSeconds: runSummary.runtimeMs / 1000,
            generationsCompleted: runSummary.generationsCompleted,
            totalEvaluations: runSummary.totalEvaluations,
            stoppedEarly: runSummary.stopped,
          }
        : null,
      optimizerSettings: {
        maxIterations,
        populationSize,
        mutationStrength,
        mutationRate,
        crossoverMethod,
        selectionMethod,
        elitismCount,
      },
      baseline: baselineResult
        ? {
            score: baselineResult.similarity,
            fitnessComponents: baselineResult.fitnessComponents,
          }
        : null,
      result: {
        finalScore: bestResult.similarity,
        improvement: baselineResult ? bestResult.similarity - baselineResult.similarity : null,
        scoreDirection: "higher_is_better",
        fitnessComponents: bestResult.fitnessComponents,
        componentWeights: {
          mean: 0.15,
          variance: 0.15,
          gradRatio: 0.2,
          edgeDensity: 0.2,
          histogram: 0.3,
        },
        iterationsRun: bestResult.iteration + 1,
        optimizedParams: bestResult.params,
      },
      // Sparse best-ever improvements (legacy history)
      bestHistory: history.map(h => ({
        iteration: h.iteration,
        score: h.similarity,
        components: h.fitnessComponents,
      })),
      // Dense per-generation convergence log (same data as the history CSV)
      generationStats: genStats,
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `optimization-results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [bestResult, history, genStats, runSummary, maxIterations, populationSize, mutationStrength, mutationRate, crossoverMethod, selectionMethod, elitismCount, baselineResult])

  // Export only the optimised shader parameters — ready to paste into a scene config
  const handleExportParams = useCallback(() => {
    if (!bestResult) return

    const p = bestResult.params

    // Round numeric values to a useful precision; keep colours as hex strings
    const round = (v: unknown, decimals = 3) =>
      typeof v === "number" ? parseFloat(v.toFixed(decimals)) : v

    const sceneParams = {
      _meta: {
        description: "Wood texture parameters optimised by genetic algorithm. Drop into any material slot that accepts the 'wood' shader.",
        algorithm: "wood",
        optimisedAt: new Date().toISOString(),
        referenceImage: referenceImageId || "unknown",
        matchScore: `${(bestResult.similarity * 100).toFixed(1)}% (higher is better)`,
        iterationsRun: bestResult.iteration + 1,
      },
      // Grain structure
      grainScale: round(p.grainScale, 2),
      anisotropy: round(p.anisotropy, 3),
      // Domain warp
      warpStrength: round(p.warpStrength, 3),
      warpScale: round(p.warpScale, 3),
      // fBm noise layers
      octaves: Math.round(Number(p.octaves)),
      persistence: round(p.persistence, 3),
      lacunarity: round(p.lacunarity, 3),
      // Surface details
      ridgeStrength: round(p.ridgeStrength, 3),
      detailStrength: round(p.detailStrength, 3),
      crackStrength: round(p.crackStrength, 3),
      crackScale: round(p.crackScale, 2),
      // Tone
      contrast: round(p.contrast, 3),
      brightness: round(p.brightness, 3),
      // Colours (hex strings, ready to use)
      colorLight: p.colorLight,
      colorDark: p.colorDark,
    }

    const blob = new Blob([JSON.stringify(sceneParams, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `wood-params-${(bestResult.similarity * 100).toFixed(0)}pct-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [bestResult])

  // --- Thesis evaluation exports (Chapter 6.7 Optimization-Based Approximation) ---

  // Small helper: trigger a browser download for a text/blob payload.
  const downloadFile = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Escape a single CSV cell (quote if it contains comma, quote or newline).
  const csvCell = useCallback((v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }, [])

  // 1) Convergence history CSV — one row per generation. The primary file for the
  //    convergence graph in Chapter 6.7. Columns are higher-is-better fitness values.
  const handleExportHistoryCsv = useCallback(() => {
    if (genStats.length === 0) return
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
      "best_comp_mean",
      "best_comp_variance",
      "best_comp_grad_ratio",
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
      g.compMean.toFixed(6),
      g.compVariance.toFixed(6),
      g.compGradRatio.toFixed(6),
      g.compEdgeDensity.toFixed(6),
      g.compHistogram.toFixed(6),
    ])
    const csv = [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\n")
    downloadFile(csv, `optimization-history-${Date.now()}.csv`, "text/csv")
  }, [genStats, csvCell, downloadFile])

  // 2) Run summary CSV — a single key/value table with the before/after numbers,
  //    runtime, target/method metadata and the final best parameters. Designed to be
  //    quoted directly in the written thesis section.
  const handleExportSummaryCsv = useCallback(() => {
    if (!bestResult || !runSummary) return
    const improvement = baselineResult ? bestResult.similarity - baselineResult.similarity : null
    const rows: Array<[string, unknown]> = [
      ["target_image", referenceImageId || "unknown"],
      ["texture_method", "wood"],
      ["fitness_metric", "weighted_combined_similarity"],
      ["score_direction", "higher_is_better"],
      ["started_at", runSummary.startedAt],
      ["runtime_ms", runSummary.runtimeMs.toFixed(2)],
      ["runtime_s", (runSummary.runtimeMs / 1000).toFixed(3)],
      ["generations_completed", runSummary.generationsCompleted],
      ["total_evaluations", runSummary.totalEvaluations],
      ["stopped_early", runSummary.stopped],
      ["max_iterations_setting", maxIterations],
      ["population_size", populationSize],
      ["mutation_rate", mutationRate],
      ["mutation_strength", mutationStrength],
      ["crossover_method", crossoverMethod],
      ["selection_method", selectionMethod],
      ["elitism_count", elitismCount],
      ["initial_fitness", baselineResult ? baselineResult.similarity.toFixed(6) : ""],
      ["final_best_fitness", bestResult.similarity.toFixed(6)],
      ["absolute_improvement", improvement !== null ? improvement.toFixed(6) : ""],
      ["relative_improvement_pct", improvement !== null && baselineResult && baselineResult.similarity > 0
        ? ((improvement / baselineResult.similarity) * 100).toFixed(2)
        : ""],
      ["best_found_at_generation", bestResult.iteration],
      // Final best component breakdown
      ["final_comp_mean", bestResult.fitnessComponents.mean.toFixed(6)],
      ["final_comp_variance", bestResult.fitnessComponents.variance.toFixed(6)],
      ["final_comp_grad_ratio", bestResult.fitnessComponents.gradRatio.toFixed(6)],
      ["final_comp_edge_density", bestResult.fitnessComponents.edgeDensity.toFixed(6)],
      ["final_comp_histogram", bestResult.fitnessComponents.histogram.toFixed(6)],
      // Initial (baseline) component breakdown for before/after comparison
      ["initial_comp_mean", baselineResult ? baselineResult.fitnessComponents.mean.toFixed(6) : ""],
      ["initial_comp_variance", baselineResult ? baselineResult.fitnessComponents.variance.toFixed(6) : ""],
      ["initial_comp_grad_ratio", baselineResult ? baselineResult.fitnessComponents.gradRatio.toFixed(6) : ""],
      ["initial_comp_edge_density", baselineResult ? baselineResult.fitnessComponents.edgeDensity.toFixed(6) : ""],
      ["initial_comp_histogram", baselineResult ? baselineResult.fitnessComponents.histogram.toFixed(6) : ""],
    ]
    // Append the final best parameters as param_<name> rows.
    for (const [key, val] of Object.entries(bestResult.params)) {
      rows.push([`param_${key}`, typeof val === "number" ? val.toFixed(6) : val])
    }
    const csv = ["key,value", ...rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)].join("\n")
    downloadFile(csv, `optimization-summary-${Date.now()}.csv`, "text/csv")
  }, [bestResult, runSummary, baselineResult, referenceImageId, maxIterations, populationSize, mutationRate, mutationStrength, crossoverMethod, selectionMethod, elitismCount, csvCell, downloadFile])

  // 3) Export the three comparison images (target, baseline/initial, optimized) as PNGs.
  const handleExportImages = useCallback(() => {
    const stamp = Date.now()
    const saveCanvas = (canvas: HTMLCanvasElement | null, name: string) => {
      if (!canvas) return
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = name
        a.click()
        URL.revokeObjectURL(url)
      }, "image/png")
    }
    saveCanvas(canvasRef.current, `target-${stamp}.png`)
    saveCanvas(baselineCanvasRef.current, `initial-baseline-${stamp}.png`)
    saveCanvas(generatedCanvasRef.current, `optimized-${stamp}.png`)
  }, [])
  
  return (
    <div className="flex h-full w-full bg-background">
      {/* Left side - Controls */}
      <aside className="w-80 border-r border-border flex flex-col bg-sidebar">
        <div className="flex-shrink-0 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Wood Texture
          </Button>
          <h1 className="text-lg font-semibold text-sidebar-foreground">
            Texture Optimizer
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a wood texture image to automatically find matching parameters
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Upload Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reference Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {referenceImage ? "Change Image" : "Upload Wood Texture"}
                  </span>
                </div>
              </Button>
            </div>
            
            {/* Optimization Settings */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Optimization Settings</Label>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Max Iterations</span>
                  <span className="text-muted-foreground">{maxIterations}</span>
                </div>
                <Slider value={[maxIterations]} onValueChange={([v]) => setMaxIterations(v)} min={20} max={300} step={10} disabled={isOptimizing} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Population Size</span>
                  <span className="text-muted-foreground">{populationSize}</span>
                </div>
                <Slider value={[populationSize]} onValueChange={([v]) => setPopulationSize(v)} min={5} max={60} step={5} disabled={isOptimizing} />
              </div>

              {/* Advanced controls toggle */}
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={() => setShowAdvanced(v => !v)}
                disabled={isOptimizing}
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="space-y-4 pl-1 border-l-2 border-border">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Mutation Rate</span>
                      <span className="text-muted-foreground">{mutationRate.toFixed(2)}</span>
                    </div>
                    <Slider value={[mutationRate]} onValueChange={([v]) => setMutationRate(v)} min={0.05} max={0.5} step={0.05} disabled={isOptimizing} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Mutation Strength</span>
                      <span className="text-muted-foreground">{mutationStrength.toFixed(2)}</span>
                    </div>
                    <Slider value={[mutationStrength]} onValueChange={([v]) => setMutationStrength(v)} min={0.05} max={0.5} step={0.05} disabled={isOptimizing} />
                    <p className="text-xs text-muted-foreground">Initial perturbation magnitude. Decays 50% over run.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Elitism Count</span>
                      <span className="text-muted-foreground">{elitismCount}</span>
                    </div>
                    <Slider value={[elitismCount]} onValueChange={([v]) => setElitismCount(v)} min={0} max={6} step={1} disabled={isOptimizing} />
                    <p className="text-xs text-muted-foreground">Top N individuals carried unchanged to next generation.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Crossover Method</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["blend", "uniform", "single-point"] as CrossoverMethod[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setCrossoverMethod(m)}
                          disabled={isOptimizing}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${crossoverMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {m === "single-point" ? "1-point" : m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {crossoverMethod === "blend" && "Weighted average of parent values."}
                      {crossoverMethod === "uniform" && "Each gene randomly from either parent."}
                      {crossoverMethod === "single-point" && "Genes before cut from parent 1, after from parent 2."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Selection Method</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["tournament", "roulette", "rank"] as SelectionMethod[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setSelectionMethod(m)}
                          disabled={isOptimizing}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${selectionMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectionMethod === "tournament" && "Best of 3 random candidates (k=3)."}
                      {selectionMethod === "roulette" && "Fitness-proportionate probability."}
                      {selectionMethod === "rank" && "Selection probability based on rank order."}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Progress */}
            {(isOptimizing || progress > 0) && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="text-xs text-muted-foreground text-center">
                  Similarity: {(currentSimilarity * 100).toFixed(1)}% (higher is better)
                </div>
              </div>
            )}
            
            {/* Fitness Components */}
            {currentFitnessComponents && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fitness Breakdown</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-1.5 bg-muted/50 rounded">
                    <span>Mean</span>
                    <span className="font-mono">{(currentFitnessComponents.mean * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-muted/50 rounded">
                    <span>Variance</span>
                    <span className="font-mono">{(currentFitnessComponents.variance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-muted/50 rounded">
                    <span>Direction</span>
                    <span className="font-mono">{(currentFitnessComponents.gradRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-muted/50 rounded">
                    <span>Edges</span>
                    <span className="font-mono">{(currentFitnessComponents.edgeDensity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="col-span-2 flex justify-between p-1.5 bg-muted/50 rounded">
                    <span>Histogram</span>
                    <span className="font-mono">{(currentFitnessComponents.histogram * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Best Result */}
            {bestResult && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-sm font-medium text-primary">
                    Best Match: {(bestResult.similarity * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Found at iteration {bestResult.iteration + 1}
                    {baselineResult && (
                      <span className="ml-2">
                        &bull; improvement:{" "}
                        <span className="text-green-600 dark:text-green-400">
                          +{((bestResult.similarity - baselineResult.similarity) * 100).toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline parameter preview */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Best Parameters
                  </Label>
                  <div className="rounded-md border border-border bg-muted/40 p-2 space-y-0.5 max-h-48 overflow-y-auto">
                    {[
                      ["grainScale", bestResult.params.grainScale],
                      ["anisotropy", bestResult.params.anisotropy],
                      ["warpStrength", bestResult.params.warpStrength],
                      ["warpScale", bestResult.params.warpScale],
                      ["octaves", Math.round(Number(bestResult.params.octaves))],
                      ["persistence", bestResult.params.persistence],
                      ["lacunarity", bestResult.params.lacunarity],
                      ["ridgeStrength", bestResult.params.ridgeStrength],
                      ["detailStrength", bestResult.params.detailStrength],
                      ["crackStrength", bestResult.params.crackStrength],
                      ["crackScale", bestResult.params.crackScale],
                      ["contrast", bestResult.params.contrast],
                      ["brightness", bestResult.params.brightness],
                    ].map(([key, val]) => (
                      <div key={String(key)} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-mono">{key}</span>
                        <span className="font-mono tabular-nums">
                          {typeof val === "number" ? val.toFixed(3) : String(val)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-xs pt-0.5 border-t border-border mt-0.5">
                      <span className="text-muted-foreground font-mono">colorLight</span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-sm border border-border"
                          style={{ background: String(bestResult.params.colorLight) }}
                        />
                        <span className="font-mono">{String(bestResult.params.colorLight)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-mono">colorDark</span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-sm border border-border"
                          style={{ background: String(bestResult.params.colorDark) }}
                        />
                        <span className="font-mono">{String(bestResult.params.colorDark)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Action Buttons */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-4 space-y-2">
          {isOptimizing ? (
            <Button variant="destructive" className="w-full" onClick={handleStop}>
              <Square className="h-4 w-4 mr-2" />
              Stop Optimization
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={runOptimization}
              disabled={!referenceStats}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Optimization
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
              disabled={isOptimizing}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleApply}
              disabled={!bestResult || isOptimizing}
            >
              Apply
            </Button>
          </div>
          
          {/* Scene-ready params — the primary export users will want */}
          <Button
            className="w-full"
            onClick={handleExportParams}
            disabled={!bestResult}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Params (scene-ready)
          </Button>

          {/* Full diagnostics export for reproducibility records */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleExportResults}
            disabled={!bestResult}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Full Results JSON
          </Button>

          {/* Thesis evaluation exports (Chapter 6.7) — available once a run has produced
              a per-generation convergence log. */}
          <div className="pt-2 mt-1 border-t border-sidebar-border space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Thesis Evaluation Data
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleExportHistoryCsv}
              disabled={genStats.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Convergence History CSV
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleExportSummaryCsv}
              disabled={!runSummary || !bestResult}
            >
              <Download className="h-4 w-4 mr-2" />
              Run Summary CSV
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportImages}
              disabled={!bestResult}
            >
              <Download className="h-4 w-4 mr-2" />
              Comparison Images (PNG)
            </Button>
            {runSummary && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {runSummary.generationsCompleted} generations &bull;{" "}
                {runSummary.totalEvaluations} evaluations &bull;{" "}
                {(runSummary.runtimeMs / 1000).toFixed(1)}s runtime
                {runSummary.stopped && " (stopped early)"}
              </p>
            )}
          </div>
        </div>
      </aside>
      
      {/* Main area - Comparison */}
      <main className="flex-1 flex items-center justify-center bg-muted/20 p-8 overflow-auto">
        <div className="flex gap-6 items-start flex-wrap justify-center">
          {/* Reference Image */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm font-medium">Reference</Label>
            <div className="relative w-56 h-56 rounded-lg border border-border overflow-hidden bg-muted/50">
              {referenceImage ? (
                <canvas ref={canvasRef} width={256} height={256} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No image uploaded
                </div>
              )}
            </div>
          </div>

          {/* Baseline (default params) */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm font-medium">Baseline (defaults)</Label>
            <div className="relative w-56 h-56 rounded-lg border border-border overflow-hidden bg-muted/50">
              <canvas ref={baselineCanvasRef} width={128} height={128} className="w-full h-full" />
              {!baselineResult && !isCapturingBaseline && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-muted/80 text-center px-4">
                  Captured before optimization
                </div>
              )}
              {isCapturingBaseline && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs bg-muted/80">
                  Capturing...
                </div>
              )}
            </div>
            {baselineResult && (
              <span className="text-xs text-muted-foreground">
                Score: {(baselineResult.similarity * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {/* Best Optimized Texture */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm font-medium">
              Optimized
              {bestResult && baselineResult && (
                <span className={`ml-2 text-xs font-normal ${bestResult.similarity > baselineResult.similarity ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {bestResult.similarity > baselineResult.similarity ? "+" : ""}
                  {((bestResult.similarity - baselineResult.similarity) * 100).toFixed(1)}%
                </span>
              )}
            </Label>
            <div className="relative w-56 h-56 rounded-lg border border-border overflow-hidden bg-muted/50">
              <canvas ref={generatedCanvasRef} width={128} height={128} className="w-full h-full" />
              {!bestResult && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm bg-muted/80">
                  Run optimization
                </div>
              )}
            </div>
            {bestResult && (
              <span className="text-xs text-muted-foreground">
                Score: {(bestResult.similarity * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </main>
      
      {/* History sidebar */}
      {history.length > 0 && (
        <aside className="w-48 border-l border-border bg-sidebar p-4">
          <Label className="text-sm font-medium">History</Label>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-3">
            <div className="space-y-2">
              {history.map((result, i) => (
                <div
                  key={i}
                  className="p-2 rounded-md bg-muted/50 text-xs"
                >
                  <div className="font-medium">{(result.similarity * 100).toFixed(1)}%</div>
                  <div className="text-muted-foreground">Iter {result.iteration}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  )
}
