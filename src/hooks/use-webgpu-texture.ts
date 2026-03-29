"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { TextureType } from "@/lib/texture-types"
import { generateShader } from "@/lib/shaders"

export function useWebGPUTexture(
  textureType: TextureType,
  params: Record<string, number | boolean | string>
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deviceRef = useRef<GPUDevice | null>(null)
  const contextRef = useRef<GPUCanvasContext | null>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(Date.now())

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      // Initialize WebGPU if needed
      if (!deviceRef.current) {
        if (!navigator.gpu) {
          setIsSupported(false)
          setError("WebGPU is not supported in this browser")
          return
        }

        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          setIsSupported(false)
          setError("No WebGPU adapter found")
          return
        }

        const device = await adapter.requestDevice()
        deviceRef.current = device

        const context = canvas.getContext("webgpu")
        if (!context) {
          setError("Could not get WebGPU context")
          return
        }
        contextRef.current = context

        const format = navigator.gpu.getPreferredCanvasFormat()
        context.configure({
          device,
          format,
          alphaMode: "premultiplied",
        })
      }

      const device = deviceRef.current
      const context = contextRef.current
      if (!device || !context) return

      const time = (Date.now() - startTimeRef.current) / 1000
      const shaderCode = generateShader(textureType, params, time)

      const shaderModule = device.createShaderModule({
        code: shaderCode,
      })

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
        },
        primitive: {
          topology: "triangle-list",
        },
      })

      const commandEncoder = device.createCommandEncoder()
      const textureView = context.getCurrentTexture().createView()

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      })

      renderPass.setPipeline(pipeline)
      renderPass.draw(6)
      renderPass.end()

      device.queue.submit([commandEncoder.finish()])

      // Continue animation if animate is enabled
      if (params.animate) {
        animationRef.current = requestAnimationFrame(() => render())
      }

    } catch (err) {
      console.error("WebGPU render error:", err)
      setError(err instanceof Error ? err.message : "Render error")
    }
  }, [textureType, params])

  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
    }
  }, [])

  // Export function that renders to a texture and reads back pixels
  const exportTexture = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current
    const device = deviceRef.current
    const context = contextRef.current
    if (!canvas || !device || !context) return null

    try {
      const width = canvas.width
      const height = canvas.height
      const time = (Date.now() - startTimeRef.current) / 1000
      const shaderCode = generateShader(textureType, params, time)

      const shaderModule = device.createShaderModule({ code: shaderCode })

      // Create a texture to render to
      const exportTextureGPU = device.createTexture({
        size: { width, height },
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      })

      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{ format: "rgba8unorm" }],
        },
        primitive: { topology: "triangle-list" },
      })

      const commandEncoder = device.createCommandEncoder()
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: exportTextureGPU.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      })

      renderPass.setPipeline(pipeline)
      renderPass.draw(6)
      renderPass.end()

      // Create buffer to read back pixels
      const bytesPerRow = Math.ceil(width * 4 / 256) * 256
      const bufferSize = bytesPerRow * height
      const readBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      commandEncoder.copyTextureToBuffer(
        { texture: exportTextureGPU },
        { buffer: readBuffer, bytesPerRow },
        { width, height }
      )

      device.queue.submit([commandEncoder.finish()])

      await readBuffer.mapAsync(GPUMapMode.READ)
      const arrayBuffer = readBuffer.getMappedRange()
      const data = new Uint8Array(arrayBuffer)

      // Create canvas to draw image data
      const exportCanvas = document.createElement("canvas")
      exportCanvas.width = width
      exportCanvas.height = height
      const ctx = exportCanvas.getContext("2d")!
      const imageData = ctx.createImageData(width, height)

      // Copy pixels (accounting for row padding)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = y * bytesPerRow + x * 4
          const dstIdx = (y * width + x) * 4
          imageData.data[dstIdx] = data[srcIdx]
          imageData.data[dstIdx + 1] = data[srcIdx + 1]
          imageData.data[dstIdx + 2] = data[srcIdx + 2]
          imageData.data[dstIdx + 3] = data[srcIdx + 3]
        }
      }

      ctx.putImageData(imageData, 0, 0)
      readBuffer.unmap()
      exportTextureGPU.destroy()
      readBuffer.destroy()

      return new Promise((resolve) => {
        exportCanvas.toBlob((blob) => resolve(blob), "image/png")
      })
    } catch (err) {
      console.error("Export error:", err)
      return null
    }
  }, [textureType, params])

  return { canvasRef, isSupported, error, exportTexture }
}
