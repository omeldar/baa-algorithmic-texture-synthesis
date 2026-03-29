"use client"

import { cn } from "@/lib/utils"
import { TEXTURE_DEFINITIONS, type TextureType } from "@/lib/texture-types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Code2 } from "lucide-react"

interface TextureSidebarProps {
  selectedTexture: TextureType
  onSelectTexture: (texture: TextureType) => void
  onOpenPlayground?: () => void
}

const categoryLabels = {
  procedural: "Procedural",
  "rule-based": "Rule-Based",
  "example-based": "Example-Based",
  optimisation: "Optimisation",
}

const categoryColors = {
  procedural: "bg-primary/20 text-primary border-primary/30",
  "rule-based": "bg-chart-2/20 text-chart-2 border-chart-2/30",
  "example-based": "bg-chart-4/20 text-chart-4 border-chart-4/30",
  optimisation: "bg-chart-5/20 text-chart-5 border-chart-5/30",
}

export function TextureSidebar({ selectedTexture, onSelectTexture, onOpenPlayground }: TextureSidebarProps) {
  // Group textures by category
  const grouped = TEXTURE_DEFINITIONS.reduce(
    (acc, tex) => {
      if (!acc[tex.category]) {
        acc[tex.category] = []
      }
      acc[tex.category].push(tex)
      return acc
    },
    {} as Record<string, typeof TEXTURE_DEFINITIONS>
  )

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-sidebar-border p-4">
        <h1 className="text-lg font-semibold text-sidebar-foreground">
          Texture Synthesis Lab
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          WebGPU Procedural Textures
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {Object.entries(categoryLabels).map(([category, label]) => {
            // Skip if no textures in this category
            if (!grouped[category] || grouped[category].length === 0) {
              return null
            }

            return (
              <div key={category} className="mb-4">
                <div className="mb-2 flex items-center gap-2 px-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  <div className="h-px flex-1 bg-sidebar-border" />
                </div>

                <div className="space-y-1">
                  {grouped[category]?.map((texture) => (
                    <button
                      key={texture.id}
                      onClick={() => onSelectTexture(texture.id)}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors",
                        selectedTexture === texture.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                          selectedTexture === texture.id
                            ? "bg-primary"
                            : "bg-muted-foreground/40 group-hover:bg-muted-foreground"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{texture.name}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {texture.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-4 space-y-3">
        {onOpenPlayground && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={onOpenPlayground}
          >
            <Code2 className="h-4 w-4" />
            Shader Playground
          </Button>
        )}
        <Badge
          variant="outline"
          className={cn(
            "w-full justify-center py-1 text-xs",
            categoryColors[
              TEXTURE_DEFINITIONS.find((t) => t.id === selectedTexture)?.category || "procedural"
            ]
          )}
        >
          {categoryLabels[
            TEXTURE_DEFINITIONS.find((t) => t.id === selectedTexture)?.category || "procedural"
          ]}
        </Badge>
      </div>
    </aside>
  )
}
