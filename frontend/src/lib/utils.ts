import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function calculateAge(dob: string | Date): number {
  const today = new Date()
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function getRiskColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'critical': return 'text-rose-400 border-rose-400/30 bg-rose-400/10'
    case 'high': return 'text-orange-400 border-orange-400/30 bg-orange-400/10'
    case 'medium': return 'text-amber-400 border-amber-400/30 bg-amber-400/10'
    case 'low': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
    default: return 'text-slate-200 border-slate-400/30 bg-slate-400/10'
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'appeal_approved': return 'status-approved'
    case 'denied': return 'status-denied'
    case 'pending':
    case 'submitted': return 'status-pending'
    case 'running': return 'status-running'
    case 'critical': return 'status-critical'
    default: return 'status-pending'
  }
}

export function getApprovalColor(prob: number): string {
  if (prob >= 0.75) return '#00ff87'
  if (prob >= 0.5) return '#fbbf24'
  return '#f43f5e'
}

export function truncate(str: string, length: number): string {
  if (!str) return ''
  return str.length > length ? str.slice(0, length) + '...' : str
}
