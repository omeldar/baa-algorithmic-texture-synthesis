"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Check, ExternalLink } from "lucide-react"
import { useState, useMemo } from "react"
import type { TextureDefinition, TextureType } from "@/lib/texture-types"
import { generateShader, hasShader } from "@/lib/shaders"

interface CodeViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: TextureDefinition
  params: Record<string, number | boolean | string>
}

/**
 * CodeViewer Component
 * 
 * Displays the generated WGSL shader code for a texture type with
 * syntax highlighting. The code shown reflects the current parameter
 * values, so users can see exactly what shader code will be executed.
 */
export function CodeViewer({ open, onOpenChange, definition, params }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)

  // Generate shader code based on current parameters
  // Returns null for non-shader texture types (e.g., example-based)
  const shaderCode = useMemo(() => {
    if (!hasShader(definition.id as TextureType)) {
      return null
    }
    return generateShader(definition.id as TextureType, params, 0)
  }, [definition.id, params])

  // Don't render dialog if no shader code available
  if (!shaderCode) {
    return null
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shaderCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{definition.name}</span>
            <span className="text-sm font-normal text-muted-foreground">
              WGSL Shader
            </span>
          </DialogTitle>
          <DialogDescription>
            WebGPU Shading Language (WGSL) implementation of the {definition.name.toLowerCase()} algorithm.
            This code reflects your current parameter settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative min-h-0">
          <div className="absolute right-2 top-2 z-10 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="h-[70vh] w-full rounded-lg border border-border bg-muted/50" orientation="both">
            <div className="min-w-max">
              <pre className="p-4 text-sm whitespace-pre font-mono">
                <code className="language-wgsl text-foreground">
                {shaderCode.split('\n').map((line, i) => (
                  <div key={i} className="flex hover:bg-muted/30">
                    <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground/50 font-mono">
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      {highlightWGSL(line)}
                    </span>
                  </div>
                ))}
                </code>
              </pre>
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            This shader is designed for WebGPU and uses WGSL syntax.
          </p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            asChild
          >
            <a
              href="https://www.w3.org/TR/WGSL/"
              target="_blank"
              rel="noopener noreferrer"
            >
              WGSL Specification
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// WGSL SYNTAX HIGHLIGHTING
// ============================================

/**
 * WGSL language keywords for syntax highlighting
 */
const WGSL_KEYWORDS = [
  'fn', 'var', 'let', 'const', 'return', 'if', 'else', 'for', 'while', 
  'struct', 'break', 'continue', 'discard', 'switch', 'case', 'default',
  'loop', 'continuing', 'enable', 'override'
]

/**
 * WGSL shader stage and attribute keywords
 */
const WGSL_ATTRIBUTES = [
  '@fragment', '@vertex', '@compute', '@location', '@builtin', '@group', 
  '@binding', '@workgroup_size', '@stage', '@interpolate'
]

/**
 * WGSL built-in types
 */
const WGSL_TYPES = [
  'f32', 'i32', 'u32', 'f16', 'bool',
  'vec2f', 'vec3f', 'vec4f', 'vec2i', 'vec3i', 'vec4i', 'vec2u', 'vec3u', 'vec4u',
  'vec2', 'vec3', 'vec4',
  'mat2x2f', 'mat3x3f', 'mat4x4f', 'mat2x2', 'mat3x3', 'mat4x4',
  'array', 'ptr', 'sampler', 'texture_2d'
]

/**
 * WGSL built-in functions
 */
const WGSL_BUILTINS = [
  'floor', 'fract', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'dot', 'length', 'normalize', 'cross', 'reflect', 'refract',
  'mix', 'clamp', 'abs', 'min', 'max', 'pow', 'sqrt', 'exp', 'exp2', 'log', 'log2',
  'smoothstep', 'step', 'select', 'sign', 'ceil', 'round', 'trunc',
  'fma', 'saturate', 'distance', 'inverseSqrt'
]

/**
 * Simple WGSL syntax highlighting
 * Applies color classes to keywords, types, numbers, and comments
 */
function highlightWGSL(line: string): React.ReactNode {
  // Handle comments (entire line)
  if (line.trim().startsWith('//')) {
    return <span className="text-muted-foreground italic">{line}</span>
  }

  // Handle inline comments
  const commentIndex = line.indexOf('//')
  let codePart = line
  let commentPart = ''
  
  if (commentIndex !== -1) {
    codePart = line.substring(0, commentIndex)
    commentPart = line.substring(commentIndex)
  }

  // Tokenize the code part
  const tokens = tokenizeWGSL(codePart)
  const highlighted = tokens.map((token, i) => highlightToken(token, i))

  if (commentPart) {
    highlighted.push(
      <span key="comment" className="text-muted-foreground italic">{commentPart}</span>
    )
  }

  return <>{highlighted}</>
}

/**
 * Token types for syntax highlighting
 */
type TokenType = 'keyword' | 'attribute' | 'type' | 'builtin' | 'number' | 'string' | 'operator' | 'text'

interface Token {
  type: TokenType
  value: string
}

/**
 * Tokenize WGSL code for syntax highlighting
 */
function tokenizeWGSL(code: string): Token[] {
  const tokens: Token[] = []
  const regex = /(@\w+)|(\d+\.?\d*f?)|("[^"]*")|(\w+)|([(),;{}[\]<>:=+\-*/&|^!~%])|(\s+)/g
  
  let match
  while ((match = regex.exec(code)) !== null) {
    const value = match[0]
    
    if (match[1]) {
      // Attribute (@fragment, @vertex, etc.)
      tokens.push({ type: 'attribute', value })
    } else if (match[2]) {
      // Number
      tokens.push({ type: 'number', value })
    } else if (match[3]) {
      // String
      tokens.push({ type: 'string', value })
    } else if (match[4]) {
      // Word - check if keyword, type, or builtin
      if (WGSL_KEYWORDS.includes(value)) {
        tokens.push({ type: 'keyword', value })
      } else if (WGSL_TYPES.includes(value)) {
        tokens.push({ type: 'type', value })
      } else if (WGSL_BUILTINS.includes(value)) {
        tokens.push({ type: 'builtin', value })
      } else {
        tokens.push({ type: 'text', value })
      }
    } else if (match[5]) {
      // Operator
      tokens.push({ type: 'operator', value })
    } else {
      // Whitespace or other
      tokens.push({ type: 'text', value })
    }
  }
  
  return tokens
}

/**
 * Apply highlighting to a token
 */
function highlightToken(token: Token, key: number): React.ReactNode {
  const classMap: Record<TokenType, string> = {
    keyword: 'text-primary font-medium',
    attribute: 'text-primary font-medium',
    type: 'text-chart-2',
    builtin: 'text-accent',
    number: 'text-chart-5',
    string: 'text-chart-2',
    operator: 'text-muted-foreground',
    text: '',
  }

  const className = classMap[token.type]
  
  if (className) {
    return <span key={key} className={className}>{token.value}</span>
  }
  
  return token.value
}
