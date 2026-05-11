'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { analyticsApi, patientsApi } from '@/lib/api'
import { cn, getRiskColor } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const StatCard = ({ title, value, sub, color, icon, delay = 0 }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay }} className="glass-panel rounded-2xl p-5 border"
    style={{ borderColor: `${color}18` }}>
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-right">
        <div className="text-2xl font-display font-bold text-white">{value}</div>
        <div className="text-xs text-white/35 mt-0.5">{sub}</div>
      </div>
    </div>
    <p className="text-sm text-white/45 font-medium">{title}</p>
  </motion.div>
)

const customTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel rounded-xl px-4 py-3 border border-white/10 text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [agentSessions, setAgentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const loadData = async () => {
    try {
      const [statsRes, patientsRes, trendsRes, sessionsRes] = await Promise.all([
        analyticsApi.dashboard(),
        patientsApi.list({ limit: 6 }),
        analyticsApi.approvalTrends(),
        analyticsApi.agentSessions ? analyticsApi.agentSessions() : Promise.resolve({ data: { sessions: [] } }),
      ])
      setStats(statsRes.data)
      setPatients(patientsRes.data)
      setTrends(trendsRes.data.trends?.slice(-14) || [])
      setAgentSessions(sessionsRes.data.sessions || [])
    } catch (err) {
      console.error('Dashboard load error', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Poll every 15s for live agent activity
    pollRef.current = setInterval(loadData, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const recentSessions = agentSessions.slice(0, 8)
  const runningSession = agentSessions.find(s => s.status === 'running')

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl font-bold text-white">
            Clinical Intelligence Dashboard
          </motion.h1>
          <p className="text-white/40 text-sm mt-1">Real-time multi-agent healthcare operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border',
            runningSession
              ? 'border-cyan-400/20 bg-cyan-400/5'
              : 'border-emerald-400/20 bg-emerald-400/5')}>
            <div className={cn('w-2 h-2 rounded-full',
              runningSession ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400')} />
            <span className={cn('text-xs font-medium',
              runningSession ? 'text-cyan-400' : 'text-emerald-400')}>
              {runningSession ? 'Agent Workflow Running' : 'All Systems Operational'}
            </span>
          </div>
          <Link href="/agents">
            <button className="px-4 py-2 rounded-xl text-xs font-semibold text-void"
              style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 15px rgba(0,245,255,0.25)' }}>
              Launch Agent Workflow
            </button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard delay={0} title="Total Patients" value={loading ? '—' : stats?.total_patients ?? 0} sub="Active cases" color="#00f5ff"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
        <StatCard delay={0.05} title="Pending Authorizations" value={loading ? '—' : stats?.pending_auths ?? 0} sub="Awaiting decision" color="#fbbf24"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12"/><polyline points="14,2 14,8 20,8"/></svg>} />
        <StatCard delay={0.1} title="Approval Rate" value={loading ? '—' : `${Math.round((stats?.approval_rate || 0) * 100)}%`} sub={`${stats?.approved_auths ?? 0} approved`} color="#00ff87"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>} />
        <StatCard delay={0.15} title="Time Saved" value={loading ? '—' : `${Math.round(stats?.time_saved_hours || 0)}h`} sub="vs manual processing" color="#a855f7"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>} />
      </div>

      {/* Charts + agent feed */}
      <div className="grid grid-cols-3 gap-6">
        {/* Trends chart */}
        <div className="col-span-2 glass-panel rounded-2xl p-6 border border-white/6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Authorization Trends</h3>
              <p className="text-xs text-white/35 mt-0.5">14-day real authorization data</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/35">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>Submitted</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Approved</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"/>Denied</span>
            </div>
          </div>
          {loading ? (
            <div className="h-48 skeleton rounded-xl" />
          ) : trends.length === 0 || trends.every(t => t.submitted === 0) ? (
            <div className="h-48 flex items-center justify-center text-white/25 text-sm">
              No authorization data yet. Create prior authorizations to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.25}/><stop offset="100%" stopColor="#00f5ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff87" stopOpacity={0.25}/><stop offset="100%" stopColor="#00ff87" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gRose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2}/><stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={customTooltip} />
                <Area type="monotone" dataKey="submitted" stroke="#00f5ff" strokeWidth={2} fill="url(#gCyan)" name="Submitted" />
                <Area type="monotone" dataKey="approved" stroke="#00ff87" strokeWidth={2} fill="url(#gGreen)" name="Approved" />
                <Area type="monotone" dataKey="denied" stroke="#f43f5e" strokeWidth={1.5} fill="url(#gRose)" name="Denied" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Live agent session feed - real data */}
        <div className="glass-panel rounded-2xl p-6 border border-white/6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Agent Sessions</h3>
            <Link href="/agents" className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">View graph</Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)
            ) : recentSessions.length > 0 ? (
              recentSessions.map((session, i) => (
                <motion.div key={session.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-2.5 border-b border-white/4 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                      session.status === 'running' ? 'bg-cyan-400 animate-pulse' :
                      session.status === 'completed' ? 'bg-emerald-400' :
                      session.status === 'failed' ? 'bg-rose-400' : 'bg-white/20'
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs text-white/60 truncate capitalize">{session.session_type} workflow</p>
                      <p className="text-xs text-white/25">
                        {session.completed_agents?.length || 0}/10 agents
                        {session.tool_calls > 0 && ` · ${session.tool_calls} calls`}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-xs flex-shrink-0 ml-2',
                    session.status === 'completed' ? 'text-emerald-400' :
                    session.status === 'running' ? 'text-cyan-400' :
                    session.status === 'failed' ? 'text-rose-400' : 'text-white/30')}>
                    {session.status}
                  </span>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-6 text-white/20 text-xs">
                <p>No agent sessions yet.</p>
                <p className="mt-1">Run a workflow from the Agent Network page.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent patients */}
      <div className="glass-panel rounded-2xl border border-white/6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <h3 className="text-sm font-semibold text-white">Recent Patients</h3>
          <Link href="/patients" className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">View all</Link>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-white/25 text-sm">
            <p>No patients yet. Run the seed script to add demo patients.</p>
            <code className="text-xs mt-2 block text-white/20">python -m app.scripts.seed_data</code>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Patient', 'MRN', 'Diagnosis', 'Risk', 'Insurance', 'Actions'].map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((patient, i) => (
                  <motion.tr key={patient.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/patients/${patient.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                          {patient.first_name?.[0]}{patient.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">{patient.first_name} {patient.last_name}</p>
                          <p className="text-xs text-white/30 capitalize">{patient.gender}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/40 font-mono">{patient.mrn}</td>
                    <td className="px-6 py-4 text-xs text-white/55 max-w-48 truncate">{patient.primary_diagnosis || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border', getRiskColor(patient.risk_level))}>
                        {patient.risk_level || 'low'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/40">{patient.insurance_provider || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/patients/${patient.id}`}
                          className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors px-2.5 py-1 rounded-lg border border-cyan-500/15 hover:border-cyan-500/30">
                          View
                        </Link>
                        <Link href={`/agents?patient=${patient.id}`}
                          className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors px-2.5 py-1 rounded-lg border border-violet-500/15 hover:border-violet-500/30">
                          Run AI
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
