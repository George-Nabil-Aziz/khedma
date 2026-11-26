import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { go, type Path } from '../lib/router'
import { useStore } from '../lib/store'
import { dmy } from '../lib/serviceYear'
import {
  MASS_PALETTE,
  classColor,
  massCounts,
  setClassColor,
  renameGroup,
  saveServiceOrder,
  renameService,
  type MassItem,
  copticDate,
  createMass,
  deleteChild,
  deleteClass,
  deleteMass,
  loadAssignments,
  loadMass,
  saveAssignment,
  saveChild,
  saveClass,
  useMass,
  type MassAssignment,
  type MassClass,
} from '../lib/mass'
import { openPicker } from '../lib/picker'
import { load, save } from '../lib/storage'
import { telLink, whatsappLink } from '../lib/phones'
import { Loading } from '../components/Loading'
import { SortableList } from '../components/SortableList'
import { toast } from '../components/Toast'
import { confirmDialog } from '../components/ConfirmDialog'
import { ArrowBackIcon, ChurchIcon, CloudOffIcon, PencilIcon, PhoneIcon, ChevronDownIcon, GripIcon, PlusIcon, TrashIcon, WhatsAppIcon, XIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'
const errorBox = 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300'
const iconBtn = 'grid size-9 place-items-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800'

/** "4-12-2026 · 25 هاتور" */
const massDay = (iso: string) => `${dmy(iso)} · ${copticDate(iso)}`

/** The same, as two parts: the Gregorian date, then the Coptic one in a soft badge of its own. */
function MassDay({ iso, className = '' }: { iso: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span dir="ltr" className="whitespace-nowrap">{dmy(iso)}</span>
      {/* a pill that may drop under the date on a very narrow screen, but never breaks inside itself */}
      <span className="shrink-0 whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-[0.8em] font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">{copticDate(iso)}</span>
    </span>
  )
}

function OfflineNote() {
  const { t } = useI18n()
  const { online } = useStore()
  if (online) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <CloudOffIcon className="size-4 shrink-0" />
      {t('needsOnline')}
    </div>
  )
}

/** العدد: how many lines of this mass each child serves in. */
function CountsTable({ rows }: { rows: Record<string, MassAssignment> }) {
  const { t } = useI18n()
  const { classes, children } = useMass()
  const counts = massCounts(rows, children, classes)
  const th = 'border border-slate-200 bg-slate-100 px-3 py-2 text-start text-sm font-bold dark:border-slate-700 dark:bg-slate-800'
  const td = 'border border-slate-200 px-3 py-2 dark:border-slate-700'
  return (
    <div className="space-y-3">
      <p className="font-semibold">
        {t('massChildrenServing')}: <span dir="ltr">{counts.length}</span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[420px] border-collapse text-start">
          <thead>
            <tr>
              <th className={`${th} w-12`}>#</th>
              <th className={th}>{t('massServed')}</th>
              <th className={th}>{t('massServant')}</th>
              <th className={`${th} w-20`}>{t('massCount')}</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((x, i) => (
              <tr key={x.child.id}>
                <td className={`${td} text-center text-slate-500`}>{i + 1}</td>
                <td className={`${td} font-semibold`}>{x.child.name}</td>
                <td className={`${td} ${classColor(classes, x.cls?.id)?.fill ?? ''}`}>{x.cls?.name}</td>
                <td className={`${td} text-center font-bold`}>{x.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The colour dot of a class, so the colours on the schedule can be matched to names. */
function ClassDot({ id, onClick }: { id: string; onClick?: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const { classes, colorsReady } = useMass()
  const c = classColor(classes, id)
  if (!c) return null
  if (!onClick || !colorsReady) return <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${c.dot}`} />
  // tap the dot to pick another colour; a roomy button around a small dot, easy to hit on a phone
  return (
    <button type="button" onClick={onClick} disabled={!online} title={t('massColor')} aria-label={t('massColor')} className="-m-2 grid size-7 shrink-0 place-items-center rounded-full disabled:opacity-60">
      <span className={`size-3 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80 ${c.dot}`} />
    </button>
  )
}

/** The palette as swatches: tap one to give the class that colour (saved at once). */
function ColorRow({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useI18n()
  const { classes } = useMass()
  const current = classColor(classes, id)?.key
  async function pick(key: string) {
    onDone()
    if (key === current) return
    const err = await setClassColor(id, key)
    if (err) toast(err)
  }
  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800" role="group" aria-label={t('massColor')}>
      {MASS_PALETTE.map(c => (
        <button key={c.key} type="button" onClick={() => pick(c.key)} aria-label={c.key} aria-pressed={c.key === current} className={`grid size-9 place-items-center rounded-full ${c.fill} ${c.key === current ? 'ring-2 ring-indigo-500' : 'ring-1 ring-slate-300 dark:ring-slate-600'}`}>
          <span className={`size-3 rounded-full ${c.dot}`} />
        </button>
      ))}
    </div>
  )
}

/** A small muted running number before an entry; a fixed width so the names line up. */
function Num({ n }: { n: number }) {
  return (
    <span dir="ltr" className="w-7 shrink-0 text-center text-sm tabular-nums text-slate-400">
      {n}
    </span>
  )
}

/**
 * A bar of equal-width tabs in one row — the phone look of the app's other tab bars (boxes, the open
 * one filled with the accent); short text that never wraps, so four fit at 360px.
 */
function TabBar({ cols, tabs }: { cols: 3 | 4; tabs: { on: boolean; label: string; path: Path }[] }) {
  return (
    <nav className={`grid max-w-xl gap-1.5 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {tabs.map(x => (
        <button
          key={x.path}
          onClick={() => go(x.path)}
          aria-current={x.on ? 'page' : undefined}
          className={`min-w-0 truncate rounded-lg border px-1 py-2 text-center text-xs font-semibold sm:text-sm ${
            x.on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-200'
          }`}
        >
          {x.label}
        </button>
      ))}
    </nav>
  )
}

/** The tabs of القداس: the masses, the names to pick from, the services, and sharing. */
export function MassTabs({ active }: { active: 'masses' | 'names' | 'services' | 'share' }) {
  const { t } = useI18n()
  return (
    <TabBar
      cols={4}
      tabs={[
        { on: active === 'masses', label: t('massList'), path: '/masses' },
        { on: active === 'names', label: t('massNames'), path: '/mass-names' },
        { on: active === 'services', label: t('massServices'), path: '/mass-services' },
        { on: active === 'share', label: t('share'), path: '/mass-share' },
      ]}
    />
  )
}

/** The three sub-tabs of الأسماء: classes with their children, only the classes, only the children. */
function NamesTabs({ active }: { active: 'names' | 'servants' | 'children' }) {
  const { t } = useI18n()
  return (
    <TabBar
      cols={3}
      tabs={[
        { on: active === 'names', label: t('massAll'), path: '/mass-names' },
        { on: active === 'servants', label: t('massServants'), path: '/mass-servants' },
        { on: active === 'children', label: t('massChildren'), path: '/mass-children' },
      ]}
    />
  )
}

// ---- list ---------------------------------------------------------------------

/** The masses, newest first; add one by its date, delete one. */
export function MassesPage() {
  const { t } = useI18n()
  const { online } = useStore()
  const { masses, loaded, error } = useMass()
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadMass()
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    const r = await createMass(date)
    setBusy(false)
    if ('error' in r) return setFormError(r.error === 'duplicate' ? t('massDuplicate') : r.error)
    go(`/mass/${r.id}`)
  }

  async function remove(id: string, iso: string) {
    const ok = await confirmDialog({ title: t('deleteMass'), message: t('deleteMassConfirm').replace('{date}', massDay(iso)), confirmLabel: t('deleteMass'), danger: true })
    if (!ok) return
    const err = await deleteMass(id)
    if (err) toast(err)
  }

  if (!loaded) return <Loading />

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <MassTabs active="masses" />
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {adding ? (
        <form onSubmit={add} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 font-bold">
            <ChurchIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
            {t('newMass')}
          </h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('massDate')}</span>
            <input type="date" required dir="ltr" className={input} value={date} onChange={e => setDate(e.target.value)} onClick={openPicker} disabled={busy} autoFocus />
          </label>
          {date && <MassDay iso={date} className="text-sm text-slate-500" />}
          {formError && <p className={errorBox}>{formError}</p>}
          <div className="flex gap-2">
            <button disabled={!online || busy || !date} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {t('save')}
            </button>
            <button type="button" onClick={() => setAdding(false)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={!online}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon className="size-5" />
          {t('newMass')}
        </button>
      )}

      {masses.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
          <ChurchIcon className="size-10 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold">{t('noMasses')}</p>
        </div>
      )}

      <section className="space-y-2">
        {masses.map(m => (
          <div key={m.id} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white pe-2 hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40">
            <button onClick={() => go(`/mass/${m.id}`)} className="flex min-w-0 flex-1 items-center gap-2 p-4 text-start">
              <ChurchIcon className="size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
              <MassDay iso={m.mass_date} className="min-w-0 flex-1 text-lg font-bold" />
            </button>
            <button onClick={() => remove(m.id, m.mass_date)} disabled={!online} title={t('deleteMass')} aria-label={t('deleteMass')} className={`${iconBtn} text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10`}>
              <TrashIcon />
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

// ---- one mass -----------------------------------------------------------------

const keyOf = (service: string, slot: number) => `${service}#${slot}`
const VIEW_KEY = 'massView'
const COLLAPSED_KEY = 'massCollapsed'

/** The schedule of one mass: per service, a class of servants and one of its children. */
export function MassPage({ id }: { id: string }) {
  const { t } = useI18n()
  const { online } = useStore()
  const { masses, classes, children, loaded, groups } = useMass()
  const [exporting, setExporting] = useState(false)
  const [rows, setRows] = useState<Record<string, MassAssignment> | null>(null)
  const [error, setError] = useState('')
  // جدول (the sheet) or كروت (cards): remembered on this device
  const [view, setViewState] = useState<'table' | 'cards' | 'counts'>(() => {
    const v = load(VIEW_KEY)
    return v === 'cards' || v === 'counts' ? v : 'table'
  })
  const setView = (v: 'table' | 'cards' | 'counts') => {
    setViewState(v)
    save(VIEW_KEY, v)
  }

  useEffect(() => {
    loadMass()
    loadAssignments(id).then(r => {
      if (typeof r === 'string') {
        setError(r)
        setRows({})
      } else setRows(Object.fromEntries(r.map(a => [keyOf(a.service_key, a.slot), a])))
    })
  }, [id])

  const mass = masses.find(m => m.id === id)
  if (!loaded || !rows) return <Loading />
  if (!mass) return <p className="py-10 text-center text-slate-500">{t('massNotFound')}</p>

  /** Pick a class (child cleared) or a child; shown at once, saved to Supabase, undone if it fails. */
  async function change(service: string, slot: number, patch: { class_id: string | null; child_id: string | null }) {
    const k = keyOf(service, slot)
    const before = rows![k]
    const next: MassAssignment = { mass_id: id, service_key: service, slot, ...patch }
    setRows(r => ({ ...r, [k]: next }))
    const err = await saveAssignment(next)
    if (err) {
      setRows(r => {
        const copy = { ...r }
        if (before) copy[k] = before
        else delete copy[k]
        return copy
      })
      toast(err)
    }
  }

  const select = 'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700'
  const plain = 'bg-white dark:bg-slate-800'
  const dim = 'text-slate-400 dark:text-slate-500' // the placeholder shows muted while the field is empty
  const normal = 'text-slate-900 dark:text-slate-100' // the options of an empty field keep normal text

  /**
   * The two dropdowns of one line, the same in both views: servant class, then a child. With no
   * servant picked the child list holds everyone, grouped by class; picking a child then does not
   * fill the servant. A × beside a field (only when it has a value) empties it and saves at once.
   */
  const pickers = (service: string, slot: number) => {
    const a = rows[keyOf(service, slot)]
    const classId = a?.class_id ?? ''
    const childId = a?.child_id ?? ''
    const color = classColor(classes, classId) // the servant field takes its class's colour
    const clear = (label: string, onClear: () => void) => (
      <button type="button" onClick={onClear} disabled={!online} title={t('clear')} aria-label={`${t('clear')}: ${label}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40 dark:hover:bg-slate-700">
        <XIcon className="size-4" />
      </button>
    )
    const option = (c: { id: string; name: string }, plainText = false) => (
      <option key={c.id} value={c.id} className={plainText ? normal : undefined}>
        {c.name}
      </option>
    )
    return [
      <div key="s" className="flex items-center gap-1">
        <select className={`${select} ${color?.fill ?? `${plain} ${dim}`}`} disabled={!online} value={classId} aria-label={t('massServant')} onChange={e => change(service, slot, { class_id: e.target.value || null, child_id: null })}>
          <option value="" disabled hidden>{t('pickServant')}</option>
          {classes.map(c => option(c, !color))}
        </select>
        {classId && clear(t('massServant'), () => change(service, slot, { class_id: null, child_id: null }))}
      </div>,
      <div key="c" className="flex items-center gap-1">
        <select className={`${select} ${plain} ${childId ? '' : dim}`} disabled={!online} value={childId} aria-label={t('massServed')} onChange={e => change(service, slot, { class_id: classId || children.find(c => c.id === e.target.value)?.class_id || null, child_id: e.target.value || null })}>
          <option value="" disabled hidden>{t('pickChild')}</option>
          {classId
            ? children.filter(c => c.class_id === classId).map(c => option(c, !childId))
            : classes.map(cl => (
                <optgroup key={cl.id} label={cl.name}>
                  {children.filter(c => c.class_id === cl.id).map(c => option(c, !childId))}
                </optgroup>
              ))}
        </select>
        {childId && clear(t('massServed'), () => change(service, slot, { class_id: classId || null, child_id: null }))}
      </div>,
    ]
  }

  const slotLabel = (it: MassItem, slot: number) => (
    <>
      {it.label}
      {it.double && (
        <span className="ms-1 text-sm font-normal text-slate-500">
          ({slot}){it.slotLabels?.[slot - 1] ? ` ${it.slotLabels[slot - 1]}` : ''}
        </span>
      )}
    </>
  )

  // كروت: a card per group, a row per line (on a phone the service is the row's title)
  const line = (it: MassItem, slot: number) => {
    const service = it.key
    const [servant, child] = pickers(service, slot)
    return (
      <div key={keyOf(service, slot)} className="grid gap-2 border-t border-slate-100 p-3 first:border-t-0 dark:border-slate-800 sm:grid-cols-3 sm:items-center">
        {servant}
        {child}
        <span className="font-semibold max-sm:order-first">{slotLabel(it, slot)}</span>
      </div>
    )
  }

  // جدول: the sheet — it keeps this layout on a phone and scrolls sideways inside its own box
  const sheet = (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[760px] border-collapse text-start">
        <thead>
          <tr className="bg-slate-100 text-sm dark:bg-slate-800">
            <th className="w-[36%] border border-slate-200 px-3 py-2 text-start font-bold dark:border-slate-700">{t('massServant')}</th>
            <th className="w-[30%] border border-slate-200 px-3 py-2 text-start font-bold dark:border-slate-700">{t('massServed')}</th>
            <th className="border border-slate-200 px-3 py-2 text-start font-bold dark:border-slate-700">{t('massService')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.key}>
              <tr>
                <th colSpan={3} className="border border-slate-200 bg-indigo-50 px-3 py-2 text-start text-sm font-bold text-indigo-700 dark:border-slate-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {g.title}
                </th>
              </tr>
              {g.items.flatMap(it =>
                (it.double ? [1, 2] : [1]).map(slot => {
                  const [servant, child] = pickers(it.key, slot)
                  return (
                    <tr key={keyOf(it.key, slot)}>
                      <td className={`border border-slate-200 p-1.5 dark:border-slate-700 ${classColor(classes, rows[keyOf(it.key, slot)]?.class_id)?.fill ?? ''}`}>{servant}</td>
                      <td className="border border-slate-200 p-1.5 dark:border-slate-700">{child}</td>
                      <td className="border border-slate-200 px-3 py-1.5 font-semibold dark:border-slate-700">{slotLabel(it, slot)}</td>
                    </tr>
                  )
                }),
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )

  // the file is built only when asked for (exceljs is a big library)
  async function exportExcel() {
    setExporting(true)
    try {
      const { exportMass } = await import('../lib/exportMass')
      await exportMass({
        dateText: dmy(mass!.mass_date),
        groups,
        rows: rows ?? {},
        classes,
        children,
        labels: { servant: t('massServant'), served: t('massServed'), service: t('massService'), counts: t('massViewCounts'), childrenServing: t('massChildrenServing'), count: t('massCount') },
      })
    } catch (e) {
      toast((e as Error).message)
    }
    setExporting(false)
  }

  const toggle = (on: boolean) =>
    `min-w-0 truncate rounded-md px-3 py-1.5 text-center text-sm font-semibold sm:py-1 ${on ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <button onClick={() => go('/masses')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowBackIcon className="size-4" />
        {t('massList')}
      </button>
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {/* phone: the date, then the view bar full width, then export; wider screens: date and view bar on one row */}
      <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
        <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold sm:flex-1">
          <ChurchIcon className="size-6 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <MassDay iso={mass.mass_date} />
        </h2>
        <div role="group" aria-label={t('massView')} className="grid grid-cols-3 rounded-lg bg-slate-100 p-0.5 sm:flex dark:bg-slate-800">
          <button className={toggle(view === 'table')} aria-pressed={view === 'table'} onClick={() => setView('table')}>
            {t('massViewTable')}
          </button>
          <button className={toggle(view === 'cards')} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
            {t('massViewCards')}
          </button>
          <button className={toggle(view === 'counts')} aria-pressed={view === 'counts'} onClick={() => setView('counts')}>
            {t('massViewCounts')}
          </button>
        </div>
      </div>

      <div className="flex">
        <button onClick={exportExcel} disabled={exporting} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 sm:w-auto dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('massExport')}
        </button>
      </div>

      {view === 'counts' ? (
        <CountsTable rows={rows} />
      ) : view === 'table' ? (
        sheet
      ) : (
        <>
          {/* column titles, only where the rows are laid out as columns (not on a phone) */}
          <div className="hidden grid-cols-3 gap-2 px-3 text-sm font-bold text-slate-500 sm:grid">
            <span>{t('massServant')}</span>
            <span>{t('massServed')}</span>
            <span>{t('massService')}</span>
          </div>

          {groups.map(g => (
            <section key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <h3 className="bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{g.title}</h3>
              {g.items.flatMap(it => (it.double ? [1, 2] : [1]).map(slot => line(it, slot)))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}

/** A phone field with one number or more (split by a dash, slash or comma): each gets call and WhatsApp. */
function PhoneLinks({ phone }: { phone: string }) {
  const { t } = useI18n()
  const numbers = phone
    .split(/[-–/،,]/)
    .map(n => n.trim())
    .filter(n => n.replace(/\D/g, '').length >= 3)
  return (
    <span className="flex flex-wrap items-center gap-x-3">
      {numbers.map(n => (
        <span key={n} className="flex items-center">
          <span dir="ltr">{n}</span>
          <a href={telLink(n)} title={t('call')} aria-label={t('call')} className="grid size-7 place-items-center rounded-md text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10">
            <PhoneIcon className="size-4" />
          </a>
          <a href={whatsappLink(n)} target="_blank" rel="noreferrer" title="WhatsApp" className="grid size-7 place-items-center rounded-md text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10">
            <WhatsAppIcon className="size-4" />
          </a>
        </span>
      ))}
    </span>
  )
}

// ---- names --------------------------------------------------------------------

/** The servant classes and their children: add, edit, delete. */
export function MassNamesPage() {
  const { t } = useI18n()
  const { online } = useStore()
  const { classes, children, loaded, error } = useMass()
  const [editClass, setEditClass] = useState<string | 'new' | null>(null)
  // the classes folded shut, remembered on this device; a class not in the list (a new one) is open
  const [collapsed, setCollapsedState] = useState<string[]>(() => {
    try {
      const v = JSON.parse(load(COLLAPSED_KEY) ?? '[]')
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const setCollapsed = (ids: string[]) => {
    setCollapsedState(ids)
    save(COLLAPSED_KEY, JSON.stringify(ids))
  }
  const isOpen = (id: string) => !collapsed.includes(id)
  const anyOpen = classes.some(c => isOpen(c.id))

  useEffect(() => {
    loadMass()
  }, [])

  async function removeClass(id: string, name: string) {
    const count = children.filter(c => c.class_id === id).length
    const ok = await confirmDialog({ title: t('deleteMassClass'), message: t('deleteMassClassConfirm').replace('{name}', name).replace('{n}', String(count)), confirmLabel: t('deleteMassClass'), danger: true })
    if (!ok) return
    const err = await deleteClass(id)
    if (err) toast(err)
  }

  if (!loaded) return <Loading />

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <MassTabs active="names" />
      <NamesTabs active="names" />
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {editClass === 'new' ? (
        <ClassForm title={t('addMassClass')} initial="" onDone={() => setEditClass(null)} id={null} />
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setEditClass('new')}
            disabled={!online}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
          >
            <PlusIcon className="size-5" />
            {t('addMassClass')}
          </button>
          {classes.length > 0 && (
            <button
              onClick={() => setCollapsed(anyOpen ? classes.map(c => c.id) : [])}
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 px-4 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {anyOpen ? t('massCollapseAll') : t('massExpandAll')}
            </button>
          )}
        </div>
      )}

      {classes.map((c, i) =>
        editClass === c.id ? (
          <ClassForm key={c.id} title={t('editMassClass')} initial={c.name} id={c.id} onDone={() => setEditClass(null)} />
        ) : (
          <ClassCard key={c.id} num={i + 1} id={c.id} name={c.name} open={isOpen(c.id)} onToggle={() => setCollapsed(isOpen(c.id) ? [...collapsed, c.id] : collapsed.filter(x => x !== c.id))} onEdit={() => setEditClass(c.id)} onDelete={() => removeClass(c.id, c.name)} />
        ),
      )}
    </div>
  )
}

/** A text field that saves when you leave it (or press Enter), only if it changed. */
function EditText({ value, onSave, label, placeholder, allowEmpty = false, disabled }: { value: string; onSave: (v: string) => Promise<string | null>; label: string; placeholder?: string; allowEmpty?: boolean; disabled?: boolean }) {
  const { t } = useI18n()
  const [v, setV] = useState(value)
  const [busy, setBusy] = useState(false)
  // another value arrived (a save, or a reload)
  useEffect(() => setV(value), [value])

  async function commit() {
    const text = v.trim()
    if (text === value.trim()) return setV(value)
    if (!text && !allowEmpty) return setV(value)
    setBusy(true)
    const err = await onSave(text)
    setBusy(false)
    if (err) {
      setV(value)
      toast(err)
    } else toast(t('massSaved'))
  }

  return (
    <input
      className={input}
      value={v}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled || busy}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

/** الخدمات: rename the group titles, the services and the lines of two-line services, or put them in another order (nothing is added or removed). */
export function MassServicesPage() {
  const { t } = useI18n()
  const { online } = useStore()
  const { groups, servicesReady, loaded, error } = useMass()
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    loadMass()
  }, [])

  if (!loaded) return <Loading />
  const off = !online || !servicesReady

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <MassTabs active="services" />
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}
      {!servicesReady && !error && online && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{t('massServicesMissing')}</p>}

      {reordering ? (
        <ServicesReorder onClose={() => setReordering(false)} />
      ) : (
        <>
          {/* totals from the list as it is now: services, and lines to fill (a two-line service counts twice) */}
          <p className="rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            {t('massTotalServices')}: <span dir="ltr">{groups.reduce((n, g) => n + g.items.length, 0)}</span> · {t('massTotalLines')}:{' '}
            <span dir="ltr">{groups.reduce((n, g) => n + g.items.reduce((m, it) => m + (it.double ? 2 : 1), 0), 0)}</span>
          </p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm text-slate-500">{t('massServicesHelp')}</p>
            <button onClick={() => setReordering(true)} disabled={off} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {t('massReorder')}
            </button>
          </div>

          {groups.map((g, gi) => (
            <section key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-1 bg-indigo-50 p-2 dark:bg-indigo-500/10">
                <Num n={gi + 1} />
                <EditText value={g.title} label={g.title} disabled={off} onSave={v => renameGroup(g.key, v)} />
                {/* how many services in the group, and (when a two-line one makes it more) how many lines */}
                <span dir="ltr" title={t('massTotalServices')} className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-500/30">
                  {g.items.length}
                  {g.items.some(it => it.double) && ` / ${g.items.reduce((m, it) => m + (it.double ? 2 : 1), 0)}`}
                </span>
              </div>
              {g.items.map((it, ii) => (
                <div key={it.key} className="space-y-2 border-t border-slate-100 p-2 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    <Num n={ii + 1} />
                    <EditText value={it.label} label={it.label} disabled={off} onSave={v => renameService(it.key, v, it.slotLabels ?? ['', ''])} />
                  </div>
                  {it.double &&
                    [1, 2].map(n => (
                      <div key={n} className="flex items-center gap-1 ps-8">
                        <span dir="ltr" className="w-7 shrink-0 text-center text-sm text-slate-400">
                          ({n})
                        </span>
                        <EditText
                          value={it.slotLabels?.[n - 1] ?? ''}
                          allowEmpty
                          label={t('massSlotLabel').replace('{n}', String(n))}
                          placeholder={t('massSlotLabel').replace('{n}', String(n))}
                          disabled={off}
                          onSave={v => {
                            const labels = [it.slotLabels?.[0] ?? '', it.slotLabels?.[1] ?? '']
                            labels[n - 1] = v
                            return renameService(it.key, it.label, labels)
                          }}
                        />
                      </div>
                    ))}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}

/** Drag the groups, and the services inside a group; «حفظ» saves the order, «إلغاء» drops it. */
function ServicesReorder({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { groups } = useMass()
  const [order, setOrder] = useState(() => groups.map(g => ({ id: g.key })))
  const [items, setItems] = useState(() => Object.fromEntries(groups.map(g => [g.key, g.items.map(i => ({ id: i.key }))])))
  const [busy, setBusy] = useState(false)

  const same = (a: { id: string }[], b: string[]) => a.every((x, i) => x.id === b[i])
  const changed = !same(order, groups.map(g => g.key)) || groups.some(g => !same(items[g.key], g.items.map(i => i.key)))

  async function save() {
    if (!changed) return onClose()
    setBusy(true)
    const err = await saveServiceOrder(order.map(o => o.id), Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.map(i => i.id)])))
    setBusy(false)
    if (err) return toast(err)
    toast(t('massSaved'))
    onClose()
  }

  const grip = 'touch-manipulation select-none [-webkit-touch-callout:none]'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <button onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
        <button onClick={save} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
      </div>

      <SortableList
        items={order}
        onChange={setOrder}
        className="space-y-3"
        renderItem={(o, gi, handle, dragging) => {
          const g = groups.find(x => x.key === o.id)!
          return (
            <section className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${dragging ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
              {/* the group is dragged by its title bar; its services by their own rows */}
              <div {...handle} aria-label={`${t('dragToReorder')}: ${g.title}`} className={`${grip} flex cursor-grab items-center gap-3 bg-indigo-50 px-3 py-2.5 dark:bg-indigo-500/10`}>
                <GripIcon className="size-4 shrink-0 text-slate-400" />
                <span className="w-6 shrink-0 text-center text-sm text-slate-400">{gi + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-indigo-700 dark:text-indigo-300">{g.title}</span>
              </div>
              <div className="p-2">
                <SortableList
                  items={items[g.key]}
                  onChange={v => setItems(prev => ({ ...prev, [g.key]: v }))}
                  renderItem={(it, ii, h, drag) => {
                    const item = g.items.find(x => x.key === it.id)!
                    return (
                      <div {...h} aria-label={`${t('dragToReorder')}: ${item.label}`} className={`${grip} flex cursor-grab items-center gap-3 rounded-lg border bg-white px-3 py-2 dark:bg-slate-900 ${drag ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
                        <GripIcon className="size-4 shrink-0 text-slate-400" />
                        <span className="w-6 shrink-0 text-center text-sm text-slate-400">{ii + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
                      </div>
                    )
                  }}
                />
              </div>
            </section>
          )
        }}
      />
    </div>
  )
}

/** الخدام: only the classes, as a plain list. */
export function MassServantsPage() {
  const { t } = useI18n()
  const { online } = useStore()
  const { classes, children, loaded, error } = useMass()
  const [edit, setEdit] = useState<string | 'new' | null>(null)
  const [picking, setPicking] = useState<string | null>(null) // the class whose colour is being picked

  useEffect(() => {
    loadMass()
  }, [])

  async function remove(id: string, name: string) {
    const count = children.filter(c => c.class_id === id).length
    const ok = await confirmDialog({ title: t('deleteMassClass'), message: t('deleteMassClassConfirm').replace('{name}', name).replace('{n}', String(count)), confirmLabel: t('deleteMassClass'), danger: true })
    if (!ok) return
    const err = await deleteClass(id)
    if (err) toast(err)
  }

  if (!loaded) return <Loading />

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <MassTabs active="names" />
      <NamesTabs active="servants" />
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {edit === 'new' ? (
        <ClassForm title={t('addMassClass')} initial="" onDone={() => setEdit(null)} id={null} />
      ) : (
        <button
          onClick={() => setEdit('new')}
          disabled={!online}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon className="size-5" />
          {t('addMassClass')}
        </button>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {classes.map((c, i) =>
          edit === c.id ? (
            <ClassForm key={c.id} title={t('editMassClass')} initial={c.name} id={c.id} onDone={() => setEdit(null)} />
          ) : (
            <Fragment key={c.id}>
            <div className="flex items-center gap-1 border-t border-slate-100 ps-1 pe-1 first:border-t-0 dark:border-slate-800">
              <Num n={i + 1} />
              <div className="min-w-0 flex-1 py-2">
                <div className="flex items-center gap-2 font-semibold">
                  <ClassDot id={c.id} onClick={() => setPicking(p => (p === c.id ? null : c.id))} />
                  <span className="min-w-0">
                    {c.name} <span dir="ltr">({children.filter(x => x.class_id === c.id).length})</span>
                  </span>
                </div>
              </div>
              <button onClick={() => setEdit(c.id)} disabled={!online} title={t('editMassClass')} aria-label={t('editMassClass')} className={`${iconBtn} text-slate-500`}>
                <PencilIcon />
              </button>
              <button onClick={() => remove(c.id, c.name)} disabled={!online} title={t('deleteMassClass')} aria-label={t('deleteMassClass')} className={`${iconBtn} text-red-500`}>
                <TrashIcon />
              </button>
            </div>
            {picking === c.id && <ColorRow id={c.id} onDone={() => setPicking(null)} />}
            </Fragment>
          ),
        )}
      </section>
    </div>
  )
}

/** الأولاد: every child in one list, with their class; search by name; add / edit with a class picker. */
export function MassChildrenPage() {
  const { t } = useI18n()
  const { online } = useStore()
  const { classes, children, loaded, error } = useMass()
  const [edit, setEdit] = useState<string | 'new' | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    loadMass()
  }, [])

  async function remove(id: string, name: string) {
    const ok = await confirmDialog({ title: t('deleteMassChild'), message: t('deleteMassChildConfirm').replace('{name}', name), confirmLabel: t('deleteMassChild'), danger: true })
    if (!ok) return
    const err = await deleteChild(id)
    if (err) toast(err)
  }

  if (!loaded) return <Loading />

  const className = (id: string) => classes.find(c => c.id === id)?.name ?? ''
  const query = q.trim()
  const shown = children.filter(c => !query || c.name.includes(query))

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <MassTabs active="names" />
      <NamesTabs active="children" />
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {edit === 'new' ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ChildForm classId="" child={null} classes={classes} onDone={() => setEdit(null)} />
        </section>
      ) : (
        <button
          onClick={() => setEdit('new')}
          disabled={!online}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon className="size-5" />
          {t('addMassChild')}
        </button>
      )}

      <input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchName')} aria-label={t('searchName')} />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {shown.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{t('noMassChildren')}</p>}
        {shown.map((c, i) =>
          edit === c.id ? (
            <ChildForm key={c.id} classId={c.class_id} child={c} classes={classes} onDone={() => setEdit(null)} />
          ) : (
            <div key={c.id} className="flex items-center gap-1 border-t border-slate-100 ps-1 pe-1 first:border-t-0 dark:border-slate-800">
              <Num n={i + 1} />
              <div className="min-w-0 flex-1 py-2">
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-indigo-700 dark:text-indigo-300">{className(c.class_id)}</div>
                {(c.phone || c.note) && (
                  <div className="flex flex-wrap gap-x-3 text-sm text-slate-500">
                    {c.phone && <PhoneLinks phone={c.phone} />}
                    {c.note && <span>{c.note}</span>}
                  </div>
                )}
              </div>
              <button onClick={() => setEdit(c.id)} disabled={!online} title={t('edit')} aria-label={t('edit')} className={`${iconBtn} text-slate-500`}>
                <PencilIcon />
              </button>
              <button onClick={() => remove(c.id, c.name)} disabled={!online} title={t('deleteMassChild')} aria-label={t('deleteMassChild')} className={`${iconBtn} text-red-500`}>
                <TrashIcon />
              </button>
            </div>
          ),
        )}
      </section>
    </div>
  )
}

function ClassForm({ id, title, initial, onDone }: { id: string | null; title: string; initial: string; onDone: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const err = await saveClass(id, name)
    setBusy(false)
    if (err) return setError(err.includes('duplicate') ? t('massClassDuplicate') : err)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold">{title}</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t('massClassName')}</span>
        <input required className={input} placeholder={t('phMassClass')} value={name} onChange={e => setName(e.target.value)} disabled={busy} autoFocus />
      </label>
      {error && <p className={errorBox}>{error}</p>}
      <div className="flex gap-2">
        <button disabled={!online || busy || !name.trim() || name.trim() === initial} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
        <button type="button" onClick={onDone} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

function ClassCard({ num, id, name, open, onToggle, onEdit, onDelete }: { num: number; id: string; name: string; open: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const { children } = useMass()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [picking, setPicking] = useState(false)
  const mine = children.filter(c => c.class_id === id)

  async function remove(childId: string, childName: string) {
    const ok = await confirmDialog({ title: t('deleteMassChild'), message: t('deleteMassChildConfirm').replace('{name}', childName), confirmLabel: t('deleteMassChild'), danger: true })
    if (!ok) return
    const err = await deleteChild(childId)
    if (err) toast(err)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* a tap on the header (not on its buttons) folds the class shut or open */}
      <div
        onClick={e => !(e.target as HTMLElement).closest('button') && onToggle()}
        className="flex cursor-pointer items-center gap-1 bg-indigo-50 ps-1 pe-1 dark:bg-indigo-500/10"
      >
        <button type="button" onClick={onToggle} aria-expanded={open} title={t(open ? 'massCollapse' : 'massExpand')} aria-label={t(open ? 'massCollapse' : 'massExpand')} className={`${iconBtn} size-8 text-slate-500`}>
          <ChevronDownIcon className={`size-4 transition-transform ${open ? '' : 'ltr:-rotate-90 rtl:rotate-90'}`} />
        </button>
        <Num n={num} />
        <h3 className="flex min-w-0 flex-1 items-center gap-2 py-2 font-bold text-indigo-700 dark:text-indigo-300">
          <ClassDot id={id} onClick={() => setPicking(p => !p)} />
          {/* the number of children, which is what stays visible when it is folded */}
          <span className="min-w-0">
            {name} <span dir="ltr">({mine.length})</span>
          </span>
        </h3>
        <button onClick={onEdit} disabled={!online} title={t('editMassClass')} aria-label={t('editMassClass')} className={`${iconBtn} text-slate-500`}>
          <PencilIcon />
        </button>
        <button onClick={onDelete} disabled={!online} title={t('deleteMassClass')} aria-label={t('deleteMassClass')} className={`${iconBtn} text-red-500`}>
          <TrashIcon />
        </button>
      </div>
      {picking && <ColorRow id={id} onDone={() => setPicking(false)} />}

      {open && mine.map((c, i) =>
        editing === c.id ? (
          <ChildForm key={c.id} classId={id} child={c} onDone={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="flex items-center gap-1 border-t border-slate-100 ps-1 pe-1 dark:border-slate-800">
            <Num n={i + 1} />
            <div className="min-w-0 flex-1 py-2">
              <div className="font-semibold">{c.name}</div>
              {(c.phone || c.note) && (
                <div className="flex flex-wrap gap-x-3 text-sm text-slate-500">
                  {c.phone && <PhoneLinks phone={c.phone} />}
                  {c.note && <span>{c.note}</span>}
                </div>
              )}
            </div>
            <button onClick={() => setEditing(c.id)} disabled={!online} title={t('edit')} aria-label={t('edit')} className={`${iconBtn} text-slate-500`}>
              <PencilIcon />
            </button>
            <button onClick={() => remove(c.id, c.name)} disabled={!online} title={t('deleteMassChild')} aria-label={t('deleteMassChild')} className={`${iconBtn} text-red-500`}>
              <TrashIcon />
            </button>
          </div>
        ),
      )}

      {!open ? null : editing === 'new' ? (
        <ChildForm classId={id} child={null} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} disabled={!online} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
          <PlusIcon className="size-4" />
          {t('addMassChild')}
        </button>
      )}
    </section>
  )
}

/** `classes`: given → the form lets you pick the class (the flat children list); otherwise the child stays in `classId`. */
function ChildForm({ classId: initialClass, child, classes, onDone }: { classId: string; child: { id: string; name: string; phone: string | null; note: string | null } | null; classes?: MassClass[]; onDone: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const [classId, setClassId] = useState(initialClass)
  const [d, setD] = useState({ name: child?.name ?? '', phone: child?.phone ?? '', note: child?.note ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = !child || classId !== initialClass || d.name !== child.name || d.phone !== (child.phone ?? '') || d.note !== (child.note ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const err = await saveChild(child?.id ?? null, classId, { name: d.name, phone: d.phone, note: d.note })
    setBusy(false)
    if (err) return setError(err)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
      {classes && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('massServant')}</span>
          <select required className={input} value={classId} onChange={e => setClassId(e.target.value)} disabled={busy}>
            <option value="" disabled hidden>{t('pickServant')}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('name')}</span>
          <input required className={input} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} disabled={busy} autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('massPhone')}</span>
          {/* text, not type=tel / number: keeps the leading 0 and allows two numbers */}
          <input dir="ltr" inputMode="tel" className={input} value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} disabled={busy} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('notes')}</span>
          <input className={input} value={d.note} onChange={e => setD({ ...d, note: e.target.value })} disabled={busy} />
        </label>
      </div>
      {error && <p className={errorBox}>{error}</p>}
      <div className="flex gap-2">
        <button disabled={!online || busy || !d.name.trim() || !classId || !changed} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
        <button type="button" onClick={onDone} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
