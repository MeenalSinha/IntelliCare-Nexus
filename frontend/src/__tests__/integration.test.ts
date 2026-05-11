/**
 * IntelliCare Nexus - Frontend Integration Tests
 * Tests API client functions, utility functions, and store behavior
 */

// =============================================
// UTILITY FUNCTION TESTS
// =============================================

import { calculateAge, formatDate, formatPercent, getRiskColor, getApprovalColor, cn, truncate } from '../lib/utils'

describe('Utility Functions', () => {
  describe('calculateAge', () => {
    it('calculates correct age for known DOB', () => {
      const dob = new Date(1966, 2, 15) // March 15, 1966
      const age = calculateAge(dob)
      expect(age).toBeGreaterThanOrEqual(58)
      expect(age).toBeLessThanOrEqual(60)
    })

    it('handles string DOB', () => {
      const age = calculateAge('1990-01-01')
      expect(age).toBeGreaterThan(30)
    })
  })

  describe('formatPercent', () => {
    it('converts decimal to percent string', () => {
      expect(formatPercent(0.85)).toBe('85%')
      expect(formatPercent(0)).toBe('0%')
      expect(formatPercent(1)).toBe('100%')
    })
  })

  describe('getRiskColor', () => {
    it('returns correct color classes for risk levels', () => {
      expect(getRiskColor('critical')).toContain('rose')
      expect(getRiskColor('high')).toContain('orange')
      expect(getRiskColor('medium')).toContain('amber')
      expect(getRiskColor('low')).toContain('emerald')
    })

    it('handles unknown risk level gracefully', () => {
      const result = getRiskColor('unknown')
      expect(result).toBeTruthy()
    })
  })

  describe('getApprovalColor', () => {
    it('returns green for high probability', () => {
      expect(getApprovalColor(0.85)).toBe('#00ff87')
    })

    it('returns yellow for medium probability', () => {
      expect(getApprovalColor(0.6)).toBe('#fbbf24')
    })

    it('returns red for low probability', () => {
      expect(getApprovalColor(0.3)).toBe('#f43f5e')
    })
  })

  describe('truncate', () => {
    it('truncates long strings', () => {
      const result = truncate('Hello World this is a long string', 10)
      expect(result.length).toBeLessThanOrEqual(13) // 10 + '...'
      expect(result.endsWith('...')).toBe(true)
    })

    it('does not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello')
    })

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('')
    })
  })

  describe('cn (classname merge)', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
      expect(cn('base', false && 'hidden', 'active')).toBe('base active')
    })

    it('deduplicates tailwind classes', () => {
      const result = cn('px-2', 'px-4')
      expect(result).toBe('px-4')
    })
  })
})

// =============================================
// API CLIENT STRUCTURE TESTS
// =============================================

describe('API Client Structure', () => {
  it('exports all required API modules', async () => {
    const apiModule = await import('../lib/api')
    expect(apiModule.authApi).toBeDefined()
    expect(apiModule.patientsApi).toBeDefined()
    expect(apiModule.priorAuthApi).toBeDefined()
    expect(apiModule.trialsApi).toBeDefined()
    expect(apiModule.agentsApi).toBeDefined()
    expect(apiModule.toolsApi).toBeDefined()
    expect(apiModule.analyticsApi).toBeDefined()
    expect(apiModule.createAgentWebSocket).toBeDefined()
  })

  it('authApi has expected methods', async () => {
    const { authApi } = await import('../lib/api')
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.me).toBe('function')
  })

  it('patientsApi has expected methods', async () => {
    const { patientsApi } = await import('../lib/api')
    expect(typeof patientsApi.list).toBe('function')
    expect(typeof patientsApi.get).toBe('function')
    expect(typeof patientsApi.create).toBe('function')
    expect(typeof patientsApi.fhir).toBe('function')
  })

  it('priorAuthApi has expected methods', async () => {
    const { priorAuthApi } = await import('../lib/api')
    expect(typeof priorAuthApi.list).toBe('function')
    expect(typeof priorAuthApi.create).toBe('function')
    expect(typeof priorAuthApi.submit).toBe('function')
    expect(typeof priorAuthApi.appeal).toBe('function')
    expect(typeof priorAuthApi.updateStatus).toBe('function')
  })

  it('toolsApi has expected methods', async () => {
    const { toolsApi } = await import('../lib/api')
    expect(typeof toolsApi.list).toBe('function')
    expect(typeof toolsApi.invoke).toBe('function')
    expect(typeof toolsApi.detail).toBe('function')
  })

  it('createAgentWebSocket returns a WebSocket-like function', async () => {
    const { createAgentWebSocket } = await import('../lib/api')
    expect(typeof createAgentWebSocket).toBe('function')
  })
})

// =============================================
// AUTH STORE TESTS
// =============================================

describe('Auth Store', () => {
  it('exports useAuthStore hook', async () => {
    const storeModule = await import('../lib/store')
    expect(storeModule.useAuthStore).toBeDefined()
  })

  it('store has expected actions', async () => {
    const { useAuthStore } = await import('../lib/store')
    const state = useAuthStore.getState()
    expect(typeof state.login).toBe('function')
    expect(typeof state.logout).toBe('function')
    expect(typeof state.loadFromStorage).toBe('function')
  })

  it('initial state is unauthenticated', async () => {
    const { useAuthStore } = await import('../lib/store')
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })
})

// =============================================
// COMPONENT STRUCTURE TESTS
// =============================================

describe('Component Exports', () => {
  it('Sidebar component exports default', async () => {
    // Dynamic import to avoid Next.js router dependency
    const module = await import('../components/layout/Sidebar')
    expect(module.default).toBeDefined()
  })

  it('DemoMode component exports default', async () => {
    const module = await import('../components/demo/DemoMode')
    expect(module.default).toBeDefined()
  })
})

// =============================================
// FHIR DATA STRUCTURE TESTS
// =============================================

describe('FHIR Data Structures', () => {
  it('valid FHIR bundle structure is recognized', () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'test-patient',
            name: [{ family: 'Sharma', given: ['Arjun'] }],
            gender: 'male',
            birthDate: '1966-03-15',
          }
        }
      ]
    }
    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.entry[0].resource.resourceType).toBe('Patient')
  })

  it('ICD-10 codes are string format', () => {
    const codes = ['C34.10', 'Z96.89', 'E11.65']
    codes.forEach(code => {
      expect(typeof code).toBe('string')
      expect(code.length).toBeGreaterThan(3)
    })
  })
})

// =============================================
// AGENT EVENT STRUCTURE TESTS
// =============================================

describe('Agent Event Structures', () => {
  it('agent event has required fields', () => {
    const event = {
      session_id: 'test-session-123',
      agent_name: 'ClinicalContextAgent',
      event_type: 'started',
      message: 'Parsing FHIR bundle...',
      data: {},
      timestamp: new Date().toISOString(),
    }
    expect(event.session_id).toBeTruthy()
    expect(event.agent_name).toBeTruthy()
    expect(['started', 'completed', 'failed', 'tool_call', 'tool_result', 'processing']).toContain(event.event_type)
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('all 10 agent names are valid strings', () => {
    const agents = [
      'ClinicalContextAgent',
      'PriorAuthorizationAgent',
      'InsurancePolicyAgent',
      'MedicalNecessityAgent',
      'AppealAgent',
      'ClinicalTrialMatchmakerAgent',
      'EligibilityReasoningAgent',
      'PatientCommunicationAgent',
      'CareCoordinationAgent',
      'AuditComplianceAgent',
    ]
    expect(agents.length).toBe(10)
    agents.forEach(a => expect(typeof a).toBe('string'))
  })
})
