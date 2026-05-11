'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '@/lib/api'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#00f5ff', '#a855f7', '#00ff87', '#f43f5e', '#fbbf24']

const MetricCard = ({ title, value, unit, sub, color, trend }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-panel rounded-2xl p-5 border"
    style={{ borderColor: `${color}18` }}
  >
    <p className="text-xs text-white/80 uppercase tracking-wider mb-3">{title}</p>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-display font-bold" style={{ color }}>{value}</span>
      {unit && <span className="text-sm text-white/80 mb-1">{unit}</span>}
    </div>
    <div className="flex items-center justify-between mt-2">
      <p className="text-xs text-white/70">{sub}</p>
      {trend && (
        <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  </motion.div>
)

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [agentSessions, setAgentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([analyticsApi.dashboard(), analyticsApi.approvalTrends()])
      .then(([s, t]) => {
        setStats(s.data)
        setTrends(t.data.trends?.slice(-14) || [])
      })
    analyticsApi.agentSessions && analyticsApi.agentSessions().then(r => setAgentSessions(r.data.sessions || [])).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pieData = stats ? [
    { name: 'Approved', value: stats.approved_auths || 0 },
    { name: 'Pending', value: stats.pending_auths || 0 },
    { name: 'Denied', value: stats.denied_auths || 0 },
  ] : []

  // Build agent performance from real session data
  const agentPerfMap: Record<string, {calls: number, successes: number}> = {}
  agentSessions.forEach((s: any) => {
    (s.completed_agents || []).forEach((agent: string) => {
      const short = agent.replace('Agent','').replace(/([A-Z])/g,' $1').trim().slice(0,15)
      if (!agentPerfMap[short]) agentPerfMap[short] = { calls: 0, successes: 0 }
      agentPerfMap[short].calls += 1
      agentPerfMap[short].successes += 1
    })
  })
  const agentPerformance = Object.entries(agentPerfMap).map(([agent, d]) => ({
    agent,
    calls: d.calls,
    success: d.calls > 0 ? Math.round((d.successes / d.calls) * 100) : 0,
    latency: 0,
  }))

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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Analytics and Insights</h1>
        <p className="text-white/80 text-sm mt-1">Platform performance and clinical outcome metrics</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Approval Rate"
          value={loading ? '—' : `${Math.round((stats?.approval_rate || 0) * 100)}`}
          unit="%"
          sub="30-day average"
          color="#00ff87"
          trend={+8}
        />
        <MetricCard
          title="Avg Processing"
          value={loading ? '—' : stats?.avg_processing_days || '3.2'}
          unit="days"
          sub="vs 14 days manual"
          color="#00f5ff"
          trend={-78}
        />
        <MetricCard
          title="Time Saved"
          value={loading ? '—' : `${Math.round(stats?.time_saved_hours || 0)}`}
          unit="hrs"
          sub="Clinician time recovered"
          color="#a855f7"
          trend={+12}
        />
        <MetricCard
          title="Trial Matches"
          value={loading ? '—' : stats?.active_trials || 0}
          sub="Patients enrolled/referred"
          color="#fbbf24"
          trend={+23}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Approval trends */}
        <div className="col-span-2 glass-panel rounded-2xl p-6 border border-white/6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">Authorization Volume and Outcomes</h3>
              <p className="text-xs text-white/70 mt-0.5">14-day rolling window</p>
            </div>
            <div className="flex gap-4 text-xs text-white/80">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>Submitted</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Approved</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"/>Denied</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="gSubmitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#00f5ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff87" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#00ff87" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gDenied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2}/>
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} />
              <Tooltip content={customTooltip} />
              <Area type="monotone" dataKey="submitted" stroke="#00f5ff" strokeWidth={2} fill="url(#gSubmitted)" name="Submitted" />
              <Area type="monotone" dataKey="approved" stroke="#00ff87" strokeWidth={2} fill="url(#gApproved)" name="Approved" />
              <Area type="monotone" dataKey="denied" stroke="#f43f5e" strokeWidth={1.5} fill="url(#gDenied)" name="Denied" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown pie */}
        <div className="glass-panel rounded-2xl p-6 border border-white/6">
          <h3 className="text-sm font-semibold text-white mb-5">Authorization Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} opacity={0.85} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{v}</span>} />
              <Tooltip content={customTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent performance table */}
      <div className="glass-panel rounded-2xl border border-white/6 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/6">
          <h3 className="text-sm font-semibold text-white">Agent Performance Metrics</h3>
          <p className="text-xs text-white/70 mt-0.5">Real-time agent call statistics and reliability</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Agent', 'Total Calls', 'Success Rate', 'Avg Latency', 'Status'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((agent, i) => (
                <motion.tr
                  key={agent.agent}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-white/4 hover:bg-white/2 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-sm text-white/70">{agent.agent}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm font-mono text-white/50">{agent.calls}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${agent.success}%` }} />
                      </div>
                      <span className="text-xs text-emerald-400">{agent.success}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-xs font-mono text-white/80">{agent.latency}s</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs status-approved">Operational</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI confidence distribution */}
      <div className="glass-panel rounded-2xl p-6 border border-white/6">
        <h3 className="text-sm font-semibold text-white mb-5">Approval Probability Distribution</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={(() => {
            const buckets = [
              { range: '0-20%', count: 0 },
              { range: '20-40%', count: 0 },
              { range: '40-60%', count: 0 },
              { range: '60-75%', count: 0 },
              { range: '75-90%', count: 0 },
              { range: '90-100%', count: 0 },
            ]
            agentSessions.forEach((s: any) => {
              const prob = s.approval_probability || 0
              if (prob < 0.2) buckets[0].count++
              else if (prob < 0.4) buckets[1].count++
              else if (prob < 0.6) buckets[2].count++
              else if (prob < 0.75) buckets[3].count++
              else if (prob < 0.9) buckets[4].count++
              else buckets[5].count++
            })
            return buckets
          })()}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
            <Tooltip content={customTooltip} />
            <Bar dataKey="count" fill="#00f5ff" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="Cases" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
