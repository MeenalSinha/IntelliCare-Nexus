'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType, NodeTypes,
  Handle, Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { agentsApi, patientsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Custom Agent Node ──────────────────────────────────────

const AgentNode = ({ data }: { data: any }) => {
  const colors: Record<string, string> = {
    idle: 'rgba(255,255,255,0.15)',
    running: '#00f5ff',
    completed: '#00ff87',
    failed: '#f43f5e',
    waiting: '#fbbf24',
  }
  const color = colors[data.status] || colors.idle
  const isRunning = data.status === 'running'
  const isDone = data.status === 'completed'

  return (
    <div className="relative px-4 py-3 rounded-xl min-w-44 select-none"
      style={{
        background: 'rgba(13,20,38,0.97)',
        border: `1px solid ${color}40`,
        boxShadow: isRunning ? `0 0 20px ${color}50, 0 0 40px ${color}20` :
                   isDone ? `0 0 12px ${color}30` : '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
      }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {isRunning && (
        <div className="absolute inset-0 rounded-xl"
          style={{ border: `1px solid ${color}60`, animation: 'agentPulse 1.5s ease-in-out infinite' }} />
      )}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
          style={{
            backgroundColor: color,
            boxShadow: isRunning ? `0 0 8px ${color}` : isDone ? `0 0 4px ${color}` : 'none',
          }} />
        <span className="text-xs font-semibold text-white/90 truncate">{data.label}</span>
        {isDone && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
      </div>
      <p className="text-xs text-white/40 truncate max-w-36 leading-snug">{data.message || data.status}</p>
      {data.toolCalls != null && data.toolCalls > 0 && (
        <p className="text-xs text-cyan-400/40 font-mono mt-1">{data.toolCalls} tool calls</p>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
}

const nodeTypes: NodeTypes = { agentNode: AgentNode }

const INITIAL_NODES: Node[] = [
  { id: 'orchestrator', type: 'agentNode', position: { x: 300, y: 10 }, data: { label: 'Orchestrator', status: 'idle', message: 'Coordinating all agents' } },
  { id: 'clinical', type: 'agentNode', position: { x: 40, y: 110 }, data: { label: 'Clinical Context', status: 'idle', message: 'FHIR parsing' } },
  { id: 'prior_auth', type: 'agentNode', position: { x: 300, y: 110 }, data: { label: 'Prior Auth', status: 'idle', message: 'Auth detection' } },
  { id: 'insurance', type: 'agentNode', position: { x: 560, y: 110 }, data: { label: 'Insurance Policy', status: 'idle', message: 'Policy retrieval' } },
  { id: 'necessity', type: 'agentNode', position: { x: 40, y: 240 }, data: { label: 'Medical Necessity', status: 'idle', message: 'Letter generation' } },
  { id: 'appeal', type: 'agentNode', position: { x: 300, y: 240 }, data: { label: 'Appeal Agent', status: 'idle', message: 'Appeal drafting' } },
  { id: 'trial_match', type: 'agentNode', position: { x: 560, y: 240 }, data: { label: 'Trial Matchmaker', status: 'idle', message: 'ClinicalTrials.gov' } },
  { id: 'eligibility', type: 'agentNode', position: { x: 40, y: 370 }, data: { label: 'Eligibility Reasoning', status: 'idle', message: 'Criteria analysis' } },
  { id: 'communication', type: 'agentNode', position: { x: 300, y: 370 }, data: { label: 'Patient Comm.', status: 'idle', message: 'Multilingual summary' } },
  { id: 'coordination', type: 'agentNode', position: { x: 560, y: 370 }, data: { label: 'Care Coordination', status: 'idle', message: 'Care planning' } },
  { id: 'audit', type: 'agentNode', position: { x: 300, y: 480 }, data: { label: 'Audit & Compliance', status: 'idle', message: 'HIPAA logging' } },
]

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id, source, target, animated: false,
  style: { stroke: 'rgba(0,245,255,0.18)', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#00f5ff' },
})

const INITIAL_EDGES: Edge[] = [
  makeEdge('e1', 'orchestrator', 'clinical'),
  makeEdge('e2', 'clinical', 'prior_auth'),
  makeEdge('e3', 'prior_auth', 'insurance'),
  makeEdge('e4', 'insurance', 'necessity'),
  makeEdge('e5', 'necessity', 'appeal'),
  makeEdge('e6', 'necessity', 'trial_match'),
  makeEdge('e7', 'trial_match', 'eligibility'),
  makeEdge('e8', 'eligibility', 'communication'),
  makeEdge('e9', 'communication', 'coordination'),
  makeEdge('e10', 'coordination', 'audit'),
]

const AGENT_TO_NODE: Record<string, string> = {
  ClinicalContextAgent: 'clinical',
  PriorAuthorizationAgent: 'prior_auth',
  InsurancePolicyAgent: 'insurance',
  MedicalNecessityAgent: 'necessity',
  AppealAgent: 'appeal',
  ClinicalTrialMatchmakerAgent: 'trial_match',
  EligibilityReasoningAgent: 'eligibility',
  PatientCommunicationAgent: 'communication',
  CareCoordinationAgent: 'coordination',
  AuditComplianceAgent: 'audit',
  Orchestrator: 'orchestrator',
}

// ─── Inner page uses useSearchParams (inside Suspense) ──────

function AgentsPageInner() {
  const searchParams = useSearchParams()
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [events, setEvents] = useState<any[]>([])
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('session'))
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState(searchParams.get('patient') || '')
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [toolCallCount, setToolCallCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const toolCallsRef = useRef(0)

  useEffect(() => {
    patientsApi.list({ limit: 20 }).then(r => setPatients(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (sessionId) connectWebSocket(sessionId)
    return () => wsRef.current?.close()
  }, [sessionId])

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const connectWebSocket = (sid: string) => {
    wsRef.current?.close()
    const token = localStorage.getItem('access_token') || ''
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const ws = new WebSocket(`${WS_URL}/ws/agents/${sid}?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.event_type === 'heartbeat' || data.event_type === 'connected') return
      setEvents(prev => [...prev.slice(-150), data])

      // Count tool calls
      if (data.event_type === 'tool_call') {
        toolCallsRef.current += 1
        setToolCallCount(toolCallsRef.current)
      }

      updateNodeFromEvent(data)

      if (data.event_type === 'completed' && data.agent_name === 'Orchestrator') {
        setWorkflowStatus('completed')
        toast.success('Workflow completed successfully')
      } else if (data.event_type === 'failed') {
        setWorkflowStatus('failed')
        toast.error('Workflow failed — check event log')
      }
    }
    ws.onerror = () => {
      setWorkflowStatus('failed')
      toast.error('WebSocket connection error')
    }
  }

  const updateNodeFromEvent = useCallback((event: any) => {
    const nodeId = AGENT_TO_NODE[event.agent_name]
    if (!nodeId) return

    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n
      const newStatus =
        event.event_type === 'started' ? 'running' :
        event.event_type === 'completed' ? 'completed' :
        event.event_type === 'failed' ? 'failed' :
        n.data.status
      const toolCalls = (n.data.toolCalls || 0) + (event.event_type === 'tool_call' ? 1 : 0)
      return { ...n, data: { ...n.data, status: newStatus, message: event.message?.slice(0, 55) || n.data.message, toolCalls } }
    }))

    if (event.event_type === 'started') {
      setEdges(prev => prev.map(e => {
        if (e.target === nodeId) return { ...e, animated: true, style: { stroke: '#00f5ff', strokeWidth: 2 } }
        return e
      }))
    }
    if (event.event_type === 'completed') {
      setEdges(prev => prev.map(e => {
        if (e.target === nodeId) return { ...e, animated: false, style: { stroke: '#00ff87', strokeWidth: 1.5 } }
        return e
      }))
    }
  }, [setNodes, setEdges])

  const startWorkflow = async () => {
    if (!selectedPatient) { toast.error('Select a patient first'); return }
    setWorkflowStatus('running')
    setEvents([])
    setToolCallCount(0)
    toolCallsRef.current = 0
    setNodes(INITIAL_NODES.map(n => ({ ...n, data: { ...n.data, status: 'idle', toolCalls: 0 } })))
    setEdges(INITIAL_EDGES)
    try {
      const res = await agentsApi.run({ patient_id: selectedPatient, workflow_type: 'full' })
      setSessionId(res.data.session_id)
      toast.success(`Workflow started — session ${res.data.session_id.slice(0, 8)}`)
    } catch {
      setWorkflowStatus('failed')
      toast.error('Failed to start workflow')
    }
  }

  const resetWorkflow = () => {
    wsRef.current?.close()
    wsRef.current = null
    setSessionId(null)
    setEvents([])
    setWorkflowStatus('idle')
    setToolCallCount(0)
    toolCallsRef.current = 0
    setNodes(INITIAL_NODES)
    setEdges(INITIAL_EDGES)
  }

  const completedCount = nodes.filter(n => n.data.status === 'completed').length
  const runningNode = nodes.find(n => n.data.status === 'running')

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Left panel */}
      <div className="w-80 flex flex-col border-r border-white/6 bg-abyss overflow-hidden flex-shrink-0">
        <div className="p-5 border-b border-white/6 space-y-4">
          <div>
            <h2 className="font-display font-bold text-white text-base">Agent Orchestration</h2>
            <p className="text-xs text-white/40 mt-0.5">LangGraph multi-agent live visualization</p>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Patient</label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
              disabled={workflowStatus === 'running'}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none focus:border-cyan-500/40">
              <option value="">Select patient...</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.mrn}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={startWorkflow} disabled={!selectedPatient || workflowStatus === 'running'}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-void disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #00f5ff, #06d6f5)', boxShadow: '0 0 15px rgba(0,245,255,0.2)' }}>
              {workflowStatus === 'running' ? 'Running...' : 'Start Workflow'}
            </button>
            <button onClick={resetWorkflow}
              className="px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 hover:bg-white/8 transition-all">
              Reset
            </button>
          </div>

          {workflowStatus !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/40">
                <span>{completedCount}/10 agents</span>
                <span className="capitalize font-medium" style={{
                  color: workflowStatus === 'completed' ? '#00ff87' : workflowStatus === 'failed' ? '#f43f5e' : '#00f5ff'
                }}>{workflowStatus}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #00f5ff, #a855f7)' }}
                  animate={{ width: `${(completedCount / 10) * 100}%` }}
                  transition={{ duration: 0.5 }} />
              </div>
              <div className="flex items-center justify-between text-xs text-white/30">
                <span>{toolCallCount} MCP tool calls</span>
                {sessionId && <span className="font-mono">{sessionId.slice(0, 8)}...</span>}
              </div>
            </div>
          )}
        </div>

        {/* Events */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <p className="text-xs text-white/25 px-2 py-1 uppercase tracking-wider">Live Event Stream</p>
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="px-3 py-2 rounded-xl"
                style={{
                  background: event.event_type === 'completed' ? 'rgba(0,255,135,0.05)' :
                               event.event_type === 'tool_call' ? 'rgba(0,245,255,0.04)' :
                               event.event_type === 'failed' ? 'rgba(244,63,94,0.05)' :
                               'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                    backgroundColor:
                      event.event_type === 'completed' ? '#00ff87' :
                      event.event_type === 'tool_call' ? '#00f5ff' :
                      event.event_type === 'failed' ? '#f43f5e' : 'rgba(255,255,255,0.3)'
                  }} />
                  <span className="text-xs text-white/50 font-medium truncate">
                    {event.agent_name?.replace('Agent', '') || 'System'}
                    {event.event_type === 'tool_call' && event.data?.tool && (
                      <span className="text-cyan-400/50 ml-1">→ {event.data.tool}</span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-snug">{event.message}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {events.length === 0 && (
            <p className="text-center text-white/20 text-xs py-8">Start a workflow to see live events</p>
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative bg-void overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />

        {/* Status bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <div className="glass-panel rounded-xl px-4 py-2 flex items-center gap-3 pointer-events-auto">
            {runningNode ? (
              <>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-white/50">Active:</span>
                <span className="text-xs text-cyan-300 font-medium">{runningNode.data.label}</span>
              </>
            ) : workflowStatus === 'completed' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #00ff87' }} />
                <span className="text-xs text-emerald-300 font-medium">
                  All agents completed — {toolCallCount} MCP calls executed
                </span>
              </>
            ) : (
              <span className="text-xs text-white/30">Select a patient and start the workflow</span>
            )}
          </div>
          {workflowStatus === 'completed' && (
            <a href="/explainability" className="glass-panel rounded-xl px-3 py-2 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors pointer-events-auto">
              View Explainability Timeline
            </a>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(0,245,255,0.025)" gap={32} />
          <Controls style={{ background: 'rgba(13,20,38,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
          <MiniMap
            style={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
            nodeColor={n => {
              const s = n.data?.status
              return s === 'running' ? '#00f5ff' : s === 'completed' ? '#00ff87' : s === 'failed' ? '#f43f5e' : 'rgba(255,255,255,0.12)'
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ─── Exported page wraps inner in Suspense (Next.js 15 requirement) ─

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-void text-white/30 text-sm">
        Loading agent network...
      </div>
    }>
      <AgentsPageInner />
    </Suspense>
  )
}
