'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-void overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/4 rounded-full blur-3xl" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center"
            style={{ boxShadow: '0 0 20px rgba(0,245,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#00f5ff" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="12" cy="12" r="3" fill="#00f5ff" fillOpacity="0.9"/>
              <path d="M12 6v2M12 16v2M6 12h2M16 12h2" stroke="#00f5ff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <span className="font-display font-bold text-white">IntelliCare Nexus</span>
            <span className="ml-2 text-xs text-white/30">v1.0</span>
          </div>
        </div>
        <Link href="/auth">
          <motion.button
            whileHover={{ scale: 1.03 }}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-void"
            style={{
              background: 'linear-gradient(135deg, #00f5ff, #06d6f5)',
              boxShadow: '0 0 20px rgba(0,245,255,0.25)',
            }}
          >
            Access Platform
          </motion.button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 text-xs text-cyan-300 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Powered by Google Gemini 2.5 and 10 Autonomous AI Agents
          </div>

          <h1 className="font-display text-6xl md:text-7xl font-bold leading-none mb-6">
            <span className="text-gradient-hero">The Future of</span>
            <br />
            <span className="text-white">Clinical Intelligence</span>
          </h1>

          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            IntelliCare Nexus autonomously handles prior authorizations, clinical trial matching,
            and care coordination — saving physicians hours every day.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/auth">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3.5 rounded-xl font-semibold text-void"
                style={{
                  background: 'linear-gradient(135deg, #00f5ff, #06d6f5)',
                  boxShadow: '0 0 30px rgba(0,245,255,0.3)',
                }}
              >
                Launch Platform
              </motion.button>
            </Link>
            <Link href="/agents">
              <button className="px-8 py-3.5 rounded-xl font-semibold text-white/70 border border-white/10 hover:border-white/20 hover:bg-white/4 transition-all">
                View Agent Network
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              icon: '01',
              title: 'Prior Authorization Autopilot',
              desc: 'AI agents detect auth requirements, fetch payer policies, generate necessity letters, and predict approval probability in minutes.',
              color: '#00f5ff',
            },
            {
              icon: '02',
              title: 'Clinical Trial Matchmaker',
              desc: 'Query ClinicalTrials.gov, parse eligibility criteria, analyze genomic compatibility, and rank trials by patient fit.',
              color: '#a855f7',
            },
            {
              icon: '03',
              title: 'Autonomous Appeal Generation',
              desc: 'When authorization is denied, AI agents automatically draft evidence-based appeals citing clinical guidelines.',
              color: '#00ff87',
            },
            {
              icon: '04',
              title: 'FHIR-Native Data Model',
              desc: 'Built on FHIR R4 standards. Ingests patient bundles, extracts clinical context, and integrates with EHR systems.',
              color: '#fbbf24',
            },
            {
              icon: '05',
              title: 'Multilingual Patient Summaries',
              desc: 'Generate patient-friendly explanations in English and Hindi using Gemini 2.5 with empathetic language.',
              color: '#f43f5e',
            },
            {
              icon: '06',
              title: 'Live Agent Orchestration',
              desc: 'Watch 10 specialized AI agents collaborate in real time via LangGraph, with WebSocket event streaming.',
              color: '#06d6f5',
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass-panel rounded-2xl p-6 border"
              style={{ borderColor: `${feature.color}18` }}
            >
              <div className="text-xs font-mono text-white/20 mb-4">{feature.icon}</div>
              <h3 className="font-display font-semibold text-white mb-2" style={{ color: feature.color }}>
                {feature.title}
              </h3>
              <p className="text-sm text-white/45 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech stack strip */}
      <section className="relative z-10 border-t border-white/6 py-8">
        <div className="flex items-center justify-center gap-8 text-xs text-white/25">
          {['Google Gemini 2.5', 'LangGraph', 'FHIR R4', 'FastAPI', 'Next.js 15', 'React Flow', 'PostgreSQL', 'Redis', 'ChromaDB'].map(tech => (
            <span key={tech}>{tech}</span>
          ))}
        </div>
      </section>
    </div>
  )
}
