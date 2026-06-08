"use client"

import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Play, AlertCircle, Square, FileText, Clock } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Maximum dimensions to prevent long processing times
const MAX_INPUT_SIZE = 128

import type { TextureType } from "@/lib/texture-types"

export interface ExampleCanvasRef {
  exportTexture: () => Promise<Blob | null>
  getLastGenerationTime: () => number | null
}

interface GenerationRecord {
  timestamp: number
  generationMs: number
  outputWidth: number
  outputHeight: number
  params: Record<string, number | string>
}

interface ExampleCanvasProps {
  params: Record<string, number | boolean | string>
  textureType: TextureType
}

// Resize image data to fit within max dimensions while preserving aspect ratio
function resizeImageData(imageData: ImageData, maxWidth: number, maxHeight: number): ImageData {
  const { width, height } = imageData
  
  if (width <= maxWidth && height <= maxHeight) {
    return imageData
  }
  
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const newWidth = Math.floor(width * scale)
  const newHeight = Math.floor(height * scale)
  
  // Create temporary canvases for resizing
  const srcCanvas = document.createElement("canvas")
  srcCanvas.width = width
  srcCanvas.height = height
  const srcCtx = srcCanvas.getContext("2d")!
  srcCtx.putImageData(imageData, 0, 0)
  
  const dstCanvas = document.createElement("canvas")
  dstCanvas.width = newWidth
  dstCanvas.height = newHeight
  const dstCtx = dstCanvas.getContext("2d")!
  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = "high"
  dstCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight)
  
  return dstCtx.getImageData(0, 0, newWidth, newHeight)
}

export const ExampleCanvas = forwardRef<ExampleCanvasRef, ExampleCanvasProps>(
  function ExampleCanvas({ params = {}, textureType }, ref) {
    const [sourceImage, setSourceImage] = useState<ImageData | null>(null)
    const [sourcePreview, setSourcePreview] = useState<string | null>(null)
    const [resultImage, setResultImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [elapsedTime, setElapsedTime] = useState<number | null>(null)
    const [intermediateResult, setIntermediateResult] = useState<string | null>(null)
    const [generationHistory, setGenerationHistory] = useState<GenerationRecord[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const workerRef = useRef<Worker | null>(null)
    const startTimeRef = useRef<number>(0)

    // Determine which algorithm we're using
    const isImageQuilting = textureType === "image-quilting"
    
  // Extract params based on algorithm
  // Common params
  const seed = String(params.seed || "42")
  // Efros-Leung params
  const neighborhoodSize = Number(params.neighborhoodSize) || 5
  // Image Quilting params
  const patchSize = Number(params.patchSize) || 32
  const overlapSize = Number(params.overlapSize) || 8
  // Common params
  const outputWidth = Number(params.outputWidth) || (isImageQuilting ? 256 : 128)
  const outputHeight = Number(params.outputHeight) || (isImageQuilting ? 256 : 128)
  const errorTolerance = Number(params.errorTolerance) || 0.1

    // Cleanup worker on unmount
    useEffect(() => {
      return () => {
        if (workerRef.current) {
          workerRef.current.terminate()
        }
      }
    }, [])

    useImperativeHandle(ref, () => ({
      exportTexture: async () => {
        if (!resultImage) return null
        const response = await fetch(resultImage)
        return response.blob()
      },
      getLastGenerationTime: () => elapsedTime,
    }))

    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File too large. Please use an image under 50MB.")
        return
      }

      const img = new Image()
      img.onload = () => {
        // Create canvas to get image data
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        
        let imageData = ctx.getImageData(0, 0, img.width, img.height)
        
        // Resize if needed
        if (img.width > MAX_INPUT_SIZE || img.height > MAX_INPUT_SIZE) {
          imageData = resizeImageData(imageData, MAX_INPUT_SIZE, MAX_INPUT_SIZE)
          toast.info(`Image resized to ${imageData.width}x${imageData.height} for faster processing`)
        }
        
        setSourceImage(imageData)
        
        // Create preview
        const previewCanvas = document.createElement("canvas")
        previewCanvas.width = imageData.width
        previewCanvas.height = imageData.height
        const previewCtx = previewCanvas.getContext("2d")!
        previewCtx.putImageData(imageData, 0, 0)
        setSourcePreview(previewCanvas.toDataURL())
        
        // Reset result
        setResultImage(null)
        setIntermediateResult(null)
        setElapsedTime(null)
        
        URL.revokeObjectURL(img.src)
      }
      
      img.onerror = () => {
        toast.error("Failed to load image")
      }
      
      img.src = URL.createObjectURL(file)
    }, [])

    const handleStop = useCallback(() => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
        setIsProcessing(false)
        toast.info("Synthesis cancelled")
      }
    }, [])

    const handleSynthesize = useCallback(async () => {
      if (!sourceImage) {
        toast.error("Please upload a source texture first")
        return
      }

      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate()
      }

      setIsProcessing(true)
      setProgress(0)
      setResultImage(null)
      setIntermediateResult(null)
      startTimeRef.current = Date.now()

      try {
        // Create appropriate worker based on algorithm
        const workerUrl = isImageQuilting
          ? new URL("../lib/workers/image-quilting.worker.js", import.meta.url)
          : new URL("../lib/workers/efros-leung.worker.js", import.meta.url)
        
        let worker: Worker
        try {
          worker = new Worker(workerUrl)
        } catch (workerError) {
          throw new Error(`Failed to create worker: ${workerError instanceof Error ? workerError.message : String(workerError)}`)
        }
        workerRef.current = worker

        worker.onmessage = (e) => {
          const data = e.data

          if (data.type === "progress") {
            setProgress(data.percent / 100)
            
            // Show intermediate result if available
            if (data.imageData) {
              const canvas = document.createElement("canvas")
              canvas.width = data.imageData.width
              canvas.height = data.imageData.height
              const ctx = canvas.getContext("2d")!
              ctx.putImageData(data.imageData, 0, 0)
              setIntermediateResult(canvas.toDataURL())
            }
          } else if (data.type === "complete") {
            const elapsed = Date.now() - startTimeRef.current
            
            // Convert result to data URL
            const canvas = document.createElement("canvas")
            canvas.width = data.imageData.width
            canvas.height = data.imageData.height
            const ctx = canvas.getContext("2d")!
            ctx.putImageData(data.imageData, 0, 0)
            setResultImage(canvas.toDataURL())
            setIntermediateResult(null)
            setElapsedTime(elapsed)
            setIsProcessing(false)
            
            // Record to history
            const record: GenerationRecord = {
              timestamp: Date.now(),
              generationMs: elapsed,
              outputWidth,
              outputHeight,
              params: isImageQuilting
                ? { seed, patchSize, overlapSize, errorTolerance }
                : { seed, neighborhoodSize, errorTolerance },
            }
            setGenerationHistory(prev => [...prev, record].slice(-20))
            
            toast.success(`Synthesis complete in ${(elapsed / 1000).toFixed(1)}s`)
            
            worker.terminate()
            workerRef.current = null
          } else if (data.type === "error") {
            setIsProcessing(false)
            toast.error(data.message || "Synthesis failed")
            
            worker.terminate()
            workerRef.current = null
          }
        }

        worker.onerror = (error) => {
          setIsProcessing(false)
          // Throw the full error so it appears in the console and v0 can see it
          const errorDetails = `Worker error - message: ${error.message}, filename: ${error.filename}, lineno: ${error.lineno}, colno: ${error.colno}`
          console.error(errorDetails, error)
          toast.error(errorDetails)
          throw new Error(errorDetails)
        }

        // Start synthesis with appropriate parameters
        // Convert ImageData to plain object for worker transfer
        const sourceDataObj = {
          data: new Uint8ClampedArray(sourceImage.data),
          width: sourceImage.width,
          height: sourceImage.height,
        }
        
      if (isImageQuilting) {
        worker.postMessage({
          type: "start",
          seed,
          sourceData: sourceDataObj,
          outputWidth: Math.min(outputWidth, 512),
          outputHeight: Math.min(outputHeight, 512),
          patchSize,
          overlapSize,
          errorTolerance,
        })
      } else {
        worker.postMessage({
          type: "start",
          seed,
          sourceData: sourceDataObj,
          outputWidth: Math.min(outputWidth, 256),
          outputHeight: Math.min(outputHeight, 256),
          neighborhoodSize,
          errorTolerance,
        })
      }
      } catch (error) {
        console.error("Synthesis error:", error)
        toast.error("Failed to start synthesis")
        setIsProcessing(false)
      }
    }, [sourceImage, isImageQuilting, seed, neighborhoodSize, patchSize, overlapSize, outputWidth, outputHeight, errorTolerance])

    // Calculate stats from history
    const historyStats = generationHistory.length > 0 ? {
      count: generationHistory.length,
      avg: generationHistory.reduce((sum, r) => sum + r.generationMs, 0) / generationHistory.length,
      min: Math.min(...generationHistory.map(r => r.generationMs)),
      max: Math.max(...generationHistory.map(r => r.generationMs)),
    } : null

    const handleDownloadReport = useCallback(() => {
      if (generationHistory.length === 0) {
        toast.error("No generation history to export")
        return
      }

      const methodName = isImageQuilting ? "Image Quilting" : "Efros-Leung"
      const stats = historyStats!

      // PDF Report
      const pdf = new jsPDF()
      pdf.setFontSize(18)
      pdf.text(`${methodName} Generation Report`, 14, 20)
      
      pdf.setFontSize(10)
      pdf.setTextColor(100)
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      pdf.text(`Method: ${methodName} (CPU-based, example-based synthesis)`, 14, 34)
      pdf.text(`Samples: ${stats.count}`, 14, 40)

      // Summary table
      autoTable(pdf, {
        startY: 48,
        head: [["Metric", "Value"]],
        body: [
          ["Average Generation Time", `${(stats.avg / 1000).toFixed(2)} seconds`],
          ["Minimum Generation Time", `${(stats.min / 1000).toFixed(2)} seconds`],
          ["Maximum Generation Time", `${(stats.max / 1000).toFixed(2)} seconds`],
          ["Total Samples", `${stats.count}`],
          ["Real-time Feasible?", stats.avg < 16 ? "Yes" : "No (exceeds 16ms frame budget)"],
        ],
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60] },
      })

      // Parameters from last run
      const lastRun = generationHistory[generationHistory.length - 1]
      const paramEntries = Object.entries(lastRun.params).map(([key, val]) => [
        key,
        String(val)
      ])
      paramEntries.push(["outputWidth", String(lastRun.outputWidth)])
      paramEntries.push(["outputHeight", String(lastRun.outputHeight)])
      
      autoTable(pdf, {
        startY: (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
        head: [["Parameter", "Value"]],
        body: paramEntries,
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60] },
      })

      // History table
      const historyData = generationHistory.map((r, i) => [
        String(i + 1),
        `${(r.generationMs / 1000).toFixed(2)}s`,
        `${r.outputWidth}x${r.outputHeight}`,
        new Date(r.timestamp).toLocaleTimeString(),
      ])

      autoTable(pdf, {
        startY: (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
        head: [["#", "Gen Time", "Output Size", "Timestamp"]],
        body: historyData,
        theme: "striped",
        headStyles: { fillColor: [60, 60, 60] },
      })

      pdf.save(`${methodName.toLowerCase().replace(" ", "-")}-report-${Date.now()}.pdf`)

      // Also export CSV
      const csvLines = [
        `# ${methodName} Generation Report`,
        `# Generated: ${new Date().toISOString()}`,
        `# Avg: ${(stats.avg / 1000).toFixed(2)}s, Min: ${(stats.min / 1000).toFixed(2)}s, Max: ${(stats.max / 1000).toFixed(2)}s`,
        `#`,
        `# Last Run Parameters:`,
        ...Object.entries(lastRun.params).map(([k, v]) => `# ${k}: ${v}`),
        `# outputWidth: ${lastRun.outputWidth}`,
        `# outputHeight: ${lastRun.outputHeight}`,
        `#`,
        `sample,generation_ms,generation_sec,output_width,output_height,timestamp`,
        ...generationHistory.map((r, i) => 
          `${i + 1},${r.generationMs},${(r.generationMs / 1000).toFixed(2)},${r.outputWidth},${r.outputHeight},${r.timestamp}`
        ),
      ]
      
      const csvBlob = new Blob([csvLines.join("\n")], { type: "text/csv" })
      const csvUrl = URL.createObjectURL(csvBlob)
      const csvLink = document.createElement("a")
      csvLink.href = csvUrl
      csvLink.download = `${methodName.toLowerCase().replace(" ", "-")}-data-${Date.now()}.csv`
      csvLink.click()
      URL.revokeObjectURL(csvUrl)

      toast.success("Report downloaded (PDF + CSV)")
    }, [generationHistory, historyStats, isImageQuilting])

    // Display image (intermediate or final)
    const displayResult = resultImage || intermediateResult

    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 p-8 overflow-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Main content area */}
        <div className="w-full max-w-4xl space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              This algorithm runs on CPU (in a background thread). Processing time depends 
              on output size and neighborhood size. You can cancel at any time.
            </p>
          </div>

          {/* Source and Result side by side */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Source Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Source Texture</h3>
              <div 
                className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-border bg-background cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                {sourcePreview ? (
                  <img
                    src={sourcePreview}
                    alt="Source texture"
                    className="h-full w-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Upload className="h-10 w-10" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs">or drag and drop</p>
                    </div>
                  </div>
                )}
              </div>
              {sourceImage && (
                <p className="text-xs text-muted-foreground text-center">
                  {sourceImage.width} x {sourceImage.height} pixels
                </p>
              )}
            </div>

            {/* Result Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Synthesized Texture</h3>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-background">
                {displayResult ? (
                  <img
                    src={displayResult}
                    alt="Synthesized texture"
                    className="h-full w-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    {isProcessing ? (
                      <div className="text-center space-y-3 w-3/4">
                        <div className="text-sm font-medium">Initializing...</div>
                        <Progress value={progress * 100} className="h-2" />
                        <div className="text-xs">0% complete</div>
                      </div>
                    ) : (
                      <p className="text-sm">Result will appear here</p>
                    )}
                  </div>
                )}
                
                {/* Progress overlay when we have intermediate result */}
                {isProcessing && displayResult && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                    <Progress value={progress * 100} className="h-2 mb-2" />
                    <div className="text-xs text-center">{Math.round(progress * 100)}% complete</div>
                  </div>
                )}
              </div>
              {resultImage && elapsedTime && (
                <p className="text-xs text-muted-foreground text-center">
                  {outputWidth} x {outputHeight} pixels | Generated in {(elapsedTime / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            {isProcessing ? (
              <Button
                size="lg"
                variant="destructive"
                className="gap-2 px-8"
                onClick={handleStop}
              >
                <Square className="h-4 w-4" />
                Cancel
              </Button>
            ) : (
              <Button
                size="lg"
                className="gap-2 px-8"
                onClick={handleSynthesize}
                disabled={!sourceImage}
              >
                <Play className="h-4 w-4" />
                Synthesize Texture
              </Button>
            )}
          </div>

          {/* Generation Metrics Panel */}
          {(elapsedTime || historyStats) && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Generation Metrics
                </h3>
                {historyStats && (
                  <span className="text-xs text-muted-foreground">{historyStats.count} samples</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {elapsedTime && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Last Run</p>
                    <p className="text-lg font-semibold tabular-nums">{(elapsedTime / 1000).toFixed(2)}s</p>
                    <p className="text-xs text-muted-foreground">{elapsedTime.toFixed(0)} ms</p>
                  </div>
                )}
                {historyStats && (
                  <>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-lg font-semibold tabular-nums">{(historyStats.avg / 1000).toFixed(2)}s</p>
                      <p className="text-xs text-muted-foreground">{historyStats.avg.toFixed(0)} ms</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Min</p>
                      <p className="text-lg font-semibold tabular-nums">{(historyStats.min / 1000).toFixed(2)}s</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Max</p>
                      <p className="text-lg font-semibold tabular-nums">{(historyStats.max / 1000).toFixed(2)}s</p>
                    </div>
                  </>
                )}
              </div>

              {/* Real-time feasibility indicator */}
              {historyStats && (
                <div className={`rounded-md p-3 text-sm ${historyStats.avg < 16 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  {historyStats.avg < 16 
                    ? "Real-time feasible (under 16ms frame budget)"
                    : `Not real-time feasible: ${(historyStats.avg / 1000).toFixed(2)}s avg is ${Math.round(historyStats.avg / 16)}x slower than 16ms frame budget`
                  }
                </div>
              )}

              {historyStats && historyStats.count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadReport}
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Download Report (PDF + CSV)
                </Button>
              )}
            </div>
          )}

          {/* Algorithm info */}
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">
              {isImageQuilting ? "About Image Quilting (Efros-Freeman)" : "About Efros-Leung Synthesis"}
            </p>
            <p className="leading-relaxed">
              {isImageQuilting ? (
                <>
                  This algorithm synthesizes textures by copying and stitching together <strong>patches</strong> from the source image, 
                  rather than individual pixels. For each new patch, it finds regions that best match the overlap 
                  with already-placed patches, then uses a <strong>minimum error boundary cut</strong> to seamlessly blend them together. 
                  This is significantly faster than pixel-by-pixel methods while preserving larger structures.
                </>
              ) : (
                <>
                  This algorithm grows a texture pixel-by-pixel by finding similar neighborhoods 
                  in the source image. For each new pixel, it searches for regions in the source 
                  that match the already-filled surroundings, then copies the center pixel from 
                  a matching region.
                </>
              )}
            </p>
          </div>

          {/* GPU limitations explanation */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Why Not GPU?</p>
            <p className="leading-relaxed mb-2">
              Unlike procedural algorithms (Perlin, Simplex, Worley), example-based synthesis cannot easily run on GPU because:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Sequential dependency</strong>: Each {isImageQuilting ? "patch" : "pixel"} needs results from previously computed {isImageQuilting ? "patches" : "pixels"}</li>
              <li><strong>Global search</strong>: Must search the entire source image for each output {isImageQuilting ? "patch" : "pixel"}</li>
              <li><strong>Unpredictable memory access</strong>: Cannot coalesce memory reads like GPU prefers</li>
              <li><strong>Heavy branching</strong>: {isImageQuilting ? "Minimum cut computation" : "Finding best matches"} requires conditional logic GPUs dislike</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }
)
