'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { patientsApi } from '@/lib/api'
import { cn, formatDate, calculateAge, getRiskColor } from '@/lib/utils'

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  useEffect(() => {
    load()
  }, [search, riskFilter])

  const load = async () => {
    setLoading(true)
    try {
      const res = await patientsApi.list({ search: search || undefined, risk_level: riskFilter || undefined, limit: 50 })
      setPatients(res.data)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Patient Registry</h1>
          <p className="text-white/80 text-sm mt-1">FHIR-compatible patient management</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/40 w-64"
            />
          </div>
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 border border-white/6 h-40 skeleton" />
          ))
        ) : patients.map((patient, i) => (
          <motion.div
            key={patient.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link href={`/patients/${patient.id}`}>
              <div className="glass-panel rounded-2xl p-5 border border-white/6 hover:border-cyan-500/20 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                      {patient.first_name?.[0]}{patient.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white/90">{patient.first_name} {patient.last_name}</p>
                      <p className="text-xs text-white/70 font-mono">{patient.mrn}</p>
                    </div>
                  </div>
                  <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border', getRiskColor(patient.risk_level))}>
                    {patient.risk_level}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-white/70 flex-shrink-0 w-20">Diagnosis</span>
                    <span className="text-xs text-white/60 leading-snug">{patient.primary_diagnosis || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 w-20">Age / Gender</span>
                    <span className="text-xs text-white/60">{calculateAge(patient.date_of_birth)} yrs • {patient.gender || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 w-20">Insurance</span>
                    <span className="text-xs text-white/60">{patient.insurance_provider || '—'}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-white/70">Active</span>
                  </div>
                  <span className="text-xs text-cyan-400/60 group-hover:text-cyan-400 transition-colors">
                    View profile
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {!loading && patients.length === 0 && (
        <div className="text-center py-20 text-white/70">
          <p className="text-lg">No patients found</p>
          <p className="text-sm mt-1">Run the seed script or adjust your filters</p>
        </div>
      )}
    </div>
  )
}
