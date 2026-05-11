import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { Toaster } from 'react-hot-toast'

// Stitch design system: Inter for body, JetBrains Mono for clinical data
// Geist loaded via CSS @import for display/headlines
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'IntelliCare Nexus | Autonomous Clinical Decision Platform',
  description: 'AI-powered multi-agent platform for prior authorization automation, clinical trial matching, and autonomous care coordination using Google Gemini 2.5',
  keywords: ['healthcare AI', 'prior authorization', 'clinical trials', 'FHIR', 'multi-agent', 'LangGraph', 'Gemini'],
  openGraph: {
    title: 'IntelliCare Nexus',
    description: 'Autonomous Clinical Decision & Access Platform',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              /* Stitch surface-container-high token */
              background: '#232a39',
              color: '#dbe2f7',
              border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: '0.5rem',   /* Stitch ROUND_FOUR */
              fontSize: '0.8125rem',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            },
            success: {
              iconTheme: { primary: '#00ef7e', secondary: '#232a39' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#232a39' },
            },
            loading: {
              iconTheme: { primary: '#00e5ff', secondary: '#232a39' },
            },
          }}
        />
      </body>
    </html>
  )
}
