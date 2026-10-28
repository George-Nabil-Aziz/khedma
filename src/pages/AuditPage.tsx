import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Phone } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { useStore } from '../lib/store'
import { OWNER_LABEL } from '../lib/phones'
import { CloudOffIcon, SyncIcon } from '../components/Icons'

type Entry = {
  id: number
  at: string
  user_email: string | null
  action: 'insert' | 'update' | 'delete' | 'login' | 'logout'
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[] | null
}

const PAGE = 100

const FIELD_LABEL: Record<string, TKey> = {
  full_name: 'name',
  house_number: 'houseNumber',
  street: 'street',
  branch_of_street: 'branchOfStreet',
  landmark: 'landmark',
  floor: 'floorLabel',
  side: 'side',
  apartment: 'apartmentLabel',
  birth_date: 'birthDate',
  deacon: 'deacon',
  notes: 'notes',
  national_id: 'nationalId',
  phones: 'phones',
  primary_contact: 'primaryContact',
  present: 'attendance',
  label: 'fieldLabel',
  type: 'fieldType',
  mother_mobile: 'motherMobile',
  father_mobile: 'fatherMobile',
  child_mobile: 'childMobile',
}

const FILTERS = [
  { id: 'all', key: 'auditAll' },
  { id: 'children', key: 'children' },
  { id: 'attendance', key: 'attendance' },
  { id: 'custom_fields', key: 'customize' },
  { id: 'auth', key: 'auditLogins' },
] as const satisfies readonly { id: string; key: TKey }[]

export function AuditPage() {
  const { t, lang } = useI18n()
  const { online, rows, fields } = useStore()
  const [entries, setEntries] = useState<Entry[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(
    async (before?: number) => {
      setLoading(true)
      setError('')
      let q = supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(PAGE)
      if (before) q = q.lt('id', before)
      if (filter === 'auth') q = q.in('action', ['login', 'logout'])
      else if (filter !== 'all') q = q.eq('table_name', filter)
      const { data, error } = await q
      if (error) setError(error.message)
      else {
        setEntries(prev => (before ? [...prev, ...(data as Entry[])] : (data as Entry[])))
        setHasMore(data.length === PAGE)
      }
      setLoading(false)
    },
    [filter],
  )

  useEffect(() => {
    if (online) load()
  }, [online, load])

  const nameOf = useMemo(() => new Map(rows.map(r => [r.client_id, r.full_name])), [rows])
  const fieldLabel = (k: string) => (FIELD_LABEL[k] ? t(FIELD_LABEL[k]) : k)
  const customLabel = (k: string) => fields.find(f => f.key === k)?.label ?? k
  const dateFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  function show(k: string, v: unknown): string {
    if (v == null || v === '') return '—'
    if (k === 'phones') {
      const list = v as Phone[]
      return list.length ? list.map(p => `${t(OWNER_LABEL[p.owner])}: ${p.number}${p.whatsapp ? ' ✆' : ''}`).join(' · ') : '—'
    }
    if (k === 'primary_contact') return t(OWNER_LABEL[v as Phone['owner']])
    if (typeof v === 'boolean') return v ? '✓' : '✗'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  /** "What changed" lines; `extra` is split into the custom columns inside it. */
  function changes(e: Entry): { label: string; from: string; to: string }[] {
    if (e.action !== 'update' || !e.changed_fields) return []
    const out: { label: string; from: string; to: string }[] = []
    for (const k of e.changed_fields) {
      if (k === 'extra') {
        const a = (e.old_data?.extra ?? {}) as Record<string, unknown>
        const b = (e.new_data?.extra ?? {}) as Record<string, unknown>
        for (const x of new Set([...Object.keys(a), ...Object.keys(b)]))
          if (JSON.stringify(a[x] ?? null) !== JSON.stringify(b[x] ?? null)) out.push({ label: customLabel(x), from: show(x, a[x]), to: show(x, b[x]) })
      } else if (!['id', 'client_id', 'created_at'].includes(k)) {
        out.push({ label: fieldLabel(k), from: show(k, e.old_data?.[k]), to: show(k, e.new_data?.[k]) })
      }
    }
    return out
  }

  function target(e: Entry): string {
    const row = e.new_data ?? e.old_data
    if (e.table_name === 'children') return String(row?.full_name ?? nameOf.get(e.record_id ?? '') ?? '')
    if (e.table_name === 'attendance') {
      const child = String(row?.child_client_id ?? '')
      return `${nameOf.get(child) ?? child.slice(0, 8)} — ${row?.date}`
    }
    if (e.table_name === 'custom_fields') return String(row?.label ?? e.record_id ?? '')
    return ''
  }

  function verb(e: Entry): { text: string; tone: string } {
    if (e.action === 'login') return { text: t('auditLogin'), tone: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' }
    if (e.action === 'logout') return { text: t('auditLogout'), tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
    if (e.table_name === 'attendance') {
      const on = (e.new_data?.present ?? false) as boolean
      return on
        ? { text: t('auditTicked'), tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' }
        : { text: t('auditUnticked'), tone: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' }
    }
    if (e.action === 'insert') return { text: t('auditAdded'), tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' }
    if (e.action === 'delete') return { text: t('auditDeleted'), tone: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' }
    return { text: t('auditEdited'), tone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300' }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              filter === f.id ? 'bg-indigo-600 text-white' : 'border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {t(f.key)}
          </button>
        ))}
        <button
          onClick={() => load()}
          disabled={!online || loading}
          className="ms-auto flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <SyncIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('auditOnlineOnly')}
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <ol className="space-y-2">
        {entries.map(e => {
          const v = verb(e)
          const lines = changes(e)
          return (
            <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.tone}`}>{v.text}</span>
                <span className="font-semibold">{target(e)}</span>
                <span className="ms-auto text-xs text-slate-500" dir="ltr">
                  {e.user_email ?? t('auditDashboard')}
                </span>
                <span className="text-xs text-slate-400">{dateFmt.format(new Date(e.at))}</span>
              </div>
              {lines.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                  {lines.map((l, i) => (
                    <div key={i} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                      <span className="font-semibold text-slate-500">{l.label}</span>
                      <span>
                        <span className="text-red-600 line-through decoration-red-300 dark:text-red-400" dir="auto">
                          {l.from}
                        </span>
                        <span className="mx-2 text-slate-400">{lang === 'ar' ? '←' : '→'}</span>
                        <span className="text-emerald-700 dark:text-emerald-400" dir="auto">
                          {l.to}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {!loading && entries.length === 0 && online && !error && <p className="text-center text-sm text-slate-500">{t('auditEmpty')}</p>}
      {hasMore && (
        <button
          onClick={() => load(entries[entries.length - 1]?.id)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  )
}
