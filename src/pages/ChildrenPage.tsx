import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, type Child } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { RefreshIcon } from '../components/Icons'

// Values of the "ي/ش/وسط" column in the Excel sheet.
const SIDE: Record<string, { ar: string; en: string }> = {
  'ي': { ar: 'يمين', en: 'right' },
  'ش': { ar: 'شمال', en: 'left' },
  'وسط': { ar: 'وسط', en: 'middle' },
}

export function ChildrenPage() {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function fetchRows() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('children').select('*').order('full_name')
    if (error) setError(error.message)
    else setRows(data as Child[])
    setLoading(false)
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.full_name, r.street, r.mother_mobile, r.father_mobile, r.child_mobile, r.national_id].some(v =>
        v?.toLowerCase().includes(q),
      ),
    )
  }, [rows, query])

  function address(r: Child) {
    const side = r.side ? (SIDE[r.side.trim()]?.[lang] ?? r.side) : null
    return [
      r.house_number && `${t('house')} ${r.house_number}`,
      r.street,
      r.branch_of_street && `${t('branchOf')} ${r.branch_of_street}`,
      r.floor && `${t('floor')} ${r.floor}`,
      side,
      r.apartment && `${t('apartment')} ${r.apartment}`,
    ]
      .filter(Boolean)
      .join(lang === 'ar' ? '، ' : ', ')
  }

  const columns: { key: TKey; render: (r: Child) => ReactNode; ltr?: boolean }[] = [
    { key: 'name', render: r => <span className="font-semibold">{r.full_name}</span> },
    { key: 'address', render: address },
    { key: 'landmark', render: r => r.landmark },
    { key: 'birthDate', render: r => r.birth_date, ltr: true },
    { key: 'motherMobile', render: r => r.mother_mobile, ltr: true },
    { key: 'fatherMobile', render: r => r.father_mobile, ltr: true },
    { key: 'childMobile', render: r => r.child_mobile, ltr: true },
    { key: 'deacon', render: r => r.deacon },
    { key: 'notes', render: r => r.notes },
    { key: 'nationalId', render: r => r.national_id, ltr: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:max-w-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder={t('search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {t('total')}: {filtered.length}
        </span>
        <button
          onClick={fetchRows}
          className="ms-auto flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <RefreshIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3 text-start font-semibold">#</th>
              {columns.map(c => (
                <th key={c.key} className="whitespace-nowrap px-3 py-3 text-start font-semibold">
                  {t(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-slate-500">
                  {rows.length ? t('noResults') : t('empty')}
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  {columns.map(c => (
                    <td key={c.key} className={`px-3 py-2 ${c.ltr ? 'whitespace-nowrap' : 'min-w-32'}`}>
                      {c.render(r) ? (
                        c.ltr ? <span dir="ltr">{c.render(r)}</span> : c.render(r)
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
