import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { DAY_KINDS, childrenLoading, isChecked, isDay, stillInClassFirst, toggleDay, toggleFollowUp, useStore, viewRows, type DayKind, type FollowUpKind } from '../lib/store'
import type { TKey } from '../lib/i18n'
import { sortRows, useColumns, useSort } from '../lib/columns'
import { NoChildren } from '../components/NoChildren'
import { Loading } from '../components/Loading'
import { ClassTitle } from '../components/ClassTitle'
import { currentServiceYear, iso, serviceYearRange } from '../lib/serviceYear'

// Two rows per child, each with its own colour so they are easy to tell apart.
const KINDS: { kind: FollowUpKind; label: TKey; on: string; hover: string }[] = [
  { kind: 'attendance', label: 'rowAttendance', on: 'border-indigo-600 bg-indigo-600 text-white', hover: 'hover:border-indigo-400' },
  { kind: 'visit', label: 'rowVisit', on: 'border-emerald-600 bg-emerald-600 text-white', hover: 'hover:border-emerald-400' },
]

// The two marks a Friday can carry for the whole class, each with its own sign and colour.
const DAY: Record<DayKind, { label: TKey; sign: string; text: string; menuOn: string }> = {
  communion: { label: 'communionDay', sign: '✝', text: 'text-amber-600 dark:text-amber-300', menuOn: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' },
  club: { label: 'clubDay', sign: '⚽', text: 'text-sky-600 dark:text-sky-300', menuOn: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200' },
}

/** Background of a Friday's column: amber for تناول, sky for نادي, both halves when it is both. */
function dayBg(communion: boolean, club: boolean, strong: boolean) {
  if (communion && club)
    return strong
      ? 'bg-linear-to-b from-amber-100 to-sky-100 dark:from-amber-500/15 dark:to-sky-500/15'
      : 'bg-linear-to-b from-amber-50 to-sky-50 dark:from-amber-500/5 dark:to-sky-500/5'
  if (communion) return strong ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-amber-50 dark:bg-amber-500/5'
  if (club) return strong ? 'bg-sky-100 dark:bg-sky-500/15' : 'bg-sky-50 dark:bg-sky-500/5'
  return ''
}

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
  const [dayMenu, setDayMenu] = useState<{ date: string; top: number; left: number } | null>(null)
  const currentCell = useRef<HTMLTableCellElement>(null)
  const currentMonthCell = useRef<HTMLTableCellElement>(null)
  const nameHeader = useRef<HTMLTableCellElement>(null)
  const kindHeader = useRef<HTMLTableCellElement>(null)

  // The Fridays of the class's own service year, so older classes show their own year.
  const year = store.classes.find(c => c.id === store.currentClass)?.service_year ?? currentServiceYear()
  const days = useMemo(() => {
    const { start, end } = serviceYearRange(year)
    return fridays(start, end).map(d => ({ date: iso(d), day: d.getDate(), month: `${d.getFullYear()}-${d.getMonth()}`, d }))
    // the range also moves with the admin's year-end setting (الإعدادات)
  }, [year, store.yearEndWeeks])

  // Months as header groups: 4 or 5 Fridays each.
  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' })
    const out: { key: string; label: string; count: number }[] = []
    for (const d of days) {
      const last = out[out.length - 1]
      if (last?.key === d.month) last.count++
      else out.push({ key: d.month, label: fmt.format(d.d), count: 1 })
    }
    return out
  }, [days, lang])

  // Today if it is Friday, otherwise the coming Friday.
  const today = iso(new Date())
  const currentDate = days.find(d => d.date >= today)?.date ?? days[days.length - 1].date
  const currentMonth = days.find(d => d.date === currentDate)?.month
  const firstOfMonth = new Set(days.filter((d, i) => i === 0 || days[i - 1].month !== d.month).map(d => d.date))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = viewRows(store)
    // same order as the Children page: those who left the class at the bottom
    return stillInClassFirst(sortRows(q ? all.filter(r => r.full_name.toLowerCase().includes(q)) : all, columns, sort, lang))
  }, [store, columns, sort, lang, query])

  // Open with this Friday's whole month in view, starting right after the sticky name columns.
  useEffect(() => {
    const month = currentMonthCell.current
    const box = scroller.current
    if (!month || !box) return
    const stickyWidth = (nameHeader.current?.offsetWidth ?? 0) + (kindHeader.current?.offsetWidth ?? 0)
    const m = month.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    // Measured on screen, so it works the same in Arabic (right-to-left) and English.
    const delta = document.documentElement.dir === 'rtl' ? m.right - (b.right - stickyWidth) : m.left - (b.left + stickyWidth)
    box.scrollLeft += delta
  }, [rows.length > 0, lang])

  // Name and row label stay in view while scrolling across the Fridays.
  const stickyName = 'sticky inset-s-0 z-10 w-44 min-w-44 max-w-44 bg-white dark:bg-slate-900'
  const stickyKind = 'sticky inset-s-44 z-10 w-24 min-w-24 bg-white dark:bg-slate-900'

  // First "loading", then either the grid or — for a class with no children yet — a card saying so.
  // Never an empty grid (same rule as the Children page).
  const count = viewRows(store).length
  const loading = childrenLoading(store, count)
  if (loading || count === 0)
    return (
      <div className="space-y-4">
        <ClassTitle />
        {loading ? <Loading /> : <NoChildren />}
      </div>
    )

  return (
    <div className="space-y-4">
      {dayMenu && <DayMenu {...dayMenu} onClose={() => setDayMenu(null)} />}
      <ClassTitle />
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
        <span className="text-xs text-amber-700 dark:text-amber-300">{t('communionHint')}</span>
      </div>

      <div ref={scroller} className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="border-separate border-spacing-0 text-sm">
          <thead className="text-slate-600 dark:text-slate-300">
            <tr>
              <th ref={nameHeader} rowSpan={2} className={`${stickyName} border-b border-slate-200 px-3 py-2 text-start font-semibold dark:border-slate-800`}>
                {t('name')}
              </th>
              <th ref={kindHeader} rowSpan={2} className={`${stickyKind} border-b border-e border-slate-200 dark:border-slate-800`} />
              <th rowSpan={2} className="border-b border-e border-slate-200 px-2 py-2 font-semibold dark:border-slate-800" title={t('attendanceTotal')}>
                ∑
              </th>
              {months.map(m => (
                <th
                  key={m.key}
                  ref={m.key === currentMonth ? currentMonthCell : undefined}
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
                  className={`border-b border-e border-slate-200 p-0.5 text-xs font-semibold dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${
                    d.date === currentDate ? 'bg-indigo-600 text-white' : dayBg(isDay(store, d.date, 'communion'), isDay(store, d.date, 'club'), true)
                  }`}
                >
                  {/* click a date to choose what that Friday is for the whole class: تناول, نادي, or both */}
                  <button
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setDayMenu(m => (m?.date === d.date ? null : { date: d.date, top: r.bottom + 4, left: r.left + r.width / 2 }))
                    }}
                    title={t('communionHint')}
                    aria-haspopup="menu"
                    aria-expanded={dayMenu?.date === d.date}
                    className="flex w-full flex-col items-center rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {d.day}
                    {/* kept in place when empty so the header doesn't jump */}
                    <span className="flex h-3 items-center gap-px text-[11px] leading-none">
                      {DAY_KINDS.filter(k => isDay(store, d.date, k)).map(k => (
                        <span key={k} className={d.date === currentDate ? '' : DAY[k].text}>
                          {DAY[k].sign}
                        </span>
                      ))}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={days.length + 3} className="px-3 py-10 text-center text-slate-500">
                  {t('noResults')}
                </td>
              </tr>
            ) : (
              rows.flatMap((r, ri) => [
                // the line above the first child who left the class
                r.moved_out_on && !rows[ri - 1]?.moved_out_on && (
                  <tr key="moved-out">
                    <td colSpan={days.length + 3} className="border-y-2 border-slate-300 bg-slate-50 py-1.5 text-xs font-bold text-slate-500 dark:border-slate-600 dark:bg-slate-800/60">
                      <span className="sticky inset-s-0 px-3">
                        {t('movedOut')} ({rows.filter(x => x.moved_out_on).length})
                      </span>
                    </td>
                  </tr>
                ),
                ...KINDS.map(({ kind, label, on: onClass, hover }, i) => {
                  const last = i === KINDS.length - 1
                  // A thicker line closes each child's pair of rows.
                  const bottom = last ? 'border-b-2 border-slate-200 dark:border-slate-700' : 'border-b border-slate-100 dark:border-slate-800'
                  const total = days.filter(d => isChecked(store, r.client_id, d.date, kind)).length
                  return (
                    <tr key={`${r.client_id}-${kind}`} className={r.moved_out_on ? 'opacity-60' : ''}>
                      {i === 0 && (
                        <td rowSpan={KINDS.length} className={`${stickyName} border-b-2 border-slate-200 px-3 py-1.5 align-middle dark:border-slate-700`}>
                          <button
                            onClick={() => go(`/child/${r.client_id}`)}
                            className="text-start font-semibold leading-snug hover:text-indigo-600 dark:hover:text-indigo-300"
                          >
                            {r.full_name}
                          </button>
                        </td>
                      )}
                      <td className={`${stickyKind} ${bottom} border-e px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400`}>{t(label)}</td>
                      <td className={`${bottom} border-e px-2 text-center font-bold text-slate-700 dark:text-slate-200`} title={t('attendanceTotal')}>
                        {total}
                      </td>
                      {days.map(d => {
                        const on = isChecked(store, r.client_id, d.date, kind)
                        return (
                          <td
                            key={d.date}
                            className={`${bottom} border-e border-e-slate-100 p-1 text-center dark:border-e-slate-800 ${firstOfMonth.has(d.date) ? 'border-s border-s-slate-200 dark:border-s-slate-700' : ''} ${
                              d.date === currentDate ? 'bg-indigo-50 dark:bg-indigo-500/10' : dayBg(isDay(store, d.date, 'communion'), isDay(store, d.date, 'club'), false)
                            }`}
                          >
                            <button
                              onClick={() => toggleFollowUp(r.client_id, d.date, kind)}
                              role="checkbox"
                              aria-checked={on}
                              aria-label={`${r.full_name} — ${t(label)} — ${d.date}`}
                              className={`grid size-7 place-items-center rounded-md border-2 transition-colors ${
                                on ? onClass : `border-slate-300 dark:border-slate-600 ${hover}`
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
                }),
              ])
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * What a Friday is for the whole class: تناول, نادي, or both — each one toggles on its own.
 * Fixed on screen under the date, since the grid's scroll box would clip it.
 */
function DayMenu({ date, top, left, onClose }: { date: string; top: number; left: number; onClose: () => void }) {
  const { t } = useI18n()
  const store = useStore()
  const box = useRef<HTMLDivElement>(null)

  // close on a click outside, Escape, or any scroll (it would no longer sit under its date)
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const target = e.target as Element
      // the date that opened it toggles it itself
      if (!box.current?.contains(target) && !target.closest('[aria-expanded="true"]')) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', click)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div
      ref={box}
      role="menu"
      style={{ top, left }}
      className="fixed z-50 w-40 -translate-x-1/2 space-y-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="px-2 pb-1 pt-0.5 text-center text-xs text-slate-400" dir="ltr">
        {date}
      </div>
      {DAY_KINDS.map(k => {
        const on = isDay(store, date, k)
        return (
          <button
            key={k}
            role="menuitemcheckbox"
            aria-checked={on}
            onClick={() => toggleDay(date, k)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm font-semibold ${on ? DAY[k].menuOn : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
          >
            <span className={`w-4 text-center ${on ? '' : DAY[k].text}`}>{DAY[k].sign}</span>
            <span className="flex-1">{t(DAY[k].label)}</span>
            {on && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
