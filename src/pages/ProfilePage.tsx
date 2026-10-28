import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { PasswordInput } from '../components/PasswordInput'
import { changePassword, saveProfile, useStore } from '../lib/store'
import { PhotoPicker } from '../components/Avatar'
import { CloudOffIcon, LockIcon, ShieldIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'
const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

export function ProfilePage({ email, admin }: { email: string; admin: boolean }) {
  const { t } = useI18n()
  const { online, profile } = useStore()

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}
      {/* key: start over once the saved profile arrives from the server */}
      <ProfileForm key={profile ? 'loaded' : 'empty'} email={email} admin={admin} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ email, admin }: { email: string; admin: boolean }) {
  const { t } = useI18n()
  const { online, profile } = useStore()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [photo, setPhoto] = useState<string | null>(profile?.photo ?? null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const changed = name.trim() !== (profile?.display_name ?? '') || photo !== (profile?.photo ?? null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const err = await saveProfile({ display_name: name.trim() || null, photo })
    setMessage(err ? { ok: false, text: err } : { ok: true, text: t('saved') })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className={card}>
      <PhotoPicker
        photo={photo}
        name={name || email}
        onChange={p => {
          setPhoto(p)
          setMessage(null)
        }}
      />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          {t('displayName')}
          <span className="ms-2 text-xs font-normal text-slate-400">({t('displayNameHint')})</span>
        </span>
        <input
          className={input}
          value={name}
          placeholder={t('phDisplayName')}
          maxLength={100}
          onChange={e => {
            setName(e.target.value)
            setMessage(null)
          }}
          disabled={busy}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('email')}</span>
        <input className={`${input} bg-slate-50 text-slate-500 dark:bg-slate-800/50`} value={email} dir="ltr" readOnly />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t('role')}</span>
        {admin ? (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
            <ShieldIcon className="size-5" />
            {t('youAreAdmin')}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">{t('youAreServant')}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={!online || busy || !changed}
          className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('save')}
        </button>
        {message && <span className={`text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>}
      </div>
    </form>
  )
}

function PasswordForm() {
  const { t } = useI18n()
  const { online } = useStore()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setMessage({ ok: false, text: t('passwordTooShort') })
    if (password !== repeat) return setMessage({ ok: false, text: t('passwordMismatch') })
    setBusy(true)
    const err = await changePassword(password)
    setMessage(err ? { ok: false, text: err } : { ok: true, text: t('passwordChanged') })
    if (!err) {
      setPassword('')
      setRepeat('')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="flex items-center gap-2 font-bold">
        <LockIcon className="size-4 text-indigo-600 dark:text-indigo-300" />
        {t('changePassword')}
      </h2>
      <div className="space-y-3">
        <PasswordInput
          autoComplete="new-password"
          placeholder={t('newPassword')}
          className={input}
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={busy}
        />
        <PasswordInput
          autoComplete="new-password"
          placeholder={t('confirmPassword')}
          className={input}
          value={repeat}
          onChange={e => setRepeat(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={!online || busy || !password}
          className="rounded-lg border border-slate-200 px-5 py-2 font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('changePassword')}
        </button>
        {message && <span className={`text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>}
      </div>
    </form>
  )
}
