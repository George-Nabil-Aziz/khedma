import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { LogOutIcon, MenuIcon, MoonIcon, SunIcon, UsersIcon } from './Icons'

export function Layout({ email, children }: { email: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

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
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">27</div>
          <span className="text-lg font-bold">{t('appName')}</span>
        </div>
        <nav className="flex-1 p-3">
          <a className="flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            <UsersIcon />
            {t('children')}
          </a>
        </nav>
        <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="truncate px-3 pb-2" dir="ltr">{email}</div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOutIcon />
            {t('signOut')}
          </button>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setOpen(true)} />
        <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const btn = 'grid size-9 place-items-center rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
      <button className={`${btn} lg:hidden`} onClick={onMenu} aria-label={t('menu')}>
        <MenuIcon />
      </button>
      <h1 className="flex-1 text-lg font-bold">{t('children')}</h1>
      <button
        className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      >
        {lang === 'ar' ? 'English' : 'عربي'}
      </button>
      <button className={btn} onClick={toggle} aria-label={t('toggleTheme')}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}
