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
