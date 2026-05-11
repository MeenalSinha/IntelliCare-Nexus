'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const DemoMode = dynamic(() => import('@/components/demo/DemoMode'), { ssr: false })

const navItems = [
  {
    label: 'Dashboard', href: '/dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  },
  {
    label: 'Patients', href: '/patients',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    label: 'Prior Auth', href: '/prior-auth',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  },
  {
    label: 'Clinical Trials', href: '/trials',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>
  },
  {
    label: 'Agent Network', href: '/agents',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="M6 6l4 4M14 14l4 4M18 6l-4 4M6 18l4-4"/></svg>
  },
  {
    label: 'Explainability', href: '/explainability',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  },
  {
    label: 'MCP Tools', href: '/tools',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  },
  {
    label: 'Analytics', href: '/analytics',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
  },
  {
    label: 'Audit & Compliance', href: '/audit',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDemoOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen w-64 z-50 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #080d1a 0%, #050810 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 0 15px rgba(0,245,255,0.15)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#00f5ff" strokeWidth="1.5" strokeDasharray="3 2"/>
                <circle cx="12" cy="12" r="3" fill="#00f5ff" fillOpacity="0.9"/>
                <path d="M12 6v2M12 16v2M6 12h2M16 12h2" stroke="#00f5ff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm text-white leading-none">IntelliCare</h1>
              <p className="text-xs text-cyan-400/60 font-mono mt-0.5">NEXUS v1.0</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={cn(
                    'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                    isActive
                      ? 'text-cyan-300 bg-cyan-500/10 active'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  )}
                >
                  <span className={cn('flex-shrink-0', isActive ? 'text-cyan-400' : 'text-white/30')}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
                      style={{ boxShadow: '0 0 6px rgba(0,245,255,0.8)' }}
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}



          {/* System status */}
          <div className="mx-0 px-3 py-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">10 Agents Online</span>
            </div>
            <p className="text-xs text-white/30">Gemini 2.5 Flash — Active</p>
          </div>
        </nav>

        {/* Demo Mode button */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setDemoOpen(true)}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)',
              boxShadow: '0 0 20px rgba(168,85,247,0.25)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Hackathon Demo Mode
          </button>
          <p className="text-center text-xs text-white/15 mt-1">Ctrl+Shift+D</p>
        </div>

        {/* User */}
        <div className="p-4 border-t border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
              {user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'DR'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">{user?.full_name || 'Physician'}</p>
              <p className="text-xs text-white/30 capitalize">{user?.role || 'physician'}</p>
            </div>
            <button
              onClick={logout}
              className="text-white/20 hover:text-rose-400 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {demoOpen && <DemoMode onClose={() => setDemoOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
