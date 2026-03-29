"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { TextureSidebar } from "@/components/texture-sidebar"
import { ShaderPlayground } from "@/components/shader-playground"
import { ParameterPanel } from "@/components/parameter-panel"
import { TextureCanvas, type TextureCanvasRef } from "@/components/texture-canvas"
import { ExampleCanvas, type ExampleCanvasRef } from "@/components/example-canvas"
import { CodeViewer } from "@/components/code-viewer"
import {
  type TextureType,
  getTextureDefinition,
  getDefaultParams,
  TEXTURE_DEFINITIONS,
} from "@/lib/texture-types"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

export function TextureApp() {
  const canvasRef = useRef<TextureCanvasRef>(null)
  const exampleCanvasRef = useRef<ExampleCanvasRef>(null)
  const [mounted, setMounted] = useState(false)
  const [selectedTexture, setSelectedTexture] = useState<TextureType>("perlin")
  const [showCode, setShowCode] = useState(false)
  const [showPlayground, setShowPlayground] = useState(false)
  const [params, setParams] = useState<Record<TextureType, Record<string, number | boolean | string>>>(() => {
    const initial: Record<string, Record<string, number | boolean | string>> = {}
    for (const def of TEXTURE_DEFINITIONS) {
      initial[def.id] = getDefaultParams(def)
    }
    return initial as Record<TextureType, Record<string, number | boolean | string>>
  })

  const currentDefinition = getTextureDefinition(selectedTexture)
  const currentParams = params[selectedTexture]

  const handleParamChange = useCallback((id: string, value: number | boolean | string) => {
    setParams((prev) => ({
      ...prev,
      [selectedTexture]: {
        ...prev[selectedTexture],
        [id]: value,
      },
    }))
  }, [selectedTexture])

  const handleReset = useCallback(() => {
    if (currentDefinition) {
      setParams((prev) => ({
        ...prev,
        [selectedTexture]: getDefaultParams(currentDefinition),
      }))
      toast.success("Parameters reset to defaults")
    }
  }, [selectedTexture, currentDefinition])

  const handleExport = useCallback(async () => {
    // Use the appropriate canvas ref based on texture type
    const isExample = selectedTexture === "efros-leung" || selectedTexture === "image-quilting"
    const ref = isExample ? exampleCanvasRef.current : canvasRef.current
    if (ref) {
      const blob = await ref.exportTexture()
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.download = `${selectedTexture}-texture.png`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
        toast.success("Texture exported as PNG")
      } else {
        toast.error("Failed to export texture")
      }
    }
  }, [selectedTexture])

  const handleSelectTexture = useCallback((texture: TextureType) => {
    setSelectedTexture(texture)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading Texture Lab...</div>
      </div>
    )
  }

  if (!currentDefinition) {
    return <div>Texture not found</div>
  }

  if (showPlayground) {
    return (
      <>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <ShaderPlayground onBack={() => setShowPlayground(false)} />
        </div>
        <Toaster position="bottom-center" />
      </>
    )
  }

  // Check if current texture is example-based (needs special canvas)
  const isExampleBased = selectedTexture === "efros-leung" || selectedTexture === "image-quilting"

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Left Sidebar - Navigation */}
        <TextureSidebar
          selectedTexture={selectedTexture}
          onSelectTexture={handleSelectTexture}
          onOpenPlayground={() => setShowPlayground(true)}
        />

        {/* Main Canvas Area */}
        <main className="flex-1 overflow-hidden">
          {isExampleBased ? (
            <ExampleCanvas
              ref={exampleCanvasRef}
              params={currentParams}
              textureType={selectedTexture}
            />
          ) : (
            <TextureCanvas
              ref={canvasRef}
              textureType={selectedTexture}
              params={currentParams}
            />
          )}
        </main>

        {/* Right Panel - Parameters */}
        <ParameterPanel
          definition={currentDefinition}
          params={currentParams}
          onParamChange={handleParamChange}
          onReset={handleReset}
          onShowCode={() => setShowCode(true)}
          onExport={handleExport}
          hideCodeButton={isExampleBased}
        />
      </div>

      {/* Code Viewer Dialog */}
      <CodeViewer
        open={showCode}
        onOpenChange={setShowCode}
        definition={currentDefinition}
        params={currentParams}
      />

      <Toaster position="bottom-center" />
    </>
  )
}
