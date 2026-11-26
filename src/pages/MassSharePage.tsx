import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { useStore } from '../lib/store'
import { createMassInvite, leaveMass, listMassMembers, removeMassMember, type MassMember } from '../lib/mass'
import { MassTabs } from './MassPage'
import { CloudOffIcon, CopyIcon, ShareIcon, TrashIcon } from '../components/Icons'
import { toast } from '../components/Toast'
import { confirmDialog } from '../components/ConfirmDialog'

const primary = 'flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50'

type Code = { code: string; expires_at: string }

/** Share القداس with a colleague by a code; admins also see who has access and can remove them. */
export function MassSharePage({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const { online } = useStore()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <MassTabs active="share" />
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}
      <Invite />
      {admin ? <Members /> : <Leave />}
    </div>
  )
}

function Invite() {
  const { t } = useI18n()
  const { online } = useStore()
  const [invite, setInvite] = useState<Code | null>(null)
  const [, tick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const left = invite ? Math.max(0, Math.ceil((Date.parse(invite.expires_at) - Date.now()) / 1000)) : 0
  const shown = invite && left > 0 ? invite : null

  // count down every second while a code is up; at 0 it disappears
  useEffect(() => {
    if (!shown) return
    const timer = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(timer)
  }, [shown])

  async function generate() {
    setBusy(true)
    setError('')
    const r = await createMassInvite()
    if (r.ok) setInvite(r.value)
    else setError(r.error)
    setBusy(false)
  }

  async function copy() {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.code)
      toast(t('copied'))
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        <span className="text-indigo-600 dark:text-indigo-300">
          <ShareIcon className="size-5" />
        </span>
        {t('massInviteTitle')}
      </h2>
      <p className="text-sm text-slate-500">{t('massInviteHelp')}</p>
      {shown && (
        <div className="space-y-2 rounded-xl bg-indigo-50 p-4 text-center dark:bg-indigo-500/10">
          <div dir="ltr" className="font-mono text-4xl font-bold tracking-[0.3em] text-indigo-700 select-all dark:text-indigo-300">
            {shown.code}
          </div>
          <div className="text-xs text-slate-500">
            {t('codeExpiresIn')}{' '}
            <span dir="ltr" className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </span>
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold dark:border-indigo-500/30">
            <CopyIcon />
            {t('copy')}
          </button>
        </div>
      )}
      <button onClick={generate} disabled={!online || busy} className={primary}>
        {shown ? t('newCode') : t('generateCode')}
      </button>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">
          {error}
        </p>
      )}
    </section>
  )
}

/** Admins: everyone who joined with a code, each removable. */
function Members() {
  const { t } = useI18n()
  const { online } = useStore()
  const [members, setMembers] = useState<MassMember[] | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const r = await listMassMembers()
    if (typeof r === 'string') {
      setError(r)
      setMembers([])
    } else {
      setError('')
      setMembers(r)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function remove(m: MassMember) {
    const name = m.display_name || m.email
    const ok = await confirmDialog({ title: t('removeMassMember'), message: t('removeMassMemberConfirm').replace('{name}', name), confirmLabel: t('removeMassMember'), danger: true })
    if (!ok) return
    const err = await removeMassMember(m.user_id)
    if (err) toast(err)
    else load()
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold">{t('massMembers')}</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {members && members.length === 0 && !error && <p className="text-sm text-slate-500">{t('noMassMembers')}</p>}
      {members?.map(m => (
        <div key={m.user_id} className="flex items-center gap-1 border-t border-slate-100 first:border-t-0 dark:border-slate-800">
          <div className="min-w-0 flex-1 py-2">
            <div className="truncate font-semibold">{m.display_name || m.email}</div>
            {m.display_name && (
              <div dir="ltr" className="truncate text-start text-sm text-slate-500">
                {m.email}
              </div>
            )}
          </div>
          <button onClick={() => remove(m)} disabled={!online} title={t('removeMassMember')} aria-label={t('removeMassMember')} className="grid size-9 place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10">
            <TrashIcon />
          </button>
        </div>
      ))}
    </section>
  )
}

/** A member (not an admin) can leave the section. */
function Leave() {
  const { t } = useI18n()
  const { online } = useStore()

  async function leave() {
    const ok = await confirmDialog({ title: t('leaveMass'), message: t('leaveMassConfirm'), confirmLabel: t('leaveMass'), danger: true })
    if (!ok) return
    const err = await leaveMass()
    if (err) toast(err)
    else go('/')
  }

  return (
    <button onClick={leave} disabled={!online} className="w-full rounded-lg border border-slate-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-red-500/10">
      {t('leaveMass')}
    </button>
  )
}
