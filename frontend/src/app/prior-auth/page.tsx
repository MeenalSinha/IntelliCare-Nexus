'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { priorAuthApi, patientsApi } from '@/lib/api'
import { cn, getApprovalColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', submitted: 'Submitted', approved: 'Approved',
  denied: 'Denied', appealing: 'Appealing', appeal_approved: 'Appeal Approved', cancelled: 'Cancelled',
}
const STATUS_STYLES: Record<string, string> = {
  pending: 'status-pending', submitted: 'status-running', approved: 'status-approved',
  denied: 'status-denied', appealing: 'status-pending', appeal_approved: 'status-approved',
}

interface CreateAuthForm {
  patient_id: string
  procedure_code: string
  procedure_name: string
  diagnosis_codes: string
  urgency: string
  payer_name: string
}

const PROCEDURE_PRESETS = [
  { code: '70553', name: 'MRI Brain with and without Contrast', payer_hint: 'UnitedHealthcare' },
  { code: 'J9271', name: 'Pembrolizumab 200mg IV Infusion (Keytruda)', payer_hint: 'UnitedHealthcare' },
  { code: 'J9306', name: 'Pertuzumab 420mg IV Infusion (Perjeta)', payer_hint: 'Aetna' },
  { code: 'J9035', name: 'Bevacizumab 10mg IV Infusion (Avastin)', payer_hint: 'Cigna' },
  { code: '71250', name: 'CT Chest with Contrast', payer_hint: 'BlueCross BlueShield' },
  { code: '78816', name: 'PET Scan Whole Body', payer_hint: 'Medicare' },
  { code: 'J2505', name: 'Pegfilgrastim 6mg Injection (Neulasta)', payer_hint: 'Aetna' },
]

export default function PriorAuthPage() {
  const [auths, setAuths] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'letter' | 'evidence' | 'reasoning' | 'appeal'>('letter')

  const [createForm, setCreateForm] = useState<CreateAuthForm>({
    patient_id: '',
    procedure_code: '',
    procedure_name: '',
    diagnosis_codes: '',
    urgency: 'routine',
    payer_name: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
    patientsApi.list({ limit: 50 }).then(r => {
      setPatients(r.data)
      if (r.data.length > 0 && !createForm.patient_id) {
        setCreateForm(f => ({
          ...f,
          patient_id: r.data[0].id,
          diagnosis_codes: (r.data[0].diagnosis_codes || []).join(', '),
          payer_name: r.data[0].insurance_provider || '',
        }))
      }
    })
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await priorAuthApi.list({ status: statusFilter || undefined })
      setAuths(res.data)
      if (res.data.length > 0 && !selected) setSelected(res.data[0])
    } catch { toast.error('Failed to load authorizations') }
    setLoading(false)
  }

  const handlePatientChange = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId)
    setCreateForm(f => ({
      ...f,
      patient_id: patientId,
      diagnosis_codes: patient ? (patient.diagnosis_codes || []).join(', ') : '',
      payer_name: patient?.insurance_provider || '',
    }))
  }

  const handlePresetSelect = (preset: typeof PROCEDURE_PRESETS[0]) => {
    setCreateForm(f => ({
      ...f,
      procedure_code: preset.code,
      procedure_name: preset.name,
    }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.patient_id || !createForm.procedure_code || !createForm.procedure_name) {
      toast.error('Patient, procedure code, and procedure name are required')
      return
    }
    setCreating(true)
    try {
      const payload = {
        patient_id: createForm.patient_id,
        procedure_code: createForm.procedure_code,
        procedure_name: createForm.procedure_name,
        diagnosis_codes: createForm.diagnosis_codes
          .split(',').map(c => c.trim()).filter(Boolean),
        urgency: createForm.urgency,
        payer_name: createForm.payer_name,
      }
      const res = await priorAuthApi.create(payload)
      setAuths(prev => [res.data, ...prev])
      setSelected(res.data)
      setShowCreateModal(false)
      toast.success(`Authorization ${res.data.reference_number} created. AI necessity letter generating...`)
      // Poll for the generated letter
      setTimeout(() => refreshSelected(res.data.id), 8000)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create authorization')
    } finally {
      setCreating(false)
    }
  }

  const refreshSelected = async (id: string) => {
    try {
      const res = await priorAuthApi.get(id)
      setAuths(prev => prev.map(a => a.id === id ? res.data : a))
      setSelected(res.data)
    } catch {}
  }

  const submitAuth = async (id: string) => {
    setActionLoading(true)
    try {
      const res = await priorAuthApi.submit(id)
      setAuths(prev => prev.map(a => a.id === id ? res.data : a))
      setSelected(res.data)
      toast.success('Authorization submitted to payer')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit')
    } finally { setActionLoading(false) }
  }

  const generateAppeal = async (id: string) => {
    setActionLoading(true)
    toast.loading('Generating AI appeal letter...', { id: 'appeal' })
    try {
      const res = await priorAuthApi.appeal(id)
      setAuths(prev => prev.map(a => a.id === id ? res.data : a))
      setSelected(res.data)
      setActiveTab('appeal')
      toast.success('Appeal letter generated', { id: 'appeal' })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate appeal', { id: 'appeal' })
    } finally { setActionLoading(false) }
  }

  const simulateDecision = async (id: string, decision: 'approved' | 'denied') => {
    setActionLoading(true)
    try {
      const res = await priorAuthApi.updateStatus(
        id, decision,
        decision === 'denied' ? 'Medical necessity criteria not sufficiently documented per payer policy guidelines' : undefined
      )
      setAuths(prev => prev.map(a => a.id === id ? res.data : a))
      setSelected(res.data)
      toast.success(`Authorization ${decision}`)
    } catch { toast.error('Failed to update status') }
    finally { setActionLoading(false) }
  }

  const probColor = selected ? getApprovalColor(selected.approval_probability || 0) : '#00f5ff'
  const probPct = selected ? Math.round((selected.approval_probability || 0) * 100) : 0

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left list */}
      <div className="w-80 border-r border-white/6 flex flex-col bg-abyss overflow-hidden flex-shrink-0">
        <div className="p-5 border-b border-white/6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-white text-base">Prior Authorizations</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-void font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 10px rgba(0,245,255,0.3)' }}
              title="Create new authorization"
            >
              +
            </button>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 focus:outline-none">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)
          ) : auths.map(auth => (
            <motion.div key={auth.id} onClick={() => { setSelected(auth); setActiveTab('letter') }}
              className={cn('p-4 rounded-xl cursor-pointer border transition-all',
                selected?.id === auth.id ? 'border-cyan-500/30 bg-cyan-500/8' : 'border-white/6 bg-white/2 hover:bg-white/4')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-white/40">{auth.reference_number}</span>
                <span className={cn('px-2 py-0.5 rounded-md text-xs', STATUS_STYLES[auth.status] || 'status-pending')}>
                  {STATUS_LABELS[auth.status] || auth.status}
                </span>
              </div>
              <p className="text-sm font-medium text-white/80 mb-1 line-clamp-2">{auth.procedure_name}</p>
              <p className="text-xs text-white/40">{auth.payer_name}</p>
              {(auth.approval_probability || 0) > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full approval-meter-fill"
                      style={{ width: `${auth.approval_probability * 100}%` }} />
                  </div>
                  <span className="text-xs text-white/30">{Math.round(auth.approval_probability * 100)}%</span>
                </div>
              )}
            </motion.div>
          ))}
          {!loading && auths.length === 0 && (
            <div className="text-center py-12 text-white/25 text-xs space-y-2">
              <p>No authorizations yet.</p>
              <p>Click the + button to create one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-xl font-bold text-white mb-2">{selected.procedure_name}</h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono text-white/40">{selected.reference_number}</span>
                  <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', STATUS_STYLES[selected.status] || 'status-pending')}>
                    {STATUS_LABELS[selected.status] || selected.status}
                  </span>
                  <span className="text-xs text-white/40">{selected.payer_name}</span>
                  <span className="text-xs text-white/30">{selected.urgency} priority</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {selected.status === 'pending' && (
                  <button onClick={() => submitAuth(selected.id)} disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-void disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)' }}>
                    Submit to Payer
                  </button>
                )}
                {selected.status === 'submitted' && (
                  <>
                    <button onClick={() => simulateDecision(selected.id, 'approved')} disabled={actionLoading}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-void bg-emerald-400 hover:bg-emerald-300 transition-colors">
                      Simulate Approved
                    </button>
                    <button onClick={() => simulateDecision(selected.id, 'denied')} disabled={actionLoading}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 transition-colors">
                      Simulate Denied
                    </button>
                  </>
                )}
                {selected.status === 'denied' && (
                  <button onClick={() => generateAppeal(selected.id)} disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #a855f7, #8b5cf6)' }}>
                    {actionLoading ? 'Generating...' : 'Generate AI Appeal'}
                  </button>
                )}
                <button onClick={() => refreshSelected(selected.id)}
                  className="px-3 py-2 rounded-xl text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-all">
                  Refresh
                </button>
              </div>
            </div>

            {/* Approval meter */}
            {probPct > 0 && (
              <div className="glass-panel rounded-2xl p-6 border border-white/6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">AI Approval Prediction</h3>
                    <p className="text-xs text-white/30 mt-0.5">Based on clinical evidence alignment with payer criteria</p>
                  </div>
                  <span className="text-4xl font-display font-bold" style={{ color: probColor, textShadow: `0 0 20px ${probColor}40` }}>
                    {probPct}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${probPct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full approval-meter-fill" />
                </div>
                <div className="flex justify-between mt-2 text-xs text-white/30">
                  <span>Low probability</span>
                  <span>
                    {probPct >= 75 ? 'Recommend: Submit immediately' :
                     probPct >= 50 ? 'Recommend: Physician review first' :
                     'Recommend: Additional documentation needed'}
                  </span>
                  <span>High probability</span>
                </div>
              </div>
            )}

            {/* Content tabs */}
            <div className="flex items-center gap-1 border-b border-white/6 pb-0">
              {[
                { key: 'letter', label: 'Necessity Letter' },
                { key: 'evidence', label: 'Evidence Mapping' },
                { key: 'reasoning', label: 'AI Reasoning' },
                { key: 'appeal', label: 'Appeal', badge: selected.appeal_letter ? '1' : null },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-1.5',
                    activeTab === tab.key ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-white/40 hover:text-white/60')}>
                  {tab.label}
                  {tab.badge && (
                    <span className="w-4 h-4 rounded-full bg-violet-500/40 text-violet-300 text-xs flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}>
                {activeTab === 'letter' && (
                  <div className="glass-panel rounded-2xl p-6 border border-white/6">
                    {selected.necessity_letter ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-white/40">AI-generated by MedicalNecessityAgent using Gemini 2.5</p>
                          <button onClick={() => navigator.clipboard?.writeText(selected.necessity_letter || '')}
                            className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors px-3 py-1 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40">
                            Copy
                          </button>
                        </div>
                        <div className="bg-white/3 rounded-xl p-5 max-h-96 overflow-y-auto">
                          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                            {selected.necessity_letter}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-white/30">
                        <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center mx-auto mb-3">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12"/><polyline points="14,2 14,8 20,8"/>
                          </svg>
                        </div>
                        <p className="text-sm">Necessity letter generating...</p>
                        <p className="text-xs text-white/20 mt-1">MedicalNecessityAgent is drafting your letter. Click Refresh in a few seconds.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'evidence' && (
                  <div className="space-y-3">
                    {Object.entries(selected.evidence_mapping || {}).length > 0 ? (
                      Object.entries(selected.evidence_mapping || {}).map(([key, val]: any) => (
                        <div key={key} className={cn('p-4 rounded-xl border',
                          val.met ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5')}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn('text-base', val.met ? 'text-emerald-400' : 'text-rose-400')}>
                              {val.met ? '✓' : '✗'}
                            </span>
                            <span className="text-sm font-medium text-white/80">{val.requirement || key}</span>
                          </div>
                          <p className="text-xs text-white/50 ml-6">{val.evidence}</p>
                        </div>
                      ))
                    ) : (
                      <div className="glass-panel rounded-2xl p-8 border border-white/6 text-center text-white/30 text-sm">
                        Evidence mapping will appear after the necessity letter is generated.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'reasoning' && (
                  <div className="glass-panel rounded-2xl p-6 border border-cyan-500/15">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-cyan-400/80">Gemini 2.5 Clinical Reasoning Chain</h3>
                    </div>
                    {selected.ai_reasoning ? (
                      <p className="text-sm text-white/65 leading-relaxed">{selected.ai_reasoning}</p>
                    ) : (
                      <p className="text-white/30 text-sm">Reasoning will appear after AI letter generation completes.</p>
                    )}
                  </div>
                )}

                {activeTab === 'appeal' && (
                  <div className="space-y-4">
                    {selected.denial_reason && (
                      <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                        <p className="text-xs text-rose-400/70 font-medium mb-1">Denial Reason</p>
                        <p className="text-sm text-white/65">{selected.denial_reason}</p>
                      </div>
                    )}
                    {selected.appeal_letter ? (
                      <div className="glass-panel rounded-2xl p-6 border border-violet-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-violet-400/70">AI-generated appeal by AppealAgent</p>
                          <button onClick={() => navigator.clipboard?.writeText(selected.appeal_letter || '')}
                            className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors px-3 py-1 rounded-lg border border-violet-500/20 hover:border-violet-500/40">
                            Copy
                          </button>
                        </div>
                        <div className="bg-white/3 rounded-xl p-5 max-h-96 overflow-y-auto">
                          <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                            {selected.appeal_letter}
                          </p>
                        </div>
                      </div>
                    ) : selected.status === 'denied' ? (
                      <div className="glass-panel rounded-2xl p-8 border border-white/6 text-center">
                        <p className="text-white/40 text-sm mb-4">Authorization was denied. Generate an AI appeal letter.</p>
                        <button onClick={() => generateAppeal(selected.id)} disabled={actionLoading}
                          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg, #a855f7, #8b5cf6)' }}>
                          {actionLoading ? 'Generating AI Appeal...' : 'Generate Appeal Letter'}
                        </button>
                      </div>
                    ) : (
                      <div className="glass-panel rounded-2xl p-8 border border-white/6 text-center text-white/25 text-sm">
                        Appeals are generated when an authorization is denied.
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/25 space-y-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <p className="text-sm">Select an authorization or create a new one</p>
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl glass-panel-elevated rounded-2xl p-8 border border-white/10"
              style={{ boxShadow: '0 0 40px rgba(0,245,255,0.08)' }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">New Prior Authorization</h2>
                  <p className="text-white/40 text-sm mt-0.5">AI will generate the necessity letter automatically</p>
                </div>
                <button onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                {/* Patient */}
                <div>
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Patient *</label>
                  <select value={createForm.patient_id} onChange={e => handlePatientChange(e.target.value)} required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-cyan-500/40">
                    <option value="">Select patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.mrn}</option>
                    ))}
                  </select>
                </div>

                {/* Procedure presets */}
                <div>
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Quick Select Procedure</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROCEDURE_PRESETS.map(preset => (
                      <button key={preset.code} type="button" onClick={() => handlePresetSelect(preset)}
                        className={cn('text-left px-3 py-2.5 rounded-xl border text-xs transition-all',
                          createForm.procedure_code === preset.code
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-white/8 bg-white/3 text-white/50 hover:bg-white/6 hover:text-white/70')}>
                        <p className="font-mono text-xs text-white/30 mb-0.5">{preset.code}</p>
                        <p className="leading-snug">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Procedure Code *</label>
                    <input value={createForm.procedure_code}
                      onChange={e => setCreateForm(f => ({ ...f, procedure_code: e.target.value }))}
                      required placeholder="e.g. J9271"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 font-mono focus:outline-none focus:border-cyan-500/40" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Urgency</label>
                    <select value={createForm.urgency} onChange={e => setCreateForm(f => ({ ...f, urgency: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-cyan-500/40">
                      <option value="routine">Routine (3-5 days)</option>
                      <option value="urgent">Urgent (24-72 hours)</option>
                      <option value="stat">STAT (24 hours)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Procedure Name *</label>
                  <input value={createForm.procedure_name}
                    onChange={e => setCreateForm(f => ({ ...f, procedure_name: e.target.value }))}
                    required placeholder="e.g. Pembrolizumab 200mg IV Infusion Q3W"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-cyan-500/40" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Diagnosis Codes</label>
                    <input value={createForm.diagnosis_codes}
                      onChange={e => setCreateForm(f => ({ ...f, diagnosis_codes: e.target.value }))}
                      placeholder="C34.10, Z96.89 (comma separated)"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 font-mono focus:outline-none focus:border-cyan-500/40" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">Payer / Insurer</label>
                    <input value={createForm.payer_name}
                      onChange={e => setCreateForm(f => ({ ...f, payer_name: e.target.value }))}
                      placeholder="e.g. UnitedHealthcare"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-cyan-500/40" />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" disabled={creating}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-void disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 20px rgba(0,245,255,0.25)' }}>
                    {creating ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/></svg>Creating...</>
                    ) : (
                      <>Create Authorization + Generate AI Letter</>
                    )}
                  </button>
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    className="px-5 py-3 rounded-xl text-sm text-white/50 border border-white/10 hover:bg-white/5 transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
