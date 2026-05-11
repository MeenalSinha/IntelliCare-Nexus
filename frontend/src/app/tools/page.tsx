'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toolsApi, patientsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const TOOL_CATEGORIES: Record<string, string> = {
  parse_fhir_bundle: 'FHIR',
  build_fhir_bundle: 'FHIR',
  find_eligible_trials: 'Clinical Trials',
  fetch_payer_policy: 'Authorization',
  generate_medical_necessity_letter: 'Authorization',
  calculate_approval_probability: 'Authorization',
  generate_appeal_letter: 'Authorization',
  eligibility_reasoning: 'Clinical Trials',
  generate_patient_summary: 'Communication',
  parse_clinical_notes: 'Clinical Notes',
  detect_authorization_requirements: 'Authorization',
  log_compliance_event: 'Compliance',
}

const TOOL_COLORS: Record<string, string> = {
  FHIR: '#00f5ff',
  'Clinical Trials': '#a855f7',
  Authorization: '#00ff87',
  Communication: '#f97316',
  'Clinical Notes': '#fbbf24',
  Compliance: '#64748b',
}

const QUICK_PARAMS: Record<string, any> = {
  fetch_payer_policy: {
    payer_name: 'UnitedHealthcare',
    procedure_code: 'J9271',
    diagnosis_codes: ['C34.10'],
  },
  detect_authorization_requirements: {
    medications: [
      { name: 'Pembrolizumab (Keytruda)', dose: '200mg', route: 'IV' },
      { name: 'Carboplatin', dose: 'AUC 6', route: 'IV' },
    ],
    procedures: [{ name: 'MRI Brain with Contrast', code: '70553', urgency: 'urgent' }],
    payer_name: 'UnitedHealthcare',
  },
  parse_clinical_notes: {
    note_text: 'Patient Arjun Sharma presents with 3-month history of productive cough and hemoptysis. ' +
      'CT chest shows 4.2cm RUL mass. Biopsy confirmed adenocarcinoma. ' +
      'NGS panel: KRAS G12C mutation, PD-L1 TPS 85%. ' +
      'ECOG PS 1. Plan: pembrolizumab + carboplatin + pemetrexed.',
    extract_fields: ['diagnoses', 'medications', 'genomic_findings', 'assessment', 'plan'],
  },
  generate_patient_summary: {
    patient_context: {
      patient_name: 'Arjun',
      diagnosis: 'Non-small cell lung cancer, stage IIIB',
      medications: ['Pembrolizumab', 'Carboplatin', 'Pemetrexed'],
      eligible_trials: ['CODEBREAK 200 — Sotorasib trial'],
      authorization_status: 'In Progress',
      approval_probability_pct: '88%',
    },
    language: 'en',
    context_type: 'cancer treatment and clinical trial options',
  },
  log_compliance_event: {
    action: 'fhir_bundle_parsed',
    agent_name: 'ClinicalContextAgent',
    patient_id: 'demo-patient-id',
    details: { diagnoses_count: 2, session_id: 'demo-session' },
  },
  build_fhir_bundle: {
    patient_data: {
      id: "demo-123",
      mrn: "MRN88492",
      first_name: "Arjun",
      last_name: "Sharma",
      gender: "male",
      date_of_birth: "1966-03-15",
      language_preference: "en",
      phone: "+1-555-0198",
      diagnosis_codes: ["C34.10"],
      primary_diagnosis: "Non-small cell lung cancer",
      medications: [
        { name: "Pembrolizumab", dose: "200mg", frequency: "Q3W" }
      ],
      lab_results: [
        { test: "PD-L1 TPS", value: "85%", date: "2023-02-01" }
      ],
      insurance_provider: "UnitedHealthcare",
      insurance_policy_number: "UH99281A"
    }
  },
  parse_fhir_bundle: {
    fhir_bundle: {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'demo-123',
            name: [{ use: 'official', family: 'Sharma', given: ['Arjun'] }],
            gender: 'male',
            birthDate: '1966-03-15',
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'C34.10', display: 'Non-small cell lung cancer' }] },
            clinicalStatus: { coding: [{ code: 'active' }] },
            subject: { reference: 'Patient/demo-123' },
          },
        },
      ],
    },
  },
  find_eligible_trials: {
    patient_context: {
      primary_diagnoses: [{ code: 'C34.10', description: 'Non-small cell lung cancer, stage IIIB' }],
      genomic_findings: [{ gene: 'KRAS', variant: 'G12C' }],
      relevant_labs: [{ test: 'PD-L1 TPS', value: '85%' }],
      age: 58,
      gender: 'male',
      ecog_ps: 1,
    },
    max_results: 3,
  },
  generate_medical_necessity_letter: {
    patient_context: {
      patient_name: 'Arjun Sharma',
      age: 58,
      diagnosis: 'Non-small cell lung cancer, Stage IIIB (C34.10)',
      ecog_ps: 1,
      genomics: 'KRAS G12C mutation, PD-L1 TPS 85%',
      prior_treatments: 'Treatment-naive',
    },
    procedure: {
      name: 'Pembrolizumab (Keytruda)',
      code: 'J9271',
      indication: 'First-line metastatic NSCLC with PD-L1 TPS >= 50%',
    },
    payer_criteria: {
      payer: 'UnitedHealthcare',
      criteria: ['PD-L1 TPS >= 50%', 'No prior checkpoint inhibitor', 'ECOG PS 0-2'],
      documentation_required: ['Pathology report', 'PD-L1 assay result', 'Performance status documentation'],
    },
  },
  calculate_approval_probability: {
    patient_context: {
      patient_name: 'Arjun Sharma',
      age: 58,
      diagnosis: 'Non-small cell lung cancer, Stage IIIB',
      ecog_ps: 1,
      genomics: 'KRAS G12C mutation, PD-L1 TPS 85%',
    },
    procedure: {
      name: 'Pembrolizumab (Keytruda)',
      code: 'J9271',
      indication: 'First-line metastatic NSCLC',
    },
    payer_criteria: {
      payer: 'UnitedHealthcare',
      criteria: ['PD-L1 TPS >= 50%', 'ECOG PS 0-2', 'No prior checkpoint inhibitor therapy'],
    },
  },
  generate_appeal_letter: {
    patient_context: {
      patient_name: 'Arjun Sharma',
      age: 58,
      diagnosis: 'Non-small cell lung cancer, Stage IIIB (C34.10)',
      ecog_ps: 1,
      genomics: 'KRAS G12C mutation, PD-L1 TPS 85%',
    },
    prior_auth: {
      id: 'PA-2024-001',
      procedure: 'Pembrolizumab (Keytruda) J9271',
      payer: 'UnitedHealthcare',
      submitted_date: '2024-01-15',
      status: 'DENIED',
    },
    denial_reason: 'Medical necessity not established. PD-L1 documentation insufficient per payer policy UHC-ONC-2024-11.',
  },
  eligibility_reasoning: {
    patient_context: {
      age: 58,
      gender: 'male',
      diagnosis: 'Non-small cell lung cancer, Stage IIIB',
      ecog_ps: 1,
      genomics: { KRAS: 'G12C', 'PD-L1 TPS': '85%' },
      prior_treatments: [],
      active_conditions: ['NSCLC'],
    },
    trial: {
      nct_id: 'NCT04269928',
      title: 'CODEBREAK 200: Sotorasib vs Docetaxel in KRAS G12C NSCLC',
      phase: 'Phase 3',
      inclusion_criteria: ['KRAS G12C mutation', 'Stage IIIB/IV NSCLC', 'ECOG PS 0-2', 'Age 18+'],
      exclusion_criteria: ['Active CNS metastases', 'Prior KRAS inhibitor therapy'],
    },
  },
}

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [params, setParams] = useState<string>('{}')
  const [result, setResult] = useState<any>(null)
  const [invoking, setInvoking] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [activeTab, setActiveTab] = useState<'params' | 'result'>('params')

  useEffect(() => {
    toolsApi.list().then(r => {
      setTools(r.data.tools || [])
    }).catch(() => {
      // Fallback: show hardcoded tool list for demo
      setTools([
        { name: 'parse_fhir_bundle', description: 'Parse a FHIR R4 Bundle and extract structured clinical context', input_schema: { fhir_bundle: 'dict' } },
        { name: 'find_eligible_trials', description: 'Query ClinicalTrials.gov and return ranked matching trials for a patient', input_schema: { patient_context: 'dict', max_results: 'int' } },
        { name: 'fetch_payer_policy', description: 'Retrieve insurance payer coverage criteria for a given procedure/drug', input_schema: { payer_name: 'str', procedure_code: 'str', diagnosis_codes: 'list' } },
        { name: 'generate_medical_necessity_letter', description: 'Generate a physician-ready medical necessity letter using Gemini AI', input_schema: { patient_context: 'dict', procedure: 'dict', payer_criteria: 'dict' } },
        { name: 'calculate_approval_probability', description: 'Predict the probability of prior authorization approval using AI analysis', input_schema: { patient_context: 'dict', procedure: 'dict', payer_criteria: 'dict' } },
        { name: 'generate_appeal_letter', description: 'Autonomously generate a denial appeal letter citing clinical guidelines', input_schema: { patient_context: 'dict', prior_auth: 'dict', denial_reason: 'str' } },
        { name: 'eligibility_reasoning', description: 'Explain why a patient qualifies or disqualifies for a clinical trial', input_schema: { patient_context: 'dict', trial: 'dict' } },
        { name: 'generate_patient_summary', description: 'Create a patient-friendly summary in English or Hindi', input_schema: { patient_context: 'dict', language: 'str', context_type: 'str' } },
        { name: 'parse_clinical_notes', description: 'Extract structured information from unstructured clinical notes using Gemini', input_schema: { note_text: 'str', extract_fields: 'list' } },
        { name: 'build_fhir_bundle', description: 'Build a FHIR R4 Bundle from structured patient data', input_schema: { patient_data: 'dict' } },
        { name: 'detect_authorization_requirements', description: 'Identify medications and procedures that require prior authorization', input_schema: { medications: 'list', procedures: 'list', payer_name: 'str' } },
        { name: 'log_compliance_event', description: 'Log a HIPAA-compliant audit event to the compliance trail', input_schema: { action: 'str', agent_name: 'str', patient_id: 'str', details: 'dict' } },
      ])
    }).finally(() => setLoading(false))
  }, [])

  const selectTool = (tool: any) => {
    setSelected(tool)
    setResult(null)
    setActiveTab('params')
    const quick = QUICK_PARAMS[tool.name]
    setParams(quick ? JSON.stringify(quick, null, 2) : '{}')
  }

  const invokeTool = async () => {
    if (!selected) return
    setInvoking(true)
    setActiveTab('result')
    try {
      const parsed = JSON.parse(params)
      const res = await toolsApi.invoke(selected.name, parsed)
      setResult(res.data)
      toast.success(`Tool invoked in ${res.data.latency_ms}ms`)
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Invocation failed'
      setResult({ error: errMsg })
      toast.error('Tool invocation failed')
    } finally {
      setInvoking(false)
    }
  }

  const categories = ['all', ...new Set(Object.values(TOOL_CATEGORIES))]
  const filteredTools = tools.filter(t =>
    filterCat === 'all' || TOOL_CATEGORIES[t.name] === filterCat
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — tool list */}
      <div className="w-80 border-r border-white/6 bg-abyss flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/6">
          <h2 className="font-display font-bold text-white">MCP Tool Registry</h2>
          <p className="text-xs text-white/80 mt-0.5">{tools.length} tools • Live invocation</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={cn('px-2.5 py-1 rounded-lg text-xs transition-all capitalize',
                  filterCat === cat ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-white/80 hover:bg-white/8')}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            Array(8).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
          ) : filteredTools.map((tool, i) => {
            const cat = TOOL_CATEGORIES[tool.name] || 'Other'
            const color = TOOL_COLORS[cat] || '#ffffff'
            return (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => selectTool(tool)}
                className={cn(
                  'p-3.5 rounded-xl cursor-pointer border transition-all',
                  selected?.name === tool.name
                    ? 'border-cyan-500/30 bg-cyan-500/8'
                    : 'border-white/6 hover:bg-white/4'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-mono font-medium text-white/80 truncate">{tool.name}</span>
                </div>
                <p className="text-xs text-white/80 leading-snug line-clamp-2">{tool.description}</p>
                <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-md"
                  style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                  {cat}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Right panel — tool detail + invocation */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Tool header */}
            <div className="p-6 border-b border-white/6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono px-3 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                      tool_registry.invoke()
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg"
                      style={{
                        background: `${TOOL_COLORS[TOOL_CATEGORIES[selected.name] || 'Other'] || '#fff'}12`,
                        color: TOOL_COLORS[TOOL_CATEGORIES[selected.name] || 'Other'] || '#fff',
                        border: `1px solid ${TOOL_COLORS[TOOL_CATEGORIES[selected.name] || 'Other'] || '#fff'}25`,
                      }}>
                      {TOOL_CATEGORIES[selected.name] || 'Other'}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white font-mono">{selected.name}</h2>
                  <p className="text-sm text-white/50 mt-1">{selected.description}</p>
                </div>
                <button
                  onClick={invokeTool}
                  disabled={invoking}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-void disabled:opacity-40 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 15px rgba(0,245,255,0.2)' }}
                >
                  {invoking ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/></svg>Invoking...</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Invoke Tool</>
                  )}
                </button>
              </div>

              {/* Schema */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(selected.input_schema || {}).map(([key, type]) => (
                  <span key={key} className="px-3 py-1 rounded-lg bg-white/5 border border-white/8 text-xs">
                    <span className="text-white/80">{String(type)}</span>
                    <span className="text-white/15 mx-1.5">·</span>
                    <span className="text-white/60 font-mono">{key}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-4 border-b border-white/6">
              {(['params', 'result'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px capitalize',
                    activeTab === tab ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-white/80')}>
                  {tab === 'params' ? 'Parameters' : 'Result'}
                  {tab === 'result' && result && (
                    <span className={cn('ml-2 w-2 h-2 rounded-full inline-block',
                      result.error ? 'bg-rose-400' : 'bg-emerald-400')} />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'params' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/80">Edit JSON parameters below, then click Invoke Tool</p>
                    {QUICK_PARAMS[selected.name] && (
                      <button onClick={() => setParams(JSON.stringify(QUICK_PARAMS[selected.name], null, 2))}
                        className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
                        Load demo params
                      </button>
                    )}
                  </div>
                  <textarea
                    value={params}
                    onChange={e => setParams(e.target.value)}
                    rows={18}
                    className="w-full bg-white/4 border border-white/10 rounded-xl p-4 text-sm text-white/70 font-mono focus:outline-none focus:border-cyan-500/30 resize-none leading-relaxed"
                    spellCheck={false}
                  />
                  <p className="text-xs text-white/60">Valid JSON required. Parameters must match the tool's input schema.</p>
                </div>
              )}

              {activeTab === 'result' && (
                <AnimatePresence mode="wait">
                  {invoking ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                      <p className="text-white/80 text-sm">Invoking {selected.name}...</p>
                      <p className="text-white/50 text-xs">Calling Gemini 2.5 via MCP tool registry</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      {result.error ? (
                        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 mb-4">
                          <p className="text-sm text-rose-300">{result.error}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 rounded-lg status-approved text-xs">Success</span>
                          {result.latency_ms && (
                            <span className="text-xs text-white/70 font-mono">{result.latency_ms}ms</span>
                          )}
                          <span className="text-xs text-white/70 font-mono">{result.timestamp?.slice(11, 19)}</span>
                        </div>
                      )}
                      <pre className="bg-white/4 border border-white/8 rounded-xl p-5 text-xs text-white/60 font-mono overflow-auto max-h-[500px] leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(result.data ?? result, null, 2)}
                      </pre>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" className="flex items-center justify-center h-48 text-white/60 text-sm">
                      Invoke the tool to see results here
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/60 space-y-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <p className="text-sm">Select a tool to inspect and invoke</p>
            <p className="text-xs text-white/15">All 12 MCP tools are live and connected to Gemini 2.5</p>
          </div>
        )}
      </div>
    </div>
  )
}
