import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { isPresent, toggleAttendance, useStore, viewRows } from '../lib/store'
import { sortRows, useColumns, useSort } from '../lib/columns'

// The service year: every Friday from 6 Oct 2026 to 6 Oct 2027.
const FROM = '2026-10-06'
const TO = '2027-10-06'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fridays(from: string, to: string): Date[] {
  const [fy, fm, fd] = from.split('-').map(Number)
  const d = new Date(fy, fm - 1, fd)
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)) // first Friday on/after `from`
  const out: Date[] = []
  for (; iso(d) <= to; d.setDate(d.getDate() + 7)) out.push(new Date(d))
  return out
}

export function AttendancePage() {
  const { t, lang } = useI18n()
  const store = useStore()
  const columns = useColumns()
  const { sort } = useSort()
  const [query, setQuery] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const currentCell = useRef<HTMLTableCellElement>(null)

  const days = useMemo(() => fridays(FROM, TO).map(d => ({ date: iso(d), day: d.getDate(), month: `${d.getFullYear()}-${d.getMonth()}`, d })), [])

  // Months as header groups: 4 or 5 Fridays each.
  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })
    const out: { key: string; label: string; count: number }[] = []
    for (const d of days) {
      const last = out[out.length - 1]
      if (last?.key === d.month) last.count++
      else out.push({ key: d.month, label: fmt.format(d.d), count: 1 })
    }
    return out
  }, [days, lang])

  const today = iso(new Date())
  const currentDate = days.find(d => d.date >= today)?.date ?? days[days.length - 1].date
  const firstOfMonth = new Set(days.filter((d, i) => i === 0 || days[i - 1].month !== d.month).map(d => d.date))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = viewRows(store)
    return sortRows(q ? all.filter(r => r.full_name.toLowerCase().includes(q)) : all, columns, sort, lang)
  }, [store, columns, sort, lang, query])

  // Open on this week's Friday instead of October.
  useEffect(() => {
    const cell = currentCell.current
    const box = scroller.current
    if (!cell || !box) return
    const offset = cell.offsetLeft - box.clientWidth / 2 + cell.clientWidth / 2
    box.scrollLeft = document.documentElement.dir === 'rtl' ? -(box.scrollWidth - box.clientWidth - offset) : offset
  }, [rows.length > 0])

  const sticky = 'sticky start-0 z-10 bg-white dark:bg-slate-900'

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
          {t('total')}: {rows.length}
        </span>
        <span className="text-xs text-slate-500">{t('attendanceOrderNote')}</span>
      </div>

      <div ref={scroller} className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="border-separate border-spacing-0 text-sm">
          <thead className="text-slate-600 dark:text-slate-300">
            <tr>
              <th rowSpan={2} className={`${sticky} min-w-44 border-b border-e border-slate-200 px-3 py-2 text-start font-semibold dark:border-slate-800`}>
                {t('name')}
              </th>
              <th rowSpan={2} className="border-b border-e border-slate-200 px-2 py-2 font-semibold dark:border-slate-800" title={t('attendanceTotal')}>
                ∑
              </th>
              {months.map(m => (
                <th
                  key={m.key}
                  colSpan={m.count}
                  className="whitespace-nowrap border-b border-e border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold dark:border-slate-800 dark:bg-slate-800/60"
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {days.map(d => (
                <th
                  key={d.date}
                  ref={d.date === currentDate ? currentCell : undefined}
                  className={`border-b border-slate-200 px-1 py-1.5 text-xs font-semibold dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${
                    d.date === currentDate ? 'bg-indigo-600 text-white' : ''
                  }`}
                >
                  {d.day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={days.length + 2} className="px-3 py-10 text-center text-slate-500">
                  {store.loaded ? t('empty') : t('loading')}
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const total = days.filter(d => isPresent(store, r.client_id, d.date)).length
                return (
                  <tr key={r.client_id} className="group">
                    <td className={`${sticky} border-b border-e border-slate-100 px-3 py-1.5 group-hover:bg-slate-50 dark:border-slate-800 dark:group-hover:bg-slate-800`}>
                      <button onClick={() => go(`/child/${r.client_id}`)} className="whitespace-nowrap text-start font-semibold hover:text-indigo-600 dark:hover:text-indigo-300">
                        {r.full_name}
                      </button>
                    </td>
                    <td className="border-b border-e border-slate-100 px-2 text-center font-bold text-indigo-700 dark:border-slate-800 dark:text-indigo-300">{total}</td>
                    {days.map(d => {
                      const on = isPresent(store, r.client_id, d.date)
                      return (
                        <td
                          key={d.date}
                          className={`border-b border-slate-100 p-1 text-center dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${
                            d.date === currentDate ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                          }`}
                        >
                          <button
                            onClick={() => toggleAttendance(r.client_id, d.date)}
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`${r.full_name} — ${d.date}`}
                            className={`grid size-7 place-items-center rounded-md border-2 transition-colors ${
                              on
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'
                            }`}
                          >
                            {on && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
