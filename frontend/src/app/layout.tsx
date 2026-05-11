import type { Metadata } from 'next'
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'IntelliCare Nexus | Autonomous Clinical Decision Platform',
  description: 'AI-powered multi-agent platform for prior authorization automation and clinical trial matching',
  keywords: ['healthcare AI', 'prior authorization', 'clinical trials', 'FHIR', 'multi-agent'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1426',
              color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(0,245,255,0.2)',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
            },
            success: {
              iconTheme: { primary: '#00ff87', secondary: '#0d1426' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#0d1426' },
            },
          }}
        />
      </body>
    </html>
  )
}
