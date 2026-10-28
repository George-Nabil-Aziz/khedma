type P = { className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const

export const UsersIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
)
export const SunIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
)
export const MoonIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
)
export const MenuIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
)
export const LogOutIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={`${className} rtl:-scale-x-100`}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
)
export const RefreshIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" /></svg>
)
export const LanguagesIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></svg>
)
export const PlusIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
export const SyncIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7l3-2.7M21 21v-5h-5" /></svg>
)
export const AlertIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" /></svg>
)
export const CloudOffIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="m2 2 20 20M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 9.94 5.26" /></svg>
)
export const ArrowBackIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={`${className} rtl:-scale-x-100`}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
)
export const StarIcon = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5Z" /></svg>
)
export const StarOutlineIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5Z" /></svg>
)
export const WhatsAppIcon = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.56.79 1.92.86 2.06.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" /></svg>
)
export const ColumnsIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>
)
export const SlidersIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
)
export const ChevronUpIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="m18 15-6-6-6 6" /></svg>
)
export const ChevronDownIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const SortIcon = ({ className = 'size-3.5' }: P) => (
  <svg {...base} className={className}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
)
export const TrashIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
)
export const LockIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
export const XIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const CalendarCheckIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></svg>
)
export const HistoryIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2" /></svg>
)
export const ShieldIcon = ({ className = 'size-3.5' }: P) => (
  <svg {...base} className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
)
