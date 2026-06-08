/**
 * WebGPU-based texture generator for optimization
 * Uses the exact same shaders as the front page preview
 */

import { generateShader } from "@/lib/shaders"
import type { TextureType } from "@/lib/texture-types"

export interface TextureGeneratorResult {
  imageData: ImageData
  canvas: HTMLCanvasElement
}

export class WebGPUTextureGenerator {
  private device: GPUDevice | null = null
  private initialized = false
  private initPromise: Promise<boolean> | null = null

  async init(): Promise<boolean> {
    if (this.initialized) return true
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        if (!navigator.gpu) {
          console.error("WebGPU not supported")
          return false
        }

        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          console.error("No WebGPU adapter")
          return false
        }

        this.device = await adapter.requestDevice()
        this.initialized = true
        return true
      } catch (err) {
        console.error("WebGPU init error:", err)
        return false
      }
    })()

    return this.initPromise
  }

  async generate(
    textureType: TextureType,
    params: Record<string, number | boolean | string>,
    size: number = 128
  ): Promise<TextureGeneratorResult | null> {
    if (!this.device) {
      const ok = await this.init()
      if (!ok || !this.device) return null
    }

    const device = this.device

    try {
      const shaderCode = generateShader(textureType, params, 0)

      const shaderModule = device.createShaderModule({ code: shaderCode })

      // Create texture to render to
      const texture = device.createTexture({
        size: { width: size, height: size },
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
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      })

      renderPass.setPipeline(pipeline)
      renderPass.draw(6)
      renderPass.end()

      // Read back pixels
      const bytesPerRow = Math.ceil(size * 4 / 256) * 256
      const bufferSize = bytesPerRow * size
      const readBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      commandEncoder.copyTextureToBuffer(
        { texture },
        { buffer: readBuffer, bytesPerRow },
        { width: size, height: size }
      )

      device.queue.submit([commandEncoder.finish()])

      await readBuffer.mapAsync(GPUMapMode.READ)
      const arrayBuffer = readBuffer.getMappedRange()
      const gpuData = new Uint8Array(arrayBuffer)

      // Create canvas and imageData
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")!
      const imageData = ctx.createImageData(size, size)

      // Copy pixels (handle row padding)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const srcIdx = y * bytesPerRow + x * 4
          const dstIdx = (y * size + x) * 4
          imageData.data[dstIdx] = gpuData[srcIdx]
          imageData.data[dstIdx + 1] = gpuData[srcIdx + 1]
          imageData.data[dstIdx + 2] = gpuData[srcIdx + 2]
          imageData.data[dstIdx + 3] = gpuData[srcIdx + 3]
        }
      }

      ctx.putImageData(imageData, 0, 0)

      // Cleanup
      readBuffer.unmap()
      texture.destroy()
      readBuffer.destroy()

      return { imageData, canvas }
    } catch (err) {
      console.error("Texture generation error:", err)
      return null
    }
  }

  destroy() {
    if (this.device) {
      this.device.destroy()
      this.device = null
      this.initialized = false
    }
  }
}

// Singleton instance for optimization
let generatorInstance: WebGPUTextureGenerator | null = null

export function getTextureGenerator(): WebGPUTextureGenerator {
  if (!generatorInstance) {
    generatorInstance = new WebGPUTextureGenerator()
  }
  return generatorInstance
}
