'use client'

import { Suspense, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { agentsApi, patientsApi } from '@/lib/api'
import { cn, formatDateTime } from '@/lib/utils'

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: '#00f5ff',
  ClinicalContextAgent: '#a855f7',
  PriorAuthorizationAgent: '#fbbf24',
  InsurancePolicyAgent: '#06d6f5',
  MedicalNecessityAgent: '#00ff87',
  AppealAgent: '#f43f5e',
  ClinicalTrialMatchmakerAgent: '#8b5cf6',
  EligibilityReasoningAgent: '#2dd4bf',
  PatientCommunicationAgent: '#f97316',
  CareCoordinationAgent: '#10b981',
  AuditComplianceAgent: '#64748b',
}

const EVENT_ICONS: Record<string, string> = {
  started: '▶',
  completed: '✓',
  failed: '✗',
  tool_call: '⚡',
  tool_result: '↩',
  processing: '◉',
  audit: '🔒',
}

function ExplainabilityPageInner() {
  const searchParams = useSearchParams()
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState(searchParams.get('patient') || '')
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('session'))
  const [sessionState, setSessionState] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [filterAgent, setFilterAgent] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [notFoundMessage, setNotFoundMessage] = useState('')

  useEffect(() => {
    patientsApi.list({ limit: 20 }).then(r => setPatients(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (sessionId) loadSessionState(sessionId)
  }, [sessionId])

  const loadSessionState = async (sid: string) => {
    setLoading(true)
    setNotFoundMessage('')
    try {
      const res = await agentsApi.sessionState(sid)
      setSessionState(res.data)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Session state not found'
      setNotFoundMessage(detail)
      setSessionState(null)
    }
    setLoading(false)
  }

  const allEvents = sessionState
    ? [
        ...(sessionState.agent_events || []),
        ...(sessionState.audit_trail || []).map((a: any) => ({
          ...a, agent_name: a.agent, event_type: 'audit',
          message: `Audit: ${a.action}`, timestamp: a.ts,
        })),
        ...(sessionState.tool_call_log || []).map((t: any) => ({
          ...t, agent_name: t.agent, event_type: 'tool_call',
          message: `Tool: ${t.tool}`, timestamp: t.ts,
        })),
      ].sort((a, b) =>
        new Date(a.timestamp || a.ts || 0).getTime() - new Date(b.timestamp || b.ts || 0).getTime()
      )
    : []

  const filteredEvents = allEvents.filter(e => {
    if (filterAgent !== 'all' && e.agent_name !== filterAgent) return false
    if (filterType !== 'all' && e.event_type !== filterType) return false
    return true
  })

  const completedAgents: string[] = sessionState?.completed_agents || []
  const toolCallCount = (sessionState?.tool_call_log || []).length
  const auditCount = (sessionState?.audit_trail || []).length
  const uniqueAgents = [...new Set(allEvents.map(e => e.agent_name).filter(Boolean))] as string[]

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Explainability Timeline</h1>
          <p className="text-white/80 text-sm mt-1">Complete reasoning chain for every agent decision</p>
        </div>
      </div>

      {/* Session selector */}
      <div className="glass-panel rounded-2xl p-5 border border-white/6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/80 mb-1.5 block">Patient (optional)</label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70">
              <option value="">All patients</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.mrn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/80 mb-1.5 block">Session ID</label>
            <div className="flex gap-2">
              <input
                value={sessionId || ''}
                onChange={e => setSessionId(e.target.value)}
                placeholder="Paste session ID from agent workflow..."
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 font-mono focus:outline-none focus:border-cyan-500/40"
              />
              {sessionId && (
                <button onClick={() => loadSessionState(sessionId)}
                  className="px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300 hover:bg-cyan-500/25 transition-all">
                  Load
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {sessionState && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Agents Completed', value: completedAgents.length, color: '#00ff87' },
            { label: 'MCP Tool Calls', value: toolCallCount, color: '#00f5ff' },
            { label: 'Audit Events', value: auditCount, color: '#fbbf24' },
            { label: 'Total Events', value: allEvents.length, color: '#a855f7' },
          ].map(s => (
            <div key={s.label} className="glass-panel rounded-xl p-4 border" style={{ borderColor: `${s.color}15` }}>
              <p className="text-xs text-white/80 mb-1">{s.label}</p>
              <p className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar filters */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-white/6">
            <h3 className="text-sm font-semibold text-white/70 mb-4">Agents</h3>
            <div className="space-y-1">
              <button onClick={() => setFilterAgent('all')}
                className={cn('w-full text-left px-3 py-2 rounded-xl text-xs transition-all',
                  filterAgent === 'all' ? 'bg-cyan-500/15 text-cyan-300' : 'text-white/35 hover:text-white/55')}>
                All Agents
              </button>
              {Object.keys(AGENT_COLORS).map(agent => {
                const done = completedAgents.includes(agent)
                return (
                  <button key={agent} onClick={() => setFilterAgent(filterAgent === agent ? 'all' : agent)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all text-left',
                      filterAgent === agent ? 'bg-white/8' : 'hover:bg-white/4')}>
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                      done ? 'bg-emerald-400' : uniqueAgents.includes(agent) ? 'bg-amber-400' : 'bg-white/20'
                    )} />
                    <span className={done ? 'text-white/60' : 'text-white/60'}
                      style={{ color: filterAgent === agent ? AGENT_COLORS[agent] : undefined }}>
                      {agent.replace('Agent', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/6">
            <h3 className="text-xs font-semibold text-white/80 mb-3 uppercase tracking-wider">Event Type</h3>
            <div className="space-y-1">
              {['all', 'started', 'completed', 'tool_call', 'tool_result', 'processing', 'audit', 'failed'].map(type => (
                <button key={type} onClick={() => setFilterType(type)}
                  className={cn('w-full px-3 py-1.5 rounded-lg text-xs text-left transition-all capitalize',
                    filterType === type ? 'bg-cyan-500/15 text-cyan-300' : 'text-white/70 hover:text-white/50')}>
                  {EVENT_ICONS[type] || ''} {type === 'all' ? 'All Types' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="col-span-3">
          {loading && (
            <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          )}

          {!loading && notFoundMessage && (
            <div className="glass-panel rounded-2xl p-8 border border-amber-500/20 text-center">
              <p className="text-amber-400/80 text-sm mb-2">Session Not Found</p>
              <p className="text-white/80 text-xs">{notFoundMessage}</p>
              <p className="text-white/60 text-xs mt-2">Session states expire after 1 hour. Run a new workflow to generate a fresh session.</p>
            </div>
          )}

          {!loading && !sessionState && !notFoundMessage && (
            <div className="flex items-center justify-center h-64 text-white/60 text-sm">
              Enter a session ID from a completed agent workflow
            </div>
          )}

          {!loading && sessionState && (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/30 via-violet-500/20 to-transparent" />
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredEvents.map((event, i) => {
                    const agentColor = AGENT_COLORS[event.agent_name] || '#ffffff'
                    const icon = EVENT_ICONS[event.event_type] || '•'
                    const isCompleted = event.event_type === 'completed'
                    const isFailed = event.event_type === 'failed'
                    const isToolCall = event.event_type === 'tool_call'
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        className={cn('relative ml-14 rounded-xl p-4 border transition-all',
                          isCompleted ? 'border-emerald-500/20 bg-emerald-500/5' :
                          isFailed ? 'border-rose-500/20 bg-rose-500/5' :
                          isToolCall ? 'border-cyan-500/10 bg-cyan-500/3' :
                          'border-white/5 bg-white/2')}>
                        <div className="absolute -left-8 top-4 w-3 h-3 rounded-full border-2 transition-all"
                          style={{
                            borderColor: agentColor,
                            backgroundColor: isCompleted ? agentColor : 'transparent',
                            boxShadow: isCompleted ? `0 0 6px ${agentColor}60` : 'none',
                          }} />
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: agentColor }}>
                                {event.agent_name?.replace('Agent', '').replace(/([A-Z])/g, ' $1').trim() || 'System'}
                              </span>
                              <span className={cn('px-2 py-0.5 rounded-md text-xs font-mono',
                                isCompleted ? 'bg-emerald-500/15 text-emerald-400' :
                                isFailed ? 'bg-rose-500/15 text-rose-400' :
                                isToolCall ? 'bg-cyan-500/15 text-cyan-400' :
                                'bg-white/8 text-white/80')}>
                                {icon} {event.event_type?.replace('_', ' ')}
                              </span>
                              {event.data?.tool && (
                                <span className="text-xs text-white/70 font-mono">{event.data.tool}</span>
                              )}
                            </div>
                            <p className="text-sm text-white/65 leading-snug">{event.message}</p>
                            {event.data && !event.data.tool && Object.keys(event.data).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {Object.entries(event.data).slice(0, 3).map(([k, v]: any) => (
                                  <span key={k} className="px-2 py-0.5 rounded bg-white/4 text-xs text-white/70">
                                    <span className="text-white/50">{k}:</span> {String(v)?.slice(0, 25)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-white/50 flex-shrink-0 font-mono">
                            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {filteredEvents.length === 0 && (
                  <div className="text-center py-12 text-white/70 text-sm">No events match the current filters</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExplainabilityPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-void text-white/70 text-sm">
        Loading timeline...
      </div>
    }>
      <ExplainabilityPageInner />
    </Suspense>
  )
}
