'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '@/lib/api'
import { cn, formatDateTime } from '@/lib/utils'

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [hipaaControls, setHipaaControls] = useState<any[]>([])
  const [agentSessions, setAgentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [activeSection, setActiveSection] = useState<'logs' | 'hipaa' | 'agents'>('logs')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setErrorMsg('')
      try {
        const [logsRes, hipaaRes, sessionsRes] = await Promise.all([
          analyticsApi.auditLogs({ limit: 100 }),
          analyticsApi.hipaaStatus(),
          analyticsApi.agentSessions(50),
        ])
        setLogs(logsRes.data.logs || [])
        setHipaaControls(hipaaRes.data.controls || [])
        setAgentSessions(sessionsRes.data.sessions || [])
      } catch (err: any) {
        setErrorMsg(err?.response?.data?.detail || 'Failed to load audit data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const phiLogs = logs.filter(l => l.phi_accessed)
  const successRate = logs.length > 0
    ? Math.round((logs.filter(l => l.outcome === 'success').length / logs.length) * 100)
    : 100
  const compliantCount = hipaaControls.filter(c => c.status === 'compliant').length

  // Aggregate real agent stats from sessions
  const agentAggregates: Record<string, { sessions: number; completed: number; failed: number }> = {}
  agentSessions.forEach(session => {
    const agentNames: string[] = session.completed_agents || []
    agentNames.forEach(name => {
      if (!agentAggregates[name]) agentAggregates[name] = { sessions: 0, completed: 0, failed: 0 }
      agentAggregates[name].sessions += 1
      agentAggregates[name].completed += 1
    })
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Audit and Compliance</h1>
          <p className="text-white/40 text-sm mt-1">HIPAA-aligned audit trail and compliance monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <div className="px-4 py-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">
                {compliantCount}/{hipaaControls.length} Controls Compliant
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Audit Events', value: loading ? '—' : logs.length, color: '#00f5ff' },
          { label: 'PHI Access Events', value: loading ? '—' : phiLogs.length, color: '#fbbf24' },
          { label: 'Success Rate', value: loading ? '—' : `${successRate}%`, color: '#00ff87' },
          { label: 'HIPAA Controls', value: loading ? '—' : `${compliantCount}/${hipaaControls.length}`, color: '#a855f7' },
        ].map(stat => (
          <div key={stat.label} className="glass-panel rounded-2xl p-4 border" style={{ borderColor: `${stat.color}15` }}>
            <p className="text-xs text-white/40 mb-2">{stat.label}</p>
            <p className="text-2xl font-display font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/6">
        {(['logs', 'hipaa', 'agents'] as const).map(section => (
          <button key={section} onClick={() => setActiveSection(section)}
            className={cn('px-5 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeSection === section ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-white/40 hover:text-white/60')}>
            {section === 'hipaa' ? 'HIPAA Controls' : section === 'agents' ? 'Agent Audit' : 'Audit Log'}
          </button>
        ))}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-sm text-amber-400">{errorMsg}</p>
          <p className="text-xs text-white/30 mt-1">Ensure the backend is running and the database is seeded.</p>
        </div>
      )}

      {/* Audit Log */}
      {activeSection === 'logs' && (
        <div className="flex gap-5">
          <div className="flex-1 glass-panel rounded-2xl border border-white/6 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wide">Audit Events</span>
              <span className="text-xs text-white/30">{logs.length} total</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
              {loading ? (
                Array(8).fill(0).map((_, i) => <div key={i} className="mx-4 my-2 skeleton h-14 rounded-xl" />)
              ) : logs.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">
                  <p>No audit events yet.</p>
                  <p className="text-xs mt-1">Run an agent workflow to generate audit logs.</p>
                </div>
              ) : logs.map((log, i) => (
                <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  onClick={() => setSelectedLog(log)}
                  className={cn('flex items-center gap-4 px-5 py-3.5 border-b border-white/4 cursor-pointer transition-all last:border-0',
                    selectedLog?.id === log.id ? 'bg-cyan-500/8' : 'hover:bg-white/2')}>
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                    log.outcome === 'success' ? 'bg-emerald-400' : 'bg-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/70 font-mono">{log.action}</span>
                      {log.phi_accessed && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20">PHI</span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 mt-0.5 truncate">{log.agent_name || 'System'}</p>
                  </div>
                  <span className="text-xs text-white/25 flex-shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {selectedLog && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="w-80 glass-panel rounded-2xl border border-white/6 p-5 space-y-4 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">Event Detail</h3>
              <div className="space-y-3">
                {[
                  { label: 'Action', value: selectedLog.action },
                  { label: 'Agent', value: selectedLog.agent_name || '—' },
                  { label: 'Resource Type', value: selectedLog.resource_type || '—' },
                  { label: 'Outcome', value: selectedLog.outcome || '—' },
                  { label: 'PHI Accessed', value: selectedLog.phi_accessed ? 'Yes' : 'No' },
                  { label: 'Timestamp', value: formatDateTime(selectedLog.created_at) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-white/30 mb-0.5">{label}</p>
                    <p className="text-sm text-white/70">{value}</p>
                  </div>
                ))}
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-white/30 mb-2">Details</p>
                  <pre className="text-xs text-white/45 bg-white/4 rounded-xl p-3 overflow-auto max-h-32 font-mono">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* HIPAA Controls — real from API */}
      {activeSection === 'hipaa' && (
        <div className="space-y-3">
          {loading ? (
            Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
          ) : hipaaControls.length === 0 ? (
            <p className="text-white/30 text-sm">HIPAA status unavailable — backend may be offline.</p>
          ) : hipaaControls.map((ctrl, i) => (
            <motion.div key={ctrl.control} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-panel rounded-xl px-5 py-4 border border-white/6 flex items-center gap-4">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                ctrl.status === 'compliant' ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-amber-500/15 border border-amber-500/30')}>
                {ctrl.status === 'compliant' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 9v4"/><path d="M12 17h.01"/>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/80">{ctrl.control}</p>
                <p className="text-xs text-white/40 mt-0.5">{ctrl.detail}</p>
              </div>
              <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0',
                ctrl.status === 'compliant' ? 'status-approved' : 'status-pending')}>
                {ctrl.status === 'compliant' ? 'Compliant' : 'Review Needed'}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Agent Audit — from real session data */}
      {activeSection === 'agents' && (
        <div className="glass-panel rounded-2xl border border-white/6 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/6">
            <h3 className="text-sm font-semibold text-white">Agent Activity Summary</h3>
            <p className="text-xs text-white/30 mt-0.5">Aggregated from {agentSessions.length} agent sessions</p>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : Object.keys(agentAggregates).length === 0 ? (
            <div className="p-12 text-center text-white/25 text-sm">
              No agent activity yet. Run a workflow from the Agent Network page.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Agent', 'Total Invocations', 'Completions', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(agentAggregates).map(([agent, data], i) => (
                  <motion.tr key={agent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-sm text-white/70">{agent}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-white/50">{data.sessions}</td>
                    <td className="px-6 py-4 text-sm font-mono text-emerald-400/80">{data.completed}</td>
                    <td className="px-6 py-4">
                      <span className="status-approved px-2.5 py-1 rounded-lg text-xs font-medium">Operational</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
