"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import type { TextureDefinition, TextureParameter } from "@/lib/texture-types"
import { Code2, RotateCcw, Download } from "lucide-react"

interface ParameterPanelProps {
  definition: TextureDefinition
  params: Record<string, number | boolean | string>
  onParamChange: (id: string, value: number | boolean | string) => void
  onReset: () => void
  onShowCode?: () => void
  onExport: () => void
  hideCodeButton?: boolean
}

/**
 * Renders a description text below the parameter control
 * Helps beginners understand what each parameter does
 */
function ParameterDescription({ description }: { description?: string }) {
  if (!description) return null
  return (
    <p className="mt-1.5 text-xs text-muted-foreground/80 leading-relaxed">
      {description}
    </p>
  )
}

function ParameterControl({
  param,
  value,
  onChange,
}: {
  param: TextureParameter
  value: number | boolean | string
  onChange: (value: number | boolean | string) => void
}) {
  switch (param.type) {
    case "slider":
      return (
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel className="text-sm">{param.label}</FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums">
              {typeof value === "number" ? value.toFixed(param.step && param.step < 1 ? 2 : 0) : value}
            </span>
          </div>
          <Slider
            value={[Number(value)]}
            onValueChange={(v) => onChange(v[0])}
            min={param.min}
            max={param.max}
            step={param.step}
            className="mt-2"
          />
          <ParameterDescription description={param.description} />
        </Field>
      )

    case "checkbox":
      return (
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel className="text-sm">{param.label}</FieldLabel>
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(checked) => onChange(checked)}
            />
          </div>
          <ParameterDescription description={param.description} />
        </Field>
      )

    case "text":
      return (
        <Field>
          <FieldLabel className="text-sm">{param.label}</FieldLabel>
          <Input
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 h-8 bg-input"
          />
          <ParameterDescription description={param.description} />
        </Field>
      )

    case "color":
      return (
        <Field>
          <FieldLabel className="text-sm">{param.label}</FieldLabel>
          <Input
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 h-8 w-full cursor-pointer"
          />
          <ParameterDescription description={param.description} />
        </Field>
      )

    default:
      return null
  }
}

export function ParameterPanel({
  definition,
  params,
  onParamChange,
  onReset,
  onShowCode,
  onExport,
  hideCodeButton = false,
}: ParameterPanelProps) {
  return (
    <aside className="flex h-full max-h-screen w-80 flex-col border-l border-border bg-card">
      {/* Header - fixed at top */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <h2 className="text-base font-semibold text-card-foreground">
          {definition.name}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {definition.description}
        </p>
      </div>

      {/* Scrollable parameters area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <FieldGroup>
              {definition.parameters.map((param) => (
                <ParameterControl
                  key={param.id}
                  param={param}
                  value={params[param.id]}
                  onChange={(value) => onParamChange(param.id, value)}
                />
              ))}
            </FieldGroup>
          </div>
        </ScrollArea>
      </div>

      {/* Action buttons - fixed at bottom */}
      <div className="flex-shrink-0 border-t border-border p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex-1"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="flex-1"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        </div>
        {!hideCodeButton && onShowCode && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowCode}
            className="mt-2 w-full"
          >
            <Code2 className="mr-1.5 h-3.5 w-3.5" />
            View Shader Code
          </Button>
        )}
      </div>
    </aside>
  )
}
