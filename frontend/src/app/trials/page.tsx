'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { trialsApi, patientsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer
} from 'recharts'

export default function TrialsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [selectedMatch, setSelectedMatch] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'en' | 'hi'>('en')

  useEffect(() => {
    patientsApi.list({ limit: 20 }).then(r => {
      setPatients(r.data)
      if (r.data.length > 0) setSelectedPatient(r.data[0].id)
    })
  }, [])

  const findTrials = async () => {
    if (!selectedPatient) return
    setLoading(true)
    setMatches([])
    setSelectedMatch(null)
    try {
      const res = await trialsApi.match({ patient_id: selectedPatient, max_results: 5 })
      setMatches(res.data.matches || [])
      if (res.data.matches?.length > 0) setSelectedMatch(res.data.matches[0])
      toast.success(`Found ${res.data.matches?.length || 0} trial matches`)
    } catch {
      toast.error('Failed to search trials')
    }
    setLoading(false)
  }

  const getMatchColor = (score: number) => {
    if (score >= 0.75) return '#00ff87'
    if (score >= 0.5) return '#fbbf24'
    return '#f43f5e'
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      eligible: 'status-approved',
      possibly_eligible: 'status-pending',
      ineligible: 'status-denied',
    }
    return map[status] || 'status-pending'
  }

  const radarData = selectedMatch ? [
    { subject: 'Age', value: 85 },
    { subject: 'Diagnosis', value: selectedMatch.match_score * 100 },
    { subject: 'Performance', value: 78 },
    { subject: 'Prior Tx', value: selectedMatch.confidence * 100 },
    { subject: 'Genomics', value: selectedMatch.genomic_compatibility?.compatibility === 'high' ? 90 : 60 },
    { subject: 'Location', value: 70 },
  ] : []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: search + results */}
      <div className="w-96 border-r border-white/6 flex flex-col bg-abyss overflow-hidden">
        {/* Search controls */}
        <div className="p-5 border-b border-white/6 space-y-4">
          <div>
            <h2 className="font-display font-bold text-white">Clinical Trial Matchmaker</h2>
            <p className="text-xs text-white/80 mt-0.5">AI-powered precision medicine matching</p>
          </div>
          <div>
            <label className="text-xs text-white/80 mb-1.5 block">Patient</label>
            <select
              value={selectedPatient}
              onChange={e => setSelectedPatient(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none"
            >
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={findTrials}
            disabled={loading || !selectedPatient}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-void disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 15px rgba(0,245,255,0.2)' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
                </svg>
                Searching ClinicalTrials.gov...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Find Matching Trials
              </>
            )}
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          )}
          <AnimatePresence>
            {matches.map((match, i) => {
              const score = match.match_score
              const color = getMatchColor(score)
              return (
                <motion.div
                  key={match.trial?.nct_id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setSelectedMatch(match)}
                  className={cn(
                    'p-4 rounded-xl cursor-pointer border transition-all',
                    selectedMatch?.trial?.nct_id === match.trial?.nct_id
                      ? 'border-cyan-500/30 bg-cyan-500/8'
                      : 'border-white/6 bg-white/2 hover:bg-white/4'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white/70 mb-0.5">{match.trial?.nct_id}</p>
                      <p className="text-sm font-medium text-white/80 leading-snug line-clamp-2">
                        {match.trial?.title}
                      </p>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-md text-xs flex-shrink-0', getStatusBadge(match.status))}>
                      {match.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-white/70">{match.trial?.phase || '—'}</span>
                    <span className="text-white/15">•</span>
                    <span className="text-xs text-white/70 truncate">{match.trial?.sponsor}</span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {!loading && matches.length === 0 && (
            <div className="text-center py-10 text-white/50 text-xs">
              <p>Select a patient and click</p>
              <p>"Find Matching Trials" to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Trial detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedMatch ? (
          <div className="p-8 space-y-6">
            {/* Trial header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-cyan-400/60 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-lg">
                  {selectedMatch.trial?.nct_id}
                </span>
                <span className="text-xs text-white/80">{selectedMatch.trial?.phase}</span>
                <span className="text-xs px-2.5 py-1 rounded-lg border"
                  style={{
                    color: getMatchColor(selectedMatch.match_score),
                    borderColor: `${getMatchColor(selectedMatch.match_score)}30`,
                    background: `${getMatchColor(selectedMatch.match_score)}10`,
                  }}>
                  {Math.round(selectedMatch.match_score * 100)}% match
                </span>
              </div>
              <h1 className="font-display text-xl font-bold text-white leading-snug">
                {selectedMatch.trial?.title}
              </h1>
              <p className="text-sm text-white/80 mt-1">{selectedMatch.trial?.sponsor}</p>
            </div>

            {/* Radar + eligibility grid */}
            <div className="grid grid-cols-2 gap-5">
              {/* Radar chart */}
              <div className="glass-panel rounded-2xl p-5 border border-white/6">
                <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wide">Compatibility Profile</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#00f5ff" fill="#00f5ff" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Criteria summary */}
              <div className="glass-panel rounded-2xl p-5 border border-white/6">
                <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wide">Eligibility Summary</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-emerald-400/70 mb-1.5 font-medium">Criteria Met ({selectedMatch.inclusion_met?.length || 0})</p>
                    <div className="space-y-1">
                      {(selectedMatch.inclusion_met || []).slice(0, 3).map((c: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 text-xs flex-shrink-0 mt-0.5">✓</span>
                          <span className="text-xs text-white/50 leading-snug">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(selectedMatch.missing_criteria || []).length > 0 && (
                    <div>
                      <p className="text-xs text-amber-400/70 mb-1.5 font-medium">Needs Clarification ({selectedMatch.missing_criteria?.length})</p>
                      <div className="space-y-1">
                        {(selectedMatch.missing_criteria || []).slice(0, 2).map((c: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-amber-400 text-xs flex-shrink-0 mt-0.5">?</span>
                            <span className="text-xs text-white/50 leading-snug">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Reasoning */}
            {selectedMatch.reasoning && (
              <div className="glass-panel rounded-2xl p-5 border border-cyan-500/15">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-cyan-400/80">Why This Trial?</h3>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">{selectedMatch.reasoning}</p>
              </div>
            )}

            {/* Patient Summary - language toggle */}
            {(selectedMatch.patient_summary_en || selectedMatch.patient_summary_hi) && (
              <div className="glass-panel rounded-2xl p-5 border border-violet-500/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-violet-300/70 uppercase tracking-wide">Patient-Friendly Summary</h3>
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                    <button onClick={() => setActiveTab('en')}
                      className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                        activeTab === 'en' ? 'bg-violet-500/30 text-violet-300' : 'text-white/80')}>
                      English
                    </button>
                    <button onClick={() => setActiveTab('hi')}
                      className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                        activeTab === 'hi' ? 'bg-violet-500/30 text-violet-300' : 'text-white/80')}>
                      Hindi
                    </button>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-sm text-white/60 leading-relaxed"
                  >
                    {activeTab === 'en' ? selectedMatch.patient_summary_en : selectedMatch.patient_summary_hi}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}

            {/* Trial locations */}
            {(selectedMatch.trial?.locations || []).length > 0 && (
              <div className="glass-panel rounded-2xl p-5 border border-white/6">
                <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wide">Trial Locations</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(selectedMatch.trial.locations || []).map((loc: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-cyan-400/50 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-white/70">{loc.facility}</p>
                        <p className="text-xs text-white/70">{loc.city}, {loc.state || loc.country}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white/60">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M9 3h6"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <p className="text-sm">Search for clinical trials to begin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
