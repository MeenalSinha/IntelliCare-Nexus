import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/auth'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
}

export const patientsApi = {
  list: (params?: { skip?: number; limit?: number; search?: string; risk_level?: string }) =>
    api.get('/patients/', { params }),
  get: (id: string) => api.get(`/patients/${id}`),
  create: (data: any) => api.post('/patients/', data),
  fhir: (id: string) => api.get(`/patients/${id}/fhir`),
  summary: (id: string) => api.get(`/patients/${id}/summary`),
}

export const priorAuthApi = {
  list: (params?: { patient_id?: string; status?: string }) =>
    api.get('/prior-auth/', { params }),
  get: (id: string) => api.get(`/prior-auth/${id}`),
  create: (data: any) => api.post('/prior-auth/', data),
  submit: (id: string) => api.post(`/prior-auth/${id}/submit`),
  appeal: (id: string) => api.post(`/prior-auth/${id}/appeal`),
  updateStatus: (id: string, status: string, denial_reason?: string) =>
    api.patch(`/prior-auth/${id}/status`, null, { params: { new_status: status, denial_reason } }),
}

export const trialsApi = {
  match: (data: { patient_id: string; max_results?: number; conditions?: string[] }) =>
    api.post('/trials/match', data),
  patientMatches: (patient_id: string) => api.get(`/trials/patient/${patient_id}`),
}

export const agentsApi = {
  run: (data: { patient_id: string; workflow_type?: string; context?: any }) =>
    api.post('/agents/run', data),
  session: (session_id: string) => api.get(`/agents/session/${session_id}`),
  sessionState: (session_id: string) => api.get(`/agents/session/${session_id}/state`),
}

export const toolsApi = {
  list: () => api.get('/tools/'),
  invoke: (tool_name: string, parameters: Record<string, any>) =>
    api.post('/tools/invoke', { tool_name, parameters }),
  detail: (tool_name: string) => api.get(`/tools/${tool_name}`),
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  approvalTrends: () => api.get('/analytics/approval-trends'),
  agentSessions: (limit: number = 20) => api.get('/analytics/agent-sessions', { params: { limit } }),
  hipaaStatus: () => api.get('/analytics/hipaa-status'),
  auditLogs: (params?: { patient_id?: string; skip?: number; limit?: number }) =>
    api.get('/analytics/audit-logs', { params }),
}

export const createAgentWebSocket = (sessionId: string): WebSocket => {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''
  return new WebSocket(`${WS_URL}/ws/agents/${sessionId}?token=${token}`)
}
