import { useState, type FormEvent } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { go } from '../lib/router'
import { activeClasses, createClass, deleteClass, leaveClass, rejoinClass, renameClass, saveSheetInfo, setCurrentClass, setDefaultClass, useStore } from '../lib/store'
import { currentServiceYear, dmy, serviceYearOptions } from '../lib/serviceYear'
import type { ClassInfo, SheetInfo } from '../lib/supabase'
import { confirmDialog } from '../components/ConfirmDialog'
import { ClassServants } from '../components/ClassServants'
import { CloudOffIcon, PencilIcon, PlusIcon, ShareIcon, StarIcon, StarOutlineIcon, TrashIcon, UsersIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

// بيانات الكشف: the header of the exported sheets (تصدير), typed when the class is made or edited.
// The title is the class name and الخادم its servants, so neither is asked for.
/** السنة الدراسية: the school year of the class's children, picked from a list. */
const GRADES = [
  'KG1',
  'KG2',
  ...['أولى', 'ثانية', 'ثالثة', 'رابعة', 'خامسة', 'سادسة'].map(n => `${n} ابتدائي`),
  ...['أولى', 'ثانية', 'ثالثة'].map(n => `${n} إعدادي`),
  ...['أولى', 'ثانية', 'ثالثة'].map(n => `${n} ثانوي`),
  'جامعة',
  'خريجين',
]

const SHEET_FIELDS: { key: keyof SheetInfo; label: TKey }[] = [
  { key: 'grade', label: 'sheetGrade' },
  { key: 'area', label: 'sheetArea' },
  { key: 'head', label: 'sheetHead' },
  { key: 'assistant', label: 'sheetAssistant' },
]

/** Only the filled fields, trimmed — what is saved. */
function cleanInfo(info: SheetInfo): SheetInfo {
  return Object.fromEntries(SHEET_FIELDS.map(f => [f.key, (info[f.key] ?? '').trim()]).filter(([, v]) => v))
}
const sameInfo = (a: SheetInfo, b: SheetInfo) => JSON.stringify(cleanInfo(a)) === JSON.stringify(cleanInfo(b))

function SheetInfoFields({ value, onChange, disabled }: { value: SheetInfo; onChange: (v: SheetInfo) => void; disabled: boolean }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {SHEET_FIELDS.map(f => (
        <label key={f.key} className="block space-y-1">
          <span className="text-xs font-semibold text-slate-500">{t(f.label)}</span>
          {f.key === 'grade' ? (
            <select className={input} value={value.grade ?? ''} onChange={e => onChange({ ...value, grade: e.target.value })} disabled={disabled}>
              <option value="">—</option>
              {/* something typed before the list existed stays choosable */}
              {[...(value.grade && !GRADES.includes(value.grade) ? [value.grade] : []), ...GRADES].map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          ) : (
            <input className={input} value={value[f.key] ?? ''} onChange={e => onChange({ ...value, [f.key]: e.target.value })} disabled={disabled} />
          )}
        </label>
      ))}
    </div>
  )
}

/** All my classes over the years, grouped by service year, newest first. */
export function ClassesPage({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const { online, classes } = useStore()

  const years = [...new Set(classes.map(c => c.service_year))].sort().reverse()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

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

      {/* a new class: below the classes there already are */}
      <NewClassForm />
    </div>
  )
}

function NewClassForm() {
  const { t } = useI18n()
  const { online } = useStore()
  const [name, setName] = useState('')
  const [year, setYear] = useState(currentServiceYear())
  const [info, setInfo] = useState<SheetInfo>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await createClass(name.trim(), year)
    // the class is made even if its بيانات الكشف could not be saved — they can be added later (✏️)
    const saved = r.ok && Object.keys(cleanInfo(info)).length ? await saveSheetInfo(r.value, cleanInfo(info)) : null
    setBusy(false)
    if (r.ok) {
      setName('')
      setInfo({})
      if (saved && !saved.ok) return setError(saved.error)
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
        <input className={input} placeholder={t('phClassName')} value={name} onChange={e => setName(e.target.value)} disabled={!online || busy} />
        <select className={input} dir="ltr" value={year} onChange={e => setYear(e.target.value)} disabled={!online || busy} aria-label={t('serviceYear')}>
          {serviceYearOptions().map(y => (
            <option key={y.value} value={y.value}>
              {y.label}
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
      <SheetInfoFields value={info} onChange={setInfo} disabled={!online || busy} />
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
  const date = dmy(until)

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
  const [info, setInfo] = useState<SheetInfo>(c.sheet_info ?? {})
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

  function cancelRename() {
    setName(c.name)
    setInfo(c.sheet_info ?? {})
    setError('')
    setRenaming(false)
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
        // starred and open: amber border with an indigo ring around it, so both show
        c.is_default && open
          ? 'border-amber-400 ring-2 ring-indigo-400 dark:border-amber-500/60 dark:ring-indigo-500/70'
          : c.is_default
            ? 'border-amber-400 ring-2 ring-amber-400/20 dark:border-amber-500/60'
            : open
              ? 'border-indigo-400 ring-2 ring-indigo-400/20 dark:border-indigo-500/60'
              : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* on a phone the buttons drop under the name, so the name and status words get the full width */}
      <div className="flex flex-wrap items-center gap-2">
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
            className="flex min-w-0 flex-1 basis-full flex-col gap-2"
            onSubmit={async e => {
              e.preventDefault()
              const ok = await run(async () => {
                if (name.trim() !== c.name) {
                  const r = await renameClass(c.id, name.trim())
                  if (!r.ok) return r
                }
                return sameInfo(info, c.sheet_info ?? {}) ? { ok: true } : saveSheetInfo(c.id, cleanInfo(info))
              })
              if (ok) setRenaming(false)
            }}
          >
            <input
              className={input}
              placeholder={t('phClassName')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && cancelRename()}
              disabled={busy}
              autoFocus
              aria-label={t('className')}
            />
            <SheetInfoFields value={info} onChange={setInfo} disabled={busy} />
            <div className="flex gap-2">
              {/* nothing to save until something is actually changed */}
              <button
                disabled={busy || !name.trim() || (name.trim() === c.name && sameInfo(info, c.sheet_info ?? {}))}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('save')}
              </button>
              {/* back to the card without saving */}
              <button
                type="button"
                onClick={cancelRename}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1 basis-40">
            <div className="font-bold wrap-break-word sm:truncate">{c.name}</div>
            {/* status words, with a dot only between two of them */}
            <div className="flex flex-wrap gap-x-1.5 text-xs text-slate-500 [&>*+*]:before:me-1.5 [&>*+*]:before:content-['·']">
              {c.is_default && <span className="text-amber-600 dark:text-amber-400">{t('thisYearClass')}</span>}
              {open && <span className="text-indigo-600 dark:text-indigo-300">{t('openNow')}</span>}
              {!c.is_member && <span>{t('notMember')}</span>}
            </div>
          </div>
        )}

        {!renaming && (
          <div className="ms-auto flex items-center gap-2">
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
            <button onClick={() => {
              setName(c.name)
              setInfo(c.sheet_info ?? {})
              setRenaming(true)
            }} disabled={!online} title={t('rename')} aria-label={t('rename')} className={`${iconBtn} text-slate-500`}>
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
          </div>
        )}
      </div>
      {showServants && <ClassServants classId={c.id} className={c.name} admin={admin} />}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
  )
}
