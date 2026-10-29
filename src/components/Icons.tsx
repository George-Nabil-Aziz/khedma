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
/** 文 plus `letter` in the corner — the language a tap switches to (E or ع). */
export const LanguagesIcon = ({ className = 'size-5', letter }: P & { letter: string }) => (
  <svg {...base} className={className}>
    <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1" />
    {/* ع is a small glyph that hangs below the line, so it is drawn larger and a bit higher */}
    <text x="17.5" y={letter === 'ع' ? 19 : 22} textAnchor="middle" fontSize={letter === 'ع' ? 18 : 13} fontWeight="800" fill="currentColor" stroke="none" fontFamily="inherit">
      {letter}
    </text>
  </svg>
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
export const ShareIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
)
export const SettingsIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const UserCogIcon =({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4" /><circle cx="18" cy="17" r="2.5" /><path d="M18 13v1.5M18 19.5V21M14.5 17H16M20 17h1.5M15.5 14.5l1 1M19.5 18.5l1 1M15.5 19.5l1-1M19.5 15.5l1-1" /></svg>
)
export const CopyIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
)
export const DoorIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={`${className} rtl:-scale-x-100`}><path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.56v16.88a.5.5 0 0 1-.68.47L5 19V5.92a1 1 0 0 1 .66-.94l6.68-2.42a.5.5 0 0 1 .66.47Z" /></svg>
)
export const PencilIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
)
export const SchoolIcon = ({ className = 'size-5' }: P) => (
  <svg {...base} className={className}><path d="M14 22v-4a2 2 0 1 0-4 0v4M18 10l4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2M18 5v17M4 6l8-4 8 4M6 5v17" /><circle cx="12" cy="9" r="2" /></svg>
)
export const CameraIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>
)
export const GripIcon = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><circle cx="9" cy="5" r="1.6" /><circle cx="15" cy="5" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="19" r="1.6" /><circle cx="15" cy="19" r="1.6" /></svg>
)
export const EyeIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const EyeOffIcon = ({ className = 'size-4' }: P) => (
  <svg {...base} className={className}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20" /></svg>
)
