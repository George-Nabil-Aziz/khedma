import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { DAY_KINDS, childrenLoading, cycleDay, cycleVisit, isChecked, visitOf, isDay, stillInClassFirst, toggleFollowUp, useStore, viewRows, type DayKind, type FollowUpKind } from '../lib/store'
import type { TKey } from '../lib/i18n'
import { sortRows, useColumns, useSort } from '../lib/columns'
import { NoChildren } from '../components/NoChildren'
import { Loading } from '../components/Loading'
import { HomeIcon, PhoneIcon } from '../components/Icons'
import { ClassTitle } from '../components/ClassTitle'
import { currentServiceYear, dmy, fridays, iso, serviceYearRange } from '../lib/serviceYear'
import { balance, lastDay, loadTrips, useTrips, type Trip } from '../lib/trips'

// Two rows per child, each with its own colour so they are easy to tell apart.
const KINDS: { kind: FollowUpKind; label: TKey; on: string; hover: string }[] = [
  { kind: 'attendance', label: 'rowAttendance', on: 'border-indigo-600 bg-indigo-600 text-white', hover: 'hover:border-indigo-400' },
  { kind: 'visit', label: 'rowVisit', on: 'border-emerald-600 bg-emerald-600 text-white', hover: 'hover:border-emerald-400' },
]

// The two marks a Friday can carry for the whole class, each with its own sign and colour.
const DAY: Record<DayKind, { label: TKey; sign: string; text: string }> = {
  communion: { label: 'communionDay', sign: '✝', text: 'text-amber-600 dark:text-amber-300' },
  club: { label: 'clubDay', sign: '⚽', text: 'text-sky-600 dark:text-sky-300' },
}

/**
 * Background of a Friday's column: amber for تناول, sky for نادي, both when it is both.
 * The date itself (head) one step darker than the rows under it.
 */
function dayBg(communion: boolean, club: boolean, head = false) {
  if (communion && club)
    return head
      ? 'bg-linear-to-b from-amber-300/70 to-sky-300/70 dark:from-amber-500/35 dark:to-sky-500/35'
      : 'bg-linear-to-b from-amber-200/60 to-sky-200/60 dark:from-amber-500/20 dark:to-sky-500/20'
  if (communion) return head ? 'bg-amber-300/70 dark:bg-amber-500/35' : 'bg-amber-200/60 dark:bg-amber-500/20'
  if (club) return head ? 'bg-sky-300/70 dark:bg-sky-500/35' : 'bg-sky-200/60 dark:bg-sky-500/20'
  return head ? 'bg-slate-100 dark:bg-slate-800' : ''
}

// The coming Friday (or today's): a rose frame drawn inside its cells, so its own colour still shows.
const THIS_FRIDAY = 'shadow-[inset_2px_0_0_var(--color-rose-500),inset_-2px_0_0_var(--color-rose-500)]'
// the very last row also closes the frame at the bottom
const THIS_FRIDAY_LAST = 'shadow-[inset_2px_0_0_var(--color-rose-500),inset_-2px_0_0_var(--color-rose-500),inset_0_-2px_0_var(--color-rose-500)]'
const THIS_FRIDAY_HEAD = 'shadow-[inset_2px_0_0_var(--color-rose-500),inset_-2px_0_0_var(--color-rose-500),inset_0_2px_0_var(--color-rose-500)] text-rose-700 dark:text-rose-300'

// A trip's day: violet, in the الرحلات row and down the whole column when it is not a Friday.
const TRIP_HEAD = 'bg-violet-200/70 dark:bg-violet-500/30'
const TRIP_COL = 'bg-violet-100/60 dark:bg-violet-500/10'

export function AttendancePage() {
  const { t, lang } = useI18n()
  const store = useStore()
  const columns = useColumns()
  const { sort } = useSort()
  const [query, setQuery] = useState('')

  // The Fridays of the class's own service year, so older classes show their own year.
  const year = store.classes.find(c => c.id === store.currentClass)?.service_year ?? currentServiceYear()
  const allDays = useMemo(() => {
    const { start, end } = serviceYearRange(year)
    return fridays(start, end).map(d => ({ date: iso(d), day: d.getDate(), month: `${d.getFullYear()}-${d.getMonth()}`, d }))
    // the range also moves with the admin's year-end setting (الإعدادات)
  }, [year, store.yearEndWeeks])

  // الرحلات of this class in this service year, on every one of their days
  const { trips, going, payments } = useTrips()
  useEffect(() => {
    loadTrips()
  }, [store.currentClass])
  const tripsByDate = useMemo(() => {
    const { start, end } = serviceYearRange(year)
    const out = new Map<string, { trip: Trip; first: boolean }[]>()
    for (const trip of trips) {
      if (trip.class_id !== store.currentClass || !trip.trip_date) continue
      const last = lastDay(trip)!
      for (const d = new Date(trip.trip_date + 'T00:00'); iso(d) <= last; d.setDate(d.getDate() + 1)) {
        const date = iso(d)
        if (date >= start && date <= end) out.set(date, [...(out.get(date) ?? []), { trip, first: date === trip.trip_date }])
      }
    }
    return out
  }, [trips, store.currentClass, year, store.yearEndWeeks])

  // The Fridays, plus a column of its own for a trip on another day. ∑ still counts Fridays only.
  const allCols = useMemo(() => {
    const cols = allDays.map(d => ({ ...d, friday: true, trips: tripsByDate.get(d.date) ?? [] }))
    for (const [date, list] of tripsByDate)
      if (!cols.some(c => c.date === date)) {
        const d = new Date(date + 'T00:00')
        cols.push({ date, day: d.getDate(), month: `${d.getFullYear()}-${d.getMonth()}`, d, friday: false, trips: list })
      }
    return cols.sort((a, b) => a.date.localeCompare(b.date))
  }, [allDays, tripsByDate])
  const time = (t: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${t}`))

  // Today if it is Friday, otherwise the coming Friday.
  const today = iso(new Date())
  const currentDate = allDays.find(d => d.date >= today)?.date ?? allDays[allDays.length - 1].date

  // "النهاردة": only the coming Friday's column; "الكل" brings every Friday back (the start)
  const [onlyToday, setOnlyToday] = useState(false)
  const days = useMemo(() => (onlyToday ? allCols.filter(d => d.date === currentDate) : allCols), [allCols, onlyToday, currentDate])

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

  const firstOfMonth = new Set(days.filter((d, i) => i === 0 || days[i - 1].month !== d.month).map(d => d.date))

  // The الرحلات row: side-by-side days with the same trips make one cell, so a trip of several
  // days is written once across them.
  const tripsKey = (d: (typeof days)[number]) => d.trips.map(x => x.trip.id).join()
  const tripCells: { d: (typeof days)[number]; span: number }[] = []
  for (const d of days) {
    const prev = tripCells[tripCells.length - 1]
    if (prev && d.trips.length && tripsKey(prev.d) === tripsKey(d)) prev.span++
    else tripCells.push({ d, span: 1 })
  }

  // الفلتر: who missed the last Friday (for الافتقاد), or — per trip — who is going, who is not,
  // who still owes. "absent", or "going" / "notGoing" / "owes" + ":" + the trip's id.
  const [filter, setFilter] = useState('all')
  useEffect(() => setFilter('all'), [store.currentClass])
  const lastFriday = [...allDays].reverse().find(d => d.date <= today)?.date
  const classTrips = useMemo(
    () => trips.filter(tr => tr.class_id === store.currentClass).sort((a, b) => (b.trip_date ?? '9999').localeCompare(a.trip_date ?? '9999')),
    [trips, store.currentClass],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const [what, id] = filter.split(':')
    const trip = classTrips.find(tr => tr.id === id)
    const keep = (r: (typeof all)[number]) => {
      if (what === 'absent') return !!lastFriday && !r.moved_out_on && !isChecked(store, r.client_id, lastFriday, 'attendance')
      if (!trip) return true // "all", or a trip deleted meanwhile
      const g = going.find(x => x.trip_id === trip.id && x.child_client_id === r.client_id)
      if (what === 'going') return !!g
      if (what === 'notGoing') return !g && !r.moved_out_on
      return !!g && balance(trip, r.client_id, r.category, payments).left > 0 // owes
    }
    const all = viewRows(store)
    // same order as the Children page: those who left the class at the bottom
    return stillInClassFirst(sortRows(all.filter(r => (!q || r.full_name.toLowerCase().includes(q)) && keep(r)), columns, sort, lang))
  }, [store, columns, sort, lang, query, filter, classTrips, going, payments, lastFriday])

  // Name and row label stay in view while scrolling across the Fridays.
  // Narrow on a phone, so the Fridays still get most of the screen.
  const stickyName = 'sticky inset-s-0 z-10 w-24 min-w-24 max-w-24 sm:w-44 sm:min-w-44 sm:max-w-44'
  const stickyKind = 'sticky inset-s-24 sm:inset-s-44 z-10 w-16 min-w-16 sm:w-24 sm:min-w-24'
  const headBg = 'bg-white dark:bg-slate-900'
  // every other child on a light band (both of its rows); opaque, as the name cells stay on top while scrolling
  const band = (i: number) => (i % 2 ? 'bg-[#e9eef4] dark:bg-slate-800' : 'bg-white dark:bg-slate-900') // between slate-100 and -200

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
      <ClassTitle />
      {/* search and the count; how the grid works is under الإعدادات → طريقة الاستخدام */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          className="min-w-40 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:max-w-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder={t('searchName')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label={t('filter')}
          className={`min-w-0 max-w-full shrink rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 ${
            filter === 'all' ? 'border-slate-300 bg-white dark:border-slate-700' : 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
          }`}
        >
          <option value="all">{t('filterAll')}</option>
          {lastFriday && (
            <option value="absent">
              {t('filterAbsent').replace('{date}', dmy(lastFriday))}
            </option>
          )}
          {classTrips.map(tr => (
            <optgroup key={tr.id} label={`🚌 ${tr.name}`}>
              <option value={`going:${tr.id}`}>{t('filterGoing')}</option>
              <option value={`notGoing:${tr.id}`}>{t('filterNotGoing')}</option>
              {!!(tr.price || tr.hidden_price || tr.brothers_price) && <option value={`owes:${tr.id}`}>{t('filterOwes')}</option>}
            </optgroup>
          ))}
        </select>
        <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {t('total')}: {rows.length}
        </span>
        {/* النهاردة ⇄ الكل: just the coming Friday, or every Friday of the year */}
        <button
          onClick={() => setOnlyToday(v => !v)}
          aria-pressed={onlyToday}
          className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
        >
          {t(onlyToday ? 'all' : 'today')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="border-separate border-spacing-0 text-sm">
          <thead className="text-slate-600 dark:text-slate-300">
            <tr>
              <th rowSpan={2} className={`${stickyName} ${headBg} border-b border-slate-200 px-2 py-2 text-start font-semibold sm:px-3 dark:border-slate-800`}>
                {t('name')}
              </th>
              <th rowSpan={2} className={`${stickyKind} ${headBg} border-b border-e border-slate-200 dark:border-slate-800`} />
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
              {days.map(d =>
                !d.friday ? (
                  // a trip's own day: no تناول / نادي marks to set (the 🚌 is in the الرحلات row)
                  <th key={d.date} className={`border-b border-e border-slate-200 p-0.5 text-xs font-semibold dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${TRIP_HEAD}`}>
                    <span className="flex flex-col items-center px-1 py-0.5">
                      {d.day}
                      <span className="h-3" />
                    </span>
                  </th>
                ) : (
                <th
                  key={d.date}
                  className={`border-b border-e border-slate-200 p-0.5 text-xs font-semibold dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${
                    dayBg(isDay(store, d.date, 'communion'), isDay(store, d.date, 'club'), true)
                  } ${d.date === currentDate ? THIS_FRIDAY_HEAD : ''}`}
                >
                  {/* each tap on a date, for the whole class: nothing → ✝ تناول → ⚽ نادي → both → nothing */}
                  <button
                    onClick={() => cycleDay(d.date)}
                    title={DAY_KINDS.filter(k => isDay(store, d.date, k)).map(k => t(DAY[k].label)).join(' + ') || t('communionHint')}
                    className="flex w-full flex-col items-center rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {d.day}
                    {/* kept in place when empty so the header doesn't jump */}
                    <span className="flex h-3 items-center gap-px text-[11px] leading-none">
                      {DAY_KINDS.filter(k => isDay(store, d.date, k)).map(k => (
                        <span key={k} className={DAY[k].text}>
                          {DAY[k].sign}
                        </span>
                      ))}
                    </span>
                  </button>
                </th>
                ),
              )}
            </tr>
            {/* الرحلات: name and gathering time under the trip's days, written once across all of
                them — tap it for the trip */}
            {tripsByDate.size > 0 && (
              <tr>
                <th colSpan={2} className={`sticky inset-s-0 z-10 ${headBg} border-b border-e border-slate-200 px-2 py-1 text-start text-xs font-semibold sm:px-3 dark:border-slate-800`}>
                  {t('trips')}
                </th>
                <th className="border-b border-e border-slate-200 dark:border-slate-800" />
                {tripCells.map(({ d, span }) => (
                  <th
                    key={d.date}
                    colSpan={span}
                    className={`border-b border-e border-slate-200 p-0.5 align-top text-[11px] font-semibold dark:border-slate-800 ${firstOfMonth.has(d.date) ? 'border-s' : ''} ${
                      d.trips.length ? TRIP_HEAD : ''
                    } ${span === 1 && d.date === currentDate ? THIS_FRIDAY : ''}`}
                  >
                    {d.trips.map(({ trip: tr, first }) => (
                      <button
                        key={tr.id}
                        onClick={() => go(`/trip/${tr.id}`)}
                        title={[tr.name, tr.place, tr.gather_time && `${t('gathering')}: ${time(tr.gather_time)}`, tr.gather_place].filter(Boolean).join(' — ')}
                        className={`block w-full rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10 ${span === 1 ? 'max-w-20' : ''}`}
                      >
                        <span className="block truncate">🚌 {tr.name}</span>
                        {/* the gathering is on the first day only */}
                        {first && tr.gather_time && <span className="block font-normal text-slate-500 dark:text-slate-400">{time(tr.gather_time)}</span>}
                      </button>
                    ))}
                  </th>
                ))}
              </tr>
            )}
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
                      {/* a block, or sticky does nothing: stays in view with the names while scrolling across */}
                      <span className="sticky inset-s-0 inline-block px-3">
                        {t('movedOut')} ({rows.filter(x => x.moved_out_on).length})
                      </span>
                    </td>
                  </tr>
                ),
                ...KINDS.map(({ kind, label, on: onClass, hover }, i) => {
                  const last = i === KINDS.length - 1
                  // A thicker line closes each child's pair of rows.
                  const bottom = last ? 'border-b-2 border-slate-200 dark:border-slate-700' : 'border-b border-slate-100 dark:border-slate-800'
                  // the whole year, even while only the coming Friday is shown
                  const total = allDays.filter(d => isChecked(store, r.client_id, d.date, kind)).length
                  // Left the class: faded — the contents only, never a whole row or cell, or the name
                  // cells (sticky) turn see-through and the scrolled Fridays show behind them.
                  const dim = r.moved_out_on ? 'opacity-60' : ''
                  return (
                    <tr key={`${r.client_id}-${kind}`} className={band(ri)}>
                      {i === 0 && (
                        <td rowSpan={KINDS.length} className={`${stickyName} ${band(ri)} border-b-2 border-slate-200 px-2 py-1.5 align-middle sm:px-3 dark:border-slate-700`}>
                          <button
                            onClick={() => go(`/child/${r.client_id}`)}
                            className={`text-start text-xs font-semibold leading-snug hover:text-indigo-600 sm:text-sm dark:hover:text-indigo-300 ${dim}`}
                          >
                            {r.full_name}
                          </button>
                        </td>
                      )}
                      <td className={`${stickyKind} ${band(ri)} ${bottom} border-e px-1.5 py-1 text-xs font-semibold text-slate-500 sm:px-2 dark:text-slate-400`}>
                        <span className={dim}>{t(label)}</span>
                      </td>
                      <td className={`${bottom} border-e px-2 text-center font-bold text-slate-700 dark:text-slate-200`} title={t('attendanceTotal')}>
                        <span className={dim}>{total}</span>
                      </td>
                      {days.map(d => {
                        // a trip's own day: nothing to tick for الحضور / الافتقاد
                        if (!d.friday)
                          return <td key={d.date} className={`${bottom} border-e border-e-slate-100 dark:border-e-slate-800 ${firstOfMonth.has(d.date) ? 'border-s border-s-slate-200 dark:border-s-slate-700' : ''} ${TRIP_COL}`} />
                        const on = isChecked(store, r.client_id, d.date, kind)
                        // الافتقاد: 📞 phone or 🏠 home — each tap moves to the next (then back to empty)
                        const visit = kind === 'visit' ? visitOf(store, r.client_id, d.date) : null
                        const visitLabel = visit === 'phone' ? t('visitPhone') : visit === 'home' ? t('visitHome') : null
                        return (
                          <td
                            key={d.date}
                            className={`${bottom} border-e border-e-slate-100 p-1 text-center dark:border-e-slate-800 ${firstOfMonth.has(d.date) ? 'border-s border-s-slate-200 dark:border-s-slate-700' : ''} ${
                              dayBg(isDay(store, d.date, 'communion'), isDay(store, d.date, 'club'))
                            } ${d.date === currentDate ? (last && ri === rows.length - 1 ? THIS_FRIDAY_LAST : THIS_FRIDAY) : ''}`}
                          >
                            <button
                              onClick={() => (kind === 'visit' ? cycleVisit(r.client_id, d.date) : toggleFollowUp(r.client_id, d.date, kind))}
                              role="checkbox"
                              aria-checked={on}
                              aria-label={`${r.full_name} — ${t(label)} — ${dmy(d.date)}${visitLabel ? ` — ${visitLabel}` : ''}`}
                              title={kind === 'visit' ? (visitLabel ?? t('visitHint')) : undefined}
                              className={`grid size-7 place-items-center rounded-md border-2 transition-colors ${dim} ${
                                on ? onClass : `border-slate-300 dark:border-slate-600 ${hover}`
                              }`}
                            >
                              {visit === 'phone' ? (
                                <PhoneIcon className="size-4" />
                              ) : visit === 'home' ? (
                                <HomeIcon className="size-4" />
                              ) : (
                                on && (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                )
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
