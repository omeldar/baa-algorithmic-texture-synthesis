"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { TextureSidebar } from "@/components/texture-sidebar"
import { TextureShowcase } from "@/components/texture-showcase"
import { ParameterPanel } from "@/components/parameter-panel"
import { TextureCanvas, type TextureCanvasRef } from "@/components/texture-canvas"
import { ExampleCanvas, type ExampleCanvasRef } from "@/components/example-canvas"
import { OptimisationCanvas, type OptimisationCanvasRef } from "@/components/optimisation-canvas"
import { CodeViewer } from "@/components/code-viewer"
import { TextureOptimizer } from "@/components/texture-optimizer"
import {
  type TextureType,
  getTextureDefinition,
  getDefaultParams,
  TEXTURE_DEFINITIONS,
} from "@/lib/texture-types"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import type { GenerationTiming } from "@/hooks/use-webgpu-texture"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export function TextureApp() {
  const canvasRef = useRef<TextureCanvasRef>(null)
  const exampleCanvasRef = useRef<ExampleCanvasRef>(null)
  const optimisationCanvasRef = useRef<OptimisationCanvasRef>(null)
  const [mounted, setMounted] = useState(false)
  const [selectedTexture, setSelectedTexture] = useState<TextureType>("perlin")
  const [showCode, setShowCode] = useState(false)
  const [showShowcase, setShowShowcase] = useState(false)
  const [showOptimizer, setShowOptimizer] = useState(false)
  const [generationHistory, setGenerationHistory] = useState<GenerationTiming[]>([])
  const [lastGenerationMs, setLastGenerationMs] = useState<number | null>(null)
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
    const isOptimisation = selectedTexture === "optimisation-based"
    const ref = isOptimisation 
      ? optimisationCanvasRef.current 
      : isExample 
        ? exampleCanvasRef.current 
        : canvasRef.current
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

  const handleApplyOptimizedParams = useCallback((optimizedParams: Record<string, number | boolean | string>) => {
    setParams((prev) => ({
      ...prev,
      wood: optimizedParams,
    }))
    setShowOptimizer(false)
    setSelectedTexture("wood")
    toast.success("Optimized parameters applied to Wood texture")
  }, [])

  // Sync generation history from canvas ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (canvasRef.current) {
        const history = canvasRef.current.getGenerationHistory()
        if (history.length > 0) {
          setGenerationHistory(history)
          setLastGenerationMs(history[history.length - 1]?.generationMs ?? null)
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [selectedTexture])

  const handleClearHistory = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clearHistory()
    }
    setGenerationHistory([])
    setLastGenerationMs(null)
    toast.success("Generation history cleared")
  }, [])

  const handleDownloadReport = useCallback(() => {
    if (generationHistory.length === 0) {
      toast.error("No generation history to export")
      return
    }

    const stats = {
      count: generationHistory.length,
      avg: generationHistory.reduce((sum, t) => sum + t.generationMs, 0) / generationHistory.length,
      min: Math.min(...generationHistory.map(t => t.generationMs)),
      max: Math.max(...generationHistory.map(t => t.generationMs)),
    }

    // PDF Report
    const pdf = new jsPDF()
    pdf.setFontSize(18)
    pdf.text("Texture Generation Report", 14, 20)
    
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
    pdf.text(`Method: ${currentDefinition?.name || selectedTexture}`, 14, 34)
    pdf.text(`Samples: ${stats.count}`, 14, 40)

    // Summary table
    autoTable(pdf, {
      startY: 48,
      head: [["Metric", "Value"]],
      body: [
        ["Average Generation Time", `${stats.avg.toFixed(3)} ms`],
        ["Minimum Generation Time", `${stats.min.toFixed(3)} ms`],
        ["Maximum Generation Time", `${stats.max.toFixed(3)} ms`],
        ["Total Samples", `${stats.count}`],
      ],
      theme: "striped",
      headStyles: { fillColor: [60, 60, 60] },
    })

    // Parameters table
    const paramEntries = Object.entries(currentParams).map(([key, val]) => [
      key,
      typeof val === "number" ? val.toFixed(4) : String(val)
    ])
    
    autoTable(pdf, {
      startY: (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
      head: [["Parameter", "Value"]],
      body: paramEntries,
      theme: "striped",
      headStyles: { fillColor: [60, 60, 60] },
    })

    // Generation history table (last 50)
    const historyData = generationHistory.slice(-50).map((t, i) => [
      String(i + 1),
      t.generationMs.toFixed(3),
      new Date(t.timestamp).toLocaleTimeString(),
    ])

    autoTable(pdf, {
      startY: (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
      head: [["#", "Gen Time (ms)", "Timestamp"]],
      body: historyData,
      theme: "striped",
      headStyles: { fillColor: [60, 60, 60] },
    })

    pdf.save(`texture-report-${selectedTexture}-${Date.now()}.pdf`)

    // Also export CSV
    const csvLines = [
      `# Texture Generation Report`,
      `# Method: ${currentDefinition?.name || selectedTexture}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Avg: ${stats.avg.toFixed(3)} ms, Min: ${stats.min.toFixed(3)} ms, Max: ${stats.max.toFixed(3)} ms`,
      `#`,
      `# Parameters:`,
      ...Object.entries(currentParams).map(([k, v]) => `# ${k}: ${v}`),
      `#`,
      `sample,generation_ms,timestamp`,
      ...generationHistory.map((t, i) => `${i + 1},${t.generationMs.toFixed(3)},${t.timestamp}`),
    ]
    
    const csvBlob = new Blob([csvLines.join("\n")], { type: "text/csv" })
    const csvUrl = URL.createObjectURL(csvBlob)
    const csvLink = document.createElement("a")
    csvLink.href = csvUrl
    csvLink.download = `texture-data-${selectedTexture}-${Date.now()}.csv`
    csvLink.click()
    URL.revokeObjectURL(csvUrl)

    toast.success("Report downloaded (PDF + CSV)")
  }, [generationHistory, currentDefinition, selectedTexture, currentParams])

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

  if (showShowcase) {
    return (
      <>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <TextureShowcase onBack={() => setShowShowcase(false)} />
        </div>
        <Toaster position="bottom-center" />
      </>
    )
  }

  if (showOptimizer) {
    return (
      <>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <TextureOptimizer
            onBack={() => setShowOptimizer(false)}
            onApplyParams={handleApplyOptimizedParams}
            currentParams={params.wood}
          />
        </div>
        <Toaster position="bottom-center" />
      </>
    )
  }

  // Check if current texture is example-based or optimisation-based (needs special canvas)
  const isExampleBased = selectedTexture === "efros-leung" || selectedTexture === "image-quilting"
  const isOptimisationBased = selectedTexture === "optimisation-based"

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Left Sidebar - Navigation */}
        <TextureSidebar
          selectedTexture={selectedTexture}
          onSelectTexture={handleSelectTexture}
          onOpenShowcase={() => setShowShowcase(true)}
          onOpenOptimizer={() => setShowOptimizer(true)}
        />

        {/* Main Canvas Area */}
        <main className="flex-1 overflow-hidden">
          {isOptimisationBased ? (
            <OptimisationCanvas
              ref={optimisationCanvasRef}
              params={currentParams}
            />
          ) : isExampleBased ? (
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
          hideCodeButton={isExampleBased || isOptimisationBased}
          lastGenerationMs={!isExampleBased && !isOptimisationBased ? lastGenerationMs : undefined}
          generationHistory={!isExampleBased && !isOptimisationBased ? generationHistory : undefined}
          onClearHistory={!isExampleBased && !isOptimisationBased ? handleClearHistory : undefined}
          onDownloadReport={!isExampleBased && !isOptimisationBased && generationHistory.length > 0 ? handleDownloadReport : undefined}
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
