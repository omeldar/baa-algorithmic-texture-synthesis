import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Texture Synthesis Lab',
  description: 'Interactive WebGPU-powered procedural texture generation tool for exploring algorithmic texture synthesis techniques including Perlin noise, Voronoi diagrams, Simplex noise, and Fractional Brownian Motion.',
  authors: [{ name: 'Eldar Omerovic' }],
  keywords: ['texture synthesis', 'procedural generation', 'WebGPU', 'shader', 'Perlin noise', 'Voronoi', 'Simplex noise', 'FBM', 'bachelor thesis', 'algorithmic texture synthesis'],
  creator: 'Eldar Omerovic',
  publisher: 'Eldar Omerovic',
  other: {
    'thesis-type': 'Bachelor Thesis',
    'thesis-topic': 'Algorithmic Texture Synthesis for Approximating Target Textures',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
