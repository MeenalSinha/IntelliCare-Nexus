'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { patientsApi, agentsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface DemoStep {
  id: string
  title: string
  description: string
  agent: string
  duration: number
  color: string
}

const DEMO_SCRIPT: DemoStep[] = [
  { id: 'load', title: 'Loading Patient Profile', description: 'Ingesting FHIR R4 bundle for Arjun Sharma — Stage IIIB NSCLC', agent: 'ClinicalContextAgent', duration: 2000, color: '#a855f7' },
  { id: 'parse', title: 'Parsing Clinical Context', description: 'Extracting diagnoses, genomics (KRAS G12C), labs, medications from FHIR bundle', agent: 'ClinicalContextAgent', duration: 2500, color: '#a855f7' },
  { id: 'auth', title: 'Detecting Authorization Requirements', description: 'MRI Brain (70553) and Pembrolizumab 200mg IV (J9271) flagged as requiring prior auth', agent: 'PriorAuthorizationAgent', duration: 2000, color: '#fbbf24' },
  { id: 'policy', title: 'Fetching Payer Policies', description: 'Retrieving UnitedHealthcare coverage criteria for oncology immunotherapy + imaging', agent: 'InsurancePolicyAgent', duration: 2500, color: '#06d6f5' },
  { id: 'letter', title: 'Generating Medical Necessity Letter', description: 'Gemini 2.5 drafting evidence-based necessity letter mapping PD-L1 85%, KRAS G12C, ECOG PS 1', agent: 'MedicalNecessityAgent', duration: 3500, color: '#00ff87' },
  { id: 'prob', title: 'Calculating Approval Probability', description: 'AI predicts 88% approval probability based on clinical evidence alignment', agent: 'MedicalNecessityAgent', duration: 1500, color: '#00ff87' },
  { id: 'trials', title: 'Searching ClinicalTrials.gov', description: 'Querying API for NSCLC trials compatible with KRAS G12C + PD-L1 high profile', agent: 'ClinicalTrialMatchmakerAgent', duration: 3000, color: '#8b5cf6' },
  { id: 'eligibility', title: 'Analyzing Trial Eligibility', description: 'CODEBREAK 200 (sotorasib) — 91% match. CheckMate 227 — 78% match. AI explaining inclusion/exclusion', agent: 'EligibilityReasoningAgent', duration: 3500, color: '#2dd4bf' },
  { id: 'summary', title: 'Generating Patient Summary', description: 'Creating patient-friendly explanations in English and Hindi for Arjun Sharma', agent: 'PatientCommunicationAgent', duration: 2500, color: '#f97316' },
  { id: 'coordination', title: 'Coordinating Care Plan', description: 'Scheduling authorization submission, trial referral to oncology coordinator, patient counseling', agent: 'CareCoordinationAgent', duration: 2000, color: '#10b981' },
  { id: 'audit', title: 'Finalizing Compliance Report', description: 'HIPAA audit trail complete — 28 tool calls, 10 agents, fully compliant', agent: 'AuditComplianceAgent', duration: 1500, color: '#64748b' },
]

interface DemoModeProps {
  onClose: () => void
}

export default function DemoMode({ onClose }: DemoModeProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(-1)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [demoPatientId, setDemoPatientId] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Find the demo patient on mount
  useEffect(() => {
    patientsApi.list({ limit: 20 }).then(r => {
      const demo = r.data.find((p: any) => p.mrn === 'ICN-001-2024') || r.data[0]
      if (demo) setDemoPatientId(demo.id)
    }).catch(() => {})
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const runDemo = async () => {
    setIsRunning(true)
    setCurrentStep(0)
    setCompletedSteps([])
    setShowResult(false)

    // Start real agent workflow in background
    if (demoPatientId) {
      try {
        const res = await agentsApi.run({ patient_id: demoPatientId, workflow_type: 'full' })
        setSessionId(res.data.session_id)
      } catch {}
    }

    // Run the scripted demo animation
    let stepIndex = 0
    const advance = () => {
      if (stepIndex >= DEMO_SCRIPT.length) {
        setShowResult(true)
        setIsRunning(false)
        return
      }
      setCurrentStep(stepIndex)
      const step = DEMO_SCRIPT[stepIndex]
      timerRef.current = setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id])
        stepIndex++
        timerRef.current = setTimeout(advance, 400)
      }, step.duration)
    }
    advance()
  }

  const stopDemo = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsRunning(false)
    setCurrentStep(-1)
    setCompletedSteps([])
    setShowResult(false)
  }

  const goToAgents = () => {
    if (sessionId && demoPatientId) {
      router.push(`/agents?session=${sessionId}&patient=${demoPatientId}`)
    } else {
      router.push('/agents')
    }
    onClose()
  }

  const currentStepData = currentStep >= 0 ? DEMO_SCRIPT[currentStep] : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(5,8,16,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: currentStepData ? `${currentStepData.color}08` : 'rgba(0,245,255,0.05)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(168,85,247,0.05)' }} />

      <div className="relative w-full max-w-4xl px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#00f5ff" strokeWidth="1.5" strokeDasharray="3 2"/>
                  <circle cx="12" cy="12" r="3" fill="#00f5ff"/>
                </svg>
              </div>
              <span className="font-display font-bold text-white">IntelliCare Nexus</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs border border-violet-400/30 bg-violet-400/10 text-violet-300 font-medium">
                DEMO MODE
              </span>
            </div>
            <p className="text-white/80 text-sm">Lung Cancer Patient — Full Autonomous Workflow</p>
          </div>
          <button onClick={onClose}
            className="text-white/70 hover:text-white/60 transition-colors text-sm">
            Close
          </button>
        </div>

        {/* Demo scenario card */}
        {!isRunning && !showResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-8 border border-white/8 text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6"
              style={{ boxShadow: '0 0 30px rgba(0,245,255,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="1.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">
              Arjun Sharma — Stage IIIB NSCLC
            </h2>
            <p className="text-white/50 mb-2 max-w-xl mx-auto">
              58-year-old male with non-small cell lung cancer. KRAS G12C mutation, PD-L1 85%.
              Needs MRI authorization, immunotherapy approval, and clinical trial evaluation.
            </p>
            <p className="text-xs text-white/70 mb-8">
              10 AI agents will autonomously process this case in real time using Gemini 2.5
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={runDemo}
                className="px-8 py-3.5 rounded-xl font-semibold text-void flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 30px rgba(0,245,255,0.3)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                Start Demo
              </button>
              <button onClick={onClose}
                className="px-8 py-3.5 rounded-xl font-semibold text-white/60 border border-white/10 hover:bg-white/5 transition-all">
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Running state */}
        {isRunning && currentStepData && (
          <div className="space-y-6">
            {/* Current agent */}
            <motion.div
              key={currentStepData.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-2xl p-8 border text-center"
              style={{ borderColor: `${currentStepData.color}30`, boxShadow: `0 0 40px ${currentStepData.color}10` }}
            >
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: `${currentStepData.color}15`, border: `1px solid ${currentStepData.color}30`,
                  boxShadow: `0 0 20px ${currentStepData.color}30` }}>
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: currentStepData.color }} />
              </div>
              <p className="text-xs font-mono mb-2" style={{ color: currentStepData.color }}>
                {currentStepData.agent}
              </p>
              <h3 className="font-display text-xl font-bold text-white mb-3">{currentStepData.title}</h3>
              <p className="text-white/50 text-sm max-w-lg mx-auto leading-relaxed">{currentStepData.description}</p>

              {/* Thinking dots */}
              <div className="flex items-center justify-center gap-1.5 mt-6">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: currentStepData.color }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.3, repeat: Infinity }} />
                ))}
              </div>
            </motion.div>

            {/* Progress steps */}
            <div className="grid grid-cols-6 gap-2">
              {DEMO_SCRIPT.map((step, i) => {
                const isDone = completedSteps.includes(step.id)
                const isCurrent = currentStep === i
                return (
                  <div key={step.id}
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      background: isDone ? step.color : isCurrent ? `${step.color}60` : 'rgba(255,255,255,0.08)',
                      boxShadow: isDone ? `0 0 6px ${step.color}60` : 'none',
                    }} />
                )
              })}
            </div>

            <div className="flex justify-between text-xs text-white/70">
              <span>Step {currentStep + 1} of {DEMO_SCRIPT.length}</span>
              <button onClick={stopDemo} className="text-white/60 hover:text-white/50 transition-colors">Stop</button>
            </div>
          </div>
        )}

        {/* Result screen */}
        {showResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6">
            <div className="glass-panel rounded-2xl p-8 border border-emerald-500/20 text-center"
              style={{ boxShadow: '0 0 40px rgba(0,255,135,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5"
                style={{ boxShadow: '0 0 25px rgba(0,255,135,0.2)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </div>
              <h3 className="font-display text-2xl font-bold text-white mb-3">Workflow Complete</h3>
              <p className="text-white/50 text-sm mb-8 max-w-lg mx-auto">
                10 AI agents processed Arjun Sharma's case autonomously. Prior auth generated with 88% approval probability.
                2 eligible clinical trials identified. Multilingual patient summary ready.
              </p>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Agents Run', value: '10', color: '#00f5ff' },
                  { label: 'Approval Prob.', value: '88%', color: '#00ff87' },
                  { label: 'Trials Matched', value: '2', color: '#a855f7' },
                  { label: 'Time Saved', value: '4.5h', color: '#fbbf24' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-4 border"
                    style={{ borderColor: `${s.color}20`, background: `${s.color}08` }}>
                    <p className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-white/80 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={goToAgents}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-void"
                  style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)' }}>
                  View Agent Graph
                </button>
                <button onClick={stopDemo}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/10 hover:bg-white/5 transition-all">
                  Run Again
                </button>
                <button onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white/60 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
