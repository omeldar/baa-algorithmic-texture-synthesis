"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Download, RotateCcw, Save, AlertCircle } from "lucide-react"
import { toast } from "sonner"

const DEFAULT_SHADER = `// Shader Playground - Checkerboard Pattern
// Edit this WGSL code and click "Run" to see the result
//
// Available uniforms:
//   params.time       - elapsed time in seconds
//   params.resolution - canvas size in pixels (vec2f)

struct Params {
    time: f32,
    resolution: vec2f,
}

@group(0) @binding(0) var<uniform> params: Params;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // Number of squares per row/column
    let gridSize = 8.0;
    
    // Scale UV to grid
    let gridUV = floor(uv * gridSize);
    
    // Checkerboard pattern: alternate black and white
    let checker = (gridUV.x + gridUV.y) % 2.0;
    
    // Black or white
    let color = vec3f(checker);
    
    return vec4f(color, 1.0);
}
`

interface ShaderPlaygroundProps {
  onBack: () => void
}

export function ShaderPlayground({ onBack }: ShaderPlaygroundProps) {
  const [code, setCode] = useState(DEFAULT_SHADER)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [gpuSupported, setGpuSupported] = useState<boolean | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const deviceRef = useRef<GPUDevice | null>(null)
  const contextRef = useRef<GPUCanvasContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const pipelineRef = useRef<GPURenderPipeline | null>(null)

  // Check WebGPU support on mount
  useEffect(() => {
    const checkGPU = async () => {
      if (!navigator.gpu) {
        setGpuSupported(false)
        setError("WebGPU is not supported in this browser")
        return
      }
      const adapter = await navigator.gpu.requestAdapter()
      setGpuSupported(!!adapter)
      if (!adapter) {
        setError("No WebGPU adapter found")
      }
    }
    checkGPU()
  }, [])

  const vertexShader = `
    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) uv: vec2f,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
      var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0)
      );
      
      var output: VertexOutput;
      output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
      output.uv = (pos[vertexIndex] + 1.0) * 0.5;
      output.uv.y = 1.0 - output.uv.y;
      return output;
    }
  `

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  const runShader = useCallback(async () => {
    if (!canvasRef.current) return

    stopAnimation()
    setError(null)

    try {
      if (!navigator.gpu) {
        throw new Error("WebGPU is not supported in this browser")
      }

      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) throw new Error("No GPU adapter found")

      const device = await adapter.requestDevice()
      deviceRef.current = device

      const context = canvasRef.current.getContext("webgpu")
      if (!context) throw new Error("Could not get WebGPU context")
      contextRef.current = context

      const format = navigator.gpu.getPreferredCanvasFormat()
      context.configure({ device, format, alphaMode: "premultiplied" })

      // Create pipeline with user shader
      const fullShaderCode = vertexShader + "\n" + code
      
      const shaderModule = device.createShaderModule({
        code: fullShaderCode,
      })

      // Check for compilation errors
      const compilationInfo = await shaderModule.getCompilationInfo()
      const errors = compilationInfo.messages.filter(m => m.type === "error")
      if (errors.length > 0) {
        throw new Error(errors.map(e => `Line ${e.lineNum}: ${e.message}`).join("\n"))
      }

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{ format }],
        },
        primitive: { topology: "triangle-list" },
      })

      pipelineRef.current = pipeline

      // Create uniform buffer
      const uniformBuffer = device.createBuffer({
        size: 16, // time (f32) + padding + resolution (vec2f)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      })

      setIsRunning(true)
      const startTime = performance.now()

      const render = () => {
        const time = (performance.now() - startTime) / 1000

        // Update uniforms
        const uniformData = new Float32Array([
          time,
          0, // padding
          canvasRef.current?.width || 512,
          canvasRef.current?.height || 512,
        ])
        device.queue.writeBuffer(uniformBuffer, 0, uniformData)

        const commandEncoder = device.createCommandEncoder()
        const textureView = context.getCurrentTexture().createView()

        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        })

        renderPass.setPipeline(pipeline)
        renderPass.setBindGroup(0, bindGroup)
        renderPass.draw(6)
        renderPass.end()

        device.queue.submit([commandEncoder.finish()])
        animationRef.current = requestAnimationFrame(render)
      }

      render()
      toast.success("Shader compiled successfully")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setIsRunning(false)
      toast.error("Shader compilation failed")
    }
  }, [code, stopAnimation, vertexShader])

  const handleReset = useCallback(() => {
    setCode(DEFAULT_SHADER)
    stopAnimation()
    setIsRunning(false)
    setError(null)
    toast.info("Shader reset to default")
  }, [stopAnimation])

  const handleExport = useCallback(() => {
    if (canvasRef.current) {
      const link = document.createElement("a")
      link.download = "custom-shader-texture.png"
      link.href = canvasRef.current.toDataURL("image/png")
      link.click()
      toast.success("Texture exported as PNG")
    }
  }, [])

  const handleSaveShader = useCallback(() => {
    const blob = new Blob([code], { type: "text/plain" })
    const link = document.createElement("a")
    link.download = "custom-shader.wgsl"
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success("Shader saved as .wgsl file")
  }, [code])

  useEffect(() => {
    return () => {
      stopAnimation()
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
    }
  }, [stopAnimation])

  return (
    <div className="flex h-full w-full">
      {/* Editor Panel */}
      <div className="flex w-1/2 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Shader Editor</h2>
            <p className="text-xs text-muted-foreground">Write WGSL code</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveShader}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
            <Button size="sm" onClick={runShader} disabled={gpuSupported === false}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Run
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <pre className="flex-1 whitespace-pre-wrap text-xs text-destructive">{error}</pre>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-full min-h-[calc(100vh-180px)] w-full resize-none rounded-md border border-border bg-muted/30 p-4 font-mono text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
              placeholder="Write your WGSL shader code here..."
            />
          </div>
        </ScrollArea>
      </div>

      {/* Preview Panel */}
      <div className="flex w-1/2 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Preview</h2>
            <p className="text-xs text-muted-foreground">
              {isRunning ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Shader running
                </span>
              ) : "Click Run to preview"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!isRunning}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export PNG
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center bg-muted/20 p-8">
          <div className="relative overflow-hidden rounded-lg border border-border shadow-lg">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="block bg-black"
            />
            {!isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 gap-2">
                {gpuSupported === false ? (
                  <>
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-destructive font-medium">WebGPU not supported</p>
                    <p className="text-xs text-muted-foreground text-center px-4">
                      Try using Chrome, Edge, or another WebGPU-compatible browser
                    </p>
                  </>
                ) : gpuSupported === null ? (
                  <p className="text-sm text-muted-foreground">Checking WebGPU support...</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click "Run" to compile and preview your shader
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
