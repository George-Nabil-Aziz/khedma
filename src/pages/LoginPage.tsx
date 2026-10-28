import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from '../components/Icons'

export function LoginPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800'

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex justify-end gap-2 p-4">
        <button
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        >
          {lang === 'ar' ? 'English' : 'عربي'}
        </button>
        <button
          className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
          onClick={toggle}
          aria-label={t('toggleTheme')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className="grid flex-1 place-items-center px-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">27</div>
            <h1 className="text-xl font-bold">{t('appName')}</h1>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('email')}</span>
            <input type="email" dir="ltr" required autoComplete="email" className={input} value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('password')}</span>
            <input
              type="password"
              dir="ltr"
              required
              autoComplete="current-password"
              className={input}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? t('signingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
