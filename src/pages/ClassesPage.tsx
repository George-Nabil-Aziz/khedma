import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { createClass, leaveClass, renameClass, setCurrentClass, setDefaultClass, useStore } from '../lib/store'
import { currentServiceYear, nearbyServiceYears } from '../lib/serviceYear'
import type { ClassInfo } from '../lib/supabase'
import { CloudOffIcon, DoorIcon, PencilIcon, PlusIcon, StarIcon, StarOutlineIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

/** All my classes over the years, grouped by service year, newest first. */
export function ClassesPage() {
  const { t } = useI18n()
  const { online, classes } = useStore()

  const years = [...new Set(classes.map(c => c.service_year))].sort().reverse()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm text-slate-500">{t('classesHelp')}</p>

      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      <NewClassForm />

      {years.map(year => (
        <section key={year} className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-sm font-bold text-slate-500">
            <span dir="ltr">{year}</span>
            {year === currentServiceYear() && (
              <span className="rounded-full bg-indigo-100 px-2 text-xs text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{t('currentYear')}</span>
            )}
          </h2>
          {classes
            .filter(c => c.service_year === year)
            .map(c => (
              <ClassCard key={c.id} c={c} />
            ))}
        </section>
      ))}
    </div>
  )
}

function NewClassForm() {
  const { t } = useI18n()
  const { online } = useStore()
  const [name, setName] = useState('')
  const [year, setYear] = useState(currentServiceYear())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await createClass(name.trim(), year)
    setBusy(false)
    if (r.ok) {
      setName('')
      go('/')
    } else setError(r.error)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        <PlusIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
        {t('newClass')}
      </h2>
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <input className={input} placeholder={t('phClassName')} value={name} onChange={e => setName(e.target.value)} disabled={!online || busy} autoFocus />
        <select className={input} value={year} onChange={e => setYear(e.target.value)} disabled={!online || busy} aria-label={t('serviceYear')} dir="ltr">
          {nearbyServiceYears().map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          disabled={!online || busy || !name.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('create')}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </form>
  )
}

function ClassCard({ c }: { c: ClassInfo }) {
  const { t } = useI18n()
  const { online, currentClass } = useStore()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(c.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = c.id === currentClass

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError('')
    const r = await action()
    if (!r.ok) setError(r.error ?? '')
    setBusy(false)
    return r.ok
  }

  const iconBtn = 'grid size-9 place-items-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800'

  return (
    <div
      className={`space-y-2 rounded-xl border bg-white p-3 dark:bg-slate-900 ${
        open ? 'border-indigo-400 ring-2 ring-indigo-500/20 dark:border-indigo-500/60' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {c.is_member && (
          <button
            onClick={() => run(() => setDefaultClass(c.is_default ? null : c.id))}
            disabled={!online || busy}
            title={c.is_default ? t('unmarkThisYear') : t('markThisYear')}
            aria-label={c.is_default ? t('unmarkThisYear') : t('markThisYear')}
            className={`${iconBtn} ${c.is_default ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'}`}
          >
            {c.is_default ? <StarIcon className="size-5" /> : <StarOutlineIcon className="size-5" />}
          </button>
        )}

        {renaming ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async e => {
              e.preventDefault()
              if (await run(() => renameClass(c.id, name.trim()))) setRenaming(false)
            }}
          >
            <input className={input} placeholder={t('phClassName')} value={name} onChange={e => setName(e.target.value)} disabled={busy} autoFocus aria-label={t('className')} />
            <button disabled={busy || !name.trim()} className="rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
              {t('save')}
            </button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{c.name}</div>
            <div className="text-xs text-slate-500">
              {c.is_default && <span className="text-amber-600 dark:text-amber-400">{t('thisYearClass')} · </span>}
              {open && <span className="text-indigo-600 dark:text-indigo-300">{t('openNow')}</span>}
              {!c.is_member && <span>{t('notMember')}</span>}
            </div>
          </div>
        )}

        {!renaming && (
          <>
            <button
              onClick={() => {
                setCurrentClass(c.id)
                go('/')
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('openClass')}
            </button>
            <button onClick={() => setRenaming(true)} disabled={!online} title={t('rename')} aria-label={t('rename')} className={`${iconBtn} text-slate-500`}>
              <PencilIcon />
            </button>
            {c.is_member && (
              <button
                onClick={() => window.confirm(t('leaveConfirm').replace('{name}', c.name)) && run(() => leaveClass(c.id))}
                disabled={!online || busy}
                title={t('leaveClass')}
                aria-label={t('leaveClass')}
                className={`${iconBtn} text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10`}
              >
                <DoorIcon />
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
  )
}
