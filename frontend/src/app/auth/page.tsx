'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const router = useRouter()
  const { login, isLoading, isAuthenticated, loadFromStorage } = useAuthStore()
  const [email, setEmail] = useState('demo@intellicare.ai')
  const [password, setPassword] = useState('Demo@2024')

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard')
  }, [isAuthenticated, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome to IntelliCare Nexus')
      router.push('/dashboard')
    } catch {
      toast.error('Invalid credentials. Try demo@intellicare.ai / Demo@2024')
    }
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 mb-6"
            style={{ boxShadow: '0 0 30px rgba(0,245,255,0.15)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" stroke="#00f5ff" strokeWidth="1.5" strokeDasharray="4 2"/>
              <path d="M16 8v4M16 20v4M8 16h4M20 16h4" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="3" fill="#00f5ff" fillOpacity="0.8"/>
            </svg>
          </motion.div>
          <h1 className="font-display text-2xl font-bold text-white mb-1">IntelliCare Nexus</h1>
          <p className="text-sm text-white/40">Autonomous Clinical Decision Platform</p>
        </div>

        {/* Form */}
        <div className="glass-panel rounded-2xl p-8 border border-white/8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
                placeholder="physician@hospital.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-void transition-all relative overflow-hidden"
              style={{
                background: isLoading
                  ? 'rgba(0,245,255,0.3)'
                  : 'linear-gradient(135deg, #00f5ff, #06d6f5)',
                boxShadow: isLoading ? 'none' : '0 0 20px rgba(0,245,255,0.3)',
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
                  </svg>
                  Authenticating...
                </span>
              ) : 'Access Platform'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-6 p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
            <p className="text-xs text-amber-400/80 font-medium mb-2">Demo Credentials</p>
            <p className="text-xs text-white/50 font-mono">demo@intellicare.ai</p>
            <p className="text-xs text-white/50 font-mono">Demo@2024</p>
          </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          HIPAA-compliant. All demo data is synthetic.
        </p>
      </motion.div>
    </div>
  )
}
