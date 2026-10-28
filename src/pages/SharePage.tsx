import { useState, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { createInvite, joinClass, useStore } from '../lib/store'
import { CloudOffIcon, CopyIcon, PlusIcon, ShareIcon } from '../components/Icons'
import { CodeInput } from '../components/CodeInput'

const primary = 'flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50'

/** Invite a colleague to the class on screen, or join a colleague's class with their code. */
export function SharePage() {
  const { t } = useI18n()
  const { online, classes, currentClass } = useStore()
  const current = classes.find(c => c.id === currentClass)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      {current && <Invite name={current.name} />}
      <Join />
    </div>
  )
}

/** Shown instead of the class pages when the user has no class yet. */
export function NoClass() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{t('noClassTitle')}</h2>
        <p className="text-slate-500">{t('noClassHelp')}</p>
      </div>
      <button onClick={() => go('/classes')} className={`${primary} w-full py-3`}>
        <PlusIcon className="size-5" />
        {t('createClass')}
      </button>
      <button
        onClick={() => go('/share')}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <ShareIcon className="size-5" />
        {t('joinWithCode')}
      </button>
    </div>
  )
}

function Invite({ name }: { name: string }) {
  const { t, lang } = useI18n()
  const { online } = useStore()
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setBusy(true)
    setError('')
    setCopied(false)
    const r = await createInvite()
    if (r.ok) setInvite(r.value)
    else setError(r.error)
    setBusy(false)
  }

  async function copy() {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  }

  const time = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Card title={`${t('inviteTitle')}: ${name}`} icon={<ShareIcon className="size-5" />}>
      <p className="text-sm text-slate-500">{t('inviteHelp')}</p>
      {invite && (
        <div className="space-y-2 rounded-xl bg-indigo-50 p-4 text-center dark:bg-indigo-500/10">
          <div dir="ltr" className="font-mono text-4xl font-bold tracking-[0.3em] text-indigo-700 select-all dark:text-indigo-300">
            {invite.code}
          </div>
          <div className="text-xs text-slate-500">
            {t('codeExpires')}: {time.format(new Date(invite.expires_at))}
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold dark:border-indigo-500/30">
            <CopyIcon />
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      )}
      <button onClick={generate} disabled={!online || busy} className={primary}>
        {invite ? t('newCode') : t('generateCode')}
      </button>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

function Join() {
  const { t } = useI18n()
  const { online } = useStore()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Sends as soon as the sixth digit is typed — no button.
  async function submit(full: string) {
    setBusy(true)
    setError('')
    const r = await joinClass(full)
    setBusy(false)
    setCode('')
    if (r.ok) go('/')
    else setError(r.error === 'too_many' ? t('codeTooMany') : r.error === 'invalid' ? t('codeInvalid') : r.error)
  }

  return (
    <Card title={t('joinTitle')}>
      <CodeInput
        value={code}
        onChange={v => {
          setCode(v)
          if (v) setError('')
        }}
        onComplete={submit}
        disabled={!online || busy}
      />
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        {icon && <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  )
}

function ErrorText({ children }: { children: string }) {
  if (!children) return null
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">
      {children}
    </p>
  )
}
