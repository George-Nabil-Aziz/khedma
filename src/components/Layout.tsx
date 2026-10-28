import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { go, useRoute, type Path } from '../lib/router'
import { resetStore, useStore } from '../lib/store'
import {
  CalendarCheckIcon,
  HistoryIcon,
  LanguagesIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  ShieldIcon,
  SlidersIcon,
  SunIcon,
  SyncIcon,
  UsersIcon,
} from './Icons'

export function Layout({ email, admin, title, children }: { email: string; admin: boolean; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const route = useRoute()
  const { outbox, conflicts, attOutbox, attError } = useStore()
  const issues = conflicts.length + outbox.filter(o => o.error).length + (attError ? 1 : 0)
  const pending = outbox.length + attOutbox.length

  function nav(path: Path) {
    go(path)
    setOpen(false)
  }

  async function signOut() {
    if (pending && !window.confirm(t('signOutPending'))) return
    await supabase.rpc('log_event', { p_action: 'logout' }).then(
      () => {},
      () => {},
    )
    await resetStore()
    await supabase.auth.signOut()
  }

  const item = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start ${
      active
        ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static ${
          open ? '' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-9" />
          <span className="text-lg font-bold">{t('appName')}</span>
        </div>

        <div className="p-3">
          <button
            onClick={() => nav('/new')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusIcon />
            {t('addChild')}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <button className={item(route.name === 'list' || route.name === 'edit')} onClick={() => nav('/')}>
            <UsersIcon />
            {t('children')}
          </button>
          <button className={item(route.name === 'attendance')} onClick={() => nav('/attendance')}>
            <CalendarCheckIcon />
            {t('attendance')}
          </button>
          <button className={item(route.name === 'fields')} onClick={() => nav('/fields')}>
            <SlidersIcon />
            {t('customize')}
          </button>
          <button className={item(route.name === 'sync')} onClick={() => nav('/sync')}>
            <SyncIcon />
            <span className="flex-1">{t('sync')}</span>
            {issues > 0 ? (
              <span className="rounded-full bg-red-500 px-2 text-xs font-bold text-white">{issues}</span>
            ) : pending > 0 ? (
              <span className="rounded-full bg-amber-500 px-2 text-xs font-bold text-white">{pending}</span>
            ) : null}
          </button>
          {admin && (
            <button className={item(route.name === 'audit')} onClick={() => nav('/audit')}>
              <HistoryIcon />
              {t('audit')}
            </button>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="truncate" dir="ltr">
              {email}
            </span>
            {admin && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                <ShieldIcon className="size-3" />
                {t('admin')}
              </span>
            )}
          </div>
          <button onClick={signOut} className={item(false) + ' text-sm'}>
            <LogOutIcon />
            {t('signOut')}
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} onMenu={() => setOpen(true)} onSignOut={signOut} />
        <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

export function HeaderButtons() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const btn =
    'relative grid size-9 place-items-center rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'

  return (
    <>
      <button className={btn} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title={t('switchLang')} aria-label={t('switchLang')}>
        <LanguagesIcon />
        <span className="absolute -bottom-1 -end-1 rounded bg-indigo-600 px-1 text-[9px] font-bold leading-tight text-white">
          {lang === 'ar' ? 'EN' : 'ع'}
        </span>
      </button>
      <button className={btn} onClick={toggle} title={t('toggleTheme')} aria-label={t('toggleTheme')}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </>
  )
}

function Header({ title, onMenu, onSignOut }: { title: string; onMenu: () => void; onSignOut: () => void }) {
  const { t } = useI18n()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
      <button
        className="grid size-9 place-items-center rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:hidden"
        onClick={onMenu}
        aria-label={t('menu')}
      >
        <MenuIcon />
      </button>
      <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
      <ConnectionStatus />
      <HeaderButtons />
      <button
        onClick={onSignOut}
        title={t('signOut')}
        aria-label={t('signOut')}
        className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      >
        <LogOutIcon />
      </button>
    </header>
  )
}

/** Pulsing dot: green when online, red when offline, blue while syncing. */
function ConnectionStatus() {
  const { t } = useI18n()
  const { online, syncing } = useStore()
  const color = !online ? 'bg-red-500' : syncing ? 'bg-sky-500' : 'bg-emerald-500'
  const label = !online ? t('offline') : syncing ? t('syncing') : t('online')

  return (
    <button
      onClick={() => go('/sync')}
      title={label}
      className="flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
    >
      <span className="relative flex size-2.5">
        <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${color}`} />
        <span className={`relative inline-flex size-2.5 rounded-full ${color}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
