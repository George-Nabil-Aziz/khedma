import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { useStore } from '../lib/store'
import { dmy } from '../lib/serviceYear'
import {
  MASS_GROUPS,
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
} from '../lib/mass'
import { openPicker } from '../lib/picker'
import { telLink, whatsappLink } from '../lib/phones'
import { Loading } from '../components/Loading'
import { toast } from '../components/Toast'
import { confirmDialog } from '../components/ConfirmDialog'
import { ArrowBackIcon, ChurchIcon, CloudOffIcon, PencilIcon, PhoneIcon, PlusIcon, TrashIcon, WhatsAppIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'
const errorBox = 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300'
const iconBtn = 'grid size-9 place-items-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800'

/** "4-12-2026 · 25 هاتور" */
const massDay = (iso: string) => `${dmy(iso)} · ${copticDate(iso)}`

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

/** The tabs of القداس: the masses, the names to pick from, and sharing. */
export function MassTabs({ active }: { active: 'masses' | 'names' | 'share' }) {
  const { t } = useI18n()
  const tab = (on: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${
      on ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`
  return (
    <nav className="flex gap-2">
      <button className={tab(active === 'masses')} onClick={() => go('/masses')}>
        {t('massList')}
      </button>
      <button className={tab(active === 'names')} onClick={() => go('/mass-names')}>
        {t('massNames')}
      </button>
      <button className={tab(active === 'share')} onClick={() => go('/mass-share')}>
        {t('share')}
      </button>
    </nav>
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
          {date && <p className="text-sm text-slate-500">{massDay(date)}</p>}
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
              <span className="min-w-0 flex-1 truncate text-lg font-bold">{massDay(m.mass_date)}</span>
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

/** The schedule of one mass: per service, a class of servants and one of its children. */
export function MassPage({ id }: { id: string }) {
  const { t } = useI18n()
  const { online } = useStore()
  const { masses, classes, children, loaded } = useMass()
  const [rows, setRows] = useState<Record<string, MassAssignment> | null>(null)
  const [error, setError] = useState('')

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

  const line = (service: string, label: string, slot: number, double: boolean) => {
    const a = rows[keyOf(service, slot)]
    const classId = a?.class_id ?? ''
    const pickable = children.filter(c => c.class_id === classId)
    const select = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'
    return (
      <div key={keyOf(service, slot)} className="grid gap-2 border-t border-slate-100 p-3 first:border-t-0 dark:border-slate-800 sm:grid-cols-3 sm:items-center">
        {/* الخادم | المخدوم | الخدمة — on a phone the service comes first, as the card's title */}
        <select className={select} disabled={!online} value={classId} aria-label={t('massServant')} onChange={e => change(service, slot, { class_id: e.target.value || null, child_id: null })}>
          <option value="">{t('pickServant')}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={select} disabled={!online || !classId} value={a?.child_id ?? ''} aria-label={t('massServed')} onChange={e => change(service, slot, { class_id: classId || null, child_id: e.target.value || null })}>
          <option value="">{t('pickChild')}</option>
          {pickable.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="font-semibold max-sm:order-first">
          {label}
          {double && <span className="ms-1 text-sm font-normal text-slate-500">({slot})</span>}
        </span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <button onClick={() => go('/masses')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowBackIcon className="size-4" />
        {t('massList')}
      </button>
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      <h2 className="flex items-center gap-2 text-xl font-bold">
        <ChurchIcon className="size-6 shrink-0 text-indigo-600 dark:text-indigo-300" />
        {massDay(mass.mass_date)}
      </h2>

      {/* column titles, only where the rows are laid out as a table (not on a phone) */}
      <div className="hidden grid-cols-3 gap-2 px-3 text-sm font-bold text-slate-500 sm:grid">
        <span>{t('massServant')}</span>
        <span>{t('massServed')}</span>
        <span>{t('massService')}</span>
      </div>

      {MASS_GROUPS.map(g => (
        <section key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <h3 className="bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{g.title}</h3>
          {g.items.flatMap(it => (it.double ? [1, 2] : [1]).map(slot => line(it.key, it.label, slot, !!it.double)))}
        </section>
      ))}
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
      <OfflineNote />
      {error && <p className={errorBox}>{error}</p>}

      {editClass === 'new' ? (
        <ClassForm title={t('addMassClass')} initial="" onDone={() => setEditClass(null)} id={null} />
      ) : (
        <button
          onClick={() => setEditClass('new')}
          disabled={!online}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon className="size-5" />
          {t('addMassClass')}
        </button>
      )}

      {classes.map(c =>
        editClass === c.id ? (
          <ClassForm key={c.id} title={t('editMassClass')} initial={c.name} id={c.id} onDone={() => setEditClass(null)} />
        ) : (
          <ClassCard key={c.id} id={c.id} name={c.name} onEdit={() => setEditClass(c.id)} onDelete={() => removeClass(c.id, c.name)} />
        ),
      )}
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

function ClassCard({ id, name, onEdit, onDelete }: { id: string; name: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const { children } = useMass()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const mine = children.filter(c => c.class_id === id)

  async function remove(childId: string, childName: string) {
    const ok = await confirmDialog({ title: t('deleteMassChild'), message: t('deleteMassChildConfirm').replace('{name}', childName), confirmLabel: t('deleteMassChild'), danger: true })
    if (!ok) return
    const err = await deleteChild(childId)
    if (err) toast(err)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1 bg-indigo-50 ps-3 pe-1 dark:bg-indigo-500/10">
        <h3 className="min-w-0 flex-1 py-2 font-bold text-indigo-700 dark:text-indigo-300">{name}</h3>
        <button onClick={onEdit} disabled={!online} title={t('editMassClass')} aria-label={t('editMassClass')} className={`${iconBtn} text-slate-500`}>
          <PencilIcon />
        </button>
        <button onClick={onDelete} disabled={!online} title={t('deleteMassClass')} aria-label={t('deleteMassClass')} className={`${iconBtn} text-red-500`}>
          <TrashIcon />
        </button>
      </div>

      {mine.map(c =>
        editing === c.id ? (
          <ChildForm key={c.id} classId={id} child={c} onDone={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="flex items-center gap-1 border-t border-slate-100 ps-3 pe-1 dark:border-slate-800">
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

      {editing === 'new' ? (
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

function ChildForm({ classId, child, onDone }: { classId: string; child: { id: string; name: string; phone: string | null; note: string | null } | null; onDone: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const [d, setD] = useState({ name: child?.name ?? '', phone: child?.phone ?? '', note: child?.note ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = !child || d.name !== child.name || d.phone !== (child.phone ?? '') || d.note !== (child.note ?? '')

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
        <button disabled={!online || busy || !d.name.trim() || !changed} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
        <button type="button" onClick={onDone} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
