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
    label: 'Dashboard', href: '/dashboard', group: 'main',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    label: 'Patients', href: '/patients', group: 'main',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: 'Prior Auth', href: '/prior-auth', group: 'clinical',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    label: 'Clinical Trials', href: '/trials', group: 'clinical',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>,
  },
  {
    label: 'Agent Network', href: '/agents', group: 'ai',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="M6 6l4 4M14 14l4 4M18 6l-4 4M6 18l4-4"/></svg>,
  },
  {
    label: 'Explainability', href: '/explainability', group: 'ai',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  },
  {
    label: 'MCP Tools', href: '/tools', group: 'ai',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  },
  {
    label: 'Analytics', href: '/analytics', group: 'insights',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    label: 'Audit & Compliance', href: '/audit', group: 'insights',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
]

const GROUP_LABELS: Record<string, string> = {
  main: 'Overview',
  clinical: 'Clinical',
  ai: 'AI Agents',
  insights: 'Insights',
}

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

  const groups = ['main', 'clinical', 'ai', 'insights']
  const initials = user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'DR'

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen w-64 z-50 flex flex-col glass-panel"
        style={{
          background: 'linear-gradient(180deg, rgba(5,12,26,0.9) 0%, rgba(3,6,16,0.95) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Logo ───────────────────────────────────────────────── */}
        <div className="px-5 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3.5">
            {/* Stitch: primary cyan glow logo mark */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative border-glow-cyan"
              style={{ background: 'rgba(0,229,255,0.05)' }}
            >
              {/* Animated dot pulse */}
              <span className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 animate-agent-pulse" />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" className="animate-spin-slow"/>
                <circle cx="12" cy="12" r="4" fill="#00e5ff" fillOpacity="1" className="animate-pulse-glow"/>
              </svg>
            </div>
            <div>
              {/* Stitch: Geist display font for brand name */}
              <h1 className="font-display font-bold text-[15px] text-white leading-none tracking-tight">
                IntelliCare
              </h1>
              <p className="text-[11px] font-mono mt-1 tracking-widest text-cyan-400/70 font-semibold uppercase">
                NEXUS v2.0
              </p>
            </div>
          </div>
        </div>

        {/* ── Navigation ─────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {groups.map(group => {
            const items = navItems.filter(i => i.group === group)
            return (
              <div key={group}>
                {/* Stitch: label-caps style */}
                <p className="px-3 mb-1.5 text-[10px] font-display font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {GROUP_LABELS[group]}
                </p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link key={item.href} href={item.href}>
                        <motion.div
                          whileHover={{ x: 3, backgroundColor: 'rgba(255,255,255,0.03)' }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            'nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium',
                            isActive
                              ? 'active'
                              : 'text-slate-200 hover:text-slate-200'
                          )}
                        >
                          <span className={cn('flex-shrink-0 transition-colors', isActive ? 'text-cyan-400' : 'opacity-60')}>
                            {item.icon}
                          </span>
                          <span className="font-body tracking-wide">{item.label}</span>
                        </motion.div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* ── System status (Stitch "Status Indicator") ─────── */}
          <div className="mx-1 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-[inset_0_0_12px_rgba(0,255,135,0.05)]">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(0,255,135,0.8)]" />
              <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">10 Agents Online</span>
            </div>
            <p className="text-[11px] text-emerald-400/50 font-mono">Gemini 3.1 Pro — Active</p>
          </div>
        </nav>

        {/* ── Demo Mode CTA (Stitch "btn-ai" violet gradient) ───── */}
        <div className="px-4 pb-4 flex-shrink-0">
          <button
            onClick={() => setDemoOpen(true)}
            className="w-full py-3 btn-ai text-[12px] font-display uppercase tracking-widest text-white flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Hackathon Demo
          </button>
          <p className="text-center text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>Ctrl+Shift+D</p>
        </div>

        {/* ── User footer ────────────────────────────────────────── */}
        <div className="px-4 py-4 border-t border-white/[0.04] bg-white/[0.01] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Stitch: violet secondary-container avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-display font-bold flex-shrink-0 border-glow-violet"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#ddb7ff' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: 'rgba(219,226,247,0.85)' }}>
                {user?.full_name || 'Dr. Sophia Chen'}
              </p>
              <p className="text-[11px] capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {user?.role || 'Physician'}
              </p>
            </div>
            <button
              onClick={logout}
              className="transition-colors flex-shrink-0 hover:text-rose-400"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              title="Sign out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
