import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { PasswordInput } from '../components/PasswordInput'
import { HeaderButtons } from '../components/Layout'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800'
const primary = 'w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60'

export function LoginPage() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex justify-end gap-2 p-4">
        <HeaderButtons />
      </div>

      <div className="grid flex-1 place-items-center px-4 pb-8">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto mb-3 size-16 drop-shadow" />
            <h1 className="text-xl font-bold">{t('appName')}</h1>
            {mode === 'signUp' && <p className="mt-1 text-sm text-slate-500">{t('createAccount')}</p>}
          </div>

          {mode === 'signIn' ? <SignIn /> : <SignUp />}

          {/* switch between the two */}
          <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500 dark:border-slate-800">
            {mode === 'signIn' ? t('noAccount') : t('haveAccount')}{' '}
            <button
              type="button"
              onClick={() => setMode(m => (m === 'signIn' ? 'signUp' : 'signIn'))}
              className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
            >
              {mode === 'signIn' ? t('createAccount') : t('signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function SignIn() {
  const { t } = useI18n()
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
    else
      supabase.rpc('log_event', { p_action: 'login' }).then(
        () => {},
        () => {},
      )
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Labeled label={t('email')}>
        <input type="email" dir="ltr" required autoComplete="email" placeholder="name@example.com" className={input} value={email} onChange={e => setEmail(e.target.value)} />
      </Labeled>
      <Labeled label={t('password')}>
        <PasswordInput
          required
          placeholder={t('phPassword')}
          autoComplete="current-password"
          className={input}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </Labeled>
      <Message error={error} />
      <button disabled={busy} className={primary}>
        {busy ? t('signingIn') : t('signIn')}
      </button>
    </form>
  )
}

/**
 * Anyone can make an account, but a new account sees no children: it has no class until it
 * creates one or a colleague gives it a share code (enforced by the database, see 006).
 */
function SignUp() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError(t('passwordTooShort'))
    if (password !== repeat) return setError(t('passwordMismatch'))

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // app: puts the account on Khedma's own list (accounts are shared with other apps in the project)
      options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL, data: { app: 'khedma_2027' } },
    })
    if (error) {
      setError(error.message)
    } else if (data.session) {
      // Signed in straight away (email confirmation is off): save the name on the profile.
      if (name.trim()) await supabase.from('profiles').upsert({ user_id: data.session.user.id, display_name: name.trim() })
    } else {
      // Email confirmation is on: the account works after clicking the link in the email.
      setCheckEmail(true)
    }
    setBusy(false)
  }

  if (checkEmail) return <Message ok={t('checkYourEmail').replace('{email}', email.trim())} />

  return (
    <form onSubmit={submit} className="space-y-4">
      <Labeled label={t('displayName')}>
        <input required autoComplete="name" placeholder={t('phDisplayName')} className={input} value={name} onChange={e => setName(e.target.value)} />
      </Labeled>
      <Labeled label={t('email')}>
        <input type="email" dir="ltr" required autoComplete="email" placeholder="name@example.com" className={input} value={email} onChange={e => setEmail(e.target.value)} />
      </Labeled>
      <Labeled label={t('password')}>
        <PasswordInput
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t('passwordTooShort')}
          className={input}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </Labeled>
      <Labeled label={t('confirmPassword')}>
        <PasswordInput
          required
          autoComplete="new-password"
          placeholder={t('phConfirmPassword')}
          className={input}
          value={repeat}
          onChange={e => setRepeat(e.target.value)}
        />
      </Labeled>
      <Message error={error} />
      <button disabled={busy} className={primary}>
        {busy ? t('loading') : t('createAccount')}
      </button>
    </form>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}

function Message({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">{error}</p>
  if (ok) return <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">{ok}</p>
  return null
}
