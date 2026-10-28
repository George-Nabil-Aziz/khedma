import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { activeClasses, createClass, deleteClass, leaveClass, rejoinClass, renameClass, setCurrentClass, setDefaultClass, useStore } from '../lib/store'
import { currentServiceYear, serviceYearOptions } from '../lib/serviceYear'
import type { ClassInfo } from '../lib/supabase'
import { confirmDialog } from '../components/ConfirmDialog'
import { ClassServants } from '../components/ClassServants'
import { CloudOffIcon, PencilIcon, PlusIcon, ShareIcon, StarIcon, StarOutlineIcon, TrashIcon, UsersIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

/** All my classes over the years, grouped by service year, newest first. */
export function ClassesPage({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const { online, classes } = useStore()

  const years = [...new Set(classes.map(c => c.service_year))].sort().reverse()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* only meaningful once there is at least one class to star */}
      {activeClasses(classes).length > 0 && <p className="text-sm text-slate-500">{t('classesHelp')}</p>}

      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      <NewClassForm />

      {/* no class yet: say so, and point to the other way in — a colleague's share code */}
      {activeClasses(classes).length === 0 && (
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <h2 className="font-bold">{t('noClassTitle')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('noClassHelp')}</p>
          <button
            onClick={() => go('/share')}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300"
          >
            <ShareIcon className="size-4" />
            {t('joinWithCode')}
          </button>
        </div>
      )}

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
              c.left_at ? <LeftClassCard key={c.id} c={c} /> : <ClassCard key={c.id} c={c} admin={admin} />
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
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <input className={input} placeholder={t('phClassName')} value={name} onChange={e => setName(e.target.value)} disabled={!online || busy} autoFocus />
        {/* The list shows single years (2027); once picked, the box shows the whole service year
            (2026-2027). The select's own text is hidden and the full year is drawn over it. */}
        <div className="relative" dir="ltr">
          <select
            className={`${input} text-transparent`}
            value={year}
            onChange={e => setYear(e.target.value)}
            disabled={!online || busy}
            aria-label={`${t('serviceYear')}: ${year}`}
          >
            {serviceYearOptions().map(y => (
              <option key={y.value} value={y.value} className="text-slate-900 dark:text-slate-100">
                {y.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-semibold">{year}</span>
        </div>
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

/** A class I left in the last 7 days: greyed out, no data, just a way back in. */
function LeftClassCard({ c }: { c: ClassInfo }) {
  const { t, lang } = useI18n()
  const { online } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const until = new Date(new Date(c.left_at!).getTime() + 7 * 24 * 60 * 60 * 1000)
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(until)

  async function rejoin() {
    setBusy(true)
    setError('')
    const r = await rejoinClass(c.id)
    setBusy(false)
    if (r.ok) go('/')
    else setError(r.error === 'too_late' ? t('rejoinTooLate') : r.error)
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 opacity-60">
          <div className="truncate font-bold line-through decoration-slate-400">{c.name}</div>
          <div className="text-xs text-slate-500">
            {t('youLeft')} · {t('rejoinUntil').replace('{date}', date)}
          </div>
        </div>
        <button
          onClick={rejoin}
          disabled={!online || busy}
          className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300"
        >
          {t('rejoin')}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
  )
}

function ClassCard({ c, admin }: { c: ClassInfo; admin: boolean }) {
  const { t } = useI18n()
  const store = useStore()
  const { online, currentClass } = store
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(c.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const open = c.id === currentClass
  const [showServants, setShowServants] = useState(false)

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError('')
    const r = await action()
    if (!r.ok) setError(r.error ?? '')
    setBusy(false)
    return r.ok
  }

  async function leave() {
    const ok = await confirmDialog({ title: t('leaveClass'), message: t('leaveConfirm').replace('{name}', c.name), confirmLabel: t('leaveClass'), danger: true })
    if (ok) run(() => leaveClass(c.id))
  }

  /** Admin: delete the class, after showing exactly which children go with it. */
  async function removeClass() {
    // the admin's local copy holds the children of every class
    const children = store.rows.filter(r => r.class_id === c.id).map(r => r.full_name).sort((a, b) => a.localeCompare(b, 'ar'))
    const ok = await confirmDialog({
      title: t('deleteClass'),
      message: t('deleteClassConfirm').replace('{name}', c.name).replace('{count}', String(children.length)),
      details: children,
      confirmLabel: t('deleteClass'),
      danger: true,
      requireText: c.name,
    })
    if (ok) run(() => deleteClass(c.id))
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
              onClick={() => setShowServants(v => !v)}
              disabled={!online}
              aria-expanded={showServants}
              className={'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ' + (showServants ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300' : 'border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800')}
            >
              <UsersIcon className="size-4" />
              <span className="hidden sm:inline">{t('servants')}</span>
            </button>
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
            {/* the trash can: an admin deletes the whole class, a servant leaves it */}
            {(admin || c.is_member) && (
              <button
                onClick={admin ? removeClass : leave}
                disabled={!online || busy}
                title={admin ? t('deleteClass') : t('leaveClass')}
                aria-label={admin ? t('deleteClass') : t('leaveClass')}
                className={`${iconBtn} text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10`}
              >
                <TrashIcon />
              </button>
            )}
          </>
        )}
      </div>
      {showServants && <ClassServants classId={c.id} className={c.name} admin={admin} />}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
  )
}
