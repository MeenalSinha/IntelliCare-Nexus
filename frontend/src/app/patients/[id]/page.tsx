'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { patientsApi, agentsApi } from '@/lib/api'
import { cn, calculateAge, formatDate, getRiskColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const Tab = ({ label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      'px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
      active ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' : 'text-white/80 hover:text-white/60'
    )}
  >
    {label}
  </button>
)

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [runningWorkflow, setRunningWorkflow] = useState(false)

  useEffect(() => {
    if (params.id) {
      patientsApi.get(params.id as string).then(r => {
        setPatient(r.data)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [params.id])

  const runAgentWorkflow = async () => {
    setRunningWorkflow(true)
    try {
      const res = await agentsApi.run({ patient_id: params.id as string, workflow_type: 'full' })
      toast.success('Agent workflow started')
      router.push(`/agents?session=${res.data.session_id}&patient=${params.id}`)
    } catch {
      toast.error('Failed to start workflow')
    } finally {
      setRunningWorkflow(false)
    }
  }

  if (loading) return (
    <div className="p-8 space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="skeleton h-32 rounded-2xl" />
      ))}
    </div>
  )

  if (!patient) return <div className="p-8 text-white/80">Patient not found</div>

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xl font-bold"
            style={{ boxShadow: '0 0 20px rgba(168,85,247,0.15)' }}>
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-white/70 font-mono">{patient.mrn}</span>
              <span className="text-white/15">•</span>
              <span className="text-xs text-white/50">{calculateAge(patient.date_of_birth)} yrs</span>
              <span className="text-white/15">•</span>
              <span className="text-xs text-white/50 capitalize">{patient.gender}</span>
              <span className={cn('px-2 py-0.5 rounded-lg text-xs font-medium border', getRiskColor(patient.risk_level))}>
                {patient.risk_level} risk
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAgentWorkflow}
            disabled={runningWorkflow}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-void disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #00f5ff, #06d6f5)',
              boxShadow: '0 0 20px rgba(0,245,255,0.25)',
            }}
          >
            {runningWorkflow ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,3 19,12 5,21 5,3"/>
              </svg>
            )}
            {runningWorkflow ? 'Starting...' : 'Run AI Workflow'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {['overview', 'medications', 'labs', 'genomics', 'timeline'].map(tab => (
          <Tab key={tab} label={tab.charAt(0).toUpperCase() + tab.slice(1)} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Primary Diagnosis */}
          <div className="col-span-2 glass-panel rounded-2xl p-6 border border-white/6">
            <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wide">Primary Diagnosis</h3>
            <p className="text-lg font-medium text-white mb-3">{patient.primary_diagnosis || 'Not documented'}</p>
            <div className="flex flex-wrap gap-2">
              {(patient.diagnosis_codes || []).map((code: string) => (
                <span key={code} className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
                  {code}
                </span>
              ))}
            </div>
          </div>

          {/* Insurance */}
          <div className="glass-panel rounded-2xl p-6 border border-white/6">
            <h3 className="text-sm font-semibold text-white/70 mb-4 uppercase tracking-wide">Insurance</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/70">Provider</p>
                <p className="text-sm text-white/80">{patient.insurance_provider || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/70">Policy Number</p>
                <p className="text-sm text-white/80 font-mono">{patient.insurance_policy_number || '—'}</p>
              </div>
            </div>
          </div>

          {/* Allergies */}
          <div className="glass-panel rounded-2xl p-5 border border-white/6">
            <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">Allergies</h3>
            <div className="flex flex-wrap gap-2">
              {(patient.allergies || []).length > 0 ? (patient.allergies || []).map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {a}
                </span>
              )) : <span className="text-xs text-white/70">NKDA</span>}
            </div>
          </div>

          {/* Vital Signs */}
          <div className="col-span-2 glass-panel rounded-2xl p-5 border border-white/6">
            <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">Vital Signs</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(patient.vital_signs || {}).map(([key, val]) => (
                <div key={key}>
                  <p className="text-xs text-white/70 capitalize">{key.replace('_', ' ')}</p>
                  <p className="text-sm font-medium text-white/80">{String(val)}</p>
                </div>
              ))}
              {!Object.keys(patient.vital_signs || {}).length && (
                <p className="text-xs text-white/70">No vitals recorded</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="space-y-3">
          {(patient.medications || []).map((med: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-panel rounded-xl p-4 border border-white/6 flex items-center justify-between">
              <div>
                <p className="font-medium text-white/80">{med.name}</p>
                <p className="text-xs text-white/80 mt-0.5">{med.dose} • {med.frequency} • {med.route}</p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">Active</span>
            </motion.div>
          ))}
          {!(patient.medications?.length) && <p className="text-white/70 text-sm">No medications recorded</p>}
        </div>
      )}

      {activeTab === 'labs' && (
        <div className="space-y-3">
          {(patient.lab_results || []).map((lab: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-panel rounded-xl p-4 border border-white/6 flex items-center justify-between">
              <div>
                <p className="font-medium text-white/80">{lab.test || lab.name}</p>
                {lab.significance && <p className="text-xs text-cyan-400/60 mt-0.5">{lab.significance}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cyan-300">{lab.value}</p>
                <p className="text-xs text-white/70">{lab.date}</p>
              </div>
            </motion.div>
          ))}
          {!(patient.lab_results?.length) && <p className="text-white/70 text-sm">No lab results recorded</p>}
        </div>
      )}

      {activeTab === 'genomics' && (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(patient.genomics || {}).map(([gene, value]) => (
            <div key={gene} className="glass-panel rounded-xl p-4 border border-white/6">
              <p className="text-xs text-white/80 font-mono uppercase tracking-wider mb-1">{gene}</p>
              <p className="text-sm text-violet-300">{String(value)}</p>
            </div>
          ))}
          {!Object.keys(patient.genomics || {}).length && <p className="text-white/70 text-sm col-span-2">No genomic data available</p>}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="relative space-y-4 pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/30 via-violet-500/30 to-transparent" />
          {(patient.procedures || []).map((proc: any, i: number) => (
            <div key={i} className="relative">
              <div className="absolute -left-4 top-3 w-2.5 h-2.5 rounded-full border border-cyan-500/50 bg-cyan-500/20" />
              <div className="glass-panel rounded-xl p-4 border border-white/6 ml-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white/80">{proc.name}</p>
                    {proc.result && <p className="text-xs text-white/50 mt-1">{proc.result}</p>}
                  </div>
                  <p className="text-xs text-white/70 flex-shrink-0 ml-4">{proc.date || 'Pending'}</p>
                </div>
              </div>
            </div>
          ))}
          {!(patient.procedures?.length) && <p className="text-white/70 text-sm">No procedures recorded</p>}
        </div>
      )}
    </div>
  )
}
