"use client"

import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Play, AlertCircle, Square } from "lucide-react"
import { toast } from "sonner"

// Maximum dimensions to prevent long processing times
const MAX_INPUT_SIZE = 128

import type { TextureType } from "@/lib/texture-types"

export interface ExampleCanvasRef {
  exportTexture: () => Promise<Blob | null>
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
    const fileInputRef = useRef<HTMLInputElement>(null)
    const workerRef = useRef<Worker | null>(null)
    const startTimeRef = useRef<number>(0)

    // Determine which algorithm we're using
    const isImageQuilting = textureType === "image-quilting"
    
    // Extract params based on algorithm
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
      }
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
    }, [sourceImage, isImageQuilting, neighborhoodSize, patchSize, overlapSize, outputWidth, outputHeight, errorTolerance])

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
