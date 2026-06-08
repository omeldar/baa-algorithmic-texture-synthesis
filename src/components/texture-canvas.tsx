"use client"

import { useWebGPUTexture, type GenerationTiming } from "@/hooks/use-webgpu-texture"
import type { TextureType } from "@/lib/texture-types"
import { AlertCircle, Cpu, Clock } from "lucide-react"
import { forwardRef, useImperativeHandle } from "react"

interface TextureCanvasProps {
  textureType: TextureType
  params: Record<string, number | boolean | string>
  onTimingUpdate?: (timing: { lastMs: number | null, history: GenerationTiming[] }) => void
}

export interface TextureCanvasRef {
  exportTexture: () => Promise<Blob | null>
  getGenerationHistory: () => GenerationTiming[]
  clearHistory: () => void
}

export const TextureCanvas = forwardRef<TextureCanvasRef, TextureCanvasProps>(
  function TextureCanvas({ textureType, params, onTimingUpdate }, ref) {
  const { canvasRef, isSupported, error, exportTexture, lastGenerationMs, generationHistory, clearHistory } = useWebGPUTexture(textureType, params)

  useImperativeHandle(ref, () => ({
    exportTexture,
    getGenerationHistory: () => generationHistory,
    clearHistory,
  }), [exportTexture, generationHistory, clearHistory])

  if (!isSupported) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/30 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            WebGPU Not Supported
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your browser does not support WebGPU. Please try using Chrome 113+, Edge 113+, 
            or another browser with WebGPU enabled.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-left text-xs">
          <p className="font-medium text-foreground">To enable WebGPU:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>Chrome/Edge: Enable via chrome://flags/#enable-unsafe-webgpu</li>
            <li>Firefox: Enable via about:config dom.webgpu.enabled</li>
            <li>Safari: Enable via Develop menu → Feature Flags</li>
          </ul>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/30 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Render Error
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-muted/20 p-8">
      {/* Grid pattern background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
      
      <div className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-lg border border-border shadow-2xl">
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className="h-full w-full"
        />
        
        {/* WebGPU badge + timing */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3">
          {lastGenerationMs !== null && (
            <div className="flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur">
              <Clock className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground tabular-nums">{lastGenerationMs.toFixed(2)} ms</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur">
            <Cpu className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">WebGPU</span>
          </div>
        </div>
      </div>
    </div>
  )
})
