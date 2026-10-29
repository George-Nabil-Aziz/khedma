import { useMemo, useState, type ReactNode } from 'react'
import { OWNERS, type Address, type CustomField, type OtherAddress, type Owner } from './supabase'
import { useI18n, type TKey } from './i18n'
import { load, save } from './storage'
import { classFields, useStore, type ViewRow } from './store'
import { OWNER_LABEL, OWNER_PHONES_LABEL, telLink, whatsappLink } from './phones'
import { formatNationalId } from './nationalId'
import { NO, YES, parseDeacon } from './deacon'
import { StarIcon, WhatsAppIcon } from '../components/Icons'

export type SortValue = string | number | null

export type Column = {
  id: string
  label: string
  render: (r: ViewRow) => ReactNode
  sort: (r: ViewRow) => SortValue
  ltr?: boolean
  nowrap?: boolean
}

// Values of the "ي/ش/وسط" column in the Excel sheet.
export const SIDES = [
  { value: 'ي', key: 'right' },
  { value: 'ش', key: 'left' },
  { value: 'وسط', key: 'middle' },
] as const satisfies readonly { value: string; key: TKey }[]

/** An address on one line: "بيت 5، شارع النصر، متفرع من ...، الدور 3، يمين، شقة 7". */
export function formatAddress(a: Address, t: (k: TKey) => string, lang: string): string {
  const sideKey = SIDES.find(s => s.value === a.side?.trim())?.key
  return [
    a.house_number && `${t('house')} ${a.house_number}`,
    a.street,
    a.branch_of_street && `${t('branchOf')} ${a.branch_of_street}`,
    a.floor && `${t('floor')} ${a.floor}`,
    sideKey ? t(sideKey) : a.side,
    a.apartment && `${t('apartment')} ${a.apartment}`,
  ]
    .filter(Boolean)
    .join(lang === 'ar' ? '، ' : ', ')
}

/** The other home on one line, with whose home it is first: "بيت الجد: شارع النصر، ...". */
export function otherAddressText(a: OtherAddress, t: (k: TKey) => string, lang: string): string {
  const where = formatAddress(a, t, lang)
  return a.label?.trim() ? `${a.label.trim()}${where ? ': ' + where : ''}` : where
}

/** الحالة of a child, as stored in the `category` column, with its colours. */
export const CATEGORIES = [
  { value: 'normal', key: 'catNormal', tone: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200' },
  { value: 'hidden', key: 'catHidden', tone: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300' },
  { value: 'brothers', key: 'catBrothers', tone: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300' },
] as const satisfies readonly { value: string; key: TKey; tone: string }[]

export function ageOf(birthDate: string | null): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

/** Every column except the name, which is always shown first. */
export function useColumns(): Column[] {
  const { t, lang } = useI18n()
  const store = useStore()
  const fields = useMemo(() => classFields(store), [store])

  return useMemo(() => {
    const sep = lang === 'ar' ? '، ' : ', '

    // the usual address only — a second home shows on the child's own page
    const address = (r: ViewRow) => formatAddress(r, t, lang)

    const phoneColumn = (owner: Owner): Column => ({
      id: `phones_${owner}`,
      label: t(OWNER_PHONES_LABEL[owner]),
      nowrap: true,
      sort: r => r.phones.find(p => p.owner === owner)?.number ?? null,
      render: r => {
        const list = r.phones.filter(p => p.owner === owner)
        if (!list.length) return null
        return (
          <div className="space-y-1">
            {list.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {r.primary_contacts.includes(owner) && i === 0 && (
                  <span title={t('primaryContact')} className="text-amber-500">
                    <StarIcon className="size-3.5" />
                  </span>
                )}
                <a dir="ltr" href={telLink(p.number)} className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-300">
                  {p.number}
                </a>
                {p.whatsapp && (
                  <a href={whatsappLink(p.number)} target="_blank" rel="noreferrer" title="WhatsApp" className="text-emerald-500 hover:text-emerald-600">
                    <WhatsAppIcon className="size-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )
      },
    })

    const builtIn: Column[] = [
      { id: 'address', label: t('address'), render: address, sort: r => address(r) || null },
      { id: 'landmark', label: t('landmark'), render: r => r.landmark, sort: r => r.landmark },
      { id: 'birth_date', label: t('birthDate'), render: r => r.birth_date && <span dir="ltr">{r.birth_date}</span>, sort: r => r.birth_date, nowrap: true },
      {
        id: 'age',
        label: t('age'),
        render: r => ageOf(r.birth_date),
        // newest birth date = youngest, so sort on age itself
        sort: r => ageOf(r.birth_date),
        nowrap: true,
      },
      ...OWNERS.map(phoneColumn),
      {
        id: 'primary_contacts',
        label: t('primaryContact'),
        render: r => r.primary_contacts.map(o => t(OWNER_LABEL[o])).join(sep),
        sort: r => r.primary_contacts.map(o => t(OWNER_LABEL[o])).join(sep) || null,
        nowrap: true,
      },
      {
        id: 'category',
        label: t('category'),
        nowrap: true,
        render: r => {
          const c = CATEGORIES.find(x => x.value === r.category)
          return c && <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c.tone}`}>{t(c.key)}</span>
        },
        sort: r => {
          const i = CATEGORIES.findIndex(x => x.value === r.category)
          return i < 0 ? null : i
        },
      },
      {
        id: 'deacon',
        label: t('deacon'),
        render: r => {
          const d = parseDeacon(r.deacon)
          if (d.is === null) return null
          return (
            <span className="inline-flex items-center gap-1.5">
              <span title={t(d.is ? 'yes' : 'no')}>{d.is ? YES : NO}</span>
              {d.note.trim()}
            </span>
          )
        },
        // yes first, then no; by the note within each
        sort: r => {
          const d = parseDeacon(r.deacon)
          return d.is === null ? null : `${d.is ? 0 : 1}${d.note.trim()}`
        },
      },
      { id: 'notes', label: t('notes'), render: r => r.notes, sort: r => r.notes },
      { id: 'national_id', label: t('nationalId'), render: r => r.national_id && <span dir="ltr">{formatNationalId(r.national_id)}</span>, sort: r => r.national_id, nowrap: true },
    ]

    return [...builtIn, ...fields.map(f => customColumn(f, t))]
  }, [t, lang, fields])
}

function customColumn(f: CustomField, t: (k: TKey) => string): Column {
  const id = `x:${f.key}`
  const get = (r: ViewRow) => r.extra?.[f.key] ?? null
  switch (f.type) {
    case 'boolean':
      return { id, label: f.label, nowrap: true, render: r => (get(r) == null ? null : get(r) ? t('yes') : t('no')), sort: r => (get(r) == null ? null : get(r) ? 1 : 0) }
    case 'number':
      return { id, label: f.label, nowrap: true, render: r => get(r) as ReactNode, sort: r => (get(r) == null || get(r) === '' ? null : Number(get(r))) }
    case 'date':
      return { id, label: f.label, nowrap: true, render: r => get(r) != null && <span dir="ltr">{String(get(r))}</span>, sort: r => (get(r) as string) ?? null }
    default:
      return { id, label: f.label, render: r => get(r) as ReactNode, sort: r => (get(r) as string) || null }
  }
}

// ---- per-device preferences --------------------------------------------------

type Prefs = { order: string[]; hidden: string[] }

const DEFAULT_HIDDEN = ['age', 'primary_contacts']

function readPrefs(): Prefs | null {
  try {
    const p = JSON.parse(load('columns') ?? 'null')
    return p && Array.isArray(p.order) && Array.isArray(p.hidden) ? p : null
  } catch {
    return null
  }
}

/** Column order + visibility, saved on this device. New custom columns appear at the end, visible. */
export function useColumnPrefs(all: Column[]) {
  const [prefs, setPrefs] = useState<Prefs | null>(readPrefs)

  const ordered = useMemo(() => {
    const byId = new Map(all.map(c => [c.id, c]))
    const order = (prefs?.order ?? []).filter(id => byId.has(id))
    for (const c of all) if (!order.includes(c.id)) order.push(c.id)
    const hidden = new Set(prefs?.hidden ?? DEFAULT_HIDDEN)
    return order.map(id => ({ column: byId.get(id)!, visible: !hidden.has(id) }))
  }, [all, prefs])

  function update(next: Prefs | null) {
    setPrefs(next)
    if (next) save('columns', JSON.stringify(next))
    else save('columns', '')
  }

  const current = (): Prefs => ({ order: ordered.map(o => o.column.id), hidden: ordered.filter(o => !o.visible).map(o => o.column.id) })

  return {
    ordered,
    visible: ordered.filter(o => o.visible).map(o => o.column),
    isDefault: prefs === null,
    toggle(id: string) {
      const p = current()
      update({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter(h => h !== id) : [...p.hidden, id] })
    },
    /** Drop column `id` where `overId` is (drag and drop). */
    reorder(id: string, overId: string) {
      const p = current()
      const from = p.order.indexOf(id)
      const to = p.order.indexOf(overId)
      if (from < 0 || to < 0 || from === to) return
      const [moved] = p.order.splice(from, 1)
      p.order.splice(to, 0, moved)
      update(p)
    },
    reset: () => update(null),
  }
}

// ---- sorting -------------------------------------------------------------------

export type Sort = { id: string; dir: 'asc' | 'desc' }

export function useSort() {
  const [sort, setSort] = useState<Sort>(() => {
    try {
      const s = JSON.parse(load('sort') ?? 'null')
      if (s && typeof s.id === 'string' && (s.dir === 'asc' || s.dir === 'desc')) return s
    } catch {
      /* ignore */
    }
    return { id: 'name', dir: 'asc' }
  })

  /** First click sorts ascending, the next click on the same column flips it. */
  function toggle(id: string) {
    const next: Sort = sort.id === id ? { id, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'asc' }
    setSort(next)
    save('sort', JSON.stringify(next))
  }

  return { sort, toggle }
}

/** The order the children page shows — الافتقاد uses the same one. */
export function sortRows(rows: ViewRow[], columns: Column[], sort: Sort, lang: string) {
  const col = columns.find(c => c.id === sort.id)
  const key = col ? col.sort : (r: ViewRow) => r.full_name
  return [...rows].sort((a, b) => compare(key(a), key(b), sort.dir, lang) || a.full_name.localeCompare(b.full_name, lang))
}

/** Empty values always go last, whichever direction. */
export function compare(a: SortValue, b: SortValue, dir: 'asc' | 'desc', lang: string) {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1
  if (b == null || b === '') return -1
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), lang, { numeric: true })
  return dir === 'asc' ? r : -r
}
